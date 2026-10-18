import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { compareByteProvenance } from '../resource-provenance/compare.mjs';
import { gitIdentity } from '../rendering-requirements/execution.mjs';
import { preservePrimaryFailure } from '../rendering-requirements/observation-execution.mjs';
import { sha256 } from '../control-availability/source.mjs';
const pins = JSON.parse(readFileSync(new URL('../control-availability/source-candidates.json', import.meta.url))).themes;
const inventory = JSON.parse(readFileSync(new URL('../control-availability/expectations.json', import.meta.url)));
const cases = inventory.cases.filter(c => c.input.startsWith('theme.') && c.mode === 'direct');
const root = fileURLToPath(new URL('../../', import.meta.url));

for (const mode of ['source', 'built']) {
  test(`${mode}: actual selected resources join four pinned archives, forks and decoder inputs`, async ({ page, servers }, info) => {
    const rows = [], loads = []; let complete = false, hasPrimaryFailure = false;
    try {
      await openHarness(page, servers, mode);
      for (const pin of pins) {
        const themeCases = cases.filter(c => c.input === `theme.${pin.slug}`);
        const observed = await page.evaluate(async ({ mode, pin, themeCases }) => {
          const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
          const theme = await api.loadTheme(`/themes/${pin.slug}`, { source: pin.archive.path.split('/').at(-1), provenance: true });
          const plain = await api.loadTheme(`/themes/${pin.slug}`, { source: pin.archive.path.split('/').at(-1) });
          try {
            const results = [];
            for (const c of themeCases) {
              let trace;
              const compose = c.family === 'bevel-button' ? api.composeBevelButton : api.composeButton;
              const actual = await compose(theme, { ...c.options, diagnostics: { onComplete(t) { trace = t; } } });
              const normal = await compose(plain, c.options);
              results.push({ id: c.id, trace, pixelsUnchanged: actual?.width === normal?.width && actual?.height === normal?.height
                && (actual === null ? normal === null : actual.data.every((v, i) => v === normal.data[i])) });
            }
            return { baseUrl: theme.baseUrl, byteProvenance: theme.byteProvenance, results,
              absentByDefault: !plain.byteProvenance && Object.values(plain.manifest.chromeElements).every(e => !e.byteProvenance) };
          } finally { theme.dispose(); plain.dispose(); }
        }, { mode, pin, themeCases });
        loads.push({ baseUrl: observed.baseUrl, byteProvenance: observed.byteProvenance });
        expect(observed.absentByDefault).toBe(true);
        for (const result of observed.results) {
          const c = themeCases.find(c => c.id === result.id), comparisons = [];
          expect(result.pixelsUnchanged).toBe(true); expect(result.trace.outcome.status).toBe('themed');
          for (const expected of c.proposed.paint) {
            const steps = result.trace.steps.filter(s => s.action === 'selected' && s.usage === 'paint' && s.role === expected.role);
            expect(steps).toHaveLength(1);
            comparisons.push(compareByteProvenance(steps[0], observed, pin, { ...expected, baseUrl: `/themes/${pin.slug}` }));
          }
          rows.push({ id: c.id, loadId: observed.byteProvenance.loadId, trace: result.trace, comparisons });
          expect(comparisons.every(c => c.status === 'passed'), JSON.stringify(comparisons)).toBe(true);
        }
      }
      expect(rows.map(row => row.id).sort()).toEqual(cases.map(c => c.id).sort());
      complete = true;
    } catch (error) { hasPrimaryFailure = true; await attachCase(page, info, { mode, rows }, error); throw error; }
    finally {
      await preservePrimaryFailure(hasPrimaryFailure, async () => {
      await attachObservations(info, 'byte-provenance-expectations', 'four-archive-pins', { evidence: 'independently-pinned-input-identities', pins, caseIds: cases.map(c => c.id),
        cases: cases.map(c => ({ id: c.id, family: c.family, options: c.options, paint: c.proposed.paint })) });
      await attachObservations(info, 'byte-provenance', mode, { execution: { ...gitIdentity(root), mode,
        browserVersion: page.context().browser().version(), builtBundleSha256: sha256(readFileSync(new URL('../../dist/scriptoscope.js', import.meta.url))) },
        complete, loads, rows, limitations: ['Actual input identity only; shared archive/resource decoding and historical pixel correctness remain unverified.',
          'Only the four pinned archives and finite cicn/cinf paint selections are independently joined; all other inputs remain unassessed.'] });
      }, description => info.annotations.push({ type: 'observation-metadata-error', description }));
    }
  });

  test(`${mode}: inherited selections retain owning load evidence and borrowed unobserved bases stay unknown`, async ({ page, servers }, info) => {
    try {
      await openHarness(page, servers, mode);
      const observed = await page.evaluate(async mode => {
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const { forkOf, onePixelCicn, cinf } = await import('/tests/resource-provenance/fixtures.mjs');
        const { loadKaleidoscopeScheme } = mode === 'source' ? await import('/tools/theme-loader/loadKaleidoscopeScheme.js') : api;
        const base = await api.loadTheme('/themes/windows-95', { provenance: true });
        const borrowed = await api.loadTheme('/themes/windows-95');
        const childBytes = forkOf([{ type: 'cicn', id: -10166, data: onePixelCicn() }, { type: 'cinf', id: -10166, data: cinf() }]);
        const child = await loadKaleidoscopeScheme(childBytes, { provenance: true }); child.baseUrl = '/fixture/child'; child.base = base;
        try {
          let inherited, own, unknown;
          await api.composeButton(child, { label: '', diagnostics: { onComplete(t) { inherited = t; } } });
          await api.composeBevelButton(child, { label: '', diagnostics: { onComplete(t) { own = t; } } });
          child.base = borrowed;
          await api.composeButton(child, { label: '', diagnostics: { onComplete(t) { unknown = t; } } });
          return { base: { baseUrl: base.baseUrl, byteProvenance: base.byteProvenance }, child: child.byteProvenance, inherited, own, unknown };
        } finally { child.dispose(); base.dispose(); borrowed.dispose(); }
      }, mode);
      const face = trace => trace.steps.find(s => s.action === 'selected' && s.usage === 'paint' && s.role === 'face');
      expect(face(observed.own).resource.byteProvenance.loadId).toBe(observed.child.loadId);
      expect(face(observed.own).owner).toEqual({ baseUrl: '/fixture/child', chainDepth: 0 });
      expect(observed.child.loadId).not.toBe(observed.base.byteProvenance.loadId);
      const expected = cases.find(c => c.id === 'windows-95.push.normal').proposed.paint[0];
      const comparison = compareByteProvenance(face(observed.inherited), observed.base, pins.find(p => p.slug === 'windows-95'), { ...expected, baseUrl: '/themes/windows-95', chainDepth: 1 });
      expect(comparison).toEqual({ status: 'passed', errors: [] });
      expect(face(observed.unknown).resource.byteProvenance).toBeUndefined();
      await attachObservations(info, 'byte-provenance', `${mode}-inheritance`, { execution: { ...gitIdentity(root), mode, browserVersion: page.context().browser().version(), builtBundleSha256: sha256(readFileSync(new URL('../../dist/scriptoscope.js', import.meta.url))) }, observed, comparison, unobservedBorrowedBase: 'unknown' });
    } catch (error) { await attachCase(page, info, { mode }, error); throw error; }
  });
}
