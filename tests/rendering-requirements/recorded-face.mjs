import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { createHash } from 'node:crypto';
import { readContract, assessCorpus, reviewDigest, digest } from '../reference-captures/contract.mjs';

export const REQUIREMENT = 'output.recorded-composited-face';
export const RECORDED_CASES = JSON.parse(readFileSync(new URL('../decoder-fixtures/recorded-case-registry.json', import.meta.url)));
export const PROFILE = RECORDED_CASES['windows-95'].profile;
export const CRAYON_PROFILE = RECORDED_CASES['crayon-os'].profile;
export const LISA_PROFILE = RECORDED_CASES['apple-lisa'].profile;
export const ANIMALS_PROFILE = RECORDED_CASES.animals.profile;
export const BEOS_PROFILE = RECORDED_CASES['beos-r503'].profile;
const CRAYON_SOURCE_PINS = JSON.parse(readFileSync(new URL('../decoder-fixtures/crayon-recorded-source-pins.json', import.meta.url)));
const LISA_SOURCE_PINS = JSON.parse(readFileSync(new URL('../decoder-fixtures/lisa-recorded-source-pins.json', import.meta.url)));
export const STATE_SOURCE_PINS = JSON.parse(readFileSync(new URL('../decoder-fixtures/recorded-state-source-pins.json', import.meta.url)));
export const sourcePinsFor = (slug,state) => STATE_SOURCE_PINS[slug]?.[state] ?? (state === 'normal' ? (slug === 'crayon-os' ? CRAYON_SOURCE_PINS : slug === 'apple-lisa' ? LISA_SOURCE_PINS : undefined) : undefined);
export const profileFor = slug => RECORDED_CASES[slug]?.profile;
export const CRAYON_CONTEXT = { controlOrigin: [20,20], portOrigin: [0,0], patternOrigin: {status:'unknown'}, clip: {kind:'rect',rect:{x:0,y:0,w:160,h:80}} };
const check = (ok, message) => { if (!ok) throw Error(`recorded face: ${message}`); };
export const caseId = (slug, state) => `recorded.${slug}.${state}.empty.w80.h20.${RECORDED_CASES[slug]?.caseSuffix}-profile`;
export const exactOptions = (state, slug) => ({ label: '', minWidth: 80, height: 20, default: false, pressed: state === 'pressed', disabled: state === 'inactive', ...(RECORDED_CASES[slug]?.explicitContext ? {compositionContext: structuredClone(CRAYON_CONTEXT)} : {}) });
export const captureBinding = capture => ({ captureId: capture.id, requestId: capture.requestId, requestDigest: capture.requestDigest, captureDigest: reviewDigest(capture), imageSha256: capture.image.sha256, reviewScope: { id: capture.reviewScope.id, version: capture.reviewScope.version, digest: digest(capture.reviewScope) }, faceImageRect: [20, 20, 80, 20], publicFaceRect: [4, 4, 80, 20], background: [255, 255, 255], profile: profileFor(capture.source.slug) });

