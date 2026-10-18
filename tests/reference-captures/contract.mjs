import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { inspectPNG } from './png.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => sha256(JSON.stringify(canonical(value)));
const readJSON = path => JSON.parse(readFileSync(path));
const text = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const check = (ok, message) => { if (!ok) throw new Error(message); };
const inside = (root, path) => {
  check(text(path) && !isAbsolute(path), 'file path must be relative to intake directory');
  const file = realpathSync(resolve(root, path)), rel = relative(realpathSync(root), file);
  check(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'file escapes intake directory');
  check(statSync(file).size <= 40 * 1024 * 1024, 'file exceeds 40 MiB intake limit');
  return readFileSync(file);
};

/** Reuse source/requirement authorities; this contract never approves their draft selections. */
export function readContract(root = repositoryRoot) {
  const catalog = readJSON(resolve(root, 'tests/reference-captures/requests.json'));
  const choices = readJSON(resolve(root, catalog.sourceRegistry));
  const ledger = readJSON(resolve(root, catalog.requirementLedger));
  check(catalog.schemaVersion === 1 && text(catalog.requestVersion), 'unsupported request schema/version');
  const engine = ledger.inputs.find(input => input.id === catalog.engineComponentId);
  check(engine && hash(engine.sha256), 'missing pinned engine component');
  const ids = new Set();
  const requests = catalog.requests.map(request => {
    check(text(request.id) && !ids.has(request.id), 'missing/duplicate request id'); ids.add(request.id);
    const source = choices.sources.find(source => source.slug === request.sourceSlug);
    check(source && hash(source.archiveSha256) && hash(source.forkSha256), `${request.id}: missing source pin`);
    check(sha256(readFileSync(resolve(root, source.path))) === source.archiveSha256, `${request.id}: source archive drift`);
    check(request.targetRequirementIds.length > 0 && request.targetRequirementIds.every(id => ledger.requirements.some(r => r.id === id)), `${request.id}: unknown requirement target`);
    const c = request.conditions;
    check(c?.text === '' && ['normal', 'pressed', 'inactive'].includes(c.state), `${request.id}: initial body-only scope changed`);
    check(c.scale?.[0] === 1 && c.scale?.[1] === 1 && c.imageSize?.every(n => Number.isInteger(n) && n > 0), `${request.id}: invalid native capture geometry`);
    check(c.cropPortRect?.length === 4 && c.cropImageRect?.length === 4 && c.portOrigin?.length === 2, `${request.id}: missing crop transform`);
    check(isDeepStrictEqual(c.cropImageRect, [c.cropPortRect[0] - c.portOrigin[0], c.cropPortRect[1] - c.portOrigin[1], ...c.cropPortRect.slice(2)]), `${request.id}: inconsistent crop transform`);
    const [x, y, w, h] = c.cropImageRect;
    check(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= c.imageSize[0] && y + h <= c.imageSize[1], `${request.id}: crop outside image`);
    const pinned = { contractId: catalog.contractId, contractVersion: catalog.contractVersion, requestVersion: catalog.requestVersion,
      ledgerVersion: ledger.inventoryVersion, sourceRegistrySchema: choices.schemaVersion, sourceRegistryReview: choices.reviewStatus,
      request, source, engineComponent: engine };
    return { ...request, source, engineComponent: engine, requestDigest: digest(pinned) };
  });
  return { catalog, requests };
}

/** Known-byte contamination screen, NOT authentication of unknown external images. */
export function knownImages(root = repositoryRoot) {
  const records = [];
  for (const [directory, kind] of [['demo/assets/references', 'qualitative-author-preview'],
    ['tests/rendering-options/goldens', 'scriptoscope-regression'], ['tests/visual-baselines', 'scriptoscope-regression']]) {
    const visit = dir => {
      for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) visit(path);
        else if (entry.name.endsWith('.png')) records.push({ path, kind, sha256: sha256(readFileSync(resolve(root, path))),
          provenanceRecord: directory === 'demo/assets/references' ? `${directory}/README.md` : directory === 'tests/rendering-options/goldens' ? `${directory}/manifest.json` : `${directory}/README.md`,
          originalCaptureVersion: 'unknown' });
      }
    };
    visit(directory);
  }
  return records;
}

