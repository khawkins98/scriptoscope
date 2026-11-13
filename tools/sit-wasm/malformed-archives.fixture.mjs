// tools/sit-wasm/malformed-archives.fixture.mjs
// Minimal malformed archives for sit-wasm.malformed.test.mjs, built in code so no opaque
// binaries are committed. Each is under 400 bytes and targets one missing check in the
// vendored decoder (see munbox/PATCHES.md, patch #4).
//
// Run directly, this file is the test's child process:
//   node malformed-archives.fixture.mjs <fixture-name> <valid-archive-path>
// It decodes the valid archive, then the named fixture, then the valid archive again, all on
// ONE decoder instance, and prints a single JSON line. The parent applies the timeout, so an
// input that never returns cannot hang the test run.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import createMunbox from './dist/munbox.mjs';

const wbe16 = (b, o, v) => { b[o] = (v >>> 8) & 255; b[o + 1] = v & 255; };
const wbe32 = (b, o, v) => { b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; };

// CRC-16/ARC, used by classic StuffIt entry headers and forks.
const ARC = new Uint16Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xA001 : c >>> 1; ARC[i] = c; }
const crcArc = (buf) => { let crc = 0; for (const x of buf) crc = ARC[(crc ^ x) & 255] ^ (crc >>> 8); return crc & 0xFFFF; };

/** Classic `SIT!` writer. items: { folder } | { end: true } | { name, rsrc?, data? } with
 * forks shaped { method, comp: Uint8Array, uncomp: number, crc: number }. */
function classicSit(items) {
  const chunks = [new Uint8Array(22)];
  const offsets = [];
  let pos = 22;
  for (const it of items) {
    const h = new Uint8Array(112);
    offsets.push(pos);
    if (it.folder !== undefined) {
      h[0] = h[1] = 32; h[2] = it.folder.length;
      for (let i = 0; i < it.folder.length; i++) h[3 + i] = it.folder.charCodeAt(i);
    } else if (it.end) {
      h[0] = h[1] = 33;
    } else {
      h[0] = it.rsrc?.method ?? 0; h[1] = it.data?.method ?? 0; h[2] = it.name.length;
      for (let i = 0; i < it.name.length; i++) h[3 + i] = it.name.charCodeAt(i);
      wbe32(h, 66, 0x436f6c72); wbe32(h, 70, 0x41636964); // type 'Colr', creator 'Acid'
      wbe32(h, 84, it.rsrc?.uncomp ?? 0); wbe32(h, 88, it.data?.uncomp ?? 0);
      wbe32(h, 92, it.rsrc?.comp.length ?? 0); wbe32(h, 96, it.data?.comp.length ?? 0);
      wbe16(h, 100, it.rsrc?.crc ?? 0); wbe16(h, 102, it.data?.crc ?? 0);
    }
    wbe16(h, 110, crcArc(h.subarray(0, 110)));
    chunks.push(h); pos += 112;
    for (const f of [it.rsrc, it.data]) if (f) { chunks.push(f.comp); pos += f.comp.length; }
  }
  const out = new Uint8Array(pos);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  out.set([0x53, 0x49, 0x54, 0x21]); wbe16(out, 4, 1); wbe32(out, 6, pos);
  out.set([0x72, 0x4c, 0x61, 0x75], 10); out[14] = 2;
  return { bytes: out, offsets };
}
const stored = (raw) => ({ method: 0, comp: raw, uncomp: raw.length, crc: crcArc(raw) });
const oneFork = (comp, uncomp, method) => classicSit([{ name: 'a', rsrc: { method, comp, uncomp, crc: 0 } }]).bytes;
/** A valid classic archive holding `inner` as a stored data fork (a nested archive). */
const nestedInSit = (inner) => classicSit([{ name: 'a', data: stored(inner) }]).bytes;

// StuffIt method 13 bit writer: values go in LSB first, metacode words MSB first.
const META_WORDS = [0x00dd, 0x001a, 0x0002, 0x0003, 0x0000, 0x000f, 0x0035, 0x0005, 0x0006, 0x0007, 0x001b, 0x0034, 0x0001, 0x0001, 0x000e, 0x000c, 0x0036, 0x01bd, 0x0006, 0x000b, 0x000e, 0x001f, 0x001e, 0x0009, 0x0008, 0x000a, 0x01bc, 0x01bf, 0x01be, 0x01b9, 0x01b8, 0x0004, 0x0002, 0x0001, 0x0007, 0x000c, 0x0002];
const META_LENGTHS = [11, 8, 8, 8, 8, 7, 6, 5, 5, 5, 5, 6, 5, 6, 7, 7, 9, 12, 10, 11, 11, 12, 12, 11, 11, 11, 12, 12, 12, 12, 12, 5, 2, 2, 3, 4, 5];
function method13(build) {
  const bits = [];
  const w = {
    meta(s) { for (let i = META_LENGTHS[s] - 1; i >= 0; i--) bits.push((META_WORDS[s] >> i) & 1); return w; },
    num(v, n) { for (let i = 0; i < n; i++) bits.push((v >> i) & 1); return w; },
    /** Metacode command 36: n code lengths in a row (n in 11..74). */
    repeat(n) { return w.meta(36).num(n - 11, 6); },
  };
  w.num(0x00, 8); // header byte: dynamic code trees
  build(w);
  const out = new Uint8Array(Math.ceil(bits.length / 8) + 8);
  bits.forEach((v, i) => { if (v) out[i >> 3] |= 1 << (i & 7); });
  return out;
}

