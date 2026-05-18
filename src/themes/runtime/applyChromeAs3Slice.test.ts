import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeStretchZone,
  applyTitlebarAs3Slice,
  applyBottomEdgeAs3Slice,
  applyVerticalEdgeAs3Slice,
  clear3Slice,
} from './applyChromeAs3Slice.js';
import type { WindowTypeEntry } from '../schema/types.js';

const W = 74;
const H = 25;
const OPTS = { cicnWidth: W, cicnHeight: H, cicnUrl: 'cicns/test.png' };

function makeWindowType(
  edges: {
    top?: { at: number; part: string }[];
    bottom?: { at: number; part: string }[];
    left?: { at: number; part: string }[];
    right?: { at: number; part: string }[];
  },
  parts: Record<string, [number, number, number, number]> = {},
): WindowTypeEntry {
  const partsMap: Record<string, { rect: [number, number, number, number] }> = {};
  for (const [k, v] of Object.entries(parts)) partsMap[k] = { rect: v };
  return {
    chrome: { active: { asset: 'x.png', width: W, height: H, slice: null } } as any,
    edges,
    parts: partsMap,
  } as unknown as WindowTypeEntry;
}

describe('computeStretchZone', () => {
  it('returns null for empty recipe', () => {
    expect(computeStretchZone([], {}, 100)).toBeNull();
  });

  it('returns null when extent is non-positive', () => {
    expect(computeStretchZone([{ at: 0, part: 'p' }], {}, 0)).toBeNull();
  });

  it('returns null when every segment is named', () => {
    expect(
      computeStretchZone(
        [{ at: 0, part: 'p0' }, { at: 50, part: 'p1' }],
        { p0: { rect: [0, 0, 1, 1] }, p1: { rect: [0, 0, 1, 1] } } as any,
        100,
      ),
    ).toBeNull();
  });

  it('returns the widest contiguous fill run', () => {
    const zone = computeStretchZone(
      [
        { at: 0, part: 'p0' },     // named
        { at: 10, part: 'p8' },    // fill 10-20
        { at: 20, part: 'p1' },    // named
        { at: 40, part: 'p8' },    // fill 40-100 (longer)
      ],
      { p0: { rect: [0, 0, 1, 1] }, p1: { rect: [0, 0, 1, 1] } } as any,
      100,
    );
    expect(zone).toEqual({ start: 40, end: 100 });
  });

  it('coalesces adjacent fills of different part codes', () => {
    const zone = computeStretchZone(
      [
        { at: 0, part: 'p0' },     // named
        { at: 25, part: 'p8' },    // fill
        { at: 28, part: 'p6' },    // fill (different code)
        { at: 33, part: 'p5' },    // fill
        { at: 35, part: 'p1' },    // named
      ],
      { p0: { rect: [0, 0, 1, 1] }, p1: { rect: [0, 0, 1, 1] } } as any,
      100,
    );
    expect(zone).toEqual({ start: 25, end: 35 });
  });
});

describe('applyTitlebarAs3Slice', () => {
  let el: HTMLDivElement;
  beforeEach(() => { el = document.createElement('div'); });

  it('returns null + clears on missing recipe', () => {
    const result = applyTitlebarAs3Slice(el, makeWindowType({}), OPTS);
    expect(result).toBeNull();
    expect(el.style.borderImageSource).toBe('');
  });

  it('sets border-image styles when recipe has a fill zone', () => {
    const wt = makeWindowType(
      {
        top: [
          { at: 0, part: 'p0' },
          { at: 25, part: 'p8' },
          { at: 35, part: 'p1' },
        ],
      },
      { p0: [0, 0, 13, 16], p1: [0, 0, 13, 16] },
    );
    const result = applyTitlebarAs3Slice(el, wt, OPTS);
    expect(result).toEqual({ leftSlicePx: 25, rightSlicePx: 39 });
    expect(el.style.borderImageSource).toContain('test.png');
    expect(el.style.borderImageSlice).toContain('0 39 0 25');
    expect(el.style.borderLeftWidth).toBe('25px');
    expect(el.style.borderRightWidth).toBe('39px');
    expect(el.style.borderImageRepeat).toBe('round');
  });

  it('clear3Slice removes all inline border styles', () => {
    const wt = makeWindowType(
      { top: [{ at: 0, part: 'p0' }, { at: 25, part: 'p8' }] },
      { p0: [0, 0, 13, 16] },
    );
    applyTitlebarAs3Slice(el, wt, OPTS);
    expect(el.style.borderImageSource).not.toBe('');
    clear3Slice(el);
    expect(el.style.borderImageSource).toBe('');
    expect(el.style.borderImageSlice).toBe('');
    expect(el.style.borderLeftWidth).toBe('');
  });

  it('re-applying is idempotent (clears prior state first)', () => {
    const wt = makeWindowType({ top: [{ at: 0, part: 'p8' }] });
    applyTitlebarAs3Slice(el, wt, OPTS);
    const firstSource = el.style.borderImageSource;
    applyTitlebarAs3Slice(el, wt, OPTS);
    expect(el.style.borderImageSource).toBe(firstSource);
  });
});

