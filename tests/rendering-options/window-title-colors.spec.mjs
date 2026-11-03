import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// TC4/TC5 replay from an independently placed raster: no assumption that a
// runtime scratch raster starts at the pen or that its row zero is baseline.
for (const mode of ['source', 'built']) test(`${mode}: raw RGB16 title equality and shadow/foreground alpha-over`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
    const theme = await api.loadTheme('/themes/1984'), key = 'document-window', wt = theme.manifest.windowTypes[key], title = 'Hdgy';
    const style = R.resolveTitleStyle(title, key, R.topTitleHeight(wt));
    const fill = CanvasRenderingContext2D.prototype.fillText, out = [];
    try {
      for (const state of ['active', 'inactive']) for (const channel of [-1, 0, 1, 2, 3]) {
        const variant = channel < 0 ? 'equal-raw' : channel === 3 ? 'distinct-display' : `raw-channel-${channel}-display-equal`;
        const text = { rgb16: [0x2101, 0x4301, 0x6501], displayRgb: [32, 80, 160] };
        const shadow = { rgb16: [...text.rgb16], displayRgb: [...text.displayRgb] };
        if (channel >= 0) shadow.rgb16[channel % 3]++;
        if (variant === 'distinct-display') shadow.displayRgb = [180, 70, 20];
        wt.titleSamples = { [state]: { text, shadow, background: text } };
        const hex = sample => '#' + sample.displayRgb.map(n => n.toString(16).padStart(2, '0')).join('');
        const calls = [];
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function (s, ...args) {
            // Record every actual colour, including wrong/unexpected colours.
            // Logical pass validation below uses independent visible coverage,
            // not a filter or one physical draw per logical paint pass.
            this.globalAlpha = 0.5;
            calls.push({ text: s, font: this.font, colour: this.fillStyle, args,
              width: this.canvas.width, height: this.canvas.height });
            return fill.call(this, s, ...args);
          };
          win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key, state });
        } finally { CanvasRenderingContext2D.prototype.fillText = fill; }
        const c = win._scriptoscopeComposed, rect = c.titleRect;
        const a = raw.assets.find(a => a.path === raw.manifest.windowTypes[key].chrome[state]);
        const tf = R.textFreeChrome(api.composeWindowChrome, new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, c, { titleLength: title.length });
        if (!tf) throw new Error('Independent colour replay has no matching text-free chrome');
        const baseline = Math.max(rect.y + rect.h - 4, rect.y + style.reference.ascent);
        const passes = variant === 'equal-raw' ? [[text, 0]] : [[shadow, 1], [text, 0]];
        const rasters = passes.map(([sample]) => {
          const canvas = document.createElement('canvas'); canvas.width = R.TITLE_SURFACE_WIDTH; canvas.height = R.TITLE_SURFACE_HEIGHT;
          const ctx = canvas.getContext('2d'); ctx.font = style.reference.font; ctx.fillStyle = hex(sample); ctx.globalAlpha = 0.5;
          fill.call(ctx, title, 32, 20);
          return ctx.getImageData(0, 0, 256, 32).data;
        });
        const prePenColumn = rasters.map(rgba => Array.from({ length: 32 }, (_, y) => ({ y: y - 20, rgba: Array.from(rgba.slice((y * 256 + 31) * 4, (y * 256 + 31) * 4 + 4)) })).filter(p => p.rgba[3]));
        const replay = ({ reverse = false, unshifted = false, mainOnly = false, missing, opaque = false } = {}) => {
          const expected = new Uint8ClampedArray(tf.buffer.data);
          let fractional = 0, overlap = 0; const touched = new Set(), contributors = new Map();
          const order = passes.map((_, i) => i); if (reverse) order.reverse();
          for (const i of order) {
            if ((mainOnly && i < passes.length - 1) || i === missing) continue;
            const pixels = rasters[i], offset = unshifted ? 0 : passes[i][1];
            for (let y = 0; y < 32; y++) for (let x = 0; x < 256; x++) {
              const p = (y * 256 + x) * 4, coverage = pixels[p + 3], alpha = opaque && coverage ? 255 : coverage;
              const dx = rect.x + x - 32 + offset, dy = baseline + y - 20 + offset;
              if (!alpha || dx < rect.x || dx >= rect.x + rect.w + 2 || dy < rect.y || dy >= rect.y + rect.h) continue;
              if (alpha < 255) fractional++;
              const d = (dy * c.buffer.width + dx) * 4;
              if (touched.has(d)) overlap++; touched.add(d);
              if (!contributors.has(d)) contributors.set(d, new Set()); contributors.get(d).add(i);
              for (let k = 0; k < 3; k++) expected[d + k] = Math.round((pixels[p + k] * alpha + expected[d + k] * (255 - alpha)) / 255);
              expected[d + 3] = Math.round(alpha + expected[d + 3] * (255 - alpha) / 255);
            }
          }
          let mismatches = 0; const firstDifferences = [];
          for (let i = 0; i < expected.length; i++) if (expected[i] !== c.buffer.data[i]) {
            mismatches++; if (firstDifferences.length < 12) firstDifferences.push({ x: Math.floor(i / 4) % c.buffer.width, y: Math.floor(i / 4 / c.buffer.width), channel: i % 4, expected: expected[i], actual: c.buffer.data[i] });
          }
          // Explicit observable equivalent of the logical colour sequence:
          // each pass has independently located exclusive visible pixels whose
          // actual RGBA must match that pass's declared paint colour. Overlap
          // obeys the fixed shadow-before-main replay and reverse-order negative.
          const logicalPaints = passes.map(([sample], i) => ({ pass: i, wantedStyle: hex(sample), exclusivePixels: 0, colourMismatches: 0 }));
          for (const [d, owners] of contributors) if (owners.size === 1) {
            const paint = logicalPaints[[...owners][0]]; paint.exclusivePixels++;
            if ([0, 1, 2, 3].some(k => expected[d + k] !== c.buffer.data[d + k])) paint.colourMismatches++;
          }
          return { mismatches, fractional, overlap, firstDifferences, logicalPaints };
        };
        out.push({ state, channel, variant, calls, wantedStyles: passes.map(([sample]) => hex(sample)), prePenColumn, style: style.reference.fontStyle, rect, baseline, ...replay(),
          opaqueMutation: replay({ opaque: true }).mismatches, missingPaintMutations: passes.map((_, i) => replay({ missing: i }).mismatches),
          reverseMismatch: replay({ reverse: true }).mismatches, unshiftedMismatch: replay({ unshifted: true }).mismatches,
          missingShadowMismatch: replay({ mainOnly: true }).mismatches, accessibleName: win.getAttribute('aria-label') });
      }
    } finally { CanvasRenderingContext2D.prototype.fillText = fill; theme.dispose?.(); }
    return out;
  }, mode);
  await attachObservations(info, 'window-title-colors', mode, { mode, rows });
  expect(rows).toHaveLength(10);
  for (const row of rows) {
    // Native observation and publication tiles may add physical calls. Require
    // the literal independently prescribed paint colours in their native order,
    // consuming distinct calls for two logically distinct equal-colour passes.
    let nextPaint = 0;
    for (const call of row.calls) if (call.colour === row.wantedStyles[nextPaint]) nextPaint++;
    expect.soft(nextPaint, `${row.variant}: actual literal paint colour sequence ${JSON.stringify(row.calls.map(c => c.colour))}`).toBe(row.wantedStyles.length);
    expect.soft(row.mismatches, `${row.state} ${row.variant}: independent colour/pen/baseline/clip replay`).toBe(0);
    for (const paint of row.logicalPaints) {
      expect.soft(paint.exclusivePixels, `${row.variant}: logical pass ${paint.pass} has observable colour`).toBeGreaterThan(0);
      expect.soft(paint.colourMismatches, `${row.variant}: actual logical paint colour ${paint.wantedStyle}`).toBe(0);
    }
    expect.soft(row.fractional, row.variant).toBeGreaterThan(0);
    expect.soft(row.opaqueMutation, row.variant).toBeGreaterThan(0);
    for (const differences of row.missingPaintMutations) expect.soft(differences, row.variant).toBeGreaterThan(0);
    expect.soft(row.accessibleName).toBe('Hdgy');
    if (row.variant !== 'equal-raw') {
      expect.soft(row.overlap, row.variant).toBeGreaterThan(0);
      expect.soft(row.missingShadowMismatch, row.variant).toBeGreaterThan(0);
      expect.soft(row.unshiftedMismatch, row.variant).toBeGreaterThan(0);
    }
    if (row.variant === 'distinct-display') expect.soft(row.reverseMismatch, row.variant).toBeGreaterThan(0);
  }
});

