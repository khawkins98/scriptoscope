/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { composeRichRecipe, clearRichRecipe } from './composeRichRecipe.js';
import type { WindowTypeEntry } from '../schema/types.js';

// Stub deriveFrameGeometry — composeRichRecipe is async because it awaits a
// pixel scan; for unit tests we don't want the canvas/image roundtrip.
vi.mock('./deriveFrameColor.js', () => ({
  deriveFrameGeometry: vi.fn(async () => ({
    top: 40,
    right: 33,
    bottom: 37,
    left: 36,
  })),
}));

// Minimal "rich" recipe stand-in inspired by 1990's top edge structure.
function makeWindowType(): WindowTypeEntry {
  return {
    chrome: { active: 'cicns/x.png' },
    parts: {
      'close-box': { rect: [56, 11, 64, 19] },
      'zoom-box':  { rect: [56, 28, 64, 36] },
    },
    edges: {
      top: [
        { at: 0,  part: 'fill-left-corner' },
        { at: 36, part: 'fill-A' },
        { at: 56, part: 'close-box' },     // named widget
        { at: 64, part: 'fill-B' },
        { at: 130, part: 'zoom-box' },    // named widget
        { at: 138, part: 'fill-right-corner' },
      ],
      bottom: [{ at: 0, part: 'fill' }],
      left: [{ at: 0, part: 'fill' }],
      right: [{ at: 0, part: 'fill' }],
    },
  };
}

describe('composeRichRecipe', () => {
  let windowEl: HTMLElement;

  beforeEach(() => {
    windowEl = document.createElement('div');
    document.body.appendChild(windowEl);
  });

  it('mounts one strip per side that has a recipe', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png',
      cicnWidth: 170,
      cicnHeight: 170,
    });
    const strips = windowEl.querySelectorAll('[data-aaron-rich-recipe-edge]');
    expect(strips.length).toBe(4);
    expect([...strips].map((s) => s.getAttribute('data-aaron-rich-recipe-edge')).sort())
      .toEqual(['bottom', 'left', 'right', 'top']);
  });

  it('produces one segment per recipe pair on the top edge', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png',
      cicnWidth: 170,
      cicnHeight: 170,
    });
    const top = windowEl.querySelector('[data-aaron-rich-recipe-edge="top"]')!;
    // 6 recipe entries + synthetic sentinel = 6 pair-segments
    expect(top.children.length).toBe(6);
  });

  it('tags widget / corner / fill segments distinctly', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png',
      cicnWidth: 170,
      cicnHeight: 170,
    });
    const top = windowEl.querySelector('[data-aaron-rich-recipe-edge="top"]')!;
    const kinds = [...top.children].map((c) => c.getAttribute('data-aaron-rich-recipe-segment'));
    // Expected: corner, fill, widget:close-box, fill, widget:zoom-box, corner
    // (First + last FILL segments are tagged 'corner' so they pin instead
    // of growing — mirrors how CSS border-image anchors its corners.)
    expect(kinds.filter((k) => k?.startsWith('widget:')).length).toBe(2);
    expect(kinds.filter((k) => k === 'corner').length).toBe(2);
    expect(kinds.filter((k) => k === 'fill').length).toBe(2);
  });

  it('sets window padding + custom props to match edge thicknesses', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png',
      cicnWidth: 170,
      cicnHeight: 170,
    });
    expect(windowEl.style.paddingTop).toBe('40px');
    expect(windowEl.style.paddingRight).toBe('33px');
    expect(windowEl.style.paddingBottom).toBe('37px');
    expect(windowEl.style.paddingLeft).toBe('36px');
    expect(windowEl.style.getPropertyValue('--aaron-frame-top-px')).toBe('40px');
  });

  it('is idempotent — re-compose replaces prior output cleanly', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png', cicnWidth: 170, cicnHeight: 170,
    });
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png', cicnWidth: 170, cicnHeight: 170,
    });
    expect(windowEl.querySelectorAll('[data-aaron-rich-recipe-edge]').length).toBe(4);
  });

  it('clearRichRecipe removes everything composeRichRecipe added', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png', cicnWidth: 170, cicnHeight: 170,
    });
    clearRichRecipe(windowEl);
    expect(windowEl.querySelectorAll('[data-aaron-rich-recipe-edge]').length).toBe(0);
    expect(windowEl.style.paddingTop).toBe('');
    expect(windowEl.style.getPropertyValue('--aaron-frame-top-px')).toBe('');
  });

  it('no-ops on zero-dimension cicn', async () => {
    await composeRichRecipe(windowEl, makeWindowType(), {
      cicnUrl: 'cicns/x.png', cicnWidth: 0, cicnHeight: 0,
    });
    expect(windowEl.querySelectorAll('[data-aaron-rich-recipe-edge]').length).toBe(0);
  });
});
