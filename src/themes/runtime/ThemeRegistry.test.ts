import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { themeRegistry, THEME_CHANGE_EVENT } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

const minimalTheme = (overrides: Partial<Theme> = {}): Theme => ({
  version: THEME_SCHEMA_VERSION,
  ...overrides,
});

describe('themeRegistry', () => {
  beforeEach(() => {
    themeRegistry.reset();
  });

  afterEach(() => {
    themeRegistry.reset();
  });

  describe('current()', () => {
    it('starts null', () => {
      expect(themeRegistry.current()).toBeNull();
    });

    it('returns the active theme after replace()', () => {
      const t = minimalTheme();
      themeRegistry.replace(t);
      expect(themeRegistry.current()).toBe(t);
    });

    it('returns null after replace(null)', () => {
      themeRegistry.replace(minimalTheme());
      themeRegistry.replace(null);
      expect(themeRegistry.current()).toBeNull();
    });
  });

  describe('palette application to :root', () => {
    it('sets --aaron-colr-<key> custom properties from theme.palette', () => {
      themeRegistry.replace(
        minimalTheme({
          palette: { bg: '#cccccc', fg: '#000000', accent: '#316ac5' },
        }),
      );
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-bg')).toBe('#cccccc');
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-fg')).toBe('#000000');
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-accent')).toBe('#316ac5');
    });

    it('clears previous palette keys on replace (no leakage)', () => {
      themeRegistry.replace(minimalTheme({ palette: { bg: '#cccccc', uniqueA: '#ff0000' } }));
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-uniqueA')).toBe('#ff0000');

      themeRegistry.replace(minimalTheme({ palette: { bg: '#000000', uniqueB: '#00ff00' } }));
      // Previous theme's unique key is gone.
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-uniqueA')).toBe('');
      // New theme's keys are set.
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-bg')).toBe('#000000');
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-uniqueB')).toBe('#00ff00');
    });

    it('clears the palette when replace(null) is called', () => {
      themeRegistry.replace(minimalTheme({ palette: { bg: '#cccccc' } }));
      themeRegistry.replace(null);
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-bg')).toBe('');
    });

    it('is a no-op for themes with no palette', () => {
      themeRegistry.replace(minimalTheme());
      // No --aaron-colr-* properties were set.
      const styleStr = document.documentElement.getAttribute('style') ?? '';
      expect(styleStr).not.toContain('--aaron-colr-');
    });
  });

  describe('event dispatch', () => {
    it('dispatches aaron:themechange on document with the new theme', () => {
      const handler = vi.fn();
      document.addEventListener(THEME_CHANGE_EVENT, handler);
      const t = minimalTheme({ name: 'test' });
      themeRegistry.replace(t);
      document.removeEventListener(THEME_CHANGE_EVENT, handler);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0] as CustomEvent;
      expect(event.detail.theme).toBe(t);
    });

    it('dispatches with theme: null on replace(null)', () => {
      themeRegistry.replace(minimalTheme());
      const handler = vi.fn();
      document.addEventListener(THEME_CHANGE_EVENT, handler);
      themeRegistry.replace(null);
      document.removeEventListener(THEME_CHANGE_EVENT, handler);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0] as CustomEvent;
      expect(event.detail.theme).toBeNull();
    });

    it('bubbles', () => {
      const handler = vi.fn();
      window.addEventListener(THEME_CHANGE_EVENT, handler);
      themeRegistry.replace(minimalTheme());
      window.removeEventListener(THEME_CHANGE_EVENT, handler);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe()', () => {
    it('invokes the listener with the new theme', () => {
      const listener = vi.fn();
      const unsubscribe = themeRegistry.subscribe(listener);
      const t = minimalTheme({ name: 'subbed' });
      themeRegistry.replace(t);
      unsubscribe();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(t);
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = themeRegistry.subscribe(listener);
      unsubscribe();
      themeRegistry.replace(minimalTheme());
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const a = vi.fn();
      const b = vi.fn();
      themeRegistry.subscribe(a);
      themeRegistry.subscribe(b);
      themeRegistry.replace(minimalTheme());
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('listeners survive across reset() only if re-subscribed', () => {
      const listener = vi.fn();
      themeRegistry.subscribe(listener);
      themeRegistry.reset();
      themeRegistry.replace(minimalTheme());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reset()', () => {
    it('clears the active theme and palette', () => {
      themeRegistry.replace(minimalTheme({ palette: { bg: '#cccccc' } }));
      themeRegistry.reset();
      expect(themeRegistry.current()).toBeNull();
      expect(document.documentElement.style.getPropertyValue('--aaron-colr-bg')).toBe('');
    });
  });
});
