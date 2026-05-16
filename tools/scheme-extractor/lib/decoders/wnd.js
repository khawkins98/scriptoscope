// Decode a 'wnd#' (Kaleidoscope window-type definition) resource.
//
// Per the TMPL 1240 spec embedded in every Kaleidoscope scheme:
//
//   "Rectangle List" — named clickable parts with rects in the chrome cicn
//     ZCNT                 2 bytes (count − 1)
//     for each entry:
//       Part               DWRD (int16)
//       Rectangle          RECT (4 × int16: top, left, bottom, right)
//
//   "Top Side"    — recipe for filling the top window-frame edge
//     ZCNT                 2 bytes (count − 1)
//     for each entry:
//       Part               DWRD
//       Border             DWRD  — pixel position along the edge
//
//   "Bottom Side" — same structure
//   "Left Side"   — same structure
//   "Right Side"  — same structure
//
// See docs/kaleidoscope-geometry-spec.md §3 for the rendering model and
// concrete decoded examples from mass:werk 7 Le + Dark ErgoBox 2.

import { Reader } from './shared.js';

/**
 * @param {Uint8Array} bytes  Raw wnd# resource bytes
 * @returns {{
 *   rectangles: Array<{part: number, rect: {top: number, left: number, bottom: number, right: number}}>,
 *   topSide:    Array<{part: number, border: number}>,
 *   bottomSide: Array<{part: number, border: number}>,
 *   leftSide:   Array<{part: number, border: number}>,
 *   rightSide:  Array<{part: number, border: number}>,
 * }}
 */
export function decodeWnd(bytes) {
  const r = new Reader(bytes);
  return {
    rectangles: readRectList(r),
    topSide:    readSideList(r),
    bottomSide: readSideList(r),
    leftSide:   readSideList(r),
    rightSide:  readSideList(r),
  };
}

function readRectList(r) {
  const cnt = r.readInt16() + 1; // ZCNT — zero-based count
  const out = [];
  for (let i = 0; i < cnt; i++) {
    const part = r.readInt16();
    const top = r.readInt16();
    const left = r.readInt16();
    const bottom = r.readInt16();
    const right = r.readInt16();
    out.push({ part, rect: { top, left, bottom, right } });
  }
  return out;
}

function readSideList(r) {
  const cnt = r.readInt16() + 1;
  const out = [];
  for (let i = 0; i < cnt; i++) {
    const part = r.readInt16();
    const border = r.readInt16();
    out.push({ part, border });
  }
  return out;
}
