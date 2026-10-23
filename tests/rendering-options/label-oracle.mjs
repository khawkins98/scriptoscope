// Independent TEST ONLY oracle. push-button.md §5 + declared browser-provider
// inputs; bevel keeps control-font-size.md's separate legacy compatibility policy.
// Browser glyphs/metrics are modern compatibility inputs, not native font truth.
export function labelOracle(family, label, fontSize, width, height, inset = 0, fillText = CanvasRenderingContext2D.prototype.fillText) {
  const canvas = document.createElement('canvas');
  // Guard pixels make ink outside the declared face observable, rather than
  // silently losing it at the mask canvas boundary.
  const guard = 32;
  canvas.width = width + guard * 2; canvas.height = height + guard * 2;
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px Chicago, "Charcoal", Geneva, sans-serif`;
  const metric = ctx.measureText(label), advance = Math.ceil(metric.width);
  const ascent = Math.ceil(metric.fontBoundingBoxAscent ?? metric.actualBoundingBoxAscent);
  const descent = Math.ceil(metric.fontBoundingBoxDescent ?? metric.actualBoundingBoxDescent);
  const glyphHeight = Math.ceil(fontSize * 1.3);
  const push = family === 'composeButton' || family === 'push';
  const x = push ? Math.trunc((width - advance) / 2) : Math.round((width - Math.max(1, advance)) / 2);
  const baseline = push
    ? height - inset - Math.trunc((height - inset * 2 + 1 - ascent - descent) / 2) - descent - (ascent + descent < 13 ? 1 : 0)
    : Math.round((height - glyphHeight) / 2) + Math.round(glyphHeight / 2);
  ctx.textBaseline = push ? 'alphabetic' : 'middle'; ctx.fillStyle = '#000';
  fillText.call(ctx, label, guard + x, guard + baseline);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = (x, y) => data[((y + guard) * canvas.width + x + guard) * 4 + 3] ?? 0;
  const foreground = [], emboss = []; let clippedInk = 0;
  for (let y = -guard; y < height + guard; y++) for (let x = -guard; x < width + guard; x++) {
    const a = alpha(x, y);
    if (a && (x < inset || x >= width - inset || y < inset || y >= height - inset)) clippedInk++;
    if (a === 255) foreground.push([x, y]);
    else if (a === 0 && x > -guard && y > -guard && alpha(x - 1, y - 1) === 255) emboss.push([x, y]);
  }
  return { canvas, x, baseline, textBaseline: ctx.textBaseline, advance, ascent, descent, foreground, emboss, clippedInk };
}

// Compare geometry independently of the per-pixel preservation assertion.
export function inkBounds(points) {
  return points.length ? [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] : null;
}
export function foregroundBounds(output, rgba) {
  const points = [];
  for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++)
    if (output.getPixel(x, y).every((value, i) => value === rgba[i])) points.push([x, y]);
  return inkBounds(points);
}
