// #631 retained scrollbar placement and native target geometry are one commit.
// Observe public change notification synchronously, before asynchronous paint can
// replace the old canvas. S comes from the established archive rule fixture.
import { test, expect, MODES, boot, settle } from './frame-pass-through-fixture.mjs';

for (const mode of MODES) test(`${mode}: retained scrollbar native owners follow new placement before replacement paint`, async ({ page, servers }, info) => {
  await boot(page, servers, mode);
  await page.evaluate(async () => {
    const f = window.__fpt;
    f.manager();
    const content = document.createElement('div');
    content.style.cssText = 'height:100%;width:100%;overflow:auto;box-sizing:border-box';
    content.innerHTML = '<div style="width:900px;height:3000px">Both scroll axes</div>';
    await f.add('A', { slug: 'windows-95', w: 240, h: 160, left: 100, top: 80, content });
  });
  await expect.poll(() => page.evaluate(() => ['vertical', 'horizontal'].every(axis => window.__fpt.hosts.A.host.shadowRoot.querySelector(`[role=scrollbar][aria-orientation=${axis}] canvas`)))).toBe(true);
  await page.evaluate(async () => {
    const f = window.__fpt;
    // A separate, identical-size active reference supplies new-theme S before
    // the observation. No candidate native target geometry is read as an oracle.
    await f.add('R', { slug: 'dolphin-som', m: f.manager(), w: 240, h: 160, left: 800, top: 600 });
    const expected = await f.oracle('R'); f.drop('R');
    const root = f.hosts.A.host.shadowRoot;
    const before = Object.fromEntries(['vertical', 'horizontal'].map(axis => {
      const bar = root.querySelector(`[role=scrollbar][aria-orientation=${axis}]`);
      return [axis, { bar, canvas: bar.querySelector('canvas'), rect: bar.getBoundingClientRect().toJSON() }];
    }));
    window.__placement = { before, observations: [] };
    f.hosts.A.m.setChangeListener(() => {
      // No await: this samples the notification's current native surfaces while
      // old painted canvases are retained, before a paint continuation can run.
      try {
        const g = f.geom('A'), axes = [];
        for (const axis of ['vertical', 'horizontal']) {
          const bar = root.querySelector(`[role=scrollbar][aria-orientation=${axis}]`), r = bar.getBoundingClientRect();
          const prior = before[axis], missing = [];
          let sampled = 0;
          const v = axis === 'vertical';
          // Cover the full interior, omitting long-axis ends where grow or
          // other original controls may legitimately take priority.
          const xs = [Math.ceil(r.left) + (v ? 1 : 20), Math.floor(r.right) - (v ? 1 : 20)];
          const ys = [Math.ceil(r.top) + (v ? 20 : 1), Math.floor(r.bottom) - (v ? 20 : 1)];
          for (let y = ys[0]; y < ys[1]; y++) for (let x = xs[0]; x < xs[1]; x++) {
            const px = x + 0.5, py = y + 0.5;
            const cx = Math.floor((px - g.left) / g.k), cy = Math.floor((py - g.top) / g.k);
            if (!f.rules.uniform(expected.region, expected.W, expected.H, cx, cy, f.rules.IN, 1)) continue;
            sampled++;
            const native = root.elementFromPoint(px, py), owner = native?.closest('[role=scrollbar]');
            if (owner !== prior.bar) missing.push({ x: px, y: py, native: native?.className ?? null, owner: owner?.getAttribute('aria-label') ?? null });
          }
          axes.push({ axis, sampled, missing, originalRetained: bar === prior.bar,
            oldCanvasRetained: bar.querySelector('canvas') === prior.canvas,
            before: prior.rect, current: r.toJSON() });
        }
        window.__placement.observations.push({ dimensionsMatchOracle: g.W === expected.W && g.H === expected.H, axes });
      } catch (error) { window.__placement.observations.push({ error: String(error) }); }
    });
    f.hosts.A.slug = 'dolphin-som';
    await f.hosts.A.m.retheme(await f.theme('dolphin-som'));
  });
  const observations = await page.evaluate(() => window.__placement.observations);
  await info.attach('synchronous-scrollbar-placement.json', { body: JSON.stringify({ mode, observations,
    limitation: 'Native hit ownership before replacement paint; no visual presentation timing.' }, null, 2), contentType: 'application/json' });
  expect(observations).toHaveLength(1);
  expect(observations[0].error).toBeUndefined();
  expect(observations[0].dimensionsMatchOracle).toBe(true);
  for (const row of observations[0].axes) {
    expect(row.originalRetained, row.axis).toBe(true);
    expect(row.oldCanvasRetained, `${row.axis}: old paint is still present at the notification`).toBe(true);
    expect(row.sampled, `${row.axis}: robust S points inside current original control`).toBeGreaterThan(0);
    expect(row.missing, `${row.axis}: every sampled point belongs to the original bar now`).toEqual([]);
  }
  expect(observations[0].axes.some(r => Math.abs(r.before.x - r.current.x) > 0.5 || Math.abs(r.before.y - r.current.y) > 0.5), 'fixture changes retained control placement').toBe(true);
  await settle(page);
});
