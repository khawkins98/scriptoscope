// Procedural Mac OS 8 "Platinum" controls — the gray default Appearance look,
// drawn by code. This is our reimplementation of the OS's procedural CDEFs:
// the genuine Platinum chrome is NOT shippable as Kaleidoscope cicn/ppat
// (confirmed against the Mac OS 8.5/8.6 ISOs — windows/controls are WDEF/CDEF
// code, not bitmaps; and every "Platinum" Kaleidoscope scheme defers windows
// + standard controls to the OS). So a scheme that ships no cicn for a given
// control falls back to these, keeping the familiar Platinum look.
//
// ── GEOMETRY (classic Mac OS 8 Appearance, in native px) ───────────────────
//   checkbox / radio : 12 × 12   (1px frame, 1px top-left inner highlight)
//   checkbox mark    : a 2px-thick checkmark inset 3px
//   radio dot        : ø4 centered
//   slider track     : 6px sunken groove, centered on the control's cross axis
//   slider thumb     : 11 (cross) × 16 (along)  raised, 1px frame + bevel
//   control thickness: 16px (matches the cicn scrollbar/slider thickness)
//
// All values are documented so the renderers stay faithful + portable.

import { PixelBuffer } from './pixelBuffer.js';

type RGBA = [number, number, number, number];

// Platinum grayscale ramp.
const FRAME: RGBA = [85, 85, 85, 255]; // #555 control outline
const WHITE: RGBA = [255, 255, 255, 255];
const HILITE: RGBA = [255, 255, 255, 255];
const SHADOW: RGBA = [154, 154, 154, 255]; // #9a9a9a inner bevel shadow
const FACE_TOP: RGBA = [246, 246, 246, 255];
const FACE_BOT: RGBA = [205, 205, 205, 255]; // #cdcdcd raised-face gradient foot
const MARK: RGBA = [0, 0, 0, 255];
const MARK_OFF: RGBA = [136, 136, 136, 255]; // disabled mark / frame

const px = (b: PixelBuffer, x: number, y: number, c: RGBA) => b.setPixel(x, y, c[0], c[1], c[2], c[3]);

/** 1px rectangle outline [x,y,w,h]. */
function strokeRect(b: PixelBuffer, x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let i = 0; i < w; i++) { px(b, x + i, y, c); px(b, x + i, y + h - 1, c); }
  for (let i = 0; i < h; i++) { px(b, x, y + i, c); px(b, x + w - 1, y + i, c); }
}

