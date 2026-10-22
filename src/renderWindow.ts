import type { LoadedTheme, WindowState, WindowType } from './types.js';
import { assetUrl, findChromeElement } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { composeWindowChrome, type ComposedChrome } from './composeChrome.js';
// The built-in frame (the `wt.model === 'corner-sprite'` branch: schemes with no
// wnd# recipe) draws through the v2 engine family proceduralFrame, dynamically
// imported so the 13 wnd# themes don't load it on first paint.
import { rasterizeText } from './textRaster.js';
import { rasterizeTitleFont } from './titleFont.js';
import { PixelBuffer } from './pixelBuffer.js';
import { resolveWindowSelection } from './resolveWindowType.js';
import { canonicalWindowTypeSlug } from './wndCascade.js';

/** Pixels reserved between the title plate's edge and the nearest title-bar widget.
 *  Used by BOTH the plate sizing (so the plate grows wide enough that a widget
 *  immediately adjacent to it doesn't overlap the title text's footprint) AND the
 *  truncation budget (so the truncator's `maxTitleW` reserves the same margin on
 *  each side). The two sites MUST use the same constant — when they diverged
 *  before this constant was named, schemes with tight title bars (windows-95,
 *  floppies, apple-lisa) truncated "Hello!" to "Hel…". Period-faithful: mirrors
 *  the kDEF's `0x4f18` plate-tile pass which measured with trailing space too. */
const TITLE_WIDGET_CLEARANCE_PX = 5;

/** Pixels of visual padding around the title glyph WITHIN the plate (independent
 *  of the widget-clearance budget — this is the inset between the plate's left/
 *  right edges and the glyph's left/right edges, NOT between plate and widget). */
const TITLE_PLATE_VISUAL_PAD_PX = 8;

export interface RenderWindowOptions {
  /** Window-type slug. Default `'document-window'`. */
  windowType?: string;
  /** Chrome state. Default `'active'`. */
  state?: WindowState;
  /** Title text. Default `''`. */
  title?: string;
  /** Content-rect width in px (the user-resizable area). Default 240. */
  width?: number;
  /** Content-rect height in px. Default 120. */
  height?: number;
  /** Integer display scale (crisp upscaling via CSS). Default 1. */
  scale?: number;
  /** Render one title-bar widget in its PRESSED state (mouse held down on it).
   *  Built-in-frame schemes (no wnd#) draw the widget's pressed icon (procedural-frame
   *  §2 parts 4/5/9: close -14333, zoom -14331, collapse -14332); native-recipe schemes
   *  (widget baked into the title cicn) darken its rect. */
  pressedWidget?: TitleWidgetRole;
  /** Optional canvas element to REUSE for the chrome painting (saves a per-render
   *  allocation). Width and height are reset to the new chrome size, which clears
   *  the buffer; we then putImageData the new pixels. WindowManager passes this
   *  from `ManagedWindow.chromeCanvas` to avoid allocating a fresh canvas on
   *  every focus / theme / size change. Demos calling renderWindow directly
   *  (no reuse) omit it and get a fresh canvas as before. (See issue #171, the
   *  2026-05-28 perf review, and the LEARNINGS "Classic Mac OS lessons" entry —
   *  pattern #5: persistent off-screen buffer.) */
  reuseCanvas?: HTMLCanvasElement;
}

/** A title-bar widget action, independent of its authored position. */
export type TitleWidgetRole = 'close' | 'zoom' | 'collapse';

/**
 * Resolve title-bar widget rects (UNSCALED, in composed-buffer pixel space) from the `wnd#`
 * parts, mapped onto the stretched window. Press feedback and interactive hit testing
 * share this resolver. The rectangle list carries semantic part IDs: 1 close,
 * 2 zoom, 3 collapse; 0 is the body and 4 the title marker. These are NOT the
 * separate side-list recipe codes. kDEF 0x5ffc maps selectors 0/1/3 to these
 * parts; hit dispatch 0x4138/0x4176/0x41d0 returns close/zoom/collapse.
 * Preserve those IDs even when a scheme puts close on the right or stacks its
 * widgets vertically. Geometry follows the actual compositor placements through the
 * kDEF's 0x5cb6 remap (below), so e.g. 1990's widgets left of a grown title plate
 * shift with their own cells (docs/spec/kdef231-code10-widgets.md §4).
 */
