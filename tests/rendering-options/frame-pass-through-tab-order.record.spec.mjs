// HPT40 reference recorder (hit-regions §9.8). Skipped unless SCRIPTOSCOPE_RECORD_TAB_ORDER=1.
// The reference must come from pre-#597 main (the branch's merge base, a6e4344c) in the same
// platform and engine build that runs the check: keyboard access differs by platform (macOS
// WebKit's default Tab skips <button>s and links; Linux WebKit does not). Re-record by copying
// this file, frame-pass-through-tab-order.mjs and the JSON into a checkout of that commit and
// running it there; the CI recording uses the pinned Playwright container. See README.md
// "HPT40 Tab-order reference".
import { test as base } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { startServers } from './servers.mjs';
import { TAB_SCENARIO, tabSequence } from './frame-pass-through-tab-order.mjs';

const test = base.extend({ servers: [async ({}, use) => { const s = await startServers(); try { await use(s); } finally { await s.close(); } }, { scope: 'worker' }] });
const FILE = new URL('./frame-pass-through-tab-order.json', import.meta.url);

test('record the HPT40 Tab-order reference for this platform and engine', async ({ page, servers, browserName, browser }) => {
  test.skip(process.env.SCRIPTOSCOPE_RECORD_TAB_ORDER !== '1', 'recorder: set SCRIPTOSCOPE_RECORD_TAB_ORDER=1 on pre-#597 main');
  await page.goto(`${servers.source}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(TAB_SCENARIO, { mode: 'source' });
  const sequence = await tabSequence(page);
  const commit = process.env.SCRIPTOSCOPE_GIT_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const json = JSON.parse(readFileSync(FILE, 'utf8'));
  json.sequences[`${process.platform}-${browserName}`] = sequence;
  (json.recordings ??= {})[`${process.platform}-${browserName}`] = { commit, browserVersion: browser.version(), recordedAt: new Date().toISOString() };
  writeFileSync(FILE, JSON.stringify(json, null, 2) + '\n');
});
