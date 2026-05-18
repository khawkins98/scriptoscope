// Mac OS resource fork parser — pure JS, browser-portable.
//
// The classic Mac resource fork is a binary structure that bundles
// arbitrary typed resources (cicn, ppat, cinf, wnd#, Colr, etc.) into
// a single blob. Kaleidoscope .ksc files ARE resource forks (with an
// empty data fork). At runtime we decode the resource fork to enumerate
// every chrome-relevant resource, then hand the bytes to type-specific
// decoders.
//
// Format reference: Inside Macintosh: More Macintosh Toolbox, chapter 1
// ("Resource Manager"). Also documented at:
//   https://developer.apple.com/library/archive/documentation/mac/MoreToolbox/MoreToolbox-99.html
//
// Layout (big-endian throughout):
//
//   ┌───────────────────────────────────────────────────────────────┐
//   │ HEADER (16 bytes)                                             │
//   │   uint32 dataOffset                                           │
//   │   uint32 mapOffset                                            │
//   │   uint32 dataLength                                           │
//   │   uint32 mapLength                                            │
//   ├───────────────────────────────────────────────────────────────┤
//   │ RESOURCE DATA (at dataOffset, dataLength bytes)               │
//   │   For each resource:                                          │
//   │     uint32 length                                             │
//   │     bytes  data[length]                                       │
//   ├───────────────────────────────────────────────────────────────┤
//   │ RESOURCE MAP (at mapOffset, mapLength bytes)                  │
//   │   16 bytes  (copy of header — usually zero'd in disk format)  │
//   │   uint32    nextHandle                                        │
//   │   uint16    fileRef                                           │
//   │   uint16    fileAttrs                                         │
//   │   uint16    typeListOffset (from start of map)                │
//   │   uint16    nameListOffset (from start of map)                │
//   │   At typeListOffset:                                          │
//   │     uint16  numTypes-1   (i.e. 0 means 1 type, 0xFFFF = 65536)│
//   │     For each type:                                            │
//   │       char[4] typeCode                                        │
//   │       uint16  numResources-1                                  │
//   │       uint16  refListOffset (from typeListOffset)             │
//   │   For each type's ref list:                                   │
//   │     int16   resourceID                                        │
//   │     uint16  nameOffset (0xFFFF = no name; else from nameList) │
//   │     uint8   attributes                                        │
//   │     uint24  dataOffset (into RESOURCE DATA section)           │
//   │     uint32  handle (reserved, usually 0)                      │
//   │   At nameListOffset:                                          │
//   │     Pascal strings (uint8 len + chars), one per named rsrc    │
//   └───────────────────────────────────────────────────────────────┘

/**
 * @typedef {object} ResourceForkEntry
 * @property {string} type    - 4-char type code (e.g. 'cicn', 'wnd#')
 * @property {number} id      - Signed 16-bit resource ID
 * @property {string} name    - Resource name (empty string if unnamed)
 * @property {number} attributes - Attribute byte
 * @property {Uint8Array} data - The resource bytes (header stripped)
 */

const HEADER_SIZE = 16;
const MAP_HEADER_SIZE = 28;
const TYPE_ENTRY_SIZE = 8;
const REF_ENTRY_SIZE = 12;

/**
 * Parse a Mac OS resource fork into a flat list of {type, id, name, data}
 * entries. Pure function: no I/O, no DOM dependency.
 *
 * @param {Uint8Array} bytes
 * @returns {ResourceForkEntry[]}
 * @throws {Error} on truncated or structurally invalid input
 */
