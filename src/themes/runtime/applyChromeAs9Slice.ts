// 9-slice chrome rendering on the WINDOW ROOT via CSS border-image.
//
// For full-window chrome cicns (Kind B per docs/chrome-rendering-
// architecture.md): the cicn encodes the entire window frame — top
// edge with titlebar widgets, side edges with bevels, bottom edge with
// the frame line, corners pinned. Render via border-image on the
// .aaron-window element. The titlebar element overlays the cicn's top
// region for click + drag affordance.
//
// Differs from applyChromeAs3Slice (which applies border-image to the
// titlebar element only, for thin Kind A cicns).

import type { WindowTypeEntry } from '../schema/types.js';
import { deriveFrameGeometry } from './deriveFrameColor.js';

export interface NineSliceOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

const NINE_SLICE_ATTR = 'data-aaron-chrome-9slice' as const;

/**
 * Apply 9-slice chrome to the WINDOW ROOT element. The titlebar element
 * sits inside the border (overlapping the top border region) and the
 * content sits in the content box.
 *
 * Returns the slice values used so the consumer can stamp custom
 * properties matching them (for titlebar height alignment, etc.).
 *
 * No-op (returns null + clears) if the cicn dimensions or windowType
 * geometry don't support 9-slice rendering.
 */
export async function applyWindowAs9Slice(
  windowEl: HTMLElement,
  _windowType: WindowTypeEntry,
  options: NineSliceOptions,
): Promise<{ top: number; right: number; bottom: number; left: number } | null> {
  const { cicnUrl, cicnWidth, cicnHeight } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) {
    clearWindow9Slice(windowEl);
    return null;
  }
  const geom = await deriveFrameGeometry(cicnUrl);
  if (!geom) {
    clearWindow9Slice(windowEl);
    return null;
  }

  // Derive top slice: if the windowType has a top recipe with a named
  // bottom-frame part (e.g., the divider row), use that. Otherwise
  // estimate via "first transparent row after the titlebar widgets" by
  // scanning down from the cicn top. Pragmatic default: half the cicn
  // height if we can't tell — typical titlebar is the top portion.
  // (We could use the wnd# `parts` rects to find the lowest titlebar
  // widget y-bottom; deferred for now.)
  const top = geom.top > 0 ? geom.top : Math.max(18, Math.floor(cicnHeight / 3));
  const right = Math.max(1, geom.right);
  const bottom = Math.max(1, geom.bottom);
  const left = Math.max(1, geom.left);

  applyBorderImage(windowEl, cicnUrl, { cicnWidth, cicnHeight, top, right, bottom, left });
  return { top, right, bottom, left };
}

function applyBorderImage(
  el: HTMLElement,
  cicnUrl: string,
  cfg: {
    cicnWidth: number;
    cicnHeight: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  },
): void {
  clearWindow9Slice(el);
  el.setAttribute(NINE_SLICE_ATTR, 'window');
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  el.style.boxSizing = 'border-box';
  el.style.borderStyle = 'solid';
  el.style.borderColor = 'transparent';
  el.style.borderTopWidth = `${cfg.top}px`;
  el.style.borderRightWidth = `${cfg.right}px`;
  el.style.borderBottomWidth = `${cfg.bottom}px`;
  el.style.borderLeftWidth = `${cfg.left}px`;
  el.style.borderImageSource = cicnUrlCss;
  // No `fill` keyword: the cicn's CENTER region is discarded so the
  // element's own background (or window contents) shows through. The
  // cicn's body region is a placeholder for the actual window body —
  // never the intended visual. With `fill`, the center pixels tile
  // across the content box producing visible repetition (e.g., Big
  // Blue's icon stamped across the body, 1990's grunge tiled).
  el.style.borderImageSlice = `${cfg.top} ${cfg.right} ${cfg.bottom} ${cfg.left}`;
  el.style.borderImageWidth = `${cfg.top}px ${cfg.right}px ${cfg.bottom}px ${cfg.left}px`;
  el.style.borderImageRepeat = 'round';
  el.style.imageRendering = 'pixelated';
  // Stamp slice values so consumer CSS can position the titlebar
  // overlay and other affordances inside the border.
  el.style.setProperty('--aaron-frame-top-px', `${cfg.top}px`);
  el.style.setProperty('--aaron-frame-right-px', `${cfg.right}px`);
  el.style.setProperty('--aaron-frame-bottom-px', `${cfg.bottom}px`);
  el.style.setProperty('--aaron-frame-left-px', `${cfg.left}px`);
}

/** Clear 9-slice rendering: remove inline border styles + custom props. */
export function clearWindow9Slice(el: HTMLElement): void {
  el.removeAttribute(NINE_SLICE_ATTR);
  for (const prop of [
    'borderStyle', 'borderColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderImageSource', 'borderImageSlice', 'borderImageWidth', 'borderImageRepeat',
  ] as const) {
    el.style[prop] = '';
  }
  el.style.removeProperty('--aaron-frame-top-px');
  el.style.removeProperty('--aaron-frame-right-px');
  el.style.removeProperty('--aaron-frame-bottom-px');
  el.style.removeProperty('--aaron-frame-left-px');
}
