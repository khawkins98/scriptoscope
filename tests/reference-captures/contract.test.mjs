import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { readContract, knownImages, captureTemplate, reviewTemplate, assessCapture, assessCorpus, sha256, digest, repositoryRoot } from './contract.mjs';

import { inspectPNG } from './png.mjs';

const contract = readContract();
const request = contract.requests.find(r => r.id === 'windows-95.normal');
// Synthetic intake-format fixtures ONLY. These pixels are never original evidence,
// checked into the capture corpus, compared to Scriptoscope, or used as a baseline.
function png(width, height, color = 33) {
  const crc32 = bytes => { let crc = -1; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; };
  const chunk = (type, data) => { const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); out.write(type, 4); data.copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, -4)), out.length - 4); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = Buffer.alloc(height * (width * 3 + 1), color); for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'reference-intake-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const bytes = png(160, 80); writeFileSync(join(root, 'test-only.png'), bytes);
  const log = Buffer.from('SYNTHETIC UNIT TEST; NOT AN ORIGINAL CAPTURE'); writeFileSync(join(root, 'test-only.txt'), log);
  const identity = name => ({ name, version: 'TEST ONLY', sha256: sha256(log) });
  const capture = captureTemplate(request);
  capture.image = { path: 'test-only.png', sha256: sha256(bytes), width: 160, height: 80 };
  capture.observed = { os: identity('TEST OS'), engineInstallation: { ...identity('Kaleidoscope'), version: '2.3.1' },
    patchStack: [], patchStackReason: 'Synthetic schema exercise', baseChain: [], baseChainReason: 'Synthetic schema exercise', resourceSearchOrder: [identity('TEST provider')],
    font: { ...identity('TEST FONT'), pointSize: 12, style: 'plain' }, palette: { depth: 8, sha256: sha256(log), description: 'TEST configuration' },
    controlDefinition: { procedureId: 0, variant: 0, hilite: 0, value: 0, enabled: true, windowActive: true, defaultMechanism: 'TEST none', invocation: 'TEST schema exercise' }, captureMethod: 'TEST ONLY' };
  capture.provenance = { producer: 'TEST PRODUCER', capturedAt: '2000-01-01T00:00:00Z', originalEnvironment: true, method: 'TEST ONLY',
    artifacts: ['capture-log', 'environment-manifest'].map(role => ({ role, path: 'test-only.txt', sha256: sha256(log) })) };
  const approve = c => {
    // The temporary provenance record follows the candidate under test. Stale
    // image/review tests separately retain old hashes/attestations.
    const manifest = Buffer.from(JSON.stringify({ source: c.source, engineComponent: c.engineComponent, observed: c.observed }));
    writeFileSync(join(root, 'test-environment.json'), manifest);
    const artifact = c.provenance.artifacts?.find(a => a.role === 'environment-manifest');
    if (artifact) { artifact.path = 'test-environment.json'; artifact.sha256 = sha256(manifest); }
    return { ...reviewTemplate(c, request), verdict: 'accepted', reviewer: 'TEST REVIEWER', reviewedAt: '2000-01-02T00:00:00Z', notes: 'SYNTHETIC VALIDATOR TEST; NOT REAL APPROVAL',
    checks: Object.fromEntries(Object.keys(reviewTemplate(c, request).checks).map(k => [k, true])) };
  };
  approve(capture);
  return { root, capture, approve, assess: (c = capture, reviews = [approve(c)], known = []) => assessCapture(c, request, reviews, { intakeRoot: root, known }) };
}

