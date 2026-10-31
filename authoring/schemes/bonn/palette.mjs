// Bonn's palette. Colours are what you want to see on screen (sRGB); the
// encoder applies the classic-Mac gamma pre-compensation.
//
// Every colour here is an entry of the 6×6×6 cube (or the system palette's
// grey ramp), so a 256-colour classic screen shows what the web shows
// (docs/authoring-visual-design.md §2.3). The ramps are short and flat:
// sandstone face / lit / shade / mortar, the city red and yellow, two Rhine
// teals, slate-teal for the skyline, pink plaster for the Old Town Hall, glass
// blues for the Post Tower and blossom pinks on a brown branch.
//
// Red is the title's colour: the pennant, the default ring, checked marks and
// the scroll arrowheads, nothing else.
export const C = {
  // The colour controls normally sit on (the white document body); the smooth
  // matte for buttons and checkboxes.
  body: '#ffffff',
  red: '#cc0000', redLo: '#990000', yellow: '#ffcc00',
  active: {
    // The concept's near-black outline, on a system-palette entry.
    outline: '#330000', window: '#663333',
    // The piers, corner blocks and bridge: the darker sandstone of the concept.
    pier: { face: '#cc9966', hi: '#ffcc99', lo: '#996666', mortar: '#996633' },
    // The skyline's materials, three tones each (body, lit, shade).
    sky3: {
      // The Minster: sandstone with grey tufa courses, a green-grey slate spire.
      stone: '#cc9966', stoneHi: '#ffcc99', stoneLo: '#996666',
      tufa: '#999999', tufaHi: '#cccccc', tufaLo: '#666666',
      roof: '#669999', roofHi: '#99cccc', roofLo: '#336666',
      // The Altes Rathaus: rose plaster, white trim, grey mansard, gilding.
      hall: '#ff9999', hallHi: '#ffcccc', hallLo: '#cc6666',
      slate: '#999999', slateHi: '#cccccc', slateLo: '#666666',
      gold: '#ffcc00', goldLo: '#cc9900',
      // The Post Tower: blue-green glass. The Langer Eugen: pale concrete, dark glass strips.
      glass: '#339999', glassHi: '#66cccc', glassLo: '#336666',
      concrete: '#cccccc', concreteHi: '#eeeeee', concreteLo: '#999999', strip: '#336666',
      tree: '#336666', treeHi: '#669999',
      // Beethoven: grey wild hair, skin, dark coat, a white stock with a red scarf, a sandstone plinth.
      hair: '#999999', hairHi: '#cccccc', hairLo: '#666666', skin: '#ffcc99', skinLo: '#cc9966', coat: '#333333', scarf: '#cc0000',
    },
    // The emblem inspired by the City of Bonn's arms.
    arms: { white: '#ffffff', cross: '#000000', red: '#cc0000', redLo: '#990000', gold: '#ffcc00', goldLo: '#cc9900' },
    waterHi: '#66cccc',
    stone: '#ffcc99', stoneHi: '#ffffcc', stoneLo: '#cc9966', mortar: '#996633',
    red: '#cc0000', redLo: '#990000', yellow: '#ffcc00',
    title: '#ffffcc', titleShadow: '#660000',
    // Skyline: slate-teal masses with a lit roof edge and yellow windows.
    sky: '#336666', skyHi: '#669999', skyLo: '#003333', lamp: '#ffcc00',
    hall: '#ffcccc', hallLo: '#cc9999', trim: '#ffffff',
    glass: '#6699cc', glassHi: '#99ccff', glassLo: '#336699',
    // The Rhine: two flat bands and white foam (no dither: it striped at 8 bpp).
    water: '#339999', waterLo: '#336666', foam: '#ffffff',
    blossom: '#ff99cc', blossomLo: '#cc6699', blossomHi: '#ffcccc', branch: '#663300',
  },
  inactive: {
    outline: '#777777', window: '#999999',
    pier: { face: '#cccccc', hi: '#dddddd', lo: '#aaaaaa', mortar: '#999999' },
    sky3: {
      stone: '#bbbbbb', stoneHi: '#cccccc', stoneLo: '#999999',
      tufa: '#aaaaaa', tufaHi: '#bbbbbb', tufaLo: '#999999',
      roof: '#999999', roofHi: '#aaaaaa', roofLo: '#888888',
      hall: '#cccccc', hallHi: '#dddddd', hallLo: '#aaaaaa',
      slate: '#999999', slateHi: '#aaaaaa', slateLo: '#888888',
      gold: '#bbbbbb', goldLo: '#999999',
      glass: '#aaaaaa', glassHi: '#bbbbbb', glassLo: '#999999',
      concrete: '#cccccc', concreteHi: '#dddddd', concreteLo: '#aaaaaa', strip: '#999999',
      tree: '#aaaaaa', treeHi: '#bbbbbb',
      hair: '#aaaaaa', hairHi: '#cccccc', hairLo: '#888888', skin: '#dddddd', skinLo: '#bbbbbb', coat: '#888888', scarf: '#999999',
    },
    arms: { white: '#eeeeee', cross: '#777777', red: '#aaaaaa', redLo: '#999999', gold: '#cccccc', goldLo: '#bbbbbb' },
    waterHi: '#cccccc',
    stone: '#dddddd', stoneHi: '#eeeeee', stoneLo: '#bbbbbb', mortar: '#aaaaaa',
    red: '#999999', redLo: '#888888', yellow: '#bbbbbb',
    title: '#222222', titleShadow: '#222222',                 // same colour = no shadow
    sky: '#999999', skyHi: '#bbbbbb', skyLo: '#777777', lamp: '#cccccc',
    hall: '#cccccc', hallLo: '#aaaaaa', trim: '#eeeeee',
    glass: '#aaaaaa', glassHi: '#cccccc', glassLo: '#888888',
    water: '#aaaaaa', waterLo: '#999999', foam: '#eeeeee',
    blossom: '#cccccc', blossomLo: '#aaaaaa', blossomHi: '#eeeeee', branch: '#888888',
  },
};

// Pairs the palette report checks besides the sampled title and button colours.
export const CONTRAST = [
  ['#330000', '#ffffff', 'frame outline on the white body', 'outline'],
  ['#777777', '#ffffff', 'inactive frame outline on white', 'outline'],
  ['#ffffcc', '#cc0000', 'menu highlight text on red', 'text'],
  ['#330000', '#ffcc99', 'button label on sandstone', 'label'],
  
  ['#336666', '#ffcc99', 'collapse wave (deep band) on the sandstone disc', 'glyph'],
  ['#330000', '#ffcc00', 'zoom shield outline on the gold lion', 'glyph'],
];
