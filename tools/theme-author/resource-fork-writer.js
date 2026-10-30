// Mac OS resource fork WRITER — the inverse of tools/theme-loader/resource-fork.js.
//
// A Kaleidoscope scheme is a resource fork: a typed bag of resources such as
// cicn, wnd#, cinf and Colr. The reader explains the binary layout in detail.
// This file builds the same layout from a list of resources, so its output can
// be decoded by the reader (and, in principle, by the classic Mac Resource
// Manager).
//
// Layout written here (big-endian throughout):
//
//   0     header (16 bytes): dataOffset, mapOffset, dataLength, mapLength
//   16    zero padding up to DATA_OFFSET (classic files reserve 256 bytes)
//   256   resource data: for each resource, uint32 length + bytes
//   ...   resource map:  header copy, type list, reference lists, name list
//
// Pure: no fs, no DOM. Returns a Uint8Array.

const DATA_OFFSET = 256;
const MAP_HEADER_SIZE = 28;
const TYPE_ENTRY_SIZE = 8;
const REF_ENTRY_SIZE = 12;

/**
 * @typedef {object} ResourceInput
 * @property {string} type        4-character type code, e.g. 'cicn' or 'wnd#'
 * @property {number} id          signed 16-bit resource id
 * @property {string} [name]      optional resource name: one character per byte
 *                                (codes 0–255), max 255 bytes — the same form the
 *                                reader returns. Bytes are written as-is and classic
 *                                tools read them as MacRoman, so keep names ASCII
 *                                unless you encode MacRoman yourself ('é' here is
 *                                0xE9, which ResEdit shows as 'È').
 * @property {number} [attributes] resource attribute byte (default 0)
 * @property {Uint8Array} data    resource body
 */

/**
 * Serialize resources into a resource fork.
 * @param {ResourceInput[]} resources
 * @returns {Uint8Array}
 */
export function writeResourceFork(resources) {
  validate(resources);

  // Group by type, sort types and ids so output is deterministic.
  /** @type {Map<string, ResourceInput[]>} */
  const byType = new Map();
  for (const r of resources) {
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type).push(r);
  }
  const types = [...byType.keys()].sort();
  for (const t of types) byType.get(t).sort((a, b) => a.id - b.id);
  const ordered = types.flatMap((t) => byType.get(t));

  // ── Data section ──
  const dataOffsets = new Map();
  let dataLength = 0;
  for (const r of ordered) {
    dataOffsets.set(r, dataLength);
    dataLength += 4 + r.data.length;
  }
  if (dataLength > 0xffffff) throw new Error('writeResourceFork: data section exceeds 16 MB (24-bit offsets)');

  // ── Name list ──
  const nameOffsets = new Map();
  const nameBytes = [];
  for (const r of ordered) {
    if (!r.name) continue;
    nameOffsets.set(r, nameBytes.length);
    nameBytes.push(r.name.length, ...[...r.name].map((ch) => ch.charCodeAt(0)));
  }

  // ── Map section ──
  const typeListOffset = MAP_HEADER_SIZE;
  const typeListSize = 2 + types.length * TYPE_ENTRY_SIZE;
  const refListSize = ordered.length * REF_ENTRY_SIZE;
  const nameListOffset = typeListOffset + typeListSize + refListSize;
  const mapLength = nameListOffset + nameBytes.length;
  if (nameListOffset > 0xffff) throw new Error('writeResourceFork: resource map too large');

  const mapOffset = DATA_OFFSET + dataLength;
  const out = new Uint8Array(mapOffset + mapLength);
  const view = new DataView(out.buffer);

  const writeHeader = (at) => {
    view.setUint32(at, DATA_OFFSET);
    view.setUint32(at + 4, mapOffset);
    view.setUint32(at + 8, dataLength);
    view.setUint32(at + 12, mapLength);
  };
  writeHeader(0);

  for (const r of ordered) {
    const at = DATA_OFFSET + dataOffsets.get(r);
    view.setUint32(at, r.data.length);
    out.set(r.data, at + 4);
  }

  // The map starts with a copy of the file header; the Resource Manager
  // overwrites it at runtime, but writing the real values is harmless.
  writeHeader(mapOffset);
  view.setUint16(mapOffset + 24, typeListOffset);
  view.setUint16(mapOffset + 26, nameListOffset);

  const typeListAbs = mapOffset + typeListOffset;
  view.setUint16(typeListAbs, (types.length - 1) & 0xffff); // count − 1; 0xFFFF = empty
  let refCursor = typeListSize; // ref lists follow the type list, offsets relative to it
  types.forEach((type, t) => {
    const list = byType.get(type);
    const entry = typeListAbs + 2 + t * TYPE_ENTRY_SIZE;
    for (let i = 0; i < 4; i++) out[entry + i] = type.charCodeAt(i);
    view.setUint16(entry + 4, list.length - 1);
    view.setUint16(entry + 6, refCursor);
    list.forEach((r, i) => {
      const ref = typeListAbs + refCursor + i * REF_ENTRY_SIZE;
      view.setInt16(ref, r.id);
      view.setUint16(ref + 2, nameOffsets.has(r) ? nameOffsets.get(r) : 0xffff);
      const off = dataOffsets.get(r);
      out[ref + 4] = r.attributes ?? 0;
      out[ref + 5] = (off >> 16) & 0xff;
      out[ref + 6] = (off >> 8) & 0xff;
      out[ref + 7] = off & 0xff;
      // ref + 8..11: reserved handle, left as zero
    });
    refCursor += list.length * REF_ENTRY_SIZE;
  });

  out.set(nameBytes, mapOffset + nameListOffset);
  return out;
}

function validate(resources) {
  const seen = new Set();
  for (const r of resources) {
    if (typeof r.type !== 'string' || r.type.length !== 4) {
      throw new Error(`writeResourceFork: type must be 4 characters (got ${JSON.stringify(r.type)})`);
    }
    if (!Number.isInteger(r.id) || r.id < -32768 || r.id > 32767) {
      throw new Error(`writeResourceFork: ${r.type} id ${r.id} is not a signed 16-bit integer`);
    }
    if (!(r.data instanceof Uint8Array)) throw new Error(`writeResourceFork: ${r.type} ${r.id} data must be a Uint8Array`);
    if (r.name && (r.name.length > 255 || /[^\x00-\xff]/.test(r.name))) {
      throw new Error(`writeResourceFork: ${r.type} ${r.id} name must be byte characters (0–255), max 255`);
    }
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) throw new Error(`writeResourceFork: duplicate resource ${key}`);
    seen.add(key);
  }
}
