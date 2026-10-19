import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {bitmapFontFixture} from '../decoder-fixtures/bitmap-font.mjs';
import {bitmapPins,verifyBitmapFixtures,validateBitmapCase,verifyBitmapRows} from './bitmap-cases.mjs';
import {makeReport} from './ledger.mjs';
const ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
// Synthetic observations test the verifier, not production rendering.
const rows=()=>bitmapPins.cases.map(p=>({caseId:p.id,options:structuredClone(p.options),fontId:p.fontId,fontData:structuredClone(p.fontData),size:p.size,trace:{family:'push-button',requested:{state:'active',pressed:false,disabled:false,default:false},outcome:{status:'themed',width:p.size[0],height:p.size[1]},bitmapTextPaint:structuredClone(p.paint)},pixelSelection:p.pixelSelection,pixels:structuredClone(p.literalPixels)}));
test('owned literal strike data and hash remain separate from production preparation/layout',()=>{
 verifyBitmapFixtures(fileURLToPath(new URL('../../',import.meta.url)));
 for(const p of bitmapPins.cases){const d=bitmapFontFixture();if(p.traceKey==='clip')d.glyphs[0].bearingX=-14;d.glyphs.sort((a,b)=>a.character<b.character?-1:1);assert.deepEqual(d,p.fontData);}
 verifyBitmapRows(rows());
});
test('prepared exact-case guard rejects edited mode, family, options or input',()=>{
 for(const p of bitmapPins.cases){const c=ledger.cases.find(c=>c.id===p.id);validateBitmapCase(c);
 for(const change of[c=>c.family='bevel',c=>c.mode='declarative',c=>c.options.label='X',c=>c.inputs=['synthetic.other']]){const altered=structuredClone(c);change(altered);assert.throws(()=>validateBitmapCase(altered));}}
});
test('actual prepared paint rejects wrong font, metrics, pen, clip, coverage or incomplete completion',()=>{
 for(const change of[
 r=>r.fontId='bitmap-font:wrong',r=>r.fontData.metrics.ascent=11,r=>r.trace.bitmapTextPaint.fontId='wrong',
 r=>r.trace.bitmapTextPaint.pen[0]++,r=>r.trace.bitmapTextPaint.declaredClip={kind:'unknown'},
 r=>r.trace.bitmapTextPaint.foreground.pixels--,r=>r.pixels.pop(),r=>r.pixels[0][2]=42,
 r=>r.trace.outcome.status='error',r=>delete r.trace.bitmapTextPaint,r=>r.options.label='other',
 ]){const r=rows();change(r[0]);assert.throws(()=>verifyBitmapRows(r));}
 assert.throws(()=>verifyBitmapRows(rows().slice(1)),/finite/);
});
test('prepared assertions stay not run for missing, dirty, stale or wrong-path execution',()=>{
 const marker={id:'bitmap.prepared-literal-paint',mode:'source',path:'tests/rendering-options/bitmap-font.spec.mjs',status:'passed'};
 for(const execution of[undefined,{executionCommit:'current',workingTreeDirty:true,assertions:[marker]},
 {executionCommit:'old',workingTreeDirty:false,assertions:[marker]},
 {executionCommit:'current',workingTreeDirty:false,assertions:[{...marker,path:'tests/unrelated.spec.mjs'}]}]){
 const r=makeReport(ledger,{executionCommit:'current',workingTreeDirty:false,execution});
 assert(r.execution.assertions.find(a=>a.id===marker.id).modes.every(m=>m.status==='not run'));
 }
});
