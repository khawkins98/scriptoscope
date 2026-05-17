import { test, expect } from '@playwright/test';

// E2E for Phase 3.4 / #73 text fields. The landing Controls window mounts
// 3 <input> fields + 1 <textarea>, all wrapped via promoteFields().

test.describe('text fields (#73)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('four fields promoted with .aaron-field wrappers', async ({ page }) => {
    await expect(page.locator('.aaron-field')).toHaveCount(4);
    // Each wraps either an input or a textarea.
    const wrappers = page.locator('.aaron-field');
    const count = await wrappers.count();
    for (let i = 0; i < count; i++) {
      const tag = await wrappers
        .nth(i)
        .locator('input, textarea')
        .first()
        .evaluate((el) => el.tagName);
      expect(['INPUT', 'TEXTAREA']).toContain(tag);
    }
  });

  test('readonly field has .aaron-field--readonly + native readonly', async ({ page }) => {
    const wrapper = page.locator('.aaron-field--readonly').first();
    await expect(wrapper).toBeVisible();
    await expect(wrapper.locator('input')).toHaveAttribute('readonly', '');
  });

  test('typing into a field updates its value', async ({ page }) => {
    const nameInput = page.locator('.aaron-field input[type="text"]').first();
    await nameInput.click();
    await nameInput.fill('');
    await nameInput.type('Bill Atkinson');
    await expect(nameInput).toHaveValue('Bill Atkinson');
  });

  test('focusing the native input puts focus inside the wrapper', async ({ page }) => {
    const emailInput = page.locator('.aaron-field input[type="email"]');
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    // The wrapper should match :focus-within (verified via JS since the
    // pseudoclass isn't directly checkable in Playwright).
    const focusWithin = await emailInput
      .evaluate((el) => el.closest('.aaron-field')?.matches(':focus-within'));
    expect(focusWithin).toBe(true);
  });

  test('textarea wraps + supports multiline value', async ({ page }) => {
    const ta = page.locator('.aaron-field textarea');
    await expect(ta).toBeVisible();
    await ta.fill('line one\nline two');
    await expect(ta).toHaveValue('line one\nline two');
  });

  test('engine-baseline focus-within rule exists in cascade', async ({ page }) => {
    const hasFocusRule = await page.evaluate(() => {
      for (const sheet of [
        ...document.styleSheets,
        ...(document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [],
      ]) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes('aaron-field') && rule.cssText.includes(':focus-within')) {
              return true;
            }
          }
        } catch { /* cross-origin */ }
      }
      return false;
    });
    expect(hasFocusRule).toBe(true);
  });
});
