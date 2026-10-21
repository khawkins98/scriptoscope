import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gitIdentity } from './execution.mjs';
import { collectObservations } from './observations.mjs';
import { fileURLToPath } from 'node:url';
import { validateLedger, inventoryDigest, makeReport, loadIssueStates, digest } from './ledger.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const original = JSON.parse(readFileSync(new URL('./ledger.json', import.meta.url)));
const transition = JSON.parse(readFileSync(new URL('./header-sampling-transition.json', import.meta.url)));
// Reconstruct the unchanged pre-mixed inventory before testing its older header transition.
const mixedTransition = JSON.parse(readFileSync(new URL('./mixed-selection-transition.json', import.meta.url)));
const priorMixedLedger = structuredClone(original);
for (const [field, count] of Object.entries(mixedTransition.counts)) priorMixedLedger[field] = priorMixedLedger[field].slice(0, count);
Object.assign(priorMixedLedger, { inventoryVersion:mixedTransition.inventoryVersion, inventorySha256:mixedTransition.inventorySha256, scope:mixedTransition.scope });
const historicalHeaderLedger = structuredClone(priorMixedLedger);
historicalHeaderLedger.inventoryVersion = transition.priorInventoryVersion;
for (const [field, prior] of [['assessments', transition.priorAssessment], ['assertions', transition.priorAssertion], ['evidence', transition.priorEvidence]]) {
  const index = historicalHeaderLedger[field].findIndex(row => prior.id ? row.id === prior.id : row.caseId === prior.caseId && row.requirementId === prior.requirementId);
  historicalHeaderLedger[field][index] = prior;
}
const copy = () => structuredClone(original);
test('sampled-header transition preserves the complete prior ledger and changes one assessment only', () => {
  assert.equal(digest(JSON.stringify(historicalHeaderLedger, null, 2) + '\n'), transition.priorLedgerSha256);
  const changed = priorMixedLedger.assessments.filter((row, i) => JSON.stringify(row) !== JSON.stringify(historicalHeaderLedger.assessments[i]));
  assert.equal(changed.length, 1); assert.equal(changed[0].caseId, transition.priorAssessment.caseId);
  assert.equal(changed[0].requirementId, 'fill.sampled-line-color'); assert.equal(changed[0].status, 'verified');
  assert.deepEqual(makeReport(priorMixedLedger).requirementStatus.counts, { verified:51, mismatched:0, unsupported:0, unknown:218 });
});
function reject(change, pattern, options = {}) {
  const ledger = copy(); change(ledger); ledger.inventorySha256 = inventoryDigest(ledger);
  assert.match(validateLedger(ledger, { root, ...options }).errors.join('\n'), pattern);
}
test('reviewed inventory validates and all open cases remain uncertified', () => {
  assert.deepEqual(validateLedger(original, { root }).errors, []);
  const report = makeReport(original);
  assert.equal(report.cases.length, 144);
  assert.equal(report.requirementStatus.denominator, original.assessments.length);
  assert.equal(report.cases.filter(c => c.status === 'verified').length, 0);
  assert(report.execution.assertions.every(a => a.modes.every(m => m.status === 'not run')));
  assert.match(report.issueLiveness, /unchecked/);
});
test('missing and duplicate identities or declared assessments cannot disappear', () => {
  reject(l => l.inputs.push(l.inputs[0]), /duplicate ID/);
  reject(l => delete l.cases[0].id, /missing ID/);
  reject(l => l.assessments.pop(), /missing assessment/);
  reject(l => l.assessments.push(l.assessments[0]), /duplicate assessment/);
  reject(l => l.assessments[0].status = 'looks-good', /invalid status/);
  reject(l => l.assessments[0].requirementId = 'not-declared', /undeclared assessment/);
});
test('all dimensions and nonempty-label typography must be declared', () => {
  reject(l => delete l.cases[0].dimensions.placement, /incomplete dimension inventory/);
  reject(l => l.cases[0].dimensions.geometry = [], /missing list/);
  reject(l => l.cases[0].options.label = 'Label', /cannot exclude typography/);
  reject(l => delete l.cases[0].inventoryClosure, /missing inventory closure/);
});
test('verified requires independent evidence and an assertion for the exact case', () => {
  const verified = l => l.assessments.find(a => a.status === 'verified');
  reject(l => verified(l).evidence = [], /missing list/);
  reject(l => l.evidence.find(e => e.id === verified(l).evidence[0]).kind = 'regression', /without independent evidence/);
  reject(l => verified(l).assertions = [], /missing list/);
  reject(l => verified(l).evidence = ['art.win95-slider'], /does not establish this requirement/);
  reject(l => verified(l).assertions = ['slider.decoded-opaque-retention'], /does not cover exact case/);
  reject(l => l.assertions[0].marker = 'nonexistent assertion', /marker missing/);
});
test('source archive, excerpt and frozen obligation digests fail closed on drift', () => {
  reject(l => l.inputs.find(i => i.kind === 'theme-archive').sha256 = '0'.repeat(64), /archive digest changed/);
  reject(l => l.evidence[0].locator = 'unrecorded claim', /locator missing|excerpt changed/);
  const changed = copy(); changed.cases[0].options.height++;
  assert.match(validateLedger(changed, { root }).errors.join('\n'), /inventory digest changed/);
});
test('mismatched requires a live issue even when the reviewed inventory has no mismatches', () => {
  const mismatch = ledger => {
    const row = ledger.assessments.find(a => a.caseId === '1138.tab.unselected.auto.agjpqy' && a.requirementId === 'tab.full-raster-coordinates');
    row.status = 'mismatched'; row.issues = [223];
    return row;
  };
  reject(l => { mismatch(l).issues = []; }, /missing list/);
  reject(l => { mismatch(l); }, /not OPEN/, { issueStates: new Map([[223, 'CLOSED']]) });
  const fixture = copy(); mismatch(fixture);
  assert.deepEqual(validateLedger(fixture, { root, issueStates: new Map([[223, 'OPEN']]) }).errors, []);
});
test('issue API failure, wrong identity and pull requests never count as live issues', async () => {
  await assert.rejects(loadIssueStates([223], { fetcher: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);
  await assert.rejects(loadIssueStates([223], { fetcher: async () => ({ ok: true, json: async () => ({ number: 224, state: 'open' }) }) }), /Invalid/);
  await assert.rejects(loadIssueStates([223], { fetcher: async () => ({ ok: true, json: async () => ({ number: 223, state: 'open', pull_request: {} }) }) }), /Invalid/);
  assert.deepEqual(await loadIssueStates([223], { fetcher: async () => ({ ok: true, json: async () => ({ number: 223, state: 'open' }) }) }), new Map([[223, 'OPEN']]));
});
test('unknown and unsupported remain in denominator; open closure blocks verified case', () => {
  const ledger = copy(); ledger.assessments[0].status = 'unsupported';
  const report = makeReport(ledger);
  assert.equal(report.requirementStatus.denominator, original.assessments.length);
  assert.equal(report.requirementStatus.counts.unsupported, makeReport(original).requirementStatus.counts.unsupported + 1);
  for (const row of ledger.assessments) row.status = 'verified';
  assert(makeReport(ledger).cases.every(c => c.status === 'unknown'));
});
test('execution is separate: stale/partial/failed runs cannot become a current pass', () => {
  const id = original.assertions[0].id;
  const execution = { executionCommit: 'old', workingTreeDirty: false, assertions: [{ id, mode: 'source', path: original.assertions[0].path, status: 'passed' }] };
  assert.equal(makeReport(original, { execution, executionCommit: 'new' }).execution.assertions[0].modes[0].status, 'not run');
  const report = makeReport(original, { execution, executionCommit: 'old' });
  assert.equal(report.execution.assertions[0].modes[0].status, 'passed');
  assert.equal(report.execution.assertions[0].modes[1].status, 'not run');
  execution.assertions.push({ id, mode: 'source', path: original.assertions[0].path, status: 'failed' });
  assert.equal(makeReport(original, { execution, executionCommit: 'old' }).execution.assertions[0].modes[0].status, 'failed or incomplete');
  assert.deepEqual(report.requirementStatus, makeReport(original).requirementStatus);
});

test('matching ID from a different test path cannot satisfy execution', () => {
  const execution = { executionCommit: 'same', workingTreeDirty: false, assertions: [{ id: original.assertions[0].id, mode: 'source', path: 'tests/unrelated.spec.mjs', status: 'passed' }] };
  const mode = makeReport(original, { execution, executionCommit: 'same' }).execution.assertions[0].modes[0];
  assert.equal(mode.status, 'not run'); assert.match(mode.rejectedRuns[0].reason, /path/);
});
test('dirty, unknown cleanliness, or currently modified worktree never supplies trusted execution', () => {
  const execution = { executionCommit: 'same', workingTreeDirty: true, assertions: [{ id: original.assertions[0].id, mode: 'source', path: original.assertions[0].path, status: 'passed' }] };
  for (const workingTreeDirty of [true, null, undefined]) {
    execution.workingTreeDirty = workingTreeDirty;
    const report = makeReport(original, { execution, executionCommit: 'same' });
    assert.equal(report.execution.assertions[0].modes[0].status, 'not run'); assert.match(report.execution.freshness, /untrusted/);
  }
  execution.workingTreeDirty = false;
  assert.equal(makeReport(original, { execution, executionCommit: 'same', workingTreeDirty: true }).execution.assertions[0].modes[0].status, 'not run');
});

test('malformed observation JSON and shape append errors without hiding prior validation failure', () => {
  const temp = mkdtempSync(join(tmpdir(), 'fidelity-observations-'));
  try {
    const folder = join(temp, 'test-results/rendering-evidence/observed'); mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'broken.json'), '{'); writeFileSync(join(folder, 'shape.json'), 'null');
    const errors = ['original missing requirement'];
    assert.deepEqual(collectObservations(temp, errors), []);
    assert.equal(errors[0], 'original missing requirement'); assert.equal(errors.length, 3);
    assert.match(errors[1], /Malformed observation/); assert.match(errors[2], /Malformed observation/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('git cleanliness measures actual source changes while ignoring generated outputs', () => {
  const temp = mkdtempSync(join(tmpdir(), 'fidelity-git-'));
  const git = args => execFileSync('git', args, { cwd: temp, stdio: 'ignore' });
  try {
    git(['init']); git(['config', 'user.email', 'test@example.invalid']); git(['config', 'user.name', 'Test']);
    writeFileSync(join(temp, '.gitignore'), 'generated/\n'); writeFileSync(join(temp, 'source'), 'original');
    git(['add', '.']); git(['commit', '-m', 'fixture']);
    mkdirSync(join(temp, 'generated')); writeFileSync(join(temp, 'generated/output'), 'ignored');
    assert.equal(gitIdentity(temp).workingTreeDirty, false);
    writeFileSync(join(temp, 'source'), 'changed'); assert.equal(gitIdentity(temp).workingTreeDirty, true);
    git(['checkout', '--', 'source']); writeFileSync(join(temp, 'new-source'), 'untracked');
    assert.equal(gitIdentity(temp).workingTreeDirty, true);
    rmSync(join(temp, '.git'), { recursive: true }); assert.equal(gitIdentity(temp).workingTreeDirty, null);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('evidence from a wholly unrelated archive or synthetic input cannot support an assessment', () => {
  for (const unrelated of ['theme.windows-95', 'synthetic.ring-c3-s1']) {
    reject(l => { l.evidence.find(e => e.id === 'art.lisa-corner').inputs = [unrelated]; }, /evidence inputs do not intersect exact case inputs\/baseInputs/);
  }
});
test('engine-wide rules and combined source-art evidence retain their bounded valid uses', () => {
  const result = validateLedger(original, { root });
  assert.deepEqual(result.errors, []); assert.equal(result.declaredCount, 1039);
  assert.deepEqual(original.evidence.find(e => e.id === 'kdef.square-corners').inputs, ['engine.kaleidoscope-2.3.1-kdef0']);
  const shared = original.evidence.find(e => e.id === 'art.tab-crop');
  assert.deepEqual(shared.inputs, ['theme.1138', 'theme.1990']);
  for (const input of shared.inputs) assert(original.cases.some(c => c.inputs.includes(input) && original.assessments.some(a => a.caseId === c.id && a.evidence.includes(shared.id))));
});
test('a declared base input can satisfy the evidence join without rewriting the primary input', () => {
  const ledger = copy(), c = ledger.cases.find(c => c.id === 'lisa.push.normal.empty.h20');
  ledger.evidence.find(e => e.id === 'art.lisa-corner').inputs = ['theme.windows-95'];
  c.baseInputs = ['theme.windows-95']; ledger.inventorySha256 = inventoryDigest(ledger);
  assert.deepEqual(validateLedger(ledger, { root }).errors, []);
});
test('invalid evidence and case references report errors without throwing from the input join', () => {
  reject(l => { l.assessments[0].evidence = ['missing-evidence']; }, /invalid reference missing-evidence/);
  reject(l => { l.assessments[0].caseId = 'missing-case'; }, /undeclared assessment/);
  reject(l => { l.evidence[0].inputs = null; }, /inputs: missing list/);
});


test('1.2.0 preserves all sixteen reviewed cases and134 assessments exactly', () => {
  assert.equal(digest(JSON.stringify({ cases: original.cases.slice(0, 16), assessments: original.assessments.slice(0, 134) })),
    'd821c4ce220e1450ad09e71224610963c0e98696807df5e5aaea9acb6fc0870e');
  const historical = { ...original, cases: original.cases.slice(0, 18), assessments: original.assessments.slice(0, 150) };
  assert.equal(historical.cases.length, 18); assert.equal(historical.assessments.length, 150);
  assert.deepEqual(makeReport(historical).requirementStatus.counts, { verified: 28, mismatched: 0, unsupported: 0, unknown: 122 });
  assert(original.cases.every(c => c.inventoryClosure.status === 'open'));
  for (const row of original.assessments.slice(134,150).filter(a => a.status === 'verified')) {
    assert.equal(row.requirementId, 'fill.authored-solid-rgb16');
    assert.deepEqual(row.assertions, ['solid.selected-rgb16-literal']);
  }
});
test('new text and pattern claims fail if executable annotations or exact case scope disappear', () => {
  const ids = ['text.authored-rgb16', 'text.masked-emboss-order', 'pattern.inset-union-phase', 'pattern.exclusive-anchor-clip', 'pattern.actual-source-samples', 'tabs.full-raster-agjpqy', 'solid.selected-rgb16-literal'];
  for (const id of ids) {
    const assertion = original.assertions.find(a => a.id === id);
    assert(assertion);
    const errors = validateLedger(original, { root, read: path => {
      const bytes = readFileSync(path);
      return path.endsWith(assertion.path) ? Buffer.from(bytes.toString().replaceAll(assertion.marker, 'removed annotation')) : bytes;
    } }).errors;
    assert.match(errors.join('\n'), new RegExp(`${id}: executable assertion marker missing`));
    reject(l => { l.assertions.find(a => a.id === id).caseIds = [l.cases[0].id]; }, /assertion does not cover exact case/);
  }
});
test('new authored-color evidence cannot be reassigned to an unrelated archive', () => {
  reject(l => {
    const row = l.assessments.find(a => a.caseId === 'crayon.push.normal.H.w80.h20' && a.requirementId === 'text.authored-rgb16');
    const evidence = l.evidence.find(e => row.evidence.includes(e.id) && e.inputs.includes('theme.crayon-os'));
    assert(evidence); evidence.inputs = ['theme.windows-95'];
  }, /evidence inputs do not intersect exact case inputs\/baseInputs/);
});

test('solid evidence cannot be reassigned to an unrelated fixture', () => {
  reject(l => { l.evidence.find(e => e.id === 'fixture.solid-rgb16').inputs = ['synthetic.text.masked-owner']; }, /evidence inputs do not intersect exact case inputs\/baseInputs/);
});


test('1.3.0 preserves all eighteen cases and150 assessments and keeps new scope finite', () => {
  const priorCounts = { inputs:17, evidence:17, requirements:23, assertions:11, cases:18, assessments:150 };
  assert.equal(digest(JSON.stringify(Object.fromEntries(Object.entries(priorCounts).map(([key,n])=>[key,original[key].slice(0,n)])))),
    'e81d1e92719eae4cce474f5a0aa052c3481de3746a625ffa1eba02462831f660');
  assert.equal(digest(JSON.stringify({ cases: original.cases.slice(0,18), assessments: original.assessments.slice(0,150) })),
    'f6de24ff0f27d9c098846cae3d9a2a1052fdc1ed9d189f78689f3d95c0b7b1e8');
  const historical={...historicalHeaderLedger,cases:historicalHeaderLedger.cases.slice(0,22),assessments:historicalHeaderLedger.assessments.slice(0,195)};
  assert.deepEqual(makeReport(historical).requirementStatus.counts,{verified:36,mismatched:0,unsupported:1,unknown:158});
  assert(original.cases.every(c=>c.inventoryClosure.status==='open'));
  const unsupported=historicalHeaderLedger.assessments.slice(150).filter(a=>a.status==='unsupported');
  assert.equal(unsupported.length,1);assert.equal(unsupported[0].caseId,'synthetic.header.collision.repeat.state1.w11.h16');
  assert.match(unsupported[0].rationale,/no output or paint dependency/);
});
test('registered header/band declarations cannot lose exact executable scope or borrow unrelated art', () => {
  for(const id of ['header.whole-surface-literal','header.sampling-admission-policy','band.sampled-line-color-literal']){
    const a=original.assertions.find(a=>a.id===id);assert(a);
    const errors=validateLedger(original,{root,read:path=>{const b=readFileSync(path);return path.endsWith(a.path)?Buffer.from(b.toString().replaceAll(a.marker,'removed')):b;}}).errors;
    assert.match(errors.join('\n'),/executable assertion marker missing/);
    if(id!=='header.sampling-admission-policy')reject(l=>{l.assertions.find(a=>a.id===id).caseIds=[l.cases[0].id];},/assertion does not cover exact case/);
  }
  reject(l=>{l.evidence.find(e=>e.id==='fixture.header-overlap-literal').inputs=['synthetic.band.collision-owner'];},/evidence inputs do not intersect exact case/);
});


test('four-state extension preserves the complete prior inventory and all 62 cases / 449 assessments', () => {
  const transition = JSON.parse(readFileSync(new URL('./four-state-recorded-transition.json', import.meta.url)));
  const prior = structuredClone(original);
  for (const [key, count] of Object.entries(transition.counts)) {
    prior[key] = prior[key].slice(0, count);
    assert.equal(digest(JSON.stringify(prior[key])), transition.prefixSha256[key], `${key} prefix`);
  }
  Object.assign(prior, { inventoryVersion: transition.inventoryVersion, inventorySha256: transition.inventorySha256, scope: transition.scope });
  assert.equal(inventoryDigest(prior), transition.inventorySha256);
  assert.equal(digest(JSON.stringify(prior)), transition.priorObjectSha256);
  assert.equal(prior.cases.length, 62); assert.equal(prior.assessments.length, 449);
  assert.deepEqual(makeReport(prior).requirementStatus.counts, { verified: 81, mismatched: 0, unsupported: 0, unknown: 368 });
});

test('Animals recorded extension preserves the complete prior 66 cases and 473 assessments', () => {
  const transition = JSON.parse(readFileSync(new URL('./animals-recorded-transition.json', import.meta.url)));
  const prior = structuredClone(original);
  for (const [key, count] of Object.entries(transition.counts)) {
    prior[key] = prior[key].slice(0, count);
    assert.equal(digest(JSON.stringify(prior[key])), transition.prefixSha256[key], `${key} prefix`);
  }
  Object.assign(prior, { inventoryVersion: transition.inventoryVersion, inventorySha256: transition.inventorySha256, scope: transition.scope });
  assert.equal(inventoryDigest(prior), transition.inventorySha256);
  assert.equal(digest(JSON.stringify(prior)), transition.priorObjectSha256);
  assert.equal(prior.cases.length, 66); assert.equal(prior.assessments.length, 473);
  assert.deepEqual(makeReport(prior).requirementStatus.counts, { verified: 85, mismatched: 0, unsupported: 0, unknown: 388 });
  const added = original.assessments.slice(transition.counts.assessments, transition.counts.assessments + 18);
  assert.equal(added.length, 18);
  assert.equal(added.filter(a => a.status === 'verified').length, 3);
  assert(added.every(a => a.status === (a.requirementId === 'output.recorded-composited-face' ? 'verified' : 'unknown')));
  const animals = structuredClone(original), next = JSON.parse(readFileSync(new URL('./beos-recorded-transition.json', import.meta.url)));
  for (const [key, count] of Object.entries(next.counts)) animals[key] = animals[key].slice(0, count);
  assert.deepEqual(makeReport(animals).requirementStatus.counts, { verified: 88, mismatched: 0, unsupported: 0, unknown: 403 });
});


test('BeOS recorded extension preserves all prior 69 cases and 491 assessments', () => {
  const transition = JSON.parse(readFileSync(new URL('./beos-recorded-transition.json', import.meta.url)));
  const prior = structuredClone(original);
  for (const [key, count] of Object.entries(transition.counts)) {
    prior[key] = prior[key].slice(0, count);
    assert.equal(digest(JSON.stringify(prior[key])), transition.prefixSha256[key], `${key} prefix`);
  }
  Object.assign(prior, { inventoryVersion: transition.inventoryVersion, inventorySha256: transition.inventorySha256, scope: transition.scope });
  assert.equal(inventoryDigest(prior), transition.inventorySha256);
  assert.equal(digest(JSON.stringify(prior)), transition.priorObjectSha256);
  assert.deepEqual(makeReport(prior).requirementStatus.counts, { verified: 88, mismatched: 0, unsupported: 0, unknown: 403 });
  const added = original.assessments.slice(transition.counts.assessments, transition.counts.assessments + 18);
  assert.equal(added.length, 18);
  assert.equal(added.filter(a => a.status === 'verified').length, 3);
  assert(added.every(a => a.status === (a.requirementId === 'output.recorded-composited-face' ? 'verified' : 'unknown')));
  const current = structuredClone(original), next = JSON.parse(readFileSync(new URL('./shared307-recorded-transition.json', import.meta.url)));
  for (const [key, count] of Object.entries(next.counts)) current[key] = current[key].slice(0, count);
  assert.deepEqual(makeReport(current).requirementStatus.counts, { verified: 91, mismatched: 0, unsupported: 0, unknown: 418 });
});


test('Evolution empty extension preserves all prior 90 cases and 617 assessments', () => {
  const transition = JSON.parse(readFileSync(new URL('./evolution-recorded-transition.json', import.meta.url)));
  const prior = structuredClone(original);
  for (const [key, count] of Object.entries(transition.counts)) {
    prior[key] = prior[key].slice(0, count);
    assert.equal(digest(JSON.stringify(prior[key])), transition.prefixSha256[key], `${key} prefix`);
  }
  Object.assign(prior, { inventoryVersion: transition.inventoryVersion, inventorySha256: transition.inventorySha256, scope: transition.scope });
  assert.equal(inventoryDigest(prior), transition.inventorySha256);
  assert.equal(digest(JSON.stringify(prior)), transition.priorObjectSha256);
  assert.deepEqual(makeReport(prior).requirementStatus.counts, { verified: 109, mismatched: 0, unsupported: 0, unknown: 508 });
  const added = original.assessments.slice(transition.counts.assessments, transition.counts.assessments + 12);
  assert.equal(added.length, 12);
  assert.equal(added.filter(a => a.status === 'verified').length, 2);
  assert(added.every(a => a.status === (a.requirementId === 'output.recorded-composited-face' ? 'verified' : 'unknown')));
  const evolution = structuredClone(original), next = JSON.parse(readFileSync(new URL('./monkey-recorded-transition.json', import.meta.url)));
  for (const [key,count] of Object.entries(next.counts)) evolution[key] = evolution[key].slice(0,count);
  assert.deepEqual(makeReport(evolution).requirementStatus.counts, { verified: 111, mismatched: 0, unsupported: 0, unknown: 518 });
  assert(original.cases.slice(90).every(c => c.inventoryClosure.status === 'open'));
});


test('Monkey extension preserves all prior 92 cases and 629 assessments', () => {
  const transition=JSON.parse(readFileSync(new URL('./monkey-recorded-transition.json',import.meta.url))),prior=structuredClone(original);
  for(const [key,count]of Object.entries(transition.counts)){
    prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');
  }
  Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
  assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
  assert.deepEqual(makeReport(prior).requirementStatus.counts,{verified:111,mismatched:0,unsupported:0,unknown:518});
  const added=original.assessments.slice(transition.counts.assessments,647);assert.equal(added.length,18);assert.equal(added.filter(a=>a.status==='verified').length,3);assert(added.every(a=>a.status===(a.requirementId==='output.recorded-composited-face'?'verified':'unknown')));
  const historical=structuredClone(original),next=JSON.parse(readFileSync(new URL('./floppies-evolution-recorded-transition.json',import.meta.url)));for(const[key,count]of Object.entries(next.counts))historical[key]=historical[key].slice(0,count);
  assert.deepEqual(makeReport(historical).requirementStatus.counts,{verified:114,mismatched:0,unsupported:0,unknown:533});
  assert(original.cases.slice(92).every(c=>c.inventoryClosure.status==='open'));
});

test('Floppies/Evolution extension preserves all prior95 cases and647 assessments',()=>{
 const transition=JSON.parse(readFileSync(new URL('./floppies-evolution-recorded-transition.json',import.meta.url))),prior=structuredClone(original);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 assert.deepEqual(makeReport(prior).requirementStatus.counts,{verified:114,mismatched:0,unsupported:0,unknown:533});
 const added=original.assessments.slice(647,671);assert.equal(added.length,24);assert.equal(added.filter(a=>a.status==='verified').length,4);assert(added.every(a=>a.status===(a.requirementId==='output.recorded-composited-face'?'verified':'unknown')));
 const at117=structuredClone(original);for(const[key,count]of Object.entries(JSON.parse(readFileSync(new URL('./window-chrome-transition.json',import.meta.url))).counts))at117[key]=at117[key].slice(0,count);
 assert.deepEqual(makeReport(at117).requirementStatus.counts,{verified:118,mismatched:0,unsupported:0,unknown:553});
 assert(original.cases.slice(95).every(c=>c.inventoryClosure.status==='open'));
});

test('nine-state extension preserves the prior inventory and marks every 1990/Dolphin row non-discriminating',()=>{
 const transition=JSON.parse(readFileSync(new URL('./nine-state-recorded-transition.json',import.meta.url))),prior=structuredClone(original);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 const cases=original.cases.slice(transition.counts.cases,126),added=original.assessments.slice(transition.counts.assessments,854);
 assert.equal(cases.length,9);assert.equal(added.length,54);assert(cases.every(c=>c.inventoryClosure.status==='open'&&c.id.endsWith('.j1223-profile')));
 assert(added.every(a=>a.status===(a.requirementId==='output.recorded-composited-face'?'verified':'unknown')));
 const at126=structuredClone(original);for(const[key,count]of Object.entries(JSON.parse(readFileSync(new URL('./checkable-rules-transition.json',import.meta.url))).counts))at126[key]=at126[key].slice(0,count);
 const before=makeReport(prior).requirementStatus.counts,after=makeReport(at126).requirementStatus.counts;
 assert.deepEqual({verified:after.verified-before.verified,unknown:after.unknown-before.unknown},{verified:9,unknown:45});
 // Every 1990/Dolphin row, case substitution list and evidence locator/limit carries the literal marker; no 1984 one does.
 const marker=/State-non-discriminating/,shared=id=>/^recorded\.(1990|dolphin-som)\./.test(id);
 for(const a of added)assert.equal(marker.test(a.rationale),shared(a.caseId),a.caseId+'/'+a.requirementId);
 for(const c of cases)assert.equal(c.substitutions.some(s=>marker.test(s)),shared(c.id),c.id+' substitutions');
 const evidence=original.evidence.filter(e=>e.reference?.captureId?.endsWith('.j1223'));assert.equal(evidence.length,9);
 for(const e of evidence)for(const field of ['locator','limits'])assert.equal(marker.test(e[field]),shared(e.id),e.id+'.'+field);
 // 1984 comparisons are state-discriminating, but no row claims the original selection.
 const claim=original.assertions.find(a=>a.id==='recorded.nine-state-j1223').claim;
 assert.match(claim,/original hilite->cicn selection remains unknown for all nine/);assert.doesNotMatch(claim,/Only 1984/);
 assert(!evidence.some(e=>/discriminates? hilite->cicn selection for/.test(e.locator)));
});

test('window-chrome extension preserves all prior99 cases and671 assessments and promotes only wnd-ladder',()=>{
 const transition=JSON.parse(readFileSync(new URL('./window-chrome-transition.json',import.meta.url))),prior=structuredClone(original);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 const added=original.assessments.slice(671,800);assert.equal(added.length,129);
 assert(added.every(a=>a.status===(a.requirementId==='window.wnd-ladder'&&a.caseId.endsWith('.window.sliced-recipes.sampled')?'verified':'unknown')));assert.equal(added.filter(a=>a.status==='verified').length,13);
 const beforeNine=structuredClone(original);for(const[key,count]of Object.entries(JSON.parse(readFileSync(new URL('./nine-state-recorded-transition.json',import.meta.url))).counts))beforeNine[key]=beforeNine[key].slice(0,count);
 assert.deepEqual(makeReport(beforeNine).requirementStatus.counts,{verified:131,mismatched:0,unsupported:0,unknown:669});
 const cases=original.cases.slice(99,117);assert.equal(cases.length,18);assert(cases.every(c=>c.family==='window-chrome'&&c.inventoryClosure.status==='open'));
});

test('checkable source-rule extension preserves all prior 126 cases and 854 assessments and promotes only the 13 CICN-lane selections',()=>{
 const transition=JSON.parse(readFileSync(new URL('./checkable-rules-transition.json',import.meta.url))),prior=structuredClone(original);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 assert.deepEqual(makeReport(prior).requirementStatus.counts,{verified:140,mismatched:0,unsupported:0,unknown:714});
 const cases=original.cases.slice(126),added=original.assessments.slice(854);
 assert.equal(cases.length,18);assert.equal(added.length,185);
 assert(cases.every(c=>c.family==='checkable'&&c.inventoryClosure.status==='open'&&c.options.label===''));
 const cicnLane=['1138','1984','1990','animals','apple-lisa','beos-r503','crayon-os','dolphin-som','evolution','floppies','monkey-paradise','windows-31','windows-95'];
 const promoted=a=>a.requirementId==='checkable.lane-selection'&&cicnLane.some(s=>a.caseId===`${s}.checkable.public-rows.sampled`);
 assert(added.every(a=>a.status===(promoted(a)?'verified':'unknown')));assert.equal(added.filter(a=>a.status==='verified').length,13);
 for(const a of added.filter(promoted))assert.match(a.rationale,/archive-fork-only resource chain.*original file provenance is unknown/,a.caseId);
 assert.match(added.find(a=>promoted(a)&&a.caseId.startsWith('apple-lisa.')).rationale,/non-discriminating for tier/);
 assert.match(added.find(a=>promoted(a)&&a.caseId.startsWith('animals.')).rationale,/no other file in the chain supplies -9485\/-9486/);
 assert(!JSON.stringify(original).includes('PENDING'));
 assert.deepEqual(makeReport(original).requirementStatus.counts,{verified:153,mismatched:0,unsupported:0,unknown:886});
});
