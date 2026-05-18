import { beforeEach, describe, expect, it } from 'vitest';
import { composeTopRecipe, composeBottomRecipe, clearRecipeSegments } from './composeRecipeBased.js';
import type { WindowTypeEntry } from '../schema/types.js';

const W = 74;
const H = 25;
const OPTS = { cicnWidth: W, cicnHeight: H, cicnUrl: 'cicns/test.png' };

function makeWindowType(
  edges: { at: number; part: string }[],
  parts: Record<string, [number, number, number, number]> = {},
  side: 'top' | 'bottom' = 'top',
): WindowTypeEntry {
  const partsMap: Record<string, { rect: [number, number, number, number] }> = {};
  for (const [k, v] of Object.entries(parts)) partsMap[k] = { rect: v };
  return {
    chrome: { active: { asset: 'x.png', width: W, height: H, slice: null } } as any,
    edges: { [side]: edges },
    parts: partsMap,
  } as unknown as WindowTypeEntry;
}

describe('composeTopRecipe', () => {
  let el: HTMLDivElement;
  beforeEach(() => { el = document.createElement('div'); });

  it('returns applied=false when there is no top recipe', () => {
    const wt = { chrome: { active: {} }, edges: {}, parts: {} } as unknown as WindowTypeEntry;
    const r = composeTopRecipe(el, wt, OPTS);
    expect(r.applied).toBe(false);
    expect(el.children).toHaveLength(0);
  });

  it('appends one fill div when the recipe has no named parts', () => {
    const wt = makeWindowType([{ at: 0, part: 'p8' }, { at: W, part: 'p9' }]);
    const r = composeTopRecipe(el, wt, OPTS);
    expect(r.applied).toBe(true);
    expect(r.titlePillLeftPx).toBe(0);
    expect(r.titlePillRightPx).toBe(0);
    expect(el.children).toHaveLength(1);
    expect((el.children[0] as HTMLElement).getAttribute('data-aaron-recipe-segment')).toBe('top-fill');
  });

  it('anchors a left-half named part to the left edge in pixels', () => {
    const wt = makeWindowType(
      [{ at: 5, part: 'p0' }, { at: 30, part: 'p8' }],
      // part-0 rect: [9,5,20,16] = 11px wide, centered at x=14.5 (left half of 74-wide cicn)
      { p0: [9, 5, 20, 16] },
    );
    const r = composeTopRecipe(el, wt, OPTS);
    expect(r.applied).toBe(true);
    const named = el.querySelector('[data-aaron-recipe-segment="top-named"]') as HTMLElement;
    expect(named.style.left).toBe('5px');
    expect(named.style.right).toBe('');
    expect(named.style.width).toBe('11px');
    expect(named.style.height).toBe('11px');
  });

  it('anchors a right-half named part to the right edge in pixels', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'p0' },
        { at: 10, part: 'p8' },
        { at: 60, part: 'p1' },
      ],
      {
        p0: [0, 5, 10, 16],  // left half → left-anchored
        p1: [55, 5, 65, 16], // right half (center=60), 10 wide
      },
    );
    const r = composeTopRecipe(el, wt, OPTS);
    expect(r.applied).toBe(true);
    const named = el.querySelectorAll('[data-aaron-recipe-segment="top-named"]');
    expect(named).toHaveLength(2);
    // p1 is right-anchored: offset from right = cicnW - at - rectWidth = 74 - 60 - 10 = 4px
    const right = Array.from(named).find((n) => (n as HTMLElement).style.right !== '') as HTMLElement;
    expect(right.style.right).toBe('4px');
    expect(right.style.left).toBe('');
  });

  it('appends a middle fill spanning between left + right clusters', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'p0' },     // left-anchored named, ends at x=10
        { at: 10, part: 'p8' },    // fill
        { at: 60, part: 'p1' },    // right-anchored named, starts at x=60
      ],
      { p0: [0, 5, 10, 16], p1: [55, 5, 65, 16] },
    );
    const r = composeTopRecipe(el, wt, OPTS);
    expect(r.applied).toBe(true);
    const middle = el.querySelector('[data-aaron-recipe-segment="top-middle-fill"]') as HTMLElement;
    expect(middle).not.toBeNull();
    // left cluster ends at cicn x=10 (rect.right of p0) → middle starts at 10px from left
    expect(middle.style.left).toBe('10px');
    // right cluster starts at cicn x=60 (rect.left of p1) → middle ends at (74-60)=14px from right
    expect(middle.style.right).toBe('14px');
  });

  it('returns title pill bounds matching the middle fill zone in pixels', () => {
    const wt = makeWindowType(
      [{ at: 0, part: 'p0' }, { at: 10, part: 'p8' }, { at: 60, part: 'p1' }],
      { p0: [0, 5, 10, 16], p1: [55, 5, 65, 16] },
    );
    const r = composeTopRecipe(el, wt, OPTS);
    expect(r.titlePillLeftPx).toBe(10);
    expect(r.titlePillRightPx).toBe(14);
  });

  it('clearRecipeSegments removes all recipe children', () => {
    const wt = makeWindowType(
      [{ at: 0, part: 'p0' }, { at: 10, part: 'p8' }, { at: 60, part: 'p1' }],
      { p0: [0, 5, 10, 16], p1: [55, 5, 65, 16] },
    );
    composeTopRecipe(el, wt, OPTS);
    expect(el.children.length).toBeGreaterThan(0);
    // Add a non-recipe child to confirm we leave it alone.
    const sibling = document.createElement('span');
    el.appendChild(sibling);
    clearRecipeSegments(el);
    expect(el.children).toHaveLength(1);
    expect(el.children[0]).toBe(sibling);
  });

  it('composeBottomRecipe returns applied=false when no recipe', () => {
    const wt = { chrome: { active: {} }, edges: {}, parts: {} } as unknown as WindowTypeEntry;
    const r = composeBottomRecipe(el, wt, OPTS);
    expect(r.applied).toBe(false);
  });

  it('composeBottomRecipe anchors named parts to container bottom', () => {
    const wt = makeWindowType(
      [{ at: 0, part: 'p0' }, { at: 10, part: 'p8' }],
      { p0: [0, 22, 10, 25] }, // bottom 3 rows of cicn
      'bottom',
    );
    const r = composeBottomRecipe(el, wt, OPTS);
    expect(r.applied).toBe(true);
    const named = el.querySelector('[data-aaron-recipe-segment="bottom-named"]') as HTMLElement;
    expect(named.style.bottom).toBe('0px'); // cicnHeight (25) - rect.bottom (25) = 0
    expect(named.style.left).toBe('0px');
    expect(named.style.height).toBe('3px');
  });

  it('composeBottomRecipe middle fill samples from cicn bottom rows', () => {
    const wt = makeWindowType(
      [{ at: 0, part: 'p0' }, { at: 10, part: 'p8' }, { at: 60, part: 'p1' }],
      { p0: [0, 22, 10, 25], p1: [55, 22, 65, 25] },
      'bottom',
    );
    const r = composeBottomRecipe(el, wt, OPTS);
    expect(r.applied).toBe(true);
    const middle = el.querySelector('[data-aaron-recipe-segment="bottom-middle-fill"]') as HTMLElement;
    expect(middle).not.toBeNull();
    // backgroundPositionY should be 'bottom' so cicn's bottom rows show.
    expect(middle.style.backgroundPosition).toContain('bottom');
  });

  it('re-applying clears prior segments (idempotent)', () => {
    const wt = makeWindowType(
      [{ at: 0, part: 'p0' }, { at: 10, part: 'p8' }],
      { p0: [0, 5, 10, 16] },
    );
    composeTopRecipe(el, wt, OPTS);
    const firstCount = el.children.length;
    composeTopRecipe(el, wt, OPTS);
    expect(el.children.length).toBe(firstCount);
  });
});
