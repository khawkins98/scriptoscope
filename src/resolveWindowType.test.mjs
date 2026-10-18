import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

const moduleUrl = async (path) => 'data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText,
).toString('base64');
const source = ts.transpileModule(await readFile(new URL('./resolveWindowType.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('./wndCascade.js', await moduleUrl('./wndCascade.ts'));
const { resolveWindowType } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const frame = (asset) => ({ chrome: { active: asset }, parts: { 'part-0': { rect: [1, 10, 40, 30] } }, edges: { top: [{ at: 1, part: 'part-1' }] } });
test('utility aliases use type identity and reject author-labelled grow boxes', () => {
  const titled = frame('blob:titled');
  const side = frame('blob:side');
  const modal = frame('blob:modal');
  const theme = { manifest: { windowTypes: { 'movable-modal': modal, 'side-floating-utility-window': side, 'titled-utility-window': titled } } };
  for (const alias of ['utility', 'mini', 'floating', 'palette']) assert.equal(resolveWindowType(theme, alias), titled);
  assert.equal(resolveWindowType(theme, 'side-floating-utility-window'), side);
  theme.manifest.chromeElements = { arbitrary: { asset: 'blob:titled', authorLabel: 'Active Grow Box' } };
  assert.equal(resolveWindowType(theme, 'utility'), side);
  delete side.edges;
  assert.equal(resolveWindowType(theme, 'utility'), modal);
});

test('legacy raw wnd# keys retain utility identity with opaque assets', () => {
  const titled = frame('blob:raw-titled');
  const side = frame('blob:raw-side');
  const theme = { manifest: { windowTypes: {
    'wnd--14300': frame('blob:collapsed'),
    'movable-modal': frame('blob:modal'),
    'wnd--14296': side,
    'wnd--14304': titled,
  } } };
  for (const alias of ['utility', 'mini', 'floating', 'palette']) assert.equal(resolveWindowType(theme, alias), titled);
  assert.equal(resolveWindowType(theme, 'wnd--14296'), side);
  delete theme.manifest.windowTypes['wnd--14304'];
  assert.equal(resolveWindowType(theme, 'utility'), side);
});

test('every corpus alias and canonical type resolves identically with filenames and opaque URLs', async () => {
  const root = new URL('../themes/', import.meta.url);
  let checked = 0;
  for (const dir of await readdir(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const files = await readdir(new URL(`${dir.name}/`, root));
    const archive = ['scheme.sit', 'scheme.rsrc'].find((name) => files.includes(name));
    if (!archive) continue;
    const bytes = await readFile(new URL(`${dir.name}/${archive}`, root));
    let sequence = 0;
    const named = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: (_rgba, _w, _h, path) => path });
    const opaque = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: () => `blob:opaque-${sequence++}` });
    const key = (theme, slug) => Object.entries(theme.manifest.windowTypes).find(([, value]) => value === resolveWindowType(theme, slug))?.[0];
    for (const slug of ['utility', 'mini', 'floating', 'palette', ...Object.keys(named.manifest.windowTypes)]) {
      assert.equal(key(opaque, slug), key(named, slug), `${dir.name}: ${slug}`);
    }
    checked++;
  }
  assert.ok(checked >= 18);
});
