// Compare the production owner with explicit historical PNG transport. The
// custom encoder deliberately opts out of the known-encoder pixel shortcut.
const source = await import('../../src/index.ts');
const built = await import('/dist/scriptoscope.js');
const slugs = Object.keys(import.meta.glob('../../themes/*/meta.json')).map(p => p.split('/')[3]).sort();
const clip = { controlOrigin: [23, 41], portOrigin: [5, -7], patternOrigin: { status: 'known', offset: [3, 5] },
  clip: { kind: 'rect', rect: { x: 25, y: 43, w: 20, h: 10 } } };

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
  if (typeof value === 'string' && value.startsWith('blob:')) found.add(value);
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
  return { baseUrl: '/synthetic-sparse-child', manifest: { ...base.manifest, chromeElements: {}, patterns: {}, engineCinfs: {} }, base };
}
async function run() {
  const report = { runAt: new Date().toISOString(), userAgent: navigator.userAgent,
    rows: [], mismatches: [], errors: [], compared: 0, painted: 0, equalMissing: 0, equalErrors: 0, rasters: 0, disposedLoads: 0 };
  for (const [transport, runtime] of [['source', source], ['built', built]]) for (const slug of slugs) {
    const input = await bytes(slug);
    const old = await runtime.loadKaleidoscopeScheme(input, { assetUrlFactory: encode });
    const current = await runtime.loadKaleidoscopeScheme(input);
    const before = report.rasters;
    const ownedUrls = urls([current.manifest, current.inspector, current.glyphs]);
    try {
      // Every public image URL must remain decodable and agree with the direct
      // pixel source, rather than merely resembling the push-button outputs.
      for (const url of ownedUrls) {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight), context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const png = { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
        const raw = await runtime.loadCicnBuffer(url);
        const difference = compare(png, raw);
        report.rasters++;
        if (difference) report.mismatches.push({ transport, slug, raster: url, difference });
      }
      for (const [environment, a, b] of [['own', old, current], ['base', child(old), child(current)]])
        for (const minWidth of [32, 80, 180]) for (const state of ['normal', 'pressed', 'disabled'])
          for (const ring of [false, true]) for (const label of ['', 'AgjpQy']) for (const clipped of [false, true]) {
            const options = { minWidth, height: 20, pressed: state === 'pressed', disabled: state === 'disabled', default: ring, label,
              ...(clipped ? { compositionContext: clip } : {}) };
            const A = await capture(runtime, a, options), B = await capture(runtime, b, options);
            const difference = A.error || B.error ? (A.error === B.error ? null : { old: A.error, current: B.error }) : compare(A.pixels, B.pixels);
            report.compared++;
            if (difference) report.mismatches.push({ transport, slug, environment, options, difference });
            else if (A.error) { report.equalErrors++; if (report.errors.length < 5) report.errors.push({ transport, slug, environment, options, error: A.error }); }
            else if (!A.pixels) report.equalMissing++;
            else report.painted++;
          }
    } finally { old.dispose(); current.dispose(); }
    // Cache and store must release the same owned identities in source and built copies.
    try {
      await runtime.loadCicnBuffer(ownedUrls.values().next().value);
      throw new Error('Disposed raster remained available');
    } catch (error) { if (error.message === 'Disposed raster remained available') throw error; }
    report.disposedLoads++;
    report.rows.push({ transport, slug, rasters: report.rasters - before });
    document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
  }
  report.status = report.mismatches.length || report.painted !== report.compared || report.compared === 0 ? 'mismatch' : 'pass';
  return report;
}
window.spikeDone = run().then(report => {
  window.spikeReport = report;
  document.querySelector('p').textContent = `Production comparison: ${report.status}`;
  document.querySelector('#result').textContent = JSON.stringify(report, null, 2);
}).catch(error => { window.spikeReport = { status: 'error', error: error.stack }; });
