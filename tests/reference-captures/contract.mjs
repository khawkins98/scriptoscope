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

// A finite observation scope, not an alternative set of verified requirements.
const faceScope = {
  id: 'public-api-empty-face', version: 1, comparisonLayer: 'composited-face-pixels',
  facePortRect: [20, 20, 80, 20], faceImageRect: [20, 20, 80, 20],
  publicInvocation: { api: 'NewControl', drawApi: 'Draw1Control', procedureId: 0, variant: 0, hilite: 0, value: 0, defaultApiInvoked: false },
  associatedRequirementIds: ['geometry.remaining', 'fill.remaining'],
  claim: 'Recorded composited pixels of the complete fixed empty normal face under the observed public invocation, environment and background.',
  excludedClaims: ['alpha-or-mask', 'font-independence', 'automatic-sizing', 'other-states', 'outside-face-or-margins',
    'default-ring', 'private-resource-or-painter-selection', 'provider-cache-or-search-order', 'whole-requirements', 'whole-request'],
};
const fullScope = { id: 'full', version: 1 };
const requestDigestModel = 'request-semantic-v1';
const scopedUnknownFields = ['font', 'patchStack', 'baseChain', 'resourceSearchOrder', 'selectedProvider', 'resourceCache', 'privateDefaultState'];
const scopedChecks = ['originalEnvironment', 'installationAndConfiguredSource', 'publicInvocation', 'recordedPixelConditions',
  'conditionsAndTransform', 'imageAndArtifacts', 'independentOfScriptoscope', 'scopeAndLimits'];
// Finite campaign membership; adding future sources requires a scoped policy review.
const campaignSources = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503',
  'black-platinum', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'platinum-8',
  'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];
export function publicFaceScope(request) {
  const c = request?.conditions;
  const state = c?.state;
  const crayon = request?.sourceSlug === 'crayon-os' && request.id === 'crayon-os.normal' && state === 'normal';
  const lisa = request?.sourceSlug === 'apple-lisa' && request.id === 'apple-lisa.normal' && state === 'normal';
  const campaign = campaignSources.includes(request?.sourceSlug) && ['normal', 'pressed', 'inactive'].includes(state)
    && request.id === `${request.sourceSlug}.${state}`;
  const legacy = lisa || crayon || (['windows-95', 'system7-nostalgia-silver'].includes(request?.sourceSlug)
    && ['normal', 'pressed', 'inactive'].includes(state) && request.id === `${request.sourceSlug}.${state}`);
  const enabled = state !== 'inactive';
  if (!((legacy || campaign) && c.surface === 'push-button' && c.text === '' && c.defaultRing === false
    && c.enabled === enabled && c.windowActive === true
    && isDeepStrictEqual(c.controlRect, [20, 20, 80, 20]) && isDeepStrictEqual(c.portOrigin, [0, 0])
    && isDeepStrictEqual(c.portBounds, [0, 0, 160, 80]) && isDeepStrictEqual(c.imageSize, [160, 80])
    && isDeepStrictEqual(c.scale, [1, 1]) && isDeepStrictEqual(c.backgroundRGB, [255, 255, 255])
    && isDeepStrictEqual(c.cropPortRect, [12, 12, 96, 36]) && isDeepStrictEqual(c.cropImageRect, [12, 12, 96, 36]))) return null;
  if (!legacy) {
    const hilite = state === 'normal' ? 0 : state === 'pressed' ? 10 : 255;
    return { ...structuredClone(faceScope), version: 5,
      publicInvocation: { ...faceScope.publicInvocation, stateApi: 'HiliteControl', hilite, enabled, windowActive: true },
      claim: 'Recorded composited pixels of the complete fixed empty face in the requested public state under the observed invocation, environment and white background; original pattern phase remains unknown.',
      excludedClaims: [...faceScope.excludedClaims, 'physical-mouse-gesture', 'inactive-window',
        'original-pattern-phase', 'general-body-paint', 'pattern-mask', 'private-pattern-provider'],
    };
  }
  if (crayon) return { ...structuredClone(faceScope), version: 3,
    claim: 'Recorded composited pixels of the complete fixed empty Crayon normal face under the observed public invocation, environment and background; original pattern phase remains unknown.',
    excludedClaims: [...faceScope.excludedClaims, 'original-pattern-phase', 'general-body-paint', 'pattern-mask', 'private-pattern-provider'],
  };
  if (lisa) return { ...structuredClone(faceScope), version: 4,
    claim: 'Recorded composited pixels of the complete fixed empty Lisa normal face under the observed public invocation, environment and background.',
    excludedClaims: [...faceScope.excludedClaims, 'original-pattern-phase', 'general-body-paint', 'private-pattern-provider'],
  };
  // Keep the already-reviewed normal v1 scope definition exact.
  if (state === 'normal') return structuredClone(faceScope);
  const hilite = state === 'pressed' ? 10 : 255;
  return { ...structuredClone(faceScope), version: 2,
    publicInvocation: { ...faceScope.publicInvocation, stateApi: 'HiliteControl', hilite, enabled, windowActive: true },
    claim: `Recorded composited pixels of the complete fixed empty ${state === 'pressed' ? 'logically highlighted' : 'disabled'} face after HiliteControl(${hilite}) in an active window under the observed public invocation, environment and background.`,
    excludedClaims: [...faceScope.excludedClaims, 'physical-mouse-gesture', 'inactive-window'],
  };
}

