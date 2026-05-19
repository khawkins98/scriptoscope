// Unified declarative-promotion scanner per spec A §21 + spec C §8.1.
//
// Walks the document for `[data-aaron-{family}]` sentinels and promotes
// every matched element into the corresponding themed control. Each
// family's promoter is idempotent (skips elements already carrying the
// `data-aaron-promoted` sentinel), so re-running on dynamic content is
// safe.
//
// The unified scanner is a MutationObserver-backed orchestrator: one
// observer instance handles the entire document, fanning out to the
// per-family promoters as new elements arrive.
//
// Auto-start on DOMContentLoaded happens through this module's side-
// effect import — same pattern as the prior window-only scanner.
// Consumers who want manual control can stopScanner() immediately after
// import.

import { scanForWindows, promoteElement as promoteWindowElement } from './window-manager/scanner.js';
import {
  promoteButtons,
  promoteCheckboxes,
  promoteRadios,
  promoteFields,
  promoteDisclosures,
} from './controls/index.js';

const WINDOW_SOURCE_SELECTOR =
  '[data-aaron-window]:not([data-aaron-promoted]), .aaron-window-source:not([data-aaron-promoted])';

let observer: MutationObserver | null = null;

/**
 * One-shot scan: promote every `[data-aaron-{family}]` element in `root`.
 * Idempotent — already-promoted elements are skipped.
 *
 * Returns counts per family so consumers can log a "promoted X buttons,
 * Y checkboxes, ..." line for diagnostics.
 */
export function scanAll(root: ParentNode = document): ScanAllResult {
  const windows = scanForWindows(root);
  const buttons = promoteButtons(root as Element);
  const checkboxes = promoteCheckboxes(root as Element);
  const radios = promoteRadios(root as Element);
  const fields = promoteFields(root as Element);
  const disclosures = promoteDisclosures(root as Element);
  return {
    windows: windows.length,
    buttons: buttons.length,
    checkboxes: checkboxes.length,
    radios: radios.length,
    fields: fields.length,
    disclosures: disclosures.length,
  };
}

export interface ScanAllResult {
  windows: number;
  buttons: number;
  checkboxes: number;
  radios: number;
  fields: number;
  disclosures: number;
}

/**
 * Start the unified auto-scanner: run an initial scanAll(), then keep
 * watching `document.body` for added matches. Idempotent — calling when
 * already started is a no-op.
 */
export function startUnifiedScanner(): void {
  if (observer !== null) return;
  scanAll(document);
  observer = new MutationObserver(onMutations);
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Stop the unified scanner. Used by tests + for opt-out. */
export function stopUnifiedScanner(): void {
  if (observer === null) return;
  observer.disconnect();
  observer = null;
}

// ─── Internals ─────────────────────────────────────────────────────────

function onMutations(mutations: MutationRecord[]): void {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;

      // Window source elements need promoteElement (creates the AaronWindow,
      // removes the source from the DOM). Run those first to avoid the
      // window source's children being misread by control promoters.
      if (node.matches(WINDOW_SOURCE_SELECTOR)) {
        promoteWindowElement(node);
        continue; // node has been replaced; descendants live in the new window
      }
      const windowDescendants = node.querySelectorAll<HTMLElement>(WINDOW_SOURCE_SELECTOR);
      for (const el of windowDescendants) promoteWindowElement(el);

      // Promote the added node + its descendants. promoteX functions only
      // search DESCENDANTS of the root; for an added leaf node that IS
      // itself a control source, we need to scope to its parent so
      // querySelectorAll picks it up.
      const root = node.parentNode instanceof HTMLElement ? node.parentNode : node;
      promoteButtons(root);
      promoteCheckboxes(root);
      promoteRadios(root);
      promoteFields(root);
      promoteDisclosures(root);
    }
  }
}

/**
 * Auto-start on DOMContentLoaded when imported in a browser. Same
 * convention as the prior window-only scanner. SSR / non-browser
 * imports do not trigger this.
 */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startUnifiedScanner);
  } else {
    queueMicrotask(startUnifiedScanner);
  }
}
