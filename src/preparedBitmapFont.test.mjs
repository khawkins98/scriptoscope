import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareBitmapFont, prepareBitmapGlyphRun, bitmapPushPen } from './preparedBitmapFont.ts';
import { bitmapFontFixture } from '../tests/decoder-fixtures/bitmap-font.mjs';
const context = { basis: 'caller-declared', controlOrigin: [20,20], portOrigin: [0,0], patternOrigin: { status: 'unknown' }, clip: { kind: 'unbounded' } };

test('prepared bitmap font snapshots dense masks and canonical mapping before digest', async () => {
  const input = bitmapFontFixture(), pending = prepareBitmapFont(input);
  input.glyphs[0].mask.fill(0); input.metrics.ascent = 1;
  const font = await pending, second = bitmapFontFixture(); second.glyphs.reverse();
  assert.equal(font.id, (await prepareBitmapFont(second)).id);
  assert.equal(font.data.metrics.ascent, 12); assert.equal(font.data.glyphs.find(g=>g.character==='X').mask[0], 1);
  assert.ok(Object.isFrozen(font.data.glyphs[0].mask));
  assert.throws(()=>prepareBitmapGlyphRun({ ...font }, 'X', undefined, context), /prepareBitmapFont/);
  for (const change of [d=>delete d.glyphs[0].mask[0],d=>d.glyphs[0].mask[0]=2,d=>d.metrics.descent=-1,d=>d.glyphs.push(d.glyphs[0])]) {
    const bad=bitmapFontFixture();change(bad);await assert.rejects(prepareBitmapFont(bad));
  }
});
test('advance, signed bearings, empty space and nominal size remain independent', async () => {
  const font = await prepareBitmapFont(bitmapFontFixture());
  const run = prepareBitmapGlyphRun(font, 'X X', undefined, context);
  assert.equal(run.advance, 7); assert.equal(run.lineHeight, 16);
  assert.deepEqual(run.inkBounds, { x:-1,y:-2,w:8,h:3 });
  assert.equal(prepareBitmapGlyphRun(font, ' ', 12, context).inkBounds, null);
  for (const label of ['Y','X\nX','X\r','X\t']) assert.throws(()=>prepareBitmapGlyphRun(font,label,12,context));
  for (const size of [6,13,NaN,Infinity]) assert.throws(()=>prepareBitmapGlyphRun(font,'X',size,context));
  assert.throws(()=>prepareBitmapGlyphRun(font,'X',12,{...context,clip:{kind:'unknown'}}));
});
test('single-line push pen uses source signed truncation, metrics and short-line adjustment', async () => {
  const input=bitmapFontFixture(); input.glyphs[0].advance=17;
  const run=prepareBitmapGlyphRun(await prepareBitmapFont(input),'X',undefined,context);
  // Independently derived source example: 103/2 truncates51, baseline40-trunc(5/2)-1-3=34.
  assert.deepEqual(bitmapPushPen(run,{x:20,y:20,w:80,h:20}),[51,34]);
  assert.deepEqual(bitmapPushPen(run,{x:-20,y:-20,w:10,h:10}),[-23,-12]);
  input.metrics={ascent:8,descent:2,leading:1};
  const short=prepareBitmapGlyphRun(await prepareBitmapFont(input),'X',12,context);
  assert.deepEqual(bitmapPushPen(short,{x:0,y:0,w:20,h:12}),[1,7]);
  assert.throws(()=>bitmapPushPen(run,{x:20000,y:0,w:80,h:20}),/left \+ right/);
});
