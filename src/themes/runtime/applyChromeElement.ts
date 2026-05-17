// Apply a parsed ChromeElementEntry as inline CSS on a DOM element.
//
// This is Phase 4.6's renderer primitive: given a `chromeElements[<slug>]`
// entry from a loaded Theme, produce the background-image + cinf-derived
// border-image rules that make the element render with that scheme's chrome
// bitmap.
//
// Inline styles, not constructable stylesheets. The architecture doc's
// stylesheet-per-theme strategy is for engine-baseline CSS (where many
// elements share one rule); per-element chrome is per-element by nature —
// duplicating the rules as inline style is simpler than maintaining a
// generated stylesheet that mirrors the DOM. If a future profiling pass
// shows the inline-style approach is slow, we can hoist common rules then;
// don't optimize without measurement.

import type { ChromeElementEntry } from '../schema/types.js';

export interface ApplyChromeElementOptions {
  /**
   * Override how the cicn middle stretches when the chrome doesn't supply
   * cinf data. Default 'stretch' for static chrome; periodic patterns can
   * be forced to 'repeat'. Ignored if `entry.slice` is provided (cinf wins).
   */
  defaultRepeat?: 'stretch' | 'repeat';
}

/**
 * Apply a ChromeElementEntry as inline CSS on `el`.
 *
 * Always sets:
 *   - background-image (the cicn URL)
 *   - image-rendering: pixelated (preserve hard pixels at any scale)
 *
 * When `entry.slice` is present (cicn has cinf 9-slice metadata):
 *   - border-image-source / border-image-slice / border-image-width / border-image-repeat
 *   - border-style: solid, border-width, transparent border-color so the
 *     border-image has somewhere to render
 *
 * When `entry.tile` is set (periodic pattern):
 *   - background-repeat per the declared direction
 *
 * When neither slice nor tile is given:
 *   - background-repeat: no-repeat (single bitmap, scaled to box via
 *     background-size if `entry.width/height` are present, else natural size)
 *
 * Reads neither `entry.bgPattern` (that's #41) nor part-rect data (that's #42).
 *
 * Idempotent: re-applying the same entry yields the same styles.
 */
export function applyChromeElement(
  el: HTMLElement,
  entry: ChromeElementEntry,
  options: ApplyChromeElementOptions = {},
): void {
  const url = cssUrl(entry.asset);

  // Always: background-image + crisp pixel rendering.
  el.style.backgroundImage = url;
  el.style.imageRendering = 'pixelated';

  if (entry.slice != null) {
    // cinf 9-slice path. Decoded cinf carries cornerSize + sideThickness +
    // tileSides flag. CSS:
    //   border-image-slice: <corner> fill   — fill keeps the middle drawn
    //   border-image-width: <side>px        — outer-edge width
    //   border-image-repeat: stretch|repeat — from cinf.tileSides
    // Plus a transparent solid border so the border-image has a box to draw.
    const { corner, side, tile } = entry.slice;
    el.style.borderImageSource = url;
    el.style.borderImageSlice = `${corner} fill`;
    el.style.borderImageWidth = `${side}px`;
    el.style.borderImageRepeat = tile ? 'repeat' : 'stretch';
    el.style.borderStyle = 'solid';
    el.style.borderWidth = `${side}px`;
    el.style.borderColor = 'transparent';
    el.style.backgroundRepeat = 'no-repeat';
    return;
  }

  if (entry.tile != null) {
    el.style.backgroundRepeat = repeatForTile(entry.tile);
    return;
  }

  // Static single bitmap.
  el.style.backgroundRepeat = options.defaultRepeat === 'repeat' ? 'repeat' : 'no-repeat';
  if (entry.width != null && entry.height != null) {
    el.style.backgroundSize = `${entry.width}px ${entry.height}px`;
  }
}

/**
 * Build the CSS text equivalent of {@link applyChromeElement} without touching
 * the DOM. Useful for static stylesheet generation or test snapshots.
 *
 * Returns property:value lines separated by `;`, no surrounding selector.
 */
export function chromeElementCss(
  entry: ChromeElementEntry,
  options: ApplyChromeElementOptions = {},
): string {
  const url = cssUrl(entry.asset);
  const decls: string[] = [
    `background-image: ${url}`,
    `image-rendering: pixelated`,
  ];

  if (entry.slice != null) {
    const { corner, side, tile } = entry.slice;
    decls.push(
      `border-image-source: ${url}`,
      `border-image-slice: ${corner} fill`,
      `border-image-width: ${side}px`,
      `border-image-repeat: ${tile ? 'repeat' : 'stretch'}`,
      `border-style: solid`,
      `border-width: ${side}px`,
      `border-color: transparent`,
      `background-repeat: no-repeat`,
    );
  } else if (entry.tile != null) {
    decls.push(`background-repeat: ${repeatForTile(entry.tile)}`);
  } else {
    decls.push(`background-repeat: ${options.defaultRepeat === 'repeat' ? 'repeat' : 'no-repeat'}`);
    if (entry.width != null && entry.height != null) {
      decls.push(`background-size: ${entry.width}px ${entry.height}px`);
    }
  }

  return decls.join('; ') + ';';
}

/**
 * Remove all styles applied by {@link applyChromeElement} from `el`.
 *
 * Useful for theme swap: tear down the old theme's chrome before applying the
 * new. Idempotent.
 */
export function clearChromeElement(el: HTMLElement): void {
  for (const prop of [
    'backgroundImage',
    'backgroundRepeat',
    'backgroundSize',
    'imageRendering',
    'borderImageSource',
    'borderImageSlice',
    'borderImageWidth',
    'borderImageRepeat',
    'borderStyle',
    'borderWidth',
    'borderColor',
  ] as const) {
    el.style[prop] = '';
  }
}

// ─── Internals ─────────────────────────────────────────────────────────

function cssUrl(asset: string): string {
  // Escape double quotes inside URLs (rare, but the asset path is user-supplied).
  const escaped = asset.replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

function repeatForTile(tile: 'horizontal' | 'vertical' | 'both'): string {
  return tile === 'horizontal' ? 'repeat-x'
       : tile === 'vertical'   ? 'repeat-y'
       : 'repeat';
}
