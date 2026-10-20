import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../tests/helpers/registerTs.mjs';
const { resolveTitleWidgetRects } = await import('./renderWindow.ts');
const { titleWidgetHits } = await import('./interactive.ts');

test('native widget IDs survive arbitrary order, stacked positions and title markers', () => {
  const wt = { chrome: { active: 'owned' }, parts: {
    'part-4': { rect: [20, 1, 26, 18] }, // Wide title marker must never become a hit.
    'part-3': { rect: [50, 25, 58, 33] },
    'part-1': { rect: [50, 3, 58, 11] },
    'part-2': { rect: [50, 14, 58, 22] },
    'part-0': { rect: [1, 35, 90, 80] },
    'part-99': { rect: [80, 3, 88, 11] },
  } };
  const composed = { frame: { top: 35 }, placement: [{
    edge: 'top', src: { x: 40, y: 0, w: 50, h: 35 }, rects: [{ x: 140, y: 0, w: 50, h: 35 }],
  }] };
  assert.deepEqual(resolveTitleWidgetRects(wt, composed), [
    { role: 'close', rect: { x: 150, y: 3, w: 8, h: 8 } },
    { role: 'zoom', rect: { x: 150, y: 14, w: 8, h: 8 } },
    { role: 'collapse', rect: { x: 150, y: 25, w: 8, h: 8 } },
  ]);
  const theme = { manifest: { windowTypes: { document: wt } } };
  assert.deepEqual(titleWidgetHits(theme, 'document', composed, 2, 'active'), [
    { role: 'close', rect: { x: 300, y: 6, w: 16, h: 16 } },
    { role: 'zoom', rect: { x: 300, y: 28, w: 16, h: 16 } },
    { role: 'collapse', rect: { x: 300, y: 50, w: 16, h: 16 } },
  ]);
  wt.parts['part-2'].rect = [0, 0, 0, 0];
  assert.deepEqual(resolveTitleWidgetRects(wt, composed).map(r => r.role), ['close', 'collapse']);
});
