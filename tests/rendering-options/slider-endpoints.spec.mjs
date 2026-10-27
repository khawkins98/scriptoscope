import { sliderPins, verifySliderRows } from '../rendering-requirements/slider-cases.mjs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { sliderRuntimeMutations, mutateSliderRuntime } from '../helpers/slider-runtime-mutations.mjs';
import { grooveColors } from '../decoder-fixtures/slider-groove.mjs';
// Independent oracle: slider-layout-cinf.md, slider.md §5.2/§5.5/CF3;
// 48px axis, 7px thumb, c=3 -> T=35. Normal red cell is [16,32).
const white = [255,255,255,255], red = [255,0,0,255];
const runFor = kind => kind === 'inactive-ordinary' ? 'RGBWK'+' '.repeat(38)+'BWKYC' : kind === 'lines' ? 'RG'+'B'.repeat(44)+'YC'
  : kind === 'end' ? 'RY'+'GBWKY'.repeat(9)+'C' : 'R'+'GBWKY'.repeat(10).slice(0,46)+'C';
function expectedPlane({ orientation, value, state = 'normal', corner = 3, kind = 'start', wide = false }) {
  const vertical = orientation === 'vertical', start = corner + Math.trunc((48 - 7 - 2 * corner) * (vertical ? 1-value : value));
  const row = runFor(kind), colors = [[255,0,0,255],[0,255,0,255],[0,0,255,255]];
  const thumb = state === 'pressed' ? colors[1] : state === 'normal' ? red : [0,0,0,255];
  return Array.from({length:48*16}, (_, i) => {
    const x = i % (vertical ? 16 : 48), y = Math.floor(i / (vertical ? 16 : 48)), axis = vertical ? y : x, cross = vertical ? x : y;
    if (axis >= start && axis < start+7) return thumb;
    return wide ? colors[(cross+1)%3] : cross >= 6 && cross < 9 ? (grooveColors[row[axis]] ?? white) : white;
  }).flat();
}
async function setup(page, servers, mode) {
  const mutation=sliderRuntimeMutations.find(m=>m.id===process.env.SCRIPTOSCOPE_SLIDER_MUTATION);
  if(mutation && mode==='source') await page.route('**/'+mutation.path,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:mutateSliderRuntime(await response.text(),mutation)});
  });
  await openHarness(page, servers, mode);
  await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const f = await import('/tests/decoder-fixtures/slider-declared.mjs');
    const environment = providers => api.prepareCinfEnvironment({ version:1, complete:true, providers });
    const load = async (providers, options = {}) => api.loadKaleidoscopeScheme(f.declaredThemeFork(options), {
      provenance:true, ...(providers ? { sliderLayoutEnvironment:await environment(providers) } : {}),
    });
    window.declaredSlider = { api, f, environment, load };
  }, mode);
}
for (const mode of ['source','built']) {
  test(`${mode}: declared cinf providers control gate, corner, complete groove bytes and ordered authority`, async ({page,servers}, info) => {
    await setup(page,servers,mode);
    const rows = await page.evaluate(async () => {
      const {api,f,load} = window.declaredSlider, rows = [];
      const first = f.provider('first',f.declaredEntries({corner:3}));
      const second = f.provider('second',f.declaredEntries({corner:5,groove:[2,1,0,0]}));
      for (const [label,providers,options] of [
        ['first',[first,second],{}], ['reversed',[second,first],{}],
        ['gate-from-declaration',[first],{gate:false}],
        ['end-anchor',[f.provider('end',f.declaredEntries({groove:[1,1,1,1]}))],{}],
        ['wide',[first],{wide:true}], ['ordinary',null,{}],
      ]) {
        const theme = await load(providers,options);
        for(const orientation of ['horizontal','vertical'])for(const value of [0,.25,.5,1])for(const state of ['normal','pressed','disabled']) {
          const out=await api.composeSlider(theme,{orientation,length:48,value,state});
          rows.push({label,orientation,value,state,size:[out.width,out.height],pixels:Array.from(out.data),marker:theme.manifest.sliderLayoutEnvironment});
        }
        theme.dispose();
      }
      // Authoritative declared absences do not fall through to archive groove cinfs.
      const cornerOnly = f.provider('corner-only',[f.cinf(-10132,[3]),f.cinf(-10116,[3])]);
      const absent = await load([cornerOnly]);
      for(const orientation of ['horizontal','vertical']) {
        const out=await api.composeSlider(absent,{orientation,length:48,value:0});
        rows.push({label:'no-declared-groove',orientation,value:0,state:'normal',pixels:Array.from(out.data)});
      }
      absent.dispose();
      return rows;
    });
    expect(rows).toHaveLength(146);
    for(const row of rows) {
      if(row.label==='no-declared-groove') {
        const vertical=row.orientation==='vertical',start=vertical?38:3;
        const expected=Array.from({length:48*16},(_,i)=>{
          const axis=vertical?Math.floor(i/16):i%48;
          return axis>=start&&axis<start+7?red:white;
        }).flat();
        expect(row.pixels,`AUTHORITY ${row.orientation}: no archive cinf mixing`).toEqual(expected); continue;
      }
      const ordinary = row.label==='ordinary', reversed=row.label==='reversed';
      expect(row.size).toEqual(row.orientation==='vertical'?[16,48]:[48,16]);
      // Disabled group2 cinf is one byte in the declared lane: CF3 skips it
      // and uses the normal groove's complete metadata. Ordinary gb has k=5.
      let kind = ordinary || reversed ? 'lines' : row.label==='end-anchor' ? 'end' : 'start';
      if(ordinary && row.state==='disabled') kind='inactive-ordinary';
      const expected=expectedPlane({...row,corner:ordinary||reversed?5:3,kind,wide:row.label==='wide'});
      expect(row.pixels,`DECLARED_PIXELS ${row.label}/${row.orientation}/${row.state}/${row.value}`).toEqual(expected);
      if(!ordinary) expect(Object.keys(row.marker).sort()).toEqual(['bindingId','environmentId']);
    }
    await attachObservations(info,'slider-declared',mode,{mode,rows,claim:'Modern ordered cinf-only composition contract; no native acceptance or status promotion'});
  });

  test(`${mode}: declared identity, Rect admission and short/unknown reads fail explicitly`, async ({page,servers}) => {
    await setup(page,servers,mode);
    const result=await page.evaluate(async()=>{
      const {api,f,load}=window.declaredSlider, rows=[];
      const good=f.provider('good',f.declaredEntries());
      const attempt=async(label,theme,opts={})=>{let code=null;try{await api.composeSlider(theme,{length:48,...opts});}catch(e){code=e.code??e.name;}rows.push({label,code});};
      const control=await load([good]);
      // Positive control completes before every identity perturbation.
      const positive=await api.composeSlider(control,{length:48,value:0});
      const manifest=control.manifest,marker=manifest.sliderLayoutEnvironment;
      await attempt('cloned-owner',{...control,manifest:{...manifest}});
      await attempt('deep-clone',{...control,manifest:structuredClone(manifest)});
      const other=await load([good]);manifest.sliderLayoutEnvironment=other.manifest.sliderLayoutEnvironment;await attempt('transplant',control);manifest.sliderLayoutEnvironment=marker;
      manifest.sliderLayoutEnvironment={...marker};await attempt('replacement',control);manifest.sliderLayoutEnvironment=marker;
      delete manifest.sliderLayoutEnvironment;await attempt('deletion',control);manifest.sliderLayoutEnvironment=marker;
      const thumb=Object.values(manifest.chromeElements).find(e=>e.sourceCicnId===-10129),asset=thumb.asset;
      thumb.asset='changed';await attempt('changed-asset',control);thumb.asset=asset;
      await attempt('base',{...control,base:other});
      for(const [label,options,opts] of [['cross-small',{cross:15},{}],['cross-large',{cross:17},{}],['missing-thumb',{thumb:false},{}],['negative-travel',{}, {length:32}],['rect-range',{}, {length:32768}],['wrong-group',{}, {variant:'pointsUpOrLeft'}],['fractional',{}, {length:48.5}],['nan',{}, {value:NaN}]]) {
        const t=await load([label==='negative-travel'?f.provider('large-corner',f.declaredEntries({corner:14})):good],options);await attempt(label,t,opts);t.dispose();
      }
      for(const [label,entries] of [
        ['empty-corner',[f.cinf(-10132,[])]],['absent-corner',[f.cinf(42,[3])]],
        ['duplicate-corner',[f.cinf(-10132,[3]),f.cinf(-10132,[4])]],
        ['duplicate-groove',[...f.declaredEntries(),f.cinf(-10131,[1,1,1,0])]],
      ]){const t=await load([f.provider(label,entries)]);await attempt(label,t);t.dispose();}
      const partial=await load([f.provider('partial',f.declaredEntries(),false),good]);await attempt('unknown-provider',partial);partial.dispose();
      // Full copied payloads: lengths 0..3 fail groove reads; later group0
      // metadata is absent in declared lane, even though present in the archive.
      const short=[];
      for(const n of [0,1,2,3,4]) {
        const entries=f.declaredEntries({groove:[1,1,1,0].slice(0,n)});
        const t=await load([f.provider('short',entries)]);
        const out=await api.composeSlider(t,{length:48,value:0});
        short.push({n,pixel:out.getPixel(15,7)});t.dispose();
      }
      // Zero is real corner metadata; unlike missing, it is admitted.
      const zero=await load([f.provider('zero',f.declaredEntries({corner:0}))]);
      const zeroOut=await api.composeSlider(zero,{length:48,value:0});
      const restored=await api.composeSlider(control,{length:48,value:0});
      control.dispose();other.dispose();zero.dispose();
      return {rows,short,positive:Array.from(positive.data),restored:Array.from(restored.data),zeroPixel:zeroOut.getPixel(0,0)};
    });
    expect(result.positive,'POSITIVE_CONTROL').toEqual(expectedPlane({orientation:'horizontal',value:0}));
    expect(result.restored).toEqual(result.positive);
    expect(result.rows.map(r=>[r.label,r.code])).toEqual([
      'cloned-owner','deep-clone','transplant','replacement','deletion','changed-asset','base',
      'cross-small','cross-large','missing-thumb','negative-travel','rect-range','wrong-group','fractional','nan',
      'empty-corner','absent-corner','duplicate-corner','duplicate-groove','unknown-provider',
    ].map(label=>[label,'UNSUPPORTED_CINF_ENVIRONMENT']));
    expect(result.short).toEqual([0,1,2,3,4].map(n=>({n,pixel:n<4?white:grooveColors.Y})));
    expect(result.zeroPixel).toEqual(red);
  });

  test(`${mode}: ordinary and declared pointers use committed travel, exact grabs and centered track clicks on both axes`, async ({page,servers}) => {
    await setup(page,servers,mode);
    const rows=await page.evaluate(async()=>{
      const {api,f,load}=window.declaredSlider,rows=[];
      const fire=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:41,button:0}));
      for(const declared of [false,true])for(const orientation of ['horizontal','vertical']) {
        const theme=await load(declared?[f.provider('layout',f.declaredEntries())]:null,{corner:3});
        const values=[],el=await api.interactiveSlider(theme,{orientation,length:48,value:.25,scale:2,onChange:v=>values.push(v)});document.body.append(el);
        const canvas=el.querySelector('canvas'),r=canvas.getBoundingClientRect();
        const p=axis=>orientation==='horizontal'?[r.left+axis*2,r.top+16]:[r.left+16,r.top+axis*2];
        // c=3, t=7, T=35, spatial thumb starts 11(h)/29(v).
        // An off-center grab preserves exact .25 (not 8/35 or 9/35).
        const start=orientation==='horizontal'?12:30;
        fire(el,'pointerdown',...p(start));const grabbed=values.slice();
        fire(window,'pointermove',...p(start+(orientation==='horizontal'?7:-7)));const moved=values.slice();
        fire(window,'pointerup',...p(start+(orientation==='horizontal'?7:-7)));
        await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);values.length=0;
        fire(el,'pointerdown',...p(orientation==='horizontal'?27.5:20.5));fire(window,'pointerup',...p(orientation==='horizontal'?27.5:20.5));
        rows.push({declared,orientation,grabbed,moved,clicked:values.slice()});
        await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);el.remove();theme.dispose();
      }
      return rows;
    });
    expect(rows).toHaveLength(4);
    for(const row of rows){expect(row.grabbed,'EXACT_GRAB').toEqual([]);expect(row.moved,'TRAVEL_DELTA').toEqual([.45]);expect(row.clicked,'CENTERED_TRACK').toEqual([.6]);}
  });
}

