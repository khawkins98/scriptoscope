// Explicit modern cinf-only environment. Never a historical Resource Manager
// inventory, implicit base chain, asset provider, or persistent raw sampler.
import { parseResourceFork } from './resource-fork.js';
import { decodeCinf } from './decoders/cinf.js';
import { controlColorSamples } from './kdef-color-samples.js';
import { displayPolicy } from './display-profile.js';
const sliderCorners = new WeakMap(); // Private first-byte observations do not change existing prepared IDs/data.
const prepared = new WeakSet(), bindings = new WeakSet(), summaries = new WeakMap(), views = new WeakMap(), themes = new WeakMap();
const preparedView = (value, binding, element) => { const result = freeze(value); views.set(result, { binding, element }); return result; };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const digest = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
const jsonDigest = value => digest(new TextEncoder().encode(JSON.stringify(value)));
export class CinfEnvironmentError extends Error {
  constructor(message, code = 'INVALID_CINF_ENVIRONMENT') { super(message); this.name = 'CinfEnvironmentError'; this.code = code; }
}
const fail = message => { throw new CinfEnvironmentError(message); };
async function inventory(bytes) {
  const raw = parseResourceFork(bytes);
  const resources = await Promise.all(raw.flatMap((r, occurrence) => r.type === 'cinf' ? [(async () => {
    const common = { signedId: r.id, occurrence, byteLength: r.data.length, sha256: await digest(r.data) };
    let resource;
    if (r.data.length < 18) resource = { ...common, status: 'invalid', reason: 'short-cinf' };
    else {
      try { resource = { ...common, status: 'decoded', data: decodeCinf(r.data) }; }
      catch { resource = { ...common, status: 'invalid', reason: 'cinf-decode-error' }; }
    }
    sliderCorners.set(resource, r.data.length ? r.data[0] : null);
    return resource;
  })()] : []));
  return { forkSha256: await digest(bytes), forkByteLength: bytes.length, resources };
}
/** Snapshot all caller bytes/fields before awaiting any digest. */
export async function prepareCinfEnvironment(input) {
  if (!globalThis.crypto?.subtle) fail('Cinf environment requires Web Crypto');
  if (input?.version !== 1 || typeof input.complete !== 'boolean' || !Array.isArray(input.providers)) fail('Declare version, completeness and ordered providers');
  const ids = new Set(); let themeSlots = 0;
  const complete = input.complete;
  const copies = Array.from(input.providers, p => {
    if (!p || typeof p.id !== 'string' || !p.id.trim() || ids.has(p.id) || typeof p.complete !== 'boolean') fail('Unique provider IDs and completeness required');
    ids.add(p.id);
    const base = { kind: p.kind, id: p.id, complete: p.complete };
    if (p.kind === 'theme-fork') { if (++themeSlots > 1) fail('Only one actual theme-fork marker is allowed'); return base; }
    if (p.kind !== 'raw-fork' || !(p.bytes instanceof Uint8Array || p.bytes instanceof ArrayBuffer)) fail('External providers require raw fork bytes');
    const bytes = new Uint8Array(p.bytes instanceof Uint8Array ? p.bytes : new Uint8Array(p.bytes));
    if (!bytes.length) fail('Empty external fork');
    return { ...base, bytes };
  });
  const providers = await Promise.all(copies.map(async p => p.kind === 'theme-fork' ? p : {
    kind: p.kind, id: p.id, complete: p.complete, ...await inventory(p.bytes),
  }));
  const data = { version: 1, complete, providers };
  const handle = freeze({ id: `cinf-environment:${await jsonDigest(data)}`, data });
  prepared.add(handle); return handle;
}
export function assertCinfEnvironment(value) {
  if (value !== undefined && !prepared.has(value)) fail('Use prepareCinfEnvironment; a serialized declaration is not a prepared handle');
}
/** Internal asynchronous shell seam: the selected actual fork, not its label,
 * replaces the marker. No additional container selection or URL allocation. */
