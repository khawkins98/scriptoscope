import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// #637, independent port of 02c344f7's allocation interception concept.
// These are execution safety guards, NOT adopted production budgets or a
// coverage envelope. No claim about arbitrary fallback/combining support follows.
const GUARD = { side: 8192, pixels: 2_097_152, operations: 200_000 };
for (const mode of ['source', 'built']) {
  test(`${mode}: guarded modest long and combining title resource controls`, async ({ page, servers }, info) => {
    const rows = [];
    for (const tail of ['Ç', 'j\u0323']) for (const repeats of [32, 2048]) {
      await openHarness(page, servers, mode);
      rows.push(await page.evaluate(async ({ mode, tail, repeats, guard }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const R = await import('/tests/rendering-options/window-title-rules.mjs');
        const theme = await api.loadTheme('/themes/1984'); R.isolateGlyphs(theme);
        const title = 'Palette '.repeat(repeats) + tail;
        const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        const height = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
        const read = CanvasRenderingContext2D.prototype.getImageData, fill = CanvasRenderingContext2D.prototype.fillText;
        const requests = [], draws = [];
        let error, win;
        const check = (kind, w, h) => {
          const request = { kind, width: w, height: h, pixels: w * h }; requests.push(request);
          if (!Number.isFinite(w * h) || w > guard.side || h > guard.side || w * h > guard.pixels) throw new Error(`TITLE_RESOURCE_GUARD ${JSON.stringify(request)}`);
          if (requests.length > guard.operations) throw new Error('TITLE_OPERATION_GUARD');
        };
        try {
          Object.defineProperty(HTMLCanvasElement.prototype, 'width', { ...width, set(value) {
            check('width', Number(value), this.height); width.set.call(this, value);
          } });
          Object.defineProperty(HTMLCanvasElement.prototype, 'height', { ...height, set(value) {
            check('height', this.width, Number(value)); height.set.call(this, value);
          } });
          CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, ...rest) {
            check('readback', Math.abs(w), Math.abs(h)); return read.call(this, x, y, w, h, ...rest);
          };
          CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
            draws.push({ text, font: this.font, style: R.titleFontStyle(this.font) }); return fill.call(this, text, ...args);
          };
          win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: 'titled-utility-window' });
        } catch (caught) { error = String(caught); }
        finally {
          Object.defineProperty(HTMLCanvasElement.prototype, 'width', width);
          Object.defineProperty(HTMLCanvasElement.prototype, 'height', height);
          CanvasRenderingContext2D.prototype.getImageData = read;
          CanvasRenderingContext2D.prototype.fillText = fill;
          theme.dispose?.();
        }
        const c = win?._scriptoscopeComposed;
        return { tail, repeats, titleLength: title.length, guard, error, requests, draw: draws.at(-1),
          clip: c?.titleRect, plate: c && R.plateOf(c), nameMatchesFullRequest: win?.getAttribute('aria-label') === title,
          userAgent: navigator.userAgent };
      }, { mode, tail, repeats, guard: GUARD }));
    }
    await attachObservations(info, 'window-title-resources', mode, { mode, rows });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const label = `${row.repeats} repetitions tail=${row.tail}`;
      expect.soft(row.error, `${label}: execution guard`).toBeUndefined();
      expect.soft(row.requests.length, `${label}: instrumentation reached allocations`).toBeGreaterThan(0);
      if (row.error) continue;
      expect.soft(row.nameMatchesFullRequest, label).toBe(true);
      expect.soft(row.draw?.text.endsWith('…'), `${label}: long request truncates`).toBe(true);
      expect.soft(row.draw?.style.family, label).toBe('Charcoal 12');
      expect.soft(row.draw?.style.face, label).toBe('bold');
    }
    // Metamorphic regression on these separated-word controls only: a distant
    // tail remains identical while full advance increases 64-fold. This is not
    // an oracle for an unknown coverage envelope or unknown-request behavior.
    for (const tail of ['Ç', 'j\u0323']) {
      const [modest, long] = rows.filter(row => row.tail === tail);
      if (modest.error || long.error) continue;
      expect.soft(long.draw).toEqual(modest.draw);
      expect.soft(long.clip).toEqual(modest.clip);
      expect.soft(long.plate).toEqual(modest.plate);
      // A modest request may need only a partial tile. Adopted bounds are
      // asserted by allocation role below, never by equality to this control.
    }
  });
}

