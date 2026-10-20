import { macRgbToSrgb } from './mac-gamma.js';

export const LEGACY_DISPLAY_POLICY = 'mac-1.8-to-2.2-high-byte';
const prepared = new WeakMap();
const preparedDirectRgb8 = new WeakMap();
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const triple = (v, max) => Array.isArray(v) && v.length === 3 && v.every(x => Number.isInteger(x) && x >= 0 && x <= max);
const jsonSnapshot = (value, seen = new Set()) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || seen.has(value)
      || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype))
    throw new DisplayProfileError('Display profile must contain finite plain JSON data');
  if (Array.isArray(value) && Array.from({ length: value.length }, (_, i) => i).some(i => !Object.prototype.hasOwnProperty.call(value, i)))
    throw new DisplayProfileError('Display profile arrays must not contain missing entries');
  seen.add(value);
  const out = Array.isArray(value) ? value.map(v => jsonSnapshot(v, seen))
    : Object.fromEntries(Object.entries(value).map(([k,v]) => [k, jsonSnapshot(v, seen)]));
  seen.delete(value); return out;
};
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
export class DisplayProfileError extends Error {
  constructor(message, code = 'INVALID_PROFILE') { super(message); this.name = 'DisplayProfileError'; this.code = code; }
}
/** Finite joint mapping only. Snapshot before the digest await; no interpolation or fallback. */
export async function prepareDisplayProfile(input) {
  let data = jsonSnapshot(input);
  const fail = message => { throw new DisplayProfileError(message); };
  if (![1, 2].includes(data?.version) || !data.conditions || typeof data.conditions !== 'object' || Array.isArray(data.conditions)
      || !Object.keys(data.conditions).length || !Array.isArray(data.evidence) || !data.evidence.length)
    fail('Display profile requires version, conditions and evidence identity');
  for (const e of data.evidence) if (!/^[a-f0-9]{64}$/.test(e?.sha256) || typeof e.description !== 'string' || !e.description.trim()) fail('Invalid profile evidence');
  if (data.producer?.model !== 'rgb16-high-byte-table' || !Array.isArray(data.producer.channels) || data.producer.channels.length !== 3
      || data.producer.channels.some(c => !Array.isArray(c) || c.length !== 256 || c.some(x => !Number.isInteger(x) || x < 0 || x > 255))) fail('Invalid producer tables');
  if (!Array.isArray(data.devicePalette) || !data.devicePalette.length || !Array.isArray(data.mappings) || !data.mappings.length) fail('Missing finite palette/mapping');
  const palette = new Map();
  for (const row of data.devicePalette) {
    if (!Number.isInteger(row.index) || row.index < 0 || row.index > 255 || !triple(row.rgb16, 65535) || palette.has(row.index)) fail('Invalid or duplicate device palette index');
    palette.set(row.index, row.rgb16);
  }
  const map = new Map();
  for (const row of data.mappings) {
    if (!triple(row.rgb16, 65535) || !triple(row.deviceRgb16, 65535) || !palette.has(row.deviceIndex)
        || row.deviceRgb16.some((v, i) => v !== palette.get(row.deviceIndex)[i])) fail('Mapping disagrees with recorded device palette');
    const key = row.rgb16.join(','); if (map.has(key)) fail('Duplicate joint RGB16 mapping');
    map.set(key, row.deviceRgb16.map((v, i) => data.producer.channels[i][v >> 8]));
  }
  // Version 1 retains its exact canonical data and identity. A direct operation
  // declaration requires version 2; it never changes the RGB16 query semantics.
  if (data.version === 1 && Object.hasOwn(data, 'directRgb8')) fail('Direct RGB8 preparation requires profile version 2');
  let directMap;
  if (data.version === 2) {
    const direct = data.directRgb8;
    if (!direct || direct.operation !== 'GetPixPat-FillCRect-patCopy' || direct.context !== 'declared-context0'
        || direct.scope !== 'preparation-only' || !Array.isArray(direct.evidence) || !direct.evidence.length
        || !Array.isArray(direct.mappings) || !direct.mappings.length) fail('Missing or unsupported direct RGB8 operation declaration');
    for (const e of direct.evidence) if (!/^[a-f0-9]{64}$/.test(e?.sha256) || typeof e.description !== 'string' || !e.description.trim()) fail('Invalid direct RGB8 evidence');
    directMap = new Map();
    for (const row of direct.mappings) {
      if (!triple(row.rgb8, 255) || !triple(row.deviceRgb16, 65535) || !palette.has(row.deviceIndex)
          || row.deviceRgb16.some((v, i) => v !== palette.get(row.deviceIndex)[i])) fail('Direct RGB8 mapping disagrees with recorded device palette');
      const key = row.rgb8.join(','); if (directMap.has(key)) fail('Duplicate joint RGB8 mapping');
      directMap.set(key, row.deviceRgb16.map((v, i) => data.producer.channels[i][v >> 8]));
    }
    direct.mappings.sort((a,b) => a.rgb8[0]-b.rgb8[0] || a.rgb8[1]-b.rgb8[1] || a.rgb8[2]-b.rgb8[2]);
  }
  data.devicePalette.sort((a,b) => a.index-b.index);
  data.mappings.sort((a,b) => a.rgb16[0]-b.rgb16[0] || a.rgb16[1]-b.rgb16[1] || a.rgb16[2]-b.rgb16[2]);
  data = canonical(data);
  if (!globalThis.crypto?.subtle) fail('Display profile preparation requires Web Crypto');
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2,'0')).join('');
  const profile = freeze({ id: `display-profile:${hash}`, data });
  prepared.set(profile, rgb16 => {
    if (!triple(rgb16, 65535)) throw new DisplayProfileError('Invalid source RGB16', 'INVALID_SOURCE_COLOR');
    const rgb = map.get(rgb16.join(','));
    if (!rgb) throw new DisplayProfileError(`Missing exact joint RGB16 mapping: ${rgb16.join(',')}`, 'MISSING_MAPPING');
    return [...rgb];
  });
  if (directMap) preparedDirectRgb8.set(profile, rgb8 => {
    if (!triple(rgb8, 255)) throw new DisplayProfileError('Invalid source RGB8', 'INVALID_SOURCE_COLOR');
    const rgb = directMap.get(rgb8.join(','));
    if (!rgb) throw new DisplayProfileError(`Missing exact joint RGB8 mapping: ${rgb8.join(',')}`, 'MISSING_MAPPING');
    return [...rgb];
  });
  return profile;
}
/** Synchronous conversion consumes only profiles returned by the async factory. */
export function displayRealizer(profile) {
  if (profile === undefined) return undefined;
  const realize = prepared.get(profile);
  if (!realize) throw new DisplayProfileError('Use prepareDisplayProfile before loading; prepared pixels cannot be retagged');
  return realize;
}
/** Internal decoder seam. This declares preparation conditions, not paint-context admission. */
export function directRgb8Realizer(profile) {
  displayRealizer(profile);
  return profile === undefined ? undefined : preparedDirectRgb8.get(profile);
}
export function displayPolicy(profile) { displayRealizer(profile); return profile?.id ?? LEGACY_DISPLAY_POLICY; }
export function realizeRgb16(rgb16, profile) { return displayRealizer(profile)?.(rgb16) ?? macRgbToSrgb(rgb16.map(v => v >> 8)); }
/** Metadata must name the actual owning theme policy, not an arbitrary profile string. */
export function ownerDisplayPolicyMatches(owner, policy) { return policy === displayPolicy(owner?.displayProfile); }
export function assertDisplayProfileChain(theme, profile) {
  const expected = displayPolicy(profile), seen = new Set();
  for (let t=theme; t && !seen.has(t); t=t.base) {
    seen.add(t);
    if (displayPolicy(t.manifest.displayProfile) !== expected) throw new DisplayProfileError('Theme base chain uses incompatible display profiles', 'PROFILE_MISMATCH');
  }
}
