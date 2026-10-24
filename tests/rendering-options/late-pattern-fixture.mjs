// Independent raw input and process-only output-array observation.
// The proxy observes completed numeric writes; it restores the original data and
// allocator in finally. It changes no runtime file or output byte.
export async function observeLatePatternExecution(page,mode){return page.evaluate(async mode=>{

 const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{loadOwnedControlFixture,plane,indexedCicn,indexedPattern,rawCinf}=await import('/tests/rendering-options/owned-control-fixture.mjs'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
 const face=plane(7,7),color=[17,101,203,255],pattern=[[color]],faces=[{id:-10239,name:'late-face',pixels:face,cinf:{corner:1,side:2,resourceId:17}},{id:-10231,name:'late-ring',pixels:face,cinf:{corner:1,side:2}}];
 const seed=await loadOwnedControlFixture(api,{faces,patterns:[{id:17,name:'late-pattern',pixels:pattern}]}),profile=seed.manifest.displayProfile;seed.dispose();
 const rows=[];
 for(const kind of ['uninstrumented-positive','positive','malformed-ring','abort-after-pattern']){
  const records=[{type:'cicn',id:-10239,name:'late-face',data:indexedCicn(face)},{type:'cinf',id:-10239,data:rawCinf({corner:1,side:2,resourceId:17})},{type:'cicn',id:-10231,name:'late-ring',data:indexedCicn(face)},{type:'cinf',id:-10231,data:kind==='malformed-ring'?rawCinf({corner:1,side:2}).slice(0,17):rawCinf({corner:1,side:2})},{type:'ppat',id:17,name:'late-pattern',data:indexedPattern(pattern)}];
  const theme=await api.loadKaleidoscopeScheme(forkOf(records),{displayProfile:profile,provenance:true});theme.baseUrl='owned-late-pattern';
  const controller=new AbortController(),alloc=api.PixelBuffer.alloc,descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');let writes=0,writeCalls=0,writePlane=null,trace,callbacks=0,out,error;const events=[],lateStarts=[],tracked=[],seen=new Set();
  api.PixelBuffer.alloc=function(width,height,...rest){const buffer=alloc.call(this,width,height,...rest);if(width===32&&height===14&&kind!=='uninstrumented-positive'){const target=buffer.data;tracked.push({buffer,target});buffer.data=new Proxy(target,{get(t,key){const value=Reflect.get(t,key,t);return typeof value==='function'?value.bind(t):value;},set(t,key,value){const ok=Reflect.set(t,key,value,t),i=Number(key);if(Number.isInteger(i)&&i%4===3&&value===255&&t[i-3]===17&&t[i-2]===101&&t[i-1]===203){writeCalls++;seen.add(i);writes=seen.size;events.push({event:'actual-pattern-write',x:((i-3)/4)%32,y:Math.floor((i-3)/4/32),unique:writes,call:writeCalls});if(writes===84&&writePlane===null){writePlane=[...t];if(kind==='abort-after-pattern'){events.push({event:'abort-after-84-unique-written',writeCalls});controller.abort();}}}return ok;}});}return buffer;};
  Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(url){if(controller.signal.aborted)lateStarts.push(url);descriptor.set.call(this,url);}});
  try{out=await api.composeButton(theme,{label:'',minWidth:24,height:6,default:true,diagnostics:{onComplete:t=>{callbacks++;trace=t;events.push({event:'callback',outcome:t.outcome});}}},controller.signal);}catch(e){error={name:e.name,message:e.message};}
  finally{api.PixelBuffer.alloc=alloc;for(const{buffer,target}of tracked)buffer.data=target;Object.defineProperty(HTMLImageElement.prototype,'src',descriptor);theme.dispose();}
  rows.push({mode,kind,writes,writeCalls,trackedAllocations:tracked.length,writePlane,events,callbacks,trace,error,lateStarts,loadId:theme.byteProvenance.loadId,output:out?{width:out.width,height:out.height,plane:[...out.data]}:null});
 }
 return rows;
},mode);}
