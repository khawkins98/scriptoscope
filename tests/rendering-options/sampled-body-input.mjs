// Independent refinement of the frozen7x7 sampled-band fixture. Only the
// mask-clear background source pixel gains its own unique green ColorSpec.
import {sampledBandIcon,sampledBandInfo} from '../decoder-fixtures/sampled-bands.mjs';
export function greenBodySampleIcon(){
 const original=sampledBandIcon(),bytes=new Uint8Array(original.length+8),v=new DataView(bytes.buffer);
 bytes.set(original.subarray(0,121));bytes.set(original.subarray(121),129);
 v.setUint16(95,3); // Four logical ColorSpecs, preserving all original entries.
 [1,0,65535,0].forEach((value,i)=>v.setUint16(121+i*2,value));
 bytes[129+6*8+6]=1; // Source(6,6), mask clear; value1 uniquely means green.
 return bytes;
}
export function greenBodySampleInfo(){const bytes=sampledBandInfo(),v=new DataView(bytes.buffer);bytes[1]=4;v.setInt16(6,6);v.setInt16(8,6);return bytes;}
