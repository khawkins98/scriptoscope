import { test, expect } from '@playwright/test';

// Helper assertion with ±5px tolerance — accounts for pointer-event
// rounding when Playwright steps the mouse. Standard toBeCloseTo with
// precision=0 means within 0.5 which is too strict for resize/drag.
function toBeCloseToLoose(actual: number, expected: number, tolerance = 5): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// E2E against the AaronWindow class directly, via demo/wm-fixture.html.
// Issue #10 will land a proper wm-core fixture under tests/e2e/fixtures/;
// until then we use the demo's dev server.

test.describe('AaronWindow direct (wm-fixture.html)', () => {
  test('mounts a window with correct initial dimensions', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const win = page.locator('.aaron-window').first();
    await expect(win).toBeVisible();
    const box = await win.boundingBox();
    expect(box).not.toBeNull();
    toBeCloseToLoose(box!.x, 100);
    toBeCloseToLoose(box!.y, 100);
    toBeCloseToLoose(box!.width, 320);
    toBeCloseToLoose(box!.height, 200);
  });

  test('drag SE corner enlarges the window (issue #5)', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const win = page.locator('.aaron-window').first();
    const seHandle = page.locator('[data-handle="se"]');
    const beforeBox = await win.boundingBox();
    expect(beforeBox).not.toBeNull();

    const handleBox = await seHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    const fromX = handleBox!.x + handleBox!.width / 2;
    const fromY = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 80, fromY + 60, { steps: 5 });
    await page.mouse.up();

    const afterBox = await win.boundingBox();
    expect(afterBox).not.toBeNull();
    toBeCloseToLoose(afterBox!.width, beforeBox!.width + 80);
    toBeCloseToLoose(afterBox!.height, beforeBox!.height + 60);
  });

  test('drag titlebar moves the window (issue #4 against AaronWindow)', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const win = page.locator('.aaron-window').first();
    const titlebar = page.locator('.aaron-titlebar').first();
    const beforeBox = await win.boundingBox();
    expect(beforeBox).not.toBeNull();

    const tbBox = await titlebar.boundingBox();
    expect(tbBox).not.toBeNull();
    const fromX = tbBox!.x + tbBox!.width / 2;
    const fromY = tbBox!.y + tbBox!.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 100, fromY + 40, { steps: 5 });
    await page.mouse.up();

    const afterBox = await win.boundingBox();
    expect(afterBox).not.toBeNull();
    toBeCloseToLoose(afterBox!.x, beforeBox!.x + 100);
    toBeCloseToLoose(afterBox!.y, beforeBox!.y + 40);
  });
});
