// Contracts shared by every first-party scheme. Keep artwork-specific recipes
// in the individual scheme tests so changing art doesn't duplicate this suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { checkScheme } from './check-scheme.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { writeMacBinary } from './macbinary.js';
import { SYSTEM_PALETTE_256 } from './encode-icons.js';
import { convertChrome, convertIcons } from '../theme-loader/convert.js';
import { parseResourceFork } from '../theme-loader/resource-fork.js';
import { unwrapToResourceFork } from '../theme-loader/containers.js';
import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodePpat } from '../theme-loader/decoders/ppat.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const root = new URL('../../authoring/schemes/', import.meta.url);
const systemColours = new Set(SYSTEM_PALETTE_256.map((c) => c.join()));
const slugs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

test('shared contracts cover every shipped first-party scheme', () => {
  for (const slug of ['bonn', 'brickworks', 'castle', 'kingfisher', 'new-year-2027']) {
    assert.ok(slugs.includes(slug), `missing authored scheme ${slug}`);
  }
});

for (const slug of slugs) {
  test(`${slug}: shared authoring contracts`, async (t) => {
    const dir = new URL(`${slug}/`, root);
    const meta = JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8'));
    const { buildScheme } = await import(new URL('scheme.mjs', dir).href);
    const { resources } = await buildScheme();
    const fork = writeResourceFork(resources);
    const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

    await t.test('builds without authoring warnings and loads through the runtime', () => {
      const { theme } = convertChrome(fork, { meta, source: 'scheme.rsrc' });
      const { errors, warnings } = checkScheme(resources, theme);
      assert.deepEqual(errors, []);
      assert.deepEqual(warnings, []);
      assert.equal(parseResourceFork(fork).length, resources.length);
      // Kingfisher uses a solid body; the other shipped schemes promise a pattern.
      if (slug !== 'kingfisher') assert.ok(theme.bodyBackground?.pattern, 'document body pattern is wired');
    });

    await t.test('pressed document strip matches close, zoom and collapse widget widths', () => {
      const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
      const widths = [1, 2, 3].map((part) => {
        const { left, right } = rects.find((r) => r.part === part).rect;
        return right - left;
      });
      assert.equal(decodeCicn(find('cicn', -14330).data).width, widths.reduce((a, b) => a + b, 0));
    });

    await t.test('picker icon planes are masked and desktop pixels use the system palette', () => {
      const { index } = convertIcons(fork, { ids: [-16455] });
      assert.deepEqual(index.map((i) => i.type).sort(), ['icl4', 'icl8', 'ics4', 'ics8']);
      assert.ok(index.every((i) => i.masked));
      for (const type of ['ICN#', 'ics#']) assert.ok(find(type, -16455), `${type} -16455`);
      const desktop = decodePpat(find('ppat', 17).data);
      const pow2 = (n) => n > 0 && (n & (n - 1)) === 0;
      assert.ok(pow2(desktop.width) && pow2(desktop.height));
      for (let i = 0; i < desktop.rgba.length; i += 4) {
        const rgb = [...desktop.rgba.subarray(i, i + 3)].join();
        assert.ok(systemColours.has(rgb), `desktop colour ${rgb} is a system palette entry`);
      }
    });

    await t.test('committed resource fork matches the build and MacBinary round-trips', () => {
      assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), `stale scheme.rsrc; run npm run author -- authoring/schemes/${slug}`);
      const bin = writeMacBinary({ name: meta.name, resourceFork: fork });
      assert.deepEqual(unwrapToResourceFork(bin), fork);
    });
  });
}
