// Independent R3 sparse-header contract; original probe/assertions preserved.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test,attachObservations} from './fixtures.mjs';
const probe=readFileSync(new URL('./controls459/sparse-browser.js',import.meta.url),'utf8');
for(const mode of ['source','built'])test(`${mode}: sparse serialized metadata rejects before public paint`,async({page,servers},info)=>{
 await page.goto(servers[mode]+'/tests/rendering-options/page.html');
 const rows=await page.evaluate(probe.replaceAll('MODE_LITERAL',JSON.stringify(mode)));
 await attachObservations(info,'controls459-sparse',mode,{mode,rows,claim:'independent modern malformed-header admission; native unknown'});
const row=k=>rows.find(r=>r.kind===k);await test.step(mode+' valid dense/Uint8Array, true NULL, explicit malformed positive controls',()=>{for(const kind of ['valid','dense','uint8']){assert.equal(row(kind).error,undefined);assert.equal(row(kind).outcome.status,'themed');assert.deepEqual(row(kind).pixels,row('valid').pixels);}assert.equal(row('NULL').error,undefined);assert.equal(row('NULL').opaque,0);for(const kind of ['explicit-undefined','short']){assert.equal(row(kind).outcome.status,'error');assert.equal(row(kind).error.name,'Error');}});await test.step(mode+' R3 sparse selected and fallback metadata reject without false paint',()=>{const failures=[];for(const kind of ['sparse','sparse-valid-fallback','sparse-fallback']){const r=row(kind);if(r.outcome.status!=='error'||!r.error||r.error.name==='TypeError'||r.pixels!==null||r.trace.steps.some(s=>s.usage==='paint'))failures.push({kind,outcome:r.outcome,opaque:r.opaque});}assert.deepEqual(failures,[],'R3 sparse slots are absent bytes and require explicit malformed rejection, never zero-filled paint');});
});