// Adopted coverage-unavailable is distinct from demonstrated nonfit/TF5.
// Inject at host boundaries only; no runtime candidates or private internals.
for (const mode of ['source', 'built']) test(`${mode}: unavailable coverage rejects first render without publishing a result`, async ({ page, servers }, info) => {
  const rows = [];
  for (const failure of ['nan-left', 'infinite-descent', 'readback-security']) {
    await openHarness(page, servers, mode);
    rows.push(await page.evaluate(async ({ mode, failure }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const theme = await api.loadTheme('/themes/1984');
      const title = `Tools ${'WINDOW '.repeat(12)}Ç`;
      const measure = CanvasRenderingContext2D.prototype.measureText, read = CanvasRenderingContext2D.prototype.getImageData, fill = CanvasRenderingContext2D.prototype.fillText;
      const completeRequestContexts = new WeakSet();
      let injected = 0, completeRequestDraws = 0, unrelatedReadbacksPassed = 0, error, win;
      try {
        if (failure === 'readback-security') {
          CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
            const result = fill.call(this, text, ...args);
            if (text === title) { completeRequestContexts.add(this); completeRequestDraws++; }
            return result;
          };
          CanvasRenderingContext2D.prototype.getImageData = function (...args) {
            if (completeRequestContexts.has(this)) { injected++; throw new DOMException('Independent complete-request coverage failure', 'SecurityError'); }
            unrelatedReadbacksPassed++; return read.apply(this, args);
          };
        } else {
          CanvasRenderingContext2D.prototype.measureText = function (text) {
            const metrics = measure.call(this, text);
            if (text !== title) return metrics;
            injected++;
            const field = failure === 'nan-left' ? 'actualBoundingBoxLeft' : 'actualBoundingBoxDescent';
            return new Proxy(metrics, { get(target, key) { return key === field ? (failure === 'nan-left' ? NaN : Infinity) : Reflect.get(target, key, target); } });
          };
        }
        win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: 'titled-utility-window' });
      } catch (caught) { error = { name: caught.name, message: caught.message }; }
      finally { CanvasRenderingContext2D.prototype.measureText = measure; CanvasRenderingContext2D.prototype.getImageData = read; CanvasRenderingContext2D.prototype.fillText = fill; }
      const recovered = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: 'titled-utility-window' });
      theme.dispose?.();
      return { failure, injected, completeRequestDraws, unrelatedReadbacksPassed, error, resultReturned: !!win, recoveredName: recovered.getAttribute('aria-label'), title };
    }, { mode, failure }));
  }
  await attachObservations(info, 'window-title-resources', `${mode}-unavailable`, { mode, rows });
  for (const row of rows) {
    expect.soft(row.injected, row.failure).toBeGreaterThan(0);
    if (row.failure === 'readback-security') expect.soft(row.completeRequestDraws, 'fault targets a context that drew the identical complete request').toBeGreaterThan(0);
    expect.soft(row.error, `${row.failure}: consuming operation rejects unavailable coverage`).toBeDefined();
    expect.soft(row.resultReturned, `${row.failure}: no TF5 or smaller successful result`).toBe(false);
    expect.soft(row.recoveredName, `${row.failure}: recovery retains complete title`).toBe(row.title);
  }
});

