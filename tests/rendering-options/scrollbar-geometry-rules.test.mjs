import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { decodePpat } from '../../tools/theme-loader/decoders/ppat.js';
import { parseResourceMap } from './checkable-rules.mjs';
import { SLUGS, expectedSet, scrollCensus, selectScrollbar } from './range-rules.mjs';
import { DRIVER_ROWS, layout, hitTest, pixelSource, segmentOffscreen, slice } from './scrollbar-geometry-rules.mjs';

// Geometry rows of docs/spec/engine/scrollbar.md §7 ("Test hooks"). Every
// expected literal below is the spec's own number (worked example §5.7, §7
// table) or an archive fact read from the archive's own resource map; the model
// in scrollbar-geometry-rules.mjs transcribes the spec formulas. Nothing here
// reads runtime output. Rows that need the runtime's `pressedPart` option or
// the engine trace (D1–D8) keep their expected values in DRIVER_ROWS, pinned
// against the model here and bound to the runtime elsewhere.

const corpus = new Map();
for (const slug of SLUGS) {
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork);
  corpus.set(slug, { map, census: scrollCensus(map) });
}
const census = slug => corpus.get(slug).census;
const R = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });
const H120 = R(0, 0, 120, 16);
const at = (slug, native, reading) => layout({ min: 0, max: 100, value: 50, hilite: 0, rect: H120, ...native }, census(slug), { reading });
const rel = (pieces, o) => pieces.map(p => [[p.dst[0] - o, p.dst[1] - o], p.src]);

// Decoded art of the pattern-underlay archive (crayon-os): mask bits and ppat pixels.
const resource = (slug, type, id) => corpus.get(slug).map.find(r => r.type === type && r.id === id).data;
const cicnArt = new Map(), ppatArt = new Map();
const art = slug => ({
  mask: (id, x, y) => { if (!cicnArt.has(id)) cicnArt.set(id, readCicnIndexed(resource(slug, 'cicn', id))); const c = cicnArt.get(id); return c.maskAlpha[y * c.pmap.width + x] !== 0; },
  ppatSize: id => { if (!ppatArt.has(id)) ppatArt.set(id, decodePpat(resource(slug, 'ppat', id))); const p = ppatArt.get(id); return [p.width, p.height]; },
});
const ppatRgb = (slug, id, u, v) => { art(slug).ppatSize(id); const p = ppatArt.get(id); return [...p.rgba.slice((v * p.width + u) * 4, (v * p.width + u) * 4 + 3)]; };
const CRAYON_R = R(13, 5, 120, 16);   // left 13, top 5: not a multiple of 8 (nor of the 64 × 16 ppat)

// Thickness-11 archives without small thumbs or small tracks whose horizontal
// thumb is the 16 × 16 -10206 (spec §7 row "§5.9 thumb, TH5, §5.6").
const T11 = ['1990', 'dolphin-som', 'evolution'];

