// The declarative scanner: find `data-scriptoscope-window` / `data-scriptoscope-button` elements (+ `.aaron-*`
// class fallbacks) and promote them, then keep promoting elements added later via a MutationObserver.
// Idempotent: promoted elements are stamped `data-scriptoscope-promoted`, so re-scans (incl. the observer
// firing on our OWN DOM moves) skip them and settle.

import { WindowManager } from '../interactive.js';
import type { LoadedTheme } from '../types.js';
import { ScriptoscopeWindow, findPositionedAncestor } from './ScriptoscopeWindow.js';
import { setInheritedRect } from './inheritedRect.js';
import { promoteButton } from './button.js';
import { promoteControl } from './control.js';
import { promoteField } from './field.js';
import { promoteIcon } from './icon.js';
import { promoteThemePicker, syncThemePickerActive } from './themePicker.js';
import type { ThemeEntry } from './theme.js';
import { promoteTabs } from './tabs.js';
import { createThemeResolver, type ThemeBootstrapOpts } from './theme.js';
import { resolveThemeRef } from './parse.js';
import { debug } from '../debug.js';
import { SCRIPTOSCOPE_READY_CLASS, SCRIPTOSCOPE_LOADING_ATTR } from './markers.js';
import {
  readLayout, createDebouncedWriter, onCrossTabUpdate, windowIdFor,
  readHostPosition, type PersistedLayout,
} from './persistence.js';

/** Per-target promotion outcome, passed to `onPromoteError`. `kind` lets the
 *  consumer's handler discriminate (e.g. ignore a known-flaky third-party
 *  field while alerting on window failures). `cause` is the raw thrown
 *  value — usually an Error but typed `unknown` for honesty. */
export interface PromoteError {
  kind: 'window' | 'button' | 'control' | 'tabs' | 'field' | 'icon';
  el: Element;
  cause: unknown;
}

export interface MountOptions extends ThemeBootstrapOpts {
  /** Where to scan (default `document`). */
  root?: Document | Element;
  /** Theme ref used when no ancestor carries `data-scriptoscope-theme` (default = `baseSlug`). */
  pageThemeDefault?: string;
  /** Opt-in to localStorage layout persistence (closes #165). When set, this mount restores
   *  window positions/sizes/collapsed state from `localStorage.scriptoscope:layout:<persistKey>` on
   *  promotion, then saves on every state change. Cross-tab sync via the `storage` event.
   *  Window identity comes from `data-scriptoscope-window-id` (stable) or DOM ordinal (fallback).
   *  Default `undefined` = persistence disabled (current behavior). When NOT set, reload resets
   *  windows to their CSS-defined positions. Schema details:
   *  `docs/superpowers/specs/2026-05-28-persistence-design.md`. */
  persistKey?: string;
  /** Per-target promotion failure hook. Called once per element whose promote
   *  throws (network failure fetching a theme, decoder error, malformed
   *  attrs). Default behavior: `console.error`. Return `false` to suppress
   *  the default log. Useful for routing errors to your app's telemetry
   *  without console noise. */
  onPromoteError?: (err: PromoteError) => void | false;
  /** When `true` (default `false`), mountDeclarative REJECTS its returned
   *  promise if the initial scan found promotable targets but ZERO of them
   *  succeeded — typically a misconfigured `themeBaseUrl` or unreachable
   *  bundles. Without this, the runtime returns a "valid" handle with no
   *  windows promoted, and the consumer has to probe the DOM to detect it.
   *  See "Common pitfall — silent partial-success" in the README. */
  rejectOnEmptyMount?: boolean;
  /** The catalog of themes that `<div data-scriptoscope-theme-picker>`
   *  elements render tiles for AND that the loader takes hints from.
   *  Each entry: `{ slug, name?, author?, year?, source? }` —
   *  `source: 'scheme.rsrc'` on `.rsrc`-only bundles saves a 580ms wasted
   *  `.sit` 404 RTT per bundle. Shape mirrors `demo/themes-manifest.json`
   *  so a consumer can pass the imported manifest directly. Default: no
   *  themes → pickers stay empty AND loader uses default cascade. */
  themes?: readonly ThemeEntry[];
  /** Cap on concurrent icon decodes inside `<div data-scriptoscope-theme-picker>`
   *  promotion. Default 2 — calibrated for HTTP/1.1 + main-thread decode
   *  contention on mid-range mobile. Lift to 4-6 for desktop wifi kiosks
   *  with a large picker; drop to 1 for very low-end devices. */
  pickerDecodeConcurrency?: number;
  /** Auto-cycle through registered `themes` every N milliseconds until the
   *  first user interaction (`pointerdown`/`keydown`/`wheel` anywhere in
   *  the root). Use on landing pages where "show the breadth, not assert
   *  it" matters. Respects `prefers-reduced-motion` (suspends entirely).
   *  Suppressed when `syncToUrlParam` boots with a deep-link present.
   *  Default: undefined → no auto-cycle. */
  autoCycle?: number;
  /** Read at boot to choose the initial theme (overrides `pageThemeDefault`
   *  if the param matches a registered theme slug). On every `retheme()`,
   *  `history.replaceState` mirrors the new slug back to the URL so the
   *  page stays shareable. Default: undefined → no URL sync. */
  syncToUrlParam?: string;
  /** What to show in the gap between mountDeclarative() invocation and the
   *  `ready` event fire. The runtime adds `data-scriptoscope-loading` on the
   *  root for that window; scriptoscope.css uses the attribute as the CSS
   *  hook for chrome wipe-in, dotted-outline picker placeholders, and
   *  (when >50% of registered themes are still decoding) a small canvas-
   *  painted watch cursor in the picker corner.
   *
   *  Defaults to `'auto'` — the runtime picks per element. `'none'` (alias
   *  `false`) suppresses entirely (no affordance attribute, no animation).
   *  The string-enum shape is forward-compatible: future versions may add
   *  `'minimal'` / `'overlay'` / etc. without breaking call sites.
   *
   *  Respects `prefers-reduced-motion` automatically (wipe-in → instant
   *  swap, pulse → instant). The watch cursor remains because it conveys
   *  information, not motion-for-decoration. */
  bootAffordance?: 'auto' | 'none' | true | false;
}

