// Colr resource decoder — scheme-global flags.
//
// Per the bundled-with-scheme TMPL 128 (verified via inspection of the
// Kaleidoscope 2.3.1 installer's bundled schemes' TMPL resources), the
// first 5 bytes of a Colr resource carry these fields:
//
//   byte 0  DBYT  Colr version
//   byte 1  DBYT  Color scheme file format version
//   byte 2  HBYT  Minimum Kaleidoscope version (e.g. 0x23 = "2.3")
//   byte 3  BOOL  Has accent colors
//   byte 4  DBYT  Stretch scroll bar thumb from center (for SmartScroll)
//
// Schemes ship 16-byte Colr resources, but the K2 1.x-era TMPL only
// describes the first 5 bytes. The remaining 11 bytes carry additional
// flags introduced in later Kaleidoscope versions (Unified Scroll Bar
// Track, Windows-style Scrollbars, etc.) — but their byte layout is not
// documented in the bundled-with-scheme TMPL. Conservative decoding:
// parse the documented 5 bytes; surface the rest as `extraBytes` for
// downstream inspection.
//
// See docs/kaleidoscope-to-html-mapping.md §2.5 + docs/tracking/
// kdef-disassembly-findings.md §4 for context.

import { Reader } from './shared.js';

/**
 * Decode a Colr resource. Returns a flags object suitable for
 * `theme.options`. Pure function: no DOM, no I/O.
 *
 * @param {Uint8Array} bytes  Raw Colr resource bytes
 * @returns {{
 *   schemeVersion: number,
 *   fileFormatVersion: number,
 *   minimumKVersion: number,
 *   hasAccentColors: boolean,
 *   stretchScrollbarThumbFromCenter: boolean,
 *   extraBytes: number[],
 * }}
 */
export function decodeColr(bytes) {
  if (bytes.length < 5) {
    throw new Error(`decodeColr: Colr resource too short (${bytes.length} bytes; need >= 5)`);
  }
  const r = new Reader(bytes);
  const signed = (u) => (u > 0x7f ? u - 0x100 : u);
  const schemeVersion       = signed(r.readUInt8());
  const fileFormatVersion   = signed(r.readUInt8());
  const minimumKVersion     = r.readUInt8(); // HBYT — hex-displayed; keep as integer
  const hasAccentColors     = r.readUInt8() !== 0; // BOOL → boolean
  const stretchThumbCenter  = r.readUInt8() !== 0; // DBYT used as boolean

  const extraBytes = [];
  while (r.remaining() > 0) {
    extraBytes.push(r.readUInt8());
  }

  return {
    schemeVersion,
    fileFormatVersion,
    minimumKVersion,
    hasAccentColors,
    stretchScrollbarThumbFromCenter: stretchThumbCenter,
    extraBytes,
  };
}
