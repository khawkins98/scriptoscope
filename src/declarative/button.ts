// Promote a `data-aaron-button` element into a themed button. We skin, we don't steal: the original
// element is HIDDEN in place (not detached) so its form association — submit/reset, `<form>` wiring —
// and its listeners all keep working; the skinned control simply forwards clicks to it.

import type { LoadedTheme } from '../types.js';
import { interactiveButton } from '../interactive.js';
import { parseButtonAttrs } from './parse.js';

export async function promoteButton(el: HTMLElement, theme: LoadedTheme): Promise<HTMLElement> {
  const parsed = parseButtonAttrs(el.dataset as Record<string, string | undefined>, el.textContent ?? '');
  el.dataset.aaronPromoted = '';
  const skinned = await interactiveButton(theme, {
    default: parsed.isDefault, // the OK ring (falls back to baseline button if the theme ships none)
    disabled: parsed.disabled,
    ...(parsed.label != null ? { label: parsed.label } : {}),
    // Forward to the original — still in the DOM, so a `type=submit`/`reset` inside a <form> works.
    onClick: () => {
      if (typeof (el as HTMLButtonElement).click === 'function') el.click();
      else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
  });
  const aria = el.getAttribute('aria-label') ?? parsed.label;
  if (aria) skinned.setAttribute('aria-label', aria);
  skinned.dataset.aaronPromoted = '';
  el.style.display = 'none'; // keep it (form association/listeners) but invisible
  el.after(skinned);
  return skinned;
}
