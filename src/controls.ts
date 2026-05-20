import type { LoadedTheme } from './types.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';

/** 9-slice corner inset for a control cicn — matches the kDEF's ~6px for
 *  a 15px button face (FUN_30a8): floor((min(w,h)-3)/2). */
function sliceInset(w: number, h: number): number {
  return Math.max(2, Math.floor((Math.min(w, h) - 3) / 2));
}

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

export interface SliderOptions {
  orientation?: Orientation;
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a slider (kdef-layout-recipes §8): stretch the groove track
 * along the axis, stamp the thumb at the value position. 7 Le's thumb
 * cicns are 15×64 sprite sheets — 4 stacked 15×16 states
 * (blank / normal / pressed / disabled).
 */
export async function composeSlider(
  theme: LoadedTheme,
  opts: SliderOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'horizontal';
  const length = Math.max(32, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const state = opts.state ?? 'normal';
  const horiz = orientation === 'horizontal';

  const tkPrefix = state === 'disabled' || state === 'inactive' ? 'inactive-' : '';
  const track =
    (await loadByKey(theme, `${tkPrefix}non-directional-${horiz ? 'horizontal' : 'vertical'}-slider-track`)) ??
    (await loadByKey(theme, `non-directional-${horiz ? 'horizontal' : 'vertical'}-slider-track`));
  if (!track) return null;
  const thumbs = await loadByKey(theme, `non-directional-${horiz ? 'horizontal' : 'vertical'}-slider-thumbs`);

  const thickness = horiz ? track.height : track.width;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // groove: stretch the track along the axis
  if (horiz) out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: 0, y: 0, w: length, h: thickness });
  else out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: 0, y: 0, w: thickness, h: length });

  // thumb: pick the state row from the sprite sheet, stamp at value
  if (thumbs) {
    const stateRow = state === 'pressed' ? 2 : state === 'disabled' || state === 'inactive' ? 3 : 1;
    const tw = horiz ? thumbs.width : thumbs.width; // thumb cell is the short dimension wide
    // sheet stacks 4 states along the LONG axis
    const cells = 4;
    if (horiz) {
      const cellH = Math.floor(thumbs.height / cells);
      const thumbW = thumbs.width;
      const pos = Math.round(value * Math.max(0, length - thumbW));
      out.copyBits(thumbs, { x: 0, y: stateRow * cellH, w: thumbW, h: cellH }, { x: pos, y: 0, w: thumbW, h: cellH });
    } else {
      const cellW = Math.floor(thumbs.width / cells);
      const thumbH = thumbs.height;
      const pos = Math.round(value * Math.max(0, length - thumbH));
      out.copyBits(thumbs, { x: stateRow * cellW, y: 0, w: cellW, h: thumbH }, { x: 0, y: pos, w: cellW, h: thumbH });
    }
    void tw;
  }
  return out;
}

export interface DisclosureOptions {
  direction?: 'right' | 'down';
  state?: ControlState;
}

/** Compose a disclosure triangle: a fixed 12×12 state glyph, stamped 1:1. */
export async function composeDisclosure(
  theme: LoadedTheme,
  opts: DisclosureOptions = {},
): Promise<PixelBuffer | null> {
  const dir = opts.direction ?? 'right';
  const state = opts.state ?? 'normal';
  const prefix = state === 'pressed' ? 'pressed-' : state === 'disabled' || state === 'inactive' ? 'inactive-' : '';
  // note: the bundle has a typo "tringle" for inactive-right
  const keys = [
    `${prefix}${dir}-pointing-disclosure-triangle`,
    `${prefix}${dir}-pointing-disclosure-tringle`,
    `${dir}-pointing-disclosure-triangle`,
  ];
  for (const k of keys) {
    const g = await loadByKey(theme, k);
    if (g) return g;
  }
  return null;
}

