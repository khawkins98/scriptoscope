// Engine-trace binding of the slider rule rows (docs/spec/engine/slider.md §7: "geometry rows need the engine
// trace"). slider-rules.mjs stays spec-only and never imports src/; this file is the consumer-side binding: it
// drives the public engine API (src/engine/index.ts: ResourceChain, sliderInit, drawSlider, sliderPartAt,
// sliderValueFromGhost) with each archive's own resources, and compares the trace and the drawn port with
// DRIVER_ROWS (the spec's literal values) and with the model's sourceMap.
//
// Inputs: every slider cicn (-10144..-10111) of the archive's own fork, as a source-map pixmap (pixel (x, y) =
// rgb(x, y, tag), alpha = the cicn's own mask, its own bounds), and every slider cinf's raw bytes. A source-map
// pixmap makes every drawn pixel name the source pixel that reached it, so the port compares with sourceMap()
// exactly; colour decoding (BL8/BL12) is the browser binding's job (slider-bl12.spec.mjs).
import '../helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { parseResourceMap } from './checkable-rules.mjs';
import { DRIVER_ROWS, inSliderRange, layout, nativeFor, rect, sliderCensus, sourceMap } from './slider-rules.mjs';

const { ResourceChain, mapProvider, createTrace, sliderInit, drawSlider, sliderPartAt, sliderValueFromGhost } = await import('../../src/engine/index.ts');

const forks = new Map();
async function fork(slug) {
  if (forks.has(slug)) return forks.get(slug);
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const raw = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(raw), census = sliderCensus(map), entries = [], tags = new Map(), masks = new Map();
  let tag = 0;
  for (const r of map.filter(r => inSliderRange(r.id))) {
    if (r.type === 'cinf') entries.push([`cinf:${r.id}`, { bytes: Array.from(r.data) }]);
    if (r.type !== 'cicn') continue;
    const c = readCicnIndexed(r.data), w = c.pmap.width, h = c.pmap.height, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x, y, tag, c.maskAlpha[y * w + x] ? 255 : 0], (y * w + x) * 4);
    tags.set(tag++, r.id); masks.set(r.id, { w, a: c.maskAlpha });
    const bounds = census.cicn.get(r.id);   // BL11: the cicn's own bounds origin (0, 0 for every corpus cicn)
    entries.push([`cicn:${r.id}`, { pixmap: { width: w, height: h, data }, pixelSize: 8, unmasked: null, origin: { top: bounds.top, left: bounds.left } }]);
  }
  const f = { census, entries, tags, mask: (id, x, y) => masks.get(id).a[y * masks.get(id).w + x] !== 0 };
  forks.set(slug, f);
  return f;
}
const BG = { r: 250, g: 251, b: 252, a: 255 };   // never a source-map pixel (x, y < 250 in every slider cicn)
/** One facade-style compose (ID10: a fresh record, message 3 with the tick count, then the draw). */
async function run(slug, native, { message, ghost, edit = e => e } = {}) {
  const f = await fork(slug), chain = new ResourceChain([mapProvider(slug, 'archive', edit(f.entries.map(([k, v]) => [k, v]))) ]), trace = createTrace('slider');
  const { initialValue = 0, ...input } = native;
  const init = sliderInit(chain, { ...input, value: input.min ?? 0 }, initialValue, trace);
  if (!init) return { handedOff: true, trace };
  const port = { width: input.rect.right, height: input.rect.bottom, data: new Uint8ClampedArray(input.rect.right * input.rect.bottom * 4) };
  const { state } = drawSlider(port, chain, init.record, { min: 0, max: 100, ...input }, { background: BG, ...(message !== undefined ? { message } : {}), ...(ghost ? { ghost } : {}) }, trace);
  // The port as a source map (sourceMap() conventions): null = the background, else { id, x, y }.
  const R = input.rect, map = [];
  for (let y = R.top; y < R.bottom; y++) {
    const line = [];
    for (let x = R.left; x < R.right; x++) {
      const i = (y * port.width + x) * 4, d = port.data;
      line.push(d[i] === BG.r && d[i + 1] === BG.g && d[i + 2] === BG.b && d[i + 3] === 255 ? null : d[i + 3] === 255 ? { id: f.tags.get(d[i + 2]), x: d[i], y: d[i + 1] } : { id: 'translucent' });
    }
    map.push(line);
  }
  return { state, trace, map, f };
}
const along = (r, h) => (h ? [r.left, r.right] : [r.top, r.bottom]);
const kind = { cap: 'copy', halves: 'copy', tile: 'tile', tileLines: 'lines' };
const trackOps = trace => trace.drawOps.filter(o => o.op in kind && o.src);
const piecesOf = (trace, h) => trackOps(trace).map(o => [kind[o.op], along(o.dst, h), along(o.src, h)]);

