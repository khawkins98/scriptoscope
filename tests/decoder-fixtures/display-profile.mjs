// Deliberately joint, non-separable synthetic mappings. Independent expectations
// use the literal output triples below, not a renderer or display LUT.
export function syntheticDisplayProfile() {
  const rows = [
    [[0,0,0],[0,0,0]], [[65535,65535,65535],[65535,65535,65535]],
    [[0,0,65535],[0x0707,0x0909,0x0b0b]],
    [[65535,0,0],[0x1414,0x1e1e,0x2828]],
    [[0x2121,0x2121,0x2121],[0x5a5a,0x6464,0x6e6e]],
    [[0x2122,0x2121,0x2121],[0x7878,0x8282,0x8c8c]],
  ];
  return { version:1,conditions:{kind:'synthetic-independent-literal'},
    evidence:[{sha256:'0'.repeat(64),description:'Synthetic data; no historical measurement'}],
    devicePalette:rows.map(([,rgb16],index)=>({index,rgb16})),
    mappings:rows.map(([rgb16,deviceRgb16],deviceIndex)=>({rgb16,deviceIndex,deviceRgb16})),
    producer:{model:'rgb16-high-byte-table',channels:Array.from({length:3},()=>Array.from({length:256},(_,i)=>i))} };
}
// 1x1 indexed full-color ppat, exact RGB16 and authoritative table at80.
export function profilePpat(rgb16=[0x2122,0x2121,0x2121]) {
  const a=new Uint8Array(96),v=new DataView(a.buffer);v.setUint16(0,1);v.setUint32(2,28);v.setUint32(6,78);
  v.setUint16(32,0x8002);v.setUint16(38,1);v.setUint16(40,1);v.setUint16(60,8);v.setUint16(62,1);v.setUint16(64,8);v.setUint32(70,80);
  rgb16.forEach((c,i)=>v.setUint16(90+i*2,c));return a;
}
export function profileClut() {
  const a=new Uint8Array(24),v=new DataView(a.buffer);v.setUint16(6,1);
  v.setUint16(8,0);[0x2122,0x2121,0x2121].forEach((c,i)=>v.setUint16(10+i*2,c));
  v.setUint16(16,2);[123,456,789].forEach((c,i)=>v.setUint16(18+i*2,c)); // omitted text part never realized
  return a;
}