/** Bresenham line, optionally 2px thick (extra pixel below-right). */
function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: RGBA, thick = false): void {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(b, x0, y0, c);
    if (thick) px(b, x0, y0 + 1, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Filled disc of diameter d at top-left (x,y). */
function disc(b: PixelBuffer, x: number, y: number, d: number, c: RGBA): void {
  const r = (d - 1) / 2;
  for (let j = 0; j < d; j++)
    for (let i = 0; i < d; i++) {
      const dxr = i - r, dyr = j - r;
      if (dxr * dxr + dyr * dyr <= (r + 0.25) * (r + 0.25)) px(b, x + i, y + j, c);
    }
}

export interface PlatinumCheckOptions {
  checked?: boolean;
  mixed?: boolean;
  disabled?: boolean;
}

/**
 * Procedural Platinum checkbox / radio glyph (12×12). White face with a 1px
 * frame + top-left highlight; checkbox marks a 2px checkmark, radio a ø4 dot.
 */
export function platinumCheckable(kind: 'checkbox' | 'radio', opts: PlatinumCheckOptions = {}): PixelBuffer {
  const S = 12;
  const b = PixelBuffer.alloc(S, S);
  const frame = opts.disabled ? MARK_OFF : FRAME;
  const mark = opts.disabled ? MARK_OFF : MARK;

  if (kind === 'radio') {
    // white disc, frame ring, top-left highlight arc
    disc(b, 0, 0, S, WHITE);
    // ring: redraw outer rim in frame by stroking a slightly inset disc edge
    for (let j = 0; j < S; j++)
      for (let i = 0; i < S; i++) {
        const r = (S - 1) / 2, dxr = i - r, dyr = j - r, dist = Math.sqrt(dxr * dxr + dyr * dyr);
        if (dist > r - 0.9 && dist <= r + 0.25) px(b, i, j, frame);
      }
    if (opts.checked) disc(b, 4, 4, 4, mark);
  } else {
    b.fillRect({ x: 1, y: 1, w: S - 2, h: S - 2 }, WHITE[0], WHITE[1], WHITE[2], 255);
    strokeRect(b, 0, 0, S, S, frame);
    // raised inner bevel: top/left highlight, bottom/right shadow
    for (let i = 1; i < S - 1; i++) { px(b, i, 1, HILITE); px(b, 1, i, HILITE); }
    for (let i = 1; i < S - 1; i++) { px(b, i, S - 2, SHADOW); px(b, S - 2, i, SHADOW); }
    if (opts.mixed) {
      line(b, 3, 6, 8, 6, mark, true); // dash for mixed state
    } else if (opts.checked) {
      // checkmark: short descending stroke + long ascending stroke (2px thick)
      line(b, 3, 6, 5, 8, mark, true);
      line(b, 5, 8, 9, 3, mark, true);
    }
  }
  return b;
}

export interface PlatinumSliderOptions {
  orientation?: 'horizontal' | 'vertical';
  length?: number;
  value?: number; // 0..1
  disabled?: boolean;
}

/**
 * Procedural Platinum slider: a 6px sunken groove down the middle of a 16px
 * control, with a raised 11×16 thumb positioned by value.
 */
export function platinumSlider(opts: PlatinumSliderOptions = {}): PixelBuffer {
  const horiz = (opts.orientation ?? 'horizontal') === 'horizontal';
  const length = Math.max(32, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const thickness = 16;
  const grooveT = 6; // groove cross-axis size
  const thumbCross = 11;
  const thumbAlong = 16;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // groove: sunken channel centered on the cross axis (dark top/left edge,
  // light bottom/right) with a gray fill.
  const g0 = Math.round((thickness - grooveT) / 2);
  if (horiz) {
    out.fillRect({ x: 1, y: g0, w: length - 2, h: grooveT }, 200, 200, 200, 255);
    for (let x = 1; x < length - 1; x++) { px(out, x, g0, SHADOW); px(out, x, g0 + grooveT - 1, WHITE); }
  } else {
    out.fillRect({ x: g0, y: 1, w: grooveT, h: length - 2 }, 200, 200, 200, 255);
    for (let y = 1; y < length - 1; y++) { px(out, g0, y, SHADOW); px(out, g0 + grooveT - 1, y, WHITE); }
  }

  // thumb: raised rounded face positioned by value along the long axis.
  const drawThumb = (tx: number, ty: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) {
      const t = j / Math.max(1, h - 1);
      const r = Math.round(FACE_TOP[0] + (FACE_BOT[0] - FACE_TOP[0]) * t);
      for (let i = 0; i < w; i++) px(out, tx + i, ty + j, [r, r, r, 255]);
    }
    strokeRect(out, tx, ty, w, h, opts.disabled ? MARK_OFF : FRAME);
    for (let i = 1; i < w - 1; i++) px(out, tx + i, ty + 1, HILITE);
    for (let i = 1; i < h - 1; i++) px(out, tx + 1, ty + i, HILITE);
  };
  if (horiz) {
    const travel = length - thumbCross;
    drawThumb(Math.round(value * travel), Math.round((thickness - thumbAlong) / 2), thumbCross, thumbAlong);
  } else {
    const travel = length - thumbCross;
    drawThumb(Math.round((thickness - thumbAlong) / 2), Math.round(value * travel), thumbAlong, thumbCross);
  }
  return out;
}
