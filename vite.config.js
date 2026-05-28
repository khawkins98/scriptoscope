// Vite handles two distinct jobs in this repo:
//
//   1. `npm run dev`   — serve the demo from demo/ on port 5173, with HMR.
//   2. `npm run build` — build the Scriptoscope library bundle from src/index.ts
//                        as an ESM module with type declarations.
//
// Switched by Vite's `command` argument: 'serve' = dev, 'build' = library bundle.
// `npm run preview` previews the built library bundle (rarely useful) — use
// `npm run dev` for the demo preview.

import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, statSync, createReadStream } from 'node:fs';

// Tiny middleware to serve canonical theme bundles from `themes/<slug>/` at
// `/themes/<slug>/...` during dev. Phase 4 runtime (`loadTheme()`) fetches
// bundles by URL; this makes the repo-root `themes/` dir reachable from the
// demo's dev server (where Vite's root is `demo/`).
const serveThemesPlugin = () => ({
  name: 'serve-themes-dir',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url || !req.url.startsWith('/themes/')) return next();
      const url = req.url.split('?')[0];
      const filepath = resolve(import.meta.dirname, '.' + url);
      if (!existsSync(filepath) || !statSync(filepath).isFile()) return next();
      const ext = (filepath.split('.').pop() ?? '').toLowerCase();
      const mime = ext === 'json' ? 'application/json'
                 : ext === 'png'  ? 'image/png'
                 : 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      createReadStream(filepath).pipe(res);
    });
  },
});

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'demo',
      publicDir: false, // demo/assets/ is already under root
      plugins: [serveThemesPlugin()],
      server: {
        port: 5173,
        open: '/',
        fs: { allow: ['..'] }, // allow imports from src/, themes/, etc.
      },
    };
  }
  // Library build mode — single ESM entry from src/index.ts.
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: {
          'scriptoscope': resolve(import.meta.dirname, 'src/index.ts'),
        },
        formats: ['es'],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      // No JS dependencies per PRD §Architecture — everything bundles in.
      rollupOptions: {
        external: [],
      },
    },
  };
});
