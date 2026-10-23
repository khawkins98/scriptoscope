// One-time delta audit against the artifact integrated into the #459 base.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
const old = JSON.parse(execFileSync('git', ['show', 'baaace98:tests/acceptance-bindings/bindings.json'], { maxBuffer: 32 * 1024 * 1024 }));
const sha = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
let count = 0;
for (const source of old.sources) {
  const d = await loadKaleidoscopeScheme(fs.readFileSync(source.input.path), {
    meta: JSON.parse(fs.readFileSync(source.meta.path)), source: `${source.id}/${source.input.path.split('/').at(-1)}`, encodeAssets: false,
  });
  for (const w of source.canonical.windows) {
    const value = structuredClone(d.manifest.windowTypes[w.key]); delete value.titleSamples;
    assert.equal(sha(value), w.valueSha256, `${source.id}/${w.key}: remove only titleSamples`); count++;
  }
  for (const wt of Object.values(d.manifest.windowTypes)) delete wt.titleSamples;
  if (!source.canonical.windows.some(w => w.key === 'collapsed-no-title-utility')) delete d.manifest.windowTypes['collapsed-no-title-utility'];
  assert.equal(sha(d.manifest), source.canonical.manifestSha256, `${source.id}: remove only titleSamples and added type`);
}
console.log(`Recovered all ${count} prior window hashes and 18 prior manifest hashes by removing only titleSamples and the five added collapsed utility records.`);
