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
  setAttribute() {}
  attachShadow() { this.shadowRoot = new EventTarget(); }
}
globalThis.document = { createElement: () => new Host() };
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
