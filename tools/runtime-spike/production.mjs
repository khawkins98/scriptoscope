// Compare eager/owned transport and, when supplied, opaque historical renderers. The
// custom encoder deliberately opts out of the known-encoder pixel shortcut.
import { compareMounts } from './mounts.mjs';
import { rasterOwner, createRasterAssetOwner, bindRasterOwner } from '../theme-loader/rasterAssets.js';
const source = await import('../../src/index.ts');
const built = await import('/dist/scriptoscope.js');
const reference = new URLSearchParams(location.search).has('reference') ? await import('/runtime-reference.js') : null;
const { themeView } = await import('../../src/ownedTheme.ts');
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
function assetPaths(value, owner, found = new Set()) {
  if (typeof value === 'string') {
    try { owner.capture(value); found.add(value); } catch {}
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) assetPaths(child, owner, found);
  }
  return found;
}
function stable(value, key = '') {
  if (['assetUrl', 'sourceAssetUrl'].includes(key) && typeof value === 'string' && value) return '<image-export>';
  if (Array.isArray(value)) return value.map(child => stable(child));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => [name, stable(child, name)]));
  return value;
}
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
function compare(a, b) {
  if (!a || !b) return a === b ? null : 'availability';
  const A = a.buffer ?? a, B = b.buffer ?? b;
  if (!same(a.layout, b.layout)) return 'layout';
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
  return !same(a.layout, b.layout) ? 'window layout' : compare(a.pixels, b.pixels) ?? compare(a.tile, b.tile);
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
    layout: { frame: composed?.frame, placement: composed?.placement, widgets: composed?.widgets,
      width: win.style.width, height: win.style.height, content: content.style.cssText.replace(/background-image:[^;]+;?/, ''),
      hidden: content.hidden, inert: content.inert, role: win.getAttribute('role'), label: win.getAttribute('aria-label') } };
}
async function compareWindows(runtime, old, current, report, transport, slug, previous = runtime) {
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
        const A = await windowSnapshot(previous, a, options), B = await windowSnapshot(runtime, b, options);
        const difference = compareWindow(A, B);
        report.windows++;
        if (A.pixels && B.pixels) report.paintedWindows++; else report.baselineWindows++;
        if (difference) report.mismatches.push({ transport, slug, environment, options, difference,
          ...(difference === 'window layout' ? { referenceLayout: A.layout, currentLayout: B.layout } : {}) });
      }
}

