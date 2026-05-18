import { test, expect } from '@playwright/test';

// E2E for Phase 4.5 (#39) — bundled-default 7 Le auto-load. Proves that
// importing the main entry triggers the bundled default to fetch + apply
// without any explicit consumer wiring.

test.describe('bundled-default auto-load (e2e)', () => {
  test('imports aaron-ui → 7 Le auto-loads, chrome renders, no manual loadTheme call', async ({ page }) => {
    await page.goto('/auto-default-fixture.html');

    // Wait for the auto-load to fire + complete.
    await expect(page.locator('#status')).toHaveText('auto-loaded: mass:werk 7 Le');

    // Palette applied to :root.
    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--aaron-colr-bg'),
    );
    expect(bg).toBe('#dddddd');

    // AaronWindow's titlebar has the bundled default's chrome cicn.
    // 3-slice rewrite: cicn lives on titlebar's own border-image-source.
    const titlebarBg = await page
      .locator('.aaron-window .aaron-titlebar')
      .first()
      .evaluate((el) => (el as HTMLElement).style.borderImageSource);
    expect(titlebarBg).toContain('themes/masswerk-7-le/cicns/');
    expect(titlebarBg).toMatch(/document-window/);
  });

  test('wnd# part overlays mount under auto-load', async ({ page }) => {
    await page.goto('/auto-default-fixture.html');
    await expect(page.locator('#status')).toHaveText('auto-loaded: mass:werk 7 Le');

    const parts = page.locator('.aaron-window .aaron-titlebar [data-aaron-window-part]');
    // 7 Le's document-window has 5 named parts.
    await expect(parts).toHaveCount(5);
  });
});
