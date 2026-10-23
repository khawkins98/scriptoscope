// Independent serialized indexed8 inputs. No production decoder/selector,
// engine table, renderer formula, source-object branding or expected raster import.
import {forkOf} from '../resource-provenance/fixtures.mjs';
const unique = values => [...new Map(values.map(rgb => [rgb.join(','), rgb])).values()];
export function indexedCicn(rows) {
  const h=rows.length,w=rows[0].length,palette=unique(rows.flat().map(p=>p.slice(0,3)));
  if(palette.length>256)throw Error('Fixture needs an explicit lossless <=256 colour palette');
  const stride=(w+1)&~1,maskStride=Math.ceil(w/16)*2,plane=maskStride*h,table=82+plane*2;
  const bytes=new Uint8Array(table+8+palette.length*8+stride*h),v=new DataView(bytes.buffer),word=(p,n)=>v.setUint16(p,n);
  word(4,0x8000|stride);word(10,h);word(12,w);word(32,8);word(34,1);word(36,8);
  for(const off of [54,68]){word(off,maskStride);word(off+6,h);word(off+8,w);}
  word(table+6,palette.length-1);
  palette.forEach((rgb,i)=>{word(table+8+i*8,i);rgb.forEach((c,j)=>word(table+10+i*8+j*2,c*257));});
  rows.forEach((row,y)=>row.forEach((p,x)=>{if(![0,255].includes(p[3]))throw Error('Indexed fixture mask must be binary');if(p[3])bytes[82+y*maskStride+(x>>3)]|=0x80>>(x&7);bytes[table+8+palette.length*8+y*stride+x]=palette.findIndex(c=>c.every((n,j)=>n===p[j]));}));
  return bytes;
}
export function indexedPattern(rows) {
  const h=rows.length,w=rows[0].length,palette=unique(rows.flat().map(p=>p.slice(0,3))),stride=(w+1)&~1,table=78+stride*h;
  if(palette.length>256)throw Error('Fixture palette overflow');
  const bytes=new Uint8Array(table+8+palette.length*8),v=new DataView(bytes.buffer),word=(p,n)=>v.setUint16(p,n);
  word(0,1);v.setUint32(2,28);v.setUint32(6,78);word(32,0x8000|stride);word(38,h);word(40,w);word(60,8);word(62,1);word(64,8);v.setUint32(70,table);word(table+6,palette.length-1);
  palette.forEach((rgb,i)=>{word(table+8+i*8,i);rgb.forEach((c,j)=>word(table+10+i*8+j*2,c*257));});
  rows.forEach((row,y)=>row.forEach((p,x)=>{if(p[3]!==255)throw Error('Indexed pattern fixture must be opaque');bytes[78+y*stride+x]=palette.findIndex(c=>c.every((n,j)=>n===p[j]));}));return bytes;
}
export function rawCinf({corner,side,tile=false,mode=0,resourceId=0,background=[0,0],text=[0,0]}) {
  const bytes=new Uint8Array(18),v=new DataView(bytes.buffer);bytes.set([corner,side,Number(tile),mode]);v.setInt16(4,resourceId);
  for(const [p,[x,y]]of [[6,background],[10,text]]){v.setInt16(p,y);v.setInt16(p+2,x);}return bytes;
}
export const plane=(w,h,color=[0,0,0,0])=>Array.from({length:h},()=>Array.from({length:w},()=>[...color]));
export async function loadOwnedControlFixture(api,{faces,patterns=[],paletteColors=[]}) {
  const colors=unique([[0,0,0],[255,255,255],...paletteColors,...faces.flatMap(f=>f.pixels.flat().map(p=>p.slice(0,3))),...patterns.flatMap(f=>f.pixels.flat().map(p=>p.slice(0,3)))]);
  if(colors.length>256)throw Error('Declare a bounded indexed fixture; do not silently quantize');
  const palette=colors.map((rgb,index)=>({index,rgb16:rgb.map(n=>n*257)}));
  // Explicit modern identity profile preserves the old hand-written display
  // literals, without applying the default gamma policy to synthetic PNG colours.
  const displayProfile=await api.prepareDisplayProfile({version:1,conditions:{kind:'synthetic-control-fixture-identity'},evidence:[{sha256:'0'.repeat(64),description:'Independent literal synthetic display bytes; no native measurement'}],devicePalette:palette,mappings:palette.map(p=>({rgb16:p.rgb16,deviceIndex:p.index,deviceRgb16:p.rgb16})),producer:{model:'rgb16-high-byte-table',channels:Array.from({length:3},()=>Array.from({length:256},(_,i)=>i))}});
  const records=[...faces.flatMap(f=>[{type:'cicn',id:f.id,name:f.name,data:indexedCicn(f.pixels)},...(f.cinf?[{type:'cinf',id:f.id,data:rawCinf(f.cinf)}]:[])]),...patterns.map(p=>({type:'ppat',id:p.id,name:p.name,data:indexedPattern(p.pixels)}))];
  return api.loadKaleidoscopeScheme(forkOf(records),{provenance:true,displayProfile});
}
export async function managedFixture(api,{pressedHeight=7}={}) {
  const faces=[[-10239,'normal',0],[-10238,'pressed',1],[-10240,'inactive',0],[-10166,'bevel',0]].map(([id,name,pattern])=>({id,name,pixels:plane(7,name==='pressed'?pressedHeight:7),cinf:{corner:3,side:1,resourceId:pattern}}));
  const ring=plane(9,9);ring[0][0]=[199,33,77,255];faces.push({id:-10231,name:'ring',pixels:ring,cinf:{corner:1,side:1}});
  const patterns=[0,1].map(id=>({id,name:String(id),pixels:Array.from({length:3},(_,y)=>Array.from({length:5},(_,x)=>id?[0,(y*5+x+1)*10,0,255]:[(y*5+x+1)*10,0,0,255]))}));
  return loadOwnedControlFixture(api,{faces,patterns});
}
