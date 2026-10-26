import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

for (const mode of ['source', 'built']) for (const wrapped of [false, true]) {
  test(`${mode}: an added ${wrapped ? 'container' : 'window root'} promotes its real host and original child`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async ({ mode, wrapped }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const theme = await api.loadTheme('/themes/windows-95');
      const root = document.createElement('section'); root.id = 'added-root'; document.body.append(root);
      const handle = await api.mountDeclarative({ root, pageThemeDefault: 'fixture', bootAffordance: 'none' });
      handle.registerTheme('fixture', theme);
      const windowSource = document.createElement('article'); windowSource.dataset.scriptoscopeWindow = '';
      windowSource.dataset.scriptoscopeTitle = 'Added window'; windowSource.style.width = '260px';
      const native = document.createElement('button'); native.dataset.scriptoscopeButton = ''; native.type = 'button'; native.textContent = 'Original child'; windowSource.append(native);
      const f = window.addedScan = { root, handle, theme, windowSource, native, clicks: 0 };
      native.addEventListener('click', () => f.clicks++);
      const container = document.createElement('div'); if (wrapped) container.append(windowSource);
      root.append(wrapped ? container : windowSource);
    }, { mode, wrapped });
    await expect(page.locator('#added-root [data-scriptoscope-window-host]')).toHaveCount(1);
    await expect(page.locator('#added-root .scriptoscope-button')).toHaveCount(1);
    const evidence = await page.evaluate(() => {
      const f = window.addedScan, host = f.root.querySelector('[data-scriptoscope-window-host]');
      return { actualChrome: !!host.shadowRoot?.querySelector('canvas'), childSame: f.native.isConnected && host.contains(f.native), stats: { ...f.handle.stats } };
    });
    expect(evidence).toMatchObject({ actualChrome: true, childSame: true, stats: { windows: 1, buttons: 1 } });
    await page.getByRole('button', { name: 'Original child', exact: true }).focus(); await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.addedScan.clicks)).toBe(1);
    const restored = await page.evaluate(() => { const f = window.addedScan; f.handle.disconnect(); const result = { sourceSame: f.root.contains(f.windowSource), nativeSame: f.windowSource.contains(f.native), faces: f.root.querySelectorAll('.scriptoscope-button').length }; f.root.remove(); f.theme.dispose(); return result; });
    expect(restored).toEqual({ sourceSame: true, nativeSame: true, faces: 0 });
    await attachObservations(info, 'scanner-added-root', `${mode}-window-${wrapped}`, { mode, wrapped, initial: evidence, restored });
  });
}

