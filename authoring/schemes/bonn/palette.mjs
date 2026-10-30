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
    outline: '#663333',
    stone: '#ffcc99', stoneHi: '#ffffcc', stoneLo: '#cc9966', mortar: '#996633',
    red: '#cc0000', redLo: '#990000', yellow: '#ffcc00',
    title: '#ffffcc', titleShadow: '#660000',
    // Skyline: slate-teal masses with a lit roof edge and yellow windows.
    sky: '#336666', skyHi: '#669999', lamp: '#ffcc00',
    hall: '#ffcccc', hallLo: '#cc9999', trim: '#ffffff',
    glass: '#6699cc', glassHi: '#99ccff',
    // The Rhine: two flat bands and white foam (no dither: it striped at 8 bpp).
    water: '#339999', waterLo: '#336666', foam: '#ffffff',
    blossom: '#ff99cc', blossomLo: '#cc6699', blossomHi: '#ffcccc', branch: '#663300',
  },
  inactive: {
    outline: '#777777',
    stone: '#dddddd', stoneHi: '#eeeeee', stoneLo: '#bbbbbb', mortar: '#aaaaaa',
    red: '#999999', redLo: '#888888', yellow: '#bbbbbb',
    title: '#222222', titleShadow: '#222222',                 // same colour = no shadow
    sky: '#999999', skyHi: '#bbbbbb', lamp: '#cccccc',
    hall: '#cccccc', hallLo: '#aaaaaa', trim: '#eeeeee',
    glass: '#aaaaaa', glassHi: '#cccccc',
    water: '#aaaaaa', waterLo: '#999999', foam: '#eeeeee',
    blossom: '#cccccc', blossomLo: '#aaaaaa', blossomHi: '#eeeeee', branch: '#888888',
  },
};

// Pairs the palette report checks besides the sampled title and button colours.
export const CONTRAST = [
  ['#663333', '#ffffff', 'frame outline on the white body', 'outline'],
  ['#777777', '#ffffff', 'inactive frame outline on white', 'outline'],
  ['#ffffcc', '#cc0000', 'menu highlight text on red', 'text'],
  ['#663333', '#ffcc99', 'button label on sandstone', 'label'],
  ['#ffffcc', '#cc0000', 'zoom square on the red half', 'glyph'],
  ['#336666', '#ffcc99', 'collapse wave (deep band) on the sandstone disc', 'glyph'],
  ['#663333', '#ffcc00', 'zoom square outline on the yellow half', 'glyph'],
];
