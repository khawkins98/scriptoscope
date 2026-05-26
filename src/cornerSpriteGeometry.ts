// src/cornerSpriteGeometry.ts
// THE corner-sprite (System 7/8 Platinum-family) window GEOMETRY — as DATA,
// sourced from the WDEF 125 decode (docs/spec/platinum-wdef125-decode.md), NOT
// hand-tuned guesses. composeCornerSprite.ts reads these instead of inline
// literals, so the geometry has a single, decode-grounded source of truth.
//
// WHY this exists: the prior geometry in composeCornerSprite.ts was created
// MOSTLY MANUALLY (e.g. a variable 7..13px widget box, close at frame.left+3).
// The decode is the better source of truth — and it disagrees: the real Platinum
// title-bar widgets are 7×7 FIXED, the close box sits 4px (not 3) from the title
// end. Each `decode:` field below is pinned to an instruction offset in the
// decode doc; `tuning:` fields are NOT in the decode (colors are runtime wctb
// data, so bevel amounts/paddings are our calibration, flagged as such).

export interface CornerSpriteGeometry {
  /** Title-bar widget boxes (close/zoom/collapse). Decode: each is 7×7px, vertically centered. */
  widget: {
    /** decode: 7×7 fixed square (WDEF 125 §"Box geometry"; SetRect spans 7 both axes). */
    box: number;
    /** decode: close box left = title.left + 4 (4px from the LEFT title end). 0x1074. */
    closeFromLeft: number;
    /** decode: zoom box right = title.right − 4 (4px from the RIGHT title end). 0x116e. */
    zoomFromRight: number;
    /** decode: collapse sits inboard of zoom; corner math top=bottom−7 then OffsetRect(1,1). 0x11fc. */
    collapseGap: number;
    /** tuning: procedural-fallback bevel (no shipped glyph) — lighten top/left, darken bottom/right. */
    bevel: { highlight: number; shadow: number };
  };
  /** Frame insets. decode: 1px L/R/B; top = titleHeight + 1 (title bar + 1px under-line). 0x434 / 0xf38. */
  frame: { side: number; bottom: number };
  /** decode: raised bevel — top/left = light (highlight), bottom/right = dark (shadow). 0x60a/0x664. */
  bevel: { raised: true; highlight: number; shadow: number };
  /** tuning: title-bar pinstripe inset margins (fraction of titleH) + plate/stripe paddings. */
  titleBar: { insetTop: number; insetBottom: number; platePad: number; stripePad: number };
  /** tuning: frame-proxy 9-slice extract params (source px per border, dest scale). */
  frameExtract: { csrc: number; scale: number };
}

// Decode-grounded defaults. Used for the Platinum-family corner-sprite schemes
// (apple-platinum-2, platinum-8, system7-nostalgia-silver, black-platinum) — all
// recreations of the same Platinum look the WDEF decodes, so its geometry is the
// faithful source for all of them.
export const CORNER_SPRITE_GEOMETRY: CornerSpriteGeometry = {
  widget: {
    box: 7,            // decode: 7×7 fixed (was manual max(7,min(13,titleH−7)) ⇒ ~12 at titleH 19)
    closeFromLeft: 4,  // decode: title.left + 4 (was manual frame.left + 3)
    zoomFromRight: 4,  // decode: title.right − 4
    collapseGap: 2,    // inboard gap (manual; decode uses corner math, approximated as a gap here)
    bevel: { highlight: 0.5, shadow: 0.18 }, // tuning (procedural fallback only)
  },
  frame: { side: 1, bottom: 1 },             // decode: 1px (0x434)
  bevel: { raised: true, highlight: 0.55, shadow: 0.22 }, // decode order; amounts are tuning
  titleBar: { insetTop: 0.2, insetBottom: 0.24, platePad: 6, stripePad: 5 }, // tuning
  frameExtract: { csrc: 5, scale: 1 },       // tuning
};