for (const mode of ['source', 'built']) test(`${mode}: directly added standalone families are discovered once`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme('/themes/windows-95');
    const root = document.createElement('section'); root.id = 'added-families'; document.body.append(root);
    const handle = await api.mountDeclarative({ root, pageThemeDefault: 'fixture', themes: [{ slug: 'fixture', name: 'Fixture' }], bootAffordance: 'none' });
    handle.registerTheme('fixture', theme);
    const template = document.createElement('template');
    template.innerHTML = `<button data-scriptoscope-button type="button">Standalone</button><input type="checkbox" aria-label="Check"><input type="radio" aria-label="Radio"><input type="range" aria-label="Range"><select aria-label="Select"><option>One</option><option>Two</option></select><input data-scriptoscope-field value="Original"><div data-scriptoscope-tabs><button data-scriptoscope-tab="first">First</button><button data-scriptoscope-tab="second">Second</button><section data-scriptoscope-panel="first">First panel</section><section data-scriptoscope-panel="second">Second panel</section></div><img alt="Icon"><div data-scriptoscope-theme-picker></div>`;
    const nodes = [...template.content.children], icon = nodes.find(n => n.tagName === 'IMG');
    icon.dataset.scriptoscopeIconId = String(theme.inspector.iconIndex[0].id);
    const f = window.familyScan = { root, handle, theme, nodes, clicks: 0, changes: 0 };
    nodes[0].addEventListener('click', () => f.clicks++); nodes[1].addEventListener('change', () => f.changes++);
    const label = document.createElement('label'); label.htmlFor = nodes[1].id = 'standalone-check'; label.textContent = 'Check';
    root.append(label, ...nodes);
  }, mode);
  await expect.poll(() => page.evaluate(() => ({ ...window.familyScan.handle.stats }))).toEqual({ windows: 0, buttons: 1, controls: 4, tabs: 1, fields: 1 });
  await expect(page.locator('#added-families [data-scriptoscope-icon-promoted]')).toHaveCount(1);
  await expect(page.locator('#added-families [data-scriptoscope-theme-picker-promoted]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Standalone', exact: true }).focus(); await page.keyboard.press('Space');
  await page.getByRole('checkbox', { name: 'Check', exact: true }).focus(); await page.keyboard.press('Space');
  await page.getByRole('tab', { name: 'Second', exact: true }).click();
  expect(await page.evaluate(() => { const f = window.familyScan; return { clicks: f.clicks, changes: f.changes, checked: f.nodes[1].checked, selected: f.nodes[6].querySelector('[data-scriptoscope-panel="second"]').hidden }; })).toEqual({ clicks: 1, changes: 1, checked: true, selected: false });
  const result = await page.evaluate(() => { const f = window.familyScan; const stats = { ...f.handle.stats }; f.handle.disconnect(); const sameControls = f.nodes.slice(1, 6).every(n => f.root.contains(n)); const result = { stats, sameControls, decorativeFaces: f.root.querySelectorAll('.scriptoscope-button,.scriptoscope-checkbox,.scriptoscope-radio,.scriptoscope-slider,.scriptoscope-select').length }; f.root.remove(); f.theme.dispose(); return result; });
  expect(result.sameControls).toBe(true); expect(result.decorativeFaces).toBe(0);
  await attachObservations(info, 'scanner-added-root', `${mode}-families`, { mode, result });
});

