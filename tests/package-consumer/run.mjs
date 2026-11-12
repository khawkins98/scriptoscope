import { parsePackResult } from '../../scripts/npm-pack-result.mjs';
import { rootExports, rendererExports, declarativeExports, sharedHostExports } from './fixture/public-exports.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium, expect } from '@playwright/test';
import { gitIdentity } from '../rendering-requirements/execution.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = resolve(process.env.SCRIPTOSCOPE_PACKAGE_EVIDENCE ?? join(root, 'test-results/rendering-evidence/package-consumer'));
const workspace = await realpath(await mkdtemp(join(tmpdir(), 'scriptoscope-package-')));
const require = createRequire(import.meta.url);
const compilerLib = await realpath(dirname(require.resolve('typescript')));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
assert(process.argv.length === 2 || (process.argv.length === 4 && process.argv[2] === '--tarball'),
  'Usage: node tests/package-consumer/run.mjs [--tarball /path/to/package.tgz]');
const suppliedTarball = process.argv[3] ? resolve(process.argv[3]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (parent, path) => { const part = relative(parent, path); return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part)); };
const command = (program, args, cwd, env = process.env) => execFileSync(program, args, { cwd, env, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, server;
const record = { schema: 1, evidence: 'packed-consumer-execution', ...gitIdentity(root), complete: false, historicalFidelity: 'not assessed',
  toolchain: { node: process.version, typescript: require('typescript').version, vite: require('vite/package.json').version }, negativeCases: [] };

async function siteFiles(directory, base = directory) {
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    if ((await stat(path)).isDirectory()) files.push(...await siteFiles(path, base));
    else { const bytes = await readFile(path); files.push({ path: relative(base, path), bytes: bytes.length, sha256: sha(bytes) }); }
  }
  return files;
}

async function checkContents(installed) {
  const files = await siteFiles(installed);
  const allowed = /^(?:package\.json|README\.md|CHANGELOG\.md|LICENSE|THIRD_PARTY_NOTICES|docs\/npm-consumer\.md|examples\/npm\/(?:index\.html|main\.ts|package\.json|tsconfig\.json|vite\.config\.js|fetch-theme\.mjs)|dist\/[^/]+\.js(?:\.map)?|dist\/scriptoscope\.css|dist\/types\/.+\.d\.ts|dist\/tools\/theme-loader\/[^/]+\.d\.ts)$/;
  for (const { path } of files) assert(allowed.test(path), `Unexpected packed file: ${path}`);
  const notices = await readFile(join(installed, 'THIRD_PARTY_NOTICES'), 'utf8');
  const munboxLicense = await readFile(join(root, 'tools/sit-wasm/munbox/LICENSE'), 'utf8');
  assert(notices.includes(munboxLicense.trim()), 'THIRD_PARTY_NOTICES must contain the full bundled munbox license');
  for (const path of ['README.md', 'docs/npm-consumer.md']) {
    const markdown = await readFile(join(installed, path), 'utf8');
    for (const [, href] of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(href) || href.startsWith('#')) continue;
      const target = resolve(installed, dirname(path), href.split('#')[0]);
      assert(inside(installed, target), `Packed documentation link escapes package: ${path}: ${href}`);
      assert((await stat(target)).isFile() || (await stat(target)).isDirectory(), `Broken packed documentation link: ${path}: ${href}`);
    }
  }
  for (const path of ['index.html', 'main.ts', 'package.json', 'tsconfig.json', 'vite.config.js', 'fetch-theme.mjs']) {
    assert((await stat(join(installed, 'examples/npm', path))).isFile(), `Missing shipped example: ${path}`);
  }
  return files;
}

