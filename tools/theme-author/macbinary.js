// MacBinary II writer: packs a resource fork plus its Finder type and creator
// into one ordinary file that can travel through modern systems.
//
// Why: a scheme on a classic Mac is a file whose RESOURCE fork holds the
// resources and whose Finder info says type 'Colr', creator 'Acid' (every
// corpus scheme has exactly these). A raw `scheme.rsrc` carries neither, so
// classic Mac OS wouldn't recognise it. Classic tools (StuffIt Expander,
// MacBinary utilities, hfsutils' `hcopy -m`) turn a MacBinary file back into a
// real two-fork file with the right type and creator. Scriptoscope's own
// loader also reads MacBinary (tools/theme-loader/containers.js).
//
// Layout (MacBinary II): a 128-byte header, then the data fork padded to a
// multiple of 128, then the resource fork padded the same way.
//
// Finder flags: every corpus scheme file has kHasCustomIcon (0x0400) set in
// its archive (0x0500, 0x0580, 0x1480 or 0x1580 across the 13 .sit bundles),
// so the Finder and Standard File draw the file with its own icon family
// (ICN#/icl8/… -16455, the picker icon) rather than the generic document. The
// writer sets it by default; the Finder ignores it when the fork has no -16455
// family.

/** Finder flag bits (Inside Macintosh: Macintosh Toolbox Essentials, "Finder Interface"). */
export const FINDER_FLAGS = { hasCustomIcon: 0x0400 };

/**
 * @param {{ name: string, type?: string, creator?: string, resourceFork: Uint8Array, dataFork?: Uint8Array, date?: Date, finderFlags?: number }} file
 *   finderFlags: the 16-bit Finder flags (default kHasCustomIcon, as every corpus scheme)
 * @returns {Uint8Array}
 */
export function writeMacBinary({ name, type = 'Colr', creator = 'Acid', resourceFork, dataFork = new Uint8Array(0), date = new Date(0), finderFlags = FINDER_FLAGS.hasCustomIcon }) {
  if (!name || name.length > 31 || /[^\x20-\x7e]/.test(name) || name.includes(':')) {
    throw new Error('writeMacBinary: name must be 1–31 printable ASCII characters without ":" (classic Mac file name rules)');
  }
  for (const [label, code] of [['type', type], ['creator', creator]]) {
    if (code.length !== 4) throw new Error(`writeMacBinary: ${label} must be 4 characters`);
  }
  const pad = (n) => Math.ceil(n / 128) * 128;
  const out = new Uint8Array(128 + pad(dataFork.length) + pad(resourceFork.length));
  const view = new DataView(out.buffer);
  const ascii = (at, s) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };

  out[1] = name.length;
  ascii(2, name);
  ascii(65, type);
  ascii(69, creator);
  out[73] = (finderFlags >> 8) & 0xff; // MacBinary II: Finder flags high byte here,
  out[101] = finderFlags & 0xff;       // low byte here
  view.setUint32(83, dataFork.length);
  view.setUint32(87, resourceFork.length);
  // Mac dates count seconds from 1904-01-01. A fixed default keeps builds reproducible.
  const macSeconds = Math.max(0, Math.floor(date.getTime() / 1000) + 2082844800) >>> 0;
  view.setUint32(91, macSeconds);
  view.setUint32(95, macSeconds);
  out[122] = 129; // written by MacBinary II
  out[123] = 129; // readable by MacBinary II and later
  view.setUint16(124, crc16xmodem(out.subarray(0, 124)));

  out.set(dataFork, 128);
  out.set(resourceFork, 128 + pad(dataFork.length));
  return out;
}

/** CRC-16/XMODEM (CCITT polynomial 0x1021, initial 0), as MacBinary II specifies. */
export function crc16xmodem(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
