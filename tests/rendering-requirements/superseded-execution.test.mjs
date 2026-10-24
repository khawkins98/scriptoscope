import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateLedger,makeReport,requiredExecutionErrors} from './ledger.mjs';
import {readFamilies,priorFamily,ARRAYS} from './build-ledger.mjs';
import Reporter from './reporter.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
const retired=['recorded.empty-face-six','recorded.shared307-eighteen'];
const active=['recorded.windows95-three-state','recorded.shared307-comparable-six'];
const makeExecution=()=>({executionCommit:'current',workingTreeDirty:false,assertions:ledger.assertions.filter(a=>!a.executionDisposition).flatMap(a=>a.modes.map(mode=>({id:a.id,path:a.path,mode,status:'passed'})))});
// Synthetic records below test accounting only; never saved as execution evidence.
const report=(execution=makeExecution(),extra={})=>makeReport(ledger,{execution,executionCommit:'current',...extra});
const mutate=fn=>{const x=structuredClone(ledger);fn(x);return validateLedger(x,{root}).errors.join('\n');};
const aggregate=x=>x.assertions.find(a=>a.id===retired[0]);
test('issue459 amendment conserves complete prior family and changes only15 statuses and9 references',()=>{
 const f=readFamilies().families.find(f=>f.family==='push-button'),p=priorFamily(f);
 assert.equal(p.version,'1.0.2');assert.equal(f.version,'1.0.3');
 for(const key of ARRAYS.filter(k=>!['assertions','assessments'].includes(k)))assert.deepEqual(f[key],p[key]);
 assert.deepEqual(f.transitions.slice(0,-1),p.transitions);
 assert.equal(f.assessments.length,p.assessments.length);assert.equal(ledger.assessments.length,1832);
 const changed=f.assessments.flatMap((r,i)=>JSON.stringify(r)!==JSON.stringify(p.assessments[i])?[{now:r,prior:p.assessments[i]}]:[]);
 assert.equal(changed.length,24);
 assert.equal(changed.filter(r=>r.now.status!==r.prior.status).length,15);
 for(const r of changed)if(r.now.status!==r.prior.status){assert.equal(r.prior.status,'verified');assert.equal(r.now.status,'unknown');assert.deepEqual(r.now.evidence,r.prior.evidence);assert.deepEqual(r.now.assertions,[]);}else{assert.equal(r.now.status,'verified');assert.deepEqual({...r.now,assertions:r.prior.assertions},r.prior);}
 for(const [i,a]of p.assertions.entries())if(retired.includes(a.id))assert.deepEqual({...f.assertions[i],executionDisposition:undefined},{...a,executionDisposition:undefined});else assert.deepEqual(f.assertions[i],a);
 assert.deepEqual(f.assertions.slice(p.assertions.length).map(a=>[a.id,a.caseIds.length]),[[active[0],3],[active[1],6]]);
 assert.deepEqual(report().requirementStatus,{denominator:1832,counts:{verified:325,mismatched:0,unsupported:6,unknown:1501}});
 assert.deepEqual(validateLedger(ledger,{root}).errors,[]);
});
test('all active execution remains required; superseded IDs stay visibly unassessed',()=>{
 const r=report();assert.deepEqual(requiredExecutionErrors(r),[]);
 for(const id of retired)assert(r.execution.assertions.find(a=>a.id===id).modes.every(m=>m.status==='unassessed'&&m.runs.length===0));
 for(const id of active)for(const mode of ['source','built']){
  const e=makeExecution();e.assertions=e.assertions.filter(a=>a.id!==id||a.mode!==mode);assert(requiredExecutionErrors(report(e)).some(s=>s.startsWith(`${id}/${mode}: not run`)));
 }
 for(const e of [undefined,{...makeExecution(),executionCommit:'wrong'},{...makeExecution(),workingTreeDirty:true},{...makeExecution(),workingTreeDirty:null}]){
  const r=makeReport(ledger,{execution:e,executionCommit:'current'});assert(requiredExecutionErrors(r).length>0);
 }
 assert(requiredExecutionErrors(report(makeExecution(),{workingTreeDirty:true})).length>0);
 const e=makeExecution();e.assertions.find(a=>a.id===active[0]).status='unassessed';assert(requiredExecutionErrors(report(e)).some(s=>s.includes('failed or incomplete')));
});
test('passed evidence cannot revive retired aggregates even with wrong path, stale or dirty identity',()=>{
 for(const id of retired)for(const path of ['tests/rendering-options/display-profile.spec.mjs','tests/forged.spec.mjs'])for(const executionCommit of ['current','wrong'])for(const mode of ['source','built','unrecognized']){
  const e=makeExecution();e.executionCommit=executionCommit;e.assertions.push({id,path,mode,status:'passed'});
  assert(requiredExecutionErrors(report(e)).some(s=>s.includes('forged passed evidence')));
 }
});
test('unsafe retirement attempts fail closed',()=>{
 const probes=[
  [x=>{x.assertions[0].executionDisposition=structuredClone(aggregate(x).executionDisposition);},/not an authorized aggregate/],
  [x=>{aggregate(x).executionDisposition.status='skip';},/invalid disposition/],
  [x=>{delete aggregate(x).executionDisposition.review;},/missing text|missing reviewed family transition/],
  [x=>{aggregate(x).executionDisposition.transitionVersion='9.9.9';},/missing reviewed family transition/],
  [x=>{aggregate(x).executionDisposition.replacements=[];},/missing list|coverage/],
  [x=>{aggregate(x).executionDisposition.replacements=['missing'];},/invalid reference|must be active/],
  [x=>{aggregate(x).executionDisposition.replacements=[retired[1]];},/must be active/],
  [x=>{aggregate(x).executionDisposition.replacements=[retired[0]];},/must be active/],
  [x=>{aggregate(x).executionDisposition.retainedCaseIds.pop();},/retained coverage/],
  [x=>{x.assertions.find(a=>a.id===active[0]).caseIds.pop();},/replacement coverage/],
  [x=>{x.assertions.find(a=>a.id===active[0]).caseIds.push(aggregate(x).caseIds.at(-1));},/replacement coverage/],
  [x=>{x.assessments.find(a=>a.assertions.includes(active[0])).assertions=[retired[0]];},/verified reference/],
  [x=>{const r=x.assessments.find(a=>a.caseId.includes('system7-nostalgia-silver')&&a.requirementId==='output.recorded-composited-face');r.status='verified';r.assertions=[active[0]];},/withdrawn output/],
 ];
 for(const [fn,pattern]of probes)assert.match(mutate(fn),pattern);
});
test('actual reporter ignores unassessed annotations and records active assertion result only',()=>{
 const reporter=new Reporter();reporter.assertions=[];
 reporter.onTestEnd({annotations:[{type:'native-comparison-unassessed',description:retired[0]},{type:'fidelity-assertion',description:active[0]}],parent:{project:()=>({name:'unit',use:{browserName:'chromium',deviceScaleFactor:1}})},title:'source: accounting',location:{file:fileURLToPath(new URL('../rendering-options/display-profile.spec.mjs',import.meta.url))}},{status:'passed',retry:0,duration:1});
 assert.deepEqual(reporter.assertions.map(a=>a.id),[active[0]]);
});
