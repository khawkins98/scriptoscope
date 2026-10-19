import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { readContract, knownImages, captureTemplate, reviewTemplate, assessCapture, assessCorpus, sha256, digest, repositoryRoot, publicFaceScope } from './contract.mjs';

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

test('actual checked-in originals are scoped observations with every broader requirement unresolved', () => {
  const report = assessCorpus(contract, JSON.parse(readFileSync(new URL('./captures.json', import.meta.url))), JSON.parse(readFileSync(new URL('./reviews.json', import.meta.url))), { intakeRoot: join(repositoryRoot, 'tests/reference-captures'), known: knownImages() });
  assert.equal(report.requests.length, 59);
  assert.equal(report.requests.filter(r => r.status === 'missing').length, 47);
  assert.deepEqual(report.requests.filter(r => r.status === 'evidence-incomplete').map(r => r.id), ['windows-95.normal', 'windows-95.pressed', 'windows-95.inactive', 'system7-nostalgia-silver.normal', 'system7-nostalgia-silver.pressed', 'system7-nostalgia-silver.inactive', 'apple-lisa.normal', 'crayon-os.normal', 'apple-lisa.pressed', 'apple-lisa.inactive', 'crayon-os.pressed', 'crayon-os.inactive']);
  assert.equal(report.captures.length, 12);
  for (const capture of report.captures) {
    assert.equal(capture.status, 'reviewed-scoped-observation');
    assert.deepEqual(capture.missing, []); assert.deepEqual(capture.rejected, []);
    assert.deepEqual(capture.verifiedRequirementIds, []);
    assert.deepEqual(capture.unresolvedRequirementIds, contract.requests.find(r => r.id === capture.requestId).targetRequirementIds);
    const requestReport = report.requests.find(r => r.id === capture.requestId);
    assert.deepEqual(requestReport.scopedEligibleObservations, [capture.captureId]);
  }
  assert.equal(report.knownNonIndependent.filter(r => r.kind === 'qualitative-author-preview').length, 18);
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
  for (const path of ['tests/reference-captures/requests.json', 'tests/reference-captures/eligibility-policy.json', 'tests/control-availability/source-choices.json', 'tests/rendering-requirements/ledger.json', 'docs/spec/fidelity-compatibility-contract.md']) {
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
test('unrelated authority prose changes provenance without invalidating an attestation', t => {
  const root = contractRoot(t), path = join(root, 'docs/spec/fidelity-compatibility-contract.md');
  writeFileSync(path, readFileSync(path, 'utf8') + '\nUnrelated documented example.\n');
  const changed = readContract(root), nextRequest = changed.requests.find(r => r.id === request.id);
  assert.notEqual(changed.compatibility.sha256, contract.compatibility.sha256);
  assert.equal(nextRequest.requestDigest, request.requestDigest);
  const f = fixture(t), review = f.approve(f.capture);
  assert.equal(assessCapture(f.capture, nextRequest, [review], { intakeRoot: f.root }).status, 'reviewed-independent-capture');
});
test('changed normative policy invalidates an existing capture and its review', t => {
  const root = contractRoot(t), path = join(root, 'tests/reference-captures/eligibility-policy.json');
  const policy = JSON.parse(readFileSync(path)); policy.sections.common.rules.push('A new eligibility obligation.');
  writeFileSync(path, JSON.stringify(policy));
  const next = readContract(root).requests.find(r => r.id === request.id);
  assert.notEqual(next.requestDigest, request.requestDigest);
  const f = fixture(t), result = assessCapture(f.capture, next, [f.approve(f.capture)], { intakeRoot: f.root });
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

// TEST ONLY: no original session, captured pixels, approval or ledger change.
function scopedFixture(t, req = request) {
  const f = fixture(t, req), c = f.capture;
  const template = captureTemplate(req, { scope: 'public-api-empty-face' });
  c.reviewScope = template.reviewScope;
  c.observed.controlDefinition.hilite = template.reviewScope.publicInvocation.hilite;
  c.observed.controlDefinition.enabled = req.conditions.enabled;
  for (const key of ['font', 'patchStack', 'baseChain', 'resourceSearchOrder', 'selectedProvider', 'resourceCache', 'privateDefaultState']) c.observed[key] = null;
  c.observed.unknownConditions = Object.fromEntries(Object.keys(template.observed.unknownConditions).map(k => [k, `TEST ONLY: ${k} was not observed; no dependent claim.`]));
  const artifacts = { 'indexed-palette': Buffer.from('TEST PALETTE'),
    'producer-table': Buffer.from('TEST PRODUCER TABLE'), 'full-frame': png(640, 480) };
  for (const [role, bytes] of Object.entries(artifacts)) {
    const path = `${role}.${role === 'full-frame' ? 'png' : 'bin'}`;
    writeFileSync(join(f.root, path), bytes); c.provenance.artifacts.push({role, path, sha256: sha256(bytes)});
  }
  c.observed.palette.sha256 = sha256(artifacts['indexed-palette']);
  c.observed.publicApiFace = {
    configuredScheme: { archiveSha256: req.source.archiveSha256, forkSha256: req.source.forkSha256, evidence: 'TEST configured file only; private selection unknown' },
    invocation: { api: 'NewControl', drawApi: 'Draw1Control', controlRect: [20,20,80,20], title: '', state: req.conditions.state, defaultRing: false, defaultApiInvoked: false, ...([2,5].includes(template.reviewScope.version) ? {stateApi:'HiliteControl'} : {}) },
    port: { origin: [0,0], bounds: [0,0,160,80], effectiveClipRect: [0,0,160,80], backgroundRGB: [255,255,255], backgroundOpaque: true },
    producer: { name: 'TEST producer', buildArtifacts: [{name:'TEST external emulator build',sha256:'1'.repeat(64)}], tableSha256: sha256(artifacts['producer-table']),
      pixelEncoding: 'rgba8', colorRealization: 'TEST ONLY recorded display/producer conditions, not general transfer proof',
      timing: 'TEST AFTER drawing, before/after mapping; not pre-draw evidence', version: {status:'unknown',reason:'TEST semantic release not established; build bytes pinned'} },
    fullFrame: { sha256: sha256(artifacts['full-frame']), width:640, height:480, requestImageRect:[80,90,160,80],
      transform:'requestImageXY = fullFrameXY - requestImageRect.xy; no resampling or color conversion' },
  };
  const approve = capture => {
    const o = capture.observed, p = o.publicApiFace;
    for (const [role, value] of Object.entries({ 'configured-scheme': p?.configuredScheme,
      'public-invocation': {controlDefinition:o.controlDefinition,invocation:p?.invocation,port:p?.port,fullFrame:p?.fullFrame},
      'pixel-conditions': {palette:o.palette,producer:p?.producer},'producer-identities':p?.producer?.buildArtifacts })) {
      const bytes = Buffer.from(JSON.stringify(value ?? null)), path = `${role}.json`;
      writeFileSync(join(f.root,path),bytes);
      let a = capture.provenance.artifacts.find(a=>a.role===role);
      if (!a) capture.provenance.artifacts.push(a={role});
      Object.assign(a,{path,sha256:sha256(bytes)});
    }
    return f.approve(capture);
  };
  approve(c);
  return {...f, request:req, approve, assess:(capture=c, reviews=[approve(capture)], known=[])=>assessCapture(capture,req,reviews,{intakeRoot:f.root,known})};
}

test('scoped observations associate geometry/fill without verifying either or satisfying a request', t => {
  for (const id of ['windows-95.normal','system7-nostalgia-silver.normal']) {
    const f=scopedFixture(t,contract.requests.find(r=>r.id===id)),review=f.approve(f.capture),result=f.assess(f.capture,[review]);
    assert.equal(result.status,'reviewed-scoped-observation');
    assert.deepEqual(result.verifiedRequirementIds,[]);assert.deepEqual(result.unresolvedRequirementIds,f.request.targetRequirementIds);
    assert.deepEqual(review.targetRequirementIds,['geometry.remaining','fill.remaining']);
    assert.equal(result.unresolvedConditions.length,8);assert.ok(result.excludedClaims.includes('alpha-or-mask'));
    const report=assessCorpus(contract,{schemaVersion:1,captures:[f.capture]},{schemaVersion:1,reviews:[review]},{intakeRoot:f.root,known:[]});
    const row=report.requests.find(r=>r.id===id);assert.equal(row.status,'evidence-incomplete');
    assert.deepEqual(row.scopedEligibleObservations,[f.capture.id]);assert.deepEqual(row.unresolvedRequirementIds,f.request.targetRequirementIds);
  }
});

test('scope wording, version, face region and excluded-claim expansion reject fresh attestations', t => {
  for (const mutate of [c=>c.reviewScope.version++,c=>c.reviewScope.facePortRect[2]=40,c=>c.reviewScope.faceImageRect[0]++,
    c=>c.reviewScope.excludedClaims=[],c=>c.reviewScope.claim='Whole button certified',c=>c.reviewScope.comparisonLayer='raw-alpha',
    c=>c.reviewScope.associatedRequirementIds.push('selection.original'),c=>c.reviewScope.id='invented']) {
    const f=scopedFixture(t);mutate(f.capture);assert.equal(f.assess().status,'rejected');
  }
});

test('normal v1 scope cannot expand to labels, defaults, other states or Crayon',t=>{
  for(const id of ['windows-95.default','windows-95.pressed','system7-nostalgia-silver.inactive','crayon-os.normal']) {
    const req=contract.requests.find(r=>r.id===id);
    if (id.endsWith('.default')) assert.throws(()=>captureTemplate(req,{scope:'public-api-empty-face'}),/unsupported review scope/);
    else assert.equal(captureTemplate(req,{scope:'public-api-empty-face'}).reviewScope.version,id.startsWith('crayon')?3:2);
    const f=scopedFixture(t);f.capture.requestId=req.id;f.capture.requestDigest=req.requestDigest;f.capture.source=req.source;f.capture.conditions=structuredClone(req.conditions);
    const result=assessCapture(f.capture,req,[f.approve(f.capture)],{intakeRoot:f.root});assert.equal(result.status,'rejected');
  }
  for(const mutate of [c=>c.conditions.text='OK',c=>c.observed.publicApiFace.invocation.title='OK',c=>c.observed.publicApiFace.invocation.defaultRing=true,
    c=>c.observed.publicApiFace.invocation.api='DrawControls',c=>c.observed.publicApiFace.invocation.drawApi='Other',
    c=>c.observed.publicApiFace.invocation.defaultApiInvoked=true,c=>c.observed.privateDefaultState=false,
    ...['procedureId','variant','hilite','value'].map(k=>c=>c.observed.controlDefinition[k]=1),
    c=>c.observed.publicApiFace.invocation.controlRect[2]=79,c=>c.observed.publicApiFace.port.backgroundRGB=[0,0,0]]) {
    const f=scopedFixture(t);mutate(f.capture);assert.equal(f.assess().status,'rejected');
  }
});

test('missing relevant scoped conditions and omitted unknown reasons remain ineligible',t=>{
  for(const mutate of [c=>delete c.observed.palette,c=>delete c.observed.engineInstallation.sha256,c=>delete c.observed.publicApiFace.configuredScheme,
    c=>delete c.observed.publicApiFace.invocation.api,c=>delete c.observed.publicApiFace.port.effectiveClipRect,
    c=>delete c.observed.publicApiFace.producer.tableSha256,c=>delete c.observed.publicApiFace.producer.buildArtifacts,
    c=>delete c.observed.publicApiFace.producer.timing,c=>delete c.observed.publicApiFace.producer.version.reason,
    c=>delete c.observed.unknownConditions.font,c=>delete c.observed.selectedProvider]) {
    const f=scopedFixture(t);mutate(f.capture);assert.ok(['partial','rejected'].includes(f.assess().status));
  }
});

test('known scoped fields must validate and cannot hide behind an unknown reason',t=>{
  for(const mutate of [c=>c.observed.font={name:'incomplete'},c=>c.observed.patchStack=[{name:'incomplete'}],
    c=>c.observed.selectedProvider={name:'incomplete'},c=>c.observed.resourceCache={name:'incomplete'}]) {
    const f=scopedFixture(t);mutate(f.capture);assert.equal(f.assess().status,'partial');
  }
});

test('scoped review must bind exact scope, subset, capture digest and independent reviewer',t=>{
  const f=scopedFixture(t);assert.equal(f.assess(f.capture,[]).status,'awaiting-independent-review');
  for(const mutate of [r=>delete r.reviewScope,r=>r.reviewScope.version++,r=>r.targetRequirementIds=f.request.targetRequirementIds,
    r=>r.captureDigest='0'.repeat(64),r=>r.requestDigest='0'.repeat(64),r=>r.reviewer=f.capture.provenance.producer,
    r=>r.checks.scopeAndLimits=false,r=>r.checks.recordedPixelConditions=false]) {
    const r=f.approve(f.capture);mutate(r);assert.ok(['partial','rejected'].includes(f.assess(f.capture,[r]).status));
  }
  const r=f.approve(f.capture);f.capture.observed.unknownConditions.font='Different unknown reason';
  f.approve(f.capture);assert.equal(f.assess(f.capture,[r]).status,'rejected');
});

test('scope cannot turn incomplete full captures into complete evidence or weaken old strict requests',t=>{
  for(const explicit of [false,true]) {
    const f=scopedFixture(t);if(explicit)f.capture.reviewScope={id:'full',version:1};else delete f.capture.reviewScope;
    const result=f.assess();assert.equal(result.status,'partial');assert.ok(result.missing.some(x=>x.includes('font')));
    assert.ok(result.missing.some(x=>x.includes('resourceSearchOrder')));
  }
  const full=fixture(t);full.capture.reviewScope={id:'full',version:1};assert.equal(full.assess().status,'reviewed-independent-capture');
});

test('scoped original frame and palette/producer artifacts remain bound and contamination screened',t=>{
  const f=scopedFixture(t),r=f.approve(f.capture);
  const original=f.capture.provenance.artifacts.find(a=>a.role==='full-frame');
  assert.equal(f.assess(f.capture,[r],[{path:'synthetic-fullframe.png',sha256:original.sha256}]).status,'rejected');
  assert.equal(f.assess(f.capture,[r],[{path:'renamed-golden.png',sha256:f.capture.image.sha256}]).status,'rejected');
  for(const role of ['indexed-palette','producer-identities','producer-table','public-invocation','configured-scheme','full-frame']) {
    const other=scopedFixture(t),review=other.approve(other.capture),a=other.capture.provenance.artifacts.find(a=>a.role===role);
    writeFileSync(join(other.root,a.path),'CHANGED');assert.equal(other.assess(other.capture,[review]).status,'rejected');
  }
  f.capture.observed.publicApiFace.fullFrame.requestImageRect=[600,400,160,80];assert.equal(f.assess().status,'rejected');
});

test('catalog version is provenance while actual scope admission remains exact',t=>{
  const root=contractRoot(t),path=join(root,'tests/reference-captures/requests.json'),c=JSON.parse(readFileSync(path));
  c.requestVersion='0.1.1';writeFileSync(path,JSON.stringify(c));assert.equal(readContract(root).requests[0].requestDigest,contract.requests[0].requestDigest);
  const scoped=publicFaceScope(request);assert.equal(scoped.version,1);assert.deepEqual(scoped.faceImageRect,[20,20,80,20]);
  assert.equal(publicFaceScope({...request,conditions:{...request.conditions,controlRect:[20,20,40,20]}}),null);
});


test('state scope v2 admits only logical highlight or disabled faces in an active window', t => {
  for (const slug of ['windows-95','system7-nostalgia-silver']) for (const state of ['pressed','inactive']) {
    const req=contract.requests.find(r=>r.id===`${slug}.${state}`),f=scopedFixture(t,req),result=f.assess();
    assert.equal(f.capture.reviewScope.version,2);assert.equal(result.status,'reviewed-scoped-observation');
    assert.equal(f.capture.observed.controlDefinition.hilite,state==='pressed'?10:255);
    assert.deepEqual(result.verifiedRequirementIds,[]);assert.deepEqual(result.unresolvedRequirementIds,req.targetRequirementIds);
    assert.equal(result.unresolvedRequirementIds.length,5);
    assert.ok(result.excludedClaims.includes('physical-mouse-gesture'));assert.ok(result.excludedClaims.includes('inactive-window'));
    const report=assessCorpus(contract,{schemaVersion:1,captures:[f.capture]},{schemaVersion:1,reviews:[f.approve(f.capture)]},{intakeRoot:f.root,known:[]});
    assert.equal(report.requests.find(r=>r.id===req.id).status,'evidence-incomplete');
    for (const mutate of [c=>c.observed.controlDefinition.hilite=0,c=>c.observed.controlDefinition.hilite=state==='pressed'?255:10,
      c=>c.observed.controlDefinition.enabled=!req.conditions.enabled,c=>c.observed.controlDefinition.windowActive=false,
      ...['procedureId','variant','value'].map(k=>c=>c.observed.controlDefinition[k]=1),
      c=>c.observed.publicApiFace.invocation.state='normal',c=>c.observed.publicApiFace.invocation.stateApi='TrackControl',
      c=>delete c.observed.publicApiFace.invocation.stateApi,c=>c.observed.publicApiFace.invocation.api='TrackControl',
      c=>c.observed.publicApiFace.invocation.drawApi='DrawControls',c=>c.reviewScope.version=1,
      c=>c.reviewScope.excludedClaims=c.reviewScope.excludedClaims.filter(v=>v!=='physical-mouse-gesture'),
      c=>c.reviewScope.faceImageRect[2]=40,c=>c.observed.publicApiFace.invocation.title='OK',
      c=>c.observed.publicApiFace.invocation.defaultApiInvoked=true]) {
      const altered=structuredClone(f.capture);mutate(altered);
      assert.ok(['partial','rejected'].includes(f.assess(altered).status));
    }
    const reviewed=f.approve(f.capture);reviewed.reviewScope.version=1;
    assert.equal(f.assess(f.capture,[reviewed]).status,'rejected');
    const stale=f.approve(f.capture);stale.requestDigest='0'.repeat(64);
    assert.equal(f.assess(f.capture,[stale]).status,'rejected');
    assert.equal(f.assess(f.capture,[]).status,'awaiting-independent-review');
    const full=structuredClone(f.capture);delete full.reviewScope;
    assert.equal(f.assess(full).status,'partial');
    assert.equal(publicFaceScope({...req,conditions:{...req.conditions,windowActive:false}}),null);
  }
});

// Finite dependency checks: no browser, renderer or new original evidence.
test('unrelated ledger/registry additions and synchronized global versions preserve every request digest', t => {
  const root = contractRoot(t);
  const edit = (path, fn) => { const file=join(root,path), value=JSON.parse(readFileSync(file)); fn(value); writeFileSync(file,JSON.stringify(value)); };
  edit('tests/rendering-requirements/ledger.json', l => { l.inventoryVersion='99.0.0';l.requirements.push({id:'unrelated',claim:'Another family'}); });
  edit('tests/control-availability/source-choices.json', c => { c.reviewStatus='unrelated registry-wide update';c.sources.push({slug:'unrelated'}); });
  edit('tests/reference-captures/requests.json', c => {c.requestVersion='99.0.0';c.contractVersion='99.0.0';});
  const doc=join(root,'docs/spec/fidelity-compatibility-contract.md');
  writeFileSync(doc,readFileSync(doc,'utf8').replace(`**${contract.compatibility.version}**`,'**99.0.0**'));
  const next=readContract(root);
  assert.deepEqual(next.requests.map(r=>r.requestDigest),contract.requests.map(r=>r.requestDigest));
  assert.notDeepEqual(next.provenance,contract.provenance);
});
for (const [name,path,mutate] of [
  ['selected source fork','tests/control-availability/source-choices.json',c=>c.sources.find(s=>s.slug==='windows-95').forkSha256='a'.repeat(64)],
  ['engine component','tests/rendering-requirements/ledger.json',l=>l.inputs.find(i=>i.id===contract.catalog.engineComponentId).sha256='a'.repeat(64)],
  ['actual input','tests/reference-captures/requests.json',c=>c.requests.find(r=>r.id===request.id).conditions.controlRect[2]=79],
  ['required observation','tests/reference-captures/requests.json',c=>c.requests.find(r=>r.id===request.id).toObserve.newCondition=null],
  ['full policy','tests/reference-captures/eligibility-policy.json',p=>p.sections.full.version++],
]) test(`${name} changes the semantic binding`,t=>{
  const root=contractRoot(t),file=join(root,path),value=JSON.parse(readFileSync(file));mutate(value);writeFileSync(file,JSON.stringify(value));
  assert.notEqual(readContract(root).requests.find(r=>r.id===request.id).requestDigest,request.requestDigest);
});
test('policy changes are limited to requests using that section; missing rules fail closed',t=>{
  const root=contractRoot(t),file=join(root,'tests/reference-captures/eligibility-policy.json'),p=JSON.parse(readFileSync(file));
  p.sections.publicFaceV2.rules.push('A state-only obligation.');writeFileSync(file,JSON.stringify(p));
  const next=readContract(root);
  for(const r of contract.requests) assert.equal(next.requests.find(n=>n.id===r.id).requestDigest===r.requestDigest,publicFaceScope(r)?.version!==2);
  p.sections.common.rules=[];writeFileSync(file,JSON.stringify(p));assert.throws(()=>readContract(root),/normative eligibility/);
});
test('origin experiments bind transitive baseline inputs without changing unrelated requests',t=>{
  const root=contractRoot(t),file=join(root,'tests/reference-captures/requests.json'),c=JSON.parse(readFileSync(file));
  c.requests.find(r=>r.id==='crayon-os.normal').toObserve.baselineCondition=null;writeFileSync(file,JSON.stringify(c));
  const next=readContract(root);
  for(const r of contract.requests) assert.equal(next.requests.find(n=>n.id===r.id).requestDigest===r.requestDigest,!['crayon-os.normal','crayon-os.normal.shifted-port','crayon-os.normal.fixed-physical-phase'].includes(r.id));
});

test('adding a future unrelated scoped policy leaves all current bindings exact',t=>{
  const root=contractRoot(t),file=join(root,'tests/reference-captures/eligibility-policy.json'),p=JSON.parse(readFileSync(file));
  p.sections.crayonConditionedPixels={version:1,rules:['Future Crayon-only scope; not admitted by this implementation.']};
  writeFileSync(file,JSON.stringify(p));
  assert.deepEqual(readContract(root).requests.map(r=>r.requestDigest),contract.requests.map(r=>r.requestDigest));
});
test('baseline target definitions cannot escape the dependent request binding',t=>{
  const root=contractRoot(t),file=join(root,'tests/reference-captures/requests.json'),c=JSON.parse(readFileSync(file));
  c.requests.find(r=>r.id==='crayon-os.normal').targetRequirementIds.push('typography.original');
  writeFileSync(file,JSON.stringify(c));assert.throws(()=>readContract(root),/baseline targets must be covered/);
});

test('migration preserves prior facts and rejects old bindings instead of grandfathering them',()=>{
  const read=name=>readFileSync(new URL(name,import.meta.url));
  const receipt=JSON.parse(read('review-amendment-semantic-v1.json'));
  const priorBytes=read('captures-before-semantic-v1.json'), priorReviewBytes=read('reviews-before-semantic-v1.json');
  assert.equal(sha256(priorBytes),receipt.priorCapturesFileSha256);
  assert.equal(sha256(priorReviewBytes),receipt.priorReviewsFileSha256);
  assert.equal(sha256(JSON.stringify({...JSON.parse(read('captures.json')),captures:JSON.parse(read('captures.json')).captures.slice(0,6)},null,2)+'\n'),receipt.capturesFileSha256);
  assert.equal(sha256(JSON.stringify({...JSON.parse(read('reviews.json')),reviews:JSON.parse(read('reviews.json')).reviews.slice(0,6)},null,2)+'\n'),receipt.amendedReviewsFileSha256);
  const prior=JSON.parse(priorBytes),current=JSON.parse(read('captures.json'));
  assert.equal(prior.captures.length,6);
  assert.deepEqual(current.captures.slice(0,6).map(c=>({...c,requestDigest:null})),prior.captures.map(c=>({...c,requestDigest:null})));
  for(const c of prior.captures){
    const q=contract.requests.find(r=>r.id===c.requestId);
    assert.notEqual(c.requestDigest,q.requestDigest);
    const result=assessCapture(c,q,JSON.parse(priorReviewBytes).reviews,{intakeRoot:join(repositoryRoot,'tests/reference-captures')});
    assert.equal(result.status,'rejected');
    assert.ok(result.rejected.some(r=>r==='requestDigest: does not match request/pin'));
  }
});


test('Crayon v3 is one conditioned normal output with explicit unknown phase; full request stays incomplete',t=>{
 const req=contract.requests.find(r=>r.id==='crayon-os.normal'),f=scopedFixture(t,req);
 f.capture.observed.patternOriginState=null;
 f.capture.observed.unknownConditions.patternOriginState='TEST: original phase/API unobserved';
 const result=f.assess();assert.equal(result.status,'reviewed-scoped-observation',JSON.stringify(result));
 assert.deepEqual(result.verifiedRequirementIds,[]);assert.equal(result.unresolvedRequirementIds.length,5);
 assert(result.excludedClaims.includes('original-pattern-phase'));
 assert(result.unresolvedConditions.some(x=>x.field==='patternOriginState'));
 for(const mutate of [c=>delete c.observed.unknownConditions.patternOriginState,
  c=>c.observed.patternOriginState={apiAvailability:'available',offset:[0,0],evidence:'invented'},
  c=>c.reviewScope.version=1,c=>c.observed.publicApiFace.port.effectiveClipRect=[0,0,80,20]]){
  const changed=structuredClone(f.capture);mutate(changed);assert(['partial','rejected'].includes(f.assess(changed).status));
 }
 const full=structuredClone(f.capture);delete full.reviewScope;assert.equal(f.assess(full).status,'partial');
 assert.equal(publicFaceScope({...req,id:'crayon-os.pressed',conditions:{...req.conditions,state:'pressed'}}).version,5);
 assert.equal(publicFaceScope({...req,id:'crayon-os.shifted',conditions:{...req.conditions,portOrigin:[10,10]}}),null);
});
test('Crayon-only scoped policy cannot stale existing six request/review bindings',t=>{
 const root=contractRoot(t),file=join(root,'tests/reference-captures/eligibility-policy.json'),policy=JSON.parse(readFileSync(file));
 policy.sections.publicFaceV3.version++;writeFileSync(file,JSON.stringify(policy));const next=readContract(root);
 const captures=JSON.parse(readFileSync(new URL('./captures.json',import.meta.url))).captures;
 for(const c of captures.slice(0,6))assert.equal(next.requests.find(r=>r.id===c.requestId).requestDigest,c.requestDigest);
 assert.notEqual(next.requests.find(r=>r.id==='crayon-os.normal').requestDigest,contract.requests.find(r=>r.id==='crayon-os.normal').requestDigest);
});

test('Lisa v4 admits only its exact normal output and cannot stale seven prior bindings',t=>{
 const req=contract.requests.find(r=>r.id==='apple-lisa.normal'),f=scopedFixture(t,req);
 assert.equal(f.capture.reviewScope.version,4);
 assert.equal(f.assess().status,'reviewed-scoped-observation');
 assert.deepEqual(f.assess().verifiedRequirementIds,[]);
 for(const change of [c=>c.reviewScope.version=1,c=>c.observed.publicApiFace.port.effectiveClipRect=[0,0,80,20]]){
  const c=structuredClone(f.capture);change(c);assert.equal(f.assess(c).status,'rejected');
 }
 assert.equal(publicFaceScope({...req,id:'apple-lisa.pressed',conditions:{...req.conditions,state:'pressed'}}).version,5);
 for(const change of [{conditions:{...req.conditions,text:'OK'}},{conditions:{...req.conditions,portOrigin:[10,10]}}])
  assert.equal(publicFaceScope({...req,...change}),null);
 const root=contractRoot(t),file=join(root,'tests/reference-captures/eligibility-policy.json'),policy=JSON.parse(readFileSync(file));
 policy.sections.publicFaceV4.version++;writeFileSync(file,JSON.stringify(policy));const next=readContract(root);
 const old=JSON.parse(readFileSync(new URL('./captures.json',import.meta.url))).captures.slice(0,7);
 for(const c of old)assert.equal(next.requests.find(r=>r.id===c.requestId).requestDigest,c.requestDigest);
 assert.notEqual(next.requests.find(r=>r.id===req.id).requestDigest,req.requestDigest);
});


test('campaign additions preserve all thirteen request objects/digests and eight original records/reviews',()=>{
 const prior=JSON.parse(readFileSync(new URL('./campaign-retention.json',import.meta.url)));
 for(const pinned of prior.requests){
  assert.equal(digest(contract.catalog.requests.find(r=>r.id===pinned.id)),pinned.objectSha256);
  assert.equal(contract.requests.find(r=>r.id===pinned.id).requestDigest,pinned.requestDigest);
 }
 const captures=JSON.parse(readFileSync(new URL('./captures.json',import.meta.url)));
 const reviews=JSON.parse(readFileSync(new URL('./reviews.json',import.meta.url)));
 assert.equal(digest({...captures,captures:captures.captures.slice(0,8)}),prior.capturesSha256);
 assert.equal(digest({...reviews,reviews:reviews.reviews.slice(0,8)}),prior.reviewsSha256);
 for(const pinned of prior.captures)assert.equal(digest(captures.captures.find(c=>c.id===pinned.id)),pinned.digest);
});
test('v5 covers only forty-six new fixed campaign IDs; prior scopes and missing captures stay explicit',()=>{
 const planned=contract.requests.filter(r=>publicFaceScope(r)?.version===5);
 assert.equal(planned.length,46);
 assert.equal(contract.requests.filter(r=>publicFaceScope(r)).length,54);
 assert.equal(new Set(contract.requests.filter(r=>publicFaceScope(r)).map(r=>r.sourceSlug)).size,18);
 for(const req of planned){
  const s=publicFaceScope(req);assert.equal(s.publicInvocation.hilite,{normal:0,pressed:10,inactive:255}[req.conditions.state]);
  assert.equal(s.publicInvocation.stateApi,'HiliteControl');
  assert(s.excludedClaims.includes('original-pattern-phase'));
 }
 const req=planned[0];
 for(const mutate of [r=>r.sourceSlug='unregistered',r=>r.id+='-other',r=>r.conditions.defaultRing=true,
  r=>r.conditions.portOrigin=[1,0],r=>r.conditions.controlRect[0]++,r=>r.conditions.text='OK',
  r=>r.conditions.windowActive=false,r=>r.conditions.enabled=false]){
  const changed=structuredClone(req);mutate(changed);assert.equal(publicFaceScope(changed),null);
 }
});
test('v5 requires actual state API, exact hilite and explicit unknown phase; full scope remains strict',t=>{
 for(const id of ['1138.normal','crayon-os.pressed','apple-lisa.inactive']){
  const req=contract.requests.find(r=>r.id===id),f=scopedFixture(t,req);
  f.capture.observed.patternOriginState=null;
  f.capture.observed.unknownConditions.patternOriginState='TEST ONLY: phase and API not observed';
  const result=f.assess();assert.equal(result.status,'reviewed-scoped-observation',JSON.stringify(result));
  assert.deepEqual(result.verifiedRequirementIds,[]);assert.equal(result.unresolvedRequirementIds.length,5);
  assert.equal(f.assess(f.capture,[]).status,'awaiting-independent-review');
  for(const mutate of [c=>delete c.observed.publicApiFace.invocation.stateApi,
   c=>c.observed.controlDefinition.hilite=99,c=>delete c.observed.unknownConditions.patternOriginState,
   c=>c.observed.patternOriginState={apiAvailability:'available',offset:[0,0],evidence:'inferred'},
   c=>c.observed.publicApiFace.port.effectiveClipRect=[0,0,80,20],c=>c.reviewScope.version=4]){
   const changed=structuredClone(f.capture);mutate(changed);assert(['partial','rejected'].includes(f.assess(changed).status));
  }
  const full=structuredClone(f.capture);delete full.reviewScope;assert.equal(f.assess(full).status,'partial');
 }
});
test('v5 policy changes invalidate only new campaign requests, never old applicable dependencies',t=>{
 const root=contractRoot(t),file=join(root,'tests/reference-captures/eligibility-policy.json'),p=JSON.parse(readFileSync(file));
 p.sections.publicFaceV5.version++;writeFileSync(file,JSON.stringify(p));
 const next=readContract(root);
 for(const req of contract.requests)assert.equal(next.requests.find(r=>r.id===req.id).requestDigest===req.requestDigest,publicFaceScope(req)?.version!==5);
});
