import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

for (const mode of ['source', 'built']) for (const insideWindow of [false, true]) {
  test(`${mode}: owned buttons restore native identity and release faces (${insideWindow ? 'window' : 'standalone'})`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async ({ mode, insideWindow }) => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(slug => runtime.loadTheme(`/themes/${slug}`)));
      const root = document.createElement('section'), content = document.createElement('div');
      document.body.append(root);
      if (insideWindow) { content.dataset.scriptoscopeWindow = ''; content.style.width = '360px'; }
      content.innerHTML = `<form><button data-scriptoscope-button data-scriptoscope-default="true" type="submit" style="display: inline-flex !important; color: red">OK</button><button data-scriptoscope-button type="reset">Cancel</button><button data-scriptoscope-button type="button" style="display: inline-block; margin: 3px">Copy</button><input name="text" value="original"></form>`;
      const originals = [...content.querySelectorAll('button')].map(el => ({ el, parent: el.parentNode, style: el.getAttribute('style') }));
      const f = window.buttonLifecycle = { runtime, themes, root, content, originals, text: content.querySelector('input'), clicks: 0, submits: 0, resets: 0 };
      for (const { el } of originals) el.addEventListener('click', () => f.clicks++);
      content.querySelector('form').addEventListener('submit', e => { e.preventDefault(); f.submits++; });
      content.querySelector('form').addEventListener('reset', () => f.resets++);
      f.mount = async () => {
        f.handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' });
        f.handle.registerTheme('first', themes[0]); f.handle.registerTheme('next', themes[1]);
        root.append(content);
      };
      await f.mount();
    }, { mode, insideWindow });
    await expect(page.locator('.scriptoscope-button')).toHaveCount(3);
    await page.getByRole('button', { name: 'OK', exact: true }).focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.buttonLifecycle.submits)).toBe(1);
    await page.evaluate(() => window.buttonLifecycle.handle.retheme('next'));
    await expect(page.locator('.scriptoscope-button')).toHaveCount(3);
    const teardown = await page.evaluate(() => {
      const f = window.buttonLifecycle;
      f.oldFaces = [...f.root.querySelectorAll('.scriptoscope-button')];
      f.originals[2].el.style.color = 'blue';
      f.originals[2].el.style.display = 'block'; // consumer overwrites the owned property
      f.originals[2].el.setAttribute('aria-label', 'Consumer copy');
      f.originals[2].el.dataset.scriptoscopePromoted = 'consumer-stamp';
      f.text.value = 'edited';
      f.handle.disconnect();
      const before = f.clicks;
      for (const face of f.oldFaces) {
        face.dispatchEvent(new PointerEvent('pointerdown'));
        face.dispatchEvent(new PointerEvent('pointerup'));
        face.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        face.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      }
      return { remainingFaces: f.root.querySelectorAll('.scriptoscope-button').length,
        sameIdentities: f.originals.every(o => o.el.parentNode === o.parent && o.el.isConnected),
        styles: f.originals.map(o => o.el.getAttribute('style')), expectedStyles: f.originals.map(o => o.style),
        promoted: f.originals.map(o => o.el.getAttribute('data-scriptoscope-promoted')),
        staleClicks: f.clicks - before, value: f.text.value,
        name: f.originals[2].el.getAttribute('aria-label'), copyDisplay: f.originals[2].el.style.display,
        copyColor: f.originals[2].el.style.color };
    });
    await attachObservations(testInfo, 'button-lifecycle', `${mode}-${insideWindow ? 'window' : 'standalone'}`, { mode, insideWindow, teardown });
    expect(teardown).toEqual(expect.objectContaining({ remainingFaces: 0, sameIdentities: true, staleClicks: 0,
      value: 'edited', name: 'Consumer copy', copyDisplay: 'block', copyColor: 'blue', promoted: [null, null, 'consumer-stamp'] }));
    expect(teardown.styles.slice(0, 2)).toEqual(teardown.expectedStyles.slice(0, 2));
    // Consumer explicitly releases its marker before opting into another mount.
    await page.evaluate(async () => {
      const f = window.buttonLifecycle;
      delete f.originals[2].el.dataset.scriptoscopePromoted;
      f.content.remove(); await f.mount();
    });
    await expect(page.locator('.scriptoscope-button')).toHaveCount(3);
    await page.getByRole('button', { name: 'Consumer copy', exact: true }).focus();
    await page.evaluate(() => window.buttonLifecycle.handle.retheme('next'));
    await expect(page.getByRole('button', { name: 'Consumer copy', exact: true })).toBeFocused();
    const before = await page.evaluate(() => window.buttonLifecycle.clicks);
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.buttonLifecycle.clicks)).toBe(before + 1);
    await page.evaluate(() => window.buttonLifecycle.handle.disconnect());
    await expect(page.getByRole('button', { name: 'Consumer copy', exact: true })).toBeFocused();
    await expect(page.locator('.scriptoscope-button')).toHaveCount(0);
    expect(await page.evaluate(() => window.buttonLifecycle.text.value)).toBe('edited');
    await page.evaluate(() => { const f = window.buttonLifecycle; f.root.remove(); f.themes.forEach(t => t.dispose?.()); });
  });
}

