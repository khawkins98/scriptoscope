// Modern consumer contract: theming preserves the native button's primary
// action. Expectations come from README's native/form/keyboard preservation
// promise, with an ordinary HTML button exercised alongside both public APIs.
// This checks activation only and makes no historical painter/pixel claim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createServer as createPortReservation } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
let server, browser, base;
test.before(async () => {
  const reservation = createPortReservation();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  server = await createServer({
    configFile: `${root}/vite.config.js`, root: `${root}/demo`,
    server: { host: '127.0.0.1', port, strictPort: true, open: false },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
test.after(async () => {
  await browser?.close();
  await server?.close();
});

async function fixture(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  // A small same-origin document avoids booting the unrelated demo desktop.
  await page.route('**/__button_activation__', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><style>
      body { padding: 40px; font: 16px sans-serif; }
      form, #imperative-wrap { display: block; margin: 30px; }
    </style>
    <form id="native-form"><button id="native" type="submit">Native action</button></form>
    <form id="promoted-form"><button id="source" type="submit" data-scriptoscope-button>Themed action</button></form>
    <div id="imperative-wrap"></div>`,
  }));
  await page.goto(`${base}__button_activation__`);
  await page.evaluate(async root => {
    const { loadTheme, promoteButton, interactiveButton } = await import(`/@fs${root}/src/index.ts`);
    const theme = await loadTheme('/themes/1138');
    window.activation = {
      native: { clicks: 0, actions: 0 },
      promoted: { clicks: 0, actions: 0 },
      imperative: { clicks: 0, actions: 0 },
    };
    for (const [name, buttonId] of [['native', 'native'], ['promoted', 'source']]) {
      const button = document.getElementById(buttonId);
      button.addEventListener('click', () => { window.activation[name].clicks++; });
      button.form.addEventListener('submit', event => {
        event.preventDefault();
        window.activation[name].actions++;
      });
    }
    const promoted = await promoteButton(document.getElementById('source'), theme);
    promoted.id = 'promoted';
    const imperative = await interactiveButton(theme, {
      label: 'Imperative action',
      onClick: () => {
        window.activation.imperative.clicks++;
        window.activation.imperative.actions++;
      },
    });
    imperative.id = 'imperative';
    document.getElementById('imperative-wrap').append(imperative);
  }, root);
  // Ensure these cases actually exercise a themed face, rather than silently
  // passing through the native fallback whose behavior supplies the baseline.
  await page.locator('#promoted canvas').waitFor();
  await page.locator('#imperative canvas').waitFor();
  return page;
}

for (const gesture of ['left', 'right', 'middle', 'Space', 'Enter']) {
  test(`${gesture}: themed primary action agrees with native button`, async t => {
    const page = await fixture(t);
    for (const id of ['native', 'promoted', 'imperative']) {
      const target = page.locator(`#${id}`);
      if (gesture === 'Space' || gesture === 'Enter') {
        await target.focus();
        await page.keyboard.press(gesture);
      } else {
        await target.click({ button: gesture });
      }
    }
    const actual = await page.evaluate(() => window.activation);
    const count = gesture === 'right' || gesture === 'middle' ? 0 : 1;
    const expected = { clicks: count, actions: count };
    assert.deepEqual(actual.native, expected, 'native browser baseline must validate the expected action');
    assert.deepEqual({ promoted: actual.promoted, imperative: actual.imperative },
      { promoted: expected, imperative: expected },
      'both public button surfaces must preserve primary activation');
  });
}
