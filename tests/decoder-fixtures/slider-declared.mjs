// Owned modern contract fixtures. Palette endpoints, opaque masks; no original
// acquisition, native pixel oracle, historical provider order or status claim.
import { forkOf } from '../resource-provenance/fixtures.mjs';
import { endpointIcon } from './slider-endpoints.mjs';
import { grooveIcon } from './slider-groove.mjs';
export const cinf = (id, bytes) => ({ type: 'cinf', id, data: Uint8Array.from(bytes) });
export const provider = (id, entries, complete = true) => ({ kind: 'raw-fork', id, complete, bytes: forkOf(entries) });
export function declaredEntries({ corner = 3, groove = [1, 1, 1, 0], pressed = groove, gate = true } = {}) {
  return [false, true].flatMap(vertical => {
    const gb = vertical ? -10116 : -10132;
    return [...(gate ? [cinf(gb, [corner])] : []), cinf(gb + 1, groove), cinf(gb + 2, pressed)];
  });
}
// The archive deliberately conflicts with declared corner and groove metadata.
// Its own gate is optional, and a group0 groove tests TR3/CF3 fallback.
export function declaredThemeFork({ corner = 5, gate = true, cross = 16, along = 7, thumb = true, wide = false } = {}) {
  return forkOf([false, true].flatMap(vertical => {
    const gb = vertical ? -10116 : -10132;
    const art = wide ? wideGroove(vertical) : grooveIcon(vertical);
    return [...[0, 1, 2].flatMap(tier => [
      { type: 'cicn', id: gb + tier, data: art },
      ...(tier === 0 && !gate ? [] : [cinf(gb + tier, tier === 0 ? [corner, 1, 1, 0] : [2, 1, 0, 0])]),
    ]), ...(thumb ? [{ type: 'cicn', id: gb + 3, data: endpointIcon(vertical, true, cross, along) }] : []),
    { type: 'cicn', id: gb - 11, data: art }, cinf(gb - 11, [2, 1, 0, 0])];
  }));
}
// 19px cross art with different rows: SL1 signed trunc puts its top at -1,
// so the 16px output sees source rows 1..16 (floor would expose 2..17).
export function wideGroove(vertical = false) {
  const width = vertical ? 19 : 7, height = vertical ? 7 : 19;
  const stride = Math.ceil(width / 8), table = 82 + stride * height;
  const colors = [[255,0,0], [0,255,0], [0,0,255]], bytes = new Uint8Array(table + 8 + 24 + width * height);
  const v = new DataView(bytes.buffer), word = (p,n) => v.setUint16(p,n);
  word(4, 0x8000 | width); word(10,height); word(12,width); word(32,8); word(34,1); word(36,8);
  word(54,stride); word(60,height); word(62,width); bytes.fill(255,82,table); word(table+6,2);
  colors.forEach((rgb,i)=>{word(table+8+i*8,i);rgb.forEach((c,j)=>word(table+10+i*8+j*2,c*257));});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes[table+32+y*width+x]=(vertical?x:y)%3;
  return bytes;
}