// Worked examples (§5.9), as slider-rules.test.mjs.
const A = { rect: rect(0, 0, 32, 120), hilite: 0, variation: 2, initialValue: 5, min: 0, max: 100, value: 50 };
const Bx = { rect: rect(0, 0, 100, 32), hilite: 0, variation: 2, initialValue: 3, min: 0, max: 100, value: 25 };
const C = { rect: rect(0, 0, 16, 100), hilite: 0, variation: 8, min: 0, max: 100, value: 50 };
const D = { rect: rect(0, 0, 14, 15), hilite: 0, variation: 0, min: 0, max: 100, value: 50 };
const Dv = { ...D, rect: rect(0, 0, 15, 14) };

test('D1 §5.2 Th of examples A, B, C (engine trace rects.Th)', async () => {
  const got = [];
  for (const [slug, n] of [['1138', A], ['1990', Bx], ['windows-95', C]]) got.push((await run(slug, n)).trace.rects.Th);
  assert.deepEqual(got, DRIVER_ROWS.D1.expected);
});

test('D2 SL3/SL5/SL6 example A: caps and the start-anchored 1:1 tiling of the middle', async () => {
  const { trace, map } = await run('1138', A);
  const ops = piecesOf(trace, true);
  const [cap1, cap2, ...tiles] = DRIVER_ROWS.D2.expected;
  assert.deepEqual(ops.slice(0, 2), [cap1, cap2]);
  // The engine traces the middle as one tiler call (BL6/BL7); its tiles must be the spec's pieces.
  assert.deepEqual(trackOps(trace).slice(2).map(o => [o.op, along(o.dst, true), along(o.src, true), o.anchor]), [['tile', [5, 115], [5, 44], 'start']]);
  for (const [, [d0, d1], [s0]] of tiles) for (let x = d0; x < d1; x++) {
    const p = map[8][x];
    if (p && p.id === -10143) assert.equal(p.x, s0 + x - d0, `tile column ${x}`);   // track pixels (the thumb covers [52, 67))
  }
});

test('D3 SL1/SL4/BL4 example C: caps and one-column lines (windows-95)', async () => {
  const { trace } = await run('windows-95', C);
  assert.deepEqual(trackOps(trace).map(o => [kind[o.op], [o.dst.top, o.dst.left, o.dst.bottom, o.dst.right], [o.src.top, o.src.left, o.src.bottom, o.src.right]]), DRIVER_ROWS.D3.expected);
});

test('D4 SL2 example D halves, horizontal (0, 0, 14, 15) and vertical (0, 0, 15, 14): trace source rects', async () => {
  const h = await run('1984', D), v = await run('1984', Dv);
  assert.equal(h.state.record.horizontal, true); assert.equal(v.state.record.horizontal, false);
  assert.deepEqual([piecesOf(h.trace, true), piecesOf(v.trace, false)], DRIVER_ROWS.D4.expected);
  assert.deepEqual(trackOps(h.trace).map(o => o.op), ['halves', 'halves']);
  // Full source cross: rows (columns) [0, 16) of the 49 × 16 (16 × 49) track; B reaches 2 rows past R.
  assert.deepEqual(trackOps(h.trace).map(o => [o.src.top, o.src.bottom]), [[0, 16], [0, 16]]);
  assert.deepEqual(trackOps(v.trace).map(o => [o.src.left, o.src.right]), [[0, 16], [0, 16]]);
});

test('D5 §5.1 F1 group-2 band centre of rows (−10, 5)', async () => {
  // R with a negative top is not a drawable port here; the band is the state message 0 computes (trace rects.B).
  const { trace } = await run('1138', { rect: rect(-10, 0, 5, 120), hilite: 0, variation: 8, min: 0, max: 100, value: 50 });
  const B = trace.rects.B;
  assert.deepEqual([B.top, B.bottom], DRIVER_ROWS.D5.expected);
});

