import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const hooks = registerHooks({
  resolve(specifier, context, resolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      try { return resolve(specifier, context); }
      catch (error) {
        if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
        return resolve(specifier.slice(0, -3) + '.ts', context);
      }
    }
    return resolve(specifier, context);
  },
});
const { regionPath } = await import('./hitRegion.ts');
hooks.deregister();

// Implementation detail: band decomposition may skip a known-solid C, but its filled set
// must still match the supplied bitmap, including disconnected frame runs on both sides.
test('solid-content shortcut preserves every region pixel and display scale', () => {
  for (const content of [undefined, { left: 3, top: 2, right: 10, bottom: 7 },
    { left: 0, top: 0, right: 13, bottom: 9 }, { left: 4, top: 4, right: 4, bottom: 4 }]) {
    const region = { width: 13, height: 9, bits: new Uint8Array(13 * 9) };
    for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
      const solid = content && x >= content.left && x < content.right && y >= content.top && y < content.bottom;
      region.bits[y * region.width + x] = solid || (x * 3 + y * 5) % 7 < 3 ? 1 : 0;
    }
    for (const scale of [1, 2]) {
      const path = regionPath(region, scale, content);
      const rectangles = [...path.matchAll(/M(\d+) (\d+)H(\d+)V(\d+)H(\d+)Z/g)]
        .map(match => match.slice(1).map(Number));
      assert.equal(rectangles.length, (path.match(/M/g) ?? []).length);
      for (let y = -1; y <= region.height; y++) for (let x = -1; x <= region.width; x++) {
        const px = (x + 0.5) * scale, py = (y + 0.5) * scale;
        const filled = rectangles.some(([left, top, right, bottom]) => px >= left && px < right && py >= top && py < bottom);
        const expected = x >= 0 && x < region.width && y >= 0 && y < region.height && region.bits[y * region.width + x] === 1;
        assert.equal(filled, expected, `pixel ${x},${y}, scale ${scale}, C ${JSON.stringify(content)}`);
      }
    }
  }
});

test('empty region remains an empty path', () => {
  assert.equal(regionPath({ width: 13, height: 9, bits: new Uint8Array(13 * 9) }, 1), '');
});
