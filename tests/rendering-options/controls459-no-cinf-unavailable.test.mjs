// #608 availability transition 1.0.17 -> 1.0.18 (corrections/608-no-cinf-unavailable.json).
// Proves the archive is exact and bounded: only nine rows move themed -> unavailable,
// every other byte of the 1.0.17 inventory is recoverable, and the cited PF section is pinned.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {delta608 as delta,peel608,active608} from './controls459/peel-608.mjs';
import {peel611} from './controls459/peel-611.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),hash=b=>createHash('sha256').update(b).digest('hex');
const live=peel611(read('../control-availability/expectations.json')),prior459=read('../control-availability/corrections/459-no-cinf-admission.json');
const terminal={role:'face',action:'missing',basis:'source-dispatch',usage:'paint',reason:'engine:PB9:cinf:NULL'};
test('608 transition moves exactly the nine no-cinf rows to unavailable and nothing else',()=>{
 assert.equal(delta.status,'candidate-requires-independent-review');assert.equal(delta.unlistedAvailability,'unknown');
 assert.equal(delta.priorInventoryVersion,prior459.candidateInventoryVersion,'608 follows the activated 459 no-cinf correction');
 assert.equal(delta.priorInventorySha256,prior459.prospectiveAcceptedCaseSha256);
 assert.deepEqual(delta.changes.map(c=>c.id),prior459.changes.map(c=>c.id),'the same nine finite cases');
 assert.deepEqual(delta.priorPolicyRule,prior459.candidatePolicyRule);assert.equal(delta.candidatePolicyRule.id,delta.priorPolicyRule.id);
 assert.match(delta.candidatePolicyRule.claim,/null with outcome unavailable/);
 for(const c of delta.changes){
  assert.equal(c.before.effectiveAvailability,'themed');assert.equal(c.before.proposed.outcome,'themed');
  assert.deepEqual(c.after.proposed,{...c.before.proposed,outcome:'unavailable',terminal},'only outcome and the PF3 terminal step change');
  assert.equal(c.after.reviewStatus,'draft-requires-independent-review');assert.equal(c.after.effectiveAvailability,'unknown');
  const restored=structuredClone(c.after);for(const k of ['reviewStatus','effectiveAvailability','proposed','notes'])restored[k]=c.before[k];
  assert.deepEqual(restored,c.before,'inputs, options, policyRefs, evidence and exclusions cannot change');
  if(active608(live))assert.deepEqual(live.cases.find(r=>r.id===c.id),{...c.after,reviewStatus:'reviewed',effectiveAvailability:'unavailable'});
 }
 assert.equal(live.inventorySha256,hash(JSON.stringify(live.cases)));
 if(active608(live)){
  assert.equal(live.inventoryVersion,'1.0.18');assert.equal(live.inventorySha256,delta.prospectiveAcceptedCaseSha256);
  assert.deepEqual(live.review.previousReview,delta.priorReview);assert.equal(live.review.inventorySha256,live.inventorySha256);
  assert.ok(live.review.transition.includes(delta.source.sha256)&&live.review.transition.includes(delta.priorInventorySha256));
  assert.deepEqual(live.policy.rules.filter(r=>r.id===delta.candidatePolicyRule.id),[delta.candidatePolicyRule]);
  const prior=peel608(live);assert.equal(prior.cases.length,27);assert.equal(hash(JSON.stringify(prior.cases)),delta.priorInventorySha256,'other 18 rows exact');
 }
});
test('608 archive pins its PF source section and the one code patch',()=>{
 const doc=readFileSync(new URL('../../docs/spec/engine/push-button.md',import.meta.url),'utf8');
 assert.equal(hash(doc.slice(doc.indexOf('### Public facade availability'),doc.indexOf('## 7. Test hooks'))),delta.source.pfSectionSha256,'PF rows changed: re-review the 608 transition');
 assert.deepEqual(delta.source.rows,['PF3','PF6']);
 for(const p of delta.codePatches){
  assert.equal(hash(readFileSync(new URL('../../'+p.beforeArchive,import.meta.url))),p.beforeSha256);
  assert.equal(hash(readFileSync(new URL('../../'+p.afterCandidate,import.meta.url))),p.afterSha256);
  assert.equal(hash(readFileSync(new URL('../../'+p.path,import.meta.url))),active608(live)?p.afterSha256:p.beforeSha256);
 }
 assert.equal(delta.codePatches[0].beforeSha256,prior459.inactiveCodePatches.find(p=>p.path===delta.codePatches[0].path).afterSha256,'608 starts from the 459 after-state');
});
