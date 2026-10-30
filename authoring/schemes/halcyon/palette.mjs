// Halcyon's palette: a kingfisher has landed on a frosted modern window
// (concept/brief.md §1).
//
// Every colour here is chosen as an entry of the classic 8-bit system palette
// (the 6×6×6 cube or the grey ramp) and written through `sys()`, which gives
// the colour the loader shows for that stored entry. The encoder stores it
// back as the entry (±1), so an 8 bpp Mac and the web show the same colours:
// nothing snaps, nothing drifts to a neighbouring hue. Write colours as
// sys('#rrggbb') with cube digits (00 33 66 99 cc ff) or grey-ramp greys.
//
// Light comes from the upper left: a 1px white sheen on the top/left inside
// every raised outline, a 1px shade on the bottom/right. Sunk parts (tracks,
// grooves, channels) reverse it.
//
// Teal is spent only on glyphs, checked/on states, the default ring, the
// active tab edge and the water (brief §4.5).
import { gammaCorrectHex } from '../../../tools/theme-loader/mac-gamma.js';

/** The on-screen colour of a stored system-palette entry. */
export const sys = (hex) => gammaCorrectHex(hex);

const white = '#ffffff';

export const C = {
  body: white,
  white,
  black: sys('#000000'),
  glass: sys('#eeeeee'),        // frosted face: bar, sides, button bottoms
  shade: sys('#cccccc'),        // 1px shade rows, pressed faces, inactive rims
  deep: sys('#999999'),         // sunk channels, disabled text
  outline: sys('#336699'),      // the window's edge, every rim
  accent: sys('#0099cc'),       // glyphs, checked, default ring, active tab, water
  accentDeep: sys('#006699'),   // pressed faces, groove edges
  accentLight: sys('#66ccff'),  // sheen on teal, thumb grips, upper water
  water: sys('#3399cc'),        // lower water, slider groove, progress fill
  text: sys('#000000'),
  textOff: sys('#999999'),

  active: {
    outline: sys('#336699'), sheen: white, face: sys('#eeeeee'), shade: sys('#cccccc'),
    plate: white, plateShade: sys('#cccccc'), title: sys('#000000'),
    rim: sys('#336699'), disc: sys('#eeeeee'), glyph: sys('#006699'),
    branch: { line: sys('#333300'), hi: sys('#99cc33'), mid: sys('#669933'), lo: sys('#336600'), cut: sys('#cc9966'), ring: sys('#996633') },
    leaf: { hi: sys('#99cc33'), mid: sys('#669933'), lo: sys('#336600') },
    bird: {
      line: sys('#003366'), back: sys('#0099cc'), deep: sys('#006699'), light: sys('#33cccc'), spark: sys('#66ffff'),
      breast: sys('#ff9933'), breastLo: sys('#cc6600'), cheek: white, eye: sys('#000000'),
      beak: sys('#333333'), beakLo: sys('#666666'), feet: sys('#ff6633'),
    },
    water: { hi: sys('#66ccff'), lo: sys('#3399cc'), foam: white, foamLo: sys('#66ccff'), ripple: white },
    pebble: { line: sys('#666666'), face: sys('#cccccc'), lo: sys('#999999'), hi: white },
  },
  inactive: {
    outline: sys('#777777'), sheen: white, face: sys('#dddddd'), shade: sys('#bbbbbb'),
    plate: sys('#eeeeee'), plateShade: sys('#cccccc'), title: sys('#555555'),
    rim: sys('#999999'), disc: sys('#dddddd'), glyph: null,
    branch: { line: sys('#666633'), hi: sys('#cccc99'), mid: sys('#999966'), lo: sys('#666633'), cut: sys('#cccc99'), ring: sys('#999966') },
    leaf: { hi: sys('#cccc99'), mid: sys('#999966'), lo: sys('#666633') },
    bird: {
      line: sys('#336666'), back: sys('#669999'), deep: sys('#336666'), light: sys('#99cccc'), spark: sys('#ccffff'),
      breast: sys('#cc9966'), breastLo: sys('#996666'), cheek: sys('#eeeeee'), eye: sys('#333333'),
      beak: sys('#555555'), beakLo: sys('#777777'), feet: sys('#cc9999'),
    },
    water: { hi: sys('#99cccc'), lo: sys('#669999'), foam: sys('#eeeeee'), foamLo: sys('#99cccc'), ripple: sys('#eeeeee') },
    pebble: { line: sys('#888888'), face: sys('#dddddd'), lo: sys('#bbbbbb'), hi: sys('#eeeeee') },
  },
};

// Extra pairs for the palette report (npm run author -- … --palette).
export const CONTRAST = [
  [C.active.outline, C.body, 'outline'],
  [C.inactive.outline, C.body, 'outline'],
  [C.active.glyph, C.active.disc, 'glyph'],
  ['#ffffff', C.accentDeep, 'glyph'],
  [C.inactive.title, C.inactive.plate, 'inactive title'],
  [C.text, C.glass, 'label'],
];