/** Reuse the intake authority. A matching filename or runtime observation is insufficient. */
export function readRecordedContext(root) {
  const contract = readContract(root);
  const corpus = JSON.parse(readFileSync(resolve(root, 'tests/reference-captures/captures.json')));
  const reviews = JSON.parse(readFileSync(resolve(root, 'tests/reference-captures/reviews.json')));
  const report = assessCorpus(contract, corpus, reviews, { intakeRoot: resolve(root, 'tests/reference-captures'), known: [] });
  for (const profile of Object.values(RECORDED_CASES).map(c => c.profile)) {
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
  check(RECORDED_CASES[slug]?.states.includes(state), 'outside finite recorded cases');
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

/** Validate the completed modern raster stage from paired metadata, not theme names. */
export function validateCompletedFacePaint(row, selected, hasPairedCinf) {
  const paints = hasPairedCinf ? (row.bandPaints ?? []).filter(p => p.role === 'face') : [row.legacyFacePaint];
  check(paints.length > 0 && paints.every(p => p && same(p.owner, selected.owner) && same(p.resource, selected.resource)), 'missing or wrong completed paint dependency');
  if (!hasPairedCinf) {
    check(!row.resources.some(r => r.type === 'cinf' && r.signedId === selected.resource.signedId), 'paired metadata cannot be omitted');
    const p = row.legacyFacePaint;
    check(p.basis === 'compatibility-policy' && p.operation === 'legacy-nine-slice-and-sample-fill' && same(p.destinationRect, { x: 0, y: 0, w: 80, h: 20 }), 'wrong legacy paint stage');
    const raw = Buffer.from(row.facePlane.rgba, 'base64');
    check(raw.length === 6400 && p.retainedNonzeroAlphaPixels === Array.from(raw).filter((a, i) => i % 4 === 3 && a > 0).length, 'wrong retained paint occupancy');
  }
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
  const paintKind = RECORDED_CASES[row.slug]?.paintKind;
  check((paintKind === 'cinf-bands' && cinf !== null) || (paintKind === 'legacy-face' && cinf === null), 'wrong registered paint kind');
  validateCompletedFacePaint(row, s, cinf !== null);
  const sourcePins=sourcePinsFor(row.slug,row.state);
  if (STATE_SOURCE_PINS[row.slug]?.[row.state]) {
    if (sourcePins.paintKind) {
      check(sourcePins.paintKind === paintKind && same(row.recordedSourcePins, sourcePins), 'wrong explicit paint/source pins');
      check(row.completionCount === 1, 'requires exactly one completion');
      check(same(row.composition?.faceRect, {x:20,y:20,w:80,h:20}) &&
        same(row.composition?.context, {...CRAYON_CONTEXT,basis:'caller-declared'}) &&
        row.composition.appliedUnknownPatternOffset === true && row.composition.originalPortState === 'unverified', 'wrong pinned port context');
      if (paintKind === 'legacy-face') {
        const p = row.legacyFacePaint;
        check(same(p.sourceRect, {x:0,y:0,w:sourcePins.sourceSize[0],h:sourcePins.sourceSize[1]}) && same(p.effectiveFaceClip, {x:0,y:0,w:80,h:20}) &&
          same(p.declaredClip, CRAYON_CONTEXT.clip) && p.coordinateSpace === 'face-local-before-ring' && p.rasterAlpha === 'copy-source-rgba' &&
          same(p.controlOrigin, [20,20]), 'wrong legacy geometry/context');
        check((row.bandPaints ?? []).length === 0 && (row.bodyFillSteps ?? []).length === 0 && row.patternAsset === null &&
          !row.paintSelectionSteps.some(p => p.role === 'body-fill'), 'invented no-cinf body paint');
      }
    }
    check(row.selectedKey===sourcePins.emittedKey && row.profileInput===sourcePins.sourceArchiveSha256 && row.profileFork===sourcePins.sourceForkSha256, 'wrong state source/key pins');
    check(same(row.selectedBodyRequest,sourcePins.bodyRequest), 'wrong actual state body request');
    check(resource?.byteLength===sourcePins.face.bytes && (sourcePins.cinf === null ? cinf === null && row.selectedCinfId === null : cinf?.byteLength===sourcePins.cinf.bytes), 'wrong state payload lengths');
    for (const [actual, pin] of [[resource, sourcePins.face], [cinf, sourcePins.cinf]]) {
      check(pin === null ? actual === null : actual?.resourceIndex === pin.resourceIndex && actual.signedId === pin.signedId && actual.sha256 === pin.payloadSha256, 'wrong state payload identity');
    }
  }
  if (sourcePins?.pattern) {
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
  check(row.originalComparison.differentPixels === 0 && row.originalComparison.comparedPixels === 1600, 'pixel mismatch/incomplete comparison');
}
