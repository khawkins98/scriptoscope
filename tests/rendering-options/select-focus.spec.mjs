import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) for (const slug of ['windows-95', 'system7-nostalgia-silver']) {
  test(`${mode}: ${slug} native select owns the tab stop, visible focus and keyboard selection`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    let result;
    try {
      result = await page.evaluate(slug => {
        const c = window.controlMatrix.listCases().find(c => c.family === 'select' && !c.options.disabled);
        return window.controlMatrix.runCase(c, { slug });
      }, slug);
      expect(result.status, result.error).toBe('rendered');
      const native = page.locator(result.native.selector);
      await native.evaluate(el => {
        const before = document.createElement('button'), after = document.createElement('button');
        before.id = 'before-select'; after.id = 'after-select'; before.textContent = 'Before'; after.textContent = 'After';
        el.parentElement.before(before); el.parentElement.after(after); before.focus();
      });
      await page.keyboard.press('Tab');
      await expect(native).toBeFocused();
      const focus = await native.evaluate(el => {
        const wrapper = el.closest('.scriptoscope-select'), style = getComputedStyle(wrapper);
        return { nativeVisibleFocus: el.matches(':focus-visible'), outline: style.outlineStyle,
          width: parseFloat(style.outlineWidth), opacity: style.opacity,
          decoration: [...wrapper.querySelectorAll('.scriptoscope-button')].map(button => ({ tabIndex: button.tabIndex, hidden: button.getAttribute('aria-hidden') })) };
      });
      expect(focus.nativeVisibleFocus).toBe(true);
      expect(focus.outline, 'the visible wrapper mirrors native keyboard focus').not.toBe('none');
      expect(focus.width).toBeGreaterThan(0); expect(focus.opacity).not.toBe('0');
      expect(focus.decoration).toHaveLength(1);
      expect(focus.decoration[0].tabIndex, 'paint-only button must not create a dead tab stop').toBe(-1);
      expect(focus.decoration[0].hidden, 'native combobox is the accessible control').toBe('true');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(native).toHaveValue('second');
      const wrapper = native.locator('..');
      await expect(wrapper.locator('.scriptoscope-button')).toHaveAttribute('aria-label', 'Alternative Agjp  ▾');
      await expect(wrapper.locator('.scriptoscope-button')).toHaveAttribute('aria-hidden', 'true');
      expect(await wrapper.locator('.scriptoscope-button').evaluate(el => el.tabIndex)).toBe(-1);
      await expect(native).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#after-select')).toBeFocused();

      result = await page.evaluate(slug => {
        const c = window.controlMatrix.listCases().find(c => c.family === 'select' && c.options.disabled);
        return window.controlMatrix.runCase(c, { slug });
      }, slug);
      const disabled = page.locator(result.native.selector);
      await expect(disabled).toBeDisabled();
      await disabled.evaluate(el => {
        const before = document.createElement('button'), after = document.createElement('button');
        before.id = 'before-disabled'; after.id = 'after-disabled'; before.textContent = 'Before'; after.textContent = 'After';
        el.parentElement.before(before); el.parentElement.after(after); before.focus();
      });
      await page.keyboard.press('Tab');
      await expect(page.locator('#after-disabled')).toBeFocused();
      await disabled.evaluate(el => el.focus());
      await expect(page.locator('#after-disabled')).toBeFocused();
    } catch (error) { await attachCase(page, testInfo, { mode, slug, oracle: 'native-select-keyboard', result }, error); throw error; }
  });
}
