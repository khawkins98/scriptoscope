import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import '../helpers/registerTs.mjs';
import {
  CANONICAL_WND, CORNER_SPRITE, SLICED, DECLARED_FLAGS, MUTATIONS, TITLE_SAMPLES, ladderSelection, checkTheme, checkComposition,
  layoutWindow, cellRects, remap, stateLabelContradiction, tileSourceOffset, TILE_REVERSE, widgetStrip, emptyTotals, xywh, stripSource,
} from './window-chrome-rules.mjs';
// The runtime under test (injected into the rule table; the rules import nothing from src/).
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
const cicnOf = (d, wt, state = 'active') => { const a = d.assets.find(x => x.path === wt.chrome[state]); return new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)); };
const sliced = slug => Object.entries(corpus.get(slug).manifest.windowTypes).filter(([, wt]) => !wt.model);
const UNTITLED = TITLE_SAMPLES[0];
/** Compose one window and check it; `size` is the content offset from the template body. */
function one(slug, key, { dw = 0, dh = 0, title = UNTITLED, state = 'active', mutation, strip: useStrip = true, pixels = true } = {}) {
  const d = corpus.get(slug), wt = d.manifest.windowTypes[key], cicn = cicnOf(d, wt, state), strip = useStrip ? widgetStrip(d, PixelBuffer) : null;
  const [l, t, r, b] = wt.parts['part-0'].rect, content = { w: Math.max(0, r - l + dw), h: Math.max(0, b - t + dh) };
  const popupFamily = key === 'popup-window', flags = { ...DECLARED_FLAGS, popupFamily, drawActive: state === 'active' };
  const composed = composeWindowChrome(cicn, wt, content.w, content.h, { popupFamily, active: state === 'active', widgetCicn: strip,
    titleWidthPx: title.SW, titleLength: title.titleLen, ...(title.SWc !== undefined ? { titleWidthCondensedPx: title.SWc } : {}) });
  return { wt, cicn, composed, strip, content, ...checkComposition({ cicn, windowType: wt, composed, content, title, flags, strip, pixels, hits: !!strip || mutation === 'noStripGate', mutation }) };
}

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

// ── The full rule table over the corpus ─────────────────────────────────────
// Per composition: the window-widgets layout (LS, TS, AP, TT, PP, AW) gives
// every placed cell (CR), the title rect is T4 remapped (RM, TX3), every pixel
// of the structure is the WD4 replay (sides top, bottom, left, right; tile
// blits through CopyMask; unpainted leading and trailing regions stay 0,0,0,0),
// and every pixel of each widget's rect answers the HT rows with the archive's
// own −14330 strip.
const corpusTotals = emptyTotals(), bySlug = {};
for (const slug of SLICED) {
  test(`${slug}: window-widgets layout, CR cells, RM title rect, WD4 CopyMask pixels and HT hits at sampled sizes and titles`, () => {
    const { totals, failures } = checkTheme(corpus.get(slug), runtime);
    assert.deepEqual(failures, []);
    assert.ok(totals.cells > 0 && totals.pixels > 0 && totals.titleRects === totals.compositions && totals.hits > 0, JSON.stringify(totals));
    for (const [k, v] of Object.entries(totals)) corpusTotals[k] += v;
    bySlug[slug] = totals;
  });
}
test('corpus rule coverage is nonvacuous for every new row', () => {
  const t = corpusTotals;
  assert.equal(Object.keys(bySlug).length, SLICED.length, 'per-archive checks ran first');
  // AW8 negative budgets, LS9 sides ending off P[N], TT8, TT10, AP1, TS1.
  assert.ok(t.negativeBudget > 1000 && t.shortSides > 100 && t.tt8 > 100 && t.untitledPlates > 1000 && t.popupSides > 1000 && t.tooShortSides > 1000, JSON.stringify(t));
  // WD4 order: pixels two sides paint with different values; Q3: unpainted structure pixels.
  assert.ok(t.orderSensitive > 10000 && t.unpaintedFrame > 1e6, JSON.stringify(t));
  // RM6 empties collapse boxes; HT8: mask-clear pixels inside a remapped rect do not hit.
  assert.ok(t.emptyCollapse > 100 && t.maskClearMisses > 1000 && t.hitPoints > 1e6, JSON.stringify(t));
  // TT2a: the runtime default condensed width (SWc = SW, F11) is reached: TT2 with room > 2 on the omitted-SWc sample.
  assert.ok(t.tt2Default > 1000, JSON.stringify(t));
  assert.ok(t.pixels1px > 1e6 && t.pixelsWhole > 1e6 && t.pixelsForward > 1e6, JSON.stringify(t));
  // Only animals and monkey-paradise ship 11/14 cells with >1px partial runs (kdef231-reference.md §5.1).
  assert.deepEqual(Object.keys(bySlug).filter(s => bySlug[s].pixelsReverse > 0).sort(), ['animals', 'monkey-paradise']);
});

