// Corpus round-trips for the control-panel extras encoders (STR#, DLOG, DITL,
// crsr, snd). tools/theme-loader has no decoder for these types, so each test
// parses the corpus records with the minimal reader below (the layouts in the
// encoders' header comments), re-encodes them, and requires the same bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { parseResourceFork } from '../theme-loader/resource-fork.js';
import { readSchemeFork } from '../../scripts/lib/scheme-source.mjs';
import { encodeStrList, toMacRoman } from './encode-strings.js';
import { encodeDlog, encodeDitl, DITL_TYPE } from './encode-dialog.js';
import { encodeCrsrRecord, encodeCrsr } from './encode-crsr.js';
import { encodeSnd, synthesize, toOffsetBinary, SND_RATE } from './encode-snd.js';
import { aboutBox, arrowCursors, shadeSounds, ARROW, aboutTextWidth, wrapAboutText } from './classic-extras.js';
import { Raster } from './raster.js';
import { expandIndexedPixels } from '../theme-loader/decoders/shared.js';

const THEMES = new URL('../../themes/', import.meta.url);
const slugs = readdirSync(THEMES).filter((s) => existsSync(new URL(`${s}/meta.json`, THEMES)));
const all = (await Promise.all(slugs.map(async (slug) => parseResourceFork((await readSchemeFork(new URL(slug, THEMES).pathname)).fork)
  .map((r) => ({ ...r, slug }))))).flat();
const ofType = (t) => all.filter((r) => r.type === t);
const view = (d) => new DataView(d.buffer, d.byteOffset, d.byteLength);
const rect = (v, o) => ({ top: v.getInt16(o), left: v.getInt16(o + 2), bottom: v.getInt16(o + 4), right: v.getInt16(o + 6) });

test('STR#: every corpus string list re-encodes to the same bytes', () => {
  const lists = ofType('STR#');
  assert.ok(lists.length >= 13, `${lists.length} STR#`);
  for (const r of lists) {
    const n = view(r.data).getUint16(0);
    const strings = [];
    let o = 2;
    for (let i = 0; i < n; i++) { strings.push(r.data.subarray(o + 1, o + 1 + r.data[o])); o += 1 + r.data[o]; }
    assert.deepEqual([...encodeStrList(strings)], [...r.data.subarray(0, o)], `${r.slug} STR# ${r.id}`);
    assert.ok(r.data.subarray(o).every((b) => b === 0), `${r.slug} STR# ${r.id}: only zero padding after the list`);
  }
});

test('toMacRoman: ASCII, line breaks and the mapped punctuation', () => {
  assert.deepEqual(toMacRoman('A\n©’…'), [65, 13, 0xa9, 0xd5, 0xc9]);
  assert.throws(() => toMacRoman('☃'), /no Mac Roman mapping/);
});

test('DLOG: every corpus about-box template re-encodes to the same bytes', () => {
  const dlogs = ofType('DLOG').filter((r) => r.id === -14320);
  assert.equal(dlogs.length, 18);
  for (const r of dlogs) {
    const v = view(r.data), titleLen = r.data[20];
    const end = 21 + titleLen;
    const hasPosition = r.data.length >= end + (end & 1) + 2;
    const got = encodeDlog({
      rect: rect(v, 0), procID: v.getInt16(8), visible: r.data[10] === 1, goAway: r.data[12] === 1,
      refCon: v.getUint32(14), itemListId: v.getInt16(18), title: r.data.subarray(21, end),
      position: hasPosition ? v.getUint16(end + (end & 1)) : null, padByte: end & 1 ? r.data[end] : 0,
    });
    assert.deepEqual([...got], [...r.data], `${r.slug} DLOG ${r.id}`);
  }
});

function parseDitl(data) {
  const v = view(data), items = [];
  let o = 2;
  for (let i = 0; i <= v.getInt16(0); i++) {
    const type = data[o + 12], len = data[o + 13];
    items.push({ code: type & 0x7f, enabled: !(type & 0x80), rect: rect(v, o + 4), bytes: data.subarray(o + 14, o + 14 + len) });
    o += 14 + len + (len & 1);
  }
  return { items, end: o };
}
const TYPE_NAME = Object.fromEntries(Object.entries(DITL_TYPE).map(([k, v]) => [v, k]));

