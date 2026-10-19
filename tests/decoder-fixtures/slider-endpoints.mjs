import {forkOf} from '../resource-provenance/fixtures.mjs';
// Owned opaque indexed8 artwork: cyan track; blank/normal/pressed/disabled
// thumb cells black/red/green/blue. The 7px axis and 16px cross are independent
// of both track cinf.corner=1 and the external group-base corner=3.
export const endpointColors = [[0,0,0,255],[255,0,0,255],[0,255,0,255],[0,0,255,255],[0,255,255,255]];
export function endpointIcon(vertical=false, thumb=false, cross=16, along=7) {
  const width=vertical?(thumb?cross*4:3):along,height=vertical?along:(thumb?cross*4:3);
  const stride=Math.ceil(width/8),table=82+stride*height;
  const bytes=new Uint8Array(table+8+40+width*height),v=new DataView(bytes.buffer),word=(p,n)=>v.setUint16(p,n);
  word(4,0x8000|width);word(10,height);word(12,width);word(32,8);word(34,1);word(36,8);
  word(54,stride);word(60,height);word(62,width);bytes.fill(255,82,table);word(table+6,4);
  endpointColors.forEach((rgb,i)=>{word(table+8+i*8,i);rgb.slice(0,3).forEach((c,j)=>word(table+10+i*8+j*2,c*257));});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes[table+48+y*width+x]=thumb?Math.floor((vertical?x:y)/cross):4;
  return bytes;
}
export function endpointFork({cross=16,thumb=true,along=7}={}) {
  const entries=[];
  for(const vertical of [false,true]) {
    const id=vertical?-10115:-10131;
    entries.push({type:'cicn',id,data:endpointIcon(vertical)},{type:'cinf',id,data:new Uint8Array([1,1,1,...Array(15).fill(0)])});
    if(thumb)entries.push({type:'cicn',id:id+2,data:endpointIcon(vertical,true,cross,along)});
  }
  return forkOf(entries);
}
export function endpointProvider(corner=3, secondary=false) {
  return forkOf([false,true].map(vertical=>({type:'cinf',id:(vertical?-10116:-10132)-(secondary?12:0),data:new Uint8Array([corner])})));
}
