import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { HEADER_NATIVE_LITERALS, HEADER_COLUMN_LITERALS, HEADER_STATE_DECISIONS, literalPixels } from './header-engine-oracle.mjs';

for (const mode of ['source', 'built']) {
  test(`${mode}: header engine preserves independent complete native planes`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, fixtures }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { headerTheme, headerOptions } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const out = [];
      for (const fixture of fixtures) {
        let trace;
        const result = await api.composeHeaderSurface(headerTheme(api, fixture), { ...headerOptions(fixture), diagnostics: { onComplete: t => { trace = t; } } });
        out.push({ name: fixture.name, status: result.status, reason: result.reason,
          pixels: result.buffer && Array.from(result.buffer.data), trace });
      }
      return out;
    }, { mode, fixtures: HEADER_NATIVE_LITERALS });
    await attachObservations(info, 'header-engine', `${mode}-literal`, { mode, observed, oracle: 'independently frozen full-plane markers, not native execution' });
    expect(observed).toHaveLength(19);
    for (const [i, row] of observed.entries()) {
      const fixture = HEADER_NATIVE_LITERALS[i];
      expect(row.status, fixture.name).toBe('rendered');
      expect(row.pixels, fixture.name).toEqual(literalPixels(fixture.rows));
      expect(row.trace.headerSurface.painted, fixture.name).toBe(fixture.name !== 'empty-clip');
      expect(row.trace.headerSurface.paintRect.h).toBe(fixture.height + (fixture.kind === 'list-view-header' ? 1 : 0));
      if (fixture.sampled) expect(row.trace.headerSurface.lineSampling).toBe('sampled-companion');
    }
  });

  test(`${mode}: header engine keeps rectangular column compatibility planes`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, fixtures }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { headerTheme } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const out = [];
      for (const fixture of fixtures) {
        const owner = headerTheme(api, fixture), element = owner.manifest.chromeElements.face;
        if (fixture.centerFill) element.bgAnchor = [1, 1];
        else element.bgPattern = 'unused-column-declaration';
        // No strict whole-header dependencies may leak into compatibility cells.
        delete element.bodyRequest; delete element.colorSamples; delete element.samplingEquivalence;
        const buffer = await api.composeListHeader(owner, { columns: fixture.widths.map(width => ({ label: '', width })), height: fixture.height });
        out.push({ name: fixture.name, width: buffer.width, height: buffer.height, pixels: Array.from(buffer.data) });
      }
      return out;
    }, { mode, fixtures: HEADER_COLUMN_LITERALS });
    await attachObservations(info, 'header-engine', `${mode}-columns`, { mode, observed, oracle: 'declared C1-C8 compatibility, no original typography claim' });
    expect(observed).toHaveLength(16);
    for (const [i, row] of observed.entries()) {
      const fixture = HEADER_COLUMN_LITERALS[i];
      expect([row.width, row.height], row.name).toEqual([fixture.widths.reduce((a, b) => a + b, 0), 16]);
      expect(row.pixels, row.name).toEqual(literalPixels(fixture.rows));
    }
  });

  test(`${mode}: header raw UInt32 selection, harmless role metadata and owner chain`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, states }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { headerTheme, headerOptions, imageUrl } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const fixture = { source: ['AAA', 'AAA', 'AAA'], kind: 'window-header', width: 3, height: 3, corner: 1, side: 0, tile: true, origin: [0, 0], offset: [0, 0] };
      const owner = headerTheme(api, fixture), active = owner.manifest.chromeElements.face;
      active.bgAnchor = [1, 1];
      const inactive = { ...structuredClone(active), sourceCicnId: -9568, sourceCinfId: -9568, asset: imageUrl(api, ['ZZZ', 'ZZZ', 'ZZZ']) };
      owner.manifest.chromeElements.inactive = inactive;
      // These are explicitly unconsumed push/bevel views, not header providers.
      owner.manifest.cinfEnvironment = { scope: 'standalone-push-bevel-body', environmentId: 'harmless-summary' };
      active.bodyCinf = { scope: 'standalone-push-bevel-body', status: 'unsupported', metadata: { slice: { corner: 99 } } };
      const child = { baseUrl: 'child/', manifest: { chromeElements: {}, patterns: {} }, base: owner };
      const out = [];
      for (const [drawState] of states) {
        let trace;
        const result = await api.composeHeaderSurface(child, { ...headerOptions(fixture), drawState, diagnostics: { onComplete: t => { trace = t; } } });
        out.push({ drawState, status: result.status, pixels: result.buffer && Array.from(result.buffer.data),
          painted: trace.steps.filter(s => s.role === 'face' && s.usage === 'paint').map(s => ({ id: s.resource.signedId, depth: s.owner.chainDepth })) });
      }
      return out;
    }, { mode, states: HEADER_STATE_DECISIONS });
    for (const [i, row] of observed.entries()) {
      const id = HEADER_STATE_DECISIONS[i][1], token = id === -9568 ? 'Z' : 'A';
      expect(row.status).toBe('rendered');
      expect(row.pixels).toEqual(literalPixels([`${token}#${token}`, '###', `${token}#${token}`]));
      expect(row.painted).toEqual([{ id, depth: 1 }]);
    }
  });

  test(`${mode}: header needed-only admission preserves errors and empty geometry`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async mode => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { headerTheme, headerOptions, imageUrl } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const { HEADER_NATIVE_LITERALS } = await import('/tests/rendering-options/header-engine-oracle.mjs');
      const names = ['unknown-clip', 'special-origin', 'missing-slice', 'invalid-slice', 'missing-request', 'invalid-request', 'mode5',
        'missing-background', 'nonbinary', 'unsafe-source', 'missing-companion', 'wrong-companion-mask', 'nonopaque-pattern',
        'unknown-pattern-origin', 'ambiguous-pattern', 'face-error', 'companion-error', 'pattern-error',
        'empty-missing-background', 'empty-unused-pattern-error', 'empty-unknown-pattern-origin', 'body-empty-missing-background'];
      const rows = [];
      for (const name of names) {
        const pattern = name.includes('pattern'), sampled = name.includes('companion');
        const fixture = structuredClone(HEADER_NATIVE_LITERALS.find(f => f.name === (pattern ? 'pattern-4' : sampled ? 'first-strip-sampled' : 'overlap-tile')));
        const owner = headerTheme(api, fixture), el = owner.manifest.chromeElements.face, options = headerOptions(fixture);
        if (name === 'unknown-clip') options.compositionContext.clip = { kind: 'unknown' };
        if (name === 'special-origin') options.compositionContext.controlOrigin = [-1, -1];
        if (name === 'missing-slice') delete el.slice;
        if (name === 'invalid-slice') el.slice.corner = -1;
        if (name === 'missing-request') delete el.bodyRequest;
        if (name === 'invalid-request') el.bodyRequest.resourceId = 32768;
        if (name === 'mode5') el.bodyRequest.mode = 5;
        if (name.includes('missing-background')) delete el.colorSamples;
        if (name === 'nonbinary') {
          const b = new api.PixelBuffer(7, 7, new Uint8ClampedArray(196).fill(128));
          el.asset = api.bufferToCanvas(b).toDataURL();
        }
        if (name === 'unsafe-source') { el.slice.corner = 7; el.slice.tile = false; options.width = 19; }
        if (name === 'missing-companion') delete el.sampledBandAsset;
        if (name === 'wrong-companion-mask') el.sampledBandAsset.asset = imageUrl(api, fixture.source.map(row => '.'.repeat(row.length)));
        if (name === 'nonopaque-pattern') owner.manifest.patterns.pattern.asset = imageUrl(api, ['.123', '4567']);
        if (name.includes('unknown-pattern-origin')) options.compositionContext.patternOrigin = { status: 'unknown' };
        if (name === 'ambiguous-pattern') {
          delete el.bodyPattern;
          owner.manifest.patterns.other = { ...owner.manifest.patterns.pattern, asset: imageUrl(api, ['7654', '3210']) };
        }
        if (name === 'face-error') el.asset = 'data:image/png;base64,AAAA';
        if (name === 'companion-error') el.sampledBandAsset.asset = 'data:image/png;base64,AAAA';
        if (name.includes('pattern-error')) owner.manifest.patterns.pattern.asset = 'data:image/png;base64,AAAA';
        if (name.startsWith('empty-')) options.compositionContext.clip = { kind: 'rect', rect: { x: 20, y: 20, w: 0, h: 0 } };
        if (name === 'body-empty-missing-background') { options.width = 3; options.height = 3; el.slice.corner = 4; el.slice.side = 4; }
        let trace, result, error;
        try { result = await api.composeHeaderSurface(owner, { ...options, diagnostics: { onComplete: t => { trace = t; } } }); }
        catch (e) { error = e.name; }
        rows.push({ name, status: result?.status, reason: result?.reason, error,
          paintClaims: trace?.steps.filter(s => s.usage === 'paint').length,
          painted: trace?.headerSurface?.painted, admission: trace?.headerSurface?.admission,
          nonzero: result?.buffer && Array.from(result.buffer.data).filter(x => x !== 0).length });
      }
      return rows;
    }, mode);
    await attachObservations(info, 'header-engine', `${mode}-admission`, { mode, observed });
    const expected = {
      'unknown-clip': 'unknown-clip', 'special-origin': 'special-window-origin', 'missing-slice': 'missing-slice',
      'invalid-slice': 'invalid-slice', 'missing-request': 'missing-body-request', 'invalid-request': 'invalid-body-request',
      mode5: 'cicn-body', 'missing-background': 'missing-background-sample', nonbinary: 'nonbinary-mask',
      'unsafe-source': 'unsafe-source-geometry', 'missing-companion': 'unverified-line-sampling',
      'wrong-companion-mask': 'unverified-line-sampling', 'nonopaque-pattern': 'nonopaque-pattern',
      'unknown-pattern-origin': 'unknown-pattern-origin', 'ambiguous-pattern': 'ambiguous-body-selection',
    };
    for (const row of observed) {
      if (row.name in expected) {
        expect([row.status, row.reason], row.name).toEqual(['unsupported', expected[row.name]]);
        expect(row.paintClaims, row.name).toBe(0);
      } else if (['face-error', 'companion-error', 'pattern-error'].includes(row.name)) {
        expect(row.error, row.name).toBeTruthy();
        expect([row.admission, row.paintClaims], row.name).toEqual(['error', 0]);
      } else {
        expect(row.status, row.name).toBe('rendered');
        if (row.name.startsWith('empty-')) expect([row.painted, row.paintClaims, row.nonzero], row.name).toEqual([false, 0, 0]);
        else expect(row.painted, row.name).toBe(true);
      }
    }
  });

  test(`${mode}: header snapshots mutable descriptors before face await`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async mode => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { headerTheme, headerOptions } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const { HEADER_NATIVE_LITERALS } = await import('/tests/rendering-options/header-engine-oracle.mjs');
      const fixture = structuredClone(HEADER_NATIVE_LITERALS[0]), owner = headerTheme(api, fixture), options = headerOptions(fixture);
      const el = owner.manifest.chromeElements.face;
      let trace;
      const pending = api.composeHeaderSurface(owner, { ...options, diagnostics: { onComplete: t => { trace = t; } } });
      el.slice.corner = 7; el.bodyRequest.mode = 5; el.sourceCicnId = -9568;
      el.colorSamples.background.displayRgb.fill(255); options.compositionContext.controlOrigin[0] = 100;
      const result = await pending;
      return { status: result.status, reason: result.reason, pixels: result.buffer && Array.from(result.buffer.data), trace,
        callerFrozen: Object.isFrozen(options.compositionContext) };
    }, mode);
    expect(observed.status).toBe('rendered');
    expect(observed.pixels).toEqual(literalPixels(HEADER_NATIVE_LITERALS[0].rows));
    expect(observed.callerFrozen).toBe(false);
    expect(observed.trace.headerSurface.requestedRect).toEqual({ x: 0, y: 0, w: 11, h: 9 });
    expect(observed.trace.steps.filter(s => s.usage === 'paint').map(s => s.resource.signedId)).toEqual([-9567]);
  });

  test(`${mode}: header keeps prepared profile capability and realizes only required colors`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async mode => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { syntheticDisplayProfile } = await import('/tests/decoder-fixtures/display-profile.mjs');
      const { headerTheme, headerOptions } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const { HEADER_NATIVE_LITERALS } = await import('/tests/rendering-options/header-engine-oracle.mjs');
      const data = syntheticDisplayProfile(), profile = await api.prepareDisplayProfile(data);
      const missingData = syntheticDisplayProfile();
      missingData.mappings = missingData.mappings.filter(m => m.rgb16[0] !== 8481);
      const missing = await api.prepareDisplayProfile(missingData);
      const rows = [];
      for (const name of ['mapped', 'missing-required', 'empty-unused', 'pattern-unused-background', 'later-base-mismatch', 'copied-capability']) {
        const pattern = name === 'pattern-unused-background';
        const fixture = structuredClone(HEADER_NATIVE_LITERALS.find(f => f.name === (pattern ? 'pattern-4' : 'overlap-tile')));
        const owner = headerTheme(api, fixture), element = owner.manifest.chromeElements.face, options = headerOptions(fixture);
        const chosen = ['missing-required', 'empty-unused', 'pattern-unused-background'].includes(name) ? missing : profile;
        owner.manifest.displayProfile = name === 'copied-capability' ? structuredClone(chosen) : chosen;
        element.colorSamples.displayPolicy = chosen.id;
        element.colorSamples.background.displayRgb = [90, 100, 110];
        element.samplingEquivalence.displayPolicy = chosen.id;
        // Text and emboss are not header dependencies and have no mappings.
        element.colorSamples.text = { rgb16: [123, 456, 789], displayRgb: [1, 2, 3] };
        element.colorSamples.emboss = { rgb16: [234, 567, 890], displayRgb: [4, 5, 6] };
        if (name === 'empty-unused') options.compositionContext.clip = { kind: 'rect', rect: { x: 0, y: 0, w: 0, h: 0 } };
        if (name === 'later-base-mismatch') owner.base = { baseUrl: 'unused-default/', manifest: { chromeElements: {}, patterns: {} } };
        let result, error, code;
        try { result = await api.composeHeaderSurface(owner, options); }
        catch (e) { error = e.name; code = e.code; }
        rows.push({ name, status: result?.status, error, code, pixels: result?.buffer && Array.from(result.buffer.data) });
      }
      return rows;
    }, mode);
    await attachObservations(info, 'header-engine', `${mode}-profile`, { mode, observed });
    const row = name => observed.find(r => r.name === name);
    expect(row('mapped').status).toBe('rendered');
    const expected = HEADER_NATIVE_LITERALS[0].rows.flatMap(r => [...r].flatMap(c => c === '#' ? [90, 100, 110, 255] : literalPixels([c])));
    expect(row('mapped').pixels).toEqual(expected);
    expect([row('missing-required').error, row('missing-required').code]).toEqual(['DisplayProfileError', 'MISSING_MAPPING']);
    expect(row('empty-unused').status).toBe('rendered');
    expect(row('empty-unused').pixels.every(v => v === 0)).toBe(true);
    expect(row('pattern-unused-background').pixels).toEqual(literalPixels(HEADER_NATIVE_LITERALS.find(f => f.name === 'pattern-4').rows));
    expect([row('later-base-mismatch').error, row('later-base-mismatch').code]).toEqual(['DisplayProfileError', 'PROFILE_MISMATCH']);
    expect([row('copied-capability').error, row('copied-capability').code]).toEqual(['DisplayProfileError', 'INVALID_PROFILE']);
  });

  test(`${mode}: header diagnostics preserve callback precedence and columns snapshot inputs`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async mode => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { headerTheme, headerOptions } = await import('/tests/rendering-options/header-engine-inputs.mjs');
      const { HEADER_NATIVE_LITERALS, HEADER_COLUMN_LITERALS } = await import('/tests/rendering-options/header-engine-oracle.mjs');
      const fixture = HEADER_NATIVE_LITERALS[0], owner = headerTheme(api, fixture), options = headerOptions(fixture);
      const sentinel = new Error('independent-callback-sentinel');
      let callbackWins = false, rendererWins = false, errorTrace;
      try { await api.composeHeaderSurface(owner, { ...options, diagnostics: { onComplete() { throw sentinel; } } }); }
      catch (error) { callbackWins = error === sentinel; }
      owner.manifest.chromeElements.face.asset = 'data:image/png;base64,AAAA';
      try { await api.composeHeaderSurface(owner, { ...options, diagnostics: { onComplete(trace) { errorTrace = trace; throw sentinel; } } }); }
      catch (error) { rendererWins = error !== sentinel; }
      const columnFixture = HEADER_COLUMN_LITERALS.find(f => f.tile && f.centerFill && f.widths.length === 1);
      const columnOwner = headerTheme(api, columnFixture), element = columnOwner.manifest.chromeElements.face;
      element.bgAnchor = [1, 1];
      const columns = [{ label: '', width: 11 }], columnOpts = { columns, height: 16 };
      const pending = api.composeListHeader(columnOwner, columnOpts);
      columns[0].width = 3; element.slice.corner = 7; columnOpts.height = 30;
      const buffer = await pending;
      return { callbackWins, rendererWins, errorTrace, width: buffer.width, height: buffer.height, pixels: Array.from(buffer.data), callerFrozen: Object.isFrozen(columns[0]) };
    }, mode);
    expect([observed.callbackWins, observed.rendererWins]).toEqual([true, true]);
    expect(observed.errorTrace.outcome.status).toBe('error');
    expect(observed.errorTrace.steps.some(s => s.usage === 'paint')).toBe(false);
    expect([observed.width, observed.height]).toEqual([11, 16]);
    expect(observed.pixels).toEqual(literalPixels(HEADER_COLUMN_LITERALS.find(f => f.tile && f.centerFill && f.widths.length === 1).rows));
    expect(observed.callerFrozen).toBe(false);
  });
}
