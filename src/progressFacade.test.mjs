// composeProgress / composeProgressFrame facade and the ProgressIdle helper
// (DECISIONS #10, #11; docs/spec/engine/progress.md DET3, IND2/IND3, IDLE2,
// COL4). Images are decoded by a stubbed Image/canvas pair keyed by URL.
import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { composeProgress, composeProgressFrame } = await import('./controls.ts');
const { ProgressIdle } = await import('./interactive.ts');
const { realizeRgb16 } = await import('../tools/theme-loader/display-profile.js');

const images = new Map();
globalThis.Image = class { src = ''; get naturalWidth() { return images.get(this.src).width; } get naturalHeight() { return images.get(this.src).height; } async decode() {} };
globalThis.document = { createElement: () => { let drawn; return { getContext: () => ({ drawImage(img) { drawn = images.get(img.src); }, getImageData: () => ({ data: new Uint8ClampedArray(drawn.data) }) }) }; } };

let seq = 0;
const solid = (w, h, rgba) => { const data = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) data.set(rgba, i * 4); return { width: w, height: h, data }; };
/** A theme whose chain answers the given cicns, cinf bytes and ppats. */
function theme({ cicns = {}, cinfs = {}, ppats = {} } = {}) {
  const baseUrl = `/t${seq++}`, chromeElements = {}, patterns = {};
  for (const [id, pm] of Object.entries(cicns)) { images.set(`${baseUrl}/c${id}.png`, pm); chromeElements[`c${id}`] = { asset: `c${id}.png`, sourceCicnId: Number(id), samplingEquivalence: { status: 'equivalent' } }; }
  for (const [id, pm] of Object.entries(ppats)) { images.set(`${baseUrl}/p${id}.png`, pm); patterns[`p${id}`] = { asset: `p${id}.png`, sourcePpatId: Number(id) }; }
  return { baseUrl, manifest: { name: 'synthetic', chromeElements, patterns, engineCinfs: cinfs, windowTypes: {} } };
}
const px = (b, x, y) => Array.from(b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 4));
const split = frame => frame.trace.drawOps.find(o => o.op === 'split');
const conv = rgb => [...realizeRgb16(rgb), 255];
const DARK = conv([0x4445, 0x4444, 0x4444]), LAVENDER = conv([0xCCCC, 0xCCCC, 0xFFFF]);

test('range drives the split (DET1): procedural bar at 25 of 0..100 splits at 26; the facade honours range, not the default', async () => {
  const f = await composeProgressFrame(theme(), { length: 100, range: { value: 25, min: 0, max: 100 }, trace: true });
  assert.equal(f.path, 'procedural');
  assert.equal(split(f).x, 26, 'mutation "ignore range" splits at the 0.5 default (50)');
  assert.deepEqual(px(f.buffer, 25, 6), DARK);
  assert.deepEqual(px(f.buffer, 26, 6), LAVENDER);
});

test('range is unclamped (DET3): past max the fill runs past I_f and the overflow is traced; below min the split is left of I_f', async () => {
  const over = await composeProgressFrame(theme(), { length: 100, range: { value: 150, min: 0, max: 100 }, trace: true });
  assert.equal(split(over).x, 2 + Math.trunc((96 * 150) / 100));
  assert.ok(split(over).row.includes('DET3') && /past max/.test(split(over).overflow));
  assert.deepEqual(px(over.buffer, 97, 6), DARK, 'no lavender: the fill covers the whole interior');
  const under = await composeProgressFrame(theme(), { length: 100, range: { value: -10, min: 0, max: 100 }, trace: true });
  assert.equal(split(under).x, -7);
  assert.ok(/below min/.test(split(under).overflow));
  assert.deepEqual(px(under.buffer, 2, 6), LAVENDER);
});

test('COL4: the fixed COL3 colours go through the display policy (not the raw high byte)', async () => {
  const b = await composeProgress(theme(), { length: 100, range: { value: 50, min: 0, max: 100 } });
  assert.notDeepEqual(LAVENDER, [0xcc, 0xcc, 0xff, 255], 'the policy changes the colour, so the check can fail');
  assert.deepEqual(px(b, 80, 6), LAVENDER, 'mutation "skip the display conversion" gives (204, 204, 255)');
  assert.deepEqual(px(b, 10, 6), DARK);
});

