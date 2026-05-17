import { test, expect } from '@playwright/test';

// E2E for Phase 4.4 (#38) — loadTheme() core. Verifies the full pipeline
// against the Vite-served canonical bundles in themes/<slug>/.

test.describe('loadTheme + ThemeRegistry (e2e)', () => {
  test('loads mass:werk 7 Le and applies its palette to :root', async ({ page }) => {
    await page.goto('/theme-loader-fixture.html');

    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-7le');

    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--aaron-colr-bg'),
    );
    expect(bg).toBe('#dddddd');

    const titlebar = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--aaron-colr-titlebar-active-bg'),
    );
    expect(titlebar).toBe('#cccccc');
  });

  test('loads ErgoBox 2 after 7 Le and cleanly replaces palette', async ({ page }) => {
    await page.goto('/theme-loader-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-7le');

    await page.locator('#load-ergobox').click();
    await expect(page.locator('#status')).toHaveText('loaded-ergobox');

    // ErgoBox bg is dark.
    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--aaron-colr-bg'),
    );
    expect(bg).toBe('#3a3a3a');

    // 7 Le's titlebar-active-bg should have been replaced by ErgoBox's value
    // (both schemes happen to define this key; the value differs).
    const titlebar = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--aaron-colr-titlebar-active-bg'),
    );
    expect(titlebar).toBe('#5a5a5a');
  });

  test('resolves asset URLs to absolute paths under the bundle root', async ({ page }) => {
    await page.goto('/theme-loader-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-7le');

    const sampleAsset = await page.evaluate(() => {
      const t = window.__aaronTheme.themeRegistry.current();
      // Pick any chrome element — the asset should be a full URL, not a relative path.
      const entry = Object.values(t?.chromeElements ?? {})[0];
      return entry?.asset ?? null;
    });
    expect(sampleAsset).toMatch(/^https?:\/\/[^/]+\/themes\/masswerk-7-le\/cicns\//);
  });

  test('unload clears the palette', async ({ page }) => {
    await page.goto('/theme-loader-fixture.html');
    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-7le');

    await page.locator('#unload').click();
    await expect(page.locator('#status')).toHaveText('unloaded');

    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--aaron-colr-bg'),
    );
    expect(bg).toBe('');
  });

  test('dispatches aaron:themechange on document', async ({ page }) => {
    await page.goto('/theme-loader-fixture.html');
    // Install listener BEFORE the load — capture the next event.
    await page.evaluate(() => {
      window.__themeChanges = [];
      document.addEventListener('aaron:themechange', (e) => {
        window.__themeChanges.push((e as CustomEvent).detail.theme?.name ?? null);
      });
    });

    await page.locator('#load-7le').click();
    await expect(page.locator('#status')).toHaveText('loaded-7le');

    const changes = await page.evaluate(() => window.__themeChanges);
    expect(changes).toEqual(['mass:werk 7 Le']);
  });
});

declare global {
  interface Window {
    __aaronTheme: {
      loadTheme: (url: string) => Promise<unknown>;
      themeRegistry: {
        current: () => { chromeElements?: Record<string, { asset: string }> } | null;
      };
    };
    __themeChanges: Array<string | null>;
  }
}