// ── Tile direction discrimination (0xfeae, qd-primitives W2/W3, §5) ──────────
// Rerun the corpus pixel check against runtimes whose tile cells are repainted
// with a wrong blit, CopyMask-style (mask-set source pixels only), in side order.
// - flip11/14: the pre-fix runtime, with 11/14 tiled forward
// - inverted: every cell gets the opposite anchor
// - scaled: every cell is stretched instead of tiled
// An archive discriminates a mutation only if the check FAILS under it.
const BLIT_MUTATIONS = {
  'flip11/14': (k, sw, dw, c) => TILE_REVERSE.has(c) ? k % sw : tileSourceOffset(k, sw, dw, false),
  inverted: (k, sw, dw, c) => tileSourceOffset(k, sw, dw, !TILE_REVERSE.has(c)),
  scaled: (k, sw, dw) => Math.min(sw - 1, Math.floor(k * sw / dw)),
};
function repaintedRuntime(offset) {
  return { PixelBuffer, composeWindowChrome: (cicn, windowType, width, height, ...rest) => {
    const composed = composeWindowChrome(cicn, windowType, width, height, ...rest);
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const horizontal = edge === 'top' || edge === 'bottom';
      for (const p of composed.placement.filter(q => q.edge === edge)) {
        if (p.code === 18) continue;
        const s0 = horizontal ? p.src.x : p.src.y, sw = horizontal ? p.src.w : p.src.h, d0 = horizontal ? p.rects[0].x : p.rects[0].y, dw = horizontal ? p.rects[0].w : p.rects[0].h;
        const thick = horizontal ? p.src.h : p.src.w;
        if (dw <= 0 || sw <= 0) continue;
        for (let k = 0; k < dw; k++) for (let t = 0; t < thick; t++) {
          const off = offset(k, sw, dw, p.code);
          const [r, g, b, a] = horizontal ? cicn.getPixel(s0 + off, p.src.y + t) : cicn.getPixel(p.src.x + t, s0 + off);
          const x = horizontal ? d0 + k : p.rects[0].x + t, y = horizontal ? p.rects[0].y + t : d0 + k;
          if (a === 255 && x >= 0 && y >= 0 && x < composed.fullWidth && y < composed.fullHeight) composed.buffer.setPixel(x, y, r, g, b, a);
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
  for (const [name, offset] of Object.entries(BLIT_MUTATIONS)) {
    const runtimeUnderTest = repaintedRuntime(offset);
    // popup-window is left out: the repaint runs after the runtime's WD6 blits and would
    // overwrite them, which fails for a reason other than the tile anchor.
    table[name] = SLICED.filter(slug => checkTheme(corpus.get(slug), runtimeUnderTest, { titles: [UNTITLED], hits: false, filter: k => k !== 'popup-window' }).failures.length > 0);
  }
  for (const slug of SLICED) t.diagnostic(`${slug}: ${Object.keys(BLIT_MUTATIONS).map(m => `${m}=${table[m].includes(slug) ? 'FAILS' : 'passes'}`).join(' ')}`);
  assert.deepEqual(table['flip11/14'], ['animals', 'monkey-paradise']);
  assert.deepEqual(table.inverted, DISCRIMINATING);
  assert.deepEqual(table.scaled, DISCRIMINATING);
});

// ── Spec-row mutations (window-widgets §7.1): each row must be able to fail ──
// A mutation switches one row of the model to the refuted reading. The real
// runtime agrees with the unmutated model (above), so a mutated model that
// disagrees with the runtime on a sample is exactly a runtime implementing the
// refuted reading failing the check there.
// Each proof searches the window type's whole sample grid (sizes × titles × states).
const PROOFS = [
  ['clampBudget', '1138', 'document-window', /(left|right)\[\d+\] \(TS1,AP3[^)]*\): spec/],
  ['fullExtent', '1138', 'document-window', /top\[\d+\].*spec/],
  ['pinLast', 'floppies', 'collapsed-document-window', /right\[\d+\].*spec/],
  ['pinLast', 'animals', 'collapsed-no-title-utility', /right\[\d+\].*spec/],
  ['keepBezels', 'animals', 'document-window', /top\[\d+\].*TT10/],
  ['keepBezels', '1984', 'document-window', /top\[\d+\].*TT10/],
  ['keepBezels', 'floppies', 'document-window', /top\[\d+\].*TT10/],
  ['dropPlate', 'animals', 'document-window', /top\[\d+\].*TT10/],
  ['skipTT8', 'floppies', 'document-window', /top\[\d+\] \(AP2,TT10[^)]*\): spec/],
  ['reverseOrder', 'floppies', 'document-window', /pixel .*\[(top|bottom|left|right) p\d+/],
  ['opaque', '1138', 'document-window', /pixel /],
  ['paintTrailing', '1138', 'document-window', /pixel \(\d+,\d+\) \[(top|bottom|left|right) p1 forward tile\]/],
  ['rectHit', 'animals', 'document-window', /hit .*: spec (close|zoom|collapse), runtime null/],
  ['rectHit', '1138', 'document-window', /hit .*: spec (close|zoom|collapse), runtime null/],
  ['noStripGate', '1138', 'document-window', /hit .*: spec (close|zoom|collapse), runtime null/, { withoutStrip: true }],
  ['nearEdge', '1138', 'titled-utility-window', /near collapse: spec collapse, runtime null/],
  ['noWD6', '1138', 'popup-window', /pixel /],
  // TT2a (amended, F11): the omitted-SWc sample (SW 60, titleLen 12) puts R in (W − titleLen, W] on
  // animals' titled sides, so reverting the default to SW − titleLen narrows the plate there.
  ['tt2aCondense', 'animals', 'movable-alert', /SW60: top\[\d+\] \([^)]*TT2[^)]*\): spec/],
];
test('every spec-row mutation fails a corpus sample the unmutated rows pass', () => {
  assert.deepEqual(new Set(PROOFS.map(p => p[0])), new Set(Object.keys(MUTATIONS)));
  for (const [mutation, slug, key, pattern, opts = {}] of PROOFS) {
    const label = `${mutation} ${slug}/${key}`, filter = k => k === key;
    assert.deepEqual(checkTheme(corpus.get(slug), runtime, { ...opts, filter }).failures, [], `${label}: unmutated`);
    const failures = checkTheme(corpus.get(slug), runtime, { ...opts, filter, mutation }).failures;
    assert.ok(failures.length > 0, `${label}: the mutation must fail`);
    assert.match(failures.join('\n'), pattern, label);
  }
});

