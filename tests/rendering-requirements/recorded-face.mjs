import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { createHash } from 'node:crypto';
import { readContract, assessCorpus, reviewDigest, digest } from '../reference-captures/contract.mjs';

export const REQUIREMENT = 'output.recorded-composited-face';
export const PROFILE = { path: 'tests/decoder-fixtures/measured-display-profile.json', id: 'display-profile:506eb4e615f81385b6143c63a9612f4c899b14e2c93c60b67358b436777f772d', sha256: 'd8c495d980029f857633652c5e1abd3bc4f289fb8705e03fd750bc9bdff96d00' };
const CRAYON_SOURCE_PINS = JSON.parse(readFileSync(new URL('../decoder-fixtures/crayon-recorded-source-pins.json', import.meta.url)));
export const CRAYON_PROFILE = { path: 'tests/decoder-fixtures/measured-display-profile-crayon.json', id: 'display-profile:d4e4f9ffb69f1292f2c86b3fb2914561c58f8b38a5aeb53336e6cf914b10a1a0', sha256: 'fbd0eb8abb9e5e153fa4ddb0d825a2fea045a6f4a19baca445d12b449ff47b5a' };
const LISA_SOURCE_PINS = JSON.parse(readFileSync(new URL('../decoder-fixtures/lisa-recorded-source-pins.json', import.meta.url)));
export const STATE_SOURCE_PINS = JSON.parse(readFileSync(new URL('../decoder-fixtures/recorded-state-source-pins.json', import.meta.url)));
export const sourcePinsFor = (slug,state) => STATE_SOURCE_PINS[slug]?.[state] ?? (state === 'normal' ? (slug === 'crayon-os' ? CRAYON_SOURCE_PINS : slug === 'apple-lisa' ? LISA_SOURCE_PINS : undefined) : undefined);
export const LISA_PROFILE = { path: 'tests/decoder-fixtures/measured-display-profile-lisa.json', id: 'display-profile:9bbdfe3464638676c8c8aac27d1b316a3f6bd21837be19f937e59fa5df4730a2', sha256: 'f48d2807c6b881b0a3fdd851b866a47116e2df2b998201b95c6c5854befdd1d6' };
export const ANIMALS_PROFILE = { path: 'tests/decoder-fixtures/measured-display-profile-animals.json', id: 'display-profile:287bde96a0ee72c13658b53c2e24643264325f79ded18ae0cd8d96257a9082b7', sha256: '8212d54dc56f28dd4825c55591e09b18ce5d9c317b647995a3d4b0635b99c5d5' };
export const BEOS_PROFILE = { path: 'tests/decoder-fixtures/measured-display-profile-beos.json', id: 'display-profile:913a5b3ad1d6501ad9059a4cad783c88c930a9647f32b0989993f4af7f2ee538', sha256: 'e70ab19f818d1281488fc0a6d4a2df9a46e816e5e0127b1176be423cb94a2c58' };
export const profileFor = slug => slug === 'beos-r503' ? BEOS_PROFILE : slug === 'animals' ? ANIMALS_PROFILE : slug === 'apple-lisa' ? LISA_PROFILE : slug === 'crayon-os' ? CRAYON_PROFILE : PROFILE;
export const CRAYON_CONTEXT = { controlOrigin: [20,20], portOrigin: [0,0], patternOrigin: {status:'unknown'}, clip: {kind:'rect',rect:{x:0,y:0,w:160,h:80}} };
const check = (ok, message) => { if (!ok) throw Error(`recorded face: ${message}`); };
export const caseId = (slug, state) => `recorded.${slug}.${state}.empty.w80.h20.${slug === 'beos-r503' ? 'b278-v2' : slug === 'animals' ? 'a209' : slug === 'apple-lisa' ? 'v16l' : slug === 'crayon-os' ? 'v14c' : 'v9'}-profile`;
export const exactOptions = (state, slug) => ({ label: '', minWidth: 80, height: 20, default: false, pressed: state === 'pressed', disabled: state === 'inactive', ...(['crayon-os','apple-lisa','animals','beos-r503'].includes(slug) ? {compositionContext: structuredClone(CRAYON_CONTEXT)} : {}) });
export const captureBinding = capture => ({ captureId: capture.id, requestId: capture.requestId, requestDigest: capture.requestDigest, captureDigest: reviewDigest(capture), imageSha256: capture.image.sha256, reviewScope: { id: capture.reviewScope.id, version: capture.reviewScope.version, digest: digest(capture.reviewScope) }, faceImageRect: [20, 20, 80, 20], publicFaceRect: [4, 4, 80, 20], background: [255, 255, 255], profile: profileFor(capture.source.slug) });

