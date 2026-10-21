import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import '../helpers/registerTs.mjs';
import { CANONICAL_WND, CORNER_SPRITE, SLICED, ladderSelection, checkTheme, checkComposition, decodeCells, allocateHalf, stateLabelContradiction, tileSourceOffset } from './window-chrome-rules.mjs';
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

const tilePixels = { pixels1px: 0, pixelsWhole: 0, pixelsForward: 0, pixelsReverse: 0 };
const reverseBySlug = {};
for (const slug of SLICED) {
  test(`${slug}: END-based cells, 1:1 corner, part-code widths, 0x5178 halves and direction-anchored 0xfeae opaque tiles at sampled sizes`, () => {
    const { totals, failures } = checkTheme(corpus.get(slug), runtime);
    assert.deepEqual(failures, []);
    assert.ok(totals.cells > 0 && totals.halves > 0, JSON.stringify(totals));
    for (const k of Object.keys(tilePixels)) tilePixels[k] += totals[k];
    reverseBySlug[slug] = totals.pixelsReverse;
  });
}
test('0xfeae pixel checks are nonvacuous per class: 1px runs, whole copies, forward and reverse (11/14) >1px tiling', () => {
  assert.ok(tilePixels.pixels1px > 1e6 && tilePixels.pixelsWhole > 1e6 && tilePixels.pixelsForward > 1e6, JSON.stringify(tilePixels));
  // Only animals and monkey-paradise ship 11/14 cells with >1px partial runs
  // (kdef231-reference.md §5.1 corpus scope).
  assert.deepEqual(Object.keys(reverseBySlug).filter(s => reverseBySlug[s] > 0).sort(), ['animals', 'monkey-paradise']);
});

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
  const pixels = edge([[1, 2], [8, 1], [1, 2]], 20); // 1px run: direction-independent
  pixels.composed.buffer.setPixel(5, 0, 1, 2, 3, 255);
  assert.match(checkComposition(pixels).failures.join(), /0xfeae/);
});

test('0xfeae offset formula: forward k % sw, reverse flush at the far end; equal when dw is a multiple of sw', () => {
  assert.deepEqual([...Array(8).keys()].map(k => tileSourceOffset(k, 3, 8, false)), [0, 1, 2, 0, 1, 2, 0, 1]);
  assert.deepEqual([...Array(8).keys()].map(k => tileSourceOffset(k, 3, 8, true)), [1, 2, 0, 1, 2, 0, 1, 2]);
  assert.deepEqual([...Array(2).keys()].map(k => tileSourceOffset(k, 6, 2, true)), [4, 5]); // shorter than the source: trailing pixels
  for (let k = 0; k < 9; k++) assert.equal(tileSourceOffset(k, 3, 9, true), tileSourceOffset(k, 3, 9, false));
});

// Mutations: repaint one cell of a correct composition with a wrong blit and
// require the checker to reject it.
function repaint(fixture, code, sourceOffset) {
  const { cicn, composed } = fixture, buffer = new PixelBuffer(composed.buffer.width, composed.buffer.height, new Uint8ClampedArray(composed.buffer.data));
  const p = composed.placement.find(q => q.edge === 'top' && q.code === code);
  for (let k = 0; k < p.rects[0].w; k++) for (let t = 0; t < p.src.h; t++) {
    const [r, g, b, a] = cicn.getPixel(p.src.x + sourceOffset(k, p.src.w, p.rects[0].w), p.src.y + t);
    buffer.setPixel(p.rects[0].x + k, p.rects[0].y + t, r, g, b, a);
  }
  return checkComposition({ ...fixture, composed: { ...composed, buffer } }).failures.join();
}
test('rule checker rejects forward tiling for 11/14 and scaling for any tile cell', () => {
  // A 3px tile (12) leaves a truncation remainder for a 4px code-8 grower and
  // a 3px code-14 remainder cell. At width 33 neither run is a whole multiple.
  const ok = edge([[1, 2], [12, 3], [8, 4], [14, 3], [1, 2]], 33);
  assert.deepEqual(ok.composed.placement.filter(p => p.edge === 'top').map(p => p.rects[0].w), [2, 12, 15, 2, 2]);
  assert.deepEqual(checkComposition(ok).failures, []);
  assert.match(repaint(ok, 14, (k, sw) => k % sw), /p14 .* reverse tile/);
  const scaled = (k, sw, dw) => Math.min(sw - 1, Math.floor(k * sw / dw));
  assert.match(repaint(ok, 14, scaled), /p14 .* reverse tile/);
  assert.match(repaint(ok, 8, scaled), /p8 .* forward tile/);
  assert.match(repaint(ok, 8, (k, sw, dw) => tileSourceOffset(k, sw, dw, true)), /p8 .* forward tile/);
});

test('author-label predicate fires on contradicting labels', () => {
  assert.match(stateLabelContradiction('active', 'Document Window Inactive'), /active frame/);
  assert.match(stateLabelContradiction('inactive', 'Dialog Active'), /inactive frame/);
  assert.equal(stateLabelContradiction('inactive', 'Inactive Dialog'), null);
  assert.equal(stateLabelContradiction('active', 'Movable Modal'), null);
});

// UNDECODED, recorded as an observation (not an expectation): at its template
// minimum the runtime's titled-half split (distributeSide) overruns and clips.
// 0x4fa8..0x50fa centre the title, and 1138's plate is off-centre (x=46 vs
// 51.5), so the original small-window result is unknown. Do not "fix" toward
// any value without a reviewed decode.
test('observation: 1138 document-window top at template size places 107px in a 103px window', () => {
  const d = corpus.get('1138'), wt = d.manifest.windowTypes['document-window'];
  const a = d.assets.find(x => x.path === wt.chrome.active), [l, t, r, b] = wt.parts['part-0'].rect;
  const c = composeWindowChrome(new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, r - l, b - t);
  assert.deepEqual([c.placement.filter(p => p.edge === 'top').reduce((s, p) => s + p.rects[0].w, 0), c.fullWidth], [107, 103]);
});

// A decode disagreement, preserved as a failing case rather than fixed.
// Remove `todo` only with an independently reviewed kDEF interpretation.
test('code 10 on an untitled side collapses: 0x4a0c returns the caller flag #1 (0x4db4/0x515e), 0x5306 leaves width 0', {
  todo: 'runtime classifies 10 as FIXED (faithfulness ledger 0x4a0c ✗, deliberate); collapsing needs the unimplemented 0x632e/0x6062 widget pass, whose placement depends on side-list widths via 0x5cb6 (kdef231-reference.md §5.1)',
}, () => {
  const c = edge([[8, 1], [10, 4], [1, 2]], 20);
  assert.deepEqual(c.composed.placement.filter(p => p.edge === 'top').map(p => p.rects[0].w), [18, 0, 2]);
});
