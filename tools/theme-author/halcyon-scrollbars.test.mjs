// Halcyon's scroll-bar part (authoring/schemes/halcyon/parts/scrollbars.mjs):
// every id the 2.3.1 scroll-bar CDEF reads is present, decodes, has the
// geometry the engine expects, and passes the authoring checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../../authoring/schemes/halcyon/parts/scrollbars.mjs';
import { C } from '../../authoring/schemes/halcyon/palette.mjs';
import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { convertChrome } from '../theme-loader/convert.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { checkScheme } from './check-scheme.js';

const resources = [];
build((type, id, data, name) => resources.push({ type, id, data, ...(name ? { name } : {}) }), { C });
const cicn = (id) => {
  const r = resources.find((x) => x.type === 'cicn' && x.id === id);
  assert.ok(r, `cicn ${id} missing`);
  return decodeCicn(r.data);
};
const opaque = (d) => d.rgba.every((v, i) => i % 4 !== 3 || v === 255);

test('tracks: every tier, small (+18), double (+4) and small double (+22), opaque, composite-sized', () => {
  for (const [base, horizontal] of [[-8288, true], [-8280, false]]) {
    for (const [off, t, cells] of [[0, 16, 1], [18, 11, 1], [4, 16, 2], [22, 11, 2]]) {
      for (let tier = cells === 2 ? 1 : 0; tier <= 3; tier++) {
        const d = cicn(base + off + tier);
        const [cross, along] = horizontal ? [d.height, d.width] : [d.width, d.height];
        assert.equal(cross, t, `${base + off + tier} thickness`);
        if (tier > 0) assert.equal(along, 2 * cells * (t - 1) + 3, `${base + off + tier} = arrow cells + 3px track`);
        assert.ok(along > 16, `${base + off + tier} must be composite (scrollbar §4.4 CF1)`);
        assert.ok(opaque(d), `${base + off + tier} must be opaque (AC5, §6 item 4)`);
      }
    }
  }
});

test('thumbs (+1956 small) are opaque and match the bar thickness; ghosts and little arrows exist', () => {
  for (const [id, horizontal] of [[-10208, false], [-10207, false], [-10206, true], [-10205, true]]) {
    for (const [tid, t] of [[id, 16], [id + 1956, 11]]) {
      const d = cicn(tid);
      assert.equal(horizontal ? d.height : d.width, t);
      assert.ok(opaque(d), `thumb ${tid}: transparent pixels inside a thumb are never painted (§5.8)`);
    }
  }
  for (const id of [-8272, -8271, -8254, -8253, -10048, -10047, -10046, -10045]) assert.ok(cicn(id));
});

test('passes the authoring checks and the runtime converter', () => {
  const { theme } = convertChrome(writeResourceFork(resources), { meta: {}, source: 'scheme.rsrc' });
  const { errors } = checkScheme(resources, theme);
  assert.deepEqual(errors, []);
});
