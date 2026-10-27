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
// The recipe-walking rules + rendering model (how these side-lists are drawn)
// are in docs/spec/kdef231-recipe-walk.md + docs/spec/compositor-spec.md.

import { Reader, readRect } from './shared.js';

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
    topSide:    readSideList(r, 'top side'),
    bottomSide: readSideList(r, 'bottom side'),
    leftSide:   readSideList(r, 'left side'),
    rightSide:  readSideList(r, 'right side'),
  };
}

function readRectList(r) {
  const cnt = readCount(r, 10, 'rectangle list');
  const out = [];
  for (let i = 0; i < cnt; i++) {
    const part = r.readInt16();
    out.push({ part, rect: readRect(r) });
  }
  return out;
}

function readSideList(r, label) {
  const cnt = readCount(r, 4, label);
  const out = [];
  for (let i = 0; i < cnt; i++) {
    const part = r.readInt16();
    const border = r.readInt16();
    out.push({ part, border });
  }
  return out;
}

// Local bounds only: other decoders retain their existing Reader semantics.
// kDEF uses signed counts and -1 as empty (see docs/spec/wnd-decoding.md).
function readCount(r, stride, label) {
  if (r.remaining() < 2) throw new Error(`wnd#: truncated ${label} count`);
  const stored = r.readInt16();
  if (stored < -1) throw new Error(`wnd#: invalid signed count ${stored} for ${label}`);
  const count = stored + 1;
  // Division avoids speculative reads/allocations and uses the actual byte view.
  if (count > Math.floor(r.remaining() / stride)) throw new Error(`wnd#: truncated ${label} records`);
  return count;
}
