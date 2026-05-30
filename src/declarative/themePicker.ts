// Promote `<div data-scriptoscope-theme-picker>` into a folder-strip theme switcher.
// The library renders one tile per registered theme (with the scheme's authentic
// folder icon + name + author/year credit), wires the full ARIA tab pattern
// (role=tab, aria-selected, roving tabindex, Arrow/Home/End keyboard nav), and
// re-skins on every retheme. Clicking a tile calls handle.retheme(slug) so the
// rest of the page swaps to match.
//
// Replaces the 40+ lines of hand-rolled boot code every consumer was writing —
// see the 2026-05-30 demo-reviewer audit. The previous pattern bifurcated the
// API: declarative for chrome, imperative for the picker. This consolidates.
//
// Attributes on the host element:
//   data-scriptoscope-theme-picker         — opt-in marker
//   data-scriptoscope-theme-picker-icon    — named icon to render per tile
//                                              (default 'system-folder', falls
//                                               back to 'folder' if a scheme
//                                               doesn't ship the System Folder)
//   data-scriptoscope-theme-picker-icon-id — raw resource id (overrides named)
//
// Tile authoring: tiles are built from a `themes` array the consumer passes
// to mountDeclarative({ themes }) — same shape as the existing
// themes-manifest.json ({ slug, name, author?, year? }).

import type { LoadedTheme } from '../types.js';
import { ICON_NAMES } from './icon.js';

/** One theme as the picker needs it. Mirrors demo/themes-manifest.json's
 *  emitted shape (with `label` retained for back-compat for now). */
export interface PickerThemeEntry {
  slug: string;
  name?: string;
  author?: string;
  year?: number;
  label?: string; // back-compat: if name/author missing, this is parsed
}

/** What the picker needs to drive: a theme loader + a switcher. The scanner
 *  passes adapters that wrap its own resolver + handle.retheme. */
export interface PickerDeps {
  /** Load a theme by slug — used to harvest each scheme's folder icon for
   *  the tile. Same shape as the resolver's `load` method. */
  loadTheme(slug: string): Promise<LoadedTheme>;
  /** Switch the page to a scheme. Same shape as handle.retheme. */
  switchTheme(slug: string): Promise<void> | void;
  /** Initial active slug (highlights the matching tile + sets tabindex=0). */
  initialSlug: string;
}

/** Result returned by {@link promoteThemePicker} on successful promotion. */
export interface PromotedPicker {
  /** The host element, now populated with tiles. */
  el: HTMLElement;
  /** Teardown for SPA unmount: disconnects the IntersectionObserver so the
   *  observer no longer pins the (possibly already-removed) tile nodes,
   *  and clears the in-flight decode queue. Called by the scanner's
   *  `handle.disconnect()` in 2026-05-30's IO-leak fix. Safe to call
   *  multiple times. Lib reviewer P1. */
  teardown: () => void;
}

/** Promote a `<div data-scriptoscope-theme-picker>` into a folder-strip
 *  switcher. Idempotent (stamped via data-scriptoscope-theme-picker-promoted).
 *  Returns `{ el, teardown }` or null if the element was already promoted or
 *  themes is empty. */
