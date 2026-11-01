// Implementation unit tests for the #597 helpers: the region path, the two-axis region tile and
// the structure builder's agreement with the drawn frame (hit-regions HP15's cross-check).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import '../tests/helpers/registerTs.mjs';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

const { regionPath, parseHit } = await import('./hitRegion.ts');
const { newRegion, regionAddRect, regionAddTiledMask, regionHas } = await import('./raster.ts');
const { rect } = await import('./engine/qd/rect.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');

test('regionPath: rows with equal runs form one band, one rectangle per run, scaled by k', () => {
  const r = newRegion({ width: 6, height: 4 });
  regionAddRect(r, rect(0, 0, 2, 6));
  regionAddRect(r, rect(2, 0, 4, 1));
  regionAddRect(r, rect(2, 4, 4, 6));
  assert.equal(regionPath(r, 1), 'M0 0H6V2H0ZM0 2H1V4H0ZM4 2H6V4H4Z');
  assert.equal(regionPath(r, 2), 'M0 0H12V4H0ZM0 4H2V8H0ZM8 4H12V8H8Z');
  assert.equal(regionPath(newRegion({ width: 3, height: 3 }), 1), '');
});

test('parseHit: trimmed, case-insensitive; empty and unknown values inherit', () => {
  assert.equal(parseHit(' BOX ', 't'), 'box');
  assert.equal(parseHit('Region', 't'), 'region');
  for (const v of [undefined, null, '', 'boxed']) assert.equal(parseHit(v, 't'), undefined);
});

test('regionAddTiledMask repeats on both axes from the anchored corner', () => {
  // 3 x 2 source, mask rows 110 / 100, placed into 8 x 5.
  const src = PixelBuffer.alloc(3, 2);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) src.setPixel(x, y, 0, 0, 0, 255);
  const S = rect(0, 0, 2, 3), D = rect(0, 0, 5, 8);
  const row = (r, y) => Array.from({ length: 8 }, (_, x) => regionHas(r, x, y) ? 1 : 0).join('');
  const fwd = newRegion({ width: 8, height: 5 });
  regionAddTiledMask(fwd, src, S, D, 1);
  assert.deepEqual([0, 1, 2, 3, 4].map(y => row(fwd, y)), ['11011011', '10010010', '11011011', '10010010', '11011011']);
  const rev = newRegion({ width: 8, height: 5 });
  regionAddTiledMask(rev, src, S, D, 0);
  assert.deepEqual([0, 1, 2, 3, 4].map(y => row(rev, y)), ['00100100', '10110110', '00100100', '10110110', '00100100']);
});

for (const slug of ['dolphin-som', 'animals', '1984', 'windows-95']) {
  test(`${slug}: the structure region equals the drawn frame's alpha outside C`, async () => {
    const dir = new URL(`../themes/${slug}/`, import.meta.url);
    const path = ['scheme.sit', 'scheme.rsrc'].map(p => new URL(p, dir)).find(existsSync);
    const decoded = await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false });
    for (const type of ['document-window', 'popup-window']) {
      const wt = decoded.manifest.windowTypes[type];
      if (!wt) continue;
      const asset = decoded.assets.find(a => a.path === wt.chrome.active);
      const source = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
      const c = composeWindowChrome(source, wt, 320, 200, { popupFamily: type === 'popup-window' });
      const S = c.structure();
      let mismatches = 0;
      for (let y = 0; y < c.fullHeight; y++) for (let x = 0; x < c.fullWidth; x++) {
        const inC = x >= c.frame.left && x < c.frame.left + 320 && y >= c.frame.top && y < c.frame.top + 200;
        if (inC) assert.ok(regionHas(S, x, y), `${slug}/${type}: C is in S (SR11)`);
        else if (regionHas(S, x, y) !== (c.buffer.getPixel(x, y)[3] > 0)) mismatches++;
      }
      assert.equal(mismatches, 0, `${slug}/${type}: S vs drawn alpha outside C`);
    }
  });
}

test('animals collapsed titled utility: a collapsed build walks only the title-axis sides (SR6, HP8)', async () => {
  const path = ['scheme.sit', 'scheme.rsrc'].map(p => new URL(p, new URL('../themes/animals/', import.meta.url))).find(existsSync);
  const decoded = await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false });
  const wt = decoded.manifest.windowTypes['collapsed-titled-utility'] ?? decoded.manifest.windowTypes['titled-utility-window'];
  const asset = decoded.assets.find(a => a.path === wt.chrome.active);
  const c = composeWindowChrome(new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba)), wt, 320, 0);
  const four = c.structure(), two = c.structure(true);
  let dropped = 0, added = 0;
  for (let i = 0; i < four.bits.length; i++) { if (four.bits[i] && !two.bits[i]) dropped++; if (two.bits[i] && !four.bits[i]) added++; }
  assert.equal(added, 0);
  assert.ok(dropped > 0, 'side cells drawn at height 0 leave the region');
});
