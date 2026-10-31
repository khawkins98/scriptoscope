// Bonn (authoring/schemes/bonn/): builds, passes the authoring checks, loads
// through the runtime converter, ships a pressed strip that matches the
// document widgets, stands the skyline over the title's code-6 caps, centres
// one bridge on open water, and the committed scheme.rsrc matches a fresh
// build, and MacBinary packaging unwraps cleanly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheme } from '../../authoring/schemes/bonn/scheme.mjs';
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

test('the skyline stands over the title caps (code 6) and one bridge is centred on the water, 11 | bridge | 8', () => {
  const wnd = decodeWnd(find('wnd#', -14336).data);
  const codes = (side) => side.slice(1).map((e) => e.part ?? e.code);
  const widths = (side) => side.slice(1).map((e, i) => e.border - side[i].border);
  const top = codes(wnd.topSide);
  assert.deepEqual(top, [1, 11, 6, 5, 6, 8, 1]);
  assert.equal(top.filter((c) => c === 12).length, 0, 'no code 12: it would repeat the skyline');
  const w = widths(wnd.topSide);
  assert.ok(w[2] > 30 && w[4] > 30, 'the caps are wide enough to carry the Minster and the Town Hall');
  assert.deepEqual(codes(wnd.bottomSide), [1, 0, 11, 1, 8, 1]);
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

test('committed bonn scheme.rsrc matches a fresh build, and MacBinary packaging unwraps cleanly', async () => {
  const dir = new URL('../../authoring/schemes/bonn/', import.meta.url);
  assert.ok(Buffer.from(fork).equals(readFileSync(new URL('scheme.rsrc', dir))), 'scheme.rsrc is stale; rebuild it');
  const { unwrapToResourceFork } = await import('../theme-loader/containers.js');
  const bin = writeMacBinary({ name: 'Bonn', resourceFork: fork });
  assert.ok(Buffer.from(unwrapToResourceFork(bin)).equals(Buffer.from(fork)));
});

test('layout.lint catches stray art in either 1px bar grower beside the caps', async () => {
  const { windowTypes, paintFrame } = await import('../../authoring/schemes/bonn/frames.mjs');
  const doc = windowTypes().find((t) => t.id === -14336);
  const fresh = () => paintFrame(doc, 'active');
  doc.layout.lint(fresh());
  // A blossom 1px past the bough lands in the left grower; a stray pixel in the right one.
  const left = fresh();
  left.set(doc.layout.named('barL').x0, doc.layout.top - 20, '#e8a0b8');
  assert.throws(() => doc.layout.lint(left), /cell barR doesn't match barL/);
  const right = fresh();
  right.set(doc.layout.named('barR').x0, doc.layout.top - 10, '#f0d040');
  assert.throws(() => doc.layout.lint(right), /cell barR doesn't match barL/);
});
