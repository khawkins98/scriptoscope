// The declarative scanner: find `data-aaron-window` / `data-aaron-button` elements (+ `.aaron-*`
// class fallbacks) and promote them, then keep promoting elements added later via a MutationObserver.
// Idempotent: promoted elements are stamped `data-aaron-promoted`, so re-scans (incl. the observer
// firing on our OWN DOM moves) skip them and settle.

import { WindowManager } from '../interactive.js';
import { AaronWindow } from './AaronWindow.js';
import { promoteButton } from './button.js';
import { promoteControl } from './control.js';
import { createThemeResolver, type ThemeBootstrapOpts } from './theme.js';
import { resolveThemeRef } from './parse.js';

export interface MountOptions extends ThemeBootstrapOpts {
  /** Where to scan (default `document`). */
  root?: Document | Element;
  /** Theme ref used when no ancestor carries `data-aaron-theme` (default = `baseSlug`). */
  pageThemeDefault?: string;
}

const WINDOW_SEL = '[data-aaron-window], .aaron-window';
const BUTTON_SEL = '[data-aaron-button], .aaron-button';
// Themed checkbox / radio / slider. Auto-promoted page-wide so existing markup picks up themes
// without retrofitting every input; opt-out with data-aaron-control="off" if a consumer wants
// the native control.
const CONTROL_SEL = 'input[type=checkbox]:not([data-aaron-control=off]), input[type=radio]:not([data-aaron-control=off]), input[type=range]:not([data-aaron-control=off])';

/** Scan `root` and promote every declarative element; watch for more. Returns a handle to stop. */
export async function mountDeclarative(opts: MountOptions = {}): Promise<{ disconnect(): void; retheme(ref: string): Promise<void> }> {
  const manager = new WindowManager();
  const resolver = createThemeResolver(opts);
  const pageDefault = opts.pageThemeDefault ?? opts.baseSlug ?? 'apple-platinum-replica';
  const root: Document | Element = opts.root ?? document;
  const inFlight = new Set<Element>();
  const mounted: AaronWindow[] = []; // tracked so disconnect() can fully tear down (unmount + ROs)
  const skinnedButtons: { el: HTMLElement; skinned: HTMLElement }[] = []; // tracked so retheme() re-skins them
  const skinnedControls: { el: HTMLInputElement; skinned: HTMLElement }[] = []; // checkbox/radio/slider
  let cascade = 0;
  let lastThemeRef: string | null = null; // last runtime theme switch — new windows inherit it, not pageDefault

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
      const pos = { x: 24 + cascade * 26, y: 24 + cascade * 26 };
      cascade += 1;
      const aw = await AaronWindow.promote(el, { manager, theme }, pos);
      // Stamp the resolved ref on the host: the original element that carried data-aaron-theme is
      // now removed, so descendant buttons inherit the window's theme via this stamp (not the body).
      aw.host.dataset.aaronTheme = ref;
      mounted.push(aw);
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
    } catch (err) {
      console.error('[aaron] button promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  const promoteCtl = async (el: HTMLInputElement): Promise<void> => {
    if (isPromoted(el)) return;
    inFlight.add(el);
    try {
      const skinned = await promoteControl(el, await resolver.load(refForEl(el)));
      if (skinned) skinnedControls.push({ el, skinned });
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
    await Promise.all([
      ...Array.from(within.querySelectorAll(BUTTON_SEL), (el) => promoteBtn(el as HTMLElement)),
      ...Array.from(within.querySelectorAll(CONTROL_SEL), (el) => promoteCtl(el as HTMLInputElement)),
    ]);
  };

  // Wire `[data-aaron-theme-switcher]` controls (the PRD's named front door for runtime themes). A
  // <select> switches on change (option values = theme refs); any other element switches on click
  // using its own data-aaron-theme. Stamped so re-scans don't double-bind.
  const wireThemeSwitchers = (within: Document | Element): void => {
    for (const node of Array.from(within.querySelectorAll('[data-aaron-theme-switcher]'))) {
      const sw = node as HTMLElement;
      if (sw.dataset.aaronPromoted != null) continue;
      sw.dataset.aaronPromoted = '';
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
  // idempotent (stamps), so we don't need to diff records precisely.
  let scheduled = false;
  const obs = new MutationObserver((records) => {
    if (scheduled) return;
    const relevant = records.some((r) =>
      Array.from(r.addedNodes).some((n) => n instanceof Element && !n.closest('.aw-window')));
    if (!relevant) return; // ignore our own churn inside the chrome
    scheduled = true;
    queueMicrotask(() => { scheduled = false; void scanAndPromote(root).then(() => wireThemeSwitchers(root)); });
  });
  const target = root instanceof Document ? (root.body ?? root.documentElement) : root;
  if (target) obs.observe(target, { childList: true, subtree: true });

  // Full teardown: stop watching AND unmount every promoted window (restores its content + the
  // original element, disconnects its ResizeObserver). NB: skinned buttons aren't restored to their
  // original elements (the window's content, incl. the skinned button, is moved back as-is). v1.
  // Also note: declarative elements added INSIDE an already-promoted window's content are not
  // promoted (the observer ignores `.aw-window` subtrees) — a documented v1 limitation.
  return {
    disconnect: () => {
      obs.disconnect();
      for (const w of mounted.splice(0)) w.unmount();
    },
    /** Switch the whole desktop (all windows + skinned buttons) to a theme ref at runtime. */
    retheme,
  };
}
