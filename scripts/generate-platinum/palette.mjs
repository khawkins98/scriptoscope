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
  // PROVISIONAL — needs confirmation. The title-bar pinstripe FOREGROUND stripe is
  // window-wctb runtime data; apple-platinum-2 is controls-only (no title art) so it
  // can't be sampled directly. Header clut -14336 brackets it (entry1 #dddddd ..
  // entry3 #ffffff); set to white pending a System-file wctb cross-check.
  titleFillFore:  [255, 255, 255], // PROVISIONAL — needs confirmation
  // SAMPLED-FAITHFUL — clut -14336 entry 4 (#aaaaaa); == widget/control face gray
  titleFillBack:  [170, 170, 170],
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
