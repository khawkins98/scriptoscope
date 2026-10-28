import {test,expect,openHarness,attachCase} from './fixtures.mjs';

// Public 3x2 cached pattern, overlapping destination, and sequential drawing.
// These two old-baseline pixels distinguish cloned storage from the broken copy.
const oldPixels=[[6,1,[199,83,29,255]],[7,1,[71,19,137,255]]];
for(const mode of ['source','built'])test(`${mode}: cached push pattern preserves cloned shared storage`,async({page,servers},info)=>{
 const isolate=async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'}});};
 await page.route('**/*',isolate);let result;
 try{
  await openHarness(page,servers,mode);
  const supported=await page.evaluate(()=>crossOriginIsolated&&typeof SharedArrayBuffer==='function'&&typeof structuredClone==='function');
  test.skip(!supported,'Runtime lacks cross-origin isolated SharedArrayBuffer / structuredClone');
  result=await page.evaluate(async mode=>{
   const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
   const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
   const colors=[[17,101,203,255],[71,19,137,255],[199,83,29,255],[43,211,67,255],[107,31,181,255],[239,149,13,255]];
   const proof=new SharedArrayBuffer(32),clone=structuredClone(proof),a=new Uint8Array(proof),b=new Uint8Array(clone);a[3]=91;b[7]=147;
   const setup={isolated:crossOriginIsolated,distinct:proof!==clone,forward:b[3]===91,reverse:a[7]===147};
   const face=plane(7,7);face[0][0]=[137,31,73,255];
   const owner=await loadOwnedControlFixture(api,{faces:[-10239,-10238,-10240].map(id=>({id,name:`face${id}`,pixels:face,cinf:{corner:3,side:1,resourceId:17}})),patterns:[{id:17,name:'asymmetric',pixels:[colors.slice(0,3),colors.slice(3)]}]});
   owner.baseUrl='independent-shared-owner';const rows=[];
   try{
    const cached=await api.loadCicnBuffer(owner.manifest.patterns.asymmetric.asset),descriptor=Object.getOwnPropertyDescriptor(cached,'data'),initial=Array.from(cached.data),allocator=api.PixelBuffer.alloc;
    for(const storageMode of ['cloned','samewrapper','nonalias'])for(const throwing of [false,true]){
     const storage=new SharedArrayBuffer(65536),destination=storageMode==='cloned'?structuredClone(storage):storageMode==='nonalias'?new SharedArrayBuffer(65536):storage;
     const source=new Uint8ClampedArray(storage,176,24),dest=new Uint8ClampedArray(destination,16,2220);source.set(initial);
     const events=[],allocations=[],sentinel=new Error('caller completion sentinel');let out,trace,caught,calls=0;
     try{
      Object.defineProperty(cached,'data',{...descriptor,value:source});
      api.PixelBuffer.alloc=(w,h)=>{const value=new api.PixelBuffer(w,h,dest);allocations.push({w,h,genuine:value instanceof api.PixelBuffer,viewIdentity:value.data===dest});return value;};
      const cacheIdentity=await api.loadCicnBuffer(owner.manifest.patterns.asymmetric.asset)===cached;
      events.push('start');
      try{out=await api.composeButton(owner,{label:'',minWidth:37,height:15,compositionContext:{controlOrigin:[-17,-13],portOrigin:[3,-5],patternOrigin:{status:'known',offset:[0,0]},clip:{kind:'unbounded'}},diagnostics:{correlationId:'independent-push',onComplete:t=>{calls++;trace=t;events.push('callback');if(throwing)throw sentinel;}}});events.push('resolved');}
      catch(e){caught=e;events.push('rejected');}
      rows.push({storageMode,throwing,admission:{cacheIdentity,sourceView:ArrayBuffer.isView(source),sourceOffset:source.byteOffset,destOffset:dest.byteOffset,distinctWrappers:source.buffer!==dest.buffer,allocations},observation:{value:out?'buffer':'undefined',width:out?.width,height:out?.height,rgba:out?Array.from(out.data):null,allocatedRGBA:Array.from(dest),sourceAfter:Array.from(source),trace,calls,events,error:caught?{name:caught.name,message:caught.message}:null,sentinelIdentity:caught===sentinel,frozen:Object.isFrozen(trace)&&Object.isFrozen(trace.steps)&&Object.isFrozen(trace.outcome)}});
     }finally{api.PixelBuffer.alloc=allocator;Object.defineProperty(cached,'data',descriptor);}
    }
   }finally{owner.dispose();}
   return {setup,rows};
  },mode);
  expect(result.setup).toEqual({isolated:true,distinct:true,forward:true,reverse:true});
  for(const row of result.rows){
   expect(row.admission).toEqual({cacheIdentity:true,sourceView:true,sourceOffset:176,destOffset:16,distinctWrappers:row.storageMode!=='samewrapper',allocations:[{w:37,h:15,genuine:true,viewIdentity:true}]});
   const o=row.observation;
   expect(o.calls).toBe(1);expect(o.frozen).toBe(true);expect(o.trace.outcome).toEqual({status:'themed',width:37,height:15});
   expect(o.trace.steps.filter(s=>s.bodyPaint)).toHaveLength(1);
   expect(o.trace.steps.find(s=>s.bodyPaint)).toMatchObject({resource:{type:'ppat',signedId:17,manifestKey:'asymmetric'},bodyPaint:{branch:'pattern-fill-union',paintedPixels:439,sourceSize:[3,2]}});
   expect(o.events).toEqual(['start','callback',row.throwing?'rejected':'resolved']);
   expect(o.error).toEqual(row.throwing?{name:'Error',message:'caller completion sentinel'}:null);expect(o.sentinelIdentity).toBe(row.throwing);
   expect(o.allocatedRGBA).toHaveLength(2220);
   if(!row.throwing){expect([o.width,o.height]).toEqual([37,15]);expect(o.rgba).toEqual(o.allocatedRGBA);}
   else expect(o.rgba).toBeNull();
   expect(o.allocatedRGBA.slice(0,4)).toEqual([137,31,73,255]);expect(o.allocatedRGBA.slice(-4)).toEqual([0,0,0,0]);
   const pixels=row.storageMode==='nonalias'?[[6,1,[71,19,137,255]],[7,1,[199,83,29,255]]]:oldPixels;
   for(const [x,y,rgba]of pixels)expect(o.allocatedRGBA.slice((y*37+x)*4,(y*37+x+1)*4)).toEqual(rgba);
  }
  for(const throwing of [false,true])expect(result.rows.find(r=>r.storageMode==='cloned'&&r.throwing===throwing).observation).toEqual(result.rows.find(r=>r.storageMode==='samewrapper'&&r.throwing===throwing).observation);
  for(const storageMode of ['cloned','samewrapper','nonalias']){
   const ordinary=result.rows.find(r=>r.storageMode===storageMode&&!r.throwing).observation,throwing=result.rows.find(r=>r.storageMode===storageMode&&r.throwing).observation;
   expect(throwing.allocatedRGBA).toEqual(ordinary.allocatedRGBA);expect(throwing.sourceAfter).toEqual(ordinary.sourceAfter);expect(throwing.trace).toEqual(ordinary.trace);
  }
 }catch(error){await attachCase(page,info,{mode,result,oldPixels},error);throw error;}
 finally{await page.unroute('**/*',isolate);}
});
