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
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (parent, path) => { const part = relative(parent, path); return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part)); };
const command = (program, args, cwd) => execFileSync(program, args, { cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
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

async function prepareConsumer(tarball, name) {
  const consumer = join(workspace, name);
  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: `consumer-${name}`, private: true, type: 'module' }));
  command(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', tarball], consumer);
  const installed = await realpath(join(consumer, 'node_modules/scriptoscope'));
  assert(inside(consumer, installed), 'The installed package must not be a repository symlink');
  await cp(new URL('./fixture/', import.meta.url), consumer, { recursive: true });
  // Use the installed package's import-condition exports, not Node require's
  // different condition set, and verify actual files rather than resolution alone.
  let phase = 'exports';
  try {
    const specifiers = ['scriptoscope', 'scriptoscope/declarative', 'scriptoscope/scriptoscope.css', 'scriptoscope/package.json'];
    const paths = JSON.parse(command(process.execPath, ['--input-type=module', '-e',
      `console.log(JSON.stringify(${JSON.stringify(specifiers)}.map(id => import.meta.resolve(id))))`], consumer));
    for (const [index, url] of paths.entries()) {
      const path = await realpath(fileURLToPath(url));
      assert(inside(installed, path), `${specifiers[index]} resolved outside the installed tarball`);
      assert((await stat(path)).isFile(), `Missing packed export: ${specifiers[index]}`);
    }
    phase = 'types';
    // Deliberately do not skip library checking: repository compilation can hide
    // declaration references to files omitted from npm's files whitelist.
    await writeFile(join(consumer, 'env.d.ts'), 'interface ImportMeta { readonly env: { readonly BASE_URL: string } }\n');
    await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true, skipLibCheck: false, noEmit: true, types: [],
    }, files: ['main.ts', 'env.d.ts'] }));
    const typeFiles = command(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json'), '--listFiles', '--pretty', 'false'], consumer).trim().split('\n').map(file => file.trim());
    for (const file of typeFiles) {
      const path = await realpath(file.trim());
      const standardLib = inside(compilerLib, path) && /^lib\..+\.d\.ts$/.test(relative(compilerLib, path));
      assert(inside(consumer, path) || standardLib, `Declaration import escaped the installed consumer: ${path}`);
    }
    return { consumer, installed, typeFiles: typeFiles.map(file => inside(compilerLib, file) ? `typescript/lib/${relative(compilerLib, file)}` : relative(consumer, file)),
      exports: specifiers.map((specifier, index) => ({ specifier, path: relative(installed, fileURLToPath(paths[index])) })) };
  } catch (error) { error.phase = phase; throw error; }
}

async function bundleConsumer(prepared, outDir) {
  const modules = [];
  try {
    const result = await build({ configFile: false, envFile: false, root: prepared.consumer, publicDir: false,
      base: '/consumer/', logLevel: 'silent',
      plugins: [{ name: 'packed-only-module-graph', generateBundle() {
        for (const id of this.getModuleIds()) {
          if (id.startsWith('\0')) continue; // Vite/Rollup generated modules.
          const path = resolve(id.split('?')[0]);
          assert(inside(prepared.consumer, path), `Consumer bundle imported outside its installation: ${id}`);
          modules.push(relative(prepared.consumer, path));
        }
      } }],
      build: { outDir, emptyOutDir: true, sourcemap: false, minify: true },
    });
    const chunks = (Array.isArray(result) ? result : [result]).flatMap(item => item.output).filter(item => item.type === 'chunk');
    const dynamicImports = [...new Set(chunks.flatMap(chunk => chunk.dynamicImports))];
    assert(dynamicImports.length > 0, 'The consumer must retain the actual lazy archive decoder');
    return { modules: modules.sort(), dynamicImports };
  } catch (error) { error.phase = 'bundle'; throw error; }
}

async function negativeTarball(original, omitted, expectedPhase, name) {
  const unpack = join(workspace, `unpack-${name}`);
  await mkdir(unpack);
  command('tar', ['-xzf', original, '-C', unpack], workspace);
  assert((await stat(join(unpack, 'package', omitted))).isFile(), `Negative fixture did not exist: ${omitted}`);
  await rm(join(unpack, 'package', omitted));
  const tarball = join(workspace, `${name}.tgz`);
  command('tar', ['-czf', tarball, '-C', unpack, 'package'], workspace);
  let failure;
  try {
    const prepared = await prepareConsumer(tarball, name);
    await bundleConsumer(prepared, join(workspace, `out-${name}`));
  } catch (error) { failure = error; }
  assert(failure, `An omitted packed ${omitted} unexpectedly passed`);
  assert.equal(failure.phase, expectedPhase, `The negative must fail at ${expectedPhase}, not an unrelated phase`);
  const message = `${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`;
  assert(message.includes(omitted.split('/').at(-1)), 'The failure must identify the omitted file');
  record.negativeCases.push({ omitted, expectedPhase, rejected: true, message });
  console.log(`Rejected missing packed ${omitted} at ${expectedPhase}.`);
}

try {
  await mkdir(output, { recursive: true });
  // test:package builds immediately before this. No dirty dist/demo or source
  // checkout files may accidentally enlarge or satisfy the package under test.
  const [packed] = JSON.parse(command(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', workspace], root));
  const tarball = join(workspace, packed.filename);
  record.package = { name: packed.name, version: packed.version, sha256: sha(await readFile(tarball)), integrity: packed.integrity, files: packed.files };
  const prepared = await prepareConsumer(tarball, 'positive');
  record.exports = prepared.exports;
  record.typeFiles = prepared.typeFiles;
  const site = join(workspace, 'site');
  const publicRoot = join(site, 'consumer');
  record.bundle = await bundleConsumer(prepared, publicRoot);
  const themeDir = join(publicRoot, 'themes/windows-95');
  await mkdir(themeDir, { recursive: true });
  for (const file of ['scheme.sit', 'meta.json']) await copyFile(join(root, 'themes/windows-95', file), join(themeDir, file));
  record.archiveSha256 = sha(await readFile(join(themeDir, 'scheme.sit')));
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
    await page.goto(`${origin}/consumer/`);
    await page.waitForFunction(() => !!window.packedConsumer?.handle);
    await page.evaluate(() => window.packedConsumer.ready);
    await expect(page.locator('[data-scriptoscope-window-host]')).toHaveCount(1);
    await expect(page.locator('.scriptoscope-checkbox,.scriptoscope-slider,.scriptoscope-select')).toHaveCount(3);
    assert.equal(await page.evaluate(() => window.packedConsumer.version), packed.version);
    assert.equal(await page.evaluate(() => window.packedConsumer.decoderExport), 'function');
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
    assert(network.every(item => item.status >= 200 && item.status < 300), 'A consumer resource failed');
    assert.deepEqual(errors, []);
  } catch (error) { await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {}); throw error; }
  await browser.close(); browser = null;
  await new Promise(resolve => server.close(resolve)); server = null;

  await negativeTarball(tarball, 'dist/scriptoscope.css', 'exports', 'missing-css');
  const main = await readFile(join(root, 'dist/scriptoscope.js'), 'utf8');
  const lazy = [...main.matchAll(/import\(["'](\.\/[^"']+\.js)["']\)/g)].map(match => match[1])[0];
  assert(lazy, 'No actual lazy loader dependency found for the negative fixture');
  await negativeTarball(tarball, join('dist', lazy), 'bundle', 'missing-decoder');
  record.complete = true;
  console.log('Packed consumer passed: exports, strict declarations, isolated production build, archive decoding, native interaction/teardown and two omitted-file negatives.');
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
