// Implementation-owned allocation and invalidation checks; no fidelity oracle.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const base = process.env.SCRIPTOSCOPE_PERF_URL;
test('control canvases persist and idle port reuse still observes fresh geometry', { skip: !base }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/control-reuse-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.goto(`${base}/control-reuse-test`);
    const checks = await page.evaluate(async source => {
      const api = await import(source);
      const { ManagedContentPort } = await import(source.replace('index.ts', 'managedContentPort.ts'));
      const theme = await api.loadOwnedTheme('/themes/1138');
      const frames = async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); };
      const slider = await api.interactiveSlider(theme, { length: 240 });
      document.body.append(slider);
      const canvas = slider.querySelector('canvas');
      for (const value of [0.8, 0.2, 1]) { slider._scriptoscopeSetValue(value); await frames(); }
      const sliderRetained = canvas === slider.querySelector('canvas');
      const tabs = document.createElement('div');
      tabs.innerHTML = '<button data-scriptoscope-tab="a">A</button><section data-scriptoscope-panel="a">A</section><button data-scriptoscope-tab="b">B</button><section data-scriptoscope-panel="b">B</section>';
      document.body.append(tabs); await api.promoteTabs(tabs, theme);
      const faces = [...tabs.querySelectorAll('[data-scriptoscope-tab-skinned]')];
      const canvases = faces.map(face => face.querySelector('canvas'));
      for (const index of [1, 0, 1]) { faces[index].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await frames(); }
      const tabsRetained = faces.length === 2 && faces.every((face, i) => face.querySelector('canvas') === canvases[i]);
      await api.restoreTabs(tabs); theme.dispose(); document.body.replaceChildren();

      const host = document.createElement('div'), viewport = document.createElement('div'), control = document.createElement('canvas');
      host.setAttribute('data-scriptoscope-window-host', '');
      viewport.style.cssText = 'position:relative;width:200px;height:100px;overflow:auto';
      control.width = 20; control.height = 10;
      control.style.cssText = 'position:absolute;left:20px;top:20px;width:20px;height:10px';
      viewport.append(control); host.append(viewport); document.body.append(host);
      const port = new ManagedContentPort(); port.commit(host, viewport, 1);
      const rect = () => ({ x: 0, y: 0, w: 20, h: 10 }), changes = [];
      const binding = port.port.observe(control, rect, result => changes.push(result));
      await frames(); const count = changes.length; await frames();
      const idle = changes.length === count && changes.at(-1).status === 'ready' &&
        Object.isFrozen(changes.at(-1).context.controlOrigin) && Object.isFrozen(changes.at(-1).context.clip.rect);
      const transitions = [];
      const check = () => {
        binding.refresh();
        transitions.push(JSON.stringify(changes.at(-1)) === JSON.stringify(port.port.measure(control, rect())));
      };
      control.style.left = '30px'; check();
      const moved = changes.at(-1).context.controlOrigin[0] === 30;
      viewport.style.width = '240px'; check();
      host.style.transform = 'rotate(10deg)'; check();
      const transformed = changes.at(-1).reason === 'transform';
      host.style.transform = ''; check();
      host.style.display = 'none'; check();
      const hidden = changes.at(-1).reason === 'hidden';
      host.style.display = ''; check();
      control.remove(); check(); viewport.append(control); check();
      port.commit(host, viewport, 2); check();
      control.style.width = '40px'; control.style.height = '20px'; check();
      port.clear(); check(); port.commit(host, viewport, 2); check();
      port.dispose();
      const removed = changes.at(-1).reason === 'port-removed';
      const finalCount = changes.length; binding.refresh(); await frames();
      binding.dispose(); host.remove();
      return { sliderRetained, tabsRetained, idle, moved, transformed, hidden, removed,
        transitions: transitions.every(Boolean), disposed: changes.length === finalCount };
    }, `/@fs${fileURLToPath(new URL('./index.ts', import.meta.url))}`);
    for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);
  } finally { await browser.close(); }
});
