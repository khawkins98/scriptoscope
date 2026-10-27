import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers();
  try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

// A fixed layout/paint checkpoint, never a poll for missing scrollbars. The host
// is appended in the same continuation as the completed public state update.
const layoutFrames = 6;
for (const mode of ['source', 'built']) for (const action of ['z-only', 'aborted', 'replaced', 'removed']) {
  test(`${mode}: detached committed window retry survives ${action}`, async ({ page, servers, browser }, info) => {
    await info.attach('runtime.json', { body: JSON.stringify({ mode, action, layoutFrames, browser: browser.version() }), contentType: 'application/json' });
    await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
    try {
      const result = await page.evaluate(async ({ mode, action, layoutFrames }) => {
        const css = document.createElement('link'); css.rel = 'stylesheet';
        css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
        await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const theme = await api.loadTheme('/themes/windows-95');
        await document.fonts.ready;
        const f = window.committedRetry = { theme, manager: new api.WindowManager(), hosts: [] };
        const make = async () => {
          const content = document.createElement('div');
          content.style.cssText = 'position:relative;width:100%;height:100%;overflow:auto';
          const spacer = document.createElement('div'); spacer.style.cssText = 'width:800px;height:800px'; content.append(spacer);
          const host = await f.manager.add(theme, { title: 'Committed retry', width: 240, height: 130 }, {}, { contentEl: content });
          f.hosts.push(host); return { host, content };
        };
        const frames = async () => { for (let i = 0; i < layoutFrames; i++) await new Promise(resolve => requestAnimationFrame(resolve)); };
        const observe = ({ host, content }) => ({
          state: (() => { const s = f.manager.describe(host); return s && { width: s.width, height: s.height, z: s.z, collapsed: s.collapsed }; })(),
          contentSame: host.contains(content),
          bars: [...host.shadowRoot.querySelectorAll('[role=scrollbar]')].map(bar => {
            const rect = bar.getBoundingClientRect();
            const style = getComputedStyle(bar);
            return { axis: bar.getAttribute('aria-orientation'), max: Number(bar.getAttribute('aria-valuemax')),
              visible: rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.display !== 'none',
              painted: [...bar.querySelectorAll('canvas')].some(canvas => {
                const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                return pixels.some((value, index) => index % 4 === 3 && value > 0);
              }) };
          }).sort((a, b) => a.axis.localeCompare(b.axis)),
        });
        const subject = await make();
        const detached = !subject.host.isConnected;
        const initial = f.manager.describe(subject.host);
        let firstLayoutFrame = false;
        requestAnimationFrame(() => { firstLayoutFrame = true; });
        if (action === 'z-only') await f.manager.applyState(subject.host, { z: initial.z + 7 });
        if (action === 'aborted') {
          const life = new AbortController(); life.abort();
          await f.manager.applyState(subject.host, { width: 900, height: 900 }, life.signal);
        }
        if (action === 'replaced') await f.manager.applyState(subject.host, { width: 900, height: 900 });
        if (action === 'removed') f.manager.remove(subject.host);
        document.body.append(subject.host);
        const appendedBeforeFrame = !firstLayoutFrame;
        await frames();
        const actual = observe(subject);
        // An unmodified committed window grounds the expected overflow and paint.
        const control = await make(); document.body.append(control.host); await frames();
        return { detached, appendedBeforeFrame, initial: { width: initial.width, height: initial.height, z: initial.z, collapsed: initial.collapsed },
          actual, control: observe(control) };
      }, { mode, action, layoutFrames });
      expect(result.detached).toBe(true);
      expect(result.appendedBeforeFrame).toBe(true);
      expect(result.control.bars.map(bar => bar.axis)).toEqual(['horizontal', 'vertical']);
      for (const bar of result.control.bars) {
        expect(bar.max).toBeGreaterThan(0); expect(bar.visible).toBe(true); expect(bar.painted).toBe(true);
      }
      if (action === 'z-only' || action === 'aborted') {
        expect(result.actual.state).toEqual({ ...result.initial, z: result.initial.z + (action === 'z-only' ? 7 : 0) });
        expect(result.actual.contentSame).toBe(true);
        expect(result.actual.bars).toEqual(result.control.bars);
      } else {
        expect(result.actual.state).toEqual(action === 'removed' ? null : { ...result.initial, width: 900, height: 900 });
        expect(result.actual.bars).toEqual([]);
      }
    } finally {
      await page.evaluate(() => { const f = window.committedRetry; if (!f) return;
        for (const host of f.hosts) { f.manager.remove(host); host.remove(); } f.theme.dispose();
      }).catch(() => {});
    }
  });
}
