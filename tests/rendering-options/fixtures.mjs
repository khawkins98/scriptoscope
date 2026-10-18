import { writeFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

export const test = base.extend({
  servers: [async ({}, use) => {
    const servers = await startServers();
    try { await use(servers); } finally { await servers.close(); }
  }, { scope: 'worker' }],
});
export { expect };
export function harnessUrl(servers, mode) {
  const runtime = mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts';
  const css = mode === 'built' ? '/dist/scriptoscope.css' : '/src/scriptoscope.css';
  return `${servers[mode]}/tests/rendering-options/page.html?${new URLSearchParams({ runtime, css, themeBase: '/themes', fonts: '/demo/assets/fonts/', sourceZoom: '4', labelZoom: '1' })}`;
}
export async function openHarness(page, servers, mode) {
  await page.goto(harnessUrl(servers, mode));
  await page.waitForFunction(() => !!window.controlMatrix);
  await page.evaluate(() => window.controlMatrix.ready);
}

/** Save the failing inputs and raw backing pixels, not just a scaled screenshot. */
export async function attachCase(page, testInfo, metadata, error) {
  const record = { ...metadata, error: error?.stack ?? String(error), url: page.url() };
  const path = testInfo.outputPath('case.json');
  await writeFile(path, JSON.stringify(record, null, 2)).catch(() => {});
  await testInfo.attach('case.json', { path, contentType: 'application/json' }).catch(() => {});
  try {
    const canvases = await page.locator('canvas').evaluateAll(nodes => nodes.map((canvas, index) => ({
      index, width: canvas.width, height: canvas.height, data: canvas.toDataURL(),
    })));
    for (const canvas of canvases) await testInfo.attach(`canvas-${canvas.index}-${canvas.width}x${canvas.height}.png`, {
      body: Buffer.from(canvas.data.split(',')[1], 'base64'), contentType: 'image/png',
    });
    // The raw canvases carry full resolution; a bounded viewport screenshot
    // avoids another huge allocation after a contact-sheet capture failure.
    await testInfo.attach('consumer-dom.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
  } catch (artifactError) {
    await testInfo.attach('artifact-warning.txt', { body: String(artifactError), contentType: 'text/plain' }).catch(() => {});
  }
}
