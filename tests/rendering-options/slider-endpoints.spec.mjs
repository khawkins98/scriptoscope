import {createHash} from 'node:crypto';
import {test,expect,openHarness,attachCase,attachObservations} from './fixtures.mjs';
import {endpointColors,endpointFork,endpointProvider,endpointIcon} from '../decoder-fixtures/slider-endpoints.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const mode of ['source','built']) test(`${mode}: declared group2 slider endpoints and committed input mapping`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try {
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {endpointFork,endpointProvider}=await import('/tests/decoder-fixtures/slider-endpoints.mjs');
      const environment=async corner=>api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'layout',complete:true,bytes:endpointProvider(corner)}]});
      const load=async(corner=3,options={})=>api.loadKaleidoscopeScheme(endpointFork(options),{provenance:true,sliderLayoutEnvironment:await environment(corner)});
      const theme=await load(),plain=await api.loadKaleidoscopeScheme(endpointFork(),{provenance:true});
      const rows=[],calls=[],decode=HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
      for(const orientation of ['horizontal','vertical'])for(const state of ['normal','pressed','disabled'])for(const value of [0,.5,1]) {
        const out=await api.composeSlider(theme,{orientation,state,length:48,value});
        rows.push({orientation,state,value,size:[out.width,out.height],pixels:Array.from(out.data)});
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
        const t=await load(corner,options);try{await api.composeSlider(t,{length});errors.push({label,code:null});}catch(e){errors.push({label,code:e.code});}finally{t.dispose();}
      }
      theme.base=plain;let baseCode;try{await api.composeSlider(theme);}catch(e){baseCode=e.code;}delete theme.base;
      const zero=await load(13);const zeroPixels=Array.from((await api.composeSlider(zero,{length:33,value:1})).data);zero.dispose();
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
      // At v=.25 the truncated thumb starts29; grabbing its left interior must
      // keep12.5, then107 backing pixels of travel clamp at the native maximum.
      fire(face,'pointerdown',r.left+31,r.top+8);const grabbed=native.value;
      fire(window,'pointermove',r.left+138,r.top+8);fire(window,'pointerup',r.left+138,r.top+8);
      const nativeResult={grabbed,value:native.value,events};handle.disconnect();root.remove();
      const provenance=theme.byteProvenance,thumbs=Object.values(theme.manifest.chromeElements).filter(e=>e.sliderLayoutCinf);
      theme.dispose();plain.dispose();
      return {rows,defaults,errors,zeroPixels,inputs,nativeResult,provenance,thumbs,calls,snapshot,baseCode,quarters};
    },mode);
    expect(result.rows).toHaveLength(18);
    const expected=(vertical,pos,state,length=48,extent=7)=>Array.from({length:length*16},(_,i)=>{
      const x=i%(vertical?16:length),y=Math.floor(i/(vertical?16:length)),axis=vertical?y:x,cross=vertical?x:y;
      return axis>=pos&&axis<pos+extent?endpointColors[state==='pressed'?2:state==='disabled'?3:1]:cross>=6&&cross<9?endpointColors[4]:[0,0,0,0];
    }).flat();
    for(const row of result.rows){const vertical=row.orientation==='vertical';expect(row.size).toEqual(vertical?[16,48]:[48,16]);expect(row.pixels).toEqual(expected(vertical,(vertical?[38,20,3]:[3,20,38])[[0,.5,1].indexOf(row.value)],row.state));}
    for(const row of result.quarters){const v=row.orientation==='vertical';expect(row.pixels).toEqual(expected(v,(v?[68,51,2]:[2,18,68])[[0,.25,1].indexOf(row.value)],'normal',80,10));}
    for(const row of result.defaults)expect(row.pixels).toEqual(expected(row.orientation==='vertical',row.value?41:0,'normal'));
    expect(result.baseCode).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
    expect(result.zeroPixels).toEqual(expected(false,13,'normal',33));
    expect(result.errors.map(x=>x.code)).toEqual(Array(5).fill('UNSUPPORTED_CINF_ENVIRONMENT'));
    for(const row of result.inputs){expect(row.drag).toEqual([1]);expect(row.afterClickAndKey).toEqual([0,.05]);}
    expect(result.snapshot.size).toEqual([48,16]);expect(result.snapshot.pixels).toEqual(expected(false,3,'normal'));expect(result.snapshot.calls).toContain(result.snapshot.originalAsset);expect(result.snapshot.transplantCode).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
    expect(result.nativeResult).toEqual({grabbed:'12.5',value:'20',events:[['input','20'],['change','20']]});
    expect(result.provenance.fork.sha256).toBe(sha(endpointFork()));
    expect(result.thumbs).toHaveLength(2);
    for(const e of result.thumbs){const vertical=e.sourceCicnId===-10113;expect(result.calls).toContain(e.asset);expect(result.provenance.resources[e.byteProvenance.cicnResourceIndex]).toMatchObject({resourceIndex:vertical?5:2,type:'cicn',signedId:vertical?-10113:-10129,status:'decoded',sha256:sha(endpointIcon(vertical,true))});expect(e.sliderLayoutCinf).toMatchObject({status:'ready',corner:3,selected:{providerId:'layout',forkSha256:sha(endpointProvider()),byteLength:1,sha256:sha(new Uint8Array([3])),occurrence:vertical?1:0,signedId:vertical?-10116:-10132}});expect(e.byteProvenance.loadId).toBe(result.provenance.loadId);}
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'slider-endpoints',mode,{...result,inputSha256:sha(endpointFork()),claim:'Declared group-base endpoint geometry; normalized pointer/keyboard policy, not original range/provider or transfer certification'});
});
