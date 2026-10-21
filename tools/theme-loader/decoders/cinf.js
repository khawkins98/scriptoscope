// Decode the raw 18-byte cinf header. TMPL 129 names the fields; offsets and
// signedness are exercised by cinf.test.mjs. The body dispatch is documented in
// docs/spec/cinf-resize-behavior.md against kDEF 2.3.1 and Apple trap identities.
//
// 0/1: unsigned corner size / independent side thickness
// 2: edge repeat flag (zero = first middle column/row; nonzero = full-band repeat)
// 3: body mode: 5 requests a cicn; otherwise request a ppat and select phase
//    1=TL, 2=TR, 3=BL, 4=BR, default=origin.
// 4..5: signed background resource ID, passed to the loader in BOTH branches.
// 6/8, 10/12, 14/16: signed y/x background, text and emboss color samples.
//
// Resize-behavior strings below are retained compatibility labels, not a full
// resource-type/body/phase model. In particular 'bg-pattern' denotes mode5 even
// though its original loader requests a color icon. No decoder output changes.

import { Reader } from './shared.js';

/** Legacy presentation labels for boolean edge repeat × modes0..4.
 * They must not be used to infer the original body resource type. */
export const RESIZE_BEHAVIOR_LABELS = /** @type {const} */ ([
  'stretch-whole',           // 0  (tileSides=0, patternAnchor=0)  — anchor at origin (0,0)
  'stretch-top',             // 1  (0, 1)                          — anchor at dst TOP-LEFT corner
  'stretch-left',            // 2  (0, 2)                          — anchor at dst TOP-RIGHT corner
  'stretch-bottom',          // 3  (0, 3)                          — anchor at dst BOTTOM-LEFT corner
  'stretch-right',           // 4  (0, 4)                          — anchor at dst BOTTOM-RIGHT corner
  'repeat-whole',            // 5  (1, 0)
  'repeat-top',              // 6  (1, 1)
  'repeat-left',             // 7  (1, 2)
  'repeat-bottom',           // 8  (1, 3)
  'repeat-right',            // 9  (1, 4)
]);

/**
 * Preserve the existing compatibility label API. Mode5 is labeled 'bg-pattern';
 * other mode bytes choose an origin/corner label. The original body dispatch
 * consults the signed background ID in every mode, separately from edge repeat.
 * @param {number} tileSides
 * @param {number} patternAnchor
 * @returns {typeof RESIZE_BEHAVIOR_LABELS[number] | 'bg-pattern'}
 */
export function resizeBehavior(tileSides, patternAnchor) {
  // Normalize only the compatibility label; retain raw bytes in decodeCinf.
  const ts = tileSides ? 1 : 0;                       // byte[2] is a boolean (byte test at 0x10bc6 et al.)
  if (patternAnchor === 5) return /** @type {const} */ ('bg-pattern');
  // Default branch (case 0 or ≥6): origin anchor.
  const pa = (patternAnchor >= 0 && patternAnchor <= 4) ? patternAnchor : 0;
  return RESIZE_BEHAVIOR_LABELS[ts * 5 + pa];
}

/**
 * @param {Uint8Array} bytes  Raw cinf resource bytes (18 bytes per the spec)
 * @returns {{
 *   cornerSize: number,
 *   sideThickness: number,
 *   tileSides: number,
 *   patternAnchor: number,
 *   resizeBehavior: typeof RESIZE_BEHAVIOR_LABELS[number] | 'bg-pattern',
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
