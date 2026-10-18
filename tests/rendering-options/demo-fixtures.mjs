import { test as base } from '@playwright/test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { root } from './servers.mjs';

export const test = base.extend({
  demo: [async ({}, use) => {
    const server = await createServer({
      configFile: resolve(root, 'vite.config.js'), root: resolve(root, 'demo'),
      server: { host: '127.0.0.1', port: 0, open: false },
    });
    await server.listen();
    try { await use(`http://127.0.0.1:${server.httpServer.address().port}`); }
    finally { await server.close(); }
  }, { scope: 'worker' }],
});

