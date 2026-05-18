import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveFrameColor, _resetFrameColorCacheForTests } from './deriveFrameColor.js';

beforeEach(() => {
  _resetFrameColorCacheForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: build a 4x4 PNG-like blob via a tiny canvas. The pixels we
// return are controlled by the inputs to `mockImage`.
async function mockImage(pixels: number[][]): Promise<void> {
  // pixels[y][x*4 + 0..3] not used directly — we mock createImageBitmap
  // + canvas readback to return scripted pixel data.
  const w = 4;
  const h = pixels.length;
  // Stub fetch + createImageBitmap.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(),
  } as unknown as Response)));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: w,
    height: h,
    close: () => {},
  } as unknown as ImageBitmap)));
  vi.stubGlobal('OffscreenCanvas', class {
    width: number; height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext(): {
      drawImage: () => void;
      getImageData: (x: number, y: number) => { data: Uint8ClampedArray };
    } {
      return {
        drawImage: () => {},
        getImageData: (x: number, y: number) => {
          const row = pixels[y] ?? [];
          const base = x * 4;
          const r = row[base + 0] ?? 0;
          const g = row[base + 1] ?? 0;
          const b = row[base + 2] ?? 0;
          const a = row[base + 3] ?? 0;
          return { data: new Uint8ClampedArray([r, g, b, a]) };
        },
      };
    }
  });
}

describe('deriveFrameColor', () => {
  it('returns the first opaque pixel found in the leftmost column', async () => {
    // Row 0 col 0 transparent, row 1 col 0 opaque black.
    await mockImage([
      [0, 0, 0, 0,  255, 255, 255, 255,  255, 255, 255, 255,  255, 255, 255, 255],
      [0, 0, 0, 255,  255, 255, 255, 255,  255, 255, 255, 255,  255, 255, 255, 255],
      [0, 0, 0, 255,  255, 255, 255, 255,  255, 255, 255, 255,  255, 255, 255, 255],
      [0, 0, 0, 255,  255, 255, 255, 255,  255, 255, 255, 255,  255, 255, 255, 255],
    ]);
    const color = await deriveFrameColor('test://a.png');
    expect(color).toBe('#000000');
  });

  it('falls back to the rightmost column when left is all transparent', async () => {
    // Whole left column transparent, right column has #555.
    const pixels = [];
    for (let y = 0; y < 4; y++) {
      pixels.push([
        0, 0, 0, 0,                  // x=0 transparent
        0, 0, 0, 0,                  // x=1
        0, 0, 0, 0,                  // x=2
        0x55, 0x55, 0x55, 255,       // x=3 opaque
      ]);
    }
    await mockImage(pixels);
    const color = await deriveFrameColor('test://b.png');
    expect(color).toBe('#555555');
  });

  it('returns null when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false } as Response)));
    const color = await deriveFrameColor('test://missing.png');
    expect(color).toBeNull();
  });

  it('caches results — second call for same URL does not re-fetch', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, blob: async () => new Blob() } as unknown as Response));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close: () => {} } as unknown as ImageBitmap)));
    vi.stubGlobal('OffscreenCanvas', class {
      getContext(): { drawImage: () => void; getImageData: () => { data: Uint8ClampedArray } } {
        return { drawImage: () => {}, getImageData: () => ({ data: new Uint8ClampedArray([0xff, 0, 0, 255]) }) };
      }
    });
    const a = await deriveFrameColor('test://cache.png');
    const b = await deriveFrameColor('test://cache.png');
    expect(a).toBe('#ff0000');
    expect(b).toBe('#ff0000');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('hex output is lowercase + zero-padded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob() } as unknown as Response)));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close: () => {} } as unknown as ImageBitmap)));
    vi.stubGlobal('OffscreenCanvas', class {
      getContext(): { drawImage: () => void; getImageData: () => { data: Uint8ClampedArray } } {
        return { drawImage: () => {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 0xab, 255]) }) };
      }
    });
    const color = await deriveFrameColor('test://hex.png');
    expect(color).toBe('#0102ab');
  });
});
