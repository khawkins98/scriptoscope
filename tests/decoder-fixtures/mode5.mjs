// Independently hand-encoded and reviewed mode5 inputs/literals (#300).
// No production decoder, geometry, palette or display helper imports.
import assert from 'node:assert/strict';
const rgb = { R:[255,0,0], G:[0,255,0], B:[0,0,255], Y:[255,255,0],
  C:[0,255,255], M:[255,0,255], K:[0,0,0], W:[255,255,255] };
const pack = (rows, depth, stride, lookup) => {
  const bytes=new Uint8Array(rows.length*stride);
  rows.forEach((row,y)=>[...row].forEach((symbol,x)=>{
    const index=lookup(symbol); const bit=x*depth;
    bytes[y*stride+(bit>>3)] |= index << (8-depth-(bit&7));
  }));
  return bytes;
};
export function literalCicn({rows,maskRows,depth,palette}) {
  const height=rows.length,width=rows[0].length;
  assert(rows.every(r=>r.length===width)); assert(maskRows.length===height&&maskRows.every(r=>r.length===width));
  const rowBytes=Math.ceil(width*depth/16)*2, maskRowBytes=Math.ceil(width/16)*2;
  const mask=pack(maskRows,1,maskRowBytes,c=>Number(c));
  // Present, safe monochrome bounds are important: mode5 takes its source Rect
  // from THIS bitmap, even in the color path. Mono pixel semantics are unclaimed.
  const mono=pack(maskRows,1,maskRowBytes,c=>Number(c));
  const pixels=pack(rows,depth,rowBytes,c=>palette.indexOf(c));
  const table=82+mask.length+mono.length;
  const bytes=new Uint8Array(table+8+palette.length*8+pixels.length),v=new DataView(bytes.buffer);
  const word=(p,x)=>v.setUint16(p,x); const long=(p,x)=>v.setUint32(p,x);
  word(4,0x8000|rowBytes); word(10,height);word(12,width);
  long(22,72<<16);long(26,72<<16);word(32,depth);word(34,1);word(36,depth);
  word(54,maskRowBytes);word(60,height);word(62,width);
  word(68,maskRowBytes);word(74,height);word(76,width);
  bytes.set(mask,82);bytes.set(mono,82+mask.length);
  word(table+4,0);word(table+6,palette.length-1);
  palette.forEach((symbol,i)=>{word(table+8+i*8,i);rgb[symbol].forEach((x,j)=>word(table+10+i*8+j*2,x*257));});
  bytes.set(pixels,table+8+palette.length*8);
  return bytes;
}
export function faceInfo(bodyId=51) {
  const bytes=new Uint8Array(18),v=new DataView(bytes.buffer);
  bytes[0]=1;bytes[1]=2;bytes[3]=5;v.setInt16(4,bodyId);
  // bg/text local(0,0), absent emboss. BG is raw green under a mask-zero pixel.
  return bytes;
}
export const inputs={
  face:literalCicn({rows:Array(7).fill('GGGGGGG'),maskRows:Array(7).fill('0000000'),depth:8,palette:['G']}),
  colorBody:literalCicn({rows:['RGBYRGBYRGBYRGBYRGBY','CMKWCMKWCMKWCMKWCMKW'],
    maskRows:['10101010101010101010','01010101010101010101'],depth:8,palette:['R','G','B','Y','C','M','K','W']}),
  // Conventional 1-bit palette0=white/background,1=black/foreground. This
  // avoids claiming arbitrary 1-bit ColorTable behavior for CopyMask.
  oneBitBody:literalCicn({rows:['KKWWKKWWKKWWKKWWKKWW','WWKKWWKKWWKKWWKKWWKK'],
    maskRows:['10101010101010101010','01010101010101010101'],depth:1,palette:['W','K']}),
  cinf51:faceInfo(51),cinf0:faceInfo(0),cinfMissing:faceInfo(52),
};
// These rows are handwritten output literals for D24x6, c1/s2, 1:1 body20x2.
// Dot means transparent, not white. Color8 intentionally ignores icon mask.
export const expectedRows={
  color8:[
    '........................',
    '........................',
    '..RGBYRGBYRGBYRGBYRGBY..',
    '..CMKWCMKWCMKWCMKWCMKW..',
    '........................',
    '........................',
  ],
  indexed1:[
    '........................',
    '........................',
    '..K.W.K.W.K.W.K.W.K.W...',
    '...W.K.W.K.W.K.W.K.W.K..',
    '........................',
    '........................',
  ],
  missing:[
    '........................',
    '..GGGGGGGGGGGGGGGGGGGG..',
    '.GGGGGGGGGGGGGGGGGGGGGG.',
    '.GGGGGGGGGGGGGGGGGGGGGG.',
    '..GGGGGGGGGGGGGGGGGGGG..',
    '........................',
  ],
  // D=(-3,5), clip=(0,7,4,1) retains local x3..6/y2 only.
  color8Clipped:[
    '........................',
    '........................',
    '...GBYR.................',
    '........................',
    '........................',
    '........................',
  ],
};
export const expectedBuffers=Object.fromEntries(Object.entries(expectedRows).map(([name,rows])=>{
  assert.equal(rows.length,6);assert(rows.every(r=>r.length===24),`${name} row width`);
  return[name,Uint8Array.from(rows.flatMap(row=>[...row].flatMap(c=>c==='.'?[0,0,0,0]:[...rgb[c],255])))];
}));
export function entries(kind='color8',bodyId=51) {
  return [{type:'cicn',id:-10239,name:'mode5-face',data:inputs.face},
    {type:'cinf',id:-10239,data:faceInfo(kind==='missing'?52:bodyId)},
    ...(kind==='missing'?[]:[{type:'cicn',id:bodyId,name:'mode5-body',data:kind==='indexed1'?inputs.oneBitBody:inputs.colorBody}])];
}