// #646 calibration retains the native counterexample. Keeping this separate
// from the fixed-surface replay detects a silent return to mixed surface sizes.
test('declared title surface distinguishes the WebKitGTK mixed-size raster', async ({ page, servers }, info) => {
  await openHarness(page, servers, 'source');
  const row = await page.evaluate(async () => {
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const raster = (width, height) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.font = '16px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif';
      ctx.globalAlpha = .5; ctx.fillStyle = '#2050a0'; ctx.fillText('Hdgy', 0, 14);
      return ctx.getImageData(0, 0, 35, 18).data;
    };
    const declared = raster(R.TITLE_SURFACE_WIDTH, R.TITLE_SURFACE_HEIGHT), small = raster(35, 18);
    return { differingChannels: declared.reduce((sum, byte, i) => sum + Number(byte !== small[i]), 0),
      declared: [R.TITLE_SURFACE_WIDTH, R.TITLE_SURFACE_HEIGHT], small: [35, 18] };
  });
  await attachObservations(info, 'window-title-colors', 'mixed-surface-calibration', { mode: 'source', row });
  expect(row.declared).toEqual([4096, 32]);
  if (info.project.name.startsWith('webkit') && process.platform === 'linux') {
    expect(row.differingChannels, '#646 finite native surface-size counterexample remains discriminating').toBeGreaterThan(0);
  }
});
