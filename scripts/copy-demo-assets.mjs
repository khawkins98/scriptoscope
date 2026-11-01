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

import { cp, mkdir, readdir, access, readFile, writeFile } from 'node:fs/promises';
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

// Period advertisement shown on inspiration.html (also linkable directly).
await copy(
  resolve(root, 'demo/assets/landing/inspiration-apple-new-media-forum-1995.jpg'),
  resolve(outAssets, 'landing/inspiration-apple-new-media-forum-1995.jpg'),
);

// themes-manifest.json — the canonical theme catalog the README's integration guide
// publicizes at https://khawkins98.github.io/scriptoscope/themes-manifest.json. Vite bundles
// it as a JSON import for the demos, but the published URL itself needs a static copy.
if (await exists(resolve(root, 'demo/themes-manifest.json'))) {
  await copy(
    resolve(root, 'demo/themes-manifest.json'),
    resolve(root, 'dist/demo/themes-manifest.json'),
  );
}

// llms.txt — the LLM-agent discovery file (https://llmstxt.org standard).
// Lives at the repo root for humans + dev tools; copied to dist/demo so it's
// also fetchable at https://khawkins98.github.io/scriptoscope/llms.txt for any
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

// First-party schemes (authoring/schemes/<slug>/, original designs) for the
// showcase's separate "First-party schemes" strip. Only the built fork and
// meta.json ship; the build scripts, concepts and classic screenshots don't.
// They stay out of themes/ so the corpus manifest and gates never list them.
const authoredDir = resolve(root, 'authoring/schemes');
for (const slug of await readdir(authoredDir)) {
  const srcDir = resolve(authoredDir, slug);
  if (!(await exists(resolve(srcDir, 'scheme.rsrc')))) continue;
  const dstDir = resolve(root, 'dist/demo/authoring/schemes', slug);
  await mkdir(dstDir, { recursive: true });
  for (const f of ['scheme.rsrc', 'meta.json']) await copy(resolve(srcDir, f), resolve(dstDir, f));
}

// ── Library files for integrators ──────────────────────────────────────
// The published GH Pages deploy doubles as a stable URL host for the
// runtime itself — consumers who want to integrate Scriptoscope into
// their own page can `<script type="module">import from "https://
// khawkins98.github.io/scriptoscope/scriptoscope.js"</script>` without
// installing from npm. Copy the built library + CSS + the in-browser
// theme decoder (for BYO theme uploads) so all the integration paths
// the README documents resolve to real files.
//
// Pre-req: `npm run build` must have produced dist/scriptoscope.{js,css}
// before this script runs. The build:demo npm script handles that ordering.
// Include every emitted JS chunk next to the public entry. The StuffIt decoder
// is dynamically imported from a hashed sibling chunk; copying only the entry
// makes CDN consumers fail as soon as they load a .sit theme.
const libFiles = (await readdir(resolve(root, 'dist'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:js|js\.map|css)$/.test(entry.name));
if (!libFiles.some((entry) => entry.name === 'scriptoscope.js')) {
  throw new Error('dist/scriptoscope.js not found — run `npm run build` first');
}
for (const { name } of libFiles) {
  await copy(resolve(root, 'dist', name), resolve(root, 'dist/demo', name));
}

// The in-browser theme decoder (StuffIt WASM + the pure-JS theme-loader).
// Lets a consumer wire their own drop-zone using `attachThemeDropZone` +
// `loadKaleidoscopeScheme`, served from the same CDN as the runtime.
//
// theme-loader: the whole directory (tests included; nothing imports them),
//          with loadKaleidoscopeScheme.js replaced by the built wrapper below.
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
// #431: the published theme-loader/loadKaleidoscopeScheme.js is the public
// wrapper (src/loadKaleidoscopeScheme.ts, engine cinf ids on by default), not
// the raw core, which leaves engineCinfIds off and so hands every slider to the
// Platinum fallback. vite.loader.config.js bundles the wrapper with the core
// into one module; overwrite the copied core with it so the existing URL (and
// theme-loader/index.js, which re-exports it) gives engine cinfs by default.
const pagesLoader = resolve(root, 'dist/pages-loader/loadKaleidoscopeScheme.js');
if (!(await exists(pagesLoader))) {
  throw new Error('dist/pages-loader/loadKaleidoscopeScheme.js not found — run `vite build --config vite.loader.config.js` first');
}
await copy(pagesLoader, resolve(root, 'dist/demo/theme-loader/loadKaleidoscopeScheme.js'));
// sit-wasm — copy the JS wrapper + the dist/ artefacts (the WASM blob).
// We DON'T copy the munbox/ source directory (C code, MIT/PATCHES.md) — those
// are repo-only, not needed at runtime.
if (await exists(resolve(root, 'tools/sit-wasm/index.mjs'))) {
  await copy(resolve(root, 'tools/sit-wasm/index.mjs'), resolve(root, 'dist/demo/sit-wasm/index.mjs'));
  await copy(resolve(root, 'tools/sit-wasm/dist'), resolve(root, 'dist/demo/sit-wasm/dist'));
}

console.log('Demo assets copied.');

// Published application host examples use the same copied runtime graph.
// Keep these source modules readable and stable for copied installation pages.
for (const name of ['explicit-host.mjs', 'explicit-layout.mjs']) {
  const source = await readFile(resolve(root, 'demo', name), 'utf8');
  const hosted = source.replaceAll("from 'scriptoscope'", "from './scriptoscope.js'")
    .replaceAll("from '../src/declarative/index.ts'", "from './declarative.js'");
  await writeFile(resolve(root, 'dist/demo', name), hosted);
}
