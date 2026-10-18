import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) {
  test(`${mode}: disposed owned range cannot start a thumb decode after a held track resumes`, async ({ page, servers }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    try {
      await openHarness(page, servers, mode);
      await page.evaluate(async mode => {
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const root = document.createElement('section'); document.body.append(root);
        root.innerHTML = '<label for="owned-range">Owned volume</label><input id="owned-range" type="range" min="0" max="100" value="50">';
        const native = root.querySelector('input');
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        const decode = HTMLImageElement.prototype.decode, revoke = URL.revokeObjectURL;
        const f = window.rangeDecodeLifetime = { root, native, descriptor, decode, revoke, phase: 'mount', initial: new Set(), revoked: new Set(), lateStarts: [] };
        const gate = new Promise(resolve => { f.release = resolve; });
        Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(url) {
          if (f.phase === 'mount') f.initial.add(url);
          if (f.phase === 'disposed') f.lateStarts.push({ url, revoked: f.revoked.has(url) });
          descriptor.set.call(this, url);
        } });
        HTMLImageElement.prototype.decode = function () {
          const pending = decode.call(this);
          if (f.phase === 'hold' && !f.held && !f.initial.has(this.src)) {
            f.held = this;
            // Decode real bytes BEFORE holding the compositor. This isolates
            // later sequential loads from an already-started image's lifetime.
            f.heldPromise = pending.then(() => { f.trackReady = true; return gate; });
            return f.heldPromise;
          }
          return pending;
        };
        URL.revokeObjectURL = url => { f.revoked.add(url); revoke.call(URL, url); };
        // These themes belong to the resolver, not registerTheme's borrowed set.
        f.handle = await api.mountDeclarative({ root, pageThemeDefault: 'windows-95', themeBaseUrl: '/themes',
          themes: [{ slug: 'windows-95', source: 'scheme.sit' }], bootAffordance: 'none', rejectOnEmptyMount: true });
        f.face = root.querySelector('.scriptoscope-slider');
        f.phase = 'hold';
      }, mode);
      await expect(page.locator('.scriptoscope-slider canvas')).toHaveCount(1);
      await expect(page.locator('.scriptoscope-slider canvas')).toBeVisible();
      // Promotion sync can replace an identical canvas between protocol calls.
      // Query its current geometry in one browser task through the stable wrapper.
      const box = await page.locator('.scriptoscope-slider').evaluate(face => {
        const canvas = face.querySelector('canvas');
        if (!canvas?.isConnected) throw new Error('Expected a connected slider canvas');
        const { x, y, width, height } = canvas.getBoundingClientRect();
        return { x, y, width, height, canvases: face.querySelectorAll('canvas').length };
      });
      expect(box).toMatchObject({ width: 120, height: 16, canvases: 1 });
      // Windows95's independently known 11px thumb / 109px travel at value50.
      await page.mouse.move(box.x + 60, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForFunction(() => window.rangeDecodeLifetime.trackReady === true);
      const result = await page.evaluate(async () => {
        const f = window.rangeDecodeLifetime;
        f.phase = 'disposed'; f.handle.disconnect();
        const synchronous = { sameNative: f.root.querySelector('input') === f.native, value: f.native.value,
          faces: f.root.querySelectorAll('.scriptoscope-slider').length,
          nativeVisible: !f.native.hasAttribute('aria-hidden') && !f.native.hasAttribute('style'),
          heldTrackRevoked: f.revoked.has(f.held.src), revokedCount: f.revoked.size };
        const faceBeforeRelease = f.face.innerHTML;
        f.release(); await f.heldPromise;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { synchronous, lateStarts: f.lateStarts, faceUnchanged: f.face.innerHTML === faceBeforeRelease };
      });
      await page.mouse.up();
      expect(result.synchronous).toMatchObject({ sameNative: true, value: '50', faces: 0, nativeVisible: true, heldTrackRevoked: true });
      expect(result.synchronous.revokedCount).toBeGreaterThan(0);
      expect(result.lateStarts, 'An aborted composition must not request even a formerly cached thumb').toEqual([]);
      expect(result.faceUnchanged).toBe(true);
      expect(errors).toEqual([]);
    } catch (error) { await attachCase(page, info, { mode, errors, boundary: 'owned-slider-sequential-decode' }, error); throw error; }
    finally {
      await page.mouse.up().catch(() => {});
      await page.evaluate(() => {
        const f = window.rangeDecodeLifetime; if (!f) return;
        f.release(); f.handle?.disconnect();
        Object.defineProperty(HTMLImageElement.prototype, 'src', f.descriptor);
        HTMLImageElement.prototype.decode = f.decode; URL.revokeObjectURL = f.revoke;
        f.root.remove();
      }).catch(() => {});
    }
  });
}
