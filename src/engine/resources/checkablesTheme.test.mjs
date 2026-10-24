// Implementation-owned boundary probes; synthetic declared themes, no archive fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({ resolve(specifier, context, next) {
 if (specifier.endsWith('.js') && context.parentURL?.includes('/src/')) {
 const target = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
 if (target.protocol === 'file:' && existsSync(fileURLToPath(target))) return next(target.href, context);
 }
 return next(specifier, context);
} });
const { themeResourceChain } = await import('./theme.ts');
const { notifyAssetUrlReleased } = await import('../../../tools/theme-loader/assetLifecycle.js');
const theme = extra => ({ manifest: { name: 'synthetic', chromeElements: {} }, baseUrl: '', inspector: { iconIndex: [], cicns: [], ppats: [], ...extra } });
const wanted = [{ type: 'cicn', id: -9503 }, { type: 'ics#', id: -10236 }, { type: 'ics8', id: -10236 }];

test('censuses distinguish proven NULL, undecoded occurrence, duplicate masks, and older unknown input', async () => {
 const t = theme({ cicnResources: [{ id: -9503, resourceIndex: 0, byteLength: 1 }], iconMaskResources: [
 { id: -10236, resourceIndex: 1, byteLength: 64 }, { id: -10236, resourceIndex: 2, byteLength: 64 }], iconColorResources: [] });
 const chain = await themeResourceChain(t, wanted, { checkables: true });
 assert.equal(chain.getResource('cicn', -9503).value.status, 'unknown');
 assert.equal(chain.getResource('ics#', -10236).value.status, 'unknown');
 assert.equal(chain.getResource('ics8', -10236), null);
 const older = await themeResourceChain(theme(), wanted, { checkables: true });
 assert.equal(older.getResource('ics#', -10236).value.status, 'unknown');
 assert.equal(older.getResource('ics8', -10236).value.status, 'unknown');
});

test('opaque icon decode remains bound to occurrence, decode failures are non-NULL, and release aborts a pending preparation', async () => {
 const originalImage = globalThis.Image, originalDocument = globalThis.document;
 let pause, start, decodeFailed = false;
 globalThis.Image = class {
 naturalWidth = 16; naturalHeight = 16;
 async decode() { if (decodeFailed) throw new Error('synthetic decode failure'); start?.(); if (pause) await pause; }
 };
 globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(1024).fill(255) }) }) }) };
 try {
 const source = 'blob:checkable-opaque';
 const t = theme({ iconColorResources: [{ type: 'ics8', id: -10236, resourceIndex: 7, byteLength: 256 }],
 iconIndex: [{ id: -10236, type: 'ics8', resourceIndex: 7, unmaskedUrl: source }] });
 const chain = await themeResourceChain(t, wanted.slice(2), { checkables: true });
 assert.equal(chain.getResource('ics8', -10236).value.width, 16);
 t.inspector.iconIndex[0].resourceIndex = 8;
 assert.equal((await themeResourceChain(t, wanted.slice(2), { checkables: true })).getResource('ics8', -10236).value.status, 'unknown');
 t.inspector.iconIndex[0].resourceIndex = 7;
 notifyAssetUrlReleased(source); decodeFailed = true;
 assert.match((await themeResourceChain(t, wanted.slice(2), { checkables: true })).getResource('ics8', -10236).value.reason, /decode failed/);
 decodeFailed = false; notifyAssetUrlReleased(source);
 let resume;
 pause = new Promise(resolve => { resume = resolve; });
 const started = new Promise(resolve => { start = resolve; });
 const pending = themeResourceChain(t, wanted.slice(2), { checkables: true, signal: new AbortController().signal });
 await started; notifyAssetUrlReleased(source); resume();
 await assert.rejects(pending, { name: 'AbortError' });
 } finally { globalThis.Image = originalImage; globalThis.document = originalDocument; }
});