export async function bindCinfEnvironment(environment, fork) {
  assertCinfEnvironment(environment);
  if (environment === undefined) return undefined;
  const actual = await inventory(fork);
  const data = { environmentId: environment.id, themeForkSha256: actual.forkSha256,
    complete: environment.data.complete, providers: environment.data.providers.map(p => p.kind === 'theme-fork' ? { ...p, ...actual } : p) };
  const binding = freeze({ id: `cinf-binding:${await jsonDigest(data)}`, ...data });
  bindings.add(binding); return binding;
}
export function cinfBindingSummary(binding) {
  if (binding === undefined) return undefined;
  if (!bindings.has(binding)) fail('Unprepared cinf binding');
  const summary = freeze({ environmentId: binding.environmentId, bindingId: binding.id, themeForkSha256: binding.themeForkSha256,
    policy: 'caller-declared-ordered-cinf-only', scope: 'standalone-push-bevel-body' });
  summaries.set(summary, binding); return summary;
}
/** Finalize identity only after the loader has assigned actual asset URLs. */
export function finalizeCinfTheme(theme) {
  if (!theme.cinfEnvironment) return;
  const binding = summaries.get(theme.cinfEnvironment);
  if (!binding) fail('Unprepared cinf theme binding');
  const faces = new Map();
  for (const element of Object.values(theme.chromeElements ?? {})) {
    const view = element.bodyCinf;
    if (!view) continue;
    const origin = views.get(view);
    if (origin?.binding !== binding || origin.element !== element) fail('Mismatched cinf face origin');
    faces.set(element, { view, asset: element.asset, width: element.width, height: element.height,
      sourceCicnId: element.sourceCicnId, sourceCinfId: element.sourceCinfId, byteProvenance: element.byteProvenance });
  }
  themes.set(theme, { environment: theme.cinfEnvironment, faces });
}
/** Snapshot at the actual face decode boundary, before any await. */
export function snapshotBodyCinfFace(theme, element) {
  if (!theme.cinfEnvironment && !themes.has(theme)) return undefined;
  const loaded = themes.get(theme), saved = loaded?.faces.get(element);
  const invalid = !loaded || loaded.environment !== theme.cinfEnvironment || (saved
    ? saved.view !== element.bodyCinf || ['asset', 'width', 'height', 'sourceCicnId', 'sourceCinfId', 'byteProvenance'].some(key => saved[key] !== element[key])
    : element.bodyCinf !== undefined);
  if (invalid) throw new CinfEnvironmentError('Cinf view does not belong to the actual loaded face', 'UNSUPPORTED_CINF_ENVIRONMENT');
  return { environment: loaded.environment, ...(saved ? { view: saved.view } : {}) };
}
function lookup(binding, id, sliderLayout = false) {
  if (!binding.complete) return { outcome: 'unknown', reason: 'incomplete-environment' };
  for (const p of binding.providers) {
    if (!p.complete) return { outcome: 'unknown', reason: 'incomplete-provider', providerId: p.id };
    const matches = p.resources.filter(r => r.signedId === id);
    if (matches.length > 1) return { outcome: 'ambiguous', reason: 'duplicate-cinf', providerId: p.id };
    if (!matches.length) continue;
    const r = matches[0], resource = { providerId: p.id, providerKind: p.kind, forkSha256: p.forkSha256,
      occurrence: r.occurrence, signedId: r.signedId, byteLength: r.byteLength, sha256: r.sha256 };
    if (sliderLayout) {
      const cornerSize = sliderCorners.get(r);
      return Number.isInteger(cornerSize) ? { outcome: 'found', resource, data: { cornerSize } }
        : { outcome: 'invalid', reason: 'empty-layout-cinf', resource };
    }
    return r.status === 'decoded' ? { outcome: 'found', resource, data: r.data }
      : { outcome: 'invalid', reason: r.reason, resource };
  }
  return { outcome: 'missing' };
}
/** Called while the selected face's transient raw sampler is still alive.
 * Common ChromeElement fields/pairing remain untouched. */
export function bodyCinfView(binding, cicn, patternKeysById, profile, ambiguousPath, element) {
  if (!binding) return undefined;
  const common = { ...cinfBindingSummary(binding), requestedId: cicn.id, body: true, displayPolicy: displayPolicy(profile) };
  const finish = value => preparedView(value, binding, element);
  const attempts = []; let selected;
  for (const id of [cicn.id, 0]) {
    const result = lookup(binding, id), { data, ...observed } = result;
    attempts.push({ id, ...observed });
    if (result.outcome === 'found') { selected = { resource: result.resource, data }; break; }
    if (result.outcome !== 'missing') return finish({ ...common, attempts, status: 'unsupported', reason: result.reason });
  }
  if (!selected) return finish({ ...common, attempts, status: 'no-body-or-border', reason: 'two-explicit-null-results' });
  const cd = selected.data;
  if (ambiguousPath) return finish({ ...common, attempts, selected: selected.resource, status: 'unsupported', reason: 'ambiguous-face-asset' });
  return finish({ ...common, attempts, selected: selected.resource, status: 'ready', metadata: {
    slice: { corner: cd.cornerSize, side: cd.sideThickness, tile: cd.tileSides !== 0, resizeBehavior: cd.resizeBehavior },
    bodyRequest: { mode: cd.patternAnchor, resourceId: cd.bgPatternId },
    bodyPattern: cd.patternAnchor !== 5 ? patternKeysById[cd.bgPatternId] ?? null : null,
    bgPattern: cd.bgPatternId !== 0 ? patternKeysById[cd.bgPatternId] ?? null : null,
    bgAnchor: [cd.bgPixel.x, cd.bgPixel.y], textAnchor: [cd.textPixel.x, cd.textPixel.y], embossAnchor: [cd.embossPixel.x, cd.embossPixel.y],
    colorSamples: controlColorSamples(cicn.sampleKdefRgb16, cd, profile),
  } });
}

