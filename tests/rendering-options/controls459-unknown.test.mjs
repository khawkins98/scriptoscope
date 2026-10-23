// Portable private independent regression: run from any candidate checkout root.
// node --test /path/to/this.test.mjs. Do not give this oracle to runtime authors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await import(pathToFileURL(resolve('tests/helpers/registerTs.mjs')).href);
const {drawPushButton}=await import(pathToFileURL(resolve('src/engine/families/pushButton.ts')).href);
const {ResourceChain,mapProvider}=await import(pathToFileURL(resolve('src/engine/resources/chain.ts')).href);
const {createTrace}=await import(pathToFileURL(resolve('src/engine/trace.ts')).href);
const D={left:1,top:1,right:11,bottom:11};
const metadata={cornerSize:1,sideThickness:1,tileSides:0,patternAnchor:0,bgPatternId:0,bgPixel:{x:0,y:0},textPixel:{x:1,y:0},embossPixel:{x:0,y:0}};
const pm=(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});
const icon={pixmap:{width:4,height:4,data:new Uint8ClampedArray(64).fill(255)},pixelSize:8,unmasked:null,sampling:'equivalent',sampleRgb16:()=>[257,514,771]};
function setup(cicn){const entries=[['cinf:-10239',metadata]];if(cicn!==null)entries.unshift(['cicn:-10239',cicn]);return{out:pm(12,12),chain:new ResourceChain([mapProvider('declared','archive',entries)]),trace:createTrace('push-button')};}
const input={rect:D,hilite:0,depth:32,lowDepth:false};
const env={realize:rgb=>({r:rgb[0]>>8,g:rgb[1]>>8,b:rgb[2]>>8,a:255})};
test('positive: valid decoded cicn and exact same-ID metadata draw with valid dimensions',()=>{const {out,chain,trace}=setup(icon);const result=drawPushButton(out,chain,input,env,trace);assert.equal(result.faceFound,true);assert.equal(result.face.drawn,true);assert.equal(result.unsupported,undefined);assert.ok(out.data.some(Boolean));assert.deepEqual(trace.resolved.map(r=>[r.type,r.id]),[['cicn',-10239],['cinf',-10239],['ppat',0]]);});
test('positive: proven NULL cicn suppresses metadata and reports missing face',()=>{const {out,chain,trace}=setup(null);const result=drawPushButton(out,chain,input,env,trace);assert.equal(result.faceFound,false);assert.deepEqual(trace.resolved.map(r=>[r.type,r.id]),[['cicn',-10239]]);assert.ok(out.data.every(v=>v===0));});
test('typed UNKNOWN non-NULL cicn plus valid same-ID cinf yields explicit unsupported, never TypeError',()=>{
 const {out,chain,trace}=setup({status:'unknown',reason:'ambiguous occurrence'});let result;
 assert.doesNotThrow(()=>{result=drawPushButton(out,chain,input,env,trace);},'typed UNKNOWN must propagate diagnostically before dereferencing pixmap');
 assert.ok(String(result.unsupported??'').includes('ambiguous occurrence'),'UNKNOWN result must preserve its exact typed reason');
 assert.ok(trace.drawOps.some(op=>op.status==='unknown' && [op.unspecified,op.unimplemented,op.unsupported].some(value=>String(value??'').includes('ambiguous occurrence'))),'trace must explicitly preserve UNKNOWN status and the exact typed ambiguity reason');
 assert.ok(out.data.every(v=>v===0),'unknown art establishes no pixels');
 assert.equal(trace.resolved.some(r=>r.type==='cicn'&&r.id!==-10239),false,'unknown must not authorize a different face-state retry');
});
test('typed UNKNOWN pressed ring is unsupported and cannot authorize the DR3 normal-ring retry',()=>{
 const entries=[['cicn:-10238',icon],['cinf:-10238',metadata],['cicn:-10230',{status:'unknown',reason:'ambiguous ring occurrence'}],['cinf:-10230',metadata],['cicn:-10231',icon],['cinf:-10231',metadata]];
 const chain=new ResourceChain([mapProvider('declared','archive',entries)]),trace=createTrace('push-button'),out=pm(12,12);
 let result;assert.doesNotThrow(()=>{result=drawPushButton(out,chain,{...input,hilite:1,defaultDataValid:true,defaultFlag:1},env,trace);},'typed UNKNOWN ring must remain distinct from proven art NULL');
 assert.equal(result.faceFound,true,'valid pressed face is an unchanged positive precondition');
 assert.ok(String(result.unsupported??'').includes('ambiguous ring occurrence'),'ring result must preserve its exact typed reason');
 assert.ok(trace.drawOps.some(op=>op.status==='unknown' && [op.unspecified,op.unimplemented,op.unsupported].some(value=>String(value??'').includes('ambiguous ring occurrence'))),'ring trace must explicitly preserve UNKNOWN status and the exact typed reason');
 assert.equal(trace.resolved.some(r=>r.type==='cicn'&&r.id===-10231),false,'UNKNOWN must not authorize normal-ring retry');
});
