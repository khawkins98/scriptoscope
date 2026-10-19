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
  /** Explicit loader admission; absent keeps imperative full-canvas policy. */
  endpointPolicy?: 'declared-group2';
  /** Increasing value follows (1) or opposes (-1) the spatial travel axis. */
  valueDirection?: 1 | -1;
}
export interface SliderComposition {
  buffer: PixelBuffer;
  layout: SliderLayout;
}
