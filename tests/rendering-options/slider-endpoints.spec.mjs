import {sliderPins} from '../rendering-requirements/slider-cases.mjs';
import {createHash} from 'node:crypto';
import {test,expect,openHarness,attachCase,attachObservations} from './fixtures.mjs';
import {endpointColors,endpointFork,endpointProvider,endpointIcon} from '../decoder-fixtures/slider-endpoints.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
// Declared group2 slider layout (docs/spec/slider-layout-cinf.md) on the v2 slider engine (docs/spec/engine/slider.md).
//
// 1. The pinned ledger fork (endpointFork: track -10131/-10115 with cinf, thumbs -10129/-10113) ships NO slider
//    gate cinf (-10144/-10128, or -10132/-10116 with variation bit 3). The declared resource chain is the archive's
//    own fork then its base chain (slider.md §2 declared defaults), so the gate hands off (G1/G2, §4.1, #407 S1):
//    without a layout environment composeSlider returns null; with one, the declared role cannot be honoured and
//    the composer rejects explicitly (slider-layout-cinf.md: unsupported results raise UNSUPPORTED_CINF_ENVIRONMENT,
//    never silent geometry).
// 2. A gated twin of that fork adds its own -10132/-10116 cinf (corner byte = the declared corner) and a same-id
//    inactive-track cicn. CDEF 3 then draws it: Th per §5.2 (c + trunc((L − t − 2c)·offset/range), vertical
//    minimum at the bottom), cells 1 normal / 2 pressed / 0 disabled (TH3), R erased opaque to the default white
//    background (BG5, BG6). The pointer, keyboard, snapshot and native checks run on this twin.
// 3. Declared-role guards (slider-layout-cinf.md; REVIEW-416-419 B1): when the fork's own corner (5) differs from the
//    declared corner (3), the declared input cannot be honoured, so the composer rejects with
//    UNSUPPORTED_CINF_ENVIRONMENT rather than silently drawing either corner; and a thumb whose cross-cell is not
//    exactly 16 px is rejected (the documented admission), although CDEF 3 itself reads 16-px cells (TH3).
const cell=state=>state==='pressed'?2:state==='disabled'?0:1;
for(const mode of ['source','built']) test(`${mode}: declared group2 slider endpoints and committed input mapping`,async({page,servers},info)=>{
  test.info().annotations.push({type:'fidelity-assertion',description:'slider.declared-group2-endpoints'});
  await openHarness(page,servers,mode);let result;
  try {
    result=await page.evaluate(async({mode,pinned})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {endpointFork,endpointProvider,endpointIcon}=await import('/tests/decoder-fixtures/slider-endpoints.mjs');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const environment=async corner=>api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'layout',complete:true,bytes:endpointProvider(corner)}]});
      // The gated twin: endpointFork's six resources in the same order (so resource indices match), then the gate/corner cinf.
      const gatedFork=({corner=3,cross=16,thumb=true,along=7}={})=>{
        const entries=[],gates=[];
        for(const vertical of [false,true]){
          const id=vertical?-10115:-10131;
          entries.push({type:'cicn',id,data:endpointIcon(vertical)},{type:'cinf',id,data:new Uint8Array([1,1,1,...Array(15).fill(0)])});
          if(thumb)entries.push({type:'cicn',id:id+2,data:endpointIcon(vertical,true,cross,along)});
          gates.push({type:'cicn',id:id-1,data:endpointIcon(vertical)},{type:'cinf',id:id-1,data:new Uint8Array([corner,1,1,...Array(15).fill(0)])});
        }
        return forkOf([...entries,...gates]);
      };
      const load=async(corner=3,options={},declared=corner)=>api.loadKaleidoscopeScheme(gatedFork({corner,...options}),{provenance:true,sliderLayoutEnvironment:await environment(declared)});
      const declared=await environment(3);
      // 1. The pinned ledger inputs: hand-off.
      const pinnedTheme=await api.loadKaleidoscopeScheme(endpointFork(),{provenance:true,sliderLayoutEnvironment:declared}),pinnedPlain=await api.loadKaleidoscopeScheme(endpointFork(),{provenance:true});
      const pinnedRows=[];
      for(const options of pinned){
        let code=null,returned;try{returned=await api.composeSlider(pinnedTheme,options);}catch(e){code=e.code;}
        pinnedRows.push({options,code,returnedNothing:returned===undefined,plainNull:(await api.composeSlider(pinnedPlain,options))===null});
      }
      const pinnedThumbs=Object.values(pinnedTheme.manifest.chromeElements).filter(e=>e.sliderLayoutCinf).map(e=>({id:e.sourceCicnId,status:e.sliderLayoutCinf.status,corner:e.sliderLayoutCinf.corner}));
      const pinnedFork=pinnedTheme.byteProvenance.fork.sha256;
      pinnedTheme.dispose();pinnedPlain.dispose();
      // 2. The gated twin.
      const theme=await api.loadKaleidoscopeScheme(gatedFork(),{provenance:true,sliderLayoutEnvironment:declared}),plain=await api.loadKaleidoscopeScheme(gatedFork(),{provenance:true});
      const rows=[],calls=[],decode=HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
      for(const orientation of ['horizontal','vertical'])for(const state of ['normal','pressed','disabled'])for(const value of [0,.5,1]) {
        const options={orientation,state,length:48,value},out=await api.composeSlider(theme,options);
        rows.push({orientation,state,value,options,size:[out.width,out.height],pixels:Array.from(out.data)});
      }
      HTMLImageElement.prototype.decode=decode;
      const quarterTheme=await load(2,{along:10}),quarters=[];
      for(const orientation of ['horizontal','vertical'])for(const value of [0,.25,1]) {
        const out=await api.composeSlider(quarterTheme,{orientation,length:80,value});quarters.push({orientation,value,pixels:Array.from(out.data)});
      }
      quarterTheme.dispose();
      const defaults=[];
      for(const orientation of ['horizontal','vertical'])for(const value of [0,1]) {
        const out=await api.composeSlider(plain,{orientation,length:48,value});defaults.push({orientation,value,pixels:Array.from(out.data)});
      }
      const errors=[];
      for(const [label,corner,options,length] of [['negative-travel',14,{},32],['cross-large',3,{cross:17},48],['cross-small',3,{cross:15},48],['missing-thumb',3,{thumb:false},48],['length-range',3,{},32768]]) {
        const t=await load(corner,options);try{await api.composeSlider(t,{length});errors.push({label,code:null});}catch(e){errors.push({label,code:e.code,message:e.message});}finally{t.dispose();}
      }
      theme.base=plain;let baseCode;try{await api.composeSlider(theme);}catch(e){baseCode=e.code;}delete theme.base;
      const zero=await load(13);const zeroPixels=Array.from((await api.composeSlider(zero,{length:33,value:1})).data);zero.dispose();
      // 3. Fork corner 5, declared corner 3.
      const conflict=await load(5,{},3);let conflictCode=null,conflictMessage=null;try{await api.composeSlider(conflict,{length:48,value:0});}catch(e){conflictCode=e.code;conflictMessage=e.message;}
      const conflictRole=Object.values(conflict.manifest.chromeElements).find(e=>e.sourceCicnId===-10129).sliderLayoutCinf;conflict.dispose();
      const inputs=[];
      const fire=(el,type,x,y,id=11)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:id,button:0}));
      for(const orientation of ['horizontal','vertical']) {
        const changes=[],el=await api.interactiveSlider(theme,{orientation,length:48,value:0,scale:2,onChange:v=>changes.push(v)});document.body.append(el);
        const rect=()=>el.querySelector('canvas').getBoundingClientRect();
        const point=axis=>{const r=rect();return orientation==='horizontal'?[r.left+axis*2,r.top+16]:[r.left+16,r.top+axis*2];};
        // Grab away from center: no jump, then drag one complete admitted travel.
        const start=orientation==='horizontal'?4:39;
        fire(el,'pointerdown',...point(start));fire(window,'pointermove',...point(start+(orientation==='horizontal'?35:-35)));fire(window,'pointerup',...point(start+(orientation==='horizontal'?35:-35)));
        await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
        const drag=changes.slice();changes.length=0;
        // Click the minimum endpoint center (spatial reversal for vertical).
        fire(el,'pointerdown',...point(orientation==='horizontal'?6.5:41.5));fire(window,'pointerup',...point(orientation==='horizontal'?6.5:41.5));
        el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
        inputs.push({orientation,drag,afterClickAndKey:changes.slice()});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);el.remove();
      }
      // Pause the first actual image decode; argument/asset mutations after
      // invocation must not redirect the already-admitted thumb preparation.
      const snapTheme=await load(),snapThumb=Object.values(snapTheme.manifest.chromeElements).find(e=>e.sourceCicnId===-10129);
      const originalAsset=snapThumb.asset,snapCalls=[];let release,entered;
      const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
      HTMLImageElement.prototype.decode=function(){const pending=decode.call(this);snapCalls.push(this.src);if(snapCalls.length===1){entered();return pending.then(()=>gate);}return pending;};
      const options={orientation:'horizontal',length:48,value:0},pending=api.composeSlider(snapTheme,options);
      await started;options.orientation='vertical';options.value=1;options.length=99;snapThumb.asset='not-the-admitted-thumb';release();
      const snapOut=await pending;HTMLImageElement.prototype.decode=decode;
      let transplantCode;try{await api.composeSlider(snapTheme);}catch(e){transplantCode=e.code;}
      const snapshot={size:[snapOut.width,snapOut.height],pixels:Array.from(snapOut.data),originalAsset,calls:snapCalls,transplantCode};snapTheme.dispose();
      const root=document.createElement('section');document.body.append(root);
      const handle=await api.mountDeclarative({root,pageThemeDefault:'endpoint',bootAffordance:'none'});handle.registerTheme('endpoint',theme);
      const form=document.createElement('form');form.innerHTML='<input type="range" min="10" max="20" step=".25" value="12.5" aria-label="Endpoint range">';root.append(form);
      for(let i=0;i<120&&!root.querySelector('.scriptoscope-slider canvas');i++)await new Promise(requestAnimationFrame);
      const face=root.querySelector('.scriptoscope-slider'),native=form.querySelector('input'),events=[];
      if(!face?.querySelector('canvas'))throw new Error('Native endpoint face did not commit');
      native.addEventListener('input',()=>events.push(['input',native.value]));native.addEventListener('change',()=>events.push(['change',native.value]));
      const r=face.querySelector('canvas').getBoundingClientRect();
      // At v=.25 the native face (length 120, c 3, t 7: T 107) starts its thumb at 3 + trunc(107·25/100) = 29;
      // grabbing its left interior must keep 12.5, then 107 backing pixels of travel clamp at the native maximum.
      fire(face,'pointerdown',r.left+31,r.top+8);const grabbed=native.value;
      fire(window,'pointermove',r.left+138,r.top+8);fire(window,'pointerup',r.left+138,r.top+8);
      const nativeResult={grabbed,value:native.value,events};handle.disconnect();root.remove();
      const provenance=theme.byteProvenance,thumbs=Object.values(theme.manifest.chromeElements).filter(e=>e.sliderLayoutCinf);
      theme.dispose();plain.dispose();
      return {pinnedRows,pinnedThumbs,pinnedFork,rows,defaults,errors,zeroPixels,conflictCode,conflictMessage,conflictRole:{status:conflictRole.status,corner:conflictRole.corner},inputs,nativeResult,provenance,thumbs,calls,snapshot,baseCode,quarters};
    },{mode,pinned:sliderPins.cases.map(p=>p.options)});
    // 1. Pinned ledger inputs: G2 hand-off; the declared role is admitted but cannot be drawn, and is rejected explicitly.
    expect(result.pinnedFork).toBe(sha(endpointFork()));
    expect(result.pinnedThumbs).toEqual([{id:-10129,status:'ready',corner:3},{id:-10113,status:'ready',corner:3}]);
    expect(result.pinnedRows.map(r=>[r.code,r.returnedNothing,r.plainNull])).toEqual(Array(6).fill(['UNSUPPORTED_CINF_ENVIRONMENT',true,true]));
    // 2. The gated twin.
    expect(result.rows).toHaveLength(18);
    const white=[255,255,255,255];
    const expected=(vertical,pos,state,length=48,extent=7)=>Array.from({length:length*16},(_,i)=>{
      const x=i%(vertical?16:length),y=Math.floor(i/(vertical?16:length)),axis=vertical?y:x,cross=vertical?x:y;
      return axis>=pos&&axis<pos+extent?endpointColors[cell(state)]:cross>=6&&cross<9?endpointColors[4]:white;
    }).flat();
    // §5.2 with c 3, t 7, L 48: T 35 -> starts 3, 20, 38 (vertical 38, 20, 3).
    for(const row of result.rows){const vertical=row.orientation==='vertical';expect(row.size).toEqual(vertical?[16,48]:[48,16]);expect(row.pixels,`${row.orientation}/${row.state}/${row.value}`).toEqual(expected(vertical,(vertical?[38,20,3]:[3,20,38])[[0,.5,1].indexOf(row.value)],row.state));}
    // c 2, t 10, L 80: T 66 -> 2, 18, 68 (vertical 68, 51, 2).
    for(const row of result.quarters){const v=row.orientation==='vertical';expect(row.pixels).toEqual(expected(v,(v?[68,51,2]:[2,18,68])[[0,.25,1].indexOf(row.value)],'normal',80,10));}
    // No layout environment: the same CDEF 3 geometry from the fork's own corner cinf (ID6).
    for(const row of result.defaults)expect(row.pixels).toEqual(expected(row.orientation==='vertical',row.value?(row.orientation==='vertical'?3:38):(row.orientation==='vertical'?38:3),'normal'));
    expect(result.baseCode).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
    // c 13, t 7, L 33: T 0 -> the thumb at 13.
    expect(result.zeroPixels).toEqual(expected(false,13,'normal',33));
    // slider-layout-cinf.md admission: negative travel, a 17- or 15-px thumb cross-cell (the exact-16-pixel rule), a
    // missing thumb and a length outside the local Rect each reject explicitly.
    expect(result.errors.map(x=>[x.label,x.code])).toEqual(['negative-travel','cross-large','cross-small','missing-thumb','length-range'].map(l=>[l,'UNSUPPORTED_CINF_ENVIRONMENT']));
    for(const x of result.errors.filter(x=>x.label.startsWith('cross-')))expect(x.message,x.label).toMatch(/thumb cross-cell is not 16 px/);
    for(const row of result.inputs){expect(row.drag).toEqual([1]);expect(row.afterClickAndKey).toEqual([0,.05]);}
    expect(result.snapshot.size).toEqual([48,16]);expect(result.snapshot.pixels).toEqual(expected(false,3,'normal'));expect(result.snapshot.calls).toContain(result.snapshot.originalAsset);expect(result.snapshot.transplantCode).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
    expect(result.nativeResult).toEqual({grabbed:'12.5',value:'20',events:[['input','20'],['change','20']]});
    expect(result.thumbs).toHaveLength(2);
    for(const e of result.thumbs){const vertical=e.sourceCicnId===-10113;expect(result.calls).toContain(e.asset);expect(result.provenance.resources[e.byteProvenance.cicnResourceIndex]).toMatchObject({resourceIndex:vertical?5:2,type:'cicn',signedId:vertical?-10113:-10129,status:'decoded',sha256:sha(endpointIcon(vertical,true))});expect(e.sliderLayoutCinf).toMatchObject({status:'ready',corner:3,selected:{providerId:'layout',forkSha256:sha(endpointProvider()),byteLength:1,sha256:sha(new Uint8Array([3])),occurrence:vertical?1:0,signedId:vertical?-10116:-10132}});expect(e.byteProvenance.loadId).toBe(result.provenance.loadId);}
    // 3. The declared role reports corner 3; the fork's own corner 5 differs, so the composition is rejected (B1).
    expect(result.conflictRole).toEqual({status:'ready',corner:3});
    expect(result.conflictCode).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
    expect(result.conflictMessage).toMatch(/declared corner differs from the resource-chain corner/);
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'slider-endpoints',mode,{mode,...result,inputSha256:sha(endpointFork()),claim:'Pinned declared-group2 fork hands off (G2) and is rejected explicitly; a gated twin draws CDEF 3 geometry (§5.2, TH3, BG6); normalized pointer/keyboard policy; a differing declared corner and a non-16-px thumb cross-cell rejected'});
});