// Private adapter trace is source-only; public built compositions above have
// independent complete-plane assertions and do not borrow source rendering.
test('source: every opted-in slider cinf request uses the ordered declared tier; art and ppat keep their chain', async ({page,servers},info) => {
  await setup(page,servers,'source');
  const result=await page.evaluate(async()=>{
    const {f,load}=window.declaredSlider;
    const {composeSliderWithLayout}=await import('/src/controls.ts');
    const {themeResourceChain}=await import('/src/engine/resources/theme.ts');
    const {snapshotSliderEnvironment}=await import('/src/engine/resources/sliderEnvironment.ts');
    const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
    const {endpointIcon}=await import('/tests/decoder-fixtures/slider-endpoints.mjs');
    const a=f.provider('first',[f.cinf(-10132,[3]),f.cinf(-10116,[3])]);
    const b=f.provider('second',[
      ...f.declaredEntries({corner:7,groove:[1,1,1,1]}),
      // Deliberate wrong art in the provider cannot become a raster source.
      {type:'cicn',id:-10129,data:endpointIcon(false,true,16,13)},
    ]);
    const theme=await load([a,b]),rows=[];
    for(const orientation of ['horizontal','vertical'])for(const state of ['normal','pressed','disabled']) {
      const frame=await composeSliderWithLayout(theme,{orientation,state,length:48,value:.25,trace:true});
      rows.push({orientation,state,trace:frame.trace,layout:frame.layout});
    }
    // Explicit absence of declared groove metadata must produce NULL requests,
    // never the conflicting archive/base cinfs. Base composition is rejected by
    // typed admission; generic ResourceChain must still suppress base cinfs.
    const sparse=await load([a]),base=await load(null);
    const sparseFrame=await composeSliderWithLayout(sparse,{length:48,trace:true});
    const env=snapshotSliderEnvironment(sparse,'horizontal');
    sparse.base=base;
    const patternUrl=Object.values(theme.manifest.chromeElements).find(e=>e.sourceCicnId===-10131).asset;
    sparse.manifest.patterns={owned:{sourcePpatId:42,asset:patternUrl}};
    const wanted=[{type:'cinf',id:-10131},{type:'cicn',id:-10129},{type:'ppat',id:42}];
    const chain=await themeResourceChain(sparse,wanted,{cinfProviders:env.providers});
    const mix={cinf:chain.getResource('cinf',-10131),cicn:chain.getResource('cicn',-10129)?.provider.tier,ppat:chain.getResource('ppat',42)?.provider.tier};
    const ordinary=await themeResourceChain(sparse,wanted);
    const plain={cinf:ordinary.getResource('cinf',-10131)?.provider.tier,cicn:ordinary.getResource('cicn',-10129)?.provider.tier,ppat:ordinary.getResource('ppat',42)?.provider.tier};
    // CF3 short group2 groove fails; complete group0 metadata wins next.
    const short=await load([f.provider('short',[
      ...f.declaredEntries({groove:[1,1,1]}),f.cinf(-10143,[2,1,0,0]),f.cinf(-10127,[2,1,0,0]),
    ])]);
    const cf3=await composeSliderWithLayout(short,{length:48,trace:true});
    theme.dispose();sparse.dispose();base.dispose();short.dispose();
    return {rows,sparse:sparseFrame.trace,mix,plain,cf3:cf3.trace};
  });
  for(const row of result.rows) {
    const gb=row.orientation==='horizontal'?-10132:-10116;
    const cinfs=row.trace.resolved.filter(r=>r.type==='cinf');
    expect(cinfs.length).toBeGreaterThan(3);
    for(const request of cinfs) {
      if(request.found) {
        expect(request.tier,`ALL_CINF_AUTHORITY ${request.id}/${request.row}`).toBe('cinf');
        expect(request.provider).toBe(request.id===gb?'first':'second');
      } else { expect(request.tier).toBe(null);expect(request.provider).toBe(null); }
    }
    expect(cinfs.some(r=>r.row?.includes('G1'))).toBe(true);
    expect(cinfs.some(r=>r.row?.includes('ID6'))).toBe(true);
    expect(cinfs.some(r=>r.id===gb+1 || r.id===gb+2)).toBe(true);
    const art=row.trace.resolved.filter(r=>r.type==='cicn'&&r.found);
    expect(art.length).toBeGreaterThan(0);expect(art.every(r=>r.tier==='archive')).toBe(true);
    expect(row.layout.thumb).toEqual(row.orientation==='horizontal'?{x:11,y:0,w:7,h:16}:{x:0,y:29,w:16,h:7});
    expect(row.layout).not.toHaveProperty('endpointPolicy');
  }
  const absent=result.sparse.resolved.filter(r=>r.type==='cinf'&&r.id!==-10132);
  expect(absent.length).toBeGreaterThan(0);expect(absent.every(r=>r.found===false&&r.provider===null&&r.tier===null)).toBe(true);
  expect(result.mix).toEqual({cinf:null,cicn:'archive',ppat:'archive'});
  expect(result.plain).toEqual({cinf:'archive',cicn:'archive',ppat:'archive'});
  expect(result.cf3.drawOps.some(o=>o.op==='track'&&o.id===-10131&&o.row==='CF3,TR4')).toBe(true);
  expect(result.cf3.drawOps.find(o=>o.op==='track'&&o.src)?.id).toBe(-10143);
  await attachObservations(info,'slider-declared','trace',{mode:'source',...result,claim:'Declared modern trace authority, complete payloads and CF3; not a native Resource Manager claim'});
});

