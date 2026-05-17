import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyChromeElement,
  chromeElementCss,
  clearChromeElement,
} from './applyChromeElement.js';
import type { ChromeElementEntry } from '../schema/types.js';

let el: HTMLElement;

beforeEach(() => {
  el = document.createElement('div');
});

describe('applyChromeElement', () => {
  describe('without slice or tile (static single bitmap)', () => {
    it('sets background-image to the cicn URL', () => {
      applyChromeElement(el, {
        asset: 'http://localhost/themes/x/cicns/button.png',
      });
      expect(el.style.backgroundImage).toBe('url("http://localhost/themes/x/cicns/button.png")');
    });

    it('sets image-rendering: pixelated', () => {
      applyChromeElement(el, { asset: 'a.png' });
      expect(el.style.imageRendering).toBe('pixelated');
    });

    it('sets background-repeat: no-repeat by default', () => {
      applyChromeElement(el, { asset: 'a.png' });
      expect(el.style.backgroundRepeat).toBe('no-repeat');
    });

    it('sets background-size from width/height when present', () => {
      applyChromeElement(el, { asset: 'a.png', width: 100, height: 18 });
      expect(el.style.backgroundSize).toBe('100px 18px');
    });

    it('skips background-size when width/height are absent', () => {
      applyChromeElement(el, { asset: 'a.png' });
      expect(el.style.backgroundSize).toBe('');
    });

    it('respects defaultRepeat: repeat option', () => {
      applyChromeElement(el, { asset: 'a.png' }, { defaultRepeat: 'repeat' });
      expect(el.style.backgroundRepeat).toBe('repeat');
    });
  });

  describe('with cinf slice (9-slice border-image)', () => {
    const entry: ChromeElementEntry = {
      asset: 'btn.png',
      slice: { corner: 4, side: 4, tile: false },
    };

    it('sets border-image-source to the cicn URL', () => {
      applyChromeElement(el, entry);
      expect(el.style.borderImageSource).toBe('url("btn.png")');
    });

    it('sets border-image-slice with fill keyword', () => {
      applyChromeElement(el, entry);
      // jsdom returns this as "4 fill" or "4fill" depending on implementation —
      // accept either by trimming.
      expect(el.style.borderImageSlice.replace(/\s+/g, ' ')).toMatch(/^4 fill$|^4fill$/);
    });

    it('sets border-image-width from cinf.side', () => {
      applyChromeElement(el, entry);
      expect(el.style.borderImageWidth).toBe('4px');
    });

    it('sets border-image-repeat: stretch when cinf.tile is false', () => {
      applyChromeElement(el, entry);
      expect(el.style.borderImageRepeat).toBe('stretch');
    });

    it('sets border-image-repeat: repeat when cinf.tile is true', () => {
      applyChromeElement(el, { ...entry, slice: { corner: 4, side: 4, tile: true } });
      expect(el.style.borderImageRepeat).toBe('repeat');
    });

    it('also sets a transparent solid border so border-image renders', () => {
      applyChromeElement(el, entry);
      expect(el.style.borderStyle).toBe('solid');
      expect(el.style.borderWidth).toBe('4px');
      expect(el.style.borderColor).toBe('transparent');
    });

    it('still sets background-image (slice path is additive)', () => {
      applyChromeElement(el, entry);
      expect(el.style.backgroundImage).toBe('url("btn.png")');
      expect(el.style.backgroundRepeat).toBe('no-repeat');
    });

    it('handles asymmetric corner/side values', () => {
      applyChromeElement(el, {
        asset: 'b.png',
        slice: { corner: 8, side: 4, tile: false },
      });
      expect(el.style.borderImageSlice.replace(/\s+/g, ' ')).toMatch(/^8 fill$|^8fill$/);
      expect(el.style.borderImageWidth).toBe('4px');
      expect(el.style.borderWidth).toBe('4px');
    });
  });

  describe('with tile (periodic pattern)', () => {
    it('sets background-repeat: repeat-x for tile: horizontal', () => {
      applyChromeElement(el, { asset: 'p.png', tile: 'horizontal' });
      expect(el.style.backgroundRepeat).toBe('repeat-x');
    });

    it('sets background-repeat: repeat-y for tile: vertical', () => {
      applyChromeElement(el, { asset: 'p.png', tile: 'vertical' });
      expect(el.style.backgroundRepeat).toBe('repeat-y');
    });

    it('sets background-repeat: repeat for tile: both', () => {
      applyChromeElement(el, { asset: 'p.png', tile: 'both' });
      expect(el.style.backgroundRepeat).toBe('repeat');
    });

    it('does not set border-image when only tile (no slice)', () => {
      applyChromeElement(el, { asset: 'p.png', tile: 'horizontal' });
      expect(el.style.borderImageSource).toBe('');
    });
  });

  describe('idempotency', () => {
    it('applying the same entry twice yields the same styles', () => {
      const entry: ChromeElementEntry = {
        asset: 'a.png',
        slice: { corner: 4, side: 4, tile: false },
      };
      applyChromeElement(el, entry);
      const after1 = el.getAttribute('style');
      applyChromeElement(el, entry);
      const after2 = el.getAttribute('style');
      expect(after2).toBe(after1);
    });
  });

});

