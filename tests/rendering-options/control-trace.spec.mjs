import { test, expect, openHarness } from './fixtures.mjs';

for (const mode of ['source', 'built']) {
  test(`${mode}: control traces expose actual owner, signed identity, policies and ring usage`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const buffer = api.PixelBuffer.alloc(9, 9); buffer.fillRect({ x: 0, y: 0, w: 9, h: 9 }, 100, 120, 140, 255);
      const asset = api.bufferToCanvas(buffer).toDataURL();
      const element = (id, extra = {}) => ({ asset, width: 9, height: 9, sourceCicnId: id, sourceCinfId: id,
        slice: { corner: 2, side: 1, tile: false }, bgAnchor: [4, 4], ...extra });
      const theme = (name, entries, base) => ({ baseUrl: `${location.origin}/synthetic/${name}`, manifest: { chromeElements: entries }, base });
      const base = theme('base', { 'push-button-active': element(-10239), fallbackBevel: element(-10163) });
      const cases = {
        child: [theme('child', { slot: element(10239) }, base), {}],
        inherited: [theme('inherited', {}, base), {}],
        rejected: [theme('rejected', { menu: element(-10239, { authorLabel: 'Solo Menu Background' }) }, base), {}],
        rejectedKey: [theme('rejected-key', { 'menu-wallpaper': element(-10239) }, base), {}],
        rawEscape: [theme('raw', { menu: element(-10239, { authorLabel: 'Solo Menu Background' }) }), {}],
        canonicalNamed: [theme('canonical-named', { 'push-button-active': element(-123), menu: element(-10239, {authorLabel:'Solo Menu Background'}) }), {}],
        positiveRejected: [theme('positive-rejected', { menu: element(10239, {authorLabel:'Solo Menu Background'}) }, base), {}],
        activeMissing: [theme('active-missing', { 'pressed-push-button': element(-10238) }), {}],
        unknown: [theme('unknown', { 'push-button-active': element(undefined) }), {}],
        bevel: [theme('bevel', {}, base), { small: true, disabled: true }],
        plain: [theme('plain', { slot: element(-10239), ring: element(-10231, { asset: 'invalid:must-not-decode' }) }), {}],
        pressedDefault: [theme('default', { slot: element(-10238), ring: element(-10231) }), { default: true, pressed: true }],
        noRing: [theme('no-ring', { slot: element(-10239) }), { default: true }],
        missing: [theme('missing', {}), {}],
      };
      const traces = {}, pixelsEqual = {}, frozen = {};
      for (const [name, [t, options]] of Object.entries(cases)) {
        const compose = name === 'bevel' ? api.composeBevelButton : api.composeButton;
        const traced = await compose(t, { ...options, label: '', diagnostics: { correlationId: name, onComplete: value => {
          traces[name] = value; frozen[name] = Object.isFrozen(value) && Object.isFrozen(value.steps) && value.steps.every(Object.isFrozen);
        } } });
        const plain = await compose(t, { ...options, label: '' });
        pixelsEqual[name] = traced === null ? plain === null : traced.width === plain.width && traced.height === plain.height
          && traced.data.every((n, i) => n === plain.data[i]);
      }
      const c = window.controlMatrix.listCases().find(c => c.mode === 'direct' && c.family === 'push');
      const metadata = await window.controlMatrix.runCase(c, { slug: 'windows-95', includeReferences: false });
      return { traces, pixelsEqual, frozen, attached: metadata.resolutionTrace };
    }, mode);
    const selected = trace => trace.steps.find(s => s.role === 'face' && s.action === 'selected');
    const t = result.traces;
    expect(selected(t.child)).toMatchObject({ owner: { chainDepth: 0 }, resource: { signedId: 10239, sourceCinfId: 10239, manifestKey: 'slot' }, basis: 'compatibility-policy', reason: 'positive-id-alias' });
    expect(selected(t.inherited)).toMatchObject({ owner: { chainDepth: 1 }, resource: { signedId: -10239, manifestKey: 'push-button-active' } });
    expect(selected(t.inherited).owner.baseUrl).toMatch(/\/synthetic\/base$/);
    expect(t.inherited.steps.some(s => s.reason === 'base-inheritance')).toBe(true);
    for (const name of ['rejected','rejectedKey','rawEscape','canonicalNamed']) {
      expect(selected(t[name])).toMatchObject({owner:{chainDepth:0},resource:{signedId:-10239},basis:'source-dispatch',reason:'resource-id'});
      expect(t[name].steps.some(s=>s.action==='rejected'||s.reason==='active-to-pressed'||s.reason==='raw-id-escape')).toBe(false);
    }
    expect(selected(t.canonicalNamed).resource.manifestKey).toBe('menu');
    expect(t.positiveRejected.steps[0]).toMatchObject({action:'rejected',reason:'anti-role-label',basis:'compatibility-policy',resource:{signedId:10239}});
    expect(selected(t.positiveRejected).owner.chainDepth).toBe(1);
    expect(t.activeMissing.steps.some(s=>s.reason==='active-to-pressed')).toBe(true);
    expect(selected(t.activeMissing).resource.signedId).toBe(-10238);
    expect(selected(t.unknown).resource).toMatchObject({ signedId: null, sourceCinfId: null, manifestKey: 'push-button-active' });
    expect(selected(t.bevel)).toMatchObject({ requestedId: -10163, owner: { chainDepth: 1 }, resource: { signedId: -10163 }, basis: 'compatibility-policy' });
    expect(t.bevel.steps.filter(s => s.reason.startsWith('bevel-')).map(s => s.reason)).toEqual(['bevel-unpressed-fallback', 'bevel-default-fallback']);
    expect(t.plain.steps.filter(s => s.role === 'default-ring' && s.action === 'selected')).toMatchObject([{ usage: 'layout-reservation', basis: 'compatibility-policy', resource: { signedId: -10231 } }]);
    expect(t.plain.steps.some(s => s.role === 'default-ring' && s.usage === 'paint')).toBe(false);
    expect(t.pressedDefault.steps.find(s => s.reason === 'pressed-ring-to-active')).toMatchObject({ basis: 'source-dispatch', usage: 'paint' });
    expect(t.pressedDefault.steps.find(s => s.reason === 'ring-paint')).toMatchObject({ requestedId: -10230, resource: { signedId: -10231 }, usage: 'paint' });
    expect(t.noRing.steps.find(s => s.reason === 'ring-unavailable')).toMatchObject({ requestedId: -10231, action: 'missing', usage: 'paint' });
    expect(t.missing.outcome).toEqual({ status: 'unavailable' });
    expect(Object.values(result.pixelsEqual).every(Boolean)).toBe(true);
    expect(Object.values(result.frozen).every(Boolean)).toBe(true);
    expect(result.attached).toMatchObject({ version: 1, family: 'push-button', outcome: { status: 'themed' } });
  });

  test(`${mode}: corpus traces retain canonical active slots and exact face/ring state choices`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      for (const slug of ['animals', 'monkey-paradise', 'windows-95']) {
        const theme = await api.loadTheme(`/themes/${slug}`);
        for (const family of ['push', 'bevel']) for (const state of ['active', 'pressed', 'inactive']) {
          let trace;
          await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](theme, {
            label: '', default: true, pressed: state === 'pressed', disabled: state === 'inactive',
            diagnostics: { onComplete: value => { trace = value; } },
          });
          rows.push({ slug, family, state, trace });
        }
        theme.dispose?.();
      }
      return rows;
    }, mode);
    for (const { slug, family, state, trace } of rows) {
      const face = trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      // Expectations are explicit reviewed source IDs and runtime policy choices,
      // not derived by repeating the production resolver in the harness.
      const faceId = family === 'bevel' ? { active: -10166, pressed: -10165, inactive: -10167 }[state]
        : { active: -10239, pressed: -10238, inactive: -10240 }[state];
      expect(face.resource.signedId, `${slug}/${family}/${state}`).toBe(faceId);
      expect(face.resource.sourceCinfId).toBe(faceId);
      expect(face.owner.chainDepth).toBe(0);
      if (family === 'push') {
        expect(trace.steps.find(s => s.reason === 'ring-paint').resource.signedId).toBe(state === 'inactive' ? -10232 : -10231);
        if (slug !== 'windows-95' && state === 'active') {
          expect(face).toMatchObject({basis:'source-dispatch',reason:'resource-id',resource:{signedId:-10239,manifestKey:'solo-menu-background-2'}});
          expect(trace.steps.some(s => s.action==='rejected'||s.reason==='active-to-pressed')).toBe(false);
        }
      }
    }
  });

  test(`${mode}: public render diagnostics isolate concurrent calls and preserve error/ownership contracts`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const theme = await api.loadTheme('/themes/windows-95');
      let disposals = 0; theme.dispose = () => { disposals++; };
      const records = [], callback = trace => records.push(trace);
      await Promise.all([
        api.composeButton(theme, { label: '', diagnostics: { correlationId: 'push', onComplete: callback } }),
        api.composeBevelButton(theme, { label: '', disabled: true, diagnostics: { correlationId: 'bevel', onComplete: callback } }),
      ]);
      const callbackError = new Error('callback'), rendererError = new Error('decode');
      let successCalls = 0, successError;
      try { await api.composeButton(theme, { label: '', diagnostics: { onComplete: () => { successCalls++; throw callbackError; } } }); }
      catch (error) { successError = error; }
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () { if (this.src.endsWith('#trace-error')) throw rendererError; return decode.call(this); };
      let failureCalls = 0, failureTrace, failureError;
      try {
        const broken = { baseUrl: location.origin, manifest: { chromeElements: { slot: {
          sourceCicnId: -10239, asset: 'data:image/png;base64,broken#trace-error', width: 9, height: 9,
        } } } };
        await api.composeButton(broken, { label: '', diagnostics: { onComplete: trace => {
          failureCalls++; failureTrace = trace; throw callbackError;
        } } });
      } catch (error) { failureError = error; }
      finally { HTMLImageElement.prototype.decode = decode; }
      return { records, isolated: records[0] !== records[1] && records[0].steps !== records[1].steps,
        disposals, successCalls, failureCalls, successError: successError === callbackError,
        failureError: failureError === rendererError, failureTrace };
    }, mode);
    expect(result.isolated).toBe(true);
    expect(result.records.map(t => t.correlationId).sort()).toEqual(['bevel', 'push']);
    expect(result.records.find(t => t.correlationId === 'push').steps.filter(s => s.role === 'face' && s.action === 'selected').map(s => s.resource.signedId)).toEqual([-10239]);
    expect(result.records.find(t => t.correlationId === 'bevel').steps.filter(s => s.role === 'face' && s.action === 'selected').map(s => s.resource.signedId)).toEqual([-10167]);
    expect(result.disposals).toBe(0);
    expect([result.successCalls, result.failureCalls]).toEqual([1, 1]);
    expect(result.successError).toBe(true); expect(result.failureError).toBe(true);
    expect(result.failureTrace.outcome).toEqual({ status: 'error' });
    expect(result.failureTrace.steps[0]).toMatchObject({ action: 'selected', resource: { signedId: -10239 } });
  });
}