/** Named rule rows: id -> (reading) => observed value. EXPECTED pins each under the decode. */
const ROWS = {
  'G1 §5.2/§5.3 composite boxes and T (1138, 120 × 16)': r => { const l = at('1138', {}, r); return { boxes: l.boxes, T: l.T }; },
  'G2 §5.2/§5.3 icon-lane boxes and T (platinum-8, 120 × 16)': r => { const l = at('platinum-8', {}, r); return { boxes: l.boxes, T: l.T }; },
  'G3 §5.4/§5.5 cells and track source (1138 -8286)': r => { const l = at('1138', {}, r); return { cells: l.cells, source: l.trackSource }; },
  'G4 TH3–TH5/§5.6/§5.7 thumb (1138 worked example)': r => { const l = at('1138', {}, r); return { thumb: l.thumbCicn, len: l.len, pos: l.pos, Th: l.Th }; },
  'G5 §5.8 track segments (1138 worked example)': r => at('1138', {}, r).segments.map(s => s.rect),
  'G6 §5.9 track halves (1138 worked example)': r => at('1138', {}, r).trackPieces.map(s => s.pieces.map(p => [p.dst, p.src])),
  'G7 §5.9 thumb caps at t = 11 (1990, dolphin-som, evolution)': r => T11.map(slug => { const l = at(slug, { rect: R(0, 0, 120, 11) }, r);
    return { thumb: l.thumbCicn, minLen: l.minLen, Th: l.Th, cross: l.t, pieces: rel(l.thumbPieces, l.Th[0]) }; }),
  'G8 TR7 ≤ 11 quirk (pressed 20, t = 11, horizontal)': r => SLUGS.filter(slug => {
    const p = selectScrollbar({ hilite: 20, orientation: 'horizontal', thickness: 11 }, census(slug), { reading: r });
    const l = at(slug, { hilite: 20, rect: R(0, 0, 120, 11) }, r);
    return p.composite && !census(slug).cicn.has(-8285 + 18) && p.tracks.join() === '-8285' && l.boxSource[3] === -8285;
  }),
  'G9 AH1–AH3/AC2/AC3 composite arrow-box sources by hilite (1138)': r => Object.fromEntries([0, 20, 21, 22, 23, 129].map(h => [h, at('1138', { hilite: h }, r).boxSource])),
  'G10 HT1–HT8 part codes (1138 worked example)': r => { const l = at('1138', {}, r);
    return [[-1, 8], [0, 8], [14, 8], [15, 8], [51, 8], [52, 8], [60, 8], [68, 8], [69, 8], [104, 8], [105, 8], [119, 8], [120, 8], [60, 16]].map(([x, y]) => hitTest(l, { x, y }, { reading: r }))
      .concat(hitTest(at('1138', { hilite: 255 }, r), { x: 60, y: 8 }, { reading: r })); },
  'G11 HT2/HT6 icon-lane overlap pixel goes to the arrow (platinum-8, value 0)': r => { const l = at('platinum-8', { value: 0 }, r); return { Th: l.Th, part: hitTest(l, { x: 15, y: 8 }, { reading: r }) }; },
  'G12 TF7/TF8/AC4 pattern underlay anchored at R (crayon-os, R at 13,5)': r => { const l = at('crayon-os', { rect: CRAYON_R }, r);
    return { pattern: l.pattern, track: pixelSource(l, 40, 9, art('crayon-os'), { reading: r }), arrow: pixelSource(l, 14, 9, art('crayon-os'), { reading: r }) }; },
  'G13 §4.7 offscreen rule (atiPresent × pattern × picSave)': r => [false, true].flatMap(atiPresent => [false, true].flatMap(pattern => [false, true].map(picSave => segmentOffscreen({ atiPresent, pattern, picSave }, { reading: r })))),
  'G14 §3 draw order (1138 normal, disabled)': r => [0, 255].map(h => at('1138', { hilite: h }, r).order),
  'G15 CF1/CF2 composite flag (crayon-os, windows-95, platinum-8 normal tracks)': r => ['crayon-os', 'windows-95', 'platinum-8'].map(slug => at(slug, {}, r).composite),
  'G17 §5.4 (#396) pressed non-hit cell from its own cicn (animals, monkey-paradise)': r => Object.fromEntries(['animals', 'monkey-paradise'].map(slug => [slug, at(slug, { hilite: 20 }, r).boxCells])),
  'G18 §5.4 (#396) narrow-source cell (1138, min = max, hilite 20)': r => at('1138', { hilite: 20, min: 0, max: 0, value: 0 }, r).boxCells,
  'G19 AD4 inactive draws no arrows (1138, platinum-8)': r => Object.fromEntries(['1138', 'platinum-8'].map(slug => [slug, at(slug, { hilite: 254 }, r).arrowsDrawn])),
  'G20 §5.2/§5.5 inactive T = R, whole-bounds source (1984)': r => { const l = at('1984', { hilite: 254 }, r);
    return { T: l.T, source: l.trackSource, segments: l.segments.map(sg => sg.rect), pieces: l.trackPieces[0].pieces.map(p => [p.dst, p.src]) }; },
  'G16 AI4 icon art: ics8 or the 1-bit ics#, never ics4': r => {
    const synthetic = { cicn: new Map([[-8286, [16, 16]], [-10206, [17, 16]]]), ppat: new Set(), mask: new Set([-10202, -10201]), color: new Set([-10201]), ics4: new Set([-10202, -10201]) };
    return selectScrollbar({ hilite: 0, orientation: 'horizontal' }, synthetic, { reading: r }).iconArt;
  },
};