export function captureTemplate(request) {
  return { id: `${request.id}.capture-1`, kind: 'independent-original', requestId: request.id, requestDigest: request.requestDigest,
    source: structuredClone(request.source), engineComponent: structuredClone(request.engineComponent), conditions: structuredClone(request.conditions),
    observed: structuredClone(request.toObserve), image: { path: null, sha256: null, width: null, height: null },
    provenance: { producer: null, capturedAt: null, originalEnvironment: null, method: null, artifacts: [] } };
}

export const reviewDigest = capture => digest(capture);
const reviewChecks = ['originalEnvironment', 'sourceAndBaseIdentity', 'engineAndPatchStack', 'conditionsAndTransform', 'imageAndArtifacts', 'independentOfScriptoscope'];
export function reviewTemplate(capture, request) {
  return { captureId: capture.id, verdict: null, reviewer: null, reviewedAt: null, captureDigest: reviewDigest(capture),
    requestDigest: request.requestDigest, targetRequirementIds: [...request.targetRequirementIds],
    checks: Object.fromEntries(reviewChecks.map(key => [key, null])), notes: null };
}

/** Validate eligibility of supplied evidence, never renderer fidelity or historical authenticity. */
export function assessCapture(capture, request, reviews, { intakeRoot, known = [] }) {
  const missing = [], rejected = [];
  const need = (ok, field) => { if (!ok) missing.push(field); };
  const equal = (actual, expected, field) => {
    if (actual == null) missing.push(field);
    else if (!isDeepStrictEqual(actual, expected)) rejected.push(`${field}: does not match request/pin`);
  };
  const identity = (value, field) => {
    need(text(value?.name), `${field}.name`); need(text(value?.version), `${field}.version`); need(hash(value?.sha256), `${field}.sha256`);
  };
  const kind = capture?.kind;
  const result = status => ({ captureId: capture?.id ?? null, requestId: capture?.requestId ?? null, kind, status, missing, rejected });
  need(text(capture?.id), 'id');
  if (!['independent-original', 'qualitative-author-preview', 'scriptoscope-regression', 'synthetic-test'].includes(kind)) rejected.push('unknown evidence kind');
  let bytes;
  if (!capture?.image?.path) missing.push('image.path');
  else try { bytes = inside(intakeRoot, capture.image.path); } catch (error) { rejected.push(`image: ${error.message}`); }
  need(hash(capture?.image?.sha256), 'image.sha256');
  if (bytes) {
    if (hash(capture.image.sha256) && sha256(bytes) !== capture.image.sha256) rejected.push('image.sha256: bytes do not match');
    const contamination = known.filter(record => record.sha256 === sha256(bytes));
    if (kind === 'independent-original' && contamination.length) rejected.push(`known non-independent image bytes: ${contamination.map(r => r.path).join(', ')}`);
    try {
      const { width, height } = inspectPNG(bytes);
      equal([capture.image.width, capture.image.height], [width, height], 'image dimensions');
      if (request) equal([width, height], request.conditions.imageSize, 'image/request size');
    } catch (error) { rejected.push(`image: ${error.message}`); }
  }
  if (kind !== 'independent-original') return result(rejected.length ? 'rejected' : missing.length ? 'partial' : 'non-independent');
  if (!request) { rejected.push('unknown capture request'); return result('rejected'); }
  equal(capture.requestDigest, request.requestDigest, 'requestDigest');
  equal(capture.source, request.source, 'source');
  equal(capture.engineComponent, request.engineComponent, 'engineComponent');
  equal(capture.conditions, request.conditions, 'conditions');
  const o = capture.observed ?? {};
  identity(o.os, 'observed.os'); identity(o.engineInstallation, 'observed.engineInstallation');
  if (text(o.engineInstallation?.name) && o.engineInstallation.name !== 'Kaleidoscope') rejected.push('engineInstallation.name: expected Kaleidoscope');
  if (text(o.engineInstallation?.version) && o.engineInstallation.version !== '2.3.1') rejected.push('engineInstallation.version: expected Kaleidoscope2.3.1');
  for (const field of ['patchStack', 'baseChain', 'resourceSearchOrder']) {
    need(Array.isArray(o[field]), `observed.${field}`);
    if (Array.isArray(o[field])) o[field].forEach((value, i) => identity(value, `observed.${field}[${i}]`));
  }
  need(Array.isArray(o.resourceSearchOrder) && o.resourceSearchOrder.length > 0, 'observed.resourceSearchOrder (ordered original resource providers)');
  need(text(o.baseChainReason), 'observed.baseChainReason (including an explicitly empty chain)');
  need(text(o.patchStackReason), 'observed.patchStackReason (including an explicitly empty stack)');
  identity(o.font, 'observed.font');
  need(Number.isFinite(o.font?.pointSize) && o.font.pointSize > 0, 'observed.font.pointSize');
  need(text(o.font?.style), 'observed.font.style');
  need([1, 2, 4, 8, 16, 24, 32].includes(o.palette?.depth), 'observed.palette.depth');
  need(hash(o.palette?.sha256), 'observed.palette.sha256 (palette/color configuration record)');
  need(text(o.palette?.description), 'observed.palette.description');
  need(text(o.captureMethod), 'observed.captureMethod');
  for (const field of ['procedureId', 'variant', 'hilite', 'value']) need(Number.isInteger(o.controlDefinition?.[field]), `observed.controlDefinition.${field}`);
  for (const field of ['enabled', 'windowActive']) {
    need(typeof o.controlDefinition?.[field] === 'boolean', `observed.controlDefinition.${field}`);
    if (typeof o.controlDefinition?.[field] === 'boolean') equal(o.controlDefinition[field], request.conditions[field], `observed.controlDefinition.${field}`);
  }
  for (const field of ['defaultMechanism', 'invocation']) need(text(o.controlDefinition?.[field]), `observed.controlDefinition.${field}`);
  const p = capture.provenance ?? {};
  need(text(p.producer), 'provenance.producer'); need(text(p.capturedAt) && Number.isFinite(Date.parse(p.capturedAt)), 'provenance.capturedAt');
  need(text(p.method), 'provenance.method');
  if (p.originalEnvironment === false) rejected.push('provenance: producer declares non-original environment');
  else need(p.originalEnvironment === true, 'provenance.originalEnvironment');
  need(Array.isArray(p.artifacts), 'provenance.artifacts');
  const roles = new Set();
  for (const artifact of Array.isArray(p.artifacts) ? p.artifacts : []) {
    roles.add(artifact.role); need(hash(artifact.sha256), `artifact ${artifact.role}.sha256`);
    try {
      const artifactBytes = inside(intakeRoot, artifact.path);
      if (sha256(artifactBytes) !== artifact.sha256) rejected.push(`artifact ${artifact.role}: hash mismatch`);
      if (artifact.role === 'environment-manifest') {
        equal(JSON.parse(artifactBytes), JSON.parse(JSON.stringify({ source: capture.source, engineComponent: capture.engineComponent, observed: capture.observed })), 'environment-manifest');
      }
    }
    catch (error) { rejected.push(`artifact ${artifact.role}: ${error.message}`); }
  }
  for (const role of ['capture-log', 'environment-manifest']) need(roles.has(role), `provenance.artifacts.${role}`);
  const matches = reviews.filter(review => review.captureId === capture.id);
  if (matches.length > 1) rejected.push('multiple review decisions: resolve explicitly before intake');
  const review = matches[0];
  if (review) {
    if (review.verdict === 'rejected') rejected.push(`review rejected: ${review.notes ?? 'no reason supplied'}`);
    else if (review.verdict !== 'accepted') missing.push('review.verdict');
    equal(review.captureDigest, reviewDigest(capture), 'review.captureDigest');
    equal(review.requestDigest, request.requestDigest, 'review.requestDigest');
    equal(review.targetRequirementIds, request.targetRequirementIds, 'review.targetRequirementIds');
    need(text(review.reviewer), 'review.reviewer');
    if (text(review.reviewer) && review.reviewer === p.producer) rejected.push('reviewer must be independent of capture producer');
    need(text(review.reviewedAt) && Number.isFinite(Date.parse(review.reviewedAt)), 'review.reviewedAt'); need(text(review.notes), 'review.notes');
    for (const field of reviewChecks) need(review.checks?.[field] === true, `review.checks.${field}`);
  }
  if (rejected.length) return result('rejected');
  if (missing.length) return result('partial');
  return result(review ? 'reviewed-independent-capture' : 'awaiting-independent-review');
}

