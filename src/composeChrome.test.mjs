import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import '../tests/helpers/registerTs.mjs';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

// Exercise the public compositor directly, without browser image decoding or
// generated bundles. registerTs loads the runtime TypeScript with its
// production .js specifiers, including the src/engine modules it imports.
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');

function edgeAllocation(cells, width, titleWidthPx = 0) {
  let end = 0;
  const top = [{ at: 0, part: 'part-0' }, ...cells.map(([code, size]) => ({ at: end += size, part: `part-${code}` }))];
  const source = PixelBuffer.alloc(end, 3);
  source.data.fill(255);
  const wt = { parts: { 'part-0': { rect: [0, 1, end, 3] } }, edges: { top } };
  const composed = composeWindowChrome(source, wt, width, 2, { titleWidthPx });
  return composed.placement.filter(p => p.edge === 'top').map(p => p.rects[0].w);
}

test('whole tiles truncate, allowing zero; code 13/14 absorb their remainder', () => {
  assert.deepEqual(edgeAllocation([[12, 10], [13, 1]], 16), [10, 6]);
  assert.deepEqual(edgeAllocation([[12, 10], [14, 1]], 6), [0, 6]);
  assert.deepEqual(edgeAllocation([[12, 10]], 16), [10]); // no receiver: do not invent a partial tile
  assert.deepEqual(edgeAllocation([[12, 10], [14, 1]], 0), [0, 0]);
});

test('primary divisor excludes remainder-only cells and collects every tile fraction first', () => {
  // Budget 35 / three primary cells = 11, remainder 2. Tiles return 1+3;
  // the three recipients then get 2 each (normal grower also gets 11).
  assert.deepEqual(edgeAllocation([[13, 1], [12, 10], [8, 1], [12, 8], [14, 1]], 35), [2, 10, 13, 8, 2]);
  assert.deepEqual(edgeAllocation([[18, 1], [12, 10], [14, 1]], 25), [13, 10, 2]);
});

test('integer remainder goes to later recipients, as the sequential DIVS pass does', () => {
  assert.deepEqual(edgeAllocation([[8, 1], [11, 1], [18, 1]], 10), [3, 3, 4]);
  assert.deepEqual(edgeAllocation([[12, 10], [13, 1], [14, 1]], 15), [10, 2, 3]);
});

test('fixed and collapsed cells are not budget recipients; below-minimum art clips without negative widths', () => {
  assert.deepEqual(edgeAllocation([[1, 3], [0, 5], [12, 10], [14, 1], [1, 2]], 21), [3, 0, 10, 6, 2]);
  assert.deepEqual(edgeAllocation([[1, 3], [12, 10], [14, 1], [1, 2]], 1), [3, 0, 0, 2]);
  assert.deepEqual(edgeAllocation([[1, 3], [13, 1], [14, 1], [1, 2]], 20), [3, 0, 0, 2]);
});

test('title halves allocate independently and do not let remainder-only cells claim a primary share', () => {
  assert.deepEqual(edgeAllocation([[12, 10], [13, 1], [5, 1], [12, 10], [14, 1]], 41, 10), [10, 5, 10, 10, 6]);
  assert.deepEqual(edgeAllocation([[1, 3], [13, 1], [5, 1], [8, 1], [1, 2]], 20, 4), [3, 0, 4, 11, 2]);
});

for (const slug of ['monkey-paradise', 'animals']) {
  test(`${slug}: native and resized bottom artwork reaches the corner without clipping or holes`, async () => {
    const dir = new URL(`../themes/${slug}/`, import.meta.url);
    const path = ['scheme.sit', 'scheme.rsrc'].map(p => new URL(p, dir)).find(existsSync);
    const decoded = await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false });
    const wt = decoded.manifest.windowTypes['document-window'];
    const [l, t, r, b] = wt.parts['part-0'].rect;
    for (const state of ['active', 'inactive']) {
      const asset = decoded.assets.find(a => a.path === wt.chrome[state]);
      const source = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
      for (const width of [r - l, 240, 320]) for (const height of [b - t, 120, 160]) {
        const c = composeWindowChrome(source, wt, width, height);
        const bottom = c.placement.filter(p => p.edge === 'bottom');
        const label = `${slug}/${state} ${width}x${height}`;
        let cursor = 0;
        for (const cell of bottom) {
          const dst = cell.rects[0];
          assert.equal(dst.x, cursor, `${label}: contiguous bottom cells`);
          assert.ok(dst.w >= 0, `${label}: nonnegative width`);
          cursor += dst.w;
          assert.ok(cursor <= c.fullWidth, `${label}: no clipped cell`);
          if (cell.code === 12) assert.equal(dst.w % cell.src.w, 0, `${label}: whole tiles`);
        }
        assert.equal(cursor, c.fullWidth, `${label}: complete bottom coverage`);
        const corner = bottom.at(-1), dst = corner.rects[0];
        assert.equal(dst.x, c.fullWidth - corner.src.w, `${label}: far corner anchored`);
        // Verify actual output bytes, not just the compositor's own placement map.
        for (let y = 0; y < corner.src.h; y++) for (let x = 0; x < corner.src.w; x++) {
          assert.deepEqual(c.buffer.getPixel(dst.x + x, dst.y + y), source.getPixel(corner.src.x + x, corner.src.y + y), `${label}: corner pixel ${x},${y}`);
        }
      }
    }
  });
}
