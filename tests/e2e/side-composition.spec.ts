import { test, expect } from '@playwright/test';

// E2E for the side + bottom edge containers. After the chrome refinement
// PR following #87 (cicn-derived frame color + drop edge rendering), the
// three [data-aaron-edge] containers exist as structural placeholders
// but are not visually rendered — the period-correct 1px hairline frame
// is drawn via consumer CSS using --aaron-cicn-frame-color sampled from
// the cicn at runtime.
//
// These tests assert the structural contract: containers present + empty
// + frame color custom property is set.

test.describe('window frame (post-#87 refinement)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
  });

  test('every window has three structural edge containers', async ({ page }) => {
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

  test('edge containers render 3-slice pieces sized by derived geometry', async ({ page }) => {
    // Bottom edge has 3-piece (left/middle/right); left + right each
    // have 3-piece (top/middle/bottom). So per window: 3 + 3 + 3 = 9.
    const segs = page.locator('.aaron-window').first().locator('[data-aaron-edge] [data-3slice-piece]');
    await expect(segs).toHaveCount(9);
  });

  test('window root carries --aaron-frame-*-px geometry properties', async ({ page }) => {
    await expect(async () => {
      const geom = await page
        .locator('.aaron-window')
        .first()
        .evaluate((el) => ({
          l: (el as HTMLElement).style.getPropertyValue('--aaron-frame-left-px'),
          r: (el as HTMLElement).style.getPropertyValue('--aaron-frame-right-px'),
          b: (el as HTMLElement).style.getPropertyValue('--aaron-frame-bottom-px'),
        }));
      expect(geom.l).toMatch(/^\d+px$/);
      expect(geom.r).toMatch(/^\d+px$/);
      expect(geom.b).toMatch(/^\d+px$/);
    }).toPass({ timeout: 2000 });
  });

  test('window root carries --aaron-cicn-frame-color after theme load', async ({ page }) => {
    // The sample is async (image load + canvas readback) so allow a
    // brief settle window.
    await expect(async () => {
      const color = await page
        .locator('.aaron-window')
        .first()
        .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--aaron-cicn-frame-color'));
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }).toPass({ timeout: 2000 });
  });

  test('frame color updates on theme switch', async ({ page }) => {
    await expect(async () => {
      const color = await page
        .locator('.aaron-window')
        .first()
        .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--aaron-cicn-frame-color'));
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }).toPass({ timeout: 2000 });
    const before = await page
      .locator('.aaron-window')
      .first()
      .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--aaron-cicn-frame-color'));

    await page.locator('#scheme-switcher').selectOption('masswerk-dark-ergobox2');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk Dark ErgoBox 2');

    await expect(async () => {
      const after = await page
        .locator('.aaron-window')
        .first()
        .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--aaron-cicn-frame-color'));
      expect(after).toMatch(/^#[0-9a-f]{6}$/);
      expect(after).not.toBe(before);
    }).toPass({ timeout: 2000 });
  });
});
