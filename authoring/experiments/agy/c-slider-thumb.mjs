import { Raster, verticalGradient } from '../../../tools/theme-author/raster.js';

export function sliderThumb(state) {
  const r = new Raster(15, 17);
  const grad = verticalGradient(0, 17, [
    [0, '#ffffff'],
    [1, '#e2e7ee'],
  ]);

  for (let y = 0; y < 17; y++) {
    const dx = y === 0 ? 2 : y === 1 ? 1 : y <= 9 ? 0 : y - 9;
    r.hline(dx, y, 15 - 2 * dx, grad);
  }

  r.outlineEdges(0, 0, 15, 17, '#8d98a8');

  const grip = state === 'active' ? '#1689a8' : '#c4c9d0';
  r.vline(7, 3, 6, grip);

  return r;
}