for (const mode of ['source', 'built']) {
  test(`${mode}: insertion observers cannot leave an unregistered button after disconnect`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const retheme of [false, true]) {
      await page.evaluate(async ({ mode, retheme }) => {
        const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(slug => runtime.loadTheme(`/themes/${slug}`)));
        const root = document.createElement('section'), holder = document.createElement('div'), native = document.createElement('button');
        native.textContent = 'Original'; native.dataset.scriptoscopeButton = ''; native.style.display = 'inline-flex'; holder.append(native); document.body.append(root);
        const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' });
        handle.registerTheme('first', themes[0]); handle.registerTheme('next', themes[1]);
        const f = window.buttonRace = { root, holder, native, handle, themes, calls: 0, done: false };
        native.addEventListener('click', () => f.calls++);
        if (retheme) {
          root.append(holder);
          await new Promise(resolve => {
            const observer = new MutationObserver(() => { if (root.querySelector('.scriptoscope-button')) { observer.disconnect(); resolve(); } });
            observer.observe(root, { childList: true, subtree: true });
          });
        }
        const observer = new MutationObserver(records => {
          const fresh = records.flatMap(r => [...r.addedNodes]).find(n => n instanceof HTMLElement && n.classList.contains('scriptoscope-button'));
          if (!fresh) return;
          observer.disconnect(); f.fresh = fresh; handle.disconnect(); f.done = true;
        });
        observer.observe(root, { childList: true, subtree: true });
        if (retheme) f.pending = handle.retheme('next'); else root.append(holder);
      }, { mode, retheme });
      await page.waitForFunction(() => window.buttonRace.done);
      const result = await page.evaluate(async () => {
        const f = window.buttonRace; await f.pending;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        f.fresh.dispatchEvent(new PointerEvent('pointerdown')); f.fresh.dispatchEvent(new PointerEvent('pointerup'));
        const result = { faces: f.root.querySelectorAll('.scriptoscope-button').length, display: f.native.style.display,
          stamp: f.native.getAttribute('data-scriptoscope-promoted'), calls: f.calls, connected: f.native.isConnected };
        f.root.remove(); f.themes.forEach(t => t.dispose?.()); return result;
      });
      expect(result).toEqual({ faces: 0, display: 'inline-flex', stamp: null, calls: 0, connected: true });
    }
  });

  test(`${mode}: held normal decode cannot start ring or pressed loads after owned disconnect`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const root = document.createElement('section'), holder = document.createElement('div'), native = document.createElement('button');
      native.dataset.scriptoscopeButton = ''; native.dataset.scriptoscopeDefault = ''; native.textContent = 'OK'; holder.append(native); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none' });
      const f = window.buttonHeld = { root, native, handle, held: false, decodes: [], errors: [] };
      const decode = HTMLImageElement.prototype.decode;
      let release; const barrier = new Promise(resolve => release = resolve); f.release = release;
      HTMLImageElement.prototype.decode = async function () {
        f.decodes.push(this.src);
        // Complete the actual first decode while bytes are still owned, then
        // hold its promise delivery. Disposal must not start another asset.
        const result = await decode.call(this);
        if (!f.held) { f.held = true; await barrier; }
        return result;
      };
      f.restore = () => { HTMLImageElement.prototype.decode = decode; };
      handle.addEventListener('promoteError', event => f.errors.push(String(event.detail)));
      root.append(holder);
    }, mode);
    await page.waitForFunction(() => window.buttonHeld.held);
    const result = await page.evaluate(async () => {
      const f = window.buttonHeld;
      const settled = f.handle.retheme('windows-95'); // waits for the already-started scan
      f.handle.disconnect(); f.release(); await settled;
      f.restore();
      const result = { decodes: f.decodes.length, faces: f.root.querySelectorAll('.scriptoscope-button').length,
        display: f.native.style.display, stamp: f.native.getAttribute('data-scriptoscope-promoted'), errors: f.errors };
      f.root.remove(); return result;
    });
    await attachObservations(testInfo, 'button-lifecycle', `${mode}-held-owned`, { mode, result });
    expect(result).toEqual({ decodes: 1, faces: 0, display: '', stamp: null, errors: [] });
  });

  test(`${mode}: pending moved sources stay consumer-owned and aborted borrowed themes remain usable`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const movement of ['remove', 'reparent']) {
      await page.evaluate(async ({ mode, movement }) => {
        const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const theme = await runtime.loadTheme('/themes/windows-95');
        const root = document.createElement('section'), holder = document.createElement('div'), other = document.createElement('div'), native = document.createElement('button');
        native.dataset.scriptoscopeButton = ''; native.textContent = 'Move'; holder.append(native); document.body.append(root, other);
        const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'borrowed', bootAffordance: 'none' }); handle.registerTheme('borrowed', theme);
        const f = window.buttonMoved = { runtime, theme, root, other, native, handle, movement, held: false };
        const decode = HTMLImageElement.prototype.decode; const barrier = new Promise(resolve => f.release = resolve);
        HTMLImageElement.prototype.decode = async function () { HTMLImageElement.prototype.decode = decode; const result = await decode.call(this); f.held = true; await barrier; return result; };
        root.append(holder);
      }, { mode, movement });
      await page.waitForFunction(() => window.buttonMoved.held);
      const result = await page.evaluate(async () => {
        const f = window.buttonMoved;
        if (f.movement === 'remove') f.native.remove(); else f.other.append(f.native);
        f.release(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        f.handle.disconnect();
        // The inactive face/ring were never prepared by the enabled promotion.
        const reused = await f.runtime.composeButton(f.theme, { label: 'Still borrowed', default: true, disabled: true });
        const result = { parent: f.native.parentNode === f.other ? 'other' : f.native.parentNode === null ? null : 'stolen',
          faces: document.querySelectorAll('.scriptoscope-button').length, display: f.native.style.display,
          stamp: f.native.getAttribute('data-scriptoscope-promoted'), usable: !!reused };
        f.root.remove(); f.other.remove(); f.theme.dispose?.(); return result;
      });
      expect(result).toEqual({ parent: movement === 'remove' ? null : 'other', faces: 0, display: '', stamp: null, usable: true });
    }
  });
}

