// Implementation-owned loader checks: synthetic Resource Manager records only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertIcons } from './convert.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';

// Resource Manager layout documented by resource-fork.js / Inside Macintosh.
function fork(records) {
 const groups = [...new Set(records.map(r => r.type))].map(type => [type, records.filter(r => r.type === type)]);
 const dataLength = records.reduce((n, r) => n + 4 + r.data.length, 0), map = 256 + dataLength;
 const mapLength = 30 + groups.length * 8 + records.length * 12;
 const bytes = new Uint8Array(map + mapLength), view = new DataView(bytes.buffer);
 view.setUint32(0, 256); view.setUint32(4, map); view.setUint32(8, dataLength); view.setUint32(12, mapLength);
 view.setUint16(map + 24, 28); view.setUint16(map + 26, mapLength); view.setUint16(map + 28, groups.length - 1);
 let data = 0, ref = 2 + groups.length * 8;
 groups.forEach(([type, rows], i) => {
 const at = map + 30 + i * 8;
 bytes.set(new TextEncoder().encode(type), at); view.setUint16(at + 4, rows.length - 1); view.setUint16(at + 6, ref);
 for (const r of rows) {
 const at = map + 28 + ref;
 view.setInt16(at, r.id); view.setUint16(at + 2, 65535); view.setUint32(at + 4, data);
 view.setUint32(256 + data, r.data.length); bytes.set(r.data, 260 + data);
 data += 4 + r.data.length; ref += 12;
 }
 });
 return bytes;
}
const id = -10236;
const mask = new Uint8Array(64); mask.fill(255, 0, 32); // all mask-clear, poisoned image
const color = new Uint8Array(256).fill(35);
const records = [{ type: 'ics#', id, data: mask }, { type: 'ics8', id, data: color }];

test('opaque companion retains actual mask-clear RGB and is opt-in by signed identity', () => {
 const bytes = fork(records), core = convertIcons(bytes), prepared = convertIcons(bytes, { unmaskedIconIds: [id] });
 assert.equal(core.assets.some(a => a.path.includes('opaque-')), false);
 assert.equal(convertIcons(bytes, { unmaskedIconIds: [-id] }).assets.some(a => a.path.includes('opaque-')), false);
 const masked = prepared.assets.find(a => !a.path.includes('opaque-')), opaque = prepared.assets.find(a => a.path.includes('opaque-'));
 assert.equal(masked.rgba[3], 0); assert.equal(opaque.rgba[3], 255);
 assert.deepEqual([...opaque.rgba.slice(0, 3)], [...masked.rgba.slice(0, 3)]);
 assert.ok(opaque.rgba.slice(0, 3).some(n => n !== 0));
});

test('colour census retains duplicates and malformed occurrences while decode deduplicates', () => {
 const out = convertIcons(fork([...records, { type: 'ics8', id, data: new Uint8Array(1) }]));
 assert.deepEqual(out.iconColorResources.map(r => [r.id, r.resourceIndex, r.byteLength]), [[id, 1, 256], [id, 2, 1]]);
 assert.equal(out.index.filter(i => i.type === 'ics8').length, 1);
});

test('encoded loader binds opaque URL to exact typed occurrence; [] preserves opt-out', async () => {
 const encode = (rgba, w, h, path) => `test:${path}`;
 const theme = await loadKaleidoscopeScheme(fork(records), { encodeAssets: true, assetUrlFactory: encode, unmaskedIconIds: [id] });
 assert.equal(theme.inspector.iconIndex[0].resourceIndex, 1);
 assert.equal(theme.inspector.iconIndex[0].unmaskedUrl, 'test:icons/opaque-ics8-n10236.png');
 assert.equal(theme.inspector.iconColorResources[0].id, id);
 const bare = await loadKaleidoscopeScheme(fork(records), { encodeAssets: true, assetUrlFactory: encode, unmaskedIconIds: [] });
 assert.equal(bare.inspector.iconIndex[0].unmaskedUrl, undefined);
});
