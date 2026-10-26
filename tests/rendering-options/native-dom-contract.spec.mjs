import { test as base, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { startServers } from './servers.mjs';
const tabKey = browserName => process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
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
test('plain native browser establishes full-control radio and disabled focus behavior', async ({ page, browserName }) => {
  await page.setContent('<input id="check" type="checkbox"><input id="a" name="r" type="radio"><input id="b" name="r" type="radio" checked><button id="before">Before</button><fieldset disabled><button>Disabled</button></fieldset><button id="after">After</button>');
  await page.locator('#check').focus(); await page.keyboard.press(tabKey(browserName)); await expect(page.locator('#b')).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(page.locator('#a')).toBeChecked();
  await page.locator('#before').focus(); await page.keyboard.press(tabKey(browserName)); await expect(page.locator('#after')).toBeFocused();
});
for (const mode of ['source', 'built']) {
  test(`${mode}: native checkables preserve identity, forms and browser radio focus`, async ({ page, servers, browserName }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      window.content = document.createElement('section'); content.innerHTML = `<form><label>Check<input id="check" type="checkbox" name="check"></label><label for="a">A</label><input id="a" name="choice" type="radio" value="a" checked><label for="b">B</label><input id="b" name="choice" type="radio" value="b"><button id="after" type="button">After</button></form>`;
      window.originals = [...content.querySelectorAll('input')].map(el => ({ el, parent: el.parentNode, next: el.nextSibling, attrs: el.getAttributeNames().map(k => [k, el.getAttribute(k)]) }));
      window.events = { input: 0, change: 0 };
      for (const type of ['input', 'change']) content.querySelector('form').addEventListener(type, () => events[type]++);
      window.mount = async () => { window.handle = await api.mountDeclarative({ root: document.body, pageThemeDefault: 'borrowed', bootAffordance: 'none' }); handle.registerTheme('borrowed', theme); document.body.append(content); };
      await mount();
    });
    await expect(page.locator('.scriptoscope-checkbox,.scriptoscope-radio')).toHaveCount(3);
    await expect(page.getByRole('checkbox', { name: 'Check' })).toHaveJSProperty('tagName', 'INPUT');
    await page.getByRole('checkbox', { name: 'Check' }).click();
    await page.getByRole('radio', { name: 'B', exact: true }).click();
    await expect(page.locator('#check')).toBeChecked(); await expect(page.locator('#b')).toBeChecked();
    expect(await page.evaluate(() => events)).toEqual({ input: 2, change: 2 });
    await page.locator('#check').focus(); await page.keyboard.press(tabKey(browserName)); await expect(page.locator('#b')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); await expect(page.locator('#a')).toBeFocused(); await expect(page.locator('#a')).toBeChecked();
    await page.keyboard.press(tabKey(browserName)); await expect(page.locator('#after')).toBeFocused();
    expect(await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector('form'))))).toEqual({ check: 'on', choice: 'a' });
    await page.evaluate(() => { originals[0].el.setAttribute('aria-label', 'Consumer check'); handle.disconnect(); });
    expect(await page.evaluate(() => originals.every(({ el, parent, next }) => el.parentNode === parent && el.nextSibling === next))).toBe(true);
    await expect(page.locator('#check')).toHaveAttribute('aria-label', 'Consumer check');
    await expect(page.locator('#check')).toBeChecked(); await expect(page.locator('#a')).toBeChecked();
    await page.evaluate(() => { content.remove(); return mount(); });
    await expect(page.locator('.scriptoscope-checkbox,.scriptoscope-radio')).toHaveCount(3);
    await expect(page.getByRole('checkbox', { name: 'Consumer check' })).toBeChecked();
    await page.evaluate(() => { handle.disconnect(); theme.dispose(); });
  });

  test(`${mode}: button uses browser activation, neutral form type and fieldset disabling`, async ({ page, servers, browserName }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      document.body.innerHTML = '<button id="before">Before</button><form id="form"><fieldset id="fields"></fieldset></form><button id="after">After</button>';
      window.calls = 0; window.submits = 0;
      form.addEventListener('submit', e => { e.preventDefault(); submits++; });
      window.face = await api.interactiveButton(theme, { label: 'Action', onClick: () => calls++ }); face.id = 'face'; fields.append(face);
    });
    const face = page.getByRole('button', { name: 'Action' });
    await expect(face).toHaveJSProperty('tagName', 'BUTTON'); await expect(face).toHaveJSProperty('type', 'button');
    await face.click(); await face.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    expect(await page.evaluate(() => ({ calls, submits }))).toEqual({ calls: 3, submits: 0 });
    await page.evaluate(() => { fields.disabled = true; face.click(); });
    await expect(face).toBeDisabled(); await page.locator('#before').focus(); await page.keyboard.press(tabKey(browserName)); await expect(page.locator('#after')).toBeFocused();
    await page.evaluate(() => face.focus()); await expect(face).not.toBeFocused();
    expect(await page.evaluate(() => ({ calls, submits }))).toEqual({ calls: 3, submits: 0 });
    await page.evaluate(() => { fields.disabled = false; face.disabled = true; face.click(); });
    await expect(face).toBeDisabled(); expect(await page.evaluate(() => calls)).toBe(3);
    await page.evaluate(() => theme.dispose());
  });

  test(`${mode}: declarative native buttons forward defaults once and honor cancellation`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    for (const type of ['button', 'submit', 'reset', 'omitted']) {
      await page.evaluate(async type => {
        document.body.innerHTML = '<form id="owner"><input id="field" value="initial"></form><section id="root"></section>';
        const original = document.createElement('button'); original.textContent = 'Forward';
        original.setAttribute('form', 'owner'); original.dataset.scriptoscopeButton = '';
        if (type !== 'omitted') original.type = type;
        window.original = original; window.counts = { click: 0, submit: 0, reset: 0 };
        original.addEventListener('click', () => counts.click++);
        owner.addEventListener('submit', e => { e.preventDefault(); counts.submit++; });
        owner.addEventListener('reset', () => counts.reset++);
        window.handle = await api.mountDeclarative({ root, pageThemeDefault: 'borrowed', bootAffordance: 'none' });
        handle.registerTheme('borrowed', theme); root.append(original);
      }, type);
      await expect(page.locator('#root .scriptoscope-button')).toHaveCount(1);
      await page.evaluate(() => { field.value = 'edited'; });
      await page.getByRole('button', { name: 'Forward' }).click();
      expect(await page.evaluate(() => ({ ...counts, value: field.value }))).toEqual({ click: 1,
        submit: ['submit', 'omitted'].includes(type) ? 1 : 0, reset: type === 'reset' ? 1 : 0,
        value: type === 'reset' ? 'initial' : 'edited' });
      await page.evaluate(() => {
        original.addEventListener('click', e => e.preventDefault(), { once: true });
        window.before = { ...counts }; window.stale = original.nextElementSibling;
      });
      await page.getByRole('button', { name: 'Forward' }).click();
      expect(await page.evaluate(() => ({ submit: counts.submit - before.submit, reset: counts.reset - before.reset,
        click: counts.click - before.click }))).toEqual({ submit: 0, reset: 0, click: 1 });
      await page.evaluate(() => { handle.disconnect(); before = { ...counts }; stale.click(); });
      expect(await page.evaluate(() => ({ same: original.parentNode === root, form: original.form === owner,
        eventsUnchanged: JSON.stringify(before) === JSON.stringify(counts), stale: stale.isConnected }))).toEqual({ same: true, form: true, eventsUnchanged: true, stale: false });
    }
    await page.evaluate(() => theme.dispose());
  });

  test(`${mode}: disconnected native click activates once; synthetic pointer pairs do not`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    expect(await page.evaluate(async () => {
      let calls = 0; const face = await api.interactiveButton(theme, { label: 'Detached', onClick: () => calls++ });
      const fragment = document.createDocumentFragment(); fragment.append(face);
      face.dispatchEvent(new PointerEvent('pointerdown')); face.dispatchEvent(new PointerEvent('pointerup'));
      face.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); face.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      const synthetic = calls; face.click(); const activated = calls; face.disabled = true; face.click(); theme.dispose();
      return { connected: face.isConnected, synthetic, activated, disabled: calls };
    })).toEqual({ connected: false, synthetic: 0, activated: 1, disabled: 1 });
  });
}

