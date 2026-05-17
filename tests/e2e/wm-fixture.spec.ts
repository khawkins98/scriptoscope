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
  test('mounts windows with correct initial dimensions', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const windows = page.locator('.aaron-window');
    await expect(windows).toHaveCount(3);
    const a = page.locator('.aaron-window').first();
    const aBox = await a.boundingBox();
    expect(aBox).not.toBeNull();
    toBeCloseToLoose(aBox!.x, 100);
    toBeCloseToLoose(aBox!.y, 100);
    toBeCloseToLoose(aBox!.width, 320);
    toBeCloseToLoose(aBox!.height, 200);
  });

  test('drag SE corner enlarges the window (issue #5)', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    // Click window A first to bring it to top, then resize it.
    const a = page.locator('.aaron-window').first();
    await a.click({ position: { x: 20, y: 20 } });
    const beforeBox = await a.boundingBox();

    const seHandle = a.locator('[data-handle="se"]');
    const handleBox = await seHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    const fromX = handleBox!.x + handleBox!.width / 2;
    const fromY = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 80, fromY + 60, { steps: 5 });
    await page.mouse.up();

    const afterBox = await a.boundingBox();
    toBeCloseToLoose(afterBox!.width, beforeBox!.width + 80);
    toBeCloseToLoose(afterBox!.height, beforeBox!.height + 60);
  });

  test('drag titlebar moves the window (issue #4 against AaronWindow)', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    // Use window B (middle of stack) to avoid relying on auto-focus
    const b = page.locator('.aaron-window').nth(1);
    // Click at B's top-left corner — not overlapped by C (which starts at x=300)
    await b.click({ position: { x: 20, y: 20 } });
    const beforeBox = await b.boundingBox();
    const titlebar = b.locator('.aaron-titlebar');
    const tbBox = await titlebar.boundingBox();
    expect(tbBox).not.toBeNull();
    const fromX = tbBox!.x + tbBox!.width / 2;
    const fromY = tbBox!.y + tbBox!.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 100, fromY + 40, { steps: 5 });
    await page.mouse.up();
    const afterBox = await b.boundingBox();
    toBeCloseToLoose(afterBox!.x, beforeBox!.x + 100);
    toBeCloseToLoose(afterBox!.y, beforeBox!.y + 40);
  });

  test('click on a buried window raises it (issue #6)', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const a = page.locator('.aaron-window').first();      // Window A — bottom of stack
    const c = page.locator('.aaron-window').nth(2);       // Window C — top initially

    // Initially C should be active, A inactive
    await expect(c).toHaveAttribute('data-state', 'active');
    await expect(a).toHaveAttribute('data-state', 'inactive');

    // Click on A's titlebar (a visible-and-not-overlapped area of A)
    const titlebar = a.locator('.aaron-titlebar');
    const tbBox = await titlebar.boundingBox();
    expect(tbBox).not.toBeNull();
    // Click far-left of titlebar to avoid being under C
    await page.mouse.click(tbBox!.x + 5, tbBox!.y + 5);

    // A becomes active, C inactive
    await expect(a).toHaveAttribute('data-state', 'active');
    await expect(c).toHaveAttribute('data-state', 'inactive');

    // And A's z-index is higher than C's
    const aZ = await a.evaluate(el => parseInt((el as HTMLElement).style.zIndex || '0', 10));
    const cZ = await c.evaluate(el => parseInt((el as HTMLElement).style.zIndex || '0', 10));
    expect(aZ).toBeGreaterThan(cZ);
  });
});