for (const mode of ['source', 'built']) for (const barrierKind of ['preparation', 'theme']) {
  test(`${mode}: scoped added roots survive a pending ${barrierKind} barrier and later mutations`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    let releaseArchive, archiveHeld = false;
    if (barrierKind === 'theme') {
      const gate = new Promise(resolve => releaseArchive = resolve);
      await page.route('**/themes/system7-nostalgia-silver/scheme.*', async route => { archiveHeld = true; await gate; await route.continue(); });
    }
    await page.evaluate(async ({ mode, barrierKind }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const theme = await api.loadTheme('/themes/windows-95');
      const root = document.createElement('section'); root.id = 'queued-roots'; document.body.append(root);
      const handle = await api.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'fixture', bootAffordance: 'none' }); handle.registerTheme('fixture', theme);
      const f = window.queuedScan = { api, root, handle, theme, held: false, clicks: 0, broadScans: 0, originals:[] };
      const query = root.querySelectorAll.bind(root); root.querySelectorAll = selector => { if (selector.includes('[data-scriptoscope-window]')) f.broadScans++; return query(selector); };
      f.add = title => { const el = document.createElement('article'); el.dataset.scriptoscopeWindow = ''; el.dataset.scriptoscopeTitle = title; el.style.width = '240px'; const button = document.createElement('button'); button.dataset.scriptoscopeButton = ''; button.textContent = title; button.type = 'button'; button.addEventListener('click', () => f.clicks++); f.originals.push(button);el.append(button); root.append(el); return el; };
      if (barrierKind === 'preparation') {
        const decode = HTMLImageElement.prototype.decode; const gate = new Promise(resolve => f.release = resolve);
        HTMLImageElement.prototype.decode = async function () { HTMLImageElement.prototype.decode = decode; const result = await decode.call(this); f.held = true; await gate; return result; };
      } else f.request = handle.retheme('system7-nostalgia-silver');
      f.first = f.add('First queued');
    }, { mode, barrierKind });
    if (barrierKind === 'theme') await expect.poll(() => archiveHeld).toBe(true);
    else await page.waitForFunction(() => window.queuedScan.held);
    await page.evaluate(async () => { const f = window.queuedScan; f.second = f.add('Second queued'); await new Promise(resolve => requestAnimationFrame(resolve)); f.root.append(document.createElement('aside')); });
    if (barrierKind === 'theme') releaseArchive(); else await page.evaluate(() => window.queuedScan.release());
    await expect(page.locator('#queued-roots [data-scriptoscope-window-host]')).toHaveCount(2);
    await expect.poll(()=>page.evaluate(()=>window.queuedScan.originals.map(source=>{const face=source.nextElementSibling;return{sourceConnected:source.isConnected,tag:face?.tagName,label:face?.getAttribute('aria-label')??face?.textContent,visible:!!face&&getComputedStyle(face).display!=='none',canvas:!!face?.querySelector('canvas')};}))).toEqual(['First queued','Second queued'].map(label=>({sourceConnected:true,tag:'BUTTON',label,visible:true,canvas:barrierKind!=='theme'})));
    // Repeated consumer additions and real chrome mutations must not duplicate
    // faces/listeners. Additions inside an existing promoted content slot remain
    // outside this scanner's declared boundary.
    await page.evaluate(async () => { const f = window.queuedScan; const host = f.root.querySelector('[data-scriptoscope-window-host]'); const late = document.createElement('button'); late.dataset.scriptoscopeButton = ''; late.textContent = 'Late unsupported'; host.querySelector('.scriptoscope-fit').append(late); f.late = late; for (let n = 0; n < 4; n++) { const aside = document.createElement('aside'); f.root.append(aside); aside.append(document.createElement('span')); } await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await page.getByRole('button', { name: 'First queued', exact: true }).focus(); await page.keyboard.press('Space');
    const observed = await page.evaluate(() => { const f = window.queuedScan; return { stats: { ...f.handle.stats }, broadScans: f.broadScans, lateStamp: f.late.dataset.scriptoscopePromoted ?? null, clicks: f.clicks, refs: [...f.root.querySelectorAll('[data-scriptoscope-window-host]')].map(h => h.dataset.scriptoscopeTheme) }; });
    expect(observed.stats).toMatchObject({ windows: 2, buttons: 2 }); expect(observed.broadScans).toBe(0); expect(observed.lateStamp).toBeNull(); expect(observed.clicks).toBe(1);
    expect(observed.refs).toEqual(Array(2).fill(barrierKind === 'theme' ? 'system7-nostalgia-silver' : 'fixture'));
    await page.evaluate(() => { const f = window.queuedScan; f.handle.disconnect(); f.root.remove(); f.theme.dispose(); });
    await attachObservations(info, 'scanner-added-root', `${mode}-queued-${barrierKind}`, { mode, barrierKind, observed });
  });
}

for (const mode of ['source', 'built']) test(`${mode}: disconnect during added-family theme preparation publishes nothing late`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let release, held = false; const gate = new Promise(resolve => release = resolve);
  await page.route('**/themes/windows-95/scheme.*', async route => { held = true; await gate; await route.continue(); });
  await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'); document.body.append(root);
    const errors = [], handle = await api.mountDeclarative({ root, pageThemeDefault: 'windows-95', themeBaseUrl: '/themes', bootAffordance: 'none', onPromoteError: e => { errors.push(e.kind); return false; } });
    const t = document.createElement('template'); t.innerHTML = '<button data-scriptoscope-button>Pending</button><input type="range" value="25"><input data-scriptoscope-field value="Native"><img data-scriptoscope-icon="folder"><div data-scriptoscope-tabs><button data-scriptoscope-tab="panel">Tab</button><section data-scriptoscope-panel="panel">Panel</section></div>';
    const nodes = [...t.content.children]; const f = window.abortedScan = { root, handle, nodes, errors, minted: new Set(), revoked: new Set() };
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    URL.createObjectURL = function (blob) { const url = create.call(URL, blob); f.minted.add(url); return url; };
    URL.revokeObjectURL = function (url) { if (f.minted.has(url)) f.revoked.add(url); return revoke.call(URL, url); };
    f.restore = () => { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }; root.append(...nodes);
  }, mode);
  await expect.poll(() => held).toBe(true);
  await page.evaluate(() => window.abortedScan.handle.disconnect()); release();
  // Resolver disposal of every actual late-load URL proves that the held
  // conversion completed; this is not a sleep-based absence assertion.
  await page.waitForFunction(() => { const f = window.abortedScan; return f.minted.size > 0 && f.revoked.size === f.minted.size; });
  await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const observed = await page.evaluate(() => { const f = window.abortedScan; const result = { stats: { ...f.handle.stats }, errors: f.errors, identities: f.nodes.every(n => n.parentNode === f.root), stamps: f.nodes.map(n => [...n.attributes].filter(a => a.name.endsWith('-promoted')).map(a => a.name)), value: f.nodes[1].value, faces: f.root.querySelectorAll('canvas,.scriptoscope-button,.scriptoscope-slider').length }; f.restore(); f.root.remove(); return result; });
  expect(observed).toEqual({ stats: { windows: 0, buttons: 0, controls: 0, tabs: 0, fields: 0 }, errors: [], identities: true, stamps: [[], [], [], [], []], value: '25', faces: 0 });
  await attachObservations(info, 'scanner-added-root', `${mode}-abort`, { mode, observed });
});

