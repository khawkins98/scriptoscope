import type { PixelBuffer } from './pixelBuffer.js';

/** Private synchronous publication: the aliased ImageData never escapes this call.
 * Public PixelBuffer.toImageData() continues to return an independent snapshot. */
export function publishPixels(context: CanvasRenderingContext2D, buffer: PixelBuffer): void {
  const data = buffer.data;
  const image = data.buffer instanceof ArrayBuffer && data.length === buffer.width * buffer.height * 4
    ? new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), buffer.width, buffer.height)
    : buffer.toImageData();
  context.putImageData(image, 0, 0);
}

/** Repaint an owned control canvas only after its asynchronous preparation wins. */
export function repaintControlCanvas(canvas: HTMLCanvasElement, buffer: PixelBuffer, scale = 1): void {
  if (canvas.width !== buffer.width) canvas.width = buffer.width;
  if (canvas.height !== buffer.height) canvas.height = buffer.height;
  const context = canvas.getContext('2d');
  if (context) publishPixels(context, buffer);
  canvas.style.width = `${buffer.width * scale}px`;
  canvas.style.height = `${buffer.height * scale}px`;
}
