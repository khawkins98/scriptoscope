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

/**
 * @param {{ name: string, type?: string, creator?: string, resourceFork: Uint8Array, dataFork?: Uint8Array, date?: Date }} file
 * @returns {Uint8Array}
 */
export function writeMacBinary({ name, type = 'Colr', creator = 'Acid', resourceFork, dataFork = new Uint8Array(0), date = new Date(0) }) {
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
