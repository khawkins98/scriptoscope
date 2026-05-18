import { describe, expect, it } from 'vitest';
import { parseResourceFork } from './resource-fork.js';
import { readFileSync, existsSync } from 'node:fs';

describe('parseResourceFork — error handling', () => {
  it('throws on non-Uint8Array input', () => {
    expect(() => parseResourceFork([1, 2, 3])).toThrow(/Uint8Array/);
    expect(() => parseResourceFork(new ArrayBuffer(16))).toThrow(/Uint8Array/);
  });

  it('throws on truncated input (< header size)', () => {
    expect(() => parseResourceFork(new Uint8Array(8))).toThrow(/too short/);
  });

  it('throws when data section claims to overrun file', () => {
    // dataOffset=0, mapOffset=0, dataLength=huge, mapLength=0
    const buf = new Uint8Array(16);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 0, false);
    view.setUint32(4, 0, false);
    view.setUint32(8, 100, false); // dataLength > buf.length
    view.setUint32(12, 0, false);
    expect(() => parseResourceFork(buf)).toThrow(/overruns/);
  });
});

describe('parseResourceFork — synthetic fixtures', () => {
  /**
   * Build a minimal valid resource fork with one resource:
   *   type='TEXT' id=128 name='hi' data=[0x41, 0x42, 0x43] ('ABC')
   */
  function buildMinimalFixture() {
    // Layout we'll produce:
    //
    //   offset  bytes  meaning
    //   0       16     header
    //   16      4      data section: uint32 length = 3
    //   20      3      data bytes "ABC"
    //   23      0      (padding to align map, but not strictly required)
    //   23      28     map header (mostly zeros)
    //   51      2      typeList: numTypes-1 = 0
    //   53      8      type entry: 'TEXT', 0, refListOffset = 12 (from typeListAbs)
    //   61      12     ref entry: id=128, nameOffset=0, attrs=0, dataOff=0, handle=0
    //   73      3      name list: pascal "hi" (\x02 h i)
    //
    // dataOffset = 16, dataLength = 7 (4 + 3)
    // mapOffset  = 23, mapLength  = 76 - 23 = 53
    // typeListOffset from map start = 28 (right after map header)
    // nameListOffset from map start = 50 (= typeListOffset 28 + count2 + typeEntry8 + refEntry12)
    const dataOffset = 16;
    const mapOffset = 23;
    const typeListOffsetInMap = 28;
    const nameListOffsetInMap = 50;
    const total = 76;
    const buf = new Uint8Array(total);
    const v = new DataView(buf.buffer);

    // Header
    v.setUint32(0, dataOffset, false);
    v.setUint32(4, mapOffset, false);
    v.setUint32(8, 7, false); // dataLength
    v.setUint32(12, total - mapOffset, false); // mapLength

    // Data: length + 'ABC'
    v.setUint32(16, 3, false);
    buf[20] = 0x41;
    buf[21] = 0x42;
    buf[22] = 0x43;

    // Map: 16 zero bytes + 4 zero (next handle) + 2 zero (fileRef) + 2 zero (attrs)
    // = 24 bytes of zeros, then typeListOffset (2) + nameListOffset (2)
    v.setUint16(mapOffset + 24, typeListOffsetInMap, false);
    v.setUint16(mapOffset + 26, nameListOffsetInMap, false);

    // Type list count (numTypes-1)
    const typeListAbs = mapOffset + typeListOffsetInMap;
    v.setUint16(typeListAbs, 0, false);

    // Type entry
    buf[typeListAbs + 2] = 0x54; // 'T'
    buf[typeListAbs + 3] = 0x45; // 'E'
    buf[typeListAbs + 4] = 0x58; // 'X'
    buf[typeListAbs + 5] = 0x54; // 'T'
    v.setUint16(typeListAbs + 6, 0, false); // numResources - 1 = 0
    v.setUint16(typeListAbs + 8, 12, false); // refListOffset from typeListAbs

    // Ref entry (refListAbs = typeListAbs + 12)
    const refEntryAbs = typeListAbs + 12;
    v.setInt16(refEntryAbs, 128, false); // id
    v.setUint16(refEntryAbs + 2, 0, false); // nameOffset
    buf[refEntryAbs + 4] = 0; // attrs
    // 24-bit dataOffset = 0
    buf[refEntryAbs + 5] = 0;
    buf[refEntryAbs + 6] = 0;
    buf[refEntryAbs + 7] = 0;
    v.setUint32(refEntryAbs + 8, 0, false); // handle

    // Name list (nameListAbs = mapOffset + nameListOffsetInMap)
    const nameListAbs = mapOffset + nameListOffsetInMap;
    buf[nameListAbs] = 2;       // pascal length
    buf[nameListAbs + 1] = 0x68; // 'h'
    buf[nameListAbs + 2] = 0x69; // 'i'

    return buf;
  }

  it('parses a single-resource fixture round-trip', () => {
    const buf = buildMinimalFixture();
    const entries = parseResourceFork(buf);
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.type).toBe('TEXT');
    expect(entry.id).toBe(128);
    expect(entry.name).toBe('hi');
    expect(entry.attributes).toBe(0);
    expect(Array.from(entry.data)).toEqual([0x41, 0x42, 0x43]);
  });
});

describe('parseResourceFork — real Kaleidoscope scheme (when available)', () => {
  const fixturePath = '/tmp/aaron-schemes/1022/1022/1022/..namedfork/rsrc';
  const haveFixture = existsSync(fixturePath);
  const itIfFixture = haveFixture ? it : it.skip;

  itIfFixture('parses 1022.rsrc (Acid by SHIOCOP) to 666 resources matching DeRez', () => {
    const bytes = new Uint8Array(readFileSync(fixturePath));
    const entries = parseResourceFork(bytes);
    expect(entries.length).toBe(666);

    const byType = {};
    for (const e of entries) byType[e.type] = (byType[e.type] || 0) + 1;
    // Counts confirmed against `LC_ALL=C awk -F"'" '/^data/{print $2}' 1022.r | sort | uniq -c`
    expect(byType['cicn']).toBe(190);
    expect(byType['cinf']).toBe(100);
    expect(byType['wnd#']).toBe(10);
    expect(byType['ppat']).toBe(2);
    expect(byType['Colr']).toBe(1);
  });

  itIfFixture('extracts wnd# names where present', () => {
    const bytes = new Uint8Array(readFileSync(fixturePath));
    const entries = parseResourceFork(bytes);
    const wnds = entries.filter((e) => e.type === 'wnd#');
    // 1022 has 2 named wnd# entries: "Document Window" and "Popup Window".
    const named = wnds.filter((w) => w.name !== '');
    expect(named.length).toBe(2);
    const names = named.map((w) => w.name).sort();
    expect(names).toEqual(['Document Window', 'Popup Window']);
  });
});
