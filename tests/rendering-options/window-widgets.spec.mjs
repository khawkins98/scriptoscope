import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// These are authored visual arrangements, independent of runtime role labels:
// 1138 has close at left; Evolution groups all three at right; 1990 stacks
// close/zoom/shade vertically. Corner sprites use the public document layout.
const subjects = ['1138', 'evolution', '1990', 'system7-nostalgia-silver'];
for (const mode of ['source', 'built']) {
  test(`${mode}: authored titlebar slots close, zoom and shade the actual window`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    const observations = [];
    for (const slug of subjects) {
      await page.evaluate(async ({ mode, slug }) => {
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const theme = await api.loadTheme(`/themes/${slug}`);
        const manager = new api.WindowManager();
        const fixture = { theme, manager, closes: 0, commits: 0 };
        fixture.host = await manager.add(theme, { width: 240, height: 120, title: 'Widget actions' },
          { onClose: () => fixture.closes++ });
        document.body.append(fixture.host);
        Object.assign(fixture.host.style, { position: 'absolute', left: '30px', top: '40px' });
        manager.setChangeListener(() => fixture.commits++);
        window.widgets = fixture;
      }, { mode, slug });
      const slots = async () => page.evaluate(slug => {
        const buttons = [...window.widgets.host.shadowRoot.querySelectorAll('.scriptoscope-titlewidget')];
        return buttons.map(b => { const r = b.getBoundingClientRect(); return {
          x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute('aria-label'),
          left: r.x, top: r.y, width: r.width, height: r.height,
        }; }).sort((a, b) => slug === '1990' ? a.y - b.y : a.x - b.x);
      }, slug);
      const before = await slots();
      expect(before).toHaveLength(3);
      await page.evaluate(() => {
        const canvas = window.widgets.host.shadowRoot.querySelector('.scriptoscope-chrome');
        window.widgets.beforePress = Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
      });
      // Click by visual slot, never by the action label under test.
      await page.mouse.move(before[2].x, before[2].y);
      await page.mouse.down();
      const pressed = () => page.evaluate(() => {
        const f = window.widgets, canvas = f.host.shadowRoot.querySelector('.scriptoscope-chrome');
        const now = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, r = canvas.getBoundingClientRect();
        let count = 0, left = Infinity, top = Infinity, right = -1, bottom = -1;
        for (let i = 0; i < now.length; i += 4) if (now.slice(i, i + 4).some((v, j) => v !== f.beforePress[i + j])) {
          const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
          count++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        return { count, left: r.x + left, top: r.y + top, right: r.x + right, bottom: r.y + bottom };
      });
      await expect.poll(async () => (await pressed()).count).toBeGreaterThan(0);
      const press = await pressed();
      expect(press.left).toBeGreaterThanOrEqual(before[2].left);
      expect(press.top).toBeGreaterThanOrEqual(before[2].top);
      expect(press.right).toBeLessThan(before[2].left + before[2].width);
      expect(press.bottom).toBeLessThan(before[2].top + before[2].height);
      await page.mouse.up();
      await expect.poll(() => page.evaluate(() => window.widgets.commits)).toBe(1);
      const shaded = await page.evaluate(() => {
        const f = window.widgets, d = f.manager.describe(f.host);
        return { collapsed: d.collapsed, width: d.width, height: d.height };
      });
      observations.push({ slug, slots: before, press, shaded });
      await attachObservations(testInfo, 'window-widgets', `${mode}-actions`, { mode, observations });
      expect(shaded, `${slug}: last authored widget is shade, not zoom`).toEqual({ collapsed: true, width: 240, height: 120 });
      expect(await page.getByRole('button', { name: 'Resize window', exact: true }).count()).toBe(0);
      await expect.poll(async () => (await slots())[2]?.label).toBe('Collapse window');
      const collapsed = await slots();
      expect(await page.evaluate(({ x, y }) => window.widgets.host.shadowRoot.elementFromPoint(x, y)?.getAttribute('aria-label'), collapsed[2])).toBe('Collapse window');
      await page.mouse.click(collapsed[2].x, collapsed[2].y);
      await expect.poll(() => page.evaluate(() => window.widgets.commits)).toBe(2);
      await expect.poll(() => page.evaluate(() => window.widgets.manager.describe(window.widgets.host).collapsed)).toBe(false);
      expect(await page.getByRole('button', { name: 'Resize window', exact: true }).count()).toBe(1);
      const expanded = await slots();
      await page.mouse.click(expanded[1].x, expanded[1].y);
      await expect.poll(() => page.evaluate(() => window.widgets.commits)).toBe(3);
      await expect.poll(() => page.evaluate(() => window.widgets.manager.describe(window.widgets.host).width)).toBe(360);
      expect(await page.evaluate(() => window.widgets.manager.describe(window.widgets.host).collapsed)).toBe(false);
      const zoomed = await slots();
      await page.mouse.click(zoomed[1].x, zoomed[1].y);
      await expect.poll(() => page.evaluate(() => window.widgets.commits)).toBe(4);
      await expect.poll(() => page.evaluate(() => window.widgets.manager.describe(window.widgets.host).width)).toBe(240);
      // Keyboard activates the same visual slot, with the correct accessible name.
      const labels = await page.evaluate(() => [...window.widgets.host.shadowRoot.querySelectorAll('.scriptoscope-titlewidget')].map(b => b.getAttribute('aria-label')));
      expect(labels.sort()).toEqual(['Close window', 'Collapse window', 'Zoom window']);
      await page.getByRole('button', { name: 'Close window', exact: true }).focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.widgets.closes)).toBe(1);
      expect(await page.evaluate(() => [window.widgets.host.style.left, window.widgets.host.style.top])).toEqual(['30px', '40px']);
      await page.getByRole('button', { name: 'Resize window', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => page.evaluate(() => window.widgets.manager.describe(window.widgets.host).width)).toBe(248);
      await page.evaluate(() => { const f = window.widgets; f.manager.remove(f.host); f.host.remove(); f.theme.dispose?.(); });
    }
    await attachObservations(testInfo, 'window-widgets', `${mode}-actions`, { mode, observations });
  });
}
