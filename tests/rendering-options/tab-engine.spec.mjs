import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { TAB_ENGINE_PATTERN_ROWS, TAB_ENGINE_SOLID_ROWS, TAB_ENGINE_SAMPLED_ROWS, TAB_ENGINE_NULLS, TAB_ENGINE_PUBLIC_SELECTION } from './tab-engine-rules.mjs';

// Expectations are frozen independent literals, not candidate-rendered output.
for (const mode of ['source', 'built']) {
  test(`${mode}: tab engine paints every P4 alignment and missing-pattern solid centre from selected owner`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { tabFixture, tabPixels } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
      const rows = [];
      for (const alignment of [0, 1, 2, 3, 4, 5, 255]) for (const selected of [false, true]) {
        const { owner } = tabFixture(api, { id: selected ? -9972 : -9975, mode: alignment });
        // A root-owned conflicting pattern must not paint a base-owned face.
        const conflict = tabFixture(api, { sourceRows: ['LMMMMMR', 'LMMMMMR', 'LMMZMMR', 'LMMMMMR', 'LMMMMMR'] });
        const child = { baseUrl: '/root-with-conflicting-pattern', manifest: { chromeElements: {}, patterns: { chosen: { sourcePpatId: 17, asset: conflict.image(['ZZZ', 'ZZZ']), width: 3, height: 2 } } }, base: owner };
        let trace;
        const output = await api.composeTab(child, { label: '', selected, diagnostics: { onComplete: t => { trace = t; } } });
        rows.push({ alignment, selected, pixels: tabPixels(output), trace });
      }
      for (const request of [0, 17]) for (const maskedBackground of [false, true]) {
        const { owner } = tabFixture(api, { request, pattern: false, maskedBackground });
        let trace; const output = await api.composeTab(owner, { label: '', diagnostics: { onComplete: t => { trace = t; } } });
        rows.push({ request, maskedBackground, pixels: tabPixels(output), trace });
      }
      return rows;
    }, mode);
    await attachObservations(info, 'tab-engine', `${mode}-phase`, { mode, observed });
    for (const row of observed) {
      expect(row.pixels, JSON.stringify({ alignment: row.alignment, selected: row.selected, request: row.request, masked: row.maskedBackground })).toEqual(row.alignment === undefined ? TAB_ENGINE_SOLID_ROWS : TAB_ENGINE_PATTERN_ROWS[row.alignment]);
      const chosen = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      expect(chosen.resource.signedId).toBe(row.selected ? -9972 : -9975);
      if (row.alignment !== undefined) expect(chosen.owner.chainDepth).toBe(1);
    }
  });

  test(`${mode}: tab C1 sampled-line companion never recolours caps and AD rejects missing proof`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { tabFixture, tabPixels } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
      const f = tabFixture(api, { tile: false, request: 0, pattern: false });
      f.element.samplingEquivalence = { ...f.proof, status: 'different', reason: 'opaque-display-mismatch' };
      f.element.sampledBandAsset = { ...f.proof, asset: f.image(['QUUUUUS', 'QMMMMMS', 'QMMZMMS', 'QMMMMMS', 'QVVVVVS']), derivedPath: 'cicn-sampled/tab-finite.png' };
      let trace; const output = await api.composeTab(f.owner, { label: '', diagnostics: { onComplete: t => { trace = t; } } });
      return { pixels: tabPixels(output), trace };
    }, mode);
    await attachObservations(info, 'tab-engine', `${mode}-sampled`, { mode, result });
    expect(result.pixels).toEqual(TAB_ENGINE_SAMPLED_ROWS);
  });

  test(`${mode}: tab AD null boundaries stop at selected owner without legacy or large retry`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, names }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { tabFixture } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
      const rows = [];
      for (const name of names) {
        const f = tabFixture(api, { request: 0, pattern: false, tile: false });
        // Valid large art exists but must never be retried after found small art.
        f.owner.manifest.chromeElements.large = { ...f.element, sourceCicnId: -9983, sourceCinfId: -9983 };
        if (name === 'no-cinf') { f.element.sourceCinfId = null; delete f.element.slice; delete f.element.bodyRequest; delete f.owner.manifest.engineCinfs[-9975]; }
        if (name === 'missing-slice') delete f.element.slice;
        if (name === 'missing-body-request') delete f.element.bodyRequest;
        if (name === 'invalid-body-request') f.element.bodyRequest.resourceId = 0.5;
        if (name === 'invalid-slice') f.element.slice.corner = 4;
        if (name === 'unknown-lines') delete f.element.samplingEquivalence;
        if (name === 'different-without-companion') f.element.samplingEquivalence = { ...f.proof, status: 'different', reason: 'opaque-display-mismatch' };
        if (name === 'wrong-sample-display') { f.element.samplingEquivalence.displayPolicy = 'wrong-owner'; delete f.element.engineColorSamples; }
        if (name === 'masked-background-no-raw') {
          const masked = tabFixture(api, { request: 0, pattern: false, tile: false, maskedBackground: true });
          f.owner = masked.owner; f.element = masked.element; delete f.element.engineColorSamples; delete f.element.colorSamples;
        }
        if (['ambiguous-pattern', 'undecoded-pattern'].includes(name)) {
          f.element.slice.tile = true; f.owner.manifest.engineCinfs[-9975][2] = 1;
          f.element.bodyRequest.resourceId = 17; f.owner.manifest.engineCinfs[-9975][5] = 17;
          f.owner.inspector.ppatResources = [{ id: 17, resourceIndex: 2, byteLength: 1 }];
          f.owner.manifest.patterns = name === 'undecoded-pattern' ? {} : { a: { sourcePpatId: 17, asset: f.image(['ABC', 'DEF']), width: 3, height: 2 }, b: { sourcePpatId: 17, asset: f.image(['DEF', 'ABC']), width: 3, height: 2 } };
        }
        let trace; const out = await api.composeTab(f.owner, { label: 'AgjpQy', diagnostics: { onComplete: t => { trace = t; } } });
        rows.push({ name, null: out === null, trace });
      }
      const empty = tabFixture(api); empty.element.asset = empty.image(['.......', '.......', '.......', '.......', '.......']);
      let emptyTrace; const emptyOutput = await api.composeTab(empty.owner, { diagnostics: { onComplete: t => { emptyTrace = t; } } });
      let missing; const noArt = await api.composeTab({ baseUrl: '/empty', manifest: { chromeElements: {} } }, { diagnostics: { onComplete: t => { missing = t; } } });
      return { rows, empty: { null: emptyOutput === null, trace: emptyTrace }, missing: { null: noArt === null, trace: missing } };
    }, { mode, names: TAB_ENGINE_NULLS });
    await attachObservations(info, 'tab-engine', `${mode}-admission`, { mode, rows });
    expect(rows.rows.filter(r => !r.null).map(r => r.name)).toEqual([]);
    expect(rows.empty.null).toBe(true); expect(rows.missing.null).toBe(true);
    for (const row of rows.rows) {
      expect(row.trace.steps.some(s => s.requestedId === -9983), row.name).toBe(false);
      expect(String(row.trace.tabBody?.path), row.name).not.toMatch(/legacy/);
    }
    // Concrete outcomes/reasons must separate AD1/2/3/4/5, regardless of which
    // additive diagnostic field carries their meaning. Bind precise field names
    // only after the runtime API is supplied; null output alone is insufficient.
    const reasons = [rows.missing, rows.empty, ...['no-cinf', 'missing-slice', 'unknown-lines', 'ambiguous-pattern'].map(n => rows.rows.find(r => r.name === n))].map(r => JSON.stringify({ outcome: r.trace.outcome, body: r.trace.tabBody, rejected: r.trace.steps.filter(s => s.action === 'rejected' || s.usage === 'admission') }));
    expect(new Set(reasons).size).toBe(6);
  });
}

