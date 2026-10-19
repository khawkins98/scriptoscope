// Explicit modern cinf-only environment. Never a historical Resource Manager
// inventory, implicit base chain, asset provider, or persistent raw sampler.
import { parseResourceFork } from './resource-fork.js';
import { decodeCinf } from './decoders/cinf.js';
import { controlColorSamples } from './kdef-color-samples.js';
import { displayPolicy } from './display-profile.js';
const prepared = new WeakSet(), bindings = new WeakSet(), summaries = new WeakSet(), views = new WeakSet();
const preparedView = value => { const result = freeze(value); views.add(result); return result; };
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
    if (r.data.length < 18) return { ...common, status: 'invalid', reason: 'short-cinf' };
    try { return { ...common, status: 'decoded', data: decodeCinf(r.data) }; }
    catch { return { ...common, status: 'invalid', reason: 'cinf-decode-error' }; }
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
  summaries.add(summary); return summary;
}
/** Internal use guard: serialized metadata cannot stand in for prepared inputs. */
export function isBoundBodyCinfView(summary, view) {
  return summaries.has(summary) && views.has(view) && summary.bindingId === view.bindingId;
}
function lookup(binding, id) {
  if (!binding.complete) return { outcome: 'unknown', reason: 'incomplete-environment' };
  for (const p of binding.providers) {
    if (!p.complete) return { outcome: 'unknown', reason: 'incomplete-provider', providerId: p.id };
    const matches = p.resources.filter(r => r.signedId === id);
    if (matches.length > 1) return { outcome: 'ambiguous', reason: 'duplicate-cinf', providerId: p.id };
    if (!matches.length) continue;
    const r = matches[0], resource = { providerId: p.id, providerKind: p.kind, forkSha256: p.forkSha256,
      occurrence: r.occurrence, signedId: r.signedId, byteLength: r.byteLength, sha256: r.sha256 };
    return r.status === 'decoded' ? { outcome: 'found', resource, data: r.data }
      : { outcome: 'invalid', reason: r.reason, resource };
  }
  return { outcome: 'missing' };
}
/** Called while the selected face's transient raw sampler is still alive.
 * Common ChromeElement fields/pairing remain untouched. */
export function bodyCinfView(binding, cicn, patternKeysById, profile, ambiguousPath) {
  if (!binding) return undefined;
  const common = { ...cinfBindingSummary(binding), requestedId: cicn.id, body: true, displayPolicy: displayPolicy(profile) };
  const attempts = []; let selected;
  for (const id of [cicn.id, 0]) {
    const result = lookup(binding, id), { data, ...observed } = result;
    attempts.push({ id, ...observed });
    if (result.outcome === 'found') { selected = { resource: result.resource, data }; break; }
    if (result.outcome !== 'missing') return preparedView({ ...common, attempts, status: 'unsupported', reason: result.reason });
  }
  if (!selected) return preparedView({ ...common, attempts, status: 'no-body-or-border', reason: 'two-explicit-null-results' });
  const cd = selected.data;
  if (ambiguousPath) return preparedView({ ...common, attempts, selected: selected.resource, status: 'unsupported', reason: 'ambiguous-face-asset' });
  return preparedView({ ...common, attempts, selected: selected.resource, status: 'ready', metadata: {
    slice: { corner: cd.cornerSize, side: cd.sideThickness, tile: cd.tileSides !== 0, resizeBehavior: cd.resizeBehavior },
    bodyRequest: { mode: cd.patternAnchor, resourceId: cd.bgPatternId },
    bodyPattern: cd.patternAnchor !== 5 ? patternKeysById[cd.bgPatternId] ?? null : null,
    bgPattern: cd.bgPatternId !== 0 ? patternKeysById[cd.bgPatternId] ?? null : null,
    bgAnchor: [cd.bgPixel.x, cd.bgPixel.y], textAnchor: [cd.textPixel.x, cd.textPixel.y], embossAnchor: [cd.embossPixel.x, cd.embossPixel.y],
    colorSamples: controlColorSamples(cicn.sampleKdefRgb16, cd, profile),
  } });
}
