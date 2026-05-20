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
  if (!wt) throw new Error(`renderWindow: no usable windowType (wanted "${slug}")`);
  const cicnPath = wt.chrome[state] ?? wt.chrome.active;
  if (!cicnPath) throw new Error(`renderWindow: no chrome for state "${state}"`);
  // (chromeElement lookup kept for validation / future metadata use)
  findChromeElement(theme, cicnPath);

  const cicn = await loadCicnBuffer(assetUrl(theme, cicnPath));
  const composed = composeWindowChrome(cicn, wt, contentW, contentH);
  const { frame, fullWidth, fullHeight } = composed;

  // ── title: rasterized INTO the chrome buffer, colors DERIVED from the
  // composited titlebar (not the palette / hard-coded). The kDEF erases
  // the title region in the titlebar's fill color and draws the text in
  // the scheme's text color; we recover both by sampling the bar we just
  // composed — so it respects each scheme's actual geometry, incl. the
  // schemes that ship no palette (1990/acid/evolution). The center
  // placement matches the kDEF (title is centered on the content rect).
  if (title && frame.top > 6) {
    // Sample the dominant (modal) opaque color across the titlebar band:
    // that's the fill BASE (stripes/ornament are the minority), i.e. the
    // color the kDEF erases the title region to.
    const [er, eg, eb] = dominantColor(composed.buffer, { x: 0, y: 1, w: fullWidth, h: frame.top - 2 });
    // Text color: contrast against the erase base (light bar → black,
    // dark bar → white). Stand-in until cinf's text-color pixel is wired.
    const lum = 0.299 * er + 0.587 * eg + 0.114 * eb;
    const fgHex = lum < 128 ? '#ffffff' : '#000000';

    const textH = Math.max(7, Math.round(frame.top * 0.46));
    const glyphs = rasterizeText(title, textH, fgHex);
    const pad = 3;
    const bandW = glyphs.width + pad * 2;
    const bandX = Math.round((fullWidth - bandW) / 2);
    composed.buffer.fillRect({ x: bandX, y: 1, w: bandW, h: frame.top - 2 }, er, eg, eb, 255);
    composed.buffer.drawOver(glyphs, bandX + pad, Math.round((frame.top - glyphs.height) / 2));
  }

  // ── window root: positioned at the content rect ──
  const win = document.createElement('div');
  win.className = 'aw-window';
  win.dataset.awState = state;
  Object.assign(win.style, {
    position: 'relative',
    width: `${contentW * scale}px`,
    height: `${contentH * scale}px`,
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
    left: `${-frame.left * scale}px`,
    top: `${-frame.top * scale}px`,
    width: `${fullWidth * scale}px`,
    height: `${fullHeight * scale}px`,
    imageRendering: 'pixelated',
    zIndex: '0',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  // ── content body, on top of the (transparent) content hole ──
  const content = document.createElement('div');
  content.className = 'aw-content';
  Object.assign(content.style, {
    position: 'absolute',
    inset: '0',
    background: '#fff',
    boxSizing: 'border-box',
    overflow: 'auto',
    zIndex: '1',
  } satisfies Partial<CSSStyleDeclaration>);

  win.append(canvas, content);
  return win;
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
  if (wts[slug]) return wts[slug];
  const noun = slug.replace(/-window$/, '');
  for (const [k, v] of Object.entries(wts)) {
    if (k.includes(noun)) return v;
  }
  // raw doc-window resource ids (-14336 inactive / -14335 active family)
  for (const id of ['wnd--14336', 'wnd--14335', 'wnd--14332', 'wnd--14331']) {
    if (wts[id]) return wts[id];
  }
  for (const v of Object.values(wts)) {
    if (v.parts?.['part-0']) return v;
  }
  return Object.values(wts)[0];
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
