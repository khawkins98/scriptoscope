// Bonn's palette. Colours are what you want to see on screen (sRGB); the
// encoder applies the classic-Mac gamma pre-compensation.
//
// Procedural surfaces and controls use the system palette's 6×6×6 cube
// and grey ramp. The extracted landmark, bough and bridge PNGs retain their
// separate source-derived palettes (sprites/README.md).
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
    outline: '#330000',
    // Sandstone piers, corner blocks and the About bust pedestal.
    pier: { face: '#cc9966', hi: '#ffcc99', lo: '#996666', mortar: '#996633' },
    // Procedural canopy and the separate About-box Beethoven bust.
    sky3: {
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
    trim: '#ffffff',
    // The Rhine: two flat bands and white foam (no dither: it striped at 8 bpp).
    water: '#339999', waterLo: '#336666', foam: '#ffffff',
    blossom: '#ff99cc', blossomLo: '#cc6699', blossomHi: '#ffcccc', branch: '#663300',
  },
  inactive: {
    outline: '#777777',
    pier: { face: '#cccccc', hi: '#dddddd', lo: '#aaaaaa', mortar: '#999999' },
    sky3: {
      tree: '#aaaaaa', treeHi: '#bbbbbb',
      hair: '#aaaaaa', hairHi: '#cccccc', hairLo: '#888888', skin: '#dddddd', skinLo: '#bbbbbb', coat: '#888888', scarf: '#999999',
    },
    arms: { white: '#eeeeee', cross: '#777777', red: '#aaaaaa', redLo: '#999999', gold: '#cccccc', goldLo: '#bbbbbb' },
    waterHi: '#cccccc',
    stone: '#dddddd', stoneHi: '#eeeeee', stoneLo: '#bbbbbb', mortar: '#aaaaaa',
    red: '#999999', redLo: '#888888', yellow: '#bbbbbb',
    title: '#222222', titleShadow: '#222222',                 // same colour = no shadow
    sky: '#999999', skyHi: '#bbbbbb', skyLo: '#777777', lamp: '#cccccc',
    trim: '#eeeeee',
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
