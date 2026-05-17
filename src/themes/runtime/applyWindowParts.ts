// Convert wnd#-derived part rects into absolutely-positioned hit-target
// overlays inside a chrome container.
//
// Phase 4.8 renderer primitive. Given a WindowTypeEntry from a parsed Theme
// and the chrome cicn's native pixel dimensions, this helper mounts one
// invisible <div> per part, positioned as a percentage of the container so
// the overlays reflow with the chrome under standard resize.
//
// Why percent-positioned: cicn chrome is rendered via border-image, which
// stretches to fill the box. The part rects are in chrome-cicn pixel
// coordinates; dividing by the cicn's native size gives a unit-free
// position that holds at any rendered scale.
//
// What this DOESN'T do (deliberately scoped to #42):
// - Attach event listeners. The caller decides which parts dispatch
//   close()/maximize()/minimize() and wires it up. The future per-window
//   applier (post-#42) is where that wiring lives.
// - Reason about per-scheme semantic part IDs. wnd# part numbers are
//   scheme-relative (LEARNINGS 2026-05-17 "wnd# part IDs are scheme-relative
//   integers, not a stable semantic enum"). This helper emits parts as
//   data-part="part-<n>" preserving the raw integer; semantic naming is a
//   higher layer's concern.

import type { WindowTypeEntry } from '../schema/types.js';

/**
 * Sentinel attribute marking divs created by this helper, so clearWindowParts
 * can selectively remove them without touching other children of the chrome
 * container.
 */
const PARTS_OWNER_ATTR = 'data-aaron-window-part' as const;

export interface ApplyWindowPartsOptions {
  /** Native pixel width of the chrome cicn (required for percent conversion). */
  chromeWidth: number;
  /** Native pixel height of the chrome cicn. */
  chromeHeight: number;
  /**
   * Accessibility treatment for the mounted divs.
   * - `'hidden'` (default): `aria-hidden="true"` on each part — assumes the
   *   real interactive elements (close/zoom buttons) live elsewhere in the
   *   DOM with proper labels.
   * - `'button'`: each part gets `role="button"` and `tabindex="0"`. Only
   *   pick this if these are the only interactive elements for the part.
   */
  aria?: 'hidden' | 'button';
  /**
   * When set, each part renders a crisp slice of this cicn at the part's
   * rect — useful for control glyphs (close/zoom/windowshade) that would
   * otherwise visually stretch with the titlebar's background. The slice
   * is positioned via `background-position`, sized to the part's native
   * pixel rect (not the percentage), and stays crisp at any titlebar
   * width.
   *
   * Without this, parts are transparent hit-target overlays (the prior
   * behaviour, still used for non-glyph parts).
   */
  glyphCicnUrl?: string;
}

export interface WindowPartInfo {
  /** Part slug from the bundle, e.g. `"part-1"`. */
  partSlug: string;
  /** Mounted overlay div. Caller can attach event listeners. */
  el: HTMLElement;
}

/**
 * Mount one invisible div per `windowType.parts` entry inside `container`.
 *
 * Replaces any prior part divs created by a previous call (looks them up via
 * the `data-aaron-window-part` sentinel attribute) so the helper is
 * idempotent — re-applying yields the same DOM.
 *
 * Returns an array of `{partSlug, el}` so the caller can wire up event
 * listeners per part without having to query the DOM.
 *
 * @example
 * const parts = applyWindowParts(titlebarEl, theme.windowTypes['document-window'], {
 *   chromeWidth: 74, chromeHeight: 25,
 * });
 * for (const {partSlug, el} of parts) {
 *   if (partSlug === 'part-1') el.addEventListener('click', () => win.close());
 *   if (partSlug === 'part-2') el.addEventListener('click', () => win.maximize());
 * }
 */
