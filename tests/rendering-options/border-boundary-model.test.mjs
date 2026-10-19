import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderWriter, boundarySizes, boundaryVariants } from './border-boundary-model.mjs';
const opaque = () => 255;
const at = (input, size, x, y, alpha = opaque, clip) => borderWriter(input, { width: size[0], height: size[1], clip }, x, y, alpha);
test('reverse source model retains literal square corners and unequal-band overlap order', () => {
  const a = { width: 9, height: 9, corner: 4, side: 1, tile: false };
  assert.deepEqual(at(a, [53, 40], 2, 2), { region: 0, source: [2, 2], branch: 'copy' });
  assert.deepEqual(at(a, [53, 40], 51, 2), { region: 1, source: [7, 2], branch: 'copy' });
  assert.equal(at(a, [53, 40], 2, 6), null); // body, not a border claim
  const b = { width: 21, height: 21, corner: 7, side: 14, tile: true };
  assert.deepEqual(at(b, [53, 40], 9, 30), { region: 6, source: [9, 9], branch: 'copy' });
  assert.deepEqual(at(b, [53, 40], 45, 30), { region: 7, source: [13, 9], branch: 'copy' });
});
test('short destination overlap preserves original corner origin; later transparent writer exposes earlier corner', () => {
  const a = { width: 9, height: 9, corner: 4, side: 1, tile: true };
  // Height3 is shorter than one corner: BL starts at -1, so source y6
  // survives at output y0. It is not rescaled/clamped to half destination.
  assert.deepEqual(at(a, [24, 3], 2, 0), { region: 3, source: [2, 6], branch: 'copy' });
  assert.deepEqual(at(a, [24, 3], 2, 0, (x, y) => x === 2 && y === 6 ? 0 : 255),
    { region: 0, source: [2, 0], branch: 'copy' });
});
test('masked partial tile tail and clipping retain source phase; width-one sampling wins', () => {
  const a = { width: 11, height: 9, corner: 4, side: 1, tile: true };
  assert.deepEqual(at(a, [25, 12], 20, 0), { region: 2, source: [5, 0], branch: 'copy' }); // 17px middle: final tail is source4,5
  assert.equal(at(a, [25, 12], 20, 0, (x, y) => x === 5 && y === 0 ? 0 : 255), null);
  assert.deepEqual(at(a, [25, 12], 20, 0, opaque, [20, 0, 1, 1]), { region: 2, source: [5, 0], branch: 'copy' });
  assert.equal(at(a, [25, 12], 21, 0, opaque, [20, 0, 1, 1]), null);
  const b = { width: 7, height: 7, corner: 3, side: 1, tile: true };
  assert.deepEqual(at(b, [29, 17], 4, 0), { region: 2, source: [3, 0], branch: 'horizontal-lines' });
  assert.deepEqual(at(b, [29, 17], 0, 4), { region: 6, source: [0, 3], branch: 'vertical-lines' });
});
test('finite thresholds retain public minimum exclusions and all state option tuples', () => {
  assert.equal(boundaryVariants.length, 15);
  const plan = boundarySizes({ width: 7, height: 7, corner: 3, tile: true }, 'push');
  assert.deepEqual(plan.axes[0].map(r => [r.middle, r.reachable]), [[0, false], [1, false], [2, false], [3, false]]);
  assert.deepEqual(plan.sizes, [[24, 6], [24, 7], [24, 8], [24, 9]]);
});

import { admitSolidBody, solidBodyOrInitial } from './border-boundary-model.mjs';
import { solidBackgroundIcon, solidBackgroundInfo, solidBackgroundRows } from '../decoder-fixtures/solid-background.mjs';
import { forkOf } from '../resource-provenance/fixtures.mjs';
import { convertScheme } from '../../tools/theme-loader/convert.js';
const solidInput = () => ({ width: 7, height: 7, request: { mode: 0, resourceId: 0 }, anchor: [3, 3],
  sample: { rgb16: [0x2121, 0x2121, 0x2121], displayRgb: [48, 48, 48] },
  rawPatternOccurrences: [], lookup: 'declared-same-owner-null', sampleModel: 'kdef-2.3.1-color',
  displayPolicy: 'mac-1.8-to-2.2-high-byte', unavailableReason: null });
test('conditional solid union matches existing full literal rows for masked and opaque palette-collision sources', () => {
  for (const collision of [false, true]) {
    const converted = convertScheme(forkOf([{ type: 'cicn', id: -10239, name: 'face', data: solidBackgroundIcon({ opaqueBackground: collision, collision }) },
      { type: 'cinf', id: -10239, data: solidBackgroundInfo() }]));
    const e = converted.theme.chromeElements.face, art = converted.assets.find(a => a.path === e.asset);
    assert.deepEqual(e.colorSamples.background, solidInput().sample);
    const background = admitSolidBody({ ...solidInput(), sample: e.colorSamples.background });
    const model = { width: 7, height: 7, corner: 3, side: 1, tile: false }, destination = { width: 29, height: 9 };
    const rows = Array.from({ length: 9 }, (_, y) => Array.from({ length: 29 }, (_, x) => {
      const writer = borderWriter(model, destination, x, y, (sx, sy) => art.rgba[(sy * 7 + sx) * 4 + 3]);
      const p = writer ? Array.from(art.rgba.slice((writer.source[1] * 7 + writer.source[0]) * 4, (writer.source[1] * 7 + writer.source[0]) * 4 + 4))
        : solidBodyOrInitial(model, destination, x, y, background).rgba;
      return p[3] === 0 ? '.' : p.every((v, i) => v === [48, 48, 48, 255][i]) ? 'G'
        : p.every((v, i) => v === [0, 0, 255, 255][i]) ? 'B' : '?';
    }).join(''));
    assert.deepEqual(rows, solidBackgroundRows);
    // These alpha/RGB values would make a raster-background oracle wrong.
    const raster = Array.from(art.rgba.slice((3 * 7 + 3) * 4, (3 * 7 + 3) * 4 + 4));
    assert.equal(raster[3], collision ? 255 : 0);
    if (collision) assert.deepEqual(raster, [255, 0, 0, 255]);
  }
});
test('solid admission rejects present or ambiguous pattern evidence and malformed raw samples/anchors', () => {
  for (const mutate of [x => { x.rawPatternOccurrences = [9]; }, x => { x.lookup = 'ambiguous'; },
    x => { x.lookup = 'unknown'; }, x => { x.request.mode = 5; }, x => { x.request.resourceId = 65535; },
    x => { x.width = undefined; }, x => { x.sample.rgb16 = new Array(3); }, x => { x.anchor = [7, 3]; }, x => { x.anchor = [-1, 0]; }, x => { x.sample.rgb16 = [65536, 0, 0]; },
    x => { x.sample.displayRgb = [256, 0, 0]; }, x => { x.sampleModel = 'guessed'; },
    x => { x.displayPolicy = 'unbound'; }, x => { x.unavailableReason = 'ambiguous-asset-path'; }]) {
    const input = solidInput(); mutate(input); assert.equal(admitSolidBody(input), null);
  }
  assert.deepEqual(solidBodyOrInitial({ corner: 4, side: 1 }, { width: 8, height: 2 }, 4, 1,
    admitSolidBody(solidInput())), { kind: 'initial', rgba: [0, 0, 0, 0] }); // both union rectangles empty
});
