import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers();
  try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

// #537 (WCAG 2.4.3): title-widget overlay buttons sit in the shadow DOM, and so
// in tab order, in visual reading order, not a fixed close/zoom/collapse
// sequence. Reading order is computed here from each button's bounding rect:
// rows top to bottom (by centre), left to right within a row, where a button
// joins the row whose lead's vertical span it overlaps. 1984's document close
// (y 16-27 against 10-21) stays on the title row at the far left, and
// monkey-paradise's taller collapse sprite (top 0 against 5) stays on its row.
const SLUGS = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503',
  'black-platinum', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise',
  'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];

/** Page-side helpers, installed once per page. */
const install = (page, servers, mode) => page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`).then(() => page.evaluate(async mode => {
  const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
  const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const name = el => el?.getAttribute('aria-label')?.split(' ')[0] ?? null;
  const widgets = host => [...host.shadowRoot.querySelectorAll('.scriptoscope-titlewidget')];
  const reading = host => {
    const boxes = widgets(host).map(el => { const r = el.getBoundingClientRect(); return { el, x: r.left, top: r.top, cy: r.top + r.height / 2, h: r.height }; });
    const rows = [];
    for (const b of boxes.sort((a, c) => a.cy - c.cy)) {
      const row = rows.at(-1);
      if (row && b.top < row[0].top + row[0].h && row[0].top < b.top + b.h) row.push(b); else rows.push([b]);
    }
    return rows.flatMap(row => row.sort((a, c) => a.x - c.x)).map(b => name(b.el));
  };
  const dom = host => widgets(host).map(name);
  window.order = { api, settle, name, widgets, reading, dom };
}, mode));

for (const mode of ['source', 'built']) {
  test(`${mode}: title-widget DOM order follows visual reading order on every theme and window type`, async ({ page, servers }) => {
    test.setTimeout(240_000);
    await install(page, servers, mode);
    const rows = await page.evaluate(async SLUGS => {
      const { api, settle, reading, dom } = window.order, out = [];
      for (const slug of SLUGS) {
        const theme = await api.loadTheme(`/themes/${slug}`);
        const manager = new api.WindowManager();
        const types = new Set([...Object.keys(theme.manifest.windowTypes ?? {}), 'document-window', 'floating-utility-window']);
        for (const windowType of types) {
          const host = await manager.add(theme, { width: 240, height: 120, title: 'Order', windowType }, { onClose() {} });
          document.body.append(host);
          Object.assign(host.style, { position: 'absolute', left: '20px', top: '20px' });
          await settle();
          out.push({ slug, windowType, dom: dom(host), reading: reading(host) });
          manager.remove(host); host.remove();
        }
        theme.dispose?.();
      }
      return out;
    }, SLUGS);
    // Precondition: the sweep really covers multi-widget windows on every theme.
    for (const slug of SLUGS) expect(rows.some(r => r.slug === slug && r.dom.length >= 2), `${slug} has a multi-widget window`).toBe(true);
    const by = (slug, windowType) => rows.find(r => r.slug === slug && r.windowType === windowType)?.reading;
    // The issue's cases, pinned so a changed row rule cannot silently pass them.
    expect(by('windows-95', 'document-window')).toEqual(['Collapse', 'Zoom', 'Close']);
    expect(by('windows-95', 'floating-utility-window')).toEqual(['Collapse', 'Zoom', 'Close']);
    expect(by('1984', 'document-window')).toEqual(['Close', 'Zoom', 'Collapse']);
    expect(by('1984', 'collapsed-document-window')).toEqual(['Close', 'Zoom', 'Collapse']);
    expect(by('monkey-paradise', 'floating-utility-window')).toEqual(['Close', 'Zoom', 'Collapse']);
    const mismatched = rows.filter(r => r.dom.join() !== r.reading.join()).map(r => `${r.slug} ${r.windowType}: dom ${r.dom} reading ${r.reading}`);
    expect(mismatched).toEqual([]);
  });

  test(`${mode}: a reordering retheme keeps every widget node, focus and Tab order`, async ({ page, servers }) => {
    await install(page, servers, mode);
    await page.evaluate(async () => {
      const { api, settle } = window.order;
      document.body.innerHTML = '';
      const themes = { w95: await api.loadTheme('/themes/windows-95'), ap2: await api.loadTheme('/themes/apple-platinum-2') };
      const manager = new api.WindowManager();
      const host = await manager.add(themes.w95, { width: 240, height: 120, title: 'Order' }, { onClose() {} });
      document.body.append(host);
      Object.assign(host.style, { position: 'absolute', left: '20px', top: '20px' });
      const churn = [];
      for (const type of ['focusin', 'focusout']) host.shadowRoot.addEventListener(type, e => churn.push(`${type}:${e.target.getAttribute('aria-label')}`));
      Object.assign(window.order, { themes, manager, host, churn });
      await settle();
    });
    const snapshot = () => page.evaluate(async () => {
      const { settle, widgets, name, reading, dom, host } = window.order;
      await settle();
      return { dom: dom(host), reading: reading(host), marked: widgets(host).every(el => el.__orderMark === name(el)),
        focused: host.shadowRoot.activeElement && name(host.shadowRoot.activeElement),
        focusedMarked: !!host.shadowRoot.activeElement && host.shadowRoot.activeElement.__orderMark === name(host.shadowRoot.activeElement) };
    });
    // Tab from the first title widget walks the widgets in reading order, then the move handle.
    const tabWalk = async () => {
      const first = await page.evaluate(() => { const { widgets, host } = window.order; widgets(host)[0].focus(); return widgets(host).length; });
      const seen = [await page.evaluate(() => window.order.name(window.order.host.shadowRoot.activeElement))];
      for (let i = 0; i < first; i++) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => window.order.name(window.order.host.shadowRoot.activeElement)));
      }
      return seen;
    };
    const w95 = ['Collapse', 'Zoom', 'Close'], ap2 = ['Close', 'Zoom', 'Collapse'];
    expect(await snapshot()).toMatchObject({ dom: w95, reading: w95 });
    expect(await tabWalk()).toEqual([...w95, 'Move']);
    await page.evaluate(() => { const { widgets, name, host } = window.order; for (const el of widgets(host)) el.__orderMark = name(el); });
    // Focus the widget the reorder moves furthest (last → first and back).
    for (const [to, want] of [['ap2', ap2], ['w95', w95]]) {
      await page.evaluate(() => { const { widgets, name, host, churn } = window.order; widgets(host).find(el => name(el) === 'Close').focus(); churn.length = 0; });
      await page.evaluate(to => window.order.manager.retheme(window.order.themes[to]), to);
      await expect.poll(async () => (await snapshot()).dom, `dom after retheme to ${to}`).toEqual(want);
      expect(await snapshot(), `after retheme to ${to}`).toEqual({ dom: want, reading: want, marked: true, focused: 'Close', focusedMarked: true });
      expect(await page.evaluate(() => window.order.churn), `no focus churn on retheme to ${to}`).toEqual([]);
      expect(await tabWalk(), `Tab order after retheme to ${to}`).toEqual([...want, 'Move']);
    }
  });
}