export function resolveTitleWidgetRects(
  wt: WindowType,
  composed: ComposedChrome,
): { role: TitleWidgetRole; rect: { x: number; y: number; w: number; h: number } }[] {
  // Built-in frame (proceduralFrameChrome): ONE `edge:'widget'` placement whose `rects` are the
  // widgets left to right and whose `role` joins their names (e.g. "close/zoom/collapse").
  const ws = composed.placement.find((s) => s.edge === 'widget');
  if (ws && ws.rects.length) {
    const roles = ws.role.split('/');
    const out: { role: TitleWidgetRole; rect: { x: number; y: number; w: number; h: number } }[] = [];
    ws.rects.forEach((r, i) => {
      const role = roles[i];
      if (role === 'close' || role === 'zoom' || role === 'collapse') out.push({ role, rect: { x: r.x, y: r.y, w: r.w, h: r.h } });
    });
    return out;
  }
  // Native wnd# model: the kDEF's 0x5cb6 template → placed remap. Each drawn
  // side segment (sides in 0x5356 order top, bottom, left, right; segments from
  // index 1, 0x5d26) is a template cell `src` with a placed cell `rects[0]`.
  // The rect's topLeft is translated by the (placed − template) offset of the
  // first template cell containing it (PtInRect is half-open, 0x5d4a..0x5d76);
  // botRight − 1 is matched separately and translates bottom/right by its own
  // cell (0x5d78..0x5da4). If either corner matches no cell the rect is emptied
  // (0x5dc6..0x5dd0), so the widget has no hit or press area. A cell collapsed
  // to width 0 keeps its template rect, so its widget lands, at full size, at
  // the collapse point (still hit-testable, as 0x5ddc uses the same remap at
  // 0x5f72). The leading [0, border[0]) region and the runtime's far-edge cap
  // are not segments and never match.
  const order = ['top', 'bottom', 'left', 'right'] as const;
  const segs = order.flatMap((edge) => composed.placement.filter((s) => s.edge === edge && (s.segment ?? 1) >= 1 && s.rects.length > 0));
  if (!segs.length || !wt.parts) return [];
  const delta = (x: number, y: number): { dx: number; dy: number } | null => {
    const hit = segs.find((s) => x >= s.src.x && x < s.src.x + s.src.w && y >= s.src.y && y < s.src.y + s.src.h);
    return hit ? { dx: hit.rects[0]!.x - hit.src.x, dy: hit.rects[0]!.y - hit.src.y } : null;
  };
  const out: { role: TitleWidgetRole; rect: { x: number; y: number; w: number; h: number } }[] = [];
  const roles = { 'part-1': 'close', 'part-2': 'zoom', 'part-3': 'collapse' } as const;
  for (const [part, role] of Object.entries(roles)) {
    // 0x41be: no collapse hit when 0x487e is false (shade flag cleared at 0x4e3a).
    if (role === 'collapse' && composed.shadeCleared) continue;
    const rect = wt.parts[part]?.rect;
    if (!rect) continue;
    const [l, t, r, b] = rect;
    if (r <= l || b <= t) continue;
    const tl = delta(l, t), br = delta(r - 1, b - 1);
    if (!tl || !br) continue;
    const x = l + tl.dx, y = t + tl.dy, w = r + br.dx - x, h = b + br.dy - y;
    if (w <= 0 || h <= 0) continue;
    out.push({ role, rect: { x, y, w, h } });
  }
  return out;
}

/** Darken a rect of a chrome buffer to read as a "pressed in" title-bar widget — the synthesized
 *  press for native-recipe schemes that bake the widget into the title cicn (no pressed art). */
function pressRect(buf: PixelBuffer, r: { x: number; y: number; w: number; h: number }): void {
  const x1 = Math.min(buf.width, r.x + r.w), y1 = Math.min(buf.height, r.y + r.h);
  for (let y = Math.max(0, r.y); y < y1; y++) {
    for (let x = Math.max(0, r.x); x < x1; x++) {
      const [pr, pg, pb, pa] = buf.getPixel(x, y);
      if (pa > 0) buf.setPixel(x, y, Math.round(pr * 0.6), Math.round(pg * 0.6), Math.round(pb * 0.6), pa);
    }
  }
}

/**
 * Build one themed window. The chrome is composed at native resolution by
 * the pixel compositor (faithful CopyBits replay), blitted to a <canvas>
 * that sits BEHIND real DOM content; CSS does only positioning + integer
 * upscale (image-rendering: pixelated = sample-and-hold). The consumer's
 * width/height is the CONTENT rect; chrome extends outside it.
 */
