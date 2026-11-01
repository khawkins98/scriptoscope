// Implementation-owned scheduling checks derived from window-input-policy.md.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import test from 'node:test';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && specifier.endsWith('.js')) {
    try { return next(specifier.slice(0, -3) + '.ts', context); } catch {}
  }
  return next(specifier, context);
}, load(url, context, next) {
  if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    }).outputText };
  return next(url, context);
} });
const { WindowManager } = await import('./interactive.ts');

class Host extends EventTarget {
  style = {};
  offsetWidth = 260; offsetHeight = 160;
  getBoundingClientRect() { return { left: 0, top: 0, width: 260, height: 160 }; }
  appendChild() {}
  remove() {}
  captures = 0;
  setPointerCapture() { this.captures++; }
  hasPointerCapture() { return true; }
  releasePointerCapture() {}
  setAttribute() {}
  attachShadow() { this.shadowRoot = new EventTarget(); }
}
globalThis.document = Object.assign(new EventTarget(), { createElement: () => new Host() });
globalThis.getComputedStyle = () => ({ transform: 'none' });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function harness() {
  const manager = new WindowManager({ hit: 'box' });
  const gates = new Map();
  manager.prepareRender = entry => {
    const gate = gates.get(entry.opts.title);
    if (entry.initializing && gate) return gate.promise;
    return Promise.resolve({});
  };
  manager.commitRender = entry => { entry.commitEpoch++; entry.paintedActive = entry.active; };
  manager.syncOutside = () => {};
  const add = async (title, pending = false, state = 'active') => {
    if (pending) gates.set(title, deferred());
    return manager.add({}, { title, state });
  };
  const active = () => manager.windows.filter(w => w.active).map(w => w.opts.title);
  const fail = async (title, promise) => {
    const rejected = assert.rejects(promise, new RegExp(title));
    gates.get(title).reject(new Error(title));
    await rejected;
  };
  const succeed = async (title, promise) => { gates.get(title).resolve({}); return promise; };
  return { manager, add, active, fail, succeed };
}

for (const order of [['B', 'C'], ['C', 'B']]) test(`failed claims restore successful authority: ${order}`, async () => {
  const h = harness();
  await h.add('A');
  const pending = { B: h.add('B', true), C: h.add('C', true) };
  await h.fail(order[0], pending[order[0]]);
  if (order[0] === 'C') assert.deepEqual(h.active(), ['A']);
  await h.fail(order[1], pending[order[1]]);
  assert.deepEqual(h.active(), ['A']);
  assert.equal(h.manager.windows[0].paintedActive, true);
});

test('an older pending claim may succeed after the newer claim fails', async () => {
  const h = harness(); await h.add('A');
  const b = h.add('B', true), c = h.add('C', true);
  await h.fail('C', c); assert.deepEqual(h.active(), ['A']);
  await h.succeed('B', b); assert.deepEqual(h.active(), ['B']);
});

test('successful request order wins over completion order', async () => {
  const h = harness(); await h.add('A');
  const b = h.add('B', true), c = h.add('C', true);
  await h.succeed('C', c); await h.succeed('B', b);
  assert.deepEqual(h.active(), ['C']);
});

test('a successful older claim becomes fallback while a newer claim prepares', async () => {
  const h = harness(); await h.add('A');
  const b = h.add('B', true), c = h.add('C', true);
  await h.succeed('B', b); assert.deepEqual(h.active(), ['C']);
  await h.fail('C', c); assert.deepEqual(h.active(), ['B']);
});

for (const operation of ['focus', 'deactivate', 'remove', 'dispose']) test(`${operation} survives pending failures`, async () => {
  const h = harness(); const a = await h.add('A'); await h.add('D', false, 'inactive');
  const b = h.add('B', true), c = h.add('C', true);
  const focused = operation === 'focus' ? h.manager.focus(h.manager.windows.find(w => w.opts.title === 'D')) : undefined;
  if (operation === 'deactivate') h.manager.deactivate();
  if (operation === 'remove') h.manager.remove(a);
  if (operation === 'dispose') h.manager.dispose();
  // Removed initial renders currently resolve without remounting; exercise their cleanup here.
  if (operation === 'dispose') {
    await h.succeed('B', b); await h.succeed('C', c);
  } else { await h.fail('B', b); await h.fail('C', c); }
  await focused;
  assert.deepEqual(h.active(), operation === 'focus' ? ['D'] : []);
});

// Implementation-owned reentrancy checks from window-hit-policy.md, without browser fixtures.
function pointer(target, type, x = 1) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: 7, pointerType: 'mouse', button: 0, isPrimary: true, clientX: x, clientY: x });
  target.dispatchEvent(event);
}
for (const kind of ['move', 'resize']) for (const phase of ['setup', 'moving']) {
  for (const operation of ['remove', 'dispose']) test(`${operation} during ${kind} ${phase} ends the gesture`, async () => {
    const h = harness(), host = await h.add('A');
    const entry = h.manager.windows[0], win = new Host(), controls = new Map();
    entry.layers = { decor: new Host(), hit: new Host() };
    entry.frameAbort = new AbortController();
    win._scriptoscopeComposed = { frame: { left: 10, right: 10, top: 10, bottom: 10 }, fullWidth: 260, fullHeight: 160 };
    h.manager.overlay = (_entry, _win, role) => {
      const control = new Host(); controls.set(role, control); return control;
    };
    h.manager.toAbsolute = () => ({ x: 0, y: 0 });
    const end = () => operation === 'remove' ? h.manager.remove(host) : h.manager.dispose();
    h.manager.claimFocus = () => { if (phase === 'setup') end(); };
    h.manager.wireMoveResize(entry, win, entry.frameAbort.signal);
    const target = kind === 'move' ? win : controls.get('growbox');
    let listenerAdds = 0;
    const originalAdd = document.addEventListener;
    document.addEventListener = function (...args) { listenerAdds++; return originalAdd.apply(this, args); };
    try {
      pointer(target, 'pointerdown');
      if (phase === 'moving') { pointer(document, 'pointermove', 20); end(); }
      const snapshot = { ...host.style }, count = listenerAdds;
      await h.add('fresh');
      pointer(document, 'pointermove', 40); pointer(document, 'pointerup', 40);
      assert.deepEqual(host.style, snapshot);
      assert.equal(listenerAdds, count);
      assert.equal(target.captures, phase === 'setup' ? 0 : 1);
      if (phase === 'setup') assert.equal(listenerAdds, 0);
    } finally { document.addEventListener = originalAdd; }
  });
}
