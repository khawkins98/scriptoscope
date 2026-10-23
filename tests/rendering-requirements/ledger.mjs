import {iconCaseIds,validateIconCase,verifyIconFixtures} from './icon-cases.mjs';
import {sliderCaseIds,validateSliderCase,verifySliderFixtures} from './slider-cases.mjs';
import {mixedCaseIds,validateMixedCase,verifyMixedFixtures} from './mixed-cases.mjs';
import {bitmapCaseIds,validateBitmapCase,verifyBitmapFixtures} from './bitmap-cases.mjs';
import {readRecordedContext,validateRecordedBinding,REQUIREMENT} from './recorded-face.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readOriginal } from '../helpers/compact-json.mjs';
import { resolve, relative } from 'node:path';
export const DIMENSIONS = ['resourceSelection', 'geometry', 'fillMask', 'typography', 'state', 'placement', 'interaction'];
export const STATUSES = ['verified', 'mismatched', 'unsupported', 'unknown'];
export const digest = value => createHash('sha256').update(value).digest('hex');
export const inventoryDigest = ledger => digest(JSON.stringify({ scope: ledger.scope, requirements: ledger.requirements, cases: ledger.cases }));
const independent = new Set(['primary-decode', 'source-art', 'period-document', 'scoped-original']);
const populated = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => /^[a-f0-9]{64}$/.test(value ?? '');

