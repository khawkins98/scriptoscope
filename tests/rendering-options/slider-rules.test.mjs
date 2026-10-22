import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { parseResourceMap } from './checkable-rules.mjs';
import {
  AWAITING_ROWS, BASE, DRIVER_ROWS, PUBLIC_ROWS, SLUGS, W, H, band, gate, hitTest, inSliderRange, layout, nativeFor, posCntl, rect, select,
  sliderCensus, sourceMap, thumbCntl, tickCount, valueFromGhost,
} from './slider-rules.mjs';

// Rule rows of docs/spec/engine/slider.md (§4 decision tables, §5 geometry,
// §7 test hooks). Every expected literal is the spec's own number (worked
// examples A–D, §7 table) or an archive fact read from the archive's own
// resource map; slider-rules.mjs transcribes the spec formulas. Nothing here
// reads runtime output (the runtime binding is slider-rules.spec.mjs).

const corpus = new Map();
for (const slug of SLUGS) {
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork);
  corpus.set(slug, { map, census: sliderCensus(map), loaded: await loadKaleidoscopeScheme(bytes, { encodeAssets: false, provenance: true }) });
}
const census = slug => corpus.get(slug).census;
const masks = new Map();
const maskOf = slug => (id, x, y) => {
  const key = `${slug}/${id}`;
  if (!masks.has(key)) { const c = readCicnIndexed(corpus.get(slug).map.find(r => r.type === 'cicn' && r.id === id).data); masks.set(key, { w: c.pmap.width, h: c.pmap.height, a: c.maskAlpha }); }
  const m = masks.get(key); return m.a[y * m.w + x] !== 0;
};
const G1 = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'windows-31', 'windows-95'];
const NONE = ['apple-platinum-2', 'black-platinum', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
const synthetic = ({ cinf = {}, cicn = {} }) => ({ cinf: new Map(Object.entries(cinf).map(([k, v]) => [Number(k), v])), cicn: new Map(Object.entries(cicn).map(([k, v]) => [Number(k), v])) });
const B16 = (w, h) => ({ top: 0, left: 0, bottom: h, right: w });

// Worked examples (spec §5.9).
const A = { rect: rect(0, 0, 32, 120), hilite: 0, variation: 2, initialValue: 5, min: 0, max: 100, value: 50 };   // 1138 h group 0, n = 5
const Bx = { rect: rect(0, 0, 100, 32), hilite: 0, variation: 2, initialValue: 3, min: 0, max: 100, value: 25 };  // 1990 v group 0, n = 3
const C = { rect: rect(0, 0, 16, 100), hilite: 0, variation: 8, min: 0, max: 100, value: 50 };                    // windows-95 h group 2
const D = { rect: rect(0, 0, 12, 15), hilite: 0, variation: 0, min: 0, max: 100, value: 50 };                     // 1984 h, along 15
const at = (slug, native, r) => layout(native, census(slug), { reading: r });
const cross = (b, h) => (h ? [b.top, b.bottom] : [b.left, b.right]);
const pieces = l => l.trackPieces.map(p => [p.kind, l.horizontal ? [p.dst.left, p.dst.right] : [p.dst.top, p.dst.bottom], l.horizontal ? [p.src.left, p.src.right] : [p.src.top, p.src.bottom]]);
const lisaPressed = r => Object.fromEntries(['horizontal', 'vertical'].flatMap(o => [0, 4, 8].map(variation => [`${o[0]}${variation >> 2}`,
  select({ rect: o === 'horizontal' ? rect(0, 0, 32, 120) : rect(0, 0, 120, 32), hilite: 129, variation }, census('apple-lisa'), { reading: r }).track])));
// ID4: the 1138 example with the tick cicn's bounds moved to left 2 (tw 5), to separate t.right + t.left from tw.
const shiftedTick = () => { const c = census('1138'); return { cinf: c.cinf, cicn: new Map([...c.cicn, [-10139, { top: 0, left: 2, bottom: 7, right: 7 }]]) }; };

/** Named rule rows: id -> (reading) => observed value. EXPECTED pins each under the decode. */
const ROWS = {
  'R1 G1–G3 gate per archive (h/v, groups 0 and 2)': r => Object.fromEntries(SLUGS.map(slug => [slug, ['horizontal', 'vertical'].flatMap(o => [0, 8].map(variation =>
    gate({ rect: o === 'horizontal' ? rect(0, 0, 16, 120) : rect(0, 0, 120, 16), variation }, census(slug), { reading: r })[0])).join('')])),
  'R2 G1/G3 synthetic gate forks': r => [
    gate({ rect: rect(0, 0, 16, 120), variation: 4 }, synthetic({ cinf: { [-10144]: [5, 16, 1, 0] } }), { reading: r }),
    gate({ rect: rect(0, 0, 16, 120), variation: 8 }, synthetic({ cinf: { [-10132]: [5, 16, 1, 0] } }), { reading: r }),
    gate({ rect: rect(0, 0, 16, 120), variation: 4 }, synthetic({ cinf: { [-10132]: [5, 16, 1, 0] } }), { reading: r }),
    gate({ rect: rect(0, 0, 16, 120), variation: 8 }, synthetic({}), { reading: r, systemSlider: false }),
  ],
  'R3 ST trackTier / thumbCell / tickState per hilite': r => [0, 1, 22, 23, 129, 253, 254, 255].map(hilite => {
    const s = select({ rect: rect(0, 0, 32, 120), hilite, variation: 0 }, census('1138'), { reading: r }); return [s.tier, s.cell, s.tickState]; }),
  'R4 TR3 apple-lisa pressed (hilite 129) falls back to gb + 1': r => lisaPressed(r),
  'R5 TR4 pressed cicn without its cinf falls back (synthetic)': r => select({ rect: rect(0, 0, 16, 120), hilite: 129, variation: 8 },
    synthetic({ cinf: { [-10144]: [5, 16, 1, 0], [-10131]: [5, 16, 1, 0] }, cicn: { [-10131]: B16(49, 16), [-10130]: B16(49, 16) } }), { reading: r }).track,
  'R6 TR3 corpus: archives whose track is not gb + tier': r => G1.filter(slug => ['horizontal', 'vertical'].some(o => [0, 4, 8].some(variation => [0, 22, 129, 254, 255].some(hilite => {
    const s = select({ rect: o === 'horizontal' ? rect(0, 0, 32, 120) : rect(0, 0, 120, 32), hilite, variation }, census(slug), { reading: r });
    return s.track !== s.gb + DRIVER_TIER(hilite); })))),
  'R7 TH1/TK4 thumbs and tick ids per group (1984 h, n = 5)': r => [0, 4, 8].map(variation => {
    const s = select({ rect: rect(0, 0, 32, 120), hilite: 0, variation: variation | 2, initialValue: 5 }, census('1984'), { reading: r }); return [s.thumb, s.tickId]; }),
  'R8 TH3/TH5 cell source rows (1138 example A, hilite 254/0/129/22; ghost)': r => [254, 0, 129, 22].map(hilite => { const l = at('1138', { ...A, hilite }, r); return [l.thumbOp.src.top, l.thumbOp.src.bottom]; })
    .concat([(l => [l.ghostOp.src.top, l.ghostOp.src.bottom])(at('1138', { ...A, message: 13, ghost: rect(0, 30, 16, 45) }, r))]),
  'R9 TH5 ghost drawn in message 13 only': r => [0, 13].map(message => !!at('1138', { ...A, message, ghost: rect(0, 30, 16, 45) }, r).ghostOp),
  'R10 §5.1 band per group (1138 h, R 32 high)': r => [0, 1, 2].map(g => cross(band(rect(0, 0, 32, 120), g, true, { reading: r }), true)),
  'R11 §5.1 F1 group-2 centre of rows (−10, 5)': r => cross(band(rect(-10, 0, 5, 120), 2, true, { reading: r }), true),
  'R12 §5.2 Th of examples A, B, C': r => [at('1138', A, r).Th, at('1990', Bx, r).Th, at('windows-95', C, r).Th],
  'R13 §5.2 range 0: Th at R.left, no inset (1138 h, R.left 10)': r => at('1138', { ...A, rect: rect(0, 10, 32, 130), min: 50, max: 50, value: 50 }, r).Th.left,
  'R14 §5.2 vertical minimum at the bottom (1990 v, value 0)': r => at('1990', { ...Bx, value: 0 }, r).Th.top,
  'R15 SL3/SL5/SL6 example A track pieces': r => pieces(at('1138', A, r)),
  'R16 SL1/SL4/BL4 example C one-column lines': r => { const l = at('windows-95', C, r); return l.trackPieces.map(p => [p.kind, [p.dst.top, p.dst.left, p.dst.bottom, p.dst.right], [p.src.top, p.src.left, p.src.bottom, p.src.right]]); },
  'R17 SL2 example D halves (1984 h, along 15)': r => pieces(at('1984', D, r)),
  'R18 SL6 end-anchored tiles (synthetic byte 3 ≠ 0 on 1138 −10143)': r => { const c = census('1138');
    return pieces(layout(A, { cinf: new Map([...c.cinf, [-10143, [5, 16, 1, 1]]]), cicn: c.cicn }, { reading: r })); },
  'R19 TK5/§5.4 example A tick rects': r => at('1138', A, r).ticks.map(t => [t.v, t.dst.left, t.dst.top, t.dst.right, t.dst.bottom]),
  'R20 TK5/§5.4 example B tick rects': r => at('1990', Bx, r).ticks.map(t => [t.v, t.dst.top, t.dst.left, t.dst.bottom, t.dst.right]),
  'R21 §5.4 F2 v_i for range 0..10, n = 4': r => at('1138', { ...A, max: 10, value: 5, initialValue: 4 }, r).ticks.map(t => t.v),
  'R22 TK1/TK2/TK3 no ticks: n = 1, range 0, R cross 23': r => [at('1138', { ...A, initialValue: 1 }, r), at('1138', { ...A, min: 50, max: 50 }, r), at('1138', { ...A, rect: rect(0, 0, 23, 120) }, r)].map(l => l.ticks.length),
  'R23 §5.4 tick centring subtracts t.right and t.left (synthetic bounds.left 2)': r => layout(A, shiftedTick(), { reading: r }).ticks.map(t => t.dst.left),
  'R24 BL1 mask-clear thumb pixels keep what is below (1138 example A)': r => {
    const l = at('1138', A, r), mask = maskOf('1138'), m = sourceMap(l, mask, { reading: r }), below = sourceMap({ ...l, order: l.order.filter(s => s !== 'thumb') }, mask, { reading: r });
    let clear = 0, kept = 0;
    for (let y = l.Th.top; y < l.Th.bottom; y++) for (let x = l.Th.left; x < l.Th.right; x++) if (!mask(l.thumbOp.id, x - l.Th.left, 16 * l.thumbOp.cell + y - l.Th.top)) { clear++; kept += JSON.stringify(m[y][x]) === JSON.stringify(below[y][x]) ? 1 : 0; }
    return [clear > 0 && kept === clear, m.flat().some(v => v === null)];   // and the O4 background shows somewhere in R
  },
  'R25 §3.3 O-order (example A; message 13)': r => [at('1138', A, r).order, at('1138', { ...A, message: 13, ghost: rect(0, 30, 16, 45) }, r).order],
  'R26 HT1–HT4 example A points and a tick-band point': r => { const l = at('1138', A, r); return [[30, 8], [60, 8], [100, 8], [60, 20], [57, 18]].map(([h, v]) => hitTest(l, { h, v }, { reading: r })); },
  'R27 §5.6 value 50 → Th.left 52 → 49; G.left 53 → 51': r => { const l = at('1138', A, r); return [l.Th.left, valueFromGhost(l, { left: l.Th.left }, { reading: r }), valueFromGhost(l, { left: 53 }, { reading: r })]; },
  'R28 §5.7 posCntl +10 (example A h; example B v)': r => [posCntl(at('1138', A, r), 10, { reading: r }), posCntl(at('1990', Bx, r), 10, { reading: r })],
  'R29 §5.8 thumbCntl at P (60, 8), example A': r => thumbCntl(at('1138', A, r), { h: 60, v: 8 }),
  'R30 public rows (DECISIONS #9): track and cell per state (1138)': r => Object.fromEntries(PUBLIC_ROWS.map(row => { const l = at('1138', nativeFor(row), r); return [`${row.orientation[0]}/${row.state}`, [l.sel.track, l.thumbOp.cell]]; })),
  'R31 pressedPart pageUp/pageDown: pressed track, normal thumb (awaits the slider driver)': r => Object.fromEntries(AWAITING_ROWS.map(row => { const l = at('1138', nativeFor(row), r); return [`${row.orientation[0]}/${row.pressedPart}`, [l.sel.track, l.thumbOp.cell]]; })),
};
// The decode's tier for a hilite, used only to phrase R6 (TR1 as transcribed in slider-rules.mjs).
function DRIVER_TIER(h) { return h === 254 || h === 255 ? 0 : h >= 1 && h <= 253 ? 2 : 1; }

const G1R = Object.fromEntries(SLUGS.map(slug => [slug, G1.includes(slug) ? 'kkkk' : 'ssss']));
const EXPECTED = {
  'R1 G1–G3 gate per archive (h/v, groups 0 and 2)': G1R,
  'R2 G1/G3 synthetic gate forks': ['kaleidoscope', 'kaleidoscope', 'system', 'kaleidoscope'],
  'R3 ST trackTier / thumbCell / tickState per hilite': [[1, 1, 1], [2, 1, 1], [2, 1, 1], [2, 1, 1], [2, 2, 1], [2, 1, 1], [0, 0, 0], [0, 0, 0]],
  // −10142, −10136, −10130, −10126, −10120, −10114 are absent: gb + 1 is drawn.
  'R4 TR3 apple-lisa pressed (hilite 129) falls back to gb + 1': { h0: -10143, h1: -10137, h2: -10131, v0: -10127, v1: -10121, v2: -10115 },
  'R5 TR4 pressed cicn without its cinf falls back (synthetic)': -10131,
  'R6 TR3 corpus: archives whose track is not gb + tier': ['apple-lisa'],
  // group 1 ships no −10134/−10133: base + 4 + tickState (TK4).
  'R7 TH1/TK4 thumbs and tick ids per group (1984 h, n = 5)': [[-10141, -10139], [-10135, -10139], [-10129, null]],
  'R8 TH3/TH5 cell source rows (1138 example A, hilite 254/0/129/22; ghost)': [[0, 16], [16, 32], [32, 48], [16, 32], [48, 64]],
  'R9 TH5 ghost drawn in message 13 only': [false, true],
  'R10 §5.1 band per group (1138 h, R 32 high)': [[0, 16], [16, 32], [8, 24]],
  'R11 §5.1 F1 group-2 centre of rows (−10, 5)': [-10, 6],
  'R12 §5.2 Th of examples A, B, C': [rect(0, 52, 16, 67), rect(58, 0, 77, 16), rect(0, 44, 16, 55)],
  'R13 §5.2 range 0: Th at R.left, no inset (1138 h, R.left 10)': 10,
  'R14 §5.2 vertical minimum at the bottom (1990 v, value 0)': 76,
  'R15 SL3/SL5/SL6 example A track pieces': [['copy', [0, 5], [0, 5]], ['copy', [115, 120], [44, 49]], ['tile', [5, 44], [5, 44]], ['tile', [44, 83], [5, 44]], ['tile', [83, 115], [5, 37]]],
  'R16 SL1/SL4/BL4 example C one-column lines': [['copy', [6, 0, 10, 2], [0, 0, 4, 2]], ['copy', [6, 98, 10, 100], [0, 3, 4, 5]], ['lines', [6, 2, 10, 98], [0, 2, 4, 3]]],
  'R17 SL2 example D halves (1984 h, along 15)': [['copy', [0, 8], [0, 8]], ['copy', [8, 15], [42, 49]]],
  'R18 SL6 end-anchored tiles (synthetic byte 3 ≠ 0 on 1138 −10143)': [['copy', [0, 5], [0, 5]], ['copy', [115, 120], [44, 49]], ['tile', [76, 115], [5, 44]], ['tile', [37, 76], [5, 44]], ['tile', [5, 37], [12, 44]]],
  'R19 TK5/§5.4 example A tick rects': [[0, 10, 16, 15, 23], [25, 33, 16, 38, 23], [50, 57, 16, 62, 23], [75, 81, 16, 86, 23], [100, 105, 16, 110, 23]],
  'R20 TK5/§5.4 example B tick rects': [[0, 84, 16, 87, 23], [50, 48, 16, 51, 23], [100, 13, 16, 16, 23]],
  'R21 §5.4 F2 v_i for range 0..10, n = 4': [0, 3, 7, 10],
  'R22 TK1/TK2/TK3 no ticks: n = 1, range 0, R cross 23': [0, 0, 0],
  'R23 §5.4 tick centring subtracts t.right and t.left (synthetic bounds.left 2)': [8, 31, 55, 79, 103],
  'R24 BL1 mask-clear thumb pixels keep what is below (1138 example A)': [true, true],
  'R25 §3.3 O-order (example A; message 13)': [['erase', 'track', 'thumb', 'ticks', 'composite'], ['erase', 'track', 'ghost', 'thumb', 'ticks', 'composite']],
  'R26 HT1–HT4 example A points and a tick-band point': [22, 129, 23, 0, 0],
  'R27 §5.6 value 50 → Th.left 52 → 49; G.left 53 → 51': [52, 49, 51],
  // h: 50 + trunc((10·100 + 47) / 95) = 61; v: 25 − trunc((10·100 + 35) / 71) = 11.
  'R28 §5.7 posCntl +10 (example A h; example B v)': [61, 11],
  // limit.left = 60 − trunc(95·50/100) = 13, right = 13 + 95 + 1; slop = B outset 15.
  'R29 §5.8 thumbCntl at P (60, 8), example A': { axis: 1, limit: rect(0, 13, 16, 109), slop: rect(-15, -15, 31, 135) },
  'R30 public rows (DECISIONS #9): track and cell per state (1138)': {
    'h/normal': [-10131, 1], 'h/pressed': [-10130, 2], 'h/disabled': [-10132, 0], 'h/inactive': [-10132, 0],
    'v/normal': [-10115, 1], 'v/pressed': [-10114, 2], 'v/disabled': [-10116, 0], 'v/inactive': [-10116, 0] },
  'R31 pressedPart pageUp/pageDown: pressed track, normal thumb (awaits the slider driver)': { 'h/pageUp': [-10130, 1], 'h/pageDown': [-10130, 1], 'v/pageUp': [-10114, 1], 'v/pageDown': [-10114, 1] },
};

// Plausible wrong readings (spec §7 "mutations that must fail"), each a DECODE override.
const MUTATIONS = {
  'gate on the track cicn': { gate: 'cicn' },
  'gate on cinf gb only': { gate: 'gbOnly' },
  'no System slider (G3 for every archive)': { systemSlider: false },
  'thumb cell 2 for a page press (hilite 22)': { thumbCell: h => (h === 254 || h === 255 ? 0 : h >= 1 && h <= 253 ? 2 : 1) },
  'disabled/inactive → ghost cell 3 (current runtime map)': { thumbCell: h => (h === 254 || h === 255 ? 3 : h === 129 ? 2 : 1) },
  'inactive → normal track tier 1': { trackTier: h => (h === 255 ? 0 : h >= 1 && h <= 253 ? 2 : 1) },
  'track drawn without its cinf': { trackNeedsCinf: false },
  'gb + 1 skipped': { trackGbNormal: false },
  'band centre with floor': { bandCentre: (a, b) => Math.floor((a + b) / 2) - 8 },
  'band = R': { bandIsR: true },
  'thumb offset rounded': { thumbRound: Math.round },
  'vertical minimum at the top': { verticalMinAtBottom: false },
  'c inset at range 0': { insetAtRangeZero: true },
  'cap clamped at 6': { capClamp: 6 },
  'halves rule omitted': { halves: false },
  'middle stretched': { stretchMiddle: true },
  'tiles from the end when byte 3 = 0': { endAnchor: () => true },
  'byte 3 ignored (always start-anchored)': { endAnchor: () => false },
  'one-column middle read as the full middle': { oneColumnMiddle: false },
  'v_i without rounding': { tickRound: false },
  'tick band inside B': { tickBandOutsideB: false },
  'tick centred by tw': { tickCentre: (tA, t) => Math.trunc((tA - (t.right - t.left)) / 2) },
  'no TK3 cross guard': { tickCrossMin: 0 },
  'no base fallback for group ticks': { tickBaseFallback: false },
  'unmasked (srcCopy) art': { masked: false },
  'no erase': { erase: false },
  'thumb before track': { order: ['erase', 'thumb', 'track', 'ghost', 'ticks', 'composite'] },
  'ghost cell drawn outside message 13': { ghostOnly13: false },
  'hit test against R': { hitArea: 'R' },
  '22 and 23 swapped': { pages: [23, 22] },
  'tracking without + trunc(T/2)': { trackRound: false },
  'value from G inverts §5.2': { valueFromGhost: false },
  'vertical posCntl sign not flipped': { verticalPosSign: false },
};

test('own resource-map census agrees with the loader over all 18 archives (input identity)', () => {
  const sha = b => createHash('sha256').update(b).digest('hex');
  for (const [slug, { map, census: c, loaded }] of corpus) {
    for (const type of ['cicn', 'cinf']) {
      const own = map.filter(r => r.type === type && inSliderRange(r.id)).map(r => [r.id, r.data.length, sha(r.data)]).sort((a, b) => a[0] - b[0]);
      const prov = loaded.byteProvenance.resources.filter(r => r.type === type && inSliderRange(r.signedId)).map(r => [r.signedId, r.byteLength, r.sha256]).sort((a, b) => a[0] - b[0]);
      assert.deepEqual(own, prov, `${slug} ${type} id -> bytes`);
    }
    for (const e of Object.values(loaded.manifest.chromeElements).filter(e => inSliderRange(e.sourceCicnId ?? 0))) {
      const b = c.cicn.get(e.sourceCicnId); assert.deepEqual([W(b), H(b)], [e.width, e.height], `${slug} ${e.sourceCicnId} bounds`);
    }
  }
});

test('corpus impact (spec §6 table): gate, corners, slicing bytes, thumbs, missing ids, masks', () => {
  assert.deepEqual(SLUGS.filter(s => census(s).cinf.has(-10144) && census(s).cinf.has(-10128)), G1);
  assert.deepEqual(SLUGS.filter(s => !census(s).cinf.size && !census(s).cicn.size), NONE);
  assert.deepEqual(SLUGS.filter(s => census(s).cicn.size && !census(s).cinf.size), ['floppies']);
  const c = slug => [0, 4, 8].map(variation => select({ rect: rect(0, 0, 32, 120), variation }, census(slug)).c).join('/');
  assert.deepEqual(Object.fromEntries(G1.map(s => [s, c(s)])), { 1138: '5/5/5', 1984: '10/10/10', 1990: '5/5/5', animals: '10/10/10', 'apple-lisa': '5/4/5', 'beos-r503': '2/2/2',
    'crayon-os': '3/3/3', 'dolphin-som': '5/5/5', evolution: '5/5/5', 'windows-31': '1/1/1', 'windows-95': '2/2/2' });
  const bytes = i => G1.filter(s => [...census(s).cinf.values()].every(b => b[i] !== 0));
  assert.deepEqual(bytes(2), ['1138', '1990', 'crayon-os', 'dolphin-som', 'evolution']);
  assert.deepEqual(G1.filter(s => [...census(s).cinf.values()].every(b => b[2] === 0)), ['1984', 'animals', 'apple-lisa', 'beos-r503', 'windows-31', 'windows-95']);
  assert.deepEqual(bytes(3), []);
  const tA = slug => [-10141, -10135, -10129].map(id => W(census(slug).cicn.get(id))).join('/');
  assert.deepEqual(Object.fromEntries(G1.map(s => [s, tA(s)])), { 1138: '15/15/15', 1984: '15/15/15', 1990: '19/19/16', animals: '19/19/17', 'apple-lisa': '15/15/15', 'beos-r503': '17/17/17',
    'crayon-os': '15/15/15', 'dolphin-som': '19/19/16', evolution: '19/19/16', 'windows-31': '16/16/16', 'windows-95': '11/11/11' });
  assert.deepEqual([-10142, -10136, -10130, -10126, -10120, -10114].filter(id => census('apple-lisa').cicn.has(id)), []);
  assert.deepEqual(G1.filter(s => !census(s).cicn.has(-10134) || !census(s).cicn.has(-10133)), ['1984', 'apple-lisa']);
  for (const s of [...G1, 'floppies']) for (const b of census(s).cicn.values()) assert.ok(b.top === 0 && b.left === 0, `${s} bounds origin`);
  // Mask-clear pixels per group: tracks (tiers 0..2, h and v) and thumbs.
  const clear = (slug, ids) => ids.some(id => { const b = census(slug).cicn.get(id), m = maskOf(slug); if (!b) return false;
    for (let y = 0; y < H(b); y++) for (let x = 0; x < W(b); x++) if (!m(id, x, y)) return true; return false; });
  const ids = (g, k) => ['horizontal', 'vertical'].flatMap(o => k.map(i => BASE[o] + 6 * g + i));
  const table = kinds => Object.fromEntries(G1.map(s => [s, [0, 1, 2].map(g => (clear(s, ids(g, kinds)) ? 'c' : '-')).join('')]));
  const ccc = Object.fromEntries(G1.map(s => [s, 'ccc']));
  assert.deepEqual(table([0, 1, 2]), { ...ccc, 'crayon-os': 'cc-', 'windows-31': '---', 'windows-95': '---' });
  assert.deepEqual(table([3]), { ...ccc, 'crayon-os': 'cc-', 'windows-31': '---', 'windows-95': 'cc-' });
});

test('decode rows equal the spec values', () => {
  for (const [id, row] of Object.entries(ROWS)) assert.deepEqual(row({}), EXPECTED[id], id);
  assert.equal(tickCount({ variation: 2 | 8, initialValue: 5 }), 0);   // ID4: group 2 never has ticks
});

test('mutation table: each wrong reading fails the named rows; every row is failed by one', () => {
  const table = Object.fromEntries(Object.entries(MUTATIONS).map(([name, reading]) => [name,
    Object.keys(ROWS).filter(id => { try { return JSON.stringify(ROWS[id](reading)) !== JSON.stringify(EXPECTED[id]); } catch { return true; } }).map(id => id.split(' ')[0])]));
  assert.deepEqual(table, {
    'gate on the track cicn': ['R1', 'R2', 'R5'],
    'gate on cinf gb only': ['R2', 'R5'],
    'no System slider (G3 for every archive)': ['R1', 'R2'],
    'thumb cell 2 for a page press (hilite 22)': ['R3', 'R8', 'R31'],
    'disabled/inactive → ghost cell 3 (current runtime map)': ['R3', 'R8', 'R30'],
    'inactive → normal track tier 1': ['R3', 'R6', 'R30'],
    'track drawn without its cinf': ['R5'],
    'gb + 1 skipped': ['R4', 'R5'],                              // R6 still names only apple-lisa
    'band centre with floor': ['R11'],
    'band = R': ['R10', 'R11', 'R12', 'R24', 'R26', 'R29'],     // example C: R is 16 high, B = R
    'thumb offset rounded': ['R12', 'R27'],
    'vertical minimum at the top': ['R12', 'R14'],
    'c inset at range 0': ['R13'],
    'cap clamped at 6': ['R17'],
    'halves rule omitted': ['R17'],
    'middle stretched': ['R15', 'R16', 'R18'],
    'tiles from the end when byte 3 = 0': ['R15'],
    'byte 3 ignored (always start-anchored)': ['R18'],
    'one-column middle read as the full middle': ['R16'],
    'v_i without rounding': ['R21'],
    'tick band inside B': ['R19', 'R20'],
    'tick centred by tw': ['R23'],
    'no TK3 cross guard': ['R22'],
    'no base fallback for group ticks': ['R7'],
    'unmasked (srcCopy) art': ['R24'],
    'no erase': ['R24', 'R25'],
    'thumb before track': ['R25'],
    'ghost cell drawn outside message 13': ['R9'],
    'hit test against R': ['R26'],
    '22 and 23 swapped': ['R26'],
    'tracking without + trunc(T/2)': ['R27', 'R28'],
    'value from G inverts §5.2': ['R27'],
    'vertical posCntl sign not flipped': ['R28'],
  });
  const failed = new Set(Object.values(table).flat());
  assert.deepEqual(Object.keys(ROWS).map(id => id.split(' ')[0]).filter(id => !failed.has(id)), []);
});

// Per-archive discrimination (range-rules style): which archives' sampled
// draws change under each reading. Rows: h/v × groups 0/1/2 × hilite
// 0/22/129/254, R along 120 × cross 32, value 25 of 0..100, n = 5 (groups 0/1).
const SAMPLED = ['horizontal', 'vertical'].flatMap(o => [0, 4, 8].flatMap(g => [0, 22, 129, 254].map(hilite =>
  ({ rect: o === 'horizontal' ? rect(0, 0, 32, 120) : rect(0, 0, 120, 32), hilite, variation: g | 2, initialValue: 5, min: 0, max: 100, value: 25 }))));
const sig = (slug, reading) => JSON.stringify(SAMPLED.map(n => { const l = layout(n, census(slug), { reading });
  return l.gate === 'system' ? 'system' : [l.sel.track, l.sel.thumb, l.sel.tickId, l.thumbOp?.cell, l.B, l.Th, pieces(l), l.ticks.map(t => t.dst), l.order]; }));
test('per-archive mutation table over sampled draws; readings no archive discriminates are named', () => {
  const geometry = ['gate on the track cicn', 'gate on cinf gb only', 'no System slider (G3 for every archive)', 'thumb cell 2 for a page press (hilite 22)',
    'disabled/inactive → ghost cell 3 (current runtime map)', 'inactive → normal track tier 1', 'track drawn without its cinf', 'gb + 1 skipped', 'no base fallback for group ticks', 'band centre with floor', 'band = R',
    'thumb offset rounded', 'vertical minimum at the top', 'cap clamped at 6', 'halves rule omitted', 'middle stretched', 'tiles from the end when byte 3 = 0', 'byte 3 ignored (always start-anchored)',
    'one-column middle read as the full middle', 'v_i without rounding', 'tick band inside B', 'tick centred by tw', 'thumb before track'];
  const table = Object.fromEntries(geometry.map(name => [name, SLUGS.filter(slug => sig(slug, MUTATIONS[name]) !== sig(slug, {}))]));
  assert.deepEqual(table, {
    'gate on the track cicn': ['floppies'],
    'gate on cinf gb only': [],                                 // every G1 archive ships cinf at base and every gb (spec §7): synthetic R2 only
    'no System slider (G3 for every archive)': SLUGS.filter(s => !G1.includes(s)),
    'thumb cell 2 for a page press (hilite 22)': G1,
    'disabled/inactive → ghost cell 3 (current runtime map)': G1,
    'inactive → normal track tier 1': G1,
    'track drawn without its cinf': [],                          // every corpus track cicn ships its cinf: synthetic R5 only
    'gb + 1 skipped': ['apple-lisa'],
    'no base fallback for group ticks': ['1984', 'apple-lisa'],
    'band centre with floor': [],                                // non-negative coordinates: trunc = floor (F1, R11, needs a negative R)
    'band = R': G1,
    'thumb offset rounded': G1,
    'vertical minimum at the top': G1,
    'cap clamped at 6': ['1984', 'animals'],
    'halves rule omitted': [],                                   // along 120 > 2k everywhere (needs along ≤ 2k: example D, R17)
    // windows-31 and windows-95: a one-column middle, so stretch/tile/lines differ in the trace (piece kind) only.
    'middle stretched': G1,
    'tiles from the end when byte 3 = 0': ['1138', '1990', 'crayon-os', 'dolphin-som', 'evolution'],
    'byte 3 ignored (always start-anchored)': [],                // byte 3 = 0 everywhere: SL6 end anchoring has no corpus case (R18 synthetic)
    'one-column middle read as the full middle': ['1984', 'animals', 'apple-lisa', 'beos-r503', 'windows-31', 'windows-95'],
    'v_i without rounding': [],                                  // n = 5, range 100: (n − 1) divides i·range (F2, R21: range 10, n = 4)
    'tick band inside B': G1,
    'tick centred by tw': [],                                    // every corpus tick cicn has bounds at 0, 0 (BL10; R23 synthetic)
    'thumb before track': G1,
  });
});

test('driver rows: DRIVER_ROWS expected values are the spec rows', () => {
  for (const [id, row] of Object.entries(DRIVER_ROWS)) assert.deepEqual(ROWS[row.row]({}), row.expected, `${id} ${row.row}`);
  for (const row of Object.values(DRIVER_ROWS)) assert.deepEqual(row.expected, EXPECTED[row.row]);
});
