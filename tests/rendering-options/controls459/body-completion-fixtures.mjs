// Independent literal completion oracle. No runtime imports or output-derived expectations.
import {entries, literalCicn, expectedBuffers} from '../../decoder-fixtures/mode5.mjs';
import {forkOf} from '../../resource-provenance/fixtures.mjs';
const rgb={'.':[0,0,0,0],R:[255,0,0,255],G:[0,255,0,255],B:[0,0,255,255],Y:[255,255,0,255],C:[0,255,255,255],M:[255,0,255,255],K:[0,0,0,255],W:[255,255,255,255]};
const plane=rows=>rows.flatMap(row=>[...row].flatMap(c=>rgb[c]));
export const context={controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'known',offset:[0,0]},clip:{kind:'unbounded'}};
export function ppat(){
 const b=new Uint8Array(158),v=new DataView(b.buffer);v.setUint16(0,1);v.setUint32(2,28);v.setUint32(6,78);
 v.setUint16(32,0x8004);v.setUint16(38,2);v.setUint16(40,4);v.setUint16(60,8);v.setUint16(62,1);v.setUint16(64,8);v.setUint32(70,86);b.set([0,1,2,3,4,5,6,7],78);v.setUint16(92,7);
 for(let i=0;i<8;i++){v.setUint16(94+i*8,i);for(let c=0;c<3;c++)v.setUint16(96+i*8+c*2,(i>>c&1)*65535);}return b;
}
const pack=(records)=>Array.from(forkOf(records));
export function modeCases(){
 const definitions=[['color8','color8',51,false,'color8',40,'unmasked-copy'],['indexed1','indexed1',51,false,'indexed1',20,'masked-copy'],['missing','missing',52,false,'missing',84,'missing-erase'],['negative-origin-clip','color8',51,false,'color8Clipped',4,'unmasked-copy'],['signed-zero','color8',0,false,'color8',40,'unmasked-copy'],['same-id-types','color8',51,true,'color8',40,'unmasked-copy'],['ppat-only','missing',52,true,'missing',84,'missing-erase']];
 return definitions.map(([id,kind,bodyId,collision,expected,count,branch])=>{const records=entries(kind,bodyId);if(collision)records.push({type:'ppat',id:bodyId,name:'collision',data:ppat()});return{id,kind:'mode5',fork:pack(records),rgba:Array.from(expectedBuffers[expected]),count,branch,bodyId,missing:kind==='missing',options:{label:'',minWidth:24,height:6,compositionContext:id==='negative-origin-clip'?{controlOrigin:[-3,5],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:{x:0,y:7,w:4,h:1}}}:context}};});
}
// Own handencoded mode5 control: ordinary asset is already opaque, so it is a
// sufficient actual transport; a hidden-RGB companion is unnecessary here.
export function ordinaryCase(){
 const records=entries();records[2].data=literalCicn({rows:['YYYYYYYYYYYYYYYYYYYY','BBBBBBBBBBBBBBBBBBBB'],maskRows:['11111111111111111111','11111111111111111111'],depth:8,palette:['Y','B']});
 return{id:'own-ordinary-opaque',kind:'mode5',fork:pack(records),rgba:plane(['........................','........................','..YYYYYYYYYYYYYYYYYYYY..','..BBBBBBBBBBBBBBBBBBBB..','........................','........................']),count:40,branch:'unmasked-copy',bodyId:51,options:{label:'',minWidth:24,height:6,compositionContext:context}};
}
const patternRows=['.............................','...HEFGHEFGHEFGHEFGHEFGHEF...','...DABCDABCDABCDABCDABCDAB...','.FGHEFGHEFGHEFGHEFGHEFGHEFGH.','.BCDABCDABCDABCDABCDABCDABCD.','.FGHEFGHEFGHEFGHEFGHEFGHEFGH.','...DABCDABCDABCDABCDABCDAB...','...HEFGHEFGHEFGHEFGHEFGHEF...','.............................'];
const colors={'.':[0,0,0,0],A:[0,0,0,255],B:[255,0,0,255],C:[0,255,0,255],D:[255,255,0,255],E:[0,0,255,255],F:[255,0,255,255],G:[0,255,255,255],H:[255,255,255,255]};
export function patternCase(){
 const face=literalCicn({rows:Array(7).fill('GGGGGGG'),maskRows:Array(7).fill('0000000'),depth:8,palette:['G']});
 const info=new Uint8Array([3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
 return{id:'raw-pattern-union',kind:'pattern',fork:pack([{type:'cicn',id:-10239,name:'pattern-face',data:face},{type:'cinf',id:-10239,data:info},{type:'ppat',id:0,name:'literal-pattern',data:ppat()}]),rgba:patternRows.flatMap(r=>[...r].flatMap(c=>colors[c])),count:173,branch:'pattern-fill-union',bodyId:0,rects:[{x:3,y:1,w:23,h:7},{x:1,y:3,w:27,h:3}],options:{label:'',minWidth:29,height:9,compositionContext:{...context,controlOrigin:[20,20]}}};
}
export function ringCase(){const c=ordinaryCase(),records=entries();records[2].data=literalCicn({rows:['YYYYYYYYYYYYYYYYYYYY','BBBBBBBBBBBBBBBBBBBB'],maskRows:['11111111111111111111','11111111111111111111'],depth:8,palette:['Y','B']});records.push({type:'cicn',id:-10231,name:'late-ring',data:literalCicn({rows:Array(9).fill('RRRRRRRRR'),maskRows:Array(9).fill('111111111'),depth:8,palette:['R']})},{type:'cinf',id:-10231,data:new Uint8Array([1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])});return{...c,id:'late-ring',fork:pack(records),options:{...c.options,default:true}};}
export const cases=[...modeCases(),ordinaryCase(),patternCase()];
