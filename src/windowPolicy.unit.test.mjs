// Implementation-owned checks derived from window-widgets PM1/PM2.
import assert from 'node:assert/strict';
import test from 'node:test';
// PM-assigned execution-only source preloader; its source is outside this lane.
import '../tests/helpers/registerTs.mjs';
const { alternateWindowWidgets, resolveWindowSelection } = await import('./resolveWindowType.ts');
const { equivalentWindowTypeKeys } = await import('./wndCascade.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');
const { widgetCicnIds } = await import('./engine/families/window.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { WindowManager } = await import('./interactive.ts');
const { measureTitle, rasterizeTitle } = await import('./titleFont.ts');

const frame = () => ({ chrome: { active: 'frame' }, parts: { 'part-0': { rect: [2, 5, 18, 18] } } });
const theme = (windowTypes, base) => ({ manifest: { windowTypes }, ...(base ? { base } : {}) });

test('PM1 includes utility aliases and collapsed identities, excluding other public types', () => {
  for (const type of ['titled-utility-window', 'no-title-utility-window', 'side-floating-utility-window',
    'collapsed-titled-utility-window', 'collapsed-no-title-utility-window', 'collapsed-side-floating-utility-window']) {
    for (const key of equivalentWindowTypeKeys(type)) assert.equal(alternateWindowWidgets(key), true, key);
  }
  for (const key of ['document-window', 'collapsed-document-window', 'popup-window', 'dialog', 'alert', 'custom-utility']) {
    assert.equal(alternateWindowWidgets(key), false, key);
  }
});

test('PM1 uses the selected owner and type after fallback', () => {
  const base = theme({ 'collapsed-side-utility': frame() });
  const selected = resolveWindowSelection(theme({}, base), 'collapsed-side-floating-utility-window');
  assert.equal(selected.owner, base);
  assert.equal(selected.renderedType, 'collapsed-side-floating-utility-window');
  assert.equal(alternateWindowWidgets(selected.renderedType), true);
  const fallback = resolveWindowSelection(theme({ 'document-window': frame() }, base), 'titled-utility-window');
  assert.equal(fallback.renderedType, 'document-window');
  assert.equal(alternateWindowWidgets(fallback.renderedType), false);
});

test('PM1 compositor flags select top and side alternate widget strips', () => {
  const pixels = PixelBuffer.alloc(20, 20);
  pixels.fillRect({ x: 0, y: 0, w: 20, h: 20 }, 0, 0, 0);
  for (const [sideTitle, expected] of [[false, [-14298]], [true, [-14290, -14298]]]) {
    const composed = composeWindowChrome(pixels, frame(), 31, 27, { altWidgets: true, sideTitle });
    assert.equal(composed.layout.flags.altWidgets, true);
    assert.deepEqual(widgetCicnIds(composed.layout.flags), expected);
  }
});

test('PF4 keeps the expanded popup content rect and full side walk', () => {
  const pixels = PixelBuffer.alloc(20, 20);
  pixels.fillRect({ x: 0, y: 0, w: 20, h: 20 }, 0, 0, 0);
  const normal = composeWindowChrome(pixels, frame(), 31, 27, { popupFamily: true });
  const requested = composeWindowChrome(pixels, frame(), 31, 27, { popupFamily: true, collapsed: true });
  assert.equal(requested.layout.flags.collapsed, false);
  assert.deepEqual(requested.layout.C, normal.layout.C);
  assert.deepEqual(requested.structure(), normal.structure());
  assert.equal(requested.fullHeight, normal.fullHeight);
});

test('PM2 manager apply and toggle ignore popup collapse without changing expanded size', async () => {
  const manager = new WindowManager();
  let calls = 0;
  const entry = { theme: theme({ 'popup-window': frame() }), opts: { windowType: 'popup-window', width: 31, height: 27 },
    host: {}, active: true, collapsed: false, z: 1, applyStateEpoch: 0, renderEpoch: 0,
    handlers: { onCollapse: () => calls++ } };
  manager.windows.push(entry);
  manager.prepareRender = () => { throw new Error('ignored collapse must not prepare chrome'); };
  await manager.applyState(entry.host, { collapsed: true });
  await manager.toggleCollapse(entry);
  assert.equal(manager.describe(entry.host).collapsed, false);
  assert.deepEqual(entry.opts, { windowType: 'popup-window', width: 31, height: 27 });
  assert.equal(calls, 0);
  const inherited = { ...entry, theme: theme({}, entry.theme), collapsed: true };
  assert.equal(manager.effectiveCollapsed(inherited), false);
  assert.equal(manager.effectiveCollapsed({ ...entry, theme: theme({}), opts: { windowType: 'wnd--12320' } }, undefined, true), false);
});

test('PM1 title measurement and drawing share the bold face', () => {
  const previous = globalThis.document;
  const fonts = [];
  globalThis.document = { createElement: () => ({ getContext: () => ({
    set font(value) { fonts.push(value); },
    measureText: () => ({ width: 8, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 }),
    fillText() {}, getImageData: () => ({ data: new Uint8ClampedArray(9 * 9 * 4) }),
  }) }) };
  try {
    measureTitle('Tool', 12, { bold: true });
    rasterizeTitle('Tool', 12, '#000000', { bold: true });
    assert.equal(fonts.length, 3);
    assert.ok(fonts.every(font => font.startsWith('bold ')));
    fonts.length = 0;
    measureTitle('Document', 12);
    assert.ok(fonts.every(font => !font.startsWith('bold ')));
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
