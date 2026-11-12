// Static-site build for the demo. Runs as `npm run build:demo` and
// produces dist/demo/ — a fully-resolved HTML/CSS/JS bundle that
// GitHub Pages serves. The main vite.config.js handles dev-serve and
// library-bundle modes; this separate config handles the static demo
// build cleanly without conditional spaghetti.

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The landing collage decodes StuffIt archives as soon as it starts, but the
// library imports its decoder lazily, so the browser would only learn of that
// chunk after the app chunk has run. Its name is hashed, so index.html cannot
// name it: add its modulepreload here. The decoder's WASM is not preloaded,
// because WebKit requests a fetch preload link a second time.
function preloadLandingDecoder() {
  let base = '/';
  return {
    name: 'preload-landing-decoder',
    configResolved(config) { base = config.base; },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle || ctx.path !== '/index.html') return;
        const decoder = Object.values(ctx.bundle).find(output => output.type === 'chunk'
          && output.facadeModuleId?.endsWith('/tools/sit-wasm/index.mjs'));
        // Fail rather than publish a landing page that silently lost the preload.
        if (!decoder) throw new Error('preload-landing-decoder: no chunk for tools/sit-wasm/index.mjs in the demo build; update or remove this plugin.');
        return [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: base + decoder.fileName }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  root: 'demo',
  plugins: [preloadLandingDecoder()],
  // GitHub Pages serves at /scriptoscope/ (the repo slug, post-2026-05-31 rename from
  // /aaron-ui/). Override via the env var if/when the repo is renamed again. The legacy
  // AARON_UI_BASE_PATH env var is kept as a fallback alias so any old CI / scripts /
  // bookmarks pointing at the prior naming keep building.
  base: process.env.SCRIPTOSCOPE_BASE_PATH ?? process.env.AARON_UI_BASE_PATH ?? '/scriptoscope/',
  publicDir: false,
  // Same `@khawkins98/scriptoscope` alias as the dev config — keeps the prod bundle
  // using the same import path the landing models for consumers.
  resolve: {
    alias: {
      '@khawkins98/scriptoscope': resolve(import.meta.dirname, 'src/index.ts'),
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
        // Consumer-facing advertisement: a portrait collage in five live schemes.
        index: resolve(import.meta.dirname, 'demo/index.html'),
        // The original interactive landing, preserved as the hands-on demo.
        showcase: resolve(import.meta.dirname, 'demo/showcase.html'),
        capabilities: resolve(import.meta.dirname, 'demo/capabilities.html'),
        install: resolve(import.meta.dirname, 'demo/install.html'),
        story: resolve(import.meta.dirname, 'demo/story.html'),
        acknowledgements: resolve(import.meta.dirname, 'demo/acknowledgements.html'),
        // The 1995 Apple ad the landing's art direction is drawn from, with preservation credit.
        inspiration: resolve(import.meta.dirname, 'demo/inspiration.html'),
        // The developer / contributor diagnostic — was demo/index.html until the
        // 2026-05-30 swap. Houses the ribbon, per-scheme scene + reference comparison,
        // control playgrounds, geometry/slices/icons/rasters/roles inspectors, BYO drop zone.
        diagnostic: resolve(import.meta.dirname, 'demo/diagnostic.html'),
        // Hostile-CSS regression page: aggressive host rules that would wreck light-DOM chrome.
        // Confirms ADR-0001 Decision 2 (Shadow DOM around the chrome) keeps doing its job.
        'declarative-hostile-css': resolve(import.meta.dirname, 'demo/declarative-hostile-css.html'),
        // Real-world example pages. Each pinned to a different theme so a
        // visitor sees the breadth of the corpus across page archetypes.
        // User direction 2026-05-31: 'good way to just play around with
        // the functionality and dog food it.' Cross-linked from the main
        // showcase + each other via topnav.
        personal:  resolve(import.meta.dirname, 'demo/personal.html'),  // 3-col blog, theme: 1138
        shareware: resolve(import.meta.dirname, 'demo/shareware.html'), // cascade, theme: system7-nostalgia-silver
        landing:   resolve(import.meta.dirname, 'demo/landing.html'),   // hero + cards, theme: beos-r503
        docs:      resolve(import.meta.dirname, 'demo/docs.html'),      // docs-site 3-col, theme: 1984
      },
    },
  },
});
