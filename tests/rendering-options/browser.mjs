import { listCases } from './cases.mjs';
const params = new URLSearchParams(location.search);
const runtimeUrl = new URL(params.get('runtime') ?? '/dist/scriptoscope.js', location.href).href;
const cssUrl = new URL(params.get('css') ?? '/dist/scriptoscope.css', location.href).href;
const themeBase = new URL(params.get('themeBase') ?? '/themes/', location.href).href.replace(/\/$/, '');
const fontBase = new URL(params.get('fonts') ?? '/demo/assets/fonts/', location.href);
const sourceZoom = Number(params.get('sourceZoom') ?? 4);
const labelZoom = Number(params.get('labelZoom') ?? 1);
if (![1, 2, 4, 8].includes(sourceZoom) || ![1, 2, 4, 8].includes(labelZoom)) throw new Error('Reference zoom must be 1, 2, 4 or 8');
const matrix = document.querySelector('#matrix');
const records = new Map(), themes = new Map();
let runtime, catalog, serial = 0;

const bounded = (promise, label, ms = 15000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })])
    .finally(() => clearTimeout(timer));
};
const ready = (async () => {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = cssUrl;
  const css = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = () => reject(new Error(`Stylesheet failed: ${cssUrl}`)); });
  document.head.append(link);
  const fontLoads = ['Chicago', 'Charcoal', 'Charcoal 12'].map(async name => {
    // Pin both names used by rasterizeText to the bundled face, avoiding local
    // Chicago/Charcoal installations changing comparison semantics.
    const font = new FontFace(name, `url("${new URL(name === 'Charcoal 12' ? 'charcoal-12.woff' : 'virtue.woff', fontBase)}")`);
    document.fonts.add(await font.load());
  });
  await bounded(Promise.all([css, ...fontLoads]), 'Stylesheet/fonts');
  runtime = await import(runtimeUrl);
  const response = await fetch(params.get('catalog') ?? '/demo/themes-manifest.json');
  if (!response.ok) throw new Error(`Theme catalog HTTP ${response.status}`);
  catalog = await response.json();
  document.querySelector('#status').textContent = `Ready · ${catalog.length} themes · ${devicePixelRatio} DPR · ${runtimeUrl.endsWith('/src/index.ts') ? 'source runtime' : 'built public runtime'} · source art ${sourceZoom}×`;
  return { runtimeUrl, cssUrl, sourceZoom, labelZoom, themes: catalog.map(t => t.slug), devicePixelRatio };
})();
ready.catch(error => { document.querySelector('#status').textContent = `FAILED: ${error.message}`; });

async function themeFor(slug, baseSlug) {
  const key = `${slug}:${baseSlug ?? ''}`;
  if (themes.has(key)) return themes.get(key);
  const entry = catalog.find(t => t.slug === slug);
  if (!entry) throw new Error(`Unknown theme ${slug}`);
  const pending = (async () => {
    const base = baseSlug && baseSlug !== slug ? await themeFor(baseSlug) : undefined;
    return runtime.loadTheme(`${themeBase}/${slug}`, { source: entry.source, base });
  })();
  themes.set(key, pending);
  try { return await pending; } catch (error) { themes.delete(key); throw error; }
}

