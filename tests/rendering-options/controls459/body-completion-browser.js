// Portable page.evaluate entry point. Uses public API and injected frozen inputs only.
export async function observeCompletion({apiUrl,cases,ring,mode,mutation=false}) {
 const api=await import(apiUrl), rows=[];
 const deepFrozen=(value,seen=new Set())=>{if(!value||typeof value!=='object'||seen.has(value))return true;seen.add(value);return Object.isFrozen(value)&&Object.values(value).every(v=>deepFrozen(v,seen));};
 const snapshot=t=>JSON.parse(JSON.stringify(t));
 const callback=(state,throws)=>t=>{state.calls++;state.frozen=deepFrozen(t);state.trace=snapshot(t);if(mutation)for(const s of state.trace.steps)delete s.bodyPaint;if(throws)throw throws;};
 const load=async(c,transparent=false)=>api.loadKaleidoscopeScheme(Uint8Array.from(c.fork),{provenance:true,...(transparent?{assetUrlFactory:async(rgba,w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;if(!(w===4&&h===2))cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);return cv.toDataURL();}}:{})});
 const identity=t=>({baseUrl:t.baseUrl,provenance:t.byteProvenance,elements:t.manifest.chromeElements,patterns:t.manifest.patterns});
 for(const c of cases){
  const owner=await load(c);owner.baseUrl=`independent-${c.id}`;let disposals=0;const dispose=owner.dispose.bind(owner);owner.dispose=()=>{disposals++;dispose();};
  const originalDecode=HTMLImageElement.prototype.decode,decoded=[];HTMLImageElement.prototype.decode=function(){decoded.push(this.src);return originalDecode.call(this);};
  try{const child={baseUrl:'empty-child',manifest:{chromeElements:{}},base:owner},state={calls:0};const output=await api.composeButton(child,{...c.options,diagnostics:{onComplete:callback(state)}});rows.push({id:c.id,mode,...state,size:[output.width,output.height],rgba:Array.from(output.data),owner:identity(owner),borrowedDisposals:disposals,decoded});}
  finally{HTMLImageElement.prototype.decode=originalDecode;owner.dispose();}
 }
 // Real archived raw control: independent source sample pins, no fake manifest.
 const real=await api.loadTheme('/themes/crayon-os',{provenance:true});try{const state={calls:0},output=await api.composeButton(real,{label:'',minWidth:80,height:20,compositionContext:{controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'known',offset:[0,0]},clip:{kind:'unbounded'}},diagnostics:{onComplete:callback(state)}});rows.push({id:'real-crayon',mode,...state,size:[output.width,output.height],samples:[[12,12],[67,13],[68,13]].map(([x,y])=>output.getPixel(x,y)),owner:identity(real)});}finally{real.dispose();}
 const pattern=cases.find(c=>c.kind==='pattern');
 for(const variant of ['transparent','zero-clip']){const c=pattern,owner=await load(c,variant==='transparent');try{const state={calls:0},opts=variant==='zero-clip'?{...c.options,compositionContext:{...c.options.compositionContext,clip:{kind:'rect',rect:{x:100,y:100,w:1,h:1}}}}:c.options;const output=await api.composeButton(owner,{...opts,diagnostics:{onComplete:callback(state)}});rows.push({id:variant,mode,...state,rgba:Array.from(output.data),owner:identity(owner)});}finally{owner.dispose();}}
 // Hold exactly the ordinary typed body or ordinary raw ring reached by these
 // wholly opaque independent records; race against settled draw, never a timer.
 for(const stage of ['body','pattern','ring'])for(const action of ['abort','error']){
  const c=stage==='ring'?ring:stage==='pattern'?pattern:cases.find(c=>c.id==='own-ordinary-opaque'),owner=await load(c);
  const target=stage==='pattern'?owner.manifest.patterns['literal-pattern'].asset:owner.manifest.chromeElements[stage==='ring'?'late-ring':'mode5-body'].asset;
  const original=HTMLImageElement.prototype.decode,state={calls:0};let entered,release,reached=0;const enteredPromise=new Promise(r=>entered=r),held=new Promise(r=>release=r),controller=new AbortController(),sentinel=Error(`intentional-${stage}-decode`),callbackError=Error('callback sentinel');
  HTMLImageElement.prototype.decode=async function(){if(this.src===target){reached++;entered();await held;if(action==='error')throw sentinel;}return original.call(this);};
  let pending;
  try{
   pending=api.composeButton(owner,{...c.options,diagnostics:{onComplete:callback(state,callbackError)}},controller.signal).then(output=>({resolved:true,size:output?[output.width,output.height]:null}),e=>({resolved:false,name:e.name,message:e.message,sameError:e===sentinel}));
   const first=await Promise.race([enteredPromise.then(()=> 'entered'),pending.then(()=> 'settled')]),callsWhileHeld=state.calls;
   if(first==='entered'&&action==='abort')controller.abort();release();const outcome=await pending;
   rows.push({id:`${stage}-${action}`,mode,first,reached,callsWhileHeld,target,outcome,...state});
  }finally{release();await pending;HTMLImageElement.prototype.decode=original;owner.dispose();}
 }
 // Success callback exceptions propagate once, preserving a complete frozen trace.
 {const c=cases.find(c=>c.id==='own-ordinary-opaque'),owner=await load(c),state={calls:0},sentinel=Error('success callback sentinel');try{let sameError=false;try{await api.composeButton(owner,{...c.options,diagnostics:{onComplete:callback(state,sentinel)}});}catch(e){sameError=e===sentinel;}rows.push({id:'callback-throw',mode,sameError,...state,owner:identity(owner)});}finally{owner.dispose();}}
 // Concurrent same-key owners must keep invocation, URL and load separate.
 {const c=cases.find(c=>c.id==='own-ordinary-opaque'),owners=await Promise.all([load(c),load(c)]);try{const values=await Promise.all(owners.map(async(owner,i)=>{owner.baseUrl=`concurrent-${i}`;const state={calls:0};await api.composeButton(owner,{...c.options,diagnostics:{correlationId:`completion-${i}`,onComplete:callback(state)}});return{...state,owner:identity(owner)};}));rows.push({id:'concurrent',mode,values});}finally{owners.forEach(t=>t.dispose());}}
 return rows;
}
