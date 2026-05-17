import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyControlChrome } from './applyControlChrome.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

const theme: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'normal-button':   { asset: 'cicns/btn-normal.png',   width: 60, height: 18 },
    'pressed-button':  { asset: 'cicns/btn-pressed.png',  width: 60, height: 18 },
    'disabled-button': { asset: 'cicns/btn-disabled.png', width: 60, height: 18 },
    'focused-button':  { asset: 'cicns/btn-focused.png',  width: 60, height: 18 },
    'cb-off-normal':   { asset: 'cicns/cb-off.png',  width: 12, height: 12 },
    'cb-on-normal':    { asset: 'cicns/cb-on.png',   width: 12, height: 12 },
  },
};

const stdMap = {
  normal:   'normal-button',
  pressed:  'pressed-button',
  disabled: 'disabled-button',
  focused:  'focused-button',
};

let el: HTMLElement;
let teardowns: Array<() => void> = [];

/**
 * MutationObserver delivers records asynchronously (at the end of the
 * current task as a microtask). Tests that mutate attributes and expect
 * re-render need to yield first.
 */
async function flushMutations(): Promise<void> {
  // Two cycles: one to let the observer's microtask drain, one to let
  // any follow-up render-induced microtasks finish.
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

function track(fn: () => void): () => void {
  teardowns.push(fn);
  return fn;
}

beforeEach(() => {
  themeRegistry.reset();
  themeRegistry.replace(theme);
  el = document.createElement('div');
  document.body.appendChild(el);
});

afterEach(() => {
  while (teardowns.length) teardowns.pop()!();
  el.remove();
  themeRegistry.reset();
});

describe('applyControlChrome', () => {
  describe('rendering', () => {
    it('applies the normal-state chrome on mount', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      expect(el.style.backgroundImage).toContain('btn-normal.png');
    });

    it('re-renders when data-state changes', async () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      el.setAttribute('data-state', 'pressed');
      await flushMutations();
      expect(el.style.backgroundImage).toContain('btn-pressed.png');
    });

    it('aria-disabled overrides data-state', async () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      el.setAttribute('aria-disabled', 'true');
      await flushMutations();
      expect(el.style.backgroundImage).toContain('btn-disabled.png');
    });

    it('falls back to normal when no slug is mapped for the state', async () => {
      track(applyControlChrome(el, {
        stateChromeMap: { normal: 'normal-button' }, // pressed/disabled/focused absent
      }));
      el.setAttribute('data-state', 'pressed');
      await flushMutations();
      expect(el.style.backgroundImage).toContain('btn-normal.png');
    });

    it('uses checkedStateChromeMap when aria-checked="true"', async () => {
      track(applyControlChrome(el, {
        stateChromeMap:        { normal: 'cb-off-normal' },
        checkedStateChromeMap: { normal: 'cb-on-normal' },
      }));
      expect(el.style.backgroundImage).toContain('cb-off.png');
      el.setAttribute('aria-checked', 'true');
      await flushMutations();
      expect(el.style.backgroundImage).toContain('cb-on.png');
    });

    it('clears chrome when no theme is loaded', () => {
      themeRegistry.reset();
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      expect(el.style.backgroundImage).toBe('');
    });

    it('clears chrome when slug is not in theme catalog', () => {
      track(applyControlChrome(el, {
        stateChromeMap: { normal: 'does-not-exist' },
      }));
      expect(el.style.backgroundImage).toBe('');
    });
  });

  describe('theme subscription', () => {
    it('re-renders on theme change', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      expect(el.style.backgroundImage).toContain('btn-normal.png');

      const alt: Theme = {
        version: THEME_SCHEMA_VERSION,
        chromeElements: {
          'normal-button': { asset: 'cicns/alt-btn.png', width: 60, height: 18 },
        },
      };
      themeRegistry.replace(alt);
      // ThemeRegistry.subscribe listener is synchronous; no microtask needed.
      expect(el.style.backgroundImage).toContain('alt-btn.png');
    });

    it('clears chrome on themeRegistry.replace(null)', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      themeRegistry.replace(null);
      expect(el.style.backgroundImage).toBe('');
    });
  });

  describe('pointer state machine', () => {
    function pointerEvent(type: string, opts: Partial<PointerEventInit> = {}): PointerEvent {
      // jsdom doesn't fully implement PointerEvent constructor in all versions;
      // synthesize via MouseEvent with pointerId stamped on.
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...opts }) as MouseEvent;
      Object.defineProperty(ev, 'pointerId', { value: 1 });
      return ev as unknown as PointerEvent;
    }

    it('pointerdown sets data-state="pressed"', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      el.dispatchEvent(pointerEvent('pointerdown'));
      expect(el.getAttribute('data-state')).toBe('pressed');
    });

    it('pointerup within bounds fires activate and returns to prior state', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      // Stub bounding rect so the pointerup position is "within."
      el.getBoundingClientRect = () => ({
        x: 0, y: 0, width: 100, height: 50, left: 0, right: 100, top: 0, bottom: 50, toJSON: () => ({}),
      });
      el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
      el.dispatchEvent(pointerEvent('pointerup', { clientX: 10, clientY: 10 }));
      expect(onActivate).toHaveBeenCalledTimes(1);
      expect(el.getAttribute('data-state')).toBe('normal');
    });

    it('pointerup outside bounds cancels activate', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      el.getBoundingClientRect = () => ({
        x: 0, y: 0, width: 100, height: 50, left: 0, right: 100, top: 0, bottom: 50, toJSON: () => ({}),
      });
      el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
      el.dispatchEvent(pointerEvent('pointerup', { clientX: 500, clientY: 500 }));
      expect(onActivate).not.toHaveBeenCalled();
      expect(el.getAttribute('data-state')).toBe('normal');
    });

    it('disabled state suppresses pointer events', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      el.setAttribute('aria-disabled', 'true');
      el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
      // data-state stays whatever observer made it (disabled via aria-disabled).
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('interactive: false disables the state machine entirely', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, {
        stateChromeMap: stdMap,
        interactive: false,
        onActivate,
      }));
      el.dispatchEvent(pointerEvent('pointerdown'));
      expect(onActivate).not.toHaveBeenCalled();
      expect(el.getAttribute('data-state')).toBeNull();
    });
  });

  describe('keyboard state machine', () => {
    it('Space fires activate', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('Enter fires activate', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('other keys do nothing', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('disabled suppresses keyboard activation', () => {
      const onActivate = vi.fn();
      track(applyControlChrome(el, { stateChromeMap: stdMap, onActivate }));
      el.setAttribute('aria-disabled', 'true');
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('default activate', () => {
    it('dispatches a click event when no onActivate is provided', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      const handler = vi.fn();
      el.addEventListener('click', handler);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
      el.removeEventListener('click', handler);
    });
  });

  describe('focus state', () => {
    it('focus event sets data-state="focused"', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      el.dispatchEvent(new FocusEvent('focus'));
      expect(el.getAttribute('data-state')).toBe('focused');
    });

    it('blur returns to normal', () => {
      track(applyControlChrome(el, { stateChromeMap: stdMap }));
      el.dispatchEvent(new FocusEvent('focus'));
      el.dispatchEvent(new FocusEvent('blur'));
      expect(el.getAttribute('data-state')).toBe('normal');
    });
  });

  describe('teardown', () => {
    it('detaches listeners + clears chrome on teardown', () => {
      const detach = applyControlChrome(el, { stateChromeMap: stdMap });
      expect(el.style.backgroundImage).toContain('btn-normal.png');
      detach();
      expect(el.style.backgroundImage).toBe('');

      // Subsequent theme changes do not re-render.
      const alt: Theme = {
        version: THEME_SCHEMA_VERSION,
        chromeElements: { 'normal-button': { asset: 'cicns/alt.png', width: 60, height: 18 } },
      };
      themeRegistry.replace(alt);
      expect(el.style.backgroundImage).toBe('');
    });

    it('teardown is idempotent', () => {
      const detach = applyControlChrome(el, { stateChromeMap: stdMap });
      detach();
      expect(() => detach()).not.toThrow();
    });

    it('pointer events post-teardown do nothing', () => {
      const onActivate = vi.fn();
      const detach = applyControlChrome(el, { stateChromeMap: stdMap, onActivate });
      detach();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onActivate).not.toHaveBeenCalled();
    });
  });
});
