// Brickworks (authoring/schemes/brickworks/): builds, passes the authoring
// checks with no errors, loads through the runtime converter, ships a pressed
// strip that matches the document widgets, and the committed scheme.rsrc /
// scheme.bin are current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheme } from '../../authoring/schemes/brickworks/scheme.mjs';
import { checkScheme } from './check-scheme.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { writeMacBinary } from './macbinary.js';
import { convertChrome } from '../theme-loader/convert.js';
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

test('stud runs are whole-tile code-12 cells, each with a code-13 filler in its allocation', () => {
  for (const id of [-14336, -14328, -14304]) {
    const top = decodeWnd(find('wnd#', id).data).topSide.map((e) => e.part);
    assert.ok(top.includes(12) && top.includes(13), `wnd# ${id} top recipe ${top}`);
  }
});

test('committed brickworks scheme.rsrc and scheme.bin match a fresh build (run `npm run author -- authoring/schemes/brickworks`)', () => {
  const dir = new URL('../../authoring/schemes/brickworks/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const bin = writeMacBinary({ name: 'Brickworks', resourceFork: fork });
  assert.ok(Buffer.from(bin).equals(readFileSync(new URL('scheme.bin', dir))), 'scheme.bin is stale; rebuild it');
});