/** Counts of successfully-promoted targets by kind, exposed on MountHandle.
 *  Reflects the initial scan + every subsequent observer-driven re-scan.
 *  `windows` includes the picker if one is on the page; `controls` is the
 *  sum of promoted checkboxes + radios + range sliders + selects. */
export interface MountStats {
  windows: number;
  buttons: number;
  controls: number;
  tabs: number;
  fields: number;
}

/** Events dispatched on the MountHandle. Use `handle.addEventListener('ready', cb)`.
 *  All events bubble through the handle itself (it's an EventTarget); promoted
 *  windows ALSO dispatch a `scriptoscope:promoted` CustomEvent on the original
 *  consumer element (bubbles up the DOM) so consumers can listen anywhere
 *  without holding the handle.
 *
 * - `ready`         — initial scan completed; stats reflect first-pass counts.
 * - `retheme`       — handle.retheme resolved; .detail is the new ref.
 * - `promoteError`  — single-target promotion failed; .detail is { kind, el, cause }.
 * - `unmounted`     — disconnect() ran; handle is now inert.
 */
export type MountEventMap = {
  ready: CustomEvent<{ stats: MountStats }>;
  retheme: CustomEvent<{ ref: string }>;
  promoteError: CustomEvent<PromoteError>;
  unmounted: CustomEvent<undefined>;
};

/** Public handle returned by mountDeclarative. Exported so consumers can type
 *  refs (`const handle: MountHandle = await mountDeclarative(...)`). Extends
 *  EventTarget so consumers can subscribe to lifecycle events via the standard
 *  addEventListener / removeEventListener; cast the CustomEvent.detail per
 *  the MountEventMap above. */
export interface MountHandle extends EventTarget {
  disconnect(): void;
  retheme(ref: string): Promise<void>;
  registerTheme(ref: string, theme: LoadedTheme): void;
  /** Live promotion counts. Mutable: re-scans (observer-driven) add to these.
   *  Lets consumers gate UI on "is the runtime alive" without DOM probing. */
  readonly stats: MountStats;
}

/**
 * Re-entrant mount guard. A SPA consumer that idempotently calls
 * `mountDeclarative({ root })` (e.g. inside a React useEffect, or after a
 * route change) would otherwise spin up a second WindowManager + observer
 * pair on the same root, both racing to promote the same elements. The
 * second WindowManager won't see the first's promoted hosts as its own,
 * and `disconnect()` on the first handle yanks windows out from under the
 * second. Diagnosing this is brutal because there's no error — just
 * intermittent layout glitches.
 *
 * Defence: WeakMap keyed on the actual `root` Element (Document maps to its
 * documentElement). If a mount already exists, log once and return the
 * existing handle. That's friendlier than rejecting because consumers using
 * React StrictMode (double-invocation in dev) won't get a noisy error.
 * Cleared in disconnect() so a remount after teardown works.
 */
const mountedRoots = new WeakMap<Element, MountHandle>();
const rootKey = (r: Document | Element): Element | null =>
  r instanceof Document ? r.documentElement : r;

const WINDOW_SEL = '[data-scriptoscope-window], .scriptoscope-window-fallback';
const BUTTON_SEL = '[data-scriptoscope-button], .scriptoscope-button-fallback';
// Themed text fields: native <input type=text|email|...> and <textarea>. OPT-IN via
// [data-scriptoscope-field] (not auto-scan over every text input) because field styling can
// VISUALLY conflict with a consumer's existing stylesheet — checkbox/radio overlays are
// composable, but a CMS may already paint inputs distinctively. Opt-in keeps the
// surprise surface small. See src/declarative/field.ts for the bevel rationale.
const FIELD_SEL = '[data-scriptoscope-field], .scriptoscope-field-attr';
// Themed tab strip wrapper. The interior structure (children with [data-scriptoscope-tab] +
// [data-scriptoscope-panel]) is parsed by promoteTabs itself. Wrapper-level scan keeps the selector
// list flat + lets us re-skin tabs on retheme without re-querying the panels each time.
const TABS_SEL = '[data-scriptoscope-tabs]';
// Themed checkbox / radio / slider / select. Auto-promoted page-wide so existing markup picks up
// themes without retrofitting every input; opt-out per-control with `data-scriptoscope-control="off"` if
// a consumer wants the native chrome. Selects use a transparent-overlay strategy (themed button +
// native `<select>` invisible on top) — the dropdown menu itself stays browser-native for now;
// fully themed via `popup-window` chrome is a follow-up.
const CONTROL_SEL = [
  'input[type=checkbox]:not([data-scriptoscope-control=off])',
  'input[type=radio]:not([data-scriptoscope-control=off])',
  'input[type=range]:not([data-scriptoscope-control=off])',
  'select:not([data-scriptoscope-control=off])',
].join(', ');
// Scheme-resolved Finder icons. `<img data-scriptoscope-icon="folder">` (named
// key) or `<img data-scriptoscope-icon-id="-3999">` (raw Apple resource id).
// Re-resolves src on retheme so the icon follows the active scheme.
const ICON_SEL = '[data-scriptoscope-icon], [data-scriptoscope-icon-id]';
const THEME_PICKER_SEL = '[data-scriptoscope-theme-picker]';

