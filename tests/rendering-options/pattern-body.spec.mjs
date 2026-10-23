import { readFileSync } from 'node:fs';
import { comparePatternBinding, compareCompletedPatternPaint, sameJson } from '../resource-provenance/patterns.mjs';
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
      const {loadOwnedControlFixture}=await import('/tests/rendering-options/owned-control-fixture.mjs');
      const sourcePlane=Array.from({length:7},()=>Array.from({length:7},()=>[0,0,0,0]));
      const owner=await loadOwnedControlFixture(api,{faces:[-10239,-10238,-10240,-10166,-10165,-10167].map(id=>({id,name:`face-${Math.abs(id)}`,pixels:sourcePlane,cinf:{corner:3,side:1,resourceId:0}})),patterns:[{id:0,name:'zero',pixels:Array.from({length:2},(_,y)=>Array.from({length:4},(_,x)=>colors[y*4+x]))}]});
      owner.baseUrl=`${location.origin}/owner/`;
      for(const e of Object.values(owner.manifest.chromeElements))e.bgPattern='mislinked';
      owner.manifest.patterns.mislinked={sourcePpatId:999,asset:'/must-not-load-mismatched-pattern.png'};
      const child={baseUrl:`${location.origin}/child/`,base:owner,manifest:{chromeElements:{},displayProfile:owner.manifest.displayProfile,patterns:{wrong:{sourcePpatId:0,asset:faceUrl}}}};
      const rows = [];
      for(const inherited of [false,true])for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) for (const shifted of [false, true]) {
        let trace;
        const output = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](inherited?child:owner, {
          label: '', minWidth: 29, height: 9, pressed: state === 'pressed', disabled: state === 'disabled',
          compositionContext: { controlOrigin: shifted ? [23, 25] : [20, 20], portOrigin: shifted ? [3, 5] : [0, 0],
            patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: 'unbounded' } },
          diagnostics: { onComplete: value => { trace = value; } },
        });
        const pixels = Array.from({ length: 9 }, (_, y) => Array.from({ length: 29 }, (_, x) => {
          const pixel = [...output.getPixel(x, y)]; if (!pixel[3]) return '.';
          const i = colors.findIndex(color => color.every((v, j) => v === pixel[j])); return i < 0 ? '?' : String.fromCharCode(65 + i);
        }).join(''));
        rows.push({inherited,family,state,shifted, size: [output.width, output.height], pixels, trace });
      }
      owner.dispose();return rows;
    }, mode);
    expect(rows).toHaveLength(24);
    expect(rows.filter(r => r.family === 'push' && r.state === 'normal' && !r.shifted&&!r.inherited)).toHaveLength(1);
    for (const row of rows) {
      expect(row.size).toEqual([29, 9]);
      expect(row.trace.requested).toMatchObject({ state: row.state === 'normal' ? 'active' : row.state === 'disabled' ? 'inactive' : 'pressed', pressed: row.state === 'pressed', disabled: row.state === 'disabled' });
      const faceId = { push: { normal: -10239, pressed: -10238, disabled: -10240 }, bevel: { normal: -10166, pressed: -10165, disabled: -10167 } }[row.family][row.state];
      expect(row.trace.steps.find(step => step.role === 'face' && step.action === 'selected' && step.usage==='paint' && step.resource?.type==='cicn')).toMatchObject({ owner:{chainDepth:row.inherited?1:0}, resource: { signedId: faceId, manifestKey:`face-${Math.abs(faceId)}` } });
      expect.soft(row.pixels, `${row.family}/${row.state}/${row.shifted}`).toEqual(row.shifted ? shiftedRows : normalRows);
      expect(row.trace.composition.faceRect).toMatchObject({ w: 29, h: 9 });
      const paints = row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'selected' && step.usage==='paint');
      expect(paints).toHaveLength(1);
      expect.soft(paints[0].bodyPaint,'completed pattern operation remains mandatory').toMatchObject({branch:'pattern-fill-union', unionRects:[{x:3,y:1,w:23,h:7},{x:1,y:3,w:27,h:3}],
        paintedPixels:173, sourceSize:[4,2], phase:{basis:'modern-composition-policy',offset:row.shifted?[23,25]:[20,20],originalPatternPhase:'unverified'}});
      expect.soft(paints[0]).toMatchObject({ requestedId:0,basis:row.family==='bevel'?'compatibility-policy':'source-dispatch',usage:'paint',
        owner:{chainDepth:row.inherited?1:0}, resource: { type: 'ppat', signedId: 0, manifestKey: 'zero' } });
      expect(paints[0].owner.baseUrl).toContain('/owner/');
      expect(row.trace.steps.some(step=>step.role==='body-fill'&&step.usage==='paint'&&step.resource?.signedId===999)).toBe(false);
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
      const {loadOwnedControlFixture}=await import('/tests/rendering-options/owned-control-fixture.mjs');
      const pixels=b=>Array.from({length:b.height},(_,y)=>Array.from({length:b.width},(_,x)=>[...b.getPixel(x,y)]));
      const theme=await loadOwnedControlFixture(api,{faces:[{id:-10239,name:'face',pixels:pixels(face),cinf:{corner:3,side:1,resourceId:0}},{id:-10231,name:'ring',pixels:pixels(ring),cinf:{corner:1,side:1}}],patterns:[{id:0,name:'tile',pixels:pixels(tile)}]});
      const rows = [];
      for (const bodyMode of [0, 1, 2, 3, 4, 6, 127, 128, 255]) for (const clipped of [false, true]) {
        theme.manifest.engineCinfs['-10239'][3]=bodyMode; let trace;
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
      expect(row.trace.steps.find(step => step.role === 'face' && step.action === 'selected' && step.usage==='paint' && step.resource?.type==='cicn')).toMatchObject({ owner: { chainDepth: 0 }, resource: { signedId: -10239, manifestKey: 'face' } });
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
      const painted = row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'selected' && step.usage==='paint');
      expect(painted).toHaveLength(1);
      const step = painted[0], id = row.state === 'pressed' ? -10238 : 17;
      expect(step).toMatchObject({ requestedId: id, bodyMode: 0, basis: 'source-dispatch', usage: 'paint',
        owner: { chainDepth: row.inherited ? 1 : 0 }, resource: { type: 'ppat', signedId: id } });
      const entry = result.owner.manifest.patterns[step.resource.manifestKey], pin = pins.patterns.find(pin => pin.signedId === id);
      expect(step.resource.byteProvenance).toEqual(entry.byteProvenance);
      expect(comparePatternBinding(result.owner, step.resource.manifestKey, { ...pin,
        inputSha256: pins.archiveSha256, forkSha256: pins.forkSha256,
        resourceIndex: step.resource.byteProvenance.ppatResourceIndex }).status).toBe('matched');
      expect(step.bodyPaint,'completed real pattern operation must publish bodyPaint').toMatchObject({branch:'pattern-fill-union',sourceAssetUrl:entry.asset});
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
      const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
      const make=async request=>{
        const theme=await loadOwnedControlFixture(api,{faces:[[-10239,'normal'],[-10238,'pressed']].map(([id,name])=>({id,name,pixels:plane(7,7,[255,255,255,255]),...(request?{cinf:{corner:3,side:1,background:[3,3],mode:request.mode,resourceId:request.resourceId}}:{})}))});
        theme.manifest.patterns={mustNotLoad:{sourcePpatId:17,asset:'/missing-unsupported-body-must-not-load.png'}};return theme;
      };
      const requests=[null,{mode:5,resourceId:17},{mode:0,resourceId:-99}],rows=[];
      for(const request of requests){const theme=await make(request);try{let trace;const out=await api.composeButton(theme,{label:'',diagnostics:{onComplete:t=>trace=t}});rows.push({request,pixel:[...out.getPixel(10,3)],trace});}finally{theme.dispose();}}
      const theme=await make({mode:0,resourceId:-99});
      const input = { controlOrigin: [3, 5], portOrigin: [0, 0], patternOrigin: { status: 'unknown' }, clip: { kind: 'unbounded' } }, traces = [];
      const element = await api.interactiveButton(theme, { label: '', compositionContext: input, diagnostics: { onComplete: trace => {
        traces.push(trace); input.controlOrigin[0] = 99;
      } } });
      element.remove(); // detached fixture; page teardown releases its local listeners
      let invalidTrace, callbacks = 0, errorName;
      try { await api.composeButton(theme, { compositionContext: { ...input, controlOrigin: [NaN, 0] }, diagnostics: { onComplete: value => { invalidTrace = value; callbacks++; } } }); }
      catch (error) { errorName = error.name; }
      theme.dispose();return { rows, traces, callerOrigin: input.controlOrigin, invalidTrace, callbacks, errorName };
    }, mode);
    for (const row of result.rows) {
      expect(row.pixel).toEqual(row.request?[255,255,255,255]:[0,0,0,0]);
      expect(row.trace.composition).toMatchObject({ originalPortState: 'unverified', appliedUnknownPatternOffset: true,
        context: { basis: 'compatibility-default', controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'unknown' }, clip: { kind: 'unknown' } } });
      const decisions=row.trace.steps.filter(step=>step.role==='body-fill');
      if(!row.request){expect(decisions).toEqual([]);expect(row.trace.bandPaints??[]).toEqual([]);}
      else{expect(decisions.some(step=>step.requestedId===row.request.resourceId&&step.action==='missing')).toBe(true);expect(decisions.some(step=>step.resource)).toBe(false);}
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
      const loader=api;
      const { forkOf, cinf, onePixelCicn } = await import('/tests/resource-provenance/fixtures.mjs');
      const { twoPixelPpat } = await import('/tests/resource-provenance/patterns.mjs');
      const request = cinf(); request[0] = 0; request[1] = 0;
      const bytes = forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() },
        { type: 'cinf', id: -10239, data: request },
        { type: 'ppat', id: 0, name: '2', data: twoPixelPpat() },
        { type: 'ppat', id: 0, name: '1', data: twoPixelPpat({ red: 0 }) }]);
      const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
      const inputSha256=await hash(bytes),payloadSha256=await hash(twoPixelPpat({red:0}));
      const rows = [];
      for (const provenance of [false, true]) {
        const theme = await loader.loadKaleidoscopeScheme(bytes, { provenance });
        try {
          const face = Object.values(theme.manifest.chromeElements)[0];
          let trace;
          const output = await api.composeButton(theme, { label: '', minWidth: 29, height: 9,
            diagnostics: { onComplete: value => { trace = value; } } });
          const row = { provenance, inputSha256,payloadSha256,owner:{baseUrl:theme.baseUrl,manifest:{patterns:theme.manifest.patterns},byteProvenance:theme.byteProvenance}, keys: Object.keys(theme.manifest.patterns), bodyPattern: face.bodyPattern,
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
      const selected = row.trace.steps.filter(step => step.role === 'body-fill' && step.action === 'selected' && step.usage==='paint');
      expect(selected).toHaveLength(1);
      expect(selected[0].resource).toMatchObject({ type: 'ppat', signedId: 0, manifestKey: '1' });
      if (row.provenance) {
        expect(selected[0].resource.byteProvenance.ppatResourceIndex).toBe(3);
        const expected={inputSha256:row.inputSha256,forkSha256:row.inputSha256,payloadSha256:row.payloadSha256,byteLength:104,resourceIndex:3,signedId:0,
          chainDepth:0,bodyMode:0,sourceSize:[2,1],unionRects:[{x:0,y:0,w:29,h:9}],paintedPixels:261,phaseOffset:[0,0],context:row.trace.composition.context};
        expect(compareCompletedPatternPaint(row.owner,selected[0],expected)).toEqual({status:'matched',failures:[]});
        const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
        expect(compareCompletedPatternPaint(reorder(row.owner),reorder(selected[0]),reorder(expected))).toEqual({status:'matched',failures:[]});
        expect(sameJson({rects:[{x:1},{x:2}]},{rects:[{x:2},{x:1}]})).toBe(false);
        for(const mutate of [s=>s.bodyPaint.phase.offset[0]++,s=>s.bodyPaint.paintedPixels--,s=>s.resource.byteProvenance.ppatResourceIndex=2,s=>s.resource.assetUrl='unloaded:pattern',s=>delete s.bodyPaint,s=>delete s.bodyPaint.context.basis,s=>s.bodyPaint.unionRects.reverse().push({x:0,y:0,w:29,h:9})]) {
          const changed=structuredClone(selected[0]);mutate(changed);expect(compareCompletedPatternPaint(row.owner,changed,expected).status).toBe('mismatch');
        }
      }
      else expect(selected[0].resource.byteProvenance).toBeUndefined();
      expect(selected[0].reason).toBe('resource-id');
      const [unlinked,linked]=row.legacy;
      for(const carried of [unlinked,linked]){
        expect(carried.pixel).toEqual([0,0,0,255]);
        const actual=carried.trace.steps.find(step=>step.role==='body-fill'&&step.action==='selected'&&step.usage==='paint');
        expect(actual.resource).toMatchObject({type:'ppat',signedId:0,manifestKey:'1'});
      }
    }
    await attachObservations(info, 'pattern-paint', `${mode}-numeric-order`, { mode, result });
  } catch (error) { await attachCase(page, info, { mode, result }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: completed pattern unions count transparent writes and exclude clipped empty or aborted stages`, async ({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try {
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
      const face=api.PixelBuffer.alloc(5,5),tile=api.PixelBuffer.alloc(2,1); // Both transparent: write count is not occupancy.
      const url=b=>api.bufferToCanvas(b).toDataURL();
      const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
      const theme=await loadOwnedControlFixture(api,{faces:[{id:-10239,name:'face',pixels:plane(5,5),cinf:{corner:2,side:2,tile:true,mode:2,resourceId:0}}],patterns:[{id:0,name:'tile',pixels:plane(2,1,[0,0,0,255])}]});
      // Explicit custom alpha pattern remains modern caller input; it is not a
      // native PixPat transparency claim. Typed face/cinf identity stays real.
      theme.manifest.patterns.tile.asset=url(tile);const el=theme.manifest.chromeElements.face;
      const rows=[];
      for(const spec of [{name:'equal',corner:2,side:2,height:10},{name:'cross',corner:3,side:1,height:10},{name:'clipped',corner:3,side:1,height:10,clip:{kind:'rect',rect:{x:23,y:22,w:5,h:4}}},{name:'zero',corner:2,side:2,height:10,clip:{kind:'rect',rect:{x:100,y:100,w:1,h:1}}},{name:'no-body',corner:6,side:6,height:4}]){
        theme.manifest.engineCinfs['-10239'][0]=spec.corner;theme.manifest.engineCinfs['-10239'][1]=spec.side;let trace;
        const out=await api.composeButton(theme,{label:'',minWidth:24,height:spec.height,compositionContext:{controlOrigin:[20,20],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:spec.clip??{kind:'unbounded'}},diagnostics:{onComplete:t=>trace=t}});
        rows.push({name:spec.name,trace,nonzero:[...out.data].filter(Boolean).length});
      }
      let entered,release,trace,error;const atDecode=new Promise(r=>entered=r),gate=new Promise(r=>release=r),original=Image.prototype.decode,controller=new AbortController();
      const abortedTheme=await loadOwnedControlFixture(api,{faces:[{id:-10239,name:'face',pixels:plane(5,5,[25,50,75,255]),cinf:{corner:2,side:1,tile:true,mode:2,resourceId:0}}],patterns:[{id:0,name:'tile',pixels:plane(2,1,[0,0,0,255])}]});
      const heldUrl=abortedTheme.manifest.chromeElements.face.asset;
      Image.prototype.decode=async function(){if(this.src===heldUrl){entered();await gate}return original.call(this)};
      try{
        const pending=api.composeButton(abortedTheme,{label:'',minWidth:24,height:10,diagnostics:{onComplete:t=>trace=t}},controller.signal).then(()=>({resolved:true}),e=>{error=e.name;return{resolved:false}});
        const reached=await Promise.race([atDecode.then(()=>true),pending.then(()=>false)]);if(!reached)throw Error('pattern abort fixture settled before decode');controller.abort();release();await pending;
      }finally{release?.();Image.prototype.decode=original;abortedTheme.dispose();theme.dispose();}
      return{rows,aborted:{trace,error}};
    },mode);
    const expected={equal:{unionRects:[{x:2,y:2,w:20,h:6}],paintedPixels:120},cross:{unionRects:[{x:3,y:1,w:18,h:8},{x:1,y:3,w:22,h:4}],paintedPixels:160},clipped:{unionRects:[{x:3,y:1,w:18,h:8},{x:1,y:3,w:22,h:4}],paintedPixels:20}};
    for(const row of result.rows){
      expect(row.nonzero).toBe(0);const selection=row.trace.steps.filter(s=>s.role==='body-fill'&&s.action==='selected'&&s.usage==='paint');expect(selection).toHaveLength(1);
      if(expected[row.name])expect(selection[0].bodyPaint).toMatchObject({...expected[row.name],branch:'pattern-fill-union',sourceSize:[2,1],phase:{basis:'modern-composition-policy',offset:[-24,0],originalPatternPhase:'unverified'}});
      else expect(selection[0].bodyPaint).toBeUndefined();
    }
    expect(result.aborted.error).toBe('AbortError');expect(result.aborted.trace.outcome.status).toBe('error');
    expect(result.aborted.trace.steps.filter(s=>s.role==='body-fill'&&s.action==='selected'&&s.usage==='paint')).toHaveLength(0);
    expect(result.aborted.trace.steps.some(s=>s.bodyPaint)).toBe(false);
    await attachObservations(info,'pattern-paint',`${mode}-completion`,{mode,result});
  }catch(error){await attachCase(page,info,{mode,result},error);throw error}
});
