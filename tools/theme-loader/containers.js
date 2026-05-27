// Mac archive/container unwrappers — pure JS, browser-portable (no fs/zlib/Buffer).
//
// Kaleidoscope schemes were distributed as classic-Mac transfer wrappers, because a
// raw resource fork doesn't survive a non-HFS filesystem or an FTP transfer. This
// module takes whatever a user drops and recovers the RAW RESOURCE FORK bytes that
// the rest of the pipeline expects (resource-fork.js → convert.js). It handles the
// toolchain-free formats:
//
//   • MacBinary I/II/III — 128-byte header, then data fork, then resource fork.
//   • AppleSingle / AppleDouble — an entry table; the resource fork is entry id 2.
//   • BinHex 4.0 (.hqx) — 6-bit ASCII + RLE90, forks length-prefixed.
//   • raw resource fork — passed through unchanged.
//
// StuffIt (.sit) is DETECTED here (so we can route + give a clear message) but not yet
// decoded — that needs a separate WASM decoder (see the browser-conversion design).
//
// Format references:
//   MacBinary II:  https://files.stairways.com/other/macbinaryii-standard-info.txt
//   AppleSingle/Double: RFC 1740 (the entry table + entry ids)
//   BinHex 4.0:    RFC 1741 (the 6-bit alphabet, RLE90, the fork layout)

/** @typedef {'macbinary'|'applesingle'|'appledouble'|'binhex'|'stuffit'|'raw'} ContainerKind */

const u32 = (b, o) => (b[o] * 0x1000000) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; // big-endian, unsigned
const u16 = (b, o) => (b[o] << 8) | b[o + 1];

