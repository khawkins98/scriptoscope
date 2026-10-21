// Compact committed evidence (layout compact-json-v1) and exact original-byte recovery.
// See tests/reference-captures/README.md "Compact evidence format".
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const STORE_PATH = 'tests/compact-evidence.json';
export const LAYOUT = 'compact-json-v1';
const INLINE_WIDTH = 120;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * compact-json-v1: valid JSON, LF line endings, 2-space indentation, raw UTF-8.
 * Arrays whose items are all primitives are written on one line. Any other
 * object/array is written on one line when its minified form is at most 120
 * characters; otherwise each member goes on its own line. Table rows therefore
 * become one reviewable line each.
 */
export function formatCompactJSON(value) {
  const format = (item, pad) => {
    if (item === null || typeof item !== 'object') return JSON.stringify(item);
    const flat = JSON.stringify(item);
    if (Array.isArray(item) ? item.every(v => v === null || typeof v !== 'object') || flat.length <= INLINE_WIDTH
      : flat.length <= INLINE_WIDTH) return flat;
    const next = pad + '  ';
    if (Array.isArray(item)) return '[\n' + item.map(v => next + format(v, next)).join(',\n') + '\n' + pad + ']';
    return '{\n' + Object.entries(item).map(([k, v]) => next + JSON.stringify(k) + ': ' + format(v, next)).join(',\n') + '\n' + pad + '}';
  };
  return format(value, '') + '\n';
}

/** Byte encoders of the original (pre-compaction) files. Each is exact, never approximate. */
export const ORIGINAL_ENCODINGS = {
  // JavaScript JSON.stringify(value, null, 2) followed by one LF.
  'json-indent2-lf': value => JSON.stringify(value, null, 2) + '\n',
  // Same, with every UTF-16 code unit >= U+0080 escaped as lowercase \uXXXX
  // (the byte form written by Python json.dumps(value, indent=2) + LF).
  'json-indent2-ascii-lf': value => JSON.stringify(value, null, 2)
    .replace(/[\u0080-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n',
};

let cached;
export function compactStore(root = REPOSITORY_ROOT) {
  if (root === REPOSITORY_ROOT && cached) return cached;
  const store = JSON.parse(readFileSync(resolve(root, STORE_PATH)));
  if (store.schemaVersion !== 1 || store.layout !== LAYOUT) throw new Error('unsupported compact evidence store');
  const value = { ...store, byStored: new Map(store.compacted.map(e => [e.storedSha256, e])),
    byAlias: new Map(store.aliases.map(e => [e.path, e])) };
  if (root === REPOSITORY_ROOT) cached = value;
  return value;
}

/**
 * Return the exact original bytes bound by existing sha256 identities. Lookup is
 * content-addressed (stored-bytes SHA-256), so a renamed or copied compact file
 * still decodes; unregistered bytes are returned unchanged. A registered file
 * whose re-encoding does not reproduce its original identity throws.
 */
export function originalBytes(bytes, store = compactStore()) {
  const entry = store.byStored.get(sha256(bytes));
  if (!entry) return bytes;
  const encode = ORIGINAL_ENCODINGS[entry.encoding];
  if (!encode) throw new Error(`compact evidence: unknown encoding ${entry.encoding}`);
  const original = Buffer.from(encode(JSON.parse(bytes)));
  if (original.length !== entry.originalBytes || sha256(original) !== entry.originalSha256)
    throw new Error(`compact evidence: ${entry.path} does not reproduce its original identity`);
  return original;
}

/** A removed duplicate: path → single retained repository copy with the same original identity. */
export function aliasFor(repoPath, store = compactStore()) { return store.byAlias.get(repoPath); }

/**
 * Read the original bytes of a repository file, following a declared alias when
 * the duplicate path was removed. Paths outside the repository are read as-is.
 */
export function readOriginal(file, { root = REPOSITORY_ROOT } = {}) {
  const absolute = resolve(root, file);
  if (existsSync(absolute)) return originalBytes(readFileSync(absolute));
  const rel = relative(realpathSync(REPOSITORY_ROOT), absolute);
  const alias = !rel.startsWith('..') && !isAbsolute(rel) ? aliasFor(rel) : undefined;
  if (!alias) return readFileSync(absolute); // preserve the ordinary ENOENT failure
  const bytes = originalBytes(readFileSync(resolve(REPOSITORY_ROOT, alias.target)));
  if (sha256(bytes) !== alias.sha256) throw new Error(`compact evidence: alias ${alias.path} target identity changed`);
  return bytes;
}

// CLI for NEW, not-yet-bound files only: rewrite in canonical compact-json-v1.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--write') {
  const { writeFileSync } = await import('node:fs');
  for (const path of process.argv.slice(3)) {
    const bytes = readFileSync(path);
    if (compactStore().byStored.has(sha256(bytes)) || compactStore().compacted.some(e => sha256(bytes) === e.originalSha256))
      throw new Error(`${path}: already registered; migrated identities are not rewritten`);
    writeFileSync(path, formatCompactJSON(JSON.parse(bytes)));
  }
}
