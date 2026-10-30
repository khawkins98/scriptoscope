// Castle's palette. Colours are what you want to see on screen (sRGB); the
// encoder applies the classic-Mac gamma pre-compensation.
//
// Every colour is a step of the 6×6×6 cube (multiples of 0x33) or of the
// System grey ramp (#bbbbbb, #aaaaaa, #888888, #777777 …), so an 8 bpp screen
// keeps each ramp step on its own entry. The first Castle used warm greys
// 10–20 units off the axis; at 8 bpp they went pink and olive (exotic-frames
// R16). Stone is therefore plain grey: the warmth comes from the roofs, the
// banner, the oak and the parchment around it.
//
// Ramps (light from the upper left on everything):
//   stone   lit #cccccc · A #aaaaaa · B #999999 · shade #777777 · mortar #666666 · outline #333333
//   roof    lit #cc6666 · tile #993333 · shade #660000
//   cloth   lit #cc3333 · cloth #990000 · fold #660000 ;  gold #ffcc33 / #cc9900
//   oak     grain #cc9966 · face #996633 · shade #663300
//   water   #6699cc / #336699 ;  moss #669966
//
// One deliberate exception: the body. No system-palette colour is a calm,
// low-chroma parchment (#ffffcc is butter-yellow; the near-cube warm greys
// snap PINK at 8 bpp). #efe8d8 is chosen because its nearest 8-bit entry is
// the neutral #eeeeee, so a classic screen shows plain light grey, never
// yellow or pink. The body is web-only anyway (exotic-frames R22).
export const C = {
  // What controls sit on: the parchment body (mattes and hidden swatches).
  body: '#efe8d8',
  active: {
    stone: ['#aaaaaa', '#999999'], stoneHi: '#cccccc', stoneLo: '#777777', mortar: '#666666', outline: '#333333',
    roof: '#993333', roofHi: '#cc6666', roofLo: '#660000',
    flag: '#cc3333', flagLo: '#990000',
    cloth: '#990000', clothHi: '#cc3333', clothLo: '#660000',
    gold: '#ffcc33', goldLo: '#cc9900',
    pole: '#cc9966', poleLo: '#663300',
    title: '#ffffcc', titleShadow: '#660000',
    field: '#336699', alertField: '#990000',
    moss: '#669966', water: '#336699', waterHi: '#6699cc',
    iron: '#333333', ironHi: '#666666',
    plate: '#aaaaaa', plateHi: '#cccccc', plateLo: '#777777', glyph: '#333333', window: '#ffffcc',
    oak: '#996633',
  },
  // Inactive: the same objects, quieter. Stone lifts a step, everything
  // coloured goes to the grey ramp (a desaturated red would snap pink at 8 bpp),
  // glyphs drop, the title is dark on the grey banner (no shadow).
  inactive: {
    stone: ['#bbbbbb', '#aaaaaa'], stoneHi: '#dddddd', stoneLo: '#999999', mortar: '#888888', outline: '#666666',
    roof: '#999999', roofHi: '#aaaaaa', roofLo: '#777777',
    flag: '#aaaaaa', flagLo: '#888888',
    cloth: '#999999', clothHi: '#aaaaaa', clothLo: '#777777',
    gold: '#cccccc', goldLo: '#aaaaaa',
    pole: '#aaaaaa', poleLo: '#777777',
    title: '#333333', titleShadow: '#333333',
    field: '#999999', alertField: '#999999',
    moss: '#aaaaaa', water: '#999999', waterHi: '#bbbbbb',
    iron: '#777777', ironHi: '#999999',
    plate: '#bbbbbb', plateHi: '#dddddd', plateLo: '#999999', glyph: null, window: null,
    oak: '#aaaaaa',
  },
  wood: {
    face: '#996633', grain: '#cc9966', lo: '#663300', edge: '#333333', text: '#ffffcc', emboss: '#663300',
    pressedFace: '#663300', pressedGrain: '#996633', pressedText: '#ffffcc',
    disabledFace: '#cc9966', disabledGrain: '#ffcc99', disabledLo: '#996633', disabledEdge: '#996633', disabledText: '#eeeeee',
    band: '#333333', bandHi: '#666666', disabledBand: '#999999',
  },
  ring: { gold: '#ffcc33', lo: '#cc9900', edge: '#663300', inactive: '#cccccc', inactiveLo: '#aaaaaa', inactiveEdge: '#888888' },
};

// Extra pairs for `npm run author -- … --palette` (fg, bg, label, floor).
export const CONTRAST = [
  ['#333333', '#efe8d8', 'outline on parchment', 3],
  ['#333333', '#efe8d8', 'body text on parchment', 4.5],
  ['#333333', '#aaaaaa', 'widget glyph on plate', 3],
  ['#ffcc33', '#336699', 'shield chevron on field', 3],
  ['#333333', '#aaaaaa', 'tab label on front tab', 4.5],
];
