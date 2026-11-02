// Scriptoscope Reference: enamel bezel, paper controls, one six-tile maker mark.
import { Raster, encodeCicn, encodeCinf, encodeColr, encodeVers } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

// ── Push buttons ──────────────────────────────────────────────────────────
// Three faces (inactive -10240, normal -10239, pressed -10238), each with a
// same-id cinf. The engine copies the four c×c corners 1:1, stretches the
// s-thick edge bands from one column/row, and fills the middle with ONE
// colour read at bgPixel. s = 2 keeps the sheen row and the bottom shade row.
// Square faces keep the concept's shallow upper-left light and lower-right shade.
const BUTTON = { size: 20, corner: 4, side: 2 };

function pushFace({ face, edge, text, top, bottom }) {
  const { size } = BUTTON;
  const r = new Raster(size, size).fillRect(0, 0, size, size, face);
  r.hline(1, 1, size - 2, top).vline(1, 1, size - 2, top); // shallow light rim
  r.hline(1, size - 2, size - 2, bottom).vline(size - 2, 1, size - 2, bottom); // shade
  r.outlineEdges(0, 0, size, size, edge);
  r.swatch(9, 10, text); // hidden in the sampled-fill center, never copied by the compositor
  return r;
}

const pushCinf = () =>
  encodeCinf({
    cornerSize: BUTTON.corner,
    sideThickness: BUTTON.side,
    tileSides: 0,
    patternAnchor: 0,
    bgPatternId: 0,
    bgPixel: { x: 10, y: 10 },
    textPixel: { x: 9, y: 10 },
    embossPixel: { x: 0, y: 0 },
  });

// A square brass dash ring surrounds the face without painting over it.
// Its 6px middle bands contain two 3px periods; tileSides repeats both axes.
function ringFace(color) {
  const size = 24;
  const r = new Raster(size, size);
  for (let p = 0; p < size; p++) {
    if (p % 3 === 2) continue;
    r.fillRect(p, 0, 1, 2, color).fillRect(p, size - 2, 1, 2, color);
    r.fillRect(0, p, 2, 1, color).fillRect(size - 2, p, 2, 1, color);
  }
  return r;
}

const ringCinf = () =>
  encodeCinf({
    cornerSize: 9,
    sideThickness: 4,
    tileSides: 1,
    patternAnchor: 0,
    bgPatternId: 0,
    bgPixel: { x: 12, y: 12 },
    textPixel: { x: 12, y: 12 },
    embossPixel: { x: 0, y: 0 },
  });

// ── Checkboxes and radio buttons ──────────────────────────────────────────
// id = -9504 + 12·kind + 3·value + tier
//   kind 0 checkbox, 1 radio · value 0 off, 1 on, 2 mixed · tier 0 disabled, 1 normal, 2 pressed
// 13px (odd, so the radio dot and the dash have a centre pixel). Boxes are
// the box stays white and the mark is ink, on whole pixels.
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
  const on = value > 0,
    disabled = tier === 0,
    pressed = tier === 2;
  const outline = C.ink;
  const edge = disabled ? C.deep : outline;
  const fill = pressed ? C.shade : disabled ? C.paper : C.white;
  const sunk = disabled ? C.paper : pressed ? C.deep : C.shade;
  const r = new Raster(CHECK, CHECK);
  if (kind === 0) {
    r.fillRect(0, 0, CHECK, CHECK, fill)
      .set(0, 0, null)
      .set(CHECK - 1, 0, null)
      .set(0, CHECK - 1, null)
      .set(CHECK - 1, CHECK - 1, null);
    r.outlineEdges(0, 0, CHECK, CHECK, edge);
    r.hline(1, 1, CHECK - 2, sunk).vline(1, 1, CHECK - 2, sunk);
  } else {
    for (let y = 0; y < CHECK; y++) {
      const a = RADIO[y].indexOf('#'),
        b = RADIO[y].lastIndexOf('#');
      for (let x = a; x <= b; x++) r.set(x, y, RADIO[y][x] === '#' ? edge : fill);
    }
    // Sunk: shade the inner ring on the upper left.
    for (let y = 1; y < CHECK - 1; y++)
      for (let x = 1; x < CHECK - 1; x++) {
        const c = r.get(x, y);
        if (!c || RADIO[y][x] === '#') continue;
        const nearRim = RADIO[y - 1][x] === '#' || RADIO[y][x - 1] === '#';
        if (nearRim && x + y < CHECK - 1) r.set(x, y, sunk);
      }
  }
  if (!on) return r;
  const ink = disabled ? C.deep : outline;
  if (value === 2) return r.sprite(4, 6, MARKS.dash, { '#': ink });
  if (kind === 1) return r.sprite(4, 4, MARKS.dot, { '#': ink });
  return r.sprite(3, 3, MARKS.check, { '#': ink });
}

// ── Assemble ──────────────────────────────────────────────────────────────
export async function buildScheme() {
  const resources = [];
  const add = (type, id, data, name) => resources.push({ type, id, data, ...(name ? { name } : {}) });

  add('vers', 1, encodeVers({ major: 1, minor: 0, short: '1.0', long: '1.0 Scriptoscope Reference' }));
  add('Colr', 129, encodeColr());

  const faces = [
    [
      -10240,
      'Inactive Push Button',
      { face: C.paper, edge: C.shade, text: C.textOff, top: C.paper, bottom: C.paper },
    ],
    [-10239, 'Push Button', { face: C.paper, edge: C.ink, text: C.text, top: C.white, bottom: C.shade }],
    [
      -10238,
      'Pressed Push Button',
      { face: C.enamel, edge: C.ink, text: C.paper, top: C.enamelHi, bottom: C.black },
    ],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(), name);
  }
  add('cicn', -10232, encodeCicn(ringFace(C.shade)), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(C.accent)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'],
    values = ['Off', 'On', 'Mixed'],
    tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++)
    for (let value = 0; value < 3; value++)
      for (let tier = 0; tier < 3; tier++) {
        add(
          'cicn',
          -9504 + 12 * kind + 3 * value + tier,
          encodeCicn(checkable(kind, value, tier)),
          `${tiers[tier]} ${values[value]} ${kinds[kind]}`,
        );
      }

  // Window frames and control families (parts/*.mjs). Each exports `build(add, { C })`; they
  // load in name order.
  // Each resource remembers which file added it, so a clash names both files.
  const owner = new Map(resources.map((r) => [`${r.type}:${r.id}`, 'scheme.mjs']));
  for (const { file, module } of await loadParts()) {
    module.build(
      (type, id, data, name) => {
        const key = `${type}:${id}`;
        if (owner.has(key))
          throw new Error(
            `${type} ${id} is added by both ${owner.get(key)} and parts/${file}; each id belongs to one family`,
          );
        owner.set(key, `parts/${file}`);
        add(type, id, data, name);
      },
      { C },
    );
  }
  return { resources };
}

async function loadParts() {
  const { readdirSync } = await import('node:fs');
  const files = readdirSync(new URL('./parts/', import.meta.url))
    .filter((f) => f.endsWith('.mjs'))
    .sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      module: await import(new URL(`./parts/${file}`, import.meta.url).href),
    })),
  );
}