for (const mode of ['source', 'built']) test(`${mode}: shared recipe and procedural titles keep measurement and publication bounded`, async ({ page, servers }, info) => {
  const rows = [];
  for (const slug of ['1984', 'platinum-8']) for (const key of ['document-window', 'titled-utility-window']) {
    await openHarness(page, servers, mode);
    rows.push(await page.evaluate(async ({ mode, slug, key, guard }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const theme = await api.loadTheme(`/themes/${slug}`);
      const title = 'Palette '.repeat(32) + 'Ç';
      const measure = CanvasRenderingContext2D.prototype.measureText, fill = CanvasRenderingContext2D.prototype.fillText, read = CanvasRenderingContext2D.prototype.getImageData;
      const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'), height = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
      const ids = new WeakMap(); let serial = 0;
      const id = canvas => { if (!ids.has(canvas)) ids.set(canvas, ++serial); return ids.get(canvas); };
      const events = [], requests = [];
      const request = (kind, canvas, w, h) => {
        requests.push({ kind, id: id(canvas), width: w, height: h, pixels: w * h,
          canvasWidth: canvas.width, canvasHeight: canvas.height,
          coObservedPairBytes: kind === 'readback' ? 4 * (canvas.width * canvas.height + w * h) : undefined });
        if (w > guard.side || h > guard.side || w * h > guard.pixels || requests.length > guard.operations) throw new Error('TITLE_RESOURCE_GUARD');
      };
      let win, error;
      try {
        Object.defineProperty(HTMLCanvasElement.prototype, 'width', { ...width, set(value) { request('width', this, Number(value), this.height); width.set.call(this, value); } });
        Object.defineProperty(HTMLCanvasElement.prototype, 'height', { ...height, set(value) { request('height', this, this.width, Number(value)); height.set.call(this, value); } });
        CanvasRenderingContext2D.prototype.measureText = function (text) {
          events.push({ kind: 'measure', id: id(this.canvas), full: text === title, width: this.canvas.width, height: this.canvas.height }); return measure.call(this, text);
        };
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          events.push({ kind: 'draw', id: id(this.canvas), full: text === title, text, font: this.font,
            width: this.canvas.width, height: this.canvas.height, args, align: this.textAlign, baseline: this.textBaseline,
            transform: Array.from(this.getTransform().toFloat64Array()), spacing: this.letterSpacing });
          return fill.call(this, text, ...args);
        };
        CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, ...rest) {
          request('readback', this.canvas, Math.abs(w), Math.abs(h)); return read.call(this, x, y, w, h, ...rest);
        };
        win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key });
      } catch (caught) { error = String(caught); }
      finally {
        Object.defineProperty(HTMLCanvasElement.prototype, 'width', width); Object.defineProperty(HTMLCanvasElement.prototype, 'height', height);
        CanvasRenderingContext2D.prototype.measureText = measure; CanvasRenderingContext2D.prototype.fillText = fill; CanvasRenderingContext2D.prototype.getImageData = read;
        theme.dispose?.();
      }
      const output = win?.querySelector('canvas');
      const drawnIds = new Set(events.filter(e => e.kind === 'draw').map(e => e.id));
      const coverageIds = slug === '1984' ? [...new Set(events.filter(e => e.kind === 'draw' && e.full).map(e => e.id))] : [];
      const publicationIds = [...drawnIds].filter(id => !coverageIds.includes(id));
      const metricsOnlyIds = [...new Set(events.filter(e => e.kind === 'measure' && !drawnIds.has(e.id)).map(e => e.id))];
      return { slug, key, events, requests, error,
        roles: { coverageIds, publicationIds, metricsOnlyIds },
        cumulativeSetterTargetPixels: requests.filter(r => r.kind !== 'readback').reduce((sum, r) => sum + r.pixels, 0),
        cumulativeReadbackPixels: requests.filter(r => r.kind === 'readback').reduce((sum, r) => sum + r.pixels, 0),
        retainedReadbackDataInInstrumentation: false, output: output && { id: id(output), width: output.width, height: output.height }, name: win?.getAttribute('aria-label'), title };
    }, { mode, slug, key, guard: GUARD }));
  }
  await attachObservations(info, 'window-title-resources', `${mode}-shared`, { mode, rows });
  for (const row of rows) {
    const label = `${row.slug} ${row.key}`;
    expect.soft(row.error, label).toBeUndefined();
    if (row.error) continue;
    expect.soft(row.name, label).toBe(row.title);
    expect.soft(row.events.some(event => event.kind === 'measure' && event.full), `${label}: full advance is measured`).toBe(true);
    const draws = row.events.filter(event => event.kind === 'draw');
    expect.soft(draws.length, label).toBeGreaterThan(0);
    // A procedural pass with truncateTo undefined deliberately paints the full
    // request into its bounded destination. Text identity alone is not phase.
    const observationIds = new Set(row.roles.coverageIds);
    expect.soft(observationIds.size, `${label}: one reused coverage canvas`).toBeLessThanOrEqual(1);
    const firstFullMeasure = row.events.findIndex(e => e.kind === 'measure' && e.full);
    const firstDraw = row.events.findIndex(e => e.kind === 'draw');
    expect.soft(firstFullMeasure, `${label}: full advance precedes painting`).toBeLessThan(firstDraw);
    for (const draw of draws) {
      if (observationIds.has(draw.id)) {
        expect.soft(draw.width, `${label}: coverage scratch width`).toBeLessThanOrEqual(4096);
        expect.soft(draw.height, `${label}: coverage scratch height`).toBeLessThanOrEqual(32);
        expect.soft(draw.args.length, `${label}: no maxWidth compression`).toBe(2);
      } else {
        expect.soft(draw.width, `${label}: publication follows destination output width`).toBeLessThanOrEqual(row.output.width);
        expect.soft(draw.height, `${label}: publication follows destination output height`).toBeLessThanOrEqual(row.output.height);
      }
      expect.soft(draw.width * draw.height, `${label}: bounded publication storage`).toBeLessThanOrEqual(Math.max(4096 * 32, row.output.width * row.output.height));
    }
    for (const request of row.requests.filter(request => observationIds.has(request.id))) {
      // A zero-area reset dimension carries no pixel backing; retain it in
      // receipts, but apply the storage shape bound only to nonzero planes.
      if (request.width === 0 || request.height === 0) continue;
      expect.soft(request.width, `${label}: observation allocation/readback width`).toBeLessThanOrEqual(4096);
      expect.soft(request.height, `${label}: observation allocation/readback height`).toBeLessThanOrEqual(32);
      if (request.kind === 'readback') expect.soft(request.coObservedPairBytes, `${label}: explicit coverage canvas plus current readback`).toBeLessThanOrEqual(1_048_576);
    }
  }
});

