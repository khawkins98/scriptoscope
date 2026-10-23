import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

for (const mode of ['source', 'built']) {
  test(`${mode}: literal push/default branches retain the face rectangle through direct and promoted paths`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    // kDEF231 0x757c: disabled precedes pressed. 0x76b8–0x770e:
    // inactive has no active retry; pressed does. 0x7698–0x76a2 expands
    // the face Rect by four, independently of the ring raster dimensions.
    // Owned caller/art fixtures condition these branches; they do not establish
    // native aux-chain/default eligibility, caller construction or provider truth.
    const cases = [
      { name: 'normal', omit: [], options: {}, face: -10239, ring: -10231 },
      { name: 'pressed', omit: [], options: { pressed: true }, face: -10238, ring: -10230 },
      { name: 'disabled', omit: [], options: { disabled: true }, face: -10240, ring: -10232 },
      { name: 'both', omit: [], options: { disabled: true, pressed: true }, face: -10240, ring: -10232 },
      { name: 'pressed-retry', omit: [-10230], options: { pressed: true }, face: -10238, ring: -10231 },
      { name: 'inactive-missing', omit: [-10232], options: { disabled: true }, face: -10240, ring: null },
      { name: 'both-inactive-missing', omit: [-10232], options: { disabled: true, pressed: true }, face: -10240, ring: null },
      { name: 'active-missing', omit: [-10231], options: {}, face: -10239, ring: null },
      { name: 'no-rings', omit: [-10231, -10230, -10232], options: {}, face: -10239, ring: null },
      { name: 'not-default', omit: [], options: { default: false }, face: -10239, ring: null },
    ];
    const result = await page.evaluate(async ({ mode, cases }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const colors = { '-10239': [202, 202, 202, 255], '-10238': [160, 170, 180, 255], '-10240': [110, 120, 130, 255],
        '-10231': [255, 0, 0, 255], '-10230': [0, 0, 255, 255], '-10232': [255, 255, 0, 255] };
      // Reuse the literal overlap/body stencil from visual-baselines/control-ring:
      // 6x6 face versus 12x12 ring; magenta overlaps the face's top-left,
      // green exists only in the ring source's body and must never be painted.
      const elements = {};
      const {loadOwnedControlFixture}=await import('/tests/rendering-options/owned-control-fixture.mjs');
      for (const id of [-10239, -10238, -10240, -10231, -10230, -10232]) {
        const ring = id >= -10232, n = ring ? 12 : 6;
        const b = api.PixelBuffer.alloc(n, n);
        if (ring) {
          b.fillRect({ x: 1, y: 1, w: 1, h: 1 }, ...colors[id]);
          b.fillRect({ x: 4, y: 4, w: 1, h: 1 }, 255, 0, 255, 255);
          b.fillRect({ x: 5, y: 5, w: 2, h: 2 }, 0, 255, 0, 255);
        } else b.fillRect({ x: 0, y: 0, w: n, h: n }, ...colors[id]);
        elements[`slot${id}`]={id,name:`slot${id}`,pixels:Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>[...b.getPixel(x,y)])),cinf:{corner:ring?5:1,side:ring?5:1,background:[2,2]}};
      }
      const owned=[];const theme=async omit=>{const t=await loadOwnedControlFixture(api,{faces:Object.values(elements).filter(e=>!omit.includes(e.id))});owned.push(t);return t;};
      const sample = b => {
        const pixel = (x, y) => Array.from(b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 4));
        return { size: [b.width, b.height], margin: pixel(0, 0), ring: pixel(1, 1), overlap: pixel(4, 4),
          center: pixel(Math.floor(b.width / 2), Math.floor(b.height / 2)),
          greenPixels: Array.from({ length: b.width * b.height }, (_, i) => i).filter(i => b.data[i * 4] === 0 && b.data[i * 4 + 1] === 255 && b.data[i * 4 + 2] === 0 && b.data[i * 4 + 3] === 255).length };
      };
      const direct = [];
      for (const c of cases) {
        let trace;
        const b = await api.composeButton(await theme(c.omit), { label: '', height: 6, minWidth: 24, default: true, ...c.options,
          diagnostics: { onComplete: value => { trace = value; } } });
        direct.push({ name: c.name, pixels: sample(b), trace });
      }
      const promoted = [];
      for (const omit of [[], [-10230], [-10232], [-10231]]) for (const disabled of [false, true]) {
        const host = document.createElement('div'), native = document.createElement('button');
        native.type = 'button'; native.dataset.scriptoscopeButton = ''; native.dataset.scriptoscopeDefault = 'true'; native.disabled = disabled;
        host.append(native); document.body.append(host);
        const face = await api.promoteButton(native, await theme(omit));
        const read = () => { const canvas = face.querySelector('canvas'); return sample({ width: canvas.width, height: canvas.height,
          data: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data }); };
        const normal = read();
        face.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        const down = read();
        face.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        promoted.push({ omit, disabled, normal, down, released: read() });
        host.remove();
      }
      owned.forEach(t=>t.dispose());return { direct, promoted };
    }, { mode, cases });
    // Keep actual traces/pixels even if a later literal assertion fails.
    await attachObservations(testInfo, 'push-default-rules', mode, { mode, cases, ...result });
    const colors = { '-10239': [202, 202, 202, 255], '-10238': [160, 170, 180, 255], '-10240': [110, 120, 130, 255],
      '-10231': [255, 0, 0, 255], '-10230': [0, 0, 255, 255], '-10232': [255, 255, 0, 255] };
    const transparent = [0, 0, 0, 0], magenta = [255, 0, 255, 255];
    for (const [i, row] of result.direct.entries()) {
      const c = cases[i], reserved = c.name !== 'no-rings';
      expect(row.trace.steps.find(s => s.role === 'face' && s.action === 'selected' && s.usage === 'paint' && s.resource?.type === 'cicn').resource.signedId, c.name).toBe(c.face);
      expect(row.trace.steps.filter(s => s.role==='default-ring'&&s.usage==='paint'&&s.action==='selected'&&s.resource?.type==='cicn').map(s => s.resource.signedId), c.name).toEqual(c.ring === null ? [] : [c.ring]);
      expect(row.pixels, c.name).toEqual({ size: reserved ? [32, 14] : [24, 6], margin: reserved ? transparent : colors[c.face],
        ring: reserved ? (c.ring === null ? transparent : colors[c.ring]) : colors[c.face],
        overlap: c.ring === null ? colors[c.face] : magenta, center: colors[c.face], greenPixels: 0 });
    }
    // Literal promoted expectations: enabled transitions normal→pressed→normal;
    // native disabled remains inactive even when pointerdown is dispatched.
    const ringPairs = { 'all': [-10231, -10230], '-10230': [-10231, -10231], '-10232': [-10231, -10230], '-10231': [null, -10230] };
    for (const row of result.promoted) {
      const rings = row.disabled ? (row.omit.includes(-10232) ? [null, null] : [-10232, -10232]) : ringPairs[row.omit[0] ?? 'all'];
      for (const [i, pixels] of [row.normal, row.down].entries()) {
        const face = row.disabled ? -10240 : i === 0 ? -10239 : -10238;
        expect(pixels.ring).toEqual(rings[i] === null ? transparent : colors[rings[i]]);
        expect(pixels.overlap).toEqual(rings[i] === null ? colors[face] : magenta);
        expect(pixels.center).toEqual(colors[face]);
        expect(pixels.margin).toEqual(transparent);
        expect(pixels.greenPixels).toBe(0);
        expect(pixels.size).toEqual(row.normal.size);
      }
      expect(row.released).toEqual(row.normal);
    }
  });

  test(`${mode}: control traces expose actual owner, signed identity, policies and ring usage`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
      const owned=[];
      const theme=async(name,entries,base)=>{
        const t=await loadOwnedControlFixture(api,{paletteColors:[[100,120,140]],faces:entries.map(([id,key])=>({id,name:key,pixels:plane(9,9,[100,120,140,255]),cinf:{corner:2,side:1,background:[4,4]}}))});
        t.baseUrl=`${location.origin}/synthetic/${name}`;if(base)t.base=base;owned.push(t);return t;
      };
      const base=await theme('base',[[-10239,'push-button-active'],[-10163,'fallback-bevel']]);
      const cases={
        child:[await theme('child',[[10239,'slot']],base),{}],
        inherited:[await theme('inherited',[],base),{}],
        rejected:[await theme('rejected',[[-10239,'solo-menu-background']],base),{}],
        rejectedKey:[await theme('rejected-key',[[-10239,'menu-wallpaper']],base),{}],
        rawEscape:[await theme('raw',[[-10239,'menu']]),{}],
        canonicalNamed:[await theme('canonical-named',[[-123,'push-button-active'],[-10239,'menu']]),{}],
        positiveRejected:[await theme('positive-rejected',[[10239,'solo-menu-background']],base),{}],
        activeMissing:[await theme('active-missing',[[-10238,'pressed-push-button']]),{}],
        unknown:[await theme('unknown',[]),{}],
        bevel:[await theme('bevel',[],base),{small:true,disabled:true}],
        plain:[await theme('plain',[[-10239,'slot'],[-10231,'ring']]),{}],
        pressedDefault:[await theme('default',[[-10238,'slot'],[-10231,'ring']]),{default:true,pressed:true}],
        noRing:[await theme('no-ring',[[-10239,'slot']]),{default:true}],
        missing:[await theme('missing',[]),{}],
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
      owned.forEach(t=>t.dispose());return { traces, pixelsEqual, frozen, attached: metadata.resolutionTrace };
    }, mode);
    const selected=trace=>trace.steps.find(s=>s.role==='face'&&s.action==='selected'&&s.usage==='paint'&&s.resource?.type==='cicn');
    const t=result.traces;
    for(const name of ['child','inherited','positiveRejected'])expect(selected(t[name])).toMatchObject({owner:{chainDepth:1},resource:{signedId:-10239,manifestKey:'push-button-active'}});
    expect(selected(t.inherited).owner.baseUrl).toMatch(/\/synthetic\/base$/);
    for(const name of ['rejected','rejectedKey','rawEscape','canonicalNamed']){
      expect(selected(t[name])).toMatchObject({owner:{chainDepth:0},resource:{signedId:-10239},basis:'source-dispatch',reason:'resource-id'});
      expect(t[name].steps.some(s=>['anti-role-label','anti-role-key','active-to-pressed','raw-id-escape'].includes(s.reason))).toBe(false);
    }
    expect(selected(t.canonicalNamed).resource.manifestKey).toBe('menu');
    for(const name of ['activeMissing','unknown','missing']){expect(t[name].outcome).toEqual({status:'unavailable'});expect(selected(t[name])).toBeUndefined();}
    // Bevel is explicitly outside the PB engine contract and retains its
    // still-supported compatibility fallback. Do not erase an unmigrated API.
    expect(selected(t.bevel)).toMatchObject({owner:{chainDepth:1},resource:{signedId:-10163},basis:'compatibility-policy'});
    expect(t.bevel.steps.filter(s=>s.reason.startsWith('bevel-')).map(s=>s.reason)).toEqual(['bevel-unpressed-fallback','bevel-default-fallback']);
    expect(t.child.steps.some(s=>s.resource?.signedId===10239&&s.usage==='paint')).toBe(false);
    expect(t.plain.steps.some(s=>s.role==='default-ring'&&s.usage==='paint')).toBe(false);
    const ring=t.pressedDefault.steps.find(s=>s.role==='default-ring'&&s.usage==='paint'&&s.resource?.type==='cicn');
    expect(ring.resource.signedId).toBe(-10231);
    expect(t.pressedDefault.steps.some(s=>s.requestedId===-10230&&s.action==='missing')).toBe(true);
    expect(t.noRing.steps.some(s=>s.role==='default-ring'&&s.requestedId===-10231&&s.action==='missing')).toBe(true);
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
      const face = trace.steps.find(s => s.role === 'face' && s.action === 'selected' && s.usage === 'paint' && s.resource?.type === 'cicn');
      // Expectations are explicit reviewed source IDs and runtime policy choices,
      // not derived by repeating the production resolver in the harness.
      const faceId = family === 'bevel' ? { active: -10166, pressed: -10165, inactive: -10167 }[state]
        : { active: -10239, pressed: -10238, inactive: -10240 }[state];
      expect(face.resource.signedId, `${slug}/${family}/${state}`).toBe(faceId);
      expect(face.resource.sourceCinfId).toBe(faceId);
      expect(face.owner.chainDepth).toBe(0);
      if (family === 'push') {
        expect(trace.steps.find(s => s.role==='default-ring'&&s.usage==='paint'&&s.resource?.type==='cicn').resource.signedId).toBe(state === 'inactive' ? -10232 : -10231);
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
        const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
        const broken=await loadOwnedControlFixture(api,{faces:[{id:-10239,name:'slot',pixels:plane(9,9,[100,120,140,255]),cinf:{corner:2,side:1}}]});
        broken.manifest.chromeElements.slot.asset='data:image/png;base64,broken#trace-error';
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
    expect(result.records.find(t => t.correlationId === 'push').steps.filter(s => s.role === 'face' && s.action === 'selected' && s.usage === 'paint' && s.resource?.type === 'cicn').map(s => s.resource.signedId)).toEqual([-10239]);
    expect(result.records.find(t => t.correlationId === 'bevel').steps.filter(s => s.role === 'face' && s.action === 'selected' && s.usage === 'paint' && s.resource?.type === 'cicn').map(s => s.resource.signedId)).toEqual([-10167]);
    expect(result.disposals).toBe(0);
    expect([result.successCalls, result.failureCalls]).toEqual([1, 1]);
    expect(result.successError).toBe(true); expect(result.failureError).toBe(true);
    expect(result.failureTrace.outcome).toEqual({ status: 'error' });
    // Resource preparation can fail before the driver selects any art. An
    // admission or completion must never be invented for that failed preload.
    expect(result.failureTrace.steps.filter(s=>s.usage==='paint')).toEqual([]);
    expect(result.failureTrace.bandPaints??[]).toEqual([]);
  });
}