export async function renderWindow(
  theme: LoadedTheme,
  opts: RenderWindowOptions = {},
): Promise<HTMLElement> {
  const requestedSlug = opts.windowType ?? 'document-window';
  const slug = canonicalWindowTypeSlug(requestedSlug);
  const state: WindowState = opts.state ?? 'active';
  const title = opts.title ?? '';
  const contentW = opts.width ?? 240;
  const contentH = opts.height ?? 120;
  const scale = Math.max(1, Math.round(opts.scale ?? 1));

  // Find the first theme in the base chain with renderable chrome for this slug.
  // Some schemes ship NO window-frame chrome (e.g. "Apple Platinum 2": its window
  // resources are 16px proxy icons, no wnd# side recipe). They DEFER to their base
  // theme's window chrome (the real Platinum baseline); the resolved `owner` is the
  // bundle the chrome + body assets are loaded from. With nothing in the chain, a
  // procedural default window from the (original) scheme's header colors renders
  // (North Star: render any scheme).
  const resolved = resolveWindowSelection(theme, requestedSlug, state);
  if (!resolved) {
    const utility = /utility|mini|floating|palette/.test(slug);
    return buildBaselineWindow(theme, { title, state, contentW, contentH, scale, utility, slug });
  }
  const { owner, wt, cicnPath } = resolved;
  // (chromeElement lookup kept for validation / future metadata use)
  findChromeElement(owner, cicnPath);

  // The sliced path walks the chrome cicn; the built-in frame loads its own art by id.
  const cicn = wt.model === 'corner-sprite' ? null : await loadCicnBuffer(assetUrl(owner, cicnPath));

  // Utility / mini / floating / palette windows usually carry NO visible title — the label is
  // screen-reader-only via aria-label. EXCEPT `titled-utility-window` (literally named for having
  // one): classic Mac apps put a short title in its small horizontal bar — Inspector / Tool /
  // Options windows all had labels. side-floating-utility / no-title-utility / mini / palette
  // types stay headless (they either have a vertical side strip with no room for horizontal text,
  // or are named "no-title" for a reason).
  // The showTitle gate uses the SAME predicate as bodyBackgroundStyle's slug check —
  // see UTILITY_SLUG_RE below. Two definitions of "utility-ish" silently drifting
  // was the bug class the title-bar + body-bg regressions split into.
  const isUtility = UTILITY_SLUG_RE.test(slug);
  const isTitledUtility = /^titled-utility-window/.test(slug);
  const showTitle = !!title && (!isUtility || isTitledUtility);

  // ── title geometry: the title TEXT is a CENTRED part (kDEF placement mode 0).
  // We rasterize it (width pass) BEFORE composing so the compositor can reserve
  // the measured title-text width for the title-plate cell (code 5) — the kDEF
  // measures the title via StringWidth and sizes that cell to it (0x4a64/0x5034),
  // tiling the plate src across it (the "pill" behind the title). Without that
  // the plate stays its tiny src width and the text spills onto the bezel. ──
  const frameTop = wt.parts['part-0']?.rect[1] ?? 0;
  const builtInFrame = wt.model === 'corner-sprite';
  let glyphs: PixelBuffer | null = null;
  let textH = 0;
  if (showTitle && frameTop > 6 && !builtInFrame) {
    textH = Math.max(8, Math.min(13, frameTop - 6)); // ~Chicago 12px, never frame-scaled
    // Canvas text only uses a font that's ALREADY loaded — so ensure the
    // "Charcoal" @font-face is ready before we rasterize, else ctx.font silently
    // falls back to sans-serif. The face caches after the first load.
    if (typeof document !== 'undefined' && document.fonts?.load) {
      try { await document.fonts.load(`16px "Charcoal 12"`); } catch { /* ignore */ }
      try { await document.fonts.load(`${textH}px Charcoal`); } catch { /* ignore */ }
    }
    // Title in the "Charcoal" font (period anti-aliased type); pixel rasterizer
    // is the fallback (non-DOM contexts). Width pass; recoloured below.
    glyphs = rasterizeTitleFont(title, textH, '#000000') ?? rasterizeText(title, textH, '#000000');
  }
  // Plate width = measured title width + a little padding each side (the kDEF
  // measures with trailing space, 0x4f18); 0 when there's no visible title.
  // The plate sizing + the truncation-budget math at L356 use the SAME
  // widget-clearance constant — make it named so a future tune of one site
  // can't desync the other (the regression class this fixes: schemes whose
  // recipe places a widget immediately after the plate had `maxTitleW <
  // glyph_width` and the title truncated to "Hel…"). Period-faithful in
  // spirit: the kDEF's plate-tile pass `0x4f18` measures with trailing
  // space too — same idea, smaller constant.
  const titleWidthPx = glyphs ? glyphs.width + TITLE_PLATE_VISUAL_PAD_PX + TITLE_WIDGET_CLEARANCE_PX * 2 : 0;

  // Built-in frame windows (no wnd# recipe: apple-platinum-2, black-platinum,
  // platinum-8, slimes, system7-nostalgia-silver) draw through the v2 engine
  // (docs/spec/engine/procedural-frame.md), title text and pressed widget included.
  let composed;
  if (builtInFrame) {
    const key = Object.entries(owner.manifest.windowTypes ?? {}).find(([, v]) => v === wt)?.[0] ?? slug;
    const { composeProceduralFrameChrome } = await import('./proceduralFrameChrome.js');
    composed = await composeProceduralFrameChrome(owner, canonicalWindowTypeSlug(key), state, contentW, contentH, {
      title: showTitle ? title : '',
      ...(opts.pressedWidget ? { pressedWidget: opts.pressedWidget } : {}),
    });
  } else {
    // popup-window requests are service slot 8 (procID 1008 + varCode, family 63 → the family-63 flag, 0x3210).
    composed = composeWindowChrome(cicn!, wt, contentW, contentH, { cinf: wt.cinf ?? null, titleWidthPx, popupFamily: slug === 'popup-window' });
    // Native-recipe widgets are baked into the title cicn (no pressed art), so synthesize the
    // press by darkening the held widget's rect (corner-sprite schemes used the pressed glyph above).
    if (opts.pressedWidget && wt) {
      const wr = resolveTitleWidgetRects(wt, composed).find((w) => w.role === opts.pressedWidget);
      if (wr) pressRect(composed.buffer, wr.rect);
    }
  }
  const { frame, fullWidth, fullHeight } = composed;

  if (glyphs && frame.top > 6) {
    const tr = composed.titleRegion;
    const cx = tr.x + tr.w / 2;
    // Vertical anchor: the centre of the scheme's title-text marker band (tr.midY — the cicn
    // colour-sample line), faithful for tall ornate bars (evolution); else the bar's geometric centre.
    const titleMidY = tr.midY ?? frame.top / 2;

    // TRUNCATION — the available title width is the gap between the close (left) and zoom/collapse
    // (right) widgets, centred at cx. When the full title can't fit (a narrow window) we truncate it
    // with an ellipsis, and when even "…" can't fit we drop the title entirely — Mac OS behaviour
    // ("Infinite HD" → "Infi…" → nothing). Widget rects come from the SAME resolver the hit-testing
    // uses, so the text never runs under a widget.
    const wrects = resolveTitleWidgetRects(wt, composed);
    // Available title width starts from the titleRegion — the kDEF placed a title PLATE
    // there that's already sized to fit the title. Widget rects only further CLIP it
    // when they actually overlap the title region (Mac OS 8.5+ Platinum: zoom/collapse
    // can intrude into the bar's middle). Schemes like 1990 stack widgets to the LEFT of
    // the plate; the widgets sit OUTSIDE the title region so they don't constrain it.
    const trLeft = tr.x;
    const trRight = tr.x + tr.w;
    const leftEnd = wrects
      .filter((w) => w.rect.x + w.rect.w > trLeft && w.rect.x < trRight && (w.rect.x + w.rect.w / 2) < cx)
      .reduce((m, w) => Math.max(m, w.rect.x + w.rect.w), trLeft);
    const rightStart = wrects
      .filter((w) => w.rect.x + w.rect.w > trLeft && w.rect.x < trRight && (w.rect.x + w.rect.w / 2) >= cx)
      .reduce((m, w) => Math.min(m, w.rect.x), trRight);
    const maxTitleW = Math.max(0, Math.floor(2 * Math.min(cx - (leftEnd + TITLE_WIDGET_CLEARANCE_PX), (rightStart - TITLE_WIDGET_CLEARANCE_PX) - cx)));
    let dispTitle = title;
    if (glyphs.width > maxTitleW && title.length > 1) {
      dispTitle = '…';
      for (let n = title.length - 1; n >= 1; n--) {
        const cand = `${title.slice(0, n)}…`;
        const cg = rasterizeTitleFont(cand, textH, '#000000') ?? rasterizeText(cand, textH, '#000000');
        if (cg && cg.width <= maxTitleW) { dispTitle = cand; break; }
      }
    }
    const baseGlyphs = dispTitle === title ? glyphs : (rasterizeTitleFont(dispTitle, textH, '#000000') ?? rasterizeText(dispTitle, textH, '#000000'));
    if (baseGlyphs && baseGlyphs.width <= maxTitleW) {
      // Title colour CONTRASTS with the bar the text sits on: sample the composed buffer over the
      // text's OWN footprint (the title plate / pinstripe), not the dark frame — a dark bar (Black
      // Platinum) gets WHITE text; light bars keep BLACK. NOT headerColors.text (a frame tint).
      const sgx = Math.max(1, Math.min(fullWidth - baseGlyphs.width - 1, Math.round(cx - baseGlyphs.width / 2)));
      const sgy = Math.max(1, Math.round(titleMidY - baseGlyphs.height / 2));
      let lumSum = 0, lumN = 0;
      const sx1 = Math.min(fullWidth, sgx + baseGlyphs.width), sy1 = Math.min(frame.top - 1, sgy + baseGlyphs.height);
      for (let sy = sgy; sy < sy1; sy++) for (let sx = sgx; sx < sx1; sx++) {
        const [pr, pg, pb, pa] = composed.buffer.getPixel(sx, sy);
        if (pa < 8) continue;
        lumSum += 0.299 * pr + 0.587 * pg + 0.114 * pb; lumN++;
      }
      // Title colour priority:
      //   1. The AUTHORED colour from the kDEF title-text marker (`0x5530`) — IF
      //      it contrasts with the bar's average luminance. The marker is a 1-pixel
      //      hint the artist drew INTO the title cicn; sometimes it's filled with
      //      the title-text color (the faithful "draw white-on-blue" hint), sometimes
      //      it's filled with the bar's BG color (the artist used it only as a
      //      position marker, not a color hint — windows-31's marker pixel is on
      //      the dark blue title bar, so sampling it gives dark blue → invisible
      //      title text). Reject the sample when |marker - bar avg| is small.
      //   2. Luminance-contrast B/W on the composed bar's pixels (the fallback
      //      path; what every current corpus render uses).
      // Active windows take the authored colour at full saturation; inactive ones
      // dim it toward grey to match the classic Mac convention.
      const authored = composed.titleFillRgb;
      let useAuthored = false;
      if (authored && lumN > 0) {
        const markerLum = 0.299 * authored.r + 0.587 * authored.g + 0.114 * authored.b;
        const barLum = lumSum / lumN;
        // 40 ≈ minimum perceptual contrast for legible text on a coloured bg.
        useAuthored = Math.abs(markerLum - barLum) > 40;
      }
      let fgHex: string;
      if (useAuthored && authored) {
        const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
        if (state === 'inactive') {
          const r = (authored.r + 128) / 2, g = (authored.g + 128) / 2, b = (authored.b + 128) / 2;
          fgHex = `#${hex(r)}${hex(g)}${hex(b)}`;
        } else {
          fgHex = `#${hex(authored.r)}${hex(authored.g)}${hex(authored.b)}`;
        }
      } else {
        const darkBar = lumN > 0 && lumSum / lumN < 112;
        fgHex = darkBar
          ? (state === 'inactive' ? '#bcbcbc' : '#ffffff')
          : (state === 'inactive' ? '#808080' : '#000000');
      }
      const g = fgHex === '#000000' ? baseGlyphs : (rasterizeTitleFont(dispTitle, textH, fgHex) ?? rasterizeText(dispTitle, textH, fgHex));
      const gx = Math.max(1, Math.min(fullWidth - g.width - 1, Math.round(cx - g.width / 2)));
      const gy = Math.max(1, Math.min(frame.top - g.height - 1, Math.round(titleMidY - g.height / 2)));
      composed.buffer.drawOver(g, gx, gy);
    }
  }

  // ── window root: bounds the FULL window footprint (chrome included), so the
  // element's box encloses everything it draws. The canvas fills the root at
  // 0,0 and the content is INSET by the frame thickness. ──
  const win = document.createElement('div');
  win.className = 'scriptoscope-window';
  // Optional shell CSS targets the actual frame, not a grid-stretched host.
  win.setAttribute('part', 'window');
  win.dataset.scriptoscopeCurrentState = state;
  // The title is always exposed to assistive tech, even when it isn't drawn
  // (utility/mini windows show no visible label in a modern context).
  // For modal-class window-types we add aria-modal="true" so SRs constrain
  // virtual-cursor navigation (the keyboard focus trap in handle.openModal
  // is the keyboard side; this is the AT side). UTILITY_SLUG_RE includes
  // dialog/alert/modal/popup which all reasonably benefit from modal semantics
  // when wrapped in handle.openModal — a11y reviewer 2026-05-31.
  if (title) {
    win.setAttribute('role', isUtility ? 'dialog' : 'group');
    win.setAttribute('aria-label', title);
    if (isUtility && /modal|alert|dialog/.test(slug)) win.setAttribute('aria-modal', 'true');
  }
  Object.assign(win.style, {
    position: 'relative',
    // touch-action: none — block the browser's default touch gestures
    // (page scroll, pinch zoom, double-tap zoom) on the chrome region
    // so pointer-drag works on iOS without a 150ms tap-delay or a
    // mid-drag scroll hijack. The slot inside (.scriptoscope-content)
    // has its own overflow:auto + restores touch-action to 'pan-y' so
    // consumer content inside still scrolls naturally. FE-reviewer
    // follow-up 2026-05-31.
    touchAction: 'none',
    width: `${fullWidth * scale}px`,
    height: `${fullHeight * scale}px`,
  } satisfies Partial<CSSStyleDeclaration>);

  // ── chrome canvas: native-res buffer, CSS-scaled, behind content ──
  // Pool the canvas if the caller passed one (WindowManager does this on every
  // re-render; see RenderWindowOptions.reuseCanvas). Setting width/height
  // resets the buffer to transparent black — desired, since we paint the whole
  // chrome via putImageData on the next line. Width-reset is also necessary
  // because the new chrome may have different dimensions than the previous
  // render (e.g. resize, shade/zoom).
  const canvas = opts.reuseCanvas ?? document.createElement('canvas');
  canvas.className = 'scriptoscope-chrome';
  canvas.width = fullWidth;
  canvas.height = fullHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('renderWindow: no 2d context');
  ctx.putImageData(composed.buffer.toImageData(), 0, 0);
  Object.assign(canvas.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${fullWidth * scale}px`,
    height: `${fullHeight * scale}px`,
    imageRendering: 'pixelated',
    zIndex: '0',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  // ── content body, inset by the frame so it sits over the chrome's hole ──
  // The inner <slot> is the Shadow-DOM seam: when the WindowManager mounts this
  // window into a shadow root, the consumer's content lives in the HOST's light
  // DOM and is rendered HERE via the slot. Host CSS still reaches the consumer's
  // content (slotted children stay light-DOM-styled); the chrome is shielded
  // from host CSS by the shadow boundary. When this window is used WITHOUT a
  // shadow root (the demo's direct renderWindow path), the slot is a no-op and
  // .scriptoscope-content can still receive direct children — no behavioural change.
  const content = document.createElement('div');
  content.className = 'scriptoscope-content';
  Object.assign(content.style, {
    position: 'absolute',
    left: `${frame.left * scale}px`,
    top: `${frame.top * scale}px`,
    width: `${contentW * scale}px`,
    height: `${contentH * scale}px`,
    boxSizing: 'border-box',
    overflow: 'auto',
    zIndex: '1',
    // Restore default touch behaviour inside the content area: the
    // parent `.scriptoscope-window` sets `touch-action: none` to block
    // iOS gestures during chrome drag, but content (consumer prose,
    // forms, scrollable lists) needs normal touch scrolling back.
    touchAction: 'auto',
    ...bodyBackgroundStyle(owner, slug),
  } satisfies Partial<CSSStyleDeclaration>);
  scaleBodyPattern(content, owner, scale, slug);
  content.appendChild(document.createElement('slot'));

  win.append(canvas, content);

  // ── grow box overlay: stacked ABOVE the content so the resize control sits
  //    just inside the bottom-right frame corner, over the body — the chrome
  //    canvas is behind the content, so a grow box drawn into it (at the inner
  //    corner) would be hidden. The built-in frame returns it as its own sprite
  //    (with any procedural handle baked in) precisely so it can stack on top. ──
  if (composed.growBox) {
    const gb = composed.growBox;
    const gcv = document.createElement('canvas');
    gcv.className = 'scriptoscope-growbox';
    gcv.width = gb.w;
    gcv.height = gb.h;
    const gctx = gcv.getContext('2d');
    if (gctx) {
      gctx.putImageData(gb.buffer.toImageData(), 0, 0);
      Object.assign(gcv.style, {
        position: 'absolute',
        left: `${gb.x * scale}px`,
        top: `${gb.y * scale}px`,
        width: `${gb.w * scale}px`,
        height: `${gb.h * scale}px`,
        imageRendering: 'pixelated',
        zIndex: '2',
        pointerEvents: 'none',
      } satisfies Partial<CSSStyleDeclaration>);
      win.append(gcv);
    }
  }
  // Expose the composed result (incl. the slice placement map) for diagnostics.
  (win as unknown as { _scriptoscopeComposed?: typeof composed })._scriptoscopeComposed = composed;
  return win;
}

/**
 * Procedural DEFAULT window for schemes that ship no window-frame chrome
 * (they inherit the OS-default Platinum window). DOM/CSS only — analogous
 * to the baseline controls. Uses the scheme's declared header colors for
 * the titlebar fill/text so it still reads as that scheme. Returns the same
 * `.scriptoscope-window` / `.scriptoscope-content` structure consumers expect.
 */
function buildBaselineWindow(
  theme: LoadedTheme,
  opts: { title: string; state: WindowState; contentW: number; contentH: number; scale: number; utility?: boolean; slug?: string },
): HTMLElement {
  const { title, state, contentW, contentH, scale, utility, slug = '' } = opts;
  const hc = (state === 'inactive' ? theme.manifest.headerColors?.inactive : theme.manifest.headerColors?.active) ?? {};
  const fill = hc.fill ?? '#cccccc';
  // Title text contrasts with the bar (white on a dark fill, else black). NOT
  // `hc.text` — the clut part-2 entry is a frame tint, not the title colour
  // (platinum → #555 grey vs. BLACK on screen); see docs/tracking/title-text-color.md.
  const fm = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(fill);
  const fillLum = fm ? 0.299 * parseInt(fm[1]!, 16) + 0.587 * parseInt(fm[2]!, 16) + 0.114 * parseInt(fm[3]!, 16) : 255;
  const text = fillLum < 128 ? '#ffffff' : '#000000';
  const frameC = hc.frame ?? '#555555';
  // Active titlebar shows the Platinum racing-stripe pinstripe; inactive is
  // flat (the OS active/inactive cue). The faithful classic-Platinum bar is a
  // three-tone gradient: lightTinge highlight → fill mid → darkTinge shadow,
  // which gives the bar its "polished metal" depth. Previously we only used
  // darkTinge — a flatter two-tone bar. Read both when they differ from fill;
  // fall back to the two-tone (and finally a single darkenHex'd fill) when the
  // scheme didn't ship distinct tinges (apple-platinum-2: darkTinge == fill).
  const active = state !== 'inactive';
  const stripe = hc.darkTinge && hc.darkTinge !== fill ? hc.darkTinge : darkenHex(fill, 0.14);
  const highlight = hc.lightTinge && hc.lightTinge !== fill ? hc.lightTinge : null;
  const barBg = active
    ? (highlight
        // 3-tone pinstripe: highlight on top, fill mid, darkTinge below — repeats
        // every 3px (1px highlight + 1px fill + 1px stripe), matching the classic
        // Platinum metal grain. Visible on every theme whose clut ships a distinct
        // lightTinge (most do per the codex header-state-variants flag).
        ? `repeating-linear-gradient(0deg, ${highlight} 0 1px, ${fill} 1px 2px, ${stripe} 2px 3px)`
        : `repeating-linear-gradient(0deg, ${fill} 0 1px, ${stripe} 1px 2px)`)
    : fill;
  const titleH = 19;

  const win = document.createElement('div');
  win.className = 'scriptoscope-window';
  // Optional shell CSS targets the actual frame, not a grid-stretched host.
  win.setAttribute('part', 'window');
  win.dataset.scriptoscopeCurrentState = state;
  if (title) {
    win.setAttribute('role', utility ? 'dialog' : 'group');
    win.setAttribute('aria-label', title);
    // aria-modal for modal-class window-types — see the parallel block in the
    // cicn-recipe path above for the rationale (a11y reviewer 2026-05-31).
    if (utility && /modal|alert|dialog/.test(slug)) win.setAttribute('aria-modal', 'true');
  }
  // Explicit footprint (border-box) so callers can read the window's full size
  // — `width`/`height` match the cicn path, e.g. the scene sizes its desk to it.
  const fullW = contentW + 2; // 1px frame each side
  const fullH = titleH + 1 + contentH + 2; // bar + bar border-bottom + top/bottom frame
  Object.assign(win.style, {
    position: 'relative',
    border: `1px solid ${frameC}`,
    background: fill,
    boxSizing: 'border-box',
    width: `${fullW * scale}px`,
    height: `${fullH * scale}px`,
  } satisfies Partial<CSSStyleDeclaration>);

  // titlebar: horizontal pinstripe (Platinum racing stripes) in the header
  // fill, centered title in the header text color, close + zoom/collapse boxes
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'relative', height: `${titleH * scale}px`,
    borderBottom: `1px solid ${frameC}`,
    background: barBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: `${Math.round(11 * scale)}px Charcoal, Chicago, Geneva, sans-serif`,
    color: text,
  } satisfies Partial<CSSStyleDeclaration>);
  const widget = (left: number): HTMLDivElement => {
    const w = document.createElement('div');
    Object.assign(w.style, {
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      [left >= 0 ? 'left' : 'right']: `${Math.abs(left) * scale}px`,
      width: `${11 * scale}px`, height: `${11 * scale}px`,
      border: `1px solid ${frameC}`, background: fill,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5)`,
    } satisfies Partial<CSSStyleDeclaration>);
    return w;
  };
  // Document windows: close (left) + zoom & windowshade (right). Utility /
  // "mini" windows: close (left) + a single windowshade (right), no zoom.
  bar.appendChild(widget(5)); // close box (left)
  bar.appendChild(widget(-5)); // windowshade (right)
  if (!utility) bar.appendChild(widget(-18)); // zoom box (right) — doc windows only
  // Visible title on document windows only; utility/mini windows are
  // label-free in a modern context (the aria-label carries it for AT).
  if (title && !utility) {
    const t = document.createElement('span');
    t.textContent = title;
    Object.assign(t.style, { background: fill, padding: `0 ${4 * scale}px`, position: 'relative', zIndex: '1' });
    bar.appendChild(t);
  }
  win.appendChild(bar);

  const content = document.createElement('div');
  content.className = 'scriptoscope-content';
  Object.assign(content.style, {
    position: 'relative', width: `${contentW * scale}px`, height: `${contentH * scale}px`,
    overflow: 'hidden', boxSizing: 'border-box',
    ...bodyBackgroundStyle(theme, utility ? 'utility' : undefined),
  } satisfies Partial<CSSStyleDeclaration>);
  scaleBodyPattern(content, theme, scale);
  content.appendChild(document.createElement('slot'));
  win.appendChild(content);
  return win;
}

