// Castle (authoring/schemes/castle/): builds, passes the authoring checks,
// loads through the runtime converter, ships a pressed strip that matches the
// document widgets, and the committed scheme.rsrc / scheme.bin are current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheme } from '../../authoring/schemes/castle/scheme.mjs';
import { checkScheme } from './check-scheme.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { writeMacBinary } from './macbinary.js';
import { convertChrome, convertIcons } from '../theme-loader/convert.js';
import { decodePpat } from '../theme-loader/decoders/ppat.js';
import { SYSTEM_PALETTE_256 } from './encode-icons.js';
import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const fork = writeResourceFork(resources);
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('Castle builds with no authoring errors or warnings and loads through the runtime converter', () => {
  const { theme } = convertChrome(fork, { meta: { name: 'Castle' }, source: 'scheme.rsrc' });
  const { errors, warnings } = checkScheme(resources, theme);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.ok(theme.bodyBackground?.pattern, 'document body pattern (cinf -9551 → ppat) is wired');
});

test('pressed strip -14330 is close | zoom | collapse at the document widget sizes', () => {
  const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
  const width = (part) => { const r = rects.find((x) => x.part === part).rect; return r.right - r.left; };
  const strip = decodeCicn(find('cicn', -14330).data);
  assert.equal(strip.width, width(1) + width(2) + width(3));
  // The utility window has a close box only, so its collapse can't read the zoom piece (R24).
  const util = decodeWnd(find('wnd#', -14304).data).rectangles;
  for (const part of [2, 3]) { const r = util.find((x) => x.part === part).rect; assert.equal(r.right - r.left, 0); }
});

test('classic extras: the picker icon family (-16455) and a power-of-two desktop pattern (ppat 17) in exact 8-bit system colours', () => {
  const { index } = convertIcons(fork, { ids: [-16455] });
  assert.deepEqual(index.map((i) => i.type).sort(), ['icl4', 'icl8', 'ics4', 'ics8']);
  assert.ok(index.every((i) => i.masked), 'every icon plane has its ICN#/ics# mask');
  for (const type of ['ICN#', 'ics#']) assert.ok(find(type, -16455), `${type} -16455`);
  const desktop = decodePpat(find('ppat', 17).data);
  const pow2 = (n) => (n & (n - 1)) === 0;
  assert.ok(pow2(desktop.width) && pow2(desktop.height), `desktop ${desktop.width}x${desktop.height}`);
  const system = new Set(SYSTEM_PALETTE_256.map((c) => c.join()));
  for (let i = 0; i < desktop.rgba.length; i += 4) {
    const rgb = [...desktop.rgba.subarray(i, i + 3)].join();
    assert.ok(system.has(rgb), `desktop colour ${rgb} is a system palette entry`);
  }
});

test('committed castle scheme.rsrc and scheme.bin match a fresh build (run `npm run author -- authoring/schemes/castle`)', () => {
  const dir = new URL('../../authoring/schemes/castle/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const bin = writeMacBinary({ name: 'Castle', resourceFork: fork });
  assert.ok(Buffer.from(bin).equals(readFileSync(new URL('scheme.bin', dir))), 'scheme.bin is stale; rebuild it');
});
