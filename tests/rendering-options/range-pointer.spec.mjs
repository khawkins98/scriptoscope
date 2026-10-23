import { test, expect, openHarness, attachCase } from './fixtures.mjs';

// Pointer contracts for promoted native ranges (docs/spec/slider-interaction.md; the integration policy). Thumb
// extents and travel are specified independently of runtime layout metadata:
//   windows-95  CDEF 3 (slider.md): tA 11, corner c 2 (cinf -10132 byte 0, §6), T = 120 - 11 - 2c = 105 (§5.2, ID7)
//   procedural  the Platinum substitute (§6 item 3): 11px thumb, travel 109 from 0
//   wide / zero-travel / no-thumb  engineered forks with a gate and corner cinf at -10132 / -10116 (G1 via
//               variation bit 3, ID6 c = 3), so CDEF 3 draws them: wide tA 23 (T 91), zero-travel tA 114 (T 0),
//               no-thumb none (TH2).
//   handoff     a hand-built manifest with slider cicns but no slider cinf: G2 hands off (slider.md §4.1, S1).
export const GEOMETRY = {
  'windows-95': { c: 2, extent: 11 }, procedural: { c: 0, extent: 11 }, wide: { c: 3, extent: 23 }, 'zero-travel': { c: 3, extent: 114 },
};
const travelOf = kind => 120 - GEOMETRY[kind].extent - 2 * GEOMETRY[kind].c;
/** Horizontal thumb start (§5.2; the facade's native value is round(100 · normalized) of 0..100). Platinum rounds. */
const startOf = (kind, normalized) => (kind === 'procedural' ? Math.round(normalized * 109)
  : GEOMETRY[kind].c + Math.trunc(travelOf(kind) * Math.round(100 * normalized) / 100));

