import test from 'node:test';
import assert from 'node:assert/strict';
import {checkablePresentation} from './checkable-presentation.mjs';
test('full source margins and allocation survive independently of opaque bounds',()=>{
 // 19×23 source, all clear except two edge sentinels. Full frame extends left
 // and above D; a crop-to-ink implementation cannot satisfy dimensions/padding.
 const rgba=new Array(19*23*4).fill(0);rgba.splice(0,4,7,8,9,255);rgba.splice((22*19+18)*4,4,10,11,12,255);
 const out=checkablePresentation({width:19,height:23,rgba},'cicn');
 assert.deepEqual([out.width,out.height],[19,23]);
 assert.deepEqual(out.rgba.slice(0,4),[7,8,9,255]);assert.deepEqual(out.rgba.slice(-4),[10,11,12,255]);
 assert.equal(out.rgba.filter((x,i)=>i%4===3&&x).length,2);
});
test('literal 16×16 icon frame occupies y4..19 within the complete 16×20 output',()=>{
 const rgba=new Array(16*16*4).fill(0);rgba.splice(0,4,9,8,7,255);rgba.splice(1020,4,6,5,4,255);
 const out=checkablePresentation({width:16,height:16,rgba},'icon');
 assert.deepEqual([out.width,out.height],[16,20]);assert.deepEqual(out.rgba.slice(0,256),new Array(256).fill(0));
 assert.deepEqual(out.rgba.slice(256,260),[9,8,7,255]);assert.deepEqual(out.rgba.slice(-4),[6,5,4,255]);
});
