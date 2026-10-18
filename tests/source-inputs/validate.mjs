import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { enumerateForks, selectFork, sha256 } from '../control-availability/source.mjs';
import { decodeArchive } from '../../tools/sit-wasm/index.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const check = (ok, message) => { if (!ok) throw new Error(message); };
const equal = (a, b, message) => check(isDeepStrictEqual(a, b), message);
const hash = value => sha256(JSON.stringify(value));
const one = (items, predicate, label) => {
  const found = items.filter(predicate); check(found.length === 1, `${label}: expected one reference`); return found[0];
};
export const readInputs = () => ({ choices: json('tests/control-availability/source-choices.json'),
  evidence: json('tests/source-inputs/evidence.json'), review: json('tests/source-inputs/review.json'),
  candidates: json('tests/control-availability/source-candidates.json') });
function strings(resource) {
  const bytes = resource.data, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decode = bytes => new TextDecoder('macintosh').decode(bytes);
  if (resource.type === 'TEXT') return [decode(bytes)];
  let offset = resource.type === 'vers' ? 6 : resource.type === 'STR#' ? 2 : 0;
  const count = resource.type === 'vers' ? 2 : resource.type === 'STR#' ? view.getUint16(0) : 1, result = [];
  for (let i = 0; i < count; i++) {
    check(offset < bytes.length, 'Missing identity-string length'); const size = bytes[offset++];
    check(size <= bytes.length - offset, 'Truncated identity string'); result.push(decode(bytes.subarray(offset, offset + size))); offset += size;
  }
  return result;
}
function validateContent(content, bytes, decision) {
  const resources = parseResourceFork(bytes), types = {};
  for (const resource of resources) types[resource.type] = (types[resource.type] ?? 0) + 1;
  equal(content.resourceTypes, types, `${decision.slug}: resource-map observation drift`);
  for (const observed of content.identityStrings) {
    const resource = one(resources, r => r.type === observed.type && r.id === observed.signedId, `${decision.slug}: identity resource`);
    check(sha256(resource.data) === observed.payloadSha256, `${decision.slug}: identity payload drift`);
    equal(strings(resource), observed.strings, `${decision.slug}: identity strings disagree with payload`);
  }
  check(decision.identityRefs.length > 0, `${decision.slug}: missing content identity evidence`);
  for (const ref of decision.identityRefs) one(content.identityStrings,
    row => row.type === ref.type && row.signedId === ref.signedId && row.payloadSha256 === ref.payloadSha256, `${decision.slug}: dangling content reference`);
}
/** Validate the reviewed input boundary, never infer approval from observations. */
export async function validateInputs({ choices, evidence, review, candidates }, { readFile = read } = {}) {
  check(choices.schemaVersion === 1 && evidence.schemaVersion === 1 && review.schemaVersion === 1, 'Unsupported source-input schema');
  check(choices.reviewStatus === 'reviewed-contract-inputs' && review.status === 'reviewed-contract-inputs', 'Invalid input-only review status');
  check(choices.reviewVersion === review.reviewVersion && review.reviewVersion === '1.0.0', 'Review version mismatch');
  check(choices.reviewFile === 'tests/source-inputs/review.json' && review.evidenceFile === 'tests/source-inputs/evidence.json', 'Review evidence path mismatch');
  check(review.registrySourcesSha256 === hash(choices.sources), 'Reviewed registry digest drift');
  check(review.decisionsSha256 === hash(review.decisions), 'Reviewed decisions digest drift');
  check(review.evidenceSha256 === sha256(readFile(review.evidenceFile)), 'Reviewed evidence file drift');
  equal(JSON.parse(readFile(review.evidenceFile)), evidence, 'Evidence object differs from reviewed file');
  check(review.captureScriptSha256 === sha256(readFile('tests/source-inputs/capture.py')), 'Capture script drift');
  check(review.reviewers?.length >= 2 && review.reviewers.every(x => typeof x === 'string' && x.length > 0), 'Missing independent reviewers');
  check(evidence.status === 'unreviewed-independent-tool-observations', 'Observation evidence cannot be promoted to decoder truth');
  for (const tool of ['lsar', 'unar']) check(evidence.tools[tool]?.version && /^[a-f0-9]{64}$/.test(evidence.tools[tool]?.binarySha256), `Missing ${tool} capture identity`);
  check(candidates.reviewStatus === 'unreviewed' && candidates.themes.every(c => c.reviewStatus === 'unreviewed' && c.expectedAvailability === 'unknown'), 'Candidate observations must remain unreviewed/unknown');
  const ids = choices.sources.map(c => c.slug);
  check(ids.length === new Set(ids).size, 'Duplicate source choice');
  const catalogIds = JSON.parse(readFile('demo/themes-manifest.json')).map(theme => theme.slug);
  check(ids.length === 18, 'Review 1.0.0 covers exactly 18 contract inputs');
  equal([...ids].sort(), catalogIds.sort(), 'Reviewed input inventory differs from supplied theme catalog');
  equal([...ids].sort(), evidence.rows.map(r => r.slug).sort(), 'Missing/duplicate evidence input');
  equal([...ids].sort(), review.decisions.map(r => r.slug).sort(), 'Missing/duplicate review decision');
  let archives = 0, standalone = 0, forks = 0;
  for (const choice of choices.sources) {
    const row = one(evidence.rows, r => r.slug === choice.slug, choice.slug);
    const decision = one(review.decisions, r => r.slug === choice.slug, choice.slug);
    check(choice.selectionReviewStatus === 'reviewed-contract-input' && choice.selectionReviewEvidence === choice.slug, `${choice.slug}: choice is not explicitly reviewed`);
    check(decision.status === 'reviewed-contract-input' && decision.scope === 'explicit-contract-input-only' && decision.basis && decision.unknowns?.length,
      `${choice.slug}: review exceeds declared-input scope or lacks limits`);
    const bytes = readFile(choice.path);
    check(sha256(bytes) === choice.archiveSha256 && row.sourceSha256 === choice.archiveSha256 && row.sourceByteLength === bytes.length, `${choice.slug}: archive identity drift`);
    const actualForks = await enumerateForks(bytes, choice.format), actual = selectFork(bytes, actualForks, choice);
    if (choice.format === 'rsrc') {
      standalone++;
      check(row.kind === 'standalone-input' && decision.kind === row.kind && decision.lsarIndex === null && choice.entryIndex === null && choice.entryName === null,
        `${choice.slug}: standalone input cannot claim archive selection`);
      check(!row.entries && decision.readmeRefs.length === 0, `${choice.slug}: invented standalone archive entries`);
      validateContent(row.content, actual.bytes, decision);
    } else {
      archives++; forks += actualForks.length;
      check(choice.format === 'sit' && row.kind === 'archive-input' && decision.kind === row.kind, `${choice.slug}: incorrect archive kind`);
      check(row.listingSha256 === hash(row.entries), `${choice.slug}: listing digest drift`);
      check(new Set(row.entries.map(e => e.lsarIndex)).size === row.entries.length, `${choice.slug}: duplicate lsar index`);
      const independentForks = row.entries.filter(e => e.resourceFork);
      equal(independentForks.map(e => e.extractedSha256).sort(), actualForks.map(e => sha256(e.bytes)).sort(), `${choice.slug}: complete resource-fork inventory disagrees`);
      const selected = one(independentForks, e => e.extractedSha256 === choice.forkSha256, `${choice.slug}: independent fork match`);
      one(actualForks, e => e.fileType === 'Colr' && e.creator === 'Acid', `${choice.slug}: actual unique scheme file`);
      const scheme = one(independentForks, e => e.fileType === 'Colr' && e.creator === 'Acid', `${choice.slug}: unique scheme file`);
      check(selected === scheme && selected.lsarIndex === decision.lsarIndex, `${choice.slug}: reviewed scheme/index mismatch`);
      equal(row.declaredForkMatches, [selected.lsarIndex], `${choice.slug}: ambiguous independent match`);
      check(selected.extractedByteLength === actual.bytes.length && selected.byteLength === actual.bytes.length, `${choice.slug}: fork length mismatch`);
      check(actual.fileType === selected.fileType && actual.creator === selected.creator, `${choice.slug}: file type/creator disagreement`);
      const actualDataHashes = new Set((await decodeArchive(bytes)).filter(e => e.forkType === 0).map(e => sha256(e.bytes)));
      for (const ref of decision.readmeRefs) {
        one(row.entries, e => !e.resourceFork && !e.directory && e.lsarIndex === ref.lsarIndex && e.extractedSha256 === ref.extractedSha256, `${choice.slug}: dangling readme reference`);
        check(actualDataHashes.has(ref.extractedSha256), `${choice.slug}: readme payload not present in actual archive`);
      }
      validateContent(selected.content, actual.bytes, decision);
    }
  }
  return { reviewedContractInputs: ids.length, archiveSelections: archives, standaloneInputs: standalone,
    independentlyCorroboratedResourceForks: forks, candidateFacts: 'unreviewed', originalResourceManagerPolicy: 'unknown', completeDecoderCorrectness: 'unknown' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await validateInputs(readInputs()), null, 2));
