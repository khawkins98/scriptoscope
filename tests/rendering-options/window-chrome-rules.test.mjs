import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import '../helpers/registerTs.mjs';
import { CANONICAL_WND, CORNER_SPRITE, SLICED, ladderSelection, checkTheme, checkComposition, decodeCells, allocateHalf, sideTooShort, stateLabelContradiction, tileSourceOffset, TILE_REVERSE } from './window-chrome-rules.mjs';
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
// Per-archive discrimination: rerun the corpus check against runtimes whose
// tile cells are repainted with a wrong blit, CopyMask-style (opaque source
// pixels only), inside the same side-bar windows the checker reads.
// - flip11/14: the pre-fix runtime, with 11/14 tiled forward
// - inverted: every cell gets the opposite anchor
// - scaled: every cell is stretched instead of tiled
// An archive discriminates a mutation only if the check FAILS under it. Bucket
// counts alone do not show this: apple-lisa and windows-95 have forward >1px
// pixels yet pass every mutation, because their sources are uniform along the run.
const MUTATIONS = {
  'flip11/14': (k, sw, dw, code) => TILE_REVERSE.has(code) ? k % sw : tileSourceOffset(k, sw, dw, false),
  inverted: (k, sw, dw, code) => tileSourceOffset(k, sw, dw, !TILE_REVERSE.has(code)),
  scaled: (k, sw, dw) => Math.min(sw - 1, Math.floor(k * sw / dw)),
};
function mutatedRuntime(offset) {
  return { PixelBuffer, composeWindowChrome: (cicn, windowType, width, height, ...rest) => {
    const composed = composeWindowChrome(cicn, windowType, width, height, ...rest);
    const { frame, fullWidth: W, fullHeight: H, buffer } = composed;
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const recipe = windowType.edges?.[edge] ?? [], thickness = frame[edge];
      if (!recipe.length || thickness <= 0) continue;
      const horizontal = edge === 'top' || edge === 'bottom', [lo, hi] = horizontal ? [0, W] : [frame.top, H - frame.bottom];
      for (const p of composed.placement.filter(q => q.edge === edge).slice(0, decodeCells(recipe).length)) {
        if (p.code === 18) continue;
        const s0 = horizontal ? p.src.x : p.src.y, sw = horizontal ? p.src.w : p.src.h, d0 = horizontal ? p.rects[0].x : p.rects[0].y, dw = horizontal ? p.rects[0].w : p.rects[0].h;
        if (dw <= 0 || sw <= 0) continue;
        for (let k = 0; k < dw; k++) {
          if (d0 + k < lo || d0 + k >= hi) continue;
          const off = offset(k, sw, dw, p.code);
          for (let t = 0; t < thickness; t++) {
            const [r, g, b, a] = horizontal ? cicn.getPixel(s0 + off, p.src.y + t) : cicn.getPixel(p.src.x + t, s0 + off);
            if (a === 255) buffer.setPixel(horizontal ? d0 + k : p.rects[0].x + t, horizontal ? p.rects[0].y + t : d0 + k, r, g, b, a);
          }
        }
      }
    }
    return composed;
  } };
}
// Expected discriminating archives (reviewed in campaign-20261021 lanes/H/PR-REVIEW.json).
const DISCRIMINATING = ['1990', 'animals', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise'];
test('per-archive discrimination: flip11/14 fails only animals and monkey-paradise; inverted and scaled fail exactly seven archives', t => {
  const table = {};
  for (const [name, offset] of Object.entries(MUTATIONS)) {
    const runtimeUnderTest = mutatedRuntime(offset);
    table[name] = SLICED.filter(slug => checkTheme(corpus.get(slug), runtimeUnderTest).failures.length > 0);
  }
  for (const slug of SLICED) t.diagnostic(`${slug}: ${Object.keys(MUTATIONS).map(m => `${m}=${table[m].includes(slug) ? 'FAILS' : 'passes'}`).join(' ')}`);
  assert.deepEqual(table['flip11/14'], ['animals', 'monkey-paradise']);
  assert.deepEqual(table.inverted, DISCRIMINATING);
  assert.deepEqual(table.scaled, DISCRIMINATING);
});

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

// Code 10 (docs/spec/compositor-spec.md, code 10 note): 0x5178 hands 0x49d6 its
// first flag argument (0x52fc), filled from 0x4a64's too-short byte, which
// only 0x4e0e sets, when the placed extent is below the fixed-cell sum.
// Hand trace for [8:1, 10:4, 1:2] on the non-title path (0x5148): fixed0 = 6.
// Width 20: not too short, budget 14 → [14, 4, 2]. Width 5: 5 < 6 → code 10
// dropped (fixed0 = 2), budget 3 → [3, 0, 2].
test('code 10 is fixed at and above the template and dropped below it (0x4dfe..0x4e0e, 0x52fc → 0x4a0c)', () => {
  const widths = c => c.composed.placement.filter(p => p.edge === 'top').map(p => p.rects[0].w);
  const wide = edge([[8, 1], [10, 4], [1, 2]], 20), short = edge([[8, 1], [10, 4], [1, 2]], 5);
  assert.deepEqual(widths(wide), [14, 4, 2]);
  assert.deepEqual(widths(short), [3, 0, 2]);
  assert.deepEqual(checkComposition(wide).failures, []);
  assert.deepEqual(checkComposition(short).failures, []);
  assert.equal(sideTooShort(short.windowType.edges.top, 5 - 7), true);
  assert.equal(sideTooShort(wide.windowType.edges.top, 20 - 7), false);
  // Boundary: extent == fixed0 is not too short (0x4e0c, signed greater-or-equal branch).
  assert.deepEqual(widths(edge([[8, 1], [10, 4], [1, 2]], 6)), [0, 4, 2]);
  // Widget-gated codes bound fixed0, so the verdict can be undetermined.
  assert.equal(sideTooShort([{ at: 0, part: 'part-0' }, { at: 4, part: 'part-10' }, { at: 8, part: 'part-2' }], -2), null);
  // Popup family with a code-5 anchor takes 0x4c64 and is never too short.
  assert.equal(sideTooShort([{ at: 0, part: 'part-0' }, { at: 4, part: 'part-10' }, { at: 5, part: 'part-5' }], -3, true), false);
});
test('rule checker rejects a code-10 cell kept (below template) or dropped (above template)', () => {
  const mutate = (fixture, f) => { const c = structuredClone({ placement: fixture.composed.placement }); f(c.placement.filter(p => p.edge === 'top')); return checkComposition({ ...fixture, composed: { ...fixture.composed, placement: c.placement } }).failures.join(); };
  // The pre-fix runtime kept 10 fixed below the minimum: [0, 4, 2] in 5px.
  assert.match(mutate(edge([[8, 1], [10, 4], [1, 2]], 5), p => { p[0].rects[0].w = 0; p[1].rects[0].x = 0; p[1].rects[0].w = 4; p[2].rects[0].x = 4; }), /p10: expected collapse/);
  assert.match(mutate(edge([[8, 1], [10, 4], [1, 2]], 20), p => { p[0].rects[0].w = 18; p[1].rects[0].x = 18; p[1].rects[0].w = 0; p[2].rects[0].x = 18; }), /p10: fixed 4px drawn 0px/);
});
test('corpus below-template sample reaches the too-short step and drops code-10 cells', () => {
  let tooShortSides = 0, code10 = 0, code10Zero = 0;
  for (const slug of SLICED) { const t = checkTheme(corpus.get(slug), runtime).totals; tooShortSides += t.tooShortSides; code10 += t.code10; code10Zero += t.code10Zero; }
  assert.ok(tooShortSides > 100 && code10Zero > 20 && code10 > code10Zero, JSON.stringify({ tooShortSides, code10, code10Zero }));
});
