// Brickworks hand-placed pixel art: studs, the round widget stud, the crane,
// the loose brick stack and the wheel. Sprites are ASCII grids drawn with
// Raster.sprite, so each pixel is placed on purpose (no smooth strokes, no
// dither). Light comes from the upper left everywhere: `h` on top rows and
// on the left of cylinders, `l` on right columns, `d` for the 1px shade.
//
// Legend letters (mapped to colours by `legend(b, p)`):
//   o outline   h hi   b base   l lo   d deep

/** Map a brick ramp and the window palette to sprite letters. */
export const legend = (b, p) => ({ o: p.outline, h: b.hi, b: b.base, l: b.lo, d: b.deep });

// A stud standing on a brick, seen from the front: a lit top face, a lit left
// side, a 1px shade on the right. The last row sits on the brick's top edge,
// so the brick's outline doesn't run under it.
export const STUD = [
  '.oooooo.',
  'ohhhhhho',
  'ohbbbbdo',
  'ohbbbbdo',
  'ohbbbbdo',
  'ohbbbbdo',
];
export const STUD_W = 8;
export const STUD_H = STUD.length;
// The smaller stud of push buttons and tabs (it has to fit a 9px corner).
export const STUD_SMALL = [
  '.oooo.',
  'ohhhho',
  'ohbbdo',
  'ohbbdo',
  'ohbbdo',
];

// The round title-bar widget: a 13px stud seen from above. 1-2-1 stair rim,
// a lit arc upper left, a 1px shade lower right.
export const DISC = [
  '....ooooo....',
  '..oohhhbboo..',
  '.ohhbbbbbbbo.',
  '.ohbbbbbbbbo.',
  'ohbbbbbbbbbbo',
  'ohbbbbbbbbbbo',
  'obbbbbbbbbbbo',
  'obbbbbbbbbbbo',
  'obbbbbbbbbblo',
  '.obbbbbbbblo.',
  '.obbbbbbbllo.',
  '..oobbllloo..',
  '....ooooo....',
];
export const DISC_SIZE = 13;

// The 17px title-bar knob (the concept's widget size at 1x): the same stair
// rim, lit arc upper left and shade lower right.
export const KNOB = [
  '......ooooo......',
  '....oohhhbboo....',
  '...ohhbbbbbbbo...',
  '..ohhbbbbbbbbbo..',
  '.ohbbbbbbbbbbbbo.',
  '.ohbbbbbbbbbbbbo.',
  'ohbbbbbbbbbbbbbbo',
  'ohbbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbblo',
  'obbbbbbbbbbbbbblo',
  'obbbbbbbbbbbbbblo',
  '.obbbbbbbbbbbblo.',
  '.obbbbbbbbbbbblo.',
  '..obbbbbbbbbllo..',
  '...obbbbbbbllo...',
  '....oollllloo....',
  '......ooooo......',
];
export const KNOB_SIZE = 17;

// 7×7 glyphs, whole pixels, centred on the knob's centre pixel (8, 8). The ×
// doubles its strokes on the stair steps so it weighs the same as the bars.
export const GLYPH = {
  close: ['X.....X', 'XX...XX', '.XX.XX.', '..XXX..', '.XX.XX.', 'XX...XX', 'X.....X'],
  zoom: ['...X...', '...X...', '...X...', 'XXXXXXX', '...X...', '...X...', '...X...'],
  collapse: ['.......', '.......', '.......', 'XXXXXXX', '.......', '.......', '.......'],
};

// The loose bricks on the document's bottom-left corner: a tall blue 2×2
// brick standing in front of the wall, and a low green 1×1 brick beside it on
// the baseplate. 30 columns × 18 rows (the document's bottom band).
// B/c/L = blue hi/base/lo, E/e/F = green hi/base/lo.
export const STACK = [
  '..oooooo....oooooo............',
  '.oBBBBBBo..oBBBBBBo...........',
  '.oBccccLo..oBccccLo...........',
  '.oBccccLo..oBccccLo...........',
  '.oBccccLo..oBccccLo...........',
  'ooBccccLooooBccccLoo..oooooo..',
  'oBBBBBBBBBBBBBBBBBLo.oEEEEEEo.',
  'oBccccccccccccccccLo.oEeeeeFo.',
  'oBccccccccccccccccLo.oEeeeeFo.',
  'oBccccccccccccccccLo.oEeeeeFo.',
  'oBccccccccccccccccLoooEeeeeFoo',
  'oBccccccccccccccccLoEEEEEEEEFo',
  'oBccccccccccccccccLoEeeeeeeeFo',
  'oBccccccccccccccccLoEeeeeeeeFo',
  'oBccccccccccccccccLoEeeeeeeeFo',
  'oBccccccccccccccccLoEeeeeeeeFo',
  'oLLLLLLLLLLLLLLLLLLoFFFFFFFFFo',
  'oooooooooooooooooooooooooooooo',
];

// The wheel grow box: a 16px grey wheel. T/t = tyre hi/base, s = hub rim,
// U/u = hub hi/base, a = axle.
export const WHEEL = [
  '.....oooooo.....',
  '...ooTTTTttoo...',
  '..oTTtttttttto..',
  '.oTttttttttttto.',
  '.oTtttsssstttto.',
  'oTtttsUUuustttto',
  'oTttsUuuuuusttto',
  'oTttsUuaauusttto',
  'otttsuuaauusttto',
  'otttsuuuuuusttto',
  'ottttsuuuustttto',
  '.ottttsssstttto.',
  '.otttttttttttto.',
  '..otttttttttto..',
  '...oottttttoo...',
  '.....oooooo.....',
];

// Studs in the concept's three-quarter view, lifted from concept.jpg with
// `npm run paint-over` and cleaned: an elliptical lit top, a cylinder side in
// the brick's lo tone, a rim in the brick's deep tone (d) or the outline (o)
// where the stud stands against the sky.
export const TOP_STUD = [
  '..dddddddd..',
  '.dhhbbbbbbd.',
  'dhbbbbbbbbbd',
  'dlbhhhhhbbld',
  'dlllllllllld',
  '.dllllllldd.',
  '..dddddddd..',
];
export const TOP_STUD_W = 12;
// The baseplate's studs, smaller and flatter.
export const PLATE_STUD = [
  '..oooooo..',
  '.ohhbbbbo.',
  'ohbbbbbbbo',
  'olhhhhhhlo',
  'ollllllllo',
  '.ollllllo.',
  '..oooooo..',
];
export const PLATE_STUD_W = 10;
