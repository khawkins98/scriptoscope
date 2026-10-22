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
import { buildLedger, readFamilies, assemble, formatFamily, familyDigest, recordTransition, priorFamily, baseFamily, ARRAYS, LEDGER_PATH } from './build-ledger.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
// ledger.json is generated from families/*.json (build-ledger.mjs). `live` is the
// committed file; `original` is the exact 1.22.0 single-file ledger rebuilt from
// the family sources with every post-split family transition undone. The
// historical transition tests below run against `original`, so they keep
// reconstructing their prior versions byte-for-byte however families grow.
const live = JSON.parse(readFileSync(new URL('./ledger.json', import.meta.url)));
const original = buildLedger({ mode: 'base' }).ledger;
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
// Validation reads the repository documents, which now carry main 1.24.0's decode
// corrections (#377, window@1.1.0), so it checks the 1.22.0 rows with the window
// family's in-place edits and its appended kdef.too-short-step evidence: every
// family at its split state except window, which is at 1.1.0 (digest recomputed).
// Later window transitions (1.2.0 procedural-frame rows) are validated live by
// the byte-identity test below.
const code10 = JSON.parse(readFileSync(new URL('./code10-transition.json', import.meta.url)));
const atVersion = (f, version) => { let x = f; while (x.version !== version) x = priorFamily(x); return x; };
const validatable = (() => {
  const { base, families } = readFamilies();
  const ledger = assemble(base, families.map(f => f.family === 'window' ? atVersion(f, '1.1.0') : baseFamily(f))).ledger;
  for (const key of ARRAYS) assert.equal(ledger[key].length, original[key].length + (key === 'evidence' ? 1 : 0), key);
  Object.assign(ledger, { inventoryVersion: original.inventoryVersion, scope: original.scope });
  ledger.inventorySha256 = inventoryDigest(ledger);
  return ledger;
})();
const copy = () => structuredClone(validatable);
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
  assert.deepEqual(validateLedger(validatable, { root }).errors, []);
  const report = makeReport(original);
  assert.equal(report.cases.length, 198);
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
test('mismatched requires a live issue for every tracked mismatch', () => {
  const mismatch = ledger => {
    const row = ledger.assessments.find(a => a.caseId === '1138.tab.unselected.auto.agjpqy' && a.requirementId === 'tab.full-raster-coordinates');
    row.status = 'mismatched'; row.issues = [223];
    return row;
  };
  reject(l => { mismatch(l).issues = []; }, /missing list/);
  reject(l => { mismatch(l); }, /not OPEN/, { issueStates: new Map([[223, 'CLOSED'], [374, 'OPEN']]) });
  // The 18 recorded scroll-bar state mismatches (1.22.0) fail closed if #374 closes.
  assert.match(validateLedger(validatable, { root, issueStates: new Map([[374, 'CLOSED']]) }).errors.join('\n'), /scrollbar\.state-selection: tracking issue #374 is not OPEN/);
  const fixture = copy(); mismatch(fixture);
  assert.deepEqual(validateLedger(fixture, { root, issueStates: new Map([[223, 'OPEN'], [374, 'OPEN']]) }).errors, []);
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
  const result = validateLedger(validatable, { root });
  assert.deepEqual(result.errors, []); assert.equal(result.declaredCount, 1404);
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
    const errors = validateLedger(validatable, { root, read: path => {
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
    const errors=validateLedger(validatable,{root,read:path=>{const b=readFileSync(path);return path.endsWith(a.path)?Buffer.from(b.toString().replaceAll(a.marker,'removed')):b;}}).errors;
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

// 1.21.0 edits one evidence row and 13 assessments in place. Restore them to get
// the exact 1.20.0 ledger that the older append-only transitions hash.
const tileDirection=JSON.parse(readFileSync(new URL('./tile-direction-transition.json',import.meta.url)));
// 1.22.0 appends the range-control cases; truncate them to get the exact 1.21.0 ledger.
const rangeTransition=JSON.parse(readFileSync(new URL('./range-rules-transition.json',import.meta.url)));
function at121(ledger){
 const prior=structuredClone(ledger);for(const[key,count]of Object.entries(rangeTransition.counts))prior[key]=prior[key].slice(0,count);
 return Object.assign(prior,{inventoryVersion:rangeTransition.inventoryVersion,inventorySha256:rangeTransition.inventorySha256,scope:rangeTransition.scope});
}
function restore120(ledger){
 const prior=at121(ledger);
 for(const row of tileDirection.priorEvidence)prior.evidence[prior.evidence.findIndex(e=>e.id===row.id)]=row;
 for(const row of tileDirection.priorAssessments)prior.assessments[prior.assessments.findIndex(a=>a.caseId===row.caseId&&a.requirementId===row.requirementId)]=row;
 return Object.assign(prior,{inventoryVersion:tileDirection.inventoryVersion,inventorySha256:tileDirection.inventorySha256,scope:tileDirection.scope});
}
// Historical extension tests read the 1.20.0 statuses; 1.21.0 later promotes seven tile-blit rows.
const at120=restore120(original);
test('tile-direction 1.21.0 restores the exact 1.20.0 ledger; changes kdef.tile-blit, 13 tile-blit rows, and promotes exactly the seven discriminating archives',()=>{
 const prior=restore120(original),current=at121(original);
 assert.equal(digest(JSON.stringify(prior)),tileDirection.priorObjectSha256);assert.equal(inventoryDigest(prior),tileDirection.inventorySha256);
 assert.deepEqual(prior.requirements,current.requirements);assert.deepEqual(prior.cases,current.cases);
 const changed=current.assessments.filter((a,i)=>JSON.stringify(a)!==JSON.stringify(prior.assessments[i]));
 assert.equal(changed.length,13);assert(changed.every((a,i)=>a.requirementId==='window.tile-blit'&&tileDirection.priorAssessments[i].status==='unknown'));
 // PR #373 round-2 review (lanes/H/PR-REVIEW.json round2, head 28921fd7): only archives whose check fails under inverted/scaled blits.
 const seven=['1990','animals','crayon-os','dolphin-som','evolution','floppies','monkey-paradise'],slug=a=>a.caseId.replace('.window.sliced-recipes.sampled','');
 assert.deepEqual(changed.filter(a=>a.status==='verified').map(slug),seven);
 assert(changed.filter(a=>!seven.includes(slug(a))).every(a=>a.status==='unknown'));
 for(const a of changed.filter(a=>a.status==='verified')){
  assert.match(a.rationale,/fails for this archive under inverted-anchor and scaled blits/,a.caseId);
  assert.match(a.rationale,/no native capture.*grafProcs.*CopyMask order.*runtime.*Sampled sizes only.*0x6390 -> 0x11452/,a.caseId);
  assert.match(a.rationale,['animals','monkey-paradise'].includes(slug(a))?/11\/14 reverse anchor is discriminated/:/11\/14 reverse anchor is direction-neutral here and not discriminated/,a.caseId);
  assert.match(a.review,/round2.*28921fd7/,a.caseId);
 }
 assert.deepEqual(current.evidence.filter((e,i)=>JSON.stringify(e)!==JSON.stringify(prior.evidence[i])).map(e=>e.id),['kdef.tile-blit']);
 assert.deepEqual(makeReport(prior).requirementStatus.counts,{verified:153,mismatched:0,unsupported:0,unknown:886});
 assert.deepEqual(makeReport(current).requirementStatus.counts,{verified:160,mismatched:0,unsupported:0,unknown:879});
});

test('nine-state extension preserves the prior inventory and marks every 1990/Dolphin row non-discriminating',()=>{
 const transition=JSON.parse(readFileSync(new URL('./nine-state-recorded-transition.json',import.meta.url))),prior=structuredClone(at120);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 const cases=at120.cases.slice(transition.counts.cases,126),added=at120.assessments.slice(transition.counts.assessments,854);
 assert.equal(cases.length,9);assert.equal(added.length,54);assert(cases.every(c=>c.inventoryClosure.status==='open'&&c.id.endsWith('.j1223-profile')));
 assert(added.every(a=>a.status===(a.requirementId==='output.recorded-composited-face'?'verified':'unknown')));
 const at126=structuredClone(at120);for(const[key,count]of Object.entries(JSON.parse(readFileSync(new URL('./checkable-rules-transition.json',import.meta.url))).counts))at126[key]=at126[key].slice(0,count);
 const before=makeReport(prior).requirementStatus.counts,after=makeReport(at126).requirementStatus.counts;
 assert.deepEqual({verified:after.verified-before.verified,unknown:after.unknown-before.unknown},{verified:9,unknown:45});
 // Every 1990/Dolphin row, case substitution list and evidence locator/limit carries the literal marker; no 1984 one does.
 const marker=/State-non-discriminating/,shared=id=>/^recorded\.(1990|dolphin-som)\./.test(id);
 for(const a of added)assert.equal(marker.test(a.rationale),shared(a.caseId),a.caseId+'/'+a.requirementId);
 for(const c of cases)assert.equal(c.substitutions.some(s=>marker.test(s)),shared(c.id),c.id+' substitutions');
 const evidence=at120.evidence.filter(e=>e.reference?.captureId?.endsWith('.j1223'));assert.equal(evidence.length,9);
 for(const e of evidence)for(const field of ['locator','limits'])assert.equal(marker.test(e[field]),shared(e.id),e.id+'.'+field);
 // 1984 comparisons are state-discriminating, but no row claims the original selection.
 const claim=at120.assertions.find(a=>a.id==='recorded.nine-state-j1223').claim;
 assert.match(claim,/original hilite->cicn selection remains unknown for all nine/);assert.doesNotMatch(claim,/Only 1984/);
 assert(!evidence.some(e=>/discriminates? hilite->cicn selection for/.test(e.locator)));
});

test('window-chrome extension preserves all prior99 cases and671 assessments and promotes only wnd-ladder',()=>{
 const transition=JSON.parse(readFileSync(new URL('./window-chrome-transition.json',import.meta.url))),prior=structuredClone(at120);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 const added=at120.assessments.slice(671,800);assert.equal(added.length,129);
 assert(added.every(a=>a.status===(a.requirementId==='window.wnd-ladder'&&a.caseId.endsWith('.window.sliced-recipes.sampled')?'verified':'unknown')));assert.equal(added.filter(a=>a.status==='verified').length,13);
 const beforeNine=structuredClone(at120);for(const[key,count]of Object.entries(JSON.parse(readFileSync(new URL('./nine-state-recorded-transition.json',import.meta.url))).counts))beforeNine[key]=beforeNine[key].slice(0,count);
 assert.deepEqual(makeReport(beforeNine).requirementStatus.counts,{verified:131,mismatched:0,unsupported:0,unknown:669});
 const cases=at120.cases.slice(99,117);assert.equal(cases.length,18);assert(cases.every(c=>c.family==='window-chrome'&&c.inventoryClosure.status==='open'));
});

test('checkable source-rule extension preserves all prior 126 cases and 854 assessments and promotes only the 13 CICN-lane selections',()=>{
 const transition=JSON.parse(readFileSync(new URL('./checkable-rules-transition.json',import.meta.url))),prior=restore120(original);
 for(const[key,count]of Object.entries(transition.counts)){prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],key+' prefix');}
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 assert.deepEqual(makeReport(prior).requirementStatus.counts,{verified:140,mismatched:0,unsupported:0,unknown:714});
 const cases=original.cases.slice(126,144),added=original.assessments.slice(854,1039);
 assert.equal(cases.length,18);assert.equal(added.length,185);
 assert(cases.every(c=>c.family==='checkable'&&c.inventoryClosure.status==='open'&&c.options.label===''));
 const cicnLane=['1138','1984','1990','animals','apple-lisa','beos-r503','crayon-os','dolphin-som','evolution','floppies','monkey-paradise','windows-31','windows-95'];
 const promoted=a=>a.requirementId==='checkable.lane-selection'&&cicnLane.some(s=>a.caseId===`${s}.checkable.public-rows.sampled`);
 assert(added.every(a=>a.status===(promoted(a)?'verified':'unknown')));assert.equal(added.filter(a=>a.status==='verified').length,13);
 for(const a of added.filter(promoted))assert.match(a.rationale,/archive-fork-only resource chain.*original file provenance is unknown/,a.caseId);
 assert.match(added.find(a=>promoted(a)&&a.caseId.startsWith('apple-lisa.')).rationale,/non-discriminating for tier/);
 assert.match(added.find(a=>promoted(a)&&a.caseId.startsWith('animals.')).rationale,/no other file in the chain supplies -9485\/-9486/);
 assert(!JSON.stringify(original).includes('PENDING'));
 assert.deepEqual(makeReport(restore120(original)).requirementStatus.counts,{verified:153,mismatched:0,unsupported:0,unknown:886});
});

test('range-control extension preserves all prior 144 cases and 1,039 assessments; promotes 13 normal selections and records 18 state mismatches',()=>{
 const prior=at121(original);
 for(const[key,count]of Object.entries(rangeTransition.counts))assert.equal(digest(JSON.stringify(prior[key])),rangeTransition.prefixSha256[key],key+' prefix');
 assert.equal(inventoryDigest(prior),rangeTransition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),rangeTransition.priorObjectSha256);
 const cases=original.cases.slice(144),added=original.assessments.slice(1039);
 assert.equal(cases.length,54);assert.equal(added.length,365);
 assert.deepEqual(Object.fromEntries(['scrollbar','slider','progress'].map(f=>[f,cases.filter(c=>c.family===f).length])),{scrollbar:18,slider:18,progress:18});
 assert(cases.every(c=>c.inventoryClosure.status==='open'&&c.id.endsWith('.public-rows.sampled')));
 // lanes/I/REVIEW.json (head 5e10c6ab): normal-selection verified for exactly 13 archives; state-selection mismatched for all 18 under #374.
 const thirteen=['1138','1984','1990','animals','apple-platinum-2','beos-r503','black-platinum','dolphin-som','evolution','floppies','monkey-paradise','platinum-8','windows-31'],slug=a=>a.caseId.split('.')[0];
 const normal=a=>a.requirementId==='scrollbar.normal-selection',state=a=>a.requirementId==='scrollbar.state-selection';
 assert.deepEqual(added.filter(a=>a.status==='verified').map(slug),thirteen);assert(added.filter(a=>a.status==='verified').every(normal));
 assert.equal(added.filter(a=>a.status==='mismatched').length,18);assert(added.filter(a=>a.status==='mismatched').every(a=>state(a)&&JSON.stringify(a.issues)==='[374]'));
 assert(added.every(a=>a.status!=='unknown'||(!normal(a)||!thirteen.includes(slug(a)))&&!state(a)));
 for(const a of added.filter(a=>a.status==='verified')){
  assert.match(a.rationale,/^Assertion scrollbar\.selection-rules: both normal rows .*Discriminated here: orientation, normal tier and normal thumb id.*archive-fork-only resource chain; original file provenance unknown\. Selection only: not art, depth, geometry or the ppat path; no native capture\. Independent review lanes\/I\/REVIEW\.json \(head 5e10c6ab/,a.caseId);
  assert.equal(/always composite/.test(a.rationale),['apple-platinum-2','black-platinum','platinum-8'].includes(slug(a)),a.caseId);
 }
 for(const a of added.filter(state))assert.match(a.rationale,/^Mismatched \(issue #374\): .*R1: .*R2: .*every native reading/,a.caseId);
 for(const s of ['crayon-os','windows-95'])assert.match(added.find(a=>normal(a)&&slug(a)===s).rationale,/R4.*ppats with the track ids/);
 // Only the five ppat-backed archives carry scrollbar.track-pattern.
 assert.deepEqual(added.filter(a=>a.requirementId==='scrollbar.track-pattern').map(slug),['apple-lisa','crayon-os','slimes','system7-nostalgia-silver','windows-95']);
 assert(!JSON.stringify(original).includes('Awaiting independent review'));
 assert.deepEqual(makeReport(original).requirementStatus.counts,{verified:173,mismatched:18,unsupported:0,unknown:1213});
});

// ---- Per-family sources (v2 lane L3). ledger.json is generated; these tests are the CI check.
const SPLIT_SHA256 = '0b8698706ef14440e2c7faf9a644ab84dae2bf1cd133e53910315f0163be4985'; // committed 1.22.0 ledger.json at the split (origin/v2 1183816e)
const sources = readFamilies();
// Mechanism probes run on the split-time state of every family (all later transitions
// undone), so they stay valid however the live families grow.
const split = sources.families.map(baseFamily);
// Document validation needs the live window family: the repository docs carry main
// 1.24.0's corrected pinned excerpts (#377), which the split-time window rows predate.
const docSplit = split.map(f => f.family === 'window' ? sources.families.find(x => x.family === 'window') : f);
const family = name => structuredClone(split.find(f => f.family === name));
const others = name => split.filter(f => f.family !== name);
const withFamily = (f, rest = others(f.family)) => assemble(sources.base, [...rest, f].sort((a, b) => a.family.localeCompare(b.family)));
const rebuilt = text => digest(text);
// A minimal well-formed appended case for a family (dimensions as in its first case, all unknown).
function addCase(f, id) {
  const c = structuredClone(f.cases[0]); c.id = id; f.cases.push(c);
  for (const [dimension, ids] of Object.entries(c.dimensions)) if (Array.isArray(ids)) for (const requirementId of ids)
    f.assessments.push({ caseId: id, requirementId, status: 'unknown', evidence: [], assertions: [], issues: [], rationale: `Demo ${dimension} obligation.`, review: 'Demo only.' });
  return f;
}

test('committed ledger.json is byte-identical to the generator output (run build-ledger.mjs --write)', () => {
  assert.equal(readFileSync(LEDGER_PATH, 'utf8'), buildLedger().text);
  assert.deepEqual(validateLedger(live, { root }).errors, []);
});

test('the family sources rebuild the exact 1.22.0 single-file ledger at the split', () => {
  const { text } = buildLedger({ mode: 'base' });
  assert.equal(rebuilt(text), SPLIT_SHA256); assert.equal(sources.base.ledgerSha256, SPLIT_SHA256);
  assert.equal(original.inventoryVersion, '1.22.0'); assert.equal(inventoryDigest(original), original.inventorySha256);
  // Every row is owned by exactly one family file and every family file is canonical (one row per line).
  for (const f of sources.families) { assert.equal(f.text, formatFamily(f), `${f.family}.json is not canonical`); assert.equal(f.inventorySha256, familyDigest(f), f.family); }
  for (const a of ARRAYS) assert.equal(sources.families.reduce((n, f) => n + baseFamily(f)[a].length, 0), original[a].length, a);
});

const T = (f, prior, version, extra = {}) => recordTransition(f, prior, { version, summary: 's', review: 'r', scope: `Demo ${f.family} scope at ${version}.`, ...extra });

test('family sources fail closed: lost, inserted, foreign or unversioned rows', () => {
  const throws = (change, pattern, name = 'scrollbar') => { const f = family(name); change(f); assert.throws(() => withFamily(f), pattern); };
  throws(f => f.assessments.pop(), /family inventory digest changed/);
  throws(f => { f.assessments.pop(); f.inventorySha256 = familyDigest(f); }, /missing rows present at the split/);
  throws(f => { f.cases.push({ ...f.cases[0], id: 'x' }); }, /family inventory digest changed/);
  throws(f => { f.evidence.push({ ...f.evidence[0], id: 'kdef.unversioned' }); }, /family inventory digest changed/);
  throws(f => { f.evidence.push({ ...f.evidence[0], id: 'kdef.unversioned' }); f.inventorySha256 = familyDigest(f); }, /appended after the split without a family transition/);
  throws(f => { f.cases[0].family = 'tab'; f.inventorySha256 = familyDigest(f); }, /not one of scrollbar/);
  throws(f => { f.assessments.push({ ...family('tab').assessments[0] }); }, /must live in the file that owns its case/);
  throws(f => { f.assertions.push({ ...family('tab').assertions[0], id: 'demo.foreign-assertion' }); f.inventorySha256 = familyDigest(f); }, /must live with its cases/);
  throws(f => { f.requirements.push({ ...family('tab').requirements[0] }); f.inventorySha256 = familyDigest(f); }, /appended after the split without a family transition/);
  throws(f => { f.version = '1.1.0'; f.inventorySha256 = familyDigest(f); }, /without transitions is at its 1.0.0/);
  // In-place edits of split-time rows change the family digest and, if it is refreshed by hand, the rebuilt 1.22.0 bytes.
  throws(f => { f.assessments[0].review += ' edited'; }, /family inventory digest changed/, 'window');
  const f = family('window'); f.assessments[0].review += ' edited'; f.inventorySha256 = familyDigest(f); assert.notEqual(rebuilt(assemble(sources.base, [...others('window'), f], { mode: 'base' }).text), SPLIT_SHA256);
  const g = family('scrollbar'); g.cases[0].options.state = 'pressed'; g.inventorySha256 = familyDigest(g); assert.notEqual(rebuilt(assemble(sources.base, [...others('scrollbar'), g], { mode: 'base' }).text), SPLIT_SHA256);
  // A row id claimed by two families is rejected.
  const h = family('tab'); h.evidence.push(family('window').evidence[0]); assert.throws(() => assemble(sources.base, [...others('tab'), T(h, family('tab'), '1.1.0')]), /duplicate evidence row/);
});

test('a recorded family transition appends, restores in-place edits exactly and computes the aggregate', () => {
  const prior = family('scrollbar'), f = addCase(family('scrollbar'), 'demo.scrollbar.case');
  const edited = f.assessments.findIndex(a => a.status === 'mismatched'); f.assessments[edited] = { ...f.assessments[edited], rationale: 'Demo edit in place.' };
  const next = recordTransition(f, prior, { version: '1.1.0', summary: 'Demo: one case appended, one row edited.', review: 'Demo only.', scope: 'Demo scrollbar scope at 1.1.0.' });
  assert.deepEqual(next.transitions[0].replaced.assessments.map(r => r.index), [edited]);
  const back = priorFamily(next); for (const key of ['version', 'scope', 'inventorySha256', ...ARRAYS]) assert.deepEqual(back[key], prior[key], key);
  const { ledger, text } = withFamily(next);
  assert.equal(ledger.inventoryVersion, '1.22.0+scrollbar@1.1.0'); assert.equal(ledger.inventorySha256, inventoryDigest(ledger));
  assert.equal(ledger.cases.at(-1).id, 'demo.scrollbar.case'); assert.equal(text.split('\n').filter(l => l.includes('"demo.scrollbar.case"')).length, 1 + next.assessments.length - prior.assessments.length);
  // The aggregate scope states the live totals, relabels the 1.22.0 text as split-time, and carries the transition review.
  assert.match(ledger.scope.description, new RegExp(`^${ledger.cases.length} exact direct composition cases and ${ledger.assessments.length} assessments`));
  assert.match(ledger.scope.description, /At the 1\.22\.0 split: 198 exact/); assert.match(ledger.scope.review, /^At the 1\.22\.0 split: /);
  assert.deepEqual(ledger.scope.families.scrollbar, { version: '1.1.0', scope: 'Demo scrollbar scope at 1.1.0.', transitions: [{ version: '1.1.0', summary: 'Demo: one case appended, one row edited.', review: 'Demo only.' }] });
  // History is untouched: the base reconstruction still yields the exact 1.22.0 bytes.
  assert.equal(rebuilt(assemble(sources.base, [...others('scrollbar'), next], { mode: 'base' }).text), SPLIT_SHA256);
  // Tampering with a recorded prior row or count fails closed.
  const bad = structuredClone(next); bad.transitions[0].replaced.assessments[0].row.rationale = 'forged'; bad.inventorySha256 = familyDigest(bad); assert.throws(() => withFamily(bad), /prior prefix digest mismatch/);
  const short = structuredClone(next); short.transitions[0].counts.cases = 99; short.inventorySha256 = familyDigest(short); assert.throws(() => withFamily(short), /lost rows/);
  assert.throws(() => T(f, prior, '1.0.0'), /bump the family version/);
  assert.throws(() => T(f, prior, '0.9.0'), /bump the family version/);
  assert.throws(() => T(f, prior, 'v2'), /must be x\.y\.z/);
  assert.throws(() => recordTransition(f, prior, { version: '1.1.0', summary: 's', review: 'r' }), /describe the new family scope/);
  const dropped = structuredClone(f); dropped.evidence.shift(); assert.throws(() => T(dropped, prior, '1.1.0'), /changed identity|cannot disappear/);
  // A second transition chains onto the first and both undo exactly.
  const third = T(addCase(structuredClone(next), 'demo.scrollbar.case2'), structuredClone(next), '1.2.0');
  assert.equal(withFamily(third).ledger.inventoryVersion, '1.22.0+scrollbar@1.2.0'); assert.equal(baseFamily(third).inventorySha256, prior.inventorySha256);
  const regress = structuredClone(third); regress.transitions[1].version = regress.version = '1.0.5'; regress.inventorySha256 = familyDigest(regress); assert.throws(() => withFamily(regress), /does not increase/);
});

test('after a transition, rows and review text cannot change without a new transition (incl. silent promotion)', () => {
  // A legitimate transition appends a case (all unknown), an assertion for it and an evidence row.
  const prior = family('scrollbar'), f = family('scrollbar');
  const v = f.assessments.find(a => a.status === 'verified'), vc = f.cases.find(c => c.id === v.caseId);
  const c = structuredClone(vc); c.id = 'demo.sb'; f.cases.push(c);
  for (const ids of Object.values(c.dimensions)) if (Array.isArray(ids)) for (const requirementId of ids) f.assessments.push({ caseId: c.id, requirementId, status: 'unknown', evidence: [], assertions: [], issues: [], rationale: 'demo', review: 'demo' });
  f.assertions.push({ ...f.assertions.find(a => a.id === v.assertions[0]), id: 'demo.as', caseIds: ['demo.sb'] });
  f.evidence.push({ ...f.evidence[0], id: 'demo.ev' });
  const legit = T(f, prior, '1.1.0'), before = withFamily(legit);
  assert.deepEqual(validateLedger(withFamily(legit, docSplit.filter(x => x.family !== 'scrollbar')).ledger, { root }).errors, []);
  const plants = {
    'append evidence': x => x.evidence.push({ ...x.evidence[0], id: 'planted.ev' }),
    'append assertion': x => x.assertions.push({ ...x.assertions.at(-1), id: 'planted.as' }),
    'append assessment': x => x.assessments.push({ ...x.assessments.at(-1), requirementId: 'planted.req' }),
    'edit appended assessment rationale': x => { x.assessments.find(a => a.caseId === 'demo.sb').rationale = 'forged'; },
    'edit appended evidence': x => { x.evidence.find(e => e.id === 'demo.ev').claim = 'forged'; },
    'edit appended assertion': x => { x.assertions.find(a => a.id === 'demo.as').caseIds.push(vc.id); },
    'delete appended evidence': x => { x.evidence = x.evidence.filter(e => e.id !== 'demo.ev'); },
    'delete appended assertion': x => { x.assertions = x.assertions.filter(a => a.id !== 'demo.as'); },
    'edit split-time row': x => { x.assessments[0].review += ' x'; },
    'rewrite transition review': x => { x.transitions[0].review = 'forged reviewer'; },
    'rewrite transition summary': x => { x.transitions[0].summary = 'forged summary'; },
    'silent unknown->verified promotion': x => Object.assign(x.assessments.find(a => a.caseId === 'demo.sb' && a.requirementId === v.requirementId), { status: 'verified', evidence: v.evidence, assertions: ['demo.as'], rationale: 'silently promoted' }),
  };
  for (const [name, plant] of Object.entries(plants)) {
    const x = structuredClone(legit); plant(x);
    assert.throws(() => withFamily(x), /family inventory digest changed/, name);
    // Refreshing the family digest by hand is not enough: rows must equal the latest transition's recorded result.
    if (!name.startsWith('rewrite')) { x.inventorySha256 = familyDigest(x); assert.throws(() => withFamily(x), /rows differ from the state recorded by transition 1\.1\.0/, `${name} (digest refreshed)`); }
  }
  // The same promotion recorded as its own reviewed transition is accepted and visible.
  const promoted = structuredClone(legit); plants['silent unknown->verified promotion'](promoted);
  const recorded = withFamily(T(promoted, legit, '1.2.0', { summary: 'promote', review: 'independent review' })).ledger;
  assert.deepEqual(makeReport(recorded).requirementStatus.counts.verified - makeReport(before.ledger).requirementStatus.counts.verified, 1);
  assert.equal(recorded.inventoryVersion, '1.22.0+scrollbar@1.2.0'); assert.notEqual(recorded.inventorySha256, before.ledger.inventorySha256);
  assert.deepEqual(recorded.scope.families.scrollbar.transitions.map(t => t.review), ['r', 'independent review']);
});

test('independent additions to two families compose without a re-bump, in either merge order', () => {
  const mk = (name, id, v) => T(addCase(family(name), id), family(name), v, { summary: `Demo ${id}`, review: 'Demo only.' });
  const a = mk('checkable', 'demo.checkable.case', '1.1.0'), b = mk('slider', 'demo.slider.case', '1.1.0');
  const rest = split.filter(f => !['checkable', 'slider'].includes(f.family));
  const one = assemble(sources.base, [...rest, a, b]), two = assemble(sources.base, [b, ...rest, a].sort((x, y) => x.family.localeCompare(y.family)));
  assert.equal(one.text, two.text);
  assert.equal(one.ledger.inventoryVersion, '1.22.0+checkable@1.1.0,slider@1.1.0');
  assert.deepEqual(validateLedger(assemble(sources.base, [...docSplit.filter(f => !['checkable', 'slider'].includes(f.family)), a, b].sort((x, y) => x.family.localeCompare(y.family))).ledger, { root }).errors, []);
  assert.equal(rebuilt(assemble(sources.base, [...rest, a, b], { mode: 'base' }).text), SPLIT_SHA256);
});

// ---- main 1.23.0 (#376) and 1.24.0 (#377), ported into families/ at the 2026-10-22 sync.
// main's single-file tests are re-expressed against the family transitions that carry them
// (tab@1.1.0, header@1.1.0, shared@1.1.0, window@1.1.0) and against the live ledger.
const tabHeader = JSON.parse(readFileSync(new URL('./tab-header-rules-transition.json', import.meta.url)));
const liveFamily = name => sources.families.find(f => f.family === name);
const portTransition = (name, version) => { const t = liveFamily(name).transitions.find(x => x.version === version); assert(t, `${name}@${version}`); return t; };

test('tab/header source-rule port (main 1.23.0) preserves the exact 1.22.0 ledger and verifies exactly the 43 reviewed obligations', () => {
  // main's 1.22.0 prefix record is satisfied by the rebuilt base.
  for (const [key, count] of Object.entries(tabHeader.counts)) { assert.equal(original[key].length, count, key); assert.equal(digest(JSON.stringify(original[key])), tabHeader.prefixSha256[key], key + ' prefix'); }
  assert.equal(digest(JSON.stringify(original)), tabHeader.priorObjectSha256); assert.equal(inventoryDigest(original), tabHeader.inventorySha256);
  assert.deepEqual(validateLedger(live, { root }).errors, []);
  const tab = liveFamily('tab'), header = liveFamily('header'), tT = portTransition('tab', '1.1.0'), hT = portTransition('header', '1.1.0');
  const cases = [...tab.cases.slice(tT.counts.cases), ...header.cases.slice(hT.counts.cases)];
  const added = [...tab.assessments.slice(tT.counts.assessments), ...header.assessments.slice(hT.counts.assessments)];
  assert.equal(cases.length, 36); assert.equal(added.length, 324);
  assert.deepEqual([...new Set(cases.map(c => c.family))], ['tab', 'header-surface']);
  assert(cases.every(c => c.inventoryClosure.status === 'open' && c.mode === 'direct' && c.inputs.length === 1));
  const approved = {'tab.state-selection':['1138','1984','animals','crayon-os','dolphin-som','evolution','floppies','monkey-paradise','apple-platinum-2','beos-r503'].map(s=>s+'.tab.public-rows.sampled'),
   'tab.body-bands':['1138','1984','1990','animals','apple-lisa','apple-platinum-2','beos-r503','dolphin-som','evolution','floppies','monkey-paradise'].map(s=>s+'.tab.public-rows.sampled'),
   'state.header-raw-dispatch':['1138','animals','beos-r503','crayon-os','dolphin-som','floppies','monkey-paradise'].map(s=>s+'.header-surface.sampled'),
   'geometry.header-whole-surface':['1138','1984','1990','animals','apple-lisa','beos-r503','crayon-os','dolphin-som','floppies','monkey-paradise','windows-31','windows-95'].map(s=>s+'.header-surface.sampled'),
   'header.body-fill':['1990','animals','monkey-paradise'].map(s=>s+'.header-surface.sampled')};
  assert(added.every(a => a.status === (approved[a.requirementId]?.includes(a.caseId) ? 'verified' : 'unknown')), 'status set');
  assert.equal(added.filter(a => a.status === 'verified').length, 43);
  assert(added.every(a => /lanes\/J\/REVIEW\.json.*eb949514/.test(a.review))); assert(!JSON.stringify(cases).includes('Pending')); assert(!JSON.stringify(added).includes('Pending'));
  const row = (slug, req) => added.find(a => a.caseId.startsWith(slug + '.') && a.requirementId === req).rationale;
  for (const slug of ['black-platinum','platinum-8','slimes','system7-nostalgia-silver']) for (const req of ['tab.state-selection','tab.variant-fallback']) assert.match(row(slug, req), /Probable divergence.*archive-fork-only/);
  assert.match(row('apple-platinum-2','tab.state-selection'), /rear row is pixel-identical to -9974/); assert.match(row('beos-r503','tab.state-selection'), /front row is identical to -9973/);
  assert.match(row('1990','header.body-fill'), /uniform in x/); assert.match(row('animals','tab.body-bands'), /only c\/s orientation/);
  assert(!JSON.stringify([...tab.evidence.slice(tT.counts.evidence), ...header.evidence.slice(hT.counts.evidence)]).includes('window cicns'));
  const sT = portTransition('shared', '1.1.0'), shared = liveFamily('shared');
  assert.deepEqual(shared.assertions.slice(sT.counts.assertions).map(a => [a.id, a.caseIds.length]), [['tab-header.source-rules', 36]]);
  for (const key of ARRAYS) if (key !== 'assertions') assert.equal(shared[key].length, sT.counts[key], `shared ${key} unchanged by the port`);
  for (const slug of ['1984','1990','apple-lisa','evolution','windows-31','windows-95']) assert.match(added.find(a => a.caseId === `${slug}.header-surface.sampled` && a.requirementId === 'state.header-raw-dispatch').rationale, /Selection-non-discriminating/);
  for (const slug of ['1990','apple-lisa','windows-31','windows-95']) assert.match(added.find(a => a.caseId === `${slug}.tab.public-rows.sampled` && a.requirementId === 'tab.state-selection').rationale, /selection-non-discriminating/);
  // main's totals (216/18/1494 of 1,728) hold for the main lineage: the live families with the v2-only
  // scroll-bar, push-button and slider transitions undone, and window at its main-ported 1.1.0. Live,
  // the scroll-bar closure of #374 moves the 18 mismatched state-selection rows to 13 verified and 5
  // unknown (scrollbar@1.3.0), slider@1.1.0 adds 54 obligations and records 33 slider mismatches
  // against #407, and window@1.2.0 adds 25 unknown procedural-frame obligations.
  const mainLineage = assemble(sources.base, sources.families.map(f => ['scrollbar', 'push-button', 'slider'].includes(f.family) ? baseFamily(f) : f.family === 'window' ? atVersion(f, '1.1.0') : f)).ledger;
  assert.deepEqual(makeReport(mainLineage).requirementStatus.counts, { verified: 216, mismatched: 18, unsupported: 0, unknown: 1494 });
  assert.equal(makeReport(mainLineage).cases.length, 234);
  assert.deepEqual(makeReport(live).requirementStatus.counts, { verified: 229, mismatched: 33, unsupported: 0, unknown: 1545 });
  assert.equal(makeReport(live).cases.length, 234);
});

test('code-10 port (main 1.24.0) edits exactly the recorded window rows and changes no status', () => {
  const w = atVersion(liveFamily('window'), '1.1.0'), t = portTransition('window', '1.1.0'), prior = priorFamily(w);
  assert.equal(prior.version, '1.0.0'); assert.deepEqual(prior.requirements, w.requirements);
  // In-place edits are exactly main's: the replaced rows are code10-transition.json's 1.23.0 rows.
  assert.deepEqual(t.replaced.evidence.map(r => r.row), code10.priorEvidence); assert.deepEqual(t.replaced.assertions.map(r => r.row), code10.priorAssertions);
  assert.deepEqual(t.replaced.cases.map(r => r.row), code10.priorCases); assert.deepEqual(t.replaced.assessments.map(r => r.row), code10.priorAssessments);
  assert.deepEqual(t.replaced.evidence.map(r => w.evidence[r.index].id), ['kdef.width-allocation']);
  assert.deepEqual(w.evidence.slice(t.counts.evidence).map(e => e.id), ['kdef.too-short-step']);
  for (const key of ['inputs', 'requirements', 'assertions', 'cases', 'assessments']) assert.equal(w[key].length, t.counts[key], key);
  assert.deepEqual(t.replaced.assertions.map(r => w.assertions[r.index].id), ['window.recipe-rules']);
  const changed = t.replaced.assessments.map(r => w.assessments[r.index]);
  assert.equal(changed.length, 13);
  assert(changed.every((a, i) => a.requirementId === 'window.flag-gated-parts' && a.status === 'unknown' && code10.priorAssessments[i].status === 'unknown'));
  assert(changed.every(a => a.evidence.join() === 'kdef.too-short-step' && a.assertions.join() === 'window.recipe-rules'));
  const cases = t.replaced.cases.map(r => w.cases[r.index]);
  assert.equal(cases.length, 13); assert(cases.every(c => c.family === 'window-chrome' && c.options.widthOffsets[0] === -12 && c.options.heightOffsets[0] === -12));
  const count = f => f.assessments.reduce((m, a) => (m[a.status] = (m[a.status] ?? 0) + 1, m), {});
  assert.deepEqual(count(w), count(prior));
});

test('window 1.2.0 appends the procedural-frame obligations to the five corner-sprite cases and changes no status', () => {
  const w = liveFamily('window'), t = w.transitions.find(x => x.version === '1.2.0'), prior = atVersion(w, '1.1.0');
  const slugs = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
  const reqs = ['window.procedural-art-selection', 'window.procedural-geometry', 'window.procedural-sampled-colours', 'window.procedural-hilite-gating', 'window.procedural-title-mode'];
  assert.deepEqual(w.requirements.slice(t.counts.requirements).map(r => r.id), reqs);
  assert.deepEqual(w.evidence.slice(t.counts.evidence).map(e => [e.id, e.document]), ['gate', 'art', 'geometry', 'frame-lines', 'title-samples', 'text-shadow', 'title-mode'].map(k => [`kdef.procedural-frame-${k}`, 'docs/spec/engine/procedural-frame.md']));
  assert.equal(w.cases.length, prior.cases.length);
  const added = w.assessments.slice(t.counts.assessments);
  assert.deepEqual(added.map(a => `${a.caseId}/${a.requirementId}`), slugs.flatMap(s => reqs.map(r => `${s}.window.corner-sprite/${r}`)));
  assert(added.every(a => a.status === 'unknown' && a.assertions.length === 0 && a.issues.length === 0 && !/pending/i.test(a.review)));
  // In place: only the five corner-sprite cases and their corner-sprite-frame / state-frame rationales.
  assert.deepEqual(t.replaced.cases.map(r => w.cases[r.index].id), slugs.map(s => `${s}.window.corner-sprite`));
  assert.deepEqual(t.replaced.assessments.map(r => `${w.assessments[r.index].caseId}/${w.assessments[r.index].requirementId}`),
    slugs.flatMap(s => ['window.corner-sprite-frame', 'window.state-frame'].map(r => `${s}.window.corner-sprite/${r}`)).sort((a, b) => w.assessments.findIndex(x => `${x.caseId}/${x.requirementId}` === a) - w.assessments.findIndex(x => `${x.caseId}/${x.requirementId}` === b)));
  assert(t.replaced.assessments.every(r => w.assessments[r.index].status === r.row.status));
  assert.deepEqual(Object.keys(t.replaced).sort(), ['assessments', 'cases']);
  const count = f => f.assessments.reduce((m, a) => (m[a.status] = (m[a.status] ?? 0) + 1, m), {});
  assert.deepEqual(count(w), { ...count(prior), unknown: count(prior).unknown + 25 });
});
