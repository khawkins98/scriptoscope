import { describe, it, expect } from 'vitest';
import { recipeDensity } from './recipeDensity.js';
import type { WindowTypeEntry } from '../schema/types.js';

const partsAllNamed = { 'p-1': { rect: [0, 0, 1, 1] as [number, number, number, number] } };

describe('recipeDensity', () => {
  it('returns "simple" when no edges', () => {
    const wt = { chrome: { active: 'x' } } as WindowTypeEntry;
    expect(recipeDensity(wt)).toBe('simple');
  });

  it('returns "simple" when fills are at the threshold (6)', () => {
    const wt: WindowTypeEntry = {
      chrome: { active: 'x' },
      parts: partsAllNamed,
      edges: {
        top: Array.from({ length: 6 }, (_, i) => ({ at: i, part: 'fill' })),
      },
    };
    expect(recipeDensity(wt)).toBe('simple');
  });

  it('returns "rich" when any edge crosses the threshold (>6)', () => {
    const wt: WindowTypeEntry = {
      chrome: { active: 'x' },
      parts: partsAllNamed,
      edges: {
        top: Array.from({ length: 7 }, (_, i) => ({ at: i, part: 'fill' })),
      },
    };
    expect(recipeDensity(wt)).toBe('rich');
  });

  it('does NOT count named-widget entries toward density', () => {
    // 20 named-widget entries on top, 0 fills — border-image handles widget
    // positioning via parts, so density stays "simple".
    const wt: WindowTypeEntry = {
      chrome: { active: 'x' },
      parts: partsAllNamed,
      edges: {
        top: Array.from({ length: 20 }, (_, i) => ({ at: i, part: 'p-1' })),
      },
    };
    expect(recipeDensity(wt)).toBe('simple');
  });

  it('escalates to "rich" based on the densest edge, not the average', () => {
    const wt: WindowTypeEntry = {
      chrome: { active: 'x' },
      parts: partsAllNamed,
      edges: {
        top: Array.from({ length: 10 }, (_, i) => ({ at: i, part: 'fill' })),
        right: [{ at: 0, part: 'p-1' }],
        bottom: [{ at: 0, part: 'p-1' }],
        left: [{ at: 0, part: 'p-1' }],
      },
    };
    expect(recipeDensity(wt)).toBe('rich');
  });
});
