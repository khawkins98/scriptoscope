// Compare the production owner with explicit historical PNG transport. The
// custom encoder deliberately opts out of the known-encoder pixel shortcut.
import { rasterOwner, createRasterAssetOwner, bindRasterOwner } from '../theme-loader/rasterAssets.js';
const source = await import('../../src/index.ts');
const built = await import('/dist/scriptoscope.js');
const slugs = Object.keys(import.meta.glob('../../themes/*/meta.json')).map(p => p.split('/')[3]).sort();
const clip = { controlOrigin: [23, 41], portOrigin: [5, -7], patternOrigin: { status: 'known', offset: [3, 5] },
  clip: { kind: 'rect', rect: { x: 25, y: 43, w: 20, h: 10 } } };
const ordinaryCases = [];
for (const minWidth of [32, 80, 180]) for (const state of ['normal', 'pressed', 'disabled'])
  for (const ring of [false, true]) for (const label of ['', 'AgjpQy']) for (const clipped of [false, true])
    ordinaryCases.push({ minWidth, height: 20, pressed: state === 'pressed', disabled: state === 'disabled', default: ring, label,
      ...(clipped ? { compositionContext: clip } : {}) });
const fontData = { version: 1, strikeSize: 12, metrics: { ascent: 9, descent: 3, leading: 1 },
  provenance: { kind: 'caller-declared', description: 'Synthetic transport probe, not an original font' },
  glyphs: [
    { character: 'A', advance: 4, bearingX: -1, bearingY: -3, width: 3, height: 3, mask: [0, 1, 0, 1, 0, 1, 1, 1, 1] },
    { character: ' ', advance: 2, bearingX: 0, bearingY: 0, width: 0, height: 0, mask: [] },
  ] };

async function encode(rgba, width, height) {
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  pixels.data.set(rgba); context.putImageData(pixels, 0, 0);
  return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
}
async function bytes(slug) {
  for (const extension of ['sit', 'rsrc']) {
    const response = await fetch(`/themes/${slug}/scheme.${extension}`);
    if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(`Missing source: ${slug}`);
}
function urls(value, found = new Set()) {
  if (typeof value === 'string' && value.startsWith('scriptoscope-raster:')) found.add(value);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) urls(child, found);
  return found;
}
function compare(a, b) {
  if (!a || !b) return a === b ? null : 'availability';
  const A = a.buffer ?? a, B = b.buffer ?? b;
  if (JSON.stringify(a.layout) !== JSON.stringify(b.layout)) return 'layout';
  if (A.width !== B.width || A.height !== B.height) return 'dimensions';
  for (let i = 0; i < A.data.length; i++) if (A.data[i] !== B.data[i]) return `byte ${i}: ${A.data[i]} != ${B.data[i]}`;
  return null;
}
async function capture(runtime, theme, options) {
  try { return { pixels: await runtime.composeButton(theme, options) }; }
  catch (error) { return { error: `${error.name}: ${error.message}` }; }
}
function child(base) {
  const manifest = { ...(base.source?.manifest ?? base.manifest), chromeElements: {}, patterns: {}, engineCinfs: {} };
  return base.kind === 'owned-theme'
    ? { kind: 'owned-theme', origin: '/synthetic-sparse-child', source: { manifest }, base, imageUrl: base.imageUrl, dispose() {} }
    : { baseUrl: '/synthetic-sparse-child', manifest, base };
}
function privateImage(value, key = '') {
  if (typeof value === 'string') return /(?:assetUrl|sourceAssetUrl)$/.test(key) && value.startsWith('scriptoscope-raster:');
  return value && typeof value === 'object' && Object.entries(value).some(([name, child]) => privateImage(child, name));
}
function compareWindow(a, b) {
  return a.layout !== b.layout ? 'window layout' : compare(a.pixels, b.pixels) ?? compare(a.tile, b.tile);
}
const probe = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) };
const changed = { ...probe, data: new Uint8ClampedArray([2, 2, 3, 255]) };
const windowProbe = { layout: 'same', pixels: probe, tile: probe };
for (const mutation of [{ layout: 'changed' }, { pixels: changed }, { tile: changed }])
  if (!compareWindow(windowProbe, { ...windowProbe, ...mutation })) throw new Error('Window comparator failed a mutation probe');

