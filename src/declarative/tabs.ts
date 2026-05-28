// Themed tab strip — closes #75 (the tabs half; group boxes remain open as the lower-priority
// tail). composeTab() (src/controls.ts) already renders one segmented-tab cicn at a given
// label + selected state; this module is the tablist coordinator: ARIA roles, panel toggling,
// roving-tabindex keyboard nav, and re-skin on retheme.
//
// CONSUMER MARKUP (opt-in via data-aaron-tabs on the wrapper):
//
//   <div data-aaron-tabs>
//     <button data-aaron-tab="t1" data-aaron-selected>Settings</button>
//     <button data-aaron-tab="t2">Appearance</button>
//     <button data-aaron-tab="t3">About</button>
//     <div data-aaron-panel="t1">Settings content…</div>
//     <div data-aaron-panel="t2">Appearance content…</div>
//     <div data-aaron-panel="t3">About content…</div>
//   </div>
//
// Native <button>s are KEPT (display:none) so their form/listener wiring survives; a skinned
// canvas-faced span sits as a sibling and takes focus + clicks, forwarding selection.
// Without `data-aaron-selected`, the first tab is the initial selection.

import type { LoadedTheme } from '../types.js';
import { composeTab, bufferToCanvas } from '../controls.js';
import { debug } from '../debug.js';

const STYLE_ID = 'aaron-tabs-css';

/** One-time stylesheet: layout for the tab strip + CSS fallback styling for the case where
 *  the scheme ships no tab cicn (composeTab → null). */
function ensureTabsCSS(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // The tablist is inline-flex so tabs sit side-by-side without wrap; panels are
  // block-level beneath. Native <button>s carrying data-aaron-tab are hidden, the
  // skinned span sibling carries the visual + focus.
  style.textContent = `
    [data-aaron-tabs] { display: block; }
    [data-aaron-tabs][role="tablist"] > [role="tab"][data-aaron-tab-skinned] {
      display: inline-block; vertical-align: bottom; cursor: pointer; user-select: none;
      line-height: 0; outline-offset: 2px; margin-right: -2px; /* tabs visually overlap their bevels */
    }
    [data-aaron-tabs] > [data-aaron-panel] {
      display: block; padding: 8px 10px; border: 1px solid #888;
      border-top: 1px solid #888; background: #fff;
    }
    [data-aaron-tabs] > [data-aaron-panel][hidden] { display: none; }
    /* CSS fallback when the scheme ships no tab cicn — show the native button with
       segmented-control styling. */
    button[data-aaron-tab][data-aaron-tab-fallback] {
      display: inline-block; font: 13px 'Charcoal', system-ui; padding: 3px 10px 1px;
      background: #ddd; border: 1px solid #888; border-bottom: none;
      border-radius: 5px 5px 0 0; cursor: pointer; margin-right: 2px;
    }
    button[data-aaron-tab][data-aaron-tab-fallback][aria-selected="true"] {
      background: #fff; padding-bottom: 2px; position: relative; z-index: 1;
    }
  `;
  document.head.append(style);
}

/** Resolve a tab element to its target panel id. The value of `data-aaron-tab` IS the panel id
 *  (mirrors the `data-aaron-panel` attribute), so we don't need a separate `data-aaron-tab-target`. */
function panelIdFor(tab: HTMLElement): string {
  return tab.dataset.aaronTab ?? '';
}

/** Promote a [data-aaron-tabs] wrapper. Idempotent — re-promoting a promoted wrapper is a no-op
 *  unless `forceRescan` is true (used by retheme to swap the canvas faces in-place). */
