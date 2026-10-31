// Castle push buttons (oak planks bound with iron straps), the default-button
// ring (a brass band), and checkboxes / radio buttons (iron-bound stone
// plates, shield bosses).
//
// Push faces (docs/authoring-a-scheme.md §5 item 3): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the
// middle with ONE colour read at bgPixel. So the plank grain can only live in
// the top/bottom bands (one row each, uniform along them) and the iron straps
// in the left/right bands (uniform down them); corner = side = 8 holds the
// plank end and its strap. Everything is hard-edged pixel
// art: corners are a 1-2 pixel stair, not a blended arc (visual design §2.2).
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

const W = C.wood;
const BTN = { size: 20, corner: 8, side: 8 };

/** Row colour of the plank (top band: lit edge, a grain row; bottom band: a grain row, shade). */
function plankRow(y, look) {
  const S = BTN.size;
  if (y === 1) return look.grain;
  if (y === 4 || y === S - 5) return look.grain;
  if (y === S - 2) return look.lo;
  return look.face;
}

function pushFace(look) {
  const S = BTN.size;
  const r = new Raster(S, S).fillRoundRect(0, 0, S, S, 2.5, look.edge);
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    if (!r.get(x, y)) continue;
    // Is (x, y) on the stepped rim? (any 4-neighbour outside the shape)
    const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !r.get(x + dx, y + dy));
    if (rim) continue;
    let c = plankRow(y, look);
    if (x === 1) c = look.grain;                         // lit left edge
    if (x === S - 2) c = look.lo;                        // shaded right edge
    // Iron straps round each end of the plank (the concept's: 3px, set in
    // from short plank ends), lit on their left, a rivet top and bottom.
    if (x === 4 || x === S - 7) c = look.bandHi;
    if (x === 5 || x === 6 || x === S - 6 || x === S - 5) c = look.band;
    if ((x === 5 || x === S - 6) && (y === 3 || y === S - 4)) c = look.bandHi;
    r.set(x, y, c);
  }
  // Hidden swatches on corner pixels that stay transparent.
  r.swatch(S - 1, 0, look.text);
  if (look.emboss) r.swatch(0, S - 1, look.emboss);
  return r;
}

const pushCinf = (emboss) => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: BTN.size - 1, y: 0 },
  embossPixel: emboss ? { x: 0, y: BTN.size - 1 } : { x: 0, y: 0 }, // (0,0) = no emboss
});

// Default ring: drawn 4px outside the face, after it; corners copied 1:1, so
// everything inside the band must be transparent. A dark edge, a 2px brass
// band, a 1px darker under-edge against the plank. Stepped like the face.
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
// 13×13: an iron rim (corners stepped), a stone face with a 1px bevel and
// iron rivets in the corners; checked is a bold red pixel X. Radios are a
// round shield boss; on is a red centre in a gold ring.
const N = 13;
const X = ['##...##', '###.###', '.#####.', '..###..', '.#####.', '###.###', '##...##'];
const DOT = ['..ggg..', '.grrrg.', 'grrrrrg', 'grrrrrg', 'grrrrrg', '.grrrg.', '..ggg..'];

function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const rim = disabled ? '#999999' : '#333333';
  const face = disabled ? '#cccccc' : pressed ? '#888888' : '#aaaaaa';
  const hi = disabled ? '#cccccc' : pressed ? '#666666' : '#cccccc';
  const lo = disabled ? '#cccccc' : pressed ? '#aaaaaa' : '#777777';
  const ink = disabled ? '#999999' : pressed ? '#660000' : '#990000';
  const r = new Raster(N, N);
  if (kind === 0) {
    r.fillRect(1, 0, N - 2, N, rim).fillRect(0, 1, N, N - 2, rim).fillRect(1, 1, N - 2, N - 2, face);
    r.hline(1, 1, N - 2, hi).vline(1, 1, N - 2, hi).hline(2, N - 2, N - 3, lo).vline(N - 2, 2, N - 3, lo);
    if (!disabled) for (const [x, y] of [[2, 2], [N - 3, 2], [2, N - 3], [N - 3, N - 3]]) r.set(x, y, pressed ? '#555555' : '#666666');
  } else {
    r.fillRoundRect(0, 0, N, N, 6.5, rim).fillRoundRect(1, 1, N - 2, N - 2, 5.5, face);
    // Bevel: the crescent of the face not covered by itself shifted down-right is lit; the opposite one shaded.
    const inFace = (x, y) => x >= 1 && y >= 1 && x < N - 1 && y < N - 1 && (x - 6) ** 2 + (y - 6) ** 2 <= 5.2 ** 2;
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (!inFace(x, y)) continue;
      if (!inFace(x - 1, y - 1)) r.set(x, y, hi);
      else if (!inFace(x + 1, y + 1)) r.set(x, y, lo);
    }
  }
  if (!on) return r;
  if (value === 2) return r.fillRect(3, 5, 7, 3, ink);
  if (kind === 1) return r.sprite(3, 3, DOT, { g: disabled ? '#bbbbbb' : '#ffcc33', r: ink });
  return r.sprite(3, 3, X, { '#': ink });
}

export function build(add) {
  const faces = [
    [-10240, 'Inactive Push Button', { face: W.disabledFace, grain: W.disabledGrain, lo: W.disabledLo, edge: W.disabledEdge, band: W.disabledBand, bandHi: '#bbbbbb', text: W.disabledText }],
    [-10239, 'Push Button', { face: W.face, grain: W.grain, lo: W.lo, edge: W.edge, band: W.band, bandHi: W.bandHi, text: W.text, emboss: W.emboss }],
    [-10238, 'Pressed Push Button', { face: W.pressedFace, grain: W.pressedGrain, lo: '#330000', edge: W.edge, band: W.band, bandHi: W.bandHi, text: W.pressedText, emboss: '#330000' }],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(!!look.emboss), name);
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
