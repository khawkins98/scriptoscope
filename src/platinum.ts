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
import { rasterizeText } from './textRaster.js';

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

/** Raised gray face (white→#cdcdcd vertical gradient) in [x,y,w,h]. */
function raisedFace(b: PixelBuffer, x: number, y: number, w: number, h: number, disabled = false): void {
  for (let j = 0; j < h; j++) {
    const t = j / Math.max(1, h - 1);
    const base = disabled ? 224 : Math.round(FACE_TOP[0] + (FACE_BOT[0] - FACE_TOP[0]) * t);
    for (let i = 0; i < w; i++) px(b, x + i, y + j, [base, base, base, 255]);
  }
  strokeRect(b, x, y, w, h, disabled ? MARK_OFF : FRAME);
  for (let i = 1; i < w - 1; i++) px(b, x + i, y + 1, HILITE);
  for (let i = 1; i < h - 1; i++) px(b, x + 1, y + i, HILITE);
}

export interface PlatinumButtonOptions {
  label?: string;
  default?: boolean;
  disabled?: boolean;
  minWidth?: number;
}

/**
 * Procedural Platinum push button: 20px tall raised gray face, 1px frame,
 * label centered (Charcoal-ish). Default button gets a 2px black ring with a
 * 1px gap. Geometry: height 20, padX 12, minWidth 56, ring pad 3.
 */
export function platinumButton(opts: PlatinumButtonOptions = {}): PixelBuffer {
  const h = 20;
  const fg = opts.disabled ? '#9a9a9a' : '#000000';
  const glyphs = opts.label ? rasterizeText(opts.label, 11, fg) : null;
  const innerW = Math.max(opts.minWidth ?? 56, (glyphs ? glyphs.width : 0) + 24);
  const ringPad = opts.default ? 3 : 0;
  const out = PixelBuffer.alloc(innerW + ringPad * 2, h + ringPad * 2);
  const bx = ringPad, by = ringPad;
  if (opts.default) {
    strokeRect(out, 0, 0, out.width, out.height, MARK); // 1px black ring
    strokeRect(out, 1, 1, out.width - 2, out.height - 2, MARK);
  }
  raisedFace(out, bx, by, innerW, h, opts.disabled);
  if (glyphs) out.drawOver(glyphs, bx + Math.round((innerW - glyphs.width) / 2), by + Math.round((h - glyphs.height) / 2));
  return out;
}

/** Filled triangle arrow pointing 'l'|'r'|'u'|'d', fit in a size×size box. */
function arrow(b: PixelBuffer, x: number, y: number, size: number, dir: 'l' | 'r' | 'u' | 'd', c: RGBA): void {
  const n = Math.floor(size * 0.42); // arrow half-extent
  const cx = x + Math.floor(size / 2), cy = y + Math.floor(size / 2);
  for (let i = 0; i <= n; i++) {
    const span = n - i;
    for (let s = -span; s <= span; s++) {
      // i=0 is the wide base, i=n the single-pixel tip; the tip must point
      // the named way (a right arrow ▶ has its tip on the RIGHT).
      if (dir === 'r') px(b, cx - n + i + Math.floor(n / 2), cy + s, c);
      else if (dir === 'l') px(b, cx + n - i - Math.floor(n / 2), cy + s, c);
      else if (dir === 'd') px(b, cx + s, cy - n + i + Math.floor(n / 2), c);
      else px(b, cx + s, cy + n - i - Math.floor(n / 2), c); // 'u'
    }
  }
}

/**
 * Procedural Platinum disclosure triangle (12×12): a filled black triangle,
 * right-pointing (collapsed) or down-pointing (expanded).
 */
export function platinumDisclosure(opts: { direction?: 'right' | 'down'; disabled?: boolean } = {}): PixelBuffer {
  const S = 12;
  const b = PixelBuffer.alloc(S, S);
  arrow(b, 0, 0, S, opts.direction === 'down' ? 'd' : 'r', opts.disabled ? MARK_OFF : MARK);
  return b;
}

