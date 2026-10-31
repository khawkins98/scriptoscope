// 8-bit simulation: what classic Kaleidoscope on an 8 bpp screen makes of art.
//
// On an 8-bit screen every pixel Kaleidoscope draws is one of the 256 entries of
// the Mac system palette (SYSTEM_PALETTE_256: the 6×6×6 cube plus four ramps).
// QuickDraw picks the entry from the colour the resource STORES, not from the
// colour the browser shows. So the simulation works in stored values:
//
//   display sRGB ──srgbToStored──▶ stored ──nearest entry──▶ entry ──macRgbToSrgb──▶ display
//
// The first step undoes the loader's 1.8 → 2.2 display transform
// (tools/theme-loader/mac-gamma.js), the last one re-applies it, so the output
// can sit next to a web preview. Quantising the on-screen values directly (as the
// first Python prototype did) picks a
// different entry for many mid-tones, because the gamma curve moves them across
// palette cells.
//
// "Nearest" models the Color Manager's inverse table: each stored channel is
// cut to its top `itabRes` bits (4 by default, the classic Mac default),
// widened back by repeating those bits (so 0xA5 becomes 0xAA), then matched to the nearest
// entry by Euclidean RGB distance. Checked against the real Kaleidoscope
// 2.3.1 captures in authoring/schemes/*/classic/ (8 bpp, Basilisk II): over
// 16,716 pixels of the fixed top-left corners of Castle's, Bonn's, Brickworks'
// and Halcyon's frames, located in the captures by search, 4-bit cells pick
// the entry classic drew for 92% of pixels (85–95% per scheme). Most misses
// are one grey step near a cell edge, or pixels where something else is drawn
// over the frame. Exact nearest (`itabRes: 0`) gets 59%, and quantising the
// on-screen values like the prototype 56%. It is a simulation, not a fidelity
// claim.
//
// Output colours: `output: 'web'` (default) shows each entry the way the web
// runtime shows stored colours (mac-gamma.js), so it sits next to a web
// preview. `output: 'capture'` uses the levels the committed Basilisk II
// captures show for the same entries (brighter, about (v/255)^0.69), so it
// sits next to classic/*.png. `output: 'stored'` returns the raw entries.
//
// Pure and portable: no fs, no DOM.

import { SYSTEM_PALETTE_256 } from './encode-icons.js';
import { srgbChannelToMac, parseColor } from './color.js';
import { macChannelToSrgb } from '../theme-loader/mac-gamma.js';

const PAL = SYSTEM_PALETTE_256;

// Every system-palette channel is a multiple of 17. These are the values the
// committed 8 bpp Basilisk II captures (authoring/schemes/*/classic/) show for
// each of those 16 levels, measured from the PNGs.
const CAPTURE_LEVELS = [0, 39, 63, 84, 102, 119, 135, 150, 165, 179, 192, 205, 218, 231, 243, 255];
const OUTPUTS = {
  web: macChannelToSrgb,
  capture: (v) => CAPTURE_LEVELS[Math.round(v / 17)],
  stored: (v) => v,
};
function outputFn(output) {
  const f = OUTPUTS[output];
  if (!f) throw new Error(`sim8: output must be 'web', 'capture' or 'stored', got ${JSON.stringify(output)}`);
  return f;
}

/**
 * Index of the system-palette entry nearest to a STORED colour.
 * @param {number[]} rgb stored [r, g, b], 0–255
 * @param {{ itabRes?: number }} [opts] model the inverse table's channel resolution (bits)
 */
export function nearestSystemIndex(rgb, { itabRes = 4 } = {}) {
  let [r, g, b] = rgb;
  if (itabRes) [r, g, b] = [r, g, b].map((v) => cellCentre(v, itabRes));
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PAL.length; i++) {
    const p = PAL[i];
    const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// A channel reduced to `bits` and widened back by bit replication (0xA → 0xAA).
function cellCentre(v, bits) {
  const q = v >> (8 - bits);
  let out = 0;
  for (let shift = 8 - bits; shift > -bits; shift -= bits) out |= shift >= 0 ? q << shift : q >> -shift;
  return out & 0xff;
}

/**
 * Where one colour lands at 8 bpp.
 * @param {string|number[]} color a display colour ('#rrggbb' or [r, g, b]) unless { gamma: false }
 * @param {{ gamma?: boolean, itabRes?: number, output?: 'web'|'capture'|'stored' }} [opts]
 * @returns {{ index: number, stored: number[], entry: number[], display: string, distance: number }}
 *   `stored` is what the resource holds, `entry` the palette entry (stored values),
 *   `display` the entry as the web shows it, `distance` the Euclidean distance
 *   between stored colour and entry (0 = exactly on the palette).
 */
export function systemEntryFor(color, { gamma = true, itabRes, output = gamma ? 'web' : 'stored' } = {}) {
  const rgb = parseColor(color);
  const stored = gamma ? rgb.map(srgbChannelToMac) : rgb;
  const index = nearestSystemIndex(stored, { itabRes });
  const entry = PAL[index].slice();
  const shown = entry.map(outputFn(output));
  const distance = Math.hypot(entry[0] - stored[0], entry[1] - stored[1], entry[2] - stored[2]);
  return { index, stored, entry, display: hex(shown), distance };
}

/**
 * Quantise an image the way an 8 bpp classic screen would.
 * @param {{ width: number, height: number, rgba?: Uint8Array|Uint8ClampedArray, data?: Uint8Array|Uint8ClampedArray }} image
 *   a Raster, or any { width, height, rgba } (e.g. decodePng's result). Display sRGB
 *   values unless { gamma: false }.
 *   With { gamma: false } the input is taken as stored values (e.g. a decoded
 *   cicn) and the output defaults to stored values too.
 * @param {{ gamma?: boolean, itabRes?: number, output?: 'web'|'capture'|'stored' }} [opts]
 * @returns {{ width: number, height: number, rgba: Uint8Array, colorsBefore: number, colorsAfter: number }}
 *   Alpha is copied unchanged; fully transparent pixels are left as they were
 *   and not counted.
 */
export function simulate8bit(image, { gamma = true, itabRes, output = gamma ? 'web' : 'stored' } = {}) {
  const src = image.rgba ?? image.data;
  if (!src || src.length !== image.width * image.height * 4) {
    throw new Error('simulate8bit: needs { width, height, rgba } with width × height × 4 bytes');
  }
  const out = new Uint8Array(src);
  const memo = new Map(); // packed display rgb → packed output rgb
  const before = new Set(), after = new Set();
  const toStored = gamma ? srgbChannelToMac : (v) => v;
  const toShown = outputFn(output);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const key = (out[i] << 16) | (out[i + 1] << 8) | out[i + 2];
    let q = memo.get(key);
    if (q === undefined) {
      const p = PAL[nearestSystemIndex([toStored(out[i]), toStored(out[i + 1]), toStored(out[i + 2])], { itabRes })];
      q = (toShown(p[0]) << 16) | (toShown(p[1]) << 8) | toShown(p[2]);
      memo.set(key, q);
    }
    before.add(key); after.add(q);
    out[i] = q >> 16; out[i + 1] = (q >> 8) & 0xff; out[i + 2] = q & 0xff;
  }
  return { width: image.width, height: image.height, rgba: out, colorsBefore: before.size, colorsAfter: after.size };
}

function hex(rgb) {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}
