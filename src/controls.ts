import type { LoadedTheme } from './types.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';

/**
 * Look up a chromeElement by its bundle key (e.g.
 * `'normal-horizontal-scrollbar'`) and load its cicn into a PixelBuffer.
 * Returns null if the scheme doesn't ship that element (→ baseline path).
 */
async function loadByKey(theme: LoadedTheme, key: string): Promise<PixelBuffer | null> {
  const el = theme.manifest.chromeElements?.[key];
  if (!el?.asset) return null;
  return loadCicnBuffer(assetUrl(theme, el.asset));
}

export type Orientation = 'horizontal' | 'vertical';
export type ControlState = 'normal' | 'pressed' | 'disabled' | 'inactive';

export interface ScrollbarOptions {
  orientation?: Orientation;
  /** Length along the scroll axis, in px (thickness is fixed by the cicn). */
  length?: number;
  /** Thumb position, 0..1. */
  value?: number;
  /** Thumb size as a fraction of the track, 0..1. */
  thumbExtent?: number;
  state?: ControlState;
}

/**
 * Compose a scrollbar into a pixel buffer (kdef-layout-recipes §3):
 * stretch the track cicn along the axis, stamp the thumb at the
 * value-proportional position. 7 Le ships an empty (white) track + a
 * blue striped thumb; arrows are OS-baseline (not in the bundle).
 *
 * Returns null if the scheme ships no scrollbar cicns (baseline path).
 */
export async function composeScrollbar(
  theme: LoadedTheme,
  opts: ScrollbarOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'vertical';
  const length = Math.max(16, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0));
  const state = opts.state ?? 'normal';

  const horiz = orientation === 'horizontal';
  const trackKey = `${state === 'pressed' ? 'pressed' : state === 'disabled' ? 'disabled' : 'normal'}-${horiz ? 'horizontal' : 'vertical'}-scrollbar`;
  const track = (await loadByKey(theme, trackKey)) ?? (await loadByKey(theme, `normal-${horiz ? 'horizontal' : 'vertical'}-scrollbar`));
  if (!track) return null; // baseline path
  const thumb = await loadByKey(theme, `${horiz ? 'horizontal' : 'vertical'}-thumb`);

  const thickness = horiz ? track.height : track.width;
  const out = horiz
    ? PixelBuffer.alloc(length, thickness)
    : PixelBuffer.alloc(thickness, length);

  // ── track: stretch the track cell along the axis ──
  if (horiz) {
    out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: 0, y: 0, w: length, h: thickness });
  } else {
    out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: 0, y: 0, w: thickness, h: length });
  }

  // ── thumb: stamp at the value-proportional position (1:1, no scale) ──
  if (thumb) {
    const thumbLen = horiz ? thumb.width : thumb.height;
    const travel = Math.max(0, length - thumbLen);
    const pos = Math.round(value * travel);
    if (horiz) {
      out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: pos, y: 0, w: thumb.width, h: thumb.height });
    } else {
      out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: 0, y: pos, w: thumb.width, h: thumb.height });
    }
  }

  return out;
}

/** Blit a composed control buffer to a CSS-scaled, pixelated canvas. */
export function bufferToCanvas(buf: PixelBuffer, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(buf.toImageData(), 0, 0);
  Object.assign(canvas.style, {
    width: `${buf.width * scale}px`,
    height: `${buf.height * scale}px`,
    imageRendering: 'pixelated',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);
  return canvas;
}