export async function promoteThemePicker(
  el: HTMLElement, themes: readonly PickerThemeEntry[], deps: PickerDeps,
): Promise<PromotedPicker | null> {
  if (el.dataset.scriptoscopeThemePickerPromoted != null) return null;
  if (!themes.length) return null;
  el.dataset.scriptoscopeThemePickerPromoted = '';
  el.setAttribute('role', 'tablist');
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Theme picker');

  // Per-tile icon: default 'system-folder' → -3983 (the warm-beige System
  // Folder), fall back to 'folder' → -3999 if a scheme doesn't ship it.
  // Consumers override with data-scriptoscope-theme-picker-icon-id.
  const explicitIconId = el.dataset.scriptoscopeThemePickerIconId
    ? parseInt(el.dataset.scriptoscopeThemePickerIconId, 10)
    : undefined;
  const iconKey = el.dataset.scriptoscopeThemePickerIcon ?? 'system-folder';
  const primaryId = explicitIconId ?? ICON_NAMES[iconKey] ?? -3983;
  const fallbackId = -3999;

  // Build tiles synchronously (placeholders + structure); icons fill in
  // async so the strip appears immediately and progressively decodes.
  const tiles = new Map<string, HTMLButtonElement>();
  for (const t of themes) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'scriptoscope-theme-picker-tile';
    tile.dataset.slug = t.slug;
    tile.setAttribute('role', 'tab');
    tile.setAttribute('aria-selected', t.slug === deps.initialSlug ? 'true' : 'false');
    tile.setAttribute('tabindex', t.slug === deps.initialSlug ? '0' : '-1');
    tile.setAttribute('aria-label', `Switch to ${t.name ?? t.slug}`);
    // aria-busy: signal to assistive tech that the tile's content (its
    // folder icon) is still loading. Flipped to 'false' in the decode
    // success branch below when icon.src lands. Without this, screen-
    // reader users hear "tab, N of 18" with no indication that 17/18
    // are still arriving and the visual placeholder is undiscoverable.
    // A11y review 2026-05-30 A[P1].
    tile.setAttribute('aria-busy', 'true');
    if (t.slug === deps.initialSlug) tile.classList.add('active');
    // Author credit underneath the name — the Mac Themes Garden / Aaron-
    // About-box convention that surfaces the scheme author (the celebrities
    // of this scene). Two-line tile: name big, author/year small italic.
    const icon = document.createElement('img');
    icon.className = 'scriptoscope-theme-picker-icon';
    icon.alt = '';
    icon.width = 32; icon.height = 32;
    const name = document.createElement('span'); name.className = 'name'; name.textContent = t.name ?? t.slug;
    tile.append(icon, name);
    if (t.author) {
      const author = document.createElement('span'); author.className = 'author';
      author.textContent = t.year ? `${t.author}, ${t.year}` : t.author;
      tile.append(author);
    }
    tile.addEventListener('click', () => { void deps.switchTheme(t.slug); });
    el.appendChild(tile);
    tiles.set(t.slug, tile);
  }

  // Keyboard nav — the ARIA APG tablist pattern. Arrow/Home/End move focus +
  // activate the tile (consumers expect a single key to switch themes).
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    const all = [...el.querySelectorAll<HTMLButtonElement>('.scriptoscope-theme-picker-tile')];
    if (!all.length) return;
    const i = all.findIndex((t) => t === document.activeElement);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1 + all.length) % all.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + all.length) % all.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else return;
    e.preventDefault();
    const target = all[next];
    if (!target) return;
    target.focus();
    const slug = target.dataset.slug;
    if (slug) void deps.switchTheme(slug);
  });

  // Lazy icon decode (perf finding 2026-05-30 P0): the eager "all 18 in
  // parallel" preload was 6.7MB of background traffic + ~30s of main-thread
  // decode on mid-range mobile, mostly to fill 32×32 icons users never
  // looked at. Now we:
  //   1. Show a placeholder (CSS dotted outline — already in scriptoscope.css)
  //   2. Decode a tile's theme only when it intersects the viewport
  //   3. Decode-on-click as the synchronous fallback (intersection might
  //      not fire if the user tabs to the tile keyboard-only)
  // The active tile is decoded eagerly because its icon is the FIRST one
  // visible + it's already being loaded by the page-default mount.
  // Concurrency is capped at 2 and decodes yield via requestIdleCallback
  // between to keep the main thread responsive on mobile scrolling.
  const decoded = new Set<string>();
  let inFlight = 0;
  const queue: string[] = [];
  const drain = (): void => {
    while (inFlight < 2 && queue.length) {
      const slug = queue.shift();
      if (!slug || decoded.has(slug)) continue;
      decoded.add(slug);
      inFlight += 1;
      void (async () => {
        try {
          const theme = await deps.loadTheme(slug);
          const idx = theme.inspector?.iconIndex ?? [];
          const pick = (id: number) => idx.find((i) => i.id === id && i.size === 32) ?? idx.find((i) => i.id === id);
          const hit = pick(primaryId) ?? pick(fallbackId);
          if (hit?.url) {
            const tile = tiles.get(slug);
            const icon = tile?.querySelector<HTMLImageElement>('.scriptoscope-theme-picker-icon');
            if (icon) icon.src = hit.url;
            // Icon arrived → drop aria-busy so AT announces the tile as
            // settled. Stays set to 'true' if no icon was found (the
            // dotted-outline placeholder remains; that IS the correct
            // state to communicate).
            tile?.setAttribute('aria-busy', 'false');
          }
        } catch { /* tolerate per-theme failures */ } finally {
          inFlight -= 1;
          // Yield to the main thread between decodes — requestIdleCallback
          // when available (Chrome/Firefox), setTimeout fallback (Safari).
          const yieldFn: (cb: () => void) => void =
            typeof requestIdleCallback === 'function'
              ? (cb) => { requestIdleCallback(cb); }
              : (cb) => { setTimeout(cb, 0); };
          yieldFn(drain);
        }
      })();
    }
  };
  const requestDecode = (slug: string): void => {
    if (decoded.has(slug)) return;
    if (!queue.includes(slug)) queue.push(slug);
    drain();
  };
  // The active tile: decode eagerly. Its theme is the page default + the
  // first icon a user will see; it's also already being loaded by mount.
  if (deps.initialSlug) requestDecode(deps.initialSlug);
  // The other 17: decode on intersection (tile scrolls into view) OR on
  // click (keyboard nav / direct interaction). IntersectionObserver is
  // ubiquitous (Chrome 51+, Firefox 55+, Safari 12.1+).
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const slug = (entry.target as HTMLButtonElement).dataset.slug;
        if (slug) requestDecode(slug);
        io?.unobserve(entry.target); // one-shot per tile
      }
    }, { rootMargin: '50px' }); // start the decode shortly before tile enters
    for (const tile of tiles.values()) io.observe(tile);
  } else {
    // No IntersectionObserver (very old browsers) — decode on hover/focus
    // instead of preloading everything.
    for (const [slug, tile] of tiles) {
      tile.addEventListener('mouseenter', () => requestDecode(slug), { once: true });
      tile.addEventListener('focus', () => requestDecode(slug), { once: true });
    }
  }
  // Click is the universal fallback — even with IntersectionObserver, a
  // user might tab to a tile keyboard-only (no hover) and click before
  // the IO fires. switchTheme already calls deps.loadTheme so the icon
  // resolves through the cache; this just ensures the tile's icon paints.
  for (const [slug, tile] of tiles) {
    tile.addEventListener('click', () => requestDecode(slug));
  }

  // Teardown closure: SPA unmount path. IO disconnect releases the
  // tile-node refs the observer held (in a long-lived SPA where mount/
  // unmount cycles, each cycle leaked one IO + N tiles before this).
  // Clearing the queue drops any in-flight decodes still pending — the
  // already-fired async decode IIFEs will run to completion harmlessly
  // because the DOM nodes they target may be gone; the `if (icon)` and
  // `tile?.` guards inside drain() already handle that case. Idempotent.
  const teardown = (): void => {
    if (io) { io.disconnect(); io = null; }
    queue.length = 0;
  };
  return { el, teardown };
}

/** Sync the picker's active state when a retheme happened elsewhere (e.g. via
 *  handle.retheme(slug) from a different control). Called by the scanner's
 *  retheme cascade so all promoted pickers stay in lockstep. */
export function syncThemePickerActive(el: HTMLElement, slug: string): void {
  for (const tile of el.querySelectorAll<HTMLButtonElement>('.scriptoscope-theme-picker-tile')) {
    const isActive = tile.dataset.slug === slug;
    tile.classList.toggle('active', isActive);
    tile.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tile.setAttribute('tabindex', isActive ? '0' : '-1');
  }
}