/** ASCII-decode the first `n` bytes (for sniffing text headers / magic strings). */
function asciiHead(bytes, n = 128) {
  let s = '';
  const lim = Math.min(n, bytes.length);
  for (let i = 0; i < lim; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * Identify the container format of a dropped file from its bytes. Best-effort: returns
 * 'raw' when nothing else matches (the downstream resource-fork parser then gives a
 * precise error if it isn't actually a fork).
 * @param {Uint8Array} bytes
 * @returns {ContainerKind}
 */
export function detectContainer(bytes) {
  if (!bytes || bytes.length < 16) return 'raw';

  // AppleSingle (0x00051600) / AppleDouble (0x00051607): exact 4-byte magic.
  const magic = u32(bytes, 0);
  if (magic === 0x00051600) return 'applesingle';
  if (magic === 0x00051607) return 'appledouble';

  // StuffIt: classic archives start with "SIT!" (+ "rLau" at offset 10) or the
  // StuffIt 5 signature "StuffIt (c)1997-".
  const head = asciiHead(bytes, 16);
  if (head.startsWith('SIT!') || head.startsWith('StuffIt')) return 'stuffit';

  // BinHex 4.0: a text file whose preamble names BinHex, with a ':'-delimited stream.
  const textHead = asciiHead(bytes, 256);
  if (/\(This file must be converted with BinHex/i.test(textHead) || /BinHex 4\.0/i.test(textHead)) return 'binhex';

  // MacBinary: no magic. Heuristic per the MacBinary II spec — byte[0] (old version)
  // and byte[74] (zero) are 0, the filename length (byte[1]) is 1..63, and the
  // declared fork sizes fit the file. (CRC at 124 confirms II/III but isn't required.)
  if (bytes[0] === 0 && bytes[74] === 0 && bytes[1] >= 1 && bytes[1] <= 63) {
    const dataLen = u32(bytes, 83);
    const rsrcLen = u32(bytes, 87);
    const total = 128 + roundUp128(dataLen) + roundUp128(rsrcLen);
    if (rsrcLen > 0 && total <= bytes.length + 128) return 'macbinary';
  }

  return 'raw';
}

const roundUp128 = (n) => Math.ceil(n / 128) * 128;

/**
 * Recover the raw resource-fork bytes from any supported container. A raw fork passes
 * through unchanged. Throws a clear error for StuffIt (not yet supported) or a malformed
 * wrapper.
 * @param {Uint8Array} bytes
 * @param {ContainerKind} [kind] precomputed kind (else auto-detected)
 * @returns {Uint8Array} the resource fork
 */
export function unwrapToResourceFork(bytes, kind = detectContainer(bytes)) {
  switch (kind) {
    case 'raw': return bytes;
    case 'macbinary': return unwrapMacBinary(bytes);
    case 'applesingle':
    case 'appledouble': return unwrapAppleSingleDouble(bytes);
    case 'binhex': return decodeBinHex(bytes).rsrc;
    case 'stuffit':
      throw new Error('StuffIt (.sit) archives are not yet supported in-browser — un-stuff it first (the .sit decoder is a separate work item). Expand the scheme and drop its resource fork / .hqx / MacBinary instead.');
    default:
      throw new Error(`unwrapToResourceFork: unknown container kind "${kind}"`);
  }
}

/** MacBinary: 128-byte header → data fork (padded to 128) → resource fork (padded). */
export function unwrapMacBinary(bytes) {
  const dataLen = u32(bytes, 83);
  const rsrcLen = u32(bytes, 87);
  const rsrcStart = 128 + roundUp128(dataLen);
  if (rsrcLen === 0) throw new Error('MacBinary: this file has no resource fork (data-fork only)');
  if (rsrcStart + rsrcLen > bytes.length) throw new Error('MacBinary: resource fork runs past end of file (truncated?)');
  return bytes.slice(rsrcStart, rsrcStart + rsrcLen);
}

/** AppleSingle/AppleDouble: entry table → resource fork is entry id 2. */
export function unwrapAppleSingleDouble(bytes) {
  // magic(4) version(4) filler(16) numEntries(2) @24, then 12-byte entries @26.
  const numEntries = u16(bytes, 24);
  for (let i = 0; i < numEntries; i++) {
    const o = 26 + i * 12;
    const id = u32(bytes, o);
    if (id === 2) { // 2 = resource fork
      const off = u32(bytes, o + 4);
      const len = u32(bytes, o + 8);
      if (off + len > bytes.length) throw new Error('AppleSingle/Double: resource-fork entry runs past end of file');
      return bytes.slice(off, off + len);
    }
  }
  throw new Error('AppleSingle/Double: no resource-fork entry (id 2) — data-fork only?');
}

// BinHex 4.0 — the 64-char 6-bit alphabet (RFC 1741), index = 6-bit value.
// Exported so a symmetric encoder (e.g. the round-trip test) can't drift from it.
export const BINHEX_ALPHABET = '!"#$%&\'()*+,-012345689@ABCDEFGHIJKLMNPQRSTUVXYZ[`abcdefhijklmpqr';
if (BINHEX_ALPHABET.length !== 64) throw new Error('BinHex alphabet must be 64 chars'); // typo guard
const BINHEX_DECODE = (() => { const m = new Int8Array(128).fill(-1); for (let i = 0; i < 64; i++) m[BINHEX_ALPHABET.charCodeAt(i)] = i; return m; })();

/**
 * Decode a BinHex 4.0 (.hqx) stream → its forks. Returns the filename + data + resource
 * forks (we use the resource fork). Verifies structure, not the CRCs (a CRC mismatch
 * shouldn't block recovering bytes that decode cleanly).
 * @param {Uint8Array} bytes
 * @returns {{ name: string, data: Uint8Array, rsrc: Uint8Array }}
 */
export function decodeBinHex(bytes) {
  const text = asciiHead(bytes, bytes.length);
  // The encoded payload lives between the first ':' and the final ':'.
  const start = text.indexOf(':');
  const end = text.lastIndexOf(':');
  if (start < 0 || end <= start) throw new Error('BinHex: no ":"-delimited data stream found');
  const payload = text.slice(start + 1, end);

  // 1) 6-bit ASCII → bytes (4 chars → 3 bytes), skipping whitespace/newlines.
  const sixbit = [];
  let acc = 0, nbits = 0;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    if (c === 0x0a || c === 0x0d || c === 0x20 || c === 0x09) continue; // CR/LF/space/tab
    const v = c < 128 ? BINHEX_DECODE[c] : -1;
    if (v < 0) throw new Error(`BinHex: invalid character 0x${c.toString(16)} in stream`);
    acc = (acc << 6) | v; nbits += 6;
    if (nbits >= 8) { nbits -= 8; sixbit.push((acc >> nbits) & 0xff); }
  }

  // 2) RLE90 expansion: 0x90 marks a run — <byte><0x90><count>. count 0 ⇒ literal 0x90.
  const out = [];
  for (let i = 0; i < sixbit.length; i++) {
    const b = sixbit[i];
    if (b === 0x90) {
      const count = sixbit[++i];
      if (count === 0) { out.push(0x90); } // escaped literal
      else { const last = out[out.length - 1]; for (let k = 1; k < count; k++) out.push(last); }
    } else {
      out.push(b);
    }
  }
  const buf = Uint8Array.from(out);

  // 3) Parse the header + forks.
  let p = 0;
  const nameLen = buf[p++];
  let name = '';
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(buf[p++]);
  p++; // version byte (0x00)
  p += 4; // type
  p += 4; // creator
  p += 2; // flags
  const dataLen = u32(buf, p); p += 4;
  const rsrcLen = u32(buf, p); p += 4;
  p += 2; // header CRC
  const data = buf.slice(p, p + dataLen); p += dataLen;
  p += 2; // data CRC
  const rsrc = buf.slice(p, p + rsrcLen); p += rsrcLen;
  if (rsrc.length !== rsrcLen) throw new Error('BinHex: resource fork truncated (declared longer than stream)');
  return { name, data, rsrc };
}
