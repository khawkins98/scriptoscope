// Shared page fixture for the #597 frame pass-through specs
// (docs/spec/engine/hit-regions.md §9, hooks HPT1–HPT38).
//
// Everything a hook asserts is a public observable (§9.2 HP45): elementFromPoint,
// real pointer input, DOM attributes (`data-scriptoscope-hit-effective`), the
// shadow tree (open, HP45), `describe()` (`active`, `hit`, `hitEffective`), the
// change listener, canvas attribute mutation records and the `region` debug
// category. Fixture points come from hit-region-rules.mjs (the §4.2 decode
// applied to the archive's own template and placed cells), never from the
// runtime's region, canvas or clip (§9.8).
import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

export { expect };
export const test = base.extend({
  servers: [async ({}, use) => {
    const servers = await startServers();
    try { await use(servers); } finally { await servers.close(); }
  }, { scope: 'worker' }],
});
export const MODES = ['source', 'built'];
export const CLAIM = 'web host policy (hit-regions §9); the Window Manager half is U1';

/** Recipe fixtures of §9.8 (theme, kind, which band each point prefers). */
export const FIXTURES = {
  dolphin: { slug: 'dolphin-som', type: 'document-window', note: 'jagged frame, all bands' },
  animals: { slug: 'animals', type: 'document-window', note: 'sky band' },
  '1984': { slug: '1984', type: 'document-window', note: 'the left column under the close knob', out: 'left' },
  '1984-popup': { slug: '1984', type: 'popup-window', note: 'the band beside the tab, and the tab' },
};
export const NEGATIVE = { slug: 'windows-95', type: 'document-window' };
export const EXEMPT = { slug: 'platinum-8', type: 'document-window' };

/** Observations are policy evidence, not fidelity; the same writer as the other rendering specs. */
export async function observe(info, kind, name, payload) {
  const body = JSON.stringify({ ...payload, claim: CLAIM, schema: 1, evidence: 'observed-execution', project: info.project.name }, null, 2);
  await info.attach(`${kind}-${name}.json`, { body, contentType: 'application/json' });
}

/** In-page boot: runtime + declarative + oracle, a sentinel beneath everything, debug capture. */
export async function boot(page, servers, mode, { sentinel = 'div' } = {}) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(BOOT, { mode, sentinel });
}

