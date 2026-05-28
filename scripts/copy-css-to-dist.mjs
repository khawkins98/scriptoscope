// Copy the consumer-facing stylesheet from src/ → dist/ after `vite build`.
// Vite's library build skips CSS that isn't imported from the JS entry, and
// scriptoscope.css is consumer-facing (loaded via `<link>` or per the exports
// map `./scriptoscope.css`), not a JS-side dependency. So we copy it explicitly
// so the published tarball's exports map resolves cleanly to dist/scriptoscope.css.

import { copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, 'src/scriptoscope.css');
const dst = resolve(root, 'dist/scriptoscope.css');
await mkdir(dirname(dst), { recursive: true });
await copyFile(src, dst);
console.log(`copied ${src} → ${dst}`);
