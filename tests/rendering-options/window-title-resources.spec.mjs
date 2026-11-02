import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// Modern resource contract, clarification 1ecfac934ec4a0fa14d92e07b1a1a3affeecf205.
// This safety ceiling is a test execution guard, NOT a runtime bound or title cap.
// A candidate must separately declare/prove its advance-independent scratch bound.
const GUARD = { side: 8192, pixels: 2_097_152 };
for (const mode of ['source', 'built']) {
  test(`${mode}: long title requests retain full-request style within bounded scratch`, async ({ page, servers }, info) => {
    const rows = [];
    for (const repeats of [32, 2048]) {
      // A fresh document prevents cached title observations hiding allocations.
      await openHarness(page, servers, mode);
      rows.push(await page.evaluate(async ({ mode, repeats, guard }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const R = await import('/tests/rendering-options/window-title-rules.mjs');
        const theme = await api.loadTheme('/themes/1984');
        R.isolateGlyphs(theme);
        const key = 'titled-utility-window', unit = 'Palette ', tail = 'j\u0323';
        const title = unit.repeat(repeats) + tail;
        const clipHeight = R.topTitleHeight(theme.manifest.windowTypes[key]);
        // Independently bounded whole-request reference. Spaces separate the repeated
        // Latin word; verify doubling preserves every row and linear advance, with
        // the combining-mark cluster retained intact at the end. Never rasterize the
        // longer request in this oracle or use replacement-renderer output as input.
        const bounded = unit.repeat(32) + tail, doubled = unit.repeat(64) + tail;
        // The mark is absent from the bundled faces, so retain the full declared
        // substitute stack for system fallback and shaping as well. The existing
        // simpler title oracle intentionally remains unchanged.
        const font = size => `bold ${size}px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif`;
        const raster = (text, size) => {
          const canvas = document.createElement('canvas');
          canvas.width = 8192; canvas.height = 128;
          const ctx = canvas.getContext('2d');
          ctx.font = font(size);
          const metrics = ctx.measureText(text);
          if (metrics.width > 8000) throw new Error('Reference input exceeds fixed independent raster');
          ctx.fillText(text, 32, 64);
          const rgba = ctx.getImageData(0, 0, 8192, 128).data;
          let top = 128, bottom = 0, edge = false;
          for (let y = 0; y < 128; y++) for (let x = 0; x < 8192; x++) {
            if (!rgba[(y * 8192 + x) * 4 + 3]) continue;
            top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
            edge ||= x === 0 || x === 8191 || y === 0 || y === 127;
          }
          return { fullBox: { t: top - 64, b: bottom - 64 }, unclipped: !edge && bottom > top,
            ascent: Math.ceil(metrics.actualBoundingBoxAscent), advance: metrics.width,
            font: ctx.font, fontStyle: { face: 'bold', size, family: 'Charcoal 12' } };
        };
        const resolve = text => {
          for (let size = 16; size > 0; size--) {
            const reference = raster(text, size), baseline = Math.max(clipHeight - 4, reference.ascent);
            if (baseline + reference.fullBox.t >= 0 && baseline + reference.fullBox.b <= clipHeight) return { size, reference };
          }
          throw new Error('Independent reference has no fitting style');
        };
        const style = resolve(bounded);
        const reference = style.reference, twice = raster(doubled, style.size);
        const prefix = resolve(unit.repeat(32));
        const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
        const read = CanvasRenderingContext2D.prototype.getImageData;
        const fill = CanvasRenderingContext2D.prototype.fillText;
        const requests = [], draws = [];
        let error, win;
        const check = (kind, width, height) => {
          const request = { kind, width, height, pixels: width * height };
          requests.push(request);
          if (width > guard.side || height > guard.side || width * height > guard.pixels) {
            throw new Error(`TITLE_RESOURCE_GUARD ${JSON.stringify(request)}`);
          }
          // Finite harness budget, generously proportional to input. This catches
          // runaway retries; the runtime's termination proof remains a separate gate.
          if (requests.length > 64 * (title.length + 1)) throw new Error('TITLE_OPERATION_GUARD');
        };
        try {
          Object.defineProperty(HTMLCanvasElement.prototype, 'width', { ...widthDescriptor, set(value) {
            check('width', Number(value), this.height); widthDescriptor.set.call(this, value);
          } });
          Object.defineProperty(HTMLCanvasElement.prototype, 'height', { ...heightDescriptor, set(value) {
            check('height', this.width, Number(value)); heightDescriptor.set.call(this, value);
          } });
          CanvasRenderingContext2D.prototype.getImageData = function (x, y, width, height, ...rest) {
            check('readback', Math.abs(width), Math.abs(height));
            return read.call(this, x, y, width, height, ...rest);
          };
          CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
            draws.push({ text, style: R.titleFontStyle(this.font) });
            return fill.call(this, text, ...args);
          };
          win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key });
        } catch (caught) { error = String(caught); }
        finally {
          Object.defineProperty(HTMLCanvasElement.prototype, 'width', widthDescriptor);
          Object.defineProperty(HTMLCanvasElement.prototype, 'height', heightDescriptor);
          CanvasRenderingContext2D.prototype.getImageData = read;
          CanvasRenderingContext2D.prototype.fillText = fill;
        }
        const c = win?._scriptoscopeComposed;
        const plate = c && R.plateOf(c);
        const room = c && Math.min(c.titleRect.w + 2, Math.max(plate.x + plate.w - c.titleRect.x, c.titleRect.w));
        // Full input measurement uses no canvas storage/readback. Enumerate only
        // bounded prefixes: every later prefix contains more positive-advance words.
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = reference.font;
        let expected;
        if (room) {
          for (let n = bounded.length - 1; n >= 0; n--) {
            const candidate = bounded.slice(0, n) + '…';
            if (Math.ceil(measure.measureText(candidate).width) <= room || n === 0) { expected = candidate; break; }
          }
        }
        const result = { repeats, titleLength: title.length, tail, clipHeight, guard, error,
          requests, finalDraw: draws.at(-1), expected, required: reference.fontStyle,
          prefixStyle: prefix.reference.fontStyle, reference, twice,
          fullAdvance: Math.ceil(measure.measureText(title).width),
          unitAdvance: measure.measureText(unit).width,
          referenceUnitDelta: twice.advance - reference.advance,
          titleRect: c?.titleRect, plate, accessibleName: win?.getAttribute('aria-label') };
        theme.dispose?.();
        return result;
      }, { mode, repeats, guard: GUARD }));
    }
    await attachObservations(info, 'window-title-resources', mode, { mode, rows });
    for (const row of rows) {
      const label = `${mode} repetitions=${row.repeats}`;
      expect.soft(row.error, `${label}: guarded resource requests`).toBeUndefined();
      expect.soft(row.reference.unclipped, label).toBe(true);
      expect.soft(row.twice.unclipped, label).toBe(true);
      expect.soft(row.reference.fullBox.t, `${label}: repeated request top`).toBe(row.twice.fullBox.t);
      expect.soft(row.reference.fullBox.b, `${label}: repeated request bottom`).toBe(row.twice.fullBox.b);
      expect.soft(row.referenceUnitDelta, `${label}: repeated shaping advance`).toBe(32 * row.unitAdvance);
      expect.soft(row.required.size, `${label}: tail beyond truncation changes fit`).toBeLessThan(row.prefixStyle.size);
      if (!row.error) {
        expect.soft(row.finalDraw?.style, `${label}: full request style`).toEqual(row.required);
        expect.soft(row.finalDraw?.text, `${label}: longest fitting prefix`).toBe(row.expected);
        expect.soft(row.finalDraw?.text.endsWith('…'), `${label}: truncated`).toBe(true);
        expect.soft(row.accessibleName, `${label}: full accessible request`).toBe('Palette '.repeat(row.repeats) + row.tail);
      }
    }
    expect(rows[1].fullAdvance).toBeGreaterThan(rows[0].fullAdvance * 50);
    if (rows.every(row => !row.error)) {
      expect(rows[1].finalDraw).toEqual(rows[0].finalDraw);
      expect(rows[1].titleRect).toEqual(rows[0].titleRect);
      expect(rows[1].plate).toEqual(rows[0].plate);
    }
  });
}