const EXPECTED = {
  'G1 §5.2/§5.3 composite boxes and T (1138, 120 × 16)': { boxes: { 0: [0, 15], 3: [105, 120] }, T: [15, 105] },
  'G2 §5.2/§5.3 icon-lane boxes and T (platinum-8, 120 × 16)': { boxes: { 0: [0, 16], 3: [104, 120] }, T: [15, 105] },
  'G3 §5.4/§5.5 cells and track source (1138 -8286)': { cells: { 0: [0, 15], 3: [18, 33] }, source: [15, 18] },
  'G4 TH3–TH5/§5.6/§5.7 thumb (1138 worked example)': { thumb: -10206, len: 17, pos: 37, Th: [52, 69] },
  'G5 §5.8 track segments (1138 worked example)': [[15, 53], [68, 105]],
  // halves, s = 3: a = 1; piece 2 is the one column [16, 17).
  'G6 §5.9 track halves (1138 worked example)': [[[[15, 16], [15, 16]], [[16, 51], [16, 17]], [[51, 53], [16, 18]]], [[[68, 69], [15, 16]], [[69, 103], [16, 17]], [[103, 105], [16, 18]]]],
  'G7 §5.9 thumb caps at t = 11 (1990, dolphin-som, evolution)': T11.map(() => ({ thumb: -10206, minLen: 11, Th: [55, 66], cross: 11, pieces: [[[0, 3], [0, 3]], [[3, 9], [6, 12]], [[9, 11], [14, 16]]] })),
  'G8 TR7 ≤ 11 quirk (pressed 20, t = 11, horizontal)': ['1990', 'animals', 'crayon-os', 'dolphin-som', 'evolution', 'monkey-paradise'],
  'G9 AH1–AH3/AC2/AC3 composite arrow-box sources by hilite (1138)': {
    0: { 0: -8286, 3: -8286 }, 20: { 0: -8285, 3: -8286 }, 21: { 0: -8286, 3: -8285 }, 22: { 0: -8286, 3: -8286 }, 23: { 0: -8286, 3: -8286 }, 129: { 0: -8286, 3: -8286 } },
  'G10 HT1–HT8 part codes (1138 worked example)': [0, 20, 20, 22, 22, 129, 129, 129, 23, 23, 21, 21, 0, 0, 0],
  'G11 HT2/HT6 icon-lane overlap pixel goes to the arrow (platinum-8, value 0)': { Th: [15, 32], part: 20 },
  // Track column 15 of -8286 is mask-clear in all 16 rows, so the segment shows
  // the ppat; the arrow cell [0, 15) is opaque, so the box shows the cicn.
  'G12 TF7/TF8/AC4 pattern underlay anchored at R (crayon-os, R at 13,5)': { pattern: -8286, track: { from: 'ppat', id: -8286, u: 27, v: 4 }, arrow: { from: 'cicn', id: -8286, x: 1, y: 4 } },
  'G13 §4.7 offscreen rule (atiPresent × pattern × picSave)': [true, true, true, true, false, false, false, true],
  'G14 §3 draw order (1138 normal, disabled)': [['arrow0', 'arrow3', 'thumb', 'track-low', 'track-high'], ['arrow0', 'arrow3', 'track-whole']],
  'G15 CF1/CF2 composite flag (crayon-os, windows-95, platinum-8 normal tracks)': [true, true, false],
  'G16 AI4 icon art: ics8 or the 1-bit ics#, never ics4': { '-10202': 'ics#', '-10201': 'ics8' },
  'G19 AD4 inactive draws no arrows (1138, platinum-8)': { '1138': [], 'platinum-8': [] },
  // 1984 -8288 is 43 × 16 (composite); inactive keeps its whole bounds. Halves, s = 43, w = 120: m = 43, a = 21.
  'G20 §5.2/§5.5 inactive T = R, whole-bounds source (1984)': { T: [0, 120], source: [0, 43], segments: [[0, 120]], pieces: [[[0, 21], [0, 21]], [[21, 98], [21, 22]], [[98, 120], [21, 43]]] },
  'G18 §5.4 (#396) narrow-source cell (1138, min = max, hilite 20)': { 0: { id: -8287, cell: [0, 15] }, 3: { id: -8288, cell: [-10, 5], outOfSource: [[105, 115]] } },
  'G17 §5.4 (#396) pressed non-hit cell from its own cicn (animals, monkey-paradise)': Object.fromEntries(['animals', 'monkey-paradise'].map(slug => [slug, { 0: { id: -8285, cell: [0, 15] }, 3: { id: -8286, cell: [28, 43] } }])),
};