const rect = element => {
  const r = element.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
function bounds(canvas) {
  const { width, height } = canvas;
  if (!width || !height) return null;
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let left = width, top = height, right = -1, bottom = -1, opaquePixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] === 0) continue;
    opaquePixels++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { left, top, right, bottom, opaquePixels };
}
function selector(element) {
  if (!element.id) element.id = `matrix-node-${++serial}`;
  return `#${element.id}`;
}
function canvasMetadata(canvas) {
  return { selector: selector(canvas), width: canvas.width, height: canvas.height, opaqueBounds: bounds(canvas), rect: rect(canvas) };
}
function elementMetadata(element) {
  const style = getComputedStyle(element);
  return { selector: selector(element), rect: rect(element), filter: style.filter, boxShadow: style.boxShadow,
    display: style.display, visibility: style.visibility, role: element.getAttribute('role'),
    ariaChecked: element.getAttribute('aria-checked'), ariaSelected: element.getAttribute('aria-selected'),
    windowPath: element.dataset.matrixWindowPath ?? null, isWindowHost: element.hasAttribute('data-scriptoscope-window-host'),
    ariaDisabled: element.getAttribute('aria-disabled'), ariaLabel: element.getAttribute('aria-label'), tabIndex: element.tabIndex };
}
const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function until(predicate, label) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > 15000) throw new Error(`${label} timed out`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// Candidate source art only, not a duplicate of the renderer's role/base/state
// resolver. Inspectors/tests must identify which source observation they assert.
const ranges = {
  push: [[10230, 10232], [10238, 10240]], default: [[10230, 10232], [10238, 10240]], select: [[10230, 10232], [10238, 10240]],
  bevel: [[10162, 10176]], 'list-header': [[9567, 9568]], checkbox: [[9500, 9504]], radio: [[9488, 9492]],
  slider: [[10113, 10132], [10205, 10208]], progress: [[10071, 10080], [10220, 10224]],
  tab: [[9969, 9984]], scrollbar: [[8277, 8288]], disclosure: [[10102, 10112]], growbox: [[14330, 14334]],
};
async function references(theme, c, section) {
  const resources = [], seen = new Set();
  for (let owner = theme; owner && !seen.has(owner); owner = owner.base) {
    seen.add(owner);
    for (const [key, element] of Object.entries(owner.manifest.chromeElements ?? {})) {
      const id = element.sourceCicnId;
      if (!ranges[c.family]?.some(([lo, hi]) => Math.abs(id) >= lo && Math.abs(id) <= hi)) continue;
      const buffer = await runtime.loadCicnBuffer(runtime.assetUrl(owner, element.asset));
      const canvas = runtime.bufferToCanvas(buffer);
      const displayScale = sourceZoom;
      canvas.style.width = `${buffer.width * displayScale}px`; canvas.style.height = `${buffer.height * displayScale}px`;
      const figure = document.createElement('figure'), caption = document.createElement('figcaption');
      caption.textContent = `${id} · ${key} · ${buffer.width}×${buffer.height} · ${displayScale}× view`;
      figure.append(canvas, caption); section.append(figure);
      resources.push({ resourceId: id, ownerSlug: owner.baseUrl.split('/').pop(), key,
        width: buffer.width, height: buffer.height, slice: element.slice ?? null,
        bgAnchor: element.bgAnchor ?? null, textAnchor: element.textAnchor ?? null,
        selector: selector(canvas), assetUrl: runtime.assetUrl(owner, element.asset) });
    }
  }
  const label = c.options.label ?? c.options.columns?.[0]?.label ?? '';
  let labelReference = null;
  if (label) {
    const canvas = runtime.bufferToCanvas(runtime.rasterizeText(label, 12, c.options.fg ?? '#000000'));
    canvas.style.width = `${canvas.width * labelZoom}px`; canvas.style.height = `${canvas.height * labelZoom}px`;
    const figure = document.createElement('figure'), caption = document.createElement('figcaption');
    caption.textContent = `12px label probe · ${labelZoom}× view (not the resolved control font)`; figure.append(canvas, caption); section.append(figure);
    labelReference = { fontPx: 12, purpose: 'Fixed input probe; not a resolved control label oracle', selector: selector(canvas), width: canvas.width, height: canvas.height, inkBounds: bounds(canvas) };
  }
  return { evidence: 'Decoded source candidates and label input; not expected composed output', resources, label: labelReference };
}

async function compose(theme, c) {
  const functions = { push: 'composeButton', default: 'composeButton', bevel: 'composeBevelButton',
    'list-header': 'composeListHeader', slider: 'composeSlider', progress: 'composeProgress',
    tab: 'composeTab', scrollbar: 'composeScrollbar', disclosure: 'composeDisclosure', growbox: 'composeGrowBox' };
  return c.family === 'checkbox' || c.family === 'radio'
    ? runtime.composeCheckable(theme, c.family, c.options)
    : runtime[functions[c.family]](theme, c.options);
}

function nativeMarkup(c) {
  const root = document.createElement('div'); root.className = 'matrix-control';
  let native;
  if (c.family === 'push' || c.family === 'default') {
    native = document.createElement('button'); native.type = 'button'; native.textContent = c.options.label;
    native.dataset.scriptoscopeButton = '';
    if (c.options.default) native.dataset.scriptoscopeDefault = '';
    if (c.options.disabled) native.dataset.scriptoscopeDisabled = '';
  } else if (c.family === 'select') {
    native = document.createElement('select');
    for (const [value, text] of [['first', c.options.label], ['second', 'Alternative Agjp']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; native.append(option);
    }
  } else if (c.family === 'tab') {
    native = document.createElement('div'); native.dataset.scriptoscopeTabs = '';
    const panels = [];
    for (let i = 0; i < 2; i++) {
      const key = `tab-${++serial}`, button = document.createElement('button'), panel = document.createElement('div');
      button.dataset.scriptoscopeTab = key; button.textContent = i ? 'Other' : c.options.label;
      if (i === (c.options.selected ? 0 : 1)) button.dataset.scriptoscopeSelected = '';
      panel.dataset.scriptoscopePanel = key; panel.textContent = `${i ? 'Other' : 'First'} panel`;
      native.append(button); panels.push(panel);
    }
    native.append(...panels);
  } else {
    native = document.createElement('input'); native.type = c.family === 'slider' ? 'range' : c.family;
    native.checked = c.options.checked ?? false;
    if (c.family === 'slider') { native.min = '0'; native.max = '100'; native.value = String(c.options.value * 100); }
    if (c.family === 'radio') native.name = `radio-${++serial}`;
  }
  native.disabled = c.options.disabled ?? false;
  native.setAttribute('aria-label', c.options.label || c.family);
  root.append(native);
  if ((c.family === 'checkbox' || c.family === 'radio') && c.options.label) {
    const label = document.createElement('label'); label.htmlFor = selector(native).slice(1); label.textContent = c.options.label; root.append(label);
  }
  return { root, native };
}

async function promote(theme, c, output, record) {
  // Mount an empty root, then register the already-loaded theme as borrowed
  // before inserting targets. This exercises real scanner/observer promotion
  // without re-decoding the archive for every matrix row.
  const errors = [];
  const handle = await runtime.mountDeclarative({ root: output, pageThemeDefault: 'matrix-theme', bootAffordance: 'none',
    onPromoteError: e => { errors.push(String(e.cause)); return false; } });
  record.handle = handle;
  handle.registerTheme('matrix-theme', theme);
  const { root, native } = nativeMarkup(c);
  const win = document.createElement('article'); win.className = 'matrix-window';
  win.dataset.scriptoscopeWindow = ''; win.dataset.scriptoscopeTitle = 'Window shadow reference';
  win.style.width = '180px'; win.style.minHeight = '40px'; win.textContent = 'Consumer window host';
  const targets = document.createElement('div'); targets.append(root, win);
  output.append(targets); record.native = native; record.controlRoot = root;
  await until(() => errors.length || (handle.stats.windows === 1 &&
    (c.family === 'tab' ? handle.stats.tabs === 1 : ['push', 'default'].includes(c.family) ? handle.stats.buttons === 1 : handle.stats.controls === 1)), 'Declarative promotion');
  if (errors.length) throw new Error(errors.join('; '));
  const manager = new runtime.WindowManager();
  const host = await manager.add(theme, { title: 'Imperative shadow reference', width: 180, height: 40, scale: record.windowScale ?? 1 });
  host.classList.add('matrix-window'); host.style.position = 'relative';
  host.dataset.matrixWindowPath = 'imperative'; host.dataset.matrixWindowScale = String(record.windowScale ?? 1); output.append(host);
  record.manager = manager; record.imperativeHost = host;
  const declarative = [...output.querySelectorAll('.matrix-window')].find(el => el !== host && el.shadowRoot);
  if (declarative) { declarative.dataset.matrixWindowPath = 'declarative'; declarative.dataset.matrixWindowScale = '1'; }
  await frames();
}

function windowMetadata(host) {
  const chrome = host.shadowRoot?.querySelector('.scriptoscope-window');
  const canvas = host.shadowRoot?.querySelector('canvas');
  const part = host.shadowRoot?.querySelector('[part~=window]');
  const partStyle = part ? getComputedStyle(part) : null;
  return { ...elementMetadata(host), requestedScale: Number(host.dataset.matrixWindowScale ?? 1),
    chromeCanvasSize: canvas ? { width: canvas.width, height: canvas.height } : null, part: part ? { rect: rect(part), boxShadow: partStyle.boxShadow, filter: partStyle.filter } : null, hostRect: rect(host), chromeRect: chrome ? rect(chrome) : null,
    chromeCanvasRect: canvas ? rect(canvas) : null };
}
function readCase(id) {
  const record = records.get(id);
  if (!record) throw new Error(`No rendered case ${id}`);
  const { c, article, output, native, controlRoot } = record;
  const controls = controlRoot ? [...controlRoot.querySelectorAll('[data-scriptoscope-promoted], [role="tab"], .scriptoscope-select')]
    .filter(e => e !== native && getComputedStyle(e).display !== 'none').map(elementMetadata) : [];
  const nativeState = native ? { ...elementMetadata(native), value: native.value ?? null,
    checked: native.checked ?? null, disabled: native.disabled ?? null, tag: native.tagName.toLowerCase() } : null;
  return { ...c, slug: record.slug, baseSlug: record.baseSlug ?? null, status: record.status, error: record.error ?? null,
    runtimeUrl, cssUrl, devicePixelRatio, sourceZoom, labelZoom, renderPath: c.mode === 'direct' ? 'public-compositor' : 'public-declarative',
    selector: selector(article), outputSelector: selector(output),
    canvases: [...(controlRoot ?? output).querySelectorAll('canvas')].map(canvasMetadata),
    native: nativeState, controls, windows: [...output.querySelectorAll('.matrix-window')].filter(e => e.shadowRoot).map(windowMetadata),
    reference: record.reference };
}
async function clear() {
  for (const record of records.values()) { record.handle?.disconnect(); if (record.imperativeHost) record.manager.remove(record.imperativeHost); }
  records.clear(); matrix.replaceChildren();
}
async function dispose() {
  await clear();
  for (const pending of themes.values()) { try { (await pending).dispose?.(); } catch { /* failed loads own their cleanup */ } }
  themes.clear();
}
async function runCase(c, { slug, baseSlug, retain = false, includeReferences = true, windowScale = 1 } = {}) {
  await ready;
  if (!retain) await clear();
  const theme = await themeFor(slug, baseSlug);
  const key = `${slug}/${c.id}`;
  if (records.has(key)) throw new Error(`Duplicate retained case ${key}`);
  const article = document.createElement('article'); article.className = 'matrix-case'; article.dataset.caseId = c.id;
  const heading = document.createElement('h2'); heading.textContent = `${slug} · ${c.id}`;
  const output = document.createElement('div'); output.className = 'matrix-output';
  const section = document.createElement('section'); section.className = 'matrix-references';
  article.append(heading, output, section); matrix.append(article);
  const record = { c, slug, baseSlug, article, output, windowScale, status: 'rendered', reference: null }; records.set(key, record);
  try {
    if (c.mode === 'declarative') await promote(theme, c, output, record);
    else {
      const buffer = await compose(theme, c);
      if (buffer) output.append(runtime.bufferToCanvas(buffer));
      else { record.status = 'unavailable'; output.textContent = 'No themed output; caller chooses fallback.'; }
    }
    if (includeReferences) record.reference = await references(theme, c, section);
    await frames();
  } catch (error) { record.status = 'error'; record.error = error.stack ?? String(error); }
  const metadata = readCase(key);
  metadata.recordKey = key;
  return metadata;
}
async function runWindowLayout({ slug, layout = 'grid', scale = 1 } = {}) {
  if (!['grid', 'flex'].includes(layout)) throw new Error(`Unknown layout ${layout}`);
  const c = listCases().find(c => c.mode === 'declarative' && c.family === 'push' && !c.options.disabled);
  if (![1, 2].includes(scale)) throw new Error('Window fixture scale must be 1 or 2');
  const result = await runCase(c, { slug, includeReferences: false, windowScale: scale });
  if (result.status !== 'rendered') return result;
  const record = records.get(result.recordKey);
  for (const host of [...record.output.querySelectorAll('.matrix-window')].filter(el => el.shadowRoot)) {
    const wrapper = document.createElement('div'); wrapper.style.display = layout;
    wrapper.style.gridTemplateColumns = 'max-content 40px'; wrapper.style.alignItems = 'stretch';
    const sibling = document.createElement('div'); sibling.style.height = `${host.getBoundingClientRect().height + 64}px`;
    sibling.style.width = '40px'; sibling.textContent = 'Taller sibling';
    host.before(wrapper); wrapper.append(host, sibling);
  }
  await frames();
  return { ...readCase(result.recordKey), recordKey: result.recordKey, layout, requestedScale: scale };
}
window.controlMatrix = { ready, listCases, runCase, readCase, runWindowLayout, clear, dispose };
