import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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
function fixture(t, request = contract.requests.find(r => r.id === 'windows-95.normal')) {
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
  assert.equal(report.requests.length, 13); assert.ok(report.requests.every(r => r.status === 'missing'));
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

function contractRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'reference-contract-authority-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['tests/reference-captures/requests.json', 'tests/control-availability/source-choices.json', 'tests/rendering-requirements/ledger.json', 'docs/spec/fidelity-compatibility-contract.md']) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), readFileSync(join(repositoryRoot, path)));
  }
  symlinkSync(join(repositoryRoot, 'themes'), join(root, 'themes'), 'dir');
  return root;
}
for (const [field, value, expected] of [['contractId', 'another.contract', /contractId/], ['contractVersion', '0.1.0', /contractVersion/]]) {
  test(`wrong or stale ${field} fails against the authoritative document`, t => {
    const root = contractRoot(t), path = join(root, 'tests/reference-captures/requests.json');
    const catalog = JSON.parse(readFileSync(path)); catalog[field] = value;
    writeFileSync(path, JSON.stringify(catalog));
    assert.throws(() => readContract(root), expected);
  });
}
test('a changed authoritative document invalidates prior request and review bindings even without a version increment', t => {
  const root = contractRoot(t), path = join(root, 'docs/spec/fidelity-compatibility-contract.md');
  const original = readContract(root); assert.equal(original.compatibility.version, contract.compatibility.version);
  writeFileSync(path, readFileSync(path, 'utf8') + '\nA changed acceptance boundary requires fresh review.\n');
  const changed = readContract(root), nextRequest = changed.requests.find(r => r.id === request.id);
  assert.notEqual(changed.compatibility.sha256, original.compatibility.sha256);
  assert.notEqual(nextRequest.requestDigest, request.requestDigest);
  const f = fixture(t), review = f.approve(f.capture);
  const result = assessCapture(f.capture, nextRequest, [review], { intakeRoot: f.root });
  assert.equal(result.status, 'rejected');
  assert.ok(result.rejected.some(r => r.startsWith('requestDigest')));
  assert.ok(result.rejected.some(r => r.startsWith('review.requestDigest')));
});
test('missing or ambiguous authoritative identity/version headers fail closed', t => {
  const root = contractRoot(t), path = join(root, 'docs/spec/fidelity-compatibility-contract.md'), document = readFileSync(path, 'utf8');
  writeFileSync(path, document.replace('Contract ID:', 'Old identity:'));
  assert.throws(() => readContract(root), /one explicit identity/);
  writeFileSync(path, document + '\nContract ID: `another.contract`. Draft version: **0.1.1**,\n');
  assert.throws(() => readContract(root), /one explicit identity/);
});

for (const field of ['sourceRegistry', 'requirementLedger']) test(`${field} cannot redirect to a second mutable authority`, t => {
  const root = contractRoot(t), path = join(root, 'tests/reference-captures/requests.json');
  const catalog = JSON.parse(readFileSync(path)); catalog[field] = 'alternative.json';
  writeFileSync(path, JSON.stringify(catalog));
  assert.throws(() => readContract(root), /authoritative/);
});
test('changed target requirement wording invalidates bindings even if its ID and ledger version stay unchanged', t => {
  const root = contractRoot(t), path = join(root, 'tests/rendering-requirements/ledger.json'), ledger = JSON.parse(readFileSync(path));
  ledger.requirements.find(r => r.id === request.targetRequirementIds[0]).claim = 'A different claimed obligation';
  writeFileSync(path, JSON.stringify(ledger));
  assert.notEqual(readContract(root).requests.find(r => r.id === request.id).requestDigest, request.requestDigest);
});

