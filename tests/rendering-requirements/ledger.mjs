import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
export const DIMENSIONS = ['resourceSelection', 'geometry', 'fillMask', 'typography', 'state', 'placement', 'interaction'];
export const STATUSES = ['verified', 'mismatched', 'unsupported', 'unknown'];
export const digest = value => createHash('sha256').update(value).digest('hex');
export const inventoryDigest = ledger => digest(JSON.stringify({ scope: ledger.scope, requirements: ledger.requirements, cases: ledger.cases }));
const independent = new Set(['primary-decode', 'source-art', 'period-document']);
const populated = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => /^[a-f0-9]{64}$/.test(value ?? '');

/** Structural integrity and provenance checks; never infer assessments from rendering. */
export function validateLedger(ledger, { root, read = path => readFileSync(path), issueStates } = {}) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const text = (value, name) => check(populated(value), `${name}: missing text`);
  const list = (value, name, nonempty = true) => {
    check(Array.isArray(value) && (!nonempty || value.length > 0), `${name}: missing list`);
    return Array.isArray(value) ? value : [];
  };
  const index = (rows, name) => {
    const result = new Map();
    for (const row of list(rows, name)) {
      check(row && populated(row.id), `${name}: missing ID`);
      if (!row || !populated(row.id)) continue;
      check(!result.has(row.id), `${name}: duplicate ID ${row.id}`); result.set(row.id, row);
    }
    return result;
  };
  const file = path => {
    if (!populated(path) || !root || relative(root, resolve(root, path)).startsWith('..') || path.startsWith('/')) {
      check(false, `invalid repository path: ${path}`); return null;
    }
    try { return read(resolve(root, path)); } catch { check(false, `missing repository file: ${path}`); return null; }
  };
  const refs = (ids, registry, name, nonempty = true) => {
    const values = list(ids, name, nonempty);
    check(new Set(values).size === values.length, `${name}: duplicate reference`);
    for (const id of values) check(registry.has(id), `${name}: invalid reference ${id}`);
    return values;
  };
  check(ledger.schemaVersion === 1, 'unsupported schemaVersion');
  text(ledger.inventoryVersion, 'inventoryVersion'); text(ledger.scope?.description, 'scope.description');
  check(ledger.inventorySha256 === inventoryDigest(ledger), 'inventory digest changed; review and version the declared obligations');
  const inputs = index(ledger.inputs, 'inputs'), evidence = index(ledger.evidence, 'evidence');
  const assertions = index(ledger.assertions, 'assertions'), requirements = index(ledger.requirements, 'requirements');
  const cases = index(ledger.cases, 'cases');
  for (const input of inputs.values()) {
    check(['theme-archive', 'synthetic', 'engine'].includes(input.kind), `${input.id}: invalid input kind`);
    check(hash(input.sha256), `${input.id}: missing exact input digest`);
    if (input.kind === 'theme-archive') { const bytes = file(input.path); if (bytes) check(digest(bytes) === input.sha256, `${input.id}: source archive digest changed`); }
    if (input.kind === 'synthetic') check(input.definition && digest(JSON.stringify(input.definition)) === input.sha256, `${input.id}: synthetic input digest changed`);
    if (input.kind === 'engine') { text(input.version, `${input.id}.version`); text(input.extractionReference, `${input.id}.extractionReference`); file(input.extractionReference); check(input.redistributed === false, `${input.id}: original engine must not be redistributed`); }
  }
  for (const ev of evidence.values()) {
    check([...independent, 'runtime-observation', 'regression'].includes(ev.kind), `${ev.id}: invalid evidence kind`);
    refs(ev.inputs, inputs, `${ev.id}.inputs`); refs(ev.requirementIds, requirements, `${ev.id}.requirementIds`); text(ev.claim, `${ev.id}.claim`); text(ev.limits, `${ev.id}.limits`);
    const document = file(ev.document);
    text(ev.locator, `${ev.id}.locator`);
    if (document) check(populated(ev.locator) && document.toString().includes(ev.locator), `${ev.id}: evidence locator missing`);
    check(hash(ev.excerptSha256) && digest(ev.locator ?? '') === ev.excerptSha256, `${ev.id}: evidence excerpt changed`);
    if (ev.kind === 'primary-decode') { list(ev.addresses, `${ev.id}.addresses`); check((ev.inputs ?? []).some(id => inputs.get(id)?.kind === 'engine'), `${ev.id}: decode needs identified engine`); }
  }
  for (const assertion of assertions.values()) {
    const body = file(assertion.path); text(assertion.marker, `${assertion.id}.marker`);
    if (body) check(populated(assertion.marker) && body.toString().includes(assertion.marker), `${assertion.id}: executable assertion marker missing`);
    refs(assertion.caseIds, cases, `${assertion.id}.caseIds`); text(assertion.claim, `${assertion.id}.claim`);
    check(JSON.stringify(assertion.modes) === JSON.stringify(['source', 'built']), `${assertion.id}: declare both execution modes`);
  }
  for (const requirement of requirements.values()) { text(requirement.claim, `${requirement.id}.claim`); check(DIMENSIONS.includes(requirement.dimension), `${requirement.id}: invalid dimension`); }
  const declared = new Map();
  for (const c of cases.values()) {
    refs(c.inputs, inputs, `${c.id}.inputs`); refs(c.baseInputs, inputs, `${c.id}.baseInputs`, false);
    text(c.family, `${c.id}.family`); check(c.options && typeof c.options === 'object' && !Array.isArray(c.options), `${c.id}: missing exact options`);
    check(c.mode === 'direct', `${c.id}: initial inventory only declares direct composition`);
    check(c.dimensions && Object.keys(c.dimensions).length === DIMENSIONS.length, `${c.id}: incomplete dimension inventory`);
    const closure = c.inventoryClosure;
    check(['open', 'closed'].includes(closure?.status), `${c.id}: missing inventory closure`); text(closure?.reason, `${c.id}.closure.reason`);
    if (closure?.status === 'closed') text(closure.review, `${c.id}.closure.review`);
    for (const dimension of DIMENSIONS) {
      const value = c.dimensions?.[dimension];
      if (value && !Array.isArray(value) && populated(value.excluded)) { text(value.review, `${c.id}.${dimension}.exclusion.review`); continue; }
      for (const id of refs(value, requirements, `${c.id}.${dimension}`)) {
        check(requirements.get(id)?.dimension === dimension, `${c.id}/${id}: wrong dimension`);
        const key = `${c.id}/${id}`; check(!declared.has(key), `duplicate obligation ${key}`); declared.set(key, c);
      }
    }
    if (populated(c.options?.label)) check(Array.isArray(c.dimensions?.typography), `${c.id}: nonempty label cannot exclude typography`);
    list(c.substitutions, `${c.id}.substitutions`, false);
  }
  const assessments = new Map(), issueIds = new Set();
  for (const row of list(ledger.assessments, 'assessments')) {
    const key = `${row.caseId}/${row.requirementId}`;
    check(!assessments.has(key), `duplicate assessment ${key}`); assessments.set(key, row);
    check(declared.has(key), `undeclared assessment ${key}`); check(STATUSES.includes(row.status), `${key}: invalid status`);
    text(row.rationale, `${key}.rationale`); text(row.review, `${key}.review`);
    const evIds = refs(row.evidence, evidence, `${key}.evidence`, row.status === 'verified' || row.status === 'mismatched');
    const c = cases.get(row.caseId);
    const caseInputs = new Set([...(Array.isArray(c?.inputs) ? c.inputs : []), ...(Array.isArray(c?.baseInputs) ? c.baseInputs : [])]);
    for (const id of evIds) {
      const ev = evidence.get(id);
      check(ev?.requirementIds?.includes(row.requirementId), `${key}: evidence does not establish this requirement`);
      // Engine-only source rules can apply generally. Named art/fixture inputs
      // must overlap this case, but overlap does not authenticate every option.
      const specific = (Array.isArray(ev?.inputs) ? ev.inputs : []).filter(input => inputs.get(input)?.kind !== 'engine');
      if (specific.length) check(specific.some(input => caseInputs.has(input)), `${key}: evidence inputs do not intersect exact case inputs/baseInputs (${id})`);
    }
    const assertionIds = refs(row.assertions, assertions, `${key}.assertions`, row.status === 'verified');
    if (row.status === 'verified') {
      check(evIds.some(id => independent.has(evidence.get(id)?.kind)), `${key}: verified without independent evidence`);
      for (const id of assertionIds) check(assertions.get(id)?.caseIds?.includes(row.caseId), `${key}: assertion does not cover exact case`);
    }
    const issues = list(row.issues, `${key}.issues`, row.status === 'mismatched');
    for (const issue of issues) check(Number.isSafeInteger(issue) && issue > 0, `${key}: invalid tracking issue`);
    if (row.status === 'mismatched') for (const issue of issues) { issueIds.add(issue); if (issueStates) check(issueStates.get(issue) === 'OPEN', `${key}: tracking issue #${issue} is not OPEN`); }
  }
  for (const key of declared.keys()) check(assessments.has(key), `missing assessment ${key}`);
  return { errors, issueIds: [...issueIds], declaredCount: declared.size };
}

