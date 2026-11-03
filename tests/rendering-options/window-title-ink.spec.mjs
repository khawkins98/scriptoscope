import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// #637: full-request fallback ink, including faint nonzero-alpha cedilla rows.
// Independent rules remain unchanged; no platform-specific expected pixel size.
const TITLE = `Tools ${'WINDOW '.repeat(12)}Ç`;
for (const mode of ['source', 'built']) {
  test(`${mode}: cedilla full-request style preserves ink at the decoded baseline`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, title }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const R = await import('/tests/rendering-options/window-title-rules.mjs');
      const decoded = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
      const rows = [];
      for (const key of ['document-window', 'titled-utility-window']) for (const width of [240, 1200]) {
        const theme = await api.loadTheme('/themes/1984'); R.isolateGlyphs(theme);
        const wt = decoded.manifest.windowTypes[key], height = R.topTitleHeight(wt);
        const style = R.resolveTitleStyle(title, key, height);
        const calls = [], fill = CanvasRenderingContext2D.prototype.fillText;
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
            calls.push({ text, font: this.font, args }); return fill.call(this, text, ...args);
          };
          win = await api.renderWindow(theme, { title, width, height: 120, windowType: key, state: 'active' });
        } finally { CanvasRenderingContext2D.prototype.fillText = fill; }
        const c = win._scriptoscopeComposed, plate = R.plateOf(c), t4p = c.titleRect;
        const a = decoded.assets.find(a => a.path === wt.chrome.active);
        const tf = R.textFreeChrome(api.composeWindowChrome, new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, c, { titleLength: title.length, maxSW: 2400 });
        const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : [], drawn = calls.at(-1);
        const room = Math.min(t4p.w + 2, Math.max(plate.x + plate.w - t4p.x, t4p.w));
        const expected = R.fittedTitle(title, style, room), reference = R.titleReference(expected, style);
        const nominalContext = document.createElement('canvas').getContext('2d'); nominalContext.font = reference.font;
        const displayedMetrics = nominalContext.measureText(expected);
        const displayedNominalAscent = Math.max(1, Math.ceil(displayedMetrics.actualBoundingBoxAscent || style.size * .72));
        const publicationBaseline = Math.max(height - 4, displayedNominalAscent);
        // Actual painter font is diagnostic only, never an input to expected style.
        const actualReference = R.titleReference(title, R.titleFontStyle(drawn.font));
        rows.push({ key, width, title, height, style, drawn, observedStyle: R.titleFontStyle(drawn.font),
          expected, reference, actualReference, displayedNominalAscent, publicationBaseline,
          fitBaseline: style.baseline, t4p, plate, matched: !!tf, box: R.bbox(ink),
          outsideClip: R.inside(ink, R.decodedClip(t4p)).length, outsidePlate: R.inside(ink, plate).length,
          accessibleName: win.getAttribute('aria-label') });
        theme.dispose?.();
      }
      return rows;
    }, { mode, title: TITLE });
    await attachObservations(info, 'window-title-ink', mode, { mode, rows });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const label = `${row.key} width=${row.width}`;
      expect.soft(row.matched, label).toBe(true);
      expect.soft(row.style.reference.unclipped, label).toBe(true);
      expect.soft(row.reference.unclipped, label).toBe(true);
      expect.soft(row.observedStyle, `${label}: full-request family/face/size`).toEqual(row.reference.fontStyle);
      expect.soft(row.drawn.text, `${label}: longest fitting prefix`).toBe(row.expected);
      expect.soft(row.t4p.h, `${label}: unchanged decoded clip`).toBe(row.height);
      expect.soft(row.box?.t, `${label}: every top ink row at unchanged publication baseline`).toBe(row.t4p.y + row.publicationBaseline + row.reference.box.t);
      expect.soft(row.box?.b, `${label}: every bottom ink row at unchanged publication baseline`).toBe(row.t4p.y + row.publicationBaseline + row.reference.box.b);
      const actualBaseline = Math.max(row.t4p.h - 4, row.actualReference.ascent);
      expect.soft(actualBaseline + row.actualReference.fullBox.t, `${label}: actual font retains faint full-request top row`).toBeGreaterThanOrEqual(0);
      expect.soft(actualBaseline + row.actualReference.fullBox.b, `${label}: actual font retains full-request bottom row`).toBeLessThanOrEqual(row.t4p.h);
      if (row.width === 1200) {
        expect.soft(row.drawn.text, `${label}: wide request remains whole`).toBe(TITLE);
        expect.soft(row.box?.r - row.box?.l, `${label}: complete glyph width`).toBe(row.reference.box.r - row.reference.box.l);
      }
      expect.soft(row.outsideClip, label).toBe(0);
      expect.soft(row.outsidePlate, label).toBe(0);
      expect.soft(row.accessibleName, label).toBe(TITLE);
    }
  });

  test(`${mode}: same cedilla request rejects prefix-only painter style`, async ({ page, servers }, info) => {
    const rows = [];
    for (const mutated of [false, true]) {
      await openHarness(page, servers, mode);
      rows.push(await page.evaluate(async ({ mode, title, mutated }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const R = await import('/tests/rendering-options/window-title-rules.mjs');
        const theme = await api.loadTheme('/themes/1984'); R.isolateGlyphs(theme);
        const key = 'titled-utility-window', h = R.topTitleHeight(theme.manifest.windowTypes[key]);
        const required = R.resolveTitleStyle(title, key, h), calls = [];
        const fill = CanvasRenderingContext2D.prototype.fillText;
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function painter(text, ...args) {
            if (text !== title && text.endsWith('…')) {
              CanvasRenderingContext2D.prototype.fillText = fill;
              let prefix;
              try { prefix = R.resolveTitleStyle(text, key, h); }
              finally { CanvasRenderingContext2D.prototype.fillText = painter; }
              if (mutated) this.font = prefix.reference.font;
              calls.push({ text, style: R.titleFontStyle(this.font), prefix: prefix.reference.fontStyle });
            }
            return fill.call(this, text, ...args);
          };
          win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key });
        } finally { CanvasRenderingContext2D.prototype.fillText = fill; theme.dispose?.(); }
        return { mutated, required: required.reference.fontStyle, draw: calls.at(-1),
          clip: win._scriptoscopeComposed.titleRect, plate: R.plateOf(win._scriptoscopeComposed), name: win.getAttribute('aria-label') };
      }, { mode, title: TITLE, mutated }));
    }
    await attachObservations(info, 'window-title-ink', `${mode}-prefix-only`, { mode, rows });
    for (const row of rows) {
      expect(row.draw, 'truncated painter reached').toBeDefined();
      expect(row.draw.prefix.size, 'mutation must discriminate full-request style').toBeGreaterThan(row.required.size);
      if (row.mutated) {
        expect(row.draw.style).toEqual(row.draw.prefix);
        expect(row.draw.style).not.toEqual(row.required);
      } else expect.soft(row.draw.style, 'unmutated full-request style').toEqual(row.required);
      expect(row.name).toBe(TITLE);
    }
    expect(rows[1].draw.text).toBe(rows[0].draw.text);
    expect(rows[1].clip).toEqual(rows[0].clip);
    expect(rows[1].plate).toEqual(rows[0].plate);
  });
}

