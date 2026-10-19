import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderWriter, boundarySizes, tinyBoundarySizes, boundaryVariants, omittedDimensions } from './border-boundary-model.mjs';
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

import { admitPatternBody, patternBodyOrInitial } from './border-boundary-model.mjs';
import { headerPatternBytes, headerPatternFace, headerPatternInfo, headerPatternRows, headerPatternColors } from '../decoder-fixtures/header-pattern.mjs';
const patternContext = () => ({ controlOrigin: [-5, 7], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [1, -2] },
  clip: { kind: 'rect', rect: { x: -5, y: 7, w: 11, h: 9 } } });
const literalTile = () => new Uint8Array('ABCDEFGH'.split('').flatMap(c => headerPatternColors[c]));
test('control pattern phase reuses five literal original-Rect rows; clipping never restarts phase or extends bottom', () => {
  const converted = convertScheme(forkOf([{ type: 'cicn', id: -9567, data: headerPatternFace() },
    { type: 'cinf', id: -9567, data: headerPatternInfo() }, { type: 'ppat', id: 0, name: 'asymmetric', data: headerPatternBytes() }]));
  const e = Object.values(converted.theme.chromeElements)[0], art = converted.assets.find(a => a.path === e.asset);
  const tile = converted.assets.find(a => a.path === converted.theme.patterns.asymmetric.asset);
  assert.deepEqual(tile.rgba, literalTile());
  const model = { width: 7, height: 7, corner: 2, side: 3, tile: true };
  for (const mode of [0, 1, 2, 3, 4]) for (const clipped of [false, true]) {
    const context = patternContext();
    if (clipped) context.clip.rect = { x: -3, y: 9, w: 7, h: 5 };
    const admitted = admitPatternBody({ mode, context, width: 11, height: 9, tileWidth: 4, tileHeight: 2, rgba: tile.rgba });
    assert.ok(admitted);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) {
      const writer = borderWriter(model, { width: 11, height: 9, ...(clipped ? { clip: [2, 2, 7, 5] } : {}) }, x, y,
        (sx, sy) => art.rgba[(sy * 7 + sx) * 4 + 3]);
      const offset = writer && (writer.source[1] * 7 + writer.source[0]) * 4;
      const actual = writer ? Array.from(art.rgba.slice(offset, offset + 4)) : patternBodyOrInitial(model, admitted, x, y).rgba;
      const outside = clipped && (x < 2 || x >= 9 || y < 2 || y >= 7);
      assert.deepEqual(actual, headerPatternColors[outside ? '.' : headerPatternRows[mode][y][x]], `mode${mode}/${clipped}/${x},${y}`);
    }
  }
});
test('pattern admission rejects unknown origin, unsupported mode, malformed context and nonopaque/short tiles', () => {
  const input = () => ({ mode: 0, context: patternContext(), width: 11, height: 9, tileWidth: 4, tileHeight: 2, rgba: literalTile() });
  for (const mutate of [x => { x.context.patternOrigin = { status: 'unknown' }; }, x => { x.mode = 5; },
    x => { x.mode = -1; }, x => { x.context.controlOrigin = [32767, 0]; }, x => { x.context.portOrigin = [1, 0]; },
    x => { x.context.patternOrigin.offset = new Array(2); }, x => { x.context.clip = { kind: 'unknown' }; },
    x => { x.context.clip.rect.w = -1; }, x => { x.rgba[3] = 0; }, x => { x.rgba[3] = 128; },
    x => { x.rgba = x.rgba.slice(4); }, x => { x.tileWidth = 0; }]) {
    const value = input(); mutate(value); assert.equal(admitPatternBody(value), null);
  }
  const a = input(), b = input(); b.mode = 255; // non5 modes outside1..4 retain P=(0,0)
  assert.deepEqual(patternBodyOrInitial({ corner: 2, side: 3 }, admitPatternBody(a), 3, 3),
    patternBodyOrInitial({ corner: 2, side: 3 }, admitPatternBody(b), 3, 3));
});


test('omitted empty-label dimensions pin modern width and the inclusive height threshold', () => {
  for (const [variant, width] of [[{ family: 'push' }, 56], [{ family: 'bevel', small: false }, 22], [{ family: 'bevel', small: true }, 18]]) {
    for (const [input, height] of [[6, 6], [20, 20], [28, 28], [29, 20], [74, 20]])
      assert.deepEqual(omittedDimensions(variant, input), [width, height]);
  }
});


test('tiny height plan deduplicates explicit cases and records unreachable width analogues', () => {
  const plan = tinyBoundarySizes({ width: 9, height: 9, corner: 4, side: 1, tile: true }, 'push');
  assert.deepEqual(plan.heights, [1, 2, 3, 4, 5, 7]);
  assert.deepEqual(plan.sizes, [[24, 1], [24, 2], [24, 3], [24, 4], [24, 5], [24, 7]]);
  assert.deepEqual(plan.unreachableWidths, plan.heights);
  const thick = tinyBoundarySizes({ width: 21, height: 21, corner: 7, side: 14, tile: true }, 'bevel');
  assert.ok(thick.heights.includes(27) && thick.heights.includes(28) && thick.heights.includes(29));
  assert.deepEqual(thick.alreadyExplicit, [[16, 14], [16, 15], [16, 29]]);
  assert.equal(new Set(thick.sizes.map(String)).size, thick.sizes.length);
});

test('one-pixel height retains negative bottom origins, masked earlier corners and no vertical middle', () => {
  const thin = { width: 9, height: 9, corner: 4, side: 1, tile: true };
  assert.deepEqual(at(thin, [24, 1], 0, 0), { region: 3, source: [0, 8], branch: 'copy' });
  assert.deepEqual(at(thin, [24, 1], 0, 0, (x, y) => x === 0 && y === 8 ? 0 : 255),
    { region: 0, source: [0, 0], branch: 'copy' });
  assert.deepEqual(at(thin, [24, 1], 10, 0), { region: 5, source: [4, 8], branch: 'horizontal-lines' });
  const thick = { ...thin, side: 3 };
  assert.deepEqual(at(thick, [24, 2], 10, 0), { region: 5, source: [4, 7], branch: 'horizontal-lines' });
  for (let y = 0; y < 2; y++) for (let x = 0; x < 24; x++) assert.ok(at(thick, [24, 2], x, y).region < 6);
  assert.equal(solidBodyOrInitial(thick, { width: 24, height: 2 }, 10, 0, { displayRgb: [10, 20, 30] }).kind, 'initial');
});