for(const mode of ['source','built']) test(`${mode}: unchanged pinned corner-only fixture draws declared endpoints without archive groove metadata`,async({page,servers})=>{
  // Keep the existing executable inventory link while the PM separately rejudges
  // its historical unsupported assessment against the declared-provider migration.
  test.info().annotations.push({type:'fidelity-assertion',description:'slider.declared-group2-endpoints'});
  await setup(page,servers,mode);
  const rows=await page.evaluate(async()=>{
    const {api}=window.declaredSlider;
    const {endpointFork,endpointProvider}=await import('/tests/decoder-fixtures/slider-endpoints.mjs');
    const env=await api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'layout',complete:true,bytes:endpointProvider(3)}]});
    const declared=await api.loadKaleidoscopeScheme(endpointFork(),{sliderLayoutEnvironment:env});
    const plain=await api.loadKaleidoscopeScheme(endpointFork()),rows=[];
    for(const orientation of ['horizontal','vertical'])for(const value of [0,.5,1]){
      const out=await api.composeSlider(declared,{orientation,length:48,value});
      rows.push({orientation,value,pixels:Array.from(out.data),plainNull:(await api.composeSlider(plain,{orientation,length:48,value}))===null});
    }
    declared.dispose();plain.dispose();return rows;
  });
  for(const row of rows){
    const vertical=row.orientation==='vertical',start=(vertical?[38,20,3]:[3,20,38])[[0,.5,1].indexOf(row.value)];
    const expected=Array.from({length:48*16},(_,i)=>{const axis=vertical?Math.floor(i/16):i%48;return axis>=start&&axis<start+7?red:white;}).flat();
    expect(row.pixels).toEqual(expected);expect(row.plainNull).toBe(true);
  }
});

