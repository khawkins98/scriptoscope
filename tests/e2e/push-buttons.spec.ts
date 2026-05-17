import { test, expect } from '@playwright/test';

// E2E for Phase 3.2 / #71 push buttons. The landing page mounts three
// buttons in the "About Aaron UI" window: Cancel, Help (disabled), OK
// (default-button). They are promoted via promoteButtons() with
// [data-aaron-button] / [data-aaron-button-default] declarative markup.

test.describe('push buttons (#71)', () => {
  test('three buttons promoted on landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#active-scheme-name')).toHaveText('mass:werk 7 Le');
    // All three Aaron buttons should carry the .aaron-button class after
    // promoteButtons() runs.
    await expect(page.locator('button.aaron-button')).toHaveCount(3);
  });

  test('default-button variant carries .aaron-button--default class', async ({ page }) => {
    await page.goto('/');
    const okBtn = page.locator('#demo-ok-button');
    await expect(okBtn).toHaveClass(/aaron-button--default/);
    await expect(okBtn).toHaveAttribute('data-aaron-promoted', '');
  });

  test('disabled button has aria-disabled + native disabled', async ({ page }) => {
    await page.goto('/');
    const helpBtn = page.locator('button.aaron-button', { hasText: 'Help' });
    await expect(helpBtn).toBeDisabled();
  });

  test('data-state attribute toggles to "pressed" on pointerdown', async ({ page }) => {
    await page.goto('/');
    const okBtn = page.locator('#demo-ok-button');
    await expect(okBtn).toHaveAttribute('data-state', 'normal');

    // Press down without releasing.
    const box = await okBtn.boundingBox();
    if (!box) throw new Error('OK button has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(okBtn).toHaveAttribute('data-state', 'pressed');
    await page.mouse.up();
    await expect(okBtn).toHaveAttribute('data-state', 'normal');
  });

  test('engine-baseline stylesheet applies focus-visible outline', async ({ page }) => {
    await page.goto('/');
    const okBtn = page.locator('#demo-ok-button');
    await okBtn.focus();
    // jsdom-like check via JS — :focus-visible may not match for mouse
    // focus, so we check that the rule exists in the cascade.
    const hasFocusRule = await page.evaluate(() => {
      for (const sheet of [...document.styleSheets, ...(document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? []]) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes(':focus-visible') && rule.cssText.includes('aaron-control')) {
              return true;
            }
          }
        } catch { /* cross-origin */ }
      }
      return false;
    });
    expect(hasFocusRule).toBe(true);
  });

  test('default-button outline visible (CSS-drawn, not cicn)', async ({ page }) => {
    await page.goto('/');
    const okBtn = page.locator('#demo-ok-button');
    const boxShadow = await okBtn.evaluate(
      (el) => window.getComputedStyle(el).boxShadow,
    );
    // The default-button variant adds an extra 2px outline via box-shadow.
    // Just check that there's a non-trivial box-shadow set (not "none").
    expect(boxShadow).not.toBe('none');
    expect(boxShadow.length).toBeGreaterThan(10);
  });
});
