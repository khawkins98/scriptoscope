import { expect } from '@playwright/test';
import { test } from './demo-fixtures.mjs';
import { root } from './servers.mjs';
import { resolve } from 'node:path';

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
  await expect(page).toHaveURL(/install.html\?theme=1138/);
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
  await page.locator('.site-next').getByRole('link', { name: /Try the showcase/ }).click();
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await expect(page.locator('details.site-story')).toHaveCount(0);
});

for (const theme of ['evolution', 'black-platinum']) {
  test(`showcase ${theme} keeps its real frames and installation readable on phones`, async ({ page, demo }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${demo}/showcase.html?theme=1138`);
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    await page.locator(`[data-slug="${theme}"]`).click();
    await expect(page.locator('#install-teaser')).toHaveAttribute('data-scriptoscope-theme', theme);
    const framesFit = () => page.locator('#powers [data-scriptoscope-window-host]').evaluateAll(hosts => hosts.every(host => {
      const frame = host.shadowRoot?.querySelector('.scriptoscope-window');
      const rect = frame?.getBoundingClientRect();
      if (frame && getComputedStyle(frame).visibility === 'hidden') return true;
      return !rect?.width || rect.right <= innerWidth;
    }));
    await expect.poll(framesFit).toBe(true);
    // Both utility palettes have a light author-controlled interior.
    const luminance = await page.locator('.site-install-heading').evaluate(el => {
      const rgb = getComputedStyle(el).color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const linear = rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    });
    expect(1.05 / (luminance + .05)).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('button', { name: /Switch to bare HTML/ }).click();
    await page.getByRole('button', { name: /Restore the chrome/ }).click();
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    await expect.poll(framesFit).toBe(true);
    await page.setViewportSize({ width: 1280, height: 960 });
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(framesFit).toBe(true);
  });
}


test('showcase reflow retains an uploaded scheme and its modal behavior', async ({ page, demo }) => {
  await page.goto(`${demo}/showcase.html?theme=1138`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await page.getByRole('button', { name: /Load your own Kaleidoscope scheme/ }).click();
  await expect(page.locator('#powers-byo-modal-wrap')).toHaveAttribute('data-scriptoscope-modal-open', '');
  await page.locator('#powers-byo-modal-drop input[type=file]').setInputFiles(resolve(root, 'themes/1138/scheme.rsrc'));
  await expect(page.locator('#powers-byo-modal-out')).toContainText('Now wearing');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => page.locator('#install-teaser').getAttribute('data-scriptoscope-theme')).toBe('dropped:scheme.rsrc');
  await expect.poll(() => page.evaluate(() => {
    const frame = document.querySelector('#install-teaser')?.shadowRoot?.querySelector('.scriptoscope-window');
    return frame ? frame.getBoundingClientRect().right <= innerWidth : false;
  })).toBe(true);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await page.getByRole('button', { name: /Load your own Kaleidoscope scheme/ }).click();
  await expect(page.locator('#powers-byo-modal-wrap')).toHaveAttribute('data-scriptoscope-modal-open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#powers-byo-modal-wrap')).not.toHaveAttribute('data-scriptoscope-modal-open', '');
});


test('installation is separate, preserves old links, and carries the chosen scheme into examples', async ({ page, demo }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${demo}/showcase.html?theme=monkey-paradise#install`);
  await expect(page).toHaveURL(/install.html\?theme=monkey-paradise#install/);
  await expect(page.locator('.site-primary-nav a[aria-current]')).toHaveText('Install');
  await expect(page.locator('#install[data-code-windows-ready]')).toBeVisible();
  await expect(page.locator('#powers-install-snippet')).toContainText("pageThemeDefault: 'monkey-paradise'");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('link', { name: 'Your own theme', exact: true }).click();
  await expect(page.locator('#own-theme-title')).toBeVisible();
  await page.getByRole('link', { name: 'Try a file in the showcase →', exact: true }).click();
  await expect(page).toHaveURL(/showcase.html\?theme=monkey-paradise#bring-your-own/);
  await expect(page.locator('#powers-byo-modal-wrap')).toHaveAttribute('data-scriptoscope-modal-open', '');
});


for (const theme of ['1138', 'evolution']) {
  test(`install code snippets use real ${theme} windows and reflow on phones`, async ({ page, demo }) => {
    await page.goto(`${demo}/install.html?theme=${theme}`);
    await expect(page.locator('#install[data-code-windows-ready]')).toBeVisible();
    const windows = page.locator('#install .site-code-example[data-scriptoscope-window-host]');
    await expect(windows).toHaveCount(6);
    await expect(windows.first().getByRole('button', { name: 'Move window', exact: true })).toBeAttached();
    const snippet = await page.locator('#powers-install-snippet').textContent();
    await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => windows.evaluateAll(hosts => hosts.length === 6 && hosts.every(host => {
      const frame = host.shadowRoot?.querySelector('.scriptoscope-window');
      return frame && frame.getBoundingClientRect().right <= innerWidth;
    }))).toBe(true);
    await expect(page.locator('#powers-install-snippet')).toHaveText(snippet);
    await expect(page.getByRole('button', { name: 'Copy complete starter', exact: true })).toBeVisible();
    await expect(page.locator('#powers-install-snippet')).toHaveCSS('overflow-x', 'auto');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
}

test('dragging an in-flow window on a scrolled page moves it with the pointer', async ({ page, demo }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${demo}/install.html`);
  await expect(page.locator('#install[data-code-windows-ready]')).toBeVisible();
  const host = page.locator('#install .site-code-example[data-scriptoscope-window-host]').nth(2);
  await host.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 200));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  const frameRect = () => host.evaluate(el => {
    const r = el.shadowRoot.querySelector('.scriptoscope-window').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width };
  });
  // The responsive layer may remount once after ready; wait for a settled frame.
  await expect.poll(async () => {
    const a = await frameRect();
    await page.waitForTimeout(250);
    const b = await frameRect();
    return a.x === b.x && a.y === b.y && await host.evaluate(el => el.isConnected);
  }, { timeout: 10_000 }).toBe(true);
  const before = await frameRect();
  // Grab the title bar's frame strip, clear of the title widgets.
  const x = before.x + 120, y = before.y + 6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 20, { steps: 4 });
  await page.mouse.up();
  const after = await frameRect();
  expect(Math.round(after.x - before.x)).toBe(30);
  expect(Math.round(after.y - before.y)).toBe(20);
});

test('reading pages wear real scheme windows', async ({ page, demo }) => {
  for (const name of ['story', 'acknowledgements', 'inspiration']) {
    await page.goto(`${demo}/${name}.html`);
    await expect(page.locator('main [data-scriptoscope-window-host]').first()).toBeVisible();
  }
});

test('windows inside a scaled ancestor track the pointer when dragged and resized (#515)', async ({ page, demo }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`${demo}/install.html`);
  await expect(page.locator('#install[data-code-windows-ready]')).toBeVisible();
  await page.addStyleTag({ content: 'body { transform: scale(0.8); transform-origin: 0 0; }' });
  const host = page.locator('#install .site-code-example[data-scriptoscope-window-host]').first();
  const frameRect = () => host.evaluate(el => {
    const r = el.shadowRoot.querySelector('.scriptoscope-window').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  await host.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const a = await frameRect();
    await page.waitForTimeout(250);
    const b = await frameRect();
    return a.x === b.x && a.y === b.y;
  }, { timeout: 10_000 }).toBe(true);

  const drag = async (fromX, fromY, dx, dy) => {
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + dx, fromY + dy, { steps: 4 });
    await page.mouse.up();
  };
  // Move: the painted frame follows the pointer in viewport pixels.
  const before = await frameRect();
  await drag(before.x + 120, before.y + 5, 50, 40);
  const moved = await frameRect();
  expect(Math.abs(moved.x - before.x - 50)).toBeLessThanOrEqual(1);
  expect(Math.abs(moved.y - before.y - 40)).toBeLessThanOrEqual(1);

  // Resize: the grow box follows the pointer too.
  const corner = await host.evaluate(el => {
    const r = el.shadowRoot.querySelector('.scriptoscope-growbox').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await drag(corner.x, corner.y, -80, 40);
  await expect.poll(async () => {
    const r = await frameRect();
    return [Math.round(r.width - moved.width), Math.round(r.height - moved.height)];
  }).toEqual([-80, 40]);
});

for (const transform of ['rotate(10deg)', 'skewX(15deg)']) {
  test(`windows inside a ${transform} ancestor track the pointer when dragged and resized (#519)`, async ({ page, demo }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`${demo}/install.html`);
    await expect(page.locator('#install[data-code-windows-ready]')).toBeVisible();
    await page.addStyleTag({ content: `body { transform: ${transform}; transform-origin: 0 0; }` });
    const host = page.locator('#install .site-code-example[data-scriptoscope-window-host]').first();
    // The bounding rect of a rotated window is its screen bounds, not its
    // corner, so measure points in the window's own coordinates with a probe.
    const pointAt = (left, top) => host.evaluate((el, at) => {
      const probe = document.createElement('span');
      Object.assign(probe.style, { position: 'absolute', left: `${at.left}px`, top: `${at.top}px`, width: '0', height: '0' });
      el.shadowRoot.querySelector('.scriptoscope-window').appendChild(probe);
      const r = probe.getBoundingClientRect();
      probe.remove();
      return { x: r.left, y: r.top };
    }, { left, top });
    const growBox = () => host.evaluate(el => {
      const r = el.shadowRoot.querySelector('.scriptoscope-growbox').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await host.scrollIntoViewIfNeeded();
    await expect.poll(async () => {
      const a = await pointAt(0, 0);
      await page.waitForTimeout(250);
      const b = await pointAt(0, 0);
      return a.x === b.x && a.y === b.y;
    }, { timeout: 10_000 }).toBe(true);

    const drag = async (from, dx, dy) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
      await page.mouse.up();
    };
    // Move: the grabbed title-bar point stays under the pointer.
    const grab = await pointAt(120, 5);
    await drag(grab, 50, 40);
    const moved = await pointAt(120, 5);
    expect(Math.abs(moved.x - grab.x - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.y - grab.y - 40)).toBeLessThanOrEqual(1);

    // Resize: the grow box ends up under the released pointer. The tilt can
    // push it below the fold, so bring it into view first.
    await host.evaluate(el => el.shadowRoot.querySelector('.scriptoscope-growbox').scrollIntoView({ block: 'center' }));
    const corner = await growBox();
    await drag(corner, -60, 40);
    await expect.poll(async () => {
      const c = await growBox();
      return Math.abs(c.x - corner.x + 60) <= 1.5 && Math.abs(c.y - corner.y - 40) <= 1.5;
    }).toBe(true);
  });
}