for (const mode of ['source', 'built']) {
  test(`${mode}: native disabled and declared default state survive retheme and disconnect`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const theme = await runtime.loadTheme('/themes/windows-95'), root = document.createElement('section'); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'theme', bootAffordance: 'none' }); handle.registerTheme('theme', theme);
      const holder = document.createElement('div'); holder.innerHTML = '<button data-scriptoscope-button data-scriptoscope-default disabled type="button">Disabled</button><button data-scriptoscope-button data-scriptoscope-disabled type="button">Declared</button>';
      const natives = [...holder.querySelectorAll('button')], f = window.buttonDisabled = { runtime, theme, root, handle, natives, clicks: 0 };
      natives.forEach(el => el.addEventListener('click', () => f.clicks++)); root.append(holder);
    }, mode);
    await expect(page.locator('.scriptoscope-button')).toHaveCount(2);
    for (const name of ['Disabled', 'Declared']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('tabindex', '-1');
    }
    expect(await page.evaluate(async () => {
      const f = window.buttonDisabled, face = f.natives[0].nextElementSibling;
      const expected = await f.runtime.composeButton(f.theme, { label: 'Disabled', disabled: true, default: true });
      const actual = face.querySelector('canvas'), bytes = actual.getContext('2d').getImageData(0, 0, actual.width, actual.height).data;
      for (const el of f.root.querySelectorAll('.scriptoscope-button')) {
        el.dispatchEvent(new PointerEvent('pointerdown')); el.dispatchEvent(new PointerEvent('pointerup'));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      }
      return { sameGeometry: actual.width === expected.width && actual.height === expected.height,
        samePixels: bytes.every((n, i) => n === expected.data[i]), clicks: f.clicks };
    })).toEqual({ sameGeometry: true, samePixels: true, clicks: 0 });
    await page.evaluate(async () => { const f = window.buttonDisabled; f.natives[0].disabled = false; await f.handle.retheme('theme'); });
    await expect(page.getByRole('button', { name: 'Disabled', exact: true })).not.toHaveAttribute('aria-disabled');
    await page.getByRole('button', { name: 'Disabled', exact: true }).focus(); await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.buttonDisabled.clicks)).toBe(1);
    await page.evaluate(() => window.buttonDisabled.handle.disconnect());
    await expect(page.locator('.scriptoscope-button')).toHaveCount(0);
    expect(await page.evaluate(() => {
      const f = window.buttonDisabled, result = { disabled: f.natives[0].disabled, default: f.natives[0].hasAttribute('data-scriptoscope-default'), sameNative: f.natives[0].isConnected };
      f.root.remove(); f.theme.dispose?.(); return result;
    })).toEqual({ disabled: false, default: true, sameNative: true });
  });
}

