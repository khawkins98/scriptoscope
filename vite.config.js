// Vite handles two distinct jobs in this repo:
//
//   1. `npm run dev`   — serve the demo from demo/ on port 5173, with HMR.
//   2. `npm run build` — build the Aaron UI library bundle from src/index.ts
//                        as an ESM module with type declarations.
//
// Switched by Vite's `command` argument: 'serve' = dev, 'build' = library bundle.
// `npm run preview` previews the built library bundle (rarely useful) — use
// `npm run dev` for the demo preview.

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'demo',
      publicDir: false, // demo/assets/ is already under root
      server: {
        port: 5173,
        open: '/themes-raster.html',
      },
    };
  }
  // Library build mode
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: resolve(import.meta.dirname, 'src/index.ts'),
        name: 'AaronUI',
        formats: ['es'],
        fileName: () => 'aaron-ui.js',
      },
      // No JS dependencies per PRD §Architecture — everything bundles in.
      rollupOptions: {
        external: [],
      },
    },
  };
});
