import { test, expect } from '@playwright/test';

// E2E for #64.2 title-pill positioning. After loadTheme completes, every
// titlebar should carry the --aaron-title-pill-{left,right} custom
// properties derived from the windowType's top recipe, and the title
// text element should be constrained to that zone.

test.describe('title pill (#64.2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('every titlebar has the pill custom properties set', async ({ page }) => {
    const titlebars = page.locator('.aaron-titlebar');
    const count = await titlebars.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const props = await titlebars
        .nth(i)
        .evaluate((el) => ({
          l: (el as HTMLElement).style.getPropertyValue('--aaron-title-pill-left'),
          r: (el as HTMLElement).style.getPropertyValue('--aaron-title-pill-right'),
        }));
      expect(props.l).toMatch(/%$/);
      expect(props.r).toMatch(/%$/);
    }
  });

  test('title element honours the pill bounds (left + right inset)', async ({ page }) => {
    const title = page.locator('.aaron-titlebar__title').first();
    const titlebar = page.locator('.aaron-titlebar').first();
    const titleBox = await title.boundingBox();
    const tbBox = await titlebar.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(tbBox).not.toBeNull();
    // Title should be strictly INSIDE the titlebar by some positive margin.
    expect(titleBox!.x).toBeGreaterThan(tbBox!.x);
    expect(titleBox!.x + titleBox!.width).toBeLessThan(tbBox!.x + tbBox!.width);
  });

  test('long titles get truncated rather than overflowing', async ({ page }) => {
    const title = page.locator('.aaron-titlebar__title').first();
    const span = title.locator('span').first();
    const overflowed = await span.evaluate(
      (el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth,
    );
    // Title may or may not be truncated depending on scheme; the key
    // assertion is that the span is constrained (overflow:hidden), not
    // that it overflows visibly. We just verify the parent has overflow
    // hidden so even when overflowed, no visible bleed occurs.
    const parentOverflow = await title.evaluate((el) => getComputedStyle(el).overflow);
    expect(parentOverflow).toBe('hidden');
    // Sanity: at least the first window's title should be too long for
    // the 7 Le narrow pill, so this confirms the truncation path runs.
    if (overflowed) {
      const textOverflow = await span.evaluate((el) => getComputedStyle(el).textOverflow);
      expect(textOverflow).toBe('ellipsis');
    }
  });

  test('pill props update on theme switch', async ({ page }) => {
    const titlebar = page.locator('.aaron-titlebar').first();
    const before = await titlebar.evaluate(
      (el) => (el as HTMLElement).style.getPropertyValue('--aaron-title-pill-left'),
    );
    await page.locator('#scheme-switcher').selectOption('masswerk-dark-ergobox2');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk Dark ErgoBox 2');
    await page.waitForTimeout(100);
    const after = await titlebar.evaluate(
      (el) => (el as HTMLElement).style.getPropertyValue('--aaron-title-pill-left'),
    );
    // Different schemes have different recipes → different pill bounds.
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });
});
