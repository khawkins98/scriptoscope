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
import { convertChrome } from '../theme-loader/convert.js';
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

test('committed castle scheme.rsrc and scheme.bin match a fresh build (run `npm run author -- authoring/schemes/castle`)', () => {
  const dir = new URL('../../authoring/schemes/castle/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const bin = writeMacBinary({ name: 'Castle', resourceFork: fork });
  assert.ok(Buffer.from(bin).equals(readFileSync(new URL('scheme.bin', dir))), 'scheme.bin is stale; rebuild it');
});
