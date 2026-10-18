import { createServer as createHttpServer } from 'node:http';
import { createServer as reservePort } from 'node:net';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

export const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };

/** Separate transports matter: built parity must not silently resolve to source. */
export async function startServers() {
  const built = createHttpServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, `.${pathname}`);
      if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Not found');
      res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
      createReadStream(path).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => built.listen(0, '127.0.0.1', resolve));
  let source;
  try {
    // Vite treats port:0 as5173, unlike node:http. Reserve an ephemeral port.
    const reservation = reservePort();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
    source = await createViteServer({ configFile: false, root, publicDir: false,
      server: { host: '127.0.0.1', port, strictPort: true, open: false },
      resolve: { alias: { scriptoscope: resolve(root, 'src/index.ts') } } });
    await source.listen();
    return {
      built: `http://127.0.0.1:${built.address().port}`,
      source: `http://127.0.0.1:${port}`,
      async close() { await source.close(); await new Promise(resolve => built.close(resolve)); },
    };
  } catch (error) { await source?.close(); await new Promise(resolve => built.close(resolve)); throw error; }
}