for(const mode of ['source','built']) test(`${mode}: declared native values and pending compositions retain admitted inputs`,async({page,servers})=>{
  await setup(page,servers,mode);
  const result=await page.evaluate(async()=>{
    const {api,f,load}=window.declaredSlider;
    const theme=await load([f.provider('layout',f.declaredEntries())]);
    const root=document.createElement('section');document.body.append(root);
    root.innerHTML='<form><input type="range" min="10" max="20" step=".25" value="12.5" aria-label="Declared native"></form>';
    const {attachNativeSources}=await import('/tests/rendering-options/explicit-native-host.mjs');
    const handle=await attachNativeSources(api,{root,theme,controls:[root.querySelector('input')]});
    for(let i=0;i<120&&!root.querySelector('.scriptoscope-slider canvas');i++)await new Promise(requestAnimationFrame);
    const face=root.querySelector('.scriptoscope-slider'),native=root.querySelector('input'),events=[];
    if(!face?.querySelector('canvas'))throw new Error('Native declared positive setup failed');
    for(const type of ['input','change'])native.addEventListener(type,()=>events.push([type,native.value]));
    const fire=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:51,button:0}));
    const r=face.querySelector('canvas').getBoundingClientRect();
    // Native length120 c3 t7 -> T107; v=.25 thumb starts29. Grab left
    // interior31 preserves12.5 exactly; one full travel reaches20.
    fire(face,'pointerdown',r.left+31,r.top+8);const grabbed=native.value;
    fire(window,'pointermove',r.left+138,r.top+8);fire(window,'pointerup',r.left+138,r.top+8);
    const nativeResult={grabbed,value:native.value,events};handle.disconnect();root.remove();
    // New owner and URLs: ensure the first decode really pauses, then mutate
    // caller options and the loaded thumb only after admission has completed.
    const snap=await load([f.provider('snapshot',f.declaredEntries())]);
    const thumb=Object.values(snap.manifest.chromeElements).find(e=>e.sourceCicnId===-10129),original=thumb.asset;
    const decode=HTMLImageElement.prototype.decode,calls=[];let entered,release;
    const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    HTMLImageElement.prototype.decode=function(){calls.push(this.src);const pending=decode.call(this);if(calls.length===1){entered();return pending.then(()=>gate);}return pending;};
    let out;
    try {
      const options={orientation:'horizontal',length:48,value:0};
      const pending=api.composeSlider(snap,options);await started;
      options.orientation='vertical';options.length=99;options.value=1;thumb.asset='changed-after-admission';release();out=await pending;
    } finally {HTMLImageElement.prototype.decode=decode;release();}
    let code=null;try{await api.composeSlider(snap,{length:48});}catch(e){code=e.code;}
    const snapshot={size:[out.width,out.height],pixels:Array.from(out.data),original,calls,code};
    snap.dispose();theme.dispose();return {nativeResult,snapshot};
  });
  expect(result.nativeResult).toEqual({grabbed:'12.5',value:'20',events:[['input','20'],['change','20']]});
  expect(result.snapshot.size).toEqual([48,16]);
  expect(result.snapshot.pixels).toEqual(expectedPlane({orientation:'horizontal',value:0}));
  expect(result.snapshot.calls).toContain(result.snapshot.original);
  expect(result.snapshot.code).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
});