export async function loadIssueStates(ids, { fetcher = fetch, token = process.env.GITHUB_TOKEN, repository = 'khawkins98/scriptoscope' } = {}) {
  const states = new Map();
  for (const id of ids) {
    const response = await fetcher(`https://api.github.com/repos/${repository}/issues/${id}`, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!response.ok) throw new Error(`Cannot verify issue #${id}: HTTP ${response.status}`);
    const issue = await response.json();
    if (issue.number !== id || issue.pull_request || !['open', 'closed'].includes(issue.state)) throw new Error(`Invalid tracking issue response #${id}`);
    states.set(id, issue.state.toUpperCase());
  }
  return states;
}

export function makeReport(ledger, { execution, executionCommit, workingTreeDirty = false, observations = [], issuesChecked = false } = {}) {
  const counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
  for (const row of ledger.assessments) counts[row.status]++;
  const freshness = !execution ? 'not supplied' : !executionCommit || execution.executionCommit !== executionCommit ? 'stale or unidentified commit; ignored' : execution.workingTreeDirty !== false || workingTreeDirty !== false ? 'dirty or unknown worktree; untrusted, ignored' : !Array.isArray(execution.assertions) ? 'invalid assertion records; ignored' : 'current and clean';
  const current = freshness === 'current and clean';
  const assertions = ledger.assertions.map(assertion => {
    const records = current ? execution.assertions.filter(row => row.id === assertion.id) : [];
    return { id: assertion.id, modes: assertion.modes.map(mode => {
      const runs = records.filter(row => row.mode === mode && row.path === assertion.path);
      const rejectedRuns = records.filter(row => row.mode === mode && row.path !== assertion.path).map(row => ({ ...row, reason: 'observed test path does not match registry' }));
      return { mode, status: runs.length === 0 ? 'not run' : runs.every(row => row.status === 'passed') ? 'passed' : 'failed or incomplete', runs, rejectedRuns };
    }) };
  });
  const cases = ledger.cases.map(c => {
    const rows = ledger.assessments.filter(a => a.caseId === c.id);
    const allVerified = rows.length > 0 && rows.every(a => a.status === 'verified');
    const status = rows.some(a => a.status === 'mismatched') ? 'mismatched' : rows.some(a => a.status === 'unsupported') ? 'unsupported' : c.inventoryClosure.status === 'closed' && allVerified ? 'verified' : 'unknown';
    return { id: c.id, status, inventoryClosure: c.inventoryClosure, declaredRequirements: rows.length, verifiedRequirements: rows.filter(a => a.status === 'verified').length, exclusions: Object.entries(c.dimensions).filter(([,v]) => v.excluded).map(([dimension,v]) => ({ dimension, ...v })), substitutions: c.substitutions };
  });
  return { schemaVersion: 1, inventoryVersion: ledger.inventoryVersion, inventorySha256: ledger.inventorySha256,
    scope: ledger.scope, inputs: ledger.inputs, evidence: ledger.evidence, requirements: ledger.requirements, assessments: ledger.assessments, requirementStatus: { denominator: ledger.assessments.length, counts }, cases,
    wholeControlCertification: 'Not claimed. This is a partial inventory; open cases cannot be verified.',
    issueLiveness: issuesChecked ? 'checked against live GitHub issue state' : 'unchecked (offline)',
    execution: { executionCommit, evidenceCommit: execution?.executionCommit ?? null, freshness, workingTreeDirty, evidenceWorkingTreeDirty: execution?.workingTreeDirty ?? null, assertions },
    regressionObservations: { evidence: 'observed-execution; not independent fidelity or expected availability', files: observations } };
}
export function markdownReport(report) {
  const lines = [`# Rendering requirement inventory ${report.inventoryVersion}`, '', report.wholeControlCertification, '',
    `Declared requirement denominator: **${report.requirementStatus.denominator}**. Unknown and unsupported obligations remain included.`, '',
    '| Requirement status | Count |', '| --- | ---: |', ...Object.entries(report.requirementStatus.counts).map(([status,n]) => `| ${status} | ${n} |`), '',
    '| Exact case | Status | Inventory closure | Verified / declared obligations |', '| --- | --- | --- | ---: |',
    ...report.cases.map(c => `| ${c.id} | ${c.status} | ${c.inventoryClosure.status} | ${c.verifiedRequirements} / ${c.declaredRequirements} |`), '',
    `Issue liveness: ${report.issueLiveness}.`, '', `Execution evidence: ${report.execution.freshness}; commit ${report.execution.executionCommit ?? 'unavailable'}.`, '',
    '| Assertion | Source | Built |', '| --- | --- | --- |', ...report.execution.assertions.map(a => `| ${a.id} | ${a.modes.find(m=>m.mode==='source')?.status} | ${a.modes.find(m=>m.mode==='built')?.status} |`), '',
    '## Requirement-level assessments', '', '| Case / requirement | Status | Evidence | Tracking |', '| --- | --- | --- | --- |', ...report.assessments.map(a => `| ${a.caseId} / ${a.requirementId} | ${a.status} | ${a.evidence.join(', ') || 'missing / unknown'} | ${a.issues.map(id=>'#'+id).join(', ')} |`), '', '## Explicit exclusions and substitutions', ''];
  for (const c of report.cases) for (const ex of c.exclusions) lines.push(`- ${c.id}, ${ex.dimension}: ${ex.excluded}`);
  for (const c of report.cases) for (const substitution of c.substitutions) lines.push(`- ${c.id}: substitution ${substitution}`);
  lines.push('', `Regression observation files: ${report.regressionObservations.files.length}. These record executions/availability, not independent truth.`, '', 'The JSON companion retains exact observation paths, input provenance and assertion runs.');
  return lines.join('\n') + '\n';
}
