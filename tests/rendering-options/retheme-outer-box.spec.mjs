import { test, expect, openHarness } from './fixtures.mjs';

// #526: an auto-sized window's box after a retheme equals a direct load of the
// new scheme. The grow-only auto-fit floor must not carry the previous scheme's
// frame-dependent size (thick evolution content wraps taller than windows-95).
// A user grow-box resize stays latched: retheme keeps the user's content size.
const TOL = 1;
const SOURCE = `<article data-scriptoscope-window data-scriptoscope-title="Use it on your page">
  <h3 style="margin:0 0 8px;font:24px serif">Make it yours.</h3>
  <p>Add a few attributes to your HTML, choose a scheme, and mount the runtime.</p>
  <p><a href="#">Open the installation guide</a></p>
  <p>Working starters, data attributes, runtime options, and your own Kaleidoscope themes.</p>
</article>`;

async function boot(page, mode) {
  await page.evaluate(async ({ mode }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
    const themes = new Map();
    const theme = slug => { if (!themes.has(slug)) themes.set(slug, api.loadTheme(`/themes/${slug}`)); return themes.get(slug); };
    const settle = async () => {
      await new Promise(r => setTimeout(r, 400));
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    };
    const box = el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; };
    const measure = win => ({ host: box(win.host), slot: box(win.host.querySelector(':scope > .scriptoscope-slot')) });
    let live = [];
    const promote = async (slug, source) => {
      for (const w of live.splice(0)) { w.win.unmount(); w.container.remove(); }
      const manager = new api.WindowManager();
      const container = document.createElement('div');
      container.style.cssText = 'width: 560px; margin: 24px;';
      container.innerHTML = source;
      document.body.prepend(container);
      const win = await declarative.ScriptoscopeWindow.promote(container.querySelector('[data-scriptoscope-window]'), { manager, theme: await theme(slug) });
      live.push({ win, container, manager });
      await settle();
      return live[0];
    };
    window.__rob = { theme, settle, measure, promote };
  }, { mode });
}

const expectSameBox = (a, b, label) => {
  for (const part of ['host', 'slot']) for (const k of ['width', 'height']) {
    expect.soft(Math.abs(a[part][k] - b[part][k]), `${label}: ${part}.${k} ${a[part][k]} vs ${b[part][k]}`).toBeLessThanOrEqual(TOL);
  }
};

for (const mode of ['source', 'built']) {
  for (const [from, to] of [['evolution', 'windows-95'], ['windows-95', 'evolution'], ['dolphin-som', 'apple-lisa']]) {
    test(`${mode}: in-flow auto window rethemed ${from} -> ${to} matches a direct ${to} load (#526)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      await boot(page, mode);
      const { direct, rethemed } = await page.evaluate(async ({ from, to, source }) => {
        const h = window.__rob;
        const d = await h.promote(to, source);
        const direct = h.measure(d.win);
        const r = await h.promote(from, source);
        await r.manager.retheme(await h.theme(to));
        await h.settle();
        return { direct, rethemed: h.measure(r.win) };
      }, { from, to, source: SOURCE });
      expectSameBox(rethemed, direct, `${from} -> ${to}`);
    });
  }

  test(`${mode}: a user grow-box size survives a retheme and later content growth (#526)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await boot(page, mode);
    const { before, after } = await page.evaluate(async ({ source }) => {
      const h = window.__rob;
      const { win, manager } = await h.promote('evolution', source);
      const grow = win.host.shadowRoot.querySelector('.scriptoscope-growbox');
      grow.focus();
      grow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await h.settle();
      const before = h.measure(win);
      await manager.retheme(await h.theme('windows-95'));
      await h.settle();
      // Later content growth must not re-impose auto-fit either: the user still owns the size.
      win.host.querySelector('p').insertAdjacentHTML('afterend', `<p>${'More content after the retheme. '.repeat(20)}</p>`);
      await h.settle();
      return { before, after: h.measure(win) };
    }, { source: SOURCE });
    for (const k of ['width', 'height']) {
      expect.soft(Math.abs(after.slot[k] - before.slot[k]), `user content ${k} ${before.slot[k]} -> ${after.slot[k]}`).toBeLessThanOrEqual(TOL);
    }
  });
}
