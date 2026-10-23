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
   for(const name of ['NULL','pressed-ring-NULL']){assert.equal(row(name).error,undefined,name);assert.equal(row(name).outcome.status,'themed',name);}
   assert.equal(row('NULL').opaque,0);
   const requests=row('pressed-ring-NULL').trace.steps.filter(s=>/^engine:DR.*:cicn:/.test(s.reason));assert.deepEqual(requests.map(s=>s.requestedId),[-10230]);
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
