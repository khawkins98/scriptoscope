// The declarative scanner: find `data-aaron-window` / `data-aaron-button` elements (+ `.aaron-*`
// class fallbacks) and promote them, then keep promoting elements added later via a MutationObserver.
// Idempotent: promoted elements are stamped `data-aaron-promoted`, so re-scans (incl. the observer
// firing on our OWN DOM moves) skip them and settle.

import { WindowManager } from '../interactive.js';
import { AaronWindow } from './AaronWindow.js';
import { promoteButton } from './button.js';
import { promoteControl } from './control.js';
import { promoteField } from './field.js';
import { promoteTabs } from './tabs.js';
import { createThemeResolver, type ThemeBootstrapOpts } from './theme.js';
import { resolveThemeRef } from './parse.js';
import { debug } from '../debug.js';
import {
  readLayout, createDebouncedWriter, onCrossTabUpdate, windowIdFor,
  readHostPosition, type PersistedLayout,
} from './persistence.js';

export interface MountOptions extends ThemeBootstrapOpts {
  /** Where to scan (default `document`). */
  root?: Document | Element;
  /** Theme ref used when no ancestor carries `data-aaron-theme` (default = `baseSlug`). */
  pageThemeDefault?: string;
  /** Opt-in to localStorage layout persistence (closes #165). When set, this mount restores
   *  window positions/sizes/collapsed state from `localStorage.aaron:layout:<persistKey>` on
   *  promotion, then saves on every state change. Cross-tab sync via the `storage` event.
   *  Window identity comes from `data-aaron-window-id` (stable) or DOM ordinal (fallback).
   *  Default `undefined` = persistence disabled (current behavior). Schema details:
   *  `docs/superpowers/specs/2026-05-28-persistence-design.md`. */
  persistKey?: string;
}

const WINDOW_SEL = '[data-aaron-window], .aaron-window';
const BUTTON_SEL = '[data-aaron-button], .aaron-button';
// Themed text fields: native <input type=text|email|...> and <textarea>. OPT-IN via
// [data-aaron-field] (not auto-scan over every text input) because field styling can
// VISUALLY conflict with a consumer's existing stylesheet — checkbox/radio overlays are
// composable, but a CMS may already paint inputs distinctively. Opt-in keeps the
// surprise surface small. See src/declarative/field.ts for the bevel rationale.
const FIELD_SEL = '[data-aaron-field], .aaron-field-attr';
// Themed tab strip wrapper. The interior structure (children with [data-aaron-tab] +
// [data-aaron-panel]) is parsed by promoteTabs itself. Wrapper-level scan keeps the selector
// list flat + lets us re-skin tabs on retheme without re-querying the panels each time.
const TABS_SEL = '[data-aaron-tabs]';
// Themed checkbox / radio / slider / select. Auto-promoted page-wide so existing markup picks up
// themes without retrofitting every input; opt-out per-control with `data-aaron-control="off"` if
// a consumer wants the native chrome. Selects use a transparent-overlay strategy (themed button +
// native `<select>` invisible on top) — the dropdown menu itself stays browser-native for now;
// fully themed via `popup-window` chrome is a follow-up.
const CONTROL_SEL = [
  'input[type=checkbox]:not([data-aaron-control=off])',
  'input[type=radio]:not([data-aaron-control=off])',
  'input[type=range]:not([data-aaron-control=off])',
  'select:not([data-aaron-control=off])',
].join(', ');

