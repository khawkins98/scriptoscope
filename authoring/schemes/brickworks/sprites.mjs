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
  '.oooo.',
  'ohhhho',
  'ohbbdo',
  'ohbbdo',
  'ohbbdo',
];
export const STUD_W = 6;

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

// 5×5 glyphs, whole pixels, centred on the disc's centre pixel (6, 6).
export const GLYPH = {
  close: ['X...X', '.X.X.', '..X..', '.X.X.', 'X...X'],
  zoom: ['..X..', '..X..', 'XXXXX', '..X..', '..X..'],
  collapse: ['.....', '.....', 'XXXXX', '.....', '.....'],
};

// The loose brick stack on the document's bottom-left corner: a blue 2×2
// brick standing on a green 1×4 brick, in front of the wall and the end of
// the baseplate. 30 columns × 20 rows (the document's bottom band).
// B/c/L = blue hi/base/lo, E/e/F = green hi/base/lo.
export const STACK = [
  '..............................',
  '..............................',
  '...oooo....oooo...............',
  '..oBBBBo..oBBBBo..............',
  '..oBccLo..oBccLo..............',
  '..oBccLo..oBccLo..............',
  'oooBccLooooBccLooo............',
  'oBBBBBBBBBBBBBBBLo............',
  'occcccccccccccccLo....oooo....',
  'occcccccccccccccLo...oEEEEo...',
  'occcccccccccccccLo...oEeeFo...',
  'occcccccccccccccLo...oEeeFo...',
  'ooooooooooooooooooooooEeeFoooo',
  'oEEEEEEEEEEEEEEEEEEEEEEEEEEEFo',
  'oeeeeeeeeeeeeeeeeeeeeeeeeeeeFo',
  'oeeeeeeeeeeeeeeeeeeeeeeeeeeeFo',
  'oeeeeeeeeeeeeeeeeeeeeeeeeeeeFo',
  'oeeeeeeeeeeeeeeeeeeeeeeeeeeeFo',
  'oeeeeeeeeeeeeeeeeeeeeeeeeeeeFo',
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