test('DECISIONS #10: value and range together throw TypeError', async () => {
  await assert.rejects(composeProgressFrame(theme(), { value: 0.5, range: { value: 1, min: 0, max: 2 } }), TypeError);
  await assert.doesNotReject(composeProgressFrame(theme(), { value: 0.5 }));
});

test('RangeError guards: range values must be 16-bit integers; phase must be an integer 0..255', async () => {
  for (const range of [{ value: 1.5, min: 0, max: 2 }, { value: 0, min: -40000, max: 2 }, { value: 0, min: 0, max: 32768 }, { value: Number.NaN, min: 0, max: 2 }]) {
    await assert.rejects(composeProgressFrame(theme(), { range }), RangeError, JSON.stringify(range));
  }
  for (const phase of [-1, 256, 1.5]) await assert.rejects(composeProgressFrame(theme(), { indeterminate: true, phase }), RangeError, String(phase));
  await assert.doesNotReject(composeProgressFrame(theme(), { range: { value: 32767, min: -32768, max: 32767 } }));
});

/** 1138-like frame mode: frame art and four pattern frames −10080..−10077. */
const frameModeTheme = () => theme({
  cicns: { [-10080]: solid(5, 14, [9, 9, 9, 255]) }, cinfs: { [-10080]: [2, 2, 0, 0, ...new Array(14).fill(0)] },
  ppats: Object.fromEntries([0, 1, 2, 3].map(i => [-10080 + i, solid(8, 8, [40 + i, 0, 0, 255])])),
});

test('composeProgressFrame reports the phase after the draw: frame mode keeps 2, resets 4 (no ppat −10076) and 9 to 0', async () => {
  const t = frameModeTheme();
  const at = async phase => composeProgressFrame(t, { length: 60, indeterminate: true, phase });
  const two = await at(2);
  assert.equal(two.path, 'kaleidoscope');
  assert.equal(two.phase, 2);
  assert.equal(px(two.buffer, 4, 4)[0], 42);
  for (const phase of [4, 9]) {
    const f = await at(phase);
    assert.equal(f.phase, 0, `phase ${phase}`);
    assert.equal(px(f.buffer, 4, 4)[0], 40);
  }
});

test('ProgressIdle advances one phase every 3 ticks (IDLE2), only when indeterminate, and keeps the phase a draw reports', async () => {
  const idle = new ProgressIdle({ indeterminate: true });
  const seen = [0, 1, 2, 3, 4, 5, 6, 7, 9].map(t => [t, idle.idle(t), idle.phase]);
  assert.deepEqual(seen, [[0, false, 0], [1, false, 0], [2, false, 0], [3, true, 1], [4, false, 1], [5, false, 1], [6, true, 2], [7, false, 2], [9, true, 3]]);
  const det = new ProgressIdle();
  assert.equal(det.idle(1000), false);
  assert.equal(det.phase, 0);
  det.indeterminate = true;
  assert.equal(det.idle(1000), true);
  const reset = new ProgressIdle({ indeterminate: true, phase: 4 });
  await reset.compose(frameModeTheme(), { length: 60 });
  assert.equal(reset.phase, 0, 'frame mode reset written back');
});

test('ProgressIdle phase validation applies before any draw, including determinate instances', () => {
  for (const phase of [-1, 256, 0.5, NaN, Infinity, -Infinity]) {
    for (const indeterminate of [false, true]) assert.throws(() => new ProgressIdle({ phase, indeterminate }), RangeError, `${phase}/${indeterminate}`);
  }
  for (const phase of [0, 1, 255]) {
    const idle = new ProgressIdle({ phase, indeterminate: true });
    idle.indeterminate = false;
    assert.equal(idle.phase, phase, 'IDLE4 changes only flag');
    assert.equal(idle.idle(3), false);
    idle.indeterminate = true;
    assert.equal(idle.idle(3), true);
    assert.equal(idle.phase, (phase + 1) % 256);
  }
});