for (const mode of ['source', 'built']) test(`${mode}: resource guard rejects full-advance allocation mutation before storage`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const row = await page.evaluate(async ({ mode, guard }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const theme = await api.loadTheme('/themes/1984'), title = 'Palette '.repeat(2048) + 'Ç';
    const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '16px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif';
    const fullAdvance = Math.ceil(ctx.measureText(title).width);
    const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    let intercepted, delegatedUnsafeSetter = false, error, result;
    try {
      Object.defineProperty(HTMLCanvasElement.prototype, 'width', { ...width, set(value) {
        // Same public request, one boundary mutation: model advance-sized scratch
        // in place of the actual proposed width. Guard before invoking native storage.
        intercepted = { proposed: Number(value), mutated: fullAdvance, height: this.height };
        if (fullAdvance > guard.side || fullAdvance * this.height > guard.pixels) throw new Error('TITLE_RESOURCE_GUARD');
        delegatedUnsafeSetter = true; width.set.call(this, fullAdvance);
      } });
      result = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: 'document-window' });
    } catch (caught) { error = String(caught); }
    finally { Object.defineProperty(HTMLCanvasElement.prototype, 'width', width); theme.dispose?.(); }
    return { fullAdvance, intercepted, delegatedUnsafeSetter, error, resultReturned: !!result };
  }, { mode, guard: GUARD });
  await attachObservations(info, 'window-title-resources', `${mode}-full-width-negative`, { mode, row });
  expect(row.fullAdvance).toBeGreaterThan(GUARD.side);
  expect(row.intercepted).toBeDefined();
  expect(row.error).toContain('TITLE_RESOURCE_GUARD');
  expect(row.delegatedUnsafeSetter).toBe(false);
  expect(row.resultReturned).toBe(false);
});
