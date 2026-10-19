// Owned indexed8 CICN: asymmetric seven-color axis, three pixels across,
// complete opaque mask, NIL bitmap. Palette endpoints need no display fitting.
export const grooveColors = {
  R:[255,0,0,255], G:[0,255,0,255], B:[0,0,255,255],
  W:[255,255,255,255], K:[0,0,0,255], Y:[255,255,0,255], C:[0,255,255,255],
};
export function grooveIcon(vertical = false) {
  const width=vertical?3:7,height=vertical?7:3,table=82+height;
  const bytes=new Uint8Array(table+8+56+width*height),v=new DataView(bytes.buffer);
  const word=(p,n)=>v.setUint16(p,n);
  word(4,0x8000|width);word(10,height);word(12,width);
  word(32,8);word(34,1);word(36,8);
  word(54,1);word(60,height);word(62,width);bytes.fill(255,82,table);
  word(table+6,6);
  Object.values(grooveColors).forEach((rgb,i)=>{word(table+8+i*8,i);rgb.slice(0,3).forEach((c,j)=>word(table+10+i*8+j*2,c*257));});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes[table+64+y*width+x]=vertical?y:x;
  return bytes;
}
export function grooveInfo(requested = false) {
  const bytes=new Uint8Array(18);bytes[0]=requested?2:1;bytes[1]=1;bytes[2]=requested?0:1;return bytes;
}
// Independent literal runs at output length32: one-cap repeating active versus
// two-cap nonrepeating requested art. These are current slicing-policy vectors.
export const activeGrooveRow = 'RGBWKYGBWKYGBWKYGBWKYGBWKYGBWKYC';
export const requestedGrooveRow = 'RG'+'BBBBBBBBBB'+'WWWWWWWWW'+'KKKKKKKKK'+'YC';