/** Reuse the intake authority. A matching filename or runtime observation is insufficient. */
export function readRecordedContext(root) {
  const contract = readContract(root);
  const corpus = JSON.parse(readFileSync(resolve(root, 'tests/reference-captures/captures.json')));
  const reviews = JSON.parse(readFileSync(resolve(root, 'tests/reference-captures/reviews.json')));
  const report = assessCorpus(contract, corpus, reviews, { intakeRoot: resolve(root, 'tests/reference-captures'), known: [] });
  for (const profile of [PROFILE, CRAYON_PROFILE, LISA_PROFILE, ANIMALS_PROFILE, BEOS_PROFILE]) {
    const profileSha = createHash('sha256').update(readFileSync(resolve(root, profile.path))).digest('hex');
    check(profileSha === profile.sha256, 'profile DATA bytes changed');
  }
  return { captures: corpus.captures, report };
}
export function validateRecordedBinding(c, binding, context) {
  const capture = context.captures.find(x => x.id === binding?.captureId);
  check(capture, 'missing exact capture');
  const assessed = context.report.captures.find(x => x.captureId === capture.id);
  check(assessed?.status === 'reviewed-scoped-observation', 'capture is not currently reviewed scoped evidence');
  check(same(binding, captureBinding(capture)), 'stale or wrong capture/profile/crop binding');
  const slug = capture.source.slug, state = capture.conditions.state;
  check((['windows-95', 'system7-nostalgia-silver'].includes(slug) && ['normal', 'pressed', 'inactive'].includes(state)) || (['crayon-os','apple-lisa','animals','beos-r503'].includes(slug) && ['normal','pressed','inactive'].includes(state)), 'outside finite recorded cases');
  check(c.mode === 'direct' && c.family === 'push', 'wrong exact mode/family');
  check(c.id === caseId(slug, state) && same(c.options, exactOptions(state, slug)), 'wrong exact case/options');
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
  check(row.profile === binding.profile.id && row.policy === binding.profile.id, 'wrong prepared profile');
  check(same(row.options, exactOptions(row.state, row.slug)), 'wrong actual options');
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
  const sourcePins=sourcePinsFor(row.slug,row.state);
  if (STATE_SOURCE_PINS[row.slug]?.[row.state]) {
    check(row.selectedKey===sourcePins.emittedKey && row.profileInput===sourcePins.sourceArchiveSha256 && row.profileFork===sourcePins.sourceForkSha256, 'wrong state source/key pins');
    check(same(row.selectedBodyRequest,sourcePins.bodyRequest), 'wrong actual state body request');
    check(resource?.byteLength===sourcePins.face.bytes && cinf?.byteLength===sourcePins.cinf.bytes, 'wrong state payload lengths');
  }
  if (row.slug === 'crayon-os' || (row.slug === 'animals' && sourcePins.pattern)) {
    check(same(row.composition?.faceRect, {x:20,y:20,w:80,h:20}), 'wrong port face placement');
    check(same(row.composition?.context, {...CRAYON_CONTEXT,basis:'caller-declared'}) && row.composition.appliedUnknownPatternOffset === true && row.composition.originalPortState === 'unverified', 'wrong actual port context');
    const pins = row.recordedSourcePins;
    check(same(pins, sourcePins), 'wrong independently pinned payloads');
    for (const [actual, pin] of [[resource,pins.face],[cinf,pins.cinf]])
      check(actual?.resourceIndex === pin.resourceIndex && actual.signedId === pin.signedId && actual.sha256 === pin.payloadSha256, 'wrong face/cinf payload');
    const patterns = row.paintSelectionSteps.filter(p=>p.role==='body-fill' && p.resource?.type==='ppat');
    check(patterns.length===1, 'missing exact selected pattern');
    const p=patterns[0], proof=p.resource.byteProvenance;
    const actual=row.resources.find(r=>r.resourceIndex===proof?.ppatResourceIndex);
    check(same(p.owner,s.owner) && proof?.loadId===row.loadId && p.resource.signedId===pins.pattern.signedId &&
      proof.manifestKey===p.resource.manifestKey && p.resource.assetUrl===row.patternAsset &&
      actual?.type==='ppat' && actual.status==='decoded' && actual.resourceIndex===pins.pattern.resourceIndex &&
      actual.signedId===pins.pattern.signedId && actual.sha256===pins.pattern.payloadSha256 &&
      ((row.state==='normal' && row.slug==='crayon-os') || actual.byteLength===pins.pattern.bytes), 'wrong selected pattern owner/payload');
  }
  if (row.slug === 'apple-lisa' || sourcePins?.missingPatternId===0) {
    check(same(row.composition?.faceRect, {x:20,y:20,w:80,h:20}) &&
      same(row.composition?.context, {...CRAYON_CONTEXT,basis:'caller-declared'}) &&
      row.composition.appliedUnknownPatternOffset === true && row.composition.originalPortState === 'unverified', 'wrong pinned port context');
    check(same(row.recordedSourcePins,sourcePins), 'wrong pinned source pins');
    for(const [actual,pin] of [[resource,sourcePins.face],[cinf,sourcePins.cinf]])
      check(actual?.resourceIndex===pin.resourceIndex && actual.signedId===pin.signedId && actual.sha256===pin.payloadSha256, 'wrong pinned face/cinf payload');
    const missing=row.bodyFillSteps?.filter(p=>p.usage==='paint' && p.action==='missing' && p.requestedResourceType==='ppat' && p.requestedId===0 && p.bodyMode===0);
    check(missing?.length===1 && same(missing[0].owner,s.owner) && missing[0].reason==='same-face-owner-pattern-unavailable' &&
      !row.resources.some(r=>r.type==='ppat'&&r.signedId===0) && !row.paintSelectionSteps.some(p=>p.role==='body-fill') && row.patternAsset===null, 'wrong pinned no-ppat0 observation');
  }
  if (row.slug === 'system7-nostalgia-silver') {
    const p = row.legacyFacePaint;
    check(p.basis === 'compatibility-policy' && p.operation === 'legacy-nine-slice-and-sample-fill' && same(p.destinationRect, { x: 0, y: 0, w: 80, h: 20 }), 'wrong legacy paint stage');
    const raw = Buffer.from(row.facePlane.rgba, 'base64');
    check(p.retainedNonzeroAlphaPixels === Array.from(raw).filter((a, i) => i % 4 === 3 && a > 0).length, 'wrong retained paint occupancy');
  }
  check(row.originalComparison.differentPixels === 0 && row.originalComparison.comparedPixels === 1600, 'pixel mismatch/incomplete comparison');
}
