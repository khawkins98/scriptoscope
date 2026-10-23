import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { solidBackgroundIcon, solidBackgroundInfo, solidBackgroundRows } from '../decoder-fixtures/solid-background.mjs';
import { verifySolidCases } from '../rendering-requirements/solid-cases.mjs';
import { solidMutations } from '../rendering-requirements/solid-negatives.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const mode of ['source', 'built']) test(`${mode}: solid bodies consume selected-owner raw background beneath masked and opaque palette collisions`, async ({ page, servers }, info) => {
  info.annotations.push({ type: 'fidelity-assertion', description: 'solid.selected-rgb16-literal' });
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const { solidBackgroundIcon, solidBackgroundInfo } = await import('/tests/decoder-fixtures/solid-background.mjs');
      const rows = [];
      for (const collision of [false, true]) for (const resourceId of [0, 17]) {
        const bytes = solidBackgroundIcon({ opaqueBackground: collision, collision });
        const cinf = solidBackgroundInfo({ resourceId });
        const ids = [-10239, -10238, -10240, -10166, -10165, -10167];
        const owner = await api.loadKaleidoscopeScheme(forkOf(ids.flatMap(id => [{ type: 'cicn', id, data: bytes }, { type: 'cinf', id, data: cinf }])), { provenance: true });
        const child = { baseUrl: `${location.origin}/wrong-child/`, base: owner, manifest: { chromeElements: {
          decoy: { sourceCicnId: -999, colorSamples: { background: { displayRgb: [255, 0, 0] } } },
        } } };
        try { for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) for (const override of [false, true]) {
          let trace;
          const options = {
            ...(family === 'push' ? { default: false } : { on: false, small: false }),
            label: '', minWidth: 29, height: 9, pressed: state === 'pressed', disabled: state === 'disabled', ...(override ? { fg: '#ff0000' } : {}),
          };
          const out = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](child, { ...options, diagnostics: { onComplete: value => { trace = value; } } });
          const selected = trace.steps.find(s => s.role === 'face' && s.action === 'selected');
          const element = owner.manifest.chromeElements[selected.resource.manifestKey];
          rows.push({ collision, resourceId, family, state, override, options, owner: { baseUrl: owner.baseUrl, byteProvenance: owner.byteProvenance }, childBaseUrl: child.baseUrl, childDeclaration: child.manifest, size: [out.width, out.height], trace,
            background: element.colorSamples.background, resources: owner.byteProvenance.resources.filter(r =>
              r.resourceIndex === element.byteProvenance.cicnResourceIndex || r.resourceIndex === element.byteProvenance.cinfResourceIndex),
            pixels: Array.from({ length: 9 }, (_, y) => Array.from({ length: 29 }, (_, x) => {
              const p = [...out.getPixel(x, y)]; return p[3] === 0 ? '.' : p.every((v, i) => v === [48, 48, 48, 255][i]) ? 'G'
                : p.every((v, i) => v === [0, 0, 255, 255][i]) ? 'B' : '?';
            }).join('')) });
        } } finally { owner.dispose(); }
      }
      return rows;
    }, mode);
    expect(result).toHaveLength(48);
    for (const row of result) {
      expect(row.size).toEqual([29, 9]);
      expect(row.background).toEqual({ rgb16: [0x2121, 0x2121, 0x2121], displayRgb: [48, 48, 48] });
      const selected = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      expect(selected.owner.chainDepth).toBe(1); expect(selected.owner.baseUrl).not.toContain('wrong-child');
      const id = { push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10166, pressed: -10165, disabled: -10167 } }[row.family][row.state];
      expect(selected.resource.signedId).toBe(id);
      expect(row.resources.find(r => r.type === 'cicn')).toMatchObject({ signedId: id, sha256: hash(solidBackgroundIcon({ opaqueBackground: row.collision, collision: row.collision })) });
      expect(row.resources.find(r => r.type === 'cinf')).toMatchObject({ signedId: id, sha256: hash(solidBackgroundInfo({ resourceId: row.resourceId })) });
      expect(row.trace.textColors.policy).toBe(row.override ? 'caller-override' : 'source-samples');
      expect(row.pixels, `${row.family}/${row.state}/collision=${row.collision}/id=${row.resourceId}/fg=${row.override}`).toEqual(solidBackgroundRows);
    }
    const verifiedCaseIds = verifySolidCases(result);
    const negatives = [];
    for(const role of ['face','body-fill']){const changed=structuredClone(result),paint=changed[0].trace.steps.find(s=>s.role===role&&s.usage==='paint');changed[0].trace.steps.push(structuredClone(paint));expect(()=>verifySolidCases(changed),`duplicate actual ${role} paint`).toThrow();negatives.push(`duplicate-actual-${role}-paint`);}
    for (const [name, mutate] of solidMutations) {
      const changed = structuredClone(result); mutate(changed);
      expect(() => verifySolidCases(changed), name).toThrow(); negatives.push(name);
    }
    await attachObservations(info, 'solid-background', `${mode}-source-color`, { mode, result, verifiedCaseIds, negatives, evidence: 'literal-source-sample-and-inset-union',
      limits: 'Diagnostic serialized bytes; existing LUT policy, not original device/palette or lookup ownership verification' });
  } catch (error) { await attachCase(page, info, { mode, result, expected: solidBackgroundRows }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: raw solid admission preserves unknown metadata, unsupported bodies and selected pattern priority`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const { solidBackgroundIcon, solidBackgroundInfo } = await import('/tests/decoder-fixtures/solid-background.mjs');
      const bytes = forkOf([{ type: 'cicn', id: -10239, data: solidBackgroundIcon() }, { type: 'cinf', id: -10239, data: solidBackgroundInfo() }]);
      const owner = await api.loadKaleidoscopeScheme(bytes);
      const key = Object.keys(owner.manifest.chromeElements)[0], initial = owner.manifest.chromeElements[key];
      const green = api.PixelBuffer.alloc(1, 1); green.setPixel(0, 0, 0, 255, 0, 255);
      const url = api.bufferToCanvas(green).toDataURL(); const rows = [];
      try {
        for (const variant of ['missing', 'wrong-model', 'wrong-policy', 'invalid-display', 'invalid-rgb16', 'ambiguous-sample', 'invalid-anchor', 'legacy-no-request', 'mode5', 'invalid-mode', 'invalid-resource', 'invalid-slice', 'declared-display', 'ambiguous-pattern', 'ppat0', 'ppat17', 'label', 'label-override']) {
          const el = structuredClone(initial); owner.manifest.chromeElements[key] = el; owner.manifest.patterns = {};
          if (variant === 'missing') delete el.colorSamples;
          if (variant === 'wrong-model') el.colorSamples.model = 'unknown';
          if (variant === 'wrong-policy') el.colorSamples.displayPolicy = 'unknown';
          if (variant === 'invalid-display') el.colorSamples.background.displayRgb = [NaN, 48, 48];
          if (variant === 'invalid-rgb16') el.colorSamples.background.rgb16 = [-1, 8481, 8481];
          if (variant === 'ambiguous-sample') el.colorSamplesUnavailableReason = 'ambiguous-asset-path';
          if (variant === 'invalid-anchor') el.bgAnchor = [99, 99];
          if (variant === 'legacy-no-request') delete el.bodyRequest;
          if (variant === 'mode5') el.bodyRequest.mode = 5;
          if (variant === 'invalid-mode') el.bodyRequest.mode = 256;
          if (variant === 'invalid-resource') el.bodyRequest.resourceId = 32768;
          if (variant === 'invalid-slice') el.slice.corner = 3.5;
          if (variant === 'declared-display') el.colorSamples.background.displayRgb = [96, 96, 96];
          if (variant === 'ambiguous-pattern') owner.manifest.patterns = { 2: { sourcePpatId: 0, asset: url }, 1: { sourcePpatId: 0, asset: url } };
          if (variant.startsWith('ppat')) { el.bodyRequest.resourceId = Number(variant.slice(4)); owner.manifest.patterns = { exact: { sourcePpatId: el.bodyRequest.resourceId, asset: url } }; }
          let trace; const labelled = variant.startsWith('label');
          const out = await api.composeButton(owner, { label: labelled ? 'H' : '', minWidth: labelled ? 80 : 29, height: labelled ? 20 : 9,
            ...(variant === 'label-override' ? { fg: '#ff0000' } : {}), diagnostics: { onComplete: value => { trace = value; } } });
          let blue = 0, red = 0;
          if (labelled) for (let y = 3; y < 17; y++) for (let x = 25; x < 55; x++) {
            const p = [...out.getPixel(x, y)]; if (p.every((v, i) => v === [0, 0, 255, 255][i])) blue++;
            if (p.every((v, i) => v === [255, 0, 0, 255][i])) red++;
          }
          let legacyPixels;
          if (variant === 'invalid-slice') {
            delete el.colorSamples;
            const legacy = await api.composeButton(owner, { label: '', minWidth: 29, height: 9 });
            legacyPixels = Array.from(legacy.data);
          }
          rows.push({ variant, center: [...out.getPixel(4, 4)], arm: [...out.getPixel(1, 4)], trace, blue, red,
            ...(legacyPixels ? { pixels: Array.from(out.data), legacyPixels } : {}) });
        }
        owner.manifest.chromeElements[key] = structuredClone(initial);
        owner.manifest.patterns = { broken: { sourcePpatId: 0, asset: 'data:image/png;base64,AAAA' } };
        let decodeRejected = false; try { await api.composeButton(owner, { label: '' }); } catch { decodeRejected = true; }
        return { rows, decodeRejected };
      } finally { owner.dispose(); }
    }, mode);
    expect(result.decodeRejected).toBe(true);
    for (const row of result.rows) {
      if (row.variant.startsWith('label')) {
        expect(row.center).toEqual([48, 48, 48, 255]);
        expect(row.trace.textColors.policy).toBe(row.variant === 'label' ? 'source-samples' : 'caller-override');
        expect(row.variant === 'label' ? row.blue : row.red).toBeGreaterThan(0);
        expect(row.variant === 'label' ? row.red : row.blue).toBe(0);
      } else if (row.variant === 'invalid-slice') {
        // Fractional geometry is not admitted to the raw-source body. Preserve
        // the existing legacy result exactly without claiming it is meaningful art.
        expect(row.pixels).toEqual(row.legacyPixels);
        expect(row.center).not.toEqual([48, 48, 48, 255]);
      } else if (row.variant === 'declared-display') {
        // Direct hand-built metadata is a caller declaration. Public loading
        // validates RGB16/display consistency; rendering does not reapply a LUT.
        expect(row.center).toEqual([96, 96, 96, 255]); expect(row.arm).toEqual([96, 96, 96, 255]);
      } else if (row.variant.startsWith('ppat')) {
        expect(row.center).toEqual([0, 255, 0, 255]); expect(row.arm).toEqual([0, 255, 0, 255]);
        expect(row.trace.steps.filter(s => s.role === 'body-fill' && s.action === 'selected')).toHaveLength(1);
      } else {
        expect(row.center, row.variant).toEqual([0, 0, 255, 255]);
        expect(row.arm, row.variant).toEqual([0, 0, 0, 0]);
      }
    }
    await attachObservations(info, 'solid-background', `${mode}-boundaries`, { mode, result });
  } catch (error) { await attachCase(page, info, { mode, result }, error); throw error; }
});
