import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const current=read('../control-availability/expectations.json');
const delta=read('../control-availability/corrections/459-push-strict-state.json');
test('459 correction is a two-row inactive candidate with exact prior-state archive and source pin',()=>{
 assert.equal(delta.status,'candidate-requires-different-tier2');assert.equal(delta.activeInventoryUnchanged,true);
 assert.equal(delta.priorInventoryVersion,current.inventoryVersion);assert.equal(delta.priorInventorySha256,current.inventorySha256);assert.deepEqual(delta.priorReview,current.review);
 assert.equal(delta.source.document,'docs/spec/engine/push-button.md');assert.equal(delta.source.sha256,createHash('sha256').update(readFileSync(new URL('../../docs/spec/engine/push-button.md',import.meta.url))).digest('hex'));
 assert.deepEqual(delta.changes.map(c=>c.id),['synthetic.named-unknown-id','synthetic.inactive-to-active']);
 for(const change of delta.changes){
  assert.deepEqual(change.before,current.cases.find(c=>c.id===change.id));
  const after=change.after;assert.equal(after.reviewStatus,'draft-requires-independent-review');assert.equal(after.effectiveAvailability,'unknown');assert.deepEqual(after.proposed,{outcome:'unavailable',paint:[],noPaintRoles:['face','default-ring'],requiredDecisions:[]});
  const recover=structuredClone(after);for(const key of ['reviewStatus','effectiveAvailability','proposed','policyRefs','notes'])recover[key]=change.before[key];assert.deepEqual(recover,change.before,'input/source/evidence/owner identity cannot change');
  assert.deepEqual(after.policyRefs,[delta.candidatePolicyRule.id]);assert.ok(change.sourceRows.includes('PB8'));
 }
 assert.equal(delta.unlistedAvailability,'unknown');
});
