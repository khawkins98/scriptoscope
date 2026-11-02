// Kingfisher — an original first-party Kaleidoscope scheme, authored in code.
//
// Look (concept/concept.jpg): a kingfisher has landed on a frosted window.
// A rounded frame with a navy outline and a white inner rim round lavender
// glass; a tall header with the title capsule and three glass beads along
// its top and the kingfisher on its branch in its lower left; a blue-grey
// water band with one ripple along the bottom. The bird, branch, ripple and
// beads are painted over from the concept (npm run paint-over) and cleaned
// by hand. It copies no shipping OS.
//
// Light: one source, upper left. Every raised part (bar, discs, buttons,
// thumbs, tabs) has a 1px white sheen on its top/left inside the outline and
// a 1px shade on its bottom/right; sunk parts (tracks, grooves, boxes)
// reverse it. Everything is placed on whole pixels in system-palette colours
// (palette.mjs), so 8 bpp looks like the web.
//
// Build:   npm run author -- authoring/schemes/kingfisher
// Guides:  docs/authoring-a-scheme.md, docs/authoring-exotic-frames.md
//
// Files:
//   palette.mjs     every colour (system-palette entries) and contrast pairs
//   parts/frames.mjs            window types (frameLayout), the frame painter,
//                               title-bar beads and the pressed-widget strips
//   parts/sprites/*.png        editable 1× kingfisher and ripple art, active/inactive
//   parts/sprites/ornament.mjs  PNG import with binary-alpha validation
//   parts/*.mjs     other control families: controls (sliders, tabs, bevels, popups),
//                   menus (menus, desktop, Finder colours, icon), progress
//                   (progress, headers, triangles, grow boxes), scrollbars, classic
//                   (control-panel extras: about box, arrow cursor, WindowShade sounds)

import { Raster, encodeCicn, encodeCinf, encodeColr, encodeVers } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

// ── Push buttons ──────────────────────────────────────────────────────────
// Three faces (inactive -10240, normal -10239, pressed -10238), each with a
// same-id cinf. The engine copies the four c×c corners 1:1, stretches the
// s-thick edge bands from one column/row, and fills the middle with ONE
// colour read at bgPixel. s = 2 keeps the sheen row and the bottom shade row.
// Corners are a hard 3px pixel stair, the same as the window's.
const BUTTON = { size: 20, corner: 4, side: 2 };

/** A rectangle with 2-1 stair corners: rows 0 and h−1 lose 2px at each end, rows 1 and h−2 lose 1. */
function stairRect(w, h, fill) {
  const r = new Raster(w, h).fillRect(0, 0, w, h, fill);
  for (const [y, n] of [[0, 2], [1, 1], [h - 2, 1], [h - 1, 2]]) {
    for (let k = 0; k < n; k++) r.set(k, y, null).set(w - 1 - k, y, null);
  }
  return r;
}

function pushFace({ face, edge, text, top, bottom }) {
  const { size } = BUTTON;
  const r = stairRect(size, size, face);
  r.hline(2, 1, size - 4, top).vline(1, 2, size - 4, top);            // sheen
  r.hline(2, size - 2, size - 4, bottom).vline(size - 2, 2, size - 4, bottom); // shade
  r.outlineEdges(0, 0, size, size, edge);
  r.swatch(0, 0, text); // hidden: a transparent corner pixel carries the label colour
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BUTTON.corner, sideThickness: BUTTON.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: 0, y: 0 }, embossPixel: { x: 0, y: 0 },
});

// Default ring: drawn outset round the face and AFTER it, corners copied 1:1,
// so everything inside the 2px teal line is transparent. Its stair is the
// face's stair grown by the gap, so the two stay parallel.
function ringFace(color) {
  const size = 24, r = new Raster(size, size);
  const outer = (x, y) => {
    const dx = Math.min(x, size - 1 - x), dy = Math.min(y, size - 1 - y);
    return dx + dy >= 3 || (dx >= 1 && dy >= 1);
  };
  const inner = (x, y) => {
    const dx = Math.min(x, size - 1 - x) - 2, dy = Math.min(y, size - 1 - y) - 2;
    return dx >= 0 && dy >= 0 && (dx + dy >= 3 || (dx >= 1 && dy >= 1));
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (outer(x, y) && !inner(x, y)) r.set(x, y, color);
  return r;
}

const ringCinf = () => encodeCinf({
  cornerSize: 9, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 12, y: 12 }, textPixel: { x: 12, y: 12 }, embossPixel: { x: 0, y: 0 },
});

