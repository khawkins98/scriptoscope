// Implementation-owned asynchronous cleanup checks for WindowManager.remove and owned disposal.
import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { WindowManager } = await import('./interactive.ts');
const { scrollbarResourceIds } = await import('./engine/families/scrollbar.ts');
const { createRasterAssetOwner, bindRasterOwner } = await import('../tools/theme-loader/rasterAssets.js');
const settle = () => new Promise(resolve => setImmediate(resolve));

class Element extends EventTarget {
  style = {};
  attributes = new Map();
  children = [];
  parentNode = null;
  setAttribute(key, value) { this.attributes.set(key, value); }
  scrollTo({ top, left }) { if (top != null) this.scrollTop = top; if (left != null) this.scrollLeft = left; }
  appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  replaceChildren(...children) {
    for (const child of [...this.children]) child.remove();
    for (const child of children) this.appendChild(child);
    this.paints = (this.paints ?? 0) + 1;
  }
}
function fixture(t, encoder) {
  const frames = new Map(), canceled = [], errors = [];
  let nextFrame = 0, begin, release, fail, encodes = 0;
  const started = new Promise(resolve => { begin = resolve; });
  const held = new Promise((resolve, reject) => { release = resolve; fail = reject; });
  const priorFrames = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.requestAnimationFrame = cb => { frames.set(++nextFrame, cb); return nextFrame; };
  globalThis.cancelAnimationFrame = id => { canceled.push(id); frames.delete(id); };
  t.after(() => Object.assign(globalThis, priorFrames));
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const priorDocument = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  t.after(() => { globalThis.document = priorDocument; });
  const owner = createRasterAssetOwner(['face', 'replacement'].map(path => ({ path, width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) })),
    (_rgba, _width, _height, path) => { encodes++; begin(); return encoder ? encoder(path) : held; }, true);
  t.after(owner.dispose);
  const id = scrollbarResourceIds(false).find(row => row.type === 'cicn').id;
  const source = { manifest: { chromeElements: { synthetic: { sourceCicnId: id, asset: 'face' } }, patterns: {} } };
  bindRasterOwner(source, owner);
  const theme = { kind: 'owned-theme', source, origin: '', imageUrl: owner.imageUrl, dispose: owner.dispose };
  const manager = new WindowManager(), win = new Element(), scroll = new Element();
  Object.assign(scroll, { clientHeight: 50, clientWidth: 50, scrollHeight: 100, scrollWidth: 50, scrollTop: 0, scrollLeft: 0 });
  const composed = { frame: { top: 1, right: 1 } };
  win._scriptoscopeComposed = composed;
  win.querySelector = () => scroll;
  const host = { shadowRoot: { firstChild: win }, isConnected: true };
  const ac = new AbortController();
  const entry = { theme, opts: {}, host, renderEpoch: 0, scrollAbort: ac, contentPort: { dispose() {} } };
  manager.windows = [entry];
  const wire = () => manager.wireScrollbarAxis('vertical', entry, win, scroll, composed, 1, ac.signal, { needV: true, needH: false });
  const wheel = () => {
    const event = new Event('wheel', { cancelable: true });
    Object.assign(event, { deltaY: 10, deltaX: 0, shiftKey: false }); scroll.dispatchEvent(event);
  };
  return { manager, entry, win, scroll, host, owner, source, ac, frames, canceled, errors, started, release, fail, wire, wheel, encodes: () => encodes };
}

test('remove and owner disposal settle a held initial scrollbar paint without publishing or unhandled rejection', async t => {
  const f = fixture(t); f.wire(); await f.started;
  const bar = f.win.children[0], sibling = new Element();
  assert.equal(bar.parentNode, f.win);
  f.win.appendChild(sibling);
  f.manager.remove(f.host); f.owner.dispose(); f.release('https://example.test/canceled.png');
  await settle();
  assert.equal(bar.paints ?? 0, 0);
  assert.equal(bar.parentNode, null);
  assert.deepEqual(f.win.children, [sibling]);
  assert.equal(sibling.parentNode, f.win);
  bar.remove();
  assert.deepEqual(f.win.children, [sibling]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.owner.usage().pending, 0);
});