test('DITL: every corpus about-box item list re-encodes to the same bytes', () => {
  const ditls = ofType('DITL').filter((r) => r.id === -14320);
  assert.equal(ditls.length, 18);
  for (const r of ditls) {
    const { items, end } = parseDitl(r.data);
    const got = encodeDitl(items.map((it) => ({ type: TYPE_NAME[it.code], enabled: it.enabled, rect: it.rect, bytes: it.bytes })));
    assert.deepEqual([...got], [...r.data.subarray(0, end)], `${r.slug} DITL ${r.id}`);
  }
});

function parseCrsr(d) {
  const v = view(d), pm = v.getUint32(2), at = v.getUint32(6);
  const rowBytes = v.getUint16(pm + 4) & 0x3fff, depth = v.getUint16(pm + 32), ct = v.getUint32(pm + 42);
  const bits = (o) => Array.from({ length: 256 }, (_, i) => (d[o + (i >> 4) * 2 + ((i & 15) >> 3)] >> (7 - (i & 7))) & 1);
  const colorTable = [];
  for (let i = 0; i <= v.getInt16(ct + 6); i++) {
    const e = ct + 8 + i * 8;
    colorTable.push({ value: v.getInt16(e), rgb16: [v.getUint16(e + 2), v.getUint16(e + 4), v.getUint16(e + 6)] });
  }
  return {
    data: bits(20), mask: bits(52), hotSpot: { y: v.getInt16(84), x: v.getInt16(86) }, depth,
    pixels: expandIndexedPixels(d.subarray(at, at + rowBytes * 16), 16, 16, depth, rowBytes),
    colorTable, ctSeed: v.getUint32(ct), ctFlags: v.getUint16(ct + 4), packSize: v.getUint32(pm + 18), end: ct + 8 + colorTable.length * 8,
  };
}

test('crsr: every corpus cursor re-encodes to the same bytes', () => {
  const cursors = ofType('crsr');
  assert.ok(cursors.length >= 50, `${cursors.length} crsr`);
  for (const r of cursors) {
    const c = parseCrsr(r.data);
    assert.deepEqual([...encodeCrsrRecord(c)], [...r.data.subarray(0, c.end)], `${r.slug} crsr ${r.id}`);
    assert.ok(r.data.subarray(c.end).every((b) => b === 0), `${r.slug} crsr ${r.id}: only zero padding after the table`);
  }
});

test('encodeCrsr: a raster round-trips, white is entry 0, the 1-bit image stays inside the mask', () => {
  const r = new Raster(16, 16).sprite(0, 0, ARROW, { '#': '#003366', o: '#ffcc33' });
  const c = parseCrsr(encodeCrsr(r, { hotSpot: { x: 1, y: 1 } }));
  assert.deepEqual(c.colorTable[0].rgb16, [0xffff, 0xffff, 0xffff]);
  assert.deepEqual(c.hotSpot, { x: 1, y: 1 });
  for (let i = 0; i < 256; i++) {
    const ch = ARROW[i >> 4][i & 15];
    assert.equal(c.mask[i], ch === '.' ? 0 : 1);
    assert.equal(c.data[i], ch === '#' ? 1 : 0, 'dark fill → 1-bit black, light outline → white');
    if (ch === '.') assert.equal(c.pixels[i], 0);
  }
  assert.throws(() => encodeCrsr(new Raster(8, 8), { hotSpot: { x: 0, y: 0 } }), /16×16/);
});

test('arrowCursors: the System 7 arrow data and mask on 1-bit screens, four cursors', () => {
  const cursors = arrowCursors({ fill: '#000033', outline: '#ffcc33' });
  assert.deepEqual(cursors.map((c) => c.id), [0, -20486, -20487, -20488]);
  const word = (bits, y) => bits.slice(y * 16, y * 16 + 16).reduce((a, b) => (a << 1) | b, 0);
  const arrow = parseCrsr(cursors[0].data);
  // Inside Macintosh: Imaging With QuickDraw, the standard arrow cursor.
  assert.deepEqual(Array.from({ length: 16 }, (_, y) => word(arrow.data, y)),
    [0x0000, 0x4000, 0x6000, 0x7000, 0x7800, 0x7c00, 0x7e00, 0x7f00, 0x7f80, 0x7c00, 0x6c00, 0x4600, 0x0600, 0x0300, 0x0300, 0x0000]);
  assert.deepEqual(Array.from({ length: 16 }, (_, y) => word(arrow.mask, y)),
    [0xc000, 0xe000, 0xf000, 0xf800, 0xfc00, 0xfe00, 0xff00, 0xff80, 0xffc0, 0xffe0, 0xfe00, 0xef00, 0xcf00, 0x0780, 0x0780, 0x0380]);
  for (const c of cursors.slice(1)) {
    const p = parseCrsr(c.data);
    for (let i = 0; i < 256; i++) assert.ok(!p.data[i] || p.mask[i], `crsr ${c.id}: 1-bit image inside the mask`);
  }
});