test('D6/D7/D8 TK5/§5.4 tick rects (examples A, B) and v_i rounding (range 0..10, n = 4)', async () => {
  const ticks = t => t.drawOps.filter(o => o.op === 'tick').map(o => o.dst);
  const a = ticks((await run('1138', A)).trace), b = ticks((await run('1990', Bx)).trace);
  assert.deepEqual(a.map((d, i) => [DRIVER_ROWS.D6.expected[i][0], d.left, d.top, d.right, d.bottom]), DRIVER_ROWS.D6.expected);
  assert.deepEqual(b.map((d, i) => [DRIVER_ROWS.D7.expected[i][0], d.top, d.left, d.bottom, d.right]), DRIVER_ROWS.D7.expected);
  const f = await fork('1138'), n8 = { ...A, max: 10, value: 5, initialValue: 4 };
  const model = layout(n8, f.census);
  assert.deepEqual(model.ticks.map(t => t.v), DRIVER_ROWS.D8.expected);
  assert.deepEqual(ticks((await run('1138', n8)).trace), model.ticks.map(t => t.dst));
});

test('D9 §3.3 draw order (example A; message 13 with a ghost)', async () => {
  const order = t => [...new Set(t.drawOps.map(o => (o.op in kind ? 'track' : o.op === 'tick' ? 'ticks' : o.op)).filter(o => ['erase', 'track', 'ghost', 'thumb', 'ticks', 'composite'].includes(o)))];
  const plain = await run('1138', A), ghost = await run('1138', A, { message: 13, ghost: rect(0, 30, 16, 45) });
  assert.deepEqual([order(plain.trace), order(ghost.trace)], DRIVER_ROWS.D9.expected);
});

test('D10 HT1–HT4 example A hit points and a tick-band point', async () => {
  const { state } = await run('1138', A);
  assert.deepEqual([[30, 8], [60, 8], [100, 8], [60, 20], [57, 18]].map(([x, y]) => sliderPartAt(state, { x, y }).part), DRIVER_ROWS.D10.expected);
});

test('D11 §5.6 value from the ghost rect (example A)', async () => {
  const { state, trace } = await run('1138', A);
  const Th = trace.rects.Th;
  assert.deepEqual([Th.left, sliderValueFromGhost(state, { ...Th }), sliderValueFromGhost(state, { ...Th, left: 53, right: 68 })], DRIVER_ROWS.D11.expected);
});

test('D12 pressedPart pageUp/pageDown (22/23): pressed track, normal thumb cell (1138)', async () => {
  const got = {};
  for (const row of [['horizontal', 'pageUp'], ['horizontal', 'pageDown'], ['vertical', 'pageUp'], ['vertical', 'pageDown']]) {
    const native = nativeFor({ orientation: row[0], state: 'pressed', pressedPart: row[1] }), h = row[0] === 'horizontal';
    const { trace } = await run('1138', native);
    const track = trace.drawOps.find(o => o.op === 'track' && o.id !== undefined && o.src).id;
    const thumb = trace.drawOps.find(o => o.op === 'thumb' && o.src);
    got[`${row[0][0]}/${row[1]}`] = [track, Math.floor((h ? thumb.src.top : thumb.src.left) / 16)];
  }
  assert.deepEqual(got, DRIVER_ROWS.D12.expected);
});

test('examples A–D and the public rows: the drawn port equals the model sourceMap pixel for pixel', async () => {
  const cases = [['1138', A], ['1990', Bx], ['windows-95', C], ['1984', D], ['1984', Dv], ['1138', { ...A, message: 13, ghost: rect(0, 30, 16, 45) }]];
  for (const slug of ['1138', '1984', 'apple-lisa', 'windows-31']) for (const orientation of ['horizontal', 'vertical'])
    for (const state of ['normal', 'pressed', 'disabled']) cases.push([slug, nativeFor({ orientation, state })]);
  for (const [slug, n] of cases) {
    const f = await fork(slug), { message, ghost, ...native } = n;
    const l = layout(n, f.census), want = sourceMap(l, f.mask);
    const { map } = await run(slug, native, { message, ghost });
    assert.deepEqual(map, want, `${slug} ${JSON.stringify(n.rect)} hilite ${n.hilite} message ${message ?? 0}`);
  }
});