test('source: pinned provider identities, actual decode URLs and typed corner selections join complete planes',async({page,servers})=>{
  await setup(page,servers,'source');
  const result=await page.evaluate(async pins=>{
    const {api}=window.declaredSlider;
    const {endpointFork,endpointProvider}=await import('/tests/decoder-fixtures/slider-endpoints.mjs');
    const {snapshotSliderEnvironment}=await import('/src/engine/resources/sliderEnvironment.ts');
    const {displayPolicy}=await import('/tools/theme-loader/display-profile.js');
    const env=await api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'layout',complete:true,bytes:endpointProvider(3)}]});
    const theme=await api.loadKaleidoscopeScheme(endpointFork(),{provenance:true,sliderLayoutEnvironment:env});
    const calls=[],rows=[],decode=HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
    try {for(const pin of pins){const options=pin.options,out=await api.composeSlider(theme,options);rows.push({...options,options,size:[out.width,out.height],pixels:Array.from(out.data)});}}
    finally{HTMLImageElement.prototype.decode=decode;}
    const cornerRoles=['horizontal','vertical'].map(orientation=>{
      const {corner,attempts,selected}=snapshotSliderEnvironment(theme,orientation);return {orientation,corner,attempts,selected};
    });
    const result={baseInputs:[],displayPolicy:displayPolicy(theme.manifest.displayProfile),providerData:env,
      layoutEnvironment:theme.manifest.sliderLayoutEnvironment,provenance:theme.byteProvenance,
      thumbEntries:Object.entries(theme.manifest.chromeElements).filter(([,e])=>[-10129,-10113].includes(e.sourceCicnId)),rows,calls,cornerRoles};
    theme.dispose();return result;
  },sliderPins.cases);
  expect(verifySliderRows(result)).toEqual(sliderPins.cases.map(p=>p.id));
});