/** Canonical "this windowType is a utility / dialog / palette" predicate, shared
 *  by `isUtility` (showTitle gate) and `bodyBackgroundStyle` (Icon-View ppat gate)
 *  so the two never drift. Extended over the previous narrower set to also catch
 *  `movable-modal` and `popup-window` — those windowTypes ship in the corpus and
 *  also wanted the utility body treatment (the prior regex left them painting
 *  the Finder Icon-View ppat as their body, same regression class as the
 *  Options dialog before the slug gate landed). */
const UTILITY_SLUG_RE = /utility|mini|floating|palette|dialog|alert|modal|popup/;

/**
 * Content-area background style. Two paths:
 *
 *   - Document windows tile the scheme's Icon-View body pattern
 *     (`bodyBackground.pattern` — decoded from cinf -9551's bgPatternId).
 *
 *   - Utility / dialog / palette / mini / floating / movable-modal / popup
 *     windows walk a separate UTILITY hierarchy:
 *       T1  `patterns['utility-pattern']`  — explicit author-declared utility
 *                                            interior (monkey-paradise +
 *                                            animals ship `ppat-42`).
 *       T2  `patterns['ppat--9568']`       — canonical kDEF utility-window
 *                                            cinf slot.
 *       T3  flat `#ffffff`                 — period default for schemes that
 *                                            ship no utility pattern.
 *
 * The earlier "flat white for everything utility-ish" rule was over-applied:
 * verified against the user's reference screenshots, monkey-paradise + animals
 * SHOW themed beige/cream utility-pattern bodies, not flat white. Reading
 * `utility-pattern` from the manifest's `patterns` map is the codex move:
 * the bundle author declared the slot explicitly; the runtime was ignoring it.
 *
 * The Icon-View ppat (`bodyBackground.pattern`) is STILL kept off utility
 * windows even when it's the only candidate left — that one was the
 * army-camo-wrapping-the-Options-dialog regression class; document-window
 * texture was never meant for utility interiors.
 */
