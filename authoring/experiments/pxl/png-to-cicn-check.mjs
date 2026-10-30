// Check that PNGs (e.g. claude-pxl output in out/sprites/) survive the authoring
// pipeline unchanged: PNG → Raster → encodeCicn → runtime decodeCicn.
// Usage: node authoring/experiments/pxl/png-to-cicn-check.mjs path/to/*.png
import { readFileSync } from 'node:fs';
import { decodePng } from '../../../scripts/lib/png-decode.mjs';
import { Raster, encodeCicn } from '../../../tools/theme-author/index.js';
import { srgbChannelToMac } from '../../../tools/theme-author/color.js';
import { decodeCicn } from '../../../tools/theme-loader/decoders/cicn.js';

for (const file of process.argv.slice(2)) {
  const { width, height, rgba } = decodePng(readFileSync(file));
  const { raster, snapped } = Raster.fromRgba(width, height, rgba);
  const decoded = decodeCicn(encodeCicn(raster));
  // Without the loader's display gamma, the decoder returns the stored values,
  // which should equal the encoder's gamma-inverted version of each source pixel.
  let mismatches = 0;
  for (let i = 0; i < width * height; i++) {
    const opaque = raster.rgba[i * 4 + 3] === 255;
    if (opaque !== decoded.rgba[i * 4 + 3] > 0) { mismatches++; continue; }
    if (opaque) for (let k = 0; k < 3; k++) if (decoded.rgba[i * 4 + k] !== srgbChannelToMac(raster.rgba[i * 4 + k])) mismatches++;
  }
  const name = file.split('/').pop();
  console.log(`${name} ${width}x${height} → cicn ${decoded.debug.pixelSize}-bit, ${decoded.debug.colorCount} colours, ` +
    `${snapped ? `${snapped} soft-alpha px snapped, ` : ''}${mismatches ? `MISMATCH ${mismatches}` : 'round-trip exact'}`);
}
