import { readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { forkOf, cinf, onePixelCicn } from '../resource-provenance/fixtures.mjs';
import { comparePatternBinding, twoPixelPpat } from '../resource-provenance/patterns.mjs';
import { sha256 } from '../control-availability/source.mjs';
import { gitIdentity } from '../rendering-requirements/execution.mjs';
import { fileURLToPath } from 'node:url';
const pins = JSON.parse(readFileSync(new URL('../resource-provenance/pattern-pins.json', import.meta.url)));
const ownRequest = cinf(); ownRequest[3] = 5;
const ownBytes = forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() },
  { type: 'cinf', id: -10239, data: ownRequest }, { type: 'ppat', id: 0, name: 'own', data: twoPixelPpat() }]);
const root = fileURLToPath(new URL('../../', import.meta.url));
for (const mode of ['source', 'built']) test(`${mode}: pattern catalog bytes stay load-local and distinct from raw body requests or paint`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const observed = await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const { forkOf, cinf, onePixelCicn } = await import('/tests/resource-provenance/fixtures.mjs');
    const { twoPixelPpat } = await import('/tests/resource-provenance/patterns.mjs');
    const loader = mode === 'source' ? await import('/tools/theme-loader/loadKaleidoscopeScheme.js') : api;
    const base = await api.loadTheme('/themes/crayon-os', { provenance: true });
    const borrowed = await api.loadTheme('/themes/crayon-os');
    const request = cinf(); request[3] = 5; // Preserve zero ID and mode5; do not call this a ppat request.
    const payload = twoPixelPpat();
    const bytes = forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() },
      { type: 'cinf', id: -10239, data: request }, { type: 'ppat', id: 0, name: 'own', data: payload }]);
    const child = await loader.loadKaleidoscopeScheme(bytes, { provenance: true }); child.base = base;
    const owner = theme => ({ manifest: { patterns: theme.manifest.patterns }, byteProvenance: theme.byteProvenance });
    try {
      const own = owner(child), baseOwner = owner(child.base);
      child.base = borrowed;
      return { own, baseOwner, borrowedOwner: owner(child.base),
        request: Object.values(child.manifest.chromeElements)[0].bodyRequest,
        legacyLink: Object.values(child.manifest.chromeElements)[0].bgPattern,
        frozen: Object.isFrozen(child.manifest.patterns.own.byteProvenance),
        plainPatternHasNoEvidence: Object.values(borrowed.manifest.patterns).every(p => !p.byteProvenance) };
    } finally { child.dispose(); base.dispose(); borrowed.dispose(); }
  }, mode);
  const joins = [];
  expect(observed.request).toEqual({ mode: 5, resourceId: 0 }); expect(observed.legacyLink).toBeNull();
  expect(observed.frozen).toBe(true); expect(observed.plainPatternHasNoEvidence).toBe(true);
  const ownPin = { inputSha256: sha256(ownBytes), forkSha256: sha256(ownBytes),
    signedId: 0, resourceIndex: 2, byteLength: 104, payloadSha256: sha256(twoPixelPpat()) };
  joins.push(comparePatternBinding(observed.own, 'own', ownPin));
  const base = observed.baseOwner;
  expect(base.byteProvenance.loadId).not.toBe(observed.own.byteProvenance.loadId);
  expect(base.byteProvenance.fork.selection.entryIndex).toBe(pins.entryIndex);
  expect(base.byteProvenance.fork.selection.entryName).toBe(pins.entryName);
  for (const pin of pins.patterns) {
    const entries = Object.entries(base.manifest.patterns).filter(([, p]) => p.sourcePpatId === pin.signedId);
    expect(entries).toHaveLength(1);
    const [key, entry] = entries[0];
    // The real archive pin constrains payload identity, not an original lookup
    // occurrence. Synthetic fixtures independently constrain occurrence order.
    joins.push(comparePatternBinding(base, key, { ...pin, resourceIndex: entry.byteProvenance.ppatResourceIndex,
      inputSha256: pins.archiveSha256, forkSha256: pins.forkSha256 }));
    expect(comparePatternBinding(observed.borrowedOwner, key, {}).status).toBe('unknown');
  }
  expect(joins.every(j => j.status === 'matched'), JSON.stringify(joins)).toBe(true);
  await attachObservations(info, 'pattern-byte-provenance', mode, { execution: { ...gitIdentity(root), mode,
    browserVersion: page.context().browser().version(), builtBundleSha256: sha256(readFileSync(new URL('../../dist/scriptoscope.js', import.meta.url))) },
    pins, observations: observed, comparisons: joins, complete: true,
    limitations: ['Catalog input identity only; no pattern renderer or inherited resolver was invoked.', 'No original Resource Manager ownership or decoder pixel correctness is certified.'] });
});
