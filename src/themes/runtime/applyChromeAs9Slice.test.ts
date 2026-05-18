import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWindowAs9Slice, clearWindow9Slice } from './applyChromeAs9Slice.js';
import { _resetFrameColorCacheForTests } from './deriveFrameColor.js';
import type { WindowTypeEntry } from '../schema/types.js';

const W = 132;
const H = 64;
const OPTS = { cicnWidth: W, cicnHeight: H, cicnUrl: 'cicns/ergobox.png' };

const dummyWindowType: WindowTypeEntry = {
  chrome: { active: 'x.png' },
  edges: {},
  parts: {},
} as unknown as WindowTypeEntry;

beforeEach(() => { _resetFrameColorCacheForTests(); });
afterEach(() => { vi.restoreAllMocks(); });

function stubGeometry(geom: { color: string | null; top: number; right: number; bottom: number; left: number } | null): void {
  if (!geom) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false } as Response)));
    return;
  }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob() } as unknown as Response)));
  // Fake the entire pipeline: createImageBitmap + OffscreenCanvas return
  // canned pixel data that countBorderPixels will interpret as the
  // requested geometry. The scan starts from each edge and goes inward.
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: W, height: H, close: () => {},
  } as unknown as ImageBitmap)));
  vi.stubGlobal('OffscreenCanvas', class {
    getContext(): {
      drawImage: () => void;
      getImageData: (x: number, y: number) => { data: Uint8ClampedArray };
    } {
      return {
        drawImage: () => {},
        getImageData: (x: number, y: number) => {
          // First sample from each edge: opaque non-white = border.
          // After geom.left pixels inward from x=0: near-white = body.
          // Etc. Roughly:
          const fromLeft = x;
          const fromRight = W - 1 - x;
          const fromTop = y;
          const fromBottom = H - 1 - y;
          let isBody = false;
          if (fromLeft >= geom.left && fromRight >= geom.right
              && fromTop >= geom.top && fromBottom >= geom.bottom) {
            isBody = true;
          }
          if (isBody) return { data: new Uint8ClampedArray([255, 255, 255, 255]) };
          // Border pixel — return color (or black default).
          const color = geom.color ?? '#000000';
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          return { data: new Uint8ClampedArray([r, g, b, 255]) };
        },
      };
    }
  });
}

describe('applyWindowAs9Slice', () => {
  let el: HTMLDivElement;
  beforeEach(() => { el = document.createElement('div'); });

  it('sets border-image styles when geometry is available', async () => {
    stubGeometry({ color: '#000000', top: 0, right: 6, bottom: 7, left: 6 });
    const result = await applyWindowAs9Slice(el, dummyWindowType, OPTS);
    expect(result).not.toBeNull();
    // Top falls back to max(18, cicnHeight/3) when geom.top is 0.
    expect(result!.top).toBe(Math.max(18, Math.floor(H / 3)));
    expect(result!.right).toBe(6);
    expect(result!.bottom).toBe(7);
    expect(result!.left).toBe(6);
    expect(el.style.borderImageSource).toContain('ergobox.png');
    // No `fill` — content box stays transparent so window body shows through.
    expect(el.style.borderImageSlice).not.toContain('fill');
    expect(el.style.borderImageRepeat).toBe('round');
    expect(el.style.borderLeftWidth).toBe('6px');
    expect(el.style.borderRightWidth).toBe('6px');
    expect(el.style.borderBottomWidth).toBe('7px');
    expect(el.hasAttribute('data-aaron-chrome-9slice')).toBe(true);
  });

  it('stamps --aaron-frame-*-px custom properties', async () => {
    stubGeometry({ color: '#000000', top: 0, right: 6, bottom: 7, left: 6 });
    await applyWindowAs9Slice(el, dummyWindowType, OPTS);
    expect(el.style.getPropertyValue('--aaron-frame-top-px')).toMatch(/^\d+px$/);
    expect(el.style.getPropertyValue('--aaron-frame-bottom-px')).toBe('7px');
    expect(el.style.getPropertyValue('--aaron-frame-left-px')).toBe('6px');
    expect(el.style.getPropertyValue('--aaron-frame-right-px')).toBe('6px');
  });

  it('returns null + clears when cicnWidth or cicnHeight is non-positive', async () => {
    const result = await applyWindowAs9Slice(el, dummyWindowType, { cicnUrl: 'x', cicnWidth: 0, cicnHeight: 0 });
    expect(result).toBeNull();
    expect(el.style.borderImageSource).toBe('');
  });

  it('returns null + clears when deriveFrameGeometry fails (fetch error)', async () => {
    stubGeometry(null);
    const result = await applyWindowAs9Slice(el, dummyWindowType, OPTS);
    expect(result).toBeNull();
  });

  it('clearWindow9Slice removes inline border styles + custom props', async () => {
    stubGeometry({ color: '#000000', top: 0, right: 6, bottom: 7, left: 6 });
    await applyWindowAs9Slice(el, dummyWindowType, OPTS);
    expect(el.style.borderImageSource).not.toBe('');
    clearWindow9Slice(el);
    expect(el.style.borderImageSource).toBe('');
    expect(el.style.borderLeftWidth).toBe('');
    expect(el.style.getPropertyValue('--aaron-frame-top-px')).toBe('');
    expect(el.hasAttribute('data-aaron-chrome-9slice')).toBe(false);
  });
});
