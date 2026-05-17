// Apply a parsed ChromeElementEntry as inline CSS on a DOM element.
//
// Phase 4.6/4.7 renderer primitive: given a `chromeElements[<slug>]` entry
// from a loaded Theme, produce the background-image + cinf-derived
// border-image + (Phase 4.7) ppat overlay rules that make the element
// render with that scheme's chrome bitmap.
//
// Inline styles, not constructable stylesheets. The architecture doc's
// stylesheet-per-theme strategy is for engine-baseline CSS (where many
// elements share one rule); per-element chrome is per-element by nature —
// duplicating the rules as inline style is simpler than maintaining a
// generated stylesheet that mirrors the DOM. If a future profiling pass
// shows the inline-style approach is slow, we can hoist common rules then;
// don't optimize without measurement.

import type { ChromeElementEntry, Theme } from '../schema/types.js';

export interface ApplyChromeElementOptions {
  /**
   * Override how the cicn middle stretches when the chrome doesn't supply
   * cinf data. Default 'stretch' for static chrome; periodic patterns can
   * be forced to 'repeat'. Ignored if `entry.slice` is provided (cinf wins).
   */
  defaultRepeat?: 'stretch' | 'repeat';
  /**
   * Loaded Theme for resolving `entry.bgPattern` slugs to ppat URLs. When
   * omitted, `bgPattern` is silently ignored — the chrome renders cicn-only.
   * Pass the same Theme that owns the entry.
   */
  theme?: Theme;
}

/**
 * Apply a ChromeElementEntry as inline CSS on `el`.
 *
 * Always sets `image-rendering: pixelated`.
 *
 * The rendering branches by combination of `slice`, `tile`, and `bgPattern`:
 *
 * | slice | bgPattern | Rendering |
 * |-------|-----------|-----------|
 * | yes   | yes       | border-image (no fill) + background-image = ppat tile filling the middle |
 * | yes   | no        | border-image (with fill) for the whole chrome; background-image = cicn as fallback |
 * | no    | yes       | Multi-layer background-image: ppat on top, cicn beneath (no border-image) |
 * | no    | no, tile  | background-image = cicn, background-repeat per `tile` direction |
 * | no    | no, none  | background-image = cicn, no-repeat, optional background-size from width/height |
 *
 * `bgPattern` is resolved against `options.theme.patterns[<slug>].asset`. When
 * `options.theme` is not provided, `bgPattern` is silently ignored.
 *
 * Reads neither part-rect data (that's #42) nor handles control state
 * variants (those flip by attribute selector at a higher layer).
 *
 * Idempotent: re-applying the same (entry, options) yields the same styles.
 */
export function applyChromeElement(
  el: HTMLElement,
  entry: ChromeElementEntry,
  options: ApplyChromeElementOptions = {},
): void {
  const cicnUrl = cssUrl(entry.asset);
  const pattern = resolveBgPattern(entry, options.theme);

  el.style.imageRendering = 'pixelated';

  if (entry.slice != null) {
    const { corner, side, tile } = entry.slice;
    el.style.borderImageSource = cicnUrl;
    // With bgPattern: drop `fill` so the cicn middle is left empty, and
    // background-image (ppat tile) fills it. Without bgPattern: keep `fill`
    // so the cicn middle draws as part of the border-image.
    el.style.borderImageSlice = pattern
      ? `${corner}`
      : `${corner} fill`;
    el.style.borderImageWidth = `${side}px`;
    el.style.borderImageRepeat = tile ? 'repeat' : 'stretch';
    el.style.borderStyle = 'solid';
    el.style.borderWidth = `${side}px`;
    el.style.borderColor = 'transparent';

    if (pattern) {
      el.style.backgroundImage = cssUrl(pattern.asset);
      el.style.backgroundRepeat = repeatForPattern(pattern.repeat);
    } else {
      el.style.backgroundImage = cicnUrl;
      el.style.backgroundRepeat = 'no-repeat';
    }
    return;
  }

  // No slice path.

  if (pattern) {
    // Multi-layer background-image: ppat tile drawn first (= top of stack),
    // cicn beneath. CSS background-image renders layers in source order,
    // first = top. Matches the architecture doc §6 example.
    el.style.backgroundImage = `${cssUrl(pattern.asset)}, ${cicnUrl}`;
    el.style.backgroundRepeat = `${repeatForPattern(pattern.repeat)}, no-repeat`;
    return;
  }

  el.style.backgroundImage = cicnUrl;
  if (entry.tile != null) {
    el.style.backgroundRepeat = repeatForTile(entry.tile);
    return;
  }
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
  const cicnUrl = cssUrl(entry.asset);
  const pattern = resolveBgPattern(entry, options.theme);
  const decls: string[] = [`image-rendering: pixelated`];

  if (entry.slice != null) {
    const { corner, side, tile } = entry.slice;
    decls.push(
      `border-image-source: ${cicnUrl}`,
      `border-image-slice: ${corner}${pattern ? '' : ' fill'}`,
      `border-image-width: ${side}px`,
      `border-image-repeat: ${tile ? 'repeat' : 'stretch'}`,
      `border-style: solid`,
      `border-width: ${side}px`,
      `border-color: transparent`,
    );
    if (pattern) {
      decls.push(
        `background-image: ${cssUrl(pattern.asset)}`,
        `background-repeat: ${repeatForPattern(pattern.repeat)}`,
      );
    } else {
      decls.push(`background-image: ${cicnUrl}`, `background-repeat: no-repeat`);
    }
  } else if (pattern) {
    decls.push(
      `background-image: ${cssUrl(pattern.asset)}, ${cicnUrl}`,
      `background-repeat: ${repeatForPattern(pattern.repeat)}, no-repeat`,
    );
  } else {
    decls.push(`background-image: ${cicnUrl}`);
    if (entry.tile != null) {
      decls.push(`background-repeat: ${repeatForTile(entry.tile)}`);
    } else {
      decls.push(
        `background-repeat: ${options.defaultRepeat === 'repeat' ? 'repeat' : 'no-repeat'}`,
      );
      if (entry.width != null && entry.height != null) {
        decls.push(`background-size: ${entry.width}px ${entry.height}px`);
      }
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

function resolveBgPattern(entry: ChromeElementEntry, theme: Theme | undefined) {
  if (entry.bgPattern == null) return null;
  if (!theme?.patterns) return null;
  return theme.patterns[entry.bgPattern] ?? null;
}

function cssUrl(asset: string): string {
  const escaped = asset.replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

function repeatForTile(tile: 'horizontal' | 'vertical' | 'both'): string {
  return tile === 'horizontal' ? 'repeat-x'
       : tile === 'vertical'   ? 'repeat-y'
       : 'repeat';
}

function repeatForPattern(repeat: 'horizontal' | 'vertical' | 'both' | undefined): string {
  if (repeat === 'horizontal') return 'repeat-x';
  if (repeat === 'vertical')   return 'repeat-y';
  return 'repeat'; // default 'both' (or unspecified)
}
