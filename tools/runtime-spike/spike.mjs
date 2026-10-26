// Compare the production owned loader against explicit historical PNG transport.
import { loadKaleidoscopeScheme, loadOwnedKaleidoscopeScheme } from '../../src/loadKaleidoscopeScheme.ts';
import { composeButtonWithLayout as composeEnginePush } from '../../src/controls.ts';
import { themeView } from '../../src/ownedTheme.ts';
import { rasterOwner } from '../theme-loader/rasterAssets.js';
import { PixelBuffer } from '../../src/pixelBuffer.ts';

const slugs = Object.keys(import.meta.glob('../../themes/*/meta.json')).map(p => p.split('/')[3]).sort();
const cases = [];
for (const width of [32, 80, 180]) for (const state of ['normal', 'pressed', 'disabled'])
  for (const ring of [false, true]) for (const label of ['', 'AgjpQy'])
    cases.push({ minWidth: width, height: 20, pressed: state === 'pressed', disabled: state === 'disabled', default: ring, label });

function summary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted.at(-1) };
}
function compare(a, b) {
  if (!a || !b) return a === b ? null : 'availability';
  if (JSON.stringify(a.layout) !== JSON.stringify(b.layout)) return 'layout';
  if (a.buffer.width !== b.buffer.width || a.buffer.height !== b.buffer.height) return 'dimensions';
  let changed = 0, visible = 0;
  for (let i = 0; i < a.buffer.data.length; i += 4) {
    if (a.buffer.data.slice(i, i + 4).some((v, j) => v !== b.buffer.data[i + j])) {
      changed++;
      if (a.buffer.data[i + 3] || b.buffer.data[i + 3]) visible++;
    }
  }
  return changed ? { changedPixels: changed, visiblePixels: visible } : null;
}
async function render(theme, options) {
  try { return { output: await composeEnginePush(theme, options) }; }
  catch (e) { return { error: `${e.name}: ${e.message}` }; }
}
async function source(slug) {
  for (const ext of ['sit', 'rsrc']) {
    const res = await fetch(`/themes/${slug}/scheme.${ext}`);
    if (res.ok && !(res.headers.get('content-type') ?? '').includes('text/html')) return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`No archive: ${slug}`);
}
async function load(bytes, direct) {
  const start = performance.now();
  const theme = await (direct ? loadOwnedKaleidoscopeScheme(bytes) : loadKaleidoscopeScheme(bytes, { assetUrlFactory: encodePng }));
  const owner = direct ? rasterOwner(theme.source) : undefined;
  const usage = owner?.usage();
  return { theme, ms: performance.now() - start, assets: usage?.rasters ?? 0,
    rawBytes: usage?.pixelBytes ?? 0, captured: direct ? themeView(theme).asset(Object.values(theme.source.manifest.chromeElements).find(el => el.asset)?.asset) : undefined };
}
// Explicit custom factory keeps the comparison on the historical image-decode
// path even when the production loader also retains its built-in encoder pixels.
async function encodePng(rgba, width, height) {
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  pixels.data.set(rgba); context.putImageData(pixels, 0, 0);
  return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
}
async function run() {
  const report = { runAt: new Date().toISOString(), userAgent: navigator.userAgent,
    repetitions: 3, casesPerTheme: cases.length, comparatorProbe: false, disposedLoads: 0,
    rows: [], mismatches: [], compared: 0, equalErrors: 0, equalMissing: 0, painted: 0 };
  for (const slug of slugs) {
    const bytes = await source(slug);
    const times = { pngLoad: [], directLoad: [], pngFirst: [], directFirst: [], pngWarm: [], directWarm: [] };
    let assets, rawBytes;
    for (let repetition = 0; repetition < report.repetitions; repetition++) {
      const pair = {};
      // Alternate transport order to reduce systematic warmup/order bias.
      for (const kind of repetition % 2 ? ['direct', 'png'] : ['png', 'direct']) {
        const loaded = await load(bytes, kind === 'direct');
        pair[kind] = loaded;
        times[`${kind}Load`].push(loaded.ms);
        const first = performance.now();
        await render(loaded.theme, cases[0]);
        times[`${kind}First`].push(performance.now() - first);
      }
      try {
        // Warm every state/resource and label path before measuring warm calls.
        for (const options of cases) for (const kind of ['png', 'direct']) await render(pair[kind].theme, options);
        for (const options of cases) {
          const outputs = {};
          for (const kind of repetition % 2 ? ['direct', 'png'] : ['png', 'direct']) {
            const start = performance.now();
            outputs[kind] = await render(pair[kind].theme, options);
            times[`${kind}Warm`].push(performance.now() - start);
          }
          const a = outputs.png, b = outputs.direct;
          if (!report.comparatorProbe && a.output) {
            const original = a.output;
            const mutated = new PixelBuffer(original.buffer.width, original.buffer.height, original.buffer.data.slice());
            mutated.data[0] ^= 1;
            if (!compare(original, { ...original, buffer: mutated })
              || !compare(original, { ...original, layout: {} }) || !compare(original, null))
              throw new Error('Comparator failed its pixel/layout/availability mutation probes');
            report.comparatorProbe = true;
          }
          const difference = a.error || b.error ? (a.error === b.error ? null : { png: a.error, direct: b.error }) : compare(a.output, b.output);
          report.compared++;
          if (difference) report.mismatches.push({ slug, repetition, options, difference });
          else if (a.error) report.equalErrors++;
          else if (!a.output) report.equalMissing++;
          else report.painted++;
        }
        assets = pair.direct.assets; rawBytes = pair.direct.rawBytes;
      } finally {
        pair.png.theme.dispose(); pair.direct.theme.dispose();
      }
      // A released identity must no longer resolve to the retained raw buffer.
      let rejected = false;
      try { await pair.direct.captured.pixels(); } catch { rejected = true; }
      if (!rejected) throw new Error('Disposed direct raster remained cached');
      report.disposedLoads++;
    }
    report.rows.push({ slug, assets, rawBytes, ...Object.fromEntries(Object.entries(times).map(([k, v]) => [k, summary(v)])) });
    document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
  }
  report.status = report.mismatches.length ? 'mismatch' : 'pass';
  return report;
}
window.spikeDone = run().then(report => {
  window.spikeReport = report;
  document.querySelector('p').textContent = `Finished: ${report.status}`;
  document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
  return report;
}).catch(error => {
  window.spikeReport = { status: 'error', error: error.stack };
  document.querySelector('#result').textContent = error.stack;
});