/** Compact Pro archive with one file entry `a` and one fork stream. */
function compactPro(stream, { flags, rsrcLen = 0, dataLen = 0, rsrcComp = 0, dataComp = 0 }) {
  const dir = new Uint8Array(7 + 2 + 45);
  dir[5] = 1;                // one entry
  dir[7] = 1; dir[8] = 0x61; // name "a"
  const m = 9;               // 45-byte file metadata
  dir[m] = 1; wbe32(dir, m + 1, 8); // volume, fork offset
  wbe16(dir, m + 27, flags); wbe32(dir, m + 29, rsrcLen); wbe32(dir, m + 33, dataLen);
  wbe32(dir, m + 37, rsrcComp); wbe32(dir, m + 41, dataComp);
  const out = new Uint8Array(8 + stream.length + dir.length);
  out[0] = 1; out[1] = 1; wbe32(out, 4, 8 + stream.length);
  out.set(stream, 8); out.set(dir, 8 + stream.length);
  return out;
}

function sit5ShortHeader() {
  const sig = 'StuffIt (c)1997-2001 Aladdin Systems, Inc., http://www.aladdinsys.com/StuffIt/\r\n';
  const a = new Uint8Array(100 + 48 + 40);
  for (let i = 0; i < sig.length; i++) a[i] = sig.charCodeAt(i);
  wbe16(a, 92, 1); wbe32(a, 94, 100);          // one entry, at offset 100
  wbe32(a, 100, 0xa5a5a5a5); a[104] = 1;       // entry magic, version
  wbe16(a, 106, 0);                            // header length 0 (the fixed header is 48 bytes)
  a[109] = 0x40; wbe32(a, 134, 0xffffffff);
  return a;
}

function wrappedForkLength() {
  const { bytes, offsets } = classicSit([{ folder: 'f' }, { name: 'a', rsrc: { method: 0, comp: new Uint8Array(4), uncomp: 4, crc: 0 } }, { end: true }]);
  const e = offsets[1];
  wbe32(bytes, e + 84, 0); wbe32(bytes, e + 88, 1); // no resource fork, 1-byte data fork
  wbe32(bytes, e + 92, 0); wbe32(bytes, e + 96, 0xFFFFFF90); // data fork "length" wraps a 32-bit sum
  return bytes;
}

function overSubscribedCompactProTable() {
  const lens = new Uint8Array(128); // 256 literal code lengths, two per byte
  const set = (sym, l) => { lens[sym >> 1] |= (sym & 1) ? l : l << 4; };
  set(200, 1); set(201, 1); set(202, 3);
  const stream = Uint8Array.from([128, ...lens, 0, 0, 0, 0, 0, 0]);
  return compactPro(stream, { flags: 2, rsrcLen: 16, rsrcComp: stream.length });
}

const emptyCompactPro = () => { const a = new Uint8Array(15); a[0] = 1; a[1] = 1; wbe32(a, 4, 8); return a; };
/** Four stream bytes whose run-length counter underflows; the fork declares 4 GiB of output. */
const compactProBomb = () => compactPro(Uint8Array.from([0x41, 0x81, 0x82, 0x01]), { flags: 0, rsrcLen: 0xffffffff, rsrcComp: 4 });

/**
 * name → { bytes, expect }. `expect` is a RegExp the decode error must match, or the number of
 * forks a successful decode returns. `hung: true` marks inputs the unpatched decoder never
 * returned from.
 */
