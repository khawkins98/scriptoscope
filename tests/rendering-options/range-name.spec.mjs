import { test, expect, openHarness, attachCase } from './fixtures.mjs';

const names = ['Volume', 'Wrapped volume', 'Master volume', 'Explicit volume',
  'Referenced volume', 'Fallback volume', 'Title volume'];

for (const mode of ['source', 'built']) for (const slug of ['windows-95', 'system7-nostalgia-silver']) {
  test(`${mode}: ${slug} promoted ranges preserve accessible names and keyboard behavior on retheme`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    try {
      await page.evaluate(async ({ mode, slug }) => {
        const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const next = slug === 'windows-95' ? 'system7-nostalgia-silver' : 'windows-95';
        const themes = await Promise.all([slug, next].map(s => runtime.loadTheme(`/themes/${s}`)));
        const root = document.createElement('section'); root.id = 'range-names'; document.body.append(root);
        root.innerHTML = `<button id="range-before">Before</button>
          <div><label for="range-0">Volume</label><input id="range-0" type="range" value="50"></div>
          <div><label>Wrapped volume<input id="range-1" type="range" value="50"></label></div>
          <div><label for="range-2">Master</label><label for="range-2">volume</label><input id="range-2" type="range" value="50"></div>
          <div><label for="range-3">Ignored label</label><input id="range-3" type="range" value="50" aria-label="Explicit volume"></div>
          <div><span id="range-ref-a">Referenced</span><span id="range-ref-b">volume</span><label for="range-4">Ignored label</label><input id="range-4" type="range" value="50" aria-label="Ignored explicit" aria-labelledby="range-ref-a range-ref-b"></div>
          <div><label for="range-5">Ignored label</label><input id="range-5" type="range" value="50" aria-label="Fallback volume" aria-labelledby="absent-reference"></div>
          <div><input id="range-6" type="range" value="50" title="Title volume"></div>
          <button id="range-after">After</button>`;
        window.rangeNames = { runtime, root, themes };
      }, { mode, slug });
      // Establish the browser's native accessible-name result before promotion.
      for (let i = 0; i < names.length; i++) await expect(page.locator(`#range-${i}`)).toHaveAccessibleName(names[i]);
      // Discover the browser's native full-control navigation before promotion.
      // macOS WebKit uses Option-Tab by default; other engines normally use Tab.
      await page.locator('#range-before').focus(); await page.keyboard.press('Tab');
      const tabKey = await page.locator('#range-0').evaluate(el => document.activeElement === el) ? 'Tab' : 'Alt+Tab';
      await page.locator('#range-before').focus(); await page.keyboard.press(tabKey);
      await expect(page.locator('#range-0')).toBeFocused();
      await page.evaluate(async () => {
        const f = window.rangeNames;
        const { attachNativeSources } = await import('/tests/rendering-options/explicit-native-host.mjs');
        f.handle = await attachNativeSources(f.runtime, { root: f.root, theme: f.themes[0],
          controls: [...f.root.querySelectorAll('input[type=range]')] });
        f.handle.retheme = () => f.handle.replace(f.themes[1]);
      });
      const sliders = page.locator('#range-names .scriptoscope-slider');
      await expect(sliders).toHaveCount(names.length);
      for (const phase of ['initial', 'retheme']) {
        if (phase === 'retheme') await page.evaluate(() => window.rangeNames.handle.retheme('range-next'));
        await page.locator('#range-before').focus();
        for (let i = 0; i < names.length; i++) {
          const slider = sliders.nth(i), native = page.locator(`#range-${i}`);
          await expect(native).toHaveAccessibleName(names[i]);
          await expect(page.getByRole('slider', { name: names[i], exact: true })).toHaveCount(1);
          await expect(slider).toHaveAttribute('aria-hidden', 'true');
          expect(await slider.evaluate(el => el.tabIndex)).toBe(-1);
          await page.keyboard.press(tabKey); await expect(native).toBeFocused();
          await expect(slider).toHaveCSS('outline-style', 'solid');
          await page.keyboard.press('ArrowRight');
          await expect(native).toHaveValue(phase === 'initial' ? '51' : '52');
        }
        await page.keyboard.press(tabKey); await expect(page.locator('#range-after')).toBeFocused();
      }
      // Keep ID references live, rather than flattening explicit labelledby text.
      await page.locator('#range-ref-a').evaluate(el => { el.textContent = 'Updated'; });
      await expect(page.locator('#range-4')).toHaveAccessibleName('Updated volume');
      await page.evaluate(() => window.rangeNames.handle.disconnect());
      // Naming attributes remain consumer-owned through native restoration.
      await expect(page.locator('#range-4')).toHaveAttribute('aria-labelledby', 'range-ref-a range-ref-b');
      await expect(page.locator('#range-4')).toHaveAttribute('aria-label', 'Ignored explicit');
    } catch (error) { await attachCase(page, testInfo, { mode, slug, oracle: 'native-range-accessible-name' }, error); throw error; }
    finally {
      await page.evaluate(() => { const f = window.rangeNames; f?.handle?.disconnect(); f?.root.remove(); f?.themes.forEach(t => t.dispose?.()); });
    }
  });
}
