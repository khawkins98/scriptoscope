// The declarative scanner: find `data-aaron-window` / `data-aaron-button` elements (+ `.aaron-*`
// class fallbacks) and promote them, then keep promoting elements added later via a MutationObserver.
// Idempotent: promoted elements are stamped `data-aaron-promoted`, so re-scans (incl. the observer
// firing on our OWN DOM moves) skip them and settle.

import type { LoadedTheme } from '../types.js';
import { WindowManager } from '../interactive.js';
import { AaronWindow } from './AaronWindow.js';
import { promoteButton } from './button.js';
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

/** Scan `root` and promote every declarative element; watch for more. Returns a handle to stop. */
export async function mountDeclarative(opts: MountOptions = {}): Promise<{ disconnect(): void }> {
  const manager = new WindowManager();
  const resolver = createThemeResolver(opts);
  const pageDefault = opts.pageThemeDefault ?? opts.baseSlug ?? 'apple-platinum-replica';
  const root: Document | Element = opts.root ?? document;
  const inFlight = new Set<Element>();
  let cascade = 0;

  await resolver.preloadFonts();

  const isPromoted = (el: Element): boolean =>
    (el as HTMLElement).dataset?.aaronPromoted != null || inFlight.has(el);

  const themeForEl = async (el: Element): Promise<LoadedTheme> => {
    const chain: (string | null)[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) chain.unshift(n.getAttribute('data-aaron-theme'));
    return resolver.load(resolveThemeRef(chain, pageDefault) ?? pageDefault);
  };

  const promoteWindow = async (el: HTMLElement): Promise<void> => {
    if (isPromoted(el) || el.closest('.aw-window')) return; // skip done / nested-in-chrome
    inFlight.add(el);
    try {
      const theme = await themeForEl(el);
      const pos = { x: 24 + cascade * 26, y: 24 + cascade * 26 };
      cascade += 1;
      await AaronWindow.promote(el, { manager, theme }, pos);
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
      await promoteButton(el, await themeForEl(el));
    } catch (err) {
      console.error('[aaron] button promote failed:', err);
    } finally {
      inFlight.delete(el);
    }
  };

  // Windows first (this moves their content — including any buttons — into the chrome), THEN buttons
  // anywhere (now in their final location). Stamps make this safe to run repeatedly.
  const scanAndPromote = async (within: Document | Element): Promise<void> => {
    await Promise.all(Array.from(within.querySelectorAll(WINDOW_SEL), (el) => promoteWindow(el as HTMLElement)));
    await Promise.all(Array.from(within.querySelectorAll(BUTTON_SEL), (el) => promoteBtn(el as HTMLElement)));
  };

  await scanAndPromote(root);

  // Promote dynamically-added elements. Coalesce bursts to a microtask; the full re-scan is
  // idempotent (stamps), so we don't need to diff records precisely.
  let scheduled = false;
  const obs = new MutationObserver((records) => {
    if (scheduled) return;
    const relevant = records.some((r) =>
      Array.from(r.addedNodes).some((n) => n instanceof Element && !n.closest('.aw-window')));
    if (!relevant) return; // ignore our own churn inside the chrome
    scheduled = true;
    queueMicrotask(() => { scheduled = false; void scanAndPromote(root); });
  });
  const target = root instanceof Document ? (root.body ?? root.documentElement) : root;
  if (target) obs.observe(target, { childList: true, subtree: true });

  return { disconnect: () => obs.disconnect() };
}
