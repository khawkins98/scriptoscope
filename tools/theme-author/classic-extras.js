// Builders for the extras real Kaleidoscope's control panel offers beyond the
// window chrome. Each returns resources ({ type, id, data, name }) to add.
// What each one turns on, and the primary source for its ids, is in
// docs/authoring-a-scheme.md §6 ("Control panel extras").
//
//   aboutBox()      DLOG + DITL -14320, its icon (cicn 128) and the panel strings
//                   (STR# -14320): enables "About This Scheme"
//   arrowCursors()  crsr 0 plus the Finder's -20486 / -20487 / -20488: enables "Arrow Cursor"
//   shadeSounds()   snd -14336 (collapse) and -14335 (expand): enables "WindowShade Sounds"
//
// None of these is drawn by the web runtime.

import { Raster } from './raster.js';
import { encodeCicn } from './encode-cicn.js';
import { encodeCrsr } from './encode-crsr.js';
import { encodeDlog, encodeDitl } from './encode-dialog.js';
import { encodeStrList } from './encode-strings.js';
import { encodeSnd } from './encode-snd.js';
import { SYSTEM_PALETTE_256 } from './encode-icons.js';

export const ABOUT_ID = -14320;
export const ABOUT_ICON_ID = 128;

// A rough Chicago 12 advance (px per character) for sizing the text box. The
// Dialog Manager wraps static text itself; this only decides the box height.
const CHAR_W = 7, LINE_H = 16;

function wrappedLines(text, width) {
  const perLine = Math.floor(width / CHAR_W);
  let lines = 0;
  for (const para of text.split('\n')) {
    let n = 1, len = 0;
    for (const word of para.split(' ')) {
      const add = (len ? 1 : 0) + word.length;
      if (len && len + add > perLine) { n++; len = word.length; } else len += add;
    }
    lines += n;
  }
  return lines;
}

/**
 * The 32×32 picture of an icon family (its icl8 plane, masked by the ICN#
 * mask) in raw stored colours: encode it with { gamma: false } and it shows
 * exactly the picker icon's palette entries.
 * @param {Array<{ type: string, data: Uint8Array }>} family  e.g. encodeIconFamily(-16455, …)
 */
export function rasterFromIconFamily(family) {
  const icl8 = family.find((r) => r.type === 'icl8')?.data, icn = family.find((r) => r.type === 'ICN#')?.data;
  if (!icl8 || !icn) throw new Error('rasterFromIconFamily: needs the icl8 and ICN# planes');
  const r = new Raster(32, 32);
  for (let i = 0; i < 1024; i++) {
    if (!((icn[128 + (i >> 3)] >> (7 - (i & 7))) & 1)) continue;
    const [red, g, b] = SYSTEM_PALETTE_256[icl8[i]];
    r.rgba.set([red, g, b, 255], i * 4);
  }
  return r;
}

/**
 * The about box: the scheme's 32×32 icon on the left and static text on the
 * right (the text-only layout of Windows 3.1/95, plus an icon), with an
 * enabled user item over the whole box so a click anywhere hits an item (as
 * Windows 95's does). Also the control panel's name/description strings.
 * @param {{ name: string, description: string, year: number|string, icon: Raster, iconGamma?: boolean, panel?: string[] }} spec
 *   iconGamma: false for a raster in raw stored colours (rasterFromIconFamily);
 *   panel: the STR# lines (default: the name and "An original first-party scheme for Scriptoscope, <year>")
 */
export function aboutBox({ name, description, year, icon, iconGamma = true, panel }) {
  if (icon.width !== 32 || icon.height !== 32) throw new Error('aboutBox: the icon is a 32×32 raster');
  const text = `${name}\n${description}\n\nAn original first-party scheme for Scriptoscope.\n${year}`;
  const W = 380, textLeft = 64, textRight = W - 16, top = 14;
  const textBottom = top + wrappedLines(text, textRight - textLeft) * LINE_H;
  const H = Math.max(textBottom, 16 + 32) + 14;
  const items = [
    { type: 'staticText', enabled: false, rect: { top, left: textLeft, bottom: textBottom, right: textRight }, text },
    { type: 'icon', enabled: false, rect: { top: 16, left: 16, bottom: 48, right: 48 }, resourceId: ABOUT_ICON_ID },
    { type: 'user', enabled: true, rect: { top: -1, left: -1, bottom: H + 1, right: W + 1 } },
  ];
  return [
    { type: 'DLOG', id: ABOUT_ID, data: encodeDlog({ rect: { top: 40, left: 40, bottom: 40 + H, right: 40 + W }, procID: 1, itemListId: ABOUT_ID }), name: 'Scheme About Box Dialog' },
    { type: 'DITL', id: ABOUT_ID, data: encodeDitl(items), name: 'Scheme About Box Dialog Information' },
    { type: 'cicn', id: ABOUT_ICON_ID, data: encodeCicn(icon, { gamma: iconGamma }), name: 'About Box Icon' },
    { type: 'STR#', id: ABOUT_ID, data: encodeStrList(panel ?? [name, `An original first-party scheme for Scriptoscope, ${year}`]), name: 'Control Panel Info Strings' },
  ];
}

