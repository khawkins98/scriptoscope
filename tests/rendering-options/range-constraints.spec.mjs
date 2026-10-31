import { test, expect, openHarness } from './fixtures.mjs';

async function setup(page, servers, mode, markup = '') {
  await openHarness(page, servers, mode);
  await page.evaluate(async ({ mode, markup }) => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(s => runtime.loadTheme(`/themes/${s}`)));
    const root = document.createElement('section'); document.body.append(root);
    const form = document.createElement('form'); form.innerHTML = markup || '<button type="button" id="before">Before</button><input id="native" type="range" data-scriptoscope-control="off" aria-label="Reference"><input id="themed" name="value" type="range" aria-label="Themed"><button type="button" id="after">After</button>';
    // Integer-aligned canvas origins keep exact pointer fractions meaningful
    // in engines that quantize trusted mouse coordinates to CSS pixels.
    form.style.display = 'grid'; form.style.justifyItems = 'start';
    root.append(form);
    const { attachNativeSources } = await import('/tests/rendering-options/explicit-native-host.mjs');
    const handle = await attachNativeSources(runtime, { root, theme: themes[0], controls: [form.querySelector('#themed')] });
    handle.retheme = () => handle.replace(themes[1]);
    const events = [];
    for (const type of ['input', 'change']) form.addEventListener(type, e => events.push({ id: e.target.id, type, value: e.target.value, bubbles: e.bubbles, composed: e.composed }));
    // The promoted range is a DOM slider path: its host supplies a fully transparent erase background, so R
    // composites to the window body already drawn behind the canvas (slider.md §4.10 BG4; the host input of BG6;
    // #596 compatibility policy). Standalone composeSlider keeps BG6's opaque-white default.
    const hostBackground = { r: 0, g: 0, b: 0, a: 0 };
    window.ranges = { runtime, themes, root, handle, form, events, hostBackground };
    form.addEventListener('pointerdown', e => { window.ranges.pointerId = e.pointerId; });
  }, { mode, markup });
  await expect(page.locator('.scriptoscope-slider')).toHaveCount(1);
}
async function cleanup(page) {
  await page.evaluate(() => { const f = window.ranges; f?.handle.disconnect(); f?.root.remove(); f?.themes.forEach(t => t.dispose?.()); });
}
for (const mode of ['source', 'built']) {
  test(`${mode}: promoted range keeps native keyboard steps, numeric accessibility and event timing`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    try {
      for (const attrs of [
        { min: '0', max: '100', step: '1', value: '50' },
        { min: '0', max: '100', step: '2', value: '40' },
        { min: '0', max: '1', step: '0.1', value: '0.3' },
        { min: '-1', max: '1', step: '0.25', value: '0' },
        { min: '10', max: '20', step: '2', value: '14' },
        { min: '0', max: '1', step: 'any', value: '0.3' },
        { min: 'bad', max: '', step: 'bad', value: '50' },
        { min: '10px', max: '20foo', step: 'any', value: '50' },
        { min: ' 10 ', max: '+20', step: '1', value: '50' },
      ]) {
        const observed = [];
        for (const id of ['native', 'themed']) {
          await page.locator(`#${id}`).evaluate((el, attrs) => { Object.assign(el, attrs); window.ranges.events.length = 0; }, attrs);
          await page.locator(`#${id}`).focus();
          await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight');
          for (const key of ['ArrowLeft', 'Home', 'ArrowLeft', 'End', 'ArrowRight', 'PageDown', 'PageUp']) await page.keyboard.press(key);
          observed.push(await page.locator(`#${id}`).evaluate(el => ({ value: el.value,
            events: window.ranges.events.map(({ type, value }) => ({ type, value })) })));
        }
        expect(observed[1], JSON.stringify(attrs)).toEqual(observed[0]);
      }
      await page.locator('#themed').evaluate(el => { el.min = '10'; el.max = '20'; el.step = '2'; el.value = '14'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await expect(page.getByRole('slider', { name: 'Themed' })).toHaveCount(1);
      await expect(page.getByRole('slider', { name: 'Themed' })).toMatchAriaSnapshot('- slider "Themed": "14"');
      await expect(page.locator('.scriptoscope-slider')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('.scriptoscope-slider')).toHaveCSS('outline-style', 'solid');
      expect(await page.evaluate(() => new FormData(window.ranges.form).get('value'))).toBe('14');
      await page.evaluate(() => window.ranges.handle.retheme('next'));
      await page.locator('#themed').focus(); await page.keyboard.press('ArrowRight');
      await expect(page.locator('#themed')).toHaveValue('16');
      await expect(page.getByRole('slider', { name: 'Themed' })).toHaveCount(1);
      await page.evaluate(() => window.ranges.handle.disconnect());
      await expect(page.locator('.scriptoscope-slider')).toHaveCount(0);
      await page.locator('#themed').focus(); await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#themed')).toHaveValue('14');
    } finally { await cleanup(page); }
  });

  test(`${mode}: authored pointer surface sanitizes fractional values and commits on release`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    try {
      await page.evaluate(() => { for (const id of ['native', 'themed']) Object.assign(document.getElementById(id), { min: '0', max: '1', step: '0.1', value: '0.3' }); });
      const traces = [];
      for (const selector of ['#native', '.scriptoscope-slider']) {
        await page.evaluate(() => { window.ranges.events.length = 0; });
        const rect = await page.locator(selector).boundingBox();
        await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height / 2); await page.mouse.down();
        await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height / 2, { steps: 3 });
        const held = await page.evaluate(() => window.ranges.events.map(({ type }) => type));
        expect(held.length).toBeGreaterThan(0); expect(held.every(t => t === 'input')).toBe(true);
        await page.mouse.up();
        const detail = await page.evaluate(() => window.ranges.events);
        for (const event of detail) { expect(event.bubbles).toBe(true); expect(event.composed).toBe(event.type === 'input'); }
        const events = detail.map(({ type }) => type);
        expect(events.at(-1)).toBe('change'); expect(events.filter(t => t === 'change')).toHaveLength(1);
        traces.push(events);
      }
      await expect(page.locator('#themed')).toBeFocused();
      await expect(page.locator('#themed')).toHaveValue('0.8');
      expect(await page.evaluate(() => new FormData(window.ranges.form).get('value'))).toBe('0.8');
      // Returning to the starting value emits input during movement, no commit.
      const rect = await page.locator('.scriptoscope-slider').boundingBox();
      await page.evaluate(() => { const el = document.getElementById('themed'); el.value = '0.5'; el.dispatchEvent(new Event('input')); window.ranges.events.length = 0; });
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
      await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height / 2); await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.up();
      expect(await page.evaluate(() => window.ranges.events.map(({ type }) => type))).toEqual(['input', 'input']);
      // Malformed HTML numeric attributes use browser defaults, not parseFloat prefixes.
      await page.locator('#themed').evaluate(el => { el.min = '10px'; el.max = '20foo'; el.step = 'any'; });
      // Wait for the newly normalized .5/100 thumb to paint before clicking
      // the track. An already visible old thumb must preserve its exact value.
      await page.evaluate(async () => { const f = window.ranges; f.invalidBoundsPixels = f.runtime.bufferToCanvas(await f.runtime.composeSlider(f.themes[0], { length: 120, value: 0.005, background: f.hostBackground })).toDataURL(); });
      await expect.poll(() => page.locator('.scriptoscope-slider canvas').evaluate(el => el.toDataURL() === window.ranges.invalidBoundsPixels)).toBe(true);
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await expect(page.locator('#themed')).toHaveValue('50');
      // Pointer cancellation must release drag listeners without a late commit.
      await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height / 2); await page.mouse.down();
      await page.evaluate(() => { window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.ranges.pointerId })); window.ranges.events.length = 0; });
      await page.mouse.move(rect.x + rect.width * 0.9, rect.y + rect.height / 2); await page.mouse.up();
      expect(await page.evaluate(() => window.ranges.events)).toEqual([]);
      // Dispose during a live drag: retained face/window listeners cannot commit.
      await page.mouse.down(); await page.mouse.move(rect.x + rect.width * 0.9, rect.y + rect.height / 2);
      await page.evaluate(() => { window.ranges.handle.disconnect(); window.ranges.events.length = 0; });
      await page.mouse.up();
      expect(await page.evaluate(() => window.ranges.events)).toEqual([]);
    } finally { await cleanup(page); }
  });

  test(`${mode}: live disabled fieldsets and first legends retain native focus and form rules`, async ({ page, servers }) => {
    await setup(page, servers, mode, '<input id="before" aria-label="Before"><fieldset id="fieldset" disabled><legend id="legend">First</legend><input id="themed" name="value" type="range" value="50" aria-label="Themed"></fieldset><input id="after" aria-label="After">');
    try {
      const native = page.locator('#themed'), face = page.locator('.scriptoscope-slider');
      await expect(native).toBeDisabled(); await expect(face).toHaveAttribute('aria-disabled', 'true');
      await page.locator('#before').focus(); await page.keyboard.press('Tab'); await expect(page.locator('#after')).toBeFocused();
      const rect = await face.boundingBox(); await page.mouse.click(rect.x + rect.width * 0.9, rect.y + rect.height / 2);
      await expect(native).toHaveValue('50'); expect(await page.evaluate(() => window.ranges.events)).toEqual([]);
      expect(await page.evaluate(() => new FormData(window.ranges.form).has('value'))).toBe(false);
      // Moving the native control AND its decoration into the first legend
      // exercises the browser's exemption, not a hand-written ancestor rule.
      await page.evaluate(() => { const f = document.getElementById('legend'), input = document.getElementById('themed'), face = input.nextElementSibling; f.append(input, face); });
      await expect(native).toBeEnabled(); await expect(face).toHaveAttribute('aria-disabled', 'false');
      await native.focus(); await page.keyboard.press('ArrowRight'); await expect(native).toHaveValue('51');
      await native.evaluate(el => { el.disabled = true; }); await expect(face).toHaveAttribute('aria-disabled', 'true');
      await page.locator('#before').focus(); await page.keyboard.press('Tab'); await expect(page.locator('#after')).toBeFocused();
      await native.evaluate(el => { el.disabled = false; });
      await page.evaluate(() => { const legend = document.createElement('legend'); legend.textContent = 'New first'; document.getElementById('fieldset').prepend(legend); });
      await expect(native).toBeDisabled(); await expect(face).toHaveAttribute('aria-disabled', 'true');
      await page.locator('#fieldset').evaluate(el => { el.disabled = false; });
      await expect(native).toBeEnabled(); await expect(face).toHaveAttribute('aria-disabled', 'false');
      await page.evaluate(() => window.ranges.handle.retheme('next'));
      await native.focus(); await page.keyboard.press('ArrowRight'); await expect(native).toHaveValue('52');
      await page.evaluate(() => window.ranges.form.reset()); await expect(native).toHaveValue('50');
      await page.evaluate(() => window.ranges.handle.disconnect()); await expect(native).toHaveValue('50');
    } finally { await cleanup(page); }
  });
  test(`${mode}: extreme bounds, reassociated form reset and imperative slider remain coherent`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    try {
      const failures = []; page.on('pageerror', error => failures.push(String(error)));
      await page.locator('#themed').evaluate(el => { el.min = '-1e308'; el.max = '1e308'; el.step = 'any'; el.value = '0'; el.dispatchEvent(new Event('input')); });
      // Known Windows95 source: 11px thumb (tA) and corner c = 2 (cinf -10132 byte 0, slider.md §6 corpus table)
      // on a 120px backing axis, so travel T = 120 - 11 - 2c = 105 starting at c (§5.2, ID7). Fourfold CSS
      // scaling makes the 75%-travel centre (2 + 5.5 + 78.75 = 86.25) an integer client coordinate, including
      // Firefox, without deriving expectations from runtime layout.
      await page.addStyleTag({ content: '#themed + .scriptoscope-slider canvas { width:480px!important; }' });
      const rect = await page.evaluate(() => { const r = document.querySelector('.scriptoscope-slider canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await expect(page.locator('#themed')).toHaveValue('0');
      await page.mouse.click(rect.x + (2 + 11 / 2 + 0.75 * (120 - 11 - 2 * 2)) * 4, rect.y + rect.height / 2);
      expect(await page.locator('#themed').evaluate(el => el.valueAsNumber / 1e308)).toBeCloseTo(0.5, 8);
      expect(failures).toEqual([]);
      // Reset follows the current native form, including a changed form= link.
      await page.evaluate(async () => {
        const f = window.ranges, el = document.getElementById('themed');
        const other = document.createElement('form'); other.id = 'other-form'; f.root.append(other);
        el.min = '0'; el.max = '100'; el.step = '1'; el.defaultValue = '25'; el.value = '80'; el.setAttribute('form', 'other-form');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        f.resetPixels = f.runtime.bufferToCanvas(await f.runtime.composeSlider(f.themes[0], { orientation: 'horizontal', length: 120, value: 0.25, background: f.hostBackground })).toDataURL();
        other.reset();
      });
      await expect(page.locator('#themed')).toHaveValue('25');
      await expect.poll(() => page.locator('.scriptoscope-slider canvas').evaluate(el => el.toDataURL() === window.ranges.resetPixels)).toBe(true);
      await page.evaluate(async () => {
        const f = window.ranges; f.handle.disconnect(); f.root.replaceChildren(); f.values = [];
        const slider = await f.runtime.interactiveSlider(f.themes[0], { value: 0.5, onChange: value => f.values.push(value) });
        slider.id = 'imperative'; f.root.append(slider);
      });
      await page.locator('#imperative').focus(); await page.keyboard.press('ArrowRight');
      await expect(page.locator('#imperative')).toHaveAttribute('aria-valuenow', '55');
      expect(await page.evaluate(() => window.ranges.values)).toEqual([0.55]);
    } finally { await cleanup(page); }
  });

}
