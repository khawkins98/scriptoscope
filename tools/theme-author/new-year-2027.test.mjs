// Midnight 2027 (authoring/schemes/new-year-2027/): builds, passes the authoring
// checks, loads through the runtime converter, keeps its concept geometry
// (droppable bursts, title plate, pressed strip), and the committed
// scheme.rsrc / scheme.bin are current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheme } from '../../authoring/schemes/new-year-2027/scheme.mjs';
import { windowTypes } from '../../authoring/schemes/new-year-2027/frames.mjs';
import { checkScheme } from './check-scheme.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { writeMacBinary } from './macbinary.js';
import { convertChrome } from '../theme-loader/convert.js';
import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const fork = writeResourceFork(resources);
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('Midnight 2027 builds with no authoring errors or warnings and loads through the runtime converter', () => {
  const { theme } = convertChrome(fork, { meta: { name: 'Midnight 2027' }, source: 'scheme.rsrc' });
  const { errors, warnings } = checkScheme(resources, theme);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.ok(theme.bodyBackground?.pattern, 'document body pattern (cinf -9551 → ppat) is wired');
});

test('document frame keeps the concept geometry: 50px top band, droppable bursts at the corners, plate in the middle', () => {
  const doc = windowTypes().find((t) => t.id === -14336).layout;
  assert.equal(doc.width, 230);
  assert.equal(doc.height, 137);
  assert.deepEqual(doc.content, { top: 50, left: 9, bottom: 122, right: 221 });
  const codes = doc.cells.top.map((c) => `${c.name}:${c.code}`);
  assert.deepEqual(codes, ['cornerL:1', 'burst:10', 'barL:11', 'capL:6', 'plate:5', 'capR:6', 'barR:8', 'year:10', 'cornerR:1']);
  // Title room (R6): the bursts and corners cost 164px; a 90px title shows from 254px.
  assert.equal(doc.fixedTop, 164);
  assert.equal(doc.minWidthForTitle(90), 254);
  const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
  const t4 = rects.find((r) => r.part === 4).rect;
  assert.ok(t4.bottom - t4.top >= 17, 'title rect is at least 17px tall (R28)');
  const frame = decodeCicn(find('cicn', -14335).data);
  assert.equal(frame.width, 230);
  assert.equal(frame.height, 137);
});

test('pressed strip -14330 is close | zoom | collapse at the document widget sizes', () => {
  const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
  const width = (part) => { const r = rects.find((x) => x.part === part).rect; return r.right - r.left; };
  const strip = decodeCicn(find('cicn', -14330).data);
  assert.equal(strip.width, width(1) + width(2) + width(3));
  assert.equal(strip.width, 45);
  // The utility window has a close box only, so its collapse can't read the zoom piece (R24).
  const util = decodeWnd(find('wnd#', -14304).data).rectangles;
  for (const part of [2, 3]) { const r = util.find((x) => x.part === part).rect; assert.equal(r.right - r.left, 0); }
});

test('committed new-year-2027 scheme.rsrc matches a fresh build, and MacBinary packaging unwraps cleanly', async () => {
  const dir = new URL('../../authoring/schemes/new-year-2027/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const { unwrapToResourceFork } = await import('../theme-loader/containers.js');
  const bin = writeMacBinary({ name: 'Midnight 2027', resourceFork: fork });
  assert.ok(Buffer.from(unwrapToResourceFork(bin)).equals(Buffer.from(fork)));
});
