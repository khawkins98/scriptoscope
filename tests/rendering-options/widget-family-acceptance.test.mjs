import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import '../helpers/registerTs.mjs';

// Private verifier probes transform module text in memory; never edit src/.
const mutation = process.env.SCRIPTOSCOPE_WIDGET_MUTATION;
if (mutation) registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (!url.endsWith('/engine/families/window.ts')) return result;
  const substitutions = {
    omitAlternate: ['d.altWidgets +', '0 +'],
    omitSideOffset: ['d.altSideTitle : 0', '0 : 0'],
    keepPopupCollapsed: ['if (flags.popupFamily)', 'if (false)'],
    useFirstRow: ['layout.flags.collapsed && strip.height', 'false && strip.height'],
  };
  const [before, after] = substitutions[mutation] ?? [];
  if (!before || !result.source.includes(before)) throw new Error(`Mutation did not bind: ${mutation}`);
  return { ...result, source: result.source.replace(before, after) };
} });

const { widgetCicnIds, probeWidgetStrip, layoutWindow, windowWidgets, widgetHit, drawPressedWidget } = await import('../../src/engine/families/window.ts');
const { ResourceChain, mapProvider } = await import('../../src/engine/resources/chain.ts');
const { PixelBuffer } = await import('../../src/pixelBuffer.ts');
const q = (left, top, right, bottom) => ({ left, top, right, bottom });
const makeLayout = flags => layoutWindow({
  sides: Array.from({ length: 4 }, () => [{ code: 7, border: 0 }, { code: 7, border: 24 }, { code: 8, border: 64 }]),
  rects: [{ type: 0, rect: q(4, 20, 60, 60) }, { type: 1, rect: q(6, 4, 10, 8) }, { type: 2, rect: q(12, 4, 16, 8) }, { type: 3, rect: q(18, 4, 22, 8) }],
  B: q(0, 0, 64, 64), C: q(4, 20, 164, 120), titleWidth: 0, titleLength: 0, flags,
});

test('WD11 and HT7: all four flag combinations, typed IDs and base-chain priority', () => {
  const cases = [[false, false, [-14330]], [false, true, [-14330, -14338]], [true, false, [-14298]], [true, true, [-14290, -14298]]];
  for (const [altWidgets, sideTitle, expected] of cases) {
    const flags = { altWidgets, sideTitle };
    assert.deepEqual(widgetCicnIds(flags), expected);
    const chain = new ResourceChain([
      mapProvider('child', 'archive', [[`cicn:${expected.at(-1)}`, 'retry'], [`ics4:${expected[0]}`, 'wrong-type']]),
      mapProvider('base', 'base', [[`cicn:${expected[0]}`, 'primary']]),
    ]);
    assert.equal(probeWidgetStrip(chain, flags).id, expected[0]);
    assert.equal(probeWidgetStrip(new ResourceChain([mapProvider('none', 'archive', [])]), flags), null);
  }
});

test('PF4: popup clears collapse while retaining the supplied expanded content rectangle', () => {
  const layout = makeLayout({ popupFamily: true, collapsed: true });
  assert.equal(layout.flags.collapsed, false);
  assert.deepEqual(layout.C, q(4, 20, 164, 120));
});

test('WD9/HT7: collapsed row affects both pressed drawing and mask membership for all three widgets', () => {
  const strip = PixelBuffer.alloc(12, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) strip.setPixel(x, y, ...(y < 4 ? [31, 63, 95, 255] : [191, 127, 47, 255]));
  // Each role has independently placed clear pixels in the two rows.
  for (const x of [0, 4, 8]) { strip.setPixel(x, 0, 0, 0, 0, 0); strip.setPixel(x + 1, 4, 0, 0, 0, 0); }
  for (const collapsed of [false, true]) {
    const layout = makeLayout({ collapsed }), widgets = windowWidgets(layout);
    for (const [i, role] of ['close', 'zoom', 'collapse'].entries()) {
      const x = 6 + 6 * i, out = PixelBuffer.alloc(168, 124);
      drawPressedWidget(out, layout, widgets.find(w => w.row.role === role), strip);
      assert.deepEqual([...out.getPixel(x + 2, 5)], collapsed ? [191, 127, 47, 255] : [31, 63, 95, 255]);
      assert.equal(widgetHit(layout, widgets, strip, x, 4).role, collapsed ? role : null);
      assert.equal(widgetHit(layout, widgets, strip, x + 1, 4).role, collapsed ? null : role);
    }
  }
});
