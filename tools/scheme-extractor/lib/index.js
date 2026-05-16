// Public API for @aaron-ui/scheme-extractor.
//
// All lib/ functions take Uint8Array / plain strings and return plain JS
// objects — no Node-specific imports — so the same code can be loaded in
// a browser (web-based extractor is the long-term goal).

export { parseDerezText } from './derez-parser.js';
export { decodeCicn } from './decoders/cicn.js';
export { decodePpat } from './decoders/ppat.js';

/**
 * Decode all decodable resources in a parsed DeRez record list.
 * Currently supports: cicn, ppat. Other types pass through as undecoded.
 *
 * @param {import('./derez-parser.js').ResourceRecord[]} records
 * @returns {Array<{record: object, decoded: object|null, error: string|null}>}
 */
import { decodeCicn } from './decoders/cicn.js';
import { decodePpat } from './decoders/ppat.js';

export function decodeAll(records) {
  return records.map(record => {
    try {
      let decoded = null;
      if (record.type === 'cicn') decoded = decodeCicn(record.bytes);
      else if (record.type === 'ppat') decoded = decodePpat(record.bytes);
      return { record, decoded, error: null };
    } catch (e) {
      return { record, decoded: null, error: e.message };
    }
  });
}
