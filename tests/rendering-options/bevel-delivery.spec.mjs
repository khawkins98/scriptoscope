// Independent current-compatibility coverage from bevel.md BV01–BV08 and
// bevel-current-boundary.md. Synthetic inputs; no native-fidelity assertion.
import { test, expect } from './fixtures.mjs';
import { literalCicn } from '../decoder-fixtures/mode5.mjs';
import { forkOf } from '../resource-provenance/fixtures.mjs';
import { rawCinf } from './owned-control-fixture.mjs';
const modeFork = depth => Array.from(forkOf([
  { type: 'cicn', id: -10166, name: 'bevel', data: literalCicn({ rows: Array(5).fill('GGGGG'), maskRows: Array(5).fill('00000'), depth: 8, palette: ['G'] }) },
  { type: 'cinf', id: -10166, data: rawCinf({ corner: 1, side: 1, mode: 5, resourceId: -51 }) },
  { type: 'cicn', id: -51, name: 'body', data: literalCicn({ rows: ['KW'.repeat(7), 'WK'.repeat(7)], maskRows: ['10'.repeat(7), '01'.repeat(7)], depth, palette: ['W', 'K'] }) },
]));

async function observe(page, servers, mode, scenario) {
  await page.route('**/bevel-delivery.html', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Bevel delivery</title>' }));
  await page.goto(`${servers[mode]}/bevel-delivery.html`);
  return page.evaluate(async ({ mode, scenario, fork }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const url = (w, h, pixel) => {
      const b = api.PixelBuffer.alloc(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.setPixel(x, y, ...pixel(x, y));
      return api.bufferToCanvas(b).toDataURL();
    };
    const policy = 'mac-1.8-to-2.2-high-byte';
    const face = { sourceCicnId: -10166, sourceCinfId: null, width: 5, height: 5,
      asset: url(5, 5, () => [0, 0, 0, 0]), slice: { corner: 2, side: 1, tile: false }, bgAnchor: [0, 0],
      bodyRequest: { mode: 0, resourceId: 17 }, colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: policy,
        background: { rgb16: [0, 0, 65535], displayRgb: [0, 0, 255] }, embossDecision: 'absent-coordinates' } };
    const theme = { baseUrl: '', manifest: { chromeElements: { face }, patterns: {} } };
    const options = { label: '', minWidth: 16, height: 6 };
    const events = [], traces = [];
    const diagnostics = { onComplete(t) { events.push('callback'); traces.push(t); } };
    const finish = b => ({ size: b && [b.width, b.height], data: b && Array.from(b.data), traces, events });
    if (scenario === 'solid' || scenario === 'malformed') {
      if (scenario === 'malformed') theme.manifest.engineCinfs = { '-10166': [255] };
      return finish(await api.composeBevelButton(theme, { ...options, diagnostics }));
    }
    if (scenario === 'ambiguous') {
      theme.manifest.patterns = { first: { sourcePpatId: 17, asset: '/must-not-decode-first.png' }, second: { sourcePpatId: 17, asset: '/must-not-decode-second.png' } };
      return finish(await api.composeBevelButton(theme, { ...options, diagnostics }));
    }
    if (scenario === 'pattern') {
      theme.manifest.patterns.tile = { sourcePpatId: 17, asset: url(3, 2, (x, y) => [(1 + x + 3 * y) * 20, 0, 0, 255]) };
      face.bodyPattern = 'tile'; face.bodyRequest.mode = 2;
      const compositionContext = { controlOrigin: [10, 20], portOrigin: [3, 4], patternOrigin: { status: 'known', offset: [1, -1] },
        clip: { kind: 'rect', rect: { x: 12, y: 22, w: 3, h: 2 } } };
      return finish(await api.composeBevelButton(theme, { ...options, diagnostics, compositionContext }));
    }
    if (scenario === 'legacy') {
      delete face.slice; delete face.bodyRequest; delete face.colorSamples;
      face.bgAnchor = [2, 2];
      face.asset = url(5, 5, (x, y) => x === 2 && y === 2 ? [0, 0, 255, 255] : [255, 0, 0, 128]);
      return finish(await api.composeBevelButton(theme, { ...options, diagnostics,
        compositionContext: { controlOrigin: [10, 20], portOrigin: [0, 0], patternOrigin: { status: 'unknown' },
          clip: { kind: 'rect', rect: { x: 11, y: 21, w: 6, h: 4 } } } }));
    }
    if (scenario === 'alpha') {
      face.asset = url(5, 5, (x, y) => x === 1 && y <= 1 ? [255, 0, 0, 128] : [0, 0, 0, 0]);
      // Top band is red at alpha128; a blue body lies underneath at y1
      // when side thickness is2. Both border alpha stages must survive.
      face.slice = { corner: 1, side: 2, tile: false };
      return finish(await api.composeBevelButton(theme, { ...options, diagnostics }));
    }
    if (scenario === 'failure' || scenario === 'callback-success' || scenario === 'callback-error' || scenario === 'late-border') {
      const renderError = new Error('independent-body-export-failure');
      const callbackError = new Error('independent-callback-failure');
      const source = { manifest: theme.manifest };
      const owned = { kind: 'owned-theme', source, origin: 'synthetic', dispose() {},
        async imageUrl(ref) { events.push(`export:${ref}`); if (ref === 'bad-pattern') throw renderError; return ref === 'face' ? face.asset : ref; } };
      face.asset = 'face';
      const faceImage = url(5, 5, () => scenario === 'late-border' ? [255, 255, 255, 255] : [0, 0, 0, 0]);
      const patternImage = url(1, 1, () => [0, 255, 0, 255]);
      owned.imageUrl = async ref => { events.push(`export:${ref}`); if (ref === 'bad-pattern' || ref === 'bad-sampled') throw renderError; return ref === 'face' ? faceImage : ref === 'pattern' ? patternImage : ref; };
      if (scenario === 'late-border') {
        face.sampledBandAsset = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb', displayPolicy: policy, width: 5, height: 5, asset: 'bad-sampled', derivedPath: 'cicn-sampled/independent.png' };
        face.bodyPattern = 'p'; theme.manifest.patterns.p = { sourcePpatId: 17, asset: 'pattern' };
      } else if (scenario !== 'callback-success') {
        face.bodyPattern = 'p'; theme.manifest.patterns.p = { sourcePpatId: 17, asset: 'bad-pattern' };
      }
      let original = false, callbackIdentity = false, error;
      try { await api.composeBevelButton(owned, { ...options, diagnostics: { onComplete(t) {
        events.push('callback'); traces.push(t); if (scenario !== 'failure') throw callbackError;
      } } }); } catch (e) { original = e === renderError; callbackIdentity = e === callbackError; error = e.message; }
      return { original, callbackIdentity, error, traces, events };
    }
    if (scenario === 'mode5-masked' || scenario === 'mode5-unmasked' || scenario === 'lifetime') {
      const owner = await (scenario === 'lifetime' ? api.loadOwnedKaleidoscopeScheme : api.loadKaleidoscopeScheme)(new Uint8Array(fork));
      try {
        if (scenario === 'lifetime') {
          let callbacks = 0, status;
          let error;
          try { await api.composeBevelButton(owner, { label: '', minWidth: 4, height: 4,
            diagnostics: { onComplete(t) { callbacks++; status = t.outcome.status; owner.dispose(); } } }); }
          catch (e) { error = e.name; }
          return { callbacks, status, error };
        }
        return finish(await api.composeBevelButton(owner, { label: '', minWidth: 4, height: 4, diagnostics }));
      } finally { owner.dispose(); }
    }
    throw Error('Unknown independent scenario');
  }, { mode, scenario, fork: scenario.startsWith('mode5') || scenario === 'lifetime' ? modeFork(scenario === 'mode5-masked' ? 1 : 8) : null });
}
const pixel = (row, x, y) => row.data.slice((y * row.size[0] + x) * 4, (y * row.size[0] + x) * 4 + 4);
const bodySteps = row => row.traces[0].steps.filter(s => s.bodyPaint);
for (const mode of ['source', 'built']) {
  for (const scenario of ['solid', 'malformed']) test(`${mode}: bevel ${scenario} raw cinf retains caller-declared solid metadata`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, scenario);
    expect(row.size).toEqual([16, 6]);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
      const body = x >= 2 && x < 14 && y >= 1 && y < 5 || x >= 1 && x < 15 && y >= 2 && y < 4;
      expect(pixel(row, x, y), `${x},${y}`).toEqual(body ? [0, 0, 255, 255] : [0, 0, 0, 0]);
    }
    expect(row.events).toEqual(['callback']); expect(row.traces[0].outcome.status).toBe('themed');
    expect(row.traces[0].steps.some(s => s.reason === 'same-face-owner-pattern-unavailable')).toBe(true);
  });
  test(`${mode}: bevel ambiguous pattern remains distinct from genuine absence`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, 'ambiguous');
    expect(row.data.every(v => v === 0)).toBe(true);
    expect(row.traces[0].steps.some(s => s.reason === 'ambiguous-legacy-pattern-order')).toBe(true);
    expect(bodySteps(row)).toHaveLength(0);
  });
  test(`${mode}: bevel pattern phase survives clipped inset overlap`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, 'pattern');
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
      const visible = x >= 2 && x < 5 && y >= 2 && y < 4;
      // Mode2 F=(-15,-1): (F+local) modulo3x2, independently literal.
      const samples = [[120, 80, 100], [60, 20, 40]];
      expect(pixel(row, x, y)).toEqual(visible ? [samples[y - 2][x - 2], 0, 0, 255] : [0, 0, 0, 0]);
    }
    expect(bodySteps(row)).toHaveLength(1);
    expect(bodySteps(row)[0].bodyPaint).toMatchObject({ branch: 'pattern-fill-union', paintedPixels: 6, sourceSize: [3, 2] });
  });
  for (const scenario of ['mode5-masked', 'mode5-unmasked']) test(`${mode}: bevel aligned ${scenario} keeps transfer and completion distinct`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, scenario);
    expect(row.size).toEqual([16, 4]);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
      const inside = x >= 1 && x < 15 && y >= 1 && y < 3;
      const clear = (x + y) % 2 !== 0;
      expect(pixel(row, x, y)).toEqual(!inside || scenario === 'mode5-masked' && clear ? [0, 0, 0, 0] : clear ? [255, 255, 255, 255] : [0, 0, 0, 255]);
    }
    expect(bodySteps(row)).toHaveLength(1);
    expect(bodySteps(row)[0].bodyPaint).toMatchObject({ branch: scenario === 'mode5-masked' ? 'masked-copy' : 'unmasked-copy', paintedPixels: scenario === 'mode5-masked' ? 14 : 28 });
  });
  test(`${mode}: bevel rectangular approximation retains center overwrite and final clip`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, 'legacy');
    expect(row.size).toEqual([16, 6]);
    expect(pixel(row, 0, 0)).toEqual([0, 0, 0, 0]); expect(pixel(row, 7, 5)).toEqual([0, 0, 0, 0]);
    expect(pixel(row, 3, 3)).toEqual([0, 0, 255, 255]);
    expect(pixel(row, 1, 1)).toEqual([255, 0, 0, 128]);
    expect(row.traces[0].legacyFacePaint).toBeDefined();
  });
  test(`${mode}: bevel border retains two alpha stages over a solid body`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, 'alpha');
    expect(pixel(row, 3, 0)).toEqual([64, 0, 0, 128]);
    expect(pixel(row, 3, 1)).toEqual([64, 0, 127, 255]);
    expect(pixel(row, 3, 2)).toEqual([0, 0, 255, 255]);
  });
  for (const scenario of ['failure', 'callback-success', 'callback-error', 'late-border']) test(`${mode}: bevel ${scenario} retains callback identity and staged completion`, async ({ page, servers }) => {
    const row = await observe(page, servers, mode, scenario);
    expect(row.events.filter(x => x === 'callback')).toHaveLength(1);
    expect(row.traces).toHaveLength(1);
    if (scenario === 'callback-success') { expect(row.callbackIdentity).toBe(true); expect(row.traces[0].outcome.status).toBe('themed'); }
    else { expect(row.original).toBe(true); expect(row.traces[0].outcome.status).toBe('error'); expect(bodySteps(row)).toHaveLength(0); expect(row.traces[0].legacyFacePaint).toBeUndefined();
      if (scenario === 'late-border') {
        expect(row.traces[0].steps.some(s => s.role === 'body-fill' && s.action === 'selected' && s.resource?.type === 'ppat')).toBe(true);
        expect(row.events.indexOf('export:pattern')).toBeLessThan(row.events.indexOf('export:bad-sampled'));
        expect(row.traces[0].bandPaints.length).toBeGreaterThan(0);
      }
    }
  });
  test(`${mode}: bevel disposal in successful completion rejects afterward without a second callback`, async ({ page, servers }) => {
    expect(await observe(page, servers, mode, 'lifetime')).toEqual({ callbacks: 1, status: 'themed', error: 'AbortError' });
  });
}