/** Reuse source/requirement authorities; this contract never approves their draft selections. */
export function readContract(root = repositoryRoot) {
  const catalog = readJSON(resolve(root, 'tests/reference-captures/requests.json'));
  const contractPath = 'docs/spec/fidelity-compatibility-contract.md';
  const document = readFileSync(resolve(root, contractPath));
  const headers = [...document.toString().matchAll(/^Contract ID: `([^`]+)`\. Draft version: \*\*(\d+\.\d+\.\d+)\*\*,/gm)];
  check(headers.length === 1, 'compatibility contract must have one explicit identity/version header');
  const compatibility = { id: headers[0][1], version: headers[0][2], path: contractPath, sha256: sha256(document) };
  check(catalog.contractId === compatibility.id, 'capture request contractId does not match authoritative compatibility contract');
  check(catalog.contractVersion === compatibility.version, 'capture request contractVersion is stale or mismatched');
  check(catalog.sourceRegistry === 'tests/control-availability/source-choices.json', 'capture requests must reuse the authoritative source registry');
  check(catalog.requirementLedger === 'tests/rendering-requirements/ledger.json', 'capture requests must reuse the authoritative requirement ledger');
  const choices = readJSON(resolve(root, catalog.sourceRegistry));
  const ledger = readJSON(resolve(root, catalog.requirementLedger));
  check(catalog.schemaVersion === 1 && text(catalog.requestVersion), 'unsupported request schema/version');
  const policyPath = 'tests/reference-captures/eligibility-policy.json';
  const policyBytes = readFileSync(resolve(root, policyPath));
  const policy = JSON.parse(policyBytes);
  check(policy.schemaVersion === 1 && policy.id === 'scriptoscope.reference-eligibility', 'unsupported eligibility policy');
  const policySections = keys => Object.fromEntries(keys.map(key => {
    const section = policy.sections?.[key];
    check(Number.isInteger(section?.version) && section.version > 0 && Array.isArray(section.rules)
      && section.rules.length > 0 && section.rules.every(text), `missing normative eligibility section: ${key}`);
    return [key, section];
  }));
  const engine = ledger.inputs.find(input => input.id === catalog.engineComponentId);
  check(engine?.kind === 'engine' && hash(engine.sha256), 'missing pinned engine component');
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
    if (c.portOrigin.some(n => n !== 0)) check(c.requiredInvocationClass === 'reviewed-direct-drawing', `${request.id}: nonzero origin needs a direct-invocation precondition`);
    if (request.experiment?.baselineRequestId) {
      const baseline = catalog.requests.find(r => r.id === request.experiment.baselineRequestId);
      check(baseline?.sourceSlug === request.sourceSlug, `${request.id}: missing matching experiment baseline`);
      const b = baseline.conditions;
      const delta = c.portOrigin.map((n, i) => n - b.portOrigin[i]);
      const translate = rect => rect.map((n, i) => n + (i < 2 ? delta[i] : 0));
      const fixed = request.experiment.kind === 'fixed-physical-placement-phase';
      check(fixed || request.experiment.kind === 'coordinate-placement', `${request.id}: unknown origin experiment`);
      check(isDeepStrictEqual(c.controlRect, fixed ? translate(b.controlRect) : b.controlRect)
        && isDeepStrictEqual(c.cropPortRect, fixed ? translate(b.cropPortRect) : b.cropPortRect), `${request.id}: inconsistent experiment placement`);
    }
    const scope = publicFaceScope(request);
    const keys = ['common', 'full', ...(scope ? ['publicFace', `publicFaceV${scope.version}`] : []),
      ...(Object.hasOwn(request.toObserve, 'patternOriginState') ? ['patternOrigin'] : []),
      ...(c.requiredInvocationClass ? ['directOrigin'] : [])];
    // Include transitive baseline inputs, not an unrelated catalog-wide version.
    const baselines = [], visited = new Set([request.id]);
    let baselineId = request.experiment?.baselineRequestId;
    while (baselineId) {
      check(!visited.has(baselineId), `${request.id}: cyclic experiment baseline`); visited.add(baselineId);
      const baseline = catalog.requests.find(r => r.id === baselineId);
      check(baseline, `${request.id}: missing experiment baseline`);
      check(baseline.targetRequirementIds.every(id => request.targetRequirementIds.includes(id)),
        `${request.id}: baseline targets must be covered by this request's pinned definitions`);
      baselines.push(baseline);
      baselineId = baseline.experiment?.baselineRequestId;
    }
    const pinned = { model: requestDigestModel, contractId: compatibility.id,
      eligibility: { id: policy.id, sections: policySections(keys) }, reviewScopes: [fullScope, ...(scope ? [scope] : [])],
      targetRequirements: request.targetRequirementIds.map(id => ledger.requirements.find(r => r.id === id)),
      request, baselines, source, engineComponent: engine };
    return { ...request, source, engineComponent: engine, requestDigest: digest(pinned) };
  });
  const provenance = { compatibility, catalogRequestVersion: catalog.requestVersion, ledgerVersion: ledger.inventoryVersion,
    sourceRegistrySchema: choices.schemaVersion, sourceRegistryReview: choices.reviewStatus,
    eligibilityPolicy: { id: policy.id, path: policyPath, sha256: sha256(policyBytes) } };
  return { catalog, compatibility, requests, requestDigestModel, provenance };
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

