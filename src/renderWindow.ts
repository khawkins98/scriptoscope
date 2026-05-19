import type { LoadedTheme, WindowState } from './types.js';
import { assetUrl, findChromeElement } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { composeWindowChrome } from './composeChrome.js';

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

  const wt = theme.manifest.windowTypes[slug];
  if (!wt) throw new Error(`renderWindow: no windowType "${slug}"`);
  const cicnPath = wt.chrome[state] ?? wt.chrome.active;
  if (!cicnPath) throw new Error(`renderWindow: no chrome for state "${state}"`);
  // (chromeElement lookup kept for validation / future metadata use)
  findChromeElement(theme, cicnPath);

  const cicn = await loadCicnBuffer(assetUrl(theme, cicnPath));
  const composed = composeWindowChrome(cicn, wt, contentW, contentH);
  const { frame, fullWidth, fullHeight } = composed;

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

  // ── title pill: clear background masks the pinstripe behind the text ──
  const pal = theme.manifest.palette ?? {};
  const tbBg = state === 'inactive' ? pal['titlebar-inactive-bg'] : pal['titlebar-active-bg'];
  const tbFg = state === 'inactive' ? pal['titlebar-inactive-fg'] : pal['titlebar-active-fg'];
  const label = document.createElement('div');
  label.className = 'aw-title';
  Object.assign(label.style, {
    position: 'absolute',
    left: `${-frame.left * scale}px`,
    top: `${-frame.top * scale}px`,
    width: `${fullWidth * scale}px`,
    height: `${frame.top * scale}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: '2',
  } satisfies Partial<CSSStyleDeclaration>);
  if (title) {
    const pill = document.createElement('span');
    pill.textContent = title;
    Object.assign(pill.style, {
      backgroundColor: tbBg ?? '#cccccc',
      padding: `0 ${4 * scale}px`,
      fontSize: `${Math.round(9 * scale)}px`,
      fontWeight: '700',
      whiteSpace: 'nowrap',
      color: tbFg ?? '#000000',
    } satisfies Partial<CSSStyleDeclaration>);
    label.appendChild(pill);
  }

  win.append(canvas, content, label);
  return win;
}
