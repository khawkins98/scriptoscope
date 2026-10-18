import { expect } from '@playwright/test';
import { test } from './demo-fixtures.mjs';

test('showcase No theme restores its two original control buttons and remounts once with live form state', async ({ page, demo }) => {
  await page.goto(`${demo}/showcase.html?theme=windows-95`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await expect(page.locator('#powers button[data-scriptoscope-button] + .scriptoscope-button')).toHaveCount(2);
  const range = page.getByRole('slider', { name: 'Vol', exact: true });
  await range.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#powers-hero-vol')).toHaveValue('51');
  await page.evaluate(() => {
    const root = document.querySelector('#powers');
    const f = window.showcaseButtons = { originals: [...root.querySelectorAll('button[data-scriptoscope-button]')],
      faces: [...root.querySelectorAll('button[data-scriptoscope-button] + .scriptoscope-button')], range: root.querySelector('#powers-hero-vol'), calls: 0 };
    f.originals[0].addEventListener('click', () => f.calls++);
  });
  await page.getByRole('button', { name: /Switch to bare HTML/ }).click();
  await expect(page.locator('#powers.scriptoscope-ready')).toHaveCount(0);
  await expect(page.locator('#powers .scriptoscope-button')).toHaveCount(0);
  await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(0);
  for (const name of ['OK', 'Cancel']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const f = window.showcaseButtons;
    for (const face of f.faces) { face.dispatchEvent(new PointerEvent('pointerdown')); face.dispatchEvent(new PointerEvent('pointerup')); }
    return { same: f.originals.every(el => el.isConnected && getComputedStyle(el).display !== 'none'), calls: f.calls,
      range: f.range === document.querySelector('#powers-hero-vol'), value: f.range.value };
  })).toEqual({ same: true, calls: 0, range: true, value: '51' });
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  expect(await page.evaluate(() => window.showcaseButtons.calls)).toBe(1);
  await page.locator('[data-slug="system7-nostalgia-silver"]').click();
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await expect(page.locator('#install-teaser')).toHaveAttribute('data-scriptoscope-theme', 'system7-nostalgia-silver');
  await expect(page.locator('#powers button[data-scriptoscope-button] + .scriptoscope-button')).toHaveCount(2);
  await expect(page.locator('#powers-hero-vol')).toHaveValue('51');
  expect(await page.evaluate(() => window.showcaseButtons.originals.every(el => el.isConnected && el.nextElementSibling?.classList.contains('scriptoscope-button')))).toBe(true);
  await page.getByRole('button', { name: 'OK', exact: true }).focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.showcaseButtons.calls)).toBe(2);
  await page.getByRole('button', { name: /Switch to bare HTML/ }).click();
  await expect(page.locator('#powers .scriptoscope-button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'OK', exact: true })).toBeVisible();
});
