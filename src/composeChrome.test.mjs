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

// Expected widths below are hand traces of docs/spec/engine/window-widgets.md
// LS1–LS9, TS1, TT1–TT9 and AW1–AW9 (the top side; content height 2).
function edgePlacement(cells, width, titleWidthPx = 0, titleRect = null) {
  let end = 0;
  const top = [{ at: 0, part: 'part-0' }, ...cells.map(([code, size]) => ({ at: end += size, part: `part-${code}` }))];
  const source = PixelBuffer.alloc(end, 3);
  source.data.fill(255);
  const wt = { parts: { 'part-0': { rect: [0, 1, end, 3] }, ...(titleRect ? { 'part-4': { rect: titleRect } } : {}) }, edges: { top } };
  const composed = composeWindowChrome(source, wt, width, 2, { titleWidthPx });
  return composed.placement.filter(p => p.edge === 'top').map(p => [p.segment, p.rects[0].x, p.rects[0].w]);
}
const edgeAllocation = (...args) => edgePlacement(...args).map(([, , w]) => w);

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

test('fixed and collapsed cells are not budget recipients; a negative budget is not clamped (AW8)', () => {
  assert.deepEqual(edgeAllocation([[1, 3], [0, 5], [12, 10], [14, 1], [1, 2]], 21), [3, 0, 10, 6, 2]);
  // 1 px: E = 1 < F = 5 (TS1); budget −4, share −4; the tile gets −4 − (−4 % 10) = 0 and
  // code 14 the remainder −4 (AW8: no clamp), so the side still ends at P[N] = 1.
  assert.deepEqual(edgeAllocation([[1, 3], [12, 10], [14, 1], [1, 2]], 1), [3, 0, -4, 2]);
  // No primary grower (AW9): 13/14 get 0 and the side ends at P[0] + F, short of P[N] (LS9).
  assert.deepEqual(edgeAllocation([[1, 3], [13, 1], [14, 1], [1, 2]], 20), [3, 0, 0, 2]);
});

test('title halves allocate independently and do not let remainder-only cells claim a primary share (TT5–TT9)', () => {
  // T4 fills the anchor cell, so W = SW. TT7 (Fb = Fa = 0): P[a] = mid + W/2 = 25, P[a−1] = 15;
  // the halves then allocate 15 and 16 px independently.
  assert.deepEqual(edgeAllocation([[12, 10], [13, 1], [5, 1], [12, 10], [14, 1]], 41, 10, [11, 0, 12, 1]), [10, 5, 10, 10, 6]);
  // No grower before the anchor: TT7 gives R' = P[a−1] + W, and the empty first half's 13 gets 0 (AW9).
  assert.deepEqual(edgeAllocation([[1, 3], [13, 1], [5, 1], [8, 1], [1, 2]], 20, 4, [4, 0, 5, 1]), [3, 0, 4, 11, 2]);
  // TT6 (growers on both sides, Fb > Fa): the plate starts at mid − W/2 = 15 on the content
  // centre, not at an even split of the room (finding F4).
  assert.deepEqual(edgeAllocation([[1, 6], [8, 1], [5, 4], [8, 1], [1, 2]], 40, 10, [7, 0, 11, 1]), [6, 9, 10, 13, 2]);
});

test('no title rect: T4 is the first entry (§2.1), W < 0 and TT8 rewrites the anchor borders', () => {
  // W = 10 − ((23 − 12) + (11 − 0)) = −12. TT7 puts P[a] = 14, P[a−1] = 26; TT8 moves them to
  // 15 and 25 and the working borders S[2], S[3] to 0 and 23, so segments 2 and 4 have no
  // template pixels (not drawn, not reported). The first half walks to 26 (budget 26: the
  // 10 px tile 20, code 13 the remainder 6), so the anchor cell is [26, 25). The second half
  // has budget 41 − 25 + 11 = 27; its code-12 cell has working width 22 − 23 = −1, which is
  // not 0, so AW1 gives it whole tiles of the share, 27 − (27 % −1) = 27 (AW1a skips only width
  // 0), and code 14 gets the remainder 0: segment 5 starts at 25 + 27 = 52.
  assert.deepEqual(edgePlacement([[12, 10], [13, 1], [5, 1], [12, 10], [14, 1]], 41, 10), [[1, 0, 20], [3, 26, -1], [5, 52, 0]]);
});

for (const slug of ['monkey-paradise', 'animals']) {
  test(`${slug}: native and resized bottom artwork spans [P[0], P[N]) and its corner copies through the mask`, async () => {
    const dir = new URL(`../themes/${slug}/`, import.meta.url);
    const path = ['scheme.sit', 'scheme.rsrc'].map(p => new URL(p, dir)).find(existsSync);
    const decoded = await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false });
    const wt = decoded.manifest.windowTypes['document-window'];
    const [l, t, r, b] = wt.parts['part-0'].rect;
    const S = wt.edges.bottom.map(e => e.at);
    for (const state of ['active', 'inactive']) {
      const asset = decoded.assets.find(a => a.path === wt.chrome[state]);
      const source = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
      for (const width of [r - l, 240, 320]) for (const height of [b - t, 120, 160]) {
        const c = composeWindowChrome(source, wt, width, height);
        const bottom = c.placement.filter(p => p.edge === 'bottom');
        const label = `${slug}/${state} ${width}x${height}`;
        // LS7: P[0] = S[0] + C.left − A.left, P[N] = S[N] + C.right − A.right (C starts at the body inset).
        const P0 = S[0] + c.frame.left - l, PN = S.at(-1) + c.frame.left + width - r;
        let cursor = P0;
        for (const cell of bottom) {
          const dst = cell.rects[0];
          assert.equal(dst.x, cursor, `${label}: contiguous bottom cells (AW7)`);
          cursor += dst.w;
          if (cell.code === 12) assert.equal(dst.w % cell.src.w, 0, `${label}: whole tiles`);
        }
        // Both bottoms have a remainder recipient, so the walk hands out the whole budget (LS9).
        assert.equal(cursor, PN, `${label}: the side ends at P[N]`);
        const corner = bottom.at(-1), dst = corner.rects[0];
        assert.equal(dst.x + dst.w, PN, `${label}: far corner ends at P[N]`);
        // CopyMask (WD4, qd X2): mask-set source pixels are copied; the sides drawn later (left,
        // right) may cover the corner, so only pixels outside their cells are compared.
        const later = c.placement.filter(p => p.edge === 'left' || p.edge === 'right').map(p => p.rects[0]);
        const covered = (x, y) => later.some(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
        let compared = 0;
        for (let y = 0; y < corner.src.h; y++) for (let x = 0; x < corner.src.w; x++) {
          const px = source.getPixel(corner.src.x + x, corner.src.y + y);
          if (covered(dst.x + x, dst.y + y) || px[3] !== 255) continue;
          assert.deepEqual(c.buffer.getPixel(dst.x + x, dst.y + y), px, `${label}: corner pixel ${x},${y}`);
          compared++;
        }
        assert.ok(compared > 0, `${label}: corner pixels compared`);
      }
    }
  });
}