// ── Checkboxes and radio buttons ──────────────────────────────────────────
// id = -9504 + 12·kind + 3·value + tier
//   kind 0 checkbox, 1 radio · value 0 off, 1 on, 2 mixed · tier 0 disabled, 1 normal, 2 pressed
// 13px (odd, so the radio dot and the dash have a centre pixel). Boxes are
// sunk: the shade is on the top/left inside the outline. As in the concept,
// the box stays white and the mark is navy, on whole pixels.
const CHECK = 13;
const RADIO = [
  '....#####....',
  '..##.....##..',
  '.#.........#.',
  '.#.........#.',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '.#.........#.',
  '.#.........#.',
  '..##.....##..',
  '....#####....',
];
const MARKS = {
  check: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'],
  dot: ['.###.', '#####', '#####', '#####', '.###.'],
  dash: ['#####', '#####'],
};

function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const navy = C.active.frame.outline;
  const edge = disabled ? C.deep : navy;
  const fill = pressed ? C.shade : disabled ? C.glass : C.white;
  const sunk = disabled ? C.glass : pressed ? C.deep : C.shade;
  const r = new Raster(CHECK, CHECK);
  if (kind === 0) {
    r.fillRect(0, 0, CHECK, CHECK, fill).set(0, 0, null).set(CHECK - 1, 0, null).set(0, CHECK - 1, null).set(CHECK - 1, CHECK - 1, null);
    r.outlineEdges(0, 0, CHECK, CHECK, edge);
    r.hline(1, 1, CHECK - 2, sunk).vline(1, 1, CHECK - 2, sunk);
  } else {
    for (let y = 0; y < CHECK; y++) {
      const a = RADIO[y].indexOf('#'), b = RADIO[y].lastIndexOf('#');
      for (let x = a; x <= b; x++) r.set(x, y, RADIO[y][x] === '#' ? edge : fill);
    }
    // Sunk: shade the inner ring on the upper left.
    for (let y = 1; y < CHECK - 1; y++) for (let x = 1; x < CHECK - 1; x++) {
      const c = r.get(x, y);
      if (!c || RADIO[y][x] === '#') continue;
      const nearRim = RADIO[y - 1][x] === '#' || RADIO[y][x - 1] === '#';
      if (nearRim && x + y < CHECK - 1) r.set(x, y, sunk);
    }
  }
  if (!on) return r;
  const ink = disabled ? C.deep : navy;
  if (value === 2) return r.sprite(4, 6, MARKS.dash, { '#': ink });
  if (kind === 1) return r.sprite(4, 4, MARKS.dot, { '#': ink });
  return r.sprite(3, 3, MARKS.check, { '#': ink });
}

// ── Assemble ──────────────────────────────────────────────────────────────
export async function buildScheme() {
  const resources = [];
  const add = (type, id, data, name) => resources.push({ type, id, data, ...(name ? { name } : {}) });

  add('vers', 1, encodeVers({ major: 0, minor: 2, short: '0.2', long: '0.2 Kingfisher (Scriptoscope authoring)' }));
  add('Colr', 129, encodeColr());

  const faces = [
    [-10240, 'Inactive Push Button', { face: C.glass, edge: C.shade, text: C.textOff, top: C.glass, bottom: C.glass }],
    [-10239, 'Push Button', { face: C.glass, edge: C.active.frame.outline, text: C.text, top: C.white, bottom: C.shade }],
    [-10238, 'Pressed Push Button', { face: C.shade, edge: C.active.frame.outline, text: C.text, top: C.deep, bottom: C.shade }],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(), name);
  }
  add('cicn', -10232, encodeCicn(ringFace(C.shade)), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(C.active.frame.outline)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)),
      `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }

  // Window frames and control families (parts/*.mjs). Each exports `build(add, { C })`; they
  // load in name order. KINGFISHER_PARTS=scrollbars,menus builds only those.
  // Each resource remembers which file added it, so a clash names both files.
  const owner = new Map(resources.map((r) => [`${r.type}:${r.id}`, 'scheme.mjs']));
  for (const { file, module } of await loadParts()) {
    module.build((type, id, data, name) => {
      const key = `${type}:${id}`;
      if (owner.has(key)) throw new Error(`${type} ${id} is added by both ${owner.get(key)} and parts/${file}; each id belongs to one family`);
      owner.set(key, `parts/${file}`);
      add(type, id, data, name);
    }, { C });
  }
  return { resources };
}

async function loadParts() {
  const { readdirSync } = await import('node:fs');
  const only = process.env.KINGFISHER_PARTS?.split(',').map((x) => x.trim()).filter(Boolean);
  const files = readdirSync(new URL('./parts/', import.meta.url))
    .filter((f) => f.endsWith('.mjs') && (!only || only.includes(f.replace(/\.mjs$/, ''))))
    .sort();
  return Promise.all(files.map(async (file) => ({ file, module: await import(new URL(`./parts/${file}`, import.meta.url).href) })));
}
