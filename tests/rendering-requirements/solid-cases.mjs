import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareByteProvenance } from '../resource-provenance/compare.mjs';
import { solidBackgroundRows } from '../decoder-fixtures/solid-background.mjs';
export const solidPins = JSON.parse(readFileSync(new URL('../decoder-fixtures/solid-background-source-pins.json', import.meta.url)));
export const solidCaseIds = solidPins.cases.map(p => p.id);

// A finite observation verifier, not another resource resolver or compositor.
export function verifySolidCases(rows) {
  const verified = [];
  for (const pin of solidPins.cases) {
    const matches = rows.filter(r => r.collision === pin.collision && r.family === pin.family && r.resourceId === 0 && r.state === 'normal' && r.override === false);
    assert.equal(matches.length, 1, `${pin.id}: exact row missing or duplicated`);
    const r = matches[0];
    const flags = pin.family === 'push' ? { default: false } : { on: false, small: false };
    assert.deepEqual(r.options, { label: '', minWidth: 29, height: 9, pressed: false, disabled: false, ...flags }, `${pin.id}: invocation`);
    assert.deepEqual(r.size, [29, 9]);
    assert.equal(r.trace.family, pin.family === 'push' ? 'push-button' : 'bevel-button');
    assert.deepEqual(r.trace.requested, { state: 'active', pressed: false, disabled: false, ...flags });
    assert.deepEqual(r.trace.outcome, { status: 'themed', width: 29, height: 9 });
    const faces = r.trace.steps.filter(s => s.role === 'face' && s.action === 'selected' && s.usage === 'paint');
    assert.equal(faces.length, 1);
    const face = faces[0];
    const expected = { baseUrl: r.owner.baseUrl, chainDepth: 1, role: 'face', usage: 'paint', signedId: pin.signedId, sourceCinfId: pin.signedId, manifestKey: pin.manifestKey };
    assert.notEqual(r.owner.baseUrl, r.childBaseUrl);
    assert.deepEqual(r.childDeclaration, { chromeElements: { decoy: { sourceCicnId: -999, colorSamples: { background: { displayRgb: [255, 0, 0] } } } } });
    const source = { archive: { format: 'rsrc', sha256: pin.forkSha256, byteLength: pin.forkBytes }, selectedFork: { forkSha256: pin.forkSha256, byteLength: pin.forkBytes, entryIndex: null, entryName: null, forkType: 1, fileType: null, creator: null }, candidates: [
      { type: 'cicn', signedId: pin.signedId, presence: 'present', payloadSha256: pin.cicnSha256, byteLength: pin.cicnBytes },
      { type: 'cinf', signedId: pin.signedId, presence: 'present', payloadSha256: solidPins.cinf.sha256, byteLength: solidPins.cinf.bytes },
    ] };
    assert.deepEqual(compareByteProvenance(face, r.owner, source, expected), { status: 'passed', errors: [] }, `${pin.id}: owning bytes`);
    assert.equal(face.resource.byteProvenance.cicnResourceIndex, pin.cicnIndex);
    assert.equal(face.resource.byteProvenance.cinfResourceIndex, pin.cinfIndex);
    const body = r.trace.steps.filter(s => s.role === 'body-fill' && s.usage === 'paint');
    assert.equal(body.length, 1);
    assert.deepEqual({ action: body[0].action, reason: body[0].reason, requestedId: body[0].requestedId, bodyMode: body[0].bodyMode, requestedResourceType: body[0].requestedResourceType, owner: body[0].owner, basis: body[0].basis, usage: body[0].usage },
      { action: 'missing', reason: 'same-face-owner-pattern-unavailable', requestedId: 0, bodyMode: 0, requestedResourceType: 'ppat', owner: face.owner, basis: pin.family==='push'?'source-dispatch':'compatibility-policy', usage: 'paint' });
    assert.deepEqual(r.background, { rgb16: [8481, 8481, 8481], displayRgb: [48, 48, 48] });
    assert.deepEqual(r.pixels, solidBackgroundRows, `${pin.id}: complete literal output`);
    verified.push(pin.id);
  }
  assert.deepEqual(verified, solidCaseIds);
  return verified;
}
