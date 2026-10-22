import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCorpus } from './tab-header-corpus.mjs';
import { ALL_ARCHIVES, HEADER_ARCHIVES, HEADER_ROWS, HEADER_VARIANTS, TAB_ARCHIVES, TAB_PUBLIC_ROWS, TAB_VARIANTS,
  diff, headerId, headerSurface, nativeForTab, parseCinf, selectTab, tabBody, tabState } from './tab-header-rules.mjs';

const corpus = await loadCorpus();
// Author labels (corpus-corroborated-ids.md): LSF panes -9978/-9977, SSF panes -9970/-9969.
const PANES = [-9978, -9977, -9970, -9969];
const tabFamily = id => id >= -9999 && id <= -9950, headerFamily = id => id >= -9570 && id <= -9560;

test('corpus partition from each archive\'s own resource map', () => {
  for (const [slug, { census }] of corpus) {
    const tabs = [...census.cicn].filter(tabFamily), headers = [...census.cicn].filter(headerFamily);
    if (TAB_ARCHIVES.includes(slug)) for (const id of [-9975, -9972]) assert.ok(census.cicn.has(id) && census.cinf.has(id), `${slug} ${id}`);
    else assert.deepEqual(tabs, [], slug);
    if (HEADER_ARCHIVES.includes(slug)) for (const id of [-9567, -9568]) assert.ok(census.cicn.has(id) && census.cinf.has(id), `${slug} ${id}`);
    else assert.deepEqual(headers, [], slug);
    // No archive ships the CDEF 8 fallback families (-9968..-9956) or a pressed front tab (-9979/-9971).
    assert.deepEqual(tabs.filter(id => id >= -9968 || id === -9979 || id === -9971), [], slug);
    // Only animals ships a tab-family cicn without same-id cinf (-9984, large disabled rear): 0x38e
    // would draw nothing there, the runtime's legacy path would draw. No public row reaches it.
    assert.deepEqual(tabs.filter(id => !PANES.includes(id) && !census.cinf.has(id)), slug === 'animals' ? [-9984] : [], slug);
    // Tab panes (-9978..-9969) are drawn by a caller this table does not decode; apple-platinum-2's have no cinf.
    assert.deepEqual(tabs.filter(id => PANES.includes(id) && !census.cinf.has(id)), slug === 'apple-platinum-2' ? [-9978, -9977, -9970, -9969] : [], slug);
  }
  assert.equal(TAB_ARCHIVES.length, 14); assert.equal(HEADER_ARCHIVES.length, 13);
});

test('own cinf parse agrees with the loader for the drawn ids (input identity, not a decoder check)', () => {
  for (const slug of TAB_ARCHIVES) for (const id of [-9975, -9972, ...(HEADER_ARCHIVES.includes(slug) ? [-9567, -9568] : [])]) {
    const { element, cinf, raster } = corpus.get(slug).art(id);
    assert.deepEqual([element.slice.corner, element.slice.side, element.slice.tile], [cinf.c, cinf.s, cinf.tile], `${slug} ${id}`);
    assert.deepEqual([element.bodyRequest.mode, element.bodyRequest.resourceId, ...element.bgAnchor], [cinf.mode, cinf.bodyId, ...cinf.sample], `${slug} ${id}`);
    assert.deepEqual([raster.width, raster.height], [element.width, element.height]);
    // Width-one band colours equal raster colours only under this record; every corpus face has it.
    assert.equal(element.samplingEquivalence.status, 'equivalent', `${slug} ${id}`);
  }
});

test('decode predictions for the public tab and header rows', () => {
  for (const [slug, { census }] of corpus) {
    const tabs = TAB_PUBLIC_ROWS.map(row => selectTab(nativeForTab(row), census));
    assert.deepEqual(tabs.map(t => t.id), TAB_ARCHIVES.includes(slug) ? [-9975, -9972] : [null, null], slug);
    assert.deepEqual(tabs.map(t => t.probes), [[-9975, -9959], [-9972, -9956]]);
    const ids = HEADER_ROWS.map(r => (census.cicn.has(headerId(r.drawState)) ? headerId(r.drawState) : null));
    assert.equal(ids.filter(Boolean).length, HEADER_ARCHIVES.includes(slug) ? 24 : 0, slug);
  }
  // Header bodies: pattern exactly where the archive ships the cinf+4 ppat.
  const patterned = HEADER_ARCHIVES.flatMap(slug => [-9567, -9568].filter(id => corpus.get(slug).census.ppat.has(corpus.get(slug).cinfOf(id).bodyId)).map(id => `${slug}/${id}`));
  assert.deepEqual(patterned, ['1990/-9567', '1990/-9568', 'animals/-9567', 'crayon-os/-9567', 'crayon-os/-9568', 'evolution/-9567', 'evolution/-9568', 'monkey-paradise/-9567']);
  assert.equal(corpus.get('dolphin-som').cinfOf(-9567).bodyId, -9567); // requested, not shipped: solid body
});

