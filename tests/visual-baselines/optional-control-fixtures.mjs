// Caller-owned inputs and expectations from push-button §5, not runtime rasters.
export function labelStrike(size = 12) {
  return {
    version: 1, strikeSize: size,
    metrics: size === 12 ? { ascent: 8, descent: 2, leading: 1 } : { ascent: 11, descent: 3, leading: 1 },
    provenance: { kind: 'caller-declared', description: 'Optional visual contract asymmetric Ag glyphs' },
    glyphs: [
      { character: 'A', advance: 6, bearingX: -1, bearingY: -7, width: 4, height: 7,
        mask: [0,1,0,0, 1,0,1,0, 1,0,1,0, 1,1,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
      { character: 'g', advance: 7, bearingX: 2, bearingY: -3, width: 3, height: 6,
        mask: [1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,0,1, 0,1,0] },
    ],
  };
}

export function labelInk(width, height, strike) {
  const { ascent, descent, leading } = strike.metrics;
  const lineHeight = ascent + descent + leading, faceHeight = height - 8;
  const advance = strike.glyphs.reduce((n, glyph) => n + glyph.advance, 0);
  let pen = 4 + Math.trunc((width - 8 - advance) / 2);
  const baseline = 4 + faceHeight - Math.trunc((faceHeight + 1 - lineHeight) / 2)
    - leading - descent - (lineHeight < 13 ? 1 : 0);
  const points = [];
  for (const glyph of strike.glyphs) {
    for (let y = 0; y < glyph.height; y++) for (let x = 0; x < glyph.width; x++) {
      const px = pen + glyph.bearingX + x, py = baseline + glyph.bearingY + y;
      if (glyph.mask[y * glyph.width + x] && px >= 4 && px < width - 4 && py >= 4 && py < height - 4) points.push([px, py]);
    }
    pen += glyph.advance;
  }
  return points;
}

// Public raw cinf header: c, s, tile, mode, signed background ID, then
// background/text/emboss Points (big-endian vertical,horizontal).
export function ringCinf(corner, side, tile) {
  return [corner, side, Number(tile), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}
