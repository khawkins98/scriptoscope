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

import { themeView, type ThemeInput, type ThemeView } from '../ownedTheme.js';
import type { ThemeEntry } from './theme.js';
import { resolveInChain } from '../baseChain.js';
import { listenUntilAborted } from '../listenUntilAborted.js';
import { ICON_NAMES } from './icon.js';
import { OwnedMutations } from './restoration.js';

/** @deprecated 2026-05-30 — use {@link ThemeEntry} from `./theme.js` (now
 *  the single shape both the loader and the picker consume). Kept as a
 *  type alias so consumer imports still resolve through one release. */
export type PickerThemeEntry = ThemeEntry;

/** What the picker needs to drive: a theme loader + a switcher. The scanner
 *  passes adapters that wrap its own resolver + handle.retheme. */
export interface PickerDeps {
  /** Load a theme by slug — used to harvest each scheme's folder icon for
   *  the tile. Same shape as the resolver's `load` method. */
  loadTheme(slug: string): Promise<ThemeInput>;
  /** Optional folder-only decoder. Other tiles avoid full theme conversion. */
  loadIcon?(slug: string, primaryId: number, fallbackId: number): Promise<string | null>;
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
   *  removes event listeners, and clears the pending decode queue. Called by the scanner's
   *  `handle.disconnect()` in 2026-05-30's IO-leak fix. Safe to call
   *  multiple times. Lib reviewer P1. */
  teardown: () => void;
}

/** Promote a `<div data-scriptoscope-theme-picker>` into a folder-strip
 *  switcher. Idempotent (stamped via data-scriptoscope-theme-picker-promoted).
 *  Returns `{ el, teardown }` or null if the element was already promoted or
 *  themes is empty. */
