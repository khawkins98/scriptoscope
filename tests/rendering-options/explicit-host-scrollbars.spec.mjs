import { test } from './demo-fixtures.mjs';
import { expect } from '@playwright/test';

test('font-delayed showcase refreshes retain one live keyboard and ARIA scrollbar per axis', async ({ page, demo }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.addInitScript(() => {
    const load = document.fonts.load.bind(document.fonts); let call = 0;
    document.fonts.load = async (...args) => { await new Promise(resolve => setTimeout(resolve, [1, 16, 37, 5][call++ % 4])); return load(...args); };
  });
  await page.goto(`${demo}/showcase.html?theme=crayon-os`);
  const hosts = page.locator('[data-scriptoscope-window-host]');
  await expect(hosts).toHaveCount(8);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => setTimeout(resolve, 700)); });
  for (const phase of ['initial', 'retheme']) {
    if (phase === 'retheme') {
      await page.getByRole('tab', { name: 'Switch to Windows 95', exact: true }).click();
      await expect.poll(() => hosts.evaluateAll(nodes => nodes.map(node => node.dataset.scriptoscopeTheme))).toEqual(Array(8).fill('windows-95'));
      await page.getByRole('tab', { name: 'Switch to Crayon OS', exact: true }).click();
      await expect.poll(() => hosts.evaluateAll(nodes => nodes.map(node => node.dataset.scriptoscopeTheme))).toEqual(Array(8).fill('crayon-os'));
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => setTimeout(resolve, 700)); });
    }
    const axes = await hosts.evaluateAll(nodes => nodes.flatMap((host, index) => {
      const bars = [...host.shadowRoot.querySelectorAll('[role=scrollbar]')];
      return ['vertical', 'horizontal'].map(axis => ({ index, axis, count: bars.filter(bar => bar.getAttribute('aria-orientation') === axis).length }));
    }));
    expect(axes.some(row => row.count === 1)).toBe(true);
    for (const row of axes) {
      expect(row.count, `${phase}: window ${row.index}, ${row.axis}`).toBeLessThanOrEqual(1);
      if (!row.count) continue;
      const target = hosts.nth(row.index).locator(`[role=scrollbar][aria-orientation=${row.axis}]`);
      await expect(target).toHaveAttribute('tabindex', '0');
      await target.focus(); await expect(target).toBeFocused();
      const before = Number(await target.getAttribute('aria-valuenow'));
      expect(Number(await target.getAttribute('aria-valuemax'))).toBeGreaterThan(0);
      // Select a direction with room to move; a scrollbar may already be at its
      // endpoint after the browser scrolls a newly focused control into view.
      const decreasing = before > 0;
      await page.keyboard.press(row.axis === 'vertical' ? (decreasing ? 'ArrowUp' : 'ArrowDown') : (decreasing ? 'ArrowLeft' : 'ArrowRight'));
      const value = expect.poll(async () => Number(await target.getAttribute('aria-valuenow')), { message: `${phase}: live keyboard response for window ${row.index}, ${row.axis}` });
      if (decreasing) await value.toBeLessThan(before); else await value.toBeGreaterThan(before);
    }
  }
});
