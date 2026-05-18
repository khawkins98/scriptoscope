import { describe, it, expect } from 'vitest';
import {
  periodWindowConstraints,
  applyConstraintsToElement,
  clearConstraintsFromElement,
} from './periodWindowConstraints.js';
import type { Theme } from '../schema/types.js';

function makeTheme(opts: {
  cicnW: number;
  cicnH: number;
  rich?: boolean;
  hasBodyRect?: boolean;
}): Theme {
  const richRecipe = opts.rich
    ? {
        top: Array.from({ length: 14 }, (_, i) => ({ at: i * 10, part: 'fill-' + i })),
        bottom: Array.from({ length: 8 }, (_, i) => ({ at: i * 10, part: 'fill-' + i })),
        left: Array.from({ length: 8 }, (_, i) => ({ at: i * 10, part: 'fill-' + i })),
        right: Array.from({ length: 8 }, (_, i) => ({ at: i * 10, part: 'fill-' + i })),
      }
    : { top: [{ at: 0, part: 'fill' }] };
  return {
    version: '0.1',
    chromeElements: {
      'doc-chrome': { asset: 'cicns/doc.png', width: opts.cicnW, height: opts.cicnH },
    },
    windowTypes: {
      'document-window': {
        chrome: { active: 'cicns/doc.png' },
        parts: opts.hasBodyRect
          ? { 'part-0': { rect: [10, 10, opts.cicnW - 10, opts.cicnH - 10] } }
          : {},
        edges: richRecipe,
      },
    },
  };
}

describe('periodWindowConstraints', () => {
  it('returns null when no windowType matches', () => {
    const c = periodWindowConstraints(
      { version: '0.1', windowTypes: {} },
      'document-window',
    );
    expect(c).toBeNull();
  });

  it('caps composer-route schemes (rich recipe + body rect) at 1.5× native', () => {
    const c = periodWindowConstraints(makeTheme({ cicnW: 170, cicnH: 170, rich: true, hasBodyRect: true }))!;
    expect(c.minWidth).toBe(170);
    expect(c.minHeight).toBe(170);
    expect(c.maxWidth).toBe(255); // 170 * 1.5
    expect(c.maxHeight).toBe(255);
    expect(c.naturalWidth).toBe(170);
  });

  it('leaves Kind B simple recipes UNBOUNDED on max (9-slice scales cleanly)', () => {
    const c = periodWindowConstraints(makeTheme({ cicnW: 132, cicnH: 64, rich: false, hasBodyRect: true }))!;
    expect(c.minWidth).toBe(132);
    expect(c.minHeight).toBe(64);
    expect(c.maxWidth).toBeUndefined();
    expect(c.maxHeight).toBeUndefined();
  });

  it('treats Kind A thin titlebars as unbounded with period minimum (120×60)', () => {
    const c = periodWindowConstraints(makeTheme({ cicnW: 74, cicnH: 25, rich: false }))!;
    expect(c.minWidth).toBe(120);
    expect(c.minHeight).toBe(60);
    expect(c.maxWidth).toBeUndefined();
    expect(c.naturalWidth).toBe(320);
  });

  it('rich recipe WITHOUT body rect does NOT cap (no composer route)', () => {
    // recipeDensity says rich but no part-0 → routes to 9-slice not composer.
    const c = periodWindowConstraints(makeTheme({ cicnW: 200, cicnH: 200, rich: true, hasBodyRect: false }))!;
    expect(c.maxWidth).toBeUndefined();
  });

  it('applyConstraintsToElement sets inline CSS min/max', () => {
    const el = document.createElement('div');
    applyConstraintsToElement(el, {
      minWidth: 170, minHeight: 170,
      maxWidth: 255, maxHeight: 255,
      naturalWidth: 170, naturalHeight: 170,
    });
    expect(el.style.minWidth).toBe('170px');
    expect(el.style.maxWidth).toBe('255px');
    expect(el.style.minHeight).toBe('170px');
    expect(el.style.maxHeight).toBe('255px');
  });

  it('applyConstraintsToElement leaves max styles empty when unbounded', () => {
    const el = document.createElement('div');
    applyConstraintsToElement(el, {
      minWidth: 120, minHeight: 60,
      naturalWidth: 320, naturalHeight: 200,
    });
    expect(el.style.minWidth).toBe('120px');
    expect(el.style.maxWidth).toBe('');
  });

  it('clearConstraintsFromElement removes all four', () => {
    const el = document.createElement('div');
    applyConstraintsToElement(el, {
      minWidth: 170, minHeight: 170, maxWidth: 255, maxHeight: 255,
      naturalWidth: 170, naturalHeight: 170,
    });
    clearConstraintsFromElement(el);
    expect(el.style.minWidth).toBe('');
    expect(el.style.minHeight).toBe('');
    expect(el.style.maxWidth).toBe('');
    expect(el.style.maxHeight).toBe('');
  });
});
