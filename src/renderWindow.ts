import type { LoadedTheme, WindowState, WindowType } from './types.js';
import { assetUrl, findChromeElement } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { composeWindowChrome } from './composeChrome.js';
import { rasterizeText } from './textRaster.js';

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

  // ── title: rasterized INTO the chrome buffer (single source of truth) ──
  // Clear a band (mask the pinstripe) in the titlebar's interior, then
  // alpha-over the glyphs. Native-res so it pixelates with the chrome.
  const pal = theme.manifest.palette ?? {};
  const tbBg = (state === 'inactive' ? pal['titlebar-inactive-bg'] : pal['titlebar-active-bg']) ?? '#cccccc';
  const tbFg = (state === 'inactive' ? pal['titlebar-inactive-fg'] : pal['titlebar-active-fg']) ?? '#000000';
  if (title && frame.top > 6) {
    // ~46% of the titlebar height — matches the period title cap height
    // (Chicago 12 in a ~22px bar reads ~9-10px tall).
    const textH = Math.max(7, Math.round(frame.top * 0.46));
    const glyphs = rasterizeText(title, textH, tbFg);
    const pad = 3;
    const bandW = glyphs.width + pad * 2;
    const bandX = Math.round((fullWidth - bandW) / 2);
    const bandY = 1;
    const bandH = frame.top - 2;
    const [br, bg, bb] = parseHexColor(tbBg);
    composed.buffer.fillRect({ x: bandX, y: bandY, w: bandW, h: bandH }, br, bg, bb, 255);
    const glyphX = bandX + pad;
    const glyphY = Math.round((frame.top - glyphs.height) / 2);
    composed.buffer.drawOver(glyphs, glyphX, glyphY);
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

/** Parse `#rgb` / `#rrggbb` → [r,g,b]. Falls back to mid-gray. */
function parseHexColor(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return [204, 204, 204];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
