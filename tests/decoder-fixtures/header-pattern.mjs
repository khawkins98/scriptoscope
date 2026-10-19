import { headerSurfaceIcon, headerSurfaceInfo } from './header-surface.mjs';

// Literal 4×2 full-color PixPat, positional palette A..H = RGB bit triples.
// Header28 + PixMap50 + pixels8 + ColorTable72. No production encoder.
export function headerPatternBytes() {
  const bytes = new Uint8Array(158), v = new DataView(bytes.buffer);
  v.setUint16(0,1); v.setUint32(2,28); v.setUint32(6,78);
  v.setUint16(32,0x8004); v.setUint16(38,2); v.setUint16(40,4);
  v.setUint16(60,8); v.setUint16(62,1); v.setUint16(64,8); v.setUint32(70,86);
  bytes.set([0,1,2,3,4,5,6,7],78); v.setUint16(92,7);
  for(let i=0;i<8;i++) {
    v.setUint16(94+i*8,i);
    for(let c=0;c<3;c++) v.setUint16(96+i*8+c*2,(i>>c&1)*65535);
  }
  return bytes;
}
export function headerPatternFace() {
  const bytes=headerSurfaceIcon(); bytes.fill(0,82,89); bytes[84]=0x10;
  // Only source(3,2) is opaque gray; repeated top band overwrites body at3,6 (destination band ends before x9).
  return bytes;
}
export function headerPatternInfo(mode=0) {
  const bytes=headerSurfaceInfo(); bytes[1]=3; bytes[2]=1; bytes[3]=mode;
  return bytes; // c2/s3, ppat ID0, hidden/opaque BG is irrelevant to pattern fill.
}
const empty='...........';
// D=(-5,7), R=(1,-2). At local q, sample is (D+q-P+R) modulo(4,2).
// P uses exclusive ORIGINAL paint-Rect edges, not either inset or clip origin.
// Union: x2..8/y3..5 plus x3..7/y2..6. @ is the later gray border overwrite.
export const headerPatternRows = {
  0:[empty,empty,'...@EF@H...','..CDABCDA..','..GHEFGHE..','..CDABCDA..','...HEFGH...',empty,empty],
  1:[empty,empty,'...@BC@A...','..HEFGHEF..','..DABCDAB..','..HEFGHEF..','...ABCDA...',empty,empty],
  2:[empty,empty,'...@CD@B...','..EFGHEFG..','..ABCDABC..','..EFGHEFG..','...BCDAB...',empty,empty],
  3:[empty,empty,'...@FG@E...','..DABCDAB..','..HEFGHEF..','..DABCDAB..','...EFGHE...',empty,empty],
  4:[empty,empty,'...@GH@F...','..ABCDABC..','..EFGHEFG..','..ABCDABC..','...FGHEF...',empty,empty],
};
// List-view extends bottom9→10 before BL/BR phase selection and inset geometry;
// clip local x2..8/y2..6 retains the wider row6 and retains only the selected port rectangle.
export const headerPatternListRows=[empty,empty,'...@CD@B...','..EFGHEFG..','..ABCDABC..','..EFGHEFG..','..ABCDABC..',empty,empty];
export const headerPatternColors=Object.fromEntries(Array.from({length:8},(_,i)=>[String.fromCharCode(65+i),[(i&1)*255,(i>>1&1)*255,(i>>2&1)*255,255]]));
headerPatternColors['@']=[48,48,48,255]; headerPatternColors['.']=[0,0,0,0];
