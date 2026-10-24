import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: push and bevel font size is independent of face height`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const result = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const { labelOracle, inkBounds, foregroundBounds } = await import('/tests/rendering-options/label-oracle.mjs');
    const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
    const { colorIcon, colorInfo } = await import('/tests/decoder-fixtures/control-colors.mjs');
    // Hidden red foreground and green emboss, with a white solid body.
    const data = colorIcon({ entries: [[0, 65535, 65535, 65535], [1, 65535, 0, 0], [2, 0, 65535, 0]], pixels: [0, 1, 2, 0, 0, 0, 0, 0] });
    const theme = await api.loadKaleidoscopeScheme(forkOf([-10239, -10175].flatMap(id => [
      { type: 'cicn', id, data }, { type: 'cinf', id, data: colorInfo({ emboss: [2, 0] }) },
    ])));
    const original = CanvasRenderingContext2D.prototype.fillText;
    let calls = [];
    CanvasRenderingContext2D.prototype.fillText = function(...args) { calls.push({ font: this.font, color: this.fillStyle, x: args[1], y: args[2], textBaseline: this.textBaseline }); return original.apply(this, args); };
    const rows = [], invalid = [];
    try {
      for (const family of ['composeButton', 'composeBevelButton']) {
        for (const fontSize of [undefined, 6, 16]) for (const height of [12, 20, 24, undefined]) {
          calls = [];
          const options = { label: 'AgjpQy', small: true, minWidth: 0, ...(height === undefined ? {} : { height }), ...(fontSize === undefined ? {} : { fontSize }) };
          const nominal = fontSize ?? 12;
          const measure = document.createElement('canvas').getContext('2d');
          measure.font = `${nominal}px Chicago, "Charcoal", Geneva, sans-serif`;
          const measuredWidth = Math.ceil(measure.measureText(options.label).width) + (family === 'composeButton' ? 24 : 16);
          const oracle = labelOracle(family, options.label, nominal, measuredWidth, height ?? 20, 0, original);
          const expectedPlacement = family === 'composeButton'
            ? [{ x: oracle.x + 1, y: oracle.baseline + 1, textBaseline: 'alphabetic' }, { x: oracle.x, y: oracle.baseline, textBaseline: 'alphabetic' }]
            : Array(2).fill({ x: 0, y: Math.round(Math.ceil(nominal * 1.3) / 2), textBaseline: 'middle' });
          const output = await api[family](theme, options);
          const painted = [...calls];
          // Independent browser measurement establishes nominal size/auto-width,
          // not historical glyph or baseline equivalence.
          const ctx = document.createElement('canvas').getContext('2d');
          ctx.font = `${nominal}px Chicago, "Charcoal", Geneva, sans-serif`;
          rows.push({ family, fontSize: nominal, height: height ?? null, size: [output.width, output.height], calls: painted, expectedPlacement,
            measuredWidth: Math.ceil(ctx.measureText(options.label).width) + (family === 'composeButton' ? 24 : 16) });
        }
        for (const fontSize of [NaN, Infinity, -1, 5.99]) {
          try { await api[family](theme, { label: 'H', fontSize }); invalid.push('accepted'); }
          catch (error) { invalid.push(error.name); }
        }
        // Full-coverage pixels of a separate 12px browser glyph mask prove that
        // both foreground and (+1,+1) emboss consume the fixed nominal size.
        const oracle = labelOracle(family, 'H', 12, 80, 24, 0, original);
        const output = await api[family](theme, { label: 'H', small: true, height: 24, minWidth: 80 });
        const fg = oracle.foreground.map(([x, y]) => [...output.getPixel(x, y)]);
        const emboss = oracle.emboss.map(([x, y]) => [...output.getPixel(x, y)]);
        const geometry = { expected: inkBounds(oracle.foreground), actual: foregroundBounds(output, [255, 0, 0, 255]) };
        rows.push({ family, fg, emboss, geometry, clippedInk: oracle.clippedInk });
      }
      return { rows, invalid };
    } finally { CanvasRenderingContext2D.prototype.fillText = original; theme.dispose(); }
  }, mode);
  for (const row of result.rows) {
    if (row.calls) {
      expect(row.calls).toHaveLength(2);
      for (const [index, call] of row.calls.entries()) {
        expect(call.font.startsWith(`${row.fontSize}px `)).toBe(true);
        expect(call).toMatchObject(row.expectedPlacement[index]);
      }
      expect(row.size).toEqual([row.measuredWidth, row.height ?? 20]);
    } else {
      expect(row.geometry.actual).toEqual(row.geometry.expected);
      expect(row.clippedInk).toBe(0);
      expect(row.fg.length).toBeGreaterThan(0); expect(row.emboss.length).toBeGreaterThan(0);
      for (const p of row.fg) expect(p).toEqual([255, 0, 0, 255]);
      for (const p of row.emboss) expect(p).toEqual([0, 255, 0, 255]);
    }
  }
  expect(result.invalid).toEqual(Array(8).fill('RangeError'));
  await attachObservations(info, 'control-font-size', mode, { mode, result, basis: 'kDEF port txSize, not Rect height; 12px default and bevel policy are compatibility choices; browser glyphs are not original font evidence' });
});
