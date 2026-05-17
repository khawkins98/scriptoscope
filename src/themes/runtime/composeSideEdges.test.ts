import { beforeEach, describe, expect, it } from 'vitest';
import {
  composeBottomEdge,
  composeLeftEdge,
  composeRightEdge,
  clearChromeSegments,
} from './composeWindowChrome.js';
import type { WindowTypeEntry } from '../schema/types.js';

const CICN_URL = 'cicns/test.png';
const W = 74;
const H = 25;
const OPTS = { cicnWidth: W, cicnHeight: H, cicnUrl: CICN_URL };

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

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
});

describe('composeBottomEdge', () => {
  it('no-ops when no bottom recipe is present', () => {
    composeBottomEdge(container, makeWindowType({}), OPTS);
    expect(container.children).toHaveLength(0);
  });

  it('renders one segment div per non-zero-width recipe entry', () => {
    const wt = makeWindowType(
      {
        bottom: [
          { at: 0, part: 'part-0' },
          { at: 5, part: 'part-8' },
          { at: 70, part: 'part-0' },
        ],
      },
      { 'part-0': [1, 22, 72, 23] },
    );
    composeBottomEdge(container, wt, OPTS);
    expect(container.children).toHaveLength(3);
    for (const c of Array.from(container.children)) {
      expect((c as HTMLElement).getAttribute('data-aaron-chrome-segment')).toBe('bottom');
    }
  });

  it('named-part segment anchors to container bottom + uses native rect width', () => {
    const wt = makeWindowType(
      { bottom: [{ at: 0, part: 'part-0' }, { at: 71, part: 'part-8' }] },
      { 'part-0': [1, 22, 72, 23] }, // 71×1
    );
    composeBottomEdge(container, wt, OPTS);
    const named = container.children[0] as HTMLElement;
    expect(named.style.bottom).toBe('0px');
    expect(named.style.width).toBe('71px');
    expect(named.style.height).toBe('1px');
    expect(named.style.backgroundPosition).toContain('-1px -22px');
  });

  it('fill segment samples from the cicn bottom rows', () => {
    const wt = makeWindowType({
      bottom: [{ at: 0, part: 'part-8' }, { at: 50, part: 'part-9' }],
    });
    composeBottomEdge(container, wt, OPTS);
    const fill = container.children[0] as HTMLElement;
    // Default bottomStripStart = cicnHeight - 2 = 23 (no named bottom strip).
    expect(fill.style.backgroundPosition).toContain('-23px');
    expect(fill.style.backgroundRepeat).toBe('repeat-x');
  });

  it('infers bottom strip from a named part with a thin bottom rect', () => {
    const wt = makeWindowType(
      { bottom: [{ at: 0, part: 'part-8' }] },
      { 'part-0': [1, 22, 72, 23] }, // top=22, near bottom of 25-tall cicn → infer 22
    );
    composeBottomEdge(container, wt, OPTS);
    const fill = container.children[0] as HTMLElement;
    expect(fill.style.backgroundPosition).toContain('-22px');
  });

  it('clears prior segments on re-compose (idempotent)', () => {
    const wt = makeWindowType({ bottom: [{ at: 0, part: 'part-8' }] });
    composeBottomEdge(container, wt, OPTS);
    expect(container.children).toHaveLength(1);
    composeBottomEdge(container, wt, OPTS);
    expect(container.children).toHaveLength(1);
  });
});

describe('composeLeftEdge', () => {
  it('iterates the Y axis and samples from cicn column 0', () => {
    const wt = makeWindowType({
      left: [{ at: 0, part: 'part-8' }, { at: H, part: 'part-x' }],
    });
    composeLeftEdge(container, wt, OPTS);
    const fill = container.children[0] as HTMLElement;
    expect(fill.style.left).toBe('0px');
    expect(fill.style.top).toBe('0%');
    // Browser normalizes -0px → 0px in the serialized style.
    expect(fill.style.backgroundPosition.startsWith('0px') || fill.style.backgroundPosition.startsWith('-0px')).toBe(true);
    expect(fill.style.backgroundRepeat).toBe('repeat-y');
  });

  it('named left-edge part anchors to container left + native rect dimensions', () => {
    const wt = makeWindowType(
      { left: [{ at: 22, part: 'part-corner' }, { at: 23, part: 'part-8' }] },
      { 'part-corner': [0, 22, 2, 24] },
    );
    composeLeftEdge(container, wt, OPTS);
    const named = container.children[0] as HTMLElement;
    expect(named.style.left).toBe('0px');
    expect(named.style.width).toBe('2px');
    expect(named.style.height).toBe('2px');
  });
});

describe('composeRightEdge', () => {
  it('samples from cicn rightmost column and anchors to container right', () => {
    const wt = makeWindowType({
      right: [{ at: 0, part: 'part-8' }],
    });
    composeRightEdge(container, wt, OPTS);
    const fill = container.children[0] as HTMLElement;
    expect(fill.style.right).toBe('0px');
    expect(fill.style.backgroundPosition).toContain(`-${W - 1}px`);
    expect(fill.style.backgroundRepeat).toBe('repeat-y');
  });
});

describe('clearChromeSegments shared cleanup', () => {
  it('removes only segments, not other children', () => {
    const wt = makeWindowType({ bottom: [{ at: 0, part: 'part-8' }] });
    composeBottomEdge(container, wt, OPTS);
    const other = document.createElement('span');
    container.appendChild(other);
    clearChromeSegments(container);
    expect(container.children).toHaveLength(1);
    expect(container.children[0]).toBe(other);
  });
});