describe('chromeElementCss (pure)', () => {
  it('produces the same declarations as applyChromeElement', () => {
    const entry: ChromeElementEntry = {
      asset: 'a.png',
      slice: { corner: 4, side: 4, tile: false },
    };
    const css = chromeElementCss(entry);
    expect(css).toContain('background-image: url("a.png")');
    expect(css).toContain('image-rendering: pixelated');
    expect(css).toContain('border-image-source: url("a.png")');
    expect(css).toContain('border-image-slice: 4 fill');
    expect(css).toContain('border-image-width: 4px');
    expect(css).toContain('border-image-repeat: stretch');
    expect(css).toContain('border-style: solid');
    expect(css).toContain('border-width: 4px');
    expect(css).toContain('border-color: transparent');
    expect(css.endsWith(';')).toBe(true);
  });

  it('omits border-image for non-sliced entries', () => {
    const css = chromeElementCss({ asset: 'p.png', tile: 'both' });
    expect(css).not.toContain('border-image');
    expect(css).toContain('background-repeat: repeat');
  });

  it('includes background-size for static entries with explicit dimensions', () => {
    const css = chromeElementCss({ asset: 'a.png', width: 16, height: 16 });
    expect(css).toContain('background-size: 16px 16px');
  });

  it('escapes double quotes inside asset paths (CSS string-safe)', () => {
    // Defensive — asset paths come from user-supplied bundle JSON, so they
    // shouldn't be trusted to be quote-free. Tested against the pure
    // generator (not via DOM) because jsdom's CSSOM rejects the escaped form
    // entirely rather than normalize it.
    const css = chromeElementCss({ asset: 'cicns/odd "name".png' });
    expect(css).toContain('url("cicns/odd \\"name\\".png")');
  });
});

describe('clearChromeElement', () => {
  it('removes every property applyChromeElement set', () => {
    applyChromeElement(el, {
      asset: 'a.png',
      slice: { corner: 4, side: 4, tile: false },
    });
    expect(el.getAttribute('style')).not.toBe('');
    clearChromeElement(el);
    // jsdom may leave an empty 'style' attribute (vs removing it).
    const styleAttr = el.getAttribute('style') ?? '';
    expect(styleAttr.replace(/\s+/g, '')).toBe('');
  });

  it('is idempotent on a never-applied element', () => {
    expect(() => clearChromeElement(el)).not.toThrow();
  });
});

describe('against canonical bundle fixtures', () => {
  // Realistic shapes from themes/masswerk-7-le/theme.json — verified to make
  // sense after a fresh `node scripts/build-theme-bundles.mjs`. These shouldn't
  // change unless the geometry spec or the extractor's mapping changes.
  it('handles a scrollbar-thumb-like entry (slice with side=0, vertical-only)', () => {
    applyChromeElement(el, {
      asset: 'cicns/cicn-n10208-vertical-thumb.png',
      width: 14,
      height: 22,
      slice: { corner: 8, side: 0, tile: false },
    });
    expect(el.style.borderImageSource).toContain('vertical-thumb.png');
    expect(el.style.borderImageWidth).toBe('0px');
  });

  it('handles a button-like entry (slice with symmetric small corners)', () => {
    applyChromeElement(el, {
      asset: 'cicns/cicn-n10166-normal-off-normal.png',
      slice: { corner: 4, side: 4, tile: false },
    });
    expect(el.style.borderImageSlice.replace(/\s+/g, ' ')).toMatch(/^4 fill$|^4fill$/);
    expect(el.style.borderImageRepeat).toBe('stretch');
  });

  it('handles a barber-pole progress fill (tile: horizontal, no slice)', () => {
    applyChromeElement(el, {
      asset: 'cicns/cicn-n10079-progress-bar-active.png',
      tile: 'horizontal',
    });
    expect(el.style.backgroundRepeat).toBe('repeat-x');
    expect(el.style.borderImageSource).toBe('');
  });
});
