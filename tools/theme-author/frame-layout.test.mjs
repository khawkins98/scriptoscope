// frameLayout / stripLayout / pressedStripFrom: the per-edge cell-list helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameLayout, stripLayout, pressedStripFrom } from './frame-layout.js';
import { Raster } from './raster.js';
import { encodeWnd } from './encode-records.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const spec = () => ({
  topH: 30, sideL: 4, sideR: 4, bottomH: 6,
  // tower | merlons (12) + filler (13) | cap plate cap | filler + merlons | tower
  top: [
    { code: 1, w: 16, name: 'towerL' }, { code: 12, w: 8, name: 'merlonsL' }, { code: 13, w: 1 },
    { code: 6, w: 4 }, { code: 5, w: 4, name: 'plate' }, { code: 6, w: 4 },
    { code: 13, w: 1 }, { code: 12, w: 8 }, { code: 1, w: 16, name: 'towerR' },
  ],
  bottom: [{ code: 1, w: 20 }, { code: 11, w: 6 }, { code: 1, w: 10, name: 'gate' }, { code: 8, w: 6 }, { code: 1, w: 20 }],
  left: [{ code: 11, w: 4 }], right: [{ code: 11, w: 4 }],
  title: { cell: 'plate', top: 10, bottom: 28 },
  widgets: { close: { x: 2, y: 14, w: 12, h: 12 } },
});

test('frameLayout derives size, content rect and a recipe that round-trips', () => {
  const l = frameLayout(spec());
  assert.deepEqual([l.width, l.height], [62, 40]);
  assert.deepEqual(l.content, { top: 30, left: 4, bottom: 34, right: 58 });
  assert.deepEqual(l.named('plate'), { code: 5, w: 4, name: 'plate', x0: 29, x1: 33 });
  assert.deepEqual(decodeWnd(encodeWnd(l.wnd)), l.wnd);
  assert.equal(l.wnd.topSide.at(-1).border, 62, 'top recipe ends at the full width');
});

test('frameLayout rejects the mistakes it knows about', () => {
  const bad = (mutate, re) => { const s = spec(); mutate(s); assert.throws(() => frameLayout(s), re); };
  bad((s) => { s.bottom[0].w = 19; }, /bottom cells add up/);
  bad((s) => { s.widgets.close.x = 16; }, /overlaps a code-12 cell/);
  bad((s) => { s.top[2] = { code: 1, w: 1 }; }, /needs a code 8\/11\/13\/14\/18 cell/);
  bad((s) => { s.top[7] = { code: 12, w: 6 }; s.top.splice(8, 0, { code: 12, w: 2 }); s.top[6] = { code: 13, w: 1 }; }, /different widths/);
  bad((s) => { s.title.top = 14; }, /under 17px/);
});

test('stripLayout and pressedStripFrom lay pieces out across and keep the silhouette as the mask', () => {
  const l = frameLayout(spec());
  const strip = stripLayout(l);
  assert.deepEqual([strip.width, strip.height], [12, 12]);
  const frame = new Raster(l.width, l.height).fillRect(0, 0, l.width, l.height, '#777777');
  const draw = (role, r, b) => r.fillCircleSmooth(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, '#ff0000');
  const r = pressedStripFrom({ strip, activeFrame: frame, draw, rows: 2 });
  assert.deepEqual([r.width, r.height], [12, 24]);
  assert.equal(r.get(0, 0), null, 'corner outside the round widget stays transparent (not clickable)');
  assert.deepEqual(r.get(6, 6), [255, 0, 0]);
  assert.deepEqual(r.get(6, 18), [255, 0, 0], 'second row for collapsed windows');
});

test('frameLayout reports the title room and lints stray art in uniform cells', () => {
  const s = spec();
  s.top[2] = { code: 13, w: 1 };
  s.top[3] = { code: 6, w: 4 };
  const l = frameLayout(s);
  // fixed: towers 16 + 16, caps 4 + 4 (the plate and the growers don't count)
  assert.equal(l.fixedTop, 40);
  assert.equal(l.minWidthForTitle(60), 100);
  const r = new Raster(l.width, l.height).fillRect(0, 0, l.width, l.height, '#888888');
  l.lint(r); // a flat plate passes
  r.set(l.named('plate').x0 + 2, 12, '#ff0000');
  assert.throws(() => l.lint(r), /cell plate column 31 differs/);
});

test('fitPalette brings an image under the limit and keeps swatches exact', async () => {
  const { fitPalette, colorCount } = await import('./fit-palette.js');
  const r = new Raster(20, 20);
  for (let i = 0; i < 400; i++) r.set(i % 20, Math.floor(i / 20), [i % 256, (i * 7) % 256, 90]);
  r.swatch(0, 0, '#123456');
  assert.ok(colorCount(r) > 256);
  fitPalette(r, 200);
  assert.ok(colorCount(r) <= 200);
  assert.deepEqual([...r.rgba.subarray(0, 4)], [0x12, 0x34, 0x56, 1]);
});

test('lint compares 1px growers in a uniform group, checks every edge, and enforces R18', () => {
  const s = spec();
  s.top[2] = { code: 13, w: 1, name: 'fillL', uniform: 'bar' };
  s.top[6] = { code: 13, w: 1, name: 'fillR', uniform: 'bar' };
  s.left = [{ code: 11, w: 4, name: 'wallL', uniform: true }];
  const l = frameLayout(s);
  const paint = () => new Raster(l.width, l.height).fillRect(0, 0, l.width, l.height, '#888888');
  l.lint(paint());
  // A 1px grower is trivially uniform on its own; only the group catches stray art in it (Bonn's tree).
  const tree = paint().set(l.named('fillR').x0, 3, '#ff0000');
  assert.throws(() => l.lint(tree), /cell fillR doesn't match fillL/);
  // Left and right cells run down the side: compare rows.
  const wall = paint().set(1, l.named('wallL').x0 + 2, '#ff0000');
  assert.throws(() => l.lint(wall), /left cell wallL row 32 differs/);
  // R18: a wholly transparent last column or row is trimmed by the web.
  assert.throws(() => l.lint(paint().fillRect(l.width - 1, 0, 1, l.height, null)), /last column.*R18/);
  assert.throws(() => l.lint(paint().fillRect(0, l.height - 1, l.width, 1, null)), /last row.*R18/);
  assert.throws(() => l.lint(new Raster(4, 4)), /raster is 4x4/);
});

test('fixedTop leaves out codes the web always zeroes (15/16/17) and keeps 2/3/4 and 10', () => {
  const s = spec();
  s.top.splice(1, 0, { code: 15, w: 4 }, { code: 2, w: 4 });
  s.top.splice(s.top.length - 1, 0, { code: 10, w: 6 });
  s.bottom[0].w += 14; // keep the bottom as wide as the top
  const l = frameLayout(s);
  // towers 16 + 16, code 2 4, caps 4 + 4, code 10 6; code 15 doesn't count
  assert.equal(l.fixedTop, 50);
});
