import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gitIdentity } from './execution.mjs';
import { collectObservations } from './observations.mjs';
import { fileURLToPath } from 'node:url';
import { validateLedger, inventoryDigest, makeReport, loadIssueStates } from './ledger.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const original = JSON.parse(readFileSync(new URL('./ledger.json', import.meta.url)));
const copy = () => structuredClone(original);
function reject(change, pattern, options = {}) {
  const ledger = copy(); change(ledger); ledger.inventorySha256 = inventoryDigest(ledger);
  assert.match(validateLedger(ledger, { root, ...options }).errors.join('\n'), pattern);
}
test('reviewed inventory validates and all open cases remain uncertified', () => {
  assert.deepEqual(validateLedger(original, { root }).errors, []);
  const report = makeReport(original);
  assert.equal(report.cases.length, 8);
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
test('mismatched requires a live issue and closed issues force assessment maintenance', () => {
  reject(l => l.assessments.find(a => a.status === 'mismatched').issues = [], /missing list/);
  reject(() => {}, /not OPEN/, { issueStates: new Map([[218, 'OPEN'], [223, 'CLOSED']]) });
  assert.deepEqual(validateLedger(original, { root, issueStates: new Map([[218, 'OPEN'], [223, 'OPEN']]) }).errors, []);
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
  assert.equal(report.requirementStatus.counts.unsupported, 1);
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
  assert.deepEqual(result.errors, []); assert.equal(result.declaredCount, 51);
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
