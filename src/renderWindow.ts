import type { LoadedTheme, WindowState, WindowType } from './types.js';
import { assetUrl, findChromeElement } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { composeWindowChrome, type ComposedChrome, type TitleWidgetRole } from './composeChrome.js';
import { themeResourceChain } from './engine/resources/theme.js';
import { widgetCicnIds } from './engine/families/window.js';
import type { IconSource } from './engine/qd/region.js';
// The built-in frame (the `wt.model === 'corner-sprite'` branch: schemes with no
// wnd# recipe) draws through the v2 engine family proceduralFrame, dynamically
// imported so the 13 wnd# themes don't load it on first paint.
import { rasterizeText } from './textRaster.js';
import { rasterizeTitle } from './titleFont.js';
import { TITLE_TEXT } from './engine/tables/window.js';
import { PixelBuffer } from './pixelBuffer.js';
import { resolveWindowSelection } from './resolveWindowType.js';
import { canonicalWindowTypeSlug } from './wndCascade.js';

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
  /** Render one title-bar widget in its PRESSED state (mouse held down on it): the
   *  built-in frame's pressed icon (procedural-frame §2 parts 4/5/9), or a wnd# scheme's
   *  pressed strip cicn (window-widgets WD9; none drawn when the scheme ships none). */
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

export type { TitleWidgetRole };

/**
 * Title-bar widget hit areas (UNSCALED, composed-buffer pixels), shared by press
 * feedback and WindowManager. Rect-list types 1 close, 2 zoom, 3 collapse keep
 * their roles wherever a scheme places them. The built-in frame reports its
 * widgets as one `edge: 'widget'` placement; a wnd# window reports the widgets
 * whose `wHit` branch is reachable, at their remapped rects (window-widgets RM,
 * HT rows: cleared collapse boxes, empty rects and schemes without the pressed
 * strip have none; inactive windows keep theirs, runtime policy, see renderWindow). Inside a rect, `composed.hitWidget`
 * applies the strip's mask (HT7).
 */