// Plausible wrong readings (spec §7 "mutations that must fail"), each a model override.
const swapPages = (p, th) => (p < ((th[0] + th[1]) >> 1) ? 23 : 22);
const halfEven = x => { const f = Math.floor(x); return x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x); };
const MUTATIONS = {
  'c = t instead of t − 1': { arrowLen: t => t },
  'icon-lane boxes c long (e = 0)': { iconBoxExtra: 0 },
  'cell length h instead of h − 1': { cellLen: h => h },
  'proportional thumb by default': { proportional: true },
  '+0.5 rounding dropped': { round: Math.trunc },
  'round half to even': { round: x => halfEven(x) },
  'segments do not overlap the thumb': { segmentOverlap: 0 },
  'cap 3 for the track': { trackSliceMode: 0 },
  'halves for the thumb': { thumbSliceMode: 1 },
  'no −5 after a small-thumb miss': { smallThumbMissPenalty: 0 },
  'cap 2': { capForMode0: 2 },
  'trackId reset after a small-art miss': { keepSmallTrackId: false },
  'non-hit box from the pressed tier': { nonHitBoxFromIdMinus1: false, nonHitBoxFromNormalTier: false },
  'arrow hit tested on parts 22/23': { hitHilite: { low: 22, high: 23 } },
  '22 and 23 swapped': { pageSplit: swapPages },
  'thumb tested before the arrows': { arrowsBeforeThumb: false },
  'page split at the thumb edge, not its centre': { pageSplit: (p, th) => (p < th[0] ? 22 : 23) },
  'pattern phase at the port origin': { patternAnchor: 'port' },
  'pattern drawn over the cicn': { patternOverCicn: true },
  'offscreen only with a pattern': { offscreen: e => e.pattern },
  'ATIr-present rule by default': { offscreen: e => e.pattern && e.picSave },
  'track drawn before the thumb': { drawOrder: ['arrow0', 'arrow3', 'track', 'thumb'] },
  'composite at ≥ 16 instead of > 16': { composite: ([w, h]) => w >= 16 || h >= 16 },
  'composite iff along length ≥ 2t (prior runtime)': { composite: ([w, h]) => Math.max(w, h) >= 2 * Math.min(w, h) },
  'ics4 accepted as colour art': { iconColour: 'ics4-or-ics8' },
  'cells from the track cicn bounds (pre-#396 reading)': { cellsFromDrawnCicn: false },
  'cells clamped to the source bounds': { clampCellsToSource: true },
  'arrows drawn when inactive': { arrowsWhenInactive: true },
  'inactive T inset by the arrow boxes': { inactiveTrackIsR: false },
  'inactive track source inset like the active one': { inactiveWholeSource: false },
};

