// Literal serialized indexed8 fixture: 7x7, stride8, mask stride1, NIL bmap.
// Raster ctFlags bit15 chooses red entry0; engine reverse-value lookup chooses
// gray0x2121 entry1 for index0. Only corners/selected bands are opaque.
export function sampledBandIcon({ corner = true, unsafeLast = false, transparent = false, sampledRgb = [8481,8481,8481] } = {}) {
  const bytes = new Uint8Array(177), v = new DataView(bytes.buffer);
  const word = (p,x) => v.setUint16(p,x);
  word(4,0x8008); word(10,7); word(12,7); word(32,8); word(34,1); word(36,8);
  word(54,1); word(60,7); word(62,7);
  if (!transparent) { bytes[82]=corner?0x90:0x10; bytes[85]=0x80; }
  word(93,0x8000); word(95,2);
  const entries = [[7,65535,0,0],[0,...sampledRgb],[3,0,0,65535]];
  if (unsafeLast) { entries[2][0]=0; word(93,0); bytes.fill(1,121); bytes[88]=2; bytes[121+6*8+6]=7; }
  entries.forEach((e,i)=>e.forEach((x,j)=>word(97+i*8+j*2,x)));
  return bytes;
}
export function sampledBandInfo(tile=false) {
  const bytes=new Uint8Array(18);bytes[0]=3;bytes[1]=1;bytes[2]=tile?1:0;
  return bytes;
}
