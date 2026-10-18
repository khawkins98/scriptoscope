import { expect } from '@playwright/test';
import { test } from './demo-fixtures.mjs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { root } from './servers.mjs';


async function routePublicAssets(page) {
  await page.route('https://khawkins98.github.io/scriptoscope/**', async route => {
    const suffix = new URL(route.request().url()).pathname.replace('/scriptoscope/', '');
    const path = resolve(root, suffix === 'themes-manifest.json' ? 'demo/themes-manifest.json' : suffix.startsWith('themes/') ? suffix : `dist/${suffix}`);
    const contentType = suffix.endsWith('.js') ? 'text/javascript'
      : suffix.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    const headers = { 'Access-Control-Allow-Origin': '*' };
    try { await route.fulfill({ body: await readFile(path), contentType, headers }); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Preserve the real server's .sit -> .rsrc fallback behavior.
      await route.fulfill({ status: 404, body: 'Not found', headers });
    }
  });
}

const hosts = page => page.locator('#collage [data-scriptoscope-window-host]');
async function ready(page) {
  await expect(hosts(page)).toHaveCount(5);
  await expect(page.locator('#reset-collage')).toBeEnabled();
}

test('portrait rethemes preserve geometry, keyboard focus and closed windows; reset restores them', async ({ page, demo }) => {
  await page.goto(demo);
  await ready(page);
  const smile = hosts(page).nth(4);
  const before = await smile.evaluate(el => parseFloat(el.style.left));
  await smile.getByRole('button', { name: 'Move window', exact: true }).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => smile.evaluate(el => parseFloat(el.style.left))).toBe(before + 32);
  await hosts(page).nth(2).getByRole('button', { name: 'Close window', exact: true }).click();
  await expect(hosts(page)).toHaveCount(4);
  const beos = page.getByRole('button', { name: 'BeOS R5.0.3', exact: true });
  await beos.focus();
  await page.keyboard.press('Enter');
  await expect(beos).toHaveAttribute('aria-pressed', 'true');
  await expect(beos).toBeFocused();
  await expect(hosts(page)).toHaveCount(4);
  await expect.poll(() => hosts(page).last().evaluate(el => parseFloat(el.style.left))).toBe(before + 32);
  await expect(page.locator('#collage [data-scriptoscope-theme="beos-r503"]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Reassemble the face' }).click();
  await ready(page);
  await expect(page.locator('#collage [data-scriptoscope-theme="beos-r503"]')).toHaveCount(5);
  await page.getByRole('button', { name: 'Original mix', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-portrait-theme="mix"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => hosts(page).evaluateAll(nodes => nodes.map(el => el.dataset.scriptoscopeTheme)))
    .toEqual(['1984', '1138', 'crayon-os', 'beos-r503', 'windows-95']);
});

test('failed initial theme requests leave the portrait recoverable', async ({ page, demo }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route('**/themes/**', route => route.abort());
  await page.goto(demo);
  await expect(page.locator('#collage-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeEnabled();
  await expect(page.locator('#reset-collage')).toBeHidden();
  await expect(page.locator('#collage [data-scriptoscope-window]')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.unroute('**/themes/**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await ready(page);
  await expect(page.locator('#collage-error')).toBeHidden();
});

test('the displayed installation snippet mounts a real window as copied', async ({ page, demo }) => {
  await page.goto(`${demo}/install.html?theme=1138`);
  const snippet = await page.locator('#powers-install-snippet').textContent();
  // Serve the real built entry and real archive at the public URLs in the
  // snippet, so this verifies its bootstrap rather than a rewritten example.
  await routePublicAssets(page);
  await page.setContent(snippet);
  await expect(page.locator('[data-scriptoscope-window-host]')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Hello world');
});

test('windows remain visible beyond the original collage and the initial phone layout fits', async ({ page, demo }) => {
  await page.goto(demo);
  await ready(page);
  const smile = hosts(page).nth(4);
  const start = await smile.getByRole('button', { name: 'Move window', exact: true }).boundingBox();
  const before = await smile.evaluate(el => parseFloat(el.style.left));
  const x = start.x + start.width / 2, y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 360, y + 300);
  await page.mouse.up();
  await expect.poll(() => smile.evaluate(el => parseFloat(el.style.left))).toBe(before + 360);
  await expect(page.getByRole('button', { name: 'Reassemble the face', exact: true })).toBeVisible();
  expect(await page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest('[data-scriptoscope-window-host]')?.dataset.scriptoscopeTheme,
  { x: x + 360, y: y + 300 })).toBe('windows-95');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(demo);
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.getByRole('link', { name: 'Explore the possibilities' })).toHaveAttribute('href', './showcase.html');
});


test('reassembly appears after movement and hides when the face is restored', async ({ page, demo }) => {
  await page.goto(demo);
  await ready(page);
  const reset = page.getByRole('button', { name: 'Reassemble the face', exact: true });
  await expect(reset).toBeHidden();
  await page.getByRole('button', { name: 'BeOS R5.0.3', exact: true }).click();
  await expect(page.locator('#collage [data-scriptoscope-theme="beos-r503"]')).toHaveCount(5);
  await expect(reset).toBeHidden();
  const move = hosts(page).first().getByRole('button', { name: 'Move window', exact: true });
  await move.focus();
  await expect(reset).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(reset).toBeVisible();
  await reset.click();
  await expect(reset).toBeHidden();
  await expect(move).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(reset).toBeVisible();
  await page.getByRole('button', { name: 'Original mix', exact: true }).click();
  await expect(reset).toBeHidden();
  await hosts(page).first().getByRole('button', { name: 'Close window', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(hosts(page)).toHaveCount(4);
  await expect(reset).toBeHidden();
  await expect(hosts(page).first().getByRole('button', { name: 'Move window', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Original mix', exact: true }).click();
  await ready(page);
  await expect(reset).toBeHidden();
});


test('the printed custom-theme recipe decodes a real StuffIt file', async ({ page, demo }) => {
  await page.goto(`${demo}/install.html`);
  const snippet = await page.locator('#install-byo-snippet').textContent();
  await routePublicAssets(page);
  await page.setContent(snippet);
  await expect(page.locator('[data-scriptoscope-window-host]')).toHaveCount(1);
  await page.locator('#pick-theme input[type=file]').setInputFiles(resolve(root, 'themes/windows-95/scheme.sit'));
  await expect(page.locator('#theme-status')).toHaveText('Loaded scheme.sit');
  await expect(page.locator('[data-scriptoscope-window-host]')).toHaveAttribute('data-scriptoscope-theme', 'my-scheme');
});


test('the printed desktop options populate and switch the catalog', async ({ page, demo }) => {
  await page.goto(`${demo}/install.html?theme=monkey-paradise`);
  await expect(page.locator('#install-scheme-name')).toHaveText('monkey-paradise');
  const starter = await page.locator('#powers-install-snippet').textContent();
  const markup = await page.locator('#install-switcher').textContent();
  const options = await page.locator('#install-options').textContent();
  const snippet = starter.replace(/<article[\s\S]*?<\/article>/, markup)
    .replace(/const handle = await mountDeclarative\(\{[\s\S]*?\}\);/, options);
  await routePublicAssets(page);
  await page.setContent(snippet);
  await expect(page.locator('#desktop [data-scriptoscope-window-host]')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Choose a scheme' })).toHaveValue('monkey-paradise');
  await page.getByRole('combobox', { name: 'Choose a scheme' }).selectOption('1984');
  await expect(page.locator('#desktop [data-scriptoscope-window-host]')).toHaveAttribute('data-scriptoscope-theme', '1984');
});
