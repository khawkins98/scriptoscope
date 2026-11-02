// Implementation-owned synthetic coverage derived from window-wheel-targets.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function declaration(path, name, member) {
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(n => n.name?.text === name);
  assert.ok(node, name);
  return member ? node.members.find(n => n.name?.text === member).getText(source) : node.getText(source).replace(/^export /, '');
}
const methods = ['wireScrollbarAxis', 'syncTargets'].map(name => declaration('./interactive.ts', 'WindowManager', name)).join('\n');
const intersection = declaration('./hitRegion.ts', 'targetIntersections');
const executable = ts.transpileModule(`${intersection}\nclass Harness { ${methods} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

class Element {
  style = {};
  children = [];
  listeners = new Map();
  attributes = new Map();
  setAttribute(key, value) { this.attributes.set(key, value); }
  append(node) { this.insertBefore(node, null); }
  insertBefore(node, next) {
    node.remove();
    const i = next === null ? this.children.length : this.children.indexOf(next);
    assert.ok(i >= 0);
    node.parentElement = this; this.children.splice(i, 0, node);
  }
  get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null; }
  prepend(node) { node.parentElement = this; this.children.unshift(node); }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  replaceWith(node) { const parent = this.parentElement; this.remove(); parent.append(node); }
  querySelector(selector) { return selector === 'canvas' ? this.children.find(n => n.canvas) ?? null : null; }
  querySelectorAll(selector) { return selector === 'canvas' ? this.children.filter(n => n.canvas) : []; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
}

for (const axis of ['vertical', 'horizontal']) for (const scale of [1, 2]) {
  test(`${axis} retained placement intersects committed runs synchronously at scale ${scale}`, async () => {
    const pending = [];
    const oldFrame = {};
    const bar = new Element();
    const canvas = new Element(); canvas.canvas = true; bar.append(canvas);
    Object.assign(bar.style, { left: '', top: '', right: '', bottom: '', width: '12px', height: '20px' });
    const layer = new Element(); layer.parentElement = { style: { width: '80px', height: '60px' } };
    const win = {};
    const host = { firstChild: win };
    const geometry = { frame: [], rectangles: [
      { left: 0, top: 0, right: 80, bottom: 10 },
      { left: 0, top: 10, right: 65, bottom: 60 },
      { left: 70, top: 10, right: 80, bottom: 60 },
    ] };
    const entry = { host, theme: {}, opts: {}, active: true, lifetime: new AbortController(), layers: { hit: layer },
      geometry, overlays: new Map([[`window-scrollbar-${axis}`, bar]]) };
    const paintedScrollbars = new WeakMap([[bar, oldFrame]]);
    const factory = new Function('document', 'growZone', 'composeScrollbarFrame', 'paintedScrollbars',
      'clamp01', 'requestAnimationFrame', 'cancelAnimationFrame', 'bufferToCanvas',
      `${executable}; return Harness;`);
    const Harness = factory({ createElement: () => new Element() }, () => ({ h: 0, w: 0 }),
      () => new Promise(resolve => pending.push(resolve)), paintedScrollbars,
      n => Math.max(0, Math.min(1, n)), () => 1, () => {}, () => { throw Error('stale paint committed'); });
    const manager = new Harness();
    manager.windows = [entry]; manager.overlay = () => bar; manager.hitEffective = () => 'region';
    const scrollEl = new Element();
    Object.assign(scrollEl, { clientHeight: 50, clientWidth: 50, scrollHeight: 100, scrollWidth: 100, scrollTop: 0, scrollLeft: 0 });
    const frame = { frame: { right: 7, top: 5, bottom: 9, left: 4 } };
    const wire = () => {
      const controller = new AbortController();
      manager.wireScrollbarAxis(axis, entry, win, scrollEl, frame, scale, controller.signal, { needV: true, needH: true });
      return controller;
    };
    const first = wire();
    const checkCoverage = () => {
      const left = axis === 'vertical' ? 80 - frame.frame.right * scale - 12 : frame.frame.left * scale;
      const top = axis === 'vertical' ? frame.frame.top * scale : 60 - frame.frame.bottom * scale - 20;
      const nodes = entry.targets.get(bar).nodes;
      for (let y = 0; y < 20; y++) for (let x = 0; x < 12; x++) {
        const expected = geometry.rectangles.some(r => x + left >= r.left && x + left < r.right && y + top >= r.top && y + top < r.bottom);
        const actual = nodes.some(n => x >= parseFloat(n.style.left) && x < parseFloat(n.style.left) + parseFloat(n.style.width)
          && y >= parseFloat(n.style.top) && y < parseFloat(n.style.top) + parseFloat(n.style.height));
        assert.equal(actual, expected, `${x},${y}`);
      }
    };
    checkCoverage();
    assert.equal(pending.length, 1);
    assert.equal(paintedScrollbars.get(bar), oldFrame);
    assert.equal(bar.querySelector('canvas'), canvas);
    assert.equal(entry.geometry, geometry);
    first.abort();
    frame.frame.right = 11; frame.frame.left = 13; frame.frame.top = 12; frame.frame.bottom = 6;
    const second = wire();
    checkCoverage();
    const movedTargets = entry.targets.get(bar);
    pending[0]({ buffer: {} });
    await Promise.resolve();
    assert.equal(entry.targets.get(bar), movedTargets);
    assert.equal(paintedScrollbars.get(bar), oldFrame);
    second.abort(); entry.lifetime.abort(); manager.windows = [];
    pending[1]({ buffer: {} });
    await Promise.resolve();
    assert.equal(entry.targets.get(bar), movedTargets);
    assert.equal(paintedScrollbars.get(bar), oldFrame);
    assert.equal(entry.overlays.get(`window-scrollbar-${axis}`), bar);
  });
}
