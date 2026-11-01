// #597 HPT36 (docs/spec/engine/hit-regions.md §9.3 HP20): hit-test and frame cost of
// the region clip at the corpus's largest path (dolphin-som document-window,
// content 1280 × 800), against a same-run `hit: 'box'` baseline (no clip).
// WebKit is gated (median elementFromPoint ≤ 3.0 ms; frame p95 ≤ baseline + 3 ms).
// Chromium and Firefox report only. Every engine records the runner identity and
// both medians, so a slow runner can be told apart from a regression.
import os from 'node:os';
import { test, expect, MODES, boot, state, settle } from './frame-pass-through-fixture.mjs';

const runner = () => ({ platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model ?? 'unknown', cpus: os.cpus().length,
  memoryGB: Math.round(os.totalmem() / 2 ** 30), ci: !!process.env.CI, runnerName: process.env.RUNNER_NAME ?? null, runnerOs: process.env.RUNNER_OS ?? null });

/** Median per-call elementFromPoint cost over 200 frame-band points, timed in 9 batches. */
const hitCost = page => page.evaluate(async () => {
  const f = window.__fpt, o = await f.oracle('A'), band = [];
  for (let y = 0; y < o.C.top; y += 2) for (let x = 0; x < o.W; x += 3) band.push(f.vp('A', [x, y]));
  const pts = Array.from({ length: 200 }, (_, i) => band[Math.floor(i * band.length / 200)]);
  for (const p of pts) document.elementFromPoint(p.x, p.y); // warm
  const per = [];
  for (let b = 0; b < 9; b++) {
    const t = performance.now();
    for (const p of pts) document.elementFromPoint(p.x, p.y);
    per.push((performance.now() - t) / pts.length);
  }
  per.sort((a, b) => a - b);
  return per[4];
});

/** Frame-interval p95 (ms) of rAF deltas while `run` drives the pointer. */
async function frameP95(page, run) {
  await page.evaluate(() => { window.__frames = []; window.__rafOn = true; const tick = t => { window.__frames.push(t); if (window.__rafOn) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await run();
  const frames = await page.evaluate(() => { window.__rafOn = false; return window.__frames; });
  const d = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
  return { p95: d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] ?? null, frames: d.length };
}

for (const mode of MODES) {
  test(`${mode}: HPT36 region clip cost at 1280 × 800 vs a same-run box baseline (gated in WebKit)`, async ({ page, servers, browserName, browser }, info) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 1200 });
    await boot(page, servers, mode);
    const results = {};
    for (const hit of ['box', 'region']) {
      await page.evaluate(async hit => { const f = window.__fpt; f.reset(); f.manager(); await f.add('A', { slug: 'dolphin-som', w: 1280, h: 800, left: 10, top: 10, hit }); }, hit);
      expect((await state(page, 'A')).hitEffective, `${hit} measurement runs in ${hit} mode`).toBe(hit);
      if (hit === 'region') expect(await page.evaluate(() => getComputedStyle(window.__fpt.layers('A').L2).clipPath.startsWith('path(')), 'the clip is applied (no size fallback, HP20)').toBe(true);
      const median = await hitCost(page);
      const title = await page.evaluate(async () => { const f = window.__fpt, o = await f.oracle('A'), p = f.points(o); return { out: f.vp('A', p.p_out), in: f.vp('A', p.p_in) }; });
      const hover = await frameP95(page, async () => { await page.mouse.move(20, title.out.y); await page.mouse.move(1290, title.out.y, { steps: 200 }); });
      const drag = await frameP95(page, async () => {
        await page.mouse.move(title.in.x, title.in.y); await page.mouse.down();
        await page.mouse.move(title.in.x + 200, title.in.y + 100, { steps: 200 }); await page.mouse.up();
      });
      await settle(page);
      results[hit] = { median, hoverP95: hover.p95, dragP95: drag.p95, frames: [hover.frames, drag.frames] };
    }
    const observation = { browserName, browserVersion: browser.version(), mode, runner: runner(), baseline: results.box, region: results.region,
      gate: browserName === 'webkit' ? 'gated' : 'report-only', ceilings: { medianMs: 3.0, p95OverBaselineMs: 3 } };
    info.annotations.push({ type: 'observation', description: JSON.stringify(observation) });
    await info.attach('hpt36.json', { body: JSON.stringify(observation, null, 2), contentType: 'application/json' });
    console.log(`HPT36 ${JSON.stringify(observation)}`);
    if (browserName !== 'webkit') return;
    expect(results.region.median, 'WebKit median elementFromPoint (ms)').toBeLessThanOrEqual(3.0);
    expect(results.region.hoverP95, 'WebKit hover p95 vs baseline').toBeLessThanOrEqual(results.box.hoverP95 + 3);
    expect(results.region.dragP95, 'WebKit drag p95 vs baseline').toBeLessThanOrEqual(results.box.dragP95 + 3);
  });
}
