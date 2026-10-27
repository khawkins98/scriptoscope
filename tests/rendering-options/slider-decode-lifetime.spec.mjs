import { test, expect, attachCase } from './fixtures.mjs';

// Native slider lifetime (docs/spec/slider-interaction.md, "The native control
// lifetime also reaches the internal composer ... a track completing after
// disconnect cannot start a thumb/fallback request against revoked owned URLs").
//
// The v2 engine composer (slider.md §3.1; the theme adapter preloads every
// slider cicn the chain holds, then the CDEF 3 tables choose) decodes all of an
// orientation's slider art in the FIRST composition and caches it by URL, so a
// pressed repaint decodes nothing new. The decode window that exists is the
// first composition: hold its first slider decode, dispose while it is held,
// then release. No image request may start after disposal, and nothing may
// paint. What each row can catch: the theme adapter starts every archive-tier decode in the same tick, before the
// hold, so the `own` rows cannot see a late decode start; they guard the commit path (no canvas or geometry
// committed to the disposed face, attached or detached, and no unhandled rejection). Proof: the chain-lifetime
// mutation in src/engine/resources/theme.ts (chainLife's `ended()` always false, so neither the signal nor the
// release of the theme's asset URLs ends the build) fails the `own` rows on the commit assertion and the `base` rows
// on late base-tier starts, source and built. Dropping the composer's and adapter's own abort checks also fails the
// `own` rows; the chain lifetime is the guard both row kinds rest on. The `base` row adds a base chain (archive, then base: the declared
// resource chain, slider.md §2), whose tiers load one after another. The base is
// `animals` (a CDEF 3 archive with slider art) because it ships scheme.sit: a
// baseSlug load takes no `source`, so a base that ships only scheme.rsrc (1138)
// is probed with a 404 for scheme.sit first, which Chromium can report as a
// failed (ERR_ABORTED) request at mount, unrelated to the lifetime under test.
for (const mode of ['source', 'built']) for (const chain of ['own', 'base']) {
  test(`${mode}: disposed owned range cannot start a decode after a held first slider decode resumes (${chain} chain)`, async ({ page, servers }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    try {
      await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
      await page.addStyleTag({ url: `${servers[mode]}${mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css'}` });
      await page.evaluate(async ({ mode, chain }) => {
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const root = document.createElement('section'); document.body.append(root);
        // Mount with no slider, so the slider's first composition (the one that decodes) starts after mount resolves.
        root.innerHTML = '<button type="button">OK</button>';
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        const decode = HTMLImageElement.prototype.decode, revoke = URL.revokeObjectURL;
        const f = window.rangeDecodeLifetime = { root, descriptor, decode, revoke, phase: 'mount', starts: [], revoked: new Set(), lateStarts: [] };
        const gate = new Promise(resolve => { f.release = resolve; });
        Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(url) {
          f.starts.push(url);
          if (f.phase === 'disposed') f.lateStarts.push({ url, revoked: f.revoked.has(url) });
          descriptor.set.call(this, url);
        } });
        HTMLImageElement.prototype.decode = function () {
          const pending = decode.call(this);
          if (f.phase === 'hold' && !f.held) {
            f.held = this;
            // Decode real bytes BEFORE holding the composer, so only the
            // composer's continuation (not this image) waits on the gate.
            f.heldPromise = pending.then(() => { f.trackReady = true; return gate; });
            return f.heldPromise;
          }
          return pending;
        };
        URL.revokeObjectURL = url => { f.revoked.add(url); revoke.call(URL, url); };
        // Every canvas commit to a slider face (attached or detached), with the phase it happened in.
        f.replaceChildren = Element.prototype.replaceChildren; f.commits = [];
        Element.prototype.replaceChildren = function (...nodes) {
          if (this.classList?.contains('scriptoscope-slider') && nodes.some(n => n instanceof HTMLCanvasElement)) f.commits.push(f.phase);
          return f.replaceChildren.apply(this, nodes);
        };
        // These themes belong to the resolver, not registerTheme's borrowed set.
        const resolver = api.createThemeResolver({ themeBaseUrl: '/themes',
          themes: [{ slug: 'windows-95', source: 'scheme.sit' }], ...(chain === 'base' ? { baseSlug: 'animals' } : {}) });
        const theme = await resolver.load('windows-95');
        const life = new AbortController();
        f.handle = { disconnect() { life.abort(); if (f.native) api.restoreControl(f.native); resolver.dispose(); } };
        f.phase = 'hold';
        root.insertAdjacentHTML('beforeend', '<label for="owned-range">Owned volume</label><input id="owned-range" type="range" min="0" max="100" value="50">');
        f.native = root.querySelector('input');
        f.pending = api.promoteGuardedControl(f.native, theme, life.signal, () => !life.signal.aborted && root.contains(f.native));
      }, { mode, chain });
      await page.waitForFunction(() => window.rangeDecodeLifetime.trackReady === true);
      const result = await page.evaluate(async () => {
        const f = window.rangeDecodeLifetime;
        f.face = f.root.querySelector('.scriptoscope-slider');
        const startsBeforeDispose = f.starts.length;
        f.phase = 'disposed'; f.handle.disconnect();
        const synchronous = { sameNative: f.root.querySelector('input') === f.native, value: f.native.value,
          faces: f.root.querySelectorAll('.scriptoscope-slider').length,
          nativeVisible: !f.native.hasAttribute('aria-hidden') && !f.native.hasAttribute('style'),
          heldRevoked: f.revoked.has(f.held.src), revokedCount: f.revoked.size, faceHadCanvas: !!f.face?.querySelector('canvas') };
        const faceBeforeRelease = f.face?.innerHTML;
        f.release(); await f.heldPromise; await f.pending;
        for (let i = 0; i < 4; i++) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { synchronous, startsBeforeDispose, lateStarts: f.lateStarts, faceUnchanged: f.face?.innerHTML === faceBeforeRelease,
          faceCanvasAfterRelease: !!f.face?.querySelector('canvas'), commits: f.commits.slice() };
      });
      expect(result.synchronous).toMatchObject({ sameNative: true, value: '50', faces: 0, nativeVisible: true, heldRevoked: true, faceHadCanvas: false });
      expect(result.synchronous.revokedCount).toBeGreaterThan(0);
      expect(result.startsBeforeDispose).toBeGreaterThan(0);
      expect(result.lateStarts, 'A disposed composition must not request any further slider art (thumb, track or base tier)').toEqual([]);
      expect(result.faceUnchanged).toBe(true);
      expect(result.faceCanvasAfterRelease, 'A disposed composition must not commit a canvas').toBe(false);
      expect(result.commits, 'No slider face (attached or detached) receives a canvas after disposal').toEqual([]);
      expect(errors).toEqual([]);
    } catch (error) { await attachCase(page, info, { mode, chain, errors, boundary: 'owned-slider-first-composition-decode' }, error); throw error; }
    finally {
      await page.evaluate(() => {
        const f = window.rangeDecodeLifetime; if (!f) return;
        f.release(); f.handle?.disconnect();
        Object.defineProperty(HTMLImageElement.prototype, 'src', f.descriptor);
        HTMLImageElement.prototype.decode = f.decode; URL.revokeObjectURL = f.revoke;
        if (f.replaceChildren) Element.prototype.replaceChildren = f.replaceChildren;
        f.root.remove();
      }).catch(() => {});
    }
  });
}