async function prepareConsumer(tarball, name, example = false) {
  const consumer = join(workspace, name);
  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: `consumer-${name}`, private: true, type: 'module' }));
  command(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', tarball], consumer);
  const installed = await realpath(join(consumer, 'node_modules/@khawkins98/scriptoscope'));
  assert(inside(consumer, installed), 'The installed package must not be a repository symlink');
  await cp(example ? join(installed, 'examples/npm') : new URL('./fixture/', import.meta.url), consumer, {
    recursive: true, filter: source => !example || !source.endsWith('/package.json'),
  });
  // Use the installed package's import-condition exports, not Node require's
  // different condition set, and verify actual files rather than resolution alone.
  let phase = 'exports';
  try {
    const specifiers = ['@khawkins98/scriptoscope', '@khawkins98/scriptoscope/renderer', '@khawkins98/scriptoscope/declarative', '@khawkins98/scriptoscope/decode-worker', '@khawkins98/scriptoscope/scriptoscope.css', '@khawkins98/scriptoscope/package.json'];
    const paths = JSON.parse(command(process.execPath, ['--input-type=module', '-e',
      `console.log(JSON.stringify(${JSON.stringify(specifiers)}.map(id => import.meta.resolve(id))))`], consumer));
    for (const [index, url] of paths.entries()) {
      const path = await realpath(fileURLToPath(url));
      assert(inside(installed, path), `${specifiers[index]} resolved outside the installed tarball`);
      assert((await stat(path)).isFile(), `Missing packed export: ${specifiers[index]}`);
    }
    command(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import * as root from '@khawkins98/scriptoscope';
      import * as renderer from '@khawkins98/scriptoscope/renderer';
      import * as declarative from '@khawkins98/scriptoscope/declarative';
      assert.deepEqual(Object.keys(root).sort(), ${JSON.stringify(rootExports)});
      assert.deepEqual(Object.keys(renderer).sort(), ${JSON.stringify(rendererExports)});
      assert.deepEqual(Object.keys(declarative).sort(), ${JSON.stringify(declarativeExports)});
      for (const key of ${JSON.stringify(sharedHostExports)}) assert.equal(declarative[key], root[key], key);
      for (const entry of [root, declarative]) for (const name of ['mountDeclarative', 'mountOwnedDeclarative']) assert.equal(name in entry, false);
      for (const [key, value] of Object.entries(renderer)) assert.equal(value, root[key], key);
      assert.equal(await import('@khawkins98/scriptoscope/renderer'), renderer);
    `], consumer);
    phase = 'contents';
    const files = await checkContents(installed);
    phase = 'types';
    // Deliberately do not skip library checking: repository compilation can hide
    // declaration references to files omitted from npm's files whitelist.
    await writeFile(join(consumer, 'env.d.ts'), 'interface ImportMeta { readonly env: { readonly BASE_URL: string } }\n');
    const typeFiles = [];
    for (const mode of ['Bundler', 'NodeNext']) {
      await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        target: 'ES2022', module: mode === 'NodeNext' ? 'NodeNext' : 'ESNext', moduleResolution: mode, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        strict: true, skipLibCheck: false, noEmit: true, types: [],
      }, files: ['main.ts', 'env.d.ts'] }));
      typeFiles.push(...command(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json'), '--listFiles', '--pretty', 'false'], consumer).trim().split('\n').map(file => file.trim()));
    }
    for (const file of typeFiles) {
      const path = await realpath(file.trim());
      const standardLib = inside(compilerLib, path) && /^lib\..+\.d\.ts$/.test(relative(compilerLib, path));
      assert(inside(consumer, path) || standardLib, `Declaration import escaped the installed consumer: ${path}`);
    }
    return { consumer, installed, files, typeFiles: [...new Set(typeFiles)].map(file => inside(compilerLib, file) ? `typescript/lib/${relative(compilerLib, file)}` : relative(consumer, file)),
      exports: specifiers.map((specifier, index) => ({ specifier, path: relative(installed, fileURLToPath(paths[index])) })) };
  } catch (error) { error.phase = phase; throw error; }
}

async function bundleConsumer(prepared, outDir, base = '/consumer/') {
  const modules = [];
  try {
    const result = await build({ configFile: false, envFile: false, root: prepared.consumer, publicDir: false,
      base, logLevel: 'silent',
      plugins: [{ name: 'packed-only-module-graph', generateBundle() {
        for (const id of this.getModuleIds()) {
          if (id.startsWith('\0')) continue; // Vite/Rollup generated modules.
          const path = resolve(id.split('?')[0]);
          assert(inside(prepared.consumer, path), `Consumer bundle imported outside its installation: ${id}`);
          modules.push(relative(prepared.consumer, path));
        }
      } }],
      build: { outDir, emptyOutDir: true, sourcemap: false, minify: true, target: 'es2022' },
    });
    const chunks = (Array.isArray(result) ? result : [result]).flatMap(item => item.output).filter(item => item.type === 'chunk');
    const dynamicImports = [...new Set(chunks.flatMap(chunk => chunk.dynamicImports))];
    assert(dynamicImports.length > 0, 'The consumer must retain the actual lazy archive decoder');
    return { modules: modules.sort(), dynamicImports };
  } catch (error) { error.phase = 'bundle'; throw error; }
}

async function negativeTarball(original, file, expectedPhase, name, mutate, failureNeedle = file.split('/').at(-1)) {
  const unpack = join(workspace, `unpack-${name}`);
  await mkdir(unpack);
  command('tar', ['-xzf', original, '-C', unpack], workspace);
  const changed = join(unpack, 'package', file);
  assert((await stat(changed)).isFile(), `Negative fixture did not exist: ${file}`);
  if (mutate) await writeFile(changed, mutate(await readFile(changed, 'utf8')));
  else await rm(changed);
  const tarball = join(workspace, `${name}.tgz`);
  // macOS tar otherwise adds AppleDouble metadata files to the defective copy.
  command('tar', ['-czf', tarball, '-C', unpack, 'package'], workspace, { ...process.env, COPYFILE_DISABLE: '1' });
  let failure;
  try {
    const prepared = await prepareConsumer(tarball, name);
    await bundleConsumer(prepared, join(workspace, `out-${name}`));
  } catch (error) { failure = error; }
  assert(failure, `The defective packed ${file} unexpectedly passed`);
  assert.equal(failure.phase, expectedPhase, `The negative must fail at ${expectedPhase}, not an unrelated phase`);
  const message = `${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`;
  assert(message.includes(failureNeedle), `The failure must identify ${failureNeedle}: ${message}`);
  record.negativeCases.push({ file, defect: mutate ? 'external-declaration-import' : 'missing-file', expectedPhase, rejected: true, message });
  console.log(`Rejected defective packed ${file} at ${expectedPhase}.`);
}

try {
  await mkdir(output, { recursive: true });
  // The publisher can supply the exact candidate instead of rebuilding/repacking.
  let tarball;
  if (suppliedTarball) {
    tarball = join(workspace, 'candidate.tgz');
    await copyFile(suppliedTarball, tarball);
  } else {
    const packed = parsePackResult(command(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', workspace], root));
    tarball = join(workspace, packed.filename);
    // Simulate stale demo/loader output and a consumer's downloaded sample.
    // Packing must be unaffected; clean CI alone would not catch a broad files list.
    const probeName = `package-boundary-${workspace.split(sep).at(-1)}.txt`;
    const probes = ['dist/demo', 'dist/pages-loader', 'examples/npm/public/themes'].map(path => join(root, path, probeName));
    try {
      for (const path of probes) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, 'not package content\n', { flag: 'wx' }); }
      const withGeneratedAssets = parsePackResult(command(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], root));
      assert.deepEqual(withGeneratedAssets.files, packed.files, 'Generated demo/loader/theme assets leaked into the package');
      assert.equal(withGeneratedAssets.integrity, packed.integrity, 'Generated output changed the tarball bytes');
      record.packHistoryIsolation = { excluded: probes.map(path => relative(root, path)), identicalIntegrity: true };
    } finally { for (const path of probes) await rm(path, { force: true }); }
  }
  const prepared = await prepareConsumer(tarball, 'positive');
  const packed = JSON.parse(await readFile(join(prepared.installed, 'package.json'), 'utf8'));
  const packageBytes = await readFile(tarball);
  record.package = { name: packed.name, version: packed.version, sha256: sha(packageBytes),
    integrity: `sha512-${createHash('sha512').update(packageBytes).digest('base64')}`, files: prepared.files, supplied: !!suppliedTarball };
  record.exports = prepared.exports;
  record.typeFiles = prepared.typeFiles;
  const site = join(workspace, 'site');
  const publicRoot = join(site, 'consumer');
  record.bundle = await bundleConsumer(prepared, publicRoot);
  const example = await prepareConsumer(tarball, 'documented-example', true);
  const exampleRoot = join(site, 'nested');
  record.example = { bundle: await bundleConsumer(example, exampleRoot, '/nested/'), typeFiles: example.typeFiles };
  const exampleTheme = join(exampleRoot, 'themes/scriptoscope');
  await mkdir(exampleTheme, { recursive: true });
  // Offline CI must exercise the same bytes as the documented pinned download,
  // not a newer authored theme that could conceal an example compatibility failure.
  const samplePins = {
    'scheme.rsrc': '7a56bf429f21f26dc63ce19c7bf1ac19787dcd317a2f1398e7b58b033fc89eb7',
    'meta.json': '6d9c83d0a7a55e5a3ef89a0c945fb49a60853636b9dc760614b6a92c79fd8c80',
  };
  for (const [file, digest] of Object.entries(samplePins)) {
    const source = join(root, 'authoring/schemes/scriptoscope', file);
    assert.equal(sha(await readFile(source)), digest, `Sample ${file} differs from the pinned download; update the example revision and fixture pins together`);
    await copyFile(source, join(exampleTheme, file));
  }
  record.example.themeInputs = samplePins;
  record.example.siteFiles = await siteFiles(exampleRoot);
  await rm(example.consumer, { recursive: true, force: true });
  const themeDir = join(publicRoot, 'themes/windows-95');
  await mkdir(themeDir, { recursive: true });
  for (const file of ['scheme.sit', 'meta.json']) await copyFile(join(root, 'themes/windows-95', file), join(themeDir, file));
  record.archiveSha256 = sha(await readFile(join(themeDir, 'scheme.sit')));
  // A no-wnd# (built-in frame) scheme: its window chrome comes from a lazily
  // imported compositor chunk that the windows-95 path never requests.
  const builtInDir = join(publicRoot, 'themes/platinum-8');
  await mkdir(builtInDir, { recursive: true });
  for (const file of ['scheme.sit', 'meta.json']) await copyFile(join(root, 'themes/platinum-8', file), join(builtInDir, file));
  record.builtInFrame = { slug: 'platinum-8', archiveSha256: sha(await readFile(join(builtInDir, 'scheme.sit'))) };
  record.siteFiles = await siteFiles(publicRoot);
  // Remove installed inputs before the browser starts. The static server has
  // access only to the completed production site and copied original input.
  await rm(prepared.consumer, { recursive: true, force: true });
  record.buildInputsRemoved = true;
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  server = createServer(async (request, response) => {
    try {
      const path = resolve(site, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
      assert(inside(site, path));
      const file = (await stat(path)).isDirectory() ? join(path, 'index.html') : path;
      assert((await stat(file)).isFile());
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      createReadStream(file).pipe(response);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const network = [], errors = [];
  record.network = network; record.browserErrors = errors;
  browser = await chromium.launch({ headless: true });
  record.browser = { name: 'chromium', version: browser.version(), playwright: require('@playwright/test/package.json').version,
    platform: process.platform, arch: process.arch, deviceScaleFactor: 1 };
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => network.push({ path: new URL(response.url()).pathname, status: response.status() }));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    errors.push(`Outside consumer origin: ${url.href}`); return route.abort();
  });
  try {
    // Run the exact source shipped to consumers, rather than a parallel recipe.
    await page.goto(`${origin}/nested/`);
    await expect(page.locator('#status')).toHaveText('Ready');
    await expect(page.locator('[data-scriptoscope-window-host]')).toHaveCount(1);
    await page.evaluate(() => { window.exampleOriginalInput = document.querySelector('#check'); });
    await page.getByRole('checkbox', { name: 'Keep my setting', exact: true }).check();
    await page.getByRole('button', { name: 'Restore native HTML', exact: true }).click();
    await expect(page.locator('#status')).toHaveText('Native HTML restored. Your checkbox value is preserved.');
    await expect(page.locator('[data-scriptoscope-window-host],.scriptoscope-checkbox')).toHaveCount(0);
    assert(await page.evaluate(() => document.querySelector('#check') === window.exampleOriginalInput && window.exampleOriginalInput.checked && document.querySelector('#window').isConnected));
    assert(network.some(item => item.path === '/nested/themes/scriptoscope/scheme.rsrc' && item.status === 200));
    record.example.teardown = { sameInput: true, checked: true, sourceConnected: true, remainingFaces: 0 };
    await page.goto(`${origin}/consumer/`);
    await page.waitForFunction(() => !!window.packedConsumer?.handle);
    await page.evaluate(() => window.packedConsumer.ready);
    await expect(page.locator('[data-scriptoscope-window-host]')).toHaveCount(1);
    await expect(page.locator('.scriptoscope-checkbox,.scriptoscope-slider,.scriptoscope-select')).toHaveCount(3);
    assert.equal(await page.evaluate(() => window.packedConsumer.version), packed.version);
    assert.equal(await page.evaluate(() => window.packedConsumer.decoderExport), 'function');
    assert.equal(await page.evaluate(() => window.packedConsumer.headerSurfaceExport), 'function');
    assert.deepEqual(await page.evaluate(() => window.packedConsumer.directProfilePixels),
      [18, 86, 154, 255, 18, 86, 154, 255, 18, 86, 154, 255, 18, 86, 154, 255]);
    const builtInFrame = await page.evaluate(() => {
      const canvas = window.packedConsumer.builtInFrame?.querySelector('canvas');
      if (!canvas || !document.querySelector('#consumer-builtin-frame')?.contains(canvas)) return null;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) opaque++;
      return { width: canvas.width, height: canvas.height, opaquePixels: opaque };
    });
    assert(builtInFrame && builtInFrame.width > 160 && builtInFrame.height > 60, 'Built-in frame window did not render a framed canvas');
    assert(builtInFrame.opaquePixels > 0, 'Built-in frame window canvas is fully transparent');
    record.builtInFrame.render = builtInFrame;
    // The opt-in decode worker is the packed `./decode-worker` export, bundled by the
    // consumer's own build; its results must equal the main-thread decode.
    const decodeWorker = await page.evaluate(() => window.packedConsumer.decodeWorker);
    assert.deepEqual(decodeWorker, { 'windows-95': { same: true, assets: decodeWorker['windows-95'].assets }, 'platinum-8': { same: true, assets: decodeWorker['platinum-8'].assets } });
    assert(decodeWorker['windows-95'].assets > 100 && decodeWorker['platinum-8'].assets > 100, 'The worker decode returned no assets');
    const workerScripts = network.filter(item => /^\/consumer\/assets\/decode-worker-[^/]+\.js$/.test(item.path));
    assert(workerScripts.length === 1 && workerScripts[0].status === 200, `Packed decode worker was not loaded once: ${JSON.stringify(workerScripts)}`);
    // A consumer's own worker file importing the entry for its side effect must keep it:
    // dropped by tree-shaking, the worker would be empty and never answer.
    const wrappedWorker = await page.evaluate(() => window.packedConsumer.wrappedWorker);
    assert.deepEqual(wrappedWorker, { same: true, assets: decodeWorker['windows-95'].assets });
    const wrappedScripts = network.filter(item => /^\/consumer\/assets\/own-worker-[^/]+\.js$/.test(item.path));
    assert(wrappedScripts.length === 1 && wrappedScripts[0].status === 200, `Wrapped decode worker was not loaded once: ${JSON.stringify(wrappedScripts)}`);
    record.decodeWorker = { script: workerScripts[0].path, results: decodeWorker, wrapped: { script: wrappedScripts[0].path, result: wrappedWorker } };
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scriptoscope-focus-width').trim()), '2px');
    await page.getByRole('checkbox', { name: 'Themed', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'Volume', exact: true });
    await slider.focus(); await page.keyboard.press('ArrowRight'); await expect(slider).toHaveValue('51');
    await page.locator('#consumer-format').selectOption('hqx');
    const box = await page.evaluate(async () => {
      const input = document.querySelector('#consumer-volume'), face = input.nextElementSibling, old = face.querySelector('canvas');
      input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true }));
      for (let i = 0; i < 120 && face.querySelector('canvas') === old; i++) await new Promise(resolve => requestAnimationFrame(resolve));
      if (face.querySelector('canvas') === old) throw Error('Packed range did not repaint');
      window.packedConsumer.events.length = 0;
      const canvas = face.querySelector('canvas'), rect = canvas.getBoundingClientRect();
      return { x: rect.left + 5 * rect.width / 120, y: rect.top + rect.height / 2, width: canvas.width };
    });
    assert.equal(box.width, 120);
    await page.mouse.click(box.x, box.y);
    await expect(slider).toHaveValue('0');
    assert.deepEqual(await page.evaluate(() => window.packedConsumer.events), []);
    await page.keyboard.press('ArrowRight'); await expect(slider).toHaveValue('1');
    const teardown = await page.evaluate(() => {
      const fixture = window.packedConsumer;
      fixture.handle.disconnect();
      return { sameArticle: fixture.root.querySelector('article') === fixture.article,
        sameInputs: fixture.inputs.every(input => document.getElementById(input.id) === input),
        restoredNative: fixture.inputs.every(input => !input.hasAttribute('aria-hidden') && !input.style.position),
        form: Object.fromEntries(new FormData(document.querySelector('#consumer-form'))),
        checked: document.querySelector('#consumer-check').checked,
        faces: fixture.root.querySelectorAll('.scriptoscope-checkbox,.scriptoscope-slider,.scriptoscope-select,[data-scriptoscope-window-host]').length };
    });
    assert.deepEqual(teardown, { sameArticle: true, sameInputs: true, restoredNative: true, form: { volume: '1', format: 'hqx' }, checked: false, faces: 0 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.scriptoscope-checkbox,.scriptoscope-slider,.scriptoscope-select,[data-scriptoscope-window-host]')).toHaveCount(0);
    record.interaction = { keyboard: '50→51, 0→1', stationaryThumb: { value: '0', events: [] }, teardown };
    for (const path of record.bundle.dynamicImports) assert(network.some(item => item.path === `/consumer/${path}` && item.status === 200), `Lazy chunk not loaded: ${path}`);
    assert(network.some(item => item.path === '/consumer/themes/windows-95/scheme.sit' && item.status === 200));
    assert(network.some(item => item.path === '/consumer/themes/platinum-8/scheme.sit' && item.status === 200), 'Built-in frame archive not fetched');
    assert(network.every(item => item.status >= 200 && item.status < 300), 'A consumer resource failed');
    assert.deepEqual(errors, []);
  } catch (error) { await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {}); throw error; }
  await browser.close(); browser = null;
  await new Promise(resolve => server.close(resolve)); server = null;

  await negativeTarball(tarball, 'dist/scriptoscope.css', 'exports', 'missing-css');
  await negativeTarball(tarball, 'THIRD_PARTY_NOTICES', 'contents', 'missing-notices');
  await negativeTarball(tarball, 'dist/renderer.js', 'exports', 'missing-renderer');
  await negativeTarball(tarball, 'dist/decode-worker.js', 'exports', 'missing-decode-worker');
  await negativeTarball(tarball, 'dist/types/renderer.d.ts', 'types', 'missing-renderer-types', undefined, '@khawkins98/scriptoscope/renderer');
  // The entry may be a re-export facade over shared chunks, so follow its static
  // import graph and take the first dynamic import found (the archive decoder).
  const inspected = join(workspace, 'inspect-candidate');
  await mkdir(inspected);
  command('tar', ['-xzf', tarball, '-C', inspected], workspace);
  const candidateDist = join(inspected, 'package/dist');
  const lazyImports = [], seen = new Set(), pending = ['scriptoscope.js'];
  while (pending.length) {
    const file = pending.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    // Follow the candidate's installed files, including when no local dist exists.
    const code = await readFile(join(candidateDist, file), 'utf8');
    const target = spec => relative(candidateDist, resolve(candidateDist, dirname(file), spec));
    for (const [, spec] of code.matchAll(/import\(["'](\.\.?\/[^"']+\.js)["']\)/g)) lazyImports.push(target(spec));
    for (const [, spec] of code.matchAll(/(?:^|[\s;}])(?:import|export)\s*(?:[^'"();]*?\sfrom\s*)?["'](\.\.?\/[^"']+\.js)["']/g)) pending.push(target(spec));
  }
  const lazy = lazyImports[0];
  assert(lazy, 'No actual lazy loader dependency found for the negative fixture');
  record.negativeLazyChunk = lazy;
  await negativeTarball(tarball, join('dist', lazy), 'bundle', 'missing-decoder');
  await negativeTarball(tarball, 'dist/tools/theme-loader/loadKaleidoscopeScheme.d.ts', 'types', 'escaped-types', declaration => {
    const target = "from '../../types/types.js'";
    assert.equal(declaration.split(target).length, 2);
    // The repository file exists and typechecks. Without the declaration-graph
    // boundary this defective tarball would silently pass using checkout types.
    return declaration.replace(target, `from ${JSON.stringify(join(root, 'src/types.js'))}`);
  }, 'Declaration import escaped the installed consumer');
  record.complete = true;
  console.log('Packed consumer passed: contents/notices, exports, Bundler/NodeNext declarations, shipped example, renderer interoperability, archive decoding, the decode-worker export, native interaction/teardown and seven package-boundary negatives.');
} catch (error) {
  record.error = `${error.stack}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`;
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'result.json'), JSON.stringify(record, null, 2) + '\n');
  await rm(workspace, { recursive: true, force: true });
}
