import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../tests/helpers/registerTs.mjs';
const { resolveTitleWidgetRects } = await import('./renderWindow.ts');
const { titleWidgetHits } = await import('./interactive.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');

// Expected rects are hand traces of docs/spec/engine/window-widgets.md: the
// layout rows (LS, AW), the cell rects (CR), the 0x5cb6 remap (RM1–RM8) and
// the widget hit (HT1–HT8). A widget is hit only with the pressed-strip cicn
// (WD11 base) present and only where its mask is set (HT7, HT8).
const opaque = (w, h) => { const p = PixelBuffer.alloc(w, h); p.data.fill(255); return p; };
const sorted = list => [...list].sort((a, b) => a.role.localeCompare(b.role));

// Top side: [0,20) code 8 grows, [20,100) code 1 is fixed. Body A = [1,35,99,80].
// Content 198 wide: P[0] = 0, P[N] = 100 + 100, F = 80, the grower gets 120,
// so the fixed cell moves +100 (RM5/RM6: both corners in one fixed cell).
const stacked = () => ({ chrome: { active: 'owned' }, edges: { top: [{ at: 0, part: 'part-0' }, { at: 20, part: 'part-8' }, { at: 100, part: 'part-1' }] }, parts: {
  'part-4': { rect: [20, 1, 26, 18] }, // the title rect: never a widget
  'part-3': { rect: [50, 25, 58, 33] },
  'part-1': { rect: [50, 3, 58, 11] },
  'part-2': { rect: [50, 14, 58, 22] },
  'part-0': { rect: [1, 35, 99, 80] },
  'part-99': { rect: [80, 3, 88, 11] }, // no widget type
} });
test('native widget IDs survive arbitrary order, stacked positions and title markers (RM5–RM7, HT6)', () => {
  const wt = stacked(), strip = opaque(24, 8);
  const composed = composeWindowChrome(opaque(100, 100), wt, 198, 45, { widgetCicn: strip });
  const want = [
    { role: 'close', rect: { x: 150, y: 3, w: 8, h: 8 } },
    { role: 'zoom', rect: { x: 150, y: 14, w: 8, h: 8 } },
    { role: 'collapse', rect: { x: 150, y: 25, w: 8, h: 8 } },
  ];
  assert.deepEqual(sorted(resolveTitleWidgetRects(wt, composed)), sorted(want));
  const theme = { manifest: { windowTypes: { document: wt } } };
  assert.deepEqual(sorted(titleWidgetHits(theme, 'document', composed, 2, 'active')), sorted(want.map(({ role, rect: r }) => ({ role, rect: { x: r.x * 2, y: r.y * 2, w: r.w * 2, h: r.h * 2 } }))));
  for (const { role, rect: r } of want) assert.equal(composed.hitWidget(r.x + 3, r.y + 3), role, role);
  assert.equal(composed.hitWidget(83, 5), null, 'type 99 is not a widget');
  assert.equal(composed.hitWidget(22, 5), null, 'the title rect is not a widget');
  // RM8: an entry whose corner lies in no cell is (0,0,0,0) and never hit.
  wt.parts['part-2'].rect = [0, 0, 0, 0];
  const missing = composeWindowChrome(opaque(100, 100), wt, 198, 45, { widgetCicn: strip });
  assert.deepEqual(resolveTitleWidgetRects(wt, missing).filter(w => w.rect.w > 0 && w.rect.h > 0).map(w => w.role).sort(), ['close', 'collapse']);
});

test('HT7: no widget is hit without the pressed-strip cicn; HT2: none in an inactive window', () => {
  const wt = stacked();
  const bare = composeWindowChrome(opaque(100, 100), wt, 198, 45, { widgetCicn: null });
  assert.equal(bare.hitWidget(153, 6), null);
  assert.deepEqual(resolveTitleWidgetRects(wt, bare).filter(w => w.rect.w > 0), []);
  const inactive = composeWindowChrome(opaque(100, 100), wt, 198, 45, { widgetCicn: opaque(24, 8), active: false });
  assert.equal(inactive.hitWidget(153, 6), null);
});

