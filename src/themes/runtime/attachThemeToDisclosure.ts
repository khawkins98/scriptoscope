// Cicn-driven chrome for disclosure triangles — spec B §4.6.
//
// Each scheme that ships disclosure artwork provides 6 cicns: 3 states
// (active / pressed / inactive) × 2 facings (right / down). When present,
// paint the glyph from the cicn; otherwise leave the engine-baseline CSS
// triangle.
//
// Slug convention (note: the bundled extractor has a "tringle" typo for
// one variant; we handle both spellings):
//   {right|down}-pointing-disclosure-triangle              normal active
//   inactive-{right|down}-pointing-disclosure-tri[an]gle   disabled
//   pressed-{right|down}-pointing-disclosure-triangle      pressed

import { themeRegistry } from './ThemeRegistry.js';
import type { Theme } from '../schema/types.js';

type RuntimeState = 'active' | 'pressed' | 'inactive';
type Facing = 'right' | 'down';

const CICN_LOADED_ATTR = 'data-aaron-cicn-loaded';

export interface AttachThemeToDisclosureOptions {
  /** The `<span>` that receives the cicn background. */
  glyphEl: HTMLSpanElement;
  /** The disclosure `<button>` — read for `data-state`, `data-facing`,
   *  `disabled`. */
  button: HTMLButtonElement;
}

/**
 * Wire a disclosure glyph span to the active theme. Subscribes to
 * `themeRegistry` + observes the button's `data-state`, `data-facing`,
 * and `disabled` attributes. Re-paints on every relevant change.
 *
 * Returns a teardown function.
 */
export function attachThemeToDisclosure(
  options: AttachThemeToDisclosureOptions,
): () => void {
  const { glyphEl, button } = options;

  const render = () => paintCicn(themeRegistry.current(), glyphEl, button);
  render();

  const unsubTheme = themeRegistry.subscribe(render);

  const observer = new MutationObserver(render);
  observer.observe(button, {
    attributes: true,
    attributeFilter: ['data-state', 'data-facing', 'disabled', 'aria-disabled'],
  });

  return () => {
    unsubTheme();
    observer.disconnect();
    clearChrome(glyphEl);
  };
}

// ─── Internals ─────────────────────────────────────────────────────────

function paintCicn(theme: Theme | null, glyphEl: HTMLSpanElement, button: HTMLButtonElement): void {
  const catalog = theme?.chromeElements;
  if (!catalog) {
    clearChrome(glyphEl);
    return;
  }

  const facing = (button.getAttribute('data-facing') as Facing | null) ?? 'right';
  const state = readRuntimeState(button);
  const slugs = candidateSlugs(facing, state);

  for (const slug of slugs) {
    const entry = catalog[slug];
    if (entry?.asset) {
      applyEntry(glyphEl, entry.asset, entry.width, entry.height);
      return;
    }
  }
  clearChrome(glyphEl);
}

function candidateSlugs(facing: Facing, state: RuntimeState): string[] {
  // Handle the "tringle" typo by trying both spellings, prefer correct.
  const baseCorrect = `${facing}-pointing-disclosure-triangle`;
  const baseTypo = `${facing}-pointing-disclosure-tringle`;
  if (state === 'active') return [baseCorrect, baseTypo];
  if (state === 'pressed') return [`pressed-${baseCorrect}`, `pressed-${baseTypo}`, baseCorrect];
  return [`inactive-${baseCorrect}`, `inactive-${baseTypo}`, baseCorrect];
}

function readRuntimeState(button: HTMLButtonElement): RuntimeState {
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return 'inactive';
  if (button.getAttribute('data-state') === 'pressed') return 'pressed';
  return 'active';
}

function applyEntry(
  glyphEl: HTMLSpanElement,
  asset: string,
  width: number | undefined,
  height: number | undefined,
): void {
  glyphEl.style.backgroundImage = `url("${asset.replace(/"/g, '\\"')}")`;
  glyphEl.style.backgroundRepeat = 'no-repeat';
  glyphEl.style.backgroundPosition = 'center';
  if (width && height) {
    glyphEl.style.backgroundSize = `${width}px ${height}px`;
    glyphEl.style.minWidth = `${width}px`;
    glyphEl.style.minHeight = `${height}px`;
  }
  glyphEl.style.imageRendering = 'pixelated';
  glyphEl.setAttribute(CICN_LOADED_ATTR, '');
}

function clearChrome(glyphEl: HTMLSpanElement): void {
  glyphEl.style.backgroundImage = '';
  glyphEl.style.backgroundSize = '';
  glyphEl.style.backgroundRepeat = '';
  glyphEl.style.backgroundPosition = '';
  glyphEl.style.imageRendering = '';
  glyphEl.style.minWidth = '';
  glyphEl.style.minHeight = '';
  glyphEl.removeAttribute(CICN_LOADED_ATTR);
}
