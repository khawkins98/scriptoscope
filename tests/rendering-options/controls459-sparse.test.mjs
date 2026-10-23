import '../helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {solidBackgroundInfo} from '../decoder-fixtures/solid-background.mjs';
const {drawPushButton}=await import('../../src/engine/families/pushButton.ts');
const {ResourceChain,mapProvider}=await import('../../src/engine/resources/chain.ts');
const {createTrace}=await import('../../src/engine/trace.ts');
const pixels={width:4,height:4,data:new Uint8ClampedArray(64).fill(255)},icon={pixmap:pixels,pixelSize:8,unmasked:null,sampling:'equivalent',sampleRgb16:()=>[257,514,771]};
function run(kind){
 const good=Array.from(solidBackgroundInfo()),entries=[['cicn:-10239',icon]];
 if(kind!=='NULL'&&kind!=='sparse-fallback')entries.push(['cinf:-10239',{bytes:kind.startsWith('sparse')?Array(18):kind==='uint8'?new Uint8Array(good):good}]);
 if(kind==='sparse-fallback')entries.push(['cinf:0',{bytes:Array(18)}]);
 if(kind==='sparse-valid-fallback')entries.push(['cinf:0',{bytes:good}]);
 if(kind==='valid-unused-sparse')entries.push(['cinf:0',{bytes:Array(18)}]);
 const out={width:24,height:20,data:new Uint8ClampedArray(24*20*4)},trace=createTrace('push',{});let result,error;
 try{result=drawPushButton(out,new ResourceChain([mapProvider('independent','archive',entries)]),{rect:{left:0,top:0,right:24,bottom:20},hilite:0,depth:32,lowDepth:false},{realize:()=>({r:1,g:2,b:3,a:255})},trace);}catch(e){error=e;}
 return {out,trace,result,error};
}
test('sparse-header positive controls preserve dense, Uint8Array, NULL and unused-default behavior',()=>{
 const valid=run('dense');assert.equal(valid.error,undefined);assert.equal(valid.result.unsupported,undefined);assert.ok(valid.out.data.some(Boolean));
 for(const kind of ['uint8','valid-unused-sparse']){const r=run(kind);assert.equal(r.error,undefined);assert.equal(r.result.unsupported,undefined);assert.deepEqual(r.out.data,valid.out.data);}
 const missing=run('NULL');assert.equal(missing.error,undefined);assert.equal(missing.result.unsupported,undefined);assert.ok(missing.out.data.every(v=>v===0));
});
for(const kind of ['sparse','sparse-valid-fallback','sparse-fallback'])test(`sparse-header explicit rejection: ${kind}`,()=>{
 const r=run(kind);assert.equal(r.error,undefined,'no incidental exception');assert.match(r.result.unsupported??'',/malformed|short|unknown/i,'absent byte slots reject explicitly');
 assert.equal(r.result.face.drawn,false);assert.ok(r.out.data.every(v=>v===0),'no sampling/body/border writes');assert.ok(!r.trace.drawOps.some(o=>o.piece));
 if(kind!=='sparse-fallback')assert.equal(r.trace.resolved.some(x=>x.type==='cinf'&&x.id===0),false,'selected sparse metadata cannot authorize fallback');
});