async function windowSnapshot(runtime, theme, options) {
  const win = await runtime.renderWindow(theme, options);
  const content = win.querySelector('.scriptoscope-content');
  const composed = win._scriptoscopeComposed;
  const background = content.style.backgroundImage;
  let tile = null;
  if (background && !['none', 'initial'].includes(background)) {
    const match = /^url\(["']?(.*?)["']?\)$/.exec(background);
    if (!match) throw new Error(`Unexpected CSS background: ${background}`);
    const url = match[1];
    if (url.startsWith('scriptoscope-raster:')) throw new Error('Window CSS exposed a private raster reference');
    tile = await runtime.loadCicnBuffer(url);
  }
  return { pixels: composed?.buffer ?? null, tile,
    layout: JSON.stringify({ frame: composed?.frame, placement: composed?.placement, widgets: composed?.widgets,
      width: win.style.width, height: win.style.height, content: content.style.cssText.replace(/background-image:[^;]+;?/, ''),
      hidden: content.hidden, inert: content.inert, role: win.getAttribute('role'), label: win.getAttribute('aria-label') }) };
}
async function compareWindows(runtime, old, current, report, transport, slug) {
  // Include child-first resolution with no window art in the child, retaining
  // the selected base owner for both chrome pixels and its CSS body image.
  const sparse = theme => {
    const out = child(theme), manifest = out.source?.manifest ?? out.manifest;
    manifest.windowTypes = {};
    return out;
  };
  for (const [environment, a, b] of [['own', old, current], ['base', sparse(old), sparse(current)], ['mixed', sparse(old), { ...sparse(current), base: old }]])
    for (const windowType of ['document-window', 'dialog', 'titled-utility-window', 'no-title-utility-window'])
      for (const state of ['active', 'inactive']) for (const scale of [1, 2]) {
        const options = { windowType, state, scale, title: 'Transport window', width: 97, height: 53 };
        window.spikeContext = { transport, slug, environment, options };
        const A = await windowSnapshot(runtime, a, options), B = await windowSnapshot(runtime, b, options);
        const difference = compareWindow(A, B);
        report.windows++;
        if (A.pixels && B.pixels) report.paintedWindows++; else report.baselineWindows++;
        if (difference) report.mismatches.push({ transport, slug, environment, options, difference });
      }
}

async function windowLifetimeProbe(runtime, report) {
  function synthetic(encoder) {
    const owner = createRasterAssetOwner([
      { path: 'document', width: 2, height: 3, rgba: new Uint8Array(2 * 3 * 4).fill(255) },
      { path: 'utility', width: 5, height: 7, rgba: new Uint8Array(5 * 7 * 4).fill(255) },
    ], encoder);
    const source = { manifest: { windowTypes: {}, chromeElements: {},
      patterns: { utility: { sourcePpatId: 42, asset: owner.references.get('utility') } },
      bodyBackground: { pattern: owner.references.get('document') } } };
    bindRasterOwner(source, owner);
    return { owner, theme: { kind: 'owned-theme', origin: '/synthetic', source, imageUrl: owner.imageUrl, dispose: owner.dispose } };
  }
  const ready = synthetic(encode);
  try {
    const win = await runtime.renderWindow(ready.theme, { windowType: 'titled-utility-window', scale: 2 });
    const body = win.querySelector('.scriptoscope-content');
    if (body.style.backgroundSize !== '4px 6px' || ready.owner.usage().images !== 1)
      throw new Error('Baseline utility sizing or selected-only CSS export changed');
    report.baselinePatterns++;
  } finally { ready.theme.dispose(); }
  let begin, release;
  const started = new Promise(resolve => { begin = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const pending = synthetic(async (...args) => { begin(); await held; return encode(...args); });
  const render = runtime.renderWindow(pending.theme, { windowType: 'titled-utility-window', scale: 2 });
  await started; pending.theme.dispose(); release();
  try { await render; throw new Error('Disposed pending CSS export published a window'); }
  catch (error) { if (error.name !== 'AbortError') throw error; }
  const usage = pending.owner.usage();
  if (usage.images || usage.pixelBytes || usage.pending) throw new Error('Pending window image export retained owned storage');
  report.pendingWindows++;
}

async function run() {
  const report = { runAt: new Date().toISOString(), userAgent: navigator.userAgent,
    rows: [], mismatches: [], errors: [], compared: 0, painted: 0, equalMissing: 0, equalErrors: 0, rasters: 0, disposedLoads: 0,
    baselinePatterns: 0, pendingWindows: 0, scrollbars: 0, paintedScrollbars: 0, missingScrollbars: 0, windows: 0, paintedWindows: 0, baselineWindows: 0, lazyWindows: 0, disposedWindows: 0, managedWindows: 0, diagnostics: 0, interactions: 0, zeroPngRenders: 0, bitmapPaints: 0 };
  for (const [transport, runtime] of [['source', source], ['built', built]]) for (const slug of slugs) {
    const input = await bytes(slug);
    const old = await runtime.loadKaleidoscopeScheme(input, { assetUrlFactory: encode });
    const current = await runtime.loadOwnedKaleidoscopeScheme(input);
    const before = report.rasters;
    const ownedUrls = urls(current.source);
    const bitmapFont = await runtime.prepareBitmapFont(fontData);
    const bitmapCases = [];
    for (const state of ['normal', 'pressed', 'disabled']) for (const clipped of [false, true])
      bitmapCases.push({ minWidth: 80, height: 20, default: true, label: 'A A', bitmapFont,
        pressed: state === 'pressed', disabled: state === 'disabled', ...(clipped ? { compositionContext: clip } : {}) });
    try {
      for (const [environment, a, b] of [['own', old, current], ['base', child(old), child(current)], ['mixed', child(old), { ...child(current), base: old }]])
        for (const options of [...ordinaryCases, ...bitmapCases]) {
            const A = await capture(runtime, a, options), B = await capture(runtime, b, options);
            const difference = A.error || B.error ? (A.error === B.error ? null : { old: A.error, current: B.error }) : compare(A.pixels, B.pixels);
            report.compared++;
            if (difference) report.mismatches.push({ transport, slug, environment, options, difference });
            else if (A.error) { report.equalErrors++; if (report.errors.length < 5) report.errors.push({ transport, slug, environment, options, error: A.error }); }
            else if (!A.pixels) report.equalMissing++;
            else { report.painted++; if (options.bitmapFont) report.bitmapPaints++; }
          }
      let clicks = 0;
      const button = await runtime.interactiveButton(current, { label: 'OK', onClick: () => clicks++ });
      document.body.append(button);
      if (button.tagName === 'BUTTON') button.click();
      else {
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      }
      button.remove();
      if (clicks !== 1) throw new Error('Owned interactive button failed activation');
      report.interactions++;
      if (rasterOwner(current.source).usage().images !== 0) throw new Error('Owned button rendering unexpectedly encoded PNGs');
      for (const orientation of ['horizontal', 'vertical']) for (const state of ['normal', 'pressed', 'disabled'])
        for (const length of [32, 121]) {
          const options = { orientation, state, length, value: 0.37 };
          const A = await runtime.composeScrollbar(old, options), B = await runtime.composeScrollbar(current, options);
          const difference = compare(A, B);
          report.scrollbars++;
          if (difference) report.mismatches.push({ transport, slug, family: 'scrollbar', options, difference });
          else if (A && B) report.paintedScrollbars++; else report.missingScrollbars++;
        }
      if (rasterOwner(current.source).usage().images !== 0) throw new Error('Owned scrollbar rendering unexpectedly encoded PNGs');
      report.zeroPngRenders++;
      await compareWindows(runtime, old, current, report, transport, slug);
      if (rasterOwner(current.source).usage().images > 2) throw new Error('Window rendering exported unrelated raster images');
      report.lazyWindows++;
      const manager = new runtime.WindowManager();
      const content = document.createElement('div'); content.append(button);
      const host = await manager.add(current, { title: 'Owned window', width: 97, height: 53 }, {}, { contentEl: content });
      document.body.append(host);
      try {
        if (manager.describe(host)?.theme !== current) throw new Error('WindowManager lost original theme identity');
        await manager.retheme(current);
        if (manager.describe(host)?.theme !== current || !content.contains(button) || !host.contains(content))
          throw new Error('Owned window retheme lost identity or consumer content');
        report.managedWindows++;
      } finally { manager.remove(host); host.remove(); }
      if (slug === slugs[0]) await windowLifetimeProbe(runtime, report);
      const priorImages = rasterOwner(current.source).usage().images;
      const firstRef = [...ownedUrls].find(ref => !ref.includes('/ppat')) ?? ownedUrls.values().next().value;
      const first = current.imageUrl(firstRef), same = current.imageUrl(firstRef);
      if (first !== same) throw new Error('Image exports did not share pending work');
      await first;
      if (rasterOwner(current.source).usage().images !== priorImages + 1) throw new Error('One image request encoded unrelated assets');
      let diagnostic;
      await runtime.composeButton(current, { default: true, label: 'OK', diagnostics: { onComplete: trace => { diagnostic = trace; } } });
      if (!diagnostic || privateImage(diagnostic)) throw new Error('Diagnostic image fields exposed private references');
      report.diagnostics++;
      // Materialize the exhaustive image comparison concurrently, matching the
      // eager adapter's worker pool instead of benchmarking serial PNG exports.
      const imageByRef = new Map(await Promise.all([...ownedUrls].map(async ref => [ref, await current.imageUrl(ref)])));
      // Every public image URL must remain decodable and agree with the direct
      // pixel source, rather than merely resembling the push-button outputs.
      for (const ref of ownedUrls) {
        const url = imageByRef.get(ref);
        const image = new Image(); image.src = url; await image.decode();
        const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight), context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const png = { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
        const raw = await runtime.loadCicnBuffer(ref);
        const difference = compare(png, raw);
        report.rasters++;
        if (difference) report.mismatches.push({ transport, slug, raster: ref, difference });
      }
    } finally { old.dispose(); current.dispose(); }
    // Cache and store must release the same owned identities in source and built copies.
    try {
      await runtime.loadCicnBuffer(ownedUrls.values().next().value);
      throw new Error('Disposed raster remained available');
    } catch (error) { if (error.message === 'Disposed raster remained available') throw error; }
    report.disposedLoads++;
    try { await runtime.renderWindow(current); throw new Error('Disposed window remained renderable'); }
    catch (error) { if (error.name !== 'AbortError') throw error; }
    report.disposedWindows++;
    report.rows.push({ transport, slug, rasters: report.rasters - before });
    document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
  }
  report.status = report.mismatches.length || report.painted !== report.compared || report.compared === 0 || report.windows !== slugs.length * 2 * 3 * 4 * 2 * 2 ? 'mismatch' : 'pass';
  return report;
}
window.spikeDone = run().then(report => {
  window.spikeReport = report;
  document.querySelector('p').textContent = `Production comparison: ${report.status}`;
  document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
}).catch(error => { window.spikeReport = { status: 'error', error: error?.stack ?? `${error?.name}: ${error?.message ?? String(error)}`, context: window.spikeContext }; });