/** Structural integrity and provenance checks; never infer assessments from rendering. */
export function validateLedger(ledger, { root, read = path => readOriginal(path), issueStates } = {}) {
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
  // Only the two reviewed issue459 aggregate comparisons can be superseded.
  // Their identities remain visible; replacement assertions still require execution.
  const supersedable = new Map([
    ['recorded.empty-face-six', ['system7-nostalgia-silver']],
    ['recorded.shared307-eighteen', ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes']],
  ]);
  for (const assertion of assertions.values()) if (assertion.executionDisposition !== undefined) {
    const d = assertion.executionDisposition, name = `${assertion.id}: superseded comparison`;
    check(supersedable.has(assertion.id), `${name}: not an authorized aggregate`);
    check(d?.status === 'superseded-unassessed', `${name}: invalid disposition`);
    text(d?.rationale, `${name}.rationale`); text(d?.review, `${name}.review`);
    const amendment = ledger.scope?.families?.['push-button']?.transitions?.find(t => t.version === d?.transitionVersion);
    check(Boolean(amendment && amendment.review === d?.review), `${name}: missing reviewed family transition`);
    const replacementIds = refs(d?.replacements, assertions, `${name}.replacements`);
    const retained = list(d?.retainedCaseIds, `${name}.retainedCaseIds`);
    const expectedRetained = assertion.caseIds.filter(id => !(supersedable.get(assertion.id) ?? []).some(slug => id.startsWith(`recorded.${slug}.`)));
    check(JSON.stringify(retained) === JSON.stringify(expectedRetained), `${name}: retained coverage differs from reviewed comparable cases`);
    const replacementCases = [];
    for (const id of replacementIds) {
      const replacement = assertions.get(id);
      check(id !== assertion.id && replacement && replacement.executionDisposition === undefined, `${name}: replacement must be active (no missing, cyclic or retired replacement)`);
      if (replacement) replacementCases.push(...replacement.caseIds);
    }
    check(new Set(replacementCases).size === replacementCases.length && JSON.stringify([...replacementCases].sort()) === JSON.stringify([...retained].sort()), `${name}: replacement coverage must equal retained comparable cases`);
    check(!ledger.assessments.some(row => row.status === 'verified' && row.assertions?.includes(assertion.id)), `${name}: verified reference to unassessed aggregate`);
    for (const caseId of assertion.caseIds) {
      const row = ledger.assessments.find(r => r.caseId === caseId && r.requirementId === REQUIREMENT);
      if (retained.includes(caseId)) check(row?.status === 'verified' && row.assertions?.length === 1 && replacementIds.includes(row.assertions[0]), `${name}: retained output must cite active replacement`);
      else check(row?.status === 'unknown' && row.assertions?.length === 0, `${name}: withdrawn output must remain unknown without execution claim`);
    }
  }
  for (const requirement of requirements.values()) { text(requirement.claim, `${requirement.id}.claim`); check(DIMENSIONS.includes(requirement.dimension), `${requirement.id}: invalid dimension`); }
  let recordedContext;
  if (ledger.evidence?.some(e=>e.kind==='scoped-original')) {
    try { recordedContext=readRecordedContext(root); } catch(error) { check(false,error.message); }
  }
  if (ledger.cases?.some(c=>bitmapCaseIds.includes(c.id))) {
    try {verifyBitmapFixtures(root);} catch(error) {check(false,error.message);}
  }
  if (ledger.cases?.some(c=>mixedCaseIds.includes(c.id))) {
    try {verifyMixedFixtures(root);} catch(error) {check(false,error.message);}
  }
  const declared = new Map();
  if (ledger.cases?.some(c=>sliderCaseIds.includes(c.id))) {
    try {verifySliderFixtures(root);} catch(error) {check(false,error.message);}
  }
  if (ledger.cases?.some(c=>iconCaseIds.includes(c.id))) {
    try {verifyIconFixtures(root);} catch(error) {check(false,error.message);}
  }
  for (const c of cases.values()) {
    if (iconCaseIds.includes(c.id)) {try {validateIconCase(c,inputs.get(c.inputs?.[0]));} catch(error) {check(false,`${c.id}: ${error.message}`);}}
    if (sliderCaseIds.includes(c.id)) {try {validateSliderCase(c,inputs.get(c.inputs?.[0]));} catch(error) {check(false,`${c.id}: ${error.message}`);}}
    if (mixedCaseIds.includes(c.id)) {try {validateMixedCase(c,inputs.get(c.inputs?.[0]));} catch(error) {check(false,`${c.id}: ${error.message}`);}}
    if (bitmapCaseIds.includes(c.id)) {try {validateBitmapCase(c,inputs.get(c.inputs?.[0]));} catch(error) {check(false,`${c.id}: ${error.message}`);}}
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
      if(ev?.kind==='scoped-original') {
        check(row.requirementId===REQUIREMENT && JSON.stringify(ev.requirementIds)===JSON.stringify([REQUIREMENT]), `${key}: scoped observation cannot verify broad requirements`);
        if(recordedContext) try { validateRecordedBinding(c,ev.reference,recordedContext); } catch(error) { check(false,`${key}: ${error.message}`); }
      }
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
    const records = (current || assertion.executionDisposition) && Array.isArray(execution?.assertions) ? execution.assertions.filter(row => row.id === assertion.id) : [];
    return { id: assertion.id, ...(assertion.executionDisposition ? { executionDisposition: assertion.executionDisposition, rejectedExecutionRecords: records } : {}), modes: assertion.modes.map(mode => {
      const runs = records.filter(row => row.mode === mode && row.path === assertion.path);
      const rejectedRuns = records.filter(row => row.mode === mode && row.path !== assertion.path).map(row => ({ ...row, reason: 'observed test path does not match registry' }));
      if (assertion.executionDisposition) return { mode, status: 'unassessed', runs: [], rejectedRuns: [...runs, ...rejectedRuns].map(row => ({ ...row, reason: 'superseded aggregate is unassessed; execution cannot establish it' })) };
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
    recordedConditionComparisons: { claim: 'Only exact composited pixels under the explicit measured profile; no whole-control percentage.', cases: cases.filter(c=>ledger.cases.find(x=>x.id===c.id)?.recordedComparison).map(c=>({...c, execution: assertions.find(a=>a.id===ledger.assessments.find(r=>r.caseId===c.id&&r.requirementId===REQUIREMENT)?.assertions[0])?.modes ?? []})) },
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
  if(report.recordedConditionComparisons.cases.length) lines.push('', '## Recorded-condition comparisons', '', report.recordedConditionComparisons.claim, '', ...report.recordedConditionComparisons.cases.map(c=>`- ${c.id}: ${c.verifiedRequirements} narrow verified obligation; closure ${c.inventoryClosure.status}; execution ${c.execution.map(m=>m.mode+': '+m.status).join(', ')}.`));
  for (const a of report.execution.assertions.filter(a => a.executionDisposition)) lines.push(`- ${a.id}: UNASSESSED (superseded aggregate). ${a.executionDisposition.rationale} Active replacements: ${a.executionDisposition.replacements.join(', ')}.`);
  lines.push('', `Regression observation files: ${report.regressionObservations.files.length}. These record executions/availability, not independent truth.`, '', 'The JSON companion retains exact observation paths, input provenance and assertion runs.');
  return lines.join('\n') + '\n';
}

/** Fail closed for all active assertions and any claimed pass for retired comparisons. */
export function requiredExecutionErrors(report) {
  const errors = [];
  for (const assertion of report.execution.assertions) {
    if (assertion.executionDisposition) {
      if (assertion.rejectedExecutionRecords.some(run => run.status === 'passed')) errors.push(`${assertion.id}: forged passed evidence for unassessed aggregate`);
    } else for (const mode of assertion.modes) if (mode.status !== 'passed') errors.push(`${assertion.id}/${mode.mode}: ${mode.status}`);
  }
  return errors;
}
