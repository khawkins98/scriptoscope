// Static-site build for the demo. Runs as `npm run build:demo` and
// produces dist/demo/ — a fully-resolved HTML/CSS/JS bundle that
// GitHub Pages serves. The main vite.config.js handles dev-serve and
// library-bundle modes; this separate config handles the static demo
// build cleanly without conditional spaghetti.

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'demo',
  base: process.env.AARON_UI_BASE_PATH ?? '/aaron-ui/',
  publicDir: false,
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
        // The runtime showcase (also serves as the contributor debugger via `?dev=1`).
        index: resolve(import.meta.dirname, 'demo/index.html'),
        // A realistic vanilla page (article/form/list/gallery) with data-aaron-* hooks on real
        // content — the North Star "skin an existing site" demo.
        'declarative-site': resolve(import.meta.dirname, 'demo/declarative-site.html'),
        // Hostile-CSS regression page: aggressive host rules that would wreck light-DOM chrome.
        // Confirms ADR-0001 Decision 2 (Shadow DOM around the chrome) keeps doing its job.
        'declarative-hostile-css': resolve(import.meta.dirname, 'demo/declarative-hostile-css.html'),
      },
    },
  },
});