export function captureTemplate(request, { scope } = {}) {
  const reviewScope = scope === undefined ? undefined : scope === 'full' ? fullScope : scope === faceScope.id ? publicFaceScope(request) : null;
  check(reviewScope !== null, 'unsupported review scope for request');
  return { ...(reviewScope ? { reviewScope: structuredClone(reviewScope) } : {}), id: `${request.id}.capture-1`, kind: 'independent-original', requestId: request.id, requestDigest: request.requestDigest,
    source: structuredClone(request.source), engineComponent: structuredClone(request.engineComponent), conditions: structuredClone(request.conditions),
    observed: { ...structuredClone(request.toObserve), ...(scope === faceScope.id ? {
      selectedProvider: null, resourceCache: null, privateDefaultState: null, unknownConditions: Object.fromEntries(scopedUnknownFields.map(field => [field, null])),
      publicApiFace: { configuredScheme: null, invocation: null, port: null, producer: null, fullFrame: null },
    } : {}) }, image: { path: null, sha256: null, width: null, height: null },
    provenance: { producer: null, capturedAt: null, originalEnvironment: null, method: null, artifacts: [] } };
}

export const reviewDigest = capture => digest(capture);
const reviewChecks = ['originalEnvironment', 'sourceAndBaseIdentity', 'engineAndPatchStack', 'conditionsAndTransform', 'imageAndArtifacts', 'independentOfScriptoscope'];
const requiredReviewChecks = request => [...reviewChecks,
  ...(Object.hasOwn(request.toObserve, 'patternOriginState') ? ['patternOriginState'] : []),
  ...(request.conditions.requiredInvocationClass ? ['directOriginInvocation'] : [])];
export function reviewTemplate(capture, request) {
  const scoped = capture.reviewScope?.id === faceScope.id;
  return { ...(capture.reviewScope ? { reviewScope: structuredClone(capture.reviewScope) } : {}), captureId: capture.id, verdict: null, reviewer: null, reviewedAt: null, captureDigest: reviewDigest(capture),
    requestDigest: request.requestDigest, targetRequirementIds: [...(scoped ? faceScope.associatedRequirementIds : request.targetRequirementIds)],
    checks: Object.fromEntries((scoped ? scopedChecks : requiredReviewChecks(request)).map(key => [key, null])), notes: null };
}

