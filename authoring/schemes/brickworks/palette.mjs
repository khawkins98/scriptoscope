// Brickworks palette. Colours are what you want to SEE (sRGB); the encoder
// applies the classic-Mac gamma pre-compensation (authoring guide §3.4).
//
// Flat glossy plastic, four steps per brick and nothing in between: `hi` (the
// lit top row, the lit left arc of a stud), `base` (the face), `lo` (the
// shaded right column) and `deep` (pressed faces, stud shade, cast shadow).
// Every step is an exact 6×6×6 cube entry, so the scheme looks the same on an
// 8-bit Mac as on the web (concept brief §1; visual-design guide §2.3).
//
// Inactive windows keep their hue and lift the value (red → #cc6666 and so
// on), so the window-type colour coding survives in the background.

const brick = (hi, base, lo, deep) => ({ hi, base, lo, deep });

export const BRICK = {
  red: brick('#ff6666', '#cc0000', '#990000', '#660000'),
  yellow: brick('#ffff99', '#ffcc00', '#cc9900', '#996600'),
  blue: brick('#6699ff', '#3366cc', '#003399', '#003366'),
  green: brick('#66cc66', '#339933', '#006600', '#003300'),
  white: brick('#ffffff', '#eeeeee', '#cccccc', '#999999'),
  grey: brick('#cccccc', '#999999', '#666666', '#333333'),
};

// Lifted plastic for inactive windows: same hue, lighter and greyer.
const QUIET = {
  red: brick('#ff9999', '#cc6666', '#996666', '#663333'),
  yellow: brick('#ffff99', '#cccc66', '#999966', '#666633'),
  blue: brick('#99ccff', '#6699cc', '#336699', '#003366'),
  green: brick('#99cc99', '#669966', '#336633', '#003300'),
  white: BRICK.white,
  grey: brick('#cccccc', '#999999', '#666666', '#333333'),
};

/** The warm near-black outline every piece shares. */
export const OUTLINE = '#330000';
export const INK = '#330000';

/** Palette for one window state. */
export function pal(state) {
  const active = state === 'active';
  return {
    ...(active ? BRICK : QUIET),
    outline: active ? OUTLINE : '#663333',
    cable: active ? OUTLINE : '#663333',
    title: active ? INK : '#666666',
    titleShadow: active ? INK : '#666666', // same colour = no shadow
    glyph: active ? '#ffffff' : null,
  };
}

// Which bricks each window type is built from: bar, corner blocks, the two
// wall colours (left wall starts with walls[0], right wall with walls[1]),
// and the centre brick of untitled dialogs and alerts.
export const SCHEME_COLOURS = {
  doc: { bar: 'red', corner: 'yellow', walls: ['red', 'blue'], base: 'green' },
  modal: { bar: 'green', corner: 'yellow', walls: ['green', 'blue'], base: 'green' },
  movableAlert: { bar: 'yellow', corner: 'red', walls: ['yellow', 'red'], base: 'green' },
  util: { bar: 'blue', corner: 'yellow', walls: ['blue', 'yellow'], base: 'green' },
  dialog: { bar: 'blue', corner: 'blue', centre: 'yellow', walls: ['blue', 'red'], base: 'green' },
  alert: { bar: 'yellow', corner: 'yellow', centre: 'red', walls: ['yellow', 'red'], base: 'green' },
};

// The plain body every window shows (and the ground behind the baseplate
// studs, so the studs stand inside the box).
export const BODY = '#eeeeee';
export const UTIL_BODY = '#eeeeee';

// Extra pairs for `npm run author -- --palette`: [fg, bg, label, floor].
export const CONTRAST = [
  [INK, BRICK.yellow.base, 'button label on yellow brick', 4.5],
  ['#666666', BRICK.white.base, 'inactive title on the tile', 3],
  [OUTLINE, '#ffffff', 'outline on white', 3],
  ['#ffffff', BRICK.red.base, 'close glyph on red stud', 3],
  ['#ffffff', BRICK.green.base, 'zoom glyph on green stud', 3],
  ['#ffffff', BRICK.blue.base, 'collapse glyph on blue stud', 3],
];
