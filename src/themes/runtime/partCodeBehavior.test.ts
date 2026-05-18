import { describe, it, expect } from 'vitest';
import { classifyPartCode, isPinnedBehavior } from './partCodeBehavior.js';

describe('classifyPartCode', () => {
  it('part-0 is always body-marker, even if it exists in the parts table', () => {
    expect(classifyPartCode('part-0', { 'part-0': {} })).toBe('body-marker');
  });

  it('parts in the rectList are named-widget (parts 1-4 in canonical schemes)', () => {
    expect(classifyPartCode('part-1', { 'part-1': {} })).toBe('named-widget');
    expect(classifyPartCode('part-4', { 'part-4': {} })).toBe('named-widget');
  });

  it('parts 5 + 6 are divider sandwich pieces — pinned, not tiled', () => {
    expect(classifyPartCode('part-5', {})).toBe('divider-fill');
    expect(classifyPartCode('part-6', {})).toBe('divider-edge');
  });

  it('parts 8 + 18 are universal-fill (different scheme dialects)', () => {
    expect(classifyPartCode('part-8', {})).toBe('universal-fill');
    expect(classifyPartCode('part-18', {})).toBe('universal-fill');
  });

  it('scheme-variant codes (10, 11, 15, 16, 17) fall to scheme-variant', () => {
    expect(classifyPartCode('part-10', {})).toBe('scheme-variant');
    expect(classifyPartCode('part-15', {})).toBe('scheme-variant');
    expect(classifyPartCode('part-17', {})).toBe('scheme-variant');
  });

  it('unknown high codes fall back to universal-fill', () => {
    expect(classifyPartCode('part-42', {})).toBe('universal-fill');
    expect(classifyPartCode('part-999', {})).toBe('universal-fill');
  });

  it('isPinnedBehavior is true for widgets + dividers, false for fills', () => {
    expect(isPinnedBehavior('named-widget')).toBe(true);
    expect(isPinnedBehavior('divider-edge')).toBe(true);
    expect(isPinnedBehavior('divider-fill')).toBe(true);
    expect(isPinnedBehavior('universal-fill')).toBe(false);
    expect(isPinnedBehavior('scheme-variant')).toBe(false);
    expect(isPinnedBehavior('body-marker')).toBe(false);
  });
});
