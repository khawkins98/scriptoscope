import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { loadCorpus } from './tab-header-corpus.mjs';
import { ALL_ARCHIVES, HEADER_ARCHIVES, HEADER_ROWS, HEADER_VARIANTS, TAB_ARCHIVES, TAB_PUBLIC_ROWS, TAB_VARIANTS,
  diff, headerId, headerSurface, nativeForTab, selectTab, tabBody } from './tab-header-rules.mjs';

// The tab/header rule table of tab-header-rules.test.mjs, run against the public
// source and built composeTab / composeHeaderSurface. Expectations are computed
// here in Node from each archive's own resource map (ids, cinf bytes, ppat
// census) and the shared decoder's rasters; the page only returns output pixels.
const corpus = await loadCorpus();
const R = [0, 0];
const b64 = s => { const b = Buffer.from(s, 'base64'); return new Uint8ClampedArray(b.buffer, b.byteOffset, b.length); };

async function observe(page, mode) {
  return page.evaluate(async ({ mode, slugs, tabRows, headerRows, R }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const enc = buf => { let s = ''; const d = buf.data; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000)); return { width: buf.width, height: buf.height, rgba: btoa(s) }; };
    const out = {};
    for (const slug of slugs) {
      const theme = await api.loadTheme(`/themes/${slug}`);
      const tabs = [];
      for (const row of tabRows) {
        let trace; const buf = await api.composeTab(theme, { ...row, diagnostics: { correlationId: slug, onComplete: t => { trace = t; } } });
        tabs.push({ out: buf && enc(buf), path: trace?.tabBody?.path ?? null, probes: trace?.steps.filter(x => x.role === 'face' && x.action !== 'fallback').map(x => x.requestedId) ?? null });
      }
      const headers = [];
      for (const { kind, drawState, width, height, origin } of headerRows) {
        const r = await api.composeHeaderSurface(theme, { kind, drawState, width, height, compositionContext: {
          controlOrigin: origin, portOrigin: [0, 0], patternOrigin: { status: 'known', offset: R }, clip: { kind: 'unbounded' }, basis: 'caller-declared' } });
        headers.push(r.status === 'rendered' ? { status: r.status, out: enc(r.buffer) } : { status: r.status, reason: r.reason });
      }
      out[slug] = { tabs, headers };
      theme.dispose?.();
    }
    return out;
  }, { mode, slugs: ALL_ARCHIVES, tabRows: TAB_PUBLIC_ROWS, headerRows: HEADER_ROWS, R });
}

/** Expected tab body for cicn `id` of `slug`, at the observed width. */
function tabExpect(slug, id, W, variant = {}) {
  const a = corpus.get(slug).art(id);
  if (!a?.cinf) return null;
  return tabBody(a.raster, a.cinf, W, { bg: a.bg, sampling: a.sampling, variant });
}
function headerExpect(slug, id, row, variant = {}) {
  const t = corpus.get(slug), a = t.art(id);
  if (!a?.cinf) return null;
  const pattern = t.census.ppat.has(a.cinf.bodyId) ? t.pattern(a.cinf.bodyId) : null;
  if (t.census.ppat.has(a.cinf.bodyId) && !pattern) throw new Error(`${slug}: ppat ${a.cinf.bodyId} not decoded`);
  return headerSurface(a.raster, a.cinf, { ...row, R, bg: a.bg, pattern, sampling: a.sampling, variant });
}
const tabCandidates = slug => [...corpus.get(slug).census.cicn].filter(id => id >= -9999 && id <= -9950 && corpus.get(slug).census.cinf.has(id));

