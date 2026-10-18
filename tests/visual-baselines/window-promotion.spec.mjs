// Real-browser regression for asynchronous promotion: the source must remain
// readable and in flow until its prepared chrome can replace it atomically.
// Uses the optional Playwright setup documented in this directory's README.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createServer as createPortReservation } from 'node:net';

let server, browser, base;
const root = fileURLToPath(new URL('../..', import.meta.url));
test.before(async () => {
  // Vite 7 treats port: 0 as its default port. Reserve an OS-assigned port
  // first, then fail safely if another process takes it before Vite listens.
  const reservation = createPortReservation();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.close());
  await page.route('**/__promotion_test', (route) => route.fulfill({ contentType: 'text/html', body: `
    <style>
      body { margin: 16px; }
      .source { width: 300px; padding: 12px; color: rgb(34, 51, 68); --consumer-token: preserved; }
      .source p { margin: 0; height: 90px; }
    </style>
    <article id="source" class="source" data-scriptoscope-title="Promotion">
      <p>Readable while the chrome prepares.</p><input value="kept selection"><button>Keep listener</button>
    </article><div id="sibling">Following content</div><input id="outside">
  ` }));
  await page.goto(`${base}__promotion_test`);
  await page.evaluate(async (root) => {
    const [{ ScriptoscopeWindow }, { WindowManager }, { loadTheme }] = await Promise.all([
      import(`/@fs${root}/src/declarative/ScriptoscopeWindow.ts`),
      import(`/@fs${root}/src/interactive.ts`),
      import(`/@fs${root}/src/loadTheme.ts`),
    ]);
    const source = document.getElementById('source');
    const input = source.querySelector('input');
    const button = source.querySelector('button');
    const theme = await loadTheme('/themes/1138', { source: 'scheme.rsrc' });
    const manager = new WindowManager();
    window.fixture = { ScriptoscopeWindow, manager, theme, source, input, button, clicks: 0 };
    button.addEventListener('click', () => window.fixture.clicks++);
  }, root);
  return page;
}

test('keeps live content, layout, and current focus until an atomic commit', async (t) => {
  const page = await fixture(t);
  const before = await page.evaluate(() => {
    const f = window.fixture;
    const add = f.manager.add.bind(f.manager);
    f.manager.add = async (...args) => {
      await new Promise((resolve) => { f.release = resolve; });
      return add(...args);
    };
    f.input.focus(); f.input.setSelectionRange(2, 7);
    const result = { top: document.getElementById('sibling').getBoundingClientRect().top,
      color: getComputedStyle(f.input).color };
    f.pending = f.ScriptoscopeWindow.promote(f.source, f);
    return result;
  });
  const pending = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const f = window.fixture;
    // User edits during preparation must be kept too.
    f.input.value = 'edited while preparing'; f.input.setSelectionRange(3, 8);
    f.button.click();
    return { top: document.getElementById('sibling').getBoundingClientRect().top,
      connected: f.input.isConnected, focused: document.activeElement === f.input,
      parent: f.input.parentNode === f.source, color: getComputedStyle(f.input).color };
  });
  assert.deepEqual(pending, { top: before.top, connected: true, focused: true, parent: true, color: before.color });
  const committed = await page.evaluate(async () => {
    const f = window.fixture; f.release(); f.window = await f.pending;
    f.button.click();
    return { sameInput: f.window.host.querySelector('input') === f.input,
      focused: document.activeElement === f.input, selection: [f.input.selectionStart, f.input.selectionEnd],
      value: f.input.value, clicks: f.clicks, color: getComputedStyle(f.input).color,
      token: getComputedStyle(f.input).getPropertyValue('--consumer-token').trim(),
      position: getComputedStyle(f.window.host).position, sourceConnected: f.source.isConnected };
  });
  assert.deepEqual(committed, { sameInput: true, focused: true, selection: [3, 8],
    value: 'edited while preparing', clicks: 2, color: before.color, token: 'preserved',
    position: 'static', sourceConnected: false });
  const restored = await page.evaluate(() => {
    const f = window.fixture; f.window.unmount();
    return { sameInput: f.source.querySelector('input') === f.input,
      focused: document.activeElement === f.input, connected: f.source.isConnected,
      followedBySibling: f.source.nextElementSibling.id === 'sibling',
      promoted: f.source.hasAttribute('data-scriptoscope-promoted') };
  });
  assert.deepEqual(restored, { sameInput: true, focused: true, connected: true, followedBySibling: true, promoted: false });
});

test('failed first render leaves the original DOM intact and the manager retryable', async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(async () => {
    const f = window.fixture;
    const render = f.manager.render;
    let failedHost;
    f.manager.render = async (entry) => {
      failedHost = entry.host;
      await new Promise(requestAnimationFrame);
      throw new Error('deliberate chrome decode failure');
    };
    f.input.focus();
    let message;
    try { await f.ScriptoscopeWindow.promote(f.source, f); } catch (error) { message = error.message; }
    const failure = { message, connected: f.input.isConnected,
      focused: document.activeElement === f.input, parent: f.input.parentNode === f.source,
      promoted: f.source.hasAttribute('data-scriptoscope-promoted'),
      registered: f.manager.describe(failedHost) !== null };
    f.manager.render = render;
    const promoted = await f.ScriptoscopeWindow.promote(f.source, f);
    const retried = promoted.host.querySelector('input') === f.input;
    promoted.unmount();
    return { failure, retried };
  });
  assert.deepEqual(result, { failure: { message: 'deliberate chrome decode failure', connected: true,
    focused: true, parent: true, promoted: false, registered: false }, retried: true });
});

test('failed content-fit render rolls back committed content without a close event', async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(async () => {
    const f = window.fixture;
    f.source.style.display = 'none'; // no natural rect: exercise the second render
    let closes = 0;
    document.addEventListener('scriptoscope:close', () => closes++);
    let failedHost;
    f.manager.setContentSize = async (host) => { failedHost = host; throw new Error('fit failed'); };
    let message;
    try { await f.ScriptoscopeWindow.promote(f.source, f); } catch (error) { message = error.message; }
    f.button.click();
    return { message, closes, sameInput: f.source.querySelector('input') === f.input,
      connected: f.source.isConnected, style: f.source.style.display,
      followedBySibling: f.source.nextElementSibling.id === 'sibling',
      promoted: f.source.hasAttribute('data-scriptoscope-promoted'),
      registered: f.manager.describe(failedHost) !== null, clicks: f.clicks };
  });
  assert.deepEqual(result, { message: 'fit failed', closes: 0, sameInput: true, connected: true,
    style: 'none', followedBySibling: true, promoted: false, registered: false, clicks: 1 });
});
