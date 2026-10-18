import { test, expect, openHarness, attachCase } from './fixtures.mjs';

async function setup(page, servers, mode, kind = 'windows-95') {
  await openHarness(page, servers, mode);
  await page.evaluate(async ({ mode, kind }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    let theme;
    if (kind === 'windows-95') theme = await api.loadTheme('/themes/windows-95');
    else {
      const elements = {};
      const asset = (id, w, h, rgba) => {
        const b = api.PixelBuffer.alloc(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.setPixel(x, y, ...rgba);
        return { sourceCicnId: id, asset: api.bufferToCanvas(b).toDataURL(), width: w, height: h, slice: { corner: 1, side: 1, tile: false } };
      };
      if (kind !== 'procedural') {
        elements.track = asset(-10131, 5, 4, [40, 50, 60, 255]);
        elements.verticalTrack = asset(-10115, 4, 5, [40, 50, 60, 255]);
        if (kind !== 'no-thumb') {
          const width = kind === 'zero-travel' ? 120 : 23;
          elements.thumb = asset(-10129, width, 64, [17, 191, 73, 255]);
          elements.verticalThumb = asset(-10113, 64, width, [17, 191, 73, 255]);
        }
      }
      theme = { baseUrl: `${location.origin}/pointer-fixture/${kind}`, manifest: { chromeElements: elements } };
    }
    const root = document.createElement('section'); root.id = 'pointer-root'; document.body.append(root);
    const handle = await api.mountDeclarative({ root, pageThemeDefault: 'fixture', bootAffordance: 'none' });
    handle.registerTheme('fixture', theme);
    const form = document.createElement('form'); form.style.cssText = 'display:grid;justify-items:start';
    form.innerHTML = '<input id="pointer-native" type="range" name="range" aria-label="Pointer range" min="0" max="100" step="1" value="25">';
    const events = [];
    for (const type of ['input', 'change']) form.addEventListener(type, e => events.push({ type, value: e.target.value }));
    form.addEventListener('pointerdown', e => { window.pointerFixture.pointerId = e.pointerId; });
    window.pointerFixture = { api, theme, root, handle, events, kind, pointerSamples: [], pointerEvents: new AbortController() };
    for (const type of ['pointerdown', 'pointermove']) window.addEventListener(type, e => { window.pointerFixture.pointerSamples.push({ type, x: e.clientX, y: e.clientY }); }, { signal: window.pointerFixture.pointerEvents.signal });
    root.append(form);
  }, { mode, kind });
  await expect(page.locator('#pointer-root .scriptoscope-slider canvas')).toHaveCount(1);
}
async function cleanup(page) {
  await page.evaluate(() => { const f = window.pointerFixture; f?.handle.disconnect(); f?.pointerEvents.abort(); f?.root.remove(); f?.theme.dispose?.(); });
}
async function setValue(page, attributes) {
  const current = await page.evaluate(async attributes => {
    const f = window.pointerFixture, input = document.getElementById('pointer-native');
    Object.assign(input, { min: '0', max: '100', step: '1', value: '25' }, attributes);
    input.dispatchEvent(new Event('input', { bubbles: true })); f.events.length = 0; f.pointerSamples.length = 0;
    const normalized = (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min));
    // This public rendering comparison only waits for the async visual setter;
    // pointer acceptance below uses independently declared thumb extents.
    const buffer = await f.api.composeSlider(f.theme, { length: 120, value: normalized })
      ?? f.api.platinumSlider({ length: 120, value: normalized });
    f.expectedPaint = f.api.bufferToCanvas(buffer).toDataURL();
    return { exact: input.value, normalized };
  }, attributes);
  await expect.poll(() => page.locator('#pointer-root .scriptoscope-slider canvas').evaluate(canvas => canvas.toDataURL() === window.pointerFixture.expectedPaint)).toBe(true);
  return current;
}
const read = page => page.evaluate(() => ({ value: document.getElementById('pointer-native').value, events: window.pointerFixture.events }));
const clear = page => page.evaluate(() => { window.pointerFixture.events.length = 0; });
const rect = page => page.evaluate(() => {
  // Query and measure atomically: async painting can replace a canvas between
  // locator resolution and boundingBox's separate browser call.
  const r = document.querySelector('#pointer-root .scriptoscope-slider canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

for (const mode of ['source', 'built']) {
  test(`${mode}: stationary grabs preserve exact native values anywhere on authored and procedural thumbs`, async ({ page, servers }, info) => {
    const rows = [];
    try {
      // Windows95's source sheet has 11px-wide cells. The procedural drawer
      // explicitly draws 11px; the engineered source fixture is 23px wide.
      for (const [kind, extent] of [['windows-95', 11], ['procedural', 11], ['wide', 23]]) {
        await setup(page, servers, mode, kind);
        for (const attrs of [
          ...[0, 25, 50, 75, 100].map(value => ({ value: String(value) })),
          { min: '0', max: '1', step: 'any', value: '0.25' },
          { min: '-1', max: '1', step: '0.1', value: '-0.3' },
          { min: '10', max: '20', step: '2', value: '14' },
        ]) {
          const current = await setValue(page, attrs), box = await rect(page);
          const start = Math.round(current.normalized * (120 - extent));
          for (const grab of [1, extent / 2, extent - 1]) {
            await clear(page);
            const x = box.x + (start + grab) * box.width / 120, y = box.y + box.height / 2;
            await page.mouse.move(x, y); await page.mouse.down();
            expect(await read(page), `${kind}/${JSON.stringify(attrs)}/grab${grab} held`).toEqual({ value: current.exact, events: [] });
            await page.mouse.up();
            const result = await read(page); rows.push({ kind, attrs, grab, result });
            expect(result, `${kind}/${JSON.stringify(attrs)}/grab${grab} released`).toEqual({ value: current.exact, events: [] });
          }
        }
        await cleanup(page);
      }
    } catch (error) { await attachCase(page, info, { mode, rows }, error); throw error; }
    finally { await cleanup(page); }
  });

  test(`${mode}: thumb dragging preserves grab offset, exact return and native sanitization on scaled surfaces`, async ({ page, servers }, info) => {
    const rows = [];
    try {
      for (const [kind, extent] of [['windows-95', 11], ['procedural', 11], ['wide', 23]]) {
        await setup(page, servers, mode, kind);
        for (const cssWidth of [120, 32, 240]) {
          // Parent scaling changes CSS size without changing the backing layout.
          await page.addStyleTag({ content: `#pointer-root canvas { width:${cssWidth}px!important; }` });
          for (const grab of [1, extent - 1]) {
            const current = await setValue(page, { min: '0', max: '1', step: 'any', value: '0.25' });
            const box = await rect(page), travel = 120 - extent;
            const left = box.x + Math.round(current.normalized * travel) * box.width / 120;
            const right = left + extent * box.width / 120;
            // Integer CSS points remain inside the independently declared thumb
            // even when Firefox quantizes trusted clientX (notably width32px).
            const x = grab === 1 ? Math.ceil(left) : Math.ceil(right) - 1, y = box.y + box.height / 2;
            expect(x).toBeGreaterThanOrEqual(left); expect(x).toBeLessThan(right);
            await page.mouse.move(x, y); await page.mouse.down();
            expect(await read(page)).toEqual({ value: current.exact, events: [] });
            // An exact backing-pixel delta, independent of the rounded thumb start.
            await page.mouse.move(x + 20 * box.width / 120, y);
            const moved = await read(page);
            const coordinates = await page.evaluate(() => { const s = window.pointerFixture.pointerSamples; return { down: s.find(e => e.type === 'pointerdown').x, move: s.at(-1).x }; });
            // Browser event coordinates may be integer/subpixel-quantized. The
            // independently known 120px backing axis and authored extent define
            // the expected delta, without querying runtime layout metadata.
            expect(coordinates.down).toBeGreaterThanOrEqual(left); expect(coordinates.down).toBeLessThan(right);
            const delta = (coordinates.move - coordinates.down) * 120 / box.width;
            expect(Number(moved.value)).toBeCloseTo(0.25 + delta / travel, 12);
            expect(moved.events.every(e => e.type === 'input')).toBe(true);
            await page.mouse.move(x, y); await page.mouse.up();
            const returned = await read(page); rows.push({ kind, cssWidth, grab, moved, returned });
            expect(returned.value).toBe(current.exact);
            expect(returned.events.map(e => e.type)).toEqual(['input', 'input']);
          }
          for (const [startValue, direction, endValue] of [[0, 1, '100'], [100, -1, '0']]) {
            await setValue(page, { value: String(startValue) }); const box = await rect(page), travel = 120 - extent;
            const x = box.x + (Math.round(startValue / 100 * travel) + extent / 2) * box.width / 120, y = box.y + box.height / 2;
            await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + direction * travel * box.width / 120, y); await page.mouse.up();
            const result = await read(page); expect(result.value).toBe(endValue); expect(result.events.map(e => e.type)).toEqual(['input', 'change']);
          }
        }
        // Native browser step/base rules own quantization after geometric travel.
        await page.addStyleTag({ content: '#pointer-root canvas { width:120px!important; }' });
        const attrs = { min: '-1', max: '1', step: '0.1', value: '-0.3' };
        const current = await setValue(page, attrs), box = await rect(page), travel = 120 - extent;
        const x = box.x + Math.round(current.normalized * travel) + 1, y = box.y + box.height / 2;
        const expected = await page.evaluate(({ attrs, travel }) => { const ref = document.createElement('input'); ref.type = 'range'; Object.assign(ref, attrs); ref.valueAsNumber = Number(attrs.value) + 20 / travel * 2; return ref.value; }, { attrs, travel });
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y); await page.mouse.up();
        expect((await read(page)).value).toBe(expected);
        await cleanup(page);
      }
    } catch (error) { await attachCase(page, info, { mode, rows }, error); throw error; }
    finally { await cleanup(page); }
  });

  test(`${mode}: track clicks are centered, blank wrapper inert, and zero travel differs from absent thumb art`, async ({ page, servers }, info) => {
    try {
      for (const [kind, extent] of [['windows-95', 11], ['wide', 23], ['procedural', 11]]) {
        await setup(page, servers, mode, kind); await setValue(page, { min: '0', max: '1', step: 'any', value: '0' });
        let box = await rect(page);
        await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
        expect(Number((await read(page)).value)).toBeCloseTo((90 - extent / 2) / (120 - extent), 12);
        expect((await read(page)).events.map(e => e.type)).toEqual(['input', 'change']);
        await page.locator('#pointer-root .scriptoscope-slider').evaluate(el => { el.style.width = '240px'; el.style.height = '50px'; });
        box = await rect(page); const before = (await read(page)).value; await clear(page);
        await page.mouse.click(box.x + box.width + 20, box.y + 4);
        await page.mouse.click(box.x + 4, box.y + box.height + 10);
        expect(await read(page)).toEqual({ value: before, events: [] });
        await cleanup(page);
      }
      await setup(page, servers, mode, 'zero-travel');
      await setValue(page, { min: '0', max: '1', step: 'any', value: '0.25' });
      let box = await rect(page); await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 8); await page.mouse.up();
      expect(await read(page)).toEqual({ value: '0.25', events: [] }); await cleanup(page);
      await setup(page, servers, mode, 'no-thumb'); await setValue(page, { value: '0' }); box = await rect(page);
      await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
      expect(await read(page)).toEqual({ value: '75', events: [{ type: 'input', value: '75' }, { type: 'change', value: '75' }] });
    } catch (error) { await attachCase(page, info, { mode }, error); throw error; }
    finally { await cleanup(page); }
  });

  test(`${mode}: native pointer lifecycle and imperative slider/scrollbar mapping stay intact`, async ({ page, servers }, info) => {
    try {
      await setup(page, servers, mode);
      for (const stop of ['disabled', 'cancel', 'disconnect']) {
        await setValue(page, { value: '25', disabled: false }); let box = await rect(page);
        const x = box.x + Math.round(0.25 * 109) + 1, y = box.y + box.height / 2;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y);
        const before = (await read(page)).value;
        await page.evaluate(stop => {
          const f = window.pointerFixture;
          if (stop === 'disabled') document.getElementById('pointer-native').disabled = true;
          else if (stop === 'cancel') window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: f.pointerId }));
          else f.handle.disconnect();
          f.events.length = 0;
        }, stop);
        if (stop === 'disabled') await expect(page.locator('.scriptoscope-slider')).toHaveAttribute('aria-disabled', 'true');
        await page.mouse.move(x + 80, y); await page.mouse.up();
        expect(await read(page), stop).toEqual({ value: before, events: [] });
      }
      await page.evaluate(async () => {
        const f = window.pointerFixture; f.root.replaceChildren(); f.values = [];
        const slider = await f.api.interactiveSlider(f.theme, { value: 0.25, onChange: v => f.values.push(['slider', v]) }); slider.id = 'legacy-slider';
        const scrollbar = await f.api.interactiveScrollbar(f.theme, { orientation: 'horizontal', value: 0.25, onChange: v => f.values.push(['scrollbar', v]) }); scrollbar.id = 'legacy-scrollbar';
        f.root.append(slider, scrollbar);
      });
      for (const id of ['legacy-slider', 'legacy-scrollbar']) {
        const box = await page.locator(`#${id} canvas`).boundingBox();
        await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
      }
      expect(await page.evaluate(() => window.pointerFixture.values)).toEqual([['slider', 0.25], ['scrollbar', 0.25]]);
    } catch (error) { await attachCase(page, info, { mode }, error); throw error; }
    finally { await cleanup(page); }
  });

  test(`${mode}: finite short compositions retain independently specified thumb cells and positions`, async ({ page, servers }) => {
    await setup(page, servers, mode, 'wide');
    try {
      const rows = await page.evaluate(async () => {
        const { api, theme } = window.pointerFixture, rows = [];
        for (const length of [8, 32, 40]) for (const orientation of ['horizontal', 'vertical']) for (const value of [0, 0.25, 1]) {
          const out = await api.composeSlider(theme, { length, orientation, value });
          const actualLength = Math.max(32, length), start = Math.round(value * (actualLength - 23));
          let mismatches = 0;
          for (let y = 0; y < 16; y++) for (let x = 0; x < 23; x++) {
            const pixel = out.getPixel(...(orientation === 'horizontal' ? [start + x, y] : [y, start + x]));
            if ([17, 191, 73, 255].some((v, i) => v !== pixel[i])) mismatches++;
          }
          rows.push({ length, orientation, value, width: out.width, height: out.height, mismatches });
        }
        return rows;
      });
      expect(rows).toHaveLength(18);
      for (const row of rows) {
        expect(row.width).toBe(row.orientation === 'horizontal' ? Math.max(32, row.length) : 16);
        expect(row.height).toBe(row.orientation === 'horizontal' ? 16 : Math.max(32, row.length));
        expect(row.mismatches, JSON.stringify(row)).toBe(0);
      }
    } finally { await cleanup(page); }
  });
  test(`${mode}: stale pressed composition cannot replace the committed canvas or hit geometry`, async ({ page, servers }, info) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    try {
      await setup(page, servers, mode, 'wide');
      await setValue(page, { min: '0', max: '1', step: 'any', value: '0.25' });
      const asset = await page.evaluate(() => {
        const f = window.pointerFixture, b = f.api.PixelBuffer.alloc(5, 40);
        for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) b.setPixel(x, y, 61, 71, 81, 255);
        f.heldUrl = `${location.origin}/held-slider-pressed.png`;
        f.theme.manifest.chromeElements.pressedTrack = { sourceCicnId: -10130, asset: f.heldUrl,
          width: 5, height: 40, slice: { corner: 1, side: 1, tile: false } };
        f.initialCanvas = document.querySelector('#pointer-root canvas');
        return f.api.bufferToCanvas(b).toDataURL().split(',')[1];
      });
      await page.route('**/held-slider-pressed.png', async route => {
        await held; await route.fulfill({ contentType: 'image/png', body: Buffer.from(asset, 'base64') });
      });
      const box = await rect(page), x = box.x + Math.round(0.25 * 97) + 2, y = box.y + 4;
      const request = page.waitForRequest('**/held-slider-pressed.png');
      await page.mouse.move(x, y); await page.mouse.down(); await request;
      await page.mouse.up();
      await expect.poll(() => page.evaluate(() => document.querySelector('#pointer-root canvas') !== window.pointerFixture.initialCanvas)).toBe(true);
      await page.evaluate(() => { window.pointerFixture.normalCanvas = document.querySelector('#pointer-root canvas'); });
      release();
      await page.evaluate(async () => {
        const f = window.pointerFixture; await f.api.loadCicnBuffer(f.heldUrl);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      expect(await page.evaluate(() => {
        const canvas = document.querySelector('#pointer-root canvas');
        return { same: canvas === window.pointerFixture.normalCanvas, height: canvas.height };
      })).toEqual({ same: true, height: 16 });
      // Stale 40px-cross layout would place the 16px thumb at y12 and treat
      // this actual normal thumb point at y4 as a track click, changing value.
      await clear(page); await page.mouse.click(x, y);
      expect(await read(page)).toEqual({ value: '0.25', events: [] });
    } catch (error) { await attachCase(page, info, { mode, oracle: 'atomic-slider-layout' }, error); throw error; }
    finally { release?.(); await cleanup(page); }
  });

}