async function windowLifetimeProbe(runtime, report) {
  function synthetic(encoder) {
    const owner = createRasterAssetOwner([
      { path: 'document', width: 2, height: 3, rgba: new Uint8Array(2 * 3 * 4).fill(255) },
      { path: 'utility', width: 5, height: 7, rgba: new Uint8Array(5 * 7 * 4).fill(255) },
    ], encoder);
    const source = { manifest: { windowTypes: {}, chromeElements: {},
      patterns: { utility: { sourcePpatId: 42, asset: 'utility' } },
      bodyBackground: { pattern: 'document' } } };
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

async function compareFamilies(runtime, old, current, report, transport, slug, previous = runtime) {
  const cases = [];
  for (const orientation of ['horizontal', 'vertical']) for (const length of [32, 121])
    for (const state of ['normal', 'pressed', 'disabled']) for (const value of [0, 0.37, 1])
      cases.push(['slider', 'composeSlider', { orientation, length, state, value }]);
  for (const length of [16, 121]) for (const state of ['normal', 'pressed', 'disabled']) {
    for (const value of [0, 0.37, 1]) cases.push(['progress', 'composeProgressFrame', { length, state, value }]);
    for (const phase of [0, 7, 255]) cases.push(['progress', 'composeProgressFrame', { length, state, indeterminate: true, phase }]);
  }
  for (const kind of ['checkbox', 'radio']) for (const disabled of [false, true]) for (const label of ['', 'Ag'])
    for (const value of kind === 'checkbox' ? [0, 1, 2] : [0, 1])
      cases.push(['checkable', 'composeCheckable', { disabled, label, checked: value === 1, mixed: value === 2 }, kind]);
  for (const direction of ['right', 'down']) for (const state of ['normal', 'pressed', 'disabled'])
    cases.push(['disclosure', 'composeDisclosure', { direction, state }]);
  for (const selected of [false, true]) for (const label of ['', 'Ag']) cases.push(['tab', 'composeTab', { selected, label }]);
  for (const on of [false, true]) for (const small of [false, true]) for (const state of ['normal', 'pressed', 'disabled'])
    for (const label of ['', 'Ag']) cases.push(['bevel', 'composeBevelButton', { on, small, label, pressed: state === 'pressed', disabled: state === 'disabled' }]);
  for (const state of ['normal', 'inactive']) cases.push(['grow', 'composeGrowBox', { state }]);
  for (const inactive of [false, true]) for (const height of [16, 30])
    cases.push(['headerColumns', 'composeListHeader', { inactive, height, columns: [{ label: 'A', width: 32 }, { label: 'B', width: 65 }] }]);
  for (const kind of ['window-header', 'list-view-header']) for (const drawState of [0, 1])
    for (const width of [32, 97]) for (const height of [16, 30]) for (const clipped of [false, true])
      cases.push(['headerSurface', 'composeHeaderSurface', { kind, drawState, width, height,
        compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [3, 5] },
          clip: { kind: 'rect', rect: { x: clipped ? 5 : 0, y: clipped ? 3 : 0, w: clipped ? 17 : width, h: clipped ? 7 : height } } } }]);
  const declaredChild = theme => {
    const out = child(theme), source = out.source ?? out;
    source.inspector = { cicnResources: [], iconMaskResources: [], iconColorResources: [] };
    return out;
  };
  const capture = async (api, theme, method, options, kind) => {
    try { return { pixels: await (kind ? api[method](theme, kind, options) : api[method](theme, options)) }; }
    catch (error) { return { error: `${error.name}: ${error.message}` }; }
  };
  for (const [environment, a, b] of [['own', old, current], ['base', child(old), child(current)], ['mixed', child(old), { ...child(current), base: old }],
    ['declaredBase', declaredChild(old), declaredChild(current)], ['declaredMixed', declaredChild(old), { ...declaredChild(current), base: old }]])
    for (const [family, method, options, kind] of cases) {
      if (environment.startsWith('declared') && family !== 'checkable') continue;
      const row = report.families[family] ??= { compared: 0, painted: 0, missing: 0, errors: 0, unsupported: 0, outcomes: {}, errorOutcomes: {} };
      const A = await capture(previous, a, method, options, kind), B = await capture(runtime, b, method, options, kind);
      let difference = A.error || B.error ? (A.error === B.error ? null : { old: A.error, current: B.error })
        : family === 'headerSurface' && (A.pixels.status !== B.pixels.status || A.pixels.reason !== B.pixels.reason) ? 'header admission'
        : family === 'headerSurface' && A.pixels.status !== 'rendered' ? null : compare(A.pixels, B.pixels);
      if (!difference && A.pixels && B.pixels && family === 'progress'
        && (A.pixels.phase !== B.pixels.phase || A.pixels.path !== B.pixels.path)) difference = 'progress phase/path';
      row.compared++;
      if (difference) report.mismatches.push({ transport, slug, family, environment, options, difference });
      else if (A.error) {
        // Deliberately unobserved sparse children are a declared unknown census,
        // distinct from declared-empty children and from successful paint.
        if (family === 'checkable' && ['base', 'mixed'].includes(environment) && A.error === 'Error: Unsupported checkable output: ics# census unavailable') row.unsupported++;
        else row.errors++;
        row.errorOutcomes[A.error] = (row.errorOutcomes[A.error] ?? 0) + 1; if (report.errors.length < 10) report.errors.push({ transport, slug, family, environment, options, error: A.error }); }
      else if (family === 'headerSurface' && A.pixels.status !== 'rendered') {
        const outcome = `${A.pixels.status}:${A.pixels.reason}`; row.outcomes[outcome] = (row.outcomes[outcome] ?? 0) + 1;
        if (A.pixels.status === 'unsupported') row.unsupported++; else row.missing++;
      } else if (!A.pixels) row.missing++; else row.painted++;
    }
}

