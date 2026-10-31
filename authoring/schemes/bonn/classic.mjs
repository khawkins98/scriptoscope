// Bonn's control-panel extras (classic Kaleidoscope only; the web runtime
// draws none of them). Builders and ids: tools/theme-author/classic-extras.js,
// docs/authoring-a-scheme.md §7.2.
//
//   About This Scheme   DLOG/DITL -14320 + cicn 128 + STR# -14320. The icon is a
//                       40×48 Beethoven bust (BUST below), larger than the 15×18
//                       one in the frame so it reads on its own; the picker icon
//                       stays the shield inspired by Bonn's arms (icon.mjs)
//   Arrow Cursor        crsr 0 and the Finder's -20486/-20487/-20488: the frame's
//                       near-black outline colour with a cream edge (exact
//                       system-palette entries). The first build used the Rhine
//                       teal, which all but vanished on the teal desktop in
//                       real Kaleidoscope (classic/README.md).
//   WindowShade Sounds  snd -14336 / -14335, synthesized: a small bell (three
//                       inharmonic partials), lower to collapse, higher to expand
import { Raster, aboutBox, arrowCursors, shadeSounds, synthesize } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

// Beethoven as a monument bust, 40×48, original pixel art: wild grey hair
// (lit on the left, dark strands, flyaway tufts), heavy brows in a frown,
// deep-set eyes, a set mouth, the high coat collar, a white stock with a red
// scarf, on a sandstone plinth. Light from the upper left. o outline, H/h/d
// hair (lit, body, shade), f/s skin (lit, shade), e brows, eyes and mouth,
// w/W white stock (lit, shade), r/R scarf (lit, shade), k/c coat (lit, shade),
// a/A/z plinth (lit, face, shade). Colours are the frame bust's (palette.mjs),
// exact system-palette entries, stored raw.
const BUST = [
  '.......o....o...o........o....o.........',
  '..o...oHo..oHo.oHo..o..ohoo.oHoo..o.....',
  '..oo..oHHooHHhohHhhhooohhhoohhddooo.....',
  '..oHo.oHHhhHhhhHhhhhhohhhhhhhhhhdo.o....',
  '..oHHooHhhhhhhhhhhhhhhhhhhdhhhhhhodo....',
  '.oHHHhhHhhhhdhhhhhhhhdhhhhhdhhhhhhddo...',
  '.oHHhhhhhhhdhhhhhhhhdhhhhhhhdhhhhhhdo...',
  'oHHhhhhhhhdhhhhhhhdhhhhhhhhhhdhhhhhddo..',
  'oHhhhhhhhdhhhhhhhdhhhhhdhhhhhhdhhhhhdo..',
  '.oHhhhhhdhhhhhhhdhhhhhhhdhhhhhhdhhhhddo.',
  'oHHhhhhdhhhhhhhhhhhhhhhhhdhhhhhhdhhhhdo.',
  'oHhhhhdhhhhfhhffhhhhfhhhhhdhhhhhhdhhhddo',
  '.oHhhhhhhffffffffffffffffhhhhhhhhhdhhhdo',
  'oHHhhhhhffffffffffffffffffshhhhhhhhhhddo',
  'oHhhhhhhfffffffffffffffffffshhdhhhhhhdo.',
  '.oHhhhhfeeeffffffffffffeeeesshhdhhhhhddo',
  'oHhhhhhffeeeeefffffeeeeeeefsshhhdhhhhdo.',
  'oHhhhhhfffffeeefsefeeeffffssshhhdhhhhddo',
  '.ohhhhhffseeeeesfffseeeeesfssshhhdhhhdo.',
  'oHhhhhhffsfewefffffsfewefsfsshhhhdhhhddo',
  'oHhhhhhfffffffffsfffffffffssshhhhhdhhdo.',
  '.ohhhhhfffffffffsffffffffffsshhhhhdhhddo',
  '.oHhhhhhffffffffsfffffffffssshhhhdhhdo..',
  '..ohhhhhffffffffssffffffffssshhhhdhhdo..',
  '..oHhhhhfffffffsssssfffffffsshhhdhhddo..',
  '...ohhhhffffffffffffffffffsshhhhdhddo...',
  '...oHhhhhfffffeeeeeeeefffssshhhdhhdo....',
  '....ohhhhffffefffffffefffsshhhhhhddo....',
  '....oohhhhfffffffffffffffsshhhhhddo.....',
  '...okkoohhhfffffffffffffsshhhhddoko.....',
  '..okkkkoohhhsffffffffffsshhhddoocko.....',
  '..okkkkkkoohhhssfffffsssshhdoocccko.....',
  '.okkkkkkkkoowwwwwwwwwwwwwwoocccccco.....',
  '.okkkkkkkkkowwwwwwwwwwwwwWWoccccccco....',
  '.okkkkkkkkoowwwrrrrrrrrwwWWoocccccco....',
  'okkkkkkkkoorrrrrrrrrrrrrrRRRoocccccco...',
  'okkkkkkkkorrrrrrrrrrrRRRRRRRRoccccccco..',
  'okkkkkkkkkoorrrrrrrrrRRRRRRRocccccccco..',
  'okkkkkkkkkkkooorrrrrRRRRRoocccccccccco..',
  'okkkkkkkkkkkkkcorrrrRRRooccccccccccccco.',
  'okkkkkkkkkkkkkcorrrRRRoocccccccccccccco.',
  'oooooooooooooooooooooooooooooooooooooooo',
  '.oooooooooooooooooooooooooooooooooooooo.',
  '..oaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaao..',
  '..oaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzo..',
  '..oaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzo..',
  '..ozzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzo..',
  '..oooooooooooooooooooooooooooooooooooo..',
];

export function bust() {
  const A = C.active, S = A.sky3, P = A.pier;
  return new Raster(40, 48).sprite(0, 0, BUST, {
    o: A.outline, e: A.outline, H: S.hairHi, h: S.hair, d: S.hairLo, f: S.skin, s: S.skinLo,
    w: A.trim, W: S.hairHi, r: S.scarf, R: C.redLo, k: S.hairLo, c: S.coat, a: P.hi, A: P.face, z: P.lo,
  });
}

const bell = (f) => synthesize([
  { from: f, decay: 0.16 },
  { from: f * 2, amp: 0.5, decay: 0.09 },
  { from: f * 2.76, amp: 0.35, decay: 0.05 },
], { seconds: 0.4, fade: 0.08 });

export function build(add) {
  const resources = [
    ...aboutBox({
      name: 'Bonn',
      description: 'Bonn on the Rhine in cherry-blossom time: the Minster, the Altes Rathaus, the Post Tower and the Langer Eugen, with Beethoven.',
      year: 2026,
      icon: bust(), iconGamma: false,
    }),
    ...arrowCursors({ fill: '#330000', outline: '#ffffcc' }),
    ...shadeSounds({ collapse: bell(660), expand: bell(990) }),
  ];
  for (const r of resources) add(r.type, r.id, r.data, r.name);
}
