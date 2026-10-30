// The kingfisher, pixel by pixel (concept/brief.md §4.1). Two sizes: the big
// bird perches on the document and modal frames, the compact one on utility
// windows, dialogs and alerts. Facing right, lit from the upper left: the
// back (left) carries the light cyan stripe, the breast (right) shades to
// dark orange at the bottom. Hard edges only, so it reads on any page.
//
// Legend (colours per state from palette.mjs → bird):
//   O outline   T back teal   D deep teal   L light cyan   S spark
//   R breast    r breast shade   W cheek / throat   K eye
//   B beak      b lower beak   F feet
// Rows are drawn over the branch, so the feet grip its top rows and the tail
// hangs behind it.

export const BIG = [
  '.............OOOOOOO..............',
  '...........OOTTTLTTTOO............',
  '..........OTTLTTTTTLTTO...........',
  '.........OTTTTTTLTTTTTTO..........',
  '.........OTLTTTTTTTTTTLTO.........',
  '.........OTTTTRRRRRRKWRRTOOOOO....',
  '.........OTWWRRRRRRRKKRRRBBBBBOO..',
  '.........OTWWWTTTTTTTRRRRBBBBBBBOO',
  '.........ODWWTTTTTTTTTWWWbbbbbOO..',
  '.........OTTTTTTTTTTWWWWWOOOOO....',
  '........OLTTTTTTTTTRWWWWO.........',
  '.......OLTTTTTTTTTRRRWWWO.........',
  '......OLLDDTTTTTTRRRRRRRO.........',
  '......OLDDLDTTTTRRRRRRRRO.........',
  '.....OLLDDDDDTTRRRRRRRRRO.........',
  '.....OLDLDDLDTRRRRRRRRRO..........',
  '.....OLLDDDDDDRRRRRRRRrO..........',
  '....OLLDDLDDDRRRRRRRRrO...........',
  '....OLDDDDDDDrRRRRRRrO............',
  '...OLDDDDDDDDrrRRRrrO.............',
  '...OLDDDDDDDOOrrrrOO..............',
  '..OLDDDDDOOO..FF.FF...............',
  '..OLDDDDO.....FF.FF...............',
  '.OLDDDO...........................',
  '.OLDDO............................',
  'OLDDO.............................',
  'ODDO..............................',
  'OOO...............................',
];

export const SMALL = [
  '........OOOOO.........',
  '......OOTLTTTOO.......',
  '.....OTLTTTTLTTO......',
  '.....OTTTTTTTTTO......',
  '....OTWRRRRKKRTOOOOO..',
  '....OTWWRRRRKRRBBBBBOO',
  '....ODWTTTTTRRWbbbbOO.',
  '....OTTTTTTTWWWOOOO...',
  '...OLTTTTTRRWWO.......',
  '...OLDDTTRRRRRO.......',
  '..OLDLDDRRRRRRO.......',
  '..OLDDDDRRRRRrO.......',
  '.OLDDLDDRRRRrO........',
  '.OLDDDDDrRRrrO........',
  '.OLDDDDOOrrrO.........',
  'OLDDDO..FF.F..........',
  'ODDO....FF.F..........',
  'OOO...................',
];

export const LEGEND_KEYS = {
  O: 'line', T: 'back', D: 'deep', L: 'light', S: 'spark', R: 'breast', r: 'breastLo',
  W: 'cheek', K: 'eye', B: 'beak', b: 'beakLo', F: 'feet',
};

/** The sprite legend for one state's bird colours. */
export const legend = (bird) => Object.fromEntries(Object.entries(LEGEND_KEYS).map(([k, role]) => [k, bird[role]]));
