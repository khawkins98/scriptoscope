// Functional facade checks with diagnostics AND provenance omitted.
import assert from 'node:assert/strict';
// A malformed image rejects as a DOMException EncodingError in every engine; its message is
// engine wording (WebKit: "Loading error."), so the name is the semantic signal (#591).
const semantic=e=>e.name==='EncodingError'||/unsupported|malformed|unknown|invalid|scal|align|decod|encoding/i.test(e.message);
export async function observePlainPolicy({apiUrl,cases,admission,mode}){
 const api=await import(apiUrl),rows=[];
 const paint=async(theme,options)=>{if('diagnostics'in options)throw Error('Plain policy fixture unexpectedly enables diagnostics');try{const out=await api.composeButton(theme,options);return{size:out?[out.width,out.height]:null,rgba:out?Array.from(out.data):null};}catch(e){return{error:{name:e.name,message:e.message}};}};
 for(const c of cases){const owner=await api.loadKaleidoscopeScheme(Uint8Array.from(c.ownerFork));let child;try{if(c.kind==='pattern'&&c.variant==='malformed')owner.manifest.patterns['owned-body'].asset='data:image/png;base64,AAAA';const direct=await paint(owner,c.options);child=await api.loadKaleidoscopeScheme(Uint8Array.from(c.childFork));child.base=owner;rows.push({id:c.id,mode,direct,inherited:await paint(child,c.options)});}finally{if(child){delete child.base;child.dispose();}owner.dispose();}}
 const c=admission.find(c=>c.id==='mode5-nonaligned'),owner=await api.loadKaleidoscopeScheme(Uint8Array.from(c.fork));try{rows.push({id:c.id,mode,...await paint(owner,c.options)});}finally{owner.dispose();}return rows;
}
const reject=(r,id)=>{assert.ok(r.error,`${id}: plain-explicit-rejection-required`);assert.notEqual(r.error.name,'TypeError');assert.ok(semantic(r.error),`${id}: explicit semantic error (${r.error.name}: ${r.error.message})`);};
export function evaluatePlainPolicy(rows,cases){
 for(const c of cases.filter(c=>c.variant!=='malformed')){const r=rows.find(r=>r.id===c.id).direct;assert.equal(r.error,undefined,`${c.id}: valid direct plain control`);assert.deepEqual(r.size,[c.options.minWidth,c.options.height]);assert.deepEqual(r.rgba,c.rgba,`${c.id}: independent full plain positive literal`);assert.ok(r.rgba.some((v,i)=>i%4===3&&v));}
 const failures=[],passed=[],check=(id,fn)=>{try{fn();passed.push(id);}catch(e){failures.push({id,message:e.message});}};
 for(const c of cases){const r=rows.find(r=>r.id===c.id);if(c.variant==='malformed'){for(const kind of ['direct','inherited'])check(`plain-${c.id}/${kind}`,()=>reject(r[kind],`plain-${c.id}/${kind}`));}else check(`plain-${c.id}`,()=>{assert.equal(r.inherited.error,undefined);assert.deepEqual(r.inherited.size,[c.options.minWidth,c.options.height]);assert.deepEqual(r.inherited.rgba,c.rgba,`plain-${c.id}: selected-face-owner-full-literal-required`);});}
 check('plain-mode5-nonaligned',()=>reject(rows.find(r=>r.id==='mode5-nonaligned'),'plain-mode5-nonaligned'));
 return{positiveControls:'passed',passed,failures};
}
export function assertPlainPolicy(rows,cases){const result=evaluatePlainPolicy(rows,cases);assert.equal(result.failures.length,0,JSON.stringify(result.failures));return result;}