export function resolveTitleWidgetRects(
  _wt: WindowType,
  composed: ComposedChrome,
): { role: TitleWidgetRole; rect: { x: number; y: number; w: number; h: number } }[] {
  const ws = composed.placement.find((s) => s.edge === 'widget');
  if (!ws?.rects.length) return composed.widgets ?? [];
  const roles = ws.role.split('/');
  return ws.rects.flatMap((r, i) => {
    const role = roles[i];
    return role === 'close' || role === 'zoom' || role === 'collapse' ? [{ role, rect: { x: r.x, y: r.y, w: r.w, h: r.h } }] : [];
  });
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

  // ── title width: rasterize the title BEFORE composing; its width is the layout's
  // `SW` (window-widgets LS6, TT rows), which sizes the code-5 plate. ──
  const frameTop = wt.parts['part-0']?.rect[1] ?? 0;
  const builtInFrame = wt.model === 'corner-sprite';
  let textH = 0;
  // Pen advance (StringWidth) and baseline row; the pixel rasterizer (non-DOM) has neither, so its box stands in.
  const raster = (text: string, hex: string): { buffer: PixelBuffer; ascent: number; advance: number } => {
    const r = rasterizeTitle(text, textH, hex);
    if (r) return r;
    const b = rasterizeText(text, textH, hex);
    return { buffer: b, ascent: b.height, advance: b.width };
  };
  let measured: ReturnType<typeof raster> | null = null;
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
    measured = raster(title, '#000000');
  }
  // Built-in frame windows (no wnd# recipe: apple-platinum-2, black-platinum,
  // platinum-8, slimes, system7-nostalgia-silver) draw through the v2 engine
  // (docs/spec/engine/procedural-frame.md), title text and pressed widget included.
  let composed;
  if (builtInFrame) {
    const key = Object.entries(owner.manifest.windowTypes ?? {}).find(([, v]) => v === wt)?.[0] ?? slug;
    const { composeProceduralFrameChrome } = await import('./proceduralFrameChrome.js');
    // The built-in utility frame derives its bar height from the title (procedural-frame §9.1
    // UI10), and collapsing does not change the window record, so the collapsed titled utility
    // keeps its title. Scoped to the built-in frame; wnd# schemes keep the showTitle gate.
    const builtInTitled = !!title && /^(collapsed-)?titled-utility/.test(canonicalWindowTypeSlug(key));
    composed = await composeProceduralFrameChrome(owner, canonicalWindowTypeSlug(key), state, contentW, contentH, {
      title: showTitle || builtInTitled ? title : '',
      ...(opts.pressedWidget ? { pressedWidget: opts.pressedWidget } : {}),
    });
  } else {
    // popup-window requests are service slot 8 (procID 1008 + varCode, family 63: window-widgets AP1).
    // The pressed strip (WD11) gates every widget hit and draws the pressed widget (WD9, HT7).
    // Accessibility divergence (DECISIONS #12): `active` is deliberately not passed. The decode
    // makes an inactive window's widgets inert (window-widgets HT2); we keep focusable, operable
    // buttons so keyboard and assistive-technology users can act on background windows. Widget
    // art still follows the decode.
    const ids = widgetCicnIds();
    const strip = (await themeResourceChain(owner, ids.map((id) => ({ type: 'cicn', id })))).probe<IconSource>('cicn', ids);
    composed = composeWindowChrome(cicn!, wt, contentW, contentH, {
      cinf: wt.cinf ?? null, titleWidthPx: measured?.advance ?? 0, titleLength: measured ? title.length : 0,
      popupFamily: slug === 'popup-window', widgetCicn: strip?.value.pixmap ?? null,
      ...(opts.pressedWidget ? { pressedWidget: opts.pressedWidget } : {}),
    });
  }
  const { frame, fullWidth, fullHeight } = composed;

  // Title text (window-widgets §4.12): in `t4p`, the remapped title rect (TX3); nothing for an
  // empty title (TX2) or an empty `t4p`. Left-aligned, baseline 4 above its bottom (TX8),
  // clipped to `t4p` widened by 2 on the right (TX4). The layout centres `t4p` on the content
  // (TT6/TT7). DIVERGENCES (runtime): TX5 condenses before TruncString, but the runtime has
  // no condensed face, so it only truncates (plain face, ellipsis); TX7's shadow string and
  // sampled colours are not drawn (the colour rule below is the runtime's); the text is drawn
  // after every side, not right after the side holding T4 (TX1).
  const t4p = composed.titleRect;
  if (measured && t4p && t4p.w > 0 && t4p.h > 0) {
    // DECISIONS #13: the plate fits the text as drawn. TX5's truncation room is the title rect
    // + 2; where the rect ends flush with the plate (dolphin-som, evolution) that put ink 1 px
    // past it, so the room stops at the plate's right edge, but never below the title rect's own
    // width (floppies and 1138's titled utility have plates 1-2 px narrower than the rect).
    const plateRight = composed.titleRegion.x + composed.titleRegion.w;
    const room = Math.min(t4p.w + TITLE_TEXT.TX4.widenRight, Math.max(plateRight - t4p.x, t4p.w));
    let dispTitle = title;
    if (measured.advance > room) { // TX5
      dispTitle = '';
      for (let n = title.length - 1; n >= 1; n--) {
        const cand = `${title.slice(0, n)}…`;
        if (raster(cand, '#000000').advance <= room) { dispTitle = cand; break; }
      }
    }
    const base = dispTitle === title ? measured : dispTitle ? raster(dispTitle, '#000000') : null;
    if (base) {
      // DECISIONS #13 (2): the decoded baseline (TX8) and clip (TX4) are kept, except that our
      // title font is taller than the original's: when its ascent would start above the title
      // rect, the baseline moves down by exactly that overflow, so every glyph stays inside.
      const baseline = Math.max(t4p.y + t4p.h - TITLE_TEXT.TX8.baselineAbove, t4p.y + base.ascent);
      const x0 = t4p.x, y0 = baseline - base.ascent;
      const clip = { l: Math.max(0, t4p.x), t: Math.max(0, t4p.y), r: Math.min(fullWidth, t4p.x + t4p.w + TITLE_TEXT.TX4.widenRight), b: Math.min(fullHeight, t4p.y + t4p.h) };
      const inClip = (x: number, y: number): boolean => x >= clip.l && x < clip.r && y >= clip.t && y < clip.b;
      // Title colour CONTRASTS with the bar under the text's own footprint (runtime rule, not TX7).
      let lumSum = 0, lumN = 0;
      for (let y = 0; y < base.buffer.height; y++) for (let x = 0; x < base.buffer.width; x++) {
        if (!inClip(x0 + x, y0 + y)) continue;
        const [pr, pg, pb, pa] = composed.buffer.getPixel(x0 + x, y0 + y);
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
      const g = fgHex === '#000000' ? base : raster(dispTitle, fgHex);
      for (let y = 0; y < g.buffer.height; y++) for (let x = 0; x < g.buffer.width; x++) {
        const px = x0 + x, py = y0 + y;
        if (!inClip(px, py)) continue;
        const [r, gg, b, a] = g.buffer.getPixel(x, y);
        if (a === 0) continue;
        const [dr, dg, db, da] = composed.buffer.getPixel(px, py);
        const sa = a / 255;
        composed.buffer.setPixel(px, py, Math.round(r * sa + dr * (1 - sa)), Math.round(gg * sa + dg * (1 - sa)), Math.round(b * sa + db * (1 - sa)), Math.max(a, da));
      }
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