test('geometry rows equal the spec values under the decode', () => {
  for (const [id, row] of Object.entries(ROWS)) assert.deepEqual(row({}), EXPECTED[id], id);
});

test('spec arithmetic re-derived by hand (worked example, thickness-11 thumb, caps of 3)', () => {
  // §5.7: c = 15, T = [15, 105), trackLen 90, len 17, free 73, 50 · 73 / 100 = 36.5 -> trunc(37.0) = 37.
  assert.equal(Math.trunc((50 * 73) / Math.fround(100) + 0.5), 37);
  // §5.9 caps, s = 16, w = 11: m = 11, a = 5, mid = 5, q1 = 3, q2 = 2.
  assert.deepEqual(rel(slice([0, 16], [0, 11], 0, false), 0), [[[0, 3], [0, 3]], [[3, 9], [6, 12]], [[9, 11], [14, 16]]]);
  assert.deepEqual(rel(slice([0, 16], [0, 11], 1, false), 0), [[[0, 5], [0, 5]], [[5, 11], [10, 16]]]);   // the halves mutation
  // At t = 16 every archive's thumb is copied 1:1 (cicn N × 16, len = N), so the slice mode cannot fail there.
  for (const slug of SLUGS) { const l = at(slug, {}); assert.deepEqual(l.thumbPieces.map(p => !!p.copy), [true], slug); }
  // Corpus: the thickness-11 archives named by the spec take minLen 16 − 5 = 11 from a 16 × 16 thumb and have no small track.
  for (const slug of T11) assert.ok(!census(slug).cicn.has(-10206 + 1956) && !census(slug).cicn.has(-8286 + 18) && census(slug).cicn.get(-10206).join() === '16,16', slug);
});

test('pattern-underlay row is pixel-observable: each mutation changes the colour that reaches the port', () => {
  const l = at('crayon-os', { rect: CRAYON_R });
  // Every pixel of the track source column (-8286 column 15) is mask-clear; the arrow cell is opaque.
  const a = art('crayon-os');
  assert.deepEqual(Array.from({ length: 16 }, (_, y) => a.mask(-8286, 15, y)), Array(16).fill(false));
  assert.ok(Array.from({ length: 15 }, (_, x) => a.mask(-8286, x, 4)).every(Boolean));
  assert.equal(l.pattern, -8286);
  // Rect anchoring (27, 4) vs port anchoring (40, 9): different ppat colours.
  assert.notDeepEqual(ppatRgb('crayon-os', -8286, 27, 4), ppatRgb('crayon-os', -8286, 40, 9));
  // Pattern over the arrow cell: ppat (1, 4) differs from the cell pixel's own colour (dark outline vs light fill).
  const cell = readCicnIndexed(resource('crayon-os', 'cicn', -8286));
  const idx = cell.indices[4 * cell.pmap.width + 1], entry = cell.colorTable.entries.find((e, i) => (cell.colorTable.flags & 0x8000 ? i : e.value) === idx);
  const cellRgb = [entry.r >> 8, entry.g >> 8, entry.b >> 8], patternRgb = ppatRgb('crayon-os', -8286, 1, 4);
  assert.ok(cellRgb.every((v, i) => Math.abs(v - patternRgb[i]) > 128), `cell ${cellRgb} vs ppat ${patternRgb}`);
});

