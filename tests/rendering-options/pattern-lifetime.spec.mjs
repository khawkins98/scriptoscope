import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) for (const family of ['select', 'button']) for (const holdAt of [1, 2]) test(`${mode}: owned ${family} pattern preparation cancels at decoded ${holdAt === 1 ? 'face' : 'pattern'}`, async ({ page, servers }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  try {
    await openHarness(page, servers, mode);
    await page.evaluate(async ({ mode, holdAt, family }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const root = document.createElement('section'); document.body.append(root);
      root.innerHTML = family === 'select'
        ? '<label for="owned-select">Pattern choice</label><select id="owned-select"><option>One</option><option>Two</option></select>'
        : '<button data-scriptoscope-button type="button">Pattern action</button>';
      const native = root.querySelector(family);
      const handle = await api.mountDeclarative({ root, pageThemeDefault: 'windows-95', themeBaseUrl: '/themes',
        themes: [{ slug: 'windows-95', source: 'scheme.sit' }, { slug: 'crayon-os', source: 'scheme.sit' }], bootAffordance: 'none', rejectOnEmptyMount: true });
      const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      const decode = HTMLImageElement.prototype.decode, revoke = URL.revokeObjectURL;
      const f = window.patternLifetime = { root, native, family, handle, descriptor, decode, revoke, phase: 'prepare', loads: 0, lateStarts: [], revoked: new Set() };
      const gate = new Promise(resolve => { f.release = resolve; });
      Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(url) {
        if (f.phase === 'disposed') f.lateStarts.push({ url, revoked: f.revoked.has(url) });
        descriptor.set.call(this, url);
      } });
      HTMLImageElement.prototype.decode = function () {
        const pending = decode.call(this);
        if (++f.loads === holdAt) {
          f.held = this;
          // Decode actual source bytes before holding; disposal of an already
          // issued browser request is a different obligation.
          f.heldPromise = pending.then(() => { f.ready = true; return gate; });
          return f.heldPromise;
        }
        return pending;
      };
      URL.revokeObjectURL = url => { f.revoked.add(url); revoke.call(URL, url); };
      f.switching = handle.retheme('crayon-os');
    }, { mode, holdAt, family });
    await page.waitForFunction(() => window.patternLifetime.ready);
    const result = await page.evaluate(async () => {
      const f = window.patternLifetime;
      f.phase = 'disposed'; f.handle.disconnect();
      const revokedHeld = f.revoked.has(f.held.src), before = f.root.innerHTML;
      f.release(); await f.switching;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { revokedHeld, sameNative: f.root.querySelector(f.family) === f.native, faces: f.root.querySelectorAll('.scriptoscope-select,.scriptoscope-button').length,
        unchanged: f.root.innerHTML === before, lateStarts: f.lateStarts, loads: f.loads };
    });
    expect(result).toMatchObject({ revokedHeld: true, sameNative: true, faces: 0, unchanged: true, loads: holdAt });
    expect(result.lateStarts, 'No later pattern/pressed/ring decode can start after owned release').toEqual([]);
    expect(errors).toEqual([]);
  } catch (error) { await attachCase(page, info, { mode, family, holdAt, errors }, error); throw error; }
  finally {
    await page.evaluate(() => {
      const f = window.patternLifetime; if (!f) return;
      f.release(); f.handle.disconnect();
      Object.defineProperty(HTMLImageElement.prototype, 'src', f.descriptor);
      HTMLImageElement.prototype.decode = f.decode; URL.revokeObjectURL = f.revoke;
      f.root.remove();
    }).catch(() => {});
  }
});
