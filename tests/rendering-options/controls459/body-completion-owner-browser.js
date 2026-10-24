// Public-loader owner/admission regressions; never derives expected values.
export async function observeOwnerPolicy({apiUrl,cases,late,admission,mode}){
 const api=await import(apiUrl),rows=[];
 const frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen);
 const capture=async(theme,options)=>{const state={calls:0,decoded:[]},original=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){state.decoded.push(this.src);return original.call(this);};try{const out=await api.composeButton(theme,{...options,diagnostics:{onComplete:t=>{state.calls++;state.frozen=frozen(t);state.trace=JSON.parse(JSON.stringify(t));}}});return{...state,size:out?[out.width,out.height]:null,rgba:out?Array.from(out.data):null};}catch(e){return{...state,error:{name:e.name,message:e.message}};}finally{HTMLImageElement.prototype.decode=original;}};
 const identity=t=>({baseUrl:t.baseUrl,elements:t.manifest.chromeElements,patterns:t.manifest.patterns,provenance:t.byteProvenance});
 for(const c of cases){const owner=await api.loadKaleidoscopeScheme(Uint8Array.from(c.ownerFork),{provenance:true});owner.baseUrl=`actual-owner-${c.id}`;if(c.kind==='pattern'&&c.variant==='malformed')owner.manifest.patterns['owned-body'].asset='data:image/png;base64,AAAA';let child;try{
  const direct=await capture(owner,c.options);child=await api.loadKaleidoscopeScheme(Uint8Array.from(c.childFork),{provenance:true});child.baseUrl=`foreign-child-${c.id}`;child.base=owner;
  const inherited=await capture(child,c.options);rows.push({id:c.id,mode,direct,inherited,owner:identity(owner),child:identity(child)});
 }finally{if(child){delete child.base;child.dispose();}owner.dispose();}}
 for(const c of [...late,...admission]){const owner=await api.loadKaleidoscopeScheme(Uint8Array.from(c.fork),{provenance:true});try{rows.push({id:c.id,mode,...await capture(owner,c.options),owner:identity(owner)});}finally{owner.dispose();}}
 return rows;
}
