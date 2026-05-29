// Decode a 'cinf' (Kaleidoscope Color INFo) resource into structured geometry data.
//
// Per the TMPL 129 spec embedded in every Kaleidoscope scheme:
//
//   Offset  Bytes  Field                       Type
//   0       1      Corner Size                 BYTE
//   1       1      Side Thickness              BYTE
//   2       1      Tile Sides                  BYTE  (0=stretch, !=0=tile/repeat the 4 edge bands)
//   3       1      Pattern Anchor              BYTE  (0=origin, 1=TL, 2=TR, 3=BL, 4=BR, 5=use bgPattern)
//   4       2      Background Pattern ID       DWRD (int16, 0 = none; only consulted when byte[3]=5)
//   6       2      Background Pixel (y)        DWRD
//   8       2      Background Pixel (x)        DWRD
//   10      2      Text Pixel (y)              DWRD
//   12      2      Text Pixel (x)              DWRD
//   14      2      Embossing Pixel (y)         DWRD
//   16      2      Embossing Pixel (x)         DWRD
//
// THE "15-VALUE RESIZE BEHAVIOR" MODEL IS WRONG. Earlier comments referenced a
// 15-item Scheme Factory MENU 139 enum, with indices 10..14 ("anchor-center",
// "anchor-top-left", etc.) parked as "encoding TBD". The kDEF actually
// dispatches on byte[2] + byte[3] as TWO INDEPENDENT FIELDS:
//
//   byte[2]: boolean — tile vs stretch the 4 edge bands. The kDEF reads this
//     via `tstb %a0@(2)` (zero vs nonzero) at addresses 0x10bc6, 0x10cf0,
//     0x10e4e, 0x10ec6, 0x10f3e. It NEVER compares against a specific value
//     above 1 — byte[2]=7 would behave identically to byte[2]=1.
//
//   byte[3]: 5-way switch — which dst-rect corner anchors the body pattern
//     phase. Dispatched at 0x109be (`cmpib #5,%a0@(3)`) + 0x10ab2 (`subq`-
//     chain). Cases 1..4 → anchor TL/TR/BL/BR; case 5 → use bgPattern
//     resource; default (0 or ≥6) → anchor at origin. There is NO `cmpib`
//     against byte[3] for values 6..15 anywhere in the kDEF (verified by
//     grep against k231-kdef0.asm).
//
// MENU 139's "anchor center / anchor TL / ..." entries (if they existed —
// not confirmed; would need a copy of Scheme Factory v2.x to extract) were
// editor-side sugar that compiled down to the same (byte[2], byte[3]) pair
// plus the per-cinf pixel-marker triples (bytes [6..17]). They are NOT a
// separate runtime mode.
//
// Full decode + corpus survey: docs/spec/cinf-resize-behavior.md.

import { Reader } from './shared.js';

/** Canonical labels for the 10 (tileSides, patternAnchor) combinations the
 *  kDEF actually dispatches on. Indexed by `tileSides * 5 + patternAnchor`
 *  where tileSides ∈ {0,1} (boolean) and patternAnchor ∈ {0..4} (origin +
 *  4 corners). patternAnchor=5 ("use bgPattern") is a separate code path
 *  that uses the cinf's bgPatternId, returned as the distinct label
 *  'bg-pattern'. Anything outside this range is treated as 'stretch-whole'
 *  (the kDEF default branch). */
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
 * Resolve (tileSides, patternAnchor) bytes into a canonical resize-behavior
 * label, matching the kDEF dispatch at 0x109be + 0x10ab2.
 *
 *   - tileSides ∈ {0,1}, patternAnchor ∈ {0..4}: one of RESIZE_BEHAVIOR_LABELS.
 *     (The runtime reads tileSides as a boolean via `tstb`, so any
 *      nonzero value collapses to the tile path; we normalise to 1.)
 *   - patternAnchor == 5: 'bg-pattern' — the body is filled with the cinf's
 *     own bgPatternId resource (bytes [4..5]). Not observed in the
 *     baked corpus but valid per the kDEF.
 *   - patternAnchor ≥ 6: kDEF falls through to the default branch
 *     (origin anchor), so we return 'stretch-whole' / 'repeat-whole'
 *     depending on tileSides.
 *
 * @param {number} tileSides
 * @param {number} patternAnchor
 * @returns {typeof RESIZE_BEHAVIOR_LABELS[number] | 'bg-pattern'}
 */
export function resizeBehavior(tileSides, patternAnchor) {
  // Defensive: clamp to known kDEF-faithful range.
  const ts = tileSides ? 1 : 0;                       // byte[2] is a boolean per `tstb` at 0x10bc6 et al.
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
