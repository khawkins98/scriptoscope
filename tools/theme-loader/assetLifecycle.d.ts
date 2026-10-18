/** Subscribe to disposal of a blob URL owned by a decoded theme. */
export function onAssetUrlReleased(listener: (url: string) => void): () => void;
/** Browser-shell notification; emitted when an owned blob URL is revoked. */
export function notifyAssetUrlReleased(url: string): void;
