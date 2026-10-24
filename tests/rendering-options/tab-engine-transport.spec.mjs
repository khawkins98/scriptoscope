import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { TAB_ENGINE_PATTERN_ROWS, TAB_ENGINE_SOLID_ROWS } from './tab-engine-rules.mjs';

// MD/OR/CS expected decisions frozen from independently reviewed7283626e.
// These are modern declared-transport obligations, not raw-census/native proof.
const decisions = {
  local: true, rawOnly: true, omittedPairId: true, legacyOrigin: true,
  unusedText: true, unusedStrongOnPattern: true, maskedRaw: true,
  nullContradiction: false, wrongPairId: false, rawContradiction: false,
  nullOrigin: false, nullSource: false, nonzeroOrigin: false, boundsMismatch: false,
  sourceIdMismatch: false, nonbinaryAlpha: false, dimensionMismatch: false,
  wrongLocalDisplay: false, inconsistentRgb: false, strongDowngrade: false,
};
for (const mode of ['source', 'built']) {
  test(`${mode}: tabs enforce MD OR CS declarations without rejecting valid legacy consumers`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, names }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { tabFixture, tabPixels } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
      const rows = [];
      for (const name of names) {
        const f = tabFixture(api, { request: 0, pattern: false, maskedBackground: name === 'maskedRaw' });
        const e = f.element;
        if (name === 'local' || name === 'legacyOrigin' || name === 'wrongLocalDisplay' || name === 'inconsistentRgb') delete e.engineColorSamples;
        if (name === 'rawOnly') for (const key of ['slice', 'bodyRequest', 'bgAnchor']) delete e[key];
        if (name === 'omittedPairId') delete e.sourceCinfId;
        if (name === 'legacyOrigin') { delete e.cicnSource; delete e.boundsOrigin; }
        if (name === 'unusedText') { e.colorSamples.text = null; e.colorSamples.emboss = null; }
        if (name === 'unusedStrongOnPattern') {
          const p = tabFixture(api); Object.assign(f.owner.manifest, p.owner.manifest);
          f.owner.manifest.chromeElements.chosen.engineColorSamples = { ...p.element.engineColorSamples, source: { ...p.source } };
        }
        if (name === 'nullContradiction') e.sourceCinfId = null;
        if (name === 'wrongPairId') e.sourceCinfId = -9972;
        if (name === 'rawContradiction') f.owner.manifest.engineCinfs[-9975][0] = 2;
        if (name === 'nullOrigin') e.boundsOrigin = null;
        if (name === 'nullSource') e.cicnSource = null;
        if (name === 'nonzeroOrigin') e.boundsOrigin.left = 1;
        if (name === 'boundsMismatch') e.cicnSource.bounds.right = 8;
        if (name === 'sourceIdMismatch') e.cicnSource.id = -9972;
        if (name === 'dimensionMismatch') e.width = 8;
        if (name === 'nonbinaryAlpha') {
          const art = api.PixelBuffer.alloc(7, 5); art.fillRect({ x: 0, y: 0, w: 7, h: 5 }, 48, 152, 48); art.setPixel(2, 0, 48, 152, 48, 128);
          e.asset = api.bufferToCanvas(art).toDataURL(); e.engineColorSamples.asset = e.asset;
        }
        if (name === 'wrongLocalDisplay') e.colorSamples.displayPolicy = 'wrong-owner-policy';
        if (name === 'inconsistentRgb') e.colorSamples.background.displayRgb = [1, 2, 3];
        if (name === 'strongDowngrade') e.engineColorSamples.source = { ...f.source };
        let trace; const out = await api.composeTab(f.owner, { label: '', diagnostics: { onComplete: t => { trace = t; } } });
        rows.push({ name, rendered: out !== null, pixels: tabPixels(out), trace });
      }
      return rows;
    }, { mode, names: Object.keys(decisions) });
    await attachObservations(info, 'tab-engine', `${mode}-transport`, { mode, rows, decisions });
    for (const row of rows) {
      expect(row.rendered, row.name).toBe(decisions[row.name]);
      if (row.rendered) expect(row.pixels, row.name).toEqual(row.name === 'unusedStrongOnPattern' ? TAB_ENGINE_PATTERN_ROWS[0] : TAB_ENGINE_SOLID_ROWS);
    }
    const legacy = rows.find(r => r.name === 'legacyOrigin');
    expect(JSON.stringify(legacy.trace)).toMatch(/legacy-zero-origin-policy/);
  });

  test(`${mode}: tab metadata and pattern snapshots precede the first decode await`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { tabFixture, tabPixels } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
      const f = tabFixture(api, { mode: 2 });
      f.element.asset += '#tab-snapshot'; f.element.engineColorSamples.asset = f.element.asset;
      let entered, release; const waiting = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; });
      const decode = HTMLImageElement.prototype.decode; let trace;
      HTMLImageElement.prototype.decode = async function () { if (this.src.endsWith('#tab-snapshot')) { entered(); await gate; } return decode.call(this); };
      try {
        const pending = api.composeTab(f.owner, { label: '', diagnostics: { onComplete: t => { trace = t; } } });
        await waiting;
        f.element.slice.corner = 3; f.element.bodyRequest.mode = 4; f.element.bodyRequest.resourceId = 0;
        f.element.width = 100; f.element.bgAnchor[0] = 0; f.cinf[0] = 3;
        f.owner.manifest.patterns.chosen.asset = f.image(['ZZZ', 'ZZZ']);
        f.owner.manifest.chromeElements = {}; release();
        return { pixels: tabPixels(await pending), trace };
      } finally { release(); HTMLImageElement.prototype.decode = decode; }
    }, mode);
    await attachObservations(info, 'tab-engine', `${mode}-snapshots`, { mode, result });
    expect(result.pixels).toEqual(TAB_ENGINE_PATTERN_ROWS[2]);
    expect(result.trace.steps.find(s => s.role === 'face' && s.action === 'selected').resource.signedId).toBe(-9975);
  });

  test(`${mode}: tab asset decode errors reject instead of becoming null admission`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const error = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { tabFixture } = await import('/tests/rendering-options/tab-engine-fixtures.mjs');
      const f = tabFixture(api); f.element.asset = 'data:image/png;base64,broken-tab';
      try { await api.composeTab(f.owner); return null; } catch (e) { return String(e); }
    }, mode);
    expect(error).toBeTruthy();
  });
}
