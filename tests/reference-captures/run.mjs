#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readContract, knownImages, captureTemplate, assessCorpus, markdownReport, repositoryRoot } from './contract.mjs';

const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); if (i < 0) return undefined; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${flag} requires a value`); return args[i + 1]; };
for (let i = 0; i < args.length; i++) {
  if (!['--captures', '--reviews', '--output', '--template', '--scope'].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
  i++;
}
const contract = readContract();
const templateId = value('--template');
if (templateId) {
  const request = contract.requests.find(r => r.id === templateId);
  if (!request) throw new Error(`Unknown request: ${templateId}`);
  console.log(JSON.stringify({ schemaVersion: 1, captures: [captureTemplate(request, { scope: value('--scope') })] }, null, 2));
} else {
  if (value('--scope')) throw new Error('--scope requires --template');
  const capturesPath = resolve(value('--captures') ?? resolve(repositoryRoot, 'tests/reference-captures/captures.json'));
  // Reviews are maintained separately. Submitting an intake never creates or approves one.
  const reviewsPath = resolve(value('--reviews') ?? resolve(repositoryRoot, 'tests/reference-captures/reviews.json'));
  const report = assessCorpus(contract, JSON.parse(readFileSync(capturesPath)), JSON.parse(readFileSync(reviewsPath)), {
    intakeRoot: dirname(capturesPath), known: knownImages(),
  });
  const output = resolve(value('--output') ?? resolve(repositoryRoot, 'test-results/reference-captures'));
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(output, 'report.md'), markdownReport(report));
  console.log(markdownReport(report));
  // Missing requested captures are a reported research gap, not broken metadata.
  // Any submitted but ineligible original evidence makes intake fail closed.
  if (report.captures.some(c => ['partial', 'rejected', 'awaiting-independent-review'].includes(c.status))) process.exitCode = 1;
}
