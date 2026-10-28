import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers();
  try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

// Native activation belongs to the browser. A completed public window update
// while Space is held must preserve that activation, as well as DOM focus.
for (const mode of ['source', 'built']) for (const updates of [0, 1, 3]) {
  test(`${mode}: native Space survives ${updates} completed window updates`, async ({ page, servers, browser }, info) => {
    await info.attach('runtime.json', { body: JSON.stringify({ mode, browser: browser.version(), updates }), contentType: 'application/json' });
    await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
    try {
      await page.evaluate(async mode => {
        const css = document.createElement('link'); css.rel = 'stylesheet';
        css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
        await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const theme = await api.loadTheme('/themes/windows-95');
        document.body.innerHTML = '<form id="owner"><input id="field" value="initial"></form><section id="mount"><i id="before"></i><article id="source" data-scriptoscope-window data-scriptoscope-title="Keyboard continuity" data-scriptoscope-width="260" data-scriptoscope-height="40"><button id="original" type="submit" form="owner">Activate original</button></article><i id="after"></i></section>';
        const original = document.querySelector('#original'), source = document.querySelector('#source');
        const owner = document.querySelector('#owner');
        const f = window.keyboardWindow = { api, theme, original, source, owner, clicks: 0, submits: 0, trustedKeys: [], faceClicks: [], cancel: false };
        original.addEventListener('click', event => { f.clicks++; if (f.cancel) event.preventDefault(); });
        owner.addEventListener('submit', event => { event.preventDefault(); f.submits++; });
        f.life = new AbortController();
        f.manager = new api.WindowManager();
        f.window = await api.ScriptoscopeWindow.promote(source, { manager: f.manager, theme });
        f.face = await api.promoteButton(original, theme, f.life.signal); f.face.id = 'keyboard-face';
        f.face.addEventListener('click', event => f.faceClicks.push(event.isTrusted));
        for (const type of ['keydown', 'keyup']) f.face.addEventListener(type, event => {
          f.trustedKeys.push({ type, key: event.key, trusted: event.isTrusted, same: event.target === f.face });
        });
        await document.fonts.ready;
        await f.manager.setContentSize(f.window.host, 260, 40);
        f.height = f.window.host.getBoundingClientRect().height;
      }, mode);
      const face = page.getByRole('button', { name: 'Activate original', exact: true });
      await expect(face).toHaveCount(1);
      await face.focus(); await expect(face).toBeFocused();
      await page.keyboard.down('Space');
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 0, submits: 0, faceClicks: [] });
      for (let n = 1; n <= updates; n++) {
        const state = await page.evaluate(async n => {
          const f = keyboardWindow;
          await f.manager.setContentSize(f.window.host, 260, 40 + 5 * n);
          return { heightDelta: f.window.host.getBoundingClientRect().height - f.height,
            focused: document.activeElement === f.face, faceSame: document.querySelector('#keyboard-face') === f.face,
            connected: f.face.isConnected && f.original.isConnected, clicks: f.clicks };
        }, n);
        expect(state).toEqual({ heightDelta: 5 * n, focused: true, faceSame: true, connected: true, clicks: 0 });
      }
      await page.keyboard.up('Space');
      // Deliberately immediate: polling here would hide a missed native activation.
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 1, submits: 1, faceClicks: [true] });
      expect(await page.evaluate(() => keyboardWindow.trustedKeys)).toEqual([
        { type: 'keydown', key: ' ', trusted: true, same: true },
        { type: 'keyup', key: ' ', trusted: true, same: true },
      ]);
      await expect(face).toBeFocused();
      await page.keyboard.down('Enter');
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 2, submits: 2, faceClicks: [true, true] });
      await page.keyboard.up('Enter');
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 2, submits: 2, faceClicks: [true, true] });
      await face.click();
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 3, submits: 3, faceClicks: [true, true, true] });
      await page.evaluate(() => { keyboardWindow.cancel = true; });
      await face.click();
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 4, submits: 3, faceClicks: [true, true, true, true] });
      const restored = await page.evaluate(() => {
        const f = keyboardWindow;
        f.life.abort(); f.api.restoreButton(f.original); f.window.restoreOriginalElement();
        return { sameSource: document.querySelector('#source') === f.source,
          sameOriginal: f.source.firstElementChild === f.original, form: f.original.form === f.owner,
          before: f.source.previousElementSibling.id, after: f.source.nextElementSibling.id,
          type: f.original.type, faceConnected: f.face.isConnected };
      });
      expect(restored).toEqual({ sameSource: true, sameOriginal: true, form: true, before: 'before', after: 'after', type: 'submit', faceConnected: false });
      await page.locator('#original').focus(); await page.keyboard.press('Space');
      expect(await page.evaluate(() => ({ clicks: keyboardWindow.clicks, submits: keyboardWindow.submits, faceClicks: keyboardWindow.faceClicks }))).toEqual({ clicks: 5, submits: 3, faceClicks: [true, true, true, true] });
    } finally {
      await page.evaluate(() => { const f = window.keyboardWindow; if (!f) return;
        f.life?.abort(); f.api.restoreButton(f.original); f.window?.restoreOriginalElement(); f.theme.dispose();
      }).catch(() => {});
    }
  });
}
