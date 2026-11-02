// #621 preparation cost observation; no fidelity claim or wall-clock gate.
// Run with Node 24: node --experimental-strip-types tests/rendering-options/region-preparation-cost.mjs
import { readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import '../../tests/helpers/registerTs.mjs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
const { PixelBuffer } = await import('../../src/pixelBuffer.ts');
const { composeWindowChrome } = await import('../../src/composeChrome.ts');
const { regionPath } = await import('../../src/hitRegion.ts');

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const measure = fn => {
  for (let i = 0; i < 5; i++) fn();
  const times = [];
  for (let i = 0; i < 15; i++) { const start = performance.now(); fn(); times.push(performance.now() - start); }
  return { medianMs: median(times), trialsMs: times };
};
const results = [];
for (const slug of ['dolphin-som', 'animals']) {
  const dir = new URL(`../../themes/${slug}/`, import.meta.url);
  const archive = ['scheme.sit', 'scheme.rsrc'].map(p => new URL(p, dir)).find(existsSync);
  const theme = await loadKaleidoscopeScheme(readFileSync(archive), { encodeAssets: false });
  const wt = theme.manifest.windowTypes['document-window'];
  const asset = theme.assets.find(a => a.path === wt.chrome.active);
  const template = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
  for (const [width, height] of [[320, 200], [1280, 800], [2400, 1600]]) {
    const compose = () => composeWindowChrome(template, wt, width, height, { titleWidthPx: 48 });
    const chrome = compose(), region = chrome.structure(), C = chrome.layout.C;
    // Compare the same region and band builder with/without known solid C.
    // Both produce one path; differing rectangle decomposition is allowed by HP19.
    const fullScan = measure(() => regionPath(region, 1));
    const frameScan = measure(() => regionPath(region, 1, C));
    const structure = measure(() => chrome.structure());
    const buildAndPath = measure(() => regionPath(chrome.structure(), 1, C));
    results.push({ slug, width, height, compose: measure(compose), structure, fullScan, frameScan, buildAndPath,
      pathLengths: { fullScan: regionPath(region, 1).length, frameScan: regionPath(region, 1, C).length } });
  }
}
console.log(JSON.stringify({ schema: 1, node: process.version, runner: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, cpus: os.cpus().length },
  claim: 'same-run preparation cost observation, not original-engine fidelity', gate: 'report-only', results }, null, 2));