// Original blocking finding, retained through the separately authored repair.
for(const mode of ['source','built']) test(`${mode}: whole declared environment rejects an unqueried incomplete tail`,async({page,servers})=>{
  await setup(page,servers,mode);
  const result=await page.evaluate(async()=>{
    const {api,f,load}=window.declaredSlider;
    // Empty base payloads satisfy presence-only G1. A supplies EVERY actual
    // cinf request, so a lazy per-query completeness check never reaches B.
    const complete=f.provider('complete',[...f.declaredEntries(),f.cinf(-10144,[]),f.cinf(-10128,[])]);
    const control=await load([complete]),positive=await api.composeSlider(control,{length:48,value:0});
    const unknown=f.provider('unqueried-incomplete',f.declaredEntries({corner:4}),false);
    const theme=await load([complete,unknown]);let code=null;
    try{await api.composeSlider(theme,{length:48,value:0});}catch(e){code=e.code;}
    const result={positive:Array.from(positive.data),code};theme.dispose();control.dispose();return result;
  });
  expect(result.positive,'POSITIVE_CONTROL complete declaration').toEqual(expectedPlane({orientation:'horizontal',value:0}));
  expect(result.code,'DECLARATION_WIDE_COMPLETENESS').toBe('UNSUPPORTED_CINF_ENVIRONMENT');
});

