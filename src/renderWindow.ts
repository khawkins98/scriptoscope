import type { LoadedTheme, WindowState, WindowType, Rect } from './types.js';
import { assetUrl, findChromeElement } from './loadTheme.js';

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
  /** Integer pixel-scale for the whole window (crisp upscaling). Default 1. */
  scale?: number;
}

/**
 * Frame thicknesses derived from the body part (`part-0`). In the Mac
 * Window Manager model the cicn's body rect tells us how much chrome
 * surrounds the content on each side.
 */
interface Frame {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function frameFromBody(bodyRect: Rect, cicnW: number, cicnH: number): Frame {
  const [left, top, right, bottom] = bodyRect;
  return {
    left,
    top,
    right: cicnW - right,
    bottom: cicnH - bottom,
    // ^ right/bottom thicknesses = cicn extent minus the body's far edge
  };
}

/**
 * Pick the horizontal stretch seam for the titlebar: the widest gap
 * between titlebar widgets (parts other than `part-0`). Close-type
 * widgets cluster left, zoom/windowshade right; the title stripe
 * between them is what stretches. Returns [seamStart, seamEnd] in
 * cicn-x. Falls back to the middle third when there aren't two
 * widget clusters to separate.
 */
function stretchSeam(parts: WindowType['parts'], cicnW: number): [number, number] {
  const spans: Array<[number, number]> = [];
  for (const [slug, part] of Object.entries(parts)) {
    if (slug === 'part-0') continue;
    const [l, , r] = part.rect;
    const x0 = Math.min(l, r);
    const x1 = Math.max(l, r);
    // Skip hairline parts (≤2px wide). Those are decorative dividers /
    // tick marks (e.g. 7 Le's part-4 at x28), not click-target widgets,
    // and letting them split a gap fools the seam heuristic.
    if (x1 - x0 <= 2) continue;
    spans.push([x0, x1]);
  }
  if (spans.length === 0) {
    return [Math.round(cicnW / 3), Math.round((cicnW * 2) / 3)];
  }
  spans.sort((a, b) => a[0] - b[0]);

  // Walk the gaps: before the first widget, between widgets, after the
  // last. The widest gap is the seam.
  let best: [number, number] = [0, 0];
  let bestW = -1;
  let cursor = 0;
  for (const [l, r] of spans) {
    const gap = l - cursor;
    if (gap > bestW) {
      bestW = gap;
      best = [cursor, l];
    }
    cursor = Math.max(cursor, r);
  }
  const tailGap = cicnW - cursor;
  if (tailGap > bestW) best = [cursor, cicnW];
  // Degenerate (widgets fill the whole bar): stretch a 1px sliver mid-bar.
  if (best[1] - best[0] <= 0) {
    const mid = Math.round(cicnW / 2);
    return [mid, mid + 1];
  }
  return best;
}

/**
 * Style a div so its background shows the cicn source rect
 * [sx0, sy0, sx1, sy1] scaled to fill the div's box. The div must have
 * `overflow: hidden` so the scaled background is clipped to exactly
 * this slice.
 */
function paintSlice(
  el: HTMLElement,
  cicnUrl: string,
  cicnW: number,
  cicnH: number,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  destW: number,
  destH: number,
): void {
  const scaleX = destW / (sx1 - sx0);
  const scaleY = destH / (sy1 - sy0);
  el.style.backgroundImage = `url("${cicnUrl}")`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = `${cicnW * scaleX}px ${cicnH * scaleY}px`;
  el.style.backgroundPosition = `${-sx0 * scaleX}px ${-sy0 * scaleY}px`;
  el.style.imageRendering = 'pixelated';
  el.style.overflow = 'hidden';
}

/**
 * Build a single themed window element. Slice 1 scope: titlebar chrome
 * (3-segment: left cap + stretched stripe + right cap) + a bordered
 * body box. The consumer's width/height is the CONTENT rect; chrome
 * extends OUTSIDE it (Mac Window Manager model).
 */
export function renderWindow(theme: LoadedTheme, opts: RenderWindowOptions = {}): HTMLElement {
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
  const ce = findChromeElement(theme, cicnPath);
  if (!ce) throw new Error(`renderWindow: no chromeElement for "${cicnPath}"`);
  const cicnUrl = assetUrl(theme, cicnPath);
  const cicnW = ce.width;
  const cicnH = ce.height;

  const body = wt.parts['part-0'];
  if (!body) throw new Error(`renderWindow: windowType "${slug}" has no part-0 body rect`);
  const frame = frameFromBody(body.rect, cicnW, cicnH);

  // ── window root: positioned at the content rect, chrome escapes out ──
  const win = document.createElement('div');
  win.className = 'aw-window';
  win.dataset.awState = state;
  Object.assign(win.style, {
    position: 'relative',
    width: `${contentW * scale}px`,
    height: `${contentH * scale}px`,
    // Chrome lives outside via absolutely-positioned children; the root
    // is just the content-rect anchor.
  } satisfies Partial<CSSStyleDeclaration>);

  // ── titlebar: spans the full footprint width, sits ABOVE content ──
  const tbH = frame.top * scale;
  const fullW = (frame.left + contentW + frame.right) * scale;
  const titlebar = document.createElement('div');
  titlebar.className = 'aw-titlebar';
  Object.assign(titlebar.style, {
    position: 'absolute',
    left: `${-frame.left * scale}px`,
    top: `${-tbH}px`,
    width: `${fullW}px`,
    height: `${tbH}px`,
    display: 'flex',
    flexDirection: 'row',
  } satisfies Partial<CSSStyleDeclaration>);

  const [seamL, seamR] = stretchSeam(wt.parts, cicnW);
  const capLsrc = seamL; // source px width of left cap
  const capRsrc = cicnW - seamR; // source px width of right cap
  const capLw = capLsrc * scale;
  const capRw = capRsrc * scale;
  const midW = fullW - capLw - capRw;

  const capL = document.createElement('div');
  capL.className = 'aw-titlebar__cap-left';
  capL.style.flex = `0 0 ${capLw}px`;
  capL.style.height = `${tbH}px`;
  paintSlice(capL, cicnUrl, cicnW, cicnH, 0, 0, seamL, frame.top, capLw, tbH);

  const mid = document.createElement('div');
  mid.className = 'aw-titlebar__fill';
  mid.style.flex = `1 1 ${midW}px`;
  mid.style.height = `${tbH}px`;
  paintSlice(mid, cicnUrl, cicnW, cicnH, seamL, 0, seamR, frame.top, midW, tbH);

  const capR = document.createElement('div');
  capR.className = 'aw-titlebar__cap-right';
  capR.style.flex = `0 0 ${capRw}px`;
  capR.style.height = `${tbH}px`;
  paintSlice(capR, cicnUrl, cicnW, cicnH, seamR, 0, cicnW, frame.top, capRw, tbH);

  // ── title label, centered over the bar ──
  const label = document.createElement('div');
  label.className = 'aw-titlebar__title';
  label.textContent = title;
  Object.assign(label.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    top: '0',
    bottom: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${Math.round(9 * scale)}px`,
    fontWeight: '700',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>);

  titlebar.append(capL, mid, capR, label);

  // ── side + bottom edges, sampled from the cicn's body-row frame ──
  // The cicn's body region is a 1px-tall sliver (rows frame.top..top+1);
  // its left/right columns are the side-frame pixels, which we stretch
  // down the content height. The bottom band (rows below the body) is
  // the bottom frame, stretched across the content width.
  const bodyRow0 = frame.top; // first body row in cicn-y
  const edges: HTMLElement[] = [];
  if (frame.left > 0) {
    const e = document.createElement('div');
    e.className = 'aw-edge aw-edge--left';
    Object.assign(e.style, {
      position: 'absolute',
      left: `${-frame.left * scale}px`,
      top: '0',
      width: `${frame.left * scale}px`,
      height: `${contentH * scale}px`,
    } satisfies Partial<CSSStyleDeclaration>);
    paintSlice(e, cicnUrl, cicnW, cicnH, 0, bodyRow0, frame.left, bodyRow0 + 1, frame.left * scale, contentH * scale);
    edges.push(e);
  }
  if (frame.right > 0) {
    const e = document.createElement('div');
    e.className = 'aw-edge aw-edge--right';
    Object.assign(e.style, {
      position: 'absolute',
      right: `${-frame.right * scale}px`,
      top: '0',
      width: `${frame.right * scale}px`,
      height: `${contentH * scale}px`,
    } satisfies Partial<CSSStyleDeclaration>);
    paintSlice(e, cicnUrl, cicnW, cicnH, cicnW - frame.right, bodyRow0, cicnW, bodyRow0 + 1, frame.right * scale, contentH * scale);
    edges.push(e);
  }
  if (frame.bottom > 0) {
    const e = document.createElement('div');
    e.className = 'aw-edge aw-edge--bottom';
    Object.assign(e.style, {
      position: 'absolute',
      left: `${-frame.left * scale}px`,
      bottom: `${-frame.bottom * scale}px`,
      width: `${fullW}px`,
      height: `${frame.bottom * scale}px`,
    } satisfies Partial<CSSStyleDeclaration>);
    paintSlice(e, cicnUrl, cicnW, cicnH, 0, cicnH - frame.bottom, cicnW, cicnH, fullW, frame.bottom * scale);
    edges.push(e);
  }

  // ── content body ──
  const content = document.createElement('div');
  content.className = 'aw-content';
  Object.assign(content.style, {
    position: 'absolute',
    inset: '0',
    background: '#fff',
    boxSizing: 'border-box',
    overflow: 'auto',
  } satisfies Partial<CSSStyleDeclaration>);

  win.append(content, titlebar, ...edges);
  return win;
}