/** Scan `root` and promote every declarative element; watch for more. Returns a handle to stop. */
export async function mountDeclarative(opts: MountOptions = {}): Promise<MountHandle> {
  const root: Document | Element = opts.root ?? document;
  // Re-entrant mount guard (see mountedRoots above). Return the existing
  // handle instead of double-mounting; warn once so the consumer notices
  // in dev but doesn't get console-spammed (React StrictMode etc).
  const key = rootKey(root);
  if (key) {
    const existing = mountedRoots.get(key);
    if (existing) {
      console.warn('[scriptoscope] mountDeclarative called on a root that is already mounted; returning the existing handle. Call handle.disconnect() before remounting.');
      return existing;
    }
  }
  const manager = new WindowManager();
  const resolver = createThemeResolver(opts);
  // syncToUrlParam (T2.3): if the URL carries ?<param>=<slug> AND it matches
  // a registered theme, that's the initial theme. Falls back to
  // pageThemeDefault → baseSlug → '1138' otherwise. Deep-link awareness
  // also gates the autoCycle below (we don't cycle if the user came in on
  // a specific scheme).
  const themesBySlug = new Map((opts.themes ?? []).map((t) => [t.slug, t]));
  const urlSlug = (opts.syncToUrlParam && typeof location !== 'undefined')
    ? new URLSearchParams(location.search).get(opts.syncToUrlParam)
    : null;
  const cameViaDeepLink = !!(urlSlug && themesBySlug.has(urlSlug));
  const pageDefault = (cameViaDeepLink ? urlSlug! : null) ?? opts.pageThemeDefault ?? opts.baseSlug ?? '1138';
  const inFlight = new Set<Element>();
  // Live stats — exposed on MountHandle; mutated by every successful promote.
  const stats: MountStats = { windows: 0, buttons: 0, controls: 0, tabs: 0, fields: 0 };
  // Positioned ancestors we've pinned an inline min-height onto (so absolute
  // window-host children don't collapse them). Map<ancestor, priorMinHeight>
  // so disconnect() can restore the original inline value (consumer's own
  // CSS still applies if they had a stylesheet min-height).
  const pinnedAncestors = new Map<HTMLElement, string>();
  // Single-pipe failure reporter. Consumer hook can suppress the default
  // console.error by returning false (matches the addEventListener cancel
  // pattern). Routing all 5 promote*'s catch blocks through this keeps the
  // surface uniform — useful when we later add lifecycle events (T3.1).
  // Lifecycle event bus — the MountHandle below extends EventTarget so
  // consumers can addEventListener('ready'|'retheme'|'promoteError'|
  // 'unmounted'). All four routed through here for one consistent shape.
  const events = new EventTarget();
  const dispatch = <T>(type: string, detail?: T): void => {
    events.dispatchEvent(new CustomEvent(type, detail !== undefined ? { detail } : undefined));
  };
  const reportPromoteError = (kind: PromoteError['kind'], el: Element, cause: unknown): void => {
    const err: PromoteError = { kind, el, cause };
    dispatch('promoteError', err);
    // Also fire a bubbling DOM event on the original element so consumers
    // can listen anywhere without holding the handle.
    el.dispatchEvent(new CustomEvent('scriptoscope:promoteError', { bubbles: true, detail: err }));
    const handled = opts.onPromoteError?.(err);
    if (handled === false) return;
    console.error(`[scriptoscope] ${kind} promote failed:`, cause);
  };
  const mounted: ScriptoscopeWindow[] = []; // tracked so disconnect() can fully tear down (unmount + ROs)
  const skinnedButtons: { el: HTMLElement; skinned: HTMLElement }[] = []; // tracked so retheme() re-skins them
  const skinnedControls: { el: HTMLInputElement | HTMLSelectElement; skinned: HTMLElement }[] = []; // checkbox/radio/slider/select
  const skinnedTabs: HTMLElement[] = []; // tablist wrappers (re-promoted on retheme to swap faces)
  const skinnedIcons: (HTMLImageElement | HTMLElement)[] = []; // [data-scriptoscope-icon] elements; re-resolved on retheme
  const skinnedPickers: HTMLElement[] = []; // [data-scriptoscope-theme-picker] elements; aria-selected synced on retheme
  const pickerTeardowns: (() => void)[] = []; // IO disconnect + queue clear, run on handle.disconnect() — lib reviewer P1 fix 2026-05-30
  // Elements we set `inert` on during the boot wipe so a fast tab can't
  // land focus on a clipped, visually-invisible widget. Cleared in the
  // ready microtask. Tracked explicitly so we only remove `inert` we
  // added (a consumer marking their own element inert pre-mount keeps it).
  // A11y reviewer P1 2026-05-30; pairs with the clip-path animation in
  // scriptoscope.css scoped on [data-scriptoscope-loading].
  const inertDuringWipe = new Set<Element>();
  const markInertIfWiping = (el: Element): void => {
    if (!loadingEl?.hasAttribute(SCRIPTOSCOPE_LOADING_ATTR)) return;
    if (el.hasAttribute('inert')) return; // consumer-set inert: leave alone
    el.setAttribute('inert', '');
    inertDuringWipe.add(el);
  };
  let cascade = 0;
  let lastThemeRef: string | null = null; // last runtime theme switch — new windows inherit it, not pageDefault

  // Persistence (opt-in via opts.persistKey). Load the snapshot now so promoteWindow can apply
  // restored geometry before WindowManager sees the window. Map<aaron-id, PersistedWindow>.
  const persistKey = opts.persistKey;
  const persistedLayout: PersistedLayout | null = persistKey ? readLayout(persistKey) : null;
  const persistedWindows = persistedLayout?.windows ?? {};
  let promoteOrdinal = 0; // for DOM-ordinal fallback identity
  const writeNow = persistKey ? createDebouncedWriter(persistKey) : null;
  const idForHost = new WeakMap<HTMLElement, string>();
  // Build a serializable layout from the current managed-window state. Called on every change.
  const snapshot = (): PersistedLayout => {
    const windows: Record<string, { x?: number; y?: number; w?: number; h?: number; collapsed?: boolean; z?: number }> = {};
    for (const aw of mounted) {
      const id = idForHost.get(aw.host);
      if (!id) continue;
      const desc = manager.describe(aw.host);
      const pos = readHostPosition(aw.host);
      const entry: { x?: number; y?: number; w?: number; h?: number; collapsed?: boolean; z?: number } = { x: pos.x, y: pos.y };
      if (desc?.width != null) entry.w = desc.width;
      if (desc?.height != null) entry.h = desc.height;
      if (desc?.collapsed) entry.collapsed = true;
      if (desc?.z != null) entry.z = desc.z;
      windows[id] = entry;
    }
    const layout: PersistedLayout = { version: 1, windows };
    if (lastThemeRef) layout.activeTheme = lastThemeRef;
    return layout;
  };
  // WindowManager fires onChange after every render() + after title-drag mouseup. We snapshot
  // and write (debounced). Without persistKey, no listener attached → zero cost.
  let unsubCrossTab: (() => void) | null = null;
  if (persistKey) {
    manager.setChangeListener(() => { if (writeNow) writeNow(snapshot()); });
    // Cross-tab sync: when another tab writes the same persistKey, re-apply each window's
    // saved geometry. Position is set directly on host.style; size is applied via
    // manager.setContentSize (which renders); collapsed via the runtime's collapse handler
    // is harder to drive from outside, so we just update size+position cross-tab and leave
    // collapse alone (rare enough that the consumer can re-collapse manually).
    unsubCrossTab = onCrossTabUpdate(persistKey, (layout) => {
      for (const aw of mounted) {
        const id = idForHost.get(aw.host);
        if (!id) continue;
        const w = layout.windows[id];
        if (!w) continue;
        if (w.x != null && w.y != null) {
          aw.host.style.left = `${w.x}px`;
          aw.host.style.top = `${w.y}px`;
        }
        if (w.w != null && w.h != null) {
          void manager.setContentSize(aw.host, w.w, w.h);
        }
      }
    });
  }

  await resolver.preloadFonts();

  const isPromoted = (el: Element): boolean =>
    (el as HTMLElement).dataset?.scriptoscopePromoted != null || inFlight.has(el);

  // Nearest-ancestor-wins theme ref for an element (walk ancestors collecting data-scriptoscope-theme).
  const refForEl = (el: Element): string => {
    const chain: (string | null)[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) chain.unshift(n.getAttribute('data-scriptoscope-theme'));
    // After a runtime theme switch, windows added later with no explicit data-scriptoscope-theme follow the
    // live theme (lastThemeRef), so the desktop stays consistent; before any switch, the page default.
    const fallback = lastThemeRef ?? pageDefault;
    return resolveThemeRef(chain, fallback) ?? fallback;
  };

  const promoteWindow = async (el: HTMLElement): Promise<void> => {
    if (isPromoted(el) || el.closest('.scriptoscope-window')) return; // skip done / nested-in-chrome
    inFlight.add(el);
    try {
      const ref = refForEl(el);
      const theme = await resolver.load(ref);
      // Resolve persistence identity + restored geometry BEFORE promotion. If persistedWindows has
      // an entry for this id, apply the saved x/y/w/h/collapsed via temporary data attrs so
      // ScriptoscopeWindow.promote's existing parseWindowAttrs picks them up. Original attrs are restored
      // on unmount via ScriptoscopeWindow.restore (no change there).
      const ord = promoteOrdinal++;
      const id = persistKey ? windowIdFor(el, ord) : '';
      const persisted = persistKey && id ? persistedWindows[id] : undefined;
      const pos = persisted && persisted.x != null && persisted.y != null
        ? { x: persisted.x, y: persisted.y }
        : { x: 24 + cascade * 26, y: 24 + cascade * 26 };
      if (!persisted) cascade += 1; // only consume cascade for non-restored windows
      // Apply saved geometry via data attrs so ScriptoscopeWindow's parseWindowAttrs picks them up.
      // PERSISTED state takes precedence over declared data-scriptoscope-* (the consumer's declared
      // values are the BOOT defaults; persisted state is "where the user last left it"). This
      // intentionally overrides the consumer's declared x/y/w/h. Document this in the persistence
      // proposal: declared attrs = first-boot defaults; persisted state = the user's last layout.
      if (persisted) {
        if (persisted.x != null) el.dataset.scriptoscopeX = String(persisted.x);
        if (persisted.y != null) el.dataset.scriptoscopeY = String(persisted.y);
        if (persisted.w != null) el.dataset.scriptoscopeWidth = String(persisted.w);
        if (persisted.h != null) el.dataset.scriptoscopeHeight = String(persisted.h);
        if (persisted.collapsed) el.dataset.scriptoscopeCollapsed = '';
      }
      const aw = await ScriptoscopeWindow.promote(el, { manager, theme }, pos);
      aw.host.dataset.scriptoscopeTheme = ref;
      if (id) idForHost.set(aw.host, id);
      mounted.push(aw);
      markInertIfWiping(aw.host);
      stats.windows += 1;
      debug('promote', `window: ${el.dataset.scriptoscopeTitle ?? '(untitled)'}`, { theme: ref, x: pos.x, y: pos.y, restored: !!persisted });
      // Bubbling DOM event so consumers can listen anywhere (e.g.
      // delegated from document.body) without holding the handle. Fired
      // on the HOST (the still-attached node post-promote) since the
      // original `el` was just removed from DOM by ScriptoscopeWindow.
      aw.host.dispatchEvent(new CustomEvent('scriptoscope:promoted', { bubbles: true, detail: { kind: 'window', host: aw.host } }));
    } catch (err) {
      reportPromoteError('window', el, err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteBtn = async (el: HTMLElement): Promise<void> => {
    if (isPromoted(el)) return; // buttons inside window content ARE wanted, so don't skip on .scriptoscope-window
    inFlight.add(el);
    try {
      const skinned = await promoteButton(el, await resolver.load(refForEl(el)));
      skinnedButtons.push({ el, skinned });
      markInertIfWiping(skinned);
      stats.buttons += 1;
      debug('promote', `button: ${el.textContent?.trim().slice(0, 30) ?? ''}`);
    } catch (err) {
      reportPromoteError('button', el, err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteTabsEl = async (el: HTMLElement): Promise<void> => {
    if (el.dataset.scriptoscopeTabsPromoted != null) return;
    inFlight.add(el);
    try {
      await promoteTabs(el, await resolver.load(refForEl(el)));
      skinnedTabs.push(el);
      markInertIfWiping(el);
      stats.tabs += 1;
    } catch (err) {
      reportPromoteError('tabs', el, err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteFld = async (el: HTMLInputElement | HTMLTextAreaElement): Promise<void> => {
    if (el.dataset.scriptoscopeFieldPromoted != null) return;
    inFlight.add(el);
    try {
      promoteField(el, await resolver.load(refForEl(el)));
      stats.fields += 1;
    } catch (err) {
      reportPromoteError('field', el, err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteIco = async (el: HTMLImageElement | HTMLElement): Promise<void> => {
    if (el.dataset.scriptoscopeIconPromoted != null) return;
    try {
      const theme = await resolver.load(refForEl(el));
      if (promoteIcon(el, theme)) { skinnedIcons.push(el); markInertIfWiping(el); }
    } catch (err) {
      reportPromoteError('icon', el, err);
    }
  };

  const promotePicker = async (el: HTMLElement): Promise<void> => {
    if (el.dataset.scriptoscopeThemePickerPromoted != null) return;
    if (!opts.themes?.length) return; // no manifest → picker stays empty (consumer didn't opt in)
    try {
      const result = await promoteThemePicker(el, opts.themes, {
        loadTheme: (slug) => resolver.load(slug),
        switchTheme: (slug) => retheme(slug),
        initialSlug: lastThemeRef ?? pageDefault,
        // Omit when undefined so exactOptionalPropertyTypes:true accepts it.
        ...(opts.pickerDecodeConcurrency != null ? { decodeConcurrency: opts.pickerDecodeConcurrency } : {}),
      });
      if (result) {
        skinnedPickers.push(result.el);
        pickerTeardowns.push(result.teardown);
        markInertIfWiping(result.el);
      }
    } catch (err) {
      reportPromoteError('control', el, err); // no 'picker' kind; reuse 'control' (kept tight for now)
    }
  };

  const promoteCtl = async (el: HTMLInputElement | HTMLSelectElement): Promise<void> => {
    if (isPromoted(el)) return;
    inFlight.add(el);
    try {
      const skinned = await promoteControl(el, await resolver.load(refForEl(el)));
      if (skinned) {
        skinnedControls.push({ el, skinned });
        markInertIfWiping(skinned);
        stats.controls += 1;
      }
      debug('promote', `control: ${el.tagName.toLowerCase()}${el.type ? `[type=${el.type}]` : ''}`);
    } catch (err) {
      reportPromoteError('control', el, err);
    } finally {
      inFlight.delete(el);
    }
  };

  // Runtime theme switch: re-skin the whole desktop AND every promoted button with one scheme — a
  // system-wide Kaleidoscope theme change overrides per-window themes. The persistent window content
  // survives the chrome re-render; buttons are re-skinned (the new skinned face replaces the old).
  const retheme = async (ref: string): Promise<void> => {
    lastThemeRef = ref;
    // Fire retheme AT END (after manager.retheme resolves) so subscribers
    // see committed state; see below.
    // syncToUrlParam (T2.3): mirror the new slug back to ?<param>=<slug>
    // so the URL stays shareable. replaceState (not pushState) keeps the
    // history clean. Only updates if the param's already there or the
    // consumer opted in via syncToUrlParam.
    if (opts.syncToUrlParam && typeof location !== 'undefined' && typeof history !== 'undefined') {
      try {
        const u = new URL(location.href);
        u.searchParams.set(opts.syncToUrlParam, ref);
        history.replaceState(null, '', u);
      } catch { /* sandboxed contexts (some iframes) can't replaceState */ }
    }
    const theme = await resolver.load(ref);
    await manager.retheme(theme);
    // Update each promoted host's `data-scriptoscope-theme` so consumers querying
    // `[data-scriptoscope-theme="<slug>"]` see the new value and CSS / AT see consistent state.
    // Manager.retheme rebuilds the inner `.scriptoscope-window` but doesn't touch the outer host
    // dataset — we do that here.
    for (const aw of mounted) aw.host.dataset.scriptoscopeTheme = ref;
    // Drop buttons whose window was closed — unmount moved their content (incl. the skinned face) back
    // out of any .scriptoscope-window, so re-skinning them would re-inject a face into the restored consumer DOM.
    // `isConnected` (not `.closest('.scriptoscope-window')`) is the load-bearing filter: `closest` walks even
    // detached subtrees and would keep entries whose window was removed via `.scriptoscope-window.remove()`.
    const live = skinnedButtons.filter((b) => b.skinned.isConnected);
    skinnedButtons.length = 0; skinnedButtons.push(...live);
    for (const b of skinnedButtons) {
      try {
        const fresh = await promoteButton(b.el, theme); // inserts the new face right after el…
        b.skinned.remove();                              // …then drop the previous one
        b.skinned = fresh;
      } catch (err) { console.error('[scriptoscope] button re-skin failed:', err); }
    }
    // Re-skin tabs: drop orphans (whose wrapper was closed/removed), then re-promote each in
    // place with forceRescan so the canvas faces are rebuilt against the new theme. The native
    // <button>s and panels stay put — only the skinned spans + ARIA + tabindex are rewritten.
    const liveTabs = skinnedTabs.filter((el) => el.isConnected);
    skinnedTabs.length = 0; skinnedTabs.push(...liveTabs);
    for (const tabsEl of skinnedTabs) {
      try {
        // Strip the old skinned siblings before re-promoting so we don't accumulate them.
        for (const old of Array.from(tabsEl.querySelectorAll(':scope > [data-scriptoscope-tab-skinned]'))) old.remove();
        // Restore the native buttons' visibility + clear promoted flag so promoteTabs sees them
        // again and can re-decide skinned vs CSS fallback under the new theme.
        for (const btn of Array.from(tabsEl.querySelectorAll<HTMLElement>(':scope > [data-scriptoscope-tab]'))) {
          btn.style.display = '';
          delete btn.dataset.scriptoscopePromoted;
          delete btn.dataset.scriptoscopeTabFallback;
        }
        delete tabsEl.dataset.scriptoscopeTabsPromoted;
        await promoteTabs(tabsEl, theme, { forceRescan: true });
      } catch (err) { console.error('[scriptoscope] tabs re-skin failed:', err); }
    }
    // Same dance for promoted checkbox/radio/slider controls: drop orphans, then re-skin each in
    // place. clear the promoted stamp first so promoteControl will re-promote (it self-guards).
    const liveCtls = skinnedControls.filter((c) => c.skinned.isConnected); // same isConnected fix as buttons
    skinnedControls.length = 0; skinnedControls.push(...liveCtls);
    for (const c of skinnedControls) {
      try {
        delete c.el.dataset.scriptoscopePromoted;
        const fresh = await promoteControl(c.el, theme);
        if (fresh) { c.skinned.remove(); c.skinned = fresh; }
      } catch (err) { console.error('[scriptoscope] control re-skin failed:', err); }
    }
    // Re-resolve every promoted icon's src from the new theme's iconIndex.
    // Filter orphans (icon removed from DOM during retheme) before re-running.
    const liveIcons = skinnedIcons.filter((el) => el.isConnected);
    skinnedIcons.length = 0; skinnedIcons.push(...liveIcons);
    for (const el of skinnedIcons) {
      try { promoteIcon(el, theme); }
      catch (err) { console.error('[scriptoscope] icon re-resolve failed:', err); }
    }
    // Sync every promoted theme picker's active-tile state. The picker
    // itself didn't trigger the retheme (it could have been triggered by
    // a different control or by handle.retheme directly) — this keeps
    // every picker in lockstep with the live theme.
    const livePickers = skinnedPickers.filter((el) => el.isConnected);
    skinnedPickers.length = 0; skinnedPickers.push(...livePickers);
    for (const el of skinnedPickers) syncThemePickerActive(el, ref);
    dispatch('retheme', { ref });
  };

  // Windows in DOCUMENT ORDER, sequentially, so the first declared window becomes the active one
  // deterministically (WindowManager focus follows add-order). This moves window content — including
  // any buttons — into the chrome; THEN promote buttons anywhere (now in their final location),
  // concurrently. Stamps make this safe to run repeatedly.
  const scanAndPromote = async (within: Document | Element): Promise<void> => {
    // Capture every window-target's bounding rect BEFORE we start promoting. Sequential
    // promotion removes each element from the document, reflowing the page; if we measured
    // each rect just-in-time, sibling inline-block windows would collapse onto each other
    // (right card measured AFTER left card was removed → both end up at x=0). Pre-capturing
    // gives every window its true natural position relative to its positioned ancestor.
    // Stored on the dataset so ScriptoscopeWindow.promote (which reads its own dataset) sees
    // them naturally — keeps the helper API uncluttered.
    const windowTargets = Array.from(within.querySelectorAll(WINDOW_SEL)) as HTMLElement[];
    for (const el of windowTargets) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        // Stash on a WeakMap (T3.2) instead of the dataset — keeps the
        // transient handoff invisible to consumer DevTools, MutationObservers,
        // and CSS attribute selectors. ScriptoscopeWindow.promote consumes it.
        setInheritedRect(el, { left: r.left, top: r.top, width: r.width, height: r.height });
      }
    }
    // ── Auto-reserve min-height on the positioned ancestors that will host
    // the absolute-positioned window hosts. WITHOUT this, the parent
    // collapses to 0 the moment we lift its children out of flow, and the
    // rest of the page reflows up. WITH it, the bare-HTML layout and the
    // skinned-chrome layout reserve identical space. THIS was the single
    // most-likely-to-be-filed bug per the 2026-05-30 demo-reviewer audit:
    // every consumer with a flex/grid layout containing data-scriptoscope-
    // window children would hit it.
    //
    // Heuristic: for each unique positioned ancestor of a window target,
    // capture its current rendered height and set as inline min-height.
    // SKIP if the ancestor already has an inline min-height (consumer
    // explicitly set one; respect it) OR if the ancestor isn't going to
    // collapse (has other in-flow children — checked by counting non-
    // promotable children). Track pinned ancestors so disconnect() can
    // restore them.
    const seenAncestors = new Set<HTMLElement>();
    for (const el of windowTargets) {
      const anc = findPositionedAncestor(el);
      if (!anc || anc === document.documentElement) continue;
      if (seenAncestors.has(anc)) continue;
      seenAncestors.add(anc);
      if (anc.style.minHeight) continue; // consumer pinned it — respect
      const h = anc.getBoundingClientRect().height;
      if (h <= 0) continue;
      // Remember the prior inline value so disconnect() restores faithfully
      // (the consumer's CSS might still apply a non-inline min-height).
      pinnedAncestors.set(anc, anc.style.minHeight);
      anc.style.minHeight = `${Math.round(h)}px`;
    }
    for (const el of windowTargets) await promoteWindow(el);
    // Tabs FIRST among the in-window controls — the button promotion later will skip any tab
    // <button> because promoteTabs stamps them with data-scriptoscope-promoted.
    for (const el of Array.from(within.querySelectorAll(TABS_SEL))) await promoteTabsEl(el as HTMLElement);
    await Promise.all([
      ...Array.from(within.querySelectorAll(BUTTON_SEL), (el) => promoteBtn(el as HTMLElement)),
      ...Array.from(within.querySelectorAll(CONTROL_SEL), (el) => promoteCtl(el as HTMLInputElement | HTMLSelectElement)),
      ...Array.from(within.querySelectorAll(FIELD_SEL), (el) => promoteFld(el as HTMLInputElement | HTMLTextAreaElement)),
      ...Array.from(within.querySelectorAll(ICON_SEL), (el) => promoteIco(el as HTMLImageElement | HTMLElement)),
      ...Array.from(within.querySelectorAll(THEME_PICKER_SEL), (el) => promotePicker(el as HTMLElement)),
    ]);
  };

  // Wire `[data-scriptoscope-theme-switcher]` controls (the PRD's named front door for runtime themes). A
  // <select> switches on change (option values = theme refs); any other element switches on click
  // using its own data-scriptoscope-theme. Uses a DEDICATED stamp (`scriptoscopeSwitcherWired`) — the generic
  // `aaronPromoted` stamp is set by control-promotion on every <select>, which would otherwise
  // skip this wiring (the two concerns are orthogonal: themed appearance vs. event binding).
  const wireThemeSwitchers = (within: Document | Element): void => {
    for (const node of Array.from(within.querySelectorAll('[data-scriptoscope-theme-switcher]'))) {
      const sw = node as HTMLElement;
      if (sw.dataset.scriptoscopeSwitcherWired != null) continue;
      sw.dataset.scriptoscopeSwitcherWired = '';
      if (sw instanceof HTMLSelectElement) {
        sw.addEventListener('change', () => { void retheme(sw.value); });
      } else {
        sw.addEventListener('click', () => { const ref = sw.getAttribute('data-scriptoscope-theme'); if (ref) void retheme(ref); });
      }
    }
  };

  // Boot affordance — set the loading attribute on the consumer's root
  // BEFORE the scan begins so any CSS hooks (chrome wipe-in, dotted
  // picker placeholders, watch cursor) can fire from the absolute start
  // of the boot window. Cleared in the ready dispatch below. 'none' /
  // false suppresses entirely.
  const bootAffordance = opts.bootAffordance;
  const wantsAffordance = bootAffordance !== 'none' && bootAffordance !== false;
  const loadingEl = root instanceof Document ? root.body : root;
  if (loadingEl && wantsAffordance) {
    loadingEl.setAttribute(SCRIPTOSCOPE_LOADING_ATTR, '');
    // Silent-fail defense (a11y reviewer 2026-05-30): if the consumer
    // opted into the affordance but didn't link scriptoscope.css, the
    // attribute does nothing and the visible effect is invisible to
    // everyone — most insidiously to the developer who set the option,
    // because the page LOOKS the same as before. Probe a custom property
    // that only resolves when the stylesheet's :root block was loaded;
    // warn once per mount.
    if (typeof getComputedStyle === 'function') {
      const probe = getComputedStyle(loadingEl).getPropertyValue('--scriptoscope-wipe-duration').trim();
      if (!probe) {
        console.warn(
          '[scriptoscope] bootAffordance is enabled but scriptoscope.css is not loaded — the affordance will not render. ' +
          'Link it via <link rel="stylesheet" href="…/scriptoscope.css"> or set { bootAffordance: "none" } to suppress this warning.',
        );
      }
    }
  }

  // Pre-scan target count for the rejectOnEmptyMount check. Counts what's
  // SCANNABLE before any promote runs (later observer churn doesn't affect
  // the initial-mount-failed signal). Sum across all promotable kinds.
  const initialTargets =
    root.querySelectorAll(WINDOW_SEL).length +
    root.querySelectorAll(BUTTON_SEL).length +
    root.querySelectorAll(CONTROL_SEL).length +
    root.querySelectorAll(TABS_SEL).length +
    root.querySelectorAll(FIELD_SEL).length;
  await scanAndPromote(root);
  wireThemeSwitchers(root);
  // Promotion-failure detector. mountDeclarative's old behavior was to log
  // per-target failures and resolve a "valid" handle anyway — consumers had
  // to probe the DOM (post-mount canvas-existence check) to learn the mount
  // was hollow. Opt in via rejectOnEmptyMount: if the scan found targets
  // but ZERO succeeded, reject so the consumer's await catches it.
  const promotedTotal = stats.windows + stats.buttons + stats.controls + stats.tabs + stats.fields;
  if (opts.rejectOnEmptyMount && initialTargets > 0 && promotedTotal === 0) {
    // Clean up the loading affordance BEFORE throwing — without this, the
    // attribute stays on body forever (consumer has no handle to call
    // disconnect() on) and the CSS hooks fire on any subsequent DOM
    // promote. Lib reviewer 2026-05-30 P1; convergent with a11y reviewer.
    if (loadingEl && wantsAffordance) loadingEl.removeAttribute(SCRIPTOSCOPE_LOADING_ATTR);
    for (const el of inertDuringWipe) el.removeAttribute('inert');
    inertDuringWipe.clear();
    if (key) mountedRoots.delete(key);
    throw new Error(
      `[scriptoscope] mountDeclarative: scan found ${initialTargets} promotable target(s) but ZERO succeeded. ` +
      'Common causes: misconfigured themeBaseUrl, theme bundle 404s, or a decoder error. ' +
      'Check the network tab + console errors above. (Use { rejectOnEmptyMount: false } to suppress this throw.)'
    );
  }
  // Add the .scriptoscope-ready class to the consumer's root (or document body
  // for the default no-`root` case). Consumer CSS can scope off this to hide
  // bare-HTML pre-mount fallbacks without managing a custom class:
  //   .scriptoscope-ready .pre-mount-loading { display: none; }
  // Removed in disconnect().
  const readyEl = root instanceof Document ? root.body : root;
  if (readyEl) readyEl.classList.add(SCRIPTOSCOPE_READY_CLASS);

  // ── autoCycle (T2.3, retimed in T4.1) — step through themes on a timer
  // until first user interaction. Suppressed when:
  //   - opts.autoCycle is falsy (default)
  //   - opts.themes is empty (nothing to cycle through)
  //   - the user came in via a syncToUrlParam deep-link (they chose a scheme)
  //   - prefers-reduced-motion (accessibility — we're a tool, not a slideshow)
  //
  // The setTimeout below ARMS during ready dispatch (not at mount-return as
  // it did pre-T4.1) — the perceived-perf reviewer caught the race: today
  // mountDeclarative returned and the timer queued IMMEDIATELY, so the
  // first cycle tick (4s) fired while the page was still settling AND
  // while the user was still reading the lede. Gating arm on `ready` means
  // autoCycle's countdown starts only after initial scan + ready event,
  // so the user gets the documented `autoCycle` ms of un-interrupted page
  // before the first theme swap. Independent of the boot affordance work
  // — this is a real bug fix.
  let cycleTimer: ReturnType<typeof setTimeout> | null = null;
  let cycleStopped = false;
  const stopCycle = (): void => {
    cycleStopped = true;
    if (cycleTimer != null) { clearTimeout(cycleTimer); cycleTimer = null; }
  };
  const shouldAutoCycle =
    !!opts.autoCycle && !!opts.themes?.length && !cameViaDeepLink &&
    typeof matchMedia !== 'undefined' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let armAutoCycle: (() => void) | null = null;
  if (shouldAutoCycle) {
    const cycleRoot = root instanceof Document ? root : root;
    const onInteract = (): void => stopCycle();
    cycleRoot.addEventListener('pointerdown', onInteract, { once: true });
    cycleRoot.addEventListener('keydown', onInteract, { once: true });
    cycleRoot.addEventListener('wheel', onInteract, { once: true, passive: true });
    const themes = opts.themes!;
    let idx = themes.findIndex((t) => t.slug === (lastThemeRef ?? pageDefault));
    if (idx < 0) idx = 0;
    const tick = async (): Promise<void> => {
      if (cycleStopped) return;
      idx = (idx + 1) % themes.length;
      const next = themes[idx];
      if (!next) return;
      try { await retheme(next.slug); } catch { /* tolerate one bad theme */ }
      if (!cycleStopped) cycleTimer = setTimeout(() => { void tick(); }, opts.autoCycle);
    };
    // Re-check cycleStopped at arm time — an edge case the lib reviewer
    // caught 2026-05-30: a consumer that `await mountDeclarative(...)`s
    // and synchronously calls `handle.disconnect()` would race the ready
    // microtask. By the time armAutoCycle ran, cycleStopped was true, but
    // we still scheduled a setTimeout whose closure tick() then no-op'd.
    // Cheap to skip the dangling timer outright.
    armAutoCycle = () => {
      if (cycleStopped) return;
      cycleTimer = setTimeout(() => { void tick(); }, opts.autoCycle);
    };
  }

  // 'ready' fires after the initial scan + .scriptoscope-ready marker.
  // Subscribers get the final first-pass stats; later scans (observer-
  // driven) increment stats without firing 'ready' again.
  // Also: this is where autoCycle's first tick gets queued + the boot
  // affordance is torn down (next commit) — both gated on the page being
  // genuinely settled, not just mountDeclarative returning.
  queueMicrotask(() => {
    // Tear down the boot affordance — CSS hooks scoped off this attribute
    // (chrome wipe-in, dotted placeholders, watch cursor) all stop firing
    // the moment it's removed. Consumer's CSS sees `data-scriptoscope-ready`
    // (the class) and the absence of `data-scriptoscope-loading` together.
    if (loadingEl && wantsAffordance) loadingEl.removeAttribute(SCRIPTOSCOPE_LOADING_ATTR);
    // Lift the wipe-window `inert` so promoted hosts become interactive
    // again. Pairs with markInertIfWiping above; only removes inert we
    // added (the Set tracks them). Runs in the same microtask as the
    // loading-attr removal so the keyboard-focus race window closes
    // synchronously with the visual wipe ending. A11y reviewer P1.
    for (const el of inertDuringWipe) el.removeAttribute('inert');
    inertDuringWipe.clear();
    dispatch('ready', { stats });
    if (armAutoCycle) armAutoCycle();
  });

  // Promote dynamically-added elements. Coalesce bursts to a microtask; the full re-scan is
  // idempotent (stamps), so we don't need to diff records precisely. Reset `scheduled` in a
  // .finally() so an unexpected throw from scanAndPromote/wireThemeSwitchers doesn't permanently
  // freeze the observer (fix from 2026-05-28 review — defensive against future regressions).
  let scheduled = false;
  const obs = new MutationObserver((records) => {
    if (scheduled) return;
    // Walk records and collect ONLY the added Element subtrees (not the
    // whole root). On a busy host page — CMS with rotating banners,
    // tooltips, modals — the prior "rescan root" path triggered the
    // entire promote pipeline on every unrelated DOM mutation, doing
    // ~free work via stamps but burning a measurable querySelectorAll
    // budget per mutation. Scoped rescan: do work proportional to what
    // actually changed (T3.3 from the lib-reviewer audit).
    const subtrees: Element[] = [];
    for (const r of records) {
      for (const n of Array.from(r.addedNodes)) {
        if (!(n instanceof Element)) continue;
        if (n.closest('.scriptoscope-window')) continue; // our own chrome churn
        subtrees.push(n);
      }
    }
    if (subtrees.length === 0) return;
    scheduled = true;
    queueMicrotask(() => {
      // Promise.all rather than sequential — each subtree scan is
      // independent. wireThemeSwitchers still runs at root because the
      // theme-switcher binding is page-scope (only one usually).
      void Promise.all(subtrees.map((s) => scanAndPromote(s)))
        .then(() => wireThemeSwitchers(root))
        .finally(() => { scheduled = false; });
    });
  });
  const target = root instanceof Document ? (root.body ?? root.documentElement) : root;
  if (target) obs.observe(target, { childList: true, subtree: true });

  // Full teardown: stop watching AND unmount every promoted window (restores its content + the
  // original element, disconnects its ResizeObserver). NB: skinned buttons aren't restored to their
  // original elements (the window's content, incl. the skinned button, is moved back as-is).
  // Also note: declarative elements added INSIDE an already-promoted window's content are not
  // promoted (the observer ignores `.scriptoscope-window` subtrees) — a documented current-shape limitation.
  const teardownPersistence = (): void => {
    unsubCrossTab?.();
    manager.setChangeListener(undefined);
  };

  // MountHandle IS the EventTarget instance with the extra methods spliced
  // onto it. Cleaner than Object.create + proto juggling — the addEventListener
  // / dispatchEvent already exist on `events`; we add disconnect/retheme/etc.
  // and cast. Consumers can `handle.addEventListener('ready', cb)` directly.
  const handle = events as unknown as MountHandle;
  Object.assign(handle, {
    disconnect: () => {
      teardownPersistence();
      obs.disconnect();
      stopCycle();
      // Picker teardowns: disconnect every promoted picker's IntersectionObserver
      // + clear its in-flight decode queue. Before this, an SPA that
      // mount/unmount-cycled leaked one IO + N tile refs per cycle (the IO
      // pinned the tile DOM nodes the picker had built, even after the
      // consumer ripped the picker out of the document). Lib reviewer P1
      // 2026-05-30. Errors don't propagate — a flaky teardown shouldn't
      // block the rest of disconnect.
      for (const t of pickerTeardowns.splice(0)) { try { t(); } catch { /* swallow */ } }
      // Lift any wipe-window inert that's still active (the edge: consumer
      // disconnect()s before the ready microtask runs, e.g. aborted boot).
      for (const el of inertDuringWipe) el.removeAttribute('inert');
      inertDuringWipe.clear();
      for (const w of mounted.splice(0)) w.unmount();
      dispatch('unmounted');
      // Restore inline min-height on every ancestor we pinned during scan.
      // Children are now back in flow (unmount moves them back), so the
      // ancestor's natural height returns — releasing the pin lets the
      // consumer's stylesheet take over again.
      for (const [anc, prior] of pinnedAncestors) anc.style.minHeight = prior;
      pinnedAncestors.clear();
      // Drop the published ready marker + loading attribute before
      // releasing the guard so consumer CSS sees the un-ready state
      // during teardown. (Loading attr is normally cleared in the ready
      // dispatch path; this covers the edge where disconnect fires
      // before ready, e.g. an aborted boot.)
      if (readyEl) readyEl.classList.remove(SCRIPTOSCOPE_READY_CLASS);
      if (loadingEl) loadingEl.removeAttribute(SCRIPTOSCOPE_LOADING_ATTR);
      // Release the re-entrant guard so the consumer can mountDeclarative
      // again on the same root (intentional teardown + remount pattern).
      if (key) mountedRoots.delete(key);
    },
    /** Switch the whole desktop (all windows + skinned buttons) to a theme ref at runtime. */
    retheme,
    /** Pre-seed the resolver cache so a subsequent `retheme(ref)` (incl. via
     *  `<select data-scriptoscope-theme-switcher>`) finds the pre-loaded theme. Used by drop-zones
     *  to make a decoded `.sit`/`.rsrc` switchable as if it were a bundle on disk. */
    registerTheme: (ref: string, theme: LoadedTheme) => resolver.register(ref, theme),
    stats,
  });
  if (key) mountedRoots.set(key, handle);
  return handle;
}
