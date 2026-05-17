import { test, expect } from '@playwright/test';

// E2E for #64.3 side + bottom composition. Every AaronWindow gains three
// edge containers ([data-aaron-edge="bottom|left|right"]); after a theme
// loads, each gets composed segment divs.

test.describe('side + bottom composition (#64.3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('every window has three edge containers', async ({ page }) => {
    const windows = page.locator('.aaron-window');
    const count = await windows.count();
    for (let i = 0; i < count; i++) {
      const sides = await windows
        .nth(i)
        .locator('[data-aaron-edge]')
        .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.aaronEdge));
      expect(sides).toEqual(expect.arrayContaining(['bottom', 'left', 'right']));
    }
  });

  test('bottom edge has composed segments after theme load', async ({ page }) => {
    const bottom = page.locator('.aaron-window [data-aaron-edge="bottom"]').first();
    const segs = await bottom.locator('[data-aaron-chrome-segment="bottom"]').count();
    expect(segs).toBeGreaterThan(0);
  });

  test('left edge has composed segments', async ({ page }) => {
    const left = page.locator('.aaron-window [data-aaron-edge="left"]').first();
    const segs = await left.locator('[data-aaron-chrome-segment="left"]').count();
    expect(segs).toBeGreaterThan(0);
  });

  test('right edge has composed segments', async ({ page }) => {
    const right = page.locator('.aaron-window [data-aaron-edge="right"]').first();
    const segs = await right.locator('[data-aaron-chrome-segment="right"]').count();
    expect(segs).toBeGreaterThan(0);
  });

  test('edge segments reference the active theme cicn', async ({ page }) => {
    const seg = page
      .locator('.aaron-window [data-aaron-edge="bottom"] [data-aaron-chrome-segment]')
      .first();
    const bg = await seg.evaluate((el) => (el as HTMLElement).style.backgroundImage);
    expect(bg).toContain('themes/masswerk-7-le/cicns/');
  });

  test('edges re-compose on theme switch', async ({ page }) => {
    const bottomSeg = page
      .locator('.aaron-window [data-aaron-edge="bottom"] [data-aaron-chrome-segment]')
      .first();
    const before = await bottomSeg.evaluate((el) => (el as HTMLElement).style.backgroundImage);
    await page.locator('#scheme-switcher').selectOption('masswerk-dark-ergobox2');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk Dark ErgoBox 2');
    await page.waitForTimeout(100);
    const after = await bottomSeg.evaluate((el) => (el as HTMLElement).style.backgroundImage);
    expect(after).toContain('themes/masswerk-dark-ergobox2/cicns/');
    expect(after).not.toBe(before);
  });
});
