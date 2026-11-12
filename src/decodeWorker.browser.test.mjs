// Real-browser check of the opt-in decode worker against the BUILT package files
// (dist/scriptoscope.js + dist/decode-worker.js) and every bundled theme archive.
// It needs a browser and a build, so the pure-Node `npm test` skips it:
//
//   npm run build && SCRIPTOSCOPE_DECODE_WORKER_BROWSER=1 node --test src/decodeWorker.browser.test.mjs
//
// The Node counterpart (same codec over a MessageChannel) is
// tools/theme-loader/decodeWorker.test.mjs and always runs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const enabled = process.env.SCRIPTOSCOPE_DECODE_WORKER_BROWSER === '1';
const root = fileURLToPath(new URL('..', import.meta.url));

async function bundledThemes() {
  const themes = [];
  for (const slug of (await readdir(join(root, 'themes'))).sort()) {
    for (const file of ['scheme.sit', 'scheme.rsrc']) {
      if (await stat(join(root, 'themes', slug, file)).then(entry => entry.isFile(), () => false)) { themes.push({ slug, file }); break; }
    }
  }
  return themes;
}

/** Serve only the built package, the theme archives and the comparison helper. */
async function serve() {
  const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html' };
  const allowed = [join(root, 'dist') + sep, join(root, 'themes') + sep, join(root, 'tests/helpers/canonical-graph.mjs')];
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>decode worker</title>'); return; }
    const file = resolve(root, `.${path}`);
    if (!allowed.some(prefix => file === prefix || file.startsWith(prefix)) || !await stat(file).then(entry => entry.isFile(), () => false)) {
      response.writeHead(404); response.end(); return;
    }
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) };
}

