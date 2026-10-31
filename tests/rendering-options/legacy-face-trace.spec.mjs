import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { compareByteProvenance } from '../resource-provenance/compare.mjs';

// Independently read from the resource-map/data offsets in the committed fork,
// not from the loader's manifest or the renderer's trace. No matching cinf exists.
const forkHash = '693915a19b9f3111abd73fe4af9025403e4ad9eab107b72953e3731b624c9beb';
const pin = { archive: { sha256: forkHash, byteLength: 130067, format: 'rsrc' },
  selectedFork: { forkSha256: forkHash, byteLength: 130067, entryIndex: null, entryName: null, forkType: 1, fileType: null, creator: null },
  candidates: [{ type: 'cicn', signedId: -10239, byteLength: 362, payloadSha256: '5bb8a10b2e18668dba4d071887d3ed411a682b7f87195bdf5b4ec625040ee6fc', presence: 'present' },
    { type: 'cinf', signedId: -10239, presence: 'absent-from-selected-fork' }] };
function join(row) {
  const admission=row.trace?.steps.find(s=>s.role==='face'&&s.usage==='admission'&&s.resource?.type==='cicn');
  if(!admission)return {status:'unknown',errors:['Actual art admission missing']};
  const bytes=compareByteProvenance(admission,row.owner,pin,{role:'face',usage:'admission',baseUrl:'/themes/system7-nostalgia-silver',chainDepth:row.inherited?1:0,signedId:-10239,sourceCinfId:null,manifestKey:'active-push-button'});
  if(bytes.status!=='passed')return bytes;
  const errors=[];
  if(row.trace.outcome.status!=='themed'||row.trace.family!=='push-button'||row.trace.requested.default)errors.push('Wrong admission outcome');
  if(row.observedOccupancy!==0||row.trace.legacyFacePaint||(row.trace.bandPaints??[]).length||row.trace.steps.some(s=>s.bodyPaint))errors.push('Invented no-cinf completed paint');
  if(admission.resource.byteProvenance.cicnResourceIndex!==50||admission.resource.assetUrl!==row.actualAsset)errors.push('Wrong admitted occurrence');
  return{status:errors.length?'failed':'passed',errors};
}

