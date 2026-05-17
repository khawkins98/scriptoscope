// Engine-baseline CSS for Phase 3 controls.
//
// Per docs/control-rendering-architecture.md §11 decisions log:
// - Light DOM (consumer stylesheets cascade into controls)
// - Constructable stylesheet attached once at first control mount
// - No :hover by default; :focus-visible focus ring using palette accent
//
// For controls that have NO cicn artwork in canonical Kaleidoscope schemes
// (push buttons, default buttons, group boxes), the visual styling lives
// here as period-correct CSS, palette-tinted via --aaron-colr-* custom
// properties. For controls that DO have cicn artwork (checkbox, radio,
// popup, slider, scrollbar), this baseline only contains layout + focus
// styles; the visible appearance comes from applyControlChrome.

const ENGINE_BASELINE_CSS = `
/* ─── Focus ring (universal, per spec §8) ──────────────────────────── */
.aaron-control:focus-visible {
  outline: 2px solid var(--aaron-colr-accent, #316ac5);
  outline-offset: 1px;
}

/* ─── Push buttons ─────────────────────────────────────────────────── */
.aaron-button {
  display: inline-block;
  min-width: 60px;
  min-height: 20px;
  padding: 2px 14px;
  margin: 0;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  color: var(--aaron-colr-fg, #000);
  background: linear-gradient(
    to bottom,
    var(--aaron-colr-bg, #f4f4f4) 0%,
    var(--aaron-colr-button-mid, #d8d8d8) 50%,
    var(--aaron-colr-button-bottom, #c8c8c8) 100%
  );
  border: 1px solid var(--aaron-colr-window-frame, #5a5a5a);
  border-radius: 8px;
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.5),
    inset -1px -1px 0 rgba(0, 0, 0, 0.08),
    0 1px 0 rgba(0, 0, 0, 0.06);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
}

.aaron-button[data-state="pressed"] {
  background: linear-gradient(
    to bottom,
    var(--aaron-colr-button-pressed-top, #a8a8a8) 0%,
    var(--aaron-colr-button-pressed-bottom, #c0c0c0) 100%
  );
  box-shadow:
    inset 1px 1px 1px rgba(0, 0, 0, 0.18),
    inset -1px -1px 0 rgba(255, 255, 255, 0.2);
}

.aaron-button[aria-disabled="true"],
.aaron-button[data-state="disabled"] {
  color: var(--aaron-colr-fg-disabled, rgba(0, 0, 0, 0.4));
  background: var(--aaron-colr-bg-disabled, #ececec);
  border-color: var(--aaron-colr-window-frame-disabled, #aaa);
  box-shadow: none;
  cursor: not-allowed;
}

/* Default-button variant: thick black outer outline + slight outer glow */
.aaron-button--default {
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.5),
    inset -1px -1px 0 rgba(0, 0, 0, 0.08),
    0 1px 0 rgba(0, 0, 0, 0.06),
    0 0 0 2px var(--aaron-colr-default-button-outline, #000);
}

.aaron-button--default[data-state="pressed"] {
  box-shadow:
    inset 1px 1px 1px rgba(0, 0, 0, 0.18),
    inset -1px -1px 0 rgba(255, 255, 255, 0.2),
    0 0 0 2px var(--aaron-colr-default-button-outline, #000);
}

.aaron-button--default[aria-disabled="true"],
.aaron-button--default[data-state="disabled"] {
  box-shadow:
    0 0 0 2px var(--aaron-colr-default-button-outline-disabled, rgba(0, 0, 0, 0.3));
}
`;

let sheet: CSSStyleSheet | null = null;
let installedInto: WeakSet<Document> = new WeakSet();

/**
 * Install the engine-baseline stylesheet into the document once.
 * Idempotent — subsequent calls no-op.
 *
 * Uses adoptedStyleSheets when available (modern evergreens per PRD's
 * "no IE / pre-2020 browser support" constraint). Falls back to a
 * `<style>` tag in the head for older Safari without polyfill.
 */
export function installEngineBaseline(doc: Document = document): void {
  if (installedInto.has(doc)) return;
  installedInto.add(doc);

  try {
    // Modern path: constructable stylesheet.
    if (sheet === null) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(ENGINE_BASELINE_CSS);
    }
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch {
    // Fallback: <style> tag.
    const style = doc.createElement('style');
    style.setAttribute('data-aaron-engine-baseline', 'true');
    style.textContent = ENGINE_BASELINE_CSS;
    doc.head.appendChild(style);
  }
}

/**
 * Test helper: clear the installation tracking so tests can re-install
 * into a fresh document. NOT for production use.
 */
export function _resetEngineBaselineForTests(): void {
  installedInto = new WeakSet();
  sheet = null;
}

/**
 * Internal: the CSS text. Exported for tests that need to assert specific
 * rules are present.
 */
export const __ENGINE_BASELINE_CSS_FOR_TESTS = ENGINE_BASELINE_CSS;
