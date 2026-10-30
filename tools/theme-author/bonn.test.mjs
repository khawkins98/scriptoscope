// Bonn (authoring/schemes/bonn/): builds, passes the authoring checks, loads
// through the runtime converter, ships a pressed strip that matches the
// document widgets, keeps the skyline a draw-once code-10 cell, and the
// committed scheme.rsrc / scheme.bin are current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheme } from '../../authoring/schemes/bonn/scheme.mjs';
import { checkScheme } from './check-scheme.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { writeMacBinary } from './macbinary.js';
import { convertChrome } from '../theme-loader/convert.js';
import { decodeCicn } from '../theme-loader/decoders/cicn.js';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const fork = writeResourceFork(resources);
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('Bonn builds with no authoring errors or warnings and loads through the runtime converter', () => {
  const { theme } = convertChrome(fork, { meta: { name: 'Bonn' }, source: 'scheme.rsrc' });
  const { errors, warnings } = checkScheme(resources, theme);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.ok(theme.bodyBackground?.pattern, 'document body pattern (cinf -9551 → ppat) is wired');
});

test('pressed strip -14330 is close | zoom | collapse at the document widget sizes; utility has close only', () => {
  const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
  const width = (rs, part) => { const r = rs.find((x) => x.part === part).rect; return r.right - r.left; };
  const strip = decodeCicn(find('cicn', -14330).data);
  assert.equal(strip.width, width(rects, 1) + width(rects, 2) + width(rects, 3));
  const util = decodeWnd(find('wnd#', -14304).data).rectangles;
  assert.equal(width(util, 1), width(rects, 1), 'utility close box is the document size, so it reads the same strip piece');
  for (const part of [2, 3]) assert.equal(width(util, part), 0);
});

test('the document skyline is one code-10 cell and the bottom bridge is whole arches, 13 | 12 | 13', () => {
  const wnd = decodeWnd(find('wnd#', -14336).data);
  const codes = (side) => side.slice(1).map((e) => e.part ?? e.code);
  const top = codes(wnd.topSide);
  assert.equal(top.filter((c) => c === 10).length, 1);
  assert.equal(top.filter((c) => c === 12).length, 0, 'no code 12: it would repeat the skyline');
  assert.deepEqual(codes(wnd.bottomSide), [1, 0, 13, 12, 13, 1]);
});

test('committed bonn scheme.rsrc and scheme.bin match a fresh build (run `npm run author -- authoring/schemes/bonn`)', () => {
  const dir = new URL('../../authoring/schemes/bonn/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const bin = writeMacBinary({ name: 'Bonn', resourceFork: fork });
  assert.ok(Buffer.from(bin).equals(readFileSync(new URL('scheme.bin', dir))), 'scheme.bin is stale; rebuild it');
});

test('layout.lint catches stray art in either bar grower beside the skyline', async () => {
  const { windowTypes, paintFrame } = await import('../../authoring/schemes/bonn/frames.mjs');
  const doc = windowTypes().find((t) => t.id === -14336);
  const fresh = () => paintFrame(doc, 'active');
  doc.layout.lint(fresh());
  const sky = doc.layout.named('skyline');
  const tree = fresh();
  // A stray pixel 1px left of the skyline lands in the 1px code-8 grower barM, in a bar row, so it no longer matches barR.
  tree.set(sky.x0 - 1, doc.layout.top - 6, '#e8a0b8');
  assert.throws(() => doc.layout.lint(tree), /cell barR doesn't match barM/);
  // The title plate is a 1px column now (trivially uniform), so the other risk is the right-hand grower.
  const stray = fresh();
  stray.set(doc.layout.named('barR').x0, doc.layout.top - 10, '#f0d040');
  assert.throws(() => doc.layout.lint(stray), /cell barR doesn't match barM/);
});
