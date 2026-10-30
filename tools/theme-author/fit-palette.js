// fitPalette: keep an image inside the 256-colour limit (promoted from the Bonn
// scheme, which hit 290 colours on its first build). A cicn is indexed (256 colours at most, encode-cicn.js),
// and a big frame with smooth (anti-aliased) shapes, gradients and a dithered
// river easily makes more. `fitPalette` merges the rarest colours into their
// nearest remaining neighbour until the image fits. Hidden swatches (alpha 1)
// are never changed, so sampled colours stay exact; frequent colours (flat
// fills, gradient rows) survive because rare ones (edge blends) go first.
//
// Rows that must stay one colour per row (1px growers) keep that property:
// a merge maps a colour to one colour everywhere.
const key = (r, g, b) => (r << 16) | (g << 8) | b;

export function fitPalette(raster, max = 254) {
  const { rgba } = raster;
  const count = new Map(), locked = new Set();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const k = key(rgba[i], rgba[i + 1], rgba[i + 2]);
    count.set(k, (count.get(k) ?? 0) + 1);
    if (rgba[i + 3] < 128) locked.add(k);
  }
  if (count.size <= max) return raster;
  const rgb = (k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255];
  const dist = (a, b) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b); return 2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2; };
  const map = new Map();
  const alive = new Set(count.keys());
  const order = [...count.keys()].filter((k) => !locked.has(k)).sort((a, b) => count.get(a) - count.get(b));
  for (const k of order) {
    if (alive.size <= max) break;
    alive.delete(k);
    let best = null, bd = Infinity;
    for (const o of alive) { const d = dist(k, o); if (d < bd) { bd = d; best = o; } }
    map.set(k, best);
    count.set(best, count.get(best) + count.get(k));
  }
  const resolve = (k) => { while (map.has(k)) k = map.get(k); return k; };
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const k = key(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (!map.has(k)) continue;
    const [r, g, b] = rgb(resolve(k));
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b;
  }
  return raster;
}

/** Number of distinct opaque or swatch colours in a raster. */
export const colorCount = (raster) => {
  const s = new Set();
  for (let i = 0; i < raster.rgba.length; i += 4) if (raster.rgba[i + 3]) s.add(key(raster.rgba[i], raster.rgba[i + 1], raster.rgba[i + 2]));
  return s.size;
};
