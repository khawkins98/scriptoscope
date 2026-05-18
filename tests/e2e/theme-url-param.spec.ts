import { test, expect } from '@playwright/test';

// E2E for the ?theme=<slug> deep-link parameter on the main demo. This
// also documents the workflow for Playwright-driven per-scheme
// screenshot capture.

const SCHEMES = [
  { slug: 'masswerk-7-le',          expectedName: 'mass:werk 7 Le' },
  { slug: 'masswerk-dark-ergobox2', expectedName: 'mass:werk Dark ErgoBox 2' },
  { slug: 'acid',                   expectedName: 'Acid' },
  { slug: '1138',                   expectedName: '1138' },
  { slug: 'big-blue',               expectedName: 'Big Blue is Watching' },
  { slug: '1990',                   expectedName: '1990' },
  { slug: 'evolution',              expectedName: '1991 evolution' },
];

test.describe('?theme= deep-link parameter', () => {
  for (const { slug, expectedName } of SCHEMES) {
    test(`?theme=${slug} loads the requested scheme`, async ({ page }) => {
      await page.goto(`/?theme=${slug}`);
      await expect(page.locator('#active-scheme-name')).toHaveText(expectedName);
    });
  }

  test('invalid ?theme= silently falls back to the bundled default', async ({ page }) => {
    await page.goto('/?theme=does-not-exist');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('changing the <select> updates the URL', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
    await page.locator('#scheme-switcher').selectOption('big-blue');
    await expect(page.locator('#active-scheme-name')).toHaveText('Big Blue is Watching');
    expect(page.url()).toContain('theme=big-blue');
  });
});
