// One owner per decoded fork. References identify pixels; image URLs are exports.
import { notifyAssetUrlReleased } from './assetLifecycle.js';
const key = Symbol.for('scriptoscope.rasterAssets.v2');
const state = globalThis[key] ??= { next: 0, entries: new Map(), owners: new WeakMap() };
const prefix = 'scriptoscope-raster:';
const ended = () => new DOMException('Raster owner disposed', 'AbortError');

export function createRasterAssetOwner(assets, encode, authoritative = false) {
  const namespace = `${prefix}${++state.next}/`;
  const references = new Map();
  const entries = new Map();
  const urls = new Set();
  const pendingBuffers = new Map();
  let disposed = false, pending = 0;
  for (const [index, asset] of assets.entries()) {
    const ref = `${namespace}${index}/${asset.path}`;
    references.set(asset.path, ref);
    const entry = { asset, ref, path: asset.path, authoritative };
    entries.set(ref, entry); state.entries.set(ref, entry);
  }
  const imageUrl = ref => {
    if (disposed) return Promise.reject(ended());
    const entry = entries.get(references.get(ref) ?? ref);
    if (!entry) return Promise.reject(new Error('Unknown owned raster reference'));
    if (!entry.image) {
      pending++;
      const { asset } = entry;
      const buffer = asset.rgba.buffer;
      pendingBuffers.set(buffer, (pendingBuffers.get(buffer) ?? 0) + 1);
      entry.image = Promise.resolve().then(() => {
        if (disposed) throw ended();
        return encode(asset.rgba, asset.width, asset.height, asset.path);
      }).then(url => {
        if (disposed) { release(url); throw ended(); }
        urls.add(url);
        entry.imageReady = true;
        if (authoritative || entry.fractional) entry.asset = undefined;
        return url;
      }).catch(error => { if (!disposed) entry.image = undefined; throw error; })
        .finally(() => {
          pending--;
          const remaining = pendingBuffers.get(buffer) - 1;
          if (remaining) pendingBuffers.set(buffer, remaining); else pendingBuffers.delete(buffer);
        });
    }
    return entry.image;
  };
  const owner = {
    references, imageUrl, lifetime: namespace,
    async imageUrls() {
      if (disposed) throw ended();
      // Preserve every occurrence and source order, including duplicate paths.
      const results = await Promise.allSettled([...entries.values()].map(async entry => [entry.path, await imageUrl(entry.ref)]));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      return new Map(results.map(result => result.value));
    },
    get disposed() { return disposed; },
    // The eager adapter has exported every image and exposes no private refs.
    releasePixels() {
      for (const ref of entries.keys()) state.entries.delete(ref);
      entries.clear(); references.clear();
    },
    usage() {
      const buffers = new Set(pendingBuffers.keys());
      for (const entry of entries.values()) if (entry.asset) buffers.add(entry.asset.rgba.buffer);
      return { rasters: entries.size, pixelBytes: [...buffers].reduce((sum, b) => sum + b.byteLength, 0), images: urls.size, pending };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      notifyAssetUrlReleased(namespace);
      for (const ref of entries.keys()) { state.entries.delete(ref); notifyAssetUrlReleased(ref); }
      for (const url of urls) release(url);
      urls.clear(); entries.clear(); references.clear();
    },
  };
  for (const entry of entries.values()) entry.owner = owner;
  return owner;
}
function release(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) { URL.revokeObjectURL(url); notifyAssetUrlReleased(url); }
}
export function bindRasterOwner(source, owner) { state.owners.set(source, owner); }
export function rasterOwner(source) { return state.owners.get(source); }
export function rasterDisposed(ref) { return ref.startsWith(prefix) && (!state.entries.has(ref) || state.entries.get(ref).owner.disposed); }
export function materializeRasterImage(ref) {
  const entry = state.entries.get(ref);
  return entry ? entry.owner.imageUrl(ref) : ref.startsWith(prefix) ? Promise.reject(ended()) : Promise.resolve(ref);
}
export function decodedRaster(ref) {
  const entry = state.entries.get(ref);
  if (!entry || entry.owner.disposed || entry.authoritative || !entry.asset || entry.fractional) return undefined;
  if (entry.pixels) return entry.pixels;
  const { width, height, rgba } = entry.asset;
  const data = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0 && data[i] !== 255) {
    entry.fractional = true;
    if (entry.imageReady) entry.asset = undefined;
    return undefined;
  }
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data.fill(0, i, i + 3);
  return entry.pixels = { width, height, data };
}