for (const mode of ['source', 'built']) {
  test(`${mode}: composeTab and composeHeaderSurface follow the CDEF 8 / PACH 130 selection and paint rules for every archive`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'tab-header.source-rules' });
    await openHarness(page, servers, mode);
    const raw = await observe(page, mode);
    const decode = o => o && { width: o.width, height: o.height, rgba: b64(o.rgba) };
    const tabRows = [], headerRows = [];
    for (const slug of ALL_ARCHIVES) {
      const { census } = corpus.get(slug);
      TAB_PUBLIC_ROWS.forEach((row, i) => {
        const sel = selectTab(nativeForTab(row), census), obs = decode(raw[slug].tabs[i].out), path = raw[slug].tabs[i].path;
        const r = { slug, selected: row.selected, expectedId: sel.id, probes: sel.probes, runtimeProbes: raw[slug].tabs[i].probes, path, size: obs && [obs.width, obs.height] };
        if (!sel.id) { r.failure = obs ? 'decode finds no archive tab art, runtime drew one' : null; tabRows.push(r); return; }
        if (!obs) { r.failure = `expected ${sel.id}, runtime returned null`; tabRows.push(r); return; }
        const d = diff(tabExpect(slug, sel.id, obs.width), obs);
        r.failure = d.equal ? null : `${sel.id}: ${d.reason}`; r.unknownPixels = d.unknown;
        r.matches = tabCandidates(slug).filter(id => diff(tabExpect(slug, id, obs.width), obs).equal);
        r.variantsFailing = Object.entries(TAB_VARIANTS).filter(([, v]) => {
          const vs = v.select ? selectTab(v.select(row), census) : sel;
          const e = vs.id && tabExpect(slug, vs.id, obs.width, v.body);
          return !e || !diff(e, obs).equal;
        }).map(([name]) => name);
        tabRows.push(r);
      });
      HEADER_ROWS.forEach((row, i) => {
        const o = raw[slug].headers[i], id = headerId(row.drawState), r = { slug, ...row, expectedId: census.cicn.has(id) ? id : null, status: o.status, reason: o.reason };
        if (!r.expectedId) { r.failure = o.status === 'unavailable' ? null : `decode finds no archive -9567/-9568, runtime ${o.status}`; headerRows.push(r); return; }
        if (o.status !== 'rendered') { r.failure = `runtime ${o.status} ${o.reason}`; headerRows.push(r); return; }
        const obs = decode(o.out), d = diff(headerExpect(slug, id, row), obs);
        r.failure = d.equal ? null : `${id}: ${d.reason}`; r.unknownPixels = d.unknown;
        r.matches = [-9567, -9568].filter(c => census.cicn.has(c) && diff(headerExpect(slug, c, row), obs).equal);
        r.variantsFailing = Object.entries(HEADER_VARIANTS).filter(([, v]) => {
          const e = headerExpect(slug, v.id ? v.id(row.drawState) : id, row, v.body);
          return !e || !diff(e, obs).equal;
        }).map(([name]) => name);
        headerRows.push(r);
      });
    }
    await attachObservations(info, 'tab-header-rules', mode, { mode, tabRows, headerRows });
    expect(tabRows).toHaveLength(36); expect(headerRows).toHaveLength(18 * HEADER_ROWS.length);
    expect(tabRows.filter(r => r.failure).map(r => `${r.slug}/${r.selected}: ${r.failure}`)).toEqual(KNOWN_TAB_FAILURES);
    expect(headerRows.filter(r => r.failure).map(r => `${r.slug}/${r.kind}/${r.drawState}/${r.width}x${r.height}@${r.origin}: ${r.failure}`)).toEqual([]);
    // Discrimination census: rows whose output equals the model of another candidate id.
    const sharedTabs = tabRows.filter(r => r.matches && r.matches.length !== 1).map(r => `${r.slug}/${r.selected}:${r.matches}`);
    const sharedHeaders = [...new Set(headerRows.filter(r => r.matches && r.matches.length !== 1).map(r => r.slug))];
    // Per-archive mutation tables: archives where each wrong reading fails some row.
    const table = (rows, variants) => Object.fromEntries(Object.keys(variants).map(name => [name, [...new Set(rows.filter(r => r.variantsFailing?.includes(name)).map(r => r.slug))]]));
    const tabTable = table(tabRows.filter(r => !r.failure), TAB_VARIANTS), headerTable = table(headerRows, HEADER_VARIANTS);
    const unknownPixels = Object.fromEntries(ALL_ARCHIVES.map(s => [s, [tabRows, headerRows].map(rows => rows.filter(r => r.slug === s).reduce((n, r) => n + (r.unknownPixels ?? 0), 0))]));
    await attachObservations(info, 'tab-header-rules', `${mode}-census`, { sharedTabs, sharedHeaders, tabTable, headerTable, unknownPixels });
    expect(sharedTabs).toEqual(SHARED_TABS);
    expect(sharedHeaders).toEqual(SHARED_HEADERS);
    expect(tabTable).toEqual(TAB_TABLE);
    expect(headerTable).toEqual(HEADER_TABLE);
    expect(unknownPixels).toEqual(UNKNOWN_PIXELS);
    expect(Object.fromEntries(TAB_ARCHIVES.map(s => [s, tabRows.filter(r => r.slug === s).map(r => r.size[0])]))).toEqual(TAB_WIDTHS);
    // Replaced by engine/tab.md P3/P4; tab-engine.spec asserts every Crayon
    // centre pixel. Keep this older table's limited oracle and all headers intact.
    expect(tabRows.filter(r => r.path === 'legacy-three-slice').map(r => r.slug)).toEqual([]);
    // Probe order: the decode probes -9960+state after a small miss (0x914);
    // the runtime probes the large id instead (compatibility policy). Only the
    // four archives with no tab art reach a second probe. Null there is pinned as
    // current policy and agrees with the decode only under the declared
    // archive-only chain: the control-panel fork ships -9959/-9956, so the
    // original probably draws a recoloured fallback tab (probable divergence).
    for (const r of tabRows) expect(r.runtimeProbes, r.slug).toEqual(TAB_ARCHIVES.includes(r.slug) ? [r.probes[0]] : [r.probes[0], r.probes[0] - 8]);
    expect(HEADER_ARCHIVES.every(s => headerRows.filter(r => r.slug === s).every(r => r.status === 'rendered'))).toBe(true);
  });
}