export interface ProgressOptions {
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a determinate progress bar (kdef-layout-recipes §4): stretch
 * the unfilled track across the bar, overlay the fill cicn across the
 * 0..value portion (inset to the interior), cap with the frame ends.
 */
export async function composeProgress(
  theme: LoadedTheme,
  opts: ProgressOptions = {},
): Promise<PixelBuffer | null> {
  const length = Math.max(16, opts.length ?? 160);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const active = (opts.state ?? 'normal') !== 'inactive';
  const sfx = active ? 'active' : 'inactive';

  const track = await loadByKey(theme, `progress-bar-track-${sfx}`);
  if (!track) return null;
  const fill = await loadByKey(theme, `progress-bar-${sfx}`);
  const frame = await loadByKey(theme, `progress-bar-frame-${sfx}`);

  const h = frame ? frame.height : track.height;
  const out = PixelBuffer.alloc(length, h);

  // unfilled track across the whole bar (vertically centered)
  const tY = Math.round((h - track.height) / 2);
  out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: 0, y: tY, w: length, h: track.height });

  // fill across 0..value
  if (fill && value > 0) {
    const fillW = Math.round(value * length);
    const fY = Math.round((h - fill.height) / 2);
    if (fillW > 0) out.copyBits(fill, { x: 0, y: 0, w: fill.width, h: fill.height }, { x: 0, y: fY, w: fillW, h: fill.height });
  }

  // frame end caps (left + mirrored right) — first pass: stamp at ends
  if (frame) {
    const cap = Math.min(frame.width, Math.floor(length / 2));
    out.copyBits(frame, { x: 0, y: 0, w: cap, h: frame.height }, { x: 0, y: 0, w: cap, h: frame.height });
    out.copyBits(frame, { x: frame.width - cap, y: 0, w: cap, h: frame.height }, { x: length - cap, y: 0, w: cap, h: frame.height });
  }
  return out;
}

export interface ButtonOptions {
  label?: string;
  default?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  minWidth?: number;
  /** Title color (themed buttons carry no text-color metadata yet). */
  fg?: string;
}

/**
 * Compose a THEMED push button (kdef-layout-recipes §2, FUN_30a8):
 * 9-slice the `push-button-{active|pressed|inactive}` face into the
 * button rect; for the default button wrap the `push-button-ring`
 * around it; rasterize the label centered. Returns null if the scheme
 * ships no push-button cicns (→ baselineButton).
 */
export async function composeButton(theme: LoadedTheme, opts: ButtonOptions = {}): Promise<PixelBuffer | null> {
  const stateKey = opts.disabled ? 'inactive' : opts.pressed ? 'pressed' : 'active';
  const face = (await loadByKey(theme, `push-button-${stateKey}`)) ?? (await loadByKey(theme, 'push-button-active'));
  if (!face) return null; // baseline path
  const ring = opts.default ? await loadByKey(theme, 'push-button-ring-active') : null;

  const label = opts.label ?? '';
  // Themed buttons carry no text-color metadata; pick black/white by the
  // face's center luminance so labels stay legible on dark themes (1990).
  const [cr, cg, cb] = face.getPixel(face.width >> 1, face.height >> 1);
  const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  const fg = opts.fg ?? (lum < 128 ? '#ffffff' : '#000000');
  const glyphs = label ? rasterizeText(label, Math.max(8, Math.round(face.height * 0.6)), fg) : null;
  const padX = 10;
  const innerW = Math.max(opts.minWidth ?? 52, (glyphs ? glyphs.width : 0) + padX * 2);
  const innerH = face.height;
  const fIns = sliceInset(face.width, face.height);
  const faceIns = { l: fIns, t: fIns, r: fIns, b: fIns };

  let out: PixelBuffer;
  let fx = 0;
  let fy = 0;
  if (ring) {
    const pad = Math.max(2, Math.round((ring.width - face.width) / 2));
    out = PixelBuffer.alloc(innerW + pad * 2, innerH + pad * 2);
    const rIns = sliceInset(ring.width, ring.height);
    out.nineSlice(ring, { x: 0, y: 0, w: ring.width, h: ring.height }, { l: rIns, t: rIns, r: rIns, b: rIns }, { x: 0, y: 0, w: out.width, h: out.height });
    fx = pad;
    fy = pad;
  } else {
    out = PixelBuffer.alloc(innerW, innerH);
  }
  out.nineSlice(face, { x: 0, y: 0, w: face.width, h: face.height }, faceIns, { x: fx, y: fy, w: innerW, h: innerH });
  if (glyphs) out.drawOver(glyphs, fx + Math.round((innerW - glyphs.width) / 2), fy + Math.round((innerH - glyphs.height) / 2));
  return out;
}