async function setup(page, servers, mode, kind = 'windows-95') {
  await openHarness(page, servers, mode);
  await page.evaluate(async ({ mode, kind }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    let theme;
    if (kind === 'windows-95') theme = await api.loadTheme('/themes/windows-95');
    else if (kind === 'procedural') theme = { baseUrl: `${location.origin}/pointer-fixture/procedural`, manifest: { chromeElements: {} } };
    else if (kind === 'handoff') {
      const asset = (id, w, h, rgba) => {
        const b = api.PixelBuffer.alloc(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.setPixel(x, y, ...rgba);
        return { sourceCicnId: id, asset: api.bufferToCanvas(b).toDataURL(), width: w, height: h, slice: { corner: 1, side: 1, tile: false } };
      };
      theme = { baseUrl: `${location.origin}/pointer-fixture/handoff`, manifest: { chromeElements: {
        track: asset(-10131, 5, 4, [40, 50, 60, 255]), verticalTrack: asset(-10115, 4, 5, [40, 50, 60, 255]),
        thumb: asset(-10129, 23, 64, [17, 191, 73, 255]), verticalThumb: asset(-10113, 64, 23, [17, 191, 73, 255]) } } };
    } else {
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const { endpointIcon } = await import('/tests/decoder-fixtures/slider-endpoints.mjs');
      const cinf = (...head) => new Uint8Array([...head, ...Array(18 - head.length).fill(0)]);
      const entries = [];
      for (const vertical of [false, true]) {
        const gb = vertical ? -10116 : -10132;   // base + 12: group 2 (non-directional)
        // gb: gate (G1, bit 3) and corner (ID6, c = 3); its cicn is the inactive track (TR3 tier 0).
        entries.push({ type: 'cicn', id: gb, data: endpointIcon(vertical) }, { type: 'cinf', id: gb, data: cinf(3, 1, 1, 0) });
        for (const tier of [1, 2]) entries.push({ type: 'cicn', id: gb + tier, data: endpointIcon(vertical) }, { type: 'cinf', id: gb + tier, data: cinf(1, 1, 1, 0) });
        if (kind !== 'no-thumb') entries.push({ type: 'cicn', id: gb + 3, data: endpointIcon(vertical, true, 16, kind === 'zero-travel' ? 114 : 23) });
      }
      theme = await api.loadKaleidoscopeScheme(forkOf(entries));
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
      for (const kind of ['windows-95', 'procedural', 'wide']) {
        const { extent } = GEOMETRY[kind];
        await setup(page, servers, mode, kind);
        for (const attrs of [
          ...[0, 25, 50, 75, 100].map(value => ({ value: String(value) })),
          { min: '0', max: '1', step: 'any', value: '0.25' },
          { min: '-1', max: '1', step: '0.1', value: '-0.3' },
          { min: '10', max: '20', step: '2', value: '14' },
        ]) {
          const current = await setValue(page, attrs), box = await rect(page);
          const start = startOf(kind, current.normalized);
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
      for (const kind of ['windows-95', 'procedural', 'wide']) {
        const { extent } = GEOMETRY[kind];
        await setup(page, servers, mode, kind);
        for (const cssWidth of [120, 32, 240]) {
          // Parent scaling changes CSS size without changing the backing layout.
          await page.addStyleTag({ content: `#pointer-root canvas { width:${cssWidth}px!important; }` });
          for (const grab of [1, extent - 1]) {
            const current = await setValue(page, { min: '0', max: '1', step: 'any', value: '0.25' });
            const box = await rect(page), travel = travelOf(kind);
            const left = box.x + startOf(kind, current.normalized) * box.width / 120;
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
            await setValue(page, { value: String(startValue) }); const box = await rect(page), travel = travelOf(kind);
            const x = box.x + (startOf(kind, startValue / 100) + extent / 2) * box.width / 120, y = box.y + box.height / 2;
            // Exact full travel at 1x/2x; the short CSS surface deliberately
            // overshoots for clamping because integer browser coordinates can
            // otherwise shorten a fractional requested endpoint displacement.
            const distance = cssWidth === 32 ? 120 : travel;
            await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + direction * distance * box.width / 120, y); await page.mouse.up();
            const movedPixels = await page.evaluate(({ width }) => { const s = window.pointerFixture.pointerSamples; return Math.abs(s.at(-1).x - s.find(e => e.type === 'pointerdown').x) * 120 / width; }, { width: box.width });
            if (cssWidth === 32) expect(movedPixels).toBeGreaterThanOrEqual(travel);
            else expect(movedPixels).toBe(travel);
            const result = await read(page); expect(result.value).toBe(endValue); expect(result.events.map(e => e.type)).toEqual(['input', 'change']);
          }
        }
        // Firefox retains lexical values such as "025". A real tiny drag
        // inside the same step must preserve that spelling and emit no events.
        await page.addStyleTag({ content: '#pointer-root canvas { width:2400px!important; }' });
        for (const attrs of [{ value: '025' }, { min: '0', max: '1', step: '.01', value: '0.250' }]) {
          const current = await setValue(page, attrs), box = await rect(page);
          const x = box.x + (startOf(kind, current.normalized) + 1) * 20;
          const y = box.y + box.height / 2;
          await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 1, y); await page.mouse.up();
          expect(await read(page), `${kind}/lexical ${current.exact}`).toEqual({ value: current.exact, events: [] });
          // Return into the same step bucket at a DIFFERENT coordinate after
          // a genuine numeric excursion: retain the original string, no commit.
          await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 100, y);
          expect(Number((await read(page)).value)).toBeGreaterThan(Number(current.exact));
          await page.mouse.move(x + 1, y); await page.mouse.up();
          expect(await read(page)).toEqual({ value: current.exact, events: [
            expect.objectContaining({ type: 'input' }), { type: 'input', value: current.exact },
          ] });
        }
        // Native browser step/base rules own quantization after geometric travel.
        await page.addStyleTag({ content: '#pointer-root canvas { width:120px!important; }' });
        const attrs = { min: '-1', max: '1', step: '0.1', value: '-0.3' };
        const current = await setValue(page, attrs), box = await rect(page), travel = travelOf(kind);
        const x = box.x + startOf(kind, current.normalized) + 1, y = box.y + box.height / 2;
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
      for (const kind of ['windows-95', 'wide', 'procedural']) {
        const { extent, c } = GEOMETRY[kind];
        await setup(page, servers, mode, kind); await setValue(page, { min: '0', max: '1', step: 'any', value: '0' });
        let box = await rect(page);
        await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
        // Track-click centring (modern policy, TRK4) over the travel that starts at c (§5.2).
        expect(Number((await read(page)).value)).toBeCloseTo((90 - c - extent / 2) / travelOf(kind), 12);
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
    } catch (error) { await attachCase(page, info, { mode }, error); throw error; }
    finally { await cleanup(page); }
  });

  test(`${mode}: a visible track with no thumb art maps clicks over its full axis`, async ({ page, servers }, info) => {
    // Integration policy: "A visible track with no thumb art uses its full axis" (TH2: Th is empty, so the corner
    // inset c has no thumb to offset). A click at 75% of the 120px axis is 75 of 0..100.
    try {
      await setup(page, servers, mode, 'no-thumb'); await setValue(page, { value: '0' }); const box = await rect(page);
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
      // The slider click is inside its drawn thumb [28,39): exact-value grab emits no change.
      // The scrollbar retains its ordinary full-axis pointer callback.
      expect(await page.evaluate(() => window.pointerFixture.values)).toEqual([['scrollbar', 0.25]]);
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
          // §5.2 with c = 3, tA = 23 (TH3 cell 1, the fixture's red normal cell); vertical minimum at the bottom.
          const actualLength = Math.max(32, length), native = Math.round(100 * value), T = actualLength - 23 - 6;
          const start = 3 + Math.trunc(T * (orientation === 'horizontal' ? native : 100 - native) / 100);
          let mismatches = 0;
          for (let y = 0; y < 16; y++) for (let x = 0; x < 23; x++) {
            const pixel = out.getPixel(...(orientation === 'horizontal' ? [start + x, y] : [y, start + x]));
            if ([255, 0, 0, 255].some((v, i) => v !== pixel[i])) mismatches++;
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

  test(`${mode}: a hand-built manifest with slider cicns but no slider cinf hands off to the Platinum substitute`, async ({ page, servers }) => {
    // slider.md G1/G2 (§4.1): the gate tests cinf only; slider cicns alone never reach Kaleidoscope's drawing.
    await setup(page, servers, mode, 'handoff');
    try {
      const out = await page.evaluate(async () => {
        const { api, theme } = window.pointerFixture;
        const composed = await api.composeSlider(theme, { length: 120, value: 0.25 });
        return { composed: composed === null, face: document.querySelector('#pointer-root canvas').toDataURL(),
          platinum: api.bufferToCanvas(api.platinumSlider({ length: 120, value: 0.25 })).toDataURL() };
      });
      expect(out.composed).toBe(true);
      expect(out.face).toBe(out.platinum);
    } finally { await cleanup(page); }
  });

  // The engine composer preloads every slider cicn the chain holds (slider.md §3.1 is the CDEF's request order; the
  // theme adapter loads the raster set up front), so a normal repaint waits on the pressed track's decode too: the
  // two compositions resolve in order. The contract under test: the pressed (stale) composition never commits a
  // canvas once a later repaint is pending, and the committed geometry is the normal composition's.
  test(`${mode}: stale pressed composition cannot replace the committed canvas or hit geometry`, async ({ page, servers }, info) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    try {
      await setup(page, servers, mode, 'wide');
      await setValue(page, { min: '0', max: '1', step: 'any', value: '0.25' });
      const asset = await page.evaluate(() => {
        const f = window.pointerFixture, b = f.api.PixelBuffer.alloc(7, 3);
        for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) b.setPixel(x, y, 61, 71, 81, 255);
        f.heldUrl = `${location.origin}/held-slider-pressed.png`;
        // The pressed track (TR3 tier 2, gb + 2 = -10130, with its cinf) now decodes from a held URL.
        Object.values(f.theme.manifest.chromeElements).find(e => e.sourceCicnId === -10130).asset = f.heldUrl;
        f.commits = [];
        f.observer = new MutationObserver(() => { const c = document.querySelector('#pointer-root canvas'); if (c && f.commits.at(-1) !== c) f.commits.push(c); });
        f.observer.observe(document.getElementById('pointer-root'), { childList: true, subtree: true });
        f.initialCanvas = document.querySelector('#pointer-root canvas');
        return f.api.bufferToCanvas(b).toDataURL().split(',')[1];
      });
      await page.route('**/held-slider-pressed.png', async route => {
        await held; await route.fulfill({ contentType: 'image/png', body: Buffer.from(asset, 'base64') });
      });
      // Inside the normal thumb: start 3 + trunc(91 · 25 / 100) = 25 (§5.2, c = 3, tA = 23), 23 wide.
      const box = await rect(page), x = box.x + startOf('wide', 0.25) + 2, y = box.y + 4;
      const request = page.waitForRequest('**/held-slider-pressed.png');
      await page.mouse.move(x, y); await page.mouse.down(); await request;
      await page.mouse.up();
      release();
      await page.evaluate(async () => {
        const f = window.pointerFixture; await f.api.loadCicnBuffer(f.heldUrl);
        for (let i = 0; i < 3; i++) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const out = await page.evaluate(async () => {
        const f = window.pointerFixture; f.observer.disconnect();
        const url = b => f.api.bufferToCanvas(b).toDataURL();
        const normal = url(await f.api.composeSlider(f.theme, { length: 120, value: 0.25 }));
        const pressed = url(await f.api.composeSlider(f.theme, { length: 120, value: 0.25, state: 'pressed' }));
        const canvas = document.querySelector('#pointer-root canvas');
        return { distinct: normal !== pressed, final: canvas.toDataURL() === normal, height: canvas.height,
          pressedCommits: f.commits.filter(c => c.toDataURL() === pressed).length, replaced: canvas !== f.initialCanvas };
      });
      expect(out).toEqual({ distinct: true, final: true, height: 16, pressedCommits: 0, replaced: true });
      await clear(page); await page.mouse.click(x, y);
      expect(await read(page)).toEqual({ value: '0.25', events: [] });
    } catch (error) { await attachCase(page, info, { mode, oracle: 'atomic-slider-layout' }, error); throw error; }
    finally { release?.(); await cleanup(page); }
  });

}
