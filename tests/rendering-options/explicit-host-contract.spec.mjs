import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';
const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers(); try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });
async function setup(page, servers, mode) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(async mode => {
    window.api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    window.theme = await api.loadTheme('/themes/windows-95');
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css'; document.head.append(css);
  }, mode);
}
for (const mode of ['source', 'built']) {
  test(`${mode}: public owned resolver shares loads and borrows registered base graphs`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      theme.dispose();
      const resolver = api.createOwnedThemeResolver({ themeBaseUrl: '/themes',
        themes: [{ slug: 'windows-95', source: 'scheme.sit' }, { slug: 'windows-31', source: 'scheme.sit' }] });
      const pending = resolver.load('windows-95'), samePromise = pending === resolver.load('windows-95');
      const owned = await pending, borrowedBase = await resolver.load('windows-31');
      const borrowedOwned = await api.loadOwnedTheme('/themes/1138', { source: 'scheme.rsrc', base: borrowedBase });
      let externalDisposals = 0;
      const legacy = { baseUrl: '/application', manifest: { name: 'Borrowed legacy', windowTypes: {}, chromeElements: {} }, base: borrowedBase,
        dispose() { externalDisposals++; } };
      resolver.register('legacy', legacy); resolver.register('external-owned', borrowedOwned);
      const identities = await resolver.load('legacy') === legacy && await resolver.load('external-owned') === borrowedOwned;
      resolver.dispose(); resolver.dispose();
      let ownDisposed = false, resolverInvalid = 0;
      try { await api.composeButton(owned); } catch (error) { ownDisposed = error.name === 'AbortError'; }
      try { await resolver.load('legacy'); } catch { resolverInvalid++; }
      try { resolver.register('late', legacy); } catch { resolverInvalid++; }
      try { await resolver.preloadFonts(); } catch { resolverInvalid++; }
      const borrowedUsable = !!(await api.composeButton(borrowedBase)) && !!(await api.composeButton(borrowedOwned)) && !!(await api.composeButton(legacy));
      borrowedOwned.dispose(); borrowedBase.dispose();
      return { samePromise, identities, ownDisposed, resolverInvalid, borrowedUsable, externalDisposals };
    });
    expect(result).toEqual({ samePromise: true, identities: true, ownDisposed: true, resolverInvalid: 3, borrowedUsable: true, externalDisposals: 0 });
  });

  test(`${mode}: explicit native submit preserves validation and original callback identity`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const root = document.createElement('section'); root.innerHTML = '<form id="explicit-validation"><input name="required" required></form><button form="explicit-validation">Submit</button>';
      document.body.append(root); const form = root.querySelector('form'), input = root.querySelector('input'), source = root.querySelector('button');
      const life = new AbortController(); let clicks = 0, submits = 0, invalid = 0, wrongTarget = 0;
      source.addEventListener('click', event => { clicks++; if (event.target !== source || event.currentTarget !== source) wrongTarget++; });
      form.addEventListener('submit', event => { event.preventDefault(); submits++; }); form.addEventListener('invalid', () => invalid++, true);
      const face = await api.promoteGuardedButton(source, theme, life.signal, () => root.contains(source));
      face.click(); const blocked = { clicks, submits, invalid };
      input.value = 'live'; face.click(); const admitted = { clicks, submits, invalid };
      life.abort(); api.restoreButton(source); const before = clicks; face.click();
      const result = { blocked, admitted, wrongTarget, staleInert: clicks === before,
        identity: form.elements.namedItem('required') === input && source.form === form, value: new FormData(form).get('required'), required: input.required };
      root.remove(); theme.dispose(); return result;
    });
    expect(result).toEqual({ blocked: { clicks: 1, submits: 0, invalid: 1 }, admitted: { clicks: 2, submits: 1, invalid: 1 },
      wrongTarget: 0, staleInert: true, identity: true, value: 'live', required: true });
  });

  test(`${mode}: public guards deny initial commits and preserve thrown identity`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const results = [];
      for (const kind of ['button', 'checkbox', 'radio', 'range', 'select']) {
        const source = document.createElement(kind === 'button' ? 'button' : kind === 'select' ? 'select' : 'input');
        if (source instanceof HTMLInputElement) source.type = kind;
        if (kind === 'select') source.innerHTML = '<option>One</option><option>Two</option>';
        else source.textContent = 'Native';
        source.style.color = 'red'; document.body.append(source);
        const before = source.outerHTML, next = source.nextSibling, life = new AbortController();
        const promote = kind === 'button' ? api.promoteGuardedButton : api.promoteGuardedControl;
        const restore = kind === 'button' ? api.restoreButton : api.restoreControl;
        const denied = await promote(source, theme, life.signal, () => false);
        const sentinel = { kind: 'caller guard error' }; let caught;
        try { await promote(source, theme, life.signal, () => { throw sentinel; }); } catch (error) { caught = error; }
        results.push({ kind, denied: denied === null, thrown: caught === sentinel,
          intact: source.outerHTML === before && source.nextSibling === next });
        life.abort(); restore(source); source.remove();
      }
      theme.dispose(); return results;
    });
    expect(result).toEqual(['button', 'checkbox', 'radio', 'range', 'select'].map(kind => ({ kind, denied: true, thrown: true, intact: true })));
  });

  test(`${mode}: guard revoked during image preparation publishes no late face`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    for (const kind of ['button', 'checkbox', 'radio', 'range', 'select']) {
      await page.evaluate(kind => {
        const source = document.createElement(kind === 'button' ? 'button' : kind === 'select' ? 'select' : 'input');
        if (source instanceof HTMLInputElement) source.type = kind;
        if (kind === 'select') source.innerHTML = '<option>One</option>';
        else source.textContent = 'Pending';
        document.body.append(source);
        const f = window.pendingGuard = { source, before: source.outerHTML, kind, permitted: true, life: new AbortController() };
        const decode = HTMLImageElement.prototype.decode;
        const gate = new Promise(resolve => f.release = resolve);
        HTMLImageElement.prototype.decode = async function () { f.started = true; await gate; return decode.call(this); };
        f.restoreDecode = () => { HTMLImageElement.prototype.decode = decode; };
        const promote = kind === 'button' ? api.promoteGuardedButton : api.promoteGuardedControl;
        f.pending = promote(source, theme, f.life.signal, () => f.permitted);
      }, kind);
      await page.waitForFunction(() => window.pendingGuard.started);
      const result = await page.evaluate(async () => {
        const f = window.pendingGuard; f.permitted = false; f.restoreDecode(); f.release();
        const face = await f.pending;
        const result = { denied: face === null, intact: f.source.outerHTML === f.before, count: document.querySelectorAll('.scriptoscope-button,.scriptoscope-checkbox,.scriptoscope-radio,.scriptoscope-slider,.scriptoscope-select').length };
        f.life.abort(); (f.kind === 'button' ? api.restoreButton : api.restoreControl)(f.source); f.source.remove();
        return result;
      });
      expect(result).toEqual({ denied: true, intact: true, count: 0 });
      // Fresh public load avoids relying on implementation image-cache behavior.
      await page.evaluate(async () => { theme.dispose(); window.theme = await api.loadTheme('/themes/windows-95'); });
    }
    await page.evaluate(() => theme.dispose());
  });

  test(`${mode}: failed and denied replacement retain old face until explicit release`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const results = [];
      for (const kind of ['button', 'checkbox', 'radio', 'range', 'select']) {
        const root = document.createElement('section'); document.body.append(root);
        const source = document.createElement(kind === 'button' ? 'button' : kind === 'select' ? 'select' : 'input');
        if (source instanceof HTMLInputElement) source.type = kind;
        if (kind === 'select') source.innerHTML = '<option>One</option><option>Two</option>';
        else source.textContent = 'Continuity'; root.append(source);
        let clicks = 0; source.addEventListener('click', () => clicks++);
        const life = new AbortController(), promote = kind === 'button' ? api.promoteGuardedButton : api.promoteGuardedControl;
        const restore = kind === 'button' ? api.restoreButton : api.restoreControl;
        const old = await promote(source, theme, life.signal, () => true);
        const denied = await promote(source, theme, life.signal, () => false);
        const stillOld = old.isConnected && root.contains(old);
        const fresh = await api.loadTheme('/themes/windows-95');
        const decode = HTMLImageElement.prototype.decode;
        const sentinel = new Error('independent replacement decode failure');
        HTMLImageElement.prototype.decode = async function () { throw sentinel; };
        let rejected = false;
        try { await promote(source, fresh, life.signal, () => true); } catch { rejected = true; }
        finally { HTMLImageElement.prototype.decode = decode; }
        const failedIntact = old.isConnected && root.contains(old);
        const replacement = await promote(source, theme, life.signal, () => true);
        if (kind === 'button') api.disposePromotedButtonFace(source, old);
        const oldRemoved = !old.isConnected, currentPresent = replacement?.isConnected && root.contains(source);
        const before = clicks; old.click(); const oldInert = clicks === before;
        life.abort(); restore(source); restore(source);
        results.push({ kind, denied: denied === null, stillOld, rejected, failedIntact, oldRemoved, currentPresent, oldInert, native: source.parentNode === root, faces: root.children.length });
        root.remove(); fresh.dispose();
      }
      theme.dispose(); return results;
    });
    expect(result).toEqual(['button', 'checkbox', 'radio', 'range', 'select'].map(kind => ({ kind, denied: true, stillOld: true, rejected: true, failedIntact: true, oldRemoved: true, currentPresent: true, oldInert: true, native: true, faces: 1 })));
  });

  test(`${mode}: field restoration preserves original baseline and later application edits`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(() => {
      const form = document.createElement('form'); document.body.append(form);
      const fields = [document.createElement('input'), document.createElement('textarea')];
      let events = 0;
      const results = fields.map((source, i) => {
        source.className = 'application-field'; source.style.color = 'red'; source.tabIndex = 3;
        source.setAttribute('data-scriptoscope-field', ''); source.name = `field${i}`; source.value = 'before';
        form.append(source); const attrs = [...source.attributes].map(a => [a.name, a.value]);
        source.addEventListener('input', () => events++);
        api.promoteField(source, theme); api.promoteField(source, theme);
        source.value = 'live'; source.classList.add('later'); source.style.color = 'purple'; source.setAttribute('aria-label', 'Application field');
        api.restoreField(source); api.restoreField(source);
        source.dispatchEvent(new Event('input', { bubbles: true }));
        return { same: form.elements.namedItem(source.name) === source, value: source.value,
          className: source.className, color: source.style.color, label: source.getAttribute('aria-label'), tabIndex: source.tabIndex,
          stamp: source.hasAttribute('data-scriptoscope-field-promoted'), originalNames: attrs.map(([name]) => name).every(name => source.hasAttribute(name)) };
      });
      const data = Object.fromEntries(new FormData(form)); form.remove(); theme.dispose(); return { results, events, data };
    });
    expect(result).toEqual({ results: [0, 1].map(() => ({ same: true, value: 'live', className: 'application-field later', color: 'purple', label: 'Application field', tabIndex: 3, stamp: false, originalNames: true })), events: 2, data: { field0: 'live', field1: 'live' } });
  });

  test(`${mode}: tabs restore live nodes, owned attributes, focus and listener lifetime`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const root = document.createElement('section');
      root.innerHTML = '<div data-scriptoscope-tabs class="app-tabs"><button data-scriptoscope-tab="a" tabindex="4">A</button><button data-scriptoscope-tab="b">B</button><section data-scriptoscope-panel="a"><input value="before"></section><section data-scriptoscope-panel="b" hidden>B panel</section></div>';
      document.body.append(root); const tabs = root.firstElementChild, nodes = [...tabs.children], input = tabs.querySelector('input');
      const original = nodes.map(n => n.outerHTML), life = new AbortController(); let clicks = 0;
      nodes[1].addEventListener('click', () => clicks++);
      await api.promoteTabs(tabs, theme, { signal: life.signal });
      await api.promoteTabs(tabs, theme, { signal: life.signal, forceRescan: true });
      const faces = [...tabs.querySelectorAll('[role=tab]')].filter(node => !nodes.includes(node));
      input.value = 'live'; nodes[1].setAttribute('aria-label', 'Later tab'); tabs.classList.add('later');
      faces.at(-1)?.focus(); const faceFocus = document.activeElement === faces.at(-1); life.abort(); api.restoreTabs(tabs); api.restoreTabs(tabs);
      const before = nodes.map(n => n.outerHTML); faces.forEach(face => face.click());
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = { nodes: nodes.every(n => n.parentNode === tabs), input: tabs.querySelector('input') === input, value: input.value,
        firstBaseline: nodes[0].outerHTML === original[0], panelBaseline: nodes[2].outerHTML === original[2] && nodes[3].outerHTML === original[3],
        label: nodes[1].getAttribute('aria-label'), className: tabs.className, faces: tabs.querySelectorAll('[role=tab]').length,
        staleInert: before.every((html, i) => nodes[i].outerHTML === html), clicks,
        focus: document.activeElement === nodes[1], faceFocus, faceCount: faces.length };
      root.remove(); theme.dispose(); return result;
    });
    expect(result).toEqual({ nodes: true, input: true, value: 'live', firstBaseline: true, panelBaseline: true, label: 'Later tab', className: 'app-tabs later', faces: 0, staleInert: true, clicks: 0, focus: true, faceFocus: true, faceCount: 2 });
  });

  test(`${mode}: restoring pending tabs cancels semantic and face publication`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      theme.dispose(); window.theme = await api.loadTheme('/themes/1138', { source: 'scheme.rsrc' });
      const source = document.createElement('div'); source.dataset.scriptoscopeTabs = '';
      source.innerHTML = '<button data-scriptoscope-tab="a">A</button><button data-scriptoscope-tab="b">B</button><section data-scriptoscope-panel="a"><input value="live"></section><section data-scriptoscope-panel="b">B</section>';
      document.body.append(source);
      const life = new AbortController(), f = window.pendingTabs = { source, life, nodes: [...source.children], before: source.outerHTML };
      const decode = HTMLImageElement.prototype.decode, gate = new Promise(resolve => f.release = resolve);
      HTMLImageElement.prototype.decode = async function () { f.started = true; await gate; return decode.call(this); };
      f.restoreDecode = () => { HTMLImageElement.prototype.decode = decode; };
      f.pending = api.promoteTabs(source, theme, { signal: life.signal });
    });
    await page.waitForFunction(() => window.pendingTabs.started);
    const result = await page.evaluate(async () => {
      const f = window.pendingTabs;
      f.life.abort(); api.restoreTabs(f.source); const restored = f.source.outerHTML;
      f.restoreDecode(); f.release(); await f.pending;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = { original: f.source.outerHTML === f.before, inert: f.source.outerHTML === restored,
        identity: f.nodes.every(node => node.parentNode === f.source), value: f.source.querySelector('input').value };
      api.restoreTabs(f.source); f.source.remove(); theme.dispose(); return result;
    });
    expect(result).toEqual({ original: true, inert: true, identity: true, value: 'live' });
  });

  test(`${mode}: explicit state preserves content, omissions and chrome on z-only changes`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const manager = new api.WindowManager(); let callbacks = 0;
      const content = document.createElement('div'), input = document.createElement('input'); content.append(input); input.value = 'live';
      const host = await manager.add(theme, { title: 'Persisted', width: 240, height: 120 }, { onCollapse: () => callbacks++, onZoom: () => callbacks++ }, { contentEl: content, enabledWidgets: new Set() });
      document.body.append(host); const parent = content.parentNode;
      await manager.applyState(host, { width: 310, height: 175, z: 700, collapsed: true });
      const collapsed = manager.describe(host), canvas = host.shadowRoot.querySelector('canvas');
      await manager.applyState(host, { z: 1700 });
      const zOnly = manager.describe(host), sameChrome = host.shadowRoot.querySelector('canvas') === canvas;
      await manager.applyState(host, { collapsed: false });
      const expanded = manager.describe(host), before = manager.describe(host);
      const aborted = new AbortController(); aborted.abort(); await manager.applyState(host, { width: 999, collapsed: true }, aborted.signal);
      const noAbortChange = JSON.stringify(manager.describe(host)) === JSON.stringify(before);
      let invalid = 0; for (const state of [{ width: NaN }, { height: Infinity }, { z: -Infinity }]) { try { await manager.applyState(host, state); } catch { invalid++; } }
      const other = await manager.add(theme, { title: 'Other', width: 160, height: 80 }); document.body.append(other);
      const laterZ = manager.describe(other).z;
      const result = { collapsed: { width: collapsed.width, height: collapsed.height, z: collapsed.z, collapsed: collapsed.collapsed },
        zOnly: { width: zOnly.width, height: zOnly.height, z: zOnly.z, collapsed: zOnly.collapsed },
        expanded: { width: expanded.width, height: expanded.height, z: expanded.z, collapsed: expanded.collapsed }, sameChrome,
        sameContent: content.parentNode === parent && host.contains(input) && input.value === 'live', callbacks, noAbortChange, invalid, clockAdvanced: laterZ > 1700 };
      manager.remove(host); await manager.applyState(host, { width: 999 }); manager.remove(other); host.remove(); other.remove(); theme.dispose(); return result;
    });
    expect(result).toEqual({ collapsed: { width: 310, height: 175, z: 700, collapsed: true }, zOnly: { width: 310, height: 175, z: 1700, collapsed: true }, expanded: { width: 310, height: 175, z: 1700, collapsed: false }, sameChrome: true, sameContent: true, callbacks: 0, noAbortChange: true, invalid: 3, clockAdvanced: true });
  });

  test(`${mode}: state failure, pending abort and supersession preserve committed content`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const manager = new api.WindowManager(), content = document.createElement('div');
      const input = document.createElement('input'); input.value = 'unchanged'; content.append(input);
      let callbacks = 0;
      const host = await manager.add(theme, { title: 'Atomic', width: 240, height: 120 },
        { onCollapse: () => callbacks++ }, { contentEl: content, enabledWidgets: new Set(['collapse']) });
      document.body.append(host);
      const baseline = manager.describe(host), chrome = host.shadowRoot.firstChild;
      const getContext = HTMLCanvasElement.prototype.getContext, sentinel = new Error('independent state preparation failure');
      HTMLCanvasElement.prototype.getContext = function () { throw sentinel; };
      let failed = false;
      try { await manager.applyState(host, { width: 410, height: 215, collapsed: true }); } catch { failed = true; }
      finally { HTMLCanvasElement.prototype.getContext = getContext; }
      const preserved = manager.describe(host), failureSameChrome = host.shadowRoot.firstChild === chrome;
      const life = new AbortController();
      const aborted = manager.applyState(host, { width: 480, collapsed: true }, life.signal); life.abort(); await aborted;
      const abortedState = manager.describe(host);
      const first = manager.applyState(host, { width: 330, height: 160 });
      const second = manager.applyState(host, { width: 390, height: 190 });
      await Promise.all([first, second]);
      const latest = manager.describe(host);
      await manager.applyState(host, { collapsed: true });
      const collapsed = manager.describe(host).collapsed;
      const result = { failed, failurePreserved: preserved.width === baseline.width && preserved.height === baseline.height && preserved.collapsed === baseline.collapsed,
        failureSameChrome, abortPreserved: abortedState.width === baseline.width && abortedState.collapsed === baseline.collapsed,
        latest: { width: latest.width, height: latest.height }, collapsed, callbacks,
        identity: content.contains(input) && host.contains(content) && input.value === 'unchanged' };
      manager.remove(host); host.remove(); theme.dispose(); return result;
    });
    expect(result).toEqual({ failed: true, failurePreserved: true, failureSameChrome: true, abortPreserved: true,
      latest: { width: 390, height: 190 }, collapsed: true, callbacks: 0, identity: true });
  });

  test(`${mode}: explicit window restore is idempotent and does not emit close`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const source = document.createElement('article'); source.dataset.scriptoscopeWidth = '240'; source.dataset.scriptoscopeHeight = '100';
      const input = document.createElement('input'); source.append(input); document.body.append(source);
      const manager = new api.WindowManager(), life = new AbortController(); let closes = 0, calls = 0;
      document.addEventListener('scriptoscope:close', () => closes++); input.addEventListener('input', () => calls++);
      const instance = await api.ScriptoscopeWindow.promote(source, { manager, theme, signal: life.signal });
      input.value = 'live'; life.abort(); instance.restoreOriginalElement(); instance.restoreOriginalElement();
      input.dispatchEvent(new Event('input'));
      const result = { source: source.isConnected, identity: source.firstChild === input, value: input.value, closes, calls, unmanaged: manager.describe(instance.host) === null, hostRemoved: !instance.host.isConnected };
      source.remove(); theme.dispose(); return result;
    });
    expect(result).toEqual({ source: true, identity: true, value: 'live', closes: 0, calls: 1, unmanaged: true, hostRemoved: true });
  });
}
