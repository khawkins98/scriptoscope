import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../tests/helpers/registerTs.mjs';
const { promoteThemePicker } = await import('./themePicker.ts');

class Element extends EventTarget {
  dataset = {};
  children = [];
  parentNode = null;
  attributes = new Map();
  classList = { add() {}, toggle() {} };
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  appendChild(child) { this.append(child); return child; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); }
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
const iconTheme = { manifest: {}, inspector: { iconIndex: [{ id: -3983, size: 32, url: 'blob:folder' }] } };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const setup = (t) => {
  const prior = globalThis.document;
  globalThis.document = { createElement: () => new Element(), activeElement: null };
  t.after(() => { globalThis.document = prior; });
  return new Element();
};

test('teardown preserves tiles but removes old handlers; remount switches once', async (t) => {
  const el = setup(t);
  el.setAttribute('aria-busy', 'application-before');
  const switches = [];
  const deps = { initialSlug: 'one', loadTheme: async () => iconTheme, switchTheme: (slug) => switches.push(slug) };
  const first = await promoteThemePicker(el, themes, deps);
  const tiles = [...el.children];
  first.teardown();
  first.teardown();
  assert.equal(el.getAttribute('aria-busy'), 'application-before');
  assert.deepEqual(el.children, tiles);
  for (const tile of tiles) assert.equal(tile.parentNode, el);
  el.children[0].dispatchEvent(new Event('click'));
  assert.deepEqual(switches, []);
  const second = await promoteThemePicker(el, themes, deps);
  t.after(() => second.teardown());
  el.children[0].focus();
  const right = new Event('keydown', { cancelable: true });
  Object.defineProperty(right, 'key', { value: 'ArrowRight' });
  el.dispatchEvent(right);
  assert.deepEqual(switches, ['two']);
  el.setAttribute('aria-busy', 'application-after');
  second.teardown();
  assert.equal(el.getAttribute('aria-busy'), 'application-after');
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
  picker.teardown();
  assert.equal(el.hasAttribute('aria-busy'), false);
  assert.equal(el.getAttribute('aria-busy'), null);
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

test('owned active preview captures its base owner and exports only the selected icon', async t => {
  const { createRasterAssetOwner, bindRasterOwner } = await import('../../tools/theme-loader/rasterAssets.js');
  const owner = createRasterAssetOwner(['folder', 'unused'].map(path => ({ path, width: 1, height: 1,
    rgba: new Uint8Array([1, 2, 3, 255]) })), (_rgba, _w, _h, path) => `blob:${path}`);
  t.after(owner.dispose);
  const source = { manifest: {}, inspector: { iconIndex: [{ id: -3983, size: 32, url: 'folder' }] } };
  bindRasterOwner(source, owner);
  const base = { kind: 'owned-theme', source, origin: '', imageUrl: owner.imageUrl, dispose: owner.dispose };
  const child = { kind: 'owned-theme', source: { manifest: {} }, base, origin: '/child', imageUrl() { throw new Error('Wrong image owner'); }, dispose() {} };
  const el = setup(t);
  const picker = await promoteThemePicker(el, [{ slug: 'one' }], { initialSlug: 'one', loadTheme: async () => child, switchTheme() {} });
  t.after(picker.teardown);
  await flush();
  assert.equal(el.children[0].children[0].src, 'blob:folder');
  assert.equal(owner.usage().images, 1);
});

test('multi-strip keyboard navigation: unselected strip retains tabindex="0" on first tile and supports ArrowDown/Up', async (t) => {
  const { syncThemePickerActive } = await import('./themePicker.ts');
  const el = setup(t);
  const switches = [];
  const picker = await promoteThemePicker(el, themes, {
    initialSlug: 'other', loadTheme: async () => iconTheme, switchTheme: (slug) => switches.push(slug),
  });
  t.after(picker.teardown);
  // None matched 'other', so the first tile must get tabindex="0" for keyboard entry
  assert.equal(el.children[0].getAttribute('tabindex'), '0');
  assert.equal(el.children[1].getAttribute('tabindex'), '-1');

  // ArrowDown advances to next tile
  el.children[0].focus();
  const down = new Event('keydown', { cancelable: true });
  Object.defineProperty(down, 'key', { value: 'ArrowDown' });
  el.dispatchEvent(down);
  assert.deepEqual(switches, ['two']);

  // Syncing to an external slug resets active tiles but keeps first tile tabindex="0"
  syncThemePickerActive(el, 'external-slug');
  assert.equal(el.children[0].getAttribute('tabindex'), '0');
  assert.equal(el.children[1].getAttribute('tabindex'), '-1');
  assert.equal(el.children[0].getAttribute('aria-selected'), 'false');
});
