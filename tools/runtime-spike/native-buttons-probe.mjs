// Implementation-owned native button/select checks; no acceptance fixtures.
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from '@playwright/test';
const browser = await ({ chromium, firefox, webkit })[process.env.SCRIPTOSCOPE_PROBE_BROWSER ?? 'chromium'].launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(`${process.env.SCRIPTOSCOPE_PROBE_ORIGIN ?? 'http://127.0.0.1:5193'}/@fs${process.cwd()}/package.json`);
  await page.setContent('<form id="form"><fieldset id="field"></fieldset></form><section id="root"></section>');
  const setup = await page.evaluate(async ({ root, built }) => {
    const api = await import(`${root}/${built ? 'dist/scriptoscope.js' : 'src/index.ts'}`);
    const theme = await api.loadTheme('/themes/1984');
    window.probe = { api, theme, activations: 0, submissions: [], sourceClicks: 0, changes: 0 };
    const button = await api.interactiveButton(theme, { label: 'Action', default: true, onClick: () => window.probe.activations++ });
    button.id = 'action'; document.getElementById('field').append(button);
    document.getElementById('form').addEventListener('submit', event => { event.preventDefault(); window.probe.submissions.push(event.submitter.id); });
    const disabled = await api.interactiveButton(theme, { label: 'Disabled', disabled: true, onClick: () => window.probe.activations++ });
    disabled.id = 'disabled'; document.getElementById('field').append(disabled);
    const rootEl = document.getElementById('root');
    const handle = await api.mountDeclarative({ root: rootEl, pageThemeDefault: 'loaded', bootAffordance: 'none' });
    handle.registerTheme('loaded', theme); window.probe.handle = handle;
    rootEl.innerHTML = '<form id="declarative"><button id="source" data-scriptoscope-button type="submit" name="source" value="yes">Submit</button><select id="select" aria-label="Choice"><option>First</option><option>Second</option></select></form>';
    document.getElementById('source').addEventListener('click', () => window.probe.sourceClicks++);
    document.getElementById('declarative').addEventListener('submit', event => { event.preventDefault(); window.probe.submissions.push(event.submitter.id); });
    document.getElementById('select').addEventListener('change', () => window.probe.changes++);
    return { tag: button.tagName, type: button.type, disabled: disabled.disabled };
  }, { root: `/@fs${process.cwd()}`, built: process.env.SCRIPTOSCOPE_PROBE_BUILT === '1' });
  assert.deepEqual(setup, { tag: 'BUTTON', type: 'button', disabled: true });
  await page.locator('#action').click();
  await page.locator('#action').focus(); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.probe.activations), 3);
  assert.deepEqual(await page.evaluate(() => window.probe.submissions), []);
  await page.evaluate(() => { document.getElementById('field').disabled = true; document.getElementById('action').click(); });
  assert.equal(await page.evaluate(() => window.probe.activations), 3);
  await page.evaluate(() => { document.getElementById('field').disabled = false; document.getElementById('disabled').click(); });
  assert.equal(await page.evaluate(() => window.probe.activations), 3);
  await page.waitForFunction(() => window.probe.handle.stats.buttons === 1 && window.probe.handle.stats.controls === 1);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  assert.equal(await page.evaluate(() => window.probe.sourceClicks), 1);
  assert.deepEqual(await page.evaluate(() => window.probe.submissions), ['source']);
  assert.equal(await page.getByRole('combobox', { name: 'Choice' }).count(), 1);
  const selected = await page.evaluate(() => {
    const wrap = document.querySelector('.scriptoscope-select');
    return { buttons: wrap.querySelectorAll('button').length, roles: wrap.querySelectorAll('[role=button]').length,
      before: wrap.querySelector('canvas')?.toDataURL() };
  });
  assert.equal(selected.buttons, 0); assert.equal(selected.roles, 0);
  await page.locator('#select').selectOption({ label: 'Second' });
  await page.waitForFunction(before => document.querySelector('.scriptoscope-select canvas')?.toDataURL() !== before, selected.before);
  assert.equal(await page.evaluate(() => window.probe.changes), 1);
  await page.evaluate(async () => { await window.probe.handle.retheme('loaded'); window.probe.oldFace = document.querySelector('#source + .scriptoscope-button'); });
  await page.evaluate(() => window.probe.handle.disconnect());
  assert.equal(await page.locator('#source').isVisible(), true);
  assert.equal(await page.locator('#select').isVisible(), true);
  assert.equal(await page.locator('.scriptoscope-select').count(), 0);
  await page.evaluate(() => window.probe.oldFace?.click());
  assert.equal(await page.evaluate(() => window.probe.sourceClicks), 1);
  console.log('PASS: native button activation, keyboard, disabled fields, no implicit submit, declarative submitter, passive select, retheme and teardown');
} finally { await browser.close(); }
