import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyChromeCicn, _resetClassifyCacheForTests } from './classifyChromeCicn.js';

beforeEach(() => { _resetClassifyCacheForTests(); });
afterEach(() => { vi.restoreAllMocks(); });

function stubImage(w: number, h: number, centerPixelGenerator: (x: number, y: number) => [number, number, number, number]): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(),
  } as unknown as Response)));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: w, height: h, close: () => {},
  } as unknown as ImageBitmap)));
  vi.stubGlobal('OffscreenCanvas', class {
    width: number; height: number;
    constructor(ww: number, hh: number) { this.width = ww; this.height = hh; }
    getContext(): {
      drawImage: () => void;
      getImageData: (x: number, y: number) => { data: Uint8ClampedArray };
    } {
      return {
        drawImage: () => {},
        getImageData: (x: number, y: number) => ({
          data: new Uint8ClampedArray(centerPixelGenerator(x, y)),
        }),
      };
    }
  });
}

describe('classifyChromeCicn', () => {
  it('returns titlebar-only when height ≤ 30 (Kind A)', async () => {
    stubImage(74, 25, () => [0, 0, 0, 255]);
    expect(await classifyChromeCicn('test://thin.png')).toBe('titlebar-only');
  });

  it('returns full-window when center is mostly body-like (Kind B)', async () => {
    // ErgoBox-style: center fills white (body backdrop).
    stubImage(132, 64, () => [255, 255, 255, 255]);
    expect(await classifyChromeCicn('test://ergobox.png')).toBe('full-window');
  });

  it('returns full-window when center is transparent (body=alpha 0)', async () => {
    stubImage(132, 64, () => [0, 0, 0, 0]);
    expect(await classifyChromeCicn('test://transparent.png')).toBe('full-window');
  });

  it('returns fixed-bitmap when center is opaque non-white (Kind C — Acid-like)', async () => {
    // All center samples opaque color (lego blocks).
    stubImage(177, 140, () => [255, 0, 0, 255]);
    expect(await classifyChromeCicn('test://acid.png')).toBe('fixed-bitmap');
  });

  it('caches results per URL', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, blob: async () => new Blob() } as unknown as Response));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 132, height: 64, close: () => {} } as unknown as ImageBitmap)));
    vi.stubGlobal('OffscreenCanvas', class {
      getContext(): { drawImage: () => void; getImageData: () => { data: Uint8ClampedArray } } {
        return {
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }),
        };
      }
    });
    const a = await classifyChromeCicn('test://cached.png');
    const b = await classifyChromeCicn('test://cached.png');
    expect(a).toBe(b);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns titlebar-only on fetch failure (safe default)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false } as Response)));
    expect(await classifyChromeCicn('test://missing.png')).toBe('titlebar-only');
  });
});
