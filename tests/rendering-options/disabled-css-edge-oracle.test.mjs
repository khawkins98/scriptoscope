import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { sha256, reconstructDisabledCssEdge, matchesDisabledCssEdgeB, compareGoldenWithDisabledCssEdge } from './disabled-css-edge-oracle.mjs';

const directory = new URL('./goldens/', import.meta.url);
const evidence = JSON.parse(readFileSync(new URL('disabled-css-edge-variants.json', directory)));
const environment = JSON.parse(readFileSync(new URL('manifest.json', directory))).environment;
const encode = image => PNG.sync.write(image);
for (const row of evidence.variants) {
  const canonical = readFileSync(new URL(`${row.slug}-page-1.png`, directory));
  const binding = { slug: row.slug, page: 1, caseIndex: 8, caseId: row.caseId, environment };
  const b = reconstructDisabledCssEdge(row, canonical);
  const actual = encode(b);
  test(`${row.slug}: frozen B only, exact sheet and environment binding`, () => {
    assert.equal(matchesDisabledCssEdgeB(binding, canonical, actual), true);
    assert.equal(matchesDisabledCssEdgeB(binding, canonical, canonical), false);
    for (const changed of [{ slug: '1984' }, { slug: row.slug === 'slimes' ? 'platinum-8' : 'slimes' }, { page: 2 }, { caseIndex: 9 }, { caseId: row.caseId.replace('disabled', 'normal') }, { environment: { ...environment, deviceScaleFactor: 2 } }])
      assert.equal(matchesDisabledCssEdgeB({ ...binding, ...changed }, canonical, actual), false);
    assert.equal(matchesDisabledCssEdgeB(binding, Buffer.concat([canonical, Buffer.from([0])]), actual), false);
    assert.equal(matchesDisabledCssEdgeB(binding, canonical, encode({ ...b, width: b.width - 1 })), false);
    assert.equal(matchesDisabledCssEdgeB(binding, canonical, Buffer.from('invalid PNG')), false);
    assert.equal(sha256(canonical), row.canonicalPngSha256, 'original baseline stays unchanged');
  });
  test(`${row.slug}: corruption of compact reconstruction fails closed`, () => {
    const changed = edit => { const copy = structuredClone(row); edit(copy); return copy; };
    for (const [edit, error] of [
      [r => r.canonicalPngSha256 = '0'.repeat(64), /PNG identity/],
      [r => r.dimensions[0]++, /dimensions/],
      [r => r.canonicalRgbaSha256 = '0'.repeat(64), /canonical RGBA/],
      [r => r.patches[0][2][0]++, /before RGBA/],
      [r => r.patches[0][3][0]++, /whole RGBA/],
      [r => r.variantRgbaSha256 = '0'.repeat(64), /whole RGBA/],
      [r => r.patches.pop(), /count/],
      [r => r.patches[1] = r.patches[0], /duplicate/],
    ]) assert.throws(() => reconstructDisabledCssEdge(changed(edit), canonical), error);
  });
  test(`${row.slug}: B plus glyph, disabled face, third edge or outside pixel is rejected`, () => {
    const y = Math.min(...row.patches.map(p => p[1]));
    const image = PNG.sync.read(canonical);
    let glyph;
    for (let j = y + 7; j < y + 18 && !glyph; j++) for (let x = 883; x < 931; x++) {
      const offset = (j * image.width + x) * 4;
      if (image.data.subarray(offset, offset + 4).equals(Buffer.from([154, 154, 154, 255]))) { glyph = [x, j]; break; }
    }
    assert.ok(glyph, 'opaque disabled label ink exists');
    for (const [x, j, replacement = [255, 0, 255, 255]] of [glyph, [900, y + 4], [877, y, [101, 101, 101, 255]], [0, 0]]) {
      const changed = { ...b, data: Buffer.from(b.data) };
      const offset = (j * b.width + x) * 4;
      changed.data.set(replacement, offset);
      assert.equal(matchesDisabledCssEdgeB(binding, canonical, encode(changed)), false, `changed ${x},${j}`);
    }
    assert.equal(sha256(canonical), row.canonicalPngSha256);
  });
  test(`${row.slug}: canonical comparison remains authoritative and called once`, async () => {
    let calls = 0;
    const info = { attachments: [], attach: async () => {} };
    const result = await compareGoldenWithDisabledCssEdge(async () => { calls++; }, info, binding);
    assert.equal(result.branch, 'canonical-stock'); assert.equal(calls, 1);
    const original = new Error('stock screenshot failure');
    await assert.rejects(compareGoldenWithDisabledCssEdge(async () => { throw original; }, info, binding), e => e === original);
  });
}
test('independently themed Slimes window pixel plus rejected B stays rejected', () => {
  const row = evidence.variants.find(r => r.slug === 'slimes');
  const canonical = readFileSync(new URL('slimes-page-1.png', directory));
  const b = reconstructDisabledCssEdge(row, canonical);
  // Reviewed yellow-green window color, outside the gray CSS button.
  let offset;
  for (let y = 351; y < 450 && offset === undefined; y++) for (let x = 450; x < 650; x++) {
    const i = (y * b.width + x) * 4;
    if (b.data.subarray(i, i + 4).equals(Buffer.from([212, 255, 68, 255]))) { offset = i; break; }
  }
  assert.notEqual(offset, undefined);
  b.data.set([255, 0, 255, 255], offset);
  assert.equal(matchesDisabledCssEdgeB({ slug: row.slug, page: 1, caseIndex: 8, caseId: row.caseId, environment }, canonical, encode(b)), false);
  assert.equal(sha256(canonical), row.canonicalPngSha256);
});
