// #614 initial activation (docs/spec/engine/inactive-window-input.md §7.2, hooks IPT8 and IPT9).
//
// IP6: at most one active window per manager. IP7: an explicit `active` request
// (`data-scriptoscope-state="active"`) makes that window active when it is added, and the last
// one added wins. IP8: with no request, only the first window of a manager starts active; an
// explicit `inactive` never starts active. IP9: "not declared" stays distinct from `active`.
// IP10: a window with its own manager is unaffected by another manager's requests.
//
// Declarative windows are promoted with ScriptoscopeWindow.promote in document order, the way
// an application host does. Observables: `describe(host).active` and the rendered state
// (`data-scriptoscope-current-state`). The last test runs the published example host
// (`mountExplicitPage`), where a window with its own `data-scriptoscope-theme` gets its own
// manager (docs/interaction.md "Two ways in").
import { test, expect, MODES, boot, settle } from './frame-pass-through-fixture.mjs';
import { test as demoTest } from './demo-fixtures.mjs';

const html = (name, state) => `<div data-scriptoscope-window data-scriptoscope-title="${name}" data-scriptoscope-width="200" data-scriptoscope-height="80"${state ? ` data-scriptoscope-state="${state}"` : ''}>${name}</div>`;

/** Promote `windows` ([name, state | undefined, manager index]) in order; return each window's activation. */
async function promoteAll(page, windows, managers = 1) {
  return page.evaluate(async ({ windows, managers }) => {
    const f = window.__fpt;
    f.reset();
    document.querySelectorAll('.iw-page').forEach(n => n.remove());
    const ms = Array.from({ length: managers }, () => f.manager());
    const wrap = document.createElement('div');
    wrap.className = 'iw-page';
    wrap.style.cssText = 'position:relative;z-index:1;margin:40px;display:flex;gap:16px;flex-wrap:wrap;width:1100px';
    document.body.append(wrap);
    for (const [name, state, mi = 0] of windows) {
      const html = `<div data-scriptoscope-window data-scriptoscope-title="${name}" data-scriptoscope-width="200" data-scriptoscope-height="80"${state ? ` data-scriptoscope-state="${state}"` : ''}>${name}</div>`;
      await f.promote(name, { m: ms[mi], slug: 'windows-95', parent: wrap, html });
    }
    await f.settle(200);
    return Object.fromEntries(windows.map(([name]) => {
      const { host, m } = f.hosts[name];
      return [name, { active: m.describe(host).active, current: host.shadowRoot.querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState }];
    }));
  }, { windows, managers });
}
const actives = states => Object.entries(states).filter(([, s]) => s.active).map(([n]) => n);
function expectOnly(states, name, why) {
  expect(actives(states), `${why}: exactly one window reports active`).toEqual([name]);
  for (const [n, s] of Object.entries(states)) expect(s.current, `${why}: ${n} renders ${n === name ? 'active' : 'inactive'}`).toBe(n === name ? 'active' : 'inactive');
}

for (const mode of MODES) {
  test(`${mode}: IPT8 the last explicit active request wins; no request starts only the first window active`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    expectOnly(await promoteAll(page, [['W1'], ['W2'], ['W3']]), 'W1', '(a) no state declared');
    expectOnly(await promoteAll(page, [['W1'], ['W2', 'active'], ['W3']]), 'W2', '(b) only the second declares active');
    expectOnly(await promoteAll(page, [['W1', 'active'], ['W2'], ['W3', 'active']]), 'W3', '(c) the first and third declare active');
    expectOnly(await promoteAll(page, [['W1', 'inactive'], ['W2', 'active'], ['W3']]), 'W2', '(d) first inactive, second active');
  });

  test(`${mode}: IPT9 a window with its own manager stays active beside an IPT8 (c) page`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    for (const order of ['own first', 'own last']) {
      const page8c = [['W1', 'active', 0], ['W2', undefined, 0], ['W3', 'active', 0]];
      const own = ['OWN', undefined, 1];
      const s = await promoteAll(page, order === 'own first' ? [own, ...page8c] : [...page8c, own], 2);
      expect(s.OWN, `${order}: the own-manager window is active in its own manager`).toEqual({ active: true, current: 'active' });
      const { OWN, ...shared } = s; void OWN;
      expectOnly(shared, 'W3', `${order}: the shared manager follows IP7`);
    }
  });
}

// End to end through the published example host: one shared manager for the page, a
// separate one for a window with its own data-scriptoscope-theme.
demoTest('source: IPT8 (c) + IPT9 through mountExplicitPage', async ({ page, demo }) => {
  await page.goto(`${demo}/install.html`);
  const states = await page.evaluate(async html => {
    const { mountExplicitPage } = await import('/explicit-host.mjs');
    const root = document.createElement('section');
    root.innerHTML = html;
    document.body.append(root);
    const handle = await mountExplicitPage({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', themes: [], bootAffordance: false });
    const hosts = () => [...root.querySelectorAll('[data-scriptoscope-window-host]')];
    for (let i = 0; i < 200 && hosts().length < 4; i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 400));
    const out = Object.fromEntries(hosts().map(h => {
      const win = h.shadowRoot.querySelector('[data-scriptoscope-current-state]');
      return [win?.getAttribute('aria-label'), win?.dataset.scriptoscopeCurrentState];
    }));
    handle.disconnect();
    return out;
  }, [html('W1', 'active'), html('W2'), html('W3', 'active'),
    html('OWN').replace('data-scriptoscope-window ', 'data-scriptoscope-window data-scriptoscope-theme="windows-31" ')].join(''));
  expect(states, 'W3 wins the shared manager; the own-theme window is active in its own').toEqual({ W1: 'inactive', W2: 'inactive', W3: 'active', OWN: 'active' });
});