test('aborting a scrollbar cancels scheduled paint and a raced callback cannot restart work', async t => {
  const f = fixture(t); f.wire(); await f.started; f.wheel();
  const bar = f.win.children[0];
  assert.equal(bar.parentNode, f.win);
  assert.equal(f.frames.size, 1);
  const [id, callback] = [...f.frames][0];
  f.manager.remove(f.host);
  assert.deepEqual(f.canceled, [id]); assert.equal(f.frames.size, 0);
  callback(); f.owner.dispose(); f.release('https://example.test/canceled.png'); await settle();
  assert.equal(f.encodes(), 1); assert.deepEqual(f.errors, []);
  assert.equal(bar.paints ?? 0, 0);
  assert.equal(bar.parentNode, null);
  assert.deepEqual(f.win.children, []);
});

test('a layout retry cannot rewire a removed host even when its chrome remains connected', async t => {
  const f = fixture(t); f.scroll.clientHeight = 0;
  await f.manager.wireScrollbars(f.entry, f.win, 0);
  assert.equal(f.frames.size, 1);
  f.manager.remove(f.host); f.scroll.clientHeight = 50;
  for (const callback of f.frames.values()) callback();
  await settle();
  assert.equal(f.host.isConnected, true); assert.equal(f.win.children.length, 0);
  assert.equal(f.encodes(), 0); assert.deepEqual(f.errors, []);
});

test('a live scrollbar reports a real encoder failure deliberately', async t => {
  const f = fixture(t), failure = new Error('synthetic encoder failure');
  f.wire(); await f.started; f.fail(failure); await settle();
  assert.equal(f.errors.length, 1);
  assert.equal(f.errors[0][0], '[scriptoscope] scrollbar paint failed:');
  assert.equal(f.errors[0][1], failure);
});

test('a superseded scrollbar preparation cannot report an obsolete encoder failure', async t => {
  const f = fixture(t);
  f.wire(); await f.started; f.wheel();
  f.fail(new Error('obsolete synthetic encoder failure')); await settle();
  assert.deepEqual(f.errors, []);
  assert.equal(f.win.children[0].paints ?? 0, 0);
  f.manager.remove(f.host);
});

for (const reversed of [false, true]) test(`scrollbar value changes invalidate earlier paint ${reversed ? 'after newer completion' : 'before the next frame'}`, async t => {
  const releases = new Map();
  const f = fixture(t, path => new Promise(resolve => releases.set(path, resolve)));
  const priorImage = globalThis.Image;
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; async decode() {} };
  t.after(() => { globalThis.Image = priorImage; });
  globalThis.document.createElement = () => {
    const element = new Element();
    element.getContext = (_kind, opts) => opts?.willReadFrequently ? {
      drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
    } : null;
    return element;
  };
  f.wire(); await f.started;
  const bar = f.win.children[0];
  // Public mutable manifest inputs let the two preparations wait independently.
  f.source.manifest.chromeElements.synthetic.asset = 'replacement';
  f.wheel();
  const callback = [...f.frames.values()][0];
  if (reversed) {
    callback(); await settle();
    releases.get('replacement')('https://example.test/newer-scrollbar.png'); await settle();
    assert.equal(bar.paints, 1);
    assert.equal(bar.attributes.get('aria-valuenow'), '20');
  }
  releases.get('face')(`https://example.test/older-scrollbar-${reversed}.png`); await settle();
  assert.equal(bar.paints ?? 0, reversed ? 1 : 0);
  if (!reversed) {
    assert.equal(bar.attributes.has('aria-valuenow'), false);
    callback(); await settle();
    releases.get('replacement')('https://example.test/newer-scrollbar-frame.png'); await settle();
  }
  assert.equal(bar.paints, 1);
  assert.equal(bar.attributes.get('aria-valuenow'), '20');
  assert.deepEqual(f.errors, []);
});
