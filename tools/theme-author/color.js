// Colour handling for scheme authoring.
//
// Why there is an "inverse gamma" step:
// Classic Macs displayed colours with a gamma of about 1.8; modern screens use
// about 2.2. When Scriptoscope LOADS a scheme it brightens every stored colour
// to compensate (tools/theme-loader/mac-gamma.js: out = 255·(in/255)^(1.8/2.2)).
// So if an author stored '#808080' it would appear lighter than '#808080' in
// the browser. To make "the colour I typed" equal "the colour I see", we store
// the inverse: stored = 255·(want/255)^(2.2/1.8). The round trip is exact to
// within ±1 per channel (8-bit rounding), and the stored value is also what a
// real 1.8-gamma Mac would have shown as the intended colour.

import { macChannelToSrgb } from '../theme-loader/mac-gamma.js';

/** Parse '#rgb', '#rrggbb' or [r, g, b] into [r, g, b] (0–255). */
export function parseColor(c) {
  if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0];
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c));
  if (!m) throw new Error(`parseColor: unsupported colour ${JSON.stringify(c)}`);
  const h = m[1].length === 3 ? [...m[1]].map((d) => d + d).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Build the inverse table by search rather than by formula, so that
// macChannelToSrgb(SRGB_TO_MAC[v]) is as close to v as the forward table allows.
const SRGB_TO_MAC = new Uint8Array(256);
for (let want = 0; want < 256; want++) {
  let best = 0, bestErr = Infinity;
  for (let stored = 0; stored < 256; stored++) {
    const err = Math.abs(macChannelToSrgb(stored) - want);
    if (err < bestErr) { best = stored; bestErr = err; }
  }
  SRGB_TO_MAC[want] = best;
}

/** Convert a display (sRGB) channel to the value to store in the resource. */
export function srgbChannelToMac(v) { return SRGB_TO_MAC[v & 0xff]; }

/** Convert a display colour to the [r, g, b] (8-bit) to store. */
export function srgbToStored(c, { gamma = true } = {}) {
  const rgb = parseColor(c);
  return gamma ? rgb.map(srgbChannelToMac) : rgb;
}

/** 8-bit → QuickDraw 16-bit channel (0xAB → 0xABAB). */
export const to16 = (v) => (v << 8) | v;
