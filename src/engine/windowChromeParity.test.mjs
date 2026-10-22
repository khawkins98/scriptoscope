// Behaviour-neutrality lock for the v2 engine re-point (lane L4).
//
// The baseline file was generated from the pre-engine composeWindowChrome
// (origin/v2 87bd335d) by running this file with SCRIPTOSCOPE_WRITE_PARITY=1
// BEFORE composeChrome.ts was re-pointed at src/engine/qd. Every sliced window
// type of every archive that ships wnd# recipes, both states, at native,
// 97x53, 240x120 and 320x160 content sizes, with and without a measured title
// width, must still produce byte-identical buffers and placement maps.
//
// Recorded changes (windowChromeParity.changes.json): the 2026-10-22 main→v2
// sync brought main #377 (code-10 too-short step). Exactly four keys change,
// each only in below-template subcases; every entry there names its subcases
// and the spec rows that cause it, and the test checks that each listed
// subcase is below the template and that the baseline holds the recorded hash.
// The placement `segment` field that #377 added (the 0x5cb6 widget-remap
// segment index, covered by src/titleWidgets.test.mjs) is left out of the
// digest, so every other key keeps its exact pre-sync hash.
import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';

const { PixelBuffer } = await import('../pixelBuffer.ts');
const { composeWindowChrome } = await import('../composeChrome.ts');
const BASELINE = new URL('./windowChromeParity.baseline.json', import.meta.url);
const CHANGES = new URL('./windowChromeParity.changes.json', import.meta.url);
const SIZES = tmpl => [tmpl, [97, 53], [240, 120], [320, 160]];
const themesDir = new URL('../../themes/', import.meta.url);

async function digests() {
  const out = {};
  for (const slug of readdirSync(themesDir).sort()) {
    const path = ['scheme.sit', 'scheme.rsrc'].map(f => new URL(`${slug}/${f}`, themesDir)).find(existsSync);
    if (!path) continue;
    const decoded = await loadKaleidoscopeScheme(readFileSync(path), { encodeAssets: false });
    for (const [type, wt] of Object.entries(decoded.manifest.windowTypes ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (wt.model === 'corner-sprite' || !wt.edges || !wt.parts?.['part-0']) continue;
      for (const state of Object.keys(wt.chrome ?? {}).sort()) {
        const asset = decoded.assets.find(a => a.path === wt.chrome[state]);
        if (!asset?.rgba) continue;
        const [l, t, r, b] = wt.parts['part-0'].rect;
        const hash = createHash('sha256');
        for (const [w, h] of SIZES([r - l, b - t])) for (const titleWidthPx of [0, 60]) {
          const source = new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
          let c;
          try { c = composeWindowChrome(source, wt, Math.max(0, w), Math.max(0, h), { titleWidthPx }); }
          catch (e) { hash.update(`throw:${e.message}`); continue; }
          hash.update(`${c.fullWidth}x${c.fullHeight}|`).update(c.buffer.data)
            .update(JSON.stringify([c.frame, c.titleRegion, c.titleFillSrcX, c.titleFillRgb, c.placement.map(({ segment, ...slice }) => slice)]));
        }
        out[`${slug}/${type}/${state}`] = hash.digest('hex');
      }
    }
  }
  return out;
}

test('composeWindowChrome is byte-identical to the pre-engine baseline (every sliced type, both states, 8 size/title cases)', async () => {
  const now = await digests();
  if (process.env.SCRIPTOSCOPE_WRITE_PARITY === '1') {
    writeFileSync(BASELINE, JSON.stringify(now, null, 1) + '\n');
    return;
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  assert.ok(Object.keys(base).length > 100, `baseline covers ${Object.keys(base).length} cases`);
  assert.deepEqual(Object.keys(now).sort(), Object.keys(base).sort());
  const drift = Object.keys(base).filter(k => base[k] !== now[k]);
  assert.deepEqual(drift, []);
});

test('recorded parity changes are below-template only and match the baseline', () => {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const { changes } = JSON.parse(readFileSync(CHANGES, 'utf8'));
  assert.ok(changes.length > 0);
  for (const c of changes) {
    assert.equal(base[c.key], c.to, `${c.key}: baseline holds the recorded hash`);
    assert.notEqual(c.from, c.to, c.key);
    assert.ok(c.rules.length > 0 && c.subcases.length > 0, c.key);
    const [tw, th] = c.template.split('x').map(Number);
    for (const sub of c.subcases) {
      const [w, h] = sub.size.split('x').map(Number);
      assert.ok(w < tw || h < th, `${c.key} ${sub.size}: a recorded change must be below the ${c.template} template`);
      assert.ok(SIZES([tw, th]).some(([x, y]) => x === w && y === h) && [0, 60].includes(sub.titleWidthPx), `${c.key} ${sub.size}: not a sampled subcase`);
    }
  }
});
