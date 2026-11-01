import {peelHashOnlyBumps} from './controls459/hash-only-bumps.mjs';
import {frozenPushSource} from './controls459/frozen-push-source.mjs';
import {peel608} from './controls459/peel-608.mjs';
import {peel611} from './controls459/peel-611.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const live=peel608(peel611(peelHashOnlyBumps(read('../control-availability/expectations.json'))));
const delta=read('../control-availability/corrections/459-push-strict-state.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
test('459 correction preserves frozen draft and prior state through independently approved activation',()=>{
 let current=live;const later=read('../control-availability/corrections/459-no-cinf-admission.json');
 if(live.inventoryVersion===later.candidateInventoryVersion){
  assert.deepEqual(live.review.previousReview,later.priorReview);for(const c of later.changes)assert.deepEqual(live.cases.find(r=>r.id===c.id),{...c.after,reviewStatus:'reviewed',effectiveAvailability:'themed'});
  current={...live,inventoryVersion:later.priorInventoryVersion,inventorySha256:later.priorInventorySha256,review:live.review.previousReview,cases:live.cases.map(row=>later.changes.find(c=>c.id===row.id)?.before??row),policy:{...live.policy,rules:live.policy.rules.filter(r=>r.id!==later.candidatePolicyRule.id)}};
  assert.equal(hash(JSON.stringify(current.cases)),later.priorInventorySha256,'recover all27 accepted1.0.16 rows before the original two-row proof');
  assert.equal(hash(JSON.stringify(current,null,2)+'\n'),'27f6e3f36466e79063ecaaf4df735ec828aed6926aff5be6a10b3e123b679e3d','recover complete frozen1.0.16 inventory, not only changed outcomes');
 }
 assert.equal(delta.status,'candidate-requires-different-tier2');assert.equal(delta.activeInventoryUnchanged,true);
 assert.equal(hash(readFileSync(new URL('../control-availability/corrections/459-push-strict-state.json',import.meta.url))),'13b7f23c9ab492670e1b3e978640ebe438e16b443af0cbe2964bb1aaa9004483');
 assert.equal(current.inventorySha256,hash(JSON.stringify(current.cases)));
 const accepted=current.inventoryVersion===delta.candidateInventoryVersion;
 if(!accepted){assert.equal(current.inventoryVersion,delta.priorInventoryVersion);assert.equal(current.inventorySha256,delta.priorInventorySha256);assert.deepEqual(current.review,delta.priorReview);}
 else {
  assert.equal(current.inventoryVersion,'1.0.16');assert.equal(current.inventorySha256,'3b17c3e7ea05462073f65dad01c12a8618d84105bacc55bbf15fca64da35205f');
  assert.equal(current.reviewStatus,'reviewed');assert.deepEqual(current.review.previousReview,delta.priorReview);assert.equal(current.review.inventoryVersion,current.inventoryVersion);assert.equal(current.review.inventorySha256,current.inventorySha256);assert.equal(current.review.date,'2026-10-23');
  const receipt=JSON.stringify(current.review.reviewers);for(const identity of ['task_250da34b4ee4','ctx_665557c4ea84','orca_session_id:0ddda36d-6b99-47bf-aa9d-18e8913a21a8','/Users/khawkins/Documents/git/scriptoscope-lanes/459-availability-review/REPORT.md','a54994b2c64503f8bfc362504faadfb310547f7b'])assert.ok(receipt.includes(identity));
  assert.ok(current.review.transition.includes(delta.source.sha256));for(const c of delta.changes)assert.ok(current.review.transition.includes(c.id));
  assert.deepEqual(current.policy.rules.filter(r=>r.id===delta.candidatePolicyRule.id),[delta.candidatePolicyRule]);
 }
 assert.equal(delta.source.document,'docs/spec/engine/push-button.md');assert.equal(delta.source.sha256,createHash('sha256').update(frozenPushSource()).digest('hex'));
 assert.deepEqual(delta.changes.map(c=>c.id),['synthetic.named-unknown-id','synthetic.inactive-to-active']);
 for(const change of delta.changes){
  const active=current.cases.find(c=>c.id===change.id);
  assert.deepEqual(active,accepted?{...change.after,reviewStatus:'reviewed',effectiveAvailability:'unavailable'}:change.before);
  const after=change.after;assert.equal(after.reviewStatus,'draft-requires-independent-review');assert.equal(after.effectiveAvailability,'unknown');assert.deepEqual(after.proposed,{outcome:'unavailable',paint:[],noPaintRoles:['face','default-ring'],requiredDecisions:[]});
  const recover=structuredClone(after);for(const key of ['reviewStatus','effectiveAvailability','proposed','policyRefs','notes'])recover[key]=change.before[key];assert.deepEqual(recover,change.before,'input/source/evidence/owner identity cannot change');
  assert.deepEqual(after.policyRefs,[delta.candidatePolicyRule.id]);assert.ok(change.sourceRows.includes('PB8'));
 }
 const recovered=current.cases.map(row=>delta.changes.find(c=>c.id===row.id)?.before??row);assert.equal(recovered.length,27);assert.equal(hash(JSON.stringify(recovered)),delta.priorInventorySha256,'all 27 old rows recover exactly; other 25 cannot change');
 assert.equal(delta.unlistedAvailability,'unknown');assert.equal(current.scope.unlistedAvailability,'unknown');
});
