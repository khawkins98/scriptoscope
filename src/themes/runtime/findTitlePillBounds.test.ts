import { describe, expect, it } from 'vitest';
import { findTitlePillBounds } from './composeWindowChrome.js';
import type { WindowTypeEntry } from '../schema/types.js';

function makeWindowType(
  edges: { at: number; part: string }[],
  parts: string[],
): WindowTypeEntry {
  const partsMap: Record<string, { rect: [number, number, number, number]; aria?: string }> = {};
  for (const p of parts) partsMap[p] = { rect: [0, 0, 10, 25] };
  return {
    chrome: { active: { asset: 'x.png', width: 100, height: 25, slice: null } } as any,
    edges: { top: edges },
    parts: partsMap,
  } as unknown as WindowTypeEntry;
}

describe('findTitlePillBounds', () => {
  it('returns null when there is no top recipe', () => {
    const wt = { chrome: { active: {} }, edges: {}, parts: {} } as unknown as WindowTypeEntry;
    expect(findTitlePillBounds(wt, 100)).toBeNull();
  });

  it('returns null when cicnWidth is zero or negative', () => {
    const wt = makeWindowType([{ at: 0, part: 'part-0' }], ['part-0']);
    expect(findTitlePillBounds(wt, 0)).toBeNull();
    expect(findTitlePillBounds(wt, -1)).toBeNull();
  });

  it('returns null when the recipe has no fill segments (all named)', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'part-0' },
        { at: 50, part: 'part-1' },
      ],
      ['part-0', 'part-1'],
    );
    expect(findTitlePillBounds(wt, 100)).toBeNull();
  });

  it('finds a single fill segment in the middle', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'part-0' },     // named, 0-30
        { at: 30, part: 'part-8' },    // FILL, 30-70
        { at: 70, part: 'part-1' },    // named, 70-100
      ],
      ['part-0', 'part-1'],
    );
    const r = findTitlePillBounds(wt, 100);
    expect(r).toEqual({ leftPct: 30, rightPct: 30 });
  });

  it('picks the widest of multiple fill runs', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'part-0' },     // named, 0-10
        { at: 10, part: 'part-8' },    // FILL, 10-20 (10 wide)
        { at: 20, part: 'part-1' },    // named, 20-40
        { at: 40, part: 'part-8' },    // FILL, 40-80 (40 wide) ← widest
        { at: 80, part: 'part-2' },    // named, 80-100
      ],
      ['part-0', 'part-1', 'part-2'],
    );
    const r = findTitlePillBounds(wt, 100);
    expect(r).toEqual({ leftPct: 40, rightPct: 20 });
  });

  it('coalesces consecutive fills of different codes into one run', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'part-0' },     // named
        { at: 25, part: 'part-8' },    // FILL
        { at: 28, part: 'part-6' },    // FILL (not in named list)
        { at: 32, part: 'part-5' },    // FILL
        { at: 35, part: 'part-1' },    // named
      ],
      ['part-0', 'part-1'],
    );
    const r = findTitlePillBounds(wt, 100);
    // Coalesced fill run: 25..35 = 10 wide → left 25%, right 65%.
    expect(r).toEqual({ leftPct: 25, rightPct: 65 });
  });

  it('handles a fill segment that runs to the cicn edge (implicit end)', () => {
    const wt = makeWindowType(
      [
        { at: 0, part: 'part-0' },     // named
        { at: 50, part: 'part-8' },    // FILL, 50-100 (extends to cicn end)
      ],
      ['part-0'],
    );
    const r = findTitlePillBounds(wt, 100);
    expect(r).toEqual({ leftPct: 50, rightPct: 0 });
  });

  it('matches the empirical 7 Le document-window recipe', () => {
    // Real recipe from themes/masswerk-7-le/theme.json (cicnWidth=74).
    const wt = makeWindowType(
      [
        { at: 0, part: 'part-0' },
        { at: 5, part: 'part-1' },
        { at: 21, part: 'part-2' },
        { at: 24, part: 'part-1' },
        { at: 25, part: 'part-8' },   // FILL start
        { at: 28, part: 'part-6' },   // FILL
        { at: 29, part: 'part-5' },   // FILL
        { at: 32, part: 'part-6' },   // FILL
        { at: 33, part: 'part-8' },   // FILL
        { at: 35, part: 'part-1' },   // named — run ends here, [25,35] width 10
        { at: 51, part: 'part-3' },
        { at: 68, part: 'part-10' },  // FILL [68,74] width 6
        { at: 74, part: 'part-1' },   // named (zero width)
      ],
      ['part-0', 'part-1', 'part-2', 'part-3', 'part-4'],
    );
    const r = findTitlePillBounds(wt, 74);
    expect(r).not.toBeNull();
    // Widest run is [25, 35]: leftPct ≈ 33.78, rightPct ≈ 52.70.
    expect(r!.leftPct).toBeCloseTo(33.7838, 2);
    expect(r!.rightPct).toBeCloseTo(52.7027, 2);
  });
});
