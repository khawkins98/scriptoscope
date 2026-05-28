import type { LoadedTheme, WindowState, WindowType } from './types.js';
import { resolveInChain } from './baseChain.js';
import { assetUrl, findChromeElement } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { composeWindowChrome, type ComposedChrome } from './composeChrome.js';
import { composeCornerSpriteChrome } from './composeCornerSprite.js';
import { rasterizeText } from './textRaster.js';
import { PixelBuffer } from './pixelBuffer.js';

/**
 * Rasterize the window title in a real FONT (the CSS "Charcoal" stack — a local
 * Charcoal if installed, else the bundled stand-in) via an offscreen canvas, so
 * the title reads as period anti-aliased type rather than the bitmap rasterizer.
 * Browser-only: returns null in a non-DOM context so the caller falls back to
 * rasterizeText (the crisp pixel path, used by node tooling).
 */
function rasterizeTitleFont(text: string, px: number, hex: string): PixelBuffer | null {
  if (typeof document === 'undefined' || !text) return null;
  // Charcoal 12 (Jeremy Sachs, CC BY-SA — a bitmap clone of Mac OS 8/9 Charcoal) is
  // crisp ONLY at its grid-native 16px: the finest design step (125 of 2000 em
  // units) maps to exactly 1px there, so every brick edge lands on a pixel. When
  // it's loaded we pin to 16px with ZERO tracking (off-grid advances would
  // re-introduce anti-aliasing) and an integer baseline — the native buffer then
  // upscales pixelated, keeping it blocky-crisp. Otherwise fall back to the
  // Charcoal stack (Virtue) at the requested px with a hair of tracking for air.
  const c12 = !!document.fonts?.check?.('16px "Charcoal 12"');
  const size = c12 ? 16 : px;
  const font = c12
    ? `16px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif`
    : `${px}px Charcoal, "Helvetica Neue", Arial, sans-serif`;
  const LS = c12 ? '0px' : '0.5px';
  const setLS = (c2d: CanvasRenderingContext2D): void => {
    try { (c2d as unknown as { letterSpacing: string }).letterSpacing = LS; } catch { /* unsupported */ }
  };
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.font = font;
  setLS(probe);
  const tm = probe.measureText(text);
  const w = Math.max(1, Math.ceil(tm.width) + 1);
  // Buffer sized tight to the text's ink box; the compositor centres this buffer in
  // the title bar (sgy, ~L220 below), so an ink-tight buffer lands the title without
  // any line-height fudge. Baseline at the ink ascent.
  const asc = Math.max(1, Math.ceil(tm.actualBoundingBoxAscent || size * 0.72));
  const desc = Math.max(0, Math.ceil(tm.actualBoundingBoxDescent || 0));
  const h = Math.max(1, asc + desc);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.font = font;
  setLS(ctx);
  ctx.fillStyle = hex;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 0, asc);
  const img = ctx.getImageData(0, 0, w, h);
  const buf = PixelBuffer.alloc(w, h);
  buf.data.set(img.data);
  return buf;
}

/**
 * Load a scheme's OWN title-bar widget GLYPH by its negative Kaleidoscope id from
 * the theme's `glyphs` map (icons/index.json — all 16px families, ics4 OR ics8).
 * These are the WIDGET channel (-14336..-14331 = close/zoom/collapse, active +
 * inactive), distinct from the same-id cicn (a window-type proxy). Returns null
 * when the scheme ships no such glyph (→ the compositor's procedural box).
 */
async function loadWidgetGlyph(owner: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const asset = owner.glyphs?.[String(id)];
  return asset ? loadCicnBuffer(assetUrl(owner, asset)) : null;
}

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
   *  Corner-sprite schemes swap to the widget's pressed glyph (-14333/-14332/-14331);
   *  native-recipe schemes (widget baked into the title cicn) darken its rect. */
  pressedWidget?: TitleWidgetRole;
}

/** A title-bar widget role, left→right: close · collapse(windowshade) · zoom. */
export type TitleWidgetRole = 'close' | 'zoom' | 'collapse';

/**
 * Resolve title-bar widget rects (UNSCALED, in composed-buffer pixel space) from the `wnd#`
 * parts, mapped onto the stretched window — the single source of truth shared by the pressed-
 * widget effect here and `interactive.titleWidgetHits` (which just ×scale's these). The widget
 * art is a `wnd#` part rect (`part-1`…; `part-0` is the body, any ≤2px-wide top-band part is the
 * title-text marker). The title bar grows in its middle, so left-anchored widgets keep their x
 * and right-anchored ones shift by the compositor's right-band delta. Roles follow the classic
 * Mac layout: close at the left; on the right the far box is zoom, an inner one collapse.
 */