// A remap fixture: top [0,4) 1, [4,20) 1, [20,22) 8, [22,24) 1, [24,26) 8, [26,40) 1;
// left [0,30) 1, [30,40) 10, [40,60) 1. Body A = [10,10,40,50]; C starts at (10,10).
const remapType = parts => ({ chrome: { active: 'owned' }, parts: { 'part-0': { rect: [10, 10, 40, 50] }, ...parts }, edges: {
  top: [[0, 0], [4, 1], [20, 1], [22, 8], [24, 1], [26, 8], [40, 1]].map(([at, c]) => ({ at, part: `part-${c}` })),
  left: [[0, 0], [30, 1], [40, 10], [60, 1]].map(([at, c]) => ({ at, part: `part-${c}` })),
} });
const rectOf = (c, role) => resolveTitleWidgetRects(null, c).find(w => w.role === role)?.rect;
test('0x5cb6 remap: half-open cells, independent corners, far-edge bottom-right, empty on a miss or in a dropped cell', () => {
  const strip = opaque(40, 10);
  const wt = remapType({ 'part-1': { rect: [4, 2, 8, 6] }, 'part-2': { rect: [21, 2, 25, 6] }, 'part-3': { rect: [2, 31, 8, 37] } });
  // Content 40 × 40 (delta +10 across, 0 down): E = 50, F = 36, so the budget 14 splits 7/7 over the two code-8 cells.
  const grown = composeWindowChrome(opaque(40, 60), wt, 40, 40, { widgetCicn: strip });
  // close: (4,2) is in [4,20), not the leading [0,4) or the earlier cell (half-open): unmoved.
  assert.deepEqual(rectOf(grown, 'close'), { x: 4, y: 2, w: 4, h: 4 });
  // zoom: top-left in [20,22) → [20,27) (near edge +0); bottom-right (24,5) in [24,26) → [29,36),
  // far edge +10 (RM6): the corners move independently and the widget stretches to 14.
  assert.deepEqual(rectOf(grown, 'zoom'), { x: 21, y: 2, w: 14, h: 4 });
  // collapse: both corners in the left code-10 cell, kept at full height (E = F, TS2).
  assert.deepEqual(rectOf(grown, 'collapse'), { x: 2, y: 31, w: 6, h: 6 });
  // One pixel short (E = 59 < F = 60, TS1): the code-10 cell is dropped to [30,30). RM6 moves the
  // bottom-right corner by the cell's far edge (−10), so the box is empty: no hit anywhere at the
  // old collapse point (finding F1; the near-edge reading kept a full-size box there).
  const short = composeWindowChrome(opaque(40, 60), wt, 40, 39, { widgetCicn: strip });
  assert.ok(!rectOf(short, 'collapse') || rectOf(short, 'collapse').h <= 0);
  for (let y = 31; y < 37; y++) for (let x = 2; x < 8; x++) assert.notEqual(short.hitWidget(x, y), 'collapse', `${x},${y}`);
  // RM8: a bottom-right corner past the top list's last border lies in no cell.
  const miss = composeWindowChrome(opaque(60, 60), remapType({ 'part-1': { rect: [26, 2, 60, 6] } }), 40, 40, { widgetCicn: opaque(60, 10) });
  assert.ok(!rectOf(miss, 'close') || rectOf(miss, 'close').w <= 0);
  assert.equal(miss.hitWidget(30, 3), null);
});

test('HT8: the hit region is the strip mask moved 1:1 onto the rect, not scaled; mask-clear pixels do not hit', () => {
  // The close entry [21,2,25,6] stretches to [21,35) as above; its source is strip [0,4) × [0,4).
  // Strip mask: [0,4) set except (1,1); [4,8) clear; [8,12) set; the strip is 12 wide.
  const strip = PixelBuffer.alloc(12, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) if ((x < 4 && !(x === 1 && y === 1)) || x >= 8) strip.setPixel(x, y, 9, 9, 9, 255);
  const c = composeWindowChrome(opaque(40, 60), remapType({ 'part-1': { rect: [21, 2, 25, 6] } }), 40, 40, { widgetCicn: strip });
  assert.deepEqual(rectOf(c, 'close'), { x: 21, y: 2, w: 14, h: 4 });
  assert.equal(c.hitWidget(21, 2), 'close');
  assert.equal(c.hitWidget(22, 3), null, 'mask-clear pixel inside the rect');
  for (let x = 25; x < 29; x++) assert.equal(c.hitWidget(x, 4), null, `${x}: past the source, over clear strip art`);
  for (let x = 29; x < 33; x++) assert.equal(c.hitWidget(x, 4), 'close', `${x}: the neighbouring strip art's mask`);
  for (let x = 33; x < 35; x++) assert.equal(c.hitWidget(x, 4), null, `${x}: past the strip's bounds`);
});

