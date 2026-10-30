// Brickworks palette. Colours are what you want to SEE (sRGB); the encoder
// applies the classic-Mac gamma pre-compensation (authoring guide §4.4).
//
// Bright primary plastic: each brick colour has a gloss, highlight, base,
// shade and a dark seam/outline tone. Inactive windows keep their plastic:
// each brick is lifted 38% toward a light grey (per hue, so the window-type
// colour coding survives) and the title stays dark enough to read (≥ 4.5:1
// on the white tile). Visual-design review §1.3.
import { mix } from '../../../tools/theme-author/index.js';

const brick = (base, { gloss, hi, lo, deep, seam }) => ({ base, gloss, hi, lo, deep, seam });

export const BRICK = {
  red: brick('#d8261c', { gloss: '#ff8f84', hi: '#f2554a', lo: '#b0180f', deep: '#86100a', seam: '#5a0a06' }),
  yellow: brick('#f7c51a', { gloss: '#fff3b0', hi: '#ffe066', lo: '#d6a400', deep: '#a87e00', seam: '#634a00' }),
  blue: brick('#1f63c6', { gloss: '#9cc3ff', hi: '#4f8ae6', lo: '#174fa0', deep: '#103a78', seam: '#0a234a' }),
  green: brick('#2a9a3c', { gloss: '#a6ecb0', hi: '#56c266', lo: '#1f7a2e', deep: '#165c22', seam: '#0c3814' }),
  white: brick('#f6f5ef', { gloss: '#ffffff', hi: '#ffffff', lo: '#dcdbd2', deep: '#bdbcb2', seam: '#5b5a55' }),
  grey: brick('#a5a29b', { gloss: '#e2e0da', hi: '#c3c0b9', lo: '#8c8982', deep: '#73706a', seam: '#45433f' }),
};

const FADE = '#e4e2dc';
const fade = (b, t = 0.38) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, mix(v, FADE, t)]));

/** Palette for one state. Inactive bricks are lifted; outline and title soften but keep contrast. */
export function pal(state) {
  const active = state === 'active';
  const b = active ? BRICK : Object.fromEntries(Object.entries(BRICK).map(([k, v]) => [k, fade(v, k === 'white' ? 0.25 : 0.38)]));
  return {
    ...b,
    outline: active ? '#1e1712' : '#6e6a63',
    title: active ? '#1c1a17' : '#5e5b55',
    titleShadow: active ? '#1c1a17' : '#5e5b55', // same colour = no shadow
    glyph: active ? '#ffffff' : null,
  };
}

// Which bricks each window type is built from ("plates of different
// colours per window type").
export const SCHEME_COLOURS = {
  doc: { bar: 'red', corner: 'yellow', wall: 'red', base: 'green' },
  modal: { bar: 'green', corner: 'yellow', wall: 'green', base: 'green' },
  movableAlert: { bar: 'yellow', corner: 'red', wall: 'yellow', base: 'green' },
  util: { bar: 'blue', corner: 'yellow', wall: 'blue', base: 'green' },
  dialog: { bar: 'blue', corner: 'blue', centre: 'yellow', wall: 'blue', base: 'green' },
  alert: { bar: 'yellow', corner: 'yellow', centre: 'red', wall: 'yellow', base: 'green' },
};

// The colour controls normally sit on: the baseplate body's middle tone.
// Used as the smooth-edge matte for buttons and checkboxes.
export const BODY = '#f3f1ea';
export const UTIL_BODY = '#eef1f6';