// ── RM6 / F1: a collapse box in a dropped code-10 cell is empty ─────────────
// §6.2: 11 collapse boxes lie wholly inside a code-10 segment. At the side's
// too-short threshold (E = F, TS2) the cell keeps its template width and the
// box is translated whole; one pixel below (TS1) the cell is dropped, RM6
// moves the bottom-right corner by the cell's far edge, and the box is empty:
// not drawn, not hit (HT7 needs the point in p).
test('RM6/F1: the 11 collapse boxes in code-10 cells are whole at the threshold and empty one pixel below it', () => {
  const SHRINK = { '1138': [10, 3, 3], animals: [164], 'apple-lisa': [5, 5, 5], 'windows-95': [2] }; // §6.2 table
  const found = [];
  for (const slug of SLICED) for (const [key, wt] of sliced(slug)) {
    if (!wt.parts['part-3']) continue;
    const d = corpus.get(slug), cicn = cicnOf(d, wt), [cl, ct, cr, cb] = wt.parts['part-3'].rect;
    const [l, t, r, b] = wt.parts['part-0'].rect, B = { left: 0, top: 0, right: cicn.width, bottom: cicn.height };
    const C0 = { left: l, top: t, right: r, bottom: b };
    const base = layoutWindow({ windowType: wt, B, C: C0, flags: DECLARED_FLAGS });
    for (const L of base.sides) if (L) for (let i = 1; i <= L.N; i++) {
      const { t: cell } = cellRects(base, L, i);
      if (L.codes[i] !== 10 || cl < cell.left || ct < cell.top || cr > cell.right || cb > cell.bottom) continue;
      const shrink = (L.S[L.N] - L.S[0]) - L.F; // §5 "Too-short threshold"
      found.push({ slug, key, edge: L.edge, shrink });
      const span = L.horizontal ? r - l : b - t;
      if (span - shrink - 1 < 0) continue; // animals titled-utility: the template is narrower than its shrink
      for (const [delta, dropped] of [[-shrink, false], [-shrink - 1, true]]) {
        const res = one(slug, key, L.horizontal ? { dw: delta } : { dh: delta }), label = `${slug}/${key} ${L.edge} ${delta}`;
        assert.deepEqual(res.failures, [], label);
        const side = res.layout.sides[L.side], p = remap(res.layout, { left: cl, top: ct, right: cr, bottom: cb });
        assert.equal(side.rows.has('TS1'), dropped, `${label}: TS1`);
        assert.equal(side.P[i] - side.P[i - 1], dropped ? 0 : L.horizontal ? cell.right - cell.left : cell.bottom - cell.top, `${label}: code-10 width`);
        const near = remap(res.layout, { left: cl, top: ct, right: cr, bottom: cb }, 'nearEdge');
        const hits = [];
        for (let y = near.top; y < near.bottom; y++) for (let x = near.left; x < near.right; x++) if (res.composed.hitWidget(x, y) === 'collapse') hits.push([x, y]);
        const listed = res.composed.widgets.filter(w => w.role === 'collapse' && w.rect.w > 0 && w.rect.h > 0);
        if (dropped) {
          assert.ok(p.right <= p.left || p.bottom <= p.top, `${label}: empty`);
          assert.deepEqual(hits, [], `${label}: no collapse hit at the old collapse point`);
          assert.deepEqual(listed, [], `${label}: no collapse press area`);
          // Mutation: the refuted near-edge reading keeps a full-size hit there.
          assert.match(one(slug, key, { ...(L.horizontal ? { dw: delta } : { dh: delta }), mutation: 'nearEdge' }).failures.join('\n'), /near collapse: spec collapse, runtime null/, `${label}: nearEdge must fail`);
        } else {
          assert.deepEqual([p.right - p.left, p.bottom - p.top], [cr - cl, cb - ct], `${label}: whole box`);
          assert.ok(hits.length > 0, `${label}: the box is hit`);
          assert.equal(listed.length, 1, `${label}: one collapse press area`);
        }
      }
    }
  }
  const bySlugShrink = {};
  for (const f of found) (bySlugShrink[f.slug] ??= []).push(f.shrink);
  // One entry per window type: the §6.2 rows list the collapsed variants with their pair.
  assert.equal(found.length, 11, JSON.stringify(found));
  for (const [slug, want] of Object.entries(SHRINK)) assert.deepEqual([...new Set(bySlugShrink[slug])].sort((a, b) => a - b), [...new Set(want)].sort((a, b) => a - b), slug);
});

