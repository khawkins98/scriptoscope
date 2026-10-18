import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Inline the two DOM-free dependencies so Node can run the TS module's .js
// imports without a build or browser dependency.
const moduleUrl = async (path) => 'data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText,
).toString('base64');
let source = ts.transpileModule(await readFile(new URL('./themePicker.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
source = source.replace('../baseChain.js', await moduleUrl('../baseChain.ts'))
  .replace('./icon.js', await moduleUrl('./icon.ts'));
const { promoteThemePicker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

class Element extends EventTarget {
  dataset = {};
  children = [];
  attributes = new Map();
  classList = { add() {}, toggle() {} };
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  appendChild(child) { this.append(child); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  hasAttribute(key) { return this.attributes.has(key); }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.className === selector.slice(1) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  focus() { document.activeElement = this; this.dispatchEvent(new Event('focus')); }
}
const themes = [{ slug: 'one' }, { slug: 'two' }];
const iconTheme = { inspector: { iconIndex: [{ id: -3983, size: 32, url: 'blob:folder' }] } };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const setup = (t) => {
  const prior = globalThis.document;
  globalThis.document = { createElement: () => new Element(), activeElement: null };
  t.after(() => { globalThis.document = prior; });
  return new Element();
};

test('teardown preserves tiles but removes old handlers; remount switches once', async (t) => {
  const el = setup(t);
  const switches = [];
  const deps = { initialSlug: 'one', loadTheme: async () => iconTheme, switchTheme: (slug) => switches.push(slug) };
  const first = await promoteThemePicker(el, themes, deps);
  first.teardown();
  first.teardown();
  el.children[0].dispatchEvent(new Event('click'));
  assert.deepEqual(switches, []);
  const second = await promoteThemePicker(el, themes, deps);
  t.after(() => second.teardown());
  el.children[0].focus();
  const right = new Event('keydown', { cancelable: true });
  Object.defineProperty(right, 'key', { value: 'ArrowRight' });
  el.dispatchEvent(right);
  assert.deepEqual(switches, ['two']);
});

test('failed icon loads settle both tile and container busy state', async (t) => {
  const el = setup(t);
  const picker = await promoteThemePicker(el, themes, {
    initialSlug: 'one', loadTheme: async () => { throw new Error('404'); }, switchTheme() {},
  });
  t.after(() => picker.teardown());
  await flush();
  assert.equal(el.children[0].getAttribute('aria-busy'), 'false');
  assert.equal(el.getAttribute('aria-busy'), 'false');
});

test('old decode completion cannot paint retained tiles or settle a new mount', async (t) => {
  const el = setup(t);
  let finish;
  const first = await promoteThemePicker(el, themes, {
    initialSlug: 'one', loadTheme: () => new Promise((resolve) => { finish = resolve; }), switchTheme() {},
  });
  const oldIcon = el.children[0].children[0];
  first.teardown();
  const second = await promoteThemePicker(el, themes, {
    initialSlug: 'one', loadTheme: () => new Promise(() => {}), switchTheme() {},
  });
  t.after(() => second.teardown());
  finish(iconTheme);
  await flush();
  assert.equal(oldIcon.src, undefined);
  assert.equal(el.getAttribute('aria-busy'), 'true');
});

test('background tiles use folder-only loading, with active-theme fallback for sparse icons', async (t) => {
  const el = setup(t);
  const fullLoads = [];
  const iconLoads = [];
  const picker = await promoteThemePicker(el, [...themes, { slug: 'sparse' }], {
    initialSlug: 'one',
    loadTheme: async (slug) => { fullLoads.push(slug); return iconTheme; },
    loadIcon: async (slug, primary, fallback) => {
      iconLoads.push([slug, primary, fallback]);
      return slug === 'sparse' ? null : 'data:image/png;base64,two';
    },
    switchTheme() {},
  });
  t.after(() => picker.teardown());
  await flush();
  el.children[1].dispatchEvent(new Event('mouseenter'));
  el.children[2].dispatchEvent(new Event('mouseenter'));
  await flush();
  assert.deepEqual(fullLoads, ['one']);
  assert.deepEqual(iconLoads, [['two', -3983, -3999], ['sparse', -3983, -3999]]);
  assert.equal(el.children[1].children[0].src, 'data:image/png;base64,two');
  assert.equal(el.children[2].children[0].src, 'blob:folder');
});

test('activating a failed background tile retries its icon and updates busy state', async (t) => {
  const el = setup(t);
  let calls = 0, finish;
  const picker = await promoteThemePicker(el, themes, {
    initialSlug: 'one', loadTheme: async () => iconTheme, switchTheme() {},
    loadIcon: async () => {
      if (++calls === 1) throw new Error('temporary failure');
      return new Promise((resolve) => { finish = resolve; });
    },
  });
  t.after(() => picker.teardown());
  await flush();
  const tile = el.children[1];
  tile.dispatchEvent(new Event('mouseenter'));
  await flush();
  assert.equal(tile.getAttribute('aria-busy'), 'false');
  tile.dispatchEvent(new Event('click'));
  assert.equal(tile.getAttribute('aria-busy'), 'true');
  finish('data:image/png;base64,recovered');
  await flush();
  assert.equal(calls, 2);
  assert.equal(tile.getAttribute('aria-busy'), 'false');
  assert.equal(tile.children[0].src, 'data:image/png;base64,recovered');
});
