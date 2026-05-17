import { test, expect } from '@playwright/test';

// Smoke tests against the demo while the real WM core is in flight.
// Once issue #2 (AaronWindow) lands, more targeted tests will live in
// tests/e2e/fixtures/wm-core.html per issue #10.

test.describe('themes-raster.html demo', () => {
  test('loads and renders three windows', async ({ page }) => {
    await page.goto('/themes-raster.html');
    await expect(page.locator('[data-aaron-window]')).toHaveCount(3);
  });

  test('theme switcher swaps reference image', async ({ page }) => {
    await page.goto('/themes-raster.html');
    const refImg = page.locator('[data-reference-img]');
    const initialSrc = await refImg.getAttribute('src');
    await page.locator('[data-aaron-theme-switcher]').selectOption('dark-ergobox');
    // Image src should change to the ErgoBox reference
    await expect(refImg).toHaveAttribute('src', /dark-ergobox/);
    expect(await refImg.getAttribute('src')).not.toBe(initialSrc);
  });

  test('close button hides a window', async ({ page }) => {
    await page.goto('/themes-raster.html');
    // Wait for theme.json fetch + hit-position layout
    await page.waitForTimeout(500);
    const hello = page.locator('[data-aaron-window][data-role="hello"]');
    await expect(hello).toBeVisible();
    const close = hello.locator('[data-action="close"]');
    await close.click();
    await expect(hello).toBeHidden();
  });

  test('checkbox click toggles state', async ({ page }) => {
    await page.goto('/themes-raster.html');
    const cb = page.locator('.aaron-checkbox').first();
    await expect(cb).toHaveAttribute('data-checked', 'false');
    await cb.click();
    await expect(cb).toHaveAttribute('data-checked', 'true');
  });
});
