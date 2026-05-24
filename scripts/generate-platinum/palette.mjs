// scripts/generate-platinum/palette.mjs
// Platinum document-window color slots. Values are reference-sampled from a real
// Mac OS 8 Platinum window (WDEF 125), cross-checked against the decoded draw
// sequence in docs/spec/platinum-wdef125-decode.md. The active title bar is a
// raised bevel (white top inner row, #999 bottom inner row) over a 2-row
// pinstripe (white / #777) with a solid #ccc centered title plate; widgets are
// #ccc faces with white top/left + #777 bottom/right bevels and black outlines.
//
// Some slots are now pure white/black (the bevel highlights and the frame ink),
// so this is no longer a single multiples-of-17 gray ramp — the named bevel
// ramp is highlight(255) > plate(204) > shadow(119) > outline(0).
export const SLOTS = [
  'frameOutline',     // #000000  window outline + widget outline + glyph ink
  'windowHighlight',  // #ffffff  top/left bevels (window bar top + widgets)
  'windowShadow',     // #999999  bottom window bevel inner row
  'plateBase',        // #cccccc  title plate + widget face + bar base bands
  'pinstripeLight',   // #ffffff  pinstripe light line (even rows)
  'pinstripeDark',    // #777777  pinstripe dark line + widget bottom/right shadow
  'titleText',        // #000000  baked title-text marker color
];

export const PALETTE = {
  frameOutline:    [0, 0, 0],       // #000000
  windowHighlight: [255, 255, 255], // #ffffff
  windowShadow:    [153, 153, 153], // #999999
  plateBase:       [204, 204, 204], // #cccccc
  pinstripeLight:  [255, 255, 255], // #ffffff
  pinstripeDark:   [119, 119, 119], // #777777
  titleText:       [0, 0, 0],       // #000000
};