// Pinned corpus properties (all rows pass; these say what passing rows cannot show).
const KNOWN_TAB_FAILURES = [];
// Runtime output widths [rear, front] for the empty label (public policy, not StringWidth+24).
const TAB_WIDTHS = { '1138': [26, 26], '1984': [34, 32], '1990': [34, 34], animals: [34, 32], 'apple-lisa': [30, 30], 'apple-platinum-2': [30, 30],
  'beos-r503': [36, 35], 'crayon-os': [82, 82], 'dolphin-som': [34, 34], evolution: [34, 34], floppies: [28, 30], 'monkey-paradise': [34, 32], 'windows-31': [18, 18], 'windows-95': [18, 18] };
const but = (list, ...drop) => list.filter(s => !drop.includes(s));
// Rows whose output equals the model of more than one tab id: identical state art.
const SHARED_TABS = ['1990/false:-9976,-9975,-9974', '1990/true:-9973,-9972', 'apple-lisa/false:-9976,-9975', 'apple-lisa/true:-9973,-9972',
  'apple-platinum-2/false:-9975,-9974', 'beos-r503/true:-9973,-9972', 'windows-31/false:-9976,-9975', 'windows-31/true:-9973,-9972',
  'windows-95/false:-9975,-9976,-9974', 'windows-95/true:-9972,-9973'];
// -9567 and -9568 give identical output in every sampled row of these archives.
const SHARED_HEADERS = ['1984', '1990', 'apple-lisa', 'evolution', 'windows-31', 'windows-95'];
const TAB_TABLE = {
  'selected ignored (always rear)': TAB_ARCHIVES, 'selected adds 1 (pressed rear)': TAB_ARCHIVES, 'large variant': TAB_ARCHIVES,
  'disabled state': but(TAB_ARCHIVES, '1990', 'apple-lisa', 'windows-31', 'windows-95'),
  'c and s swapped': ['1984', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'monkey-paradise'],
  'band repeats the whole middle': ['1138', '1984', '1990', 'dolphin-som', 'evolution', 'floppies'],
  'band uses column c+1': ['1138', '1990', 'crayon-os', 'dolphin-som', 'evolution', 'floppies'],
  'centre not filled': but(TAB_ARCHIVES, '1138', '1990', 'dolphin-som', 'evolution'),
};
// Four header readings are not discriminated by any archive (c == s, uniform
// middles, no body/border overlap). header-band-requirements.spec.mjs catches
// c/s swap, single inset and body order; only header-surface.spec.mjs catches
// the repeat flag.
const HEADER_TABLE = {
  'state polarity swapped': but(HEADER_ARCHIVES, ...SHARED_HEADERS), 'c and s swapped': [], 'single inset body': [], 'repeat flag ignored (always repeat)': [],
  'no list-view extension': but(HEADER_ARCHIVES, 'evolution'), 'pattern anchor ignored': ['1990', 'animals', 'monkey-paradise'],
  'borders reversed': ['1984', 'animals', 'crayon-os', 'dolphin-som', 'monkey-paradise', 'windows-95'], 'body painted last': [],
};
// [tab, header] pixels the rules do not fix: crayon-os tab centres request ppat 17
// (cinf+4). This older table leaves them unknown; tab-engine.spec independently
// asserts the now-decoded P3/P4 centre in every public row.
const UNKNOWN_PIXELS = Object.fromEntries(ALL_ARCHIVES.map(s => [s, [s === 'crayon-os' ? 1664 : 0, 0]]));