export function applyWindowParts(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ApplyWindowPartsOptions,
): WindowPartInfo[] {
  clearWindowParts(container);

  const parts = windowType.parts;
  if (!parts) return [];

  const { chromeWidth, chromeHeight, aria = 'hidden' } = options;
  if (chromeWidth <= 0 || chromeHeight <= 0) {
    throw new Error(
      `applyWindowParts: chromeWidth and chromeHeight must be positive (got ${chromeWidth}, ${chromeHeight})`,
    );
  }

  const mounted: WindowPartInfo[] = [];
  for (const [partSlug, partEntry] of Object.entries(parts)) {
    const [left, top, right, bottom] = partEntry.rect;
    const widthPx = right - left;
    const heightPx = bottom - top;

    const el = container.ownerDocument.createElement('div');
    el.setAttribute(PARTS_OWNER_ATTR, partSlug);
    el.setAttribute('data-part', partSlug);
    el.setAttribute('data-state', 'normal');
    if (aria === 'hidden') {
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
    }
    el.style.position = 'absolute';

    if (options.glyphCicnUrl) {
      // Crisp-glyph mode: position at the rect's % location but size in
      // native pixels (so close/zoom/windowshade don't stretch with the
      // titlebar). background-position negative offset crops the cicn
      // down to just this part's pixel region.
      el.style.left = pct(left, chromeWidth);
      el.style.top = pct(top, chromeHeight);
      el.style.width = `${widthPx}px`;
      el.style.height = `${heightPx}px`;
      el.style.backgroundImage = `url("${options.glyphCicnUrl.replace(/"/g, '\\"')}")`;
      el.style.backgroundPosition = `-${left}px -${top}px`;
      el.style.backgroundSize = `${chromeWidth}px ${chromeHeight}px`;
      el.style.backgroundRepeat = 'no-repeat';
      el.style.imageRendering = 'pixelated';
    } else {
      // Transparent hit-target mode (original behaviour).
      el.style.left = pct(left, chromeWidth);
      el.style.top = pct(top, chromeHeight);
      el.style.width = pct(widthPx, chromeWidth);
      el.style.height = pct(heightPx, chromeHeight);
    }

    container.appendChild(el);
    mounted.push({ partSlug, el });
  }
  return mounted;
}

/**
 * Remove every part div mounted by {@link applyWindowParts} from `container`.
 * Leaves other children alone. Idempotent.
 */
export function clearWindowParts(container: HTMLElement): void {
  const existing = container.querySelectorAll(`[${PARTS_OWNER_ATTR}]`);
  for (const el of Array.from(existing)) {
    el.parentNode?.removeChild(el);
  }
}

/**
 * Compute the percentage-positioned styles a part would receive, without
 * touching the DOM. Useful for static stylesheet generation or test snapshots.
 *
 * Returns one record per part slug.
 */
export function windowPartsCss(
  windowType: WindowTypeEntry,
  options: Pick<ApplyWindowPartsOptions, 'chromeWidth' | 'chromeHeight'>,
): Record<string, { left: string; top: string; width: string; height: string }> {
  const parts = windowType.parts;
  if (!parts) return {};
  const { chromeWidth, chromeHeight } = options;
  if (chromeWidth <= 0 || chromeHeight <= 0) {
    throw new Error(
      `windowPartsCss: chromeWidth and chromeHeight must be positive (got ${chromeWidth}, ${chromeHeight})`,
    );
  }
  const out: Record<string, { left: string; top: string; width: string; height: string }> = {};
  for (const [partSlug, partEntry] of Object.entries(parts)) {
    const [left, top, right, bottom] = partEntry.rect;
    out[partSlug] = {
      left: pct(left, chromeWidth),
      top: pct(top, chromeHeight),
      width: pct(right - left, chromeWidth),
      height: pct(bottom - top, chromeHeight),
    };
  }
  return out;
}

function pct(numerator: number, denominator: number): string {
  // Round to 4 decimal places (sub-pixel precision at typical chrome sizes),
  // then strip trailing zeros via Number coercion so "20.0000" emits as "20"
  // — keeps the inline-style attribute compact and matches what jsdom's CSSOM
  // returns when reading the value back.
  const value = (numerator / denominator) * 100;
  return `${Number(value.toFixed(4))}%`;
}