// ── LS9: two AP3 sides end short of P[N] ────────────────────────────────────
const GROWER = [8, 11, 12, 18];
test('LS9: floppies collapsed-document-window right (no grower) and animals collapsed-no-title-utility right (code 12 only) end short of P[N]', () => {
  // Corpus scan from the recipes: AP3 sides (no code-5 anchor on a horizontal side) with no remainder recipient (AW2/AW3).
  const noRecipient = [];
  for (const slug of SLICED) for (const [key, wt] of sliced(slug)) for (const edge of ['top', 'bottom', 'left', 'right']) {
    const list = wt.edges?.[edge] ?? [], codes = list.slice(1).map(e => Number(e.part.slice(5)));
    if (!codes.length || (codes.includes(5) && (edge === 'top' || edge === 'bottom'))) continue;
    // LS9: no remainder recipient (AW2/AW3), and a budget that can be left over: no primary
    // grower at all (AW9), or code-12 tiles wider than 1 px (or of width 0, AW1a).
    const widthOf = j => list[j + 1].at - list[j].at;
    const tiles = codes.map((c, j) => c === 12 ? widthOf(j) : null).filter(w => w != null);
    const leftover = !codes.some(c => GROWER.includes(c)) || tiles.some(w => w !== 1);
    if (!codes.some(c => [8, 11, 13, 14, 18].includes(c)) && leftover) noRecipient.push(`${slug}/${key}/${edge}:${codes.join(',')}`);
  }
  assert.deepEqual(noRecipient.map(s => s.split(':')[0]).sort(), ['animals/collapsed-no-title-utility/right', 'floppies/collapsed-document-window/right'], noRecipient.join(' '));
  // floppies: no primary grower (AW9): the side ends at P[0] + F at every size.
  const fl = one('floppies', 'collapsed-document-window', { dh: 33 });
  assert.deepEqual(fl.failures, []);
  const fr = fl.layout.sides[3], frPlaced = fl.composed.placement.filter(p => p.edge === 'right');
  assert.ok(fr.rows.has('AW9'));
  assert.equal(frPlaced.at(-1).rects[0].y + frPlaced.at(-1).rects[0].h, fr.P[0] + fr.F);
  assert.equal(fr.PN - (fr.P[0] + fr.F), 33, 'P[N] moved by the content delta; the side did not');
  // animals: code 12 is the only grower (tile width 2): the side is short by the tile fraction.
  const an = one('animals', 'collapsed-no-title-utility', { dh: 33 });
  assert.deepEqual(an.failures, []);
  const ar = an.layout.sides[3], arPlaced = an.composed.placement.filter(p => p.edge === 'right');
  assert.equal(arPlaced.at(-1).rects[0].y + arPlaced.at(-1).rects[0].h, ar.PN - 1);
  // At even budgets the tiles fit and the side ends at P[N].
  const even = one('animals', 'collapsed-no-title-utility', { dh: 0 }).layout.sides[3];
  assert.equal(even.P[even.N], even.PN);
});