// P1-G / c09e8d21: independently construct guarded paint windows and owned
// queries from the adopted contract. This is finite native-premise falsification,
// not a proof for arbitrary fonts or an import of candidate geometry code.
for (const mode of ['source', 'built']) test(`${mode}: P1-G guarded queries preserve owned exterior coverage and phase`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const result = await page.evaluate(async () => {
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const axis = (u, v, l, r) => {
      const anchor = Math.max(l, Math.min(r, (u + v) / 2));
      return { lo: Math.min(u, Math.floor(anchor)) - 1, hi: Math.max(v, Math.ceil(anchor)) + 1, anchor };
    };
    const plan = (metric, size, clip) => {
      if (!(size > 0 && size <= 16) || !Object.values(metric).every(Number.isFinite) || metric.l > metric.r || metric.t > metric.b) throw new Error('Independent guarded geometry unavailable');
      const g = size + 1;
      const envelope = { l: Math.floor(metric.l - g), r: Math.ceil(metric.r + g), t: Math.floor(metric.t - g), b: Math.ceil(metric.b + g) };
      const queries = [];
      for (let t = envelope.t; t < envelope.b; t += 30) for (let l = envelope.l; l < envelope.r; l += 4094) {
        const q = { l, r: Math.min(l + 4094, envelope.r), t, b: Math.min(t + 30, envelope.b) };
        const x = axis(q.l, q.r, metric.l, metric.r), y = axis(q.t, q.b, metric.t, metric.b);
        const p = { l: x.lo, r: x.hi, t: y.lo, b: y.hi };
        const outsideRows = Math.max(0, Math.min(q.b, clip.t) - q.t) + Math.max(0, q.b - Math.max(q.t, clip.b));
        queries.push({ q, p, anchor: { x: x.anchor, y: y.anchor }, width: p.r - p.l, height: p.b - p.t,
          xBound: Math.max(q.r - q.l + 2, Math.ceil(g) + 3), yBound: Math.max(q.b - q.t + 2, Math.ceil(g) + 3),
          exteriorArea: (q.r - q.l) * outsideRows });
      }
      let overlapArea = 0;
      for (let i = 0; i < queries.length; i++) for (let j = i + 1; j < queries.length; j++) {
        const a = queries[i].q, b = queries[j].q;
        overlapArea += Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      }
      const width = envelope.r - envelope.l, height = envelope.b - envelope.t;
      return { metric, size, g, clip, envelope, queries, overlapArea, expectedQueries: Math.ceil(width / 4094) * Math.ceil(height / 30),
        queryArea: queries.reduce((sum, { q }) => sum + (q.r - q.l) * (q.b - q.t), 0), envelopeArea: width * height,
        exteriorArea: queries.reduce((sum, q) => sum + q.exteriorArea, 0),
        expectedExteriorArea: width * (height - Math.max(0, Math.min(envelope.b, clip.b) - Math.max(envelope.t, clip.t))) };
    };
    const geometryInputs = [
      { name: 'wide-partial-core-fringe-corners', size: 16, metric: { l: 100.25, r: 8300.75, t: 21.125, b: 66.875 } },
      { name: 'signed-bearing-negative-descent', size: 12, metric: { l: -3.75, r: 21.125, t: -14.5, b: -2.25 } },
      { name: 'fractional-point', size: 15.5, metric: { l: -.25, r: -.25, t: -.75, b: -.75 }, expectedEnvelope: [-17, -18, 17, 16] },
      { name: 'vertical-line', size: 10, metric: { l: 6.5, r: 6.5, t: -60.25, b: 60.25 } },
      { name: 'horizontal-line', size: 16, metric: { l: -5000.25, r: 5000.25, t: 1.5, b: 1.5 } },
      { name: 'zero-metric-point', size: 16, metric: { l: 0, r: 0, t: 0, b: 0 } },
      { name: 'fractional-halo-not-rounded-ceil-bound', size: 10.25, metric: { l: .75, r: 4082.9, t: .75, b: 18.9 }, expectedEnvelope: [-11, -11, 4095, 31], fringeExtent: 15 },
      { name: 'exact-full-query', size: 10, metric: { l: 0, r: 4072, t: 0, b: 8 }, expectedEnvelope: [-11, -11, 4083, 19] },
    ];
    const geometry = geometryInputs.map(input => ({ name: input.name, expectedEnvelope: input.expectedEnvelope, fringeExtent: input.fringeExtent, ...plan(input.metric, input.size, { t: 0, b: 12 }) }));
    const rejected = [];
    for (const metric of [{ l: 1, r: 0, t: 0, b: 1 }, { l: 0, r: 1, t: 1, b: 0 }, { l: NaN, r: 1, t: 0, b: 1 }, { l: 0, r: Infinity, t: 0, b: 1 }]) {
      try { plan(metric, 16, { t: 0, b: 12 }); rejected.push(false); } catch { rejected.push(true); }
    }
    const cases = [];
    const titles = ['j---', 'Áj\u0323\u0301\u0308Ç', `j${'WINDOW '.repeat(96)}Ç\u0323`];
    for (const title of titles) for (const size of [10, 16]) for (const face of ['normal', 'bold']) for (const phase of [0, .5]) cases.push({ title, size, face, phaseX: phase, phaseY: phase, kind: 'retained-positive' });
    const cedilla = `Tools ${'WINDOW '.repeat(12)}Ç`;
    cases.push({ title: cedilla, size: 12, face: 'bold', phaseX: 0, phaseY: 0, kind: 'previous-red-exact-input' }, { title: cedilla, size: 10, face: 'bold', phaseX: 0, phaseY: 0, kind: 'same-input-fitting-control' });
    cases.push({ title: titles[0], size: 16, face: 'bold', phaseX: .5, phaseY: 0, kind: 'mixed-axis-phase' }, { title: titles[0], size: 16, face: 'bold', phaseX: 0, phaseY: .5, kind: 'mixed-axis-phase' });
    cases.push({ title: titles[0], size: 15.5, face: 'normal', phaseX: .5, phaseY: 0, kind: 'fractional-size' }, { title: titles[0], size: 10.25, face: 'bold', phaseX: 0, phaseY: .5, kind: 'fractional-size' });
    const rows = [];
    for (const input of cases) {
      const full = document.createElement('canvas'); full.width = R.TITLE_SURFACE_WIDTH; full.height = R.TITLE_SURFACE_HEIGHT;
      const referenceWidth = 8192, referenceHeight = 128;
      const c = full.getContext('2d'), penX = 64 + input.phaseX, baseline = 64 + input.phaseY;
      const font = `${input.face} ${input.size}px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif`;
      c.font = font; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.letterSpacing = '0px';
      const m = c.measureText(input.title), nominal = Math.max(1, Math.ceil(m.actualBoundingBoxAscent || input.size * .72));
      const clipHeight = input.face === 'bold' ? 12 : 18, clipTop = 64 - Math.max(clipHeight - 4, nominal);
      const construction = plan({ l: penX - m.actualBoundingBoxLeft, r: penX + m.actualBoundingBoxRight, t: baseline - m.actualBoundingBoxAscent, b: baseline + m.actualBoundingBoxDescent }, input.size, { t: clipTop, b: clipTop + clipHeight });
      const E = construction.envelope;
      if (E.l < 1 || E.r >= referenceWidth || E.t < 1 || E.b >= referenceHeight) throw new Error('Independent guarded oracle exceeds fixed unclipped reference');
      // Independent reference placement: baseline near the centre of the
      // declared surface, with horizontal strips on a different grid from E.
      const image = new Uint8ClampedArray(referenceWidth * referenceHeight * 4);
      for (let left = 0; left < referenceWidth; left += 4094) {
        const w = Math.min(4094, referenceWidth - left);
        c.clearRect(0, 0, full.width, full.height);
        c.fillText(input.title, penX - left + 1, 20 + input.phaseY);
        const strip = c.getImageData(1, 0, w, 32).data;
        for (let y = 0; y < 32; y++) image.set(strip.subarray(y * w * 4, (y + 1) * w * 4), ((y + 44) * referenceWidth + left) * 4);
      }
      let referenceInk = 0, outsideEnvelope = 0, border = 0;
      for (let y = 0; y < referenceHeight; y++) for (let x = 0; x < referenceWidth; x++) if (image[(y * referenceWidth + x) * 4 + 3]) {
        referenceInk++; if (x < E.l || x >= E.r || y < E.t || y >= E.b) outsideEnvelope++;
        if (!x || !y || x === referenceWidth - 1 || y === referenceHeight - 1) border++;
      }
      const tile = document.createElement('canvas'); tile.height = R.TITLE_SURFACE_HEIGHT; tile.width = R.TITLE_SURFACE_WIDTH;
      let exteriorMismatch = 0, allQueryMismatch = 0, insetMutationMismatch = 0, referenceExteriorInk = 0, observedExteriorInk = 0, queriedExteriorArea = 0;
      const paints = [];
      for (const placement of construction.queries) {
        if (!placement.exteriorArea) continue;
        const { q, p } = placement, qw = q.r - q.l, qh = q.b - q.t;
        const ctx = tile.getContext('2d'); ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
        ctx.clearRect(0, 0, tile.width, tile.height);
        ctx.fillText(input.title, penX - p.l, baseline - p.t);
        paints.push({ q, p, anchor: placement.anchor, width: tile.width, height: tile.height, font: ctx.font, penX: penX - p.l, baseline: baseline - p.t,
          phaseX: (penX - p.l) - Math.floor(penX - p.l), phaseY: (baseline - p.t) - Math.floor(baseline - p.t) });
        // Interior read pixels are diagnostic only. Only owned absolute exterior
        // rows contribute to the fit comparison, never paint-window guard ink.
        let rgba = ctx.getImageData(q.l - p.l, q.t - p.t, qw, qh).data;
        for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) {
          const ax = q.l + x, ay = q.t + y, expected = image[(ay * referenceWidth + ax) * 4 + 3], actual = rgba[(y * qw + x) * 4 + 3];
          if (expected !== actual) allQueryMismatch++;
          if (ay >= construction.clip.t && ay < construction.clip.b) continue;
          queriedExteriorArea++; if (expected) referenceExteriorInk++; if (actual) observedExteriorInk++;
          if (expected !== actual) exteriorMismatch++;
        }
        rgba = null;
        const wrongInset = ctx.getImageData(0, 0, qw, qh).data;
        for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) {
          const ay = q.t + y; if (ay >= construction.clip.t && ay < construction.clip.b) continue;
          if (wrongInset[(y * qw + x) * 4 + 3] !== image[(ay * referenceWidth + q.l + x) * 4 + 3]) insetMutationMismatch++;
        }
      }
      rows.push({ ...input, font: c.font, penX, baseline, referenceInk, border, outsideEnvelope, construction, paints,
        exteriorMismatch, allQueryMismatch, insetMutationMismatch, referenceExteriorInk, observedExteriorInk, queriedExteriorArea });
    }
    return { geometry, rejected, rows };
  });
  await attachObservations(info, 'window-title-ink', `${mode}-P1-G`, { mode, ...result });
  const checkGeometry = (row, label) => {
    expect.soft(row.overlapArea, `${label}: disjoint owned queries`).toBe(0);
    expect.soft(row.queries.length, `${label}: finite exact partition`).toBe(row.expectedQueries);
    expect.soft(row.queryArea, `${label}: complete envelope coverage`).toBe(row.envelopeArea);
    expect.soft(row.exteriorArea, `${label}: complete uniquely owned exterior`).toBe(row.expectedExteriorArea);
    for (const { q, p, anchor, width, height, xBound, yBound } of row.queries) {
      expect.soft(q.l >= row.envelope.l && q.r <= row.envelope.r && q.t >= row.envelope.t && q.b <= row.envelope.b && q.r > q.l && q.b > q.t && q.r - q.l <= 4094 && q.b - q.t <= 30, `${label}: nonempty owned query stays inside the finite envelope`).toBe(true);
      expect.soft([q.l - p.l, p.r - q.r, q.t - p.t, p.b - q.b].every(g => g >= 1), `${label}: four guarded query edges`).toBe(true);
      expect.soft(anchor.x > p.l && anchor.x < p.r && anchor.y > p.t && anchor.y < p.b, `${label}: strict projected metric anchor`).toBe(true);
      expect.soft(width <= 4096 && height <= 32 && width <= xBound && height <= yBound, `${label}: bounded paint plane`).toBe(true);
      expect.soft([p.l, p.r, p.t, p.b].every(Number.isSafeInteger), `${label}: integer origins preserve phase`).toBe(true);
    }
  };
  expect(result.geometry).toHaveLength(8); expect(result.rejected).toEqual([true, true, true, true]);
  for (const row of result.geometry) {
    checkGeometry(row, row.name);
    if (row.expectedEnvelope) expect([row.envelope.l, row.envelope.t, row.envelope.r, row.envelope.b], `${row.name}: halo uses size+1 before outward rounding`).toEqual(row.expectedEnvelope);
    if (row.fringeExtent) expect(row.queries.some(q => q.width === row.fringeExtent && q.height === row.fringeExtent), 'fractional fringe uses ceil(g)+3 bound').toBe(true);
  }
  expect(result.rows).toHaveLength(30);
  for (const row of result.rows) {
    const label = `${row.kind} ${row.face} ${row.size}px phase=${row.phaseX},${row.phaseY}`;
    checkGeometry(row.construction, label);
    expect.soft(row.referenceInk, label).toBeGreaterThan(0);
    expect.soft(row.border, `${label}: unclipped independent reference`).toBe(0);
    expect.soft(row.outsideEnvelope, `${label}: finite P1-envelope falsification`).toBe(0);
    expect.soft(row.queriedExteriorArea, `${label}: every owned exterior pixel visited exactly once`).toBe(row.construction.expectedExteriorArea);
    expect.soft(row.exteriorMismatch, `${label}: chosen-placement owned-query equivalence`).toBe(0);
    expect.soft(row.observedExteriorInk, `${label}: every nonzero-alpha witness retained`).toBe(row.referenceExteriorInk);
    expect.soft(row.paints.every(p => p.phaseX === row.phaseX && p.phaseY === row.phaseY), `${label}: both original coordinate phases preserved`).toBe(true);
  }
  expect(result.rows.some(row => row.referenceExteriorInk > 0), 'nonfit witness calibration').toBe(true);
  expect(result.rows.some(row => row.insetMutationMismatch > 0), 'wrong query-inset mapping must be rejected').toBe(true);
});