const BOOT = async ({ mode, sentinel: sentinelTag }) => {
  const css = document.createElement('link'); css.rel = 'stylesheet';
  css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
  await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
  const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
  const decl = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
  const rules = await import('/tests/rendering-options/hit-region-rules.mjs');
  const chromeRules = await import('/tests/rendering-options/window-chrome-rules.mjs');
  document.body.style.cssText = 'margin:0;width:2600px;height:2000px;position:relative';
  const style = document.createElement('style');
  style.textContent = '#fpt-sentinel{position:absolute;left:0;top:0;width:1400px;height:1000px;margin:0;padding:0;border:0;background:rgb(250,240,200);cursor:crosshair;z-index:0;display:block}';
  document.head.append(style);

  // ── Event log ──────────────────────────────────────────────────────────────
  const events = [];
  const sentinel = document.createElement(sentinelTag);
  sentinel.id = 'fpt-sentinel';
  if (sentinelTag === 'button') sentinel.type = 'button';
  for (const type of ['pointerdown', 'pointerup', 'click', 'wheel', 'pointerover', 'focus'])
    sentinel.addEventListener(type, e => events.push({ type, at: 'sentinel', pointerType: e.pointerType ?? null, trusted: e.isTrusted }));
  document.body.prepend(sentinel);

  // ── Debug channel (HP45 `region`, HP10/HP14/HP44/HP47 logs) ────────────────
  const logs = [];
  const original = console.log.bind(console);
  console.log = (...args) => {
    const head = typeof args[0] === 'string' ? args[0] : '';
    const m = /^\[scriptoscope:([^\]]+)\]\s*(.*)$/.exec(head);
    if (m) {
      let data = '';
      try { data = args.length > 1 ? JSON.stringify(args.slice(1)) : ''; } catch { data = String(args[1]); }
      logs.push({ category: m[1], label: m[2], text: `${m[2]} ${data}` });
    }
    return original(...args);
  };
  api.setDebug(true);
  const region = () => logs.filter(l => l.category === 'region');

  // ── Themes and the decode ─────────────────────────────────────────────────
  const themes = new Map(), decoded = new Map();
  const theme = slug => { if (!themes.has(slug)) themes.set(slug, api.loadTheme(`/themes/${slug}`)); return themes.get(slug); };
  const decode = slug => {
    if (!decoded.has(slug)) decoded.set(slug, (async () => {
      for (const file of ['scheme.sit', 'scheme.rsrc']) {
        const res = await fetch(`/themes/${slug}/${file}`);
        if (res.ok) return api.loadKaleidoscopeScheme(new Uint8Array(await res.arrayBuffer()), { encodeAssets: false });
      }
      throw Error(`no archive for ${slug}`);
    })());
    return decoded.get(slug);
  };

  // ── Managers, windows and per-host counters ───────────────────────────────
  const changes = new Map(), hostDowns = new Map();
  const managers = [];
  const manager = (opts) => {
    const m = opts === undefined ? new api.WindowManager() : new api.WindowManager(opts);
    m.setChangeListener(host => changes.set(host, (changes.get(host) ?? 0) + 1));
    managers.push(m);
    return m;
  };
  const settle = async (ms = 120) => {
    await new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 2; i++) await new Promise(r => requestAnimationFrame(r));
  };
  const hosts = {};
  /** add(): imperative window over the sentinel. `extra.hit` is the HP11 option. */
  const add = async (name, { m, slug, type = 'document-window', w = 320, h = 200, title = '', hit, left = 120, top = 140, scale, content, extra = {}, handlers = {}, themeObject, synthetic, parent = document.body } = {}) => {
    const contentEl = content ?? document.createElement('div');
    if (!content) {
      contentEl.className = 'fpt-content';
      contentEl.style.cssText = 'height:100%;box-sizing:border-box;background:rgb(255,255,255)';
      contentEl.textContent = `${name} content`;
    }
    const opts = { width: w, height: h, title, windowType: type, ...(scale ? { scale } : {}) };
    const host = await (m ?? managers[0] ?? manager()).add(themeObject ?? await theme(slug), opts, handlers, { contentEl, ...extra, ...(hit !== undefined ? { hit } : {}) });
    host.dataset.fptName = name;
    parent.append(host);
    (m ?? managers[0]).setPosition(host, left, top);
    host.addEventListener('pointerdown', () => hostDowns.set(host, (hostDowns.get(host) ?? 0) + 1));
    hosts[name] = { host, slug, type, m: m ?? managers[0], contentEl, synthetic };
    await settle();
    return host;
  };
  /** Declarative window promoted through ScriptoscopeWindow (HP10). */
  const promote = async (name, { m, slug, type = 'document-window', html, parent = document.body, themeObject, synthetic }) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const source = wrap.firstElementChild;
    parent.append(source);
    const instance = await decl.ScriptoscopeWindow.promote(source, { manager: m ?? managers[0], theme: themeObject ?? await theme(slug) });
    const host = instance.host;
    host.dataset.fptName = name;
    host.addEventListener('pointerdown', () => hostDowns.set(host, (hostDowns.get(host) ?? 0) + 1));
    hosts[name] = { host, slug, type, m: m ?? managers[0], instance, synthetic };
    await settle(300);
    return host;
  };

  // ── Geometry: chrome pixels ↔ viewport (HP16) ─────────────────────────────
  const canvasOf = host => (host.shadowRoot ?? host).querySelector('canvas.scriptoscope-chrome');
  const contentOf = host => (host.shadowRoot ?? host).querySelector('.scriptoscope-content');
  const geom = name => {
    const { host } = hosts[name], canvas = canvasOf(host), r = canvas.getBoundingClientRect();
    const k = r.width / canvas.width, cr = contentOf(host)?.getBoundingClientRect();
    return { W: canvas.width, H: canvas.height, k, left: r.left, top: r.top,
      domC: cr ? { left: Math.round((cr.left - r.left) / k), top: Math.round((cr.top - r.top) / k), right: Math.round((cr.right - r.left) / k), bottom: Math.round((cr.bottom - r.top) / k) } : null };
  };
  const vp = (name, p) => { const g = geom(name); return { x: g.left + (p[0] + 0.5) * g.k, y: g.top + (p[1] + 0.5) * g.k }; };
  /**
   * Local → viewport under a transformed ancestor `wrapper` (transform-origin 0 0):
   * measure the untransformed layout, then apply the wrapper's matrix (HPT11; the
   * test maps points itself, HP17).
   */
  const vpT = (name, pts, wrapper) => {
    const t = wrapper.style.transform; wrapper.style.transform = 'none';
    const w0 = wrapper.getBoundingClientRect(), g = geom(name);
    wrapper.style.transform = t;
    const M = new DOMMatrix(getComputedStyle(wrapper).transform);
    return pts.map(p => { const q = M.transformPoint(new DOMPoint(g.left - w0.left + (p[0] + 0.5) * g.k, g.top - w0.top + (p[1] + 0.5) * g.k)); return { x: w0.left + q.x, y: w0.top + q.y }; });
  };

  /**
   * The §4.2 structure region for window `name` as currently configured (theme,
   * kind, size, active state, collapsed): template + placed cells from the decode.
   * C is the template's body inset in the canvas (runtime frame policy), cross-
   * checked against the DOM content box when expanded.
   */
  const oracle = async (name, { state, collapsed = false, slug: overrideSlug, type: overrideType } = {}) => {
    const h = hosts[name], g = geom(name), slug = overrideSlug ?? h.slug;
    const dec = await decode(slug);
    let key = overrideType ?? h.type;
    if (collapsed && dec.manifest.windowTypes[`collapsed-${key}`]) key = `collapsed-${key}`;
    const wt = dec.manifest.windowTypes[key];
    if (!wt || wt.model) return { exempt: true, key, W: g.W, H: g.H, k: g.k };
    const st = state ?? ((h.host.shadowRoot ?? h.host).querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState === 'inactive' ? 'inactive' : 'active');
    const asset = h.synthetic?.[key]?.[st] ?? dec.assets.find(a => a.path === wt.chrome[st]);
    const cicn = asset && { width: asset.width, height: asset.height, alphaAt: (x, y) => asset.rgba[(y * asset.width + x) * 4 + 3] };
    const [al, at, ar, ab] = wt.parts['part-0'].rect;
    // C: the runtime's frame placement (HP16, the configuration input), else the template body inset.
    const C = !collapsed && g.domC && g.domC.right > g.domC.left ? g.domC
      : { left: al, top: at, right: g.W - (asset.width - ar), bottom: g.H - (asset.height - ab) };
    const built = rules.structureRegion({ windowType: wt, cicn, C, W: g.W, H: g.H, popupFamily: key === 'popup-window',
      flags: { ...chromeRules.DECLARED_FLAGS, drawActive: st === 'active' }, collapsed });
    // Widget rects (HT7) are kept clear of pointer fixtures so a press is a frame press.
    const widgets = ['part-1', 'part-2', 'part-3'].filter(p => wt.parts[p]).map(p => chromeRules.remap(built.layout, { left: wt.parts[p].rect[0], top: wt.parts[p].rect[1], right: wt.parts[p].rect[2], bottom: wt.parts[p].rect[3] }));
    return { key, state: st, W: g.W, H: g.H, k: g.k, C, domC: g.domC, region: built.region, layout: built.layout, widgets, census: rules.census(built.region), wt, cicn };
  };
  const near = (rects, x, y, m) => rects.some(r => x >= r.left - m && x < r.right + m && y >= r.top - m && y < r.bottom + m);
  /** Fixture points (§9.8) from the oracle; `out`: 'top' | 'left' | 'any' band preference. */
  const points = (o, { out = 'top', r = 2 } = {}) => {
    const { C, W, H } = o, grow = { left: C.right - 20, top: C.bottom - 20, right: W, bottom: H };
    const p = rules.pickPoints({ region: o.region, W, H, C }, { r,
      whereIn: (x, y) => y < C.top && !near(o.widgets, x, y, 4) && !near([grow], x, y, 0),
      whereOut: (x, y) => (out === 'left' ? x < C.left && y >= C.top : out === 'top' ? y < C.top : true) && !near(o.widgets, x, y, 2),
      prefer: (x, y, kind) => kind === 'in' ? -Math.abs(x - (C.left + C.right) / 2) - Math.abs(y - C.top / 2) : -Math.abs(y - (out === 'left' ? (C.top + C.bottom) / 2 : C.top / 2)) - Math.abs(x - (C.left + C.right) / 2) / 4,
    });
    return p;
  };
  const value = (o, p) => o.region[p[1] * o.W + p[0]];
  /** HP15 cross-check only (never a point source): oracle vs the drawn chrome alpha outside C. */
  const crossCheck = (name, o) => {
    const canvas = canvasOf(hosts[name].host), px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let agree = 0, disagree = 0, unknown = 0; const samples = [];
    for (let y = 0; y < o.H; y++) for (let x = 0; x < o.W; x++) {
      if (x >= o.C.left && x < o.C.right && y >= o.C.top && y < o.C.bottom) continue;
      const v = o.region[y * o.W + x];
      if (v === rules.UNKNOWN) { unknown++; continue; }
      const drawn = px[(y * o.W + x) * 4 + 3] !== 0 ? rules.IN : rules.OUT;
      if (drawn === v) agree++; else { disagree++; if (samples.length < 5) samples.push([x, y, v, drawn]); }
    }
    return { agree, disagree, unknown, samples };
  };

  /** What the browser hit-tests at a viewport point (HPT1/HPT2 elementFromPoint). */
  const hitAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return 'none';
    if (el === sentinel) return 'sentinel';
    for (const [name, h] of Object.entries(hosts)) {
      if (el === h.host) return `host:${name}`;
      if (h.host.contains(el)) return `content:${name}`;
    }
    return el.id ? `#${el.id}` : el.tagName.toLowerCase();
  };
  const state = name => {
    const { host, m } = hosts[name], d = m.describe(host);
    return { active: d?.active, hit: d?.hit, hitEffective: d?.hitEffective, attr: host.getAttribute('data-scriptoscope-hit-effective'),
      current: (host.shadowRoot ?? host).querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState ?? null,
      z: host.style.zIndex, left: host.style.left, top: host.style.top, changes: changes.get(host) ?? 0, downs: hostDowns.get(host) ?? 0 };
  };
  /** Canvas attribute records (HP45 commit observable) per host, from now. */
  const watchers = new Map();
  const watch = name => {
    const canvas = canvasOf(hosts[name].host), records = [];
    const mo = new MutationObserver(list => records.push(...list.map(r => r.attributeName)));
    mo.observe(canvas, { attributes: true });
    watchers.set(name, { mo, records });
    return records;
  };
  const records = async name => { await settle(30); const w = watchers.get(name); w.records.push(...w.mo.takeRecords().map(r => r.attributeName)); return w.records.length; };
  /** L1 (part=window), L2 (the clipped layer: the canvas's parent, HP26/HP43). */
  const layers = name => {
    const root = hosts[name].host.shadowRoot, L1 = root.querySelector('[part~=window]'), canvas = canvasOf(hosts[name].host);
    return { L1, L2: canvas?.parentElement ?? null, canvas, first: root.firstElementChild };
  };

  /**
   * A synthetic recipe: `slug`'s theme with the chrome templates of `keys` replaced
   * by `edit(rgba, width, height, key, state)` (in place on a copy). Returns the theme
   * object and the decoded copies for the oracle (`hosts[name].synthetic`).
   */
  const synth = async (slug, keys, edit) => {
    const base = await theme(slug), dec = await decode(slug), synthetic = {};
    const windowTypes = { ...base.manifest.windowTypes };
    for (const key of keys) {
      const wt = dec.manifest.windowTypes[key], chrome = {};
      synthetic[key] = {};
      for (const st of ['active', 'inactive']) {
        const src = dec.assets.find(a => a.path === wt.chrome[st]);
        if (!src) continue;
        const rgba = new Uint8ClampedArray(src.rgba);
        edit(rgba, src.width, src.height, key, st);
        const canvas = document.createElement('canvas'); canvas.width = src.width; canvas.height = src.height;
        canvas.getContext('2d').putImageData(new ImageData(rgba, src.width, src.height), 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        chrome[st] = URL.createObjectURL(blob);
        synthetic[key][st] = { width: src.width, height: src.height, rgba };
      }
      windowTypes[key] = { ...base.manifest.windowTypes[key], chrome: { ...base.manifest.windowTypes[key].chrome, ...chrome } };
    }
    return { theme: { ...base, manifest: { ...base.manifest, windowTypes } }, synthetic };
  };

  const drop = name => { const h = hosts[name]; if (!h) return; h.instance ? h.instance.unmount() : h.m.remove(h.host); h.host.remove(); delete hosts[name]; };
  const reset = () => { for (const name of Object.keys(hosts)) drop(name); managers.length = 0; events.length = 0; logs.length = 0; changes.clear(); hostDowns.clear(); };
  /** A page button outside every window (keyboard-activated clicks, HPT18/HPT19). */
  const pageButton = (id, left, top) => {
    let b = document.getElementById(id);
    if (!b) { b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = id; document.body.append(b); }
    b.style.cssText = `position:absolute;left:${left}px;top:${top}px;z-index:5;width:80px;height:24px`;
    b.addEventListener('click', e => events.push({ type: 'click', at: id, detail: e.detail, pointerType: e.pointerType ?? null }));
    return b;
  };

  window.__fpt = { vpT, synth, drop, reset, pageButton, api, decl, rules, chromeRules, theme, decode, manager, managers, add, promote, hosts, geom, vp, oracle, points, value,
    hitAt, state, events, logs, region, watch, crossCheck, records, layers, settle, sentinel, changes, hostDowns };
  await document.fonts.ready;
};

