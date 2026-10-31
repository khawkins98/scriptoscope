// Kingfisher's control family (authoring/schemes/kingfisher/parts/controls.mjs):
// sliders, tabs + panes, bevel buttons and popup buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../../authoring/schemes/kingfisher/parts/controls.mjs';
import { C } from '../../authoring/schemes/kingfisher/palette.mjs';
import { readCicnIndexed } from '../theme-loader/decoders/cicn.js';
import { decodeCinf } from '../theme-loader/decoders/cinf.js';
import { checkScheme } from './check-scheme.js';

const resources = [];
build((type, id, data, name) => resources.push({ type, id, data, name }), { C });
const has = (type, id) => resources.some((r) => r.type === type && r.id === id);
const cicn = (id) => readCicnIndexed(resources.find((r) => r.type === 'cicn' && r.id === id).data);

test('controls: the ids the runtime asks for exist, with same-id cinfs where required', () => {
  // Slider gate + tracks + thumbs (engine/slider.md G1, TR3, TH1), both orientations, all groups.
  for (const base of [-10144, -10128]) for (const g of [0, 1, 2]) {
    for (const t of [0, 1, 2]) assert.ok(has('cicn', base + 6 * g + t) && has('cinf', base + 6 * g + t), `track ${base + 6 * g + t}`);
    assert.ok(has('cicn', base + 6 * g + 3), `thumb ${base + 6 * g + 3}`);
  }
  // Tabs (engine/tab.md V1/V2, V3 needs the cinf), small and large, every state.
  for (let id = -9984; id <= -9971; id++) {
    if (id === -9978 || id === -9977) continue; // LSF panes, checked below
    assert.ok(has('cicn', id) && has('cinf', id), `tab ${id}`);
  }
  for (const id of [-9978, -9977, -9970, -9969]) assert.ok(has('cicn', id) && has('cinf', id), `pane ${id}`);
  // Bevel buttons (controls.ts composeBevelButton): small, normal, large.
  for (const base of [10171, 10162, 10153]) for (let o = 0; o < 6; o++) assert.ok(has('cicn', -(base + o)) && has('cinf', -(base + o)));
  for (let id = -8208; id <= -8194; id++) assert.ok(has('cicn', id), `popup ${id}`);
});

test('controls: every cicn decodes, thumb strips are 4 cells of 16, cinf samples lie inside', () => {
  for (const r of resources.filter((r) => r.type === 'cicn')) assert.ok(readCicnIndexed(r.data), `cicn ${r.id}`);
  assert.deepEqual([cicn(-10129).pmap.bounds.right, cicn(-10129).pmap.bounds.bottom], [15, 64]);
  assert.deepEqual([cicn(-10113).pmap.bounds.right, cicn(-10113).pmap.bounds.bottom], [64, 15]);
  for (const r of resources.filter((r) => r.type === 'cinf')) {
    const c = decodeCinf(r.data), img = cicn(r.id), w = img.pmap.bounds.right, h = img.pmap.bounds.bottom;
    for (const p of [c.bgPixel, c.textPixel]) assert.ok(p.x < w && p.y < h, `cinf ${r.id} sample inside`);
    assert.ok(2 * c.cornerSize < Math.max(w, h), `cinf ${r.id} corner fits`); // vertical tracks run along y
  }
});

test('controls: pass checkScheme with no errors', () => {
  const { errors } = checkScheme(resources);
  assert.deepEqual(errors, []);
});
