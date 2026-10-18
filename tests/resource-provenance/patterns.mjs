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