export function assessCorpus(contract, corpus, reviewFile, options) {
  check(corpus.schemaVersion === 1 && Array.isArray(corpus.captures), 'unsupported capture manifest');
  check(reviewFile.schemaVersion === 1 && Array.isArray(reviewFile.reviews), 'unsupported review manifest');
  const ids = corpus.captures.map(c => c.id);
  check(ids.every(text) && new Set(ids).size === ids.length, 'missing/duplicate capture id');
  check(reviewFile.reviews.every(review => ids.includes(review.captureId)), 'orphan review does not name an intake capture');
  const captures = corpus.captures.map(capture => assessCapture(capture, contract.requests.find(r => r.id === capture.requestId), reviewFile.reviews, options));
  return { schemaVersion: 1, contractId: contract.catalog.contractId, requestVersion: contract.catalog.requestVersion,
    interpretation: 'Evidence eligibility only. Missing captures are not passes; reviewed intake does not verify renderer output, original decoder, whole cases or complete fidelity.',
    requests: contract.requests.map(request => {
      const records = captures.filter(c => c.requestId === request.id && c.kind === 'independent-original');
      return { id: request.id, requestDigest: request.requestDigest, sourceSlug: request.sourceSlug,
        sourceSelectionReview: request.source.selectionReviewStatus, targetRequirementIds: request.targetRequirementIds,
        status: records.some(c => c.status === 'reviewed-independent-capture') ? 'reviewed-capture-available' : records.length ? 'evidence-incomplete' : 'missing',
        requestUnknownFields: Object.keys(request.toObserve), captures: records.map(c => c.captureId) };
    }), captures, knownNonIndependent: options.known ?? [],
    syntheticFixtures: ['tests/control-availability/fixtures.json', 'tests/rendering-requirements/ledger.json#synthetic.ring-c3-s1'],
    limitation: 'Known-byte contamination screening is not authentication. Truthful original provenance, environment and source selection require independent human review; no image was generated or original code executed by this validator.' };
}
export function markdownReport(report) {
  const lines = ['# Independent reference evidence intake', '', report.interpretation, '', '| Capture request | Evidence status |', '|---|---|', ...report.requests.map(r => `| ${r.id} | ${r.status} |`), '',
    'All requests remain provisional inputs. Their dimensions are not historical defaults. No renderer comparison or tolerance is defined by intake approval.', '',
    ...report.captures.flatMap(c => [`- ${c.captureId}: ${c.status}`, ...c.missing.map(m => `  - Missing: ${m}`), ...c.rejected.map(r => `  - Rejected: ${r}`)]), '',
    `Separate non-independent inventory: ${report.knownNonIndependent.filter(i => i.kind === 'qualitative-author-preview').length} qualitative previews, ${report.knownNonIndependent.filter(i => i.kind === 'scriptoscope-regression').length} self-regression PNGs, and ${report.syntheticFixtures.length} synthetic fixture registries. None supplies an original capture.`, '', report.limitation, ''];
  return lines.join('\n');
}
