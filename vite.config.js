// Vite dev server for the Aaron UI demo.
//
// Today's job: serve demo/ (themes.html, themes-raster.html, platinum-static.html
// and their assets) with live reload, on the default port 5173.
//
// Later (Phase 1+): this config will grow to handle the library build itself —
// TypeScript transforms, output bundles for the published npm package, etc.
// Keeping the config minimal until that work starts.

import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  publicDir: false, // demo/assets/ is already under root, no separate public dir
  server: {
    port: 5173,
    open: '/themes-raster.html', // open the raster demo on `npm run dev`
  },
  build: {
    outDir: '../dist/demo',
    emptyOutDir: true,
  },
});