let progress;
async function run() {
  const report = { runAt: new Date().toISOString(), userAgent: navigator.userAgent,
    comparison: reference ? 'historical-public-renderers' : 'current-eager-versus-owned', diagnosticComparisons: 0, rows: [], mismatches: [], errors: [], compared: 0, painted: 0, equalMissing: 0, equalErrors: 0, rasters: 0, referenceRasters: 0, disposedLoads: 0,
    families: {}, familyDiagnostics: 0, baselinePatterns: 0, pendingWindows: 0, scrollbars: 0, paintedScrollbars: 0, missingScrollbars: 0, windows: 0, paintedWindows: 0, baselineWindows: 0, lazyWindows: 0, disposedWindows: 0, managedWindows: 0, diagnostics: 0, interactions: 0, zeroPngRenders: 0, bitmapPaints: 0 };
  progress = report;
  for (const [transport, runtime] of [['source', source], ['built', built]]) for (const slug of slugs) {
    const input = await bytes(slug);
    const previous = reference ?? runtime;
    const referenceImages = [];
    const referenceEncoder = async (...args) => {
      const item = { path: args[3] }; referenceImages.push(item);
      item.url = await encode(...args); return item.url;
    };
    const old = await previous.loadKaleidoscopeScheme(input, { assetUrlFactory: reference ? referenceEncoder : encode });
    const referenceImageByPath = new Map(referenceImages.map(item => [item.path, item.url]));
    const current = await runtime.loadOwnedKaleidoscopeScheme(input);
    const before = report.rasters;
    const ownedUrls = assetPaths(current.source, rasterOwner(current.source));
    const disposedSource = themeView(current).asset(ownedUrls.values().next().value);
    const bitmapFont = await runtime.prepareBitmapFont(fontData);
    const previousFont = reference ? await previous.prepareBitmapFont(fontData) : bitmapFont;
    const bitmapCases = [];
    for (const state of ['normal', 'pressed', 'disabled']) for (const clipped of [false, true])
      bitmapCases.push({ minWidth: 80, height: 20, default: true, label: 'A A', bitmapFont,
        pressed: state === 'pressed', disabled: state === 'disabled', ...(clipped ? { compositionContext: clip } : {}) });
    try {
      for (const [environment, a, b] of [['own', old, current], ['base', child(old), child(current)], ['mixed', child(old), { ...child(current), base: old }]])
        for (const options of [...ordinaryCases, ...bitmapCases]) {
            const beforeOptions = options.bitmapFont ? { ...options, bitmapFont: previousFont } : options;
            const A = await capture(previous, a, beforeOptions), B = await capture(runtime, b, options);
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
          const A = await previous.composeScrollbar(old, options), B = await runtime.composeScrollbar(current, options);
          const difference = compare(A, B);
          report.scrollbars++;
          if (difference) report.mismatches.push({ transport, slug, family: 'scrollbar', options, difference });
          else if (A && B) report.paintedScrollbars++; else report.missingScrollbars++;
        }
      if (rasterOwner(current.source).usage().images !== 0) throw new Error('Owned scrollbar rendering unexpectedly encoded PNGs');
      await compareFamilies(runtime, old, current, report, transport, slug, previous);
      if (rasterOwner(current.source).usage().images !== 0) throw new Error('Owned family rendering unexpectedly encoded PNGs');
      report.zeroPngRenders++;
      await compareWindows(runtime, old, current, report, transport, slug, previous);
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
      const first = current.imageUrl(firstRef), shared = current.imageUrl(firstRef);
      if (first !== shared) throw new Error('Image exports did not share pending work');
      await first;
      if (rasterOwner(current.source).usage().images !== priorImages + 1) throw new Error('One image request encoded unrelated assets');
      for (const state of ['normal', 'pressed', 'disabled']) for (const ring of [false, true])
        for (const clipped of [false, true]) for (const minWidth of [32, 180]) for (const bitmap of [false, true]) {
          const options = { minWidth, height: 20, default: ring, label: bitmap ? 'A A' : 'OK',
            pressed: state === 'pressed', disabled: state === 'disabled', ...(clipped ? { compositionContext: clip } : {}) };
          let diagnostic, expected; let completed = 0, beforeCompleted = 0;
          await runtime.composeButton(current, { ...options, ...(bitmap ? { bitmapFont } : {}), diagnostics: { onComplete(trace) { completed++; diagnostic = trace; } } });
          await previous.composeButton(old, { ...options, ...(bitmap ? { bitmapFont: previousFont } : {}), diagnostics: { onComplete(trace) { beforeCompleted++; expected = trace; } } });
          if (!diagnostic || privateImage(diagnostic)) throw new Error('Diagnostic image fields exposed private references');
          report.diagnostics++; report.diagnosticComparisons++;
          if (completed !== 1 || beforeCompleted !== 1 || !same(diagnostic, expected))
            report.mismatches.push({ transport, slug, family: 'button-diagnostics', options, difference: { current: stable(diagnostic), reference: stable(expected) } });
        }
      for (const [method, options] of [['composeTab', { selected: true, label: 'Ag' }], ['composeBevelButton', { label: 'Ag' }],
        ['composeHeaderSurface', { kind: 'window-header', width: 97, height: 30, drawState: 1,
          compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [0, 0] },
            clip: { kind: 'rect', rect: { x: 0, y: 0, w: 97, h: 30 } } } }]]) {
        let completed = 0, trace;
        await runtime[method](current, { ...options, diagnostics: { onComplete(value) { completed++; trace = value; } } });
        if (completed !== 1 || !trace || privateImage(trace)) throw new Error(`Invalid owned diagnostics: ${method}`);
        let expected, beforeCompleted = 0;
        await previous[method](old, { ...options, diagnostics: { onComplete(value) { beforeCompleted++; expected = value; } } });
        report.diagnosticComparisons++;
        if (beforeCompleted !== 1 || !same(trace, expected)) report.mismatches.push({ transport, slug, family: method + '-diagnostics', difference: { current: stable(trace), reference: stable(expected) } });
        report.familyDiagnostics++;
      }
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
        const raw = await themeView(current).asset(ref).pixels();
        const difference = compare(png, raw);
        report.rasters++;
        if (difference) report.mismatches.push({ transport, slug, raster: ref, difference });
        if (reference) {
          if (!referenceImageByPath.has(ref)) throw new Error('Reference export path missing: ' + ref);
          const expected = await runtime.loadCicnBuffer(referenceImageByPath.get(ref));
          const difference = compare(expected, raw);
          report.referenceRasters++;
          if (difference) report.mismatches.push({ transport, slug, referenceRaster: ref, difference });
        }
      }
    } finally { old.dispose(); current.dispose(); }
    // Cache and store must release the same owned identities in source and built copies.
    try {
      await disposedSource.pixels();
      throw new Error('Disposed raster remained available');
    } catch (error) { if (error.message === 'Disposed raster remained available') throw error; }
    report.disposedLoads++;
    try { await runtime.renderWindow(current); throw new Error('Disposed window remained renderable'); }
    catch (error) { if (error.name !== 'AbortError') throw error; }
    report.disposedWindows++;
    report.rows.push({ transport, slug, rasters: report.rasters - before });
    document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
  }
  report.rendererComparisons = reference ? report.compared + report.windows + report.scrollbars + Object.values(report.families).reduce((sum, row) => sum + row.compared, 0) : 0;
  for (const [transport, runtime] of [['source', source], ['built', built]]) await compareMounts(runtime, slugs, report, compare, transport);
  report.status = report.mismatches.length || report.painted !== report.compared || report.compared === 0 || Object.values(report.families).some(row => row.errors || !row.compared) || report.windows !== slugs.length * 2 * 3 * 4 * 2 * 2 ? 'mismatch' : 'pass';
  return report;
}
window.spikeDone = run().then(report => {
  window.spikeReport = report;
  document.querySelector('p').textContent = `Production comparison: ${report.status}`;
  document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
}).catch(error => { window.spikeReport = { ...progress, status: 'error', error: error?.stack ?? `${error?.name}: ${error?.message ?? String(error)}`, context: window.spikeContext }; });
