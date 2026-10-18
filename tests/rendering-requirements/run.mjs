import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { gitIdentity } from './execution.mjs';
import { collectObservations } from './observations.mjs';
import { validateLedger, loadIssueStates, makeReport, markdownReport } from './ledger.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = new Set(process.argv.slice(2));
for (const arg of args) if (!['--check-issues', '--require-execution'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
const ledger = JSON.parse(readFileSync(new URL('./ledger.json', import.meta.url)));
let result = validateLedger(ledger, { root });
if (!result.errors.length && args.has('--check-issues')) {
  try {
    const issueStates = await loadIssueStates(result.issueIds);
    result = validateLedger(ledger, { root, issueStates });
  } catch (error) { result.errors.push(error.message); }
}
const executionFile = resolve(root, 'test-results/rendering-evidence/requirements/execution.json');
let execution;
try { execution = existsSync(executionFile) ? JSON.parse(readFileSync(executionFile)) : undefined; }
catch (error) { result.errors.push(`Malformed assertion execution evidence: ${error.message}`); }
const { executionCommit, workingTreeDirty } = gitIdentity(root);
const observations = collectObservations(root, result.errors);
if (result.errors.length) {
  const directory = resolve(root, 'test-results/rendering-evidence/requirements'); mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'report.json'), JSON.stringify({ valid: false, inventoryVersion: ledger.inventoryVersion, errors: result.errors }, null, 2) + '\n');
  writeFileSync(resolve(directory, 'report.md'), '# Invalid requirement ledger\n\n' + result.errors.map(message => '- ' + message).join('\n') + '\n');
  console.error(result.errors.join('\n')); process.exitCode = 1;
}
else {
  const report = makeReport(ledger, { execution, executionCommit, workingTreeDirty, observations, issuesChecked: args.has('--check-issues') });
  if (args.has('--require-execution')) {
    for (const assertion of report.execution.assertions) for (const mode of assertion.modes) if (mode.status !== 'passed') result.errors.push(`${assertion.id}/${mode.mode}: ${mode.status}`);
    if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  }
  const directory = resolve(root, 'test-results/rendering-evidence/requirements'); mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(directory, 'report.md'), markdownReport(report));
  console.log(markdownReport(report));
}
