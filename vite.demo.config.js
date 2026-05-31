// Static-site build for the demo. Runs as `npm run build:demo` and
// produces dist/demo/ — a fully-resolved HTML/CSS/JS bundle that
// GitHub Pages serves. The main vite.config.js handles dev-serve and
// library-bundle modes; this separate config handles the static demo
// build cleanly without conditional spaghetti.

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'demo',
  // GitHub Pages serves at /scriptoscope/ (the repo slug, post-2026-05-31 rename from
  // /aaron-ui/). Override via the env var if/when the repo is renamed again. The legacy
  // AARON_UI_BASE_PATH env var is kept as a fallback alias so any old CI / scripts /
  // bookmarks pointing at the prior naming keep building.
  base: process.env.SCRIPTOSCOPE_BASE_PATH ?? process.env.AARON_UI_BASE_PATH ?? '/scriptoscope/',
  publicDir: false,
  // Same `scriptoscope` alias as the dev config — keeps the prod bundle
  // using the same import path the landing models for consumers.
  resolve: {
    alias: {
      scriptoscope: resolve(import.meta.dirname, 'src/index.ts'),
    },
  },
  build: {
    outDir: '../dist/demo',
    emptyOutDir: true,
    sourcemap: false,
    // The demo's module script uses top-level await (loadTheme); target a baseline
    // that allows it (TLA = Chrome 89+/FF89+/Safari15+, i.e. the modern evergreens
    // the PRD targets). Without this, esbuild's default es2020 target fails the
    // build with "Top-level await is not available" — which had been silently
    // breaking the GitHub Pages deploy while CI (library-only build) stayed green.
    target: 'es2022',
    rollupOptions: {
      input: {
        // The consumer-facing LANDING page (2026-05-30 swap): the 1999-Apple-style
        // pitch + install snippet + hero control strip + folder-icon theme picker +
        // four named-technology cards as floating Mac windows.
        index: resolve(import.meta.dirname, 'demo/index.html'),
        // The developer / contributor diagnostic — was demo/index.html until the
        // 2026-05-30 swap. Houses the ribbon, per-scheme scene + reference comparison,
        // control playgrounds, geometry/slices/icons/rasters/roles inspectors, BYO drop zone.
        diagnostic: resolve(import.meta.dirname, 'demo/diagnostic.html'),
        // Hostile-CSS regression page: aggressive host rules that would wreck light-DOM chrome.
        // Confirms ADR-0001 Decision 2 (Shadow DOM around the chrome) keeps doing its job.
        'declarative-hostile-css': resolve(import.meta.dirname, 'demo/declarative-hostile-css.html'),
      },
    },
  },
});
