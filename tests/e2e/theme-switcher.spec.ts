import { test, expect } from '@playwright/test';

// E2E for Phase 4.9 (#43) — runtime theme switching wired end-to-end.
// Loads bundled schemes via loadTheme + attachThemeToWindow and asserts
// the visible chrome on a real AaronWindow swaps cleanly between themes.

test.describe('theme switcher (e2e)', () => {
  test('loads 7 Le and applies chrome cicn to the window titlebar', async ({ page }) => {
    await page.goto('/theme-switcher-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-masswerk-7-le');

    // 3-slice rendering: titlebar carries the cicn as border-image-source.
    const titlebarBg = await page
      .locator('.aaron-window .aaron-titlebar')
      .first()
      .evaluate((el) => (el as HTMLElement).style.borderImageSource);
    expect(titlebarBg).toContain('themes/masswerk-7-le/cicns/');
    expect(titlebarBg).toMatch(/document-window/);
  });

  test('mounts wnd# part overlays inside the titlebar', async ({ page }) => {
    await page.goto('/theme-switcher-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-masswerk-7-le');

    const parts = page.locator('.aaron-window .aaron-titlebar [data-aaron-window-part]');
    // 7 Le's document-window has 5 parts (titlebar bottom edge + close +
    // zoom + windowshade + divider).
    await expect(parts).toHaveCount(5);
  });

  test('swap from 7 Le to ErgoBox 2 cleanly re-renders the chrome', async ({ page }) => {
    await page.goto('/theme-switcher-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-masswerk-7-le');

    const firstBg = await page
      .locator('.aaron-window .aaron-titlebar')
      .first()
      .evaluate((el) => (el as HTMLElement).style.borderImageSource);
    expect(firstBg).toContain('themes/masswerk-7-le/cicns/');

    await page.locator('#load-ergobox').click();
    await expect(page.locator('#status')).toHaveText('loaded-masswerk-dark-ergobox2');
    // ErgoBox is Kind B → 9-slice border-image on the window root.
    await expect(async () => {
      const bg = await page
        .locator('.aaron-window')
        .first()
        .evaluate((el) => (el as HTMLElement).style.borderImageSource);
      expect(bg).toContain('themes/masswerk-dark-ergobox2/cicns/');
    }).toPass({ timeout: 2000 });
  });

  test('unload clears the chrome (window returns to engine-baseline)', async ({ page }) => {
    await page.goto('/theme-switcher-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-masswerk-7-le');
    await page.locator('#unload').click();
    await expect(page.locator('#status')).toHaveText('unloaded');

    // After unload, the titlebar's border-image-source should be cleared
    // and the part overlays removed.
    const titlebarBg = await page
      .locator('.aaron-window .aaron-titlebar')
      .first()
      .evaluate((el) => (el as HTMLElement).style.borderImageSource);
    expect(titlebarBg).toBe('');
    const parts = page.locator('.aaron-window .aaron-titlebar [data-aaron-window-part]');
    await expect(parts).toHaveCount(0);
  });

  // Note: drag-under-loaded-theme is implicitly covered by the WM-core e2e
  // suite (drag works without any theme loaded), plus the manual cut-through
  // of the deployed gh-pages fixture. The theme runtime doesn't touch
  // pointer-event paths — wnd# part overlays are children of the titlebar
  // and capture their own hit clicks per the architecture spec.
});