// ── LS7/LS9 sides end at P[N], not the window's drawn extent ────────────────
test('LS7/LS9: 1138 document-window top ends at P[N] = 102 in a 103 px window; the trailing column is unpainted', () => {
  const res = one('1138', 'document-window'), top = res.composed.placement.filter(p => p.edge === 'top');
  assert.deepEqual(res.failures, []);
  const S = res.wt.edges.top.map(e => e.at);
  assert.deepEqual([S[0], S.at(-1), res.composed.fullWidth], [1, 102, 103]);
  assert.deepEqual([top[0].rects[0].x, top.at(-1).rects[0].x + top.at(-1).rects[0].w], [1, 102]);
  // Q3: no full-draw routine paints [S[N], extent); only a crossing side could (here the right side starts below the top band).
  const right = res.composed.placement.filter(p => p.edge === 'right');
  const topBand = res.composed.frame.top, crossing = right.some(p => p.rects[0].y < topBand && p.rects[0].x <= 102);
  for (let y = 0; y < topBand; y++) if (!crossing) assert.equal(res.composed.buffer.getPixel(102, y)[3], 0, `(102,${y}) unpainted`);
  // The left side's list ends at S[N] = 26 against a 42 px drawn height: the side spans [P[0], P[N]) only.
  const left = res.composed.placement.filter(p => p.edge === 'left'), L = res.layout.sides[2];
  assert.equal(left.at(-1).rects[0].y + left.at(-1).rects[0].h, L.PN);
});

