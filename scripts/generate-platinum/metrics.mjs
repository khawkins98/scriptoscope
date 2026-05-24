// scripts/generate-platinum/metrics.mjs
// Platinum geometry, sourced from docs/spec/platinum-wdef125-decode.md (Constants).
// titleBarHeight is the decode's font-derived value (ascent+descent+2, clamp ≥10)
// at the standard classic system font; it is the one metric Task 7 tunes visually.
export const METRICS = {
  titleBarHeight: 19,            // standard classic Platinum document title bar; tuned in Task 7
  frameInset: 1,                 // L/R/B frame thickness (1px), top = titleBarHeight + 1
  bevel: { lightEdges: ['top', 'left'], darkEdges: ['bottom', 'right'] }, // raised
  stipple: Uint8Array.from([0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00]), // title fill, 2-row period
  widget: {
    size: 7,                     // 7×7 boxes
    closeLeftOffset: 4,          // close box: title.left + 4 .. +11
    zoomRightOffset: 4,          // zoom box:  title.right − 11 .. −4
    collapseGap: 2,              // collapse box sits inboard of zoom by this gap
  },
  // Min-cicn cell widths (px) for the recipe: fixed left (corner+close),
  // 1px stretch title cell, fixed right (zoom+collapse+corner).
  cells: {
    leftFixed: 4 + 7 + 4,        // inset + close box + margin = 15
    titleStretch: 1,             // 1px band the compositor stretches/tiles
    rightFixed: 4 + 7 + 2 + 7 + 4, // margin + zoom + gap + collapse + inset = 24
  },
};