test('actual checked-in corpus reports every provisional request missing and never a fidelity percentage', () => {
  const report = assessCorpus(contract, JSON.parse(readFileSync(new URL('./captures.json', import.meta.url))), JSON.parse(readFileSync(new URL('./reviews.json', import.meta.url))), { intakeRoot: repositoryRoot, known: knownImages() });
  assert.equal(report.requests.length, 12); assert.ok(report.requests.every(r => r.status === 'missing'));
  assert.equal(report.captures.length, 0); assert.equal(report.knownNonIndependent.filter(r => r.kind === 'qualitative-author-preview').length, 18);
  assert.equal(Object.hasOwn(report, 'percentage'), false);
});
test('complete synthetic validator fixture exercises eligibility without adding an original capture', t => {
  const f = fixture(t); assert.equal(f.assess().status, 'reviewed-independent-capture');
  assert.equal(f.assess(f.capture, []).status, 'awaiting-independent-review');
});
for (const [name, mutate] of [
  ['source identity', c => { delete c.source; }],
  ['engine component pin', c => { delete c.engineComponent; }],
  ['engine version', c => { delete c.observed.engineInstallation.version; }],
  ['image hash', c => { delete c.image.sha256; }],
  ['capture conditions', c => { delete c.conditions; }],
  ['base chain', c => { c.observed.baseChain = null; }],
  ['font identity despite empty label', c => { c.observed.font = null; }],
  ['palette', c => { c.observed.palette = null; }],
  ['patch stack', c => { c.observed.patchStack = null; }],
  ['capture provenance artifacts', c => { c.provenance.artifacts = []; }],
]) test(`missing ${name} cannot become accepted evidence`, t => {
  const f = fixture(t); mutate(f.capture); assert.equal(f.assess().status, 'partial');
});
for (const [name, mutate] of [
  ['wrong state', c => { c.conditions.state = 'pressed'; }],
  ['wrong dimensions', c => { c.conditions.controlRect[2]++; }],
  ['wrong port origin', c => { c.conditions.portOrigin[0]++; }],
  ['wrong crop', c => { c.conditions.cropImageRect[0]++; }],
  ['rescaled image', c => { c.conditions.scale = [2, 2]; }],
  ['different label', c => { c.conditions.text = 'OK'; }],
  ['different source fork', c => { c.source = { ...c.source, forkSha256: '0'.repeat(64) }; }],
  ['different engine', c => { c.observed.engineInstallation.version = '2.2'; }],
  ['wrong request digest', c => { c.requestDigest = '0'.repeat(64); }],
]) test(`${name} rejects even a fresh attestation`, t => {
  const f = fixture(t); mutate(f.capture); assert.equal(f.assess().status, 'rejected');
});
test('swapped image bytes reject the original hash; metadata edits invalidate existing approval', t => {
  const f = fixture(t), review = f.approve(f.capture);
  writeFileSync(join(f.root, f.capture.image.path), png(160, 80, 44));
  assert.equal(f.assess(f.capture, [review]).status, 'rejected');
  f.capture.image.sha256 = sha256(readFileSync(join(f.root, f.capture.image.path)));
  const result = f.assess(f.capture, [review]); assert.equal(result.status, 'rejected'); assert.ok(result.rejected.some(s => s.startsWith('review.captureDigest')));
});
test('renamed actual selfgolden or qualitative preview bytes cannot pass as independent originals', t => {
  const f = fixture(t), known = knownImages();
  for (const kind of ['scriptoscope-regression', 'qualitative-author-preview']) {
    const saved = known.find(image => image.kind === kind), bytes = readFileSync(join(repositoryRoot, saved.path));
    writeFileSync(join(f.root, 'renamed.png'), bytes);
    f.capture.image = { path: 'renamed.png', sha256: sha256(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    const result = f.assess(f.capture, [f.approve(f.capture)], known);
    assert.equal(result.status, 'rejected'); assert.ok(result.rejected.some(s => s.startsWith('known non-independent')));
  }
});
test('explicit qualitative, self-regression and synthetic evidence stays non-independent', t => {
  const f = fixture(t);
  for (const kind of ['qualitative-author-preview', 'scriptoscope-regression', 'synthetic-test']) {
    f.capture.kind = kind; assert.equal(f.assess().status, 'non-independent');
  }
});
test('absent, self, stale, incomplete and rejected reviews never approve capture intake', t => {
  const f = fixture(t); assert.equal(f.assess(f.capture, []).status, 'awaiting-independent-review');
  let review = f.approve(f.capture); review.reviewer = f.capture.provenance.producer; assert.equal(f.assess(f.capture, [review]).status, 'rejected');
  review = f.approve(f.capture); review.requestDigest = '0'.repeat(64); assert.equal(f.assess(f.capture, [review]).status, 'rejected');
  review = f.approve(f.capture); review.targetRequirementIds = ['typography.original']; assert.equal(f.assess(f.capture, [review]).status, 'rejected');
  review = f.approve(f.capture); review.checks.originalEnvironment = null; assert.equal(f.assess(f.capture, [review]).status, 'partial');
  review = f.approve(f.capture); review.verdict = 'rejected'; assert.equal(f.assess(f.capture, [review]).status, 'rejected');
});
test('request digests include exact requested conditions; the shifted pattern crop maps port to image coordinates', () => {
  const shifted = contract.requests.find(r => r.id === 'crayon-os.normal.shifted-port');
  assert.deepEqual(shifted.conditions.cropImageRect, [9, 7, 96, 36]);
  assert.notEqual(shifted.requestDigest, contract.requests.find(r => r.id === 'crayon-os.normal').requestDigest);
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
});

test('PNG intake accepts existing lossless image encodings but rejects corrupt checksums and truncated streams', () => {
  for (const known of knownImages()) {
    const bytes = readFileSync(join(repositoryRoot, known.path));
    assert.deepEqual(inspectPNG(bytes), { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
  }
  const bytes = png(160, 80); bytes[45] ^= 1;
  assert.throws(() => inspectPNG(bytes), /checksum/);
  assert.throws(() => inspectPNG(png(160, 80).subarray(0, -14)), /truncated|missing/);
});
test('a swapped environment manifest or changed capture log is rejected independently of image identity', t => {
  const f = fixture(t), review = f.approve(f.capture);
  const wrong = Buffer.from(JSON.stringify({ source: f.capture.source, engineComponent: f.capture.engineComponent, observed: { ...f.capture.observed, baseChain: ['wrong'] } }));
  writeFileSync(join(f.root, 'test-environment.json'), wrong);
  const artifact = f.capture.provenance.artifacts.find(a => a.role === 'environment-manifest'); artifact.sha256 = sha256(wrong);
  const updatedReview = { ...review, captureDigest: digest(f.capture) };
  const result = f.assess(f.capture, [updatedReview]);
  assert.equal(result.status, 'rejected'); assert.ok(result.rejected.some(s => s.startsWith('environment-manifest')));
  writeFileSync(join(f.root, 'test-only.txt'), 'CHANGED');
  assert.ok(f.assess(f.capture, [updatedReview]).rejected.some(s => s.includes('capture-log: hash mismatch')));
});
