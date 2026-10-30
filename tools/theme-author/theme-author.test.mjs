// Round-trip tests: everything the authoring encoders write must decode back
// to the same values through the runtime's own decoders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeResourceFork } from './resource-fork-writer.js';
import { encodeCicn } from './encode-cicn.js';
import { encodeWnd, encodeCinf, encodeColr } from './encode-records.js';
import { Raster } from './raster.js';
import { srgbChannelToMac } from './color.js';
import { parseResourceFork } from '../theme-loader/resource-fork.js';
import { readCicnIndexed, decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';
import { decodeCinf } from '../theme-loader/decoders/cinf.js';
import { decodeColr } from '../theme-loader/decoders/colr.js';
import { macChannelToSrgb } from '../theme-loader/mac-gamma.js';
import { checkScheme } from './check-scheme.js';
import { windowLayout } from './window-layout.js';
import { buildScheme } from '../../authoring/schemes/halcyon/scheme.mjs';

test('resource fork round-trips types, ids, names and bytes', () => {
  const input = [
    { type: 'wnd#', id: -14336, name: 'Document Window', data: Uint8Array.of(1, 2, 3) },
    { type: 'cicn', id: -14335, data: Uint8Array.of(9) },
    { type: 'cicn', id: -14336, name: 'Inactive', data: new Uint8Array(0) },
  ];
  const parsed = parseResourceFork(writeResourceFork(input));
  assert.equal(parsed.length, 3);
  for (const r of input) {
    const got = parsed.find((p) => p.type === r.type && p.id === r.id);
    assert.ok(got, `${r.type} ${r.id} missing`);
    assert.equal(got.name, r.name ?? '');
    assert.deepEqual([...got.data], [...r.data]);
  }
});

test('resource fork rejects duplicates and bad type codes', () => {
  const d = new Uint8Array(0);
  assert.throws(() => writeResourceFork([{ type: 'cicn', id: 1, data: d }, { type: 'cicn', id: 1, data: d }]), /duplicate/);
  assert.throws(() => writeResourceFork([{ type: 'cic', id: 1, data: d }]), /4 characters/);
});

test('cicn round-trips pixels, mask and chooses the smallest depth', () => {
  const r = new Raster(5, 3);
  r.fillRect(0, 0, 5, 3, '#ffffff').set(1, 1, '#ff0000').set(4, 2, null);
  const parsed = readCicnIndexed(encodeCicn(r, { gamma: false }));
  assert.equal(parsed.pmap.width, 5);
  assert.equal(parsed.pmap.pixelSize, 1, 'two colours fit in 1 bit');
  const decoded = decodeCicn(encodeCicn(r, { gamma: false }));
  const px = (x, y) => [...decoded.rgba.subarray((y * 5 + x) * 4, (y * 5 + x) * 4 + 4)];
  assert.deepEqual(px(1, 1), [255, 0, 0, 255]);
  assert.deepEqual(px(0, 0), [255, 255, 255, 255]);
  assert.equal(px(4, 2)[3], 0, 'transparent pixel stays masked');
});

test('cicn depth grows with palette size and rejects > 256 colours', () => {
  const r = new Raster(20, 1);
  for (let x = 0; x < 20; x++) r.set(x, 0, [x * 10, 0, 0]);
  assert.equal(readCicnIndexed(encodeCicn(r)).pmap.pixelSize, 8);
  const big = new Raster(300, 1);
  for (let x = 0; x < 300; x++) big.set(x, 0, [x & 0xff, x >> 8, 7]);
  assert.throws(() => encodeCicn(big, { gamma: false }), /more than 256/);
});

test('gamma pre-compensation survives the loader brightening within ±1', () => {
  for (let v = 0; v < 256; v++) {
    assert.ok(Math.abs(macChannelToSrgb(srgbChannelToMac(v)) - v) <= 1, `channel ${v}`);
  }
});

test('wnd#, cinf and Colr round-trip', () => {
  const wnd = {
    rectangles: [{ part: 0, rect: { top: 22, left: 1, bottom: 40, right: 99 } }],
    topSide: [{ part: 0, border: 10 }, { part: 8, border: 11 }],
    bottomSide: [],
    leftSide: [{ part: 0, border: 22 }, { part: 8, border: 23 }],
    rightSide: [{ part: 0, border: 22 }, { part: 8, border: 23 }],
  };
  assert.deepEqual(decodeWnd(encodeWnd(wnd)), wnd);

  const cinf = { cornerSize: 4, sideThickness: 3, tileSides: 0, patternAnchor: 0, bgPatternId: -1,
    bgPixel: { x: 5, y: 6 }, textPixel: { x: 7, y: -8 }, embossPixel: { x: 0, y: 1 } };
  const got = decodeCinf(encodeCinf(cinf));
  for (const k of Object.keys(cinf)) assert.deepEqual(got[k], cinf[k], k);

  const colr = decodeColr(encodeColr({ hasAccentColors: true }));
  assert.equal(colr.minimumKVersion, 0x20);
  assert.equal(colr.hasAccentColors, true);
  assert.equal(colr.extraBytes.length, 11);
});

// ── Authoring checks: each rule must be able to fire ──

const frame = (w, h) => encodeCicn(new Raster(w, h).fillRect(0, 0, w, h, '#888888').fillRect(1, 20, w - 2, 1, null));
const layout = () => windowLayout({ titleBar: 20, leftFixed: 20, rightFixed: 20, bottom: 4,
  widgets: { close: { x: 4, y: 4, w: 10, h: 10 } } });
function scheme(mutate = (l) => l) {
  const l = mutate(layout());
  return [
    { type: 'wnd#', id: -14336, data: encodeWnd(l.wnd) },
    { type: 'cicn', id: -14336, data: frame(l.width, l.height) },
    { type: 'cicn', id: -14335, data: frame(l.width, l.height) },
  ];
}

test('windowLayout output passes the checks', () => {
  const { errors, warnings } = checkScheme(scheme());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('check: widget inside a growing cell is an error', () => {
  const { errors } = checkScheme(scheme((l) => {
    l.wnd.rectangles[1].rect = { top: 4, left: 20, bottom: 14, right: 22 }; // over the code-11/5 cells
    return l;
  }));
  assert.ok(errors.some((e) => /close box .* stretches or collapses/.test(e)), errors.join('\n'));
});

test('check: art outside the recipe span is flagged', () => {
  const { warnings } = checkScheme(scheme((l) => { l.wnd.topSide = l.wnd.topSide.slice(1, -1); return l; }));
  assert.ok(warnings.some((w) => /outside its recipe/.test(w)), warnings.join('\n'));
});

test('check: a side with no growing cell is flagged', () => {
  const { warnings } = checkScheme(scheme((l) => { l.wnd.leftSide = l.wnd.leftSide.map((s) => ({ ...s, part: 1 })); return l; }));
  assert.ok(warnings.some((w) => /left side has no growing cell/.test(w)), warnings.join('\n'));
});

test('check: missing frame image, mismatched sizes, missing content rect', () => {
  const base = scheme();
  assert.ok(checkScheme(base.filter((r) => r.id !== -14336 || r.type !== 'cicn')).errors.some((e) => /missing frame cicn/.test(e)));
  const resized = base.map((r) => (r.type === 'cicn' && r.id === -14335 ? { ...r, data: frame(10, 10) } : r));
  assert.ok(checkScheme(resized).errors.some((e) => /must be the same size/.test(e)));
  const noBody = scheme((l) => { l.wnd.rectangles = l.wnd.rectangles.filter((x) => x.part !== 0); return l; });
  assert.ok(checkScheme(noBody).errors.some((e) => /no content rectangle/.test(e)));
});

test('check: push face without a same-id cinf is flagged', () => {
  const face = encodeCicn(new Raster(8, 8).fillRect(0, 0, 8, 8, '#ffffff'));
  const { warnings } = checkScheme([{ type: 'cicn', id: -10239, data: face }]);
  assert.ok(warnings.some((w) => /no cinf -10239/.test(w)));
  assert.ok(warnings.some((w) => /no pressed face/.test(w)));
});

test('Halcyon builds with no errors or warnings', async () => {
  const { resources } = await buildScheme();
  const { errors, warnings } = checkScheme(resources);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.ok(parseResourceFork(writeResourceFork(resources)).length === resources.length);
});

test('committed halcyon scheme.rsrc matches a fresh build (run `npm run author -- authoring/schemes/halcyon`)', async () => {
  const { readFileSync } = await import('node:fs');
  const committed = readFileSync(new URL('../../authoring/schemes/halcyon/scheme.rsrc', import.meta.url));
  const { resources } = await buildScheme();
  assert.ok(Buffer.from(writeResourceFork(resources)).equals(committed), 'scheme.rsrc is stale; rebuild it');
});

test('check: widget in a code-15 cell (collapses when the widget is present) is an error', () => {
  const { errors } = checkScheme(scheme((l) => {
    l.wnd.topSide = l.wnd.topSide.map((s, i) => (i === 1 ? { ...s, part: 15 } : s)); // left fixed cell → code 15
    return l;
  }));
  assert.ok(errors.some((e) => /close box .* code-15/.test(e)), errors.join('\n'));
});

test('Raster.blit keeps hidden swatches', () => {
  const src = new Raster(2, 1).swatch(1, 0, '#123456');
  const dst = new Raster(3, 1).blit(src, 1, 0);
  assert.equal(dst.rgba[2 * 4 + 3], 1);
  assert.deepEqual([...dst.rgba.subarray(8, 11)], [0x12, 0x34, 0x56]);
});