// The standard System 7 arrow (Inside Macintosh: Imaging With QuickDraw,
// arrow cursor data and mask), hot spot (1, 1): '#' = the arrow, 'o' = its
// outline (mask without data), '.' = transparent.
export const ARROW = [
  'oo..............',
  'o#o.............',
  'o##o............',
  'o###o...........',
  'o####o..........',
  'o#####o.........',
  'o######o........',
  'o#######o.......',
  'o########o......',
  'o#####ooooo.....',
  'o##o##o.........',
  'o#o.o##o........',
  'oo..o##o........',
  '.....o##o.......',
  '.....o##o.......',
  '......ooo.......',
];

// Finder badges (Mac OS 8 cursors), drawn over the arrow's lower right: a
// 9×8 box with a 7×6 glyph inside. '#' = ink, '.' = the box's light inside.
const BADGES = {
  [-20486]: ['...#...', '...#...', '.#####.', '...#...', '...#...', '.......'], // duplicate: plus
  [-20487]: ['....#..', '.#####.', '.#..#..', '.#.....', '.#.....', '.......'], // make alias: hooked arrow
  [-20488]: ['.......', '.#####.', '.......', '.#####.', '.......', '.#####.'], // contextual menu: menu lines
};
const BADGE_NAMES = { [-20486]: 'Duplicate Item Finder Cursor', [-20487]: 'Make Alias Finder Cursor', [-20488]: 'Context Menu Finder Cursor' };

/**
 * The arrow cursor and the three Finder cursors in two colours: `fill` for the
 * arrow and badge ink, `outline` for the 1px edge and the badge's inside. Keep
 * a dark fill and a light outline (or the reverse) so the arrow reads on any
 * background. On 1-bit screens every cursor falls back to black on white.
 * Cursors are classic-only, so colours are stored raw by default (gamma:
 * false): name exact 8-bit system-palette entries and the screen shows them.
 * @param {{ fill: string, outline: string, gamma?: boolean }} spec
 */
export function arrowCursors({ fill, outline, gamma = false }) {
  const draw = (badge) => {
    const r = new Raster(16, 16).sprite(0, 0, ARROW, { '#': fill, o: outline });
    const bw = ARROW.flatMap((row) => [...row].map((c) => (c === '#' ? 1 : 0)));
    if (badge) {
      r.fillRect(7, 8, 9, 8, fill).fillRect(8, 9, 7, 6, outline);
      for (let y = 8; y < 16; y++) for (let x = 7; x < 16; x++) bw[y * 16 + x] = x === 7 || x === 15 || y === 8 || y === 15 ? 1 : 0;
      badge.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === '#') { r.set(8 + x, 9 + y, fill); bw[(9 + y) * 16 + 8 + x] = 1; }
      }));
    }
    return encodeCrsr(r, { hotSpot: { x: 1, y: 1 }, bw, gamma });
  };
  return [
    { type: 'crsr', id: 0, data: draw(null), name: 'Custom Arrow Cursor' },
    ...Object.entries(BADGES).map(([id, badge]) => ({ type: 'crsr', id: Number(id), data: draw(badge), name: BADGE_NAMES[id] })),
  ];
}

/**
 * The WindowShade sounds, from float samples (−1…1, e.g. from synthesize()).
 * @param {{ collapse: ArrayLike<number>, expand: ArrayLike<number> }} sounds
 */
export function shadeSounds({ collapse, expand }) {
  return [
    { type: 'snd ', id: -14336, data: encodeSnd(collapse, { float: true }), name: 'Collapse Sound' },
    { type: 'snd ', id: -14335, data: encodeSnd(expand, { float: true }), name: 'Expand Sound' },
  ];
}
