// scripts/generate-platinum/slice-doc-window.mjs
// Screenshot-sourced TITLED-window cicns (active + inactive), assembled into the
// min-size cicn the compositor tiles. Generic over window-type geometry: each type
// declares its cicn size + the 5-cell top boundaries (a/b/c/d) from its wnd# recipe,
// and the source screenshot landmarks. The title bar is a per-row pinstripe band, so
// a single clean flank column carries the whole vertical structure; the real fixed
// corners are pasted 1:1 and the plate is a solid #ccc band (the title sits on it).
//
// Re-measure landmarks if a screenshot is re-captured: leftX/rightX = the window
// outline columns at a title-bar row; srcY0 = the outline row; flankX = a clean
// pinstripe column (no widget, no title).
import { decodePng } from '../diag-lib.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Per-type geometry + sources. Cells: leftFixed [0,a) · leftFill [a,b) · plate
// [b,c) · rightFill [c,d) · rightFixed [d,W). stripe = the pinstripe band rows.
const TYPES = {
  'document-window': {
    W: 98, H: 23, a: 21, b: 27, c: 57, d: 63, stripe: [4, 15],
    active:   { src: 'doc-window-macintosh-hd-active.png',   leftX: 5, flankX: 70, rightX: 313, srcY0: 2 },
    inactive: { src: 'doc-window-macintosh-hd-inactive.png', leftX: 4, flankX: 40, rightX: 312, srcY0: 3 },
  },
  'movable-modal': {
    // Movable modal (Serialize, #20): pinstripe bar, NO widgets. No inactive shot
    // → inactive is derived. Cicn 58x19, top cells 17/23/47/53/58.
    W: 58, H: 19, a: 17, b: 23, c: 47, d: 53, stripe: [4, 15],
    active:   { src: 'dialog-serialize-serial.png', leftX: 14, flankX: 40, rightX: 346, srcY0: 8 },
    inactive: null,
  },
};

// Build a W×H cicn from a source image + geometry + landmarks.
function sliceChrome(im, g, p) {
  const { W, H, a, b, c, d, stripe } = g;
  if (p.srcY0 + H > im.height || p.rightX >= im.width || p.leftX < 0)
    throw new Error(`slice rect out of bounds for ${im.width}x${im.height} (srcY0=${p.srcY0}, rightX=${p.rightX})`);
  const out = new Uint8Array(W * H * 4);
  const px = (sx, row) => { const s = ((p.srcY0 + row) * im.width + sx) * 4; return [im.rgba[s], im.rgba[s + 1], im.rgba[s + 2]]; };
  const setCol = (dx, colFn) => { for (let y = 0; y < H; y++) { const [r, gg, bb] = colFn(y); const i = (y * W + dx) * 4; out[i] = r; out[i + 1] = gg; out[i + 2] = bb; out[i + 3] = 255; } };
  for (let i = 0; i < a; i++) { const sx = p.leftX + i; setCol(i, (y) => px(sx, y)); }              // leftFixed
  for (let dx = a; dx < b; dx++) setCol(dx, (y) => px(p.flankX, y));                                  // leftFill: pinstripe
  for (let dx = c; dx < d; dx++) setCol(dx, (y) => px(p.flankX, y));                                  // rightFill: pinstripe
  const solid = px(p.flankX, stripe[1] + 2);                                                         // solid-band gray (state-aware)
  for (let dx = b; dx < c; dx++) setCol(dx, (y) => (y >= stripe[0] && y <= stripe[1]) ? solid : px(p.flankX, y)); // plate: solid
  const rfw = W - d;
  for (let i = 0; i < rfw; i++) { const sx = p.rightX - (rfw - 1) + i; setCol(d + i, (y) => px(sx, y)); } // rightFixed
  // Bottom frame: the title-bar shot has no window-bottom, so synthesize the bottom
  // outline = the top-outline colour, sampled from row 0 at a flank column.
  const ocol = Math.min(W - 1, 40), ob = (0 * W + ocol) * 4;
  const topOut = [out[ob], out[ob + 1], out[ob + 2]];
  for (let dx = 0; dx < W; dx++) { const i = ((H - 1) * W + dx) * 4; out[i] = topOut[0]; out[i + 1] = topOut[1]; out[i + 2] = topOut[2]; out[i + 3] = 255; }
  return { width: W, height: H, rgba: out };
}

// Inactive fallback: flatten the active's tiled-middle pinstripe to the solid gray.
function deriveInactive(active, g) {
  const { W, H, a, d, stripe } = g;
  const out = active.rgba.slice();
  const li = (3 * W + Math.min(W - 1, a)) * 4;
  const flat = [active.rgba[li], active.rgba[li + 1], active.rgba[li + 2]];
  for (let y = stripe[0]; y <= stripe[1]; y++) for (let dx = a; dx < d; dx++) {
    const i = (y * W + dx) * 4; out[i] = flat[0]; out[i + 1] = flat[1]; out[i + 2] = flat[2]; out[i + 3] = 255;
  }
  return { width: W, height: H, rgba: out };
}

/** Slice the active + inactive cicns for a titled window type, or null if unknown. */
export function sliceWindow(type, srcDir) {
  const g = TYPES[type];
  if (!g) return null;
  const load = (s) => decodePng(readFileSync(resolve(srcDir, 'sources', s.src)));
  if (!existsSync(resolve(srcDir, 'sources', g.active.src))) return null;
  const active = sliceChrome(load(g.active), g, g.active);
  const inactive = (g.inactive && existsSync(resolve(srcDir, 'sources', g.inactive.src)))
    ? sliceChrome(load(g.inactive), g, g.inactive)
    : deriveInactive(active, g);
  return { active, inactive };
}

/** The window types this slicer can supply (have a source screenshot). */
export const SLICED_WINDOW_TYPES = Object.keys(TYPES);