export const MALFORMED = {
  'stored fork shorter than its declared length': {
    bytes: oneFork(new Uint8Array(0), 16, 0), expect: /stored fork ends before its declared length/, hung: true },
  'method 13 code length driven below -1': {
    bytes: oneFork(method13((w) => { w.meta(33).meta(33); for (let i = 0; i < 4; i++) w.repeat(74); w.repeat(23); }), 16, 13),
    expect: /SIT13 init failed/, hung: true },
  'fork length that wraps a 32-bit bounds check': {
    bytes: wrappedForkLength(), expect: /fork data out of range/, hung: true },
  'method 13 over-subscribed code lengths': {
    bytes: oneFork(method13((w) => { w.meta(0); for (let i = 0; i < 4; i++) w.repeat(74); w.repeat(24); }), 16, 13),
    expect: /SIT13 init failed/ },
  'method 13 repeat commands past the code-length table': {
    bytes: oneFork(method13((w) => { w.meta(30); for (let i = 0; i < 5; i++) w.repeat(74); }), 16, 13),
    expect: /SIT13 init failed/ },
  'method 13 stream far shorter than its declared length': {
    bytes: oneFork(Uint8Array.from([0x10]), 0x7fffffff, 13), expect: /^decodeArchive: / },
  'StuffIt 5 entry header shorter than the fixed header': {
    bytes: sit5ShortHeader(), expect: /header1 too short/, hung: true },
  'Compact Pro code table that over-subscribes its code space': {
    bytes: overSubscribedCompactProTable(), expect: 1 },
  'Compact Pro archive with no entries': {
    bytes: emptyCompactPro(), expect: 0 },
  'Compact Pro fork declaring 4 GiB of output': {
    bytes: compactProBomb(), expect: /decoded output exceeds the 32 MiB limit/, hung: true },
  'nested: over-subscribed Compact Pro table inside a StuffIt archive': {
    bytes: nestedInSit(overSubscribedCompactProTable()), expect: 1 },
  'nested: empty Compact Pro archive inside a StuffIt archive': {
    bytes: nestedInSit(emptyCompactPro()), expect: 0 },
  'nested: 4 GiB Compact Pro fork inside a StuffIt archive': {
    bytes: nestedInSit(compactProBomb()), expect: /decoded output exceeds the 32 MiB limit/, hung: true },
};

// --- one decoder instance, driven the way index.mjs drives it ---

export const newDecoder = () => createMunbox({ print: () => {} });
const readU32 = (h, o) => (h[o] | (h[o + 1] << 8) | (h[o + 2] << 16) | (h[o + 3] << 24)) >>> 0;

/** Decode on a given instance. Returns the packed output; throws `decodeArchive: …` on a decoder error. */
export function decodeOn(m, u8) {
  const inPtr = m._malloc(u8.length || 1);
  m.HEAPU8.set(u8, inPtr);
  const outPtr = m._sit_decode(inPtr, u8.length);
  m._free(inPtr);
  if (!outPtr) throw new Error(`decodeArchive: ${m.UTF8ToString(m._sit_error()) || 'decode failed'}`);
  const packed = m.HEAPU8.slice(outPtr, outPtr + readU32(m.HEAPU8, outPtr));
  m._sit_free(outPtr);
  return packed;
}
export const forkCount = (packed) => readU32(packed, 4);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const load = (path) => new Uint8Array(readFileSync(path));

/** `<fixture-name> <valid>`: valid, malformed, valid again on one instance. */
async function malformedCase(name, validPath) {
  const valid = load(validPath);
  const m = await newDecoder();
  const result = { before: sha256(decodeOn(m, valid)) };
  try {
    result.forks = forkCount(decodeOn(m, MALFORMED[name].bytes));
  } catch (e) {
    // A decoder error is an Error whose message starts "decodeArchive: "; a trap or abort
    // inside the WASM module is a WebAssembly.RuntimeError.
    result.error = String(e?.message ?? e);
    result.trapped = e instanceof WebAssembly.RuntimeError;
  }
  try { result.after = sha256(decodeOn(m, valid)); } catch (e) { result.afterError = String(e?.message ?? e); }
  return result;
}

/** `--memory <passes> <valid>...`: linear-memory size after each pass over the valid archives. */
async function memoryPasses(passes, paths) {
  const inputs = paths.map(load);
  const m = await newDecoder();
  const result = { memory: [], errors: 0, largestOutput: 0 };
  for (let p = 0; p < passes; p++) {
    for (const bytes of inputs) {
      try { result.largestOutput = Math.max(result.largestOutput, decodeOn(m, bytes).length); } catch { result.errors++; }
    }
    result.memory.push(m.HEAPU8.length);
  }
  return result;
}

/** `--memory-malformed <passes> <valid>`: every fixture's error path, repeatedly, on one instance. */
async function memoryMalformed(passes, validPath) {
  const valid = load(validPath);
  const fixtures = Object.values(MALFORMED).filter((f) => !/32 MiB/.test(String(f.expect))).map((f) => f.bytes);
  const m = await newDecoder();
  const want = sha256(decodeOn(m, valid));
  const result = { trapped: 0, validMismatches: 0 };
  for (let p = 0; p < passes; p++) {
    for (const bytes of fixtures) {
      try { decodeOn(m, bytes); } catch (e) { if (e instanceof WebAssembly.RuntimeError) result.trapped++; }
    }
    try { if (sha256(decodeOn(m, valid)) !== want) result.validMismatches++; } catch { result.validMismatches++; }
    if (p === 0) result.memoryAfterFirstPass = m.HEAPU8.length;
  }
  result.memoryEnd = m.HEAPU8.length;
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , mode, ...rest] = process.argv;
  const result = mode === '--memory' ? await memoryPasses(Number(rest[0]), rest.slice(1))
    : mode === '--memory-malformed' ? await memoryMalformed(Number(rest[0]), rest[1])
    : await malformedCase(mode, rest[0]);
  process.stdout.write(JSON.stringify(result) + '\n');
}
