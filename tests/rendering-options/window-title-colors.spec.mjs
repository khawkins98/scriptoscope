import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// TC4/TC5 and declared substitute alpha-over policy. The browser supplies glyph
// coverage; the oracle supplies colour, pass order, (+1,+1), clip and blending.
// Fractional coverage is injected at the canvas font boundary so srcOr, opaque
// replacement and reverse pass order are distinguishable even with bitmap fonts.
for (const mode of ['source', 'built']) test(`${mode}: raw RGB16 title equality and shadow/foreground alpha-over`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const theme = await api.loadTheme('/themes/1984');
    const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
    const wt = theme.manifest.windowTypes['document-window'];
    const original = CanvasRenderingContext2D.prototype.fillText;
    const out = [];
    try {
      for (const state of ['active', 'inactive']) for (const channel of [-1, 0, 1, 2, 3]) {
        const rgb16 = [0x2101, 0x4301, 0x6501], shadowRaw = [...rgb16];
        if (channel >= 0) shadowRaw[channel % 3]++;
        const text = { rgb16, displayRgb: [32, 80, 160] };
        // 0..2 collide after display conversion: equality must use all raw bits.
        const shadow = { rgb16: shadowRaw, displayRgb: channel === 3 ? [180, 70, 20] : [...text.displayRgb] };
        wt.titleSamples = { [state]: { text, shadow, background: text } };
        const glyphs = [];
        CanvasRenderingContext2D.prototype.fillText = function (...args) {
          this.globalAlpha = 0.5;
          original.apply(this, args);
          glyphs.push({ style: this.fillStyle, ascent: args[2], image: this.getImageData(0, 0, this.canvas.width, this.canvas.height) });
        };
        const title = 'Hdgy';
        const c = (await api.renderWindow(theme, { title, state, width: 240, height: 120 }))._scriptoscopeComposed;
        const a = raw.assets.find(a => a.path === raw.manifest.windowTypes['document-window'].chrome[state]);
        const cicn = new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba));
        const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
        if (!tf) throw new Error('text-free chrome not found');
        const rect = c.titleRect;
        const passes = channel < 0 ? [[text, 0]] : [[shadow, 1], [text, 0]];
        const paints = glyphs.slice(1); // initial black glyph measures the title
        const styles = paints.map(g => g.style);
        const wantedStyles = passes.map(([s]) => '#' + s.displayRgb.map(n => n.toString(16).padStart(2, '0')).join(''));
        const replay = (order, { opaque = false, unshifted = false } = {}) => {
        const expected = new Uint8ClampedArray(tf.buffer.data);
        let fractional = 0, overlap = 0;
        const touched = new Set();
        order.forEach(i => {
          const [sample, shift] = passes[i], offset = unshifted ? 0 : shift;
          const glyph = paints[i];
          if (!glyph) return;
          const top = Math.max(rect.y + rect.h - 4, rect.y + glyph.ascent) - glyph.ascent;
          for (let y = 0; y < glyph.image.height; y++) for (let x = 0; x < glyph.image.width; x++) {
            const coverage = glyph.image.data[(y * glyph.image.width + x) * 4 + 3];
            const alpha = opaque && coverage ? 255 : coverage;
            const dx = rect.x + x + offset, dy = top + y + offset;
            if (!alpha || dx < rect.x || dx >= rect.x + rect.w + 2 || dy < rect.y || dy >= rect.y + rect.h) continue;
            if (alpha < 255) fractional++;
            const p = (dy * c.buffer.width + dx) * 4;
            if (touched.has(p)) overlap++; touched.add(p);
            for (let k = 0; k < 3; k++) expected[p + k] = Math.round((glyph.image.data[(y * glyph.image.width + x) * 4 + k] * alpha + expected[p + k] * (255 - alpha)) / 255);
            expected[p + 3] = Math.round(alpha + expected[p + 3] * (255 - alpha) / 255);
          }
        });
        let mismatches = 0;
        for (let i = 0; i < expected.length; i++) if (expected[i] !== c.buffer.data[i]) mismatches++;
        return { mismatches, fractional, overlap };
        };
        const order = passes.map((_, i) => i);
        out.push({ state, channel, styles, wantedStyles, ...replay(order),
          opaqueMutation: replay(order, { opaque: true }).mismatches,
          offsetMutation: channel >= 0 ? replay(order, { unshifted: true }).mismatches : null,
          reverseMutation: channel === 3 ? replay([...order].reverse()).mismatches : null });
      }
    } finally { CanvasRenderingContext2D.prototype.fillText = original; theme.dispose?.(); }
    return out;
  }, mode);
  await attachObservations(info, 'window-title-colors', mode, { rows });
  expect(rows).toHaveLength(10);
  for (const row of rows) {
    expect(row.styles, JSON.stringify(row)).toEqual(row.wantedStyles);
    expect(row.mismatches, JSON.stringify(row)).toBe(0);
    expect(row.fractional).toBeGreaterThan(0);
    expect(row.opaqueMutation).toBeGreaterThan(0);
    if (row.channel >= 0) { expect(row.overlap).toBeGreaterThan(0); expect(row.offsetMutation).toBeGreaterThan(0); }
    if (row.channel === 3) expect(row.reverseMutation).toBeGreaterThan(0);
  }
});