function parseSnd(d) {
  const v = view(d);
  if (v.getUint16(0) !== 1 || v.getUint16(2) !== 1 || v.getUint16(4) !== 5 || v.getUint16(10) !== 1 || v.getUint16(12) !== 0x8051) return null;
  const h = v.getUint32(16);
  if (h !== 20 || d[h + 20] !== 0) return null; // standard sound header only
  const length = v.getUint32(h + 4);
  return {
    modInit: v.getUint32(6), length, sampleRate: v.getUint32(h + 8), loopStart: v.getUint32(h + 12), loopEnd: v.getUint32(h + 16),
    baseFrequency: d[h + 21], samples: d.subarray(h + 22, h + 22 + length),
  };
}

test('snd: every corpus format-1 standard-header sound re-encodes to the same bytes', () => {
  let checked = 0;
  for (const r of ofType('snd ')) {
    const s = parseSnd(r.data);
    if (!s) continue;
    const got = encodeSnd(s.samples, s);
    assert.deepEqual([...got], [...r.data.subarray(0, got.length)], `${r.slug} snd ${r.id}`);
    checked++;
  }
  assert.ok(checked >= 8, `only ${checked} sounds checked`);
});

test('synthesize: deterministic, normalised to the peak, silent at the end', () => {
  const voices = [{ from: 880, to: 440, decay: 0.05 }, { wave: 'noise', from: 2000, amp: 0.3 }];
  const a = synthesize(voices, { seconds: 0.2 }), b = synthesize(voices, { seconds: 0.2 });
  assert.deepEqual(a, b);
  assert.equal(a.length, Math.round(0.2 * SND_RATE.r11k / 65536));
  assert.ok(Math.abs(Math.max(...a.map(Math.abs)) - 0.8) < 1e-6);
  assert.equal(toOffsetBinary([a.at(-1)])[0], 128);
  const snd = parseSnd(encodeSnd(a, { float: true }));
  assert.equal(snd.length, a.length);
  assert.equal(snd.sampleRate, SND_RATE.r11k);
});

test('aboutBox: DLOG -14320 names DITL -14320, whose icon item names cicn 128; the panel strings are name first', () => {
  const icon = new Raster(32, 32).fillRect(4, 4, 24, 24, '#336699');
  const res = aboutBox({ name: 'Test', description: 'A test scheme.', year: 2026, icon });
  const get = (t) => res.find((r) => r.type === t);
  assert.equal(view(get('DLOG').data).getInt16(18), -14320);
  const { items } = parseDitl(get('DITL').data);
  assert.deepEqual(items.map((i) => TYPE_NAME[i.code]), ['staticText', 'icon', 'user']);
  assert.equal(view(items[1].bytes).getInt16(0), get('cicn').id);
  assert.match(String.fromCharCode(...items[0].bytes), /^Test\rA test scheme\.\r\rAn original first-party scheme for Scriptoscope\.\r2026$/);
  const str = get('STR#').data;
  assert.equal(String.fromCharCode(...str.subarray(3, 3 + str[2])), 'Test');
  assert.throws(() => aboutBox({ name: 'x', description: 'x', year: 1, icon: new Raster(16, 16) }), /32×32/);
});

