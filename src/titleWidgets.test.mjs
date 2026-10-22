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

// 0x5cb6 template → placed remap (docs/spec/kdef231-code10-widgets.md §4).
const cell = (edge, segment, src, dst) => ({ edge, segment, src, rects: [dst] });
test('0x5cb6 remap: side order, half-open cells, independent corners, empty on a miss', () => {
  const wt = { parts: { 'part-0': { rect: [10, 10, 50, 50] }, 'part-1': { rect: [4, 2, 8, 6] }, 'part-2': { rect: [20, 2, 26, 6] }, 'part-3': { rect: [2, 30, 8, 36] } } };
  const placement = [
    cell('top', 0, { x: 0, y: 0, w: 4, h: 10 }, { x: 0, y: 0, w: 4, h: 10 }), // leading region: never a target
    cell('top', 1, { x: 4, y: 0, w: 16, h: 10 }, { x: 4, y: 0, w: 16, h: 10 }),
    cell('top', 2, { x: 20, y: 0, w: 4, h: 10 }, { x: 30, y: 0, w: 4, h: 10 }), // shifted +10
    cell('top', 3, { x: 24, y: 0, w: 4, h: 10 }, { x: 40, y: 0, w: 4, h: 10 }), // shifted +16
    cell('left', 1, { x: 0, y: 0, w: 10, h: 30 }, { x: 0, y: 0, w: 10, h: 30 }),
    cell('left', 2, { x: 0, y: 30, w: 10, h: 10 }, { x: 0, y: 80, w: 10, h: 0 }), // collapsed to 0, moved +50
  ];
  const rects = Object.fromEntries(resolveTitleWidgetRects(wt, { frame: { top: 10 }, placement }).map(r => [r.role, r.rect]));
  // close: topLeft (4,2) is in top seg 1 (top is searched before left); x=4 is NOT in the leading [0,4).
  assert.deepEqual(rects.close, { x: 4, y: 2, w: 4, h: 4 });
  // zoom: topLeft in seg 2 (+10), botRight-1 (25,5) in seg 3 (+16): corners move independently.
  assert.deepEqual(rects.zoom, { x: 30, y: 2, w: 12, h: 4 });
  // collapse: both corners in the collapsed left cell: translated at full size to the collapse point.
  assert.deepEqual(rects.collapse, { x: 2, y: 80, w: 6, h: 6 });
  // A corner in no segment empties the rect (no hit, no press area).
  const lead = { parts: { ...wt.parts, 'part-1': { rect: [26, 2, 60, 6] } } };
  assert.deepEqual(resolveTitleWidgetRects(lead, { frame: { top: 10 }, placement }).map(r => r.role), ['zoom', 'collapse']);
  // 0x4e3a cleared the shade flag: no collapse hit (0x41be → 0x487e false).
  assert.deepEqual(resolveTitleWidgetRects(wt, { frame: { top: 10 }, placement, shadeCleared: true }).map(r => r.role), ['close', 'zoom']);
  // Cell ends are exclusive: x=20 belongs to seg 2, not seg 1 (the old inclusive top-edge lookup took seg 1).
  assert.equal(rects.zoom.x, 30);
});

const { readFileSync } = await import('node:fs');
const { loadKaleidoscopeScheme } = await import('../tools/theme-loader/loadKaleidoscopeScheme.js');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');
test('left-side widgets follow growth through 0x5cb6 (1138, apple-lisa side-floating utility)', async () => {
  for (const slug of ['1138', 'apple-lisa']) {
    const d = await loadKaleidoscopeScheme(readFileSync(new URL(`../themes/${slug}/scheme.${slug === '1138' ? 'rsrc' : 'sit'}`, import.meta.url)), { encodeAssets: false });
    const wt = d.manifest.windowTypes['side-floating-utility-window'];
    const a = d.assets.find(x => x.path === wt.chrome.active);
    const [l, t, r, b] = wt.parts['part-0'].rect, [cl, ct, cr, cb] = wt.parts['part-3'].rect;
    const at = grow => {
      const c = composeWindowChrome(new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, r - l, b - t + grow);
      // The collapse widget sits inside the left side's code-10 cell (§7); its rect is that cell's delta.
      const ten = c.placement.find(p => p.edge === 'left' && p.code === 10);
      assert.ok(ten && ct >= ten.src.y && cb <= ten.src.y + ten.src.h, `${slug}: collapse widget inside the code-10 cell`);
      const dy = ten.rects[0].y - ten.src.y;
      assert.deepEqual(resolveTitleWidgetRects(wt, c).find(w => w.role === 'collapse').rect, { x: cl, y: ct + dy, w: cr - cl, h: cb - ct }, `${slug} +${grow}`);
      return ct + dy;
    };
    // A code-8 grower precedes the widget on the left side, so the rect moves with the height.
    assert.equal(at(50) - at(0), 50, slug);
    // Below the template the side is too short: the code-10 cell collapses, the rect stays at its collapse point.
    const c = composeWindowChrome(new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, r - l, Math.max(0, b - t - 12));
    const ten = c.placement.find(p => p.edge === 'left' && p.code === 10);
    assert.equal(ten.rects[0].h, 0, `${slug}: code 10 dropped below the template`);
    assert.deepEqual(resolveTitleWidgetRects(wt, c).find(w => w.role === 'collapse').rect, { x: cl, y: ten.rects[0].y + (ct - ten.src.y), w: cr - cl, h: cb - ct });
  }
});

test('mutation: the pre-0x5cb6 top-edge x-only lookup misplaces the same widgets', async () => {
  // The previous resolver: x of topLeft via the first top placement with an INCLUSIVE end, y kept.
  const old = (wt, c) => {
    const top = c.placement.filter(s => s.edge === 'top'), shift = s => s.rects[0].x - s.src.x;
    const [l, t, r, b] = wt.parts['part-3'].rect, hit = top.find(s => l >= s.src.x && l <= s.src.x + s.src.w);
    return { x: l + (hit ? shift(hit) : Math.max(0, ...top.map(shift))), y: t, w: r - l, h: b - t };
  };
  const d = await loadKaleidoscopeScheme(readFileSync(new URL('../themes/1138/scheme.rsrc', import.meta.url)), { encodeAssets: false });
  const wt = d.manifest.windowTypes['side-floating-utility-window'], a = d.assets.find(x => x.path === wt.chrome.active);
  const [l, t, r, b] = wt.parts['part-0'].rect;
  const c = composeWindowChrome(new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, r - l, b - t + 50);
  assert.notDeepEqual(old(wt, c), resolveTitleWidgetRects(wt, c).find(w => w.role === 'collapse').rect);
});
