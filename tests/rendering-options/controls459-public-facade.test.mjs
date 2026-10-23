import './controls459/public-chain-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {ResourceChain,mapProvider}=await import('../../src/engine/resources/chain.ts');
const {composeEnginePush}=await import('../../src/pushButtonFacade.ts');
const metadata={cornerSize:1,sideThickness:1,tileSides:0,patternAnchor:0,bgPatternId:0,bgPixel:{x:0,y:0},textPixel:{x:1,y:0},embossPixel:{x:0,y:0}};
const icon={pixmap:{width:4,height:4,data:new Uint8ClampedArray(64).fill(255)},pixelSize:8,unmasked:null,sampling:'equivalent',sampleRgb16:()=>[257,514,771]};
const theme={baseUrl:'independent:',manifest:{chromeElements:{face:{asset:'independent:face',sourceCicnId:-10239,height:4},ring:{asset:'independent:ring',sourceCicnId:-10231,height:4}}}};
const run=async(face,ring,options={})=>{globalThis.__controls459PublicChain=new ResourceChain([mapProvider('independent','archive',[...(face===null?[]:[['cicn:-10239',face]]),['cinf:-10239',metadata],...(ring===null?[]:[['cicn:-10231',ring]]),['cinf:-10231',metadata]])]);let trace;try{return{output:await composeEnginePush(theme,{label:'',minWidth:24,height:9,...options,diagnostics:{onComplete:t=>trace=t}}),trace};}catch(error){return{error,trace};}};
test('public positive: valid art and same-ID cinf paint; NULL face and NULL ring stay distinct',async()=>{
 const good=await run(icon,icon,{default:true});assert.equal(good.error,undefined);assert.ok(good.output.buffer.data.some(Boolean));assert.equal(good.trace.outcome.status,'themed');
 const missing=await run(null,null);assert.equal(missing.output,null);assert.equal(missing.trace.outcome.status,'unavailable');
 const absentRing=await run(icon,null,{default:true});assert.equal(absentRing.error,undefined);assert.ok(absentRing.output.buffer.data.some(Boolean));assert.equal(absentRing.trace.outcome.status,'themed');
});
for(const lane of ['face','ring'])test(`public UNKNOWN ${lane}: reject unsupported output and preserve exact typed ambiguity`,async()=>{
 const reason=`independent ambiguous ${lane} occurrence`;
 const result=await run(lane==='face'?{status:'unknown',reason}:icon,lane==='ring'?{status:'unknown',reason}:icon,{default:true});
 assert.ok(result.error instanceof Error,'UNKNOWN must reject rather than return a themed composition');assert.ok(result.error.message.includes(reason));assert.equal(result.output,undefined);assert.equal(result.trace.outcome.status,'error');assert.ok(result.trace.steps.some(s=>s.action==='rejected'&&s.usage==='admission'&&s.reason===reason),'public admission diagnostic preserves the exact original typed reason');
});
