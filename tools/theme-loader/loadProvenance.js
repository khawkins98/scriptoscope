// Opt-in, load-local byte evidence. No bytes, themes or sinks survive completion.
// This records decoder INPUT identity, never independent decoder correctness.
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const freeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};
const digest = async bytes => hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));

export async function beginLoadProvenance(bytes, container) {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('Byte provenance requires Web Crypto in a secure context');
  const loadId = hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const input = { container, byteLength: bytes.length, sha256: await digest(bytes) };
  const resources = [], pending = [], failures = [], assetBindings = new Map();
  let fork;
  return {
    async selectedFork(bytes, selection) {
      fork = { byteLength: bytes.length, sha256: await digest(bytes), selection };
    },
    observer: {
      begin(entry, resourceIndex) {
        if (entry.type !== 'cicn' && entry.type !== 'cinf' && entry.type !== 'ppat') return undefined;
        const record = { resourceIndex, type: entry.type, signedId: entry.id, byteLength: entry.data.length,
          sha256: null, status: 'pending' };
        resources.push(record);
        // Web Crypto snapshots the exact byte view passed to the decoder next.
        // Attach rejection immediately; parse/validation failures cannot orphan it.
        pending.push(digest(entry.data).then(hash => { record.sha256 = hash; }, error => { failures.push(error); }));
        return freeze({ loadId, resourceIndex });
      },
      bindAsset(reference, path) {
        if (!reference) return;
        if (assetBindings.has(path)) throw new Error(`Byte provenance unsupported: duplicate ${resources.find(record => record.resourceIndex === reference.resourceIndex).type} asset binding`);
        assetBindings.set(path, reference.resourceIndex);
      },
      end(reference, status) {
        if (reference) resources.find(record => record.resourceIndex === reference.resourceIndex).status = status;
      },
    },
    async settle() { await Promise.all(pending); },
    async finish() {
      await Promise.all(pending);
      if (failures.length) throw failures[0];
      return freeze({ version: 1, loadId, scope: { resourceTypes: ['cicn', 'cinf', 'ppat'], evidence: 'decoder-input-bytes' }, input, fork, resources });
    },
  };
}
