import { test as base } from '@playwright/test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { root, workerCacheDir } from './servers.mjs';

export const test = base.extend({
  demo: [async ({}, use, workerInfo) => {
    const server = await createServer({
      configFile: resolve(root, 'vite.config.js'), root: resolve(root, 'demo'),
      cacheDir: workerCacheDir('demo', workerInfo.workerIndex),
      server: { host: '127.0.0.1', port: 0, open: false },
    });
    await server.listen();
    try { await use(`http://127.0.0.1:${server.httpServer.address().port}`); }
    finally { await server.close(); }
  }, { scope: 'worker' }],
});

