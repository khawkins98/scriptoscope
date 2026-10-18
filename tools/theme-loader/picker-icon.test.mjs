import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { convertIcons } from './convert.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { loadKaleidoscopeIcon } from './loadKaleidoscopeIcon.js';

for (const [slug, source] of [['1138', 'scheme.rsrc'], ['platinum-8', 'scheme.sit']]) {
  test(`picker preview matches the full decoder but encodes just one icon: ${slug}`, async () => {
    const bytes = new Uint8Array(await readFile(new URL(`../../themes/${slug}/${source}`, import.meta.url)));
    const full = await loadKaleidoscopeScheme(bytes, { encodeAssets: false });
    const ids = [-3983, -3999];
    const expected = ids.map((id) => full.iconIndex.find((icon) => icon.id === id && icon.size === 32)
      ?? full.iconIndex.find((icon) => icon.id === id)).find(Boolean);
    assert.ok(expected, 'fixture has a folder icon');
    const expectedAsset = full.assets.find((asset) => asset.path === `icons/${expected.file}`);
    let calls = 0;
    const url = await loadKaleidoscopeIcon(bytes, ids, (rgba, width, height, path) => {
      calls++;
      assert.equal(path, expectedAsset.path);
      assert.equal(width, expectedAsset.width);
      assert.equal(height, expectedAsset.height);
      assert.deepEqual(rgba, expectedAsset.rgba, 'palette, depth, mask and pixels remain authentic');
      return 'data:image/png;base64,preview';
    });
    assert.equal(calls, 1);
    assert.equal(url, 'data:image/png;base64,preview');
    const missing = await loadKaleidoscopeIcon(bytes, [123456], () => {
      assert.fail('an absent icon must not allocate an image');
    });
    assert.equal(missing, null);
  });
}

test('selective icon conversion retains only requested ids', async () => {
  const fork = new Uint8Array(await readFile(new URL('../../themes/1138/scheme.rsrc', import.meta.url)));
  const full = convertIcons(fork);
  const selected = convertIcons(fork, { ids: [-3983] });
  assert.ok(full.index.length > selected.index.length);
  assert.ok(selected.index.length > 0);
  assert.ok(selected.index.every((icon) => icon.id === -3983));
  assert.deepEqual(selected.assets, full.assets.filter((asset) =>
    selected.index.some((icon) => asset.path === `icons/${icon.file}`)));
});
