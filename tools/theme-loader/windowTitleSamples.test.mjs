import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';

// Hand-encoded indexed 8x8 cicn and wnd#: no production encoder or sampler
// computes the expected values. window-widgets TC1–TC3, mask deliberately clear.
const words = xs => { const b = new Uint8Array(xs.length * 2), v = new DataView(b.buffer); xs.forEach((x, i) => v.setInt16(i * 2, x)); return b; };
const recipe = words([1, 0, 4, 2, 7, 6, 4, 0, 1, 4, 7, -1, -1, -1, -1]);
const palette = [[0x1234, 0x5678, 0x9abc], [0x1201, 0x3402, 0x5603], [0x1202, 0x3403, 0x5604], [0xab01, 0xcd02, 0xef03], [0xab02, 0xcd03, 0xef04], [0x7777, 0x8888, 0x9999]];
function icon(delta) {
  const b = new Uint8Array(98 + palette.length * 8 + 64), v = new DataView(b.buffer);
  const w = (o, n) => v.setUint16(o, n);
  w(4, 0x8008); w(10, 8); w(12, 8); w(32, 8); w(34, 1); w(36, 8);
  w(54, 1); w(60, 8); w(62, 8); // 8 clear mask bytes at 82; nil mono plane
  w(96, palette.length - 1);
  palette.forEach((rgb, i) => [i, ...rgb.map(n => n + delta)].forEach((n, j) => w(98 + i * 8 + j * 2, n)));
  const p = 98 + palette.length * 8;
  b.fill(5, p); b[p + 1] = 0; // TC1 background is unique; wrong row/column samples the sentinel
  b[p + 4 * 8 + 2] = 1; b[p + 4 * 8 + 3] = 2; // TC2 upper
  b[p + 6 * 8 + 2] = 3; b[p + 6 * 8 + 3] = 4; // TC3 lower
  return b;
}
test('TC1–TC3 public raw loader retains full RGB16 at clear-mask background, upper, lower and inactive samples', async () => {
  const raw = await loadKaleidoscopeScheme(forkOf([
    ...[-14336, -12320].flatMap(id => [{ type: 'wnd#', id, data: recipe }, { type: 'cicn', id, data: icon(0) }, { type: 'cicn', id: id + 1, data: icon(1) }]),
  ]), { encodeAssets: false });
  for (const [slug, slots] of [['document-window', [1, 2]], ['popup-window', [3, 4]]]) {
    const wt = raw.manifest.windowTypes[slug];
    assert.ok(wt, slug);
    for (const [state, delta] of [['active', 1], ['inactive', 0]]) {
      const s = wt.titleSamples[state];
      for (const [name, index] of [['background', 0], ['text', slots[0]], ['shadow', slots[1]]]) {
        assert.deepEqual(s[name].rgb16, palette[index].map(n => n + delta), `${slug}/${state}/${name}`);
      }
      const a = raw.assets.find(a => a.path === wt.chrome[state]);
      assert.ok(a.rgba.every((v, i) => i % 4 !== 3 || v === 0), 'mask is clear at every sample');
      // Oracle probes: swapped popup row, state, x/y or erased low bytes cannot pass.
      assert.notDeepEqual(s.text.rgb16, palette[slug === 'popup-window' ? 1 : 3]);
      assert.notDeepEqual(s.text.rgb16, s.text.rgb16.map(n => n & 0xff00));
    }
  }
});