export function resolveTitleWidgetRects(
  wt: WindowType,
  composed: ComposedChrome,
): { role: TitleWidgetRole; rect: { x: number; y: number; w: number; h: number } }[] {
  // Corner-sprite model (composeCornerSprite): ONE `edge:'widget'` placement whose `rects` are the
  // widgets in order and whose `role` joins their glyph names (e.g. "close/collapse/zoom").
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
  // Native wnd# model: widget rects are wnd# parts mapped onto the stretched title bar.
  const top = composed.placement.filter((s) => s.edge === 'top');
  if (!top.length || !wt.parts) return [];
  const shiftOf = (s: (typeof top)[number]): number => (s.rects[0]?.x ?? s.src.x) - s.src.x;
  const rightShift = top.reduce((m, s) => Math.max(m, shiftOf(s)), 0);
  const rightBandSrcX = rightShift > 0
    ? top.reduce((m, s) => (shiftOf(s) === rightShift ? Math.min(m, s.src.x) : m), Infinity)
    : Infinity;
  const frameTop = composed.frame.top;
  const placed: { right: boolean; x: number; y: number; w: number; h: number }[] = [];
  for (const [slug, part] of Object.entries(wt.parts)) {
    if (slug === 'part-0' || !part.rect) continue;
    const [l, t, r, b] = part.rect;
    if (r <= l || b <= t) continue; // empty rect
    if (t < frameTop && r - l <= 2) continue; // thin title-text marker, not a widget
    const right = (l + r) / 2 >= rightBandSrcX;
    placed.push({ right, x: right ? l + rightShift : l, y: t, w: r - l, h: b - t });
  }
  const out: { role: TitleWidgetRole; rect: { x: number; y: number; w: number; h: number } }[] = [];
  const lefties = placed.filter((p) => !p.right).sort((a, b) => a.x - b.x);
  const righties = placed.filter((p) => p.right).sort((a, b) => a.x - b.x);
  if (lefties[0]) out.push({ role: 'close', rect: { x: lefties[0].x, y: lefties[0].y, w: lefties[0].w, h: lefties[0].h } });
  // Right-side roles, per Mac OS 8.5+ Platinum convention: the OUTER (rightmost) box is ZOOM, the
  // inner one is the windowshade/COLLAPSE. The wnd# parts carry NO role labels, so this is a
  // positional heuristic — the icon ART in Platinum-replica/1138 confirms it: zoom-square outer,
  // collapse-lines inner. (Was earlier "outer=collapse" verified against evolution only, which is
  // non-classic and mislabeled every other scheme. Corner-sprite themes don't use this path — their
  // roles come from the glyph names.)
  righties.forEach((p, i) => out.push({ role: i === righties.length - 1 ? 'zoom' : 'collapse', rect: { x: p.x, y: p.y, w: p.w, h: p.h } }));
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
  const slug = opts.windowType ?? 'document-window';
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
  const resolved = resolveInChain(theme, (t) => {
    const wt = resolveWindowType(t, slug);
    const cicnPath = wt ? (wt.chrome[state] ?? wt.chrome.active) : undefined;
    return wt && cicnPath ? { owner: t, wt, cicnPath } : null;
  });
  if (!resolved) {
    const utility = /utility|mini|floating|palette/.test(slug);
    return buildBaselineWindow(theme, { title, state, contentW, contentH, scale, utility });
  }
  const { owner, wt, cicnPath } = resolved;
  // (chromeElement lookup kept for validation / future metadata use)
  findChromeElement(owner, cicnPath);

  const cicn = await loadCicnBuffer(assetUrl(owner, cicnPath));

  // Utility / mini / floating windows carry NO visible title in a modern
  // context — the label is screen-reader-only (set as aria-label below).
  const isUtility = /utility|mini|floating|palette/.test(slug);
  const showTitle = !!title && !isUtility;

  // ── title geometry: the title TEXT is a CENTRED part (kDEF placement mode 0).
  // We rasterize it (width pass) BEFORE composing so the compositor can reserve
  // the measured title-text width for the title-plate cell (code 5) — the kDEF
  // measures the title via StringWidth and sizes that cell to it (0x4a64/0x5034),
  // tiling the plate src across it (the "pill" behind the title). Without that
  // the plate stays its tiny src width and the text spills onto the bezel. ──
  const frameTop = wt.parts['part-0']?.rect[1] ?? 0;
  let glyphs: PixelBuffer | null = null;
  let textH = 0;
  if (showTitle && frameTop > 6) {
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
  const titleWidthPx = glyphs ? glyphs.width + 8 : 0;

  // Corner-sprite windows (look-only Platinum schemes: apple-platinum-2,
  // platinum-8, system7-nostalgia-silver) ship the document corner cicns + the
  // pinstripe / grow-box sprites but no wnd# recipe — composeWindowChrome can't
  // walk them. They render procedurally (the classic Platinum WDEF model) from
  // their own sprites. Isolated, self-contained branch; the sliced path below
  // is unchanged.
  let composed;
  if (wt.model === 'corner-sprite') {
    const pinstripe = wt.sprites?.pinstripe
      ? await loadCicnBuffer(assetUrl(owner, wt.sprites.pinstripe))
      : null;
    const growBox = wt.sprites?.growBox
      ? await loadCicnBuffer(assetUrl(owner, wt.sprites.growBox))
      : null;
    const hc = (state === 'inactive' ? owner.manifest.headerColors?.inactive : owner.manifest.headerColors?.active) ?? {};
    // Title-bar widget glyphs — the scheme's OWN close/zoom/shade art (the ics4/
    // ics8 WIDGET channel; the same-id cicn is a window-type proxy). The base
    // differs by window FAMILY: document / dialog / movable use the -14336.. set;
    // UTILITY / mini / floating windows use their OWN -14320.. set. Within a set:
    // close = base, zoom = base+1, collapse = base+2 (ACTIVE/normal); the +3 trio is the
    // PRESSED variant (per resource-roles: close/zoom/collapse × active/pressed — NOT inactive;
    // classic Mac inactive windows don't draw pressed-looking widgets). So inactive uses the
    // normal glyphs (greyed via the inactive header colours), and only the held widget loads its
    // pressed glyph. The compositor stamps the ones in opts.widgets (procedural box otherwise).
    const wBase = isUtility ? -14320 : -14336;
    const wIdx = { close: 0, zoom: 1, collapse: 2 } as const;
    const gid = (role: keyof typeof wIdx): number => wBase + wIdx[role] + (opts.pressedWidget === role ? 3 : 0);
    const widgetGlyphs = {
      close: await loadWidgetGlyph(owner, gid('close')),
      zoom: await loadWidgetGlyph(owner, gid('zoom')),
      collapse: await loadWidgetGlyph(owner, gid('collapse')),
    };
    // The window-frame proxy cicn (chrome.active -14332 / chrome.inactive -14336) —
    // frame-extracted by the compositor into the scheme's own beveled frame + corners.
    const frameAsset = state === 'inactive' ? (wt.chrome?.inactive ?? wt.chrome?.active) : wt.chrome?.active;
    const frameCicn = frameAsset ? await loadCicnBuffer(assetUrl(owner, frameAsset)) : null;
    composed = composeCornerSpriteChrome(wt, contentW, contentH, {
      pinstripe, growBox, frameColor: hc.frame, fillColor: hc.fill,
      lightBevel: hc.lightBevel, darkBevel: hc.darkBevel,
      titleWidthPx, widgets: wt.widgets, widgetGlyphs, frameCicn,
    });
  } else {
    composed = composeWindowChrome(cicn, wt, contentW, contentH, { cinf: wt.cinf ?? null, titleWidthPx });
    // Native-recipe widgets are baked into the title cicn (no pressed art), so synthesize the
    // press by darkening the held widget's rect (corner-sprite schemes used the pressed glyph above).
    if (opts.pressedWidget && wt) {
      const wr = resolveTitleWidgetRects(wt, composed).find((w) => w.role === opts.pressedWidget);
      if (wr) pressRect(composed.buffer, wr.rect);
    }
  }
  const { frame, fullWidth, fullHeight } = composed;

  if (glyphs && frame.top > 6) {
    // Title colour. Every scheme in the corpus draws a BLACK title (active),
    // dimmed when inactive — verified against the references for 1984, 1138,
    // platinum, beos, 1990 AND evolution (all black; the scheme places the title
    // on a light area of its bar). It is NOT `headerColors.text` (the clut part-2
    // entry — a frame tint, wrong for most schemes). Two earlier heuristics were
    // worse than this constant: a "saturated cicn marker" picked the saturated
    // BAR colour (beos's gold → gold-on-gold, invisible), and a luminance-contrast
    // wrongly whitened the dark schemes (it measured the dark frame, not the light
    // title plate the text actually sits on). The faithful kDEF mechanism samples
    // a marker pixel (kdef231-reference.md §1.4 `0x5530`) — needed only to support
    // a genuinely COLOURED title; pinning that coordinate is still open
    // (docs/tracking/title-text-color.md). Until then, black is correct here.
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
    const leftEnd = wrects.filter((w) => w.role === 'close').reduce((m, w) => Math.max(m, w.rect.x + w.rect.w), frame.left);
    const rightStart = wrects.filter((w) => w.role !== 'close').reduce((m, w) => Math.min(m, w.rect.x), fullWidth - frame.right);
    const maxTitleW = Math.max(0, Math.floor(2 * Math.min(cx - (leftEnd + 5), (rightStart - 5) - cx)));
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
      const darkBar = lumN > 0 && lumSum / lumN < 112;
      const fgHex = darkBar
        ? (state === 'inactive' ? '#bcbcbc' : '#ffffff')
        : (state === 'inactive' ? '#808080' : '#000000');
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
  win.className = 'aw-window';
  win.dataset.awState = state;
  // The title is always exposed to assistive tech, even when it isn't drawn
  // (utility/mini windows show no visible label in a modern context).
  if (title) {
    win.setAttribute('role', isUtility ? 'dialog' : 'group');
    win.setAttribute('aria-label', title);
  }
  Object.assign(win.style, {
    position: 'relative',
    width: `${fullWidth * scale}px`,
    height: `${fullHeight * scale}px`,
  } satisfies Partial<CSSStyleDeclaration>);

  // ── chrome canvas: native-res buffer, CSS-scaled, behind content ──
  const canvas = document.createElement('canvas');
  canvas.className = 'aw-chrome';
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
  const content = document.createElement('div');
  content.className = 'aw-content';
  Object.assign(content.style, {
    position: 'absolute',
    left: `${frame.left * scale}px`,
    top: `${frame.top * scale}px`,
    width: `${contentW * scale}px`,
    height: `${contentH * scale}px`,
    boxSizing: 'border-box',
    overflow: 'auto',
    zIndex: '1',
    ...bodyBackgroundStyle(owner),
  } satisfies Partial<CSSStyleDeclaration>);
  scaleBodyPattern(content, owner, scale);

  win.append(canvas, content);

  // ── grow box overlay: stacked ABOVE the content so the resize control sits
  //    just inside the bottom-right frame corner, over the body — the chrome
  //    canvas is behind the content, so a grow box drawn into it (at the inner
  //    corner) would be hidden. composeCornerSprite returns it as its own sprite
  //    (with any procedural handle baked in) precisely so it can stack on top. ──
  if (composed.growBox) {
    const gb = composed.growBox;
    const gcv = document.createElement('canvas');
    gcv.className = 'aw-growbox';
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
  (win as unknown as { _awComposed?: typeof composed })._awComposed = composed;
  return win;
}

/**
 * Procedural DEFAULT window for schemes that ship no window-frame chrome
 * (they inherit the OS-default Platinum window). DOM/CSS only — analogous
 * to the baseline controls. Uses the scheme's declared header colors for
 * the titlebar fill/text so it still reads as that scheme. Returns the same
 * `.aw-window` / `.aw-content` structure consumers expect.
 */
function buildBaselineWindow(
  theme: LoadedTheme,
  opts: { title: string; state: WindowState; contentW: number; contentH: number; scale: number; utility?: boolean },
): HTMLElement {
  const { title, state, contentW, contentH, scale, utility } = opts;
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
  // flat (the OS active/inactive cue). The stripe is the scheme's darkTinge
  // when it actually differs from the fill, else a darkened fill so it stays
  // visible (apple-platinum's darkTinge == fill, which read as inactive).
  const active = state !== 'inactive';
  const stripe = hc.darkTinge && hc.darkTinge !== fill ? hc.darkTinge : darkenHex(fill, 0.14);
  const barBg = active ? `repeating-linear-gradient(0deg, ${fill} 0 1px, ${stripe} 1px 2px)` : fill;
  const titleH = 19;

  const win = document.createElement('div');
  win.className = 'aw-window';
  win.dataset.awState = state;
  if (title) {
    win.setAttribute('role', utility ? 'dialog' : 'group');
    win.setAttribute('aria-label', title);
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
  content.className = 'aw-content';
  Object.assign(content.style, {
    position: 'relative', width: `${contentW * scale}px`, height: `${contentH * scale}px`,
    overflow: 'hidden', boxSizing: 'border-box',
    ...bodyBackgroundStyle(theme),
  } satisfies Partial<CSSStyleDeclaration>);
  scaleBodyPattern(content, theme, scale);
  win.appendChild(content);
  return win;
}

/**
 * Content-area background style: tile the scheme's body pattern (the
 * Icon/List View cinf bgPatternId ppat) at native pixel size if declared,
 * else the OS-default white. Pixelated so the small ppat tile stays crisp.
 */
function bodyBackgroundStyle(theme: LoadedTheme): Partial<CSSStyleDeclaration> {
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
function scaleBodyPattern(el: HTMLElement, theme: LoadedTheme, scale: number): void {
  const pat = theme.manifest.bodyBackground?.pattern;
  if (!pat || scale <= 1 || typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    if (!img.naturalWidth) return;
    el.style.backgroundSize = `${img.naturalWidth * scale}px ${img.naturalHeight * scale}px`;
  };
  img.src = assetUrl(theme, pat);
}

/**
 * Resolve a window type robustly across bundles. Some schemes use the
 * friendly slug (`document-window`); others (acid, evolution, big-blue)
 * key by raw resource id (`wnd--14336`). Try, in order: exact slug,
 * any key containing the slug's noun, the doc-window resource ids, then
 * the first window type that publishes a `part-0` body.
 */
function resolveWindowType(theme: LoadedTheme, slug: string): WindowType | undefined {
  const wts = theme.manifest.windowTypes ?? {};
  const ok = (k: string): WindowType | undefined => (wts[k] && looksLikeWindow(wts[k]) ? wts[k] : undefined);
  if (wts[slug] && looksLikeWindow(wts[slug])) return wts[slug];

  // "mini" / utility / floating palette windows have their OWN edge recipe +
  // chrome cicn (short title bar, thin frame). Schemes key these inconsistently
  // — `titled-utility-window` in some, raw `wnd--14296` in others — so detect
  // by the CHROME CICN ASSET NAME (stable across schemes), NOT the type key.
  // Require the candidate to ship its own top recipe, or it would fall through
  // to the document edges (the bug this fixes). Prefer a titled utility window
  // (has a title bar), then any utility, then a floating palette; skip the
  // collapsed (windowshade-rolled) variants.
  if (/utility|mini|floating|palette/.test(slug)) {
    let best: WindowType | undefined;
    let bestScore = 0;
    let bestSegs = -1;
    for (const [k, v] of Object.entries(wts)) {
      if (/collapsed/.test(k) || !v.edges?.top?.length || !v.parts?.['part-0']?.rect) continue;
      // Need a renderable ACTIVE chrome cicn (not a grow-box mis-pair); a
      // recipe-only type with no bitmap (e.g. beos's titled-utility) can't draw.
      const asset = (v.chrome?.active ?? '').toLowerCase();
      if (!asset || /grow-box/.test(asset)) continue;
      const score = /titled-utility/.test(asset) ? 4 : /utility/.test(asset) ? 3 : /floating|palette/.test(asset) ? 2 : 0;
      if (score === 0) continue;
      const segs = v.edges.top.length;
      if (score > bestScore || (score === bestScore && segs > bestSegs)) { bestScore = score; bestSegs = segs; best = v; }
    }
    if (best) return best;
    // No dedicated utility chrome → a dialog/modal reads as a small window.
    for (const k of ['movable-modal', 'dialog', 'document-window']) { const w = ok(k); if (w) return w; }
  }

  const noun = slug.replace(/-window$/, '');
  for (const [k, v] of Object.entries(wts)) if (k.includes(noun) && looksLikeWindow(v)) return v;

  // raw doc-window resource ids (-14336 inactive / -14335 active family)
  for (const id of ['document-window', 'wnd--14336', 'wnd--14335', 'wnd--14332', 'wnd--14331']) {
    const w = ok(id); if (w) return w;
  }
  for (const v of Object.values(wts)) if (looksLikeWindow(v)) return v;
  return undefined; // nothing usable → caller renders the procedural default
}

/**
 * A window type usable for rendering: has a part-0 body and a chrome cicn
 * that's an actual window frame — NOT a grow-box cicn (some bundles mis-pair
 * a dialog/utility wnd# with the grow-box) and not an empty chrome map.
 */
function looksLikeWindow(wt: WindowType): boolean {
  const ch = wt.chrome?.active ?? wt.chrome?.inactive;
  if (!ch || /grow-box/.test(ch)) return false;
  return !!wt.parts?.['part-0']?.rect;
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