describe('applyBottomEdgeAs3Slice', () => {
  let el: HTMLDivElement;
  beforeEach(() => { el = document.createElement('div'); });

  it('appends 3 piece divs (left, middle, right)', () => {
    const wt = makeWindowType(
      {
        bottom: [
          { at: 0, part: 'p0' },
          { at: 2, part: 'p8' },
          { at: 73, part: 'p0' },
        ],
      },
      { p0: [1, 22, 72, 23] },
    );
    applyBottomEdgeAs3Slice(el, wt, OPTS);
    expect(el.children).toHaveLength(3);
    const pieces = Array.from(el.children).map((c) =>
      (c as HTMLElement).getAttribute('data-3slice-piece'),
    );
    expect(pieces).toEqual(['left', 'middle', 'right']);
  });

  it('clears via clear3Slice', () => {
    const wt = makeWindowType({ bottom: [{ at: 0, part: 'p8' }] });
    applyBottomEdgeAs3Slice(el, wt, OPTS);
    expect(el.children.length).toBeGreaterThan(0);
    clear3Slice(el);
    expect(el.children).toHaveLength(0);
  });

  it('middle piece uses repeat-x', () => {
    const wt = makeWindowType(
      { bottom: [{ at: 0, part: 'p0' }, { at: 5, part: 'p8' }, { at: 60, part: 'p1' }] },
      { p0: [0, 0, 1, 1], p1: [0, 0, 1, 1] },
    );
    applyBottomEdgeAs3Slice(el, wt, OPTS);
    const middle = el.querySelector<HTMLElement>('[data-3slice-piece="middle"]')!;
    expect(middle.style.backgroundRepeat).toBe('repeat-x');
  });
});

describe('applyVerticalEdgeAs3Slice', () => {
  let el: HTMLDivElement;
  beforeEach(() => { el = document.createElement('div'); });

  it('left edge samples from cicn column 0', () => {
    const wt = makeWindowType({ left: [{ at: 0, part: 'p8' }] });
    applyVerticalEdgeAs3Slice(el, wt, OPTS, 'left');
    const middle = el.querySelector<HTMLElement>('[data-3slice-piece="middle"]')!;
    // backgroundPositionX is '0' for left edge (jsdom normalizes to '0px').
    expect(['0px', '0']).toContain(middle.style.backgroundPositionX);
    expect(middle.style.backgroundRepeat).toBe('repeat-y');
  });

  it('right edge samples from cicn rightmost column', () => {
    const wt = makeWindowType({ right: [{ at: 0, part: 'p8' }] });
    applyVerticalEdgeAs3Slice(el, wt, OPTS, 'right');
    const middle = el.querySelector<HTMLElement>('[data-3slice-piece="middle"]')!;
    expect(middle.style.backgroundPositionX).toBe(`-${W - 1}px`);
  });

  it('appends top + middle + bottom pieces', () => {
    const wt = makeWindowType({ left: [{ at: 22, part: 'p0' }, { at: 23, part: 'p8' }] });
    applyVerticalEdgeAs3Slice(el, wt, OPTS, 'left');
    const pieces = Array.from(el.querySelectorAll('[data-3slice-piece]'))
      .map((c) => (c as HTMLElement).getAttribute('data-3slice-piece'));
    expect(pieces).toEqual(['top', 'middle', 'bottom']);
  });
});
