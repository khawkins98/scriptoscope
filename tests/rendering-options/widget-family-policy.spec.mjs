import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// PM1 is declared public-type policy, not a claim that slugs decode to procIDs.
const TYPES = [
  ['document-window', false, false], ['collapsed-document-window', false, false],
  ['dialog', false, false], ['alert', false, false], ['movable-modal', false, false], ['movable-alert', false, false], ['popup-window', false, false],
  ['titled-utility-window', true, false], ['no-title-utility-window', true, false], ['side-floating-utility-window', true, true],
  ['collapsed-titled-utility', true, false], ['collapsed-titled-utility-window', true, false],
  ['collapsed-no-title-utility', true, false], ['collapsed-no-title-utility-window', true, false],
  ['collapsed-side-utility', true, true], ['collapsed-side-floating-utility-window', true, true],
];

for (const mode of ['source', 'built']) {
  test(`${mode}: PM1 actual rendered types select alternate art, pressed pixels and mask hits`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, types }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const rows = [];
      for (const [key, alt, side] of types) {
        const win = await api.renderWindow(widgetFamilyTheme([key]), { windowType: key, width: 160, height: 100, pressedWidget: 'close' });
        const c = win._scriptoscopeComposed, x = side ? 4 : 6, y = side ? 6 : 4;
        rows.push({ key, alt, side, flags: [c.layout.flags.altWidgets, c.layout.flags.sideTitle],
          pixel: [...c.buffer.getPixel(x + 1, y + 1)], hole: c.hitWidget(x, y), ink: c.hitWidget(x + 1, y) });
      }
      return rows;
    }, { mode, types: TYPES });
    await attachObservations(info, 'widget-family-policy', mode, { mode, rows });
    for (const r of rows) {
      expect.soft(r.flags, r.key).toEqual([r.alt, r.side]);
      expect.soft(r.pixel, r.key).toEqual(r.alt ? r.side ? [48, 80, 208, 255] : [32, 160, 80, 255] : [208, 32, 48, 255]);
      expect.soft(r.hole, r.key).toBeNull();
      expect.soft(r.ink, r.key).toBe('close');
    }
  });

  test(`${mode}: PM1 side retry, missing alternate strip and actual fallback owner`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { widgetFamilyTheme: make } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const cases = [
        ['side retry', make(['side-floating-utility-window'], [-14330, -14298]), 'side-floating-utility-window'],
        ['no regular fallback', make(['titled-utility-window'], [-14330]), 'titled-utility-window'],
        ['side to top fallback', make(['titled-utility-window']), 'side-floating-utility-window'],
        ['utility to document fallback', make(['document-window']), 'titled-utility-window'],
        ['base owner', make([], [], make(['side-floating-utility-window'])), 'side-floating-utility-window'],
      ];
      const out = [];
      for (const [label, theme, request] of cases) {
        const win = await api.renderWindow(theme, { windowType: request, width: 160, height: 100, pressedWidget: 'close' });
        const c = win._scriptoscopeComposed;
        // Coordinates fixed by the fixture that actually exists, independent of observed flags.
        const side = label === 'side retry' || label === 'base owner', x = side ? 4 : 6, y = side ? 6 : 4;
        out.push({ label, flags: [c.layout.flags.altWidgets, c.layout.flags.sideTitle], pixel: [...c.buffer.getPixel(x + 1, y + 1)], hit: c.hitWidget(x + 1, y) });
      }
      return out;
    }, mode);
    const expected = [
      [[true, true], [32, 160, 80, 255], 'close'], [[true, false], [160, 160, 160, 255], null],
      [[true, false], [32, 160, 80, 255], 'close'], [[false, false], [208, 32, 48, 255], 'close'],
      [[true, true], [48, 80, 208, 255], 'close'],
    ];
    rows.forEach((r, i) => expect.soft([r.flags, r.pixel, r.hit], r.label).toEqual(expected[i]));
  });

  test(`${mode}: alternate title uses bold for measurement and drawing, document remains plain`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const rows = [];
      for (const key of ['document-window', 'titled-utility-window']) {
        const calls = [], p = CanvasRenderingContext2D.prototype, measure = p.measureText, fill = p.fillText;
        p.measureText = function (text) { calls.push(['measure', this.font]); return measure.call(this, text); };
        p.fillText = function (text, ...args) { calls.push(['draw', this.font]); return fill.call(this, text, ...args); };
        try { await api.renderWindow(widgetFamilyTheme([key]), { windowType: key, width: 220, height: 100, title: 'Tools' }); }
        finally { p.measureText = measure; p.fillText = fill; }
        rows.push({ key, calls });
      }
      return rows;
    }, mode);
    for (const r of rows) {
      expect(r.calls.some(([kind]) => kind === 'measure'), r.key).toBe(true);
      expect(r.calls.some(([kind]) => kind === 'draw'), r.key).toBe(true);
      for (const [, font] of r.calls) expect.soft(/\b(?:bold|[6-9]00)\b/.test(font), `${r.key}: ${font}`).toBe(r.key === 'titled-utility-window');
    }
  });
}
