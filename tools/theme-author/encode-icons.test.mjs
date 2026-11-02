// Corpus round-trips for the icon-family and clut encoders: every icon and
// colour table in the 18 bundled schemes is decoded by the runtime's own code,
// re-encoded, and must come back byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { encodeIconPlane, encodeIconList, packIconBits, encodeIconFamily } from './encode-icons.js';
import { encodeClut, encodeHeaderClut } from './encode-clut.js';
import { Raster } from './raster.js';
import { parseResourceFork } from '../theme-loader/resource-fork.js';
import { convertIcons } from '../theme-loader/convert.js';
import { expandIndexedPixels } from '../theme-loader/decoders/shared.js';
import { decodeClut, headerColorsFromClut } from '../theme-loader/decoders/clut.js';
import { writeResourceFork } from './resource-fork-writer.js';
import { readSchemeFork } from '../../scripts/lib/scheme-source.mjs';

const THEMES = new URL('../../themes/', import.meta.url);
const slugs = readdirSync(THEMES).filter((s) => existsSync(new URL(`${s}/meta.json`, THEMES)));
const forks = await Promise.all(slugs.map(async (s) => ({ slug: s, fork: (await readSchemeFork(new URL(s, THEMES).pathname)).fork })));
const ICON = { icl8: [32, 8], ics8: [16, 8], icl4: [32, 4], ics4: [16, 4] };

test('icl8/ics8/icl4/ics4: decoded corpus icons re-encode to the same bytes', () => {
  let checked = 0;
  for (const { slug, fork } of forks) {
    const entries = parseResourceFork(fork);
    const { assets, index } = convertIcons(fork);
    for (const hit of index) {
      const [size, depth] = ICON[hit.type];
      const e = entries[hit.resourceIndex];
      const asset = assets.find((a) => a.path === `icons/${hit.file}`);
      const raster = { width: size, height: size, rgba: asset.rgba };
      const want = e.data.subarray(0, (size * size * depth) / 8);
      const got = encodeIconPlane(raster, depth, { ignoreAlpha: true });
      assert.deepEqual([...got], [...want], `${slug} ${hit.type} ${e.id}`);
      checked++;
    }
  }
  assert.ok(checked > 300, `only ${checked} icons checked`);
});

test('ICN#/ics#: image and mask planes repack to the same bytes', () => {
  let checked = 0;
  for (const { slug, fork } of forks) {
    for (const e of parseResourceFork(fork)) {
      const size = e.type === 'ICN#' ? 32 : e.type === 'ics#' ? 16 : 0;
      if (!size || e.data.length < (size * size) / 4) continue;
      const plane = size * size / 8;
      for (const off of [0, plane]) {
        const bits = expandIndexedPixels(e.data.subarray(off), size, size, 1, size / 8);
        assert.deepEqual([...packIconBits(bits, size)], [...e.data.subarray(off, off + plane)], `${slug} ${e.type} ${e.id} @${off}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 300, `only ${checked} icon lists checked`);
});

test('clut: every corpus colour table re-encodes to the same bytes', () => {
  let checked = 0;
  for (const { slug, fork } of forks) {
    for (const e of parseResourceFork(fork).filter((x) => x.type === 'clut')) {
      const v = new DataView(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      const last = v.getInt16(6);
      const entries = Array.from({ length: last + 1 }, (_, i) => ({
        value: v.getInt16(8 + i * 8), rgb16: [1, 2, 3].map((k) => v.getUint16(8 + i * 8 + k * 2)),
      }));
      const got = encodeClut(entries, { seed: v.getUint32(0), flags: v.getUint16(4) });
      assert.deepEqual([...got], [...e.data.subarray(0, 8 + entries.length * 8)], `${slug} clut ${e.id}`);
      checked++;
    }
  }
  assert.ok(checked >= 36, `only ${checked} cluts checked`);
});

test('authored icon family and header clut decode to what was drawn', () => {
  const large = new Raster(32, 32).fillRect(4, 4, 24, 24, '#000000').fillRect(8, 8, 16, 16, '#ffffff');
  const small = new Raster(16, 16).fillRect(2, 2, 12, 12, '#ff0000');
  const fam = encodeIconFamily(-16455, { large, small });
  assert.deepEqual(fam.map((r) => r.type), ['ICN#', 'icl8', 'icl4', 'ics#', 'ics8', 'ics4']);
  const fork = writeResourceFork(fam);
  const { assets, index } = convertIcons(fork);
  const icl8 = assets.find((a) => a.path === `icons/${index.find((x) => x.type === 'icl8').file}`);
  const px = (a, x, y) => [...a.rgba.subarray((y * a.width + x) * 4, (y * a.width + x) * 4 + 4)];
  assert.deepEqual(px(icl8, 0, 0)[3], 0, 'outside the mask is transparent');
  assert.deepEqual(px(icl8, 5, 5), [0, 0, 0, 255]);
  assert.deepEqual(px(icl8, 10, 10), [255, 255, 255, 255]);
  // The ICN# image plane marks the dark pixels.
  const icn = expandIndexedPixels(fam[0].data, 32, 32, 1, 4);
  assert.equal(icn[5 * 32 + 5], 1);
  assert.equal(icn[10 * 32 + 10], 0);
  assert.throws(() => encodeIconList(new Raster(20, 20)), /16x16 or 32x32/);

  const clut = decodeClut(encodeHeaderClut({
    frame: '#000000', fill: '#ffffff', text: '#000000', lightTinge: '#ffffff', darkTinge: '#000000', lightBevel: '#ffffff', darkBevel: '#000000',
  }, { gamma: false }));
  assert.deepEqual(headerColorsFromClut(clut), {
    frame: '#000000', fill: '#ffffff', lightTinge: '#ffffff', darkTinge: '#000000', lightBevel: '#ffffff', darkBevel: '#000000',
  });
});
