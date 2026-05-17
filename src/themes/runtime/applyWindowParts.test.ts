import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyWindowParts,
  clearWindowParts,
  windowPartsCss,
} from './applyWindowParts.js';
import type { WindowTypeEntry } from '../schema/types.js';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
});

// jsdom strips trailing zeros from percentage strings ("20.0000%" → "20%"),
// so string-equality assertions are brittle. Parse and compare numerically.
function parsePct(s: string): number {
  return parseFloat(s.replace('%', ''));
}

const docWindow7Le: WindowTypeEntry = {
  // 7 Le's "Document Window" wnd# — chrome cicn is 74x25 px native.
  chrome: { active: 'cicns/active.png', inactive: 'cicns/inactive.png' },
  parts: {
    'part-0': { rect: [1, 22, 72, 23] }, // 1px-tall titlebar bottom edge
    'part-1': { rect: [9, 5, 20, 16] },  // close box (11x11)
    'part-2': { rect: [36, 5, 48, 16] }, // zoom box (12x11)
    'part-3': { rect: [53, 5, 64, 16] }, // windowshade arrow (11x11)
    'part-4': { rect: [28, 3, 29, 19] }, // 1x16 vertical divider
  },
};

describe('applyWindowParts', () => {
  it('mounts one div per part', () => {
    const result = applyWindowParts(container, docWindow7Le, {
      chromeWidth: 74,
      chromeHeight: 25,
    });
    expect(result).toHaveLength(5);
    expect(container.children).toHaveLength(5);
  });

  it('marks each div with data-aaron-window-part + data-part attributes', () => {
    applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    const closeBox = container.querySelector('[data-aaron-window-part="part-1"]') as HTMLElement;
    expect(closeBox).not.toBeNull();
    expect(closeBox.getAttribute('data-part')).toBe('part-1');
    expect(closeBox.getAttribute('data-state')).toBe('normal');
  });

  it('positions each part as a percentage of chrome dimensions', () => {
    applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    const closeBox = container.querySelector('[data-part="part-1"]') as HTMLElement;
    // rect=[9, 5, 20, 16], chrome=74x25
    // left = 9/74 = 12.1622%, top = 5/25 = 20%, width = 11/74 = 14.8649%, height = 11/25 = 44%
    expect(parsePct(closeBox.style.left)).toBeCloseTo(12.1622, 3);
    expect(parsePct(closeBox.style.top)).toBe(20);
    expect(parsePct(closeBox.style.width)).toBeCloseTo(14.8649, 3);
    expect(parsePct(closeBox.style.height)).toBe(44);
  });

  it('sets position: absolute so parts overlay the chrome container', () => {
    applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    for (const child of Array.from(container.children) as HTMLElement[]) {
      expect(child.style.position).toBe('absolute');
    }
  });

  describe('accessibility', () => {
    it('defaults parts to aria-hidden="true" (real buttons elsewhere)', () => {
      applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
      const part = container.firstElementChild!;
      expect(part.getAttribute('aria-hidden')).toBe('true');
      expect(part.getAttribute('role')).toBe(null);
      expect(part.getAttribute('tabindex')).toBe(null);
    });

    it('aria: button gives parts role=button + tabindex=0 (sole interactive)', () => {
      applyWindowParts(container, docWindow7Le, {
        chromeWidth: 74, chromeHeight: 25, aria: 'button',
      });
      const part = container.firstElementChild!;
      expect(part.getAttribute('role')).toBe('button');
      expect(part.getAttribute('tabindex')).toBe('0');
      expect(part.getAttribute('aria-hidden')).toBe(null);
    });
  });

  describe('idempotency', () => {
    it('re-applying replaces prior part divs (no duplicates)', () => {
      applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
      const firstAfter = Array.from(container.children).length;
      applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
      const secondAfter = Array.from(container.children).length;
      expect(secondAfter).toBe(firstAfter);
      expect(secondAfter).toBe(5);
    });

    it('leaves non-part children alone on re-apply', () => {
      const sibling = document.createElement('span');
      sibling.textContent = 'title';
      container.appendChild(sibling);
      applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
      expect(container.contains(sibling)).toBe(true);
      applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
      expect(container.contains(sibling)).toBe(true);
    });
  });

  describe('return value', () => {
    it('returns one WindowPartInfo per part, in declaration order', () => {
      const result = applyWindowParts(container, docWindow7Le, {
        chromeWidth: 74, chromeHeight: 25,
      });
      expect(result.map(p => p.partSlug)).toEqual(['part-0', 'part-1', 'part-2', 'part-3', 'part-4']);
    });

    it('caller can attach event listeners via the returned el reference', () => {
      const result = applyWindowParts(container, docWindow7Le, {
        chromeWidth: 74, chromeHeight: 25,
      });
      let clicked = '';
      for (const { partSlug, el } of result) {
        el.addEventListener('click', () => { clicked = partSlug; });
      }
      const part1 = result.find(p => p.partSlug === 'part-1')!.el;
      part1.click();
      expect(clicked).toBe('part-1');
    });
  });

  describe('edge cases', () => {
    it('returns [] when windowType has no parts', () => {
      const noParts: WindowTypeEntry = { chrome: { active: 'a.png' } };
      const result = applyWindowParts(container, noParts, { chromeWidth: 100, chromeHeight: 50 });
      expect(result).toEqual([]);
      expect(container.children).toHaveLength(0);
    });

    it('returns [] when parts is an empty record', () => {
      const empty: WindowTypeEntry = { chrome: { active: 'a.png' }, parts: {} };
      const result = applyWindowParts(container, empty, { chromeWidth: 100, chromeHeight: 50 });
      expect(result).toEqual([]);
    });

    it('throws when chromeWidth or chromeHeight is non-positive', () => {
      expect(() =>
        applyWindowParts(container, docWindow7Le, { chromeWidth: 0, chromeHeight: 25 }),
      ).toThrow(/must be positive/);
      expect(() =>
        applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: -1 }),
      ).toThrow(/must be positive/);
    });
  });
});

