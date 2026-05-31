// Vite's static asset handling only catches things it can statically
// resolve at build time (CSS `url()` in linked stylesheets, `<img src>`,
// imports). Our demo references many cicn / ppat PNGs through CSS
// `url()` calls inside CSS custom properties in inline `<style>` blocks
// — those don't get picked up. Same for the theme.json files fetched
// dynamically at runtime.
//
// Simpler than configuring publicDir for two specific subdirectories is
// just to copy them verbatim after the build. This keeps the relative
// `assets/themes/<name>/<file>` URLs the demo's CSS uses working as-is.

import { cp, mkdir, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outAssets = resolve(root, 'dist/demo/assets');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}
async function copy(src, dst) {
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true });
  console.log(`  copied ${src.replace(root + '/', '')} → ${dst.replace(root + '/', '')}`);
}

await mkdir(outAssets, { recursive: true });
// Reference screenshots fetched by <img src> in the demo.
await copy(
  resolve(root, 'demo/assets/references'),
  resolve(outAssets, 'references'),
);

// themes-manifest.json — the canonical theme catalog the README's integration guide
// publicizes at https://khawkins98.github.io/aaron-ui/themes-manifest.json. Vite bundles
// it as a JSON import for the demos, but the published URL itself needs a static copy.
if (await exists(resolve(root, 'demo/themes-manifest.json'))) {
  await copy(
    resolve(root, 'demo/themes-manifest.json'),
    resolve(root, 'dist/demo/themes-manifest.json'),
  );
}

// llms.txt — the LLM-agent discovery file (https://llmstxt.org standard).
// Lives at the repo root for humans + dev tools; copied to dist/demo so it's
// also fetchable at https://khawkins98.github.io/aaron-ui/llms.txt for any
// LLM agent helping a consumer integrate Scriptoscope. The file curates
// pointers to README + integration docs + recipes + API surface — gives an
// agent a single canonical starting point instead of guessing across the repo.
if (await exists(resolve(root, 'llms.txt'))) {
  await copy(
    resolve(root, 'llms.txt'),
    resolve(root, 'dist/demo/llms.txt'),
  );
}

// Bundled font referenced by the @font-face (the OFL Charcoal stand-in).
if (await exists(resolve(root, 'demo/assets/fonts'))) {
  await copy(resolve(root, 'demo/assets/fonts'), resolve(outAssets, 'fonts'));
}

// Canonical theme bundles (themes/<slug>/) — served at /themes/ in dev via
// the serveThemesPlugin in vite.config.js and copied here for the gh-pages
// deploy so loadTheme('/themes/<slug>/') works at production URLs.
//
// Option A (2026-05-29): we ship ONLY the source-of-truth files —
//   scheme.rsrc   (the original Kaleidoscope resource fork, decoded in-browser)
//   meta.json     (author/origin/license/notes)
//   PROVENANCE.md (the readme/notes from the upstream archive)
// — and NOT the pre-extracted derivatives (theme.json, cicns/, ppats/, icons/,
// resource-roles.json, rasters.json, extraction-manifest.json, diag/). The
// runtime decodes scheme.rsrc on the fly via loadKaleidoscopeScheme; shipping
// the derivatives would just bloat the demo download (~3 MB → ~700 KB per theme)
// and risk re-distributing pre-decoded art the original authors didn't intend
// to ship as PNGs. A bundle is considered "shippable" iff scheme.rsrc exists.
const outThemes = resolve(root, 'dist/demo/themes');
await mkdir(outThemes, { recursive: true });
const themesDir = resolve(root, 'themes');
// Prefer .sit (the original StuffIt the author published — palatable, ~half the
// size of the unwrapped fork) and fall back to .rsrc for bundles where the
// upstream .sit is no longer reachable (wayback-recovered schemes).
const BUNDLE_SHIP_FILES = ['scheme.sit', 'scheme.rsrc', 'meta.json', 'PROVENANCE.md'];
for (const slug of await readdir(themesDir)) {
  const srcDir = resolve(themesDir, slug);
  const hasSit = await exists(resolve(srcDir, 'scheme.sit'));
  const hasRsrc = await exists(resolve(srcDir, 'scheme.rsrc'));
  if (!hasSit && !hasRsrc) continue;
  const dstDir = resolve(outThemes, slug);
  await mkdir(dstDir, { recursive: true });
  for (const f of BUNDLE_SHIP_FILES) {
    const src = resolve(srcDir, f);
    if (await exists(src)) await copy(src, resolve(dstDir, f));
  }
}

// ── Library files for integrators ──────────────────────────────────────
// The published GH Pages deploy doubles as a stable URL host for the
// runtime itself — consumers who want to integrate Scriptoscope into
// their own page can `<script type="module">import from "https://
// khawkins98.github.io/aaron-ui/scriptoscope.js"</script>` without
// installing from npm. Copy the built library + CSS + the in-browser
// theme decoder (for BYO theme uploads) so all the integration paths
// the README documents resolve to real files.
//
// Pre-req: `npm run build` must have produced dist/scriptoscope.{js,css}
// before this script runs. The build:demo npm script handles that ordering.
const libFiles = [
  ['dist/scriptoscope.js', 'dist/demo/scriptoscope.js'],
  ['dist/scriptoscope.js.map', 'dist/demo/scriptoscope.js.map'],
  ['dist/scriptoscope.css', 'dist/demo/scriptoscope.css'],
];
for (const [src, dst] of libFiles) {
  if (await exists(resolve(root, src))) {
    await copy(resolve(root, src), resolve(root, dst));
  } else {
    console.warn(`  ⚠  ${src} not found — run \`npm run build\` first to populate dist/`);
  }
}

// The in-browser theme decoder (StuffIt WASM + the pure-JS theme-loader).
// Lets a consumer wire their own drop-zone using `attachThemeDropZone` +
// `loadKaleidoscopeScheme`, served from the same CDN as the runtime.
//
// theme-loader: the whole directory minus tests (browser doesn't need them).
// sit-wasm: index.mjs (the JS wrapper) + dist/munbox.{mjs,wasm} (the WASM).
//          loadKaleidoscopeScheme imports '../sit-wasm/index.mjs', which then
//          imports './dist/munbox.mjs' — so we need both paths populated.
const decoderDirs = [
  ['tools/theme-loader', 'dist/demo/theme-loader'],
];
for (const [src, dst] of decoderDirs) {
  if (await exists(resolve(root, src))) {
    await copy(resolve(root, src), resolve(root, dst));
  }
}
// sit-wasm — copy the JS wrapper + the dist/ artefacts (the WASM blob).
// We DON'T copy the munbox/ source directory (C code, MIT/PATCHES.md) — those
// are repo-only, not needed at runtime.
if (await exists(resolve(root, 'tools/sit-wasm/index.mjs'))) {
  await copy(resolve(root, 'tools/sit-wasm/index.mjs'), resolve(root, 'dist/demo/sit-wasm/index.mjs'));
  await copy(resolve(root, 'tools/sit-wasm/dist'), resolve(root, 'dist/demo/sit-wasm/dist'));
}

console.log('Demo assets copied.');
