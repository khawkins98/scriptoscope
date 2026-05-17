import { test, expect } from '@playwright/test';

// E2E for the rewritten landing page (Phase 4.10 / #44). Smoke test:
// four real AaronWindow instances mount, the bundled default auto-loads,
// chrome paints, the switcher swaps themes.

test.describe('landing page (index.html)', () => {
  test('mounts four AaronWindow instances', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.aaron-window')).toHaveCount(4);
  });

  test('bundled default auto-loads + provenance bar shows the active scheme', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('chrome renders on each window after auto-load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
    // V2 (#64.1) composer puts cicn URLs on segment child divs. Every
    // titlebar should have at least one segment referencing the bundled
    // 7 Le chrome.
    for (let i = 0; i < 4; i++) {
      const bg = await page
        .locator('.aaron-window')
        .nth(i)
        .locator('.aaron-titlebar [data-aaron-chrome-segment]')
        .first()
        .evaluate((el) => (el as HTMLElement).style.backgroundImage);
      expect(bg).toContain('themes/masswerk-7-le/cicns/');
    }
  });

  test('swapping the <select> triggers a theme load + chrome re-render', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');

    await page.locator('#scheme-switcher').selectOption('masswerk-dark-ergobox2');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk Dark ErgoBox 2');
    await page.waitForTimeout(100);

    // All windows updated to the new chrome path.
    const bg = await page
      .locator('.aaron-window .aaron-titlebar [data-aaron-chrome-segment]')
      .first()
      .evaluate((el) => (el as HTMLElement).style.backgroundImage);
    expect(bg).toContain('themes/masswerk-dark-ergobox2/cicns/');
  });

  test('side-by-side reference thumbnail loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
    const refImg = page.locator('#reference-img');
    await expect(refImg).toHaveAttribute('src', /assets\/references\/masswerk-7-le\.jpg/);
    // Also verify the image actually loaded (no broken-image fallback).
    const naturalWidth = await refImg.evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });
});
