// Pages-only build of the public loader wrapper (#431). `npm run build:demo`
// runs it and copy-demo-assets.mjs publishes the output as
// https://khawkins98.github.io/scriptoscope/theme-loader/loadKaleidoscopeScheme.js,
// the URL the standalone decoder has always been served at. The raw core under
// tools/theme-loader/ leaves `engineCinfIds` off, so a consumer importing it
// got no engine cinfs and every slider handed off to the Platinum fallback.
// This bundles src/loadKaleidoscopeScheme.ts (engine cinf ids on by default)
// with the core it wraps into one ES module.
//
// The StuffIt decoder stays external: the module keeps importing
// `../sit-wasm/index.mjs` lazily, which resolves to the published sit-wasm/
// copy beside theme-loader/, so the WASM ships once.

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const SIT_WASM = resolve(import.meta.dirname, 'tools/sit-wasm/index.mjs');

export default defineConfig({
  publicDir: false,
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    outDir: 'dist/pages-loader',
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    lib: {
      entry: { loadKaleidoscopeScheme: resolve(import.meta.dirname, 'src/loadKaleidoscopeScheme.ts') },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: (id, importer) =>
        id === SIT_WASM || (importer !== undefined && resolve(importer, '..', id) === SIT_WASM),
      output: {
        paths: (id) => (id === SIT_WASM || id.endsWith('sit-wasm/index.mjs') ? '../sit-wasm/index.mjs' : id),
      },
    },
  },
});
