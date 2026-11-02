// Encoders for the small fixed-layout Kaleidoscope records. Each one is the
// inverse of the matching decoder in tools/theme-loader/decoders/.

import { ByteWriter } from './bytes.js';

/**
 * 'wnd#' — a window type's layout recipe (decoder: decoders/wnd.js).
 *
 *   rectangles  named parts inside the frame image. Part 0 = content area,
 *               1 = close box, 2 = zoom box, 3 = collapse box, 4 = title marker.
 *   topSide … rightSide
 *               how each edge stretches. A list of { part, border } pairs.
 *               Cell i covers [border[i-1], border[i]) and behaves according to
 *               part[i] (see docs/authoring-a-scheme.md "Side recipes"). The
 *               pixels before border[0] and after the last border are fixed
 *               corners, so part[0] never matters (authors write 0).
 *
 * Lists are stored as (count − 1) followed by the records; an empty list is -1.
 *
 * @param {{
 *   rectangles: Array<{part: number, rect: {top: number, left: number, bottom: number, right: number}}>,
 *   topSide: Array<{part: number, border: number}>, bottomSide: Array<{part: number, border: number}>,
 *   leftSide: Array<{part: number, border: number}>, rightSide: Array<{part: number, border: number}>,
 * }} wnd
 */
export function encodeWnd(wnd) {
  const w = new ByteWriter();
  w.i16(wnd.rectangles.length - 1);
  for (const r of wnd.rectangles) w.i16(r.part).rect(r.rect);
  for (const side of [wnd.topSide, wnd.bottomSide, wnd.leftSide, wnd.rightSide]) {
    w.i16(side.length - 1);
    let last = -Infinity;
    for (const s of side) {
      if (s.border < last) throw new Error('encodeWnd: side borders must not decrease');
      last = s.border;
      w.i16(s.part).i16(s.border);
    }
  }
  return w.toUint8Array();
}

/**
 * 'cinf' — per-element metadata, 18 bytes (decoder: decoders/cinf.js).
 * Points are { x, y } in the paired cicn's pixel coordinates; the kDEF reads
 * the colour at that pixel (background, text, emboss).
 *
 * @param {{
 *   cornerSize?: number, sideThickness?: number, tileSides?: number, patternAnchor?: number,
 *   bgPatternId?: number, bgPixel?: {x: number, y: number}, textPixel?: {x: number, y: number},
 *   embossPixel?: {x: number, y: number},
 * }} cinf
 */
export function encodeCinf(cinf) {
  const p = (pt) => pt ?? { x: 0, y: 0 };
  const w = new ByteWriter()
    .u8(cinf.cornerSize ?? 0)
    .u8(cinf.sideThickness ?? 0)
    .u8(cinf.tileSides ?? 0)
    .u8(cinf.patternAnchor ?? 0)
    .i16(cinf.bgPatternId ?? 0);
  for (const pt of [cinf.bgPixel, cinf.textPixel, cinf.embossPixel]) w.i16(p(pt).y).i16(p(pt).x);
  return w.toUint8Array();
}

/**
 * 'Colr' — scheme-global flags (decoder: decoders/colr.js). Only the first
 * five bytes are documented by the scheme's own TMPL; corpus schemes ship 16
 * bytes. `extraBytes` fills the rest (default zeros).
 */
export function encodeColr({
  schemeVersion = 1, fileFormatVersion = 1, minimumKVersion = 0x20,
  hasAccentColors = false, stretchScrollbarThumbFromCenter = false, extraBytes = new Array(11).fill(0),
} = {}) {
  if (extraBytes.length < 11) throw new Error('encodeColr: corpus Colr records are 16 bytes; pass at least 11 extraBytes');
  return new ByteWriter()
    .u8(schemeVersion).u8(fileFormatVersion).u8(minimumKVersion)
    .u8(hasAccentColors ? 1 : 0).u8(stretchScrollbarThumbFromCenter ? 1 : 0)
    .raw(extraBytes)
    .toUint8Array();
}

/**
 * 'vers' — the standard Mac version record shown by the Finder's Get Info.
 * Layout: major (BCD), minor/bug (BCD nibbles), stage, prerelease, region,
 * short version string (Pascal), long version string (Pascal).
 */
export function encodeVers({ major = 1, minor = 0, bug = 0, short = '1.0', long = short } = {}) {
  if (![minor, bug].every((n) => Number.isInteger(n) && n >= 0 && n <= 9)) throw new Error('encodeVers: minor and bug must be 0–9');
  if (!(Number.isInteger(major) && major >= 0 && major <= 99)) throw new Error('encodeVers: major must be 0–99');
  const pstr = (s) => {
    if (s.length > 255 || /[^\x20-\x7e]/.test(s)) throw new Error('encodeVers: strings must be printable ASCII, max 255 characters');
    return [s.length, ...[...s].map((c) => c.charCodeAt(0))];
  };
  const bcd = (n) => ((Math.floor(n / 10) % 10) << 4) | (n % 10);
  return new ByteWriter()
    .u8(bcd(major)).u8(((minor & 0xf) << 4) | (bug & 0xf))
    .u8(0x80).u8(0)   // stage: final release; prerelease number 0
    .u16(0)           // region code: US
    .raw(pstr(short)).raw(pstr(long))
    .toUint8Array();
}
