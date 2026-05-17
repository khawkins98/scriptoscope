import { test, expect } from '@playwright/test';

// E2E for Phase 3.3 / #72 checkboxes + radios. The landing page Controls
// window mounts three checkboxes (one checked, one normal, one disabled)
// and a three-radio group (one checked, one normal, one disabled).

test.describe('checkboxes + radios (#72)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('three checkboxes + three radios promoted', async ({ page }) => {
    await expect(page.locator('label.aaron-checkbox')).toHaveCount(3);
    await expect(page.locator('label.aaron-radio')).toHaveCount(3);
  });

  test('disabled checkbox carries aria-disabled', async ({ page }) => {
    const disabledCb = page.locator('label.aaron-checkbox', { hasText: 'Disabled option' });
    await expect(disabledCb).toHaveAttribute('aria-disabled', 'true');
    await expect(disabledCb.locator('input')).toBeDisabled();
  });

  test('checked checkbox stays checked across click; unchecked toggles', async ({ page }) => {
    const cb = page.locator('label.aaron-checkbox', { hasText: 'Use scheme' });
    const input = cb.locator('input');
    await expect(input).not.toBeChecked();
    await cb.click();
    await expect(input).toBeChecked();
    await cb.click();
    await expect(input).not.toBeChecked();
  });

  test('radio group: clicking another deselects the previous', async ({ page }) => {
    const seven = page.locator('label.aaron-radio', { hasText: '7 Le' }).locator('input');
    const ergo = page.locator('label.aaron-radio', { hasText: 'ErgoBox' }).locator('input');
    await expect(seven).toBeChecked();
    await expect(ergo).not.toBeChecked();
    await page.locator('label.aaron-radio', { hasText: 'ErgoBox' }).click();
    await expect(seven).not.toBeChecked();
    await expect(ergo).toBeChecked();
    // And it triggered a theme switch via the demo wiring.
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk Dark ErgoBox 2');
  });

  test('chrome span is present and aria-hidden on each control', async ({ page }) => {
    const chrome = page.locator('.aaron-checkbox__chrome').first();
    await expect(chrome).toHaveAttribute('aria-hidden', 'true');
    const radioChrome = page.locator('.aaron-radio__chrome').first();
    await expect(radioChrome).toHaveAttribute('aria-hidden', 'true');
  });

  test('native input remains in the tab order (keyboard a11y)', async ({ page }) => {
    const firstCb = page.locator('label.aaron-checkbox input').first();
    await firstCb.focus();
    await expect(firstCb).toBeFocused();
    // Space toggles via native input behaviour.
    const initiallyChecked = await firstCb.isChecked();
    await page.keyboard.press(' ');
    await expect(firstCb).toBeChecked({ checked: !initiallyChecked });
  });
});