// Full corpus + retained modern typography policy. Expected body and placement
// come from raw-map/cinf oracle; browser supplies only the separately invoked
// existing font rasterizer at the independent expected font/colour inputs.
import { loadCorpus } from './tab-header-corpus.mjs';
import { ALL_ARCHIVES, nativeForTab, selectTab, tabBody, diff } from './tab-header-rules.mjs';
import { paintTabPatternCenter } from './tab-engine-rules.mjs';
const corpus = await loadCorpus();
const decode = p => p && { width: p.width, height: p.height, rgba: Uint8ClampedArray.from(Buffer.from(p.rgba, 'base64')) };
const labelInputs = ['', 'OK', 'AgjpQy', 'A long segmented tab label'];
function labelPolicy(a) {
  let l = a.raster.width, r = -1, t = a.raster.height, b = -1;
  for (let y = 0; y < a.raster.height; y++) for (let x = 0; x < a.raster.width; x++) if (a.raster.rgba[(y * a.raster.width + x) * 4 + 3]) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
  const at = (Math.floor((t + b) / 2) * a.raster.width + Math.floor((l + r) / 2)) * 4;
  const rgb = a.raster.rgba.subarray(at, at + 3), lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return { height: b - t + 1, fontSize: Math.max(8, Math.round((b - t + 1) * .42)), foreground: lum < 128 ? '#ffffff' : '#000000' };
}
for (const mode of ['source', 'built']) test(`${mode}: all tab public selected and label rows assert complete bodies including Crayon patterns`, async ({ page, servers }, info) => {
  const inputs = ALL_ARCHIVES.flatMap(slug => [false, true].flatMap(selected => {
    const chosen = selectTab(nativeForTab({ selected }), corpus.get(slug).census), art = chosen.id && corpus.get(slug).art(chosen.id);
    return labelInputs.map(label => ({ slug, selected, label, ...(art ? labelPolicy(art) : {}) }));
  }));
  await openHarness(page, servers, mode);
  const observed = await page.evaluate(async ({ mode, inputs }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const enc = p => { if (!p) return null; let s = ''; for (let i = 0; i < p.data.length; i += 0x8000) s += String.fromCharCode(...p.data.subarray(i, i + 0x8000)); return { width: p.width, height: p.height, rgba: btoa(s) }; };
    const themes = new Map(), result = [];
    try { for (const row of inputs) {
      if (!themes.has(row.slug)) themes.set(row.slug, await api.loadTheme(`/themes/${row.slug}`, { provenance: true }));
      let trace; const output = await api.composeTab(themes.get(row.slug), { label: row.label, selected: row.selected, diagnostics: { onComplete: t => { trace = t; } } });
      result.push({ out: enc(output), glyph: row.label && row.fontSize ? enc(api.rasterizeText(row.label, row.fontSize, row.foreground)) : null, trace });
    } } finally { for (const theme of themes.values()) theme.dispose(); }
    return result;
  }, { mode, inputs });
  const failures = [], rows = [];
  for (let i = 0; i < inputs.length; i++) {
    const row = inputs[i], expectedSelection = selectTab(nativeForTab(row), corpus.get(row.slug).census), observedRow = observed[i], actual = decode(observedRow.out);
    if (expectedSelection.id === null) { if (actual) failures.push(`${row.slug}/${row.selected}/${row.label}: expected null`); continue; }
    const a = corpus.get(row.slug).art(expectedSelection.id), glyph = decode(observedRow.glyph);
    const W = Math.max(a.raster.width, (glyph?.width ?? 0) + 2 * a.cinf.c + 6);
    // P2 missing pattern and p=0 share the solid-background body.
    const model = tabBody(a.raster, { ...a.cinf, bodyId: 0 }, W, { bg: a.bg, sampling: a.sampling });
    const pattern = a.cinf.bodyId !== 0 ? corpus.get(row.slug).pattern(a.cinf.bodyId) : null;
    paintTabPatternCenter(model, a.cinf, pattern);
    if (glyph) {
      const gx = Math.round((W - glyph.width) / 2), gy = Math.round((row.height - glyph.height) / 2) + 1;
      for (let y = 0; y < glyph.height; y++) for (let x = 0; x < glyph.width; x++) {
        const dx = gx + x, dy = gy + y, p = (y * glyph.width + x) * 4;
        if (dx < 0 || dy < 0 || dx >= W || dy >= model.height || !glyph.rgba[p + 3]) continue;
        // Preserve the facade's existing drawOver transport policy, including
        // antialiased glyphs. This is modern policy, not native text transfer.
        const to = (dy * W + dx) * 4, a = glyph.rgba[p + 3] / 255;
        for (let channel = 0; channel < 3; channel++) model.rgba[to + channel] = Math.round(glyph.rgba[p + channel] * a + model.rgba[to + channel] * (1 - a));
        model.rgba[to + 3] = Math.max(model.rgba[to + 3], glyph.rgba[p + 3]);
      }
    }
    const d = diff(model, actual), chosen = observedRow.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
    if (!d.equal) failures.push(`${row.slug}/${row.selected}/${JSON.stringify(row.label)}: ${d.reason}`);
    expect(chosen.resource.signedId).toBe(expectedSelection.id);
    expect(d.unknown).toBe(0);
    rows.push({ ...row, expectedId: expectedSelection.id, size: actual && [actual.width, actual.height], diff: d, trace: observedRow.trace });
  }
  await attachObservations(info, 'tab-engine', `${mode}-complete-corpus`, { mode, rows, failures, limits: 'Complete declared raster/body/modern-font-policy checks against raw-map oracles, not historical typography/device output.' });
  expect(observed).toHaveLength(18 * 2 * 4);
  expect(failures).toEqual([]);
});