/** Find a pattern by canonical RESOURCE ID rather than friendly key — the decoder
 *  assigns friendly keys from the `ppat`'s resource name (1984's `ppat-42` ships
 *  named "blue utility"; monkey-paradise's same-id ppat ships named "utility
 *  pattern"). Both are the canonical utility-window slot; both decode to the
 *  same `ppat-42` id. Reading `sourcePpatId` is the same trick `elementById`
 *  uses for chromeElements — it survives the Option-A blob-URL rewrite that
 *  replaces `asset` paths with `blob:` URLs at runtime (the alternative,
 *  parsing the id out of the asset path, breaks once `asset` becomes a blob URL). */
function patternByResourceId(theme: LoadedTheme, id: number): string | null {
  const patterns = theme.manifest.patterns ?? {};
  const abs = Math.abs(id);
  for (const v of Object.values(patterns)) {
    if (typeof v?.sourcePpatId === 'number' && Math.abs(v.sourcePpatId) === abs) return v.asset;
  }
  return null;
}

function bodyBackgroundStyle(theme: LoadedTheme, slug?: string): Partial<CSSStyleDeclaration> {
  const isUtility = !!slug && UTILITY_SLUG_RE.test(slug);
  if (isUtility) {
    // Walk by canonical resource id rather than friendly key — `ppat-42` is the
    // kDEF's utility-window pattern slot, but each bundle author picked a
    // different friendly name (1984="blue utility", monkey-paradise="utility
    // pattern", crayon-os="utility pattern"). The id is the structured truth.
    const utilPat = patternByResourceId(theme, 42)
      ?? patternByResourceId(theme, -9568) // canonical kDEF cinf slot for utility-window
      ?? null;
    if (!utilPat) return { background: '#ffffff' };
    return {
      backgroundColor: '#ffffff',
      backgroundImage: `url("${assetUrl(theme, utilPat)}")`,
      backgroundRepeat: 'repeat',
      imageRendering: 'pixelated',
    };
  }
  const pat = theme.manifest.bodyBackground?.pattern;
  if (!pat) return { background: '#ffffff' };
  return {
    backgroundColor: '#ffffff',
    backgroundImage: `url("${assetUrl(theme, pat)}")`,
    backgroundRepeat: 'repeat',
    imageRendering: 'pixelated',
  };
}