function originFixture(t, id = 'crayon-os.normal.shifted-port') {
  const request = contract.requests.find(r => r.id === id), f = fixture(t, request), o = f.capture.observed;
  o.patternOriginState = { apiAvailability: 'available', offset: [7, -2], evidence: 'TEST ONLY observed state' };
  if (request.conditions.requiredInvocationClass) {
    o.controlDefinition.invocationClass = 'reviewed-direct-drawing';
    o.directOriginEvidence = { invocation: 'TEST ONLY', nonzeroOriginJustification: 'TEST ONLY', sourceReference: 'TEST ONLY' };
    const artifact = Buffer.from(JSON.stringify({ controlDefinition: o.controlDefinition, directOriginEvidence: o.directOriginEvidence, patternOriginState: o.patternOriginState }));
    writeFileSync(join(f.root, 'test-invocation.json'), artifact);
    f.capture.provenance.artifacts.push({ role: 'direct-origin-invocation', path: 'test-invocation.json', sha256: sha256(artifact) });
  }
  return f;
}
test('origin experiments distinguish coordinate motion from fixed physical placement without predicting pixels', () => {
  const base = contract.requests.find(r => r.id === 'crayon-os.normal').conditions;
  const moved = contract.requests.find(r => r.id === 'crayon-os.normal.shifted-port').conditions;
  const phase = contract.requests.find(r => r.id === 'crayon-os.normal.fixed-physical-phase').conditions;
  const physical = c => c.controlRect.map((v, i) => v - (i < 2 ? c.portOrigin[i] : 0));
  assert.notDeepEqual(physical(moved), physical(base));
  assert.deepEqual(physical(phase), physical(base));
  assert.deepEqual(phase.cropImageRect, base.cropImageRect);
  assert.deepEqual(phase.cropPortRect, [15, 17, 96, 36]);
  assert.ok(contract.requests.filter(r => r.sourceSlug === 'crayon-os').every(r => r.toObserve.patternOriginState === null));
});
for (const [name, mutate, expected] of [
  ['fixed-placement control rect', r => { r.conditions.controlRect[0]--; }, /experiment placement/],
  ['fixed-placement crop', r => { r.conditions.cropPortRect[0]--; r.conditions.cropImageRect[0]--; }, /experiment placement/],
  ['missing direct invocation precondition', r => { delete r.conditions.requiredInvocationClass; }, /direct-invocation/],
]) test(`origin request rejects ${name}`, t => {
  const root = contractRoot(t), path = join(root, 'tests/reference-captures/requests.json'), catalog = JSON.parse(readFileSync(path));
  mutate(catalog.requests.find(r => r.id === 'crayon-os.normal.fixed-physical-phase'));
  writeFileSync(path, JSON.stringify(catalog)); assert.throws(() => readContract(root), expected);
});
test('all pattern experiments require observed API availability/state, including the zero-origin baseline', t => {
  for (const id of ['crayon-os.normal', 'crayon-os.normal.shifted-port', 'crayon-os.normal.fixed-physical-phase']) {
    const f = originFixture(t, id); assert.equal(f.assess().status, 'reviewed-independent-capture');
    f.capture.observed.patternOriginState = null;
    assert.ok(f.assess().missing.includes('observed.patternOriginState.apiAvailability'));
  }
  const f = originFixture(t, 'crayon-os.normal');
  f.capture.observed.patternOriginState = { apiAvailability: 'unavailable', offset: null, evidence: 'TEST ONLY unavailable API evidence' };
  assert.equal(f.assess().status, 'reviewed-independent-capture');
  f.capture.observed.patternOriginState.offset = [0, 0]; assert.equal(f.assess().status, 'rejected');
});
test('nonzero origins cannot pass as ordinary manager calls or without independent invocation evidence', t => {
  const f = originFixture(t); assert.equal(f.assess().status, 'reviewed-independent-capture');
  const review = f.approve(f.capture); review.checks.directOriginInvocation = null;
  assert.ok(f.assess(f.capture, [review]).missing.includes('review.checks.directOriginInvocation'));
  const patternReview = f.approve(f.capture); patternReview.checks.patternOriginState = null;
  assert.ok(f.assess(f.capture, [patternReview]).missing.includes('review.checks.patternOriginState'));
  f.capture.observed.controlDefinition.invocationClass = 'window-control-manager';
  assert.ok(f.assess().rejected.some(s => s.startsWith('observed.controlDefinition.invocationClass')));
  f.capture.observed.controlDefinition.invocationClass = 'reviewed-direct-drawing';
  f.capture.provenance.artifacts = f.capture.provenance.artifacts.filter(a => a.role !== 'direct-origin-invocation');
  f.capture.observed.directOriginEvidence = null;
  const result = f.assess(); assert.equal(result.status, 'partial');
  assert.ok(result.missing.includes('provenance.artifacts.direct-origin-invocation'));
  assert.ok(result.missing.includes('observed.directOriginEvidence.nonzeroOriginJustification'));
});
test('swapped direct invocation or pattern-origin record rejects a fresh review', t => {
  const f = originFixture(t); f.capture.observed.patternOriginState.offset = [0, 0];
  assert.ok(f.assess().rejected.some(s => s.startsWith('direct-origin-invocation')));
});
