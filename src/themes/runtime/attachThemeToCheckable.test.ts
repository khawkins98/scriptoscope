import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachThemeToCheckable } from './attachThemeToCheckable.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

function makeCheckable(kind: 'checkbox' | 'radio'): {
  label: HTMLLabelElement;
  input: HTMLInputElement;
  chrome: HTMLSpanElement;
} {
  const label = document.createElement('label');
  label.className = `aaron-${kind}`;
  const input = document.createElement('input');
  input.type = kind;
  label.appendChild(input);
  const chrome = document.createElement('span');
  chrome.className = `aaron-${kind}__chrome`;
  label.appendChild(chrome);
  return { label, input, chrome };
}

// Theme with full 3-value × 3-state matrix for both control families.
const themeWithCicns: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'checkboxes-empty-active': { asset: 'cicns/cb-empty-active.png', width: 12, height: 12 },
    'checkboxes-empty-pressed': { asset: 'cicns/cb-empty-pressed.png', width: 12, height: 12 },
    'checkboxes-empty-inactive': { asset: 'cicns/cb-empty-inactive.png', width: 12, height: 12 },
    'checkboxes-checked-active': { asset: 'cicns/cb-checked-active.png', width: 12, height: 12 },
    'checkboxes-checked-pressed': { asset: 'cicns/cb-checked-pressed.png', width: 12, height: 12 },
    'checkboxes-checked-inactive': { asset: 'cicns/cb-checked-inactive.png', width: 12, height: 12 },
    'checkboxes-mixed-active': { asset: 'cicns/cb-mixed-active.png', width: 12, height: 12 },
    'radio-buttons-off-active': { asset: 'cicns/r-off-active.png', width: 12, height: 12 },
    'radio-buttons-on-active': { asset: 'cicns/r-on-active.png', width: 12, height: 12 },
    'radio-buttons-on-inactive': { asset: 'cicns/r-on-inactive.png', width: 12, height: 12 },
  },
};

// Theme without checkbox/radio artwork — should fall back to engine-baseline.
const themeWithoutCicns: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'window-active': { asset: 'cicns/window.png', width: 74, height: 25 },
  },
};

describe('attachThemeToCheckable', () => {
  beforeEach(() => themeRegistry.reset());
  afterEach(() => themeRegistry.reset());

  describe('checkbox', () => {
    it('paints the empty-active cicn when unchecked + enabled', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-empty-active.png")');
      expect(chrome.getAttribute('data-aaron-cicn-loaded')).toBe('');
    });

    it('swaps to the checked-active cicn when checked', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-checked-active.png")');
    });

    it('swaps to inactive cicn when disabled', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      input.disabled = true;
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-empty-inactive.png")');
    });

    it('swaps to pressed cicn when label data-state is pressed', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      label.setAttribute('data-state', 'pressed');
      // Force a render — MutationObserver dispatches asynchronously in jsdom.
      // Use a microtask flush.
      return Promise.resolve().then(() => {
        expect(chrome.style.backgroundImage).toBe('url("cicns/cb-empty-pressed.png")');
      });
    });

    it('uses mixed cicn when input.indeterminate is true', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      input.indeterminate = true;
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-mixed-active.png")');
    });

    it('falls back to checked cicn for mixed when mixed cicn missing', () => {
      const partial: Theme = {
        version: THEME_SCHEMA_VERSION,
        chromeElements: {
          'checkboxes-checked-active': { asset: 'cicns/cb-checked.png', width: 12, height: 12 },
        },
      };
      themeRegistry.replace(partial);
      const { label, input, chrome } = makeCheckable('checkbox');
      input.indeterminate = true;
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-checked.png")');
    });

    it('clears chrome when theme has no checkbox cicns', () => {
      themeRegistry.replace(themeWithoutCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('');
      expect(chrome.hasAttribute('data-aaron-cicn-loaded')).toBe(false);
    });

    it('clears chrome when no theme is loaded', () => {
      const { label, input, chrome } = makeCheckable('checkbox');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('');
      expect(chrome.hasAttribute('data-aaron-cicn-loaded')).toBe(false);
    });

    it('re-paints when the theme changes', () => {
      const { label, input, chrome } = makeCheckable('checkbox');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      themeRegistry.replace(themeWithCicns);
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-empty-active.png")');
      themeRegistry.replace(themeWithoutCicns);
      expect(chrome.style.backgroundImage).toBe('');
    });

    it('teardown clears chrome + unsubscribes', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('checkbox');
      const detach = attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'checkbox' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/cb-empty-active.png")');
      detach();
      expect(chrome.style.backgroundImage).toBe('');
      expect(chrome.hasAttribute('data-aaron-cicn-loaded')).toBe(false);
      // Subsequent theme changes don't reach the detached span.
      themeRegistry.replace(themeWithoutCicns);
      expect(chrome.style.backgroundImage).toBe('');
    });
  });

  describe('radio', () => {
    it('paints the off-active cicn when unchecked + enabled', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('radio');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'radio' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/r-off-active.png")');
    });

    it('swaps to on-active cicn when checked', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('radio');
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'radio' });
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      expect(chrome.style.backgroundImage).toBe('url("cicns/r-on-active.png")');
    });

    it('swaps to on-inactive cicn when checked + disabled', () => {
      themeRegistry.replace(themeWithCicns);
      const { label, input, chrome } = makeCheckable('radio');
      input.checked = true;
      input.disabled = true;
      attachThemeToCheckable({ chromeEl: chrome, input, label, kind: 'radio' });
      expect(chrome.style.backgroundImage).toBe('url("cicns/r-on-inactive.png")');
    });
  });
});
