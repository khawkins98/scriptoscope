import type { LoadedTheme, WindowState, WindowType } from './types.js';
import { assetUrl, findChromeElement } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { composeWindowChrome } from './composeChrome.js';
import { rasterizeText } from './textRaster.js';
import type { PixelBuffer } from './pixelBuffer.js';

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

  const wt = resolveWindowType(theme, slug);
  // Some schemes ship NO window-frame chrome — they inherit the OS default
  // Platinum window (e.g. "Apple Platinum 2": its window resources are 16px
  // proxy icons, and there's no wnd# side recipe). Render a procedural
  // default window from the scheme's declared header colors so every theme
  // still produces a window (North Star: render any scheme).
  if (!wt || !(wt.chrome[state] ?? wt.chrome.active)) {
    const utility = /utility|mini|floating|palette/.test(slug);
    return buildBaselineWindow(theme, { title, state, contentW, contentH, scale, utility });
  }
  const cicnPath = wt.chrome[state] ?? wt.chrome.active!;
  // (chromeElement lookup kept for validation / future metadata use)
  findChromeElement(theme, cicnPath);

  const cicn = await loadCicnBuffer(assetUrl(theme, cicnPath));

  // Utility / mini / floating windows carry NO visible title in a modern
  // context — the label is screen-reader-only (set as aria-label below).
  const isUtility = /utility|mini|floating|palette/.test(slug);
  const showTitle = !!title && !isUtility;

  // ── title geometry: the kDEF inserts the title's width at the title seam,
  // so we rasterize the title FIRST (the glyph width sets how far the plate
  // grows), then compose the chrome with that plate width. The plate slice
  // stretches to fit the title, pushing the decorations + side fill right;
  // the title then sits on the clean stretched plate with a TRANSPARENT
  // background (no erase box). ──
  const frameTop = wt.parts['part-0']?.rect[1] ?? 0;
  const pad = 4;
  let glyphs: PixelBuffer | null = null;
  let plateWidth = 0;
  let textH = 0;
  if (showTitle && frameTop > 6) {
    textH = Math.max(8, Math.min(13, frameTop - 6)); // ~Chicago 12px, never frame-scaled
    glyphs = rasterizeText(title, textH, '#000000'); // width pass; recoloured below
    plateWidth = glyphs.width + pad * 2;
  }

  const composed = composeWindowChrome(cicn, wt, contentW, contentH, { titlePlateWidth: plateWidth });
  const { frame, fullWidth, fullHeight } = composed;

  if (glyphs && frame.top > 6) {
    // Title colour: the scheme's DECLARED header text colour (from the
    // -14335/-14336 clut), else contrast against the composed plate.
    const hc = (state === 'inactive' ? theme.manifest.headerColors?.inactive : theme.manifest.headerColors?.active) ?? {};
    const tr = composed.titleRegion;
    let fgHex: string;
    if (hc.text) {
      fgHex = hc.text;
    } else {
      const [er, eg, eb] = dominantColor(composed.buffer, { x: tr.x, y: 1, w: Math.max(1, tr.w), h: frame.top - 2 });
      const lum = 0.299 * er + 0.587 * eg + 0.114 * eb;
      fgHex = lum < 128 ? '#ffffff' : '#000000';
    }
    const g = fgHex === '#000000' ? glyphs : rasterizeText(title, textH, fgHex);
    // Centre the title on the (grown) plate span; clamp into the bar. The
    // glyphs draw with a transparent background straight onto the plate.
    const gx = Math.max(0, Math.min(fullWidth - g.width, Math.round(tr.x + (tr.w - g.width) / 2)));
    const gy = Math.max(1, Math.round((frame.top - g.height) / 2));
    composed.buffer.drawOver(g, gx, gy);
  }

  // ── window root: bounds the FULL window footprint (chrome included), so
  // the element's box encloses everything it draws. The chrome used to bleed
  // outside a content-sized box via negative canvas offsets, which got
  // clipped when the window was embedded in an overflow:hidden container
  // (cropped title bars). Now the canvas fills the root at 0,0 and the
  // content is INSET by the frame thickness. ──
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
    ...bodyBackgroundStyle(theme),
  } satisfies Partial<CSSStyleDeclaration>);

  win.append(canvas, content);
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
  const text = hc.text ?? '#000000';
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

/**
 * The dominant (most frequent) fully-opaque color in a region of a
 * buffer. Used to recover a titlebar's fill BASE color from the
 * composited chrome — the fill dominates by area, stripes/ornament are
 * the minority, so the mode is the base. Colors are quantized to 4-bit
 * channels to fold near-identical shades together. Falls back to gray.
 */
function dominantColor(buf: PixelBuffer, rect: { x: number; y: number; w: number; h: number }): [number, number, number] {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const [r, g, b, a] = buf.getPixel(x, y);
      if (a < 255) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = counts.get(key);
      if (e) { e.n++; e.r += r; e.g += g; e.b += b; }
      else counts.set(key, { n: 1, r, g, b });
    }
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  if (!best) return [204, 204, 204];
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}
