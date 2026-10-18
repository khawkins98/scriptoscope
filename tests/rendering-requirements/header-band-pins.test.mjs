import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {forkOf} from '../resource-provenance/fixtures.mjs';
import * as h from '../decoder-fixtures/header-surface.mjs';
import * as b from '../decoder-fixtures/sampled-bands.mjs';
import {headerBandPins} from './header-band-cases.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
test('four header/band assertion pins bind exact ledger inputs and independently serialized payloads',()=>{
  const overlap=[-9567,-9568].flatMap(id=>[{type:'cicn',id,data:h.headerOverlapIcon()},{type:'cinf',id,data:h.headerOverlapInfo()}]);
  const info=h.headerSurfaceInfo();info[0]=3;info[2]=1;
  const records=[overlap,overlap,[{type:'cicn',id:-9567,data:h.headerSamplingCollisionIcon()},{type:'cinf',id:-9567,data:info}],
    [{type:'cicn',id:-10239,name:'band fixture',data:b.sampledBandIcon()},{type:'cinf',id:-10239,data:b.sampledBandInfo(true)}]];
  assert.equal(headerBandPins.cases.length,4);
  for(const[at,pin]of headerBandPins.cases.entries()){
    const c=ledger.cases.find(c=>c.id===pin.id);assert(c);assert.deepEqual(pin.options,c.options);
    const input=ledger.inputs.find(i=>i.id===(at<2?c.baseInputs[0]:c.inputs[0]));
    assert.deepEqual(pin.source.candidates.map(r=>({type:r.type,signedId:r.signedId,bytes:r.byteLength,sha256:r.payloadSha256})),input.definition.recordOrder.map(({name,...r})=>r));
    const bytes=forkOf(records[at]);assert.equal(hash(bytes),pin.source.archive.sha256);assert.equal(bytes.length,pin.source.archive.byteLength);
    for(const r of records[at]){
      const p=pin.source.candidates.find(p=>p.type===r.type&&p.signedId===r.id);assert(p);assert.equal(p.payloadSha256,hash(r.data));assert.equal(p.byteLength,r.data.length);
    }
    if(at<2){assert.deepEqual(pin.literalPalette,input.definition.literalCurrentDisplayPalette);assert.deepEqual(pin.literalRows,at===0?h.headerOverlapWindowRows:h.headerOverlapClippedListRows);}
  }
});
test('retained list-view pixels differ from independently literal ordinary-height output',()=>{
  const [ordinary,list]=headerBandPins.cases;
  assert.equal(ordinary.literalRows[10][8],'7');assert.equal(ordinary.literalRows[10][9],'6');
  assert.equal(list.literalRows[10][8],'@');assert.equal(list.literalRows[10][9],'@');
  assert.notDeepEqual(ordinary.literalPalette['7'],list.literalPalette['@']);
  assert.notDeepEqual(ordinary.literalPalette['6'],list.literalPalette['@']);
});