// BL11 (declared engine domain): a cicn whose bounds origin is not (0, 0) is outside the origin-0 domain and must be
// traced, never silently drawn as if the origin were 0. Every corpus cicn has origin (0, 0): no origin trace.
test('BL11: a non-zero cicn bounds origin is traced (thumb, tick); corpus origins (0, 0) are not', async () => {
  const origins = t => t.drawOps.filter(o => o.op === 'origin').map(o => [o.id, o.origin.top, o.origin.left, o.row.split(',').includes('BL11'), !!o.unspecified]);
  assert.deepEqual(origins((await run('1138', A)).trace), []);
  const shift = (id, origin) => e => e.map(([k, v]) => (k === `cicn:${id}` ? [k, { ...v, origin }] : [k, v]));
  assert.deepEqual(origins((await run('1138', A, { edit: shift(-10141, { top: 0, left: 2 }) })).trace), [[-10141, 0, 2, true, true]]);
  assert.deepEqual(origins((await run('1138', A, { edit: shift(-10139, { top: 3, left: 0 }) })).trace), [[-10139, 3, 0, true, true]]);
});

// CF1-CF3 (§4.11): a found cinf counts as found whatever its length (CF1); a read past its data is undefined and the
// engine's declared policy traces it unspecified, treating the corner as not found (ID8) or the track candidate as
// failed (TR4) (CF3).
test('CF1/CF3: a zero-length cinf at base passes the gate; short corner and track cinfs are traced and fall through', async () => {
  const replace = (id, bytes) => e => e.map(([k, v]) => (k === `cinf:${id}` ? [k, { bytes }] : [k, v]));
  const drop = ids => e => e.filter(([k]) => !ids.includes(k));
  // Only a zero-length cinf at base -10144 remains among the gate ids (group 0 needs base; bit 2/3 clear).
  const gateOnly = e => replace(-10144, [])(drop(['cinf:-10138', 'cinf:-10132'])(e));
  const zero = await run('1138', { ...A, variation: 0, initialValue: 0 }, { edit: gateOnly });
  assert.equal(zero.handedOff, undefined, 'CF1: a zero-length cinf still passes the gate (Kaleidoscope handles the message)');
  assert.ok(zero.trace.drawOps.some(o => o.op === 'state' && o.row.split(',').includes('CF3') && o.row.split(',').includes('ID8') && o.unspecified), 'CF3: short corner read traced, corner not found');
  // Group 2 (candidates -10131, -10131, -10143, -10143): a 2-byte cinf at -10131 (byte 2 missing) fails that
  // candidate, and base + 1 = -10143 is drawn, as the rule table selects with -10131's cinf absent.
  const G2 = { rect: rect(0, 0, 16, 120), hilite: 0, variation: 8, min: 0, max: 100, value: 50 };
  const short = await run('1138', G2, { edit: replace(-10131, [5, 16]) });
  const t = short.trace.drawOps.filter(o => o.op === 'track');
  assert.ok(t.some(o => o.id === -10131 && o.row.split(',').includes('CF3') && o.row.split(',').includes('TR4') && o.unspecified), 'CF3: short track cinf traced as a failed candidate');
  const c = (await fork('1138')).census;
  const model = layout(G2, { cinf: new Map([...c.cinf].filter(([id]) => id !== -10131)), cicn: c.cicn }).sel.track;
  assert.deepEqual([t.find(o => o.src).id, model], [-10143, -10143], 'the next TR3 candidate is drawn');
});

// §7 TR3/TR4: "a synthetic fork with a pressed cicn but no pressed cinf also falls back". 1138 with cinf -10142 (the
// group-0 pressed track's cinf) removed and its cicn kept: a thumb press (hilite 129, trackTier 2) tries gb + 2 =
// -10142, finds the cicn without its cinf (TR4, traced), and draws gb + 1 = -10143, as the rule table selects.
test('TR3/TR4: a pressed track cicn without its cinf falls back to gb + 1 (1138 group 0, hilite 129)', async () => {
  const native = { ...A, hilite: 129 };
  const { trace } = await run('1138', native, { edit: e => e.filter(([k]) => k !== 'cinf:-10142') });
  const t = trace.drawOps.filter(o => o.op === 'track');
  assert.ok(t.some(o => o.id === -10142 && o.row === 'TR4' && /without a cinf/.test(o.reason)), 'TR4: the cinf-less pressed candidate is traced and skipped');
  const c = (await fork('1138')).census;
  assert.deepEqual(c.cicn.has(-10142) && c.cinf.has(-10142), true, 'the unedited fork ships both, so the edit is what removes the cinf');
  const model = layout(native, { cinf: new Map([...c.cinf].filter(([id]) => id !== -10142)), cicn: c.cicn }).sel.track;
  assert.deepEqual([t.find(o => o.src).id, model], [-10143, -10143]);
  // Unedited, the same press draws the pressed track itself.
  assert.equal((await run('1138', native)).trace.drawOps.find(o => o.op === 'track' && o.src).id, -10142);
});
