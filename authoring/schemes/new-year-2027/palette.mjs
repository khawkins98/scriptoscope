// Midnight 2027's palette. Colours are what you want to see on screen (sRGB);
// the encoder applies the classic-Mac gamma pre-compensation.
//
// Every colour is an exact SYSTEM_PALETTE_256 entry: a step of the 6×6×6
// cube (multiples of 0x33), the blue ramp (#000022) or the grey ramp
// (#eeeeee, #bbbbbb, #888888 …), so an 8 bpp screen keeps each step on its own
// entry (concept/brief.md §1).
//
// Ramps (light from the upper left on everything):
//   sky     lit #003366 · night #000033 · outline #000022
//   gold    lit #ffffcc · foil #ffcc33 · shade #cc9933 · bronze #996600
//   bursts  gold #ffcc33/#cc9933 · pink #ff66cc/#cc3399 · cyan #33ccff/#0099cc · spark #ffffff
//   stars   dim #6699cc · bright #ffffcc
//
// Inactive is the same objects in slate: the sky goes #666699, gold goes
// silver, the bursts go grey (a faded pink or gold snaps to odd entries at
// 8 bpp), and the title goes dark on the silver plate.
export const C = {
  // The window body (web only, exotic-frames R22): plain white behind live text.
  body: '#ffffff',
  active: {
    outline: '#000022', sky: '#000033', skyHi: '#003366', skyLo: '#000022',
    star: '#6699cc', starHi: '#ffffcc', spark: '#ffffff',
    gold: '#ffcc33', goldHi: '#ffffcc', goldLo: '#cc9933', bronze: '#996600', plate: '#ffcc66',
    pink: '#ff66cc', pinkLo: '#cc3399', cyan: '#33ccff', cyanLo: '#0099cc',
    title: '#000033', titleShadow: '#000033',
    face: '#ffffff', hand: '#000033', glyph: '#ffcc33',
    disc: '#000033', discHi: '#003366',
  },
  inactive: {
    outline: '#333366', sky: '#666699', skyHi: '#9999cc', skyLo: '#333366',
    star: '#9999cc', starHi: '#cccccc', spark: '#dddddd',
    gold: '#cccccc', goldHi: '#eeeeee', goldLo: '#999999', bronze: '#777777', plate: '#cccccc',
    pink: '#aaaaaa', pinkLo: '#888888', cyan: '#aaaaaa', cyanLo: '#888888',
    title: '#333333', titleShadow: '#333333',
    face: '#eeeeee', hand: '#666666', glyph: null,
    disc: '#666699', discHi: '#9999cc',
  },
  // Push buttons: navy faces in gold; pressed inverts to gold with navy text.
  button: {
    face: '#000033', lit: '#003366', rim: '#ffcc33', rimLo: '#cc9933', edge: '#000022', text: '#ffffff',
    pressedFace: '#ffcc33', pressedLit: '#ffffcc', pressedRim: '#996600', pressedText: '#000033',
    disabledFace: '#9999cc', disabledLit: '#ccccff', disabledRim: '#cccccc', disabledEdge: '#666699', disabledText: '#eeeeee',
  },
  ring: { gold: '#ffcc33', lo: '#cc9933', edge: '#996600', inactive: '#cccccc', inactiveLo: '#aaaaaa', inactiveEdge: '#888888' },
};

// Extra pairs for `npm run author -- … --palette` (fg, bg, label, floor).
export const CONTRAST = [
  ['#000022', '#ffffff', 'outline on white', 3],
  ['#000033', '#ffcc33', 'title on gold plate', 4.5],
  ['#333333', '#cccccc', 'inactive title on silver plate', 4.5],
  ['#ffffff', '#000033', 'button label on navy face', 4.5],
  ['#000033', '#ffcc33', 'pressed label on gold face', 4.5],
  ['#ffcc33', '#000033', 'widget glyph on navy disc', 3],
  ['#ffcc33', '#ffffff', 'gold rule against the white body', 1.5],
];
