// Hand-encoded indexed PixPat: header28 + PixMap50 + two pixels + table24.
// Literal layout and colors are independent of the production decoder.
export function twoPixelPpat({ flags = 0, red = 0xffff } = {}) {
  const bytes = new Uint8Array(104), v = new DataView(bytes.buffer);
  v.setUint16(0, 1); v.setUint32(2, 28); v.setUint32(6, 78);
  v.setUint16(32, 0x8002); v.setUint16(38, 1); v.setUint16(40, 2);
  v.setUint16(60, 8); v.setUint16(62, 1); v.setUint16(64, 8);
  v.setUint32(70, 80); bytes.set([0, 1], 78);
  v.setUint16(84, flags); v.setUint16(86, 1);
  v.setUint16(90, red); v.setUint16(96, 1); v.setUint16(102, 0xffff);
  return bytes;
}

// Compare an actual catalog binding to an independently specified source pin.
// This neither resolves a pattern nor claims that any renderer consumed it.
export function comparePatternBinding(owner, key, expected) {
  const entry = owner.manifest.patterns?.[key], reference = entry?.byteProvenance;
  const evidence = owner.byteProvenance;
  if (!evidence || !reference) return { status: 'unknown', reason: 'unobserved-owner-or-binding' };
  const failures = [];
  const check = (value, wanted, field) => { if (value !== wanted) failures.push(field); };
  check(evidence.version, 1, 'version');
  check(evidence.scope?.resourceTypes?.includes('ppat'), true, 'scope.ppat');
  check(evidence.scope?.evidence, 'decoder-input-bytes', 'scope.evidence');
  check(reference.loadId, evidence.loadId, 'loadId');
  check(reference.manifestKey, key, 'manifestKey');
  check(evidence.input.sha256, expected.inputSha256, 'inputSha256');
  check(evidence.fork.sha256, expected.forkSha256, 'forkSha256');
  check(entry.sourcePpatId, expected.signedId, 'sourcePpatId');
  check(reference.ppatResourceIndex, expected.resourceIndex, 'resourceIndex');
  const records = evidence.resources.filter(r => r.resourceIndex === reference.ppatResourceIndex);
  check(records.length, 1, 'uniqueOccurrence');
  const record = records[0];
  for (const [field, wanted] of Object.entries({ type: 'ppat', signedId: expected.signedId,
    byteLength: expected.byteLength, sha256: expected.payloadSha256, status: 'decoded' })) check(record?.[field], wanted, field);
  return { status: failures.length ? 'mismatch' : 'matched', failures };
}

/** Actual completed modern patterned body, separate from native phase/provider claims. */
export function compareCompletedPatternPaint(owner, step, expected) {
  const failures = [...comparePatternBinding(owner, step?.resource?.manifestKey, expected).failures ?? []];
  const check = (actual, wanted, label) => { if (JSON.stringify(actual) !== JSON.stringify(wanted)) failures.push(label); };
  if (comparePatternBinding(owner, step?.resource?.manifestKey, expected).status !== 'matched') failures.push('binding');
  const entry=owner.manifest.patterns?.[step?.resource?.manifestKey], paint=step?.bodyPaint;
  for(const [actual,wanted,label] of [
    [step?.role,'body-fill','role'],[step?.action,'selected','action'],[step?.usage,'paint','usage'],
    [step?.requestedId,expected.signedId,'requestedId'],[step?.requestedResourceType,'ppat','requestedResourceType'],
    [step?.bodyMode,expected.bodyMode,'bodyMode'],[step?.owner,{baseUrl:owner.baseUrl,chainDepth:expected.chainDepth},'owner'],
    [step?.resource?.type,'ppat','resource.type'],[step?.resource?.signedId,expected.signedId,'resource.signedId'],
    [step?.resource?.byteProvenance,entry?.byteProvenance,'resource.byteProvenance'],
    [step?.resource?.assetUrl,entry?.asset,'resource.assetUrl'],[paint?.sourceAssetUrl,entry?.asset,'sourceAssetUrl'],
    [paint?.branch,'pattern-fill-union','branch'],[paint?.coordinateSpace,'face-local-before-ring','coordinateSpace'],
    [paint?.unionRects,expected.unionRects,'unionRects'],[paint?.paintedPixels,expected.paintedPixels,'paintedPixels'],
    [paint?.sourceSize,expected.sourceSize,'sourceSize'],[paint?.context,expected.context,'context'],
    [paint?.phase,{basis:'modern-composition-policy',offset:expected.phaseOffset,originalPatternPhase:'unverified'},'phase'],
  ])check(actual,wanted,label);
  return {status:failures.length?'mismatch':'matched',failures};
}
