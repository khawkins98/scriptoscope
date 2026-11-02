// Owned synthetic implementation checks; no theme fixtures or independent expectations.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) return next(specifier.slice(0, -3) + '.ts', context);
    throw error;
  }
}, load(url, context, next) {
  const loaded = next(url, context);
  return url.endsWith('.ts') ? { ...loaded, format: 'module', source: stripTypeScriptTypes(String(loaded.source), { mode: 'transform' }) } : loaded;
} });
const { regionGeometry, targetIntersections } = await import('./hitRegion.ts');
const { viewportFrame } = await import('./positioning.ts');
const { WindowManager } = await import('./interactive.ts');
const contains = (rects, x, y) => rects.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom);

test('exact bands preserve synthetic holes, disconnected runs and solid content at each scale', () => {
  for (const scale of [1, 2, 3]) {
    const width = 9, height = 7;
    const content = { left: 3, top: 2, right: 6, bottom: 5 };
    const bits = Uint8Array.from({ length: width * height }, (_, i) => {
      const x = i % width, y = Math.floor(i / width);
      return (x >= 3 && x < 6 && y >= 2 && y < 5) || ((x * 3 + y * 7) % 5 < 2) ? 1 : 0;
    });
    const geometry = regionGeometry({ width, height, bits }, scale, content);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      assert.equal(contains(geometry.rectangles, (x + .5) * scale, (y + .5) * scale), !!bits[y * width + x]);
      assert.equal(contains(geometry.frame, (x + .5) * scale, (y + .5) * scale), !!bits[y * width + x] && !(x >= 3 && x < 6 && y >= 2 && y < 5));
    }
    assert.equal((geometry.path.match(/M/g) ?? []).length, geometry.rectangles.length);
    const box = { left: 2 * scale, top: scale, right: 8 * scale, bottom: 6 * scale };
    const targets = targetIntersections(geometry.rectangles, box);
    for (let y = 0; y < 5 * scale; y++) for (let x = 0; x < 6 * scale; x++)
      assert.equal(contains(targets, x + .5, y + .5), contains(geometry.rectangles, x + .5 + box.left, y + .5 + box.top));
  }
  assert.equal(regionGeometry({ width: 2, height: 2, bits: new Uint8Array(4) }, 1).path, '');
});

test('window-local pointer map ignores child origins under scale, rotation and skew', () => {
  globalThis.getComputedStyle = el => el.computed;
  for (const [a, b, c, d] of [[2, 0, 0, 3], [0, 2, -2, 0], [1, .5, .25, 1]]) {
    const width = 30, height = 20, ox = 117, oy = 83;
    const xs = [0, a * width, c * height, a * width + c * height];
    const ys = [0, b * width, d * height, b * width + d * height];
    const el = { offsetWidth: width, offsetHeight: height, computed: { transform: `matrix(${a},${b},${c},${d},0,0)` },
      getBoundingClientRect: () => ({ left: ox + Math.min(...xs), top: oy + Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }) };
    const frame = viewportFrame(el);
    for (const [x, y] of [[7, 5], [13, 9], [21, 12]]) {
      const actual = frame.toLocal(ox + a * x + c * y, oy + b * x + d * y);
      assert.ok(Math.abs(actual.x - x) < 1e-8 && Math.abs(actual.y - y) < 1e-8);
    }
  }
});

class Element {
  style = {}; children = []; attributes = new Map();
  setAttribute(k, v) { this.attributes.set(k, v); }
  append(node) { this.insertBefore(node, null); }
  insertBefore(node, next) {
    node.remove();
    const i = next === null ? this.children.length : this.children.indexOf(next);
    assert.ok(i >= 0);
    node.parentElement = this; this.children.splice(i, 0, node);
  }
  get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
  querySelector(selector) { return selector.includes('content') ? this.content ?? null : null; }
  querySelectorAll() { return []; }
}

