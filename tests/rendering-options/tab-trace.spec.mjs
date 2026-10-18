import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachObservations, attachCase } from './fixtures.mjs';
import { compareTabPaint } from '../resource-provenance/tabs.mjs';
import { forkOf, onePixelCicn, cinf } from '../resource-provenance/fixtures.mjs';

const sourcePins = JSON.parse(readFileSync(new URL('../decoder-fixtures/tab-body-source-pins.json', import.meta.url))).cases;
const sourceChoices = JSON.parse(readFileSync(new URL('../control-availability/source-choices.json', import.meta.url))).sources;
const sourceEvidence = JSON.parse(readFileSync(new URL('../source-inputs/evidence.json', import.meta.url))).rows;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const selected = trace => trace?.steps.find(s => s.action === 'selected' && s.role === 'face');

for (const mode of ['source', 'built']) {
  test(`${mode}: tab traces report actual source-band and legacy branches without changing pixels or decodes`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const source = api.PixelBuffer.alloc(7, 7); source.fillRect({ x: 0, y: 0, w: 7, h: 7 }, 120, 130, 140);
      // One masked sample is deliberately inside a positive center.
      source.setPixel(3, 3, 0, 0, 0, 0);
      const encoded = api.bufferToCanvas(source).toDataURL();
      const sample = { rgb16: [0x2121, 0x2121, 0x2121], displayRgb: [48, 48, 48] };
      const element = { width: 7, height: 7, sourceCicnId: -9975, sourceCinfId: -9975,
        slice: { corner: 2, side: 1, tile: false }, bodyRequest: { mode: 0, resourceId: 0 }, bgAnchor: [2, 2] };
      const cases = {
        empty: { ...element, slice: { corner: 2, side: 4, tile: false }, bodyRequest: undefined },
        raw: { ...element, bgAnchor: [3, 3], colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: 'mac-1.8-to-2.2-high-byte', background: sample, text: null, emboss: null, embossDecision: 'unknown' } },
        opaque: element,
        noSlice: { ...element, slice: undefined },
        malformed: { ...element, slice: { corner: 4, side: 1, tile: false } },
        noRequest: { ...element, bodyRequest: undefined },
        invalidRequest: { ...element, bodyRequest: { mode: 0, resourceId: 1.5 } },
        pattern: { ...element, bodyRequest: { mode: 0, resourceId: 17 } },
        noAnchor: { ...element, bgAnchor: undefined },
        masked: { ...element, bgAnchor: [3, 3] },
      };
      const decode = HTMLImageElement.prototype.decode; let decodes = 0;
      HTMLImageElement.prototype.decode = function () { decodes++; return decode.call(this); };
      const rows = [];
      try { for (const [name, item] of Object.entries(cases)) {
        let trace, frozen;
        const theme = suffix => ({ baseUrl: location.origin, manifest: { chromeElements: { chosen: { ...item, asset: `${encoded}#${name}-${suffix}` } } } });
        decodes = 0; const plain = await api.composeTab(theme('plain'), { label: '' }); const plainDecodes = decodes;
        decodes = 0; const observed = await api.composeTab(theme('observed'), { label: '', diagnostics: { correlationId: name, onComplete: value => {
          trace = value; frozen = Object.isFrozen(value) && Object.isFrozen(value.steps) && Object.isFrozen(value.tabBody) && value.steps.every(step => Object.isFrozen(step) && (!step.owner || Object.isFrozen(step.owner)) && (!step.resource || Object.isFrozen(step.resource)));
        } } });
        rows.push({ name, trace, frozen, plainDecodes, observedDecodes: decodes,
          same: plain.width === observed.width && plain.height === observed.height && plain.data.every((v, i) => v === observed.data[i]) });
      } } finally { HTMLImageElement.prototype.decode = decode; }
      return rows;
    }, mode);
    await attachObservations(info, 'tab-trace', `${mode}-branches`, { mode, rows });
    const paths = { empty: ['source-bands', 'empty', 'none'], raw: ['source-bands', 'solid', 'raw-sample'], opaque: ['source-bands', 'solid', 'decoded-anchor'] };
    const reasons = { noSlice: 'missing-slice', malformed: 'invalid-slice-or-size', noRequest: 'missing-body-request', invalidRequest: 'invalid-body-request', pattern: 'pattern-center', noAnchor: 'missing-or-invalid-background-anchor', masked: 'masked-background' };
    for (const row of rows) {
      expect(row.same, row.name).toBe(true);
      expect([row.plainDecodes, row.observedDecodes], row.name).toEqual([1, 1]);
      expect(row.trace, row.name).toMatchObject({ version: 1, family: 'tab', requested: { selected: false }, outcome: { status: 'themed' } });
      expect(row.frozen).toBe(true);
      expect(selected(row.trace)).toMatchObject({ resource: { signedId: -9975, manifestKey: 'chosen' }, basis: 'compatibility-policy' });
      if (paths[row.name]) {
        const [path, center, backgroundPolicy] = paths[row.name];
        expect(row.trace.tabBody).toMatchObject({ path, center, backgroundPolicy });
      } else expect(row.trace.tabBody).toMatchObject({ path: 'legacy-three-slice', reason: reasons[row.name], basis: 'compatibility-policy' });
    }
  });
}