for (const mode of ['source', 'built']) for (const movement of ['source', 'parent', 'within']) test(`${mode}: a held theme load cannot adopt a moved button (${movement})`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let release, held = false, releaseNew, heldNew = false;
  const barrier = new Promise(resolve => release = resolve);
  const newBarrier = new Promise(resolve => releaseNew = resolve);
  await page.route('**/themes/windows-95/scheme.*', async route => { held = true; await barrier; await route.continue(); });
  await page.route('**/themes/system7-nostalgia-silver/scheme.*', async route => { heldNew = true; await newBarrier; await route.continue(); });
  await page.evaluate(async ({ mode, movement }) => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'), holder = document.createElement('div'), other = document.createElement('div'), native = document.createElement('button');
    native.textContent = 'Moved during archive load'; native.dataset.scriptoscopeButton = ''; holder.append(native); document.body.append(root, other);
    const handle = await runtime.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none' });
    window.buttonThemeLoad = { root, holder, other, native, handle, movement, runtime };
    if (movement === 'within') { other.dataset.scriptoscopeTheme = 'system7-nostalgia-silver'; root.append(other); }
    root.append(holder);
  }, { mode, movement });
  await expect.poll(() => held).toBe(true);
  await page.evaluate(() => {
    const f = window.buttonThemeLoad;
    f.other.append(f.movement === 'parent' ? f.holder : f.native);
    if (f.movement !== 'within') f.settled = f.handle.retheme('windows-95');
  });
  release();
  if (movement === 'within') await expect.poll(() => heldNew).toBe(true);
  else await page.evaluate(() => window.buttonThemeLoad.settled);
  const result = await page.evaluate(() => {
    const f = window.buttonThemeLoad;
    return { faces: f.other.querySelectorAll('.scriptoscope-button').length, display: f.native.style.display,
      stamp: f.native.getAttribute('data-scriptoscope-promoted'), nativeOutside: f.other.contains(f.native), buttons: f.handle.stats.buttons };
  });
  await attachObservations(testInfo, 'button-lifecycle', `${mode}-theme-load-${movement}`, { mode, movement, result });
  expect(result).toEqual({ faces: 0, display: '', stamp: null, nativeOutside: true, buttons: 0 });
  releaseNew();
  if (movement === 'within') {
    await expect(page.locator('.scriptoscope-button')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.buttonThemeLoad.handle.stats.buttons)).toBe(1);
    expect(await page.evaluate(async () => {
      const f = window.buttonThemeLoad, theme = await f.runtime.loadTheme('/themes/system7-nostalgia-silver');
      try {
        const expected = await f.runtime.composeButton(theme, { label: f.native.textContent });
        const canvas = f.native.nextElementSibling.querySelector('canvas');
        const actual = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return { width: canvas.width === expected.width, height: canvas.height === expected.height,
          pixels: actual.every((value, index) => value === expected.data[index]) };
      } finally { theme.dispose?.(); }
    })).toEqual({ width: true, height: true, pixels: true });
  }
  await page.evaluate(() => { const f = window.buttonThemeLoad; f.handle.disconnect(); f.root.remove(); f.other.remove(); });
});