test('source: fallback-neutrality mutation imports successfully and produces unwanted submit', async ({ page }) => {
  const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
  let transforms = 0;
  const server = await createViteServer({ root, configFile: false, publicDir: false,
    server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{
      name: 'native-dom-neutrality-negative', enforce: 'pre', transform(code, id) {
        if (id !== root + '/src/interactive.ts') return;
        const target = "el.type = 'button';";
        assert.equal(code.split(target).length, 2, 'mutation requires one current neutral-type assignment');
        transforms++;
        return code.replace(target, "el.type = painter ? 'button' : 'submit';");
      },
    }] });
  try {
    await server.listen(); const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
    await page.goto(origin + '/tests/rendering-options/native-dom-page.html');
    const result = await page.evaluate(async () => {
      const api = await import('/src/index.ts');
      const result = [];
      for (const slug of ['windows-95', 'system7-nostalgia-silver']) {
        const theme = await api.loadTheme('/themes/' + slug); let calls = 0, submits = 0;
        const form = document.createElement('form'); document.body.replaceChildren(form);
        form.addEventListener('submit', e => { e.preventDefault(); submits++; });
        const face = await api.interactiveButton(theme, { label: 'Negative', onClick: () => calls++ });
        form.append(face); face.click(); result.push({ calls, submits }); theme.dispose();
      }
      return result;
    });
    expect(transforms).toBe(1);
    expect(result).toEqual([{ calls: 1, submits: 0 }, { calls: 1, submits: 1 }]);
  } finally { await server.close(); }
});