test('mutation table: each wrong reading fails the named rows', () => {
  const table = Object.fromEntries(Object.entries(MUTATIONS).map(([name, reading]) => [name,
    Object.keys(ROWS).filter(id => JSON.stringify(ROWS[id](reading)) !== JSON.stringify(EXPECTED[id])).map(id => id.split(' ')[0])]));
  assert.deepEqual(table, {
    'c = t instead of t − 1': ['G1', 'G2', 'G4', 'G5', 'G6', 'G10', 'G11', 'G12', 'G18'],   // G4: pos 36 though Th stays [52, 69); G7 unchanged at t = 11
    'icon-lane boxes c long (e = 0)': ['G2', 'G11'],
    'cell length h instead of h − 1': ['G3', 'G6', 'G12', 'G17', 'G18'],
    'proportional thumb by default': ['G4', 'G5', 'G6', 'G7', 'G10', 'G11'],         // 1138 Th [36, 85)
    '+0.5 rounding dropped': ['G4', 'G5', 'G6', 'G7', 'G10'],                         // 1138 Th [51, 68)
    'round half to even': ['G4', 'G5', 'G6', 'G7', 'G10'],                            // 36.5 -> 36; 1990 t = 11: 44.5 -> 44
    'segments do not overlap the thumb': ['G5', 'G6'],                                // [15, 52) / [69, 105)
    'cap 3 for the track': ['G6', 'G12', 'G20'],
    'halves for the thumb': ['G7'],
    'no −5 after a small-thumb miss': ['G7'],
    'cap 2': ['G7'],
    'trackId reset after a small-art miss': ['G8'],
    'non-hit box from the pressed tier': ['G9', 'G17', 'G18'],
    'arrow hit tested on parts 22/23': ['G9', 'G17', 'G18'],
    '22 and 23 swapped': ['G10'],
    'thumb tested before the arrows': ['G11'],
    'page split at the thumb edge, not its centre': [],                               // finding, see below
    'pattern phase at the port origin': ['G12'],
    'pattern drawn over the cicn': ['G12'],
    'offscreen only with a pattern': ['G13'],
    'ATIr-present rule by default': ['G13'],
    'track drawn before the thumb': ['G14'],                                          // trace order only (D3)
    'composite at ≥ 16 instead of > 16': ['G2', 'G8', 'G11', 'G15', 'G16'],
    'composite iff along length ≥ 2t (prior runtime)': ['G8', 'G12', 'G15'],
    'ics4 accepted as colour art': ['G16'],
    'cells from the track cicn bounds (pre-#396 reading)': ['G17', 'G18'],           // [46, 61) of a 43-wide cicn; [18, 33) for 1138
    'cells clamped to the source bounds': ['G18'],                                    // [0, 5) instead of [−10, 5)
    'arrows drawn when inactive': ['G19'],                                            // AD4 (#395 review M5)
    'inactive T inset by the arrow boxes': ['G20'],                                   // §5.2 (#395 review M10)
    'inactive track source inset like the active one': ['G20'],                       // §5.5: [15, 28) instead of [0, 43)
  });
  // Every row is failed by at least one mutation.
  const failed = new Set(Object.values(table).flat());
  assert.deepEqual(Object.keys(ROWS).map(id => id.split(' ')[0]).filter(id => !failed.has(id)), []);
});

test('finding: the thumb-centre page split cannot be told from an edge split', () => {
  // HT7 splits pages at the thumb centre; a point outside Th is always below
  // Th.start or at/after Th.end, so any split inside [Th.start, Th.end] gives
  // the same part. No reachable layout separates them (spec §7: a row no
  // mutation can fail is a finding). Exhaustive over 1138 values and points.
  const edge = MUTATIONS['page split at the thumb edge, not its centre'];
  for (let value = 0; value <= 100; value++) {
    const l = at('1138', { value });
    for (let x = -1; x <= 120; x++) assert.equal(hitTest(l, { x, y: 8 }), hitTest(l, { x, y: 8 }, { reading: edge }), `${value}/${x}`);
  }
});

test('declared default: every track segment of every archive draws through the offscreen (ATIr absent)', () => {
  for (const slug of SLUGS) for (const hilite of [0, 20, 129, 254, 255]) {
    const l = at(slug, { hilite });
    for (const s of l.segments) assert.equal(segmentOffscreen({ atiPresent: false, pattern: l.pattern !== null, picSave: false }), true, `${slug} ${hilite} ${s.name}`);
  }
});