for (const mode of ['source', 'built']) {
  test(`${mode}: System 7 no-cinf admission joins real raw bytes without claiming completed paint`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const profile = await api.prepareDisplayProfile(await (await fetch('/tests/decoder-fixtures/measured-display-profile.json')).json());
      const themes = await Promise.all([undefined, profile].map(displayProfile => api.loadTheme('/themes/system7-nostalgia-silver', { source: 'scheme.rsrc', provenance: true, displayProfile })));
      const traces = new Map(), counts = new Map();
      const onComplete = t => { traces.set(t.correlationId, t); counts.set(t.correlationId, (counts.get(t.correlationId) ?? 0) + 1); };
      const frozen = v => !v || typeof v !== 'object' || Object.isFrozen(v) && Object.values(v).every(frozen);
      try {
        return await Promise.all(themes.flatMap((owner, index) => [false, true].map(async inherited => {
          const theme = inherited ? { baseUrl: '/empty-child', manifest: { chromeElements: {}, ...(owner.manifest.displayProfile ? { displayProfile: owner.manifest.displayProfile } : {}) }, base: owner } : owner;
          const correlationId = `${index}-${inherited}`;
          const options = { label: '', minWidth: 80, height: 20, default: false };
          const buffer = await api.composeButton(theme, { ...options, diagnostics: { correlationId, onComplete } });
          const plain = await api.composeButton(theme, options), trace = traces.get(correlationId), paint = trace.legacyFacePaint;
          const facePlane = Array.from({ length: 20 }, (_, y) => Array.from({ length: 80 }, (_, x) => [...buffer.getPixel(x + 4, y + 4)])).flat(2);
          return { inherited, profile: owner.manifest.displayProfile?.id ?? null, count: counts.get(correlationId), trace,
            actualAsset: owner.manifest.chromeElements['active-push-button'].asset,
            owner: { baseUrl: owner.baseUrl, byteProvenance: { ...owner.byteProvenance, resources: owner.byteProvenance.resources.filter(r => r.resourceIndex === 50) } },
            size: [buffer.width, buffer.height], frozen: frozen(trace), pixelsEqual: buffer.data.every((v, i) => v === plain.data[i]),
            facePlane: { rect: [4, 4, 80, 20], encoding: 'base64-rgba8', rgba: btoa(String.fromCharCode(...facePlane)) },
            observedOccupancy: facePlane.filter((_, i) => i % 4 === 3).filter(a => a > 0).length,
            selectedOnly: trace.steps.filter(s => s.role === 'face' && s.action === 'selected'), stage: paint?.operation };
        })));
      } finally { themes.forEach(t => t.dispose()); }
    }, mode);
    const negatives = [];
    for (const row of rows) {
      expect(join(row)).toEqual({ status: 'passed', errors: [] });
      expect(row.count).toBe(1); expect(row.frozen).toBe(true); expect(row.pixelsEqual).toBe(true);
      expect(row.size).toEqual([88,28]);expect(row.observedOccupancy).toBe(0);
      expect(row.trace.bandPaints??[]).toEqual([]);expect(row.trace.legacyFacePaint).toBeUndefined();
      for (const [name, mutate] of Object.entries({
        missing:r=>{r.trace.steps=r.trace.steps.filter(s=>s.resource?.type!=='cicn');},
        owner:r=>{r.trace.steps.find(s=>s.resource?.type==='cicn').owner.baseUrl='/other';},
        depth:r=>{r.trace.steps.find(s=>s.resource?.type==='cicn').owner.chainDepth=7;},
        key:r=>{r.trace.steps.find(s=>s.resource?.type==='cicn').resource.manifestKey='wrong';},
        load:r=>{r.trace.steps.find(s=>s.resource?.type==='cicn').resource.byteProvenance.loadId='wrong';},
        occurrence:r=>{r.trace.steps.find(s=>s.resource?.type==='cicn').resource.byteProvenance.cicnResourceIndex=51;},
        payload:r=>{r.owner.byteProvenance.resources[0].sha256='0'.repeat(64);},
        asset:r=>{r.actualAsset+='#wrong';},
        missingProvenance:r=>{delete r.trace.steps.find(s=>s.resource?.type==='cicn').resource.byteProvenance;},
        painted:r=>{r.observedOccupancy=1596;r.trace.legacyFacePaint={operation:'legacy-nine-slice-and-sample-fill'};},
      })) {
        const changed = structuredClone(row); mutate(changed); const result = join(changed);
        expect(result.status, name).not.toBe('passed'); negatives.push({ profile: row.profile, inherited: row.inherited, name, result });
      }
    }
    await attachObservations(info, 'legacy-face-trace', `${mode}-actual`, { mode, rows, negatives, pin,
      limits:'Actual art admission only; PB9 double metadata NULL skips paint. No original provider/fidelity claim; historical legacy occupancy is retained externally.' });
  });

  test(`${mode}: unmigrated bevel legacy occupancy is clipped before text and keeps on/off pixels and decodes`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const source = api.PixelBuffer.alloc(7, 7); source.fillRect({ x: 0, y: 0, w: 7, h: 7 }, 131, 193, 255, 128);
      const blank = api.PixelBuffer.alloc(7, 7);
      const context = rect => ({ controlOrigin: [10, 20], portOrigin: [0, 0], patternOrigin: { status: 'unknown' }, clip: { kind: 'rect', rect } });
      const cases = [
        { name: 'clipped', src: source, compositionContext: context({ x: 12, y: 21, w: 3, h: 4 }) },
        { name: 'empty-clip', src: source, compositionContext: context({ x: 40, y: 40, w: 3, h: 4 }) },
        { name: 'transparent-label', src: blank, label: 'X' },
        { name: 'tiny-no-center', src: source, height: 3 },
        { name: 'tile', src: source, tile: true },
        { name: 'bevel', src: source, bevel: true },
      ];
      const decode = HTMLImageElement.prototype.decode; let decodes = 0;
      HTMLImageElement.prototype.decode = function () { decodes++; return decode.call(this); };
      try { const rows = [];
        for (const c of cases) {
          const encoded = api.bufferToCanvas(c.src).toDataURL();
          const theme = suffix => ({ baseUrl: location.origin, manifest: { chromeElements: { face: {
            sourceCicnId:-10166, asset: `${encoded}#${c.name}-${suffix}`, ...(c.tile ? { slice: { corner: 2, side: 2, tile: true } } : {}),
          } } } });
          const options = { label: c.label ?? '', minWidth: 29, height: c.height ?? 7, compositionContext: c.compositionContext };
          const compose=api.composeBevelButton;
          decodes = 0; const plain = await compose(theme('off'), options), offDecodes = decodes;
          let trace; decodes = 0; const out = await compose(theme('on'), { ...options, diagnostics: { onComplete: t => { trace = t; } } });
          rows.push({ name: c.name, trace, offDecodes, onDecodes: decodes, size: [out.width, out.height],
            same: out.data.every((v, i) => v === plain.data[i]), rgba: [...out.data] });
        } return rows;
      } finally { HTMLImageElement.prototype.decode = decode; }
    }, mode);
    for (const row of rows) { expect(row.same).toBe(true); expect([row.offDecodes, row.onDecodes]).toEqual([1, 1]); }
    const clipped = rows.find(r => r.name === 'clipped');
    expect(clipped.trace.legacyFacePaint).toMatchObject({ retainedNonzeroAlphaPixels: 12, controlOrigin: [10, 20],
      effectiveFaceClip: { x: 2, y: 1, w: 3, h: 4 }, centerFill: { sourcePoint: [2, 2], sampledDisplayRgba: [131, 193, 255, 128], outputAlpha: 255 } });
    const literal = Array.from({ length: 29 * 7 }, (_, i) => { const x = i % 29, y = Math.floor(i / 29);
      return x >= 2 && x < 5 && y >= 1 && y < 5 ? [131, 193, 255, y >= 2 ? 255 : 128] : [0, 0, 0, 0]; }).flat();
    expect(clipped.rgba).toEqual(literal);
    expect(rows.find(r => r.name === 'empty-clip').trace.legacyFacePaint).toBeUndefined();
    const text = rows.find(r => r.name === 'transparent-label'); expect(text.trace.legacyFacePaint).toBeUndefined(); expect(text.rgba.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    expect(rows.find(r => r.name === 'tiny-no-center').trace.legacyFacePaint.centerFill).toBeUndefined();
    expect(rows.find(r => r.name === 'tile').trace.legacyFacePaint.mode).toBe('tile');
    expect(rows.find(r => r.name === 'bevel').trace).toMatchObject({ family: 'bevel-button', legacyFacePaint: { resource: { signedId: -10166 }, retainedNonzeroAlphaPixels: 203 } });
    await attachObservations(info, 'legacy-face-trace', `${mode}-stage`, { mode, rows });
  });

  test(`${mode}: unmigrated bevel snapshots loaded identity and migrated push abort suppresses completion`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const source = api.PixelBuffer.alloc(7, 7); source.fillRect({ x: 0, y: 0, w: 7, h: 7 }, 80, 90, 100);
      const encoded = api.bufferToCanvas(source).toDataURL();
      const make = (name,id=-10166) => ({ baseUrl: '/original-owner', manifest: { chromeElements: { face: { asset: `${encoded}#${name}`, sourceCicnId:id,
        byteProvenance: { loadId: name, manifestKey: 'face', cicnResourceIndex: 8, cinfResourceIndex: null } } } } });
      const decode = HTMLImageElement.prototype.decode;
      const run = async (name, target, action) => {
        const theme = make(name,action==='abort'?-10239:-10166), controller = new AbortController(); let release, reached;
        const held = new Promise(r => { reached = r; }); const gate = new Promise(r => { release = r; });
        if (target === 'ring') theme.manifest.chromeElements.ring = { asset: `${encoded}#${name}-ring`, sourceCicnId: -10231 };
        const url = target === 'ring' ? theme.manifest.chromeElements.ring.asset : theme.manifest.chromeElements.face.asset;
        HTMLImageElement.prototype.decode = async function () { if (this.src === url) { reached(); await gate; if (action === 'fail') throw new Error('held decode failed'); } return decode.call(this); };
        let trace, error, calls = 0;
        try {
        const pending = (action==='abort'?api.composeButton:api.composeBevelButton)(theme, { label: '', minWidth: 29, height: 7, default: target === 'ring', diagnostics: { onComplete: t => { trace = t; calls++; if (action !== 'mutate') throw new Error('callback must not replace render error'); } } }, controller.signal)
          .catch(e => { error = { name: e.name, message: e.message }; });
        const decodeReached=await Promise.race([held.then(()=>true),pending.then(()=>false)]);if(!decodeReached)throw Error('identity fixture settled before decode');
        if (action === 'mutate') { theme.baseUrl = '/changed-owner'; Object.assign(theme.manifest.chromeElements.face, { asset: `${encoded}#never-loaded`, sourceCicnId: -9999 }); theme.manifest.chromeElements.face.byteProvenance.loadId = 'changed-load'; }
        if (action === 'abort') controller.abort();
        release(); await pending; HTMLImageElement.prototype.decode = decode;
        return { name, trace, error, calls, actualLoadedUrl: url };
        }finally{release?.();HTMLImageElement.prototype.decode=decode;}
      };
      try {
        const rows = [];
        for (const [name, target, action] of [['identity','face','mutate'],['face-abort','face','abort'],['face-failure','face','fail']]) rows.push(await run(name, target, action));
        let successCallback, calls = 0;
        try { await api.composeBevelButton(make('callback-success'), { label: '', diagnostics: { onComplete: () => { calls++; throw new Error('success callback'); } } }); } catch (e) { successCallback = e.message; }
        return { rows, successCallback, calls };
      } finally { HTMLImageElement.prototype.decode = decode; }
    }, mode);
    const [identity, ...failed] = result.rows;
    expect(identity.trace.legacyFacePaint).toMatchObject({ owner: { baseUrl: '/original-owner', chainDepth: 0 }, resource: {
      assetUrl: identity.actualLoadedUrl, signedId:-10166, byteProvenance: { loadId: 'identity', cicnResourceIndex: 8 } } });
    for (const row of failed) { expect(row.calls).toBe(1); expect(row.trace.outcome.status).toBe('error'); expect(row.trace.legacyFacePaint).toBeUndefined();
      expect(row.error.name).toBe(row.name.endsWith('failure') ? 'Error' : 'AbortError');
      expect(row.error.message).not.toContain('callback'); }
    expect(result.successCallback).toBe('success callback'); expect(result.calls).toBe(1);
    await attachObservations(info, 'legacy-face-trace', `${mode}-lifetime`, { mode, result });
  });
}
