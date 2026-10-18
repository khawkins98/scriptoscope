// Browser-shell lifecycle seam. The conversion core stays independent of the
// runtime; consumers can drop derived caches when an owned asset is released.
// A page can use the bundled runtime alongside the separately deployed raw
// loader, or multiple bundles. URL identity is realm-wide, so their disposal
// notifications must share a registry even when this module has multiple copies.
const registryKey = Symbol.for('scriptoscope.assetLifecycle.releaseListeners.v1');
const releaseListeners = globalThis[registryKey] ??= new Set();

export function onAssetUrlReleased(listener) {
  releaseListeners.add(listener);
  return () => releaseListeners.delete(listener);
}

export function notifyAssetUrlReleased(url) {
  for (const listener of releaseListeners) {
    // Cleanup must release the remaining assets even if a subscriber fails.
    try { listener(url); } catch { /* isolate cleanup subscribers */ }
  }
}
