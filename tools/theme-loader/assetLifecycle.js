// Browser-shell lifecycle seam. The conversion core stays independent of the
// runtime; consumers can drop derived caches when an owned asset is released.
const releaseListeners = new Set();

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
