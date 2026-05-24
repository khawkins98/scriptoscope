// scripts/generate-platinum/palette.mjs
// Platinum gray ramp. Values sampled from the in-repo apple-platinum-2 scheme
// (a licensed real Platinum Kaleidoscope scheme) at the slot pixels the WDEF
// decode pins, cross-checked against the same scheme's document-window header
// `clut` id -14336. Source per slot recorded in
// themes/apple-platinum-replica/PROVENANCE.md and printed by sample-palette.mjs.
//
// All Platinum grays are multiples of 17 (0x11) — the classic 4-bit neutral ramp.
export const SLOTS = [
  'frameOutline', 'titleFillFore', 'titleFillBack',
  'bevelHighlight', 'bevelShadow', 'widgetFace', 'titleText',
];
export const PALETTE = {
  // SAMPLED-FAITHFUL — two agreeing sources (scrollbar cicn -8278 + clut -14336 entry 0)
  frameOutline:   [0, 0, 0],
  // ASSUMED (calibrated) — the title-stripe pair. apple-platinum-2 is controls-only,
  // so the title-fill grays can't be sampled directly (they're window-wctb runtime
  // data; decode slots +50/+58/+66/+74). Per the decode they are two CLOSE light grays
  // from the 4-bit ramp (fore lighter); calibrated against the render to read as the
  // subtle Platinum title texture rather than the washed-out #fff-on-#aaa halftone the
  // sampled values produced. Refine via a System-file wctb decode. Marked ASSUMED.
  titleFillFore:  [238, 238, 238], // ASSUMED — #eeeeee (lighter stripe)
  titleFillBack:  [204, 204, 204], // ASSUMED — #cccccc (light bar base)
  // SAMPLED-FAITHFUL — clut -14336 entry 1 (#dddddd); raised top/left highlight gray
  bevelHighlight: [221, 221, 221],
  // SAMPLED-FAITHFUL — scrollbar cicn -8278 px(1,1) dark bevel line (#777777).
  // (clut -14336 carries no distinct dark-gray shadow entry, only black, so the
  //  shadow gray comes from the same scheme's control bevel ramp.)
  bevelShadow:    [119, 119, 119],
  // SAMPLED-FAITHFUL — scrollbar cicn -8278 face / clut -14336 entry 4 (#aaaaaa)
  widgetFace:     [170, 170, 170],
  // SAMPLED-FAITHFUL — clut -14336 entry 0 (#000000); header title text is black
  titleText:      [0, 0, 0],
};
