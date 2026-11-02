// Encode Mac Roman text and the 'STR#' (string list) resource.
//
// Layout (Inside Macintosh: Macintosh Toolbox Essentials, "Resource Manager",
// 'STR#' resource): a 2-byte count, then that many Pascal strings (a length
// byte, then up to 255 Mac Roman bytes), packed with no padding.
//
// Kaleidoscope schemes ship `STR# -14320` "Control Panel Info Strings": the
// control panel shows string 1 as the scheme's name and the rest as its
// description (corpus author labels, docs/spec/corpus-corroborated-ids.md;
// 13 of the 18 corpus schemes ship it).

import { ByteWriter } from './bytes.js';

// The few non-ASCII characters an author is likely to type, mapped to Mac Roman
// (Inside Macintosh: Text, appendix A, "Standard Roman character set").
const MAC_ROMAN = new Map(Object.entries({
  '©': 0xa9, '®': 0xa8, '™': 0xaa, '•': 0xa5, '·': 0xe1, '°': 0xa1,
  '‘': 0xd4, '’': 0xd5, '“': 0xd2, '”': 0xd3, '–': 0xd0, '—': 0xd1, '…': 0xc9,
  'é': 0x8e, 'è': 0x8f, 'ä': 0x8a, 'ö': 0x9a, 'ü': 0x9f, 'Ä': 0x80, 'Ö': 0x85, 'Ü': 0x86, 'ß': 0xa7,
}));

/**
 * Text → Mac Roman bytes. `\n` becomes a classic Mac line break (CR, 13).
 * Throws on characters outside printable ASCII and the table above.
 * @param {string} text
 * @returns {number[]}
 */
export function toMacRoman(text) {
  return [...text].map((ch) => {
    if (ch === '\n' || ch === '\r') return 13;
    const c = ch.codePointAt(0);
    if (c >= 0x20 && c <= 0x7e) return c;
    const mapped = MAC_ROMAN.get(ch);
    if (mapped == null) throw new Error(`toMacRoman: no Mac Roman mapping for ${JSON.stringify(ch)} (U+${c.toString(16).toUpperCase().padStart(4, '0')})`);
    return mapped;
  });
}

/** A Pascal string: length byte + Mac Roman bytes (`text` may also be the raw bytes). */
export function pascalString(text) {
  const bytes = typeof text === 'string' ? toMacRoman(text) : Array.from(text);
  if (bytes.length > 255) throw new Error(`pascalString: ${bytes.length} bytes, but a Pascal string holds at most 255`);
  return [bytes.length, ...bytes];
}

/**
 * 'STR#' — a counted list of Pascal strings.
 * @param {Array<string|ArrayLike<number>>} strings  text, or raw Mac Roman bytes
 * @returns {Uint8Array}
 */
export function encodeStrList(strings) {
  const w = new ByteWriter().u16(strings.length);
  for (const s of strings) w.raw(pascalString(s));
  return w.toUint8Array();
}