describe('clearWindowParts', () => {
  it('removes every part div added by applyWindowParts', () => {
    applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    expect(container.children).toHaveLength(5);
    clearWindowParts(container);
    expect(container.children).toHaveLength(0);
  });

  it('leaves non-part children alone', () => {
    const sibling = document.createElement('span');
    container.appendChild(sibling);
    applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    clearWindowParts(container);
    expect(container.firstElementChild).toBe(sibling);
  });

  it('is idempotent (no error on empty container)', () => {
    expect(() => clearWindowParts(container)).not.toThrow();
  });
});

describe('windowPartsCss (pure)', () => {
  it('returns one entry per part with percentage strings', () => {
    const css = windowPartsCss(docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    expect(Object.keys(css)).toEqual(['part-0', 'part-1', 'part-2', 'part-3', 'part-4']);
    const p1 = css['part-1']!;
    expect(parsePct(p1.left)).toBeCloseTo(12.1622, 3);
    expect(parsePct(p1.top)).toBe(20);
    expect(parsePct(p1.width)).toBeCloseTo(14.8649, 3);
    expect(parsePct(p1.height)).toBe(44);
  });

  it('returns {} for windowType without parts', () => {
    const noParts: WindowTypeEntry = { chrome: { active: 'a.png' } };
    expect(windowPartsCss(noParts, { chromeWidth: 100, chromeHeight: 50 })).toEqual({});
  });

  it('matches the percentages applyWindowParts writes to the DOM', () => {
    // Both helpers use the same `pct()` internal; assert numerical equality
    // after parsing (jsdom's CSSOM round-trip strips trailing zeros).
    const css = windowPartsCss(docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    applyWindowParts(container, docWindow7Le, { chromeWidth: 74, chromeHeight: 25 });
    const closeBox = container.querySelector('[data-part="part-1"]') as HTMLElement;
    const p1 = css['part-1']!;
    expect(parsePct(closeBox.style.left)).toBe(parsePct(p1.left));
    expect(parsePct(closeBox.style.top)).toBe(parsePct(p1.top));
    expect(parsePct(closeBox.style.width)).toBe(parsePct(p1.width));
    expect(parsePct(closeBox.style.height)).toBe(parsePct(p1.height));
  });
});