/**
 * Match the tiled body ppat to the display scale. The chrome canvas is a
 * native-resolution raster CSS-upscaled by `scale` (pixelated), but a CSS
 * `background-repeat` tile otherwise repeats at *native* px — so at 2× the
 * pattern reads half-size against the chrome. The ppat's native dimensions
 * aren't in theme.json, so read them off the decoded image and pin
 * `background-size` to native × scale (still pixelated, so it stays crisp).
 * No-op at 1× (native tiling already matches) and outside the browser.
 */
function scaleBodyPattern(el: HTMLElement, theme: LoadedTheme, scale: number, slug?: string): void {
  // For utility-style slugs, use the same hierarchy bodyBackgroundStyle picked
  // (utility-pattern → -9568) so the scale-fix tracks the resolved asset, not
  // the document-window default.
  const isUtility = !!slug && UTILITY_SLUG_RE.test(slug);
  const pat = isUtility
    ? (patternByResourceId(theme, 42) ?? patternByResourceId(theme, -9568) ?? null)
    : (theme.manifest.bodyBackground?.pattern ?? null);
  if (!pat || scale <= 1 || typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    if (!img.naturalWidth) return;
    el.style.backgroundSize = `${img.naturalWidth * scale}px ${img.naturalHeight * scale}px`;
  };
  img.src = assetUrl(theme, pat);
}

/** Darken a hex color by `amt` (0..1). Used for the baseline pinstripe. */
function darkenHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  return `#${[d(r), d(g), d(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** `#rgb` / `#rrggbb` → [r,g,b]; falls back to gray. */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return [204, 204, 204];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