/** Fixture for window `name`: oracle + points + viewport coordinates. Throws when a point is missing. */
export async function fixture(page, name, opts = {}) {
  return page.evaluate(async ({ name, opts }) => {
    const f = window.__fpt, o = await f.oracle(name, opts);
    if (o.exempt) return { exempt: true, key: o.key, W: o.W, H: o.H, k: o.k };
    const p = f.points(o, opts);
    const vp = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v && f.vp(name, v)]));
    return { key: o.key, state: o.state, W: o.W, H: o.H, k: o.k, C: o.C, domC: o.domC, census: o.census, points: p, vp };
  }, { name, opts });
}

export const hitAt = (page, p) => page.evaluate(({ x, y }) => window.__fpt.hitAt(x, y), p);
export const state = (page, name) => page.evaluate(name => window.__fpt.state(name), name);
export const events = page => page.evaluate(() => window.__fpt.events.splice(0));
export const regionLogs = page => page.evaluate(() => window.__fpt.region().length);
export const settle = (page, ms) => page.evaluate(ms => window.__fpt.settle(ms), ms);

/** Screenshot pixels of a viewport clip, decoded in the page: `{ w, h, data }` (RGBA, CSS px at DPR 1). */
export async function capture(page, clip) {
  const c = { x: Math.max(0, Math.floor(clip.x)), y: Math.max(0, Math.floor(clip.y)), width: Math.ceil(clip.width), height: Math.ceil(clip.height) };
  const png = await page.screenshot({ clip: c, animations: 'disabled', caret: 'hide' });
  return page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return { w: bitmap.width, h: bitmap.height, x0: 0, data: Array.from(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data) };
  }, png.toString('base64')).then(r => ({ ...r, x: c.x, y: c.y }));
}
export const SENTINEL_RGB = [250, 240, 200];
export const pixel = (img, x, y) => { const i = ((y - img.y) * img.w + (x - img.x)) * 4; return img.data.slice(i, i + 4); };
