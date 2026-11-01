// #611 availability transition 1.0.18 -> 1.0.19 (corrections/611-reference-labels.json).
// Hash-only: the three kdef231-reference.md label edits listed in hit-regions.evidence.md E1
// are the whole document change, and only the nine documentSha256 pins move in the inventory.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {delta611 as delta,peel611,active611} from './controls459/peel-611.mjs';
import {delta608} from './controls459/peel-608.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');
const live=read('../control-availability/expectations.json');
test('611 changes only the nine kdef231-reference.md document pins',()=>{
 assert.equal(delta.status,'hash-only-requires-independent-review');assert.equal(delta.unlistedAvailability,'unknown');
 assert.equal(delta.priorInventoryVersion,delta608.candidateInventoryVersion,'611 follows the 608 transition');
 assert.equal(delta.priorInventorySha256,delta608.prospectiveAcceptedCaseSha256);
 assert.equal(delta.document.path,'docs/spec/kdef231-reference.md');assert.equal(delta.changedKey,'sourceEvidence[].documentSha256');
 assert.equal(delta.changedCaseIds.length,9);
 assert.equal(live.inventorySha256,hash(JSON.stringify(live.cases)));
 if(!active611(live))return;
 assert.equal(live.inventoryVersion,'1.0.19');assert.equal(live.inventorySha256,delta.prospectiveAcceptedCaseSha256);
 assert.deepEqual(live.review.previousReview,delta.priorReview);assert.equal(live.review.inventoryVersion,live.inventoryVersion);assert.equal(live.review.inventorySha256,live.inventorySha256);
 assert.ok(live.review.transition.includes(delta.document.beforeSha256)&&live.review.transition.includes(delta.document.afterSha256)&&live.review.transition.includes(delta.priorInventorySha256));
 const prior=peel611(live);assert.equal(prior.cases.length,27);assert.equal(hash(JSON.stringify(prior.cases)),delta.priorInventorySha256);
 const moved=live.cases.filter((c,i)=>JSON.stringify(c)!==JSON.stringify(prior.cases[i])).map(c=>c.id);
 assert.deepEqual(moved,delta.changedCaseIds,'no other row changes');
 for(const id of moved){
  const now=live.cases.find(c=>c.id===id),was=prior.cases.find(c=>c.id===id);
  const pins=c=>c.sourceEvidence.filter(e=>e.document===delta.document.path).map(e=>e.documentSha256);
  assert.ok(pins(now).length>0&&pins(now).every(h=>h===delta.document.afterSha256));assert.ok(pins(was).every(h=>h===delta.document.beforeSha256));
 }
});
test('611 document change is exactly the three E1 label edits',()=>{
 const doc=readFileSync(new URL('../../'+delta.document.path,import.meta.url),'utf8');
 assert.equal(hash(doc),delta.document.afterSha256,'kdef231-reference.md changed: a new hash-only bump is needed');
 assert.equal(delta.document.edits.length,3);let restored=doc;
 for(const e of delta.document.edits){assert.equal(restored.split(e.after).length,2,'each edit is unique');restored=restored.replace(e.after,()=>e.before);
  assert.match(e.after,/#611/);assert.match(e.after,/#610/);assert.match(e.after,/hit-regions\.evidence\.md/);assert.match(e.before,/1001/);}
 assert.equal(hash(restored),delta.document.beforeSha256,'undoing the three edits restores the pinned 1.0.18 document');
 assert.doesNotMatch(doc.slice(doc.indexOf('### 1.4'),doc.indexOf('### 1.4')+4000),/1001\.\.1009 verbs\)\s*\||msgs 1001\.\.1009 \(per-side/);
});
