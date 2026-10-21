import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import '../helpers/registerTs.mjs';
import { CANONICAL_WND, CORNER_SPRITE, SLICED, ladderSelection, checkTheme, checkComposition, decodeCells, allocateHalf, stateLabelContradiction } from './window-chrome-rules.mjs';
const { PixelBuffer } = await import('../../src/pixelBuffer.ts');
const { composeWindowChrome } = await import('../../src/composeChrome.ts');
const { resolveWindowType } = await import('../../src/resolveWindowType.ts');
const runtime = { PixelBuffer, composeWindowChrome };

const corpus = new Map();
for (const slug of [...SLICED, ...CORNER_SPRITE]) {
  const path = ['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync);
  corpus.set(slug, await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false, provenance: true }));
}
const resources = d => new Map(d.byteProvenance.resources.map(r => [r.resourceIndex, r]));
const wndIds = d => new Set(d.byteProvenance.resources.filter(r => r.type === 'wnd#' && r.status === 'decoded').map(r => r.signedId));
const recipeId = (d, wt) => resources(d).get(wt?.byteProvenance?.recipe?.resourceIndex)?.signedId ?? null;

test('corpus partition: 13 archives ship wnd# recipes; 5 ship none and are corner-sprite only (recipe rules not applicable)', () => {
  assert.equal(corpus.size, 18);
  for (const slug of SLICED) assert.ok(wndIds(corpus.get(slug)).size > 0, slug);
  for (const slug of CORNER_SPRITE) {
    const d = corpus.get(slug);
    assert.equal(wndIds(d).size, 0, slug);
    assert.ok(Object.values(d.manifest.windowTypes).every(w => w.model === 'corner-sprite' && w.byteProvenance.recipe.kind === 'corner-sprite-table'), slug);
  }
});

test('0x356c ladder literals match the reference §3.4.1 landing table', () => {
  const all = new Set(Object.values(CANONICAL_WND));
  const walk = (id, present = new Set(all)) => { const out = []; for (let hit; (hit = ladderSelection(id, present)) != null; present.delete(hit)) out.push(hit); return out; };
  assert.deepEqual(walk(-14322), [-14322, -14324, -14326, -14336]);
  assert.deepEqual(walk(-14284), [-14284, -14288, -14300, -14304]);
  assert.deepEqual(walk(-14292), [-14292, -14296, -14304]);
  assert.deepEqual(walk(-12320), [-12320]); // off the mask grid: a genuine miss after -12320
  assert.equal(ladderSelection(-14336, new Set([-14335])), null); // masks only clear bits: no upward search
});

test('canonical requests select the first wnd# the 0x356c ladder loads from each archive, including one-type-removed archives', () => {
  let hits = 0; const misses = [];
  for (const slug of SLICED) {
    const d = corpus.get(slug), present = wndIds(d);
    const variants = [[null, d.manifest.windowTypes, present]];
    for (const [key, wt] of Object.entries(d.manifest.windowTypes)) {
      const { [key]: _removed, ...rest } = d.manifest.windowTypes;
      variants.push([key, rest, new Set([...present].filter(id => id !== recipeId(d, wt)))]);
    }
    for (const [removed, windowTypes, ids] of variants) for (const [request, id] of Object.entries(CANONICAL_WND)) {
      const expected = ladderSelection(id, ids);
      const actual = recipeId(d, resolveWindowType({ manifest: { ...d.manifest, windowTypes } }, request));
      // A ladder miss reaches the 0x36a0 → 0x373e no-recipe path; the runtime's
      // heuristic substitute there is modern policy, recorded not asserted.
      if (expected == null) { misses.push(`${slug}${removed ? ` -${removed}` : ''}: ${request}`); continue; }
      assert.equal(actual, expected, `${slug}${removed ? ` without ${removed}` : ''}: ${request}`);
      hits++;
    }
  }
  assert.ok(hits > 1700, `nonvacuous ladder coverage (${hits})`);
  assert.ok(misses.every(m => / -/.test(m)), `the shipped archives never miss: ${misses.filter(m => !/ -/.test(m))}`);
});

