// Independent reverse opaque-writer model. Original kDEF0 source ranges and
// limitations: docs/spec/control-border-boundaries.md. No production imports.
export const boundaryVariants = [
  ...['active', 'pressed', 'inactive'].map(state => ({ family: 'push', state })),
  ...[false, true].flatMap(small => [false, true].flatMap(on =>
    ['active', 'pressed', 'inactive'].map(state => ({ family: 'bevel', small, on, state })))),
];
export function boundarySizes({ width, height, corner, tile }, family) {
  const minimumWidth = family === 'push' ? 24 : 16;
  const spans = tile ? [width - 2 * corner, height - 2 * corner] : [1, 1];
  const axes = spans.map((span, axis) => [...new Set([0, 1, span - 1, span, span + 1, 2 * span + 1])]
    .filter(middle => middle >= 0).sort((a, b) => a - b).map(middle => ({ middle, size: 2 * corner + middle,
      reachable: 2 * corner + middle >= (axis === 0 ? minimumWidth : 1) })));
  const widths = [...new Set([minimumWidth, ...axes[0].filter(v => v.reachable).map(v => v.size)])].sort((a, b) => a - b);
  const heights = [...new Set([Math.max(1, 2 * corner + 1), ...axes[1].filter(v => v.reachable).map(v => v.size)])].sort((a, b) => a - b);
  return { spans, axes, minimumWidth, sizes: widths.flatMap(w => heights.map(h => [w, h])) };
}

/** Decide one destination pixel by searching LATEST to EARLIEST original
 * painter, never by replaying the production region array. Null leaves body / 
 * all-transparent border unassessed. All coordinates are face-local. */
export function borderWriter(input, destination, x, y, alphaAt) {
  const { width: w, height: h, corner: c, side: s, tile } = input;
  const { width: W, height: H, clip = [0, 0, W, H] } = destination;
  if (x < 0 || y < 0 || x >= W || y >= H || x < clip[0] || y < clip[1] || x >= clip[0] + clip[2] || y >= clip[1] + clip[3]) return null;
  const cw = Math.min(c, w), ch = Math.min(c, h), sw = Math.min(s, w), sh = Math.min(s, h);
  const sxSpan = tile ? w - 2 * c : c < w ? 1 : 0, sySpan = tile ? h - 2 * c : c < h ? 1 : 0;
  const candidate = (region, sx, sy, sourceW, sourceH, destinationW, destinationH) => {
    if (!alphaAt(sx, sy)) return null;
    const branch = sourceW === 1 && destinationW > 1 ? 'horizontal-lines'
      : sourceH === 1 && destinationH > 1 ? 'vertical-lines' : 'copy';
    // FEAE samples the OTHER source axis once, not arbitrary 2-D repeat.
    if ((branch === 'horizontal-lines' && sourceH !== destinationH)
      || (branch === 'vertical-lines' && sourceW !== destinationW)) throw new Error('Unknown unequal sampler axis');
    return { region, source: [sx, sy], branch };
  };
  let hit;
  // Right, left, bottom, BR, BL, top, TR, TL (reverse source call order).
  if (sySpan > 0 && H > 2 * c && y >= c && y < H - c) {
    const sy = c + (y - c) % sySpan;
    if (x >= W - sw && (hit = candidate(7, w - sw + x - (W - sw), sy, sw, sySpan, sw, H - 2 * c))) return hit;
    if (x < sw && (hit = candidate(6, x, sy, sw, sySpan, sw, H - 2 * c))) return hit;
  }
  if (sxSpan > 0 && W > 2 * c && x >= c && x < W - c && y >= H - sh
    && (hit = candidate(5, c + (x - c) % sxSpan, h - sh + y - (H - sh), sxSpan, sh, W - 2 * c, sh))) return hit;
  if (y >= H - ch) {
    if (x >= W - cw && (hit = candidate(4, w - cw + x - (W - cw), h - ch + y - (H - ch), cw, ch, cw, ch))) return hit;
    if (x < cw && (hit = candidate(3, x, h - ch + y - (H - ch), cw, ch, cw, ch))) return hit;
  }
  if (sxSpan > 0 && W > 2 * c && x >= c && x < W - c && y < sh
    && (hit = candidate(2, c + (x - c) % sxSpan, y, sxSpan, sh, W - 2 * c, sh))) return hit;
  if (y < ch) {
    if (x >= W - cw && (hit = candidate(1, w - cw + x - (W - cw), y, cw, ch, cw, ch))) return hit;
    if (x < cw && (hit = candidate(0, x, y, cw, ch, cw, ch))) return hit;
  }
  return null;
}

/** Conditional modern same-owner NULL, not an original Resource Manager claim.
 * Raw inventory must be complete at the caller. A present undecoded/ambiguous
 * ppat cannot be converted into a source-backed NULL by absence from a manifest. */
export function admitSolidBody(input) {
  const { request, anchor, sample, width, height, rawPatternOccurrences, lookup, sampleModel, displayPolicy, unavailableReason } = input;
  const triple = (v, max) => Array.isArray(v) && v.length === 3 && Array.from(v).every(n => Number.isInteger(n) && n >= 0 && n <= max);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || lookup !== 'declared-same-owner-null' || !request || !Number.isInteger(request.mode) || request.mode < 0 || request.mode > 255 || request.mode === 5
    || !Number.isInteger(request.resourceId) || request.resourceId < -32768 || request.resourceId > 32767
    || !Array.isArray(rawPatternOccurrences) || rawPatternOccurrences.length !== 0
    || !Array.isArray(anchor) || anchor.length !== 2 || !Array.from(anchor).every(Number.isInteger)
    || anchor[0] < 0 || anchor[1] < 0 || anchor[0] >= width || anchor[1] >= height
    || sampleModel !== 'kdef-2.3.1-color' || displayPolicy !== 'mac-1.8-to-2.2-high-byte' || unavailableReason
    || !triple(sample?.rgb16, 65535) || !triple(sample?.displayRgb, 255)) return null;
  // Original background sampling ignores the source mask. Raster alpha/RGB
  // are deliberately NOT inputs to this decision or the resulting body color.
  return { rgb16: [...sample.rgb16], displayRgb: [...sample.displayRgb] };
}

/** Applied only after no opaque border writer survives. Coordinates and union
 * derive independently from10b72–10bb8; initial is explicit modern transparent
 * allocation, never inferred original port/mask truth. */
export function solidBodyOrInitial(input, destination, x, y, background) {
  const { corner: c, side: s } = input, { width: W, height: H } = destination;
  const inside = (x >= c && x < W - c && y >= s && y < H - s)
    || (x >= s && x < W - s && y >= c && y < H - c);
  return inside ? { kind: 'body', rgba: [...background.displayRgb, 255] }
    : { kind: 'initial', rgba: [0, 0, 0, 0] };
}
