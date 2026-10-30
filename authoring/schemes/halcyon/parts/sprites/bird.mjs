// The kingfisher, pixel by pixel (concept/brief.md §4.1). Two sizes: the big
// 57×43 bird is the centrepiece of the document window; the compact 22×18 one
// sits on utility windows and movable modals (dialogs and alerts carry none).
// Facing right, lit from the upper left. The big bird was drafted from shapes
// (head, body, wing, tail, beak) with rim lighting off the silhouette, then
// fixed by hand (eye, crown sparkles, feet); every pixel is in this file.
// Four tones per colour mass (teal 1-2-3-4, orange a-R-r-x), a 1px navy
// outline, hard outer edge (the cicn mask is 1-bit).
//
// The frame draws the body first, then the branch in front of the tail, then
// the feet (F/f) on top so they grip the branch.

export const BIG = [
  '.........................OOOOOOOOOO......................',
  '.......................OO4333334332OO....................',
  '......................O33333333333322O...................',
  '.....................O3333433433333322O..................',
  '....................O334333333334333221O.................',
  '....................O333333333333332222O.................',
  '....................O333433433333342222O.................',
  '...................O3333333333333322222kOOO..............',
  '...................O23333RRRRRRRKKKRRRRkkkkOOO...........',
  '...................OWWWW3RRRRRRRKWKRRRRkkkkkkkOOOO.......',
  '...................OWWWW2RRRRRRRKKKRRRRkkkkkkkkkkkOOOO...',
  '...................OWWWW2RRRRRRRRRRRRRRkkkkkkkkkkkkOOOOOO',
  '..................O4WWWW2RRRRRRRRRRRRRRkkkkkkkOOOOO......',
  '................OO43WWWW222222222222211kkOOOOO...........',
  '..............OO4333WWWW211111111111111OO................',
  '..............O113333WWW21111111111111O..................',
  '.............O11113333WW22222WWWWccccO...................',
  '............O1111113333222222ccccccOO....................',
  '............O1111311333332222WcOOOO......................',
  '............O111111113333333aRO..........................',
  '............O11111111133333aRRRO.........................',
  '...........O111111111113333aRRRO.........................',
  '...........O131111311113333aRRRRO........................',
  '...........O11111111111133aRRRRRO........................',
  '............O1111111111133aRRRRRrO.......................',
  '............O111111111113aRRRRRRrO.......................',
  '............O131111311113aRRRRRRRO.......................',
  '............O11111111111aRRRRRRRRO.......................',
  '.............O1111111111aRRRRRRRRrO......................',
  '.............O111111111aRRRRRRRRrrO......................',
  '..............O11111111aRRRRRRRRrrO......................',
  '............OO11111111aRRRRRRRRRrO.......................',
  '...........O2111111111aRRRRRRRRRrO.......................',
  '..........O21111111111aRRRRRRRRrrO.......................',
  '.........O21111111111aRRRRRRRRrrrO.......................',
  '........O211111nnn111aRRRRRRRRrrO........................',
  '.......O21111nnnnOOOaRRRRRRRrrrO.........................',
  '.....OO21111nnnOO...OrRRRRrrrrOO.........................',
  '....O21111nnnnO......OOOrrrrOO...........................',
  '...O2111nnnnOO..........OOOO.............................',
  '..O211nnnnOO...........FFF.FFF...........................',
  '.OnnnnnnOO.............f.f.f.f...........................',
  'OOOOOOOO.................................................',
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
  // compact bird
  O: 'line', T: 'back', D: 'deep', L: 'light', S: 'spark', R: 'breast', r: 'breastLo',
  W: 'cheek', K: 'eye', B: 'beak', b: 'beakLo', F: 'feet',
  // big bird: four-step teal ramp, four-step orange ramp
  n: 'line', 1: 'deep', 2: 'back', 3: 'light', 4: 'spark', a: 'breastHi', x: 'breastDeep',
  c: 'cheekLo', k: 'beak', m: 'beakLo', f: 'feetLo',
};

/** The sprite legend for one state's bird colours. */
export const legend = (bird) => Object.fromEntries(Object.entries(LEGEND_KEYS).map(([k, role]) => [k, bird[role]]));