// Separate opt-in role: CDEF3 group-base layout metadata belongs to the actual
// group2 thumb, not the selected groove or the push/bevel body view.
const sliderSummaries = new WeakMap(), sliderViews = new WeakMap(), sliderThemes = new WeakMap();
export function sliderLayoutBindingSummary(binding) {
  if (binding === undefined) return undefined;
  if (!bindings.has(binding)) fail('Unprepared slider layout binding');
  const summary = freeze({ environmentId: binding.environmentId, bindingId: `slider-layout:${binding.id}`,
    themeForkSha256: binding.themeForkSha256, policy: 'caller-declared-ordered-cinf-only', scope: 'standalone-group2-slider-layout' });
  sliderSummaries.set(summary, binding); return summary;
}
export function sliderLayoutCinfView(binding, cicn, ambiguousPath, element) {
  if (!binding) return undefined;
  const orientation = cicn.id === -10129 ? 'horizontal' : 'vertical';
  const common = { ...sliderLayoutBindingSummary(binding), orientation, thumbId: cicn.id };
  const finish = value => { const result = freeze(value); sliderViews.set(result, { binding, element }); return result; };
  const attempts = [];
  for (const id of orientation === 'horizontal' ? [-10132, -10144] : [-10116, -10128]) {
    const { data, ...observed } = lookup(binding, id, true);
    attempts.push({ id, ...observed });
    if (observed.outcome === 'found') return finish({ ...common, attempts, selected: observed.resource,
      ...(ambiguousPath ? { status: 'unsupported', reason: 'ambiguous-thumb-asset' }
        : { status: 'ready', corner: data.cornerSize }) });
    if (observed.outcome !== 'missing') return finish({ ...common, attempts, status: 'unsupported', reason: observed.reason });
  }
  // The source leaves the auxiliary field unchanged on two NULL results; there
  // is no established initialized zero that a new declaration may safely invent.
  return finish({ ...common, attempts, status: 'unsupported', reason: 'layout-cinf-uninitialized' });
}
export function finalizeSliderLayoutTheme(theme) {
  if (!theme.sliderLayoutEnvironment) return;
  const binding = sliderSummaries.get(theme.sliderLayoutEnvironment);
  if (!binding) fail('Unprepared slider layout theme binding');
  const thumbs = new Map();
  for (const element of Object.values(theme.chromeElements ?? {})) {
    const view = element.sliderLayoutCinf;
    if (!view) continue;
    const origin = sliderViews.get(view);
    if (origin?.binding !== binding || origin.element !== element) fail('Mismatched slider thumb origin');
    thumbs.set(element, { view, asset: element.asset, width: element.width, height: element.height,
      sourceCicnId: element.sourceCicnId, byteProvenance: element.byteProvenance });
  }
  sliderThemes.set(theme, { environment: theme.sliderLayoutEnvironment, displayProfile: theme.displayProfile, thumbs });
}
/** Capture before decoding. A view cannot be transferred between equal-ID
 * occurrences, cloned manifests, renamed assets or differently loaded forks. */
export function snapshotSliderLayoutCinf(theme, element, orientation) {
  if (!theme.sliderLayoutEnvironment && !sliderThemes.has(theme)) return undefined;
  const loaded = sliderThemes.get(theme), saved = loaded?.thumbs.get(element);
  const expectedId = orientation === 'horizontal' ? -10129 : orientation === 'vertical' ? -10113 : null;
  if (!loaded || loaded.environment !== theme.sliderLayoutEnvironment || loaded.displayProfile !== theme.displayProfile
    || !element || !saved || expectedId === null || element.sourceCicnId !== expectedId
    || saved.view !== element.sliderLayoutCinf || saved.view.orientation !== orientation
    || ['asset', 'width', 'height', 'sourceCicnId', 'byteProvenance'].some(key => saved[key] !== element[key]))
    throw new CinfEnvironmentError('Slider layout view does not belong to the actual loaded group2 thumb', 'UNSUPPORTED_CINF_ENVIRONMENT');
  return saved.view;
}
