// Implementation-owned prototype checks. Does not import acceptance fixtures.
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from '@playwright/test';
const origin = process.env.SCRIPTOSCOPE_PROBE_ORIGIN ?? 'http://127.0.0.1:5193';
const engine = process.env.SCRIPTOSCOPE_PROBE_BROWSER ?? 'chromium';
const browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(`${origin}/package.json`);
  await page.setContent(`<form id="one"><label><input id="c" type="checkbox" name="c" value="yes">Check</label>
    <input id="r1" type="radio" name="r" value="a" checked><label for="r1">Alpha</label>
    <input id="r2" type="radio" name="r" value="b"><label for="r2">Beta</label>
    <fieldset id="field"><legend><label><input id="exempt" type="checkbox">Legend</label></legend>
      <label><input id="disabled" type="checkbox">Disabled</label></fieldset></form>
    <form id="two"><input id="other" type="radio" name="r" checked><label for="other">Other</label></form>
    <label><input type="checkbox" data-no-id>Generated ID</label>`);
  const setup = await page.evaluate(async ({ sourceRoot, built }) => {
    const api = await import(`${sourceRoot}/${built ? 'dist/scriptoscope.js' : 'src/index.ts'}`);
    const handle = built ? await api.mountDeclarative({ pageThemeDefault: '1984', themeBaseUrl: '/themes', bootAffordance: 'none' }) : null;
    const direct = built ? null : await import(`${sourceRoot}/src/declarative/control.ts`);
    const faceFor = input => Array.from(input.labels ?? []).find(label => label.classList.contains(`scriptoscope-${input.type}`));
    const promoteControl = built ? async input => { await handle.retheme('1984'); return faceFor(input); } : direct.promoteControl;
    const restoreControl = built ? () => handle.disconnect() : direct.restoreControl;
    window.probe = { promoteControl, restoreControl, theme: await api.loadTheme('/themes/1984'), faces: {}, events: [] };
    for (const input of document.querySelectorAll('input')) {
      const face = built ? faceFor(input) : await promoteControl(input, window.probe.theme);
      window.probe.faces[input.id] = face;
      for (const name of ['click', 'input', 'change']) input.addEventListener(name, event => {
        window.probe.events.push({ name, id: input.id, checked: input.checked, target: event.target.id });
      });
    }
    return { count: document.querySelectorAll('input').length, generated: document.querySelector('[data-no-id]').id,
      accessible: [...document.querySelectorAll('input')].every(input => !input.hasAttribute('aria-hidden') && !input.hasAttribute('tabindex')) };
  }, { sourceRoot: `/@fs${process.cwd()}`, built: process.env.SCRIPTOSCOPE_PROBE_BUILT === '1' });
  assert.equal(setup.accessible, true);
  assert.ok(setup.generated);
  assert.equal(await page.getByRole('checkbox', { name: 'Check', exact: true }).count(), 1);
  const clickFace = id => page.locator(`label.scriptoscope-checkbox[for="${id}"], label.scriptoscope-radio[for="${id}"]`).click();
  await clickFace('c');
  assert.deepEqual(await page.evaluate(() => window.probe.events.filter(e => e.id === 'c').map(e => [e.name, e.target, e.checked])),
    [['click', 'c', true], ['input', 'c', true], ['change', 'c', true]]);
  // WebKit follows macOS mouse-focus policy; keyboard checks focus the native input explicitly.
  await page.locator('#c').focus();
  assert.equal(await page.evaluate(() => window.probe.faces.c.style.outline.length > 0), true);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#c').isChecked(), false);
  await clickFace('r2');
  assert.deepEqual(await page.evaluate(() => ['r1', 'r2', 'other'].map(id => document.getElementById(id).checked)), [false, true, true]);
  await page.locator('#r2').focus();
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await page.evaluate(() => ['r1', 'r2'].map(id => document.getElementById(id).checked)), [true, false]);
  await page.evaluate(() => { document.getElementById('field').disabled = true; });
  await page.waitForFunction(() => window.probe.faces.disabled.style.cursor === 'default');
  const disabledRect = await page.locator('label.scriptoscope-checkbox[for=disabled]').boundingBox();
  await page.mouse.click(disabledRect.x + disabledRect.width / 2, disabledRect.y + disabledRect.height / 2);
  assert.equal(await page.locator('#disabled').isChecked(), false);
  await clickFace('exempt');
  assert.equal(await page.locator('#exempt').isChecked(), true);
  await page.evaluate(() => { document.getElementById('one').reset(); });
  assert.deepEqual(await page.evaluate(() => ['c', 'r1', 'r2', 'exempt'].map(id => document.getElementById(id).checked)), [false, true, false, false]);
  await page.evaluate(() => { const c = document.getElementById('c'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => {
    const form = document.getElementById('one');
    form.addEventListener('reset', event => event.preventDefault(), { once: true }); form.reset();
  });
  assert.equal(await page.locator('#c').isChecked(), true);
  assert.equal(await page.evaluate(() => new FormData(document.getElementById('one')).get('c')), 'yes');
  // Retheme must read the source label, not the previous decorative label.
  const retheme = await page.evaluate(async () => {
    const { promoteControl, theme, faces } = window.probe;
    const input = document.getElementById('r1');
    const old = faces.r1; faces.r1 = await promoteControl(input, theme);
    return { removed: !old.isConnected, forId: faces.r1.htmlFor, role: faces.r1.getAttribute('role'), hidden: faces.r1.getAttribute('aria-hidden') };
  });
  assert.deepEqual(retheme, { removed: true, forId: 'r1', role: null, hidden: 'true' });
  if (process.env.SCRIPTOSCOPE_PROBE_BUILT !== '1') {
    const lifecycle = await page.evaluate(async () => {
      const { promoteControl, restoreControl, theme } = window.probe;
      const wrap = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; wrap.append(input, 'Lifetime'); document.body.append(wrap);
      const controller = new AbortController();
      const pending = promoteControl(input, theme, controller.signal); controller.abort();
      const canceled = await pending;
      const untouched = !input.hasAttribute('style') && !input.id;
      const face = await promoteControl(input, theme);
      input.id = 'consumer-changed-id';
      await new Promise(resolve => setTimeout(resolve, 0));
      const retargeted = face.htmlFor === input.id;
      restoreControl(input);
      const preserved = input.id === 'consumer-changed-id';
      const movedFace = await promoteControl(input, theme);
      const host = document.createElement('div'); document.body.append(host);
      host.attachShadow({ mode: 'open' }).append(input);
      await new Promise(resolve => setTimeout(resolve, 0));
      const moved = !movedFace.isConnected && !input.hasAttribute('style');
      wrap.remove(); host.remove();
      return { canceled, untouched, retargeted, preserved, moved };
    });
    assert.deepEqual(lifecycle, { canceled: null, untouched: true, retargeted: true, preserved: true, moved: true });
  }
  const restore = await page.evaluate(() => {
    for (const input of document.querySelectorAll('input')) window.probe.restoreControl(input);
    return { faces: document.querySelectorAll('.scriptoscope-checkbox,.scriptoscope-radio').length,
      generated: document.querySelector('[data-no-id]').getAttribute('id'),
      styles: [...document.querySelectorAll('input,label')].every(el => !el.hasAttribute('style')) };
  });
  assert.deepEqual(restore, { faces: 0, generated: null, styles: true });
  console.log('PASS: native activation/event order, keyboard, radio forms, disabled fieldset/legend, reset, submission, retheme, teardown');
} finally { await browser.close(); }
