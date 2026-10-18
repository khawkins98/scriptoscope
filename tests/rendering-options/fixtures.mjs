import { mkdir, writeFile } from 'node:fs/promises';
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

/** Executed observations, never an independently established availability oracle.
 * Keep these outside Playwright's per-run output directory so a subsequent golden
 * run does not erase the contract inventory before CI uploads it. */
export async function attachObservations(testInfo, kind, name, observations) {
  const safe = value => value.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const directory = new URL(`../../test-results/rendering-evidence/${safe(testInfo.project.name)}/${safe(kind)}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  const body = JSON.stringify({ schema: 1, evidence: 'observed-execution', project: testInfo.project.name, ...observations }, null, 2);
  const path = new URL(`${safe(name)}.json`, directory);
  await writeFile(path, body + '\n');
  await testInfo.attach(`${kind}-${name}.json`, { body, contentType: 'application/json' });
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
