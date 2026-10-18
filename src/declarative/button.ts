// Promote a `data-scriptoscope-button` element into a themed button. We skin, we don't steal: the original
// element is HIDDEN in place (not detached) so its form association — submit/reset, `<form>` wiring —
// and its listeners all keep working; the skinned control simply forwards clicks to it.

import type { LoadedTheme } from '../types.js';
import { interactiveButton, disposeInteractiveControl } from '../interactive.js';
import { parseButtonAttrs } from './parse.js';

interface OwnedButton {
  faces: Set<HTMLElement>;
  restoreSource(): void;
}
const ownedButtons = new WeakMap<HTMLElement, OwnedButton>();

// The source remains in place. Restore only display and our promotion stamp;
// newer consumer values and unrelated inline properties/attributes survive.
function hideSourceOwned(el: HTMLElement): () => void {
  const style = el.getAttribute('style');
  const display = el.style.getPropertyValue('display');
  const priority = el.style.getPropertyPriority('display');
  const stamp = el.getAttribute('data-scriptoscope-promoted');
  el.style.display = 'none';
  el.dataset.scriptoscopePromoted = '';
  const appliedStyle = el.getAttribute('style');
  return () => {
    if (el.getAttribute('style') === appliedStyle) {
      if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style);
    } else if (el.style.getPropertyValue('display') === 'none' && el.style.getPropertyPriority('display') === '') {
      if (display) el.style.setProperty('display', display, priority); else el.style.removeProperty('display');
    }
    if (el.getAttribute('data-scriptoscope-promoted') === '') {
      if (stamp === null) el.removeAttribute('data-scriptoscope-promoted'); else el.setAttribute('data-scriptoscope-promoted', stamp);
    }
  };
}

/** Internal scanner ownership: discard only this prepared/replaced face. */
export function disposePromotedButtonFace(el: HTMLElement, face: HTMLElement): void {
  ownedButtons.get(el)?.faces.delete(face);
  disposeInteractiveControl(face);
  face.remove();
}

/** Release all committed faces, including one whose insertion queued an observer
 * before its async scanner caller resumed. Returns whether owned focus needs
 * restoring after enclosing windows have restored their consumer content. */
export function restoreButton(el: HTMLElement): boolean {
  const owned = ownedButtons.get(el);
  if (!owned) return false;
  ownedButtons.delete(el);
  const focused = [...owned.faces].some(face => face.contains(document.activeElement));
  for (const face of owned.faces) { disposeInteractiveControl(face); face.remove(); }
  owned.faces.clear();
  owned.restoreSource();
  return focused;
}

// Direct callers may prepare a disconnected fragment. Scanner-owned promotion supplies
// a lifetime signal and additionally requires a connected source at commit.
export function promoteButton(el: HTMLElement, theme: LoadedTheme): Promise<HTMLElement>;
export function promoteButton(el: HTMLElement, theme: LoadedTheme, signal: AbortSignal): Promise<HTMLElement | null>;
export async function promoteButton(el: HTMLElement, theme: LoadedTheme, signal?: AbortSignal): Promise<HTMLElement | null> {
  return prepareButton(el, theme, signal);
}

/** Internal scanner entry: validate mount/theme ownership at the synchronous
 * commit boundary. This is not re-exported from the public entry point. */
export function promoteOwnedButton(
  el: HTMLElement, theme: LoadedTheme, signal: AbortSignal, canCommit: () => boolean,
): Promise<HTMLElement | null> {
  return prepareButton(el, theme, signal, canCommit);
}

async function prepareButton(
  el: HTMLElement, theme: LoadedTheme, signal?: AbortSignal, canCommit?: () => boolean,
): Promise<HTMLElement | null> {
  if (signal?.aborted) return null;
  const parent = el.parentNode;
  const parsed = parseButtonAttrs(el.dataset as Record<string, string | undefined>, el.textContent ?? '');
  let skinned: HTMLElement;
  try {
    skinned = await interactiveButton(theme, {
      default: parsed.isDefault, // the OK ring (falls back to baseline button if the theme ships none)
      disabled: parsed.disabled || el.matches(':disabled'),
      ...(parsed.label != null ? { label: parsed.label } : {}),
      // Forward to the original — still in the DOM, so a `type=submit`/`reset` inside a <form> works.
      onClick: () => {
        if (typeof (el as HTMLButtonElement).click === 'function') el.click();
        else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      },
    }, signal);
  } catch (error) {
    if (signal?.aborted) return null;
    throw error;
  }
  if (signal && (signal.aborted || !el.isConnected || el.parentNode !== parent || canCommit?.() === false)) {
    disposeInteractiveControl(skinned);
    return null;
  }
  const aria = el.getAttribute('aria-label') ?? parsed.label;
  if (aria) skinned.setAttribute('aria-label', aria);
  skinned.dataset.scriptoscopePromoted = '';
  if (signal) {
    const owned = ownedButtons.get(el) ?? { faces: new Set<HTMLElement>(), restoreSource: () => {} };
    // Refresh the ownership baseline on retheme without overwriting a consumer
    // property change made since the previous commit. No await splits this step.
    owned.restoreSource();
    owned.restoreSource = hideSourceOwned(el);
    owned.faces.add(skinned);
    ownedButtons.set(el, owned); // publish ownership before insertion observers
  } else {
    el.dataset.scriptoscopePromoted = '';
    el.style.display = 'none'; // preserve direct, detached two-argument behavior
  }
  el.after(skinned);
  return skinned;
}