test('selected frame art never carries an author label naming the opposite state (18 archives)', () => {
  let labelled = 0; const shared = [];
  for (const [slug, d] of corpus) for (const [key, wt] of Object.entries(d.manifest.windowTypes)) {
    // One resource serving both states (popup -12320) is state-neutral art: its
    // "Active" label shows the +1 pairing convention does not hold there.
    if (wt.chrome.active === wt.chrome.inactive) { shared.push(`${slug}/${key}`); continue; }
    for (const state of ['active', 'inactive']) {
      const label = Object.values(d.manifest.chromeElements).find(e => e.asset === wt.chrome[state])?.authorLabel;
      if (label) labelled++;
      assert.equal(stateLabelContradiction(state, label), null, `${slug}/${key}/${state}`);
    }
  }
  assert.ok(labelled > 250, `nonvacuous label coverage (${labelled})`);
  assert.ok(shared.every(s => /popup-window$/.test(s)), shared.join());
});

for (const slug of SLICED) {
  test(`${slug}: END-based cells, 1:1 corner, part-code widths, 0x5178 halves and 0xfeae opaque tiles at sampled sizes`, () => {
    const { totals, failures } = checkTheme(corpus.get(slug), runtime);
    assert.deepEqual(failures, []);
    assert.ok(totals.cells > 0 && totals.halves > 0 && totals.pixels > 0, JSON.stringify(totals));
  });
}

// Literal synthetic edges (cells are [code, width]) prove the checker rejects
// the historically wrong readings rather than passing everything.
function edge(cells, width) {
  let end = 0;
  const top = [{ at: 0, part: 'part-0' }, ...cells.map(([code, size]) => ({ at: end += size, part: `part-${code}` }))];
  const cicn = PixelBuffer.alloc(end, 3);
  for (let x = 0; x < end; x++) for (let y = 0; y < 3; y++) cicn.setPixel(x, y, x * 7 % 256, y * 60, 100, 255);
  const windowType = { parts: { 'part-0': { rect: [0, 1, end, 3] } }, edges: { top } };
  return { cicn, windowType, composed: composeWindowChrome(cicn, windowType, width, 2) };
}
test('rule checker rejects START-based cells, primary shares for 13/14, untruncated tiles and wrong pixels', () => {
  const ok = edge([[1, 2], [12, 3], [13, 1], [8, 2], [1, 2]], 31);
  assert.deepEqual(checkComposition(ok).failures, []);
  assert.deepEqual(allocateHalf(decodeCells(ok.windowType.edges.top), 31), [2, 12, 1, 14, 2]);
  const mutate = f => { const c = structuredClone({ placement: ok.composed.placement }); f(c.placement.filter(p => p.edge === 'top')); return checkComposition({ ...ok, composed: { ...ok.composed, placement: c.placement } }).failures; };
  assert.match(mutate(p => { p[1].code = 1; p[0].code = 12; }).join(), /END-based/);
  assert.match(mutate(p => { p[2].rects[0].w += 1; p[3].rects[0].w -= 1; p[3].rects[0].x += 1; }).join(), /0x5178/);
  assert.match(mutate(p => { p[1].rects[0].w = 10; p[2].rects[0].x += 1; p[2].rects[0].w -= 1; }).join(), /whole 3px tiles/);
  const pixels = edge([[1, 2], [8, 3], [1, 2]], 20);
  pixels.composed.buffer.setPixel(5, 0, 1, 2, 3, 255);
  assert.match(checkComposition(pixels).failures.join(), /0xfeae/);
});

// Known decode disagreements, preserved as failing cases for review rather than
// fixed with an undecoded policy. Remove `todo` only with an independently
// reviewed kDEF interpretation.
test('a titled bar at its own template minimum keeps the structure width (1138 document-window)', {
  todo: 'runtime splits the titled extent evenly (distributeSide), overrunning a half whose fixed art exceeds its share; the 0x4fa8..0x50fa anchor/half extents are not decoded',
}, () => {
  const d = corpus.get('1138'), wt = d.manifest.windowTypes['document-window'];
  const a = d.assets.find(x => x.path === wt.chrome.active), [l, t, r, b] = wt.parts['part-0'].rect;
  const c = composeWindowChrome(new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, r - l, b - t);
  assert.equal(c.placement.filter(p => p.edge === 'top').reduce((s, p) => s + p.rects[0].w, 0), c.fullWidth); // actual 107 vs 103
});
test('code 10 on an untitled side collapses: 0x4a0c returns the caller flag #1 (0x4db4/0x515e), 0x5306 leaves width 0', {
  todo: 'runtime classifies 10 as FIXED (faithfulness ledger 0x4a0c ≈); collapsing needs the unimplemented 0x5ffc widget pass for baked widgets',
}, () => {
  const c = edge([[8, 1], [10, 4], [1, 2]], 20);
  assert.deepEqual(c.composed.placement.filter(p => p.edge === 'top').map(p => p.rects[0].w), [18, 0, 2]);
});
