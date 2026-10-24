// Independent driver obligations, frozen before candidate runtime inspection.
// Full literal row oracle in tab-engine-rules.mjs; CDEF8 verified hash4c9fecff….
import '../helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAB_ENGINE_INPUT, TAB_ENGINE_PALETTE as colors, TAB_ENGINE_PATTERN, TAB_ENGINE_PATTERN_ROWS, TAB_ENGINE_OFFSET_PATTERN_ROWS, TAB_ENGINE_SOLID_ROWS } from './tab-engine-rules.mjs';
const E = await import('../../src/engine/index.ts');
const pixmap = rows => ({ width: rows[0].length, height: rows.length, data: Uint8ClampedArray.from(rows.flatMap(r => [...r].flatMap(k => k === '.' ? [0, 0, 0, 0] : colors[k]))) });
function readRows(port, left = 0, top = 0, width = 8, height = 5) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const p = port.data.subarray(((top + y) * port.width + left + x) * 4, ((top + y) * port.width + left + x) * 4 + 4);
    return !p[3] ? '.' : Object.keys(colors).find(k => colors[k].every((v, j) => v === p[j])) ?? '?';
  }).join(''));
}
const metadata = mode => ({ corner: 1, side: 1, tile: true, mode, patternId: 17 });
const empty = (width = 8, height = 5) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
const rgba = key => { const [r, g, b, a] = colors[key]; return { r, g, b, a }; };

test('P4 driver anchors to incoming outer D with nonzero coordinates and independent returned bottom', () => {
  for (const mode of [0, 1, 2, 3, 4, 5]) {
    const port = empty(13, 13), result = E.drawTab(port, { source: pixmap(TAB_ENGINE_INPUT), destination: E.rect(3, 2, 11, 10), metadata: metadata(mode), samplingEquivalent: true, backgroundRGB: rgba('Z'), pattern: pixmap(TAB_ENGINE_PATTERN) });
    assert.equal(result.bottom, 8, 'B6 returns top+source height, not incoming11');
    assert.deepEqual(readRows(port, 2, 3), TAB_ENGINE_OFFSET_PATTERN_ROWS[mode], `P4 mode${mode}: outer/incoming/sign mutation must fail`);
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (x < 2 || x >= 10 || y < 3 || y >= 8) assert.equal(port.data[(y * 13 + x) * 4 + 3], 0);
  }
});

test('P1/P2 missing pattern erases and empty center needs neither pattern nor background', () => {
  for (const patternId of [0, 17]) {
    const port = empty();
    E.drawTab(port, { source: pixmap(TAB_ENGINE_INPUT), destination: E.rect(0, 0, 5, 8), metadata: { ...metadata(0), patternId }, samplingEquivalent: true, backgroundRGB: rgba('Z') });
    assert.deepEqual(readRows(port), TAB_ENGINE_SOLID_ROWS, `P${patternId ? 2 : 1}`);
  }
  const port = empty();
  const result = E.drawTab(port, { source: pixmap(TAB_ENGINE_INPUT), destination: E.rect(0, 0, 5, 8), metadata: { ...metadata(0), side: 3 }, samplingEquivalent: true });
  assert.equal(result.drawn, true); assert.equal(result.center, 'empty');
});

test('C1 sampler proof is mandatory only for expanded one-column bands', () => {
  for (const samplingEquivalent of [false, undefined]) {
    const port = empty(), result = E.drawTab(port, { source: pixmap(TAB_ENGINE_INPUT), destination: E.rect(0, 0, 5, 8), metadata: { ...metadata(0), tile: false, patternId: 0 }, samplingEquivalent, backgroundRGB: rgba('Z') });
    assert.equal(result.drawn, false); assert.ok(result.unsupported || result.reason);
    assert.ok(port.data.every(v => v === 0), 'reject before any cap writes');
  }
  const port = empty();
  E.drawTab(port, { source: pixmap(TAB_ENGINE_INPUT), destination: E.rect(0, 0, 5, 8), metadata: metadata(0), pattern: pixmap(TAB_ENGINE_PATTERN) });
  assert.deepEqual(readRows(port), TAB_ENGINE_PATTERN_ROWS[0], 'ordinary width5 copies do not need sampled proof');
});

test('native colour outputs retain emboss even when equal to background; facade policy stays separate', () => {
  const port = empty(), color = rgba('Z');
  const result = E.drawTab(port, { source: pixmap(TAB_ENGINE_INPUT), destination: E.rect(0, 0, 5, 8), metadata: { ...metadata(0), patternId: 0 }, samplingEquivalent: true, backgroundRGB: color, textRGB: color, embossRGB: color });
  assert.deepEqual(result.textRGB, color); assert.deepEqual(result.embossRGB, color, 'no generic background-equality suppression');
});