/** Validate eligibility of supplied evidence, never renderer fidelity or historical authenticity. */
export function assessCapture(capture, request, reviews, { intakeRoot, known = [] }) {
  const missing = [], rejected = [], unresolvedConditions = [];
  const scoped = capture?.reviewScope?.id === faceScope.id;
  const allowedScope = scoped ? publicFaceScope(request) : null;
  const need = (ok, field) => { if (!ok) missing.push(field); };
  const equal = (actual, expected, field) => {
    if (actual == null) missing.push(field);
    else if (!isDeepStrictEqual(actual, expected)) rejected.push(`${field}: does not match request/pin`);
  };
  const identity = (value, field) => {
    need(text(value?.name), `${field}.name`); need(text(value?.version), `${field}.version`); need(hash(value?.sha256), `${field}.sha256`);
  };
  const kind = capture?.kind;
  const result = status => ({ captureId: capture?.id ?? null, requestId: capture?.requestId ?? null, kind, status, missing, rejected,
    ...(scoped ? { reviewScope: capture.reviewScope, associatedRequirementIds: [...faceScope.associatedRequirementIds],
      verifiedRequirementIds: [], unresolvedRequirementIds: [...(request?.targetRequirementIds ?? [])],
      excludedClaims: [...(allowedScope ?? faceScope).excludedClaims], unresolvedConditions } : {}) });
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
  if (capture.reviewScope !== undefined) {
    if (scoped) {
      const allowed = allowedScope;
      if (!allowed) rejected.push('reviewScope: request does not support public-api-empty-face');
      else equal(capture.reviewScope, allowed, 'reviewScope');
    } else equal(capture.reviewScope, fullScope, 'reviewScope');
  }
  equal(capture.requestDigest, request.requestDigest, 'requestDigest');
  equal(capture.source, request.source, 'source');
  equal(capture.engineComponent, request.engineComponent, 'engineComponent');
  equal(capture.conditions, request.conditions, 'conditions');
  const o = capture.observed ?? {};
  identity(o.os, 'observed.os'); identity(o.engineInstallation, 'observed.engineInstallation');
  if (text(o.engineInstallation?.name) && o.engineInstallation.name !== 'Kaleidoscope') rejected.push('engineInstallation.name: expected Kaleidoscope');
  if (text(o.engineInstallation?.version) && o.engineInstallation.version !== '2.3.1') rejected.push('engineInstallation.version: expected Kaleidoscope2.3.1');
  const knownCondition = field => {
    if (!scoped || o[field] != null) return true;
    need(Object.hasOwn(o, field) && o[field] === null, `observed.${field} (explicit unknown)`);
    need(text(o.unknownConditions?.[field]), `observed.unknownConditions.${field}`);
    unresolvedConditions.push({ field, reason: o.unknownConditions?.[field] ?? null });
    return false;
  };
  for (const field of ['patchStack', 'baseChain', 'resourceSearchOrder']) if (knownCondition(field)) {
    need(Array.isArray(o[field]), `observed.${field}`);
    if (Array.isArray(o[field])) o[field].forEach((value, i) => identity(value, `observed.${field}[${i}]`));
    if (field === 'resourceSearchOrder') need(Array.isArray(o[field]) && o[field].length > 0, 'observed.resourceSearchOrder (ordered original resource providers)');
    else need(text(o[`${field}Reason`]), `observed.${field}Reason (including an explicitly empty chain/stack)`);
  }
  if (knownCondition('font')) {
    identity(o.font, 'observed.font');
    need(Number.isFinite(o.font?.pointSize) && o.font.pointSize > 0, 'observed.font.pointSize');
    need(text(o.font?.style), 'observed.font.style');
  }
  if (scoped) for (const field of ['selectedProvider', 'resourceCache']) if (knownCondition(field)) identity(o[field], `observed.${field}`);
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
  if (scoped && [3, 5].includes(allowedScope?.version)) {
    need(Object.hasOwn(o, 'patternOriginState'), 'observed.patternOriginState (scoped explicit unknown)');
    if (o.patternOriginState !== null) rejected.push('observed.patternOriginState: scope requires explicit unknown');
    need(text(o.unknownConditions?.patternOriginState), 'observed.unknownConditions.patternOriginState');
    unresolvedConditions.push({ field: 'patternOriginState', reason: o.unknownConditions?.patternOriginState ?? null });
  } else if (Object.hasOwn(request.toObserve, 'patternOriginState')) {
    const state = o.patternOriginState;
    need(['available', 'unavailable'].includes(state?.apiAvailability), 'observed.patternOriginState.apiAvailability');
    need(text(state?.evidence), 'observed.patternOriginState.evidence');
    if (state?.apiAvailability === 'available') need(Array.isArray(state.offset) && state.offset.length === 2 && state.offset.every(Number.isInteger), 'observed.patternOriginState.offset');
    if (state?.apiAvailability === 'unavailable' && state.offset != null) rejected.push('patternOriginState.offset: unavailable API must not invent an observed offset');
  }
  if (request.conditions.requiredInvocationClass) {
    equal(o.controlDefinition?.invocationClass, request.conditions.requiredInvocationClass, 'observed.controlDefinition.invocationClass');
    for (const field of ['invocation', 'nonzeroOriginJustification', 'sourceReference']) need(text(o.directOriginEvidence?.[field]), `observed.directOriginEvidence.${field}`);
  }
  const f = o.publicApiFace;
  if (scoped) {
    equal(f?.configuredScheme?.archiveSha256, request.source.archiveSha256, 'configuredScheme.archiveSha256');
    equal(f?.configuredScheme?.forkSha256, request.source.forkSha256, 'configuredScheme.forkSha256');
    need(text(f?.configuredScheme?.evidence), 'configuredScheme.evidence (configured file, not selected provider)');
    const invocation = (allowedScope ?? faceScope).publicInvocation;
    for (const field of ['api', 'drawApi', 'defaultApiInvoked', ...([2, 5].includes(allowedScope?.version) ? ['stateApi'] : [])])
      equal(f?.invocation?.[field], invocation[field], `publicInvocation.${field}`);
    for (const field of ['procedureId', 'variant', 'hilite', 'value'])
      equal(o.controlDefinition?.[field], invocation[field], `scoped controlDefinition.${field}`);
    if (knownCondition('privateDefaultState')) rejected.push('privateDefaultState: this scope requires an explicitly unknown private flag');
    equal(f?.invocation?.controlRect, request.conditions.controlRect, 'publicInvocation.controlRect');
    equal(f?.invocation?.title, '', 'publicInvocation.title');
    equal(f?.invocation?.state, request.conditions.state, 'publicInvocation.state');
    equal(f?.invocation?.defaultRing, false, 'publicInvocation.defaultRing');
    equal(f?.port?.origin, request.conditions.portOrigin, 'publicPort.origin');
    equal(f?.port?.bounds, request.conditions.portBounds, 'publicPort.bounds');
    equal(f?.port?.effectiveClipRect, request.conditions.portBounds, 'publicPort.effectiveClipRect');
    equal(f?.port?.backgroundRGB, request.conditions.backgroundRGB, 'publicPort.backgroundRGB');
    equal(f?.port?.backgroundOpaque, true, 'publicPort.backgroundOpaque (composited background, not mask truth)');
    need([1, 2, 4, 8].includes(o.palette?.depth), 'scoped palette must be indexed');
    need(text(f?.producer?.name), 'producer.name');
    const builds = f?.producer?.buildArtifacts;
    need(Array.isArray(builds) && builds.length > 0, 'producer.buildArtifacts (external identities, not executable intake)');
    if (Array.isArray(builds)) {
      need(builds.every(b => text(b?.name) && hash(b?.sha256)), 'producer.buildArtifacts identities');
      if (new Set(builds.map(b => b?.name)).size !== builds.length) rejected.push('producer.buildArtifacts: duplicate names');
    }
    need(hash(f?.producer?.tableSha256), 'producer.tableSha256');
    equal(f?.producer?.pixelEncoding, 'rgba8', 'producer.pixelEncoding');
    need(text(f?.producer?.colorRealization) && text(f?.producer?.timing), 'producer.colorRealization/timing');
    const version = f?.producer?.version;
    if (version?.status === 'unknown') {
      need(text(version.reason), 'producer.version.reason');
      unresolvedConditions.push({ field: 'producer.version', reason: version.reason ?? null });
    } else need(version?.status === 'observed' && text(version.value), 'producer.version (observed or explicit unknown)');
    need(hash(f?.fullFrame?.sha256), 'fullFrame.sha256');
    const r = f?.fullFrame?.requestImageRect;
    need(Array.isArray(r) && r.length === 4 && r.every(Number.isInteger) && r[0] >= 0 && r[1] >= 0, 'fullFrame.requestImageRect');
    if (Array.isArray(r)) equal(r.slice(2), request.conditions.imageSize, 'fullFrame.requestImageRect size');
    equal(f?.fullFrame?.transform, 'requestImageXY = fullFrameXY - requestImageRect.xy; no resampling or color conversion', 'fullFrame.transform');
  }
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
      if (scoped) {
        const expected = { 'configured-scheme': f?.configuredScheme,
          'public-invocation': { controlDefinition: o.controlDefinition, invocation: f?.invocation, port: f?.port, fullFrame: f?.fullFrame },
          'pixel-conditions': { palette: o.palette, producer: f?.producer }, 'producer-identities': f?.producer?.buildArtifacts };
        if (Object.hasOwn(expected, artifact.role)) equal(JSON.parse(artifactBytes), JSON.parse(JSON.stringify(expected[artifact.role] ?? null)), artifact.role);
        const boundHashes = { 'indexed-palette': o.palette?.sha256, 'producer-table': f?.producer?.tableSha256, 'full-frame': f?.fullFrame?.sha256 };
        if (Object.hasOwn(boundHashes, artifact.role) && hash(boundHashes[artifact.role])) equal(artifact.sha256, boundHashes[artifact.role], `${artifact.role}.observedSha256`);
        if (artifact.role === 'full-frame') {
          const { width, height } = inspectPNG(artifactBytes), r = f?.fullFrame?.requestImageRect;
          equal([f?.fullFrame?.width, f?.fullFrame?.height], [width, height], 'fullFrame dimensions');
          if (Array.isArray(r) && (r[0] + r[2] > width || r[1] + r[3] > height)) rejected.push('fullFrame.requestImageRect: outside original frame');
          if (known.some(record => record.sha256 === sha256(artifactBytes))) rejected.push('known non-independent full-frame bytes');
        }
      }
      if (artifact.role === 'direct-origin-invocation') equal(JSON.parse(artifactBytes), {
        controlDefinition: o.controlDefinition, directOriginEvidence: o.directOriginEvidence, patternOriginState: o.patternOriginState,
      }, 'direct-origin-invocation');
    }
    catch (error) { rejected.push(`artifact ${artifact.role}: ${error.message}`); }
  }
  for (const role of ['capture-log', 'environment-manifest']) need(roles.has(role), `provenance.artifacts.${role}`);
  if (request.conditions.requiredInvocationClass) need(roles.has('direct-origin-invocation'), 'provenance.artifacts.direct-origin-invocation');
  if (scoped) for (const role of ['configured-scheme', 'public-invocation', 'pixel-conditions', 'indexed-palette', 'producer-identities', 'producer-table', 'full-frame']) {
    need(roles.has(role), `provenance.artifacts.${role}`);
    if (Array.isArray(p.artifacts) && p.artifacts.filter(a => a.role === role).length > 1) rejected.push(`duplicate scoped artifact role: ${role}`);
  }
  const matches = reviews.filter(review => review.captureId === capture.id);
  if (matches.length > 1) rejected.push('multiple review decisions: resolve explicitly before intake');
  const review = matches[0];
  if (review) {
    if (review.verdict === 'rejected') rejected.push(`review rejected: ${review.notes ?? 'no reason supplied'}`);
    else if (review.verdict !== 'accepted') missing.push('review.verdict');
    equal(review.captureDigest, reviewDigest(capture), 'review.captureDigest');
    equal(review.requestDigest, request.requestDigest, 'review.requestDigest');
    equal(review.targetRequirementIds, scoped ? faceScope.associatedRequirementIds : request.targetRequirementIds, 'review.targetRequirementIds');
    if (capture.reviewScope !== undefined || review.reviewScope !== undefined) equal(review.reviewScope, capture.reviewScope, 'review.reviewScope');
    need(text(review.reviewer), 'review.reviewer');
    if (text(review.reviewer) && review.reviewer === p.producer) rejected.push('reviewer must be independent of capture producer');
    need(text(review.reviewedAt) && Number.isFinite(Date.parse(review.reviewedAt)), 'review.reviewedAt'); need(text(review.notes), 'review.notes');
    for (const field of (scoped ? scopedChecks : requiredReviewChecks(request))) need(review.checks?.[field] === true, `review.checks.${field}`);
  }
  if (rejected.length) return result('rejected');
  if (missing.length) return result('partial');
  return result(review ? scoped ? 'reviewed-scoped-observation' : 'reviewed-independent-capture' : 'awaiting-independent-review');
}

