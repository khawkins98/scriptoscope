// Declarative scanner — per PRD §North Star principle #2 the primary
// integration path is markup-only: add `data-aaron-window` to any
// element and the scanner promotes it into a real AaronWindow on
// DOMContentLoaded. A MutationObserver applies the same promotion to
// elements added dynamically after load.
//
// CSS class fallback per PRD: `.aaron-window-source` selector also
// works, for environments where `data-*` attributes are awkward (some
// CSP contexts, some template engines).
//
// The promoted element's data-aaron-* attributes map to AaronWindow
// constructor options. The element's innerHTML becomes the `html`
// option. The original element is removed from the DOM; the new
// AaronWindow takes its parent as the mount target.
//
// Sentinel: AaronWindow's createDom() adds `data-aaron-promoted` to
// its root, so the scanner's selector excludes already-promoted
// windows. Without this we'd infinite-loop on re-scan (the rendered
// window also has `data-aaron-window`).

import { AaronWindow, type AaronWindowOptions } from './AaronWindow.js';

const PROMOTED_ATTR = 'data-aaron-promoted';
const SOURCE_SELECTOR = `[data-aaron-window]:not([${PROMOTED_ATTR}]), .aaron-window-source:not([${PROMOTED_ATTR}])`;

let observer: MutationObserver | null = null;

/**
 * Scan a subtree for `[data-aaron-window]` source elements and promote
 * each into a real AaronWindow. Returns the freshly-mounted windows.
 *
 * Idempotent: already-promoted elements are skipped via the
 * `data-aaron-promoted` sentinel that AaronWindow adds to its DOM.
 */
export function scanForWindows(root: ParentNode = document): AaronWindow[] {
  const sources = root.querySelectorAll<HTMLElement>(SOURCE_SELECTOR);
  const windows: AaronWindow[] = [];
  for (const el of sources) {
    windows.push(promoteElement(el));
  }
  return windows;
}

/**
 * Promote a single source element into an AaronWindow. The source is
 * removed from the DOM; the new window mounts at the source's former
 * parent.
 */
export function promoteElement(el: HTMLElement): AaronWindow {
  const opts: AaronWindowOptions = parseOptions(el);
  const parent = el.parentElement ?? document.body;
  opts.mount = parent;
  el.remove();
  const win = new AaronWindow(opts);
  win.mount();
  return win;
}

/**
 * Parse data-aaron-* attributes (and innerHTML) from an HTMLElement
 * into AaronWindowOptions. Exported for unit tests; rarely called
 * directly by consumers.
 */
export function parseOptions(el: HTMLElement): AaronWindowOptions {
  const opts: AaronWindowOptions = {};
  const ds = el.dataset;

  if (ds['aaronTitle']  !== undefined) opts.title  = ds['aaronTitle'];
  if (ds['aaronX']      !== undefined) opts.x      = parseIntStrict(ds['aaronX']);
  if (ds['aaronY']      !== undefined) opts.y      = parseIntStrict(ds['aaronY']);
  if (ds['aaronWidth']  !== undefined) opts.width  = parseIntStrict(ds['aaronWidth']);
  if (ds['aaronHeight'] !== undefined) opts.height = parseIntStrict(ds['aaronHeight']);
  if (ds['aaronMinWidth']  !== undefined) opts.minWidth  = parseIntStrict(ds['aaronMinWidth']);
  if (ds['aaronMinHeight'] !== undefined) opts.minHeight = parseIntStrict(ds['aaronMinHeight']);

  const inner = el.innerHTML.trim();
  if (inner !== '') opts.html = el.innerHTML;

  // Preserve consumer-added CSS classes (other than the sentinel ones).
  const extraClasses = Array.from(el.classList).filter(c =>
    c !== 'aaron-window-source' && c !== 'aaron-window',
  );
  if (extraClasses.length > 0) opts.class = extraClasses;

  return opts;
}

function parseIntStrict(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Start the auto-scanner: run an initial scan, then keep watching
 * document.body for added `[data-aaron-window]` elements. Idempotent —
 * calling when already started is a no-op.
 */
export function startScanner(): void {
  if (observer !== null) return;
  scanForWindows();
  observer = new MutationObserver(onMutations);
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Stop watching for dynamic additions. Used by tests / for opt-out. */
export function stopScanner(): void {
  if (observer === null) return;
  observer.disconnect();
  observer = null;
}

function onMutations(mutations: MutationRecord[]): void {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(SOURCE_SELECTOR)) {
        promoteElement(node);
      }
      const descendants = node.querySelectorAll<HTMLElement>(SOURCE_SELECTOR);
      for (const el of descendants) promoteElement(el);
    }
  }
}

// Auto-start removed in step 4 — the unified scanner in src/scanAll.ts
// now owns DOMContentLoaded promotion + MutationObserver for ALL
// families (windows + controls). startScanner / stopScanner remain
// exported for consumers that want fine-grained window-only control
// without the control-family promoters; they're no longer auto-invoked.
