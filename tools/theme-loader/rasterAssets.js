// One owner per decoded fork. References identify pixels; image URLs are exports.
import { notifyAssetUrlReleased } from './assetLifecycle.js';
const key = Symbol.for('scriptoscope.rasterAssets.v3');
const state = globalThis[key] ??= { next: 0, owners: new WeakMap() };
const prefix = 'scriptoscope-raster:';
const ended = () => new DOMException('Raster owner disposed', 'AbortError');

export function createRasterAssetOwner(assets, encode, authoritative = false) {
  const namespace = `${prefix}${++state.next}/`;
  const byPath = new Map();
  const entries = [];
  const urls = new Set();
  const pendingBuffers = new Map();
  let disposed = false, pending = 0;
  for (const [index, asset] of assets.entries()) {
    const ref = `${namespace}${index}/${asset.path}`;
    const entry = { asset, ref, path: asset.path, authoritative, active: true };
    entries.push(entry); byPath.set(asset.path, entry);
  }
  const imageUrl = entry => {
    if (disposed || !entry.active) return Promise.reject(ended());
    if (!entry.image) {
      pending++;
      const { asset } = entry;
      const buffer = asset.rgba.buffer;
      pendingBuffers.set(buffer, (pendingBuffers.get(buffer) ?? 0) + 1);
      entry.image = Promise.resolve().then(() => {
        if (disposed || !entry.active) throw ended();
        return encode(asset.rgba, asset.width, asset.height, asset.path);
      }).then(url => {
        if (disposed || !entry.active) { release(url); throw ended(); }
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
    lifetime: namespace,
    capture(path) {
      if (disposed) throw ended();
      const entry = byPath.get(path);
      if (!entry) throw new Error('Unknown owned raster reference');
      return entry.source ??= {
        key: entry.ref,
        decoded() {
          if (disposed || !entry.active) throw ended();
          return decodedRaster(entry);
        },
        imageUrl: () => imageUrl(entry),
      };
    },
    imageUrl(path) {
      try { return owner.capture(path).imageUrl(); }
      catch (error) { return Promise.reject(error); }
    },
    async imageUrls() {
      if (disposed) throw ended();
      // Preserve every occurrence and source order, including duplicate paths.
      const results = await Promise.allSettled(entries.map(async entry => [entry.path, await imageUrl(entry)]));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      return new Map(results.map(result => result.value));
    },
    get disposed() { return disposed; },
    // The eager adapter has exported every image and exposes no private refs.
    releasePixels() {
      clearEntries();
    },
    usage() {
      const buffers = new Set(pendingBuffers.keys());
      for (const entry of entries) if (entry.asset) buffers.add(entry.asset.rgba.buffer);
      return { rasters: entries.length, pixelBytes: [...buffers].reduce((sum, b) => sum + b.byteLength, 0), images: urls.size, pending };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      notifyAssetUrlReleased(namespace);
      clearEntries();
      for (const url of urls) release(url);
      urls.clear();
    },
  };
  function clearEntries() {
    for (const entry of entries) {
      entry.active = false;
      entry.asset = entry.pixels = entry.image = undefined;
    }
    entries.length = 0; byPath.clear();
  }
  return owner;
}
function release(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) { URL.revokeObjectURL(url); notifyAssetUrlReleased(url); }
}
export function bindRasterOwner(source, owner) { state.owners.set(source, owner); }
export function rasterOwner(source) { return state.owners.get(source); }
// An eager result keeps only its lifetime: its pixels are released after export.
// Keyed by the dispose capability, so copies that carry it ({...theme}) share it.
export function bindRasterLifetime(dispose, owner) { (state.lifetimes ??= new WeakMap()).set(dispose, owner); }
export function rasterLifetime(source) {
  return state.owners.get(source) ?? (typeof source.dispose === 'function' ? state.lifetimes?.get(source.dispose) : undefined);
}
function decodedRaster(entry) {
  if (entry.authoritative || !entry.asset || entry.fractional) return undefined;
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
