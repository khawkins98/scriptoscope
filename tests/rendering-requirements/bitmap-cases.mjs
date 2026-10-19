import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export const bitmapPins=JSON.parse(readFileSync(new URL('../decoder-fixtures/bitmap-font-pins.json',import.meta.url)));
export const bitmapCaseIds=bitmapPins.cases.map(c=>c.id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyBitmapFixtures(root){
  assert.equal(hash(readFileSync(resolve(root,bitmapPins.fixture.path))),bitmapPins.fixture.sha256,'bitmap fixture file identity');
  for(const p of bitmapPins.cases)assert.equal(`bitmap-font:${hash(JSON.stringify(p.fontData))}`,p.fontId,'declared normalized strike hash');
}
export function validateBitmapCase(c,input){
  const pin=bitmapPins.cases.find(p=>p.id===c.id);assert(pin,'unknown prepared-strike case');
  assert.equal(c.mode,'direct');assert.equal(c.family,'push');
  assert.deepEqual(c.inputs,[pin.inputId]);assert.deepEqual(c.baseInputs,[]);
  assert.deepEqual(c.options,{...pin.options,bitmapFont:pin.fontId},'exact prepared-strike options');
  if(input){assert.equal(input.kind,'synthetic');assert.deepEqual(input.definition.fixture,bitmapPins.fixture);assert.equal(input.definition.fontId,pin.fontId);assert.deepEqual(input.definition.fontData,pin.fontData,'declared input strike');}
}
/** Independent literal data and source-derived coordinates; never import layout/painter helpers. */
export function verifyBitmapRows(rows){
  assert.equal(rows.length,bitmapPins.cases.length,'exact finite prepared rows');
  for(const pin of bitmapPins.cases){
    const matches=rows.filter(r=>r.caseId===pin.id);assert.equal(matches.length,1,'missing/duplicate prepared case');const r=matches[0];
    assert.deepEqual(r.options,pin.options,'actual prepared request');
    assert.equal(r.fontId,pin.fontId,'actual prepared font identity');assert.deepEqual(r.fontData,pin.fontData,'actual normalized strike data');
    assert.deepEqual(r.size,pin.size,'actual face size');
    assert.equal(r.trace.family,'push-button');
    assert.deepEqual(r.trace.requested,{state:'active',pressed:false,disabled:false,default:false},'actual prepared flags');
    assert.deepEqual(r.trace.outcome,{status:'themed',width:pin.size[0],height:pin.size[1]},'completed prepared paint');
    assert.deepEqual(r.trace.bitmapTextPaint,pin.paint,'actual font/metrics/pen/clip/occupancy');
    assert.equal(r.pixelSelection,pin.pixelSelection);
    assert.deepEqual(r.pixels,pin.literalPixels,'complete selected literal pixel coverage');
  }
  return bitmapCaseIds;
}