export interface PlatinumScrollbarOptions {
  orientation?: 'horizontal' | 'vertical';
  length?: number;
  value?: number; // 0..1
  thumbExtent?: number; // fraction of track, 0..1
  disabled?: boolean;
}

/**
 * Procedural Platinum scrollbar (16px thick): a raised arrow box at each end
 * (triangle), a sunken gray track between, and a raised thumb positioned by
 * value. Geometry: thickness 16, arrow box 16×16, thumb ≥ 24 along the axis.
 */
export function platinumScrollbar(opts: PlatinumScrollbarOptions = {}): PixelBuffer {
  const horiz = (opts.orientation ?? 'vertical') === 'horizontal';
  const T = 16;
  const length = Math.max(T * 3, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0));
  const ext = Math.min(1, Math.max(0.1, opts.thumbExtent ?? 0.4));
  const out = horiz ? PixelBuffer.alloc(length, T) : PixelBuffer.alloc(T, length);
  const SUNK: RGBA = [200, 200, 200, 255];

  // sunken track across the whole bar
  if (horiz) { out.fillRect({ x: 0, y: 0, w: length, h: T }, SUNK[0], SUNK[1], SUNK[2], 255); strokeRect(out, 0, 0, length, T, FRAME); }
  else { out.fillRect({ x: 0, y: 0, w: T, h: length }, SUNK[0], SUNK[1], SUNK[2], 255); strokeRect(out, 0, 0, T, length, FRAME); }

  // arrow boxes at both ends (raised face + triangle pointing outward)
  const mk = opts.disabled ? MARK_OFF : MARK;
  if (horiz) {
    raisedFace(out, 0, 0, T, T, opts.disabled); arrow(out, 0, 0, T, 'l', mk);
    raisedFace(out, length - T, 0, T, T, opts.disabled); arrow(out, length - T, 0, T, 'r', mk);
  } else {
    raisedFace(out, 0, 0, T, T, opts.disabled); arrow(out, 0, 0, T, 'u', mk);
    raisedFace(out, 0, length - T, T, T, opts.disabled); arrow(out, 0, length - T, T, 'd', mk);
  }

  // thumb in the track region between the arrow boxes
  const trackStart = T;
  const trackLen = Math.max(0, length - T * 2);
  const thumbLen = Math.max(20, Math.round(trackLen * ext));
  const pos = trackStart + Math.round(value * Math.max(0, trackLen - thumbLen));
  if (trackLen >= thumbLen) {
    if (horiz) raisedFace(out, pos, 0, thumbLen, T, opts.disabled);
    else raisedFace(out, 0, pos, T, thumbLen, opts.disabled);
    // platinum grip: 3 short lines at the thumb center
    const gc = opts.disabled ? MARK_OFF : SHADOW;
    if (horiz) { const mx = pos + Math.round(thumbLen / 2); for (let k = -2; k <= 2; k += 2) for (let yy = 5; yy <= 10; yy++) px(out, mx + k, yy, gc); }
    else { const my = pos + Math.round(thumbLen / 2); for (let k = -2; k <= 2; k += 2) for (let xx = 5; xx <= 10; xx++) px(out, xx, my + k, gc); }
  }
  return out;
}

/** Sunken/recessed gray face (pressed or toggled-ON): dark top/left edge, light
 *  bottom/right, flat slightly-darker fill. The inverse bevel of raisedFace. */
function sunkenFace(b: PixelBuffer, x: number, y: number, w: number, h: number, disabled = false): void {
  const base = disabled ? 224 : 210;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(b, x + i, y + j, [base, base, base, 255]);
  strokeRect(b, x, y, w, h, disabled ? MARK_OFF : FRAME);
  for (let i = 1; i < w - 1; i++) { px(b, x + i, y + 1, SHADOW); px(b, x + i, y + h - 2, HILITE); }
  for (let i = 1; i < h - 1; i++) { px(b, x + 1, y + i, SHADOW); px(b, x + w - 2, y + i, HILITE); }
}