test('decode worker in Chromium: identical results, failures, concurrency and disposal', { skip: !enabled && 'set SCRIPTOSCOPE_DECODE_WORKER_BROWSER=1 after npm run build' }, async t => {
  assert.ok(await stat(join(root, 'dist/decode-worker.js')).then(entry => entry.isFile(), () => false), 'run npm run build first');
  const { chromium } = await import('@playwright/test');
  const themes = await bundledThemes();
  assert.ok(themes.length >= 18);
  const site = await serve();
  const browser = await chromium.launch();
  t.after(async () => { await browser.close(); await site.close(); });
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
  await page.goto(site.origin);
  await page.evaluate(async () => {
    window.unhandled = [];
    addEventListener('unhandledrejection', event => window.unhandled.push(String(event.reason?.message ?? event.reason)));
    window.api = await import('/dist/scriptoscope.js');
    Object.assign(window, await import('/tests/helpers/canonical-graph.mjs'));
    window.newWorker = () => new Worker('/dist/decode-worker.js', { type: 'module' });
    /** Count the requests the loader sends to a worker without changing them. */
    window.counted = worker => {
      const post = worker.postMessage.bind(worker);
      worker.sent = [];
      worker.postMessage = (message, transfer) => { worker.sent.push(message.type); post(message, transfer); };
      return worker;
    };
    window.fetchBytes = async url => new Uint8Array(await (await fetch(url)).arrayBuffer());
    window.outcome = promise => promise.then(() => ({ resolved: true }), error => ({ name: error?.name, message: error?.message, code: error?.code, type: error?.constructor?.name }));
  });

  await t.test('every bundled theme: raw, owned and encoded loads match the main thread byte for byte', async () => {
    const report = await page.evaluate(async themes => {
      const worker = counted(newWorker());
      const readUrl = fetchBytes;
      const canonical = (value, extra = {}) => {
        const loadId = value.byteProvenance?.loadId ?? value.source?.byteProvenance?.loadId;
        return canonicalGraph(value, { mask: loadId ? [loadId] : [], ...extra });
      };
      /** Export and digest every image an owned theme can serve. */
      const ownedImages = async theme => {
        const refs = new Set(), seen = new Set();
        (function collect(value) {
          if (typeof value === 'string') { if (/\.png$/.test(value)) refs.add(value); return; }
          if (!value || typeof value !== 'object' || seen.has(value) || ArrayBuffer.isView(value)) return;
          seen.add(value);
          for (const child of Object.values(value)) collect(child);
        })(theme.source);
        const images = [];
        for (const ref of [...refs].sort()) images.push([ref, await theme.imageUrl(ref).catch(error => `rejected: ${error.message}`)]);
        return images;
      };
      const totals = { themes: 0, typedArrays: 0, bytes: 0, blobUrls: 0, ownedImages: 0, mismatches: [], foreign: [] };
      const inputs = await Promise.all(themes.map(async ({ slug, file }) => ({ slug, file, bytes: await fetchBytes(`/themes/${slug}/${file}`) })));
      const modes = {
        raw: (bytes, options) => api.loadKaleidoscopeScheme(bytes, { ...options, provenance: true, encodeAssets: false }),
        owned: (bytes, options) => api.loadOwnedKaleidoscopeScheme(bytes, { ...options, provenance: true }),
        encoded: (bytes, options) => api.loadKaleidoscopeScheme(bytes, options),
      };
      for (const [mode, load] of Object.entries(modes)) {
        const options = ({ slug, file }) => ({ meta: { name: slug, author: { name: 'fixture' } }, source: `${slug}/${file}` });
        // Worker loads run concurrently over the one worker; main-thread loads one by one.
        const offThread = await Promise.all(inputs.map(input => load(input.bytes, { ...options(input), decodeWorker: worker })));
        for (const [index, input] of inputs.entries()) {
          const main = await load(input.bytes, options(input)), off = offThread[index];
          const describe = async theme => {
            const graph = await canonical(theme, mode === 'encoded' ? { readUrl } : {});
            const images = mode === 'owned' ? await canonical(await ownedImages(theme), { readUrl }) : null;
            return { graph, images };
          };
          const a = await describe(main), b = await describe(off);
          totals.themes++; totals.typedArrays += a.graph.typedArrays; totals.bytes += a.graph.bytes;
          totals.blobUrls += a.graph.urls; totals.ownedImages += a.images?.urls ?? 0;
          totals.foreign.push(...a.graph.foreign);
          const difference = firstDifference(a.graph.text, b.graph.text) ?? (a.images && firstDifference(a.images.text, b.images.text));
          if (difference) totals.mismatches.push({ slug: input.slug, mode, difference });
          if (input.bytes.byteLength === 0) totals.mismatches.push({ slug: input.slug, mode, difference: 'caller bytes were detached' });
          main.dispose?.(); off.dispose?.();
        }
      }
      totals.sent = worker.sent.length;
      worker.terminate();
      return totals;
    }, themes);
    assert.deepEqual(report.mismatches, []);
    assert.deepEqual(report.foreign, []);
    assert.equal(report.themes, themes.length * 3);
    assert.equal(report.sent, themes.length * 3, 'every worker-option load was decoded in the worker');
    assert.ok(report.typedArrays > 5000 && report.bytes > 10_000_000, JSON.stringify(report));
    assert.ok(report.blobUrls > 5000 && report.ownedImages > 5000, JSON.stringify(report));
    t.diagnostic(`compared ${report.themes} loads: ${report.typedArrays} typed arrays (${report.bytes} bytes), ${report.blobUrls} encoded images, ${report.ownedImages} owned image exports`);
  });

  await t.test('URL loaders and resolvers pass the worker on; the main thread never loads the StuffIt decoder', async () => {
    const report = await page.evaluate(async () => {
      const worker = counted(newWorker());
      const main = await api.loadOwnedTheme('/themes/windows-95'), off = await api.loadOwnedTheme('/themes/windows-95', { decodeWorker: worker });
      const same = firstDifference((await canonicalGraph(main)).text, (await canonicalGraph(off)).text);
      const resolver = api.createOwnedThemeResolver({ themeBaseUrl: '/themes', decodeWorker: () => worker,
        themes: [{ slug: 'beos-r503', source: 'scheme.sit' }, { slug: '1138', source: 'scheme.rsrc' }] });
      const loaded = await Promise.all(['beos-r503', '1138', 'beos-r503'].map(slug => resolver.load(slug)));
      const legacy = api.createThemeResolver({ themeBaseUrl: '/themes', decodeWorker: worker });
      const encoded = await legacy.load('platinum-8');
      const result = { same, sent: [...worker.sent], origins: loaded.map(theme => theme.origin), cached: loaded[0] === loaded[2],
        encodedAsset: Object.values(encoded.manifest.chromeElements)[0].asset.slice(0, 5) };
      resolver.dispose(); legacy.dispose(); main.dispose(); off.dispose(); worker.terminate();
      return result;
    });
    assert.equal(report.same, null);
    assert.deepEqual(report.sent, ['prewarm', 'decode', 'prewarm', 'decode', 'decode', 'prewarm', 'decode']);
    assert.deepEqual(report.origins, ['/themes/beos-r503', '/themes/1138', '/themes/beos-r503']);
    assert.ok(report.cached);
    assert.equal(report.encodedAsset, 'blob:');

    // A fresh page, so the module requests are attributable: the lazy decoder chunk
    // is whatever a main-thread archive load adds after a worker archive load.
    const fresh = await browser.newPage();
    const scripts = [];
    fresh.on('request', request => { if (/\.js$/.test(new URL(request.url()).pathname)) scripts.push(new URL(request.url()).pathname); });
    await fresh.goto(site.origin);
    await fresh.evaluate(async () => {
      window.api = await import('/dist/scriptoscope.js');
      const worker = new Worker('/dist/decode-worker.js', { type: 'module' });
      (await window.api.loadOwnedTheme('/themes/beos-r503', { decodeWorker: worker })).dispose();
      worker.terminate();
    });
    const withWorker = [...scripts];
    await fresh.evaluate(async () => { (await window.api.loadOwnedTheme('/themes/beos-r503')).dispose(); });
    const decoderChunks = scripts.filter(path => !withWorker.includes(path));
    await fresh.close();
    assert.ok(withWorker.includes('/dist/decode-worker.js'));
    assert.equal(decoderChunks.length, 1, `the main-thread load adds exactly the lazy decoder chunk: ${JSON.stringify(scripts)}`);
  });

  await t.test('the worker instantiates the StuffIt decoder once', async () => {
    const report = await page.evaluate(async themes => {
      const blob = code => URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      const probe = blob(`let count = 0;
        for (const name of ['instantiate', 'instantiateStreaming']) {
          const original = WebAssembly[name];
          WebAssembly[name] = function (...args) { return original.apply(this, args).then(result => { count++; return result; }); };
        }
        addEventListener('message', event => { if (event.data === 'wasm-count') postMessage({ wasmInstantiations: count }); });`);
      const worker = new Worker(blob(`import ${JSON.stringify(probe)}; import ${JSON.stringify(new URL('/dist/decode-worker.js', location.href).href)};`), { type: 'module' });
      const archives = themes.filter(theme => theme.file === 'scheme.sit').slice(0, 5);
      const loaded = await Promise.all(archives.map(async ({ slug }) =>
        api.loadOwnedTheme(`/themes/${slug}`, { source: 'scheme.sit', decodeWorker: worker })));
      const count = await new Promise(resolve => {
        worker.addEventListener('message', event => { if (event.data?.wasmInstantiations !== undefined) resolve(event.data.wasmInstantiations); });
        worker.postMessage('wasm-count');
      });
      for (const theme of loaded) theme.dispose();
      worker.terminate();
      return { count, archives: archives.length };
    }, themes);
    assert.equal(report.archives, 5);
    assert.equal(report.count, 1, 'five prewarms and five archive decodes share one WASM instance');
  });

  await t.test('non-cloneable options decode on the main thread; bad archives reject as on the main thread', async () => {
    const report = await page.evaluate(async () => {
      const worker = counted(newWorker());
      const bytes = await fetchBytes('/themes/1138/scheme.rsrc');
      const channel = Array.from({ length: 256 }, (_, i) => i);
      const fallbacks = {};
      const meta = { name: 'x', onLoad() {} };
      const viaMeta = await api.loadOwnedKaleidoscopeScheme(bytes, { meta, decodeWorker: worker });
      fallbacks.functionMeta = worker.sent.length; viaMeta.dispose();
      const environment = await api.prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'theme', complete: true }] });
      const main = await api.loadKaleidoscopeScheme(bytes, { cinfEnvironment: environment, encodeAssets: false });
      const withWorker = await api.loadKaleidoscopeScheme(bytes, { cinfEnvironment: environment, encodeAssets: false, decodeWorker: worker });
      fallbacks.cinfEnvironment = worker.sent.length;
      fallbacks.cinfSame = firstDifference((await canonicalGraph(main)).text, (await canonicalGraph(withWorker)).text);
      fallbacks.profile = await outcome(api.loadKaleidoscopeScheme(bytes, { displayProfile: { id: 'display-profile:forged', data: { producer: { channels: [channel, channel, channel] } } }, decodeWorker: worker }));
      fallbacks.afterProfile = worker.sent.length;
      const errors = {};
      const sit = await fetchBytes('/themes/1984/scheme.sit');
      const fixtures = { random: Uint8Array.from({ length: 512 }, (_, i) => (i * 37 + 11) & 255), truncatedArchive: sit.slice(0, sit.length >> 1),
        truncatedFork: bytes.slice(0, 4096), empty: new Uint8Array(0) };
      for (const [label, input] of Object.entries(fixtures)) {
        errors[label] = [await outcome(api.loadOwnedKaleidoscopeScheme(input)), await outcome(api.loadOwnedKaleidoscopeScheme(input, { decodeWorker: worker }))];
      }
      worker.terminate();
      return { fallbacks, errors };
    });
    assert.deepEqual({ ...report.fallbacks, profile: undefined }, { functionMeta: 0, cinfEnvironment: 0, cinfSame: null, afterProfile: 0, profile: undefined });
    assert.equal(report.fallbacks.profile.name, 'DisplayProfileError');
    for (const [label, [main, off]] of Object.entries(report.errors)) {
      assert.equal(main.resolved, undefined, label);
      assert.deepEqual(off, main, label);
    }
  });

  await t.test('a worker that fails to start, crashes or stops answering rejects its loads', async () => {
    const report = await page.evaluate(async () => {
      const bytes = await fetchBytes('/themes/1138/scheme.rsrc');
      const load = (decodeWorker, extra = {}) => outcome(api.loadOwnedKaleidoscopeScheme(bytes, { decodeWorker, ...extra }));
      const missing = new Worker('/dist/no-such-worker.js', { type: 'module' });
      const startFailure = await Promise.all([load(missing), load(missing)]);
      const afterFailure = await load(missing);
      const throwing = new Worker(URL.createObjectURL(new Blob(['addEventListener("message", () => { throw new Error("worker handler exploded"); });'], { type: 'text/javascript' })));
      const crash = await load(throwing);
      const stopped = newWorker();
      const first = await load(stopped);
      stopped.terminate();
      const started = performance.now();
      const silent = await load(stopped, { decodeWorkerTimeoutMs: 250 });
      const waited = performance.now() - started;
      missing.terminate(); throwing.terminate();
      return { startFailure, afterFailure, crash, first, silent, waited, unhandled: window.unhandled };
    });
    for (const failure of [...report.startFailure, report.afterFailure, report.crash, report.silent]) {
      assert.equal(failure.code, 'DECODE_WORKER_FAILED', JSON.stringify(failure));
      assert.match(failure.message, /^Scriptoscope decode worker failed: /);
    }
    assert.match(report.crash.message, /worker handler exploded/);
    assert.deepEqual(report.first, { resolved: true });
    assert.equal(report.silent.message, 'Scriptoscope decode worker failed: no response within 250 ms');
    assert.ok(report.waited >= 240 && report.waited < 5000, `waited ${report.waited} ms`);
    assert.deepEqual(report.unhandled, []);
  });

  await t.test('disposing a resolver during a worker decode rejects the load and releases its result', async () => {
    const report = await page.evaluate(async () => {
      const run = async decodeWorker => {
        const resolver = api.createOwnedThemeResolver({ themeBaseUrl: '/themes', themes: [{ slug: 'beos-r503', source: 'scheme.sit' }], ...(decodeWorker ? { decodeWorker } : {}) });
        const pending = outcome(resolver.load('beos-r503'));
        resolver.dispose();
        return [await pending, await outcome(resolver.load('beos-r503'))];
      };
      const worker = counted(newWorker());
      const main = await run(), off = await run(worker);
      // The worker is still the caller's and still usable afterwards.
      const reused = await outcome(api.loadOwnedTheme('/themes/beos-r503', { decodeWorker: worker }).then(theme => theme.dispose()));
      const sent = [...worker.sent];
      worker.terminate();
      return { main, off, reused, sent, unhandled: window.unhandled };
    });
    assert.deepEqual(report.main.map(result => result.message), ['ThemeResolver: disposed', 'ThemeResolver: disposed']);
    assert.deepEqual(report.off, report.main);
    assert.deepEqual(report.reused, { resolved: true });
    assert.deepEqual(report.sent, ['prewarm', 'decode', 'prewarm', 'decode']);
    assert.deepEqual(report.unhandled, []);
  });

  // The start-failure and crash cases above are reported to the console by the browser itself.
  assert.deepEqual(problems.filter(problem => !/no-such-worker|worker handler exploded|Failed to load resource|MIME type/.test(problem)), []);
});
