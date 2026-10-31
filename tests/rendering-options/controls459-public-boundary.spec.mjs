// Independent #459 public-boundary regression, adapted from the frozen Tier-2 probe.
// Literal fixture bytes and assertions are retained; shared CI transports replace agent-browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test, attachObservations} from './fixtures.mjs';
const probe=readFileSync(new URL('./controls459/boundary-browser.js',import.meta.url),'utf8');
for(const mode of ['source','built']) test(`${mode}: selected malformed metadata and UNKNOWN public boundary`,async({page,servers},info)=>{
 await page.goto(servers[mode]+'/tests/rendering-options/page.html');
 const rows=await page.evaluate(probe.replace("location.port==='63950'?'built':'source'",JSON.stringify(mode)));
 await attachObservations(info,'controls459-public-boundary',mode,{mode,rows,claim:'independent modern rejection/selection contract; native unknown'});
  const row=name=>{const found=rows.filter(r=>r.variant===name);assert.equal(found.length,1,'setup: unique probe result');return found[0];};
  await test.step(`${mode} valid, true NULL, unselected-short and mode5 positive controls`,()=>{
   for(const name of ['valid','valid-fallback','base-fallback-valid','valid-selected-base-short','ring-valid','body-mode5-valid','valid-selected-short-fallback']){assert.equal(row(name).error,undefined,name);assert.equal(row(name).outcome.status,'themed',name);assert.ok(row(name).opaque>0,name);}
   // push-button.md PF3 (#608): face art with exact cinf and cinf0 NULL is null/unavailable.
   // DR6: a ring NULL on a face that reached PF2 stays themed.
   assert.equal(row('pressed-ring-NULL').error,undefined);assert.equal(row('pressed-ring-NULL').outcome.status,'themed');assert.ok(row('pressed-ring-NULL').opaque>0);
   assert.equal(row('NULL').error,undefined);assert.equal(row('NULL').outcome.status,'unavailable');assert.equal(row('NULL').size,null);
   assert.deepEqual(row('NULL').trace.steps.at(-1),{...row('NULL').trace.steps.at(-1),role:'face',action:'missing',basis:'source-dispatch',usage:'paint',reason:'engine:PB9:cinf:NULL'});
   const requests=row('pressed-ring-NULL').trace.steps.filter(s=>/^engine:DR.*:cicn:/.test(s.reason));assert.deepEqual(requests.map(s=>s.requestedId),[-10230]);
  });
  await test.step(`${mode} aligned mode5 positive and scaled unsupported discriminate admission`,()=>{
   const valid=row('body-mode5-valid');assert.deepEqual(valid.size,[24,9]);
   const ordinary=Array.from({length:154},(_,i)=>i===0?[0,0,255,255]:[0,0,0,0]).flat();
   const opaque=Array.from({length:154},(_,i)=>i===0?[0,0,255,255]:[48,48,48,255]).flat();
   assert.deepEqual(valid.bodySource.ordinary,ordinary);assert.deepEqual(valid.bodySource.opaque,opaque);
   assert.deepEqual(valid.bodySource.bounds,{top:0,left:0,bottom:7,right:22});
   const bodies=valid.trace.steps.filter(s=>s.bodyPaint);assert.equal(bodies.length,1);
   assert.equal(bodies[0].resource.type,'cicn');assert.equal(bodies[0].resource.signedId,77);assert.equal(bodies[0].owner.chainDepth,0);
   assert.deepEqual(bodies[0].bodyPaint.sourceRect,{x:0,y:0,w:22,h:7});
   assert.deepEqual(bodies[0].bodyPaint.destinationRect,{x:1,y:1,w:22,h:7});
   assert.equal(bodies[0].bodyPaint.branch,'unmasked-copy');assert.equal(bodies[0].bodyPaint.paintedPixels,154);
   const small=row('body-mode5-small-conventional');assert.equal(small.error?.name,'Error');assert.match(small.error.message,/cicn-body-scaling-unsupported/);assert.equal(small.outcome.status,'error');assert.equal(small.trace.steps.some(s=>s.bodyPaint),false);
   const nil=row('body-mode5-NIL-mono');assert.equal(nil.error?.name,'Error');assert.match(nil.error.message,/cicn-body-scaling-unsupported/);assert.equal(nil.outcome.status,'error');assert.equal(nil.trace.steps.some(s=>s.bodyPaint),false);
   const scaled=row('body-mode5-scaled-unsupported');assert.equal(scaled.error?.name,'Error');
   assert.match(scaled.error.message,/cicn-body-scaling-unsupported/);assert.equal(scaled.outcome.status,'error');
   assert.equal(scaled.trace.steps.some(s=>s.bodyPaint),false);assert.equal(scaled.size,null);
  });
  await test.step(`${mode} selected malformed metadata and body UNKNOWN reject explicitly`,()=>{
   const failures=[];
   for(const name of ['short-selected','short-selected-valid-fallback','base-fallback-short','short-fallback','ring-short','ring-fallback-short','pressed-ring-short','body-mode5-UNKNOWN']){
    const actual=row(name);if(!actual.error||actual.error.name==='TypeError'||actual.outcome?.status!=='error'||!/short|malformed|unknown|ambiguous|unavailable/i.test(actual.error.message))failures.push({name,error:actual.error,outcome:actual.outcome});
   }
   assert.deepEqual(failures,[],'present malformed/UNKNOWN resources must preserve explicit unsupported diagnostics, never themed success or incidental TypeError');
  });
  await test.step(`${mode} PM-bounded ordinary first-occurrence metadata policy`,()=>{
   assert.equal(row('duplicate-first-good').error,undefined);
   assert.equal(row('duplicate-first-good').opaque,row('valid').opaque);
   assert.equal(row('duplicate-first-good').outcome.status,'themed');
   const malformed=row('duplicate-first-short');
   assert.ok(malformed.error&&malformed.error.name!=='TypeError'&&/short|malformed|unknown|unsupported/i.test(malformed.error.message),'selected first malformed metadata must reject, without applying the rejected blanket duplicate policy');
   assert.equal(malformed.outcome?.status,'error');
  });
});
