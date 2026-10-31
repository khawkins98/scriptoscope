// Bonn's scheme icon: the picture Kaleidoscope's scheme picker shows.
//
//   ICN# icl8 icl4 ics# ics8 ics4  -16455  "Kaleidoscope Scheme Icon"
//
// One cherry blossom, the flower of the close box and the branch along the
// title bar, seen face on: five notched petals lit from the upper left, pale
// creases between them, a yellow heart with a red eye, and the frame's
// near-black outline. Blossom pinks, outline and city colours from
// palette.mjs, on whole pixels. Each size is drawn at its own scale (the
// 16×16 one is not a scaled-down 32×32). Original art: no coat of arms, logo
// or traced photo.
import { Raster } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { C } from './palette.mjs';

const A = C.active;

// Per size: centre, petal centre distance d and radius rp, notch depth, heart
// radius. Petal 0 points straight up.
const SPEC = {
  32: { c: 16, d: 8.5, rp: 6.8, notch: 2.2, heart: 2.9 },
  16: { c: 8, d: 4, rp: 3.6, notch: 0, heart: 1.5 },
};

export function schemeIcon(size) {
  const s = SPEC[size];
  if (!s) throw new Error(`Bonn icon: no spec for ${size}×${size}`);
  const { c, d, rp, notch, heart } = s;
  const petals = [0, 1, 2, 3, 4].map((k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return { a, x: c + d * Math.cos(a), y: c + d * Math.sin(a) };
  });
  // Which petal a pixel belongs to (the nearest petal centre that covers it), or -1.
  const petalOf = (px, py) => {
    let best = -1, bestD = Infinity;
    petals.forEach((p, k) => {
      const dd = Math.hypot(px - p.x, py - p.y);
      if (dd > rp || dd >= bestD) return;
      // The notch: a V cut into the petal's outer tip.
      if (notch) {
        const along = (px - c) * Math.cos(p.a) + (py - c) * Math.sin(p.a);
        const across = Math.abs(-(px - c) * Math.sin(p.a) + (py - c) * Math.cos(p.a));
        if (along > d + rp - notch + across * 1.1) return;
      }
      best = k; bestD = dd;
    });
    if (best < 0 && Math.hypot(px - c, py - c) <= d - 1) return 0; // fill the middle
    return best;
  };
  const r = new Raster(size, size);
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? -1 : petalOf(x + 0.5, y + 0.5));
  const inside = (x, y) => at(x, y) >= 0;
  const edge = (x, y) => inside(x, y) && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!inside(x, y)) continue;
    // Outline ring, then a lit ring where the petal faces up or left and a
    // shaded ring where it faces down or right (light from the upper left).
    let col = A.blossom;
    if (edge(x, y)) col = A.outline;
    else if (edge(x, y - 1) || edge(x - 1, y)) col = A.blossomHi;
    else if (edge(x, y + 1) || edge(x + 1, y)) col = A.blossomLo;
    r.set(x, y, col);
  }
  // Creases between neighbouring petals, from the heart outwards.
  for (let k = 0; k < 5; k++) {
    const a = petals[k].a + Math.PI / 5;
    for (let t = heart + 0.5; t < d - 1; t += 0.5) {
      const x = Math.floor(c + t * Math.cos(a)), y = Math.floor(c + t * Math.sin(a));
      if (r.get(x, y) && at(x, y) >= 0) r.set(x, y, A.blossomLo);
    }
  }
  // The heart: yellow, with a red eye (city colours).
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dd = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    if (dd <= heart) r.set(x, y, dd <= heart * 0.45 ? A.red : A.yellow);
  }
  return r;
}

export function build(add) {
  for (const res of encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), name: 'Kaleidoscope Scheme Icon', dither4: false })) {
    add(res.type, res.id, res.data, res.name);
  }
}
