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

  test('drag a window by titlebar moves it (issue #4)', async ({ page }) => {
    await page.goto('/themes-raster.html');
    // Wait for theme.json + hit-zone positioning to settle.
    await page.waitForTimeout(600);
    const main = page.locator('[data-aaron-window][data-role="main"]');
    await expect(main).toBeVisible();

    // Capture initial position
    const beforeBox = await main.boundingBox();
    expect(beforeBox).not.toBeNull();

    // Use the demo's drag-zone element (inside the titlebar, between widgets).
    const dragZone = main.locator('.aaron-window__drag-zone');
    const zoneBox = await dragZone.boundingBox();
    expect(zoneBox).not.toBeNull();

    // Drag 100px right + 50px down using Playwright's mouse API.
    const startX = zoneBox!.x + zoneBox!.width / 2;
    const startY = zoneBox!.y + zoneBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50, { steps: 5 });
    await page.mouse.up();

    // Window should have moved
    const afterBox = await main.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(afterBox!.x).toBeGreaterThan(beforeBox!.x + 50);
    expect(afterBox!.y).toBeGreaterThan(beforeBox!.y + 25);
  });
});
