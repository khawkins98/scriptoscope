// Canonical description of an arbitrary decoded-theme object graph, for comparing two
// loads that must be indistinguishable. Runs unchanged in Node and in a browser page.
//
// It records, in visit order: every own key (strings and symbols) with its property
// flags, each object's prototype kind and frozen/sealed/extensible state, shared
// references and cycles (as back-references), every typed array's type, view offset,
// buffer sharing and a SHA-256 of its bytes, and primitives including -0/NaN.
// `blob:` URLs are per-load, so they are numbered in first-seen order and, when
// `readUrl` is given, replaced by a digest of the bytes they serve. Strings listed in
// `mask` (a random provenance load id) are replaced by a fixed token.

const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
const sha256 = async bytes => hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));

/**
 * @param {unknown} root
 * @param {{ mask?: string[], readUrl?: (url: string) => Promise<ArrayBuffer|Uint8Array> }} [options]
 * @returns {Promise<{ text: string, objects: number, typedArrays: number, bytes: number, urls: number, foreign: string[] }>}
 */
export async function canonicalGraph(root, { mask = [], readUrl } = {}) {
  const ids = new Map(), buffers = new Map(), urls = new Map(), pending = [], foreign = new Set();
  let typedArrays = 0, bytes = 0;
  const text = value => {
    if (mask.includes(value)) return { masked: true };
    if (!value.startsWith('blob:')) return value;
    if (!urls.has(value)) {
      const entry = { url: urls.size };
      urls.set(value, entry);
      if (readUrl) pending.push(readUrl(value).then(sha256).then(digest => { entry.sha256 = digest; }));
    }
    return urls.get(value);
  };
  const describe = value => {
    switch (typeof value) {
      case 'undefined': return { undefined: true };
      case 'number': return Number.isNaN(value) ? { number: 'NaN' } : Object.is(value, -0) ? { number: '-0' }
        : Number.isFinite(value) ? value : { number: String(value) };
      case 'bigint': return { bigint: String(value) };
      case 'symbol': return { symbol: String(value) };
      case 'string': return text(value);
      case 'boolean': return value;
      case 'function': return { function: true };
      default:
    }
    if (value === null) return null;
    if (ids.has(value)) return { ref: ids.get(value) };
    const id = ids.size;
    ids.set(value, id);
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
      const buffer = ArrayBuffer.isView(value) ? value.buffer : value;
      if (!buffers.has(buffer)) buffers.set(buffer, buffers.size);
      const view = ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
      const entry = { id, type: value.constructor.name, buffer: buffers.get(buffer), bufferByteLength: buffer.byteLength,
        byteOffset: value.byteOffset ?? 0, byteLength: value.byteLength, length: value.length ?? null };
      typedArrays++; bytes += view.byteLength;
      pending.push(sha256(view.slice()).then(digest => { entry.sha256 = digest; }));
      return entry;
    }
    const prototype = Object.getPrototypeOf(value);
    const kind = Array.isArray(value) ? (prototype === Array.prototype ? 'Array' : 'Array-subclass')
      : prototype === Object.prototype ? 'Object' : prototype === null ? 'null-prototype' : `foreign:${value.constructor?.name ?? '?'}`;
    if (kind.startsWith('foreign') || kind === 'Array-subclass') foreign.add(kind);
    const state = Object.isFrozen(value) ? 'frozen' : Object.isSealed(value) ? 'sealed' : Object.isExtensible(value) ? 'open' : 'closed';
    const entry = { id, kind, state, ...(Array.isArray(value) ? { length: value.length } : {}), properties: [] };
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      const flags = `${descriptor.enumerable ? 'e' : '-'}${descriptor.configurable ? 'c' : '-'}${'value' in descriptor ? (descriptor.writable ? 'w' : '-') : 'accessor'}`;
      entry.properties.push([typeof key === 'symbol' ? { symbol: String(key) } : key, flags,
        'value' in descriptor ? describe(descriptor.value) : { accessor: true }]);
    }
    return entry;
  };
  const description = describe(root);
  await Promise.all(pending);
  return { text: JSON.stringify(description), objects: ids.size, typedArrays, bytes, urls: urls.size, foreign: [...foreign] };
}

/** First differing region of two canonical texts, for a readable assertion message. */
export function firstDifference(a, b) {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return { at: i, expected: a.slice(Math.max(0, i - 120), i + 120), actual: b.slice(Math.max(0, i - 120), i + 120) };
}