export interface PlatinumBevelButtonOptions {
  label?: string;
  on?: boolean;       // toggled / selected (sunken)
  pressed?: boolean;  // momentary press (sunken)
  disabled?: boolean;
  small?: boolean;
  minWidth?: number;
}

/**
 * Procedural Platinum BEVEL button (toolbar / palette button) — a squarer, more
 * pronounced raised face than the push button. Toggled-ON or pressed → sunken
 * bevel with the label nudged 1px down-right. Baseline for the -10162..-10176
 * bevel-button art every scheme ships (grafted later).
 */
export function platinumBevelButton(opts: PlatinumBevelButtonOptions = {}): PixelBuffer {
  const h = opts.small ? 18 : 22;
  const fg = opts.disabled ? '#9a9a9a' : '#000000';
  const glyphs = opts.label ? rasterizeText(opts.label, opts.small ? 10 : 11, fg) : null;
  const w = Math.max(opts.minWidth ?? h, (glyphs ? glyphs.width : 0) + 16);
  const out = PixelBuffer.alloc(w, h);
  const sunk = !!(opts.on || opts.pressed);
  if (sunk) sunkenFace(out, 0, 0, w, h, opts.disabled);
  else raisedFace(out, 0, 0, w, h, opts.disabled);
  if (glyphs) out.drawOver(glyphs, Math.round((w - glyphs.width) / 2) + (sunk ? 1 : 0), Math.round((h - glyphs.height) / 2) + (sunk ? 1 : 0));
  return out;
}

export interface PlatinumMenuBarOptions {
  titles?: string[];
  activeIdx?: number; // the pulled-down title (inverts)
  width?: number;
}

/**
 * Procedural Platinum menu bar: a 20px light raised strip with a 1px white top
 * highlight + 1px black base line; titles in black, the pulled-down title
 * inverted (black bar, white text). Baseline for the menu-bar cicn (-12319).
 */
export function platinumMenuBar(opts: PlatinumMenuBarOptions = {}): PixelBuffer {
  const titles = opts.titles ?? ['File', 'Edit', 'View', 'Special'];
  const H = 20, padX = 10;
  const labs = titles.map((t) => rasterizeText(t, 12, '#000000'));
  let x = 8;
  const xs = labs.map((g) => { const s = x; x += g.width + padX * 2; return s; });
  const W = Math.max(opts.width ?? 0, x + 8);
  const out = PixelBuffer.alloc(W, H);
  out.fillRect({ x: 0, y: 0, w: W, h: H }, 238, 238, 238, 255);
  for (let i = 0; i < W; i++) { px(out, i, 0, WHITE); px(out, i, H - 1, MARK); }
  labs.forEach((g, i) => {
    const cellX = xs[i]!, cellW = g.width + padX * 2;
    if (i === opts.activeIdx) {
      out.fillRect({ x: cellX, y: 1, w: cellW, h: H - 2 }, 0, 0, 0, 255);
      const wg = rasterizeText(titles[i]!, 12, '#ffffff');
      out.drawOver(wg, cellX + padX, Math.round((H - wg.height) / 2));
    } else {
      out.drawOver(g, cellX + padX, Math.round((H - g.height) / 2));
    }
  });
  return out;
}

export interface PlatinumMenuOptions {
  items?: string[]; // '-' renders a separator
  highlightIdx?: number;
  width?: number;
}

/**
 * Procedural Platinum dropdown menu panel: white body, 1px black frame + a 1px
 * black drop shadow (bottom+right), ~16px items; the highlighted item inverts;
 * '-' is a separator rule. Baseline for the menu-highlight cicns (-12247..-12287).
 */