/** Scan `root` and promote every declarative element; watch for more. Returns a handle to stop. */
export async function mountDeclarative(opts: MountOptions = {}): Promise<{ disconnect(): void; retheme(ref: string): Promise<void> }> {
  const manager = new WindowManager();
  const resolver = createThemeResolver(opts);
  const pageDefault = opts.pageThemeDefault ?? opts.baseSlug ?? '1138';
  const root: Document | Element = opts.root ?? document;
  const inFlight = new Set<Element>();
  const mounted: AaronWindow[] = []; // tracked so disconnect() can fully tear down (unmount + ROs)
  const skinnedButtons: { el: HTMLElement; skinned: HTMLElement }[] = []; // tracked so retheme() re-skins them
  const skinnedControls: { el: HTMLInputElement | HTMLSelectElement; skinned: HTMLElement }[] = []; // checkbox/radio/slider/select
  const skinnedTabs: HTMLElement[] = []; // tablist wrappers (re-promoted on retheme to swap faces)
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
    (el as HTMLElement).dataset?.aaronPromoted != null || inFlight.has(el);

  // Nearest-ancestor-wins theme ref for an element (walk ancestors collecting data-aaron-theme).
  const refForEl = (el: Element): string => {
    const chain: (string | null)[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) chain.unshift(n.getAttribute('data-aaron-theme'));
    // After a runtime theme switch, windows added later with no explicit data-aaron-theme follow the
    // live theme (lastThemeRef), so the desktop stays consistent; before any switch, the page default.
    const fallback = lastThemeRef ?? pageDefault;
    return resolveThemeRef(chain, fallback) ?? fallback;
  };

  const promoteWindow = async (el: HTMLElement): Promise<void> => {
    if (isPromoted(el) || el.closest('.aw-window')) return; // skip done / nested-in-chrome
    inFlight.add(el);
    try {
      const ref = refForEl(el);
      const theme = await resolver.load(ref);
      // Resolve persistence identity + restored geometry BEFORE promotion. If persistedWindows has
      // an entry for this id, apply the saved x/y/w/h/collapsed via temporary data attrs so
      // AaronWindow.promote's existing parseWindowAttrs picks them up. Original attrs are restored
      // on unmount via AaronWindow.restore (no change there).
      const ord = promoteOrdinal++;
      const id = persistKey ? windowIdFor(el, ord) : '';
      const persisted = persistKey && id ? persistedWindows[id] : undefined;
      const pos = persisted && persisted.x != null && persisted.y != null
        ? { x: persisted.x, y: persisted.y }
        : { x: 24 + cascade * 26, y: 24 + cascade * 26 };
      if (!persisted) cascade += 1; // only consume cascade for non-restored windows
      // Apply saved geometry via data attrs so AaronWindow's parseWindowAttrs picks them up.
      // PERSISTED state takes precedence over declared data-aaron-* (the consumer's declared
      // values are the BOOT defaults; persisted state is "where the user last left it"). This
      // intentionally overrides the consumer's declared x/y/w/h. Document this in the persistence
      // proposal: declared attrs = first-boot defaults; persisted state = the user's last layout.
      if (persisted) {
        if (persisted.x != null) el.dataset.aaronX = String(persisted.x);
        if (persisted.y != null) el.dataset.aaronY = String(persisted.y);
        if (persisted.w != null) el.dataset.aaronWidth = String(persisted.w);
        if (persisted.h != null) el.dataset.aaronHeight = String(persisted.h);
        if (persisted.collapsed) el.dataset.aaronCollapsed = '';
      }
      const aw = await AaronWindow.promote(el, { manager, theme }, pos);
      aw.host.dataset.aaronTheme = ref;
      if (id) idForHost.set(aw.host, id);
      mounted.push(aw);
      debug('promote', `window: ${el.dataset.aaronTitle ?? '(untitled)'}`, { theme: ref, x: pos.x, y: pos.y, restored: !!persisted });
    } catch (err) {
      console.error('[aaron] window promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteBtn = async (el: HTMLElement): Promise<void> => {
    if (isPromoted(el)) return; // buttons inside window content ARE wanted, so don't skip on .aw-window
    inFlight.add(el);
    try {
      const skinned = await promoteButton(el, await resolver.load(refForEl(el)));
      skinnedButtons.push({ el, skinned });
      debug('promote', `button: ${el.textContent?.trim().slice(0, 30) ?? ''}`);
    } catch (err) {
      console.error('[aaron] button promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteTabsEl = async (el: HTMLElement): Promise<void> => {
    if (el.dataset.aaronTabsPromoted != null) return;
    inFlight.add(el);
    try {
      await promoteTabs(el, await resolver.load(refForEl(el)));
      skinnedTabs.push(el);
    } catch (err) {
      console.error('[aaron] tabs promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteFld = async (el: HTMLInputElement | HTMLTextAreaElement): Promise<void> => {
    if (el.dataset.aaronFieldPromoted != null) return;
    inFlight.add(el);
    try {
      promoteField(el, await resolver.load(refForEl(el)));
    } catch (err) {
      console.error('[aaron] field promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteCtl = async (el: HTMLInputElement | HTMLSelectElement): Promise<void> => {
    if (isPromoted(el)) return;
    inFlight.add(el);
    try {
      const skinned = await promoteControl(el, await resolver.load(refForEl(el)));
      if (skinned) skinnedControls.push({ el, skinned });
      debug('promote', `control: ${el.tagName.toLowerCase()}${el.type ? `[type=${el.type}]` : ''}`);
    } catch (err) {
      console.error('[aaron] control promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  // Runtime theme switch: re-skin the whole desktop AND every promoted button with one scheme — a
  // system-wide Kaleidoscope theme change overrides per-window themes. The persistent window content
  // survives the chrome re-render; buttons are re-skinned (the new skinned face replaces the old).
  const retheme = async (ref: string): Promise<void> => {
    lastThemeRef = ref;
    const theme = await resolver.load(ref);
    await manager.retheme(theme);
    // Drop buttons whose window was closed — unmount moved their content (incl. the skinned face) back
    // out of any .aw-window, so re-skinning them would re-inject a face into the restored consumer DOM.
    // `isConnected` (not `.closest('.aw-window')`) is the load-bearing filter: `closest` walks even
    // detached subtrees and would keep entries whose window was removed via `.aw-window.remove()`.
    const live = skinnedButtons.filter((b) => b.skinned.isConnected);
    skinnedButtons.length = 0; skinnedButtons.push(...live);
    for (const b of skinnedButtons) {
      try {
        const fresh = await promoteButton(b.el, theme); // inserts the new face right after el…
        b.skinned.remove();                              // …then drop the previous one
        b.skinned = fresh;
      } catch (err) { console.error('[aaron] button re-skin failed:', err); }
    }
    // Re-skin tabs: drop orphans (whose wrapper was closed/removed), then re-promote each in
    // place with forceRescan so the canvas faces are rebuilt against the new theme. The native
    // <button>s and panels stay put — only the skinned spans + ARIA + tabindex are rewritten.
    const liveTabs = skinnedTabs.filter((el) => el.isConnected);
    skinnedTabs.length = 0; skinnedTabs.push(...liveTabs);
    for (const tabsEl of skinnedTabs) {
      try {
        // Strip the old skinned siblings before re-promoting so we don't accumulate them.
        for (const old of Array.from(tabsEl.querySelectorAll(':scope > [data-aaron-tab-skinned]'))) old.remove();
        // Restore the native buttons' visibility + clear promoted flag so promoteTabs sees them
        // again and can re-decide skinned vs CSS fallback under the new theme.
        for (const btn of Array.from(tabsEl.querySelectorAll<HTMLElement>(':scope > [data-aaron-tab]'))) {
          btn.style.display = '';
          delete btn.dataset.aaronPromoted;
          delete btn.dataset.aaronTabFallback;
        }
        delete tabsEl.dataset.aaronTabsPromoted;
        await promoteTabs(tabsEl, theme, { forceRescan: true });
      } catch (err) { console.error('[aaron] tabs re-skin failed:', err); }
    }
    // Same dance for promoted checkbox/radio/slider controls: drop orphans, then re-skin each in
    // place. clear the promoted stamp first so promoteControl will re-promote (it self-guards).
    const liveCtls = skinnedControls.filter((c) => c.skinned.isConnected); // same isConnected fix as buttons
    skinnedControls.length = 0; skinnedControls.push(...liveCtls);
    for (const c of skinnedControls) {
      try {
        delete c.el.dataset.aaronPromoted;
        const fresh = await promoteControl(c.el, theme);
        if (fresh) { c.skinned.remove(); c.skinned = fresh; }
      } catch (err) { console.error('[aaron] control re-skin failed:', err); }
    }
  };

  // Windows in DOCUMENT ORDER, sequentially, so the first declared window becomes the active one
  // deterministically (WindowManager focus follows add-order). This moves window content — including
  // any buttons — into the chrome; THEN promote buttons anywhere (now in their final location),
  // concurrently. Stamps make this safe to run repeatedly.
  const scanAndPromote = async (within: Document | Element): Promise<void> => {
    for (const el of Array.from(within.querySelectorAll(WINDOW_SEL))) await promoteWindow(el as HTMLElement);
    // Tabs FIRST among the in-window controls — the button promotion later will skip any tab
    // <button> because promoteTabs stamps them with data-aaron-promoted.
    for (const el of Array.from(within.querySelectorAll(TABS_SEL))) await promoteTabsEl(el as HTMLElement);
    await Promise.all([
      ...Array.from(within.querySelectorAll(BUTTON_SEL), (el) => promoteBtn(el as HTMLElement)),
      ...Array.from(within.querySelectorAll(CONTROL_SEL), (el) => promoteCtl(el as HTMLInputElement | HTMLSelectElement)),
      ...Array.from(within.querySelectorAll(FIELD_SEL), (el) => promoteFld(el as HTMLInputElement | HTMLTextAreaElement)),
    ]);
  };

  // Wire `[data-aaron-theme-switcher]` controls (the PRD's named front door for runtime themes). A
  // <select> switches on change (option values = theme refs); any other element switches on click
  // using its own data-aaron-theme. Uses a DEDICATED stamp (`aaronSwitcherWired`) — the generic
  // `aaronPromoted` stamp is set by control-promotion on every <select>, which would otherwise
  // skip this wiring (the two concerns are orthogonal: themed appearance vs. event binding).
  const wireThemeSwitchers = (within: Document | Element): void => {
    for (const node of Array.from(within.querySelectorAll('[data-aaron-theme-switcher]'))) {
      const sw = node as HTMLElement;
      if (sw.dataset.aaronSwitcherWired != null) continue;
      sw.dataset.aaronSwitcherWired = '';
      if (sw instanceof HTMLSelectElement) {
        sw.addEventListener('change', () => { void retheme(sw.value); });
      } else {
        sw.addEventListener('click', () => { const ref = sw.getAttribute('data-aaron-theme'); if (ref) void retheme(ref); });
      }
    }
  };

  await scanAndPromote(root);
  wireThemeSwitchers(root);

  // Promote dynamically-added elements. Coalesce bursts to a microtask; the full re-scan is
  // idempotent (stamps), so we don't need to diff records precisely. Reset `scheduled` in a
  // .finally() so an unexpected throw from scanAndPromote/wireThemeSwitchers doesn't permanently
  // freeze the observer (fix from 2026-05-28 review — defensive against future regressions).
  let scheduled = false;
  const obs = new MutationObserver((records) => {
    if (scheduled) return;
    const relevant = records.some((r) =>
      Array.from(r.addedNodes).some((n) => n instanceof Element && !n.closest('.aw-window')));
    if (!relevant) return; // ignore our own churn inside the chrome
    scheduled = true;
    queueMicrotask(() => {
      void scanAndPromote(root)
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
  // promoted (the observer ignores `.aw-window` subtrees) — a documented current-shape limitation.
  const teardownPersistence = (): void => {
    unsubCrossTab?.();
    manager.setChangeListener(undefined);
  };

  return {
    disconnect: () => {
      teardownPersistence();
      obs.disconnect();
      for (const w of mounted.splice(0)) w.unmount();
    },
    /** Switch the whole desktop (all windows + skinned buttons) to a theme ref at runtime. */
    retheme,
  };
}
