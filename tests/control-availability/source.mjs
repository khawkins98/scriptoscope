import { createHash } from 'node:crypto';
import { decodeArchive } from '../../tools/sit-wasm/index.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
import { decodeCicn } from '../../tools/theme-loader/decoders/cicn.js';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const QUERY_IDS = [-10240, -10239, -10238, -10232, -10231, -10230, -10167, -10166, -10165];
const fourCC = value => value === undefined ? null : String.fromCharCode((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
/** Enumeration only. Neither size, name nor resource count selects a scheme. */
export async function enumerateForks(bytes, format) {
  if (format === 'rsrc') return [{ entryIndex: null, entryName: null, forkType: 1, fileType: null, creator: null, bytes }];
  if (format !== 'sit') throw new Error(`Unsupported explicit source format: ${format}`);
  return (await decodeArchive(bytes)).map((entry, entryIndex) => ({ entryIndex, entryName: entry.name,
    forkType: entry.forkType, fileType: fourCC(entry.type), creator: fourCC(entry.creator), bytes: entry.bytes })).filter(entry => entry.forkType === 1);
}
export function describeFork(entry) {
  return { entryIndex: entry.entryIndex, entryName: entry.entryName, forkType: entry.forkType,
    fileType: entry.fileType, creator: entry.creator, byteLength: entry.bytes.length, forkSha256: sha256(entry.bytes) };
}
/** A choice must pin BOTH archive identity and an explicit entry identity. */
export function selectFork(bytes, entries, choice) {
  if (sha256(bytes) !== choice.archiveSha256) throw new Error(`${choice.slug}: archive hash drift; explicit review required`);
  if (!Object.hasOwn(choice, 'entryIndex') || !Object.hasOwn(choice, 'entryName') || !choice.forkSha256) throw new Error(`${choice.slug}: missing explicit entry/fork choice`);
  const matches = entries.filter(entry => entry.entryIndex === choice.entryIndex && entry.entryName === choice.entryName);
  if (matches.length !== 1) throw new Error(`${choice.slug}: ambiguous or missing explicit entry (${matches.length} matches)`);
  const selected = matches[0];
  if (sha256(selected.bytes) !== choice.forkSha256) throw new Error(`${choice.slug}: selected resource fork hash drift`);
  return selected;
}
export function resourceCandidates(fork, ids = QUERY_IDS) {
  const resources = parseResourceFork(fork.bytes), candidates = [];
  // Raw type and signed ID only. No generated role map, theme manifest or
  // renderer classification is consulted to infer what a resource means.
  for (const type of ['cicn', 'cinf']) for (const signedId of ids) {
    const matches = resources.filter(resource => resource.type === type && resource.id === signedId);
    if (matches.length > 1) throw new Error(`Ambiguous duplicate resource ${type}/${signedId}`);
    const resource = matches[0];
    if (!resource) { candidates.push({ type, signedId, presence: 'absent-from-selected-fork' }); continue; }
    let decodedDimensions;
    if (type === 'cicn') {
      const decoded = decodeCicn(resource.data);
      decodedDimensions = { width: decoded.width, height: decoded.height, evidence: 'shared-decoder observation, not independent pixel verification' };
    }
    candidates.push({ type, signedId, presence: 'present', authorName: resource.name, byteLength: resource.data.length,
      payloadSha256: sha256(resource.data), ...(decodedDimensions ? { decodedDimensions } : {}) });
  }
  return { totalResources: resources.length, candidates };
}
export async function sourceCandidate(bytes, choice) {
  const entries = await enumerateForks(bytes, choice.format), selected = selectFork(bytes, entries, choice);
  return { slug: choice.slug, reviewStatus: 'unreviewed', expectedAvailability: 'unknown',
    archive: { path: choice.path, format: choice.format, byteLength: bytes.length, sha256: sha256(bytes) },
    selectedFork: describeFork(selected), selectionReason: choice.selectionReason,
    selectionReviewStatus: choice.selectionReviewStatus, nameDecodingLimit: choice.nameDecodingLimit ?? null,
    ...resourceCandidates(selected),
    limitations: ['Source facts are produced through shared archive/resource decoders, not independently verified decoding.',
      'Resource existence alone does not establish public API selection, fallback, historical availability or correct pixels.',
      'These candidate facts do not observe a runtime load. Opt-in load provenance (#251) separately joins actual selected fork and decoder-input payload identities to manifest selection; neither path certifies complete decoder correctness.'] };
}
