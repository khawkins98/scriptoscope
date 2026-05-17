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
    rollupOptions: {
      input: {
        index:             resolve(import.meta.dirname, 'demo/index.html'),
        'themes-raster':   resolve(import.meta.dirname, 'demo/themes-raster.html'),
        themes:            resolve(import.meta.dirname, 'demo/themes.html'),
        'platinum-static': resolve(import.meta.dirname, 'demo/platinum-static.html'),
        'wm-fixture':      resolve(import.meta.dirname, 'demo/wm-fixture.html'),
        'scanner-fixture': resolve(import.meta.dirname, 'demo/scanner-fixture.html'),
      },
    },
  },
});
