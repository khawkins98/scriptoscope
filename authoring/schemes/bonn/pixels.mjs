// Whole-pixel shape helpers shared by Bonn's controls: a rounded rectangle or
// disc as a hard mask (no blended edges, docs/authoring-visual-design.md §2.2),
// painted as a 1px outline, a lit ring on the top and left, a shaded ring on
// the bottom and right, and a flat face. Light from the upper left.

/** Corner cuts for radius R: how many pixels each of the first rows loses (R 4 → [2, 1]). */
export function cuts(R) {
  const out = [];
  for (let row = 0; row < R; row++) {
    const dy = R - row - 0.5;
    const c = Math.round(R - Math.sqrt(Math.max(0, R * R - dy * dy)));
    if (c <= 0) break;
    out.push(c);
  }
  return out;
}

/** Mask of a w×h rounded rectangle with corner radius R; `corners` picks which are rounded. */
export function roundRect(w, h, R, corners = 'tl tr bl br') {
  const c = cuts(R);
  return (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const top = y < c.length, bottom = h - 1 - y < c.length;
    const left = x < Math.max(0, ...c), right = w - 1 - x < Math.max(0, ...c);
    if (top && left && corners.includes('tl') && x < c[y]) return false;
    if (top && right && corners.includes('tr') && w - 1 - x < c[y]) return false;
    if (bottom && left && corners.includes('bl') && x < c[h - 1 - y]) return false;
    if (bottom && right && corners.includes('br') && w - 1 - x < c[h - 1 - y]) return false;
    return true;
  };
}

/** Mask of a disc of diameter d (pixel-centre test). */
export function disc(d) {
  const r = d / 2;
  return (x, y) => (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r + 0.3;
}

/**
 * Paint `mask` (in local coordinates, w×h) at (x0, y0): outline on the edge
 * ring, `hi` on the next ring where it faces up or left, `lo` where it faces
 * down or right, `face` inside. Any colour may be null to skip that ring
 * (it then takes the next one's colour).
 */
export function bevel(r, x0, y0, w, h, mask, { outline, hi, lo, face }) {
  const edge = (x, y) => mask(x, y) && !(mask(x - 1, y) && mask(x + 1, y) && mask(x, y - 1) && mask(x, y + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask(x, y)) continue;
    let c = face;
    if (edge(x, y)) c = outline ?? face;
    else if (hi && (edge(x, y - 1) || edge(x - 1, y))) c = hi;
    else if (lo && (edge(x, y + 1) || edge(x + 1, y))) c = lo;
    r.set(x0 + x, y0 + y, c);
  }
  return r;
}
