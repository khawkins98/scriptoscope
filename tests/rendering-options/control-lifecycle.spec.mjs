import { test, expect, openHarness } from './fixtures.mjs';

for (const mode of ['source', 'built']) {
  for (const insideWindow of [false, true]) test(`${mode}: form controls restore live state and release faces (${insideWindow ? 'window' : 'standalone'})`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async ({ mode, insideWindow }) => {
      // Exercise the declared browser floor: older engines ignore listener.signal.
      const addListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (options && typeof options === 'object') { const { signal, ...supported } = options; options = supported; }
        return addListener.call(this, type, listener, options);
      };
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(slug => runtime.loadTheme(`/themes/${slug}`)));
      const root = document.createElement('section'); document.body.append(root);
      const content = document.createElement('div');
      if (insideWindow) { content.dataset.scriptoscopeWindow = ''; content.dataset.scriptoscopeTitle = 'Form'; content.style.width = '350px'; }
      content.innerHTML = `<form id="native-form">
        <label id="check-label" style="color: red; margin: 3px !important">Check<input id="check" name="check" type="checkbox" style="width: 19px; color: blue" tabindex="0" aria-hidden="false"></label>
        <label for="radio-a" style="display: block">Radio A</label><input id="radio-a" type="radio" name="choice" value="a" checked>
        <label for="radio-b">Radio B</label><input id="radio-b" type="radio" name="choice" value="b">
        <label for="range">Volume</label><input id="range" name="volume" type="range" value="50" style="width: 130px" aria-label="Custom volume">
        <label for="select">Choice</label><select id="select" name="select" style="color: green; width: 160px" autocomplete="on"><option value="a">A</option><option value="b">B</option></select>
      </form>`;
      const inputs = [...content.querySelectorAll('input,select')];
      const originals = inputs.map(el => ({ el, parent: el.parentNode, attributes: [...el.attributes].map(a => [a.name, a.value]) }));
      const labels = [...content.querySelectorAll('label')].map(el => ({ el, style: el.getAttribute('style') }));
      const listeners = [];
      const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
      window.addEventListener = (type, callback, options) => {
        if (['pageshow', 'pointermove', 'pointerup'].includes(type)) listeners.push({ type, callback, signal: options?.signal, removed: false });
        return add(type, callback, options);
      };
      window.removeEventListener = (type, callback, options) => {
        listeners.filter(l => l.type === type && l.callback === callback).forEach(l => l.removed = true);
        return remove(type, callback, options);
      };
      const f = window.lifecycle = { runtime, themes, root, content, inputs, originals, labels, listeners, events: 0 };
      content.addEventListener('change', () => f.events++);
      content.addEventListener('input', () => f.events++);
      f.mount = async () => {
        f.handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' });
        f.handle.registerTheme('first', themes[0]); f.handle.registerTheme('next', themes[1]);
        root.append(content);
      };
      await f.mount();
    }, { mode, insideWindow });
    const faces = page.locator('.scriptoscope-checkbox,.scriptoscope-radio,.scriptoscope-slider,.scriptoscope-select');
    await expect(faces).toHaveCount(5);
    await page.getByRole('checkbox', { name: 'Check', exact: true }).click();
    await page.getByRole('radio', { name: 'Radio B', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'Custom volume' });
    await slider.focus(); await page.keyboard.press('ArrowRight');
    await page.locator('#select').selectOption('b');
    await expect(page.locator('#range')).toHaveValue('51');
    await page.evaluate(() => {
      const f = window.lifecycle;
      f.oldFaces = [...f.root.querySelectorAll('.scriptoscope-checkbox,.scriptoscope-radio,.scriptoscope-slider')];
      // Mutations unrelated to skin ownership must survive teardown.
      f.inputs[3].setAttribute('aria-label', 'Consumer volume');
      f.inputs[3].name = 'updated-volume'; f.inputs[3].max = '200';
      f.inputs[4].style.color = 'purple';
    });
    for (const ref of ['next', 'first', 'next']) {
      await page.evaluate(ref => window.lifecycle.handle.retheme(ref), ref);
      await expect(faces).toHaveCount(5);
      expect(await page.evaluate(() => window.lifecycle.listeners.filter(l => l.type === 'pageshow' && !l.removed && !l.signal?.aborted).length)).toBe(5);
    }
    await expect(page.getByRole('slider')).toHaveAccessibleName('Consumer volume');
    // Detached old controls cannot mutate live carriers, even if retained by a consumer.
    expect(await page.evaluate(() => {
      const f = window.lifecycle, before = f.events;
      for (const face of f.oldFaces) { face.click(); face.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); }
      return f.events - before;
    })).toBe(0);
    // End the mount while dragging and while an asynchronous paint is pending.
    const teardown = await page.evaluate(async () => {
      const f = window.lifecycle, slider = f.root.querySelector('.scriptoscope-slider');
      const rect = slider.getBoundingClientRect();
      slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + rect.width / 2, clientY: rect.top + 2, bubbles: true }));
      f.liveBeforeDisconnect = { checked: f.inputs[0].checked, choice: f.inputs[2].checked, value: f.inputs[3].value, selected: f.inputs[4].value };
      f.handle.disconnect();
      const html = slider.innerHTML, events = f.events;
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.right }));
      window.dispatchEvent(new PointerEvent('pointerup'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { events: f.events - events, paintUnchanged: html === slider.innerHTML,
        live: { checked: f.inputs[0].checked, choice: f.inputs[2].checked, value: f.inputs[3].value, selected: f.inputs[4].value },
        expected: f.liveBeforeDisconnect,
        parents: f.originals.every(o => o.el.parentNode === o.parent),
        labels: f.labels.every(o => o.el.getAttribute('style') === o.style),
        activeListeners: f.listeners.filter(l => !l.removed && !l.signal?.aborted).length,
        attributes: f.originals.map(o => Object.fromEntries([...o.el.attributes].map(a => [a.name, a.value]))),
        originalAttributes: f.originals.map(o => Object.fromEntries(o.attributes)),
        form: Object.fromEntries(new FormData(f.content.querySelector('form'))) };
    });
    expect(teardown.events).toBe(0); expect(teardown.paintUnchanged).toBe(true);
    expect(teardown.live).toEqual(teardown.expected); expect(teardown.parents).toBe(true); expect(teardown.labels).toBe(true);
    expect(teardown.activeListeners).toBe(0);
    for (let i = 0; i < 3; i++) expect(teardown.attributes[i]).toEqual(teardown.originalAttributes[i]);
    expect(teardown.attributes[3]).toEqual({ ...teardown.originalAttributes[3], 'aria-label': 'Consumer volume', name: 'updated-volume', max: '200' });
    await expect(page.locator('#select')).toHaveCSS('color', 'rgb(128, 0, 128)');
    expect(teardown.attributes[4].style).not.toContain('absolute');
    expect(teardown.form).toEqual({ check: 'on', choice: 'b', 'updated-volume': teardown.live.value, select: 'b' });
    await expect(faces).toHaveCount(0);
    // Remount the same original nodes. One face / keyboard target per control.
    await page.evaluate(async () => { const f = window.lifecycle; f.content.remove(); await f.mount(); });
    await expect(faces).toHaveCount(5);
    await expect(page.getByRole('checkbox', { name: 'Check', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Radio B', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('checkbox', { name: 'Check', exact: true }).focus();
    await page.keyboard.press('Tab'); await expect(page.getByRole('radio', { name: 'Radio A', exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByRole('radio', { name: 'Radio B', exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByRole('slider')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('#select')).toBeFocused();
    await page.evaluate(() => { const f = window.lifecycle; f.handle.disconnect(); f.root.remove(); f.themes.forEach(t => t.dispose?.()); });
  });

  test(`${mode}: pending form preparation cannot commit after disconnect or source movement`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const kind of ['checkbox', 'radio', 'range', 'select']) for (const cancel of ['disconnect', 'move', 'remove']) {
      await page.evaluate(async ({ mode, kind }) => {
        const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const theme = await runtime.loadTheme('/themes/windows-95');
        const root = document.createElement('section'), other = document.createElement('div'), holder = document.createElement('div'); document.body.append(root, other);
        const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'held', bootAffordance: 'none' }); handle.registerTheme('held', theme);
        const native = kind === 'select' ? document.createElement('select') : Object.assign(document.createElement('input'), { type: kind });
        if (kind === 'select') native.innerHTML = '<option>A</option><option>B</option>';
        native.setAttribute('style', 'color: red'); native.setAttribute('aria-label', 'Held');
        const original = native.outerHTML;
        const decode = HTMLImageElement.prototype.decode;
        const f = window.pendingControl = { root, other, holder, native, original, handle, theme, held: 0, resumed: 0 };
        const barrier = new Promise(resolve => f.release = resolve);
        HTMLImageElement.prototype.decode = async function () {
          f.held++; await barrier; const result = await decode.call(this); f.resumed++; return result;
        };
        f.restoreDecode = () => { HTMLImageElement.prototype.decode = decode; };
        holder.append(native); root.append(holder);
      }, { mode, kind });
      await page.waitForFunction(() => window.pendingControl.held > 0);
      expect(await page.evaluate(() => window.pendingControl.native.outerHTML === window.pendingControl.original)).toBe(true);
      await page.evaluate(cancel => {
        const f = window.pendingControl;
        if (cancel === 'disconnect') f.handle.disconnect();
        else if (cancel === 'move') f.other.append(f.native);
        else f.native.remove();
        f.restoreDecode(); f.release();
      }, cancel);
      await page.waitForFunction(() => window.pendingControl.resumed === window.pendingControl.held);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const result = await page.evaluate(() => {
        const f = window.pendingControl;
        const result = { unchanged: f.native.outerHTML === f.original,
          faceCount: f.root.querySelectorAll('.scriptoscope-checkbox,.scriptoscope-radio,.scriptoscope-slider,.scriptoscope-select').length,
          parent: f.native.parentNode === f.holder ? 'root' : f.native.parentNode === f.other ? 'other' : 'none',
          count: f.handle.stats.controls };
        f.handle.disconnect(); f.root.remove(); f.other.remove(); f.theme.dispose?.();
        return result;
      });
      expect(result).toEqual({ unchanged: true, faceCount: 0, parent: cancel === 'disconnect' ? 'root' : cancel === 'move' ? 'other' : 'none', count: 0 });
    }
  });
  test(`${mode}: disconnect cancels an in-flight retheme and select repaint`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(s => runtime.loadTheme(`/themes/${s}`)));
      const root = document.createElement('section'); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' });
      handle.registerTheme('first', themes[0]); handle.registerTheme('next', themes[1]);
      const content = document.createElement('div');
      content.innerHTML = '<input type="checkbox"><input type="radio"><input type="range"><select><option>A</option><option>B</option></select>';
      const originals = [...content.children].map(el => ({ el, html: el.outerHTML })); root.append(content);
      window.rethemeLifecycle = { themes, root, handle, content, originals };
    }, mode);
    // Promotion counts advance after the DOM commit's mutation microtask.
    // Poll completed public state; a mutation observer can miss the final count.
    await expect.poll(() => page.evaluate(() => window.rethemeLifecycle.handle.stats.controls)).toBe(4);
    const result = await page.evaluate(async () => {
      const { themes, root, handle, content, originals } = window.rethemeLifecycle;
      const decode = HTMLImageElement.prototype.decode;
      let release, held;
      const barrier = new Promise(resolve => release = resolve), started = new Promise(resolve => held = resolve);
      HTMLImageElement.prototype.decode = async function () { held(); await barrier; return decode.call(this); };
      const switching = handle.retheme('next'); await started;
      const oldSelect = content.querySelector('.scriptoscope-select');
      content.querySelector('select').value = 'B';
      content.querySelector('select').dispatchEvent(new Event('change', { bubbles: true }));
      handle.disconnect();
      const selectHtml = oldSelect.innerHTML;
      HTMLImageElement.prototype.decode = decode; release(); await switching;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = { restored: originals.every(o => o.el.parentNode === content && o.el.outerHTML === o.html),
        children: content.children.length, selected: content.querySelector('select').value,
        staleSelectUnchanged: oldSelect.innerHTML === selectHtml };
      root.remove(); themes.forEach(t => t.dispose?.()); return result;
    });
    expect(result).toEqual({ restored: true, children: 4, selected: 'B', staleSelectUnchanged: true });
  });

  test(`${mode}: theme switchers release only mount-owned listeners and stamps`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(s => runtime.loadTheme(`/themes/${s}`)));
      const root = document.createElement('section'); document.body.append(root);
      const content = document.createElement('div');
      content.innerHTML = '<select id="owned-switcher" data-scriptoscope-theme-switcher><option value="first">First</option><option value="next">Next</option></select><select id="consumer-switcher" data-scriptoscope-theme-switcher data-scriptoscope-switcher-wired="consumer"><option>Consumer</option></select>';
      const f = window.switcherLifecycle = { root, content, themes, runtime, changes: 0, oldRethemes: 0, newRethemes: 0 };
      content.querySelector('#owned-switcher').addEventListener('change', () => f.changes++);
      f.mount = async counter => {
        f.handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' });
        f.handle.registerTheme('first', themes[0]); f.handle.registerTheme('next', themes[1]);
        f.handle.addEventListener('retheme', () => f[counter]++); root.append(content);
      };
      await f.mount('oldRethemes');
    }, mode);
    await expect(page.locator('#owned-switcher')).toHaveAttribute('data-scriptoscope-switcher-wired', '');
    await page.locator('#owned-switcher').selectOption('next');
    await expect.poll(() => page.evaluate(() => window.switcherLifecycle.oldRethemes)).toBe(1);
    await page.evaluate(() => window.switcherLifecycle.handle.disconnect());
    await expect(page.locator('#owned-switcher')).not.toHaveAttribute('data-scriptoscope-switcher-wired');
    await expect(page.locator('#consumer-switcher')).toHaveAttribute('data-scriptoscope-switcher-wired', 'consumer');
    await page.locator('#owned-switcher').selectOption('first');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.switcherLifecycle.oldRethemes)).toBe(1);
    await page.evaluate(async () => { const f = window.switcherLifecycle; f.content.remove(); await f.mount('newRethemes'); });
    await expect(page.locator('#owned-switcher')).toHaveAttribute('data-scriptoscope-switcher-wired', '');
    await page.locator('#owned-switcher').selectOption('next');
    await expect.poll(() => page.evaluate(() => window.switcherLifecycle.newRethemes)).toBe(1);
    expect(await page.evaluate(() => { const f = window.switcherLifecycle; return [f.oldRethemes, f.newRethemes, f.changes]; })).toEqual([1, 1, 3]);
    await page.evaluate(() => { const f = window.switcherLifecycle; f.handle.disconnect(); f.root.remove(); f.themes.forEach(t => t.dispose?.()); });
  });

  test(`${mode}: select preparation uses the live selection and failed preparation leaves native markup intact`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const theme = await runtime.loadTheme('/themes/windows-95');
      const root = document.createElement('section'); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' }); handle.registerTheme('first', theme);
      const holder = document.createElement('div');
      holder.innerHTML = '<select style="width: 123px" aria-label="Choice"><option value="a">A</option><option value="b">Long current selection</option></select>';
      const native = holder.firstElementChild, original = native.outerHTML;
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () { throw new Error('deliberate decode failure'); };
      const failed = new Promise(resolve => handle.addEventListener('promoteError', resolve, { once: true }));
      root.append(holder); await failed;
      const afterFailure = native.outerHTML === original && native.parentNode === holder && holder.children.length === 1;
      HTMLImageElement.prototype.decode = decode;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      holder.remove();
      let release, held;
      const barrier = new Promise(resolve => release = resolve), started = new Promise(resolve => held = resolve);
      HTMLImageElement.prototype.decode = async function () { held(); await barrier; return decode.call(this); };
      root.append(holder); await started;
      native.value = 'b'; native.dispatchEvent(new Event('change', { bubbles: true }));
      HTMLImageElement.prototype.decode = decode; release();
      await new Promise(resolve => {
        const check = () => { if (handle.stats.controls === 1) resolve(); else requestAnimationFrame(check); };
        check();
      });
      const reference = await runtime.interactiveButton(theme, { label: 'Long current selection  ▾', disabled: false });
      const expected = reference.querySelector('canvas').toDataURL();
      const correctLabel = holder.querySelector('.scriptoscope-button canvas').toDataURL() === expected;
      handle.disconnect(); const preservedSelection = native.value === 'b'; root.remove(); theme.dispose?.();
      return { afterFailure, correctLabel, preservedSelection };
    }, mode);
    expect(result).toEqual({ afterFailure: true, correctLabel: true, preservedSelection: true });
  });

  test(`${mode}: an older pending retheme cannot replace later form controls after a newer switch`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(s => runtime.loadTheme(`/themes/${s}`)));
      const root = document.createElement('section'); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'first', bootAffordance: 'none' });
      handle.registerTheme('first', themes[0]); handle.registerTheme('next', themes[1]);
      const holder = document.createElement('div'); holder.innerHTML = '<input type="checkbox"><input type="radio"><input type="range"><select><option>A</option></select>'; root.append(holder);
      window.overlapLifecycle = { themes, root, handle, holder };
    }, mode);
    await expect.poll(() => page.evaluate(() => window.overlapLifecycle.handle.stats.controls)).toBe(4);
    const result = await page.evaluate(async () => {
      const { themes, root, handle, holder } = window.overlapLifecycle;
      const pixels = () => [...holder.querySelectorAll('canvas')].map(c => c.toDataURL());
      const original = pixels();
      const decode = HTMLImageElement.prototype.decode; let release, held;
      const barrier = new Promise(resolve => release = resolve), started = new Promise(resolve => held = resolve);
      HTMLImageElement.prototype.decode = async function () { held(); await barrier; return decode.call(this); };
      const older = handle.retheme('next'); await started;
      HTMLImageElement.prototype.decode = decode;
      await handle.retheme('first');
      const latest = pixels(); release(); await older;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const final = pixels(); handle.disconnect(); root.remove(); themes.forEach(t => t.dispose?.());
      return { original, latest, final };
    }, mode);
    expect(result.latest).toEqual(result.original); expect(result.final).toEqual(result.latest);
  });

  test(`${mode}: select fallback replaces one decoration and restores its native carrier`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const root = document.createElement('section'); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, pageThemeDefault: 'empty', bootAffordance: 'none' });
      handle.registerTheme('empty', { baseUrl: '', manifest: { name: 'No control art', chromeElements: {} } });
      const holder = document.createElement('div'); holder.innerHTML = '<select><option>A</option><option>B</option></select>';
      window.fallbackLifecycle = { root, holder, handle }; root.append(holder);
    }, mode);
    const wrap = page.locator('.scriptoscope-select');
    await expect(wrap.locator('button')).toHaveCount(1);
    await page.locator('.scriptoscope-select select').selectOption({ label: 'B' });
    await expect(wrap.locator('button')).toHaveText('B  ▾');
    await expect(wrap.locator('button')).toHaveCount(1);
    await page.evaluate(() => { const f = window.fallbackLifecycle; f.handle.disconnect(); });
    await expect(page.locator('.scriptoscope-select')).toHaveCount(0);
    await expect(page.locator('select')).toHaveValue('B');
    await page.evaluate(() => window.fallbackLifecycle.root.remove());
  });

  test(`${mode}: disconnect from a slider input handler cannot start a paint against released assets`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await page.evaluate(async mode => {
      const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const root = document.createElement('section'); document.body.append(root);
      const handle = await runtime.mountDeclarative({ root, pageThemeDefault: '/themes/windows-95', bootAffordance: 'none' });
      const holder = document.createElement('div'); holder.innerHTML = '<input type="range" value="50">'; root.append(holder);
      window.reentrantControl = { root, handle, holder };
    }, mode);
    await expect(page.locator('.scriptoscope-slider')).toHaveCount(1);
    const result = await page.evaluate(async () => {
      const f = window.reentrantControl, native = f.holder.querySelector('input'), face = f.holder.querySelector('.scriptoscope-slider');
      const decode = HTMLImageElement.prototype.decode; let lateDecodes = 0;
      HTMLImageElement.prototype.decode = function () { lateDecodes++; return decode.call(this); };
      native.addEventListener('input', () => f.handle.disconnect(), { once: true });
      const rect = face.getBoundingClientRect();
      face.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + rect.width * 0.55, clientY: rect.top + 2, bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      HTMLImageElement.prototype.decode = decode;
      const result = { lateDecodes, value: native.value, faceCount: f.holder.querySelectorAll('.scriptoscope-slider').length,
        nativeVisible: !native.hasAttribute('aria-hidden') && !native.hasAttribute('style') };
      f.root.remove(); return result;
    });
    expect(result).toEqual({ lateDecodes: 0, value: '55', faceCount: 0, nativeVisible: true });
  });

}
