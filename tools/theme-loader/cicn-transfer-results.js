// Finite observed destination planes, not a missing-palette color algorithm.
import { displayRealizer } from './display-profile.js';
import { parseResourceFork } from './resource-fork.js';
import { readCicnIndexed } from './decoders/cicn.js';

const prepared = new WeakSet(), bindings = new WeakMap();
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const json = v => JSON.stringify(canonical(v));
const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
const hashJson = v => sha(new TextEncoder().encode(json(v)));
export class CicnTransferError extends Error {
  constructor(message, code = 'INVALID_CICN_TRANSFER') { super(message); this.name = 'CicnTransferError'; this.code = code; }
}
const fail = message => { throw new CicnTransferError(message); };
function snapshot(v, seen = new Set()) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return v;
  if (!v || typeof v !== 'object' || seen.has(v) || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype)) fail('Expected finite plain JSON');
  seen.add(v);
  let out;
  if (Array.isArray(v)) {
    if (Array.from({ length: v.length }, (_, i) => i).some(i => !Object.hasOwn(v, i))) fail('Sparse arrays are unsupported');
    out = v.map(x => snapshot(x, seen));
  } else out = Object.fromEntries(Object.entries(v).map(([k,x]) => [k, snapshot(x, seen)]));
  seen.delete(v); return out;
}
function keys(v, fields) {
  if (!v || Array.isArray(v) || typeof v !== 'object' || Object.keys(v).sort().join(',') !== fields.split(' ').sort().join(',')) fail(`Expected fields: ${fields}`);
}
const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const ints = (v, n, min, max) => Array.isArray(v) && v.length === n && v.every(x => Number.isInteger(x) && x >= min && x <= max);
const rect = v => ints(v, 4, -32768, 32767) && v[2] > v[0] && v[3] > v[1];
function evidence(rows) {
  if (!Array.isArray(rows) || !rows.length) fail('Missing evidence');
  for (const r of rows) { keys(r, 'sha256 description'); if (!digest(r.sha256) || typeof r.description !== 'string' || !r.description.trim()) fail('Invalid evidence'); }
}
function validateEnvironment(e) {
  keys(e, 'deviceEvidenceSha256 engineEvidenceSha256 devicePalette producer');
  if (!digest(e.deviceEvidenceSha256) || !digest(e.engineEvidenceSha256)) fail('Missing recorded environment identity');
  keys(e.producer, 'model channels');
  if (e.producer.model !== 'rgb16-high-byte-table' || !Array.isArray(e.producer.channels) || e.producer.channels.length !== 3
      || e.producer.channels.some(c => !ints(c, 256, 0, 255))) fail('Invalid producer');
  if (!Array.isArray(e.devicePalette) || !e.devicePalette.length) fail('Missing destination palette');
  const palette = new Map();
  for (const p of e.devicePalette) {
    keys(p, 'index rgb16');
    if (!Number.isInteger(p.index) || p.index < 0 || p.index > 255 || !ints(p.rgb16, 3, 0, 65535) || palette.has(p.index)) fail('Invalid destination palette');
    palette.set(p.index, p.rgb16);
  }
  e.devicePalette.sort((a,b) => a.index-b.index); return palette;
}
function validateRecord(r, palette) {
  keys(r, 'source operation preparationEvidenceSha256 evidence destinationIndices');
  keys(r.source, 'payloadSha256 byteLength indexedRepresentationSha256');
  if (!digest(r.source.payloadSha256) || !digest(r.source.indexedRepresentationSha256) || !Number.isSafeInteger(r.source.byteLength) || r.source.byteLength < 82) fail('Invalid source identity');
  if (!digest(r.preparationEvidenceSha256)) fail('Missing preparation evidence');
  evidence(r.evidence);
  const op = r.operation;
  keys(op, 'name mode masked foregroundRGB16 backgroundRGB16 sourceRect destinationRect clipRect portRect localZeroGlobal');
  if (op.name !== 'GetCIcon-CopyBits' || op.mode !== 'srcCopy' || op.masked !== false
      || json(op.foregroundRGB16) !== '[0,0,0]' || json(op.backgroundRGB16) !== '[65535,65535,65535]'
      || ![op.sourceRect,op.destinationRect,op.clipRect,op.portRect].every(rect) || !ints(op.localZeroGlobal, 2, -32768, 32767)) fail('Unsupported operation context');
  const [l,t,right,bottom] = op.sourceRect, d = op.destinationRect, c = op.clipRect, p = op.portRect;
  if (l !== 0 || t !== 0 || d[2]-d[0] !== right || d[3]-d[1] !== bottom
      || c[0] > d[0] || c[1] > d[1] || c[2] < d[2] || c[3] < d[3]
      || p[0] > d[0] || p[1] > d[1] || p[2] < d[2] || p[3] < d[3]) fail('Only complete one-to-one origin-zero source planes are supported');
  if (!Array.isArray(r.destinationIndices) || r.destinationIndices.length !== right * bottom || r.destinationIndices.some(i => !palette.has(i))) fail('Incomplete or unbound destination plane');
}
/** Content identity authenticates neither evidence nor a historical provider. */
export async function prepareCicnTransferResults(input) {
  const data = snapshot(input); // no caller state read after first await
  keys(data, 'version scope environment records');
  if (data.version !== 1 || data.scope !== 'finite-raster-preparation' || !Array.isArray(data.records) || !data.records.length) fail('Unsupported finite transfer schema');
  const palette = validateEnvironment(data.environment), seen = new Set();
  for (const r of data.records) {
    validateRecord(r, palette);
    if (seen.has(r.source.payloadSha256)) fail('Ambiguous source transfer records');
    seen.add(r.source.payloadSha256);
  }
  data.records.sort((a,b) => a.source.payloadSha256.localeCompare(b.source.payloadSha256));
  const contractId = `cicn-transfer-context:${await hashJson({ environment: data.environment, operations: data.records.map(r => ({ source: r.source, operation: r.operation, preparationEvidenceSha256: r.preparationEvidenceSha256 })) })}`;
  const id = `cicn-transfer-results:${await hashJson(data)}`;
  const result = freeze({ id, contractId, data: canonical(data) }); prepared.add(result); return result;
}
/** Snapshot explicit authorization before loader fetch/hash/decoder awaits. */
export function snapshotCicnTransfer(option, profile) {
  if (option === undefined) return undefined;
  keys(option, 'results contractId maskPolicy');
  const { results, contractId, maskPolicy } = option;
  if (!prepared.has(results) || contractId !== results.contractId || maskPolicy !== 'source-mask-alpha') fail('Use branded results with their exact declared context and explicit source-mask-alpha policy');
  displayRealizer(profile);
  if (!profile || json(profile.data.devicePalette) !== json(results.data.environment.devicePalette)
      || json(profile.data.producer) !== json(results.data.environment.producer)) fail('Display profile palette/producer does not match finite transfer environment');
  return Object.freeze({ results, contractId, maskPolicy });
}
/** Internal canonical source representation; includes source colors, indices and mask independently. */
export function cicnIndexedRepresentation(parsed) {
  const { pmap, mask, bmap, colorTable, indices, maskAlpha } = parsed;
  return canonical({ version: 1, pmap, mask, bmap, colorTable, indices: [...indices], maskAlpha: [...maskAlpha] });
}
export async function describeCicnTransferSource(bytes) {
  bytes = new Uint8Array(bytes);
  const parsed = readCicnIndexed(bytes);
  if (!parsed) fail('Unsupported indexed representation');
  return { payloadSha256: await sha(bytes), byteLength: bytes.length, indexedRepresentationSha256: await hashJson(cicnIndexedRepresentation(parsed)) };
}
/** Private binding is consumed only against the same immutable fork snapshot. */
export async function bindCicnTransfer(option, fork) {
  if (!option) return undefined;
  const records = new Map(option.results.data.records.map(r => [r.source.payloadSha256,r]));
  const entries = parseResourceFork(fork), selected = new Map(), forkSha256 = await sha(fork);
  for (let occurrence = 0; occurrence < entries.length; occurrence++) {
    const e = entries[occurrence]; if (e.type !== 'cicn') continue;
    const payloadSha256 = await sha(e.data), r = records.get(payloadSha256); if (!r) continue;
    const source = await describeCicnTransferSource(e.data);
    if (json(source) !== json(r.source)) fail('Exact indexed source representation mismatch');
    const parsed = readCicnIndexed(e.data), op = r.operation;
    if (parsed.pmap.width !== op.sourceRect[2] || parsed.pmap.height !== op.sourceRect[3]
        || parsed.pmap.pixelType !== 0 || parsed.pmap.cmpCount !== 1 || parsed.pmap.cmpSize !== parsed.pmap.pixelSize
        || parsed.pmap.packType !== 0 || !parsed.pmap.isPixMap || parsed.pmap.bounds.left !== 0 || parsed.pmap.bounds.top !== 0
        || parsed.mask.width !== parsed.pmap.width || parsed.mask.height !== parsed.pmap.height
        || parsed.mask.bounds.left !== 0 || parsed.mask.bounds.top !== 0) fail('Unsupported observed source layout');
    const rgb = new Uint8Array(r.destinationIndices.length * 3), env = option.results.data.environment;
    const palette = new Map(env.devicePalette.map(p => [p.index,p.rgb16]));
    r.destinationIndices.forEach((index,i) => rgb.set(palette.get(index).map((v,c) => env.producer.channels[c][v >> 8]), i*3));
    const provenance = freeze({ model: 'finite-cicn-transfer-v1', resultsId: option.results.id, contractId: option.contractId,
      maskPolicy: option.maskPolicy, scope: 'finite-raster-preparation', forkSha256, source: r.source,
      resource: { type: 'cicn', signedId: e.id, resourceIndex: occurrence }, operation: r.operation,
      destinationPlaneSha256: await sha(new Uint8Array(r.destinationIndices)), preparationEvidenceSha256: r.preparationEvidenceSha256, evidence: r.evidence });
    selected.set(occurrence, { bytes: new Uint8Array(e.data), representation: json(cicnIndexedRepresentation(parsed)), rgb, provenance });
  }
  if (!selected.size) fail('No exact source matches the authorized finite transfer results');
  const binding = Object.freeze({}); bindings.set(binding, selected); return binding;
}
export function finiteCicnTransfer(binding, occurrence, bytes) {
  if (binding === undefined) return undefined;
  const selected = bindings.get(binding); if (!selected) fail('Invalid finite transfer binding');
  const hit = selected.get(occurrence); if (!hit) return undefined;
  if (bytes.length !== hit.bytes.length || bytes.some((v,i) => v !== hit.bytes[i])) fail('Transfer source changed after binding');
  return parsed => {
    if (json(cicnIndexedRepresentation(parsed)) !== hit.representation) fail('Transfer decoder representation changed');
    return { rgb: hit.rgb, provenance: hit.provenance };
  };
}