for (const mode of ['source', 'built']) for (const movement of ['outside', 'new-theme']) test(`${mode}: held face decode rechecks ancestor ownership (${movement})`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  await page.evaluate(async ({ mode, movement }) => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(slug => runtime.loadTheme(`/themes/${slug}`)));
    const root = document.createElement('section'), holder = document.createElement('div'), other = document.createElement('div'), native = document.createElement('button');
    native.textContent = 'Ancestor move'; native.dataset.scriptoscopeButton = ''; holder.append(native); document.body.append(root, other);
    const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'win', bootAffordance: 'none' });
    handle.registerTheme('win', themes[0]); handle.registerTheme('silver', themes[1]);
    if (movement === 'new-theme') { other.dataset.scriptoscopeTheme = 'silver'; root.append(other); }
    const f = window.buttonAncestor = { runtime, themes, root, holder, other, native, handle, held: false, commits: 0 };
    const decode = HTMLImageElement.prototype.decode, barrier = new Promise(resolve => f.release = resolve);
    HTMLImageElement.prototype.decode = async function () {
      HTMLImageElement.prototype.decode = decode; const result = await decode.call(this); f.held = true; await barrier; return result;
    };
    f.observer = new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n instanceof Element && n.classList.contains('scriptoscope-button')) f.commits++; });
    f.observer.observe(holder, { childList: true }); root.append(holder);
  }, { mode, movement });
  await page.waitForFunction(() => window.buttonAncestor.held);
  await page.evaluate(() => { const f = window.buttonAncestor; f.other.append(f.holder); f.release(); });
  if (movement === 'outside') await page.evaluate(() => window.buttonAncestor.handle.retheme('win'));
  else await expect.poll(() => page.evaluate(() => window.buttonAncestor.handle.stats.buttons)).toBe(1);
  const result = await page.evaluate(async movement => {
    const f = window.buttonAncestor, canvas = f.native.nextElementSibling?.querySelector('canvas');
    let newThemePixels = null;
    if (canvas) {
      const expected = await f.runtime.composeButton(f.themes[1], { label: f.native.textContent });
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      newThemePixels = canvas.width === expected.width && canvas.height === expected.height && pixels.every((v, i) => v === expected.data[i]);
    }
    const result = { commits: f.commits, faces: f.other.querySelectorAll('.scriptoscope-button').length,
      display: f.native.style.display, stamp: f.native.getAttribute('data-scriptoscope-promoted'), newThemePixels };
    f.handle.disconnect(); f.observer.disconnect(); f.root.remove(); f.other.remove(); f.themes.forEach(t => t.dispose?.()); return result;
  }, movement);
  await attachObservations(testInfo, 'button-lifecycle', `${mode}-ancestor-${movement}`, { mode, movement, result });
  expect(result).toEqual(movement === 'outside' ? { commits: 0, faces: 0, display: '', stamp: null, newThemePixels: null }
    : { commits: 1, faces: 1, display: 'none', stamp: '', newThemePixels: true });
});