for(const mode of ['source','built']) test(`${mode}: declared zero travel remains admitted and inert`,async({page,servers})=>{
  await setup(page,servers,mode);
  const result=await page.evaluate(async()=>{
    const {api,f,load}=window.declaredSlider,theme=await load([f.provider('zero-travel',f.declaredEntries({corner:13}))]);
    const rows=[];
    for(const orientation of ['horizontal','vertical'])for(const value of [0,1]){
      const out=await api.composeSlider(theme,{orientation,length:33,value});rows.push({orientation,pixels:Array.from(out.data)});
    }
    const changes=[],el=await api.interactiveSlider(theme,{length:33,value:.25,onChange:v=>changes.push(v)});document.body.append(el);
    const r=el.querySelector('canvas').getBoundingClientRect();
    const fire=(target,type,x)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:61,clientX:r.left+x,clientY:r.top+8,button:0}));
    fire(el,'pointerdown',3);fire(window,'pointermove',30);fire(window,'pointerup',30);
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);el.remove();theme.dispose();return {rows,changes};
  });
  for(const row of result.rows){
    const vertical=row.orientation==='vertical',expected=Array.from({length:33*16},(_,i)=>{
      const x=i%(vertical?16:33),y=Math.floor(i/(vertical?16:33)),axis=vertical?y:x,cross=vertical?x:y;
      return axis>=13&&axis<20?red:cross>=6&&cross<9?grooveColors[('R'+'GBWKY'.repeat(7).slice(0,31)+'C')[axis]]:white;
    }).flat();
    expect(row.pixels).toEqual(expected);
  }
  expect(result.changes).toEqual([]);
});