// ── TT4 / TT10: untitled windows drop the bezels and keep the plate margin ──
test('TT4/TT10: untitled anchored sides: code-6 bezels get 0, the plate keeps W = its margins around T4 (52 zero, 9 positive, 9 TT8)', () => {
  const plates = { zero: [], positive: [], negative: [] };
  for (const slug of SLICED) for (const [key, wt] of sliced(slug)) {
    const top = wt.edges?.top ?? [], codes = top.map(e => Number(e.part.slice(5))), a = codes.lastIndexOf(5);
    if (a < 1 || key === 'popup-window') continue;
    const S = top.map(e => e.at), t4 = (wt.parts['part-4'] ?? wt.parts['part-0']).rect;
    const W = (t4[0] - S[a - 1]) + (S[a] - t4[2]); // LS6 with SW = 0
    plates[W === 0 ? 'zero' : W > 0 ? 'positive' : 'negative'].push(`${slug}/${key}`);
  }
  assert.deepEqual([plates.zero.length, plates.positive.length, plates.negative.length], [52, 9, 9], JSON.stringify(plates));
  assert.deepEqual([...new Set(plates.negative.map(s => s.split('/')[0]))].sort(), ['1138', 'floppies']);
  for (const [slug, plate] of [['animals', 5], ['1984', 0], ['floppies', null]]) {
    const res = one(slug, 'document-window');
    assert.deepEqual(res.failures, [], slug);
    const L = res.layout.sides[0], a = L.anchor;
    assert.ok(L.rows.has('TT10'), slug);
    const top = res.composed.placement.filter(p => p.edge === 'top');
    const bezels = top.filter(p => p.code === 6);
    // floppies: TT8 moves the anchor's far border onto its bezel, which then has no template pixels and is not reported.
    assert.ok((plate == null || bezels.length > 0) && bezels.every(p => p.rects[0].w === 0), `${slug}: bezels not drawn`);
    const anchorCell = top.find(p => p.segment === a);
    if (plate != null) assert.equal(anchorCell.rects[0].w, plate, `${slug}: plate width`);
    else { // TT8: W < 0, the anchor's working template borders become T4's
      assert.ok(L.rows.has('TT8'));
      const t4 = res.wt.parts['part-4'].rect;
      assert.deepEqual([anchorCell.src.x, anchorCell.src.x + anchorCell.src.w], [t4[0], t4[2]], `${slug}: TT8 working borders`);
    }
  }
});

// ── WD4 draw order (sides top, bottom, left, right) with CopyMask ───────────
test('WD4: the later side wins where sides overlap, through its mask; reversed order fails on 11 archives', () => {
  const failing = SLICED.filter(slug => checkTheme(corpus.get(slug), runtime, { mutation: 'reverseOrder', titles: [UNTITLED], hits: false }).failures.length > 0);
  // apple-lisa and windows-95: wherever two sides overlap they paint equal pixels (orderSensitive = 0).
  assert.deepEqual(failing, SLICED.filter(s => !['apple-lisa', 'windows-95'].includes(s)));
  assert.deepEqual(['apple-lisa', 'windows-95'].map(s => bySlug[s]?.orderSensitive), [0, 0]);
  const res = one('floppies', 'document-window');
  assert.ok(res.checked.orderSensitive > 0);
});

// ── Literal synthetic edges (cells are [code, width]) ───────────────────────
function edge(cells, width, parts = {}) {
  let end = 0;
  const top = [{ at: 0, part: 'part-0' }, ...cells.map(([code, size]) => ({ at: end += size, part: `part-${code}` }))];
  const cicn = PixelBuffer.alloc(end, 3);
  for (let x = 0; x < end; x++) for (let y = 0; y < 3; y++) cicn.setPixel(x, y, x * 7 % 256, y * 60, 100, 255);
  const windowType = { parts: { 'part-0': { rect: [0, 1, end, 3] }, ...parts }, edges: { top } };
  return { cicn, windowType, composed: composeWindowChrome(cicn, windowType, width, 2) };
}
const widths = c => c.composed.placement.filter(p => p.edge === 'top').map(p => p.rects[0].w);
const mutate = (fixture, f) => { const c = structuredClone({ placement: fixture.composed.placement }); f(c.placement.filter(p => p.edge === 'top')); return checkComposition({ ...fixture, composed: { ...fixture.composed, placement: c.placement } }).failures.join(); };
test('rule checker rejects START-based cells, primary shares for 13/14, untruncated tiles and wrong pixels', () => {
  const ok = edge([[1, 2], [12, 3], [13, 1], [8, 2], [1, 2]], 31);
  assert.deepEqual(checkComposition(ok).failures, []);
  // AW1–AW3, AW7 by hand: budget 31 − 4 = 27, share 13, pool 1 + 13 % 3 = 2; code 13 gets 1, code 8 13 + 1.
  assert.deepEqual(widths(ok), [2, 12, 1, 14, 2]);
  assert.match(mutate(ok, p => { p[1].code = 1; p[0].code = 12; }), /top\[1\].*spec/);
  assert.match(mutate(ok, p => { p[2].rects[0].w += 1; p[3].rects[0].w -= 1; p[3].rects[0].x += 1; }), /top\[3\].*spec/);
  assert.match(mutate(ok, p => { p[1].rects[0].w = 10; p[2].rects[0].x += 1; p[2].rects[0].w -= 1; }), /top\[2\].*spec/);
  const pixels = edge([[1, 2], [8, 1], [1, 2]], 20); // 1px run: direction-independent
  pixels.composed.buffer.setPixel(5, 0, 1, 2, 3, 255);
  assert.match(checkComposition(pixels).failures.join(), /pixel \(5,0\) \[top p8 forward tile\]/);
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
  assert.deepEqual(widths(ok), [2, 12, 15, 2, 2]);
  assert.deepEqual(checkComposition(ok).failures, []);
  assert.match(repaint(ok, 14, (k, sw) => k % sw), /p14 reverse tile/);
  const scaled = (k, sw, dw) => Math.min(sw - 1, Math.floor(k * sw / dw));
  assert.match(repaint(ok, 14, scaled), /p14 reverse tile/);
  assert.match(repaint(ok, 8, scaled), /p8 forward tile/);
  assert.match(repaint(ok, 8, (k, sw, dw) => tileSourceOffset(k, sw, dw, true)), /p8 forward tile/);
});