export function assessCorpus(contract, corpus, reviewFile, options) {
  check(corpus.schemaVersion === 1 && Array.isArray(corpus.captures), 'unsupported capture manifest');
  check(reviewFile.schemaVersion === 1 && Array.isArray(reviewFile.reviews), 'unsupported review manifest');
  const ids = corpus.captures.map(c => c.id);
  check(ids.every(text) && new Set(ids).size === ids.length, 'missing/duplicate capture id');
  check(reviewFile.reviews.every(review => ids.includes(review.captureId)), 'orphan review does not name an intake capture');
  const captures = corpus.captures.map(capture => assessCapture(capture, contract.requests.find(r => r.id === capture.requestId), reviewFile.reviews, options));
  return { schemaVersion: 1, requestDigestModel: contract.requestDigestModel, provenance: contract.provenance, compatibilityContract: contract.compatibility, contractId: contract.compatibility.id, requestVersion: contract.catalog.requestVersion,
    interpretation: 'Evidence eligibility only. Missing captures are not passes; reviewed intake does not verify renderer output, original decoder, whole cases or complete fidelity.',
    requests: contract.requests.map(request => {
      const records = captures.filter(c => c.requestId === request.id && c.kind === 'independent-original');
      return { id: request.id, requestDigest: request.requestDigest, sourceSlug: request.sourceSlug,
        sourceSelectionReview: request.source.selectionReviewStatus, targetRequirementIds: request.targetRequirementIds,
        status: records.some(c => c.status === 'reviewed-independent-capture') ? 'reviewed-capture-available' : records.length ? 'evidence-incomplete' : 'missing',
        unresolvedRequirementIds: [...request.targetRequirementIds], verifiedRequirementIds: [],
        scopedEligibleObservations: records.filter(c => c.status === 'reviewed-scoped-observation').map(c => c.captureId),
        requestUnknownFields: Object.keys(request.toObserve), captures: records.map(c => c.captureId) };
    }), captures, knownNonIndependent: options.known ?? [],
    syntheticFixtures: ['tests/control-availability/fixtures.json', 'tests/rendering-requirements/ledger.json#synthetic.ring-c3-s1'],
    limitation: 'Known-byte contamination screening is not authentication. Truthful original provenance, environment and source selection require independent human review; no image was generated or original code executed by this validator.' };
}
export function markdownReport(report) {
  const lines = ['# Independent reference evidence intake', '', report.interpretation, '', '| Capture request | Evidence status | Scoped eligible observations |', '|---|---|---|', ...report.requests.map(r => `| ${r.id} | ${r.status} | ${(r.scopedEligibleObservations ?? []).length} |`), '',
    'All requests remain provisional inputs. Their dimensions are not historical defaults. No renderer comparison or tolerance is defined by intake approval.', '',
    ...report.captures.flatMap(c => [`- ${c.captureId}: ${c.status}`, ...c.missing.map(m => `  - Missing: ${m}`), ...c.rejected.map(r => `  - Rejected: ${r}`), ...(c.reviewScope ? [`  - Scope: ${c.reviewScope.id} v${c.reviewScope.version}; associated IDs are not verified.`, `  - Unresolved requirements: ${c.unresolvedRequirementIds.join(', ')}`, `  - Excluded claims: ${c.excludedClaims.join(', ')}`, ...c.unresolvedConditions.map(v => `  - Unknown: ${v.field}: ${v.reason ?? 'reason missing'}`)] : [])]), '',
    `Separate non-independent inventory: ${report.knownNonIndependent.filter(i => i.kind === 'qualitative-author-preview').length} qualitative previews, ${report.knownNonIndependent.filter(i => i.kind === 'scriptoscope-regression').length} self-regression PNGs, and ${report.syntheticFixtures.length} synthetic fixture registries. None supplies an original capture.`, '', report.limitation, ''];
  return lines.join('\n');
}
