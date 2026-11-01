// #621 report-only native-wheel cost probe. HPT33 remains the pass-through gate.
// Compare the same clipped window with and without only the no-op L2 listener;
// this isolates the routing workaround from geometry and themed scrollbar costs.
import os from 'node:os';
import { test, expect, MODES, boot, settle } from './frame-pass-through-fixture.mjs';

for (const mode of MODES) test(`${mode}: HPT44 native content wheel with and without the hit-layer routing workaround`, async ({ page, servers, browserName, browser }, info) => {
  await boot(page, servers, mode);
  const listeners = await page.evaluate(async () => {
    const f = window.__fpt, original = EventTarget.prototype.addEventListener;
    window.__l2Wheels = [];
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'wheel' && this instanceof HTMLElement && this.classList.contains('scriptoscope-hit-layer'))
        window.__l2Wheels.push({ target: this, listener, options });
      return original.call(this, type, listener, options);
    };
    try {
      f.manager();
      const content = document.createElement('div');
      content.innerHTML = '<div id="native-wheel-scroller" style="height:140px;overflow:auto"><div style="height:12000px">Native content scroller</div></div>';
      await f.add('A', { slug: 'dolphin-som', title: 'Wheel cost', content });
    } finally { EventTarget.prototype.addEventListener = original; }
    window.__nativeScroller = document.getElementById('native-wheel-scroller');
    const unique = window.__l2Wheels.filter((item, i, all) => all.findIndex(other => other.target === item.target && other.listener === item.listener) === i);
    window.__l2Wheels = unique;
    return unique.map(item => ({ passive: typeof item.options === 'object' ? item.options.passive : null }));
  });
  const location = await page.evaluate(() => { const r = window.__nativeScroller.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 60 }; });
  await page.mouse.move(location.x, location.y);
  const rows = [];
  // Alternate order; no background CPU load is injected. These are idle-runner
  // observations and cannot prove compositor-thread behavior under contention.
  for (let trial = 0; trial < 5; trial++) for (const enabled of trial % 2 ? [false, true] : [true, false]) {
    await page.evaluate(enabled => {
      for (const item of window.__l2Wheels) {
        item.target.removeEventListener('wheel', item.listener, item.options);
        if (enabled) item.target.addEventListener('wheel', item.listener, item.options);
      }
      window.__nativeScroller.scrollTop = 0;
    }, enabled);
    await settle(page, 80);
    await page.evaluate(() => {
      const scroller = window.__nativeScroller;
      window.__wheelSample = { started: performance.now(), scrollMs: null, frameMs: null, top: 0 };
      scroller.addEventListener('scroll', () => {
        const sample = window.__wheelSample;
        sample.scrollMs = performance.now() - sample.started;
        sample.top = scroller.scrollTop;
        requestAnimationFrame(() => { sample.frameMs = performance.now() - sample.started; });
      }, { once: true });
    });
    await page.mouse.wheel(0, 120);
    await page.waitForFunction(() => window.__wheelSample.frameMs !== null);
    const sample = await page.evaluate(() => ({ ...window.__wheelSample }));
    expect(sample.top, 'trusted native wheel scrolls the content').toBeGreaterThan(0);
    rows.push({ trial, listenerEnabled: enabled, ...sample });
  }
  // Restore the actual policy before leaving the fixture.
  await page.evaluate(() => { for (const item of window.__l2Wheels) { item.target.removeEventListener('wheel', item.listener, item.options); item.target.addEventListener('wheel', item.listener, item.options); } });
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = enabled => ({ scrollMs: median(rows.filter(r => r.listenerEnabled === enabled).map(r => r.scrollMs)), frameMs: median(rows.filter(r => r.listenerEnabled === enabled).map(r => r.frameMs)) });
  const observation = { mode, browserName, browserVersion: browser.version(), runner: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, ci: !!process.env.CI, runnerName: process.env.RUNNER_NAME ?? null },
    listeners, installed: summary(true), removed: summary(false), trials: rows, gate: 'report-only',
    limitation: 'Idle runner; includes automation transport and frame scheduling; does not measure compositor independence or bound cost under main-thread contention.' };
  info.annotations.push({ type: 'observation', description: JSON.stringify(observation) });
  await info.attach('hpt44-wheel.json', { body: JSON.stringify(observation, null, 2), contentType: 'application/json' });
  console.log(`HPT44 ${JSON.stringify(observation)}`);
});