test('author-label predicate fires on contradicting labels', () => {
  assert.match(stateLabelContradiction('active', 'Document Window Inactive'), /active frame/);
  assert.match(stateLabelContradiction('inactive', 'Dialog Active'), /inactive frame/);
  assert.equal(stateLabelContradiction('inactive', 'Inactive Dialog'), null);
  assert.equal(stateLabelContradiction('active', 'Movable Modal'), null);
});

// Code 10 (PV5, TS1, TS2): fixed at and above the side's too-short threshold,
// width 0 below it. Hand trace for [8:1, 10:4, 1:2] on AP3: F = 6.
// Width 20: E = 20 ≥ 6, budget 14 → [14, 4, 2]. Width 5: 5 < 6 → TS1, F = 2,
// budget 3 → [3, 0, 2]. Width 6: E = F, TS2 → [0, 4, 2].
test('code 10 is fixed at and above the template and dropped below it (TS1, TS2, PV5)', () => {
  const rows = c => checkComposition(c).layout.sides[0].rows;
  const wide = edge([[8, 1], [10, 4], [1, 2]], 20), short = edge([[8, 1], [10, 4], [1, 2]], 5), at = edge([[8, 1], [10, 4], [1, 2]], 6);
  assert.deepEqual([widths(wide), widths(short), widths(at)], [[14, 4, 2], [3, 0, 2], [0, 4, 2]]);
  for (const c of [wide, short, at]) assert.deepEqual(checkComposition(c).failures, []);
  assert.deepEqual([rows(wide).has('TS1'), rows(short).has('TS1'), rows(at).has('TS1')], [false, true, false]);
  // PV2: a close gap counts in F while hasClose (the declared default), not otherwise.
  const gated = { edges: { top: [{ at: 0, part: 'part-0' }, { at: 4, part: 'part-10' }, { at: 8, part: 'part-2' }] }, parts: { 'part-0': { rect: [0, 1, 8, 3] } } };
  const C = { left: 0, top: 1, right: 6, bottom: 3 }, B = { left: 0, top: 0, right: 8, bottom: 3 };
  assert.ok(layoutWindow({ windowType: gated, B, C }).sides[0].rows.has('TS1'));
  assert.ok(!layoutWindow({ windowType: gated, B, C, flags: { ...DECLARED_FLAGS, hasClose: false } }).sides[0].rows.has('TS1'));
  // AP1: a popup-family side with a code-5 anchor never runs the too-short step.
  const popup = { edges: { top: [{ at: 0, part: 'part-0' }, { at: 4, part: 'part-10' }, { at: 5, part: 'part-5' }, { at: 6, part: 'part-1' }] }, parts: { 'part-0': { rect: [0, 1, 6, 3] } } };
  const rp = layoutWindow({ windowType: popup, B, C: { left: 0, top: 1, right: 2, bottom: 3 }, flags: { ...DECLARED_FLAGS, popupFamily: true } }).sides[0].rows;
  assert.ok(rp.has('AP1') && !rp.has('TS1'));
});
test('rule checker rejects a code-10 cell kept (below template) or dropped (above template)', () => {
  // The pre-fix runtime kept 10 fixed below the minimum: [0, 4, 2] in 5px.
  assert.match(mutate(edge([[8, 1], [10, 4], [1, 2]], 5), p => { p[0].rects[0].w = 0; p[1].rects[0].x = 0; p[1].rects[0].w = 4; p[2].rects[0].x = 4; }), /top\[2\].*TS1/);
  assert.match(mutate(edge([[8, 1], [10, 4], [1, 2]], 20), p => { p[0].rects[0].w = 18; p[1].rects[0].x = 18; p[1].rects[0].w = 0; p[2].rects[0].x = 18; }), /top\[1\].*spec/);
});
test('AW8: a negative budget is not clamped; growers go negative and later borders move back', () => {
  // [1:3, 12:10, 14:1, 1:2] in 1 px: E = 1 < F = 5 (TS1, D = 0); budget −4, share −4,
  // tile −4 − (−4 % 10) = 0, pool −4 → code 14 gets −4. The side still ends at P[N] = 1.
  const c = edge([[1, 3], [12, 10], [14, 1], [1, 2]], 1);
  assert.deepEqual(widths(c), [3, 0, -4, 2]);
  assert.deepEqual(checkComposition(c).failures, []);
  assert.ok(checkComposition(c).layout.sides[0].rows.has('AW8'));
  assert.match(checkComposition({ ...c, mutation: 'clampBudget' }).failures.join(), /top\[3\].*spec/);
});
test('AW1a: a width-0 code-12 cell gets 0, adds nothing to the remainder, and costs the side one primary share (LS9)', () => {
  // [8:1, 12:0, 12:3, 1:2] in 20 px: F = 2, budget 18 over 3 primaries, share 6; 12:3 → 6;
  // 8 → 6 + 0. The side ends at 14, one share short of P[N] = 20.
  const c = edge([[8, 1], [12, 0], [12, 3], [1, 2]], 20), L = checkComposition(c).layout.sides[0];
  assert.deepEqual(checkComposition(c).failures, []);
  assert.deepEqual(L.P, [0, 6, 6, 12, 14]);
  assert.deepEqual(c.composed.placement.filter(p => p.edge === 'top').map(p => [p.segment, p.rects[0].x, p.rects[0].w]), [[1, 0, 6], [3, 6, 6], [4, 12, 2]]);
});
test('HT8 press point used by theme-ordering.spec: windows-95 document-window zoom art is mask-set over its whole source', () => {
  const d = corpus.get('windows-95'), wt = d.manifest.windowTypes['document-window'], strip = widgetStrip(d, PixelBuffer), s = stripSource(wt, 'zoom');
  assert.deepEqual([s.right - s.left, s.bottom - s.top], [16, 14]);
  for (let y = s.top; y < s.bottom; y++) for (let x = s.left; x < s.right; x++) assert.equal(strip.getPixel(x, y)[3], 255, `${x},${y}`);
});

