// Themed text-field chrome for native <input type=text|email|password|number|tel|url|
// search|date|time> and <textarea>. Closes #73.
//
// Why CSS-derived and not cicn-rendered: no scheme in the corpus ships text-field cicns.
// Kaleidoscope themed the chrome (windows, buttons, scrollbars, sliders) but left text
// fields OS-baseline (Mac OS Appearance drew the sunken bevel procedurally). The faithful
// answer is the same — render the period-correct 1px sunken bevel via CSS over the native
// input, keeping selection/IME/autofill/password-masking/screen-reader all intact.
//
// The scanner is OPT-IN via [data-scriptoscope-field] (not auto-scan over every text input the way
// [data-scriptoscope-control] is for checkbox/radio/range). The decision: text-field styling can
// VISUALLY conflict with the consumer's existing stylesheet (a CMS may already paint inputs
// a specific way), where checkbox/radio overlays are positioned art that compose cleanly.
// Opt-in keeps the surprise surface small.

import type { LoadedTheme } from '../types.js';
import { debug } from '../debug.js';

/** The input types we'll style. Excludes the ones already handled by data-scriptoscope-control
 *  (checkbox/radio/range) and the ones we shouldn't touch (file/submit/reset/button/color/
 *  hidden/image — file picker has its own dialog, submit/reset/button are buttons-not-fields,
 *  color is an OS picker, hidden is invisible, image is a picture button). */
const TEXT_TYPES = new Set([
  'text', 'email', 'password', 'number', 'tel', 'url', 'search',
  'date', 'time', 'datetime-local', 'month', 'week',
]);

const FIELD_STYLE_ID = 'scriptoscope-field-css';

/** Inject the field-chrome stylesheet once per document. Period-correct Mac OS 8 sunken
 *  bevel: 1px outer border (#888 top/left = shadow, #fff bottom/right = highlight) with a
 *  thin inset shadow underline so the inside of the field looks "sunk into" the surface.
 *  The native input keeps its own font/value/keyboard; only the box around it is themed. */
function ensureFieldCSS(): void {
  if (document.getElementById(FIELD_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FIELD_STYLE_ID;
  // The bevel is two 1px lines in opposing directions (top-left dark, bottom-right light) —
  // a classic Appearance-Manager engraved-inward inset. Box-shadow inset adds the secondary
  // shadow line so the bevel reads as 2px deep without bloating the border itself.
  // Selector specificity note: consumer CSS like `.someform input[type=text]` (0,2,1)
  // would beat a bare `.scriptoscope-field` (0,1,0) and erase the bevel. We bind to the
  // tag + class + promotion-stamp attribute (0,2,1) to match consumer specificity, then
  // win on source order — Aaron's stylesheet is injected after the consumer's. The
  // `--scriptoscope-focus-color` custom property lets consumers override the focus ring without
  // touching the bevel.
  style.textContent = `
    input.scriptoscope-field[data-scriptoscope-field-promoted],
    textarea.scriptoscope-field[data-scriptoscope-field-promoted] {
      font: inherit; color: #1c1c1c; background: #ffffff;
      border-style: solid; border-width: 1px;
      border-top-color: #888; border-left-color: #888;
      border-bottom-color: #ffffff; border-right-color: #ffffff;
      border-radius: 0;
      padding: 2px 4px; box-sizing: border-box;
      box-shadow: inset 1px 1px 0 #555, inset -1px -1px 0 #e6e6e6;
      outline: none;
    }
    input.scriptoscope-field[data-scriptoscope-field-promoted]:focus,
    input.scriptoscope-field[data-scriptoscope-field-promoted]:focus-visible,
    textarea.scriptoscope-field[data-scriptoscope-field-promoted]:focus,
    textarea.scriptoscope-field[data-scriptoscope-field-promoted]:focus-visible {
      box-shadow:
        inset 1px 1px 0 #555, inset -1px -1px 0 #e6e6e6,
        0 0 0 2px var(--scriptoscope-focus-color, #2b5070);
    }
    input.scriptoscope-field[data-scriptoscope-field-promoted]:disabled,
    input.scriptoscope-field[data-scriptoscope-field-promoted][aria-disabled="true"],
    textarea.scriptoscope-field[data-scriptoscope-field-promoted]:disabled,
    textarea.scriptoscope-field[data-scriptoscope-field-promoted][aria-disabled="true"] {
      background: #ececec; color: #888;
      box-shadow: none;
      border-color: #b0b0b0;
    }
    textarea.scriptoscope-field[data-scriptoscope-field-promoted] { resize: vertical; line-height: 1.35; }
  `;
  document.head.append(style);
}

/** Returns true if the element is a field type we should style. */
export function isFieldEligible(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
  return TEXT_TYPES.has(type);
}

/** Apply themed field chrome to a native <input>/<textarea>. The element itself is kept in
 *  place — only its class + a one-time stylesheet are added, so form value / focus / IME /
 *  autofill / password masking / screen-reader semantics all stay native.
 *
 *  Idempotent — re-promoting a promoted element is a no-op (the dataset stamp guards). Used
 *  this way the scanner can resync on theme switch without thrashing the DOM. */
export function promoteField(el: HTMLInputElement | HTMLTextAreaElement, _theme: LoadedTheme): void {
  if (el.dataset.scriptoscopeFieldPromoted != null) return;
  if (!isFieldEligible(el)) return;
  ensureFieldCSS();
  el.classList.add('scriptoscope-field');
  el.dataset.scriptoscopeFieldPromoted = '';
  // Mirror aria-disabled for AT consistency when the disabled attribute is dynamically toggled
  // (the CSS selector covers the static case; this side handles consumers that prefer aria).
  if (el.disabled) el.setAttribute('aria-disabled', 'true');
  const tag = el.tagName.toLowerCase();
  const typeSuffix = tag === 'input' ? `[type=${(el as HTMLInputElement).type ?? 'text'}]` : '';
  debug('promote', `field: ${tag}${typeSuffix}`);
}
