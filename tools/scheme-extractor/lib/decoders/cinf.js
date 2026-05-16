// Decode a 'cinf' (Kaleidoscope Color INFo) resource into structured geometry data.
//
// Per the TMPL 129 spec embedded in every Kaleidoscope scheme:
//
//   Offset  Bytes  Field                       Type
//   0       1      Corner Size                 BYTE
//   1       1      Side Thickness              BYTE
//   2       1      Tile Sides                  BYTE  (0=stretch, 1=tile)
//   3       1      Pattern Anchor              BYTE
//   4       2      Background Pattern ID       DWRD (int16, 0 = none)
//   6       2      Background Pixel (y)        DWRD
//   8       2      Background Pixel (x)        DWRD
//   10      2      Text Pixel (y)              DWRD
//   12      2      Text Pixel (x)              DWRD
//   14      2      Embossing Pixel (y)         DWRD
//   16      2      Embossing Pixel (x)         DWRD
//
// See docs/kaleidoscope-geometry-spec.md §2 for full context. cinf is the
// 9-slice geometry spec per chrome bitmap — corner size + side thickness +
// tile/stretch flag + optional ppat overlay reference + text/emboss anchors.

import { Reader } from './shared.js';

/**
 * @param {Uint8Array} bytes  Raw cinf resource bytes (18 bytes per the spec)
 * @returns {{
 *   cornerSize: number,
 *   sideThickness: number,
 *   tileSides: number,
 *   patternAnchor: number,
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
    bgPatternId,
    bgPixel:    { x: bgPixelX,   y: bgPixelY },
    textPixel:  { x: textPixelX, y: textPixelY },
    embossPixel:{ x: embossX,    y: embossY },
  };
}
