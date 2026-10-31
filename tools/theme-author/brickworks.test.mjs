// Brickworks (authoring/schemes/brickworks/): builds, passes the authoring
// checks with no errors, loads through the runtime converter, ships a pressed
// strip that matches the document widgets, and the committed scheme.rsrc
// matches a fresh build, and MacBinary packaging unwraps cleanly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheme } from '../../authoring/schemes/brickworks/scheme.mjs';
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

test('Brickworks builds with no authoring errors or warnings and loads through the runtime converter', () => {
  const { theme } = convertChrome(fork, { meta: { name: 'Brickworks' }, source: 'scheme.rsrc' });
  const { errors, warnings } = checkScheme(resources, theme);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.ok(theme.bodyBackground?.pattern, 'document body pattern (cinf -9551 → ppat) is wired');
});

test('pressed strip -14330 is close | zoom | collapse at the document widget sizes, and the utility has close only', () => {
  const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
  const width = (rs, part) => { const r = rs.find((x) => x.part === part).rect; return r.right - r.left; };
  const strip = decodeCicn(find('cicn', -14330).data);
  assert.equal(strip.width, width(rects, 1) + width(rects, 2) + width(rects, 3));
  const util = decodeWnd(find('wnd#', -14304).data).rectangles;
  assert.equal(width(util, 1), width(rects, 1));
  for (const part of [2, 3]) assert.equal(width(util, part), 0);
});

test('stud runs tile one brick from the title outward (code 11 left, code 8 right), and the document crane is a droppable code-10 cell', () => {
  for (const id of [-14336, -14328, -14304]) {
    const top = decodeWnd(find('wnd#', id).data).topSide.map((e) => e.part);
    assert.ok(top.includes(11) && top.includes(8), `wnd# ${id} top recipe ${top}`);
  }
  const doc = decodeWnd(find('wnd#', -14336).data).topSide.map((e) => e.part);
  assert.equal(doc.filter((p) => p === 10).length, 1, `document top recipe ${doc}`);
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

test('committed brickworks scheme.rsrc matches a fresh build, and MacBinary packaging unwraps cleanly', async () => {
  const dir = new URL('../../authoring/schemes/brickworks/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const { unwrapToResourceFork } = await import('../theme-loader/containers.js');
  const bin = writeMacBinary({ name: 'Brickworks', resourceFork: fork });
  assert.ok(Buffer.from(unwrapToResourceFork(bin)).equals(Buffer.from(fork)));
});