export function platinumMenu(opts: PlatinumMenuOptions = {}): PixelBuffer {
  const items = opts.items ?? ['Undo', 'Redo', '-', 'Cut', 'Copy', 'Paste'];
  const ih = 16, padX = 16;
  const labs = items.map((t) => (t === '-' ? null : rasterizeText(t, 12, '#000000')));
  const contentW = Math.max(opts.width ?? 0, Math.max(1, ...labs.map((g) => (g ? g.width : 0))) + padX * 2);
  const W = contentW, panelH = items.length * ih + 2;
  const out = PixelBuffer.alloc(W + 1, panelH + 1);
  for (let i = 1; i <= W; i++) px(out, i, panelH, MARK);   // bottom shadow
  for (let j = 1; j <= panelH; j++) px(out, W, j, MARK);   // right shadow
  out.fillRect({ x: 0, y: 0, w: W, h: panelH }, 255, 255, 255, 255);
  strokeRect(out, 0, 0, W, panelH, MARK);
  items.forEach((it, i) => {
    const y = 1 + i * ih;
    if (it === '-') { for (let xx = 2; xx < W - 2; xx++) px(out, xx, y + (ih >> 1), SHADOW); return; }
    if (i === opts.highlightIdx) {
      out.fillRect({ x: 1, y, w: W - 2, h: ih }, 0, 0, 0, 255);
      const wg = rasterizeText(it, 12, '#ffffff');
      out.drawOver(wg, padX, y + Math.round((ih - wg.height) / 2));
    } else {
      out.drawOver(labs[i]!, padX, y + Math.round((ih - labs[i]!.height) / 2));
    }
  });
  return out;
}

export interface PlatinumPopupMenuOptions {
  label?: string;
  disabled?: boolean;
  minWidth?: number;
}

/**
 * Procedural Platinum popup menu (the closed pop-up button): a raised face with
 * the label left-aligned, a 1px divider + a down-arrow box at the right, and a
 * 1px drop shadow (bottom+right). Baseline for the pop-menu-button cicns
 * (-8200..-8208) + their arrow glyph (-8194..-8199).
 */
export function platinumPopupMenu(opts: PlatinumPopupMenuOptions = {}): PixelBuffer {
  const h = 20, arrowBox = 16;
  const fg = opts.disabled ? '#9a9a9a' : '#000000';
  const glyphs = opts.label ? rasterizeText(opts.label, 11, fg) : null;
  const innerW = Math.max(opts.minWidth ?? 80, (glyphs ? glyphs.width : 0) + 16 + arrowBox);
  const out = PixelBuffer.alloc(innerW + 1, h + 1);
  for (let i = 1; i <= innerW; i++) px(out, i, h, MARK);   // bottom shadow
  for (let j = 1; j <= h; j++) px(out, innerW, j, MARK);   // right shadow
  raisedFace(out, 0, 0, innerW, h, opts.disabled);
  if (glyphs) out.drawOver(glyphs, 8, Math.round((h - glyphs.height) / 2));
  const abx = innerW - arrowBox;
  for (let j = 1; j < h - 1; j++) px(out, abx, j, opts.disabled ? MARK_OFF : FRAME); // divider
  arrow(out, abx + Math.round((arrowBox - 11) / 2), Math.round((h - 11) / 2), 11, 'd', opts.disabled ? MARK_OFF : MARK);
  return out;
}

export interface PlatinumListHeaderColumn { label: string; width: number; }
export interface PlatinumListHeaderOptions { columns?: PlatinumListHeaderColumn[]; height?: number; }

/**
 * Procedural Platinum list / Finder column header: a row of raised gray cells
 * (each 1px-framed → reads as divided columns) with left-aligned labels.
 * Baseline for the finder-header cicns (-9567/-9568).
 */
export function platinumListHeader(opts: PlatinumListHeaderOptions = {}): PixelBuffer {
  const cols = opts.columns ?? [{ label: 'Name', width: 140 }, { label: 'Size', width: 56 }, { label: 'Kind', width: 90 }];
  const H = opts.height ?? 16;
  const W = cols.reduce((a, c) => a + c.width, 0);
  const out = PixelBuffer.alloc(W, H);
  let x = 0;
  for (const c of cols) {
    raisedFace(out, x, 0, c.width, H);
    const g = rasterizeText(c.label, 11, '#000000');
    out.drawOver(g, x + 6, Math.round((H - g.height) / 2));
    x += c.width;
  }
  return out;
}