test('mode changes reuse surfaces, gesture ownership keeps latest path, ended lifetime cannot revive targets', () => {
  globalThis.document = { createElement: () => new Element() };
  const manager = Object.create(WindowManager.prototype);
  manager.defaultHit = 'region'; manager.placeRing = () => {};
  const host = new Element(), root = new Element(), hit = new Element(), content = new Element(), control = new Element();
  root.style = { width: '12px', height: '8px' }; root.append(hit); hit.content = content;
  control.style = { left: '2px', top: '1px', width: '6px', height: '4px' };
  const geometry = { path: 'prepared', frame: [{ left: 0, top: 0, right: 12, bottom: 1 }], rectangles: [{ left: 0, top: 0, right: 12, bottom: 8 }] };
  const entry = { host, layers: { hit }, geometry, region: geometry.path, overlays: new Map([['titlewidget-close', control]]), lifetime: new AbortController() };
  manager.applyHit(entry);
  const nodes = [...entry.targets.values()].flatMap(v => v.nodes);
  assert.equal(control.style.pointerEvents, 'none'); assert.equal(content.style.pointerEvents, 'auto');
  assert.ok(nodes.every(n => n.style.pointerEvents === 'auto' && !('tabIndex' in n)));
  entry.hit = 'box'; manager.applyHit(entry);
  assert.equal(hit.style.clipPath, ''); assert.equal(control.style.pointerEvents, '');
  assert.ok(nodes.every(n => n.style.pointerEvents === 'none'));
  entry.hit = 'region'; manager.applyHit(entry);
  assert.deepEqual([...entry.targets.values()].flatMap(v => v.nodes), nodes);
  manager.suspendClip(entry, true); const oldResize = entry.gesture; oldResize.ending = true;
  manager.suspendClip(entry, true); const drag = entry.gesture;
  entry.region = 'new-commit'; manager.applyHit(entry);
  manager.suspendClip(entry, false, oldResize); assert.equal(hit.style.clipPath, 'none');
  manager.suspendClip(entry, false, drag); assert.equal(hit.style.clipPath, 'path("new-commit")');
  manager.windows = [entry]; manager.themeEpoch = 0; manager.syncOutside = () => {};
  entry.renderEpoch = 0; entry.contentPort = { dispose() {} };
  manager.dispose(); manager.dispose();
  assert.equal(manager.windows.length, 0); assert.equal(entry.targets.size, 0);
  manager.syncTargets(entry); assert.ok(nodes.every(n => !n.parentElement));
  const next = { ...entry, targets: undefined, lifetime: new AbortController() };
  manager.windows = [next]; manager.syncTargets(next);
  const newNodes = [...next.targets.values()].flatMap(v => v.nodes);
  assert.ok(newNodes.length > 0 && newNodes.every(n => !nodes.includes(n)));
  manager.syncTargets(entry); assert.ok(nodes.every(n => !n.parentElement));
  manager.dispose();
});

test('changed rectangles retain exact matches, recycle owned spans and repair only missing targets', () => {
  let created = 0;
  globalThis.document = { createElement: () => { created++; return new Element(); } };
  const manager = Object.create(WindowManager.prototype);
  manager.defaultHit = 'region';
  const parent = new Element(), root = new Element(), host = new Element();
  root.append(parent);
  const content = new Element(), overlay = new Element(), sentinels = [content];
  parent.append(content);
  const box = left => ({ left, top: 0, right: left + 1, bottom: 2 });
  const entry = { host, layers: { hit: parent }, region: 'prepared',
    geometry: { frame: [box(0), box(2), box(0)] }, lifetime: new AbortController() };
  const install = rects => {
    entry.geometry.frame = rects; manager.syncTargets(entry);
    const nodes = entry.targets.get(parent).nodes;
    assert.deepEqual(parent.children, [...sentinels, ...nodes]);
    assert.deepEqual(nodes.map(n => [parseFloat(n.style.left), parseFloat(n.style.top),
      parseFloat(n.style.width), parseFloat(n.style.height)]), rects.map(r => [r.left, r.top, r.right - r.left, r.bottom - r.top]));
    return nodes;
  };
  const first = install(entry.geometry.frame);
  parent.append(overlay); sentinels.push(overlay);
  const grown = install([box(0), box(4), box(0), box(6)]);
  assert.equal(created, 4);
  assert.equal(grown[0], first[0]); assert.equal(grown[2], first[2]);
  assert.equal(grown[1], first[1]);
  const shrunk = install([box(6), box(0)]);
  assert.equal(created, 4);
  assert.equal(shrunk[0], grown[3]); assert.equal(shrunk[1], first[0]);
  assert.ok(!first[1].parentElement && !first[2].parentElement);
  shrunk[0].remove();
  const repaired = install(entry.geometry.frame);
  assert.equal(created, 5); assert.equal(repaired[1], shrunk[1]);
  const foreign = new Element(); foreign.append(repaired[1]);
  const reparented = install(entry.geometry.frame);
  assert.equal(created, 6); assert.equal(reparented[0], repaired[0]);
  assert.equal(foreign.children.length, 0);
  install([]); assert.deepEqual(parent.children, sentinels); assert.equal(created, 6);
  const original = [box(0), box(2)], originalNodes = install(original);
  original[0].left = 4; original[0].right = 5;
  const mutated = install([box(4), box(0), box(2)]);
  assert.equal(mutated[1], originalNodes[0]); assert.equal(mutated[2], originalNodes[1]);
  assert.equal(created, 9);
});