export async function promoteThemePicker(
  el: HTMLElement, themes: readonly ThemeEntry[], deps: PickerDeps,
): Promise<PromotedPicker | null> {
  if (el.dataset.scriptoscopeThemePickerPromoted != null) return null;
  if (!themes.length) return null;
  const mutations = new OwnedMutations();
  const setAttribute = (name: string, value: string): void => mutations.attribute(el, name, value);
  setAttribute('data-scriptoscope-theme-picker-promoted', '');
  let disposed = false;
  let busyTimeout: ReturnType<typeof setTimeout> | undefined;
  const events = new AbortController();
  // Remove any STALE library-added tiles from a previous mount cycle.
  // The teardown clears the stamp but intentionally leaves the tile DOM
  // in place (consumer OFF-mode delegated handlers need the tiles
  // present to read .closest('.scriptoscope-theme-picker-tile')). Here
  // on re-entry, we drop the stale set + rebuild fresh so each tile's
  // click handler binds to THIS mount's switchTheme. Pre-seeded
  // consumer tiles (a different class, e.g. .powers-picker-special-
  // tile) are preserved. The 2026-05-31 "half-stuck" bug fix pair.
  for (const stale of Array.from(el.querySelectorAll('.scriptoscope-theme-picker-tile'))) {
    stale.remove();
  }
  setAttribute('role', 'tablist');
  if (!el.hasAttribute('aria-label')) setAttribute('aria-label', `Theme picker, ${themes.length} themes`);
  // Per-tile aria-busy lifecycle (already in place 2026-05-30) tells AT
  // when an individual tile's icon has decoded. The CONTAINER aria-busy
  // is the complementary signal — flipped false once the initial active
  // tile is settled (icons either painted or decoded-and-failed). AT
  // clients honor a container's aria-busy transition as "this widget is
  // now ready to interact with"; without it, an SR user reading the
  // strip during the picker's first ~600ms boot saw inconsistent state.
  // A11y reviewer P1 2026-05-30.
  setAttribute('aria-busy', 'true');

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
    listenUntilAborted(events.signal, tile, 'click', () => { void deps.switchTheme(t.slug); });
    el.appendChild(tile);
    tiles.set(t.slug, tile);
  }
  if (tiles.size > 0 && !tiles.has(deps.initialSlug)) {
    tiles.values().next().value?.setAttribute('tabindex', '0');
  }

  // Keyboard nav — the ARIA APG tablist pattern. Arrow/Home/End move focus +
  // activate the tile (consumers expect a single key to switch themes).
  listenUntilAborted(events.signal, el, 'keydown', (e) => {
    const all = [...el.querySelectorAll<HTMLButtonElement>('.scriptoscope-theme-picker-tile')];
    if (!all.length) return;
    const i = all.findIndex((t) => t === document.activeElement);
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1 + all.length) % all.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + all.length) % all.length;
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
  //   2. Decode a tile's folder icon only when it intersects the viewport
  //   3. Decode-on-click as the synchronous fallback (intersection might
  //      not fire if the user tabs to the tile keyboard-only)
  // The active tile is decoded eagerly because its icon is the FIRST one
  // visible + it's already being loaded by the page-default mount.
  // Concurrency is capped at 2 and decodes yield via requestIdleCallback
  // between to keep the main thread responsive on mobile scrolling.
  const decoded = new Set<string>();
  let inFlight = 0;
  // Insertion-ordered queue + parallel Set for O(1) membership checks.
  // Sets preserve insertion order, so `[...queued][0]` is the head.
  // Replacing the previous `string[]` + `queue.includes()` scan — lib
  // reviewer P2 2026-05-30. Negligible at 18 themes; matters at 100+.
  const queued = new Set<string>();
  // Default 2 — calibrated for HTTP/1.1 + main-thread decode contention on
  // mid-range mobile. Was exposed as `pickerDecodeConcurrency` option until
  // 2026-05-31 (architect-reviewer #2: internal tuning knob that leaked
  // through three layers of API surface; no caller could sensibly tune it
  // without reading the original perf-thread comments). Hardcoded inline
  // now; re-expose if a real consumer hits a perf cliff that needs it.
  const concurrencyCap = 2;
  // Shared lookup: 32px preferred, else any size with the requested id.
  const pickIn = (t: ThemeView, id: number) => {
    const idx = t.inspector?.iconIndex ?? [];
    return idx.find((i) => i.id === id && i.size === 32) ?? idx.find((i) => i.id === id);
  };
  const pickInChain = (t: ThemeView) => resolveInChain(t, (owner) => {
    const hit = pickIn(owner, primaryId) ?? pickIn(owner, fallbackId);
    return hit ? { source: hit.url ? owner.asset(hit.url) : undefined } : undefined;
  });
  const iconFor = async (slug: string): Promise<string | null> => {
    // Reuse the active theme already loaded for page chrome. Background tiles
    // need only their folder icon, not hundreds of chrome/inspector assets.
    if (deps.loadIcon && slug !== deps.initialSlug) return deps.loadIcon(slug, primaryId, fallbackId);
    const source = pickInChain(themeView(await deps.loadTheme(slug)))?.source;
    return source ? source.imageUrl() : null;
  };
  // Memoised fallback URL — the first valid folder icon found among
  // initialSlug / themes[]. Single search, reused for every sparse tile.
  // We don't fire this eagerly; it triggers lazily on the first sparse
  // miss, by which point visible folder icons are usually cache-warm
  // (loaded by their own IO firings + the page chrome). Sparse-bundle
  // base-chain walk + last-resort theme walk — lib reviewer P2 2026-05-30.
  let cachedFallbackUrl: string | null = null;
  let fallbackSearch: Promise<string | null> | null = null;
  const findFallbackIcon = (excludeSlug: string): Promise<string | null> => {
    if (cachedFallbackUrl) return Promise.resolve(cachedFallbackUrl);
    if (fallbackSearch) return fallbackSearch;
    // Try initialSlug first (usually cache-warm), then themes[] in order.
    // dedup + drop the slug we already know lacks icons.
    const candidates = [...new Set([deps.initialSlug, ...themes.map((t) => t.slug)])]
      .filter((c) => c && c !== excludeSlug);
    fallbackSearch = (async () => {
      for (const c of candidates) {
        if (disposed) return null;
        try {
          const url = await iconFor(c);
          if (disposed) return null;
          if (url) { cachedFallbackUrl = url; return url; }
        } catch { /* try next candidate */ }
      }
      return null;
    })();
    void fallbackSearch.finally(() => { fallbackSearch = null; });
    return fallbackSearch;
  };
  const drain = (): void => {
    if (disposed) return;
    while (inFlight < concurrencyCap && queued.size > 0) {
      const slug = queued.values().next().value as string;
      queued.delete(slug);
      if (decoded.has(slug)) continue;
      decoded.add(slug);
      tiles.get(slug)?.setAttribute('aria-busy', 'true');
      inFlight += 1;
      void (async () => {
        try {
          let resolvedUrl = await iconFor(slug);
          if (disposed) return;
          if (resolvedUrl) {
            // Seed the fallback cache from the FIRST successful resolution
            // so subsequent sparse tiles short-circuit without re-walking.
            cachedFallbackUrl ??= resolvedUrl;
          } else {
            // Sparse theme — borrow a folder icon from any candidate that
            // has one. Search runs once per picker, memoised. Most tiles
            // hit the cache on the second-or-later sparse decode.
            resolvedUrl = await findFallbackIcon(slug);
          }
          if (disposed) return;
          if (resolvedUrl) {
            const tile = tiles.get(slug);
            const icon = tile?.querySelector<HTMLImageElement>('.scriptoscope-theme-picker-icon');
            if (icon) icon.src = resolvedUrl;
          }
        } catch {
          // A later click/keyboard activation can retry a transient failure.
          // Intersection is one-shot, so don't automatically loop failed loads.
          decoded.delete(slug);
        } finally {
          inFlight -= 1;
          if (disposed) return;
          // A failed decode has settled too; never leave AT waiting on it.
          tiles.get(slug)?.setAttribute('aria-busy', 'false');
          if (slug === deps.initialSlug) {
            clearTimeout(busyTimeout);
            setAttribute('aria-busy', 'false');
          }
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
    if (disposed || decoded.has(slug)) return;
    queued.add(slug); // Set.add is no-op on duplicate; O(1) membership
    drain();
  };
  // The active tile: decode eagerly. Its theme is the page default + the
  // first icon a user will see; it's also already being loaded by mount.
  // Once it lands (decoded or failed), flip the container aria-busy so
  // AT knows the picker is settled. Below-the-fold tiles don't gate this
  // signal — they're lazy and may not decode at all this session.
  if (tiles.has(deps.initialSlug)) {
    // Bound the busy signal even if a loader never settles. Teardown owns
    // this timer so an earlier mount cannot mark a later mount ready.
    busyTimeout = setTimeout(() => {
      if (!disposed) setAttribute('aria-busy', 'false');
    }, 3000);
    requestDecode(deps.initialSlug);
  } else {
    setAttribute('aria-busy', 'false'); // no active tile to wait on
  }
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
      listenUntilAborted(events.signal, tile, 'mouseenter', () => requestDecode(slug), { once: true });
      listenUntilAborted(events.signal, tile, 'focus', () => requestDecode(slug), { once: true });
    }
  }
  // Click is the universal fallback — even with IntersectionObserver, a
  // user might tab to a tile keyboard-only (no hover) and click before
  // the IO fires. This ensures its icon paints independently of full chrome
  // loading; theme selection itself still uses the resolver's full-theme cache.
  for (const [slug, tile] of tiles) {
    listenUntilAborted(events.signal, tile, 'click', () => requestDecode(slug));
  }

  // Retain tiles for consumer OFF-mode delegation, but release this mount's
  // listeners and ignore async work that finishes after teardown.
  const teardown = (): void => {
    if (disposed) return;
    disposed = true;
    clearTimeout(busyTimeout);
    events.abort();
    if (io) { io.disconnect(); io = null; }
    queued.clear();
    // Clear the promoted stamp so a subsequent mountDeclarative cycle
    // re-runs promotion. Tiles themselves stay (consumer OFF-mode flows
    // may delegate clicks on them — the demo's "click a theme tile to
    // re-mount and retheme" path needs the tiles present in OFF mode).
    // Re-promote replaces the tiles with fresh ones bound to the new
    // mount's switchTheme. Without the stamp clear, re-promote would
    // skip + tiles would retain their FIRST-mount click handlers
    // pointing at the dead handle's retheme — picker active class +
    // URL would update but the WindowManager wouldn't retheme. The
    // 2026-05-31 "half-stuck" bug.
    mutations.restore();
  };
  return { el, teardown };
}

/** Sync the picker's active state when a retheme happened elsewhere (e.g. via
 *  handle.retheme(slug) from a different control). Called by the scanner's
 *  retheme cascade so all promoted pickers stay in lockstep. */
export function syncThemePickerActive(el: HTMLElement, slug: string): void {
  const tiles = Array.from(el.querySelectorAll<HTMLButtonElement>('.scriptoscope-theme-picker-tile'));
  let hasActive = false;
  for (const tile of tiles) {
    const isActive = tile.dataset.slug === slug;
    if (isActive) hasActive = true;
    tile.classList.toggle('active', isActive);
    tile.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tile.setAttribute('tabindex', isActive ? '0' : '-1');
  }
  // When no tile is active in this picker (e.g. multi-picker strip setups
  // where the selected theme is in another strip), ensure the first tile
  // remains tab-focusable (tabindex="0") so keyboard/SR users can Tab in.
  if (!hasActive && tiles.length > 0) {
    tiles[0]?.setAttribute('tabindex', '0');
  }
}