for (const mode of ['source', 'built']) test(`${mode}: successive held-theme relocations settle under the final parent without another mutation`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  const slugs = ['windows-95', 'system7-nostalgia-silver', '1138'], holds = [];
  for (const slug of slugs) {
    const hold = { held: false }; const barrier = new Promise(resolve => hold.release = resolve); holds.push(hold);
    await page.route(`**/themes/${slug}/scheme.*`, async route => { hold.held = true; await barrier; await route.continue(); });
  }
  await page.evaluate(async ({ mode, slugs }) => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'), native = document.createElement('button');
    native.dataset.scriptoscopeButton = ''; native.textContent = 'Final parent'; document.body.append(root);
    const handle = await runtime.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: slugs[0], bootAffordance: 'none' });
    const parents = slugs.map(slug => { const el = document.createElement('div'); el.dataset.scriptoscopeTheme = slug; return el; });
    parents[0].append(native); root.append(...parents);
    window.buttonRelocations = { runtime, root, native, handle, parents };
  }, { mode, slugs });
  for (let index = 0; index < 2; index++) {
    await expect.poll(() => holds[index].held).toBe(true);
    await page.evaluate(index => { const f = window.buttonRelocations; f.parents[index + 1].append(f.native); }, index);
    holds[index].release();
  }
  try { await expect.poll(() => holds[2].held).toBe(true); }
  catch (error) {
    const state = await page.evaluate(() => { const f = window.buttonRelocations; return { faces: f.root.querySelectorAll('.scriptoscope-button').length, display: f.native.style.display, stamp: f.native.getAttribute('data-scriptoscope-promoted'), parent: f.parents.indexOf(f.native.parentNode), buttons: f.handle.stats.buttons }; });
    await attachObservations(testInfo, 'button-lifecycle', `${mode}-successive-moves`, { mode, state }); throw error;
  }
  expect(await page.evaluate(() => { const f = window.buttonRelocations; return { faces: f.root.querySelectorAll('.scriptoscope-button').length, display: f.native.style.display }; })).toEqual({ faces: 0, display: '' });
  holds[2].release();
  await expect.poll(() => page.evaluate(() => window.buttonRelocations.handle.stats.buttons)).toBe(1);
  const result = await page.evaluate(async () => {
    const f = window.buttonRelocations, theme = await f.runtime.loadTheme('/themes/1138');
    try {
      const expected = await f.runtime.composeButton(theme, { label: f.native.textContent }), canvas = f.native.nextElementSibling.querySelector('canvas');
      const actual = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return { faces: f.root.querySelectorAll('.scriptoscope-button').length, width: canvas.width === expected.width,
        height: canvas.height === expected.height, pixels: actual.every((value, index) => value === expected.data[index]) };
    } finally { f.handle.disconnect(); f.root.remove(); theme.dispose?.(); }
  });
  expect(result).toEqual({ faces: 1, width: true, height: true, pixels: true });
});

for (const mode of ['source', 'built']) test(`${mode}: disconnect cancels an ownership retry waiting for its animation frame`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let release, held = false, secondLoads = 0;
  const barrier = new Promise(resolve => release = resolve);
  await page.route('**/themes/windows-95/scheme.*', async route => { held = true; await barrier; await route.continue(); });
  await page.route('**/themes/1138/scheme.*', async route => { secondLoads++; await route.continue(); });
  await page.evaluate(async mode => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'), first = document.createElement('div'), second = document.createElement('div'), native = document.createElement('button');
    native.dataset.scriptoscopeButton = ''; native.textContent = 'Cancel frame'; first.append(native); second.dataset.scriptoscopeTheme = '1138'; document.body.append(root);
    const handle = await runtime.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none' });
    window.buttonRetry = { root, first, second, native, handle }; root.append(first, second);
  }, mode);
  await expect.poll(() => held).toBe(true);
  await page.evaluate(() => {
    const f = window.buttonRetry, raf = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    f.callbacks = new Map(); f.scheduled = 0; f.cancelled = 0;
    window.requestAnimationFrame = callback => { const id = 900000 + ++f.scheduled; f.callbacks.set(id, callback); return id; };
    window.cancelAnimationFrame = id => { if (f.callbacks.delete(id)) f.cancelled++; else cancel(id); };
    f.restore = () => { window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel; };
    f.second.append(f.native);
  });
  release(); await page.waitForFunction(() => window.buttonRetry.scheduled > 0);
  const result = await page.evaluate(async () => {
    const f = window.buttonRetry, settled = f.handle.retheme('1138');
    f.handle.disconnect(); await settled; f.restore();
    const result = { scheduled: f.scheduled, cancelled: f.cancelled, pendingFrames: f.callbacks.size,
      faces: f.root.querySelectorAll('.scriptoscope-button').length, display: f.native.style.display, stamp: f.native.getAttribute('data-scriptoscope-promoted') };
    f.root.remove(); return result;
  });
  await attachObservations(testInfo, 'button-lifecycle', `${mode}-cancel-retry-frame`, { mode, result, secondLoads });
  expect(result).toEqual({ scheduled: 1, cancelled: 1, pendingFrames: 0, faces: 0, display: '', stamp: null });
  expect(secondLoads).toBe(0);
});
