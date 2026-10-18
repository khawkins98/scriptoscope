import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readInputs, validateInputs } from './validate.mjs';
import { sha256 } from '../control-availability/source.mjs';
const root = new URL('../../', import.meta.url);
const digest = value => sha256(JSON.stringify(value));
function tampered(change) {
  const data = structuredClone(readInputs()); change(data);
  // Reseal superficial checks to exercise the underlying source/evidence join.
  data.review.registrySourcesSha256 = digest(data.choices.sources);
  data.review.decisionsSha256 = digest(data.review.decisions);
  for (const row of data.evidence.rows) if (row.entries) row.listingSha256 = digest(row.entries);
  const evidenceBytes = Buffer.from(JSON.stringify(data.evidence)); data.review.evidenceSha256 = sha256(evidenceBytes);
  return validateInputs(data, { readFile: path => path === data.review.evidenceFile ? evidenceBytes : readFileSync(new URL(path, root)) });
}
const win = data => data.choices.sources.find(c => c.slug === 'windows-95');
const row = data => data.evidence.rows.find(c => c.slug === 'windows-95');
const decision = data => data.review.decisions.find(c => c.slug === 'windows-95');

test('18 exact reviewed inputs retain independent fork joins and explicit unknown boundaries', async () => {
  assert.deepEqual(await validateInputs(readInputs()), { reviewedContractInputs: 18, archiveSelections: 13, standaloneInputs: 5,
    independentlyCorroboratedResourceForks: 121, candidateFacts: 'unreviewed', originalResourceManagerPolicy: 'unknown', completeDecoderCorrectness: 'unknown' });
});
test('resealed wrong source index/name/fork/archive pins cannot pass', async () => {
  for (const change of [d => { win(d).entryIndex = 0; }, d => { win(d).entryName = 'wrong'; },
    d => { win(d).forkSha256 = '0'.repeat(64); }, d => { win(d).archiveSha256 = '0'.repeat(64); }]) {
    await assert.rejects(tampered(change), /entry|fork|archive/);
  }
});
test('missing and duplicate declared choices do not silently shrink the reviewed boundary', async () => {
  await assert.rejects(tampered(d => d.choices.sources.pop()), /Missing\/duplicate evidence/);
  await assert.rejects(tampered(d => d.choices.sources.push(structuredClone(win(d)))), /Duplicate source choice/);
});
test('resealed removed or forged independent fork observations fail actual full inventory join', async () => {
  await assert.rejects(tampered(d => row(d).entries.splice(row(d).entries.findIndex(e => e.resourceFork), 1)), /complete resource-fork inventory/);
  await assert.rejects(tampered(d => { row(d).entries.find(e => e.resourceFork).extractedSha256 = '0'.repeat(64); }), /complete resource-fork inventory/);
});
test('lsar index cannot substitute for the separately pinned munbox namespace', async () => {
  await assert.rejects(tampered(d => { decision(d).lsarIndex = 1; }), /scheme\/index mismatch/);
  await assert.rejects(tampered(d => { row(d).declaredForkMatches = [1, 2]; }), /ambiguous independent match/);
});
test('invented identity strings and altered content payload references fail after resealing', async () => {
  await assert.rejects(tampered(d => { row(d).entries.find(e => e.content).content.identityStrings[0].strings[0] = 'invented'; }), /identity strings disagree/);
  await assert.rejects(tampered(d => { row(d).entries.find(e => e.content).content.identityStrings[0].payloadSha256 = '0'.repeat(64); }), /identity payload drift/);
});
test('readme evidence must join actual archive bytes, not only a matching static reference', async () => {
  await assert.rejects(tampered(d => {
    const ref = decision(d).readmeRefs[0];
    row(d).entries.find(e => e.lsarIndex === ref.lsarIndex).extractedSha256 = ref.extractedSha256 = '0'.repeat(64);
  }), /readme payload not present/);
});
test('standalone raw inputs cannot acquire fabricated archive-selection approval', async () => {
  await assert.rejects(tampered(d => { d.review.decisions.find(x => x.slug === '1138').lsarIndex = 0; }), /standalone input cannot claim archive selection/);
});
test('input choice review cannot promote resource candidates or decoder truth', async () => {
  await assert.rejects(tampered(d => { d.candidates.themes[0].reviewStatus = 'reviewed'; }), /Candidate observations must remain unreviewed/);
  await assert.rejects(tampered(d => { decision(d).scope = 'decoder-certified'; }), /review exceeds declared-input scope/);
  await assert.rejects(tampered(d => { d.evidence.status = 'reviewed-decoder'; }), /Observation evidence cannot be promoted/);
});
test('stale review versions and unchanged seals reject mutations', async () => {
  const data = readInputs(); data.review.reviewVersion = '0.9.0';
  await assert.rejects(validateInputs(data), /Review version mismatch/);
  const changed = readInputs(); win(changed).selectionReason += ' changed';
  await assert.rejects(validateInputs(changed), /Reviewed registry digest drift/);
  const observation = readInputs(); row(observation).sourceByteLength++;
  await assert.rejects(validateInputs(observation), /Evidence object differs/);
});