for (const mode of ['source', 'built']) test(`${mode}: initial mount root remains a scope rather than a window target`, async ({ page, servers }) => {
  await openHarness(page, servers, mode);
  const result = await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('article'); root.dataset.scriptoscopeWindow = ''; root.innerHTML = '<button data-scriptoscope-button type="button">Initial child</button>'; document.body.append(root);
    const handle = await api.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none' });
    const result = { windows: handle.stats.windows, buttons: handle.stats.buttons, rootSame: root.isConnected, host: !!root.querySelector('[data-scriptoscope-window-host]') }; handle.disconnect(); root.remove(); return result;
  }, mode);
  expect(result).toEqual({ windows: 0, buttons: 1, rootSame: true, host: false });
});

for (const mode of ['source', 'built']) test(`${mode}: initial window preparation retains later standalone child discovery`, async ({ page, servers }) => {
  await openHarness(page, servers, mode);
  await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'); root.id = 'initial-late'; root.innerHTML = '<article data-scriptoscope-window style="width:240px"><button data-scriptoscope-button type="button">Early child</button></article>'; document.body.append(root);
    const f = window.initialScan = { root, held: false }; const decode = HTMLImageElement.prototype.decode, gate = new Promise(resolve => f.release = resolve);
    HTMLImageElement.prototype.decode = async function () { HTMLImageElement.prototype.decode = decode; const result = await decode.call(this); f.held = true; await gate; return result; };
    f.pending = api.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none' });
  }, mode);
  await page.waitForFunction(() => window.initialScan.held);
  const result = await page.evaluate(async () => {
    const f = window.initialScan, late = document.createElement('button'); late.dataset.scriptoscopeButton = ''; late.type = 'button'; late.textContent = 'Late initial child'; f.root.append(late);
    f.release(); f.handle = await f.pending; return { stats: { ...f.handle.stats }, latePromoted: late.dataset.scriptoscopePromoted != null };
  });
  expect(result).toMatchObject({ stats: { windows: 1, buttons: 2 }, latePromoted: true });
  await expect(page.locator('#initial-late .scriptoscope-button')).toHaveCount(2);
  await page.evaluate(() => { const f = window.initialScan; f.handle.disconnect(); f.root.remove(); });
});

for (const mode of ['source', 'built']) test(`${mode}: existing hosts exclude later container-added controls`, async ({ page, servers }) => {
  await openHarness(page, servers, mode);
  const observed = await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'); root.innerHTML = '<article data-scriptoscope-window style="width:240px">Original content</article>'; document.body.append(root);
    const handle = await api.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const wrap = document.createElement('div'); wrap.innerHTML = '<button data-scriptoscope-button>Later wrapped</button>'; root.querySelector('.scriptoscope-fit').append(wrap);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = { buttons: handle.stats.buttons, promoted: wrap.firstElementChild.dataset.scriptoscopePromoted != null }; handle.disconnect(); root.remove(); return result;
  }, mode);
  expect(observed).toEqual({ buttons: 0, promoted: false });
});
