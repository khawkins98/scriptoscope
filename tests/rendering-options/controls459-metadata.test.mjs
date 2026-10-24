import '../helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {ResourceChain,mapProvider}=await import('../../src/engine/resources/chain.ts');
const {drawPushButton}=await import('../../src/engine/families/pushButton.ts');
const {createTrace}=await import('../../src/engine/trace.ts');
// Direct typed-provider adaptation of the frozen independent typed-malformed probe.
const pixmap={width:4,height:4,data:new Uint8ClampedArray(64).fill(255)};
const icon={pixmap,pixelSize:8,unmasked:null,sampling:'equivalent',sampleRgb16:()=>[257,514,771]};
const info={cornerSize:1,sideThickness:1,tileSides:0,patternAnchor:0,bgPatternId:77,bgPixel:{x:0,y:0},textPixel:{x:1,y:0},embossPixel:{x:0,y:0}};
export function probe(variant) {
 const reason=`independent ${variant} poison`,entries=[['cicn:-10239',icon]];
 if(variant!=='NULL')entries.push(['cinf:-10239',variant==='cinf-UNKNOWN'?{status:'unknown',reason}:variant==='cinf-short'?{bytes:Array(17).fill(0)}:{...info,patternAnchor:variant.startsWith('mode5')?5:0}]);
 if(variant==='ppat-UNKNOWN')entries.push(['ppat:77',{status:'unknown',reason}]);
 if(variant==='mode5-UNKNOWN')entries.push(['cicn:77',{status:'unknown',reason}]);
 if(variant==='ppat-valid')entries.push(['ppat:77',pixmap]);
 if(variant==='mode5-valid')entries.push(['cicn:77',icon]);
 const chain=new ResourceChain([mapProvider('independent','archive',entries)]),out={width:24,height:20,data:new Uint8ClampedArray(24*20*4)},trace=createTrace('push',{});
 let result,error;try{result=drawPushButton(out,chain,{rect:{left:0,top:0,right:24,bottom:20},hilite:0,depth:32,lowDepth:false},{realize:()=>({r:1,g:2,b:3,a:255})},trace);}catch(e){error={name:e.name,message:e.message};}
 return {result,error,reason,trace,opaque:[...out.data].filter((v,i)=>i%4===3&&v).length};
}
test('metadata positive controls: valid and NULL metadata, ppat and mode5 body',()=>{
 for(const name of ['valid','ppat-valid','mode5-valid','NULL']){const r=probe(name);assert.equal(r.error,undefined,name);assert.equal(r.result.unsupported,undefined,name);assert.equal(r.result.faceFound,true,name);assert.equal(r.opaque>0,name!=='NULL',name);}
});
for(const name of ['cinf-UNKNOWN','ppat-UNKNOWN','mode5-UNKNOWN','cinf-short'])test(`metadata explicit rejection: ${name}`,()=>{
 const r=probe(name);
 assert.equal(r.error,undefined,'typed unsupported result must preserve reason without incidental exception');
 assert.equal(r.result.unsupported,name==='cinf-short'?'short cinf header':r.reason,'exact independent reason survives selected metadata/body rejection');
 assert.equal(r.result.face.drawn,false,'unsupported face is never completed');
 assert.ok(r.trace.drawOps.some(op=>op.status==='unknown'&&op.unsupported===r.result.unsupported));
 assert.equal(r.trace.resolved.some(x=>x.type==='cinf'&&x.id===0),false,'present selected metadata never falls back');
 assert.equal(r.trace.drawOps.some(op=>op.piece),false,'no completed border after unsupported body/metadata');
});