// ── WD6: the popup-family raw blits ─────────────────────────────────────────
// The corpus check above replays WD6 for every popup-window sample (all 13
// popup-window rect lists carry types 5 and 6; §6.2 corrected). This row shows
// the pixels can tell: without WD6, the replay disagrees with the runtime on
// popup windows, and the WD6 blits change pixels the sides painted.
test('WD6: popup-family windows get the three raw template blits after the sides; skipping them fails the pixel check', () => {
  const failing = SLICED.filter(slug => checkTheme(corpus.get(slug), runtime, { mutation: 'noWD6', filter: k => k === 'popup-window', titles: [UNTITLED], hits: false }).failures.length > 0);
  assert.deepEqual(failing, SLICED, failing.join());
  const res = one('1138', 'popup-window', { dw: 97, dh: 33, mutation: 'noWD6' });
  assert.match(res.failures.join('\n'), /pixel /);
  // Not for other window types: WD6 runs only for popupFamily.
  assert.deepEqual(one('1138', 'document-window', { dw: 97, dh: 33, mutation: 'noWD6' }).failures, []);
});
test('keyboard subjects (window-widgets.spec): animals widget top-left strip pixels are mask-clear, 1138 mask-set', () => {
  for (const [slug, clear] of [['animals', true], ['1138', false]]) {
    const d = corpus.get(slug), wt = d.manifest.windowTypes['document-window'], strip = widgetStrip(d, PixelBuffer);
    for (const role of ['close', 'zoom', 'collapse']) { const s = stripSource(wt, role); assert.equal(strip.getPixel(s.left, s.top)[3] === 0, clear, `${slug} ${role}`); }
  }
});