for (const mode of ['source', 'built']) {
  test(`${mode}: actual tab paint joins independent archive pins and owning decoder occurrences`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, slugs }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      for (const slug of slugs) {
        const owner = await api.loadTheme(`/themes/${slug}`, { source: 'scheme.rsrc', provenance: true });
        const plain = await api.loadTheme(`/themes/${slug}`, { source: 'scheme.rsrc' });
        try {
          // A genuinely empty child establishes inherited ownership without
          // prelooking up or copying the expected manifest entry.
          const child = { baseUrl: '/empty-child', manifest: { chromeElements: {} }, base: owner };
          for (const inherited of [false, true]) {
            let trace; const output = await api.composeTab(inherited ? child : owner, {
              label: 'AgjpQy', diagnostics: { onComplete: value => { trace = value; } },
            });
            const untraced = await api.composeTab(plain, { label: 'AgjpQy' });
            rows.push({ slug, inherited, owner: { baseUrl: owner.baseUrl, byteProvenance: owner.byteProvenance }, trace,
              size: [output.width, output.height], pixelsEqual: output.width === untraced.width && output.height === untraced.height && output.data.every((v, i) => v === untraced.data[i]) });
          }
          let unknown; await api.composeTab(plain, { diagnostics: { onComplete: value => { unknown = value; } } });
          rows.push({ slug, unobserved: true, owner: { baseUrl: plain.baseUrl }, trace: unknown });
        } finally { owner.dispose(); plain.dispose(); }
      }
      return rows;
    }, { mode, slugs: sourcePins.map(p => p.slug) });
    const negatives = [];
    try { for (const row of rows) {
      const rawPin = sourcePins.find(p => p.slug === row.slug), choice = sourceChoices.find(p => p.slug === row.slug);
      const length = sourceEvidence.find(p => p.slug === row.slug).sourceByteLength;
      expect(choice.format).toBe('rsrc'); expect(choice.archiveSha256).toBe(rawPin.archiveSha256);
      const pin = { archive: { sha256: rawPin.archiveSha256, byteLength: length, format: choice.format },
        selectedFork: { forkSha256: choice.forkSha256, byteLength: length, entryIndex: null, entryName: null, forkType: 1, fileType: null, creator: null },
        candidates: rawPin.resources.map(r => ({ type: r.type, signedId: r.id, byteLength: r.bytes, payloadSha256: r.sha256, presence: 'present' })) };
      const expected = { role: 'face', usage: 'paint', baseUrl: `/themes/${row.slug}`, chainDepth: row.inherited ? 1 : 0,
        signedId: -9975, sourceCinfId: -9975, manifestKey: 'ssf-rear-tab', requested: { selected: false, state: 'active', pressed: false, disabled: false }, body: { path: 'source-bands', center: 'empty', backgroundPolicy: 'none' } };
      row.join = compareTabPaint(row.trace, row.owner, pin, expected);
      if (row.unobserved) { expect(row.join.status).toBe('unknown'); continue; }
      expect(row.join).toEqual({ status: 'passed', errors: [] });
      expect(row.pixelsEqual).toBe(true); expect(row.size[1]).toBe(16);
      expect(selected(row.trace).owner.chainDepth).toBe(row.inherited ? 1 : 0);
      const falsify = (name, mutate) => {
        const altered = structuredClone({ trace: row.trace, owner: row.owner, pin, expected }); mutate(altered);
        const result = compareTabPaint(altered.trace, altered.owner, altered.pin, altered.expected);
        expect(result.status, name).not.toBe('passed'); negatives.push({ slug: row.slug, inherited: row.inherited, name, result });
      };
      falsify('missing-trace', x => { x.trace = undefined; });
      falsify('wrong-request', x => { x.trace.requested.selected = true; });
      falsify('wrong-key', x => { x.expected.manifestKey = 'another-key'; });
      falsify('wrong-depth', x => { x.expected.chainDepth = 9; });
      falsify('wrong-owner', x => { x.expected.baseUrl = '/wrong-owner'; });
      falsify('wrong-load', x => { selected(x.trace).resource.byteProvenance.loadId = 'other-load'; });
      falsify('wrong-cicn-hash', x => { x.pin.candidates[0].payloadSha256 = '0'.repeat(64); });
      falsify('wrong-cinf-hash', x => { x.pin.candidates[1].payloadSha256 = '0'.repeat(64); });
      falsify('swapped-occurrence', x => { const r = selected(x.trace).resource.byteProvenance; r.cinfResourceIndex = r.cicnResourceIndex; });
      falsify('missing-owner-occurrence', x => { x.owner.byteProvenance.resources = []; });
      falsify('duplicate-owner-occurrence', x => { const r = selected(x.trace).resource.byteProvenance; x.owner.byteProvenance.resources.push(x.owner.byteProvenance.resources.find(v => v.resourceIndex === r.cinfResourceIndex)); });
      falsify('wrong-branch', x => { x.expected.body.center = 'solid'; });
    }
    } catch (error) { await attachCase(page, info, { mode, rows, negatives, sourcePins }, error); throw error; }
    const compactRows = rows.map(row => {
      const binding = selected(row.trace)?.resource.byteProvenance;
      const evidence = row.owner.byteProvenance;
      return { ...row, owner: { ...row.owner, ...(evidence ? { byteProvenance: { ...evidence, resources: evidence.resources.filter(r => [binding?.cicnResourceIndex, binding?.cinfResourceIndex].includes(r.resourceIndex)) } } : {}) } };
    });
    await attachObservations(info, 'tab-trace', `${mode}-actual-byte-joins`, { mode, sourcePins, rows: compactRows, negatives,
      limits: 'Actual selected paint joins only these finite inputs. Input choices and small-first API policy do not establish historical resource ownership, typography or device pixels.' });
  });

  test(`${mode}: tab selection stays invocation-local for concurrent same-ID inputs and explicit compatibility fallbacks`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const loader = mode === 'built' ? api : await import('/tools/theme-loader/loadKaleidoscopeScheme.js');
      const { forkOf, onePixelCicn, cinf } = await import('/tests/resource-provenance/fixtures.mjs');
      const build = (id, red, name = 'actual') => forkOf([{ type: 'cicn', id, name, data: onePixelCicn(red) }, { type: 'cinf', id, data: cinf() }]);
      const themes = await Promise.all([loader.loadKaleidoscopeScheme(build(-9975, 0xffff), { provenance: true }), loader.loadKaleidoscopeScheme(build(-9975, 0x7777), { provenance: true }), loader.loadKaleidoscopeScheme(build(-9980, 0x5555), { provenance: true })]);
      const rows = [], traces = new Map(), counts = new Map();
      const onComplete = trace => { traces.set(trace.correlationId, trace); counts.set(trace.correlationId, (counts.get(trace.correlationId) ?? 0) + 1); };
      try {
        await Promise.all(themes.map(async (theme, index) => {
          theme.baseUrl = `/fixture/tab-${index}`;
          const correlationId = `call-${index}`;
          await api.composeTab(theme, { selected: index === 2, diagnostics: { correlationId, onComplete } });
          rows.push({ index, count: counts.get(correlationId), trace: traces.get(correlationId), owner: { baseUrl: theme.baseUrl, byteProvenance: theme.byteProvenance } });
        }));
        let missing; await api.composeTab({ baseUrl: '/missing', manifest: { chromeElements: {} } }, { diagnostics: { onComplete: t => { missing = t; } } });
        // Identical generated path + repeated signed ID cannot acquire a false
        // unique diagnostic binding. The real loader must reject the ambiguity.
        const ambiguousBytes = forkOf([{ type: 'cicn', id: -9975, name: 'same', data: onePixelCicn() }, { type: 'cicn', id: -9975, name: 'same', data: onePixelCicn(0x7777) }]);
        let ambiguousError; try { const t = await loader.loadKaleidoscopeScheme(ambiguousBytes, { provenance: true }); t.dispose(); } catch (e) { ambiguousError = String(e); }
        return { rows, missing, ambiguousError, isolated: rows[0].trace !== rows[1].trace && rows[0].trace.steps !== rows[1].trace.steps };
      } finally { themes.forEach(t => t.dispose()); }
    }, mode);
    expect(result.isolated).toBe(true); expect(result.rows.map(r => r.count)).toEqual([1, 1, 1]);
    expect(new Set(result.rows.map(r => r.owner.byteProvenance.loadId)).size).toBe(3);
    for (const row of result.rows) {
      expect(row.trace.correlationId).toBe(`call-${row.index}`);
      const face = selected(row.trace), id = row.index === 2 ? -9980 : -9975;
      expect(face.resource.byteProvenance.loadId).toBe(row.owner.byteProvenance.loadId);
      expect(face.owner).toEqual({ baseUrl: `/fixture/tab-${row.index}`, chainDepth: 0 });
      expect(face.resource).toMatchObject({ signedId: id, sourceCinfId: id, manifestKey: 'actual', byteProvenance: { cicnResourceIndex: 0, cinfResourceIndex: 1 } });
      const bytes = forkOf([{ type: 'cicn', id, name: 'actual', data: onePixelCicn([0xffff, 0x7777, 0x5555][row.index]) }, { type: 'cinf', id, data: cinf() }]);
      expect(row.owner.byteProvenance.input.sha256).toBe(hash(bytes));
      expect(row.owner.byteProvenance.resources.find(r => r.resourceIndex === 0).sha256).toBe(hash(onePixelCicn([0xffff, 0x7777, 0x5555][row.index])));
      expect(row.trace.tabBody).toMatchObject({ path: 'legacy-three-slice', reason: 'invalid-slice-or-size' });
      if (row.index === 2) {
        expect(row.trace.requested.selected).toBe(true);
        expect(row.trace.steps.some(s => s.action === 'missing' && s.requestedId === -9972)).toBe(true);
        expect(row.trace.steps.find(s => s.reason === 'tab-small-to-large')).toMatchObject({ requestedId: -9980, basis: 'compatibility-policy' });
      }
    }
    expect(result.missing.outcome).toEqual({ status: 'unavailable' }); expect(result.missing.tabBody).toBeUndefined();
    expect(result.ambiguousError).toMatch(/ambiguous|duplicate/i);
    await attachObservations(info, 'tab-trace', `${mode}-invocation-identity`, { mode, result });
  });

  test(`${mode}: tab diagnostics preserve callback and renderer error precedence without taking theme ownership`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const matrixCase = window.controlMatrix.listCases().find(c => c.mode === 'direct' && c.family === 'tab');
      const attached = (await window.controlMatrix.runCase(matrixCase, { slug: '1138', includeReferences: false })).resolutionTrace;
      const theme = await api.loadTheme('/themes/1138', { source: 'scheme.rsrc' });
      const dispose = theme.dispose; let disposals = 0; theme.dispose = () => { disposals++; };
      const callbackError = new Error('tab callback'), rendererError = new Error('tab decode');
      let successCalls = 0, successError, failureCalls = 0, failureError, failureTrace;
      try { await api.composeTab(theme, { diagnostics: { onComplete: () => { successCalls++; throw callbackError; } } }); } catch (e) { successError = e; }
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () { if (this.src.endsWith('#tab-error')) throw rendererError; return decode.call(this); };
      try {
        await api.composeTab({ baseUrl: location.origin, manifest: { chromeElements: { broken: { asset: 'data:image/png;base64,broken#tab-error', sourceCicnId: -9975, width: 7, height: 7 } } } }, {
          diagnostics: { onComplete: value => { failureCalls++; failureTrace = value; throw callbackError; } },
        });
      } catch (e) { failureError = e; } finally { HTMLImageElement.prototype.decode = decode; dispose(); }
      return { attached, successCalls, failureCalls, successError: successError === callbackError, failureError: failureError === rendererError, failureTrace, disposals };
    }, mode);
    expect(result).toMatchObject({ successCalls: 1, failureCalls: 1, successError: true, failureError: true, disposals: 0, failureTrace: { outcome: { status: 'error' } } });
    expect(result.attached).toMatchObject({ family: 'tab', outcome: { status: 'themed' }, tabBody: { path: 'source-bands' } });
    expect(selected(result.failureTrace).resource.signedId).toBe(-9975); expect(result.failureTrace.tabBody).toBeUndefined();
  });
}
