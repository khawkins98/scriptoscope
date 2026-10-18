// Color sampling is deliberately separate from raster decoding. kDEF 2.3.1
// fc5c -> 10702 reads a serialized palette with its own search/shortcut rules;
// it neither consults ctFlags nor substitutes transparent RGB with black.
// See docs/spec/control-text-colors.md for addresses and unsupported devices.
import { macRgbToSrgb } from './mac-gamma.js';

/** Transient sampler: never placed in a returned manifest or loaded theme. */
export function makeKdefColorSampler(indices, width, height, entries) {
  return (x, y) => {
    // The original reads local offsets without bounds checks or subtracting
    // PixMap.bounds. Reject unsafe coordinates instead of emulating memory reads.
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return null;
    const index = indices[y * width + x];
    let position = index;
    if (!(index < entries.length && entries[index].value === index) && entries[entries.length - 1]?.value !== 0) {
      position = entries.length - 1;
      while (position >= 0 && entries[position].value !== index) position--;
      if (position < 0) position = 0; // 10744–10748, not raster decoder's black policy
    }
    const color = entries[position];
    if (!color) return null; // positional shortcut outside actual table: unknown
    return [color.r, color.g, color.b];
  };
}

/** Pair only the actual decoded cicn and consumed same-ID cinf. */
export function controlColorSamples(sample, cinf) {
  if (!sample || !cinf) return null;
  const read = point => {
    const rgb16 = sample(point.x, point.y);
    return rgb16 ? Object.freeze({ rgb16: Object.freeze(rgb16),
      displayRgb: Object.freeze(macRgbToSrgb(rgb16.map(value => value >> 8))) }) : null;
  };
  const background = read(cinf.bgPixel), text = read(cinf.textPixel);
  const absent = cinf.embossPixel.x === 0 && cinf.embossPixel.y === 0;
  const emboss = absent ? null : read(cinf.embossPixel);
  const embossDecision = absent ? 'absent-coordinates' : !emboss ? 'unknown'
    : emboss.rgb16[0] === 0x1234 ? 'sentinel'
    : !background ? 'unknown'
    : emboss.rgb16.every((value, i) => value === background.rgb16[i]) ? 'same-as-background' : 'present';
  return Object.freeze({ model: 'kdef-2.3.1-color', displayPolicy: 'mac-1.8-to-2.2-high-byte',
    background, text, emboss, embossDecision });
}
