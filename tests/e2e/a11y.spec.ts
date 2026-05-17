import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Accessibility e2e — runs axe-core against the demo pages.
// Per issue #9 PRD §Core principle #7: "Accessibility considered from
// the start, not retrofitted." This catches regressions early.
//
// We focus on serious/critical issues — color contrast is theme-
// dependent so we exclude that rule to avoid false positives from
// the demo's intentionally-monochrome inline styles.

test.describe('a11y axe scans (issue #9)', () => {
  test('wm-fixture.html has no serious or critical violations', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'])
      .analyze();
    const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking).toEqual([]);
  });

  test('scanner-fixture.html has no serious or critical violations', async ({ page }) => {
    await page.goto('/scanner-fixture.html');
    // Wait for scanner to finish promoting
    await page.waitForTimeout(100);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'])
      .analyze();
    const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking).toEqual([]);
  });

  test('AaronWindow has role=dialog and aria-labelledby', async ({ page }) => {
    await page.goto('/wm-fixture.html');
    const win = page.locator('.aaron-window').first();
    await expect(win).toHaveAttribute('role', 'dialog');
    const labelId = await win.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const label = page.locator(`#${labelId}`);
    await expect(label).toHaveText('Window A');
  });
});
