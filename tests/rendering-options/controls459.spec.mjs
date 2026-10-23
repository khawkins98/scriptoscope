// Independent rule-based checks of public composition; source/built parity is
// regression evidence only. Native glyphs/device/provider equivalence UNKNOWN.
import { test,expect,openHarness,attachObservations } from './fixtures.mjs';
import { selection,face,ring } from './controls459-rules.mjs';
import { readFileSync } from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../../demo/themes-manifest.json',import.meta.url)));
for(const mode of ['source','built'])test(`${mode}: independent 459 public composition and typed selection corpus`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);
  const observations=await page.evaluate(async({mode,catalog})=>{
    const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts'),out=[];
    for(const {slug} of catalog) {
      const theme=await api.loadTheme(`/themes/${slug}`);
      try {
        for(const disabled of [false,true])for(const pressed of [false,true])for(const def of [false,true]) {
          const diagnostics=[];
          const result=await api.composeButton(theme,{disabled,pressed,default:def,minWidth:57,height:21,diagnostics:{onComplete:x=>diagnostics.push(x)}});
          out.push({slug,family:'push',disabled,pressed,def,size:result?[result.width,result.height]:null,layout:diagnostics[0]?.composition,diagnostics});
        }
        for(const kind of ['checkbox','radio'])for(const disabled of [false,true])for(const value of [0,1,2]) {
          let trace;let result,error;
          try{result=await api.composeCheckable(theme,kind,{disabled,checked:value===1||value===2,mixed:value===2,onTrace:t=>{trace=t;}});}catch(e){error=String(e.message);}
          out.push({slug,family:'check',kind,disabled,value,size:result?[result.width,result.height]:null,error,trace});
        }
      } finally {theme.dispose?.();}
    }
    return out;
  },{mode,catalog});
  const failures=[];
  for(const row of observations) {
    if(row.family==='push') {
      const h=row.disabled?255:row.pressed?1:0;
      const records=row.diagnostics.flatMap(d=>d.steps??[]);
      // Public dimensions and logical-face allocation policy: reserve 4 on all
      // sides when ring resources exist (all 18 corpus forks have ring cicns).
      if(JSON.stringify(row.size)!==JSON.stringify([65,29]))failures.push({row,why:'push allocation'});
      if(JSON.stringify(row.layout?.faceRect)!==JSON.stringify({x:0,y:0,w:57,h:21}))failures.push({row,why:'logical face layout'});
      const typed=records.filter(r=>/^engine:[^:]+:cicn:/.test(r.reason));
      if(typed[0]?.requestedId!==face(h))failures.push({row,why:'push signed face selection'});
      const rings=typed.slice(1).map(r=>r.requestedId);
      const expectedRings=row.def?(h===1?[-10230,-10231]:ring(h)):[];
      if(JSON.stringify(rings)!==JSON.stringify(expectedRings))failures.push({row,why:'ring request order'});
      row.expectedFace=face(h);row.expectedRing=row.def?ring(h):[];row.resolutions=records;
    } else {
      const s=selection({variation:row.kind==='checkbox'?1:2,hilite:row.disabled?255:0,value:row.value,acidAlternate:false});
      const requests=row.trace?.resolved??[],cicns=requests.filter(r=>r.type==='cicn');
      if(cicns[0]?.id!==s.cicns[0])failures.push({row,why:'first cicn'});
      for(let i=0;i<cicns.length;i++)if(cicns[i].id!==s.cicns[i])failures.push({row,why:'cicn retry'});
      const icons=requests.filter(r=>r.type==='ics#');
      if(icons.length) {
        if(icons[0].id!==s.icons[0])failures.push({row,why:'original value/icon tier'});
        const selected=icons.find(r=>r.found);
        if(selected&&icons.at(-1).id!==selected.id)failures.push({row,why:'helper mask re-request'});
        for(const request of requests.filter(r=>r.type==='ics8'))if(request.id!==icons.at(-1).id)failures.push({row,why:'same mask colour ID'});
      }
      if(row.error)failures.push({row,why:'public composition error'});
    }
  }
  await attachObservations(info,'controls459',mode,{mode,observations,failures,unknown:['native glyph/device/provider equivalence','native final CR glyphs','original font metrics']});
  expect(failures.map(f=>({slug:f.row.slug,family:f.row.family,why:f.why,error:f.row.error}))).toEqual([]);expect(observations).toHaveLength(18*20);
});
for(const mode of ['source','built'])test(`${mode}: independent declared body environment identity, explicit NULL and preparation boundaries`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);
 const observed=await page.evaluate(async mode=>{
  const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
  const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
  const {solidBackgroundIcon,solidBackgroundInfo}=await import('/tests/decoder-fixtures/solid-background.mjs');
  const source=forkOf([{type:'cicn',id:-10239,name:'face',data:solidBackgroundIcon()},{type:'cinf',id:-10239,data:solidBackgroundInfo({background:[0,0],resourceId:77})}]);
  const external=forkOf([{type:'cinf',id:0,data:solidBackgroundInfo()}]);
  const env=await api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'independent-default',complete:true,bytes:external},{kind:'theme-fork',id:'actual',complete:true}]});
  // Exact face metadata wins before the later provider; omit the theme marker
  // for the fallback-zero case, making its NULLs explicitly declared.
  const fallbackEnv=await api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'independent-default',complete:true,bytes:external}]});
  const theme=await api.loadKaleidoscopeScheme(source,{cinfEnvironment:fallbackEnv});
  theme.manifest.patterns={poison:{sourcePpatId:77,asset:'invalid:unnecessary-local-body'}};
  const decode=HTMLImageElement.prototype.decode,requests=[];
  HTMLImageElement.prototype.decode=async function(){requests.push(this.src);if(this.src.startsWith('invalid:'))throw Error('unnecessary raw cinf body preload');return decode.call(this);};
  const draw=async(owner,opts={})=>{try{let trace;const p=await api.composeButton(owner,{label:'',minWidth:29,height:9,...opts,diagnostics:{onComplete:t=>{trace=t;}}});return{pixels:p?[...p.data]:null,trace};}catch(e){return{error:{name:e.name,code:e.code,message:e.message}};}};
  const result={};
  try{
   result.good=await draw(theme);result.view=theme.manifest.chromeElements.face.bodyCinf;
   const font=await api.prepareBitmapFont({version:1,strikeSize:12,metrics:{ascent:7,descent:2,leading:1},provenance:{kind:'caller-declared',description:'Independent one-pixel glyph; no native font equivalence'},glyphs:[{character:'A',advance:3,bearingX:0,bearingY:0,width:1,height:1,mask:[1]}]});
   const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=()=>{throw Error('bitmap used browser glyphs');};
   try{result.bitmap=await draw(theme,{bitmapFont:font,label:'A'});}finally{CanvasRenderingContext2D.prototype.fillText=fill;}
   result.browser=await draw(theme,{label:'A'});
   const channel=Array.from({length:256},(_,i)=>i);
   const profile=await api.prepareDisplayProfile({version:1,conditions:{kind:'independent finite restriction'},evidence:[{sha256:'0'.repeat(64),description:'Synthetic policy boundary'}],producer:{model:'rgb16-high-byte-table',channels:[channel,channel,channel]},devicePalette:[{index:0,rgb16:[0,0,0]}],mappings:[{rgb16:[0,0,0],deviceIndex:0,deviceRgb16:[0,0,0]}]});
   theme.manifest.displayProfile=profile;result.display=await draw(theme);delete theme.manifest.displayProfile;
   result.default=await draw(theme,{default:true});result.base=await draw({...theme,base:theme});
   const identity=theme.manifest.cinfEnvironment;theme.manifest.cinfEnvironment={...identity};result.identity=await draw(theme);theme.manifest.cinfEnvironment=identity;
   const noEnv=await api.prepareCinfEnvironment({version:1,complete:true,providers:[]});
   const nullTheme=await api.loadKaleidoscopeScheme(source,{cinfEnvironment:noEnv});try{result.nulls=await draw(nullTheme);result.nullView=nullTheme.manifest.chromeElements.face.bodyCinf;}finally{nullTheme.dispose();}
   const mode5=await api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'raw-fork',id:'mode5',complete:true,bytes:forkOf([{type:'cinf',id:-10239,data:solidBackgroundInfo({mode:5})}])}]});
   const five=await api.loadKaleidoscopeScheme(source,{cinfEnvironment:mode5});try{result.mode5=await draw(five);}finally{five.dispose();}
   result.requests=requests;result.environmentId=fallbackEnv.id;result.unusedEnvironmentId=env.id;
   return result;
  }finally{HTMLImageElement.prototype.decode=decode;theme.dispose();}
 },mode);
 const expected=Array(29*9*4).fill(0);const set=(x,y,rgb)=>{expected.splice((y*29+x)*4,4,...rgb,255);};
 // QD R1=(3,1,23,7), R2=(1,3,27,3); blue opaque TL source corner.
 for(let y=0;y<9;y++)for(let x=0;x<29;x++)if((x>=3&&x<26&&y>=1&&y<8)||(x>=1&&x<28&&y>=3&&y<6))set(x,y,[48,48,48]);set(0,0,[0,0,255]);
 expect(observed.good.error).toBeUndefined();expect(observed.good.pixels).toEqual(expected);
 expect(observed.view.environmentId).toBe(observed.environmentId);expect(observed.view.selected.signedId).toBe(0);expect(observed.view.selected.providerId).toBe('independent-default');
 expect(observed.nulls.pixels).toEqual(Array(29*9*4).fill(0));expect(observed.nullView.attempts.map(a=>[a.id,a.outcome])).toEqual([[-10239,'missing'],[0,'missing']]);
 const bitmapExpected=expected.slice();bitmapExpected.splice((5*29+13)*4,4,0,0,255,255);expect(observed.bitmap.error).toBeUndefined();expect(observed.bitmap.pixels).toEqual(bitmapExpected);expect(observed.bitmap.trace.bitmapTextPaint.pen).toEqual([13,5]);
 expect(observed.browser.error).toBeUndefined();expect(observed.browser.trace.bitmapTextPaint).toBeUndefined();expect(observed.browser.trace.textColors.foreground).toBe('rgb(0, 0, 255)');
 for(const boundary of ['default','base','identity','mode5','display'])expect(observed[boundary].error.code).toBe('UNSUPPORTED_CINF_ENVIRONMENT');
 expect(observed.requests.some(p=>p.startsWith('invalid:'))).toBe(false);
 await attachObservations(info,'controls459-declared',mode,{mode,observed,unknown:['native glyph/device/provider equivalence','original resource file ownership']});
});
for(const mode of ['source','built'])test(`${mode}: public typed duplicate art retains an ambiguity diagnostic`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);
 const observed=await page.evaluate(async mode=>{
  const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
  const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
  const {solidBackgroundIcon,solidBackgroundInfo}=await import('/tests/decoder-fixtures/solid-background.mjs');
  const entries=[{type:'cicn',id:-10239,name:'face',data:solidBackgroundIcon()},{type:'cinf',id:-10239,data:solidBackgroundInfo()}];
  const ringEntries=[...entries,{type:'cicn',id:-10231,name:'ring',data:solidBackgroundIcon()},{type:'cinf',id:-10231,data:solidBackgroundInfo()}];
  const observe=async duplicate=>{const isRing=typeof duplicate==='string'&&duplicate.startsWith('ring');const selected=duplicate==='ring-unknown'?[...ringEntries,{type:'cicn',id:-10231,name:'duplicate-ring',data:solidBackgroundIcon()}]:duplicate==='ring-valid'?ringEntries:isRing?entries:duplicate==='null'?entries.filter(e=>e.type!=='cicn'):duplicate?[...entries,{type:'cicn',id:-10239,name:'duplicate',data:solidBackgroundIcon()}]:entries;const theme=await api.loadKaleidoscopeScheme(forkOf(selected));try{let trace,error;let output;try{output=await api.composeButton(theme,{label:'',minWidth:17,height:9,default:isRing,diagnostics:{onComplete:t=>trace=t}});}catch(e){error={name:e.name,message:e.message};}return{trace,error,opaque:output?[...output.data].filter((v,i)=>i%4===3&&v!==0).length:null};}finally{theme.dispose();}};
  return{positive:await observe(false),null:await observe('null'),duplicate:await observe(true),ringPositive:await observe('ring-valid'),ringNull:await observe('ring-null'),ringDuplicate:await observe('ring-unknown')};
 },mode);
 expect(observed.positive.error).toBeUndefined();expect(observed.positive.opaque).toBeGreaterThan(0);
 expect(observed.null.error).toBeUndefined();expect(observed.null.opaque).toBeNull();expect(observed.null.trace.outcome.status).toBe('unavailable');
 // Duplicate raw ownership is not proven NULL and cannot silently become a
 // successful blank paint. Diagnostic field spelling remains unconstrained.
 const visible=row=>[row.error?.message,row.trace?.outcome?.reason,...(row.trace?.steps??[]).map(s=>s.reason)].filter(Boolean).join('\n');
 expect(observed.ringPositive.error).toBeUndefined();expect(observed.ringPositive.opaque).toBeGreaterThan(0);expect(observed.ringNull.error).toBeUndefined();expect(observed.ringNull.opaque).toBeGreaterThan(0);
 await attachObservations(info,'controls459-public-unknown',mode,{mode,observed,unknown:['native malformed-resource pixels']});
 expect.soft(visible(observed.duplicate)).toMatch(/ambiguous/i);
 expect(visible(observed.ringDuplicate)).toMatch(/ambiguous/i);
});
