import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { createHash } from 'node:crypto';
import { readContract, assessCorpus, reviewDigest, digest } from '../reference-captures/contract.mjs';

export const REQUIREMENT = 'output.recorded-composited-face';
export const PROFILE = { path: 'tests/decoder-fixtures/measured-display-profile.json', id: 'display-profile:506eb4e615f81385b6143c63a9612f4c899b14e2c93c60b67358b436777f772d', sha256: 'd8c495d980029f857633652c5e1abd3bc4f289fb8705e03fd750bc9bdff96d00' };
const check = (ok, message) => { if (!ok) throw Error(`recorded face: ${message}`); };
export const caseId = (slug, state) => `recorded.${slug}.${state}.empty.w80.h20.v9-profile`;
export const exactOptions = state => ({ label: '', minWidth: 80, height: 20, default: false, pressed: state === 'pressed', disabled: state === 'inactive' });
export const captureBinding = capture => ({ captureId: capture.id, requestId: capture.requestId, requestDigest: capture.requestDigest, captureDigest: reviewDigest(capture), imageSha256: capture.image.sha256, reviewScope: { id: capture.reviewScope.id, version: capture.reviewScope.version, digest: digest(capture.reviewScope) }, faceImageRect: [20, 20, 80, 20], publicFaceRect: [4, 4, 80, 20], background: [255, 255, 255], profile: PROFILE });

/** Reuse the intake authority. A matching filename or runtime observation is insufficient. */
export function readRecordedContext(root) {
  const contract = readContract(root);
  const corpus = JSON.parse(readFileSync(resolve(root, 'tests/reference-captures/captures.json')));
  const reviews = JSON.parse(readFileSync(resolve(root, 'tests/reference-captures/reviews.json')));
  const report = assessCorpus(contract, corpus, reviews, { intakeRoot: resolve(root, 'tests/reference-captures'), known: [] });
  const profileSha = createHash('sha256').update(readFileSync(resolve(root, PROFILE.path))).digest('hex');
  check(profileSha === PROFILE.sha256, 'profile DATA bytes changed');
  return { captures: corpus.captures, report };
}
export function validateRecordedBinding(c, binding, context) {
  const capture = context.captures.find(x => x.id === binding?.captureId);
  check(capture, 'missing exact capture');
  const assessed = context.report.captures.find(x => x.captureId === capture.id);
  check(assessed?.status === 'reviewed-scoped-observation', 'capture is not currently reviewed scoped evidence');
  check(same(binding, captureBinding(capture)), 'stale or wrong capture/profile/crop binding');
  const slug = capture.source.slug, state = capture.conditions.state;
  check(['windows-95', 'system7-nostalgia-silver'].includes(slug) && ['normal', 'pressed', 'inactive'].includes(state), 'outside six recorded cases');
  check(c.mode === 'direct' && c.family === 'push', 'wrong exact mode/family');
  check(c.id === caseId(slug, state) && same(c.options, exactOptions(state)), 'wrong exact case/options');
  check(same(c.inputs, ['theme.' + slug]) && same(c.baseInputs, []), 'wrong exact source/base inputs');
  check(same(c.recordedComparison, binding), 'case/evidence binding differs');
  return capture;
}

/** Full composited plane equality; alpha remains separate from the opaque oracle. */
export function compareRecordedPixels(raw, original) {
  check(raw.length === 6400 && original.length === 6400, 'requires all 1600 RGBA pixels');
  let differentPixels = 0;
  for (let i = 0; i < raw.length; i += 4) {
    const a = raw[i + 3];
    if (original[i + 3] !== 255 || [0, 1, 2].some(c => Math.round((raw[i + c] * a + 255 * (255 - a)) / 255) !== original[i + c])) differentPixels++;
  }
  return differentPixels;
}

/** Actual completed modern paint is required, without attributing the original painter. */
export function validateRecordedExecution(row, binding, capture) {
  check(same(row.outcome,{status:'themed',width:88,height:28}), 'composition did not complete');
  check(row.slug === capture.source.slug && row.state === capture.conditions.state, 'wrong execution case');
  check(row.profile === PROFILE.id && row.policy === PROFILE.id, 'wrong prepared profile');
  check(same(row.options, exactOptions(row.state)), 'wrong actual options');
  check(same(row.originalComparison.binding, binding), 'wrong execution reference/crop');
  check(row.profileInput === capture.source.archiveSha256 && row.profileFork === capture.source.forkSha256, 'wrong loaded source bytes');
  check(same(row.size, [88, 28]) && same(row.facePlane.rect, binding.publicFaceRect), 'wrong face geometry');
  check(row.requested?.state === (row.state === 'normal' ? 'active' : row.state) && row.requested.pressed === row.options.pressed && row.requested.disabled === row.options.disabled && row.requested.default === false, 'wrong actual request flags');
  const selected = row.paintSelectionSteps.filter(s => s.role === 'face' && s.usage === 'paint' && s.action === 'selected');
  check(selected.length === 1, 'requires one selected face');
  const s = selected[0], resource = row.resources.find(r => r.resourceIndex === row.source.cicnResourceIndex);
  check(same(s.resource.byteProvenance, row.source) && s.resource.byteProvenance.loadId === row.loadId, 'wrong selected occurrence/load');
  check(resource?.type === 'cicn' && resource.status === 'decoded' && resource.signedId === s.resource.signedId, 'wrong decoded resource');
  const expectedId = row.state === 'normal' ? -10239 : row.state === 'pressed' ? -10238 : -10240;
  check(s.resource.signedId === expectedId && s.resource.manifestKey === row.selectedKey && s.resource.assetUrl === row.selectedAsset, 'wrong face identity');
  check(s.owner.baseUrl === row.profileBaseUrl && s.owner.chainDepth === 0, 'wrong selected owner');
  const cinf=row.source.cinfResourceIndex==null?null:row.resources.find(r=>r.resourceIndex===row.source.cinfResourceIndex);
  check(cinf===null ? row.selectedCinfId===null : cinf?.type==='cinf' && cinf.status==='decoded' && cinf.signedId===row.selectedCinfId,'wrong decoded metadata occurrence');
  check(s.resource.sourceCinfId === row.selectedCinfId && row.source.manifestKey === row.selectedKey, 'wrong paired metadata/key');
  const paints = row.slug === 'system7-nostalgia-silver' ? [row.legacyFacePaint] : row.bandPaints.filter(p => p.role === 'face');
  check(paints.length > 0 && paints.every(p => p && same(p.owner, s.owner) && same(p.resource, s.resource)), 'missing or wrong completed paint dependency');
  if (row.slug === 'system7-nostalgia-silver') {
    const p = row.legacyFacePaint;
    check(p.basis === 'compatibility-policy' && p.operation === 'legacy-nine-slice-and-sample-fill' && same(p.destinationRect, { x: 0, y: 0, w: 80, h: 20 }), 'wrong legacy paint stage');
    const raw = Buffer.from(row.facePlane.rgba, 'base64');
    check(p.retainedNonzeroAlphaPixels === Array.from(raw).filter((a, i) => i % 4 === 3 && a > 0).length, 'wrong retained paint occupancy');
  }
  check(row.originalComparison.differentPixels === 0 && row.originalComparison.comparedPixels === 1600, 'pixel mismatch/incomplete comparison');
}
