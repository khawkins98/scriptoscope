import {test,expect,openHarness} from './fixtures.mjs';
// Source-blind synthetic public integration regression. No production source imports.
test('built: approved no-rect allocator observations preserve remaining contracts',async({page,servers})=>{
 await openHarness(page,servers,'built');
 const result=await page.evaluate(async()=>{
  const target=await import('/dist/scriptoscope.js'),api={target};
  const {loadOwnedControlFixture,plane}=await import('/tests/rendering-options/owned-control-fixture.mjs');
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const context=(patch={})=>({controlOrigin:[-17,-13],portOrigin:[3,-5],patternOrigin:{status:'known',offset:[-19,23]},clip:{kind:'unbounded'},...patch});
  const options=patch=>({label:'',minWidth:37,height:15,compositionContext:context(),...patch});
  const adapt=async(_,owner)=>owner;
  async function theme({solid}){const face=plane(7,7);face[0][0]=[137,31,73,255];const colors=[[17,101,203,255],[71,19,137,255],[199,83,29,255],[43,211,67,255],[107,31,181,255],[239,149,13,255]];const owner=await loadOwnedControlFixture(target,{faces:[-10239,-10238,-10240].map(id=>({id,name:`face${id}`,pixels:face,cinf:{corner:3,side:1,tile:false,mode:0,resourceId:17}})),patterns:solid?[]:[{id:17,name:'asymmetric',pixels:[colors.slice(0,3),colors.slice(3)]}]});owner.baseUrl='independent-shared-owner';return owner;}
const clips=['default','unknown','unbounded','rect'];
const optsFor=(clip,diagnostics,onComplete)=>options({minWidth:24,height:7,compositionContext:clip==='default'?undefined:context({clip:clip==='rect'?{kind:'rect',rect:{x:-12,y:-9,w:21,h:7}}:{kind:clip}}),...(diagnostics?{diagnostics:{correlationId:'allocator-contract',onComplete}}:{})});
async function capture(name,{clip,diagnostics,solid,trigger,action,key='any',changedDimension,callbackThrows=false}){
 const owner=await theme({solid}),a=api[name],alloc=a.PixelBuffer.alloc,events=[],marker=new Error('independent-allocator-sentinel'),callbackMarker=new Error('independent-callback-sentinel'),controller=new AbortController();let buffer,out,trace,error,identity=false,read=0,hit=false;const dims={};
 try{
  a.PixelBuffer.alloc=function(...args){events.push(['alloc',...args]);buffer=alloc.apply(this,args);for(const k of ['width','height']){const v=buffer[k];dims[k]=v;Object.defineProperty(buffer,k,{configurable:true,enumerable:true,get(){events.push([k]);read++;if(read===trigger&&(key==='any'||key===k)){hit=true;events.push(['effect',action]);if(action==='throw')throw marker;if(action==='abort')controller.abort();if(action==='dispose')owner.dispose();if(action==='mutate')buffer.data[0]^=0xff;}return changedDimension&&k===changedDimension&&read===trigger?v-1:v;}});}return buffer;};
  try{out=await a.composeButton(await adapt(name,owner),optsFor(clip,diagnostics,t=>{events.push(['callback']);trace=t;if(action==='callback-throw'||callbackThrows)throw callbackMarker;}),controller.signal);events.push(['resolved']);}catch(e){events.push(['rejected']);error={name:e.name,message:e.message};identity=e===marker?'allocator':e===callbackMarker?'callback':false;}
  // Each capture owns a fresh disposable fixture. Bind only its random public
  // provenance identity to resource roles; all remaining trace fields stay exact.
  const bindings=new Map();
  const visit=(v,path='owner',seen=new Set())=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);for(const [k,x]of Object.entries(v)){if(typeof x==='string'&&(x.startsWith('blob:')||k==='loadId'))bindings.set(x,bindings.get(x)??(k==='loadId'?'fixture-load-id':path+'/'+k));else if(typeof x==='object')visit(x,path+'/'+k,seen);}};
  visit(owner);
  const canonical=v=>typeof v==='string'&&bindings.has(v)?'fixture:'+bindings.get(v):Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,canonical(x)])):v;
  trace=canonical(trace);
  // Capture the genuine dimensions without getter observations created by this test.
  return{value:out?'buffer':out===null?'null':'undefined',dimensions:dims,rgba:out?Array.from(out.data):undefined,allocatedRGBA:buffer?Array.from(buffer.data):undefined,trace,error,identity,events,hit,aborted:controller.signal.aborted};
 }finally{a.PixelBuffer.alloc=alloc;owner.dispose();}
}

 const rows=[],check=(id,pass)=>rows.push({id,pass});
 const semantic=r=>{const{events,hit,...rest}=r;return rest;};
 for(const clip of clips)for(const diagnostics of [false,true])for(const solid of [false,true]){
  const spec={clip,diagnostics,solid},normal=await capture('target',spec),dims=normal.events.filter(e=>e[0]==='width'||e[0]==='height'),count=key=>dims.filter(e=>e[0]===key).length;
  const expected=clip==='rect'?(diagnostics?(solid?[747,288]:[781,292]):[714,272]):diagnostics?(solid?[535,201]:[771,217]):[376,158];
  const id=`${clip}/${diagnostics}/${solid}`;
  check(id+'/dimensions',normal.value==='buffer'&&equal(normal.dimensions,{width:24,height:7})&&normal.rgba.length===672);
  check(id+'/observations',count('width')===expected[0]&&count('height')===expected[1]);
  check(id+'/callback-order',normal.events.filter(e=>e[0]==='callback').length===Number(diagnostics)&&normal.events.at(-1)[0]==='resolved'&&(!diagnostics||normal.events.at(-2)[0]==='callback'));
  for(const action of ['throw','abort','dispose','mutate']){
   const drawing=await capture('target',{...spec,trigger:1,action});
   check(id+'/drawing/'+action,drawing.hit&&(action!=='throw'||drawing.identity==='allocator')&&(action!=='abort'||drawing.error?.name==='AbortError'));
   if(clip==='rect'){
    const trigger=dims.length-(diagnostics?2:0)-20,r=await capture('target',{...spec,trigger,action});
    check(id+'/rect/'+action,r.hit&&(action!=='throw'||r.identity==='allocator'));
   }else{
    const trigger=expected[0]+expected[1]-(diagnostics?2:0)+20,r=await capture('target',{...spec,trigger,action});
    check(id+'/omitted/'+action,!r.hit&&equal(semantic(r),semantic(normal)));
   }
   if(diagnostics)for(const offset of [1,0]){const r=await capture('target',{...spec,trigger:dims.length-offset,action});check(id+'/publication/'+action+'/'+offset,r.hit&&(action!=='throw'||r.identity==='allocator'));}
  }
  for(const changedDimension of ['width','height']){const trigger=dims.findIndex(e=>e[0]===changedDimension)+1,r=await capture('target',{...spec,trigger,changedDimension});check(id+'/dynamic/'+changedDimension,r.hit);}
 }
 return{pass:rows.every(r=>r.pass),rows};
 });
 expect(result.rows.filter(r=>!r.pass)).toEqual([]);
});
