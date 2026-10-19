import { PixelBuffer } from './pixelBuffer.js';
import { controlPointVisible, type ControlCompositionSnapshot, type ControlRect } from './controlComposition.js';
import { bitmapPushPen, type BitmapGlyphRun, type BitmapTextPaint } from './preparedBitmapFont.js';

/** CSS color decoding only: this path never measures or rasterizes a browser font. */
function color(value: string): readonly [number, number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.canvas.width = ctx.canvas.height = 1;
  ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
  const p = ctx.getImageData(0, 0, 1, 1).data;
  return [p[0]!, p[1]!, p[2]!, p[3]!];
}
export function paintBitmapText(out: PixelBuffer, run: BitmapGlyphRun, context: ControlCompositionSnapshot,
  foreground: string, emboss: string | null): BitmapTextPaint | null {
  const [ox, oy] = context.controlOrigin;
  const rect = { x: ox, y: oy, w: out.width, h: out.height };
  const pen = bitmapPushPen(run, rect);
  const ink = run.inkBounds;
  const inkBounds = ink ? { ...ink, x: ink.x + pen[0], y: ink.y + pen[1] } : null;
  const stamp = (value: string, offset: number): BitmapTextPaint['foreground'] => {
    const rgba = color(value);
    const pixels = new Set<number>();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    // Union before painting: overlapping glyph masks do not compound alpha.
    for (const { glyph, penX } of run.glyphs) for (let y = 0; y < glyph.height; y++) for (let x = 0; x < glyph.width; x++) {
      if (!glyph.mask[y * glyph.width + x] || !rgba[3]) continue;
      const dx = pen[0] - ox + penX + glyph.bearingX + x + offset;
      const dy = pen[1] - oy + glyph.bearingY + y + offset;
      if (dx < 0 || dy < 0 || dx >= out.width || dy >= out.height || !controlPointVisible(context, dx, dy)) continue;
      pixels.add(dy * out.width + dx);
      left = Math.min(left, dx + ox); top = Math.min(top, dy + oy);
      right = Math.max(right, dx + ox + 1); bottom = Math.max(bottom, dy + oy + 1);
    }
    const pixel = PixelBuffer.alloc(1, 1); pixel.setPixel(0, 0, ...rgba);
    for (const key of pixels) out.drawOver(pixel, key % out.width, Math.floor(key / out.width));
    const bounds: ControlRect | null = pixels.size ? { x: left, y: top, w: right - left, h: bottom - top } : null;
    return { rgba, pixels: pixels.size, bounds };
  };
  const embossed = emboss ? stamp(emboss, 1) : null;
  const painted = stamp(foreground, 0);
  if (!painted.pixels && !embossed?.pixels) return null;
  return { fontId: run.font.id, providerBasis: 'caller-declared', layoutBasis: 'kdef-2.3.1-single-line-push',
    coordinateSpace: 'port', strikeSize: run.font.data.strikeSize, metrics: run.font.data.metrics,
    label: run.label, advance: run.advance, lineHeight: run.lineHeight, pen, faceRect: rect,
    declaredClip: context.clip, contextBasis: context.basis, inkBounds, foreground: painted, emboss: embossed };
}
