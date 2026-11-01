// #611 transition (1.0.18 -> 1.0.19) is archived in corrections/611-reference-labels.json.
// It is hash-only: the nine kdef231-reference.md documentSha256 pins move after the
// slot-6 dispatch labels were corrected. Earlier proofs verify their own frozen state, so
// they read the inventory with the 611 delta peeled back off (then peel608 for 1.0.17).
// Peeling is exact: the result must reproduce the archived 1.0.18 file hash, otherwise it throws.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const url=p=>new URL('../../../'+p,import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export const delta611=JSON.parse(readFileSync(url('tests/control-availability/corrections/611-reference-labels.json')));
export const active611=live=>live.inventoryVersion===delta611.candidateInventoryVersion;
export function peel611(live){
 if(!active611(live))return live;
 const {beforeSha256:before,afterSha256:after}=delta611.document;
 const swap=v=>Array.isArray(v)?v.map(swap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='documentSha256'&&x===after?before:swap(x)])):v;
 const prior={...live,inventoryVersion:delta611.priorInventoryVersion,inventorySha256:delta611.priorInventorySha256,cases:swap(live.cases),review:live.review.previousReview};
 if(hash(JSON.stringify(prior,null,2)+'\n')!==delta611.priorFileSha256)throw Error('611 peel does not reproduce the archived 1.0.18 inventory');
 return prior;
}
