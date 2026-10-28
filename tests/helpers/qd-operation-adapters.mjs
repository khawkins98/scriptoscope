// Retain scalar tile formula cases through the current production raster operation.
import './registerTs.mjs';
import { tileBlit } from '../../src/raster.ts';
import { rect } from '../../src/engine/qd/rect.ts';
export function tileSourceOffset(k, sw, dw, direction) {
  const src = { width: sw, height: 1, data: new Uint8ClampedArray(sw * 4) };
  for (let x = 0; x < sw; x++) src.data.set([x + 1, 0, 0, 255], x * 4);
  const dst = { width: dw, height: 1, data: new Uint8ClampedArray(dw * 4) };
  tileBlit(dst, src, rect(0, 0, 1, sw), rect(0, 0, 1, dw), direction, 'copyBits');
  return dst.data[k * 4] - 1;
}
