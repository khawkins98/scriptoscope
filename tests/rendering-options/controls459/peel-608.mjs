// #608 transition (1.0.17 -> 1.0.18) is archived in corrections/608-no-cinf-unavailable.json.
// Earlier correction proofs verify their own frozen lifecycle state, so they read
// the inventory and code with the 608 delta peeled back off. Peeling is exact:
// the result must reproduce the archived 1.0.17 file hash, otherwise it throws.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const url=p=>new URL('../../../'+p,import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export const delta608=JSON.parse(readFileSync(url('tests/control-availability/corrections/608-no-cinf-unavailable.json')));
export const active608=live=>live.inventoryVersion===delta608.candidateInventoryVersion;
export function peel608(live){
 if(!active608(live))return live;
 const prior={...live,inventoryVersion:delta608.priorInventoryVersion,inventorySha256:delta608.priorInventorySha256,
  cases:live.cases.map(row=>delta608.changes.find(c=>c.id===row.id)?.before??row),
  policy:{...live.policy,rules:live.policy.rules.map(r=>r.id===delta608.candidatePolicyRule.id?delta608.priorPolicyRule:r)},
  review:live.review.previousReview};
 if(hash(JSON.stringify(prior,null,2)+'\n')!==delta608.priorFileSha256)throw Error('608 peel does not reproduce the archived 1.0.17 inventory');
 return prior;
}
/** SHA-256 of a frozen code path as it stood before 608 (verifies the 608 after-state first). */
export function codeShaBefore608(path,live){
 const actual=hash(readFileSync(url(path)));const patch=delta608.codePatches.find(p=>p.path===path);
 if(!patch||!active608(live))return actual;
 if(actual!==patch.afterSha256)throw Error(`${path} differs from the 608 after-state`);
 return patch.beforeSha256;
}