// TC4/TC5 replay from an independently placed raster: no assumption that a
// runtime scratch raster starts at the pen or that its row zero is baseline.
for (const mode of ['source', 'built']) test(`${mode}: coverage padding preserves title colour pass placement`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
    const theme = await api.loadTheme('/themes/1984'), key = 'document-window', wt = theme.manifest.windowTypes[key], title = 'Hdgy';
    const style = R.resolveTitleStyle(title, key, R.topTitleHeight(wt));
    const fill = CanvasRenderingContext2D.prototype.fillText, out = [];
    try {
      for (const state of ['active', 'inactive']) for (const variant of ['equal-raw', 'raw-difference-display-equal', 'distinct-display']) {
        const text = { rgb16: [0x2101, 0x4301, 0x6501], displayRgb: [32, 80, 160] };
        const shadow = { rgb16: [...text.rgb16], displayRgb: [...text.displayRgb] };
        if (variant !== 'equal-raw') shadow.rgb16[0]++;
        if (variant === 'distinct-display') shadow.displayRgb = [180, 70, 20];
        wt.titleSamples = { [state]: { text, shadow, background: text } };
        const hex = sample => '#' + sample.displayRgb.map(n => n.toString(16).padStart(2, '0')).join('');
        const colours = [hex(text), hex(shadow)], calls = [], nativePaints = [];
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function (s, ...args) {
            if (colours.includes(this.fillStyle)) {
              this.globalAlpha = 0.5; calls.push({ text: s, font: this.font, colour: this.fillStyle, args });
            }
            const result = fill.call(this, s, ...args);
            if (colours.includes(this.fillStyle)) nativePaints.push({ args, width: this.canvas.width, height: this.canvas.height,
              rgba: this.getImageData(0, 0, this.canvas.width, this.canvas.height).data });
            return result;
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
        // Diagnostic only: prove whether the separate reference agrees with
        // every captured native pixel inside its existing scratch surface.
        // Retain the pre-pen column separately; never clip it out of replay.
        const nativePositiveDifferences = nativePaints.map((paint, i) => {
          const ref = rasters[i]; if (!ref) return null;
          let differences = 0;
          for (let y = 0; y < paint.height; y++) for (let x = 0; x < paint.width; x++) {
            const rx = 32 + x - paint.args[0], ry = 20 + y - paint.args[1];
            for (let k = 0; k < 4; k++) if (paint.rgba[(y * paint.width + x) * 4 + k] !== (ref[(ry * 256 + rx) * 4 + k] ?? 0)) differences++;
          }
          return differences;
        });
        const prePenColumn = rasters.map(rgba => Array.from({ length: 32 }, (_, y) => ({ y: y - 20, rgba: Array.from(rgba.slice((y * 256 + 31) * 4, (y * 256 + 31) * 4 + 4)) })).filter(p => p.rgba[3]));
        const replay = ({ reverse = false, unshifted = false, mainOnly = false } = {}) => {
          const expected = new Uint8ClampedArray(tf.buffer.data);
          let fractional = 0, overlap = 0; const touched = new Set();
          const order = passes.map((_, i) => i); if (reverse) order.reverse();
          for (const i of order) {
            if (mainOnly && i < passes.length - 1) continue;
            const pixels = rasters[i], offset = unshifted ? 0 : passes[i][1];
            for (let y = 0; y < 32; y++) for (let x = 0; x < 256; x++) {
              const p = (y * 256 + x) * 4, alpha = pixels[p + 3];
              const dx = rect.x + x - 32 + offset, dy = baseline + y - 20 + offset;
              if (!alpha || dx < rect.x || dx >= rect.x + rect.w + 2 || dy < rect.y || dy >= rect.y + rect.h) continue;
              if (alpha < 255) fractional++;
              const d = (dy * c.buffer.width + dx) * 4;
              if (touched.has(d)) overlap++; touched.add(d);
              for (let k = 0; k < 3; k++) expected[d + k] = Math.round((pixels[p + k] * alpha + expected[d + k] * (255 - alpha)) / 255);
              expected[d + 3] = Math.round(alpha + expected[d + 3] * (255 - alpha) / 255);
            }
          }
          let mismatches = 0; const firstDifferences = [];
          for (let i = 0; i < expected.length; i++) if (expected[i] !== c.buffer.data[i]) {
            mismatches++; if (firstDifferences.length < 12) firstDifferences.push({ x: Math.floor(i / 4) % c.buffer.width, y: Math.floor(i / 4 / c.buffer.width), channel: i % 4, expected: expected[i], actual: c.buffer.data[i] });
          }
          return { mismatches, fractional, overlap, firstDifferences };
        };
        out.push({ state, variant, calls, nativePositiveDifferences, prePenColumn, style: style.reference.fontStyle, rect, baseline, ...replay(),
          reverseMismatch: replay({ reverse: true }).mismatches, unshiftedMismatch: replay({ unshifted: true }).mismatches,
          missingShadowMismatch: replay({ mainOnly: true }).mismatches, accessibleName: win.getAttribute('aria-label') });
      }
    } finally { CanvasRenderingContext2D.prototype.fillText = fill; theme.dispose?.(); }
    return out;
  }, mode);
  await attachObservations(info, 'window-title-ink', `${mode}-colour-origin`, { mode, rows });
  expect(rows).toHaveLength(6);
  for (const row of rows) {
    expect.soft(row.mismatches, `${row.state} ${row.variant}: independent colour/pen/baseline/clip replay`).toBe(0);
    expect.soft(row.fractional, row.variant).toBeGreaterThan(0);
    expect.soft(row.accessibleName).toBe('Hdgy');
    if (row.variant !== 'equal-raw') {
      expect.soft(row.overlap, row.variant).toBeGreaterThan(0);
      expect.soft(row.missingShadowMismatch, row.variant).toBeGreaterThan(0);
      expect.soft(row.unshiftedMismatch, row.variant).toBeGreaterThan(0);
    }
    if (row.variant === 'distinct-display') expect.soft(row.reverseMismatch, row.variant).toBeGreaterThan(0);
  }
});