export async function promoteTabs(
  el: HTMLElement, theme: LoadedTheme, opts: { forceRescan?: boolean } = {},
): Promise<void> {
  if (!opts.forceRescan && el.dataset.aaronTabsPromoted != null) return;
  ensureTabsCSS();

  const tabs = Array.from(el.querySelectorAll<HTMLElement>(':scope > [data-aaron-tab]'));
  const panels = Array.from(el.querySelectorAll<HTMLElement>(':scope > [data-aaron-panel]'));
  if (tabs.length === 0) return;

  // Pick the initial selection: explicit data-aaron-selected, else the first tab.
  let selectedId = tabs.find((t) => t.dataset.aaronSelected != null && t.dataset.aaronSelected !== 'false')?.dataset.aaronTab
    ?? tabs[0]?.dataset.aaronTab ?? '';

  el.setAttribute('role', 'tablist');
  el.setAttribute('aria-orientation', 'horizontal');

  // Stamp ids onto tabs + panels so aria-labelledby / aria-controls can cross-reference. We use
  // explicit IDs derived from data-aaron-tab so multiple tablists on a page don't collide.
  const localPrefix = (el.id || 'aaron-tabs') + '-';
  const tabElId = (panelId: string): string => `${localPrefix}tab-${panelId}`;
  const panelElId = (panelId: string): string => `${localPrefix}panel-${panelId}`;
  for (const panel of panels) {
    const id = panel.dataset.aaronPanel ?? '';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabElId(id));
    if (!panel.id) panel.id = panelElId(id);
    panel.hidden = id !== selectedId;
  }

  // Track the skinned faces so we can swap them on selection change + re-skin on retheme.
  const skinned: { tab: HTMLElement; face: HTMLElement; panelId: string }[] = [];

  /** Apply selection — flip ARIA + tabindex on tabs, hide/show panels, and (if available) swap
   *  the canvas face for the new selected state. */
  const setSelected = async (newId: string): Promise<void> => {
    selectedId = newId;
    for (const s of skinned) {
      const isSel = s.panelId === newId;
      s.tab.setAttribute('aria-selected', isSel ? 'true' : 'false');
      s.tab.setAttribute('tabindex', isSel ? '0' : '-1');
      s.face.setAttribute('aria-selected', isSel ? 'true' : 'false');
      s.face.setAttribute('tabindex', isSel ? '0' : '-1');
      // Swap the canvas face if we're using the themed path. CSS fallback uses [aria-selected]
      // selectors on the native button, so no canvas swap needed there.
      if (s.face.tagName === 'SPAN') {
        const buf = await composeTab(theme, { label: s.tab.textContent ?? '', selected: isSel });
        if (buf) s.face.replaceChildren(bufferToCanvas(buf, 1));
      }
    }
    for (const panel of panels) {
      panel.hidden = (panel.dataset.aaronPanel ?? '') !== newId;
    }
  };

  // Build each tab's skinned face. Returns void; populates `skinned` so setSelected can iterate.
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i] as HTMLElement;
    const panelId = panelIdFor(tab);
    const isSel = panelId === selectedId;
    tab.id = tab.id || tabElId(panelId);
    tab.setAttribute('aria-controls', panelElId(panelId));
    const buf = await composeTab(theme, { label: tab.textContent ?? '', selected: isSel });

    let face: HTMLElement;
    if (buf) {
      // Themed path: skinned span carries the canvas; native button is hidden but kept
      // (preserves any form/listener wiring the consumer added).
      face = document.createElement('span');
      face.dataset.aaronTabSkinned = '';
      face.setAttribute('role', 'tab');
      face.setAttribute('aria-selected', isSel ? 'true' : 'false');
      face.setAttribute('aria-controls', panelElId(panelId));
      face.setAttribute('tabindex', isSel ? '0' : '-1');
      const aria = tab.getAttribute('aria-label') ?? tab.textContent ?? '';
      if (aria) face.setAttribute('aria-label', aria);
      face.append(bufferToCanvas(buf, 1));
      tab.style.display = 'none';
      tab.dataset.aaronPromoted = ''; // mark so the button scanner skips it
      tab.after(face);
    } else {
      // CSS fallback: stay on the native button, mark it for the fallback stylesheet.
      tab.dataset.aaronTabFallback = '';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isSel ? 'true' : 'false');
      tab.setAttribute('tabindex', isSel ? '0' : '-1');
      face = tab; // the native button IS the face in fallback
    }

    skinned.push({ tab, face, panelId });
  }

  // Wire click + keyboard on every face. Roving tabindex: only the selected face has tabindex=0,
  // others -1. Left/Right arrows cycle focus (wrap-around). Home/End jump to first/last.
  const focusTabAt = (idx: number): void => {
    const n = skinned.length;
    const i = ((idx % n) + n) % n;
    const target = skinned[i];
    if (!target) return;
    target.face.focus();
    void setSelected(target.panelId);
  };

  for (let i = 0; i < skinned.length; i++) {
    const { face, panelId } = skinned[i] as { face: HTMLElement; panelId: string };
    const myIndex = i;
    face.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      void setSelected(panelId);
      face.focus();
    });
    face.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); focusTabAt(myIndex - 1); break;
        case 'ArrowRight': e.preventDefault(); focusTabAt(myIndex + 1); break;
        case 'Home':       e.preventDefault(); focusTabAt(0); break;
        case 'End':        e.preventDefault(); focusTabAt(skinned.length - 1); break;
        case ' ':
        case 'Enter':      e.preventDefault(); void setSelected(panelId); break;
        default: break;
      }
    });
  }

  el.dataset.aaronTabsPromoted = '';
  debug('promote', `tabs: ${tabs.length} tabs, selected=${selectedId}`);
}
