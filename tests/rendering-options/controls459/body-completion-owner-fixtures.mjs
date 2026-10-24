// Independent owner-policy extension; existing completion freeze is untouched.
import {literalCicn,faceInfo,entries,expectedBuffers} from '../../decoder-fixtures/mode5.mjs';
import {forkOf} from '../../resource-provenance/fixtures.mjs';
import {ppat,patternCase,ordinaryCase,context} from './body-completion-fixtures.mjs';
const asFork=r=>Array.from(forkOf(r)),colorBody=(symbol)=>literalCicn({rows:Array(2).fill(symbol.repeat(20)),maskRows:Array(2).fill('11111111111111111111'),depth:8,palette:[symbol]});
const ownedColor=()=>literalCicn({rows:['YYYYYYYYYYYYYYYYYYYY','BBBBBBBBBBBBBBBBBBBB'],maskRows:Array(2).fill('11111111111111111111'),depth:8,palette:['Y','B']});
const poisonPattern=()=>{const b=ppat(),v=new DataView(b.buffer);for(let i=0;i<8;i++){v.setUint16(96+i*8,65535);v.setUint16(98+i*8,0);v.setUint16(100+i*8,65535);}return b;};
const greenRows=['.............................','...GGGGGGGGGGGGGGGGGGGGGGG...','...GGGGGGGGGGGGGGGGGGGGGGG...','.GGGGGGGGGGGGGGGGGGGGGGGGGGG.','.GGGGGGGGGGGGGGGGGGGGGGGGGGG.','.GGGGGGGGGGGGGGGGGGGGGGGGGGG.','...GGGGGGGGGGGGGGGGGGGGGGG...','...GGGGGGGGGGGGGGGGGGGGGGG...','.............................'];
const green=greenRows.flatMap(r=>[...r].flatMap(c=>c==='.'?[0,0,0,0]:[0,255,0,255]));
export function ownerCases(){return ['mode5','pattern'].flatMap(kind=>['valid','absent','malformed'].map(variant=>{
 const bodyId=kind==='mode5'?-51:-7,face=entries()[0],info=kind==='mode5'?faceInfo(bodyId):new Uint8Array([3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
 if(kind==='pattern')new DataView(info.buffer).setInt16(4,bodyId);
 const type=kind==='mode5'?'cicn':'ppat',body={type,id:bodyId,name:'owned-body',data:kind==='mode5'?ownedColor():ppat()},records=[face,{type:'cinf',id:-10239,data:info}];
 if(variant!=='absent')records.push(body);if(variant==='malformed'&&kind==='mode5')records.push({...body,name:'ambiguous-owned-body'});
 const child=[{type,id:bodyId,name:'foreign-body',data:kind==='mode5'?colorBody('M'):poisonPattern()}];
 return{id:`owner-${kind}-${variant}`,kind,variant,type,bodyId,ownerFork:asFork(records),childFork:asFork(child),options:kind==='mode5'?ordinaryCase().options:patternCase().options,rgba:variant==='absent'?(kind==='mode5'?Array.from(expectedBuffers.missing):green):(kind==='mode5'?ordinaryCase().rgba:patternCase().rgba),count:variant==='absent'?(kind==='mode5'?84:173):(kind==='mode5'?40:173),branch:variant==='absent'?'missing-erase':kind==='mode5'?'unmasked-copy':'pattern-fill-union'};
}));}
export function lateRingCases(){
 const records=entries();records[2].data=ownedColor();records.push({type:'cicn',id:-10231,name:'late-ring',data:literalCicn({rows:Array(9).fill('RRRRRRRRR'),maskRows:Array(9).fill('111111111'),depth:8,palette:['R']})},{type:'cinf',id:-10231,data:new Uint8Array([1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])});
 const rows=['RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',...Array(5).fill('R..............................R'),'R.....YYYYYYYYYYYYYYYYYYYY.....R','R.....BBBBBBBBBBBBBBBBBBBB.....R',...Array(5).fill('R..............................R'),'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR'];
 const colors={R:[255,0,0,255],Y:[255,255,0,255],B:[0,0,255,255],'.':[0,0,0,0]},rgba=rows.flatMap(r=>[...r].flatMap(c=>colors[c]));
 return[{id:'late-ring-valid',fork:asFork(records),rgba,options:{...ordinaryCase().options,default:true}},{id:'late-ring-malformed',fork:asFork(records.map((r,i)=>i===4?{...r,data:r.data.slice(0,17)}:r)),options:{...ordinaryCase().options,default:true}}];
}
export const policyCases=ownerCases(),lateCases=lateRingCases();
export function admissionCases(){
 const scaled=ordinaryCase(),missing=entries('missing');new DataView(missing[1].data.buffer).setInt16(6,20);new DataView(missing[1].data.buffer).setInt16(8,20);
 return[{...scaled,id:'mode5-nonaligned',options:{...scaled.options,height:7}},{id:'missing-background-unverified',fork:asFork(missing),options:ordinaryCase().options}];
}