test('decoded CDEF 8 branches the public API does not reach', () => {
  assert.deepEqual([{}, { hilite: 254 }, { hilite: 255 }, { hilite: 10 }, { tabEnabled: false }, { tracking: true }, { tracking: true, hilite: 255 }].map(tabState), [1, 0, 0, 1, 0, 2, 0]);
  assert.deepEqual([{ selected: true }, { selected: true, hilite: 255 }, { selected: true, tracking: true }].map(tabState), [4, 3, 5]);
  const all = ids => ({ cicn: new Set(ids), cinf: new Set(ids) });
  assert.equal(selectTab({ variant: 'large', state: 4 }, all([-9980])).id, -9980);
  assert.equal(selectTab({ variant: 'small', state: 0 }, all([-9976])).id, -9976);
  // Small miss probes -9960+state, never the large id: the runtime's small->large retry is policy.
  assert.deepEqual(selectTab({ variant: 'small', state: 4 }, all([-9980, -9956])), { id: -9956, drawn: true, probes: [-9972, -9956] });
  assert.equal(selectTab({ variant: 'small', state: 4 }, all([-9980])).id, null);
  // A found icon without cinf stops the ladder and draws nothing (0x38e).
  assert.deepEqual(selectTab({ variant: 'small', state: 1 }, { cicn: new Set([-9975, -9959]), cinf: new Set([-9959]) }), { id: -9975, drawn: false, probes: [-9975, -9959] });
  assert.deepEqual([0, 1, 2, 0x80000000, 0xffffffff].map(headerId), [-9568, -9567, -9567, -9567, -9567]);
});

// Literal fixtures: letters are distinct opaque colours, '.' transparent.
const PAL = Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((k, i) => [k, [i * 9 + 3, 250 - i * 7, 40 + i, 255]]));
const img = rows => ({ width: rows[0].length, height: rows.length, rgba: Uint8ClampedArray.from(rows.flatMap(r => [...r].flatMap(k => (k === '.' ? [0, 0, 0, 0] : PAL[k])))) });
const show = e => Array.from({ length: e.height }, (_, y) => Array.from({ length: e.width }, (_, x) => {
  const i = y * e.width + x; if (!e.known[i]) return '?'; const p = [...e.rgba.subarray(i * 4, i * 4 + 4)];
  return p[3] ? Object.keys(PAL).find(k => PAL[k].every((v, j) => v === p[j])) ?? '#' : '.';
}).join(''));

test('tab body model: ends, first-column bands, overlap order and separate centre (literal rows)', () => {
  const src = img(['LAMBR', 'LCMDR', 'LE.FR', 'LGMHR', 'LIMJR', 'LKMNR']);
  const cinf = { c: 1, s: 2, tile: false, bodyId: 0 };
  assert.deepEqual(show(tabBody(src, cinf, 8, { bg: PAL.Z.slice(0, 3) })), ['LAAAAAAR', 'LCCCCCCR', 'LZZZZZZR', 'LZZZZZZR', 'LIIIIIIR', 'LKKKKKKR']);
  assert.deepEqual(show(tabBody(src, { ...cinf, tile: true }, 8, { bg: PAL.Z.slice(0, 3) })), ['LAMBAMBR', 'LCMDCMDR', 'LZZZZZZR', 'LZZZZZZR', 'LIMJIMJR', 'LKMNKMNR']);
  // 2s > H: the bands overlap on identical source rows (order is not pixel-visible); no centre.
  assert.deepEqual(show(tabBody(src, { ...cinf, s: 4 }, 6, {})), ['LAAAAR', 'LCCCCR', 'LEEEER', 'LGGGGR', 'LIIIIR', 'LKKKKR']);
  // Pattern centres and unverified width-one sampling are unknown, not guessed.
  assert.deepEqual(show(tabBody(src, { ...cinf, bodyId: 17 }, 8, {})).slice(2, 4), ['L??????R', 'L??????R']);
  assert.deepEqual(show(tabBody(src, cinf, 8, { bg: [0, 0, 0], sampling: 'different' }))[0], 'L??????R');
  for (const [name, { body }] of Object.entries(TAB_VARIANTS)) if (body)
    assert.notDeepEqual(show(tabBody(src, cinf, 8, { bg: PAL.Z.slice(0, 3), variant: body })), show(tabBody(src, cinf, 8, { bg: PAL.Z.slice(0, 3) })), name);
});

