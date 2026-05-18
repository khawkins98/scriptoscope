// Public API for @aaron-ui/scheme-extractor.
//
// All lib/ functions take Uint8Array / plain strings and return plain JS
// objects — no Node-specific imports — so the same code can be loaded in
// a browser (web-based extractor is the long-term goal).

export { parseDerezText } from './derez-parser.js';
export { decodeCicn } from './decoders/cicn.js';
export { decodePpat } from './decoders/ppat.js';
export { decodeCinf } from './decoders/cinf.js';
export { decodeWnd }  from './decoders/wnd.js';
export { buildThemeJson } from './buildThemeJson.js';
export { validateTheme, ThemeValidationError } from './validateTheme.js';

/**
 * Decode all decodable resources in a parsed DeRez record list.
 * Supports: cicn (raster), ppat (raster), cinf (geometry metadata),
 * wnd# (window-type definitions). Other types pass through undecoded.
 *
 * The cicn/ppat decoders return {width, height, rgba, ...} for PNG output.
 * The cinf/wnd# decoders return structured geometry objects for manifest
 * inclusion — they have no raster output.
 *
 * @param {import('./derez-parser.js').ResourceRecord[]} records
 * @returns {Array<{record: object, decoded: object|null, error: string|null}>}
 */
import { decodeCicn } from './decoders/cicn.js';
import { decodePpat } from './decoders/ppat.js';
import { decodeCinf } from './decoders/cinf.js';
import { decodeWnd }  from './decoders/wnd.js';

export function decodeAll(records) {
  return records.map(record => {
    try {
      let decoded = null;
      if      (record.type === 'cicn') decoded = decodeCicn(record.bytes);
      else if (record.type === 'ppat') decoded = decodePpat(record.bytes);
      else if (record.type === 'cinf') decoded = decodeCinf(record.bytes);
      else if (record.type === 'wnd#') decoded = decodeWnd(record.bytes);
      return { record, decoded, error: null };
    } catch (e) {
      return { record, decoded: null, error: e.message };
    }
  });
}
