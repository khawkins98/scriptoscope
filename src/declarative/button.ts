// Promote a `data-aaron-button` element into a themed button. The original element is replaced by
// the skinned control but kept (detached) so its click behaviour still fires — we skin, not steal.

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
    onClick: () => {
      // forward to the original element's behaviour (it's detached but its listeners are intact)
      if (typeof (el as HTMLButtonElement).click === 'function') el.click();
      else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
  });
  const aria = el.getAttribute('aria-label') ?? parsed.label;
  if (aria) skinned.setAttribute('aria-label', aria);
  skinned.dataset.aaronPromoted = '';
  el.replaceWith(skinned); // `el` survives in the onClick closure for forwarding
  return skinned;
}