/**
 * Compose a THEMED checkbox/radio glyph + label into a buffer. Stamps
 * the fixed-size state cicn 1:1 (radio: `radio-buttons-{on|off}-...`;
 * checkbox: `normal-{on|off}-...`). Returns null → baselineCheckable.
 */
export async function composeCheckable(
  theme: LoadedTheme,
  kind: 'checkbox' | 'radio',
  opts: { label?: string; checked?: boolean; disabled?: boolean; fg?: string } = {},
): Promise<PixelBuffer | null> {
  const on = opts.checked ? 'on' : 'off';
  const glyph =
    kind === 'radio'
      ? (await loadByKey(theme, `radio-buttons-${on}-${opts.disabled ? 'inactive' : 'active'}`))
      : (await loadByKey(theme, `normal-${on}-${opts.disabled ? 'disabled' : 'normal'}`));
  if (!glyph) return null;
  const label = opts.label ?? '';
  const glyphs = label ? rasterizeText(label, 9, opts.fg ?? '#000000') : null;
  const gap = 5;
  const w = glyph.width + (glyphs ? gap + glyphs.width : 0);
  const h = Math.max(glyph.height, glyphs ? glyphs.height : 0);
  const out = PixelBuffer.alloc(w, h);
  out.copyBits(glyph, { x: 0, y: 0, w: glyph.width, h: glyph.height }, { x: 0, y: Math.round((h - glyph.height) / 2), w: glyph.width, h: glyph.height });
  if (glyphs) out.drawOver(glyphs, glyph.width + gap, Math.round((h - glyphs.height) / 2));
  return out;
}

// ─── Baseline (procedural Platinum) controls ───────────────────────────
// Kaleidoscope leaves standard controls to the OS unless the scheme ships
// cicns (kdef-findings §2.2). 7 Le ships none, so these render as the
// Platinum default — DOM elements with procedural styling, not cicn
// composites. Accessible + the faithful path for cicn-less schemes.

export interface BaselineButtonOptions {
  default?: boolean;
  disabled?: boolean;
}

export function baselineButton(label: string, opts: BaselineButtonOptions = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = !!opts.disabled;
  Object.assign(b.style, {
    font: '12px Chicago, Charcoal, Geneva, sans-serif',
    padding: '2px 14px',
    minWidth: '58px',
    color: opts.disabled ? '#888' : '#000',
    background: 'linear-gradient(#ffffff, #cfcfcf)',
    border: '1px solid #555555',
    borderRadius: '9px',
    boxShadow: opts.default
      ? '0 0 0 2px #000, inset 0 1px 0 #ffffff'
      : 'inset 0 1px 0 #ffffff, inset 0 -1px 0 #b0b0b0',
    cursor: opts.disabled ? 'default' : 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  return b;
}

export function baselineCheckable(
  kind: 'checkbox' | 'radio',
  label: string,
  opts: { checked?: boolean; disabled?: boolean } = {},
): HTMLLabelElement {
  const wrap = document.createElement('label');
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    font: '12px Chicago, Charcoal, Geneva, sans-serif',
    color: opts.disabled ? '#888' : '#000',
  } satisfies Partial<CSSStyleDeclaration>);
  const box = document.createElement('span');
  Object.assign(box.style, {
    width: '12px',
    height: '12px',
    background: 'linear-gradient(#ffffff, #dcdcdc)',
    border: '1px solid #555555',
    borderRadius: kind === 'radio' ? '50%' : '2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    lineHeight: '1',
  } satisfies Partial<CSSStyleDeclaration>);
  if (opts.checked) box.textContent = kind === 'radio' ? '●' : '✓';
  const text = document.createElement('span');
  text.textContent = label;
  wrap.append(box, text);
  return wrap;
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
