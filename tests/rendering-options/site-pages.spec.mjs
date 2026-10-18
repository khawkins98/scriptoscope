import { expect } from '@playwright/test';
import { test } from './demo-fixtures.mjs';

test('wayfinding carries the scheme from installation through examples and back', async ({ page, demo }) => {
  await page.goto(`${demo}/showcase.html?theme=1138`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await page.locator('.site-primary-nav').getByRole('link', { name: 'Examples', exact: true }).click();
  await expect(page.locator('.site-primary-nav a[aria-current]')).toHaveText('Examples');
  await page.locator('.site-example-card').getByRole('link', { name: /Personal/ }).click();
  await expect(page).toHaveURL(/personal.html\?theme=1138/);
  await expect(page.locator('.site-example-nav a[aria-current]')).toHaveText('Personal page');
  await page.locator('.site-example-nav').getByRole('link', { name: 'Docs layout' }).click();
  await expect(page).toHaveURL(/docs.html\?theme=1138/);
  await page.locator('.site-next').getByRole('link', { name: /Put it on your page/ }).click();
  await expect(page).toHaveURL(/showcase.html\?theme=1138#install/);
  await expect(page.locator('#install')).toBeVisible();
});

test('diagnostic deep links reveal asynchronously created inspectors and reopen folded targets', async ({ page, demo }) => {
  await page.goto(`${demo}/diagnostic.html?theme=1138`);
  await expect(page.locator('.detail-head')).toBeVisible();
  const id = await page.locator('details.dev-tools [id]').first().getAttribute('id');
  await page.goto(`${demo}/diagnostic.html?theme=1138#${id}`);
  await expect(page.locator('details.dev-tools')).toHaveAttribute('open', '');
  await page.locator('details.dev-tools > summary').click();
  await page.locator(`.subnav a[href="#${id}"]`).click();
  await expect(page.locator('details.dev-tools')).toHaveAttribute('open', '');
});

test('dark schemes keep light code and callout surfaces readable', async ({ page, demo }) => {
  await page.goto(`${demo}/docs.html?theme=evolution`);
  await expect(page.locator('[data-scriptoscope-window-host]')).not.toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Switch theme' })).toHaveValue('evolution');
  for (const selector of ['.docs code', '.docs th', '.docs .callout strong', '.toc h2', '.anchor li']) {
    await expect(page.locator(selector).first()).toHaveCSS('color', 'rgb(40, 37, 31)');
  }
});

for (const entry of ['personal', 'shareware', 'landing', 'docs']) {
  test(`${entry} keeps wide native chrome within a phone viewport after resize`, async ({ page, demo }) => {
    await page.goto(`${demo}/${entry}.html?theme=evolution`);
    await expect(page.locator('[data-scriptoscope-window-host]')).not.toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await expect(page.locator('.site-primary-nav')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-scriptoscope-window-host]')).not.toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
}


test('landing navigation exposes the story as its own page', async ({ page, demo }) => {
  await page.goto(demo);
  const nav = page.locator('.site-primary-nav');
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Story', exact: true }).click();
  await expect(page).toHaveURL(/story.html$/);
  await expect(page.getByRole('heading', { name: 'The story behind the schemes.' })).toBeVisible();
  await expect(page.locator('.site-primary-nav a[aria-current]')).toHaveText('Story');
  await page.locator('.site-next').getByRole('link', { name: /Try & install/ }).click();
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await expect(page.locator('details.site-story')).toHaveCount(0);
});