const { readFileSync } = await import('node:fs');
const { loadKaleidoscopeScheme } = await import('../tools/theme-loader/loadKaleidoscopeScheme.js');
const load = async slug => loadKaleidoscopeScheme(readFileSync(new URL(`../themes/${slug}/scheme.${slug === '1138' ? 'rsrc' : 'sit'}`, import.meta.url)), { encodeAssets: false });
const pix = (d, path) => { const a = d.assets.find(x => x.path === path); return new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)); };
const stripOf = d => pix(d, Object.values(d.manifest.chromeElements).find(e => e.sourceCicnId === -14330).asset);
test('left-side widgets follow growth through 0x5cb6 and vanish in a dropped code-10 cell (1138, apple-lisa side-floating utility)', async () => {
  for (const slug of ['1138', 'apple-lisa']) {
    const d = await load(slug), wt = d.manifest.windowTypes['side-floating-utility-window'], strip = stripOf(d);
    const [l, t, r, b] = wt.parts['part-0'].rect, [cl, ct, cr, cb] = wt.parts['part-3'].rect;
    const compose = h => composeWindowChrome(pix(d, wt.chrome.active), wt, r - l, h, { widgetCicn: strip });
    const at = grow => {
      const c = compose(b - t + grow);
      // §6.2: the collapse widget lies wholly inside the left side's code-10 cell; at or above the
      // template it keeps its width (TS2), so the rect is that cell's translation (RM5, RM6).
      const ten = c.placement.find(p => p.edge === 'left' && p.code === 10);
      assert.ok(ten && ct >= ten.src.y && cb <= ten.src.y + ten.src.h, `${slug}: collapse widget inside the code-10 cell`);
      const dy = ten.rects[0].y - ten.src.y;
      assert.equal(ten.rects[0].h, ten.src.h, `${slug} +${grow}: code 10 kept`);
      assert.deepEqual(rectOf(c, 'collapse'), { x: cl, y: ct + dy, w: cr - cl, h: cb - ct }, `${slug} +${grow}`);
      return ct + dy;
    };
    // A code-8 grower precedes the widget on the left side, so the rect moves with the height.
    assert.equal(at(50) - at(0), 50, slug);
    // Below the template the side is too short (TS1): the code-10 cell is dropped and RM6 empties
    // the box. It is neither listed with an area nor hit at its old place (finding F1).
    const c = compose(Math.max(0, b - t - 12));
    const ten = c.placement.find(p => p.edge === 'left' && p.code === 10);
    assert.equal(ten.rects[0].h, 0, `${slug}: code 10 dropped below the template`);
    const rect = rectOf(c, 'collapse');
    assert.ok(!rect || rect.w <= 0 || rect.h <= 0, `${slug}: empty collapse rect ${JSON.stringify(rect)}`);
    const y0 = ten.rects[0].y;
    for (let y = y0; y < y0 + (cb - ct); y++) for (let x = cl; x < cr; x++) assert.notEqual(c.hitWidget(x, y), 'collapse', `${slug}: ${x},${y}`);
  }
});

test('mutation: the pre-0x5cb6 top-edge x-only lookup misplaces the same widgets', async () => {
  // The previous resolver: x of topLeft via the first top placement with an INCLUSIVE end, y kept.
  const old = (wt, c) => {
    const top = c.placement.filter(s => s.edge === 'top'), shift = s => s.rects[0].x - s.src.x;
    const [l, t, r, b] = wt.parts['part-3'].rect, hit = top.find(s => l >= s.src.x && l <= s.src.x + s.src.w);
    return { x: l + (hit ? shift(hit) : Math.max(0, ...top.map(shift))), y: t, w: r - l, h: b - t };
  };
  const d = await load('1138'), wt = d.manifest.windowTypes['side-floating-utility-window'];
  const [l, t, r, b] = wt.parts['part-0'].rect;
  const c = composeWindowChrome(pix(d, wt.chrome.active), wt, r - l, b - t + 50, { widgetCicn: stripOf(d) });
  assert.notDeepEqual(old(wt, c), rectOf(c, 'collapse'));
});
