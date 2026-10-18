import { readFileSync } from 'node:fs';
import { comparePatternBinding } from '../resource-provenance/patterns.mjs';
const pins = JSON.parse(readFileSync(new URL('../resource-provenance/pattern-pins.json', import.meta.url)));
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';

const normalRows = ['.............................', '...HEFGHEFGHEFGHEFGHEFGHEF...', '...DABCDABCDABCDABCDABCDAB...', '.FGHEFGHEFGHEFGHEFGHEFGHEFGH.', '.BCDABCDABCDABCDABCDABCDABCD.', '.FGHEFGHEFGHEFGHEFGHEFGHEFGH.', '...DABCDABCDABCDABCDABCDAB...', '...HEFGHEFGHEFGHEFGHEFGHEF...', '.............................'];
const shiftedRows = ['.............................', '...CDABCDABCDABCDABCDABCDA...', '...GHEFGHEFGHEFGHEFGHEFGHE...', '.ABCDABCDABCDABCDABCDABCDABC.', '.EFGHEFGHEFGHEFGHEFGHEFGHEFG.', '.ABCDABCDABCDABCDABCDABCDABC.', '...GHEFGHEFGHEFGHEFGHEFGHE...', '...CDABCDABCDABCDABCDABCDA...', '.............................'];
for (const mode of ['source', 'built']) test(`${mode}: pattern bodies preserve port phase, inset union and actual owner across face states`, async ({ page, servers }, testInfo) => {
  testInfo.annotations.push({ type: 'fidelity-assertion', description: 'pattern.inset-union-phase' });
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      // The face is transparent: body coverage must come from ppat, not face RGB.
      const face = api.PixelBuffer.alloc(7, 7), tile = api.PixelBuffer.alloc(4, 2);
      const colors = Array.from({ length: 8 }, (_, n) => [(n & 1) * 255, ((n >> 1) & 1) * 255, ((n >> 2) & 1) * 255, 255]);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) tile.setPixel(x, y, ...colors[y * 4 + x]);
      const faceUrl = api.bufferToCanvas(face).toDataURL(), patternUrl = api.bufferToCanvas(tile).toDataURL();
      const element = id => ({ sourceCicnId: id, sourceCinfId: id, asset: faceUrl, width: 7, height: 7,
        slice: { corner: 3, side: 1, tile: false }, bodyRequest: { mode: 0, resourceId: 0 }, bgPattern: 'mislinked' });
      const owner = { baseUrl: `${location.origin}/owner/`, manifest: { chromeElements: Object.fromEntries([-10239, -10238, -10240, -10166, -10165, -10167].map(id => [String(id), element(id)])),
        patterns: { zero: { sourcePpatId: 0, asset: patternUrl }, mislinked: { sourcePpatId: 999, asset: '/must-not-load-mismatched-pattern.png' } } } };
      // The child has a misleading same-ID pattern but no face. Its art cannot
      // replace the actual selected face owner's catalog binding.
      const child = { baseUrl: `${location.origin}/child/`, base: owner, manifest: { chromeElements: {}, patterns: { wrong: { sourcePpatId: 0, asset: faceUrl } } } };
      const rows = [];
      for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) for (const shifted of [false, true]) {
        let trace;
        const output = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](child, {
          label: '', minWidth: 29, height: 9, pressed: state === 'pressed', disabled: state === 'disabled',
          compositionContext: { controlOrigin: shifted ? [23, 25] : [20, 20], portOrigin: shifted ? [3, 5] : [0, 0],
            patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: 'unbounded' } },
          diagnostics: { onComplete: value => { trace = value; } },
        });
        const pixels = Array.from({ length: 9 }, (_, y) => Array.from({ length: 29 }, (_, x) => {
          const pixel = [...output.getPixel(x, y)]; if (!pixel[3]) return '.';
          const i = colors.findIndex(color => color.every((v, j) => v === pixel[j])); return i < 0 ? '?' : String.fromCharCode(65 + i);
        }).join(''));
        rows.push({ family, state, shifted, size: [output.width, output.height], pixels, trace });
      }
      return rows;
    }, mode);
    expect(rows).toHaveLength(12);
    expect(rows.filter(r => r.family === 'push' && r.state === 'normal' && !r.shifted)).toHaveLength(1);
    for (const row of rows) {
      expect(row.size).toEqual([29, 9]);
      expect(row.trace.requested).toMatchObject({ state: row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed', pressed: row.state === 'pressed', disabled: row.state === 'disabled' });
      const faceId = { push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10166, pressed: -10165, disabled: -10167 } }[row.family][row.state];
      expect(row.trace.steps.find(step => step.role === 'face' && step.action === 'selected')).toMatchObject({ owner: { chainDepth: 1 }, resource: { signedId: faceId, manifestKey: String(faceId) } });
      expect(row.pixels, `${row.family}/${row.state}/${row.shifted}`).toEqual(row.shifted ? shiftedRows : normalRows);
      expect(row.trace.composition.faceRect).toMatchObject({ w: 29, h: 9 });
      const paints = row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'selected');
      expect(paints).toHaveLength(1);
      expect(paints[0]).toMatchObject({ requestedId: 0, basis: 'compatibility-policy', usage: 'paint',
        owner: { chainDepth: 1 }, resource: { type: 'ppat', signedId: 0, manifestKey: 'zero' } });
      expect(paints[0].owner.baseUrl).toContain('/owner/');
      expect(row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'rejected')).toMatchObject([
        { requestedId: 0, reason: 'linked-pattern-id-mismatch', resource: { type: 'ppat', signedId: 999, manifestKey: 'mislinked' } },
      ]);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'literal-pattern-body-port-rows', rows }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: corner phase and port clipping ignore reserved ring offsets`, async ({ page, servers }, testInfo) => {
  testInfo.annotations.push({ type: 'fidelity-assertion', description: 'pattern.exclusive-anchor-clip' });
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const face = api.PixelBuffer.alloc(7, 7), ring = api.PixelBuffer.alloc(9, 9), tile = api.PixelBuffer.alloc(5, 3);
      face.setPixel(0, 0, 199, 33, 77, 255); ring.setPixel(0, 0, 123, 45, 67, 255);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) tile.setPixel(x, y, (y * 5 + x + 1) * 10, 0, 0, 255);
      const url = source => api.bufferToCanvas(source).toDataURL();
      const faceEntry = { sourceCicnId: -10239, asset: url(face), width: 7, height: 7,
        slice: { corner: 3, side: 1, tile: false }, bodyRequest: { mode: 0, resourceId: 0 } };
      const theme = { baseUrl: location.origin, manifest: { chromeElements: { face: faceEntry,
        ring: { sourceCicnId: -10231, asset: url(ring), width: 9, height: 9, slice: { corner: 1, side: 1, tile: false } } },
        patterns: { tile: { sourcePpatId: 0, asset: url(tile) } } } };
      const rows = [];
      for (const bodyMode of [0, 1, 2, 3, 4, 6, 127, 128, 255]) for (const clipped of [false, true]) {
        faceEntry.bodyRequest.mode = bodyMode; let trace;
        const output = await api.composeButton(theme, { label: '', minWidth: 29, height: 8, default: true,
          compositionContext: { controlOrigin: [23, 25], portOrigin: [3, 5], patternOrigin: { status: 'known', offset: [-3, 5] },
            clip: clipped ? { kind: 'rect', rect: { x: 27, y: 27, w: 5, h: 4 } } : { kind: 'unbounded' } },
          diagnostics: { onComplete: value => { trace = value; } },
        });
        rows.push({ bodyMode, clipped, trace, size: [output.width, output.height],
          inside: [...output.getPixel(8, 6)], farInside: [...output.getPixel(12, 9)],
          leftOutside: [...output.getPixel(7, 6)], rightOutside: [...output.getPixel(13, 6)],
          faceCorner: [...output.getPixel(4, 4)], ringCorner: [...output.getPixel(0, 0)], composition: trace.composition });
      }
      return rows;
    }, mode);
    // Literal independent source coordinates at face q(4,2), then q(8,5).
    const first = [14, 6, 7, 11, 12], second = [13, 5, 6, 10, 11];
    expect(rows.filter(r => r.bodyMode === 2 && r.clipped)).toHaveLength(1);
    for (const row of rows) {
      expect(row.size).toEqual([37, 16]);
      expect(row.trace.requested).toMatchObject({ state: 'active', pressed: false, disabled: false, default: true });
      expect(row.trace.steps.find(step => step.role === 'face' && step.action === 'selected')).toMatchObject({ owner: { chainDepth: 0 }, resource: { signedId: -10239, manifestKey: 'face' } });
      expect(row.trace.steps.find(step => step.role === 'default-ring' && step.action === 'selected' && step.usage === 'paint')).toMatchObject({ owner: { chainDepth: 0 }, resource: { signedId: -10231, manifestKey: 'ring' } });
      expect(row.inside).toEqual([(first[row.bodyMode > 4 ? 0 : row.bodyMode] + 1) * 10, 0, 0, 255]);
      expect(row.farInside).toEqual([(second[row.bodyMode > 4 ? 0 : row.bodyMode] + 1) * 10, 0, 0, 255]);
      expect(row.composition).toMatchObject({ faceRect: { x: 23, y: 25, w: 29, h: 8 }, appliedUnknownPatternOffset: false });
      if (row.clipped) for (const key of ['leftOutside', 'rightOutside', 'faceCorner', 'ringCorner']) expect(row[key], key).toEqual([0, 0, 0, 0]);
      else { expect(row.faceCorner).toEqual([199, 33, 77, 255]); expect(row.ringCorner).toEqual([123, 45, 67, 255]); }
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'exclusive-corner-phase-port-clip', rows }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: Crayon painted dependencies join pinned bytes and independent source color samples`, async ({ page, servers }, info) => {
  info.annotations.push({ type: 'fidelity-assertion', description: 'pattern.actual-source-samples' });
  await openHarness(page, servers, mode);
  let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const owner = await api.loadTheme('/themes/crayon-os', { provenance: true });
      try {
        const rows = [];
        for (const inherited of [false, true]) for (const state of ['normal', 'pressed', 'disabled']) {
          const theme = inherited ? { baseUrl: `${location.origin}/empty-child/`, manifest: { chromeElements: {} }, base: owner } : owner;
          let trace;
          const output = await api.composeButton(theme, { label: '', minWidth: 80, height: 20,
            pressed: state === 'pressed', disabled: state === 'disabled',
            compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: 'unbounded' } },
            diagnostics: { onComplete: value => { trace = value; } },
          });
          // Four-pixel ring reservation is separate from face origin and phase.
          rows.push({ inherited, state, size: [output.width, output.height], samples: [[8, 8], [63, 9], [64, 9]].map(([x, y]) => [...output.getPixel(x + 4, y + 4)]), trace });
        }
        return { rows, owner: { manifest: { patterns: owner.manifest.patterns }, byteProvenance: owner.byteProvenance } };
      } finally { owner.dispose(); }
    }, mode);
    expect(result.rows.filter(r => !r.inherited && r.state === 'normal')).toHaveLength(1);
    for (const row of result.rows) {
      expect(row.trace.requested).toMatchObject({ state: row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed', pressed: row.state === 'pressed', disabled: row.state === 'disabled', default: false });
      const face = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      expect(face.resource).toMatchObject({ signedId: { normal: -10239, pressed: -10238, disabled: -10240 }[row.state], manifestKey: `push-button-${row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed'}` });
      expect(row.size).toEqual([88, 28]);
      expect(row.trace.composition.faceRect).toMatchObject({ w: 80, h: 20 });
      const painted = row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'selected');
      expect(painted).toHaveLength(1);
      const step = painted[0], id = row.state === 'pressed' ? -10238 : 17;
      expect(step).toMatchObject({ requestedId: id, bodyMode: 0, basis: 'compatibility-policy', usage: 'paint',
        owner: { chainDepth: row.inherited ? 1 : 0 }, resource: { type: 'ppat', signedId: id } });
      const entry = result.owner.manifest.patterns[step.resource.manifestKey], pin = pins.patterns.find(pin => pin.signedId === id);
      expect(step.resource.byteProvenance).toEqual(entry.byteProvenance);
      expect(comparePatternBinding(result.owner, step.resource.manifestKey, { ...pin,
        inputSha256: pins.archiveSha256, forkSha256: pins.forkSha256,
        resourceIndex: step.resource.byteProvenance.ppatResourceIndex }).status).toBe('matched');
      // Independent raw palette observations: normal[8,8]=(231,222,198),
      // [63,9]=(247,247,214), [0,9]=(247,239,214); pressed[8,8]=(33,33,198).
      // Literal expected bytes apply the DECLARED 1.8/2.2 display transform;
      // they do not establish an original 8-bit destination palette or color match.
      if (row.state === 'pressed') expect(row.samples[0]).toEqual([48, 48, 207, 255]);
      else expect(row.samples).toEqual([[235, 228, 207, 255], [248, 248, 221, 255], [248, 242, 221, 255]]);
    }
    await attachObservations(info, 'pattern-paint', mode, { mode, pins, result, limits: 'Observed actual paint bindings and independent source samples; original lookup/port/device color remain unverified' });
  } catch (error) { await attachCase(page, info, { mode, pins, result, limits: 'Source-art/context model, not original palette or lookup ownership' }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: missing or unsupported body requests stay explicit and interactive context is one snapshot`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const face = api.PixelBuffer.alloc(7, 7); face.fillRect({ x: 0, y: 0, w: 7, h: 7 }, 255, 255, 255, 255);
      const asset = api.bufferToCanvas(face).toDataURL();
      const entry = id => ({ sourceCicnId: id, asset, width: 7, height: 7, slice: { corner: 3, side: 1, tile: false }, bgAnchor: [3, 3] });
      const normal = entry(-10239), theme = { baseUrl: location.origin, manifest: { chromeElements: { normal, pressed: entry(-10238) },
        patterns: { mustNotLoad: { sourcePpatId: 17, asset: '/missing-unsupported-body-must-not-load.png' } } } };
      const requests = [null, { mode: 5, resourceId: 17 }, { mode: 0, resourceId: -99 }], rows = [];
      for (const request of requests) {
        normal.bodyRequest = request; let trace;
        const out = await api.composeButton(theme, { label: '', diagnostics: { onComplete: value => { trace = value; } } });
        rows.push({ request, pixel: [...out.getPixel(10, 3)], trace });
      }
      normal.bodyRequest = null;
      const input = { controlOrigin: [3, 5], portOrigin: [0, 0], patternOrigin: { status: 'unknown' }, clip: { kind: 'unbounded' } }, traces = [];
      const element = await api.interactiveButton(theme, { label: '', compositionContext: input, diagnostics: { onComplete: trace => {
        traces.push(trace); input.controlOrigin[0] = 99;
      } } });
      element.remove(); // detached fixture; page teardown releases its local listeners
      let invalidTrace, callbacks = 0, errorName;
      try { await api.composeButton(theme, { compositionContext: { ...input, controlOrigin: [NaN, 0] }, diagnostics: { onComplete: value => { invalidTrace = value; callbacks++; } } }); }
      catch (error) { errorName = error.name; }
      return { rows, traces, callerOrigin: input.controlOrigin, invalidTrace, callbacks, errorName };
    }, mode);
    for (const row of result.rows) {
      expect(row.pixel).toEqual([255, 255, 255, 255]);
      expect(row.trace.composition).toMatchObject({ originalPortState: 'unverified', appliedUnknownPatternOffset: true,
        context: { basis: 'compatibility-default', controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'unknown' }, clip: { kind: 'unknown' } } });
      const decisions = row.trace.steps.filter(step => step.role === 'body-fill');
      if (!row.request) expect(decisions).toEqual([]);
      else {
        expect(decisions).toHaveLength(1);
        expect(decisions[0]).toMatchObject({ requestedId: row.request.resourceId, bodyMode: row.request.mode,
          action: row.request.mode === 0 ? 'missing' : 'fallback', requestedResourceType: row.request.mode === 5 ? 'cicn' : 'ppat' });
        expect(decisions[0].resource).toBeUndefined();
      }
    }
    expect(result.traces).toHaveLength(2);
    for (const trace of result.traces) expect(trace.composition.context.controlOrigin).toEqual([3, 5]);
    expect(result.callerOrigin).toEqual([99, 5]);
    expect(result).toMatchObject({ callbacks: 1, errorName: 'RangeError', invalidTrace: { outcome: { status: 'error' } } });
  } catch (error) { await attachCase(page, info, { mode, result }, error); throw error; }
});


for (const mode of ['source', 'built']) test(`${mode}: numeric pattern names retain actual decoder order with and without byte observation`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const loader = mode === 'built' ? api : await import('/tools/theme-loader/loadKaleidoscopeScheme.js');
      const { forkOf, cinf, onePixelCicn } = await import('/tests/resource-provenance/fixtures.mjs');
      const { twoPixelPpat } = await import('/tests/resource-provenance/patterns.mjs');
      const request = cinf(); request[0] = 0; request[1] = 0;
      const bytes = forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() },
        { type: 'cinf', id: -10239, data: request },
        { type: 'ppat', id: 0, name: '2', data: twoPixelPpat() },
        { type: 'ppat', id: 0, name: '1', data: twoPixelPpat({ red: 0 }) }]);
      const rows = [];
      for (const provenance of [false, true]) {
        const theme = await loader.loadKaleidoscopeScheme(bytes, { provenance });
        try {
          const face = Object.values(theme.manifest.chromeElements)[0];
          let trace;
          const output = await api.composeButton(theme, { label: '', minWidth: 29, height: 9,
            diagnostics: { onComplete: value => { trace = value; } } });
          const row = { provenance, keys: Object.keys(theme.manifest.patterns), bodyPattern: face.bodyPattern,
            bgPattern: face.bgPattern, pixel: [...output.getPixel(0, 0)], trace, legacy: [] };
          delete face.bodyPattern;
          for (const linked of [false, true]) {
            if (linked) face.bgPattern = '1';
            let legacyTrace;
            const legacy = await api.composeButton(theme, { label: '', minWidth: 29, height: 9,
              diagnostics: { onComplete: value => { legacyTrace = value; } } });
            row.legacy.push({ linked, pixel: [...legacy.getPixel(0, 0)], trace: legacyTrace });
          }
          rows.push(row);
        } finally { theme.dispose(); }
      }
      return rows;
    }, mode);
    for (const row of result) {
      // Hand-encoded first occurrence is red; last occurrence is black. The
      // numeric names sort in the opposite order; observation cannot change paint.
      expect(row.pixel).toEqual([0, 0, 0, 255]);
      expect(row).toMatchObject({ keys: ['1', '2'], bodyPattern: '1', bgPattern: null });
      const selected = row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'selected');
      expect(selected).toHaveLength(1);
      expect(selected[0].resource).toMatchObject({ type: 'ppat', signedId: 0, manifestKey: '1' });
      if (row.provenance) expect(selected[0].resource.byteProvenance.ppatResourceIndex).toBe(3);
      else expect(selected[0].resource.byteProvenance).toBeUndefined();
      expect(selected[0].reason).toBe('carried-body-pattern-paint');
      const [ambiguous, linked] = row.legacy;
      expect(ambiguous.pixel).toEqual([255, 0, 0, 255]); // retained solid fallback, no invented order
      expect(ambiguous.trace.steps.filter(step => step.role === 'body-fill')).toMatchObject([
        { action: 'missing', reason: 'ambiguous-legacy-pattern-order', requestedId: 0 },
      ]);
      expect(linked.pixel).toEqual([0, 0, 0, 255]);
      expect(linked.trace.steps.filter(step => step.role === 'body-fill')).toMatchObject([
        { action: 'selected', reason: 'legacy-linked-pattern-paint', resource: { manifestKey: '1' } },
      ]);
    }
    await attachObservations(info, 'pattern-paint', `${mode}-numeric-order`, { mode, result });
  } catch (error) { await attachCase(page, info, { mode, result }, error); throw error; }
});
