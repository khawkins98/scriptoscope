import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { readInventory, validateSourceEvidence } from '../control-availability/validate-source.mjs';
import { compareAvailability } from '../control-availability/compare.mjs';
import { sha256 } from '../control-availability/source.mjs';
import { gitIdentity } from '../rendering-requirements/execution.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const data = readInventory();

for (const mode of ['source', 'built']) test(`${mode}: reviewed finite availability holds independently of parity`, async ({ page, servers }, testInfo) => {
  const rows = [], failures = [];
  let complete = false;
  const git = gitIdentity(root);
  const execution = { ...git, gitCommit: git.executionCommit, mode,
    browser: testInfo.project.use.browserName, browserVersion: page.context().browser().version(),
    deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
    builtBundleSha256: sha256(readFileSync(new URL('../../dist/scriptoscope.js', import.meta.url))) };
  try {
    const sourceValidation = await validateSourceEvidence(data);
    await attachObservations(testInfo, 'availability-expectations', 'reviewed', {
      evidence: 'reviewed-api-availability-expectations', inventory: data.inventory,
      sourceValidation, limitations: ['Source facts use shared decoders; actual decoder fork/payload identity is not observed by the trace.'],
    });
    await openHarness(page, servers, mode);
    for (const c of data.inventory.cases) {
      const fixtureRef = c.sourceEvidence.find(ref => ref.fixture);
      const fixture = fixtureRef ? data.fixtures.fixtures.find(f => f.id === fixtureRef.fixture) : null;
      const sourceChoice = fixture ? null : data.choices.sources.find(choice => `theme.${choice.slug}` === c.input);
      const observed = await page.evaluate(async ({ mode, c, fixture, sourceChoice }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const { runAvailabilityCase } = await import('/tests/control-availability/browser.mjs');
        return runAvailabilityCase(api, c, fixture, sourceChoice);
      }, { mode, c, fixture, sourceChoice });
      if (c.mode === 'interactive' && observed.native) {
        const button = page.locator('#availability-native');
        const snapshot = await button.ariaSnapshot();
        observed.native.accessibilitySnapshot = snapshot;
        observed.native.accessibleName = /- button(?: "([^"]*)")?/.exec(snapshot)?.[1] ?? null;
        await page.keyboard.press('Tab');
        if (c.options.disabled) {
          observed.native.keyboard['Tab-skips-disabled'] = await page.locator('#availability-after').evaluate(el => el === document.activeElement);
          await button.evaluate(el => { el.focus(); el.click(); });
          await page.keyboard.press('Enter'); await page.keyboard.press('Space');
        } else {
          observed.native.keyboard['Tab-focus'] = await button.evaluate(el => el === document.activeElement);
          const before = await page.evaluate(() => window.availabilityInteraction.activationCount());
          await page.keyboard.press('Enter');
          const enter = await page.evaluate(() => window.availabilityInteraction.activationCount());
          observed.native.keyboard['Enter-activation'] = enter === before + 1;
          await page.keyboard.press('Space');
          observed.native.keyboard['Space-activation'] = await page.evaluate(() => window.availabilityInteraction.activationCount()) === enter + 1;
        }
        observed.native.activationCount = await page.evaluate(() => window.availabilityInteraction.activationCount());
      }
      const comparison = compareAvailability(c, observed);
      rows.push({ id: c.id, expectedAvailability: c.effectiveAvailability, status: comparison.status, observed, comparison });
      if (comparison.status !== (c.effectiveAvailability === 'unknown' ? 'unknown' : 'passed')) {
        failures.push({ id: c.id, errors: comparison.errors });
        await attachCase(page, testInfo, { mode, expected: c, observed, comparison }, new Error(`Availability mismatch: ${c.id}`));
      }
    }
    complete = true;
    expect(rows.filter(row => row.status === 'passed')).toHaveLength(26);
    expect(rows.filter(row => row.status === 'unknown').map(row => row.id)).toEqual(['synthetic.raw-repurposed-only']);
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  } catch (error) {
    await attachCase(page, testInfo, { mode, oracle: 'reviewed-finite-availability', failures, rows }, error);
    throw error;
  } finally {
    for (const c of data.inventory.cases) if (!rows.some(row => row.id === c.id)) {
      rows.push({ id: c.id, expectedAvailability: c.effectiveAvailability, status: 'not-run', observed: null,
        comparison: { status: 'not-run', errors: ['Execution did not reach this case'] } });
    }
    await attachObservations(testInfo, 'availability', mode, { execution, complete,
      inventoryVersion: data.inventory.inventoryVersion, inventorySha256: data.inventory.inventorySha256,
      cases: rows, unlistedAvailability: 'unknown',
      limitations: ['API availability only, not whole-control fidelity or historical compatibility policy.',
        'Input source hashes are validated separately; trace owner/IDs/key do not prove actual decoder fork/payload.'] });
  }
});