// D1–D8 (spec §7 rows needing the runtime's pressedPart option or the engine
// trace). Their expected values are data in scrollbar-geometry-rules.mjs
// (DRIVER_ROWS); here each is pinned to the spec model. The runtime binding is
// scrollbar-driver-binding.test.mjs (Node, engine trace) and
// range-rules.spec.mjs (public pressedPart, source and built).
const MODEL = {
  D1: () => Object.fromEntries(['1138', 'platinum-8'].map(slug => [slug, Object.fromEntries(Object.entries({ up: 20, down: 21, pageUp: 22, pageDown: 23, thumb: 129 })
    .map(([part, hilite]) => [part, expectedSet(selectScrollbar({ hilite, orientation: 'horizontal' }, census(slug)))]))])),
  D2: () => ROWS['G9 AH1–AH3/AC2/AC3 composite arrow-box sources by hilite (1138)']({}),
  D3: () => ROWS['G14 §3 draw order (1138 normal, disabled)']({}),
  D4: () => { const l = at('1138', {}); return { boxes: l.boxes, T: l.T, Th: l.Th, segments: l.segments.map(s => s.rect) }; },
  D5: () => ROWS['G7 §5.9 thumb caps at t = 11 (1990, dolphin-som, evolution)']({})[0],
  D6: () => ROWS['G12 TF7/TF8/AC4 pattern underlay anchored at R (crayon-os, R at 13,5)']({}),
  D7: () => at('1138', {}).segments.map(() => segmentOffscreen({ atiPresent: false, pattern: false, picSave: false })),
  D8: () => ROWS['G10 HT1–HT8 part codes (1138 worked example)']({}),
  D9: () => ROWS['G17 §5.4 (#396) pressed non-hit cell from its own cicn (animals, monkey-paradise)']({}),
  D10: () => ROWS['G18 §5.4 (#396) narrow-source cell (1138, min = max, hilite 20)']({}),
  D11: () => ROWS['G19 AD4 inactive draws no arrows (1138, platinum-8)']({}),
  D12: () => ROWS['G20 §5.2/§5.5 inactive T = R, whole-bounds source (1984)']({}),
};

test('driver rows: DRIVER_ROWS expected values are the spec model values', () => {
  assert.deepEqual(Object.keys(DRIVER_ROWS), Object.keys(MODEL));
  for (const [id, row] of Object.entries(DRIVER_ROWS)) assert.deepEqual(MODEL[id](), row.expected, `${id} ${row.title}`);
  // The shared rows are literally the G rows' expected values.
  assert.deepEqual(DRIVER_ROWS.D2.expected, EXPECTED['G9 AH1–AH3/AC2/AC3 composite arrow-box sources by hilite (1138)']);
  assert.deepEqual(DRIVER_ROWS.D6.expected, EXPECTED['G12 TF7/TF8/AC4 pattern underlay anchored at R (crayon-os, R at 13,5)']);
  assert.deepEqual(DRIVER_ROWS.D8.expected, EXPECTED['G10 HT1–HT8 part codes (1138 worked example)']);
  assert.deepEqual(DRIVER_ROWS.D10.expected, EXPECTED['G18 §5.4 (#396) narrow-source cell (1138, min = max, hilite 20)']);
  assert.deepEqual(DRIVER_ROWS.D11.expected, EXPECTED['G19 AD4 inactive draws no arrows (1138, platinum-8)']);
  assert.deepEqual(DRIVER_ROWS.D12.expected, EXPECTED['G20 §5.2/§5.5 inactive T = R, whole-bounds source (1984)']);
  assert.deepEqual(DRIVER_ROWS.D9.expected, EXPECTED['G17 §5.4 (#396) pressed non-hit cell from its own cicn (animals, monkey-paradise)']);
});