test('header model: transposed insets, border order, list-view extension and pattern anchor (literal rows)', () => {
  const src = img(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST', 'UVWXY']);
  const cinf = { c: 2, s: 1, tile: false, mode: 0, bodyId: 0 };
  const opts = { kind: 'window-header', width: 7, height: 6, bg: PAL.Z.slice(0, 3) };
  assert.deepEqual(show(headerSurface(src, cinf, opts)), ['ABCCCDE', 'FGZZZIJ', 'KZZZZZO', 'KZZZZZO', 'PQZZZST', 'UVWWWXY']);
  // List-view paints one row taller and clips: the bottom border is not visible.
  assert.deepEqual(show(headerSurface(src, cinf, { ...opts, kind: 'list-view-header' })).slice(4), ['KZZZZZO', 'PQZZZST']);
  const pat = img(['AB', 'CD']);
  const at = (mode, origin) => show(headerSurface(src, { ...cinf, mode, c: 0, s: 0 }, { ...opts, width: 3, height: 2, pattern: pat, origin }));
  assert.deepEqual(at(0, [0, 0]), ['ABA', 'CDC']); assert.deepEqual(at(0, [1, 0]), ['BAB', 'DCD']);
  assert.deepEqual(at(1, [1, 0]), ['ABA', 'CDC']); assert.deepEqual(at(2, [0, 0]), ['BAB', 'DCD']);
  // Asymmetric c1/s2 fixture: bands overlap each other and the transposed inset, and the middle is three columns wide.
  const asym = { ...cinf, c: 1, s: 2 };
  for (const [name, { body }] of Object.entries(HEADER_VARIANTS)) if (body) {
    const [k, o] = name === 'pattern anchor ignored' ? [{ ...cinf, mode: 2, c: 0, s: 0 }, { ...opts, width: 3, height: 2, pattern: pat }]
      : name === 'no list-view extension' ? [asym, { ...opts, kind: 'list-view-header' }] : [asym, opts];
    // The transposed inset is visible only through band mask holes.
    const from = name === 'single inset body' ? img(['ABCDE', 'F...J', 'K...O', 'P...T', 'UVWXY']) : src;
    assert.notDeepEqual(show(headerSurface(from, k, { ...o, variant: body })), show(headerSurface(from, k, o)), name);
  }
});

test('diff fails wrong size, null, alpha and colour, and skips only unknown pixels', () => {
  const e = tabBody(img(['AB', 'CD']), { c: 1, s: 1, tile: false, bodyId: 0 }, 2, {}), same = { width: 2, height: 2, rgba: e.rgba.slice() };
  assert.equal(diff(e, same).equal, true);
  assert.match(diff(e, null).reason, /null/); assert.match(diff(e, { ...same, width: 1 }).reason, /size/);
  const alpha = same.rgba.slice(); alpha[3] = 0; assert.equal(diff(e, { ...same, rgba: alpha }).mismatched, 1);
  const colour = same.rgba.slice(); colour[4] ^= 1; assert.equal(diff(e, { ...same, rgba: colour }).mismatched, 1);
  e.known[1] = 0; assert.deepEqual([diff(e, { ...same, rgba: colour }).equal, diff(e, same).unknown], [true, 1]);
});

test('docs carry the transcribed corpus rule table', () => {
  for (const [doc, needles] of [['tab-cdef8-body.md', ['0x18c–0x194', '0x38e', '0x914', '-9960+state', 'A8B2']], ['header-surface.md', ['0xc1e8–0xc1f8', 'Corpus rule table', '0x7156–0x719e']]]) {
    const text = readFileSync(new URL(`../../docs/spec/${doc}`, import.meta.url), 'utf8');
    for (const n of needles) assert.ok(text.includes(n), `${doc}: ${n}`);
  }
  assert.equal(ALL_ARCHIVES.length, 18);
});