test('aboutBox: the box is sized to its text in the panel font (Geneva 9, 13 px lines), and a larger icon moves the text over', () => {
  // Widths measured in real Kaleidoscope (classic/about@2x.png, ink extent + 1):
  // the table must stay within a few px, so the pre-wrapped lines fit their box.
  for (const [line, px] of [['A stone keep with towers, banners and a portcullis.', 248], ['An original first-party scheme for Scriptoscope.', 238],
    ['Chunky toy bricks in bright primary plastic.', 220], ['2026', 27]]) {
    assert.ok(Math.abs(aboutTextWidth(line) - px) <= 7, `${line}: ${aboutTextWidth(line)} vs ${px}`);
  }
  // Kaleidoscope wrapped Kingfisher's description after "teal"; so does the table.
  assert.deepEqual(wrapAboutText('A kingfisher lands on frosted glass: lavender, navy and teal water.'),
    ['A kingfisher lands on frosted glass: lavender, navy and teal', 'water.']);
  const box = (icon) => {
    const res = aboutBox({ name: 'Test', description: 'A test scheme.', year: 2026, icon });
    const dlog = view(res.find((r) => r.type === 'DLOG').data);
    const { items } = parseDitl(res.find((r) => r.type === 'DITL').data);
    return { w: dlog.getInt16(6) - dlog.getInt16(2), h: dlog.getInt16(4) - dlog.getInt16(0), text: items[0].rect, icon: items[1].rect };
  };
  const small = box(new Raster(32, 32).fillRect(0, 0, 32, 32, '#336699'));
  assert.deepEqual(small.text, { top: 14, left: 64, bottom: 14 + 5 * 13, right: small.text.right });
  assert.equal(small.h, 14 + 5 * 13 - 1 + 16);
  assert.ok(small.w < 380 && small.text.right - small.text.left <= 300);
  const big = box(new Raster(40, 48).fillRect(0, 0, 40, 48, '#336699'));
  assert.deepEqual(big.icon, { top: 16, left: 16, bottom: 64, right: 56 });
  assert.equal(big.text.left, 72);
  assert.equal(big.h, small.h, 'five lines are taller than a 48 px icon');
  assert.equal(box(new Raster(64, 64).fillRect(0, 0, 64, 64, '#336699')).h, 16 + 64 + 16, 'a 64 px icon sets the height');
  assert.throws(() => aboutBox({ name: 'x', description: 'x', year: 1, icon: new Raster(80, 80) }), /64×64/);
});

test('shadeSounds: collapse is -14336, expand -14335', () => {
  const s = synthesize([{ from: 440 }], { seconds: 0.05 });
  assert.deepEqual(shadeSounds({ collapse: s, expand: s }).map((r) => [r.type, r.id]), [['snd ', -14336], ['snd ', -14335]]);
});

test('first-party schemes ship the control-panel extras: about box, panel strings, four cursors in system colours, both sounds, menus', async () => {
  const { readFileSync } = await import('node:fs');
  const { SYSTEM_PALETTE_256 } = await import('./encode-icons.js');
  const system = new Set(SYSTEM_PALETTE_256.map((c) => c.map((v) => (v << 8) | v).join()));
  const authored = new URL('../../authoring/schemes/', import.meta.url);
  const dirs = readdirSync(authored).filter((dir) => existsSync(new URL(`${dir}/scheme.mjs`, authored)));
  for (const dir of dirs) {
    const { name } = JSON.parse(readFileSync(new URL(`${dir}/meta.json`, authored), 'utf8'));
    const res = parseResourceFork(new Uint8Array(readFileSync(new URL(`${dir}/scheme.rsrc`, authored))));
    const get = (t, id) => res.find((r) => r.type === t && r.id === id);
    for (const [t, id] of [['DLOG', -14320], ['DITL', -14320], ['STR#', -14320], ['cicn', 128], ['crsr', 0], ['crsr', -20486], ['crsr', -20487], ['crsr', -20488], ['snd ', -14336], ['snd ', -14335], ['cicn', -12240]]) {
      assert.ok(get(t, id), `${dir}: ${t} ${id}`);
    }
    const text = String.fromCharCode(...parseDitl(get('DITL', -14320).data).items[0].bytes);
    assert.ok(text.startsWith(`${name}\r`) && text.includes('An original first-party scheme for Scriptoscope.') && /\r2026$/.test(text), `${dir} about text: ${text}`);
    for (const id of [0, -20486, -20487, -20488]) {
      const c = parseCrsr(get('crsr', id).data);
      assert.deepEqual(c.hotSpot, { x: 1, y: 1 });
      for (const e of c.colorTable) assert.ok(system.has(e.rgb16.join()), `${dir} crsr ${id}: colour ${e.rgb16} is an 8-bit system entry`);
    }
    for (const id of [-14336, -14335]) {
      const s = parseSnd(get('snd ', id).data);
      assert.ok(s && s.sampleRate === SND_RATE.r11k && s.length > 1000 && s.length < 6000, `${dir} snd ${id}`);
    }
  }
});