export function parseResourceFork(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('parseResourceFork: input must be a Uint8Array');
  }
  if (bytes.length < HEADER_SIZE) {
    throw new Error(`parseResourceFork: input too short (${bytes.length} bytes; need ≥${HEADER_SIZE})`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const dataOffset = view.getUint32(0, false);
  const mapOffset = view.getUint32(4, false);
  const dataLength = view.getUint32(8, false);
  const mapLength = view.getUint32(12, false);

  if (dataOffset + dataLength > bytes.length) {
    throw new Error(
      `parseResourceFork: data section overruns file (dataOffset=${dataOffset} + dataLength=${dataLength} > ${bytes.length})`,
    );
  }
  if (mapOffset + mapLength > bytes.length) {
    throw new Error(
      `parseResourceFork: map section overruns file (mapOffset=${mapOffset} + mapLength=${mapLength} > ${bytes.length})`,
    );
  }

  // Map header is 16 bytes (reserved copy of file header, zeros on disk),
  // then 8 reserved bytes, then 4 control bytes — totaling 24 bytes
  // before the typeList/nameList offsets at relative bytes 24-27. Many
  // references list MAP_HEADER_SIZE = 28; the spec is:
  //   0-15:  reserved (copy of header)
  //   16-19: handle to next map (4 bytes, runtime only — zeros on disk)
  //   20-21: file ref (runtime only)
  //   22-23: file attrs
  //   24-25: typeListOffset (from start of map)
  //   26-27: nameListOffset (from start of map)
  const typeListOffset = view.getUint16(mapOffset + 24, false);
  const nameListOffset = view.getUint16(mapOffset + 26, false);

  const typeListAbs = mapOffset + typeListOffset;
  const nameListAbs = mapOffset + nameListOffset;

  if (typeListAbs >= bytes.length) {
    throw new Error(`parseResourceFork: typeList offset out of bounds (${typeListAbs} >= ${bytes.length})`);
  }

  const numTypesM1 = view.getUint16(typeListAbs, false);
  const numTypes = (numTypesM1 + 1) & 0xffff; // wrap-aware: 0xFFFF + 1 = 0 → 0x10000

  /** @type {ResourceForkEntry[]} */
  const entries = [];

  // Type list starts right after the count (typeListAbs + 2)
  for (let t = 0; t < numTypes; t++) {
    const typeEntryAbs = typeListAbs + 2 + t * TYPE_ENTRY_SIZE;
    if (typeEntryAbs + TYPE_ENTRY_SIZE > bytes.length) {
      throw new Error(`parseResourceFork: type entry ${t} out of bounds`);
    }
    const typeCode = String.fromCharCode(
      bytes[typeEntryAbs],
      bytes[typeEntryAbs + 1],
      bytes[typeEntryAbs + 2],
      bytes[typeEntryAbs + 3],
    );
    const numResourcesM1 = view.getUint16(typeEntryAbs + 4, false);
    const numResources = (numResourcesM1 + 1) & 0xffff;
    const refListOffset = view.getUint16(typeEntryAbs + 6, false);

    const refListAbs = typeListAbs + refListOffset;

    for (let r = 0; r < numResources; r++) {
      const refEntryAbs = refListAbs + r * REF_ENTRY_SIZE;
      if (refEntryAbs + REF_ENTRY_SIZE > bytes.length) {
        throw new Error(`parseResourceFork: ref entry ${t}/${r} out of bounds`);
      }
      const id = view.getInt16(refEntryAbs, false);
      const nameOffset = view.getUint16(refEntryAbs + 2, false);
      const attributes = bytes[refEntryAbs + 4];
      // 24-bit big-endian data offset (bytes 5, 6, 7 of ref entry)
      const dataOff =
        (bytes[refEntryAbs + 5] << 16) |
        (bytes[refEntryAbs + 6] << 8) |
        bytes[refEntryAbs + 7];

      let name = '';
      if (nameOffset !== 0xffff) {
        const nameAbs = nameListAbs + nameOffset;
        if (nameAbs >= bytes.length) {
          throw new Error(`parseResourceFork: name offset ${nameOffset} out of bounds`);
        }
        const nameLen = bytes[nameAbs];
        if (nameAbs + 1 + nameLen > bytes.length) {
          throw new Error(`parseResourceFork: name overruns end of file`);
        }
        // MacRoman fallback to latin-1; most chrome resource names are ASCII.
        name = String.fromCharCode(...bytes.subarray(nameAbs + 1, nameAbs + 1 + nameLen));
      }

      const dataAbs = dataOffset + dataOff;
      if (dataAbs + 4 > bytes.length) {
        throw new Error(`parseResourceFork: data offset out of bounds for ${typeCode} ${id}`);
      }
      const rsrcLen = view.getUint32(dataAbs, false);
      if (dataAbs + 4 + rsrcLen > bytes.length) {
        throw new Error(
          `parseResourceFork: resource ${typeCode} ${id} overruns data section (offset=${dataAbs}, len=${rsrcLen})`,
        );
      }
      const data = bytes.subarray(dataAbs + 4, dataAbs + 4 + rsrcLen);

      entries.push({ type: typeCode, id, name, attributes, data });
    }
  }

  return entries;
}
