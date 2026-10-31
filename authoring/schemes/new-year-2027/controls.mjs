// Midnight 2027 push buttons (navy faces in gold foil), the default-button
// ring (a gold band), and checkboxes / radio buttons (navy boxes and discs
// with gold rims). Re-themed from Castle's controls.mjs.
//
// Push faces (docs/authoring-a-scheme.md §6.1): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the
// middle with ONE colour read at bgPixel. So the face is a gold rim (lit
// top/left, shaded bottom/right) round a flat navy middle. Everything is
// hard-edged: corners are a 1-2 pixel stair, not a blended arc.
//
// Pressed inverts (visual design §2.6): a gold face with a navy label.
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

const B = C.button;
const BTN = { size: 20, corner: 5, side: 4 };

function pushFace(look) {
  const S = BTN.size;
  // Edge: a 1-2 stair at each corner (a 2px cut, then a 1px cut).
  const r = new Raster(S, S).fillRect(2, 0, S - 4, S, look.edge).fillRect(0, 2, S, S - 4, look.edge).fillRect(1, 1, S - 2, S - 2, look.edge);
  // Rim: 1px gold inside the edge; lit on top/left, shaded on bottom/right.
  r.fillRect(2, 1, S - 4, 1, look.rimHi).fillRect(1, 2, 1, S - 4, look.rimHi);
  r.fillRect(2, S - 2, S - 4, 1, look.rimLo).fillRect(S - 2, 2, 1, S - 4, look.rimLo);
  // Face: flat, with a lit row under the top rim.
  r.fillRect(2, 2, S - 4, S - 4, look.face).hline(2, 2, S - 4, look.lit);
  // Hidden swatch on a corner pixel that stays transparent.
  r.swatch(S - 1, 0, look.text);
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: BTN.size - 1, y: 0 }, embossPixel: { x: 0, y: 0 },
});

// Default ring: drawn 4px outside the face, after it; corners copied 1:1, so
// everything inside the band must be transparent. A bronze edge, a 2px gold
// band, a 1px bronze under-edge against the button. Stepped like the face.
function ringFace(gold, lo, edge) {
  const S = 28;
  return new Raster(S, S)
    .fillRoundRect(0, 0, S, S, 6.5, edge)
    .fillRoundRect(1, 1, S - 2, S - 2, 5.5, gold)
    .fillRoundRect(3, 3, S - 6, S - 6, 3.5, lo)
    .fillRoundRect(4, 4, S - 8, S - 8, 2.5, null);
}
const ringCinf = () => encodeCinf({
  cornerSize: 9, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 14, y: 14 }, textPixel: { x: 14, y: 14 }, embossPixel: { x: 0, y: 0 },
});

// Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier.
// 13×13: a dark edge, a 1px gold rim, a navy face; checked is a bold gold
// tick; radios are a navy disc in a gold ring, on = a gold dot.
const N = 13;
const TICK = [
  '......##',
  '.....###',
  '#...###.',
  '##.###..',
  '#####...',
  '.###....',
  '..#.....',
];
const DOT = ['.###.', '#####', '#####', '#####', '.###.'];

function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const edge = disabled ? '#999999' : '#000022';
  const rim = disabled ? '#cccccc' : '#ffcc33', rimLo = disabled ? '#bbbbbb' : '#cc9933';
  const face = disabled ? '#ccccff' : pressed ? '#003366' : '#000033';
  const lit = disabled ? '#eeeeee' : pressed ? '#336699' : '#003366';
  const ink = disabled ? '#999999' : pressed ? '#ffffcc' : '#ffcc33';
  const r = new Raster(N, N);
  if (kind === 0) {
    r.fillRect(1, 0, N - 2, N, edge).fillRect(0, 1, N, N - 2, edge);
    r.fillRect(1, 1, N - 2, N - 2, rim).hline(2, N - 2, N - 3, rimLo).vline(N - 2, 2, N - 3, rimLo);
    r.fillRect(2, 2, N - 4, N - 4, face).hline(2, 2, N - 4, lit).vline(2, 2, N - 4, lit);
  } else {
    const inDisc = (x, y, rad) => (x - 6) ** 2 + (y - 6) ** 2 <= rad * rad;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inDisc(x, y, 6.4)) continue;
      let c = edge;
      if (inDisc(x, y, 5.4)) c = x + y > 13 ? rimLo : rim;
      if (inDisc(x, y, 4.3)) c = !inDisc(x - 1, y - 1, 4.3) ? lit : face;
      r.set(x, y, c);
    }
  }
  if (!on) return r;
  if (value === 2) return r.fillRect(3, 5, 7, 3, ink);
  if (kind === 1) return r.sprite(4, 4, DOT, { '#': ink });
  return r.sprite(3, 3, TICK, { '#': ink });
}

export function build(add) {
  const faces = [
    [-10240, 'Inactive Push Button', { face: B.disabledFace, lit: B.disabledLit, rimHi: B.disabledRim, rimLo: B.disabledRim, edge: B.disabledEdge, text: B.disabledText }],
    [-10239, 'Push Button', { face: B.face, lit: B.lit, rimHi: B.rim, rimLo: B.rimLo, edge: B.edge, text: B.text }],
    [-10238, 'Pressed Push Button', { face: B.pressedFace, lit: B.pressedLit, rimHi: B.pressedRim, rimLo: B.pressedRim, edge: B.edge, text: B.pressedText }],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(), name);
  }
  const R = C.ring;
  add('cicn', -10232, encodeCicn(ringFace(R.inactive, R.inactiveLo, R.inactiveEdge)), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(R.gold, R.lo, R.edge)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)), `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
}
