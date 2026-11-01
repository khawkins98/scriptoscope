// Kingfisher's menus part (authoring/schemes/kingfisher/parts/menus.mjs): its
// resources exist, decode through the runtime's loader, and pass checkScheme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../../authoring/schemes/kingfisher/parts/menus.mjs';
import { C } from '../../authoring/schemes/kingfisher/palette.mjs';
import { writeResourceFork } from './resource-fork-writer.js';
import { checkScheme } from './check-scheme.js';
import { readCicnIndexed } from '../theme-loader/decoders/cicn.js';
import { decodeCinf } from '../theme-loader/decoders/cinf.js';
import { convertChrome, convertIcons } from '../theme-loader/convert.js';

const resources = [];
build((type, id, data, name) => resources.push({ type, id, data, ...(name ? { name } : {}) }), { C });
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('menus part ships every menu face with a usable same-id cinf', () => {
  for (let id = -12240; id <= -12232; id++) {
    const cicn = readCicnIndexed(find('cicn', id).data);
    const cinf = decodeCinf(find('cinf', id).data);
    const { width: W, height: H } = cicn.pmap;
    for (const key of ['bgPixel', 'textPixel']) {
      const { x, y } = cinf[key];
      assert.ok(x >= 0 && y >= 0 && x < W && y < H, `cinf ${id} ${key} inside ${W}x${H}`);
    }
    assert.ok(cicn.colorTable.entries.length <= 256);
  }
  // The menu bar faces fill the 20 px bar with corners and bands alone.
  assert.equal(readCicnIndexed(find('cicn', -12240).data).pmap.height, 22);
  for (const id of [-12231, -12230]) assert.equal(readCicnIndexed(find('cicn', id).data).pmap.width, 6);
});

test('menus part loads through the runtime converter and passes checkScheme', () => {
  const fork = writeResourceFork(resources);
  const { theme } = convertChrome(fork, { meta: {}, source: 'scheme.rsrc' });
  const patternIds = Object.values(theme.patterns ?? {}).map((p) => p.sourcePpatId);
  assert.ok(patternIds.includes(17) && patternIds.includes(42), 'desktop and utility patterns decode');
  assert.ok(theme.headerColors?.active?.frame && theme.headerColors?.inactive?.fill, 'header cluts decode');
  const { errors } = checkScheme(resources, theme);
  assert.deepEqual(errors, []);
  const { index } = convertIcons(fork, { ids: [-16455] });
  assert.deepEqual(index.map((i) => i.type).sort(), ['icl4', 'icl8', 'ics4', 'ics8']);
  assert.ok(index.every((i) => i.masked), 'every icon plane has its ICN#/ics# mask');
});
