// Kingfisher's progress / header / disclosure / grow-box part
// (authoring/schemes/kingfisher/parts/progress.mjs): the resources exist, decode,
// pass checkScheme, and the barber-pole steps are a clean cycle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../../authoring/schemes/kingfisher/parts/progress.mjs';
import { C } from '../../authoring/schemes/kingfisher/palette.mjs';
import { checkScheme } from './check-scheme.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { parseResourceFork } from '../theme-loader/resource-fork.js';
import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodeCinf } from '../theme-loader/decoders/cinf.js';
import { decodePpat } from '../theme-loader/decoders/ppat.js';

const resources = [];
build((type, id, data, name) => resources.push({ type, id, data, name }), { C });
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('ships every progress, header, disclosure and grow-box resource', () => {
  const cicn = [-10080, -10079, -10078, -10077, -10076, -10075, -9568, -9567,
    -10112, -10111, -10110, -10109, -10108, -10107, -10104, -10103, -10102, -10101, -10100, -10099,
    -14334, -14333, -14310, -14309];
  const cinf = [-10080, -10079, -10078, -10077, -10076, -10075, -9568, -9567];
  for (const id of cicn) assert.ok(find('cicn', id), `cicn ${id}`);
  for (const id of cinf) assert.ok(find('cinf', id), `cinf ${id}`);
  for (let k = 0; k < 8; k++) for (const base of [-10080, -10072]) assert.ok(find('ppat', base + k), `ppat ${base + k}`);
  const parsed = parseResourceFork(writeResourceFork(resources));
  assert.equal(parsed.length, resources.length);
});

test('decodes, with corpus geometry, and passes checkScheme', () => {
  for (const r of resources) {
    if (r.type === 'cicn') assert.ok(decodeCicn(r.data).width > 0);
    if (r.type === 'cinf') decodeCinf(r.data);
  }
  for (const id of [-10080, -10077]) {
    assert.deepEqual([decodeCicn(find('cicn', id).data).height, decodeCinf(find('cinf', id).data).cornerSize], [14, 3]);
    // Fill and track are as tall as I = 14 − 2·s.
    for (const d of [1, 2]) assert.equal(decodeCicn(find('cicn', id + d).data).height, 8);
  }
  const { errors, warnings } = checkScheme(resources);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('indeterminate steps are equal-size, distinct, and each is a 2px roll of the first', () => {
  for (const base of [-10080, -10072]) {
    const steps = Array.from({ length: 8 }, (_, k) => decodePpat(find('ppat', base + k).data));
    const px = (p) => p.rgba ?? p.pixels ?? p.data;
    for (const s of steps) assert.deepEqual([s.width, s.height], [16, 16]);
    const at = (p, x, y) => Array.from(px(p).slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 3)).join();
    steps.forEach((s, k) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) assert.equal(at(s, x, y), at(steps[0], (x - 2 * k + 32) % 16, y));
    });
    assert.notEqual(at(steps[1], 0, 0) + at(steps[1], 1, 0), at(steps[0], 0, 0) + at(steps[0], 1, 0));
  }
});

test('stays small', () => {
  const bytes = resources.reduce((n, r) => n + r.data.length, 0);
  assert.ok(bytes < 24_000, `${bytes} bytes`);
});
