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

/* ─── Checkboxes + radios ──────────────────────────────────────────── */
/* Same architectural path as push buttons (#71): canonical Kaleidoscope
   bundles ship no checkbox/radio cicn artwork — these were system CDEF
   controls. CSS-drawn, palette-tinted; native <input> handles activation
   and a11y, visually hidden behind a chrome span.
   Period note: classic Mac OS used an X mark in checkboxes (not the
   checkmark popularised by NeXT/OS X). We render the X. */

.aaron-checkbox,
.aaron-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  color: var(--aaron-colr-fg, #000);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
}

.aaron-checkbox > input,
.aaron-radio > input {
  /* Visually hidden but still focusable + a11y-discoverable.
     Sized + positioned over the chrome span so click/touch hit-area
     matches what the user sees. */
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  margin: 0;
  padding: 0;
  opacity: 0;
  cursor: default;
}

.aaron-checkbox__chrome,
.aaron-radio__chrome {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: var(--aaron-colr-control-bg, #fff);
  border: 1px solid var(--aaron-colr-window-frame, #5a5a5a);
  box-shadow: inset 1px 1px 0 rgba(0, 0, 0, 0.08);
  flex: 0 0 auto;
  position: relative;
  box-sizing: border-box;
}

.aaron-checkbox__chrome { border-radius: 2px; }
.aaron-radio__chrome    { border-radius: 50%; }

/* Checked checkbox: classic Mac X glyph (two crossed strokes) */
.aaron-checkbox > input:checked ~ .aaron-checkbox__chrome::before,
.aaron-checkbox > input:checked ~ .aaron-checkbox__chrome::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 1.5px;
  background: var(--aaron-colr-fg, #000);
}
.aaron-checkbox > input:checked ~ .aaron-checkbox__chrome::before {
  transform: translate(-50%, -50%) rotate(45deg);
}
.aaron-checkbox > input:checked ~ .aaron-checkbox__chrome::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

/* Checked radio: filled inner dot */
.aaron-radio > input:checked ~ .aaron-radio__chrome::after {
  content: "";
  position: absolute;
  inset: 2px;
  background: var(--aaron-colr-fg, #000);
  border-radius: 50%;
}

/* Focus ring on the chrome (since input itself is invisible) */
.aaron-checkbox > input:focus-visible ~ .aaron-checkbox__chrome,
.aaron-radio > input:focus-visible ~ .aaron-radio__chrome {
  outline: 2px solid var(--aaron-colr-accent, #316ac5);
  outline-offset: 1px;
}

/* Pressed state — native :active fires while mouse held down */
.aaron-checkbox:active .aaron-checkbox__chrome,
.aaron-radio:active .aaron-radio__chrome {
  background: var(--aaron-colr-button-pressed-bottom, #c0c0c0);
}

/* Disabled */
.aaron-checkbox[aria-disabled="true"],
.aaron-radio[aria-disabled="true"] {
  color: var(--aaron-colr-fg-disabled, rgba(0, 0, 0, 0.4));
  cursor: not-allowed;
}
.aaron-checkbox[aria-disabled="true"] .aaron-checkbox__chrome,
.aaron-radio[aria-disabled="true"] .aaron-radio__chrome {
  border-color: var(--aaron-colr-window-frame-disabled, #aaa);
  background: var(--aaron-colr-bg-disabled, #ececec);
  box-shadow: none;
}
.aaron-checkbox[aria-disabled="true"] > input:checked ~ .aaron-checkbox__chrome::before,
.aaron-checkbox[aria-disabled="true"] > input:checked ~ .aaron-checkbox__chrome::after,
.aaron-radio[aria-disabled="true"] > input:checked ~ .aaron-radio__chrome::after {
  background: var(--aaron-colr-fg-disabled, rgba(0, 0, 0, 0.4));
}

/* ─── Text fields (input + textarea) ───────────────────────────────── */
/* Same path as buttons / checkboxes (#71, #72): no field/frame cicn
   slugs in either canonical bundle. CSS-drawn inset bezel, palette-
   tinted. The native <input>/<textarea> is the focusable element —
   the wrapping span is purely visual.
   Period detail: classic Mac OS text fields had a 1px hairline border
   that thickened to 2px black on focus. We mimic via box-shadow rather
   than border to avoid layout reflow on focus. */

.aaron-field {
  display: inline-flex;
  align-items: stretch;
  background: var(--aaron-colr-control-bg, #fff);
  border: 1px solid var(--aaron-colr-window-frame, #5a5a5a);
  box-shadow: inset 1px 1px 0 rgba(0, 0, 0, 0.12);
  padding: 0;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  color: var(--aaron-colr-fg, #000);
  vertical-align: middle;
  box-sizing: border-box;
}

.aaron-field--block {
  display: flex;
  width: 100%;
}

.aaron-field > input,
.aaron-field > textarea {
  flex: 1 1 auto;
  margin: 0;
  padding: 2px 4px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  outline: 0;
  width: 100%;
  min-width: 0;
  resize: none;
}

.aaron-field > textarea {
  padding: 3px 4px;
  line-height: 1.4;
  resize: vertical;
}

/* Focus: thicker black inner ring (period Mac affordance, 1px → 2px) */
.aaron-field:focus-within {
  outline: 2px solid var(--aaron-colr-accent, #316ac5);
  outline-offset: 0;
}

/* Disabled */
.aaron-field[aria-disabled="true"] {
  background: var(--aaron-colr-bg-disabled, #ececec);
  color: var(--aaron-colr-fg-disabled, rgba(0, 0, 0, 0.4));
  border-color: var(--aaron-colr-window-frame-disabled, #aaa);
  box-shadow: none;
  cursor: not-allowed;
}
.aaron-field[aria-disabled="true"] > input,
.aaron-field[aria-disabled="true"] > textarea {
  cursor: not-allowed;
}

/* Read-only — visually distinct from disabled (slight tint, normal cursor) */
.aaron-field--readonly {
  background: var(--aaron-colr-bg, #f4f4f4);
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