for (const mode of ['source', 'built']) test(`${mode}: F1–F6 tab resolution is small-across-chain first and preserves positive alias identity`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async ({ mode, decisions }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const { tabFixture } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
    const rows = [];
    for (const { selected, ids: [small, large] } of decisions) for (const branch of ['base-small', 'root-small', 'large-only', 'positive-alias']) {
      const base = tabFixture(api, { id: small, request: 0, pattern: false }); base.owner.baseUrl = '/selected-base';
      const root = tabFixture(api, { id: large, request: 0, pattern: false }); root.owner.baseUrl = '/selected-root'; root.owner.base = base.owner;
      if (branch === 'root-small' || branch === 'positive-alias') {
        const first = tabFixture(api, { id: branch === 'positive-alias' ? -small : small, request: 0, pattern: false });
        root.owner.manifest.chromeElements = { first: first.element, duplicate: { ...first.element, asset: first.image(['QQQQQQQ', 'QQQQQQQ', 'QQQQQQQ', 'QQQQQQQ', 'QQQQQQQ']) }, large: root.element };
        Object.assign(root.owner.manifest.engineCinfs, first.owner.manifest.engineCinfs);
        root.owner.inspector.cicnResources.push(first.source);
      }
      if (branch === 'large-only') base.owner.manifest.chromeElements = {};
      let trace; const out = await api.composeTab(root.owner, { label: '', selected, diagnostics: { onComplete: t => { trace = t; } } });
      rows.push({ branch, selected, null: out === null, trace });
    }
    return rows;
  }, { mode, decisions: TAB_ENGINE_PUBLIC_SELECTION });
  await attachObservations(info, 'tab-engine', `${mode}-selection`, { mode, rows });
  for (const row of rows) {
    expect(row.null, row.branch).toBe(false);
    const decision = TAB_ENGINE_PUBLIC_SELECTION.find(r => r.selected === row.selected), chosen = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
    expect(chosen.resource.signedId).toBe(row.branch === 'large-only' ? decision.ids[1] : row.branch === 'positive-alias' ? -decision.ids[0] : decision.ids[0]);
    expect(chosen.owner.chainDepth).toBe(row.branch === 'base-small' ? 1 : 0);
    if (['root-small', 'positive-alias'].includes(row.branch)) expect(chosen.resource.manifestKey).toBe('first');
    if (row.branch === 'base-small') expect(row.trace.steps.some(s => s.requestedId === decision.ids[1])).toBe(false);
  }
});
