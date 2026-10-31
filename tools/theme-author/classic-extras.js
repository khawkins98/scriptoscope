// Builders for the extras real Kaleidoscope's control panel offers beyond the
// window chrome. Each returns resources ({ type, id, data, name }) to add.
// What each one turns on, and the primary source for its ids, is in
// docs/authoring-a-scheme.md §7.2 ("Control-panel extras").
//
//   aboutBox()      DLOG + DITL -14320 sized to its text, its icon (cicn 128) and the panel strings
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

// The About This Scheme panel draws the static text in the control panel's
// small application font (Geneva 9 on the System 7.5.5 reference), not the
// Chicago 12 the Dialog Manager would use, so the box is sized for that font.
// Measured from the five first-party classic/about@2x.png screenshots
// (2026-10-31): lines 13 px apart, the first baseline 10 px below the item's
// top (so the capitals start 2 px down), and these advances in px per
// character. Over the 13 measured lines the table is within -3.2 … +6.7 px
// of the real width.
const ABOUT_LINE_H = 13, ABOUT_CAP_TOP = 2;
const ABOUT_MAX_TEXT_W = 300;                  // the widest text column
const ABOUT_SLACK = 8;                         // box width over the widest line (covers the table's error)
const ABOUT_MARGIN = 16;

function aboutAdvance(ch) {
  if (ch === ' ') return 3.2;
  if (ch === 'i') return 4.6;
  if ('lI'.includes(ch)) return ch === 'l' ? 4 : 3;
  if (".,:;!|'\u2019".includes(ch)) return 3;
  if ('tfj'.includes(ch)) return 4.5;
  if ('mw'.includes(ch)) return 8;
  if ('MW'.includes(ch)) return 9;
  if (/[0-9]/.test(ch)) return 7;
  if (/[A-Z]/.test(ch)) return 6.5;
  if (ch === '-') return 5;
  return 5.4;
}

/** The about box text's width in px, in the panel's font (the table above). */
export function aboutTextWidth(line) {
  let w = 0;
  for (const ch of line) w += aboutAdvance(ch);
  return w;
}

/**
 * Word-wrap the about text to `width` px, in the panel's font. The result is
 * stored with explicit line breaks, so the text item's height is exact.
 */
export function wrapAboutText(text, width = ABOUT_MAX_TEXT_W - ABOUT_SLACK) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && aboutTextWidth(next) > width) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
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
 * The about box: the scheme's icon on the left and static text on the right
 * (the text-only layout of Windows 3.1/95, plus an icon), with an enabled user
 * item over the whole box so a click anywhere hits an item (as Windows 95's
 * does). Also the control panel's name/description strings.
 *
 * The text is wrapped here (wrapAboutText) and the dialog sized to it: 16 px
 * margins round the icon and the text, the text column as wide as its widest
 * line plus a little slack, at most 300 px.
 * @param {{ name: string, description: string, year: number|string, icon: Raster, iconGamma?: boolean, panel?: string[] }} spec
 *   icon: 32×32 (the picker icon, rasterFromIconFamily) or larger, up to 64×64;
 *   iconGamma: false for a raster in raw stored colours (rasterFromIconFamily);
 *   panel: the STR# lines (default: the name and "An original first-party scheme for Scriptoscope, <year>")
 */
export function aboutBox({ name, description, year, icon, iconGamma = true, panel }) {
  if (icon.width < 32 || icon.height < 32 || icon.width > 64 || icon.height > 64) {
    throw new Error('aboutBox: the icon is a raster from 32×32 to 64×64');
  }
  const lines = wrapAboutText(`${name}\n${description}\n\nAn original first-party scheme for Scriptoscope.\n${year}`);
  const M = ABOUT_MARGIN;
  const iconRect = { top: M, left: M, bottom: M + icon.height, right: M + icon.width };
  const textLeft = iconRect.right + M, top = M - ABOUT_CAP_TOP;
  const textRight = textLeft + Math.min(ABOUT_MAX_TEXT_W, Math.ceil(Math.max(...lines.map(aboutTextWidth))) + ABOUT_SLACK);
  const textBottom = top + lines.length * ABOUT_LINE_H;
  // The last line's descenders end a pixel above textBottom; the slack is
  // already to the right of the text, so the right margin is M − 4.
  const W = textRight + M - 4, H = Math.max(textBottom - 1, iconRect.bottom) + M;
  const items = [
    { type: 'staticText', enabled: false, rect: { top, left: textLeft, bottom: textBottom, right: textRight }, text: lines.join('\n') },
    { type: 'icon', enabled: false, rect: iconRect, resourceId: ABOUT_ICON_ID },
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
