// tools/theme-loader/containers.test.mjs
// The Mac-container unwrappers must recover the EXACT raw resource fork from each
// transfer wrapper, so a user can drop a real downloaded scheme (not just a raw
// .rsrc). We round-trip the real 1138 resource fork through every format — wrap it,
// then assert unwrapToResourceFork gives back byte-identical bytes (since
// convertScheme over an identical fork is already parity-tested, byte-equality here
// guarantees an identical theme). Plus detection + the StuffIt guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectContainer, unwrapToResourceFork, unwrapMacBinary,
  unwrapAppleSingleDouble, decodeBinHex, BINHEX_ALPHABET,
} from './containers.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FORK = new Uint8Array(readFileSync(resolve(root, 'themes', '1138', 'scheme.rsrc')));

const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const roundUp128 = (n) => Math.ceil(n / 128) * 128;

// ── fixture builders (the inverse of each decoder) ──────────────────────────
function wrapMacBinary(rsrc, data = new Uint8Array(0)) {
  const out = new Uint8Array(128 + roundUp128(data.length) + roundUp128(rsrc.length));
  out[1] = 4; // filename length (1..63)
  out.set([0x74, 0x65, 0x73, 0x74], 2); // "test"
  out.set(be32(data.length), 83);
  out.set(be32(rsrc.length), 87);
  out.set(data, 128);
  out.set(rsrc, 128 + roundUp128(data.length));
  return out;
}

function wrapAppleDouble(rsrc, magic = 0x00051607) {
  const headerLen = 26 + 12; // magic+ver+filler+numEntries + one entry
  const out = new Uint8Array(headerLen + rsrc.length);
  out.set(be32(magic), 0);
  out.set(be32(0x00020000), 4); // version 2
  out[25] = 1; // numEntries = 1 (u16 @24)
  out.set(be32(2), 26);          // entry id 2 = resource fork
  out.set(be32(headerLen), 30);  // offset
  out.set(be32(rsrc.length), 34); // length
  out.set(rsrc, headerLen);
  return out;
}

// RLE90 + 6-bit BinHex 4.0 encoder — symmetric to decodeBinHex (same alphabet).
function wrapBinHex(rsrc, { name = 'test', data = new Uint8Array(0) } = {}) {
  const flat = []; // build by loop — spreading a multi-KB fork into push() overflows the stack
  flat.push(name.length); for (const c of name) flat.push(c.charCodeAt(0));
  flat.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); // version + type(4) + creator(4) + flags(2)
  for (const b of be32(data.length)) flat.push(b);
  for (const b of be32(rsrc.length)) flat.push(b);
  flat.push(0, 0);                          // header CRC
  for (const b of data) flat.push(b); flat.push(0, 0); // data fork + data CRC
  for (const b of rsrc) flat.push(b); flat.push(0, 0); // resource fork + rsrc CRC

  const rle = [];
  for (let i = 0; i < flat.length;) {
    const b = flat[i]; let run = 1;
    while (i + run < flat.length && flat[i + run] === b && run < 255) run++;
    if (b === 0x90) { for (let k = 0; k < run; k++) rle.push(0x90, 0x00); } // escape each literal 0x90
    else if (run >= 3) { rle.push(b, 0x90, run); }
    else { for (let k = 0; k < run; k++) rle.push(b); }
    i += run;
  }

  let str = ':', acc = 0, n = 0;
  for (const b of rle) { acc = (acc << 8) | b; n += 8; while (n >= 6) { n -= 6; str += BINHEX_ALPHABET[(acc >> n) & 0x3f]; } }
  if (n > 0) str += BINHEX_ALPHABET[(acc << (6 - n)) & 0x3f];
  str += ':';
  return Uint8Array.from(`(This file must be converted with BinHex 4.0)\n${str}\n`, (c) => c.charCodeAt(0));
}

// ── detection ───────────────────────────────────────────────────────────────
test('detectContainer identifies each wrapper (and a raw fork as raw)', () => {
  assert.equal(detectContainer(FORK), 'raw');
  assert.equal(detectContainer(wrapMacBinary(FORK)), 'macbinary');
  assert.equal(detectContainer(wrapAppleDouble(FORK, 0x00051607)), 'appledouble');
  assert.equal(detectContainer(wrapAppleDouble(FORK, 0x00051600)), 'applesingle');
  assert.equal(detectContainer(wrapBinHex(new Uint8Array([1, 2, 3]))), 'binhex');
  assert.equal(detectContainer(Uint8Array.from('SIT!\0\0\0\0\0\0rLau\0\0\0\0', (c) => c.charCodeAt(0))), 'stuffit');
});

// ── round-trips: every wrapper recovers the byte-identical fork ──────────────
test('MacBinary round-trips the real 1138 resource fork byte-for-byte', () => {
  assert.deepEqual(unwrapMacBinary(wrapMacBinary(FORK)), FORK);
  assert.deepEqual(unwrapToResourceFork(wrapMacBinary(FORK)), FORK); // via the dispatcher too
});

test('AppleDouble & AppleSingle round-trip the fork byte-for-byte', () => {
  assert.deepEqual(unwrapAppleSingleDouble(wrapAppleDouble(FORK, 0x00051607)), FORK);
  assert.deepEqual(unwrapToResourceFork(wrapAppleDouble(FORK, 0x00051600)), FORK);
});

test('BinHex round-trips the real fork (exercises RLE90 on real bytes + runs)', () => {
  const { rsrc, name } = decodeBinHex(wrapBinHex(FORK, { name: 'scheme' }));
  assert.equal(name, 'scheme');
  assert.deepEqual(rsrc, FORK);
  assert.deepEqual(unwrapToResourceFork(wrapBinHex(FORK)), FORK);
});

// ── guards ───────────────────────────────────────────────────────────────────
test('a raw fork passes through unwrapToResourceFork unchanged', () => {
  assert.equal(unwrapToResourceFork(FORK), FORK); // same reference — no copy for raw
});

test('StuffIt is detected but unwrap throws a clear, actionable message', () => {
  const sit = Uint8Array.from('SIT!\0\0\0\0\0\0rLau\0\0\0\0', (c) => c.charCodeAt(0));
  assert.equal(detectContainer(sit), 'stuffit');
  assert.throws(() => unwrapToResourceFork(sit), /StuffIt .* not yet supported/);
});
