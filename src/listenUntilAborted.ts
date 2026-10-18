/** Mount-owned listeners without the newer addEventListener({ signal }) option.
 * AbortController/EventTarget are available at the supported browser floor;
 * explicit removal also works in Safari 14, Firefox 78 and Chromium 87.
 */
export function listenUntilAborted<K extends keyof (GlobalEventHandlersEventMap & WindowEventMap)>(
  signal: AbortSignal,
  target: EventTarget,
  type: K,
  listener: (event: (GlobalEventHandlersEventMap & WindowEventMap)[K]) => void,
  capture = false,
): () => void {
  if (signal.aborted) return () => {};
  const handler = listener as EventListener;
  const remove = (): void => {
    target.removeEventListener(type, handler, capture);
    signal.removeEventListener('abort', remove);
  };
  target.addEventListener(type, handler, capture);
  signal.addEventListener('abort', remove, { once: true });
  return remove;
}
