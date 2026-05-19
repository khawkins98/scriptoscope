// Decode a 'cinf' (Kaleidoscope Color INFo) resource into structured geometry data.
//
// Per the TMPL 129 spec embedded in every Kaleidoscope scheme:
//
//   Offset  Bytes  Field                       Type
//   0       1      Corner Size                 BYTE
//   1       1      Side Thickness              BYTE
//   2       1      Tile Sides                  BYTE  (0=stretch, 1=tile/repeat)
//   3       1      Pattern Anchor              BYTE  (0=whole, 1=top, 2=left, 3=bottom, 4=right)
//   4       2      Background Pattern ID       DWRD (int16, 0 = none)
//   6       2      Background Pixel (y)        DWRD
//   8       2      Background Pixel (x)        DWRD
//   10      2      Text Pixel (y)              DWRD
//   12      2      Text Pixel (x)              DWRD
//   14      2      Embossing Pixel (y)         DWRD
//   16      2      Embossing Pixel (x)         DWRD
//
// See spec B §13.3 for the open question on the full 15 resize
// behaviors (from Scheme Factory MENU 139), parked against kDEF
// disassembly. The (tileSides, patternAnchor) pair maps to behaviors
// 0-9 via `tileSides * 5 + patternAnchor`; behaviors 10-14
// (anchor-to-corner) likely encode via a value range not yet observed
// in the corpus.

import { Reader } from './shared.js';

/** Canonical labels for the 15 per-region resize behaviors recovered from
 *  Scheme Factory's MENU 139. Indices 0-9 are observed in our corpus via
 *  the (tileSides, patternAnchor) byte pair; 10-14 are predicted-but-
 *  unverified anchor-to-corner behaviors. */
export const RESIZE_BEHAVIOR_LABELS = /** @type {const} */ ([
  'stretch-whole',           // 0  (tileSides=0, patternAnchor=0)
  'stretch-top',             // 1  (0, 1)
  'stretch-left',            // 2  (0, 2)
  'stretch-bottom',          // 3  (0, 3)
  'stretch-right',           // 4  (0, 4)
  'repeat-whole',            // 5  (1, 0)
  'repeat-top',              // 6  (1, 1)
  'repeat-left',             // 7  (1, 2)
  'repeat-bottom',           // 8  (1, 3)
  'repeat-right',            // 9  (1, 4)
  'anchor-center',           // 10 (encoding TBD)
  'anchor-top-left',         // 11 (encoding TBD)
  'anchor-top-right',        // 12 (encoding TBD)
  'anchor-bottom-left',      // 13 (encoding TBD)
  'anchor-bottom-right',     // 14 (encoding TBD)
]);

/**
 * Resolve (tileSides, patternAnchor) bytes into one of the 15 canonical
 * resize behavior labels.
 *
 * Only behaviors 0-9 (stretch-* + repeat-* families) are decoded from the
 * (tileSides ∈ {0,1}, patternAnchor ∈ {0..4}) pair via the formula
 * `tileSides * 5 + patternAnchor`. The anchor-* family (indices 10-14)
 * IS NOT YET KNOWN to be encoded via this formula — `tileSides ≥ 2` is
 * not observed in the corpus, so the formula could match or not. Until
 * confirmed empirically, treat any input outside the (0-1, 0-4) range
 * as 'stretch-whole' (safe default).
 *
 * @param {number} tileSides
 * @param {number} patternAnchor
 * @returns {typeof RESIZE_BEHAVIOR_LABELS[number]}
 */
export function resizeBehavior(tileSides, patternAnchor) {
  if (tileSides < 0 || tileSides > 1) return 'stretch-whole';
  if (patternAnchor < 0 || patternAnchor > 4) return 'stretch-whole';
  return RESIZE_BEHAVIOR_LABELS[tileSides * 5 + patternAnchor];
}

/**
 * @param {Uint8Array} bytes  Raw cinf resource bytes (18 bytes per the spec)
 * @returns {{
 *   cornerSize: number,
 *   sideThickness: number,
 *   tileSides: number,
 *   patternAnchor: number,
 *   resizeBehavior: typeof RESIZE_BEHAVIOR_LABELS[number],
 *   bgPatternId: number,
 *   bgPixel: { x: number, y: number },
 *   textPixel: { x: number, y: number },
 *   embossPixel: { x: number, y: number },
 * }}
 */
export function decodeCinf(bytes) {
  const r = new Reader(bytes);
  const cornerSize    = r.readUInt8();
  const sideThickness = r.readUInt8();
  const tileSides     = r.readUInt8();
  const patternAnchor = r.readUInt8();
  const bgPatternId   = r.readInt16();
  const bgPixelY      = r.readInt16();
  const bgPixelX      = r.readInt16();
  const textPixelY    = r.readInt16();
  const textPixelX    = r.readInt16();
  const embossY       = r.readInt16();
  const embossX       = r.readInt16();
  return {
    cornerSize,
    sideThickness,
    tileSides,
    patternAnchor,
    resizeBehavior: resizeBehavior(tileSides, patternAnchor),
    bgPatternId,
    bgPixel:    { x: bgPixelX,   y: bgPixelY },
    textPixel:  { x: textPixelX, y: textPixelY },
    embossPixel:{ x: embossX,    y: embossY },
  };
}
