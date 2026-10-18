import type { PixelBuffer, PixRect } from './pixelBuffer.js';

/** Internal composition geometry, in backing pixels, committed with its buffer.
 * This describes our actual draw coordinates, not original kDEF fidelity. */
export interface SliderLayout {
  orientation: 'horizontal' | 'vertical';
  axisLength: number;
  thumb: PixRect | null;
  travelStart: number;
  travelEnd: number;
  value: number;
}
export interface SliderComposition {
  buffer: PixelBuffer;
  layout: SliderLayout;
}
