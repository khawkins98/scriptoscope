// Test-only modern CSS compatibility policy. The canonical Playwright predicate
// stays intact (including its AA classification); only a rejected complete B
// plane can enter here. No native-engine fidelity or exhaustive-output claim.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// Exported by the exact pinned Playwright 1.64.0 dependency, also used by its
// stock PNG comparator. No screenshotter/private matcher hooks are used.
import { PNG } from 'playwright-core/lib/utilsBundle';

const evidence = JSON.parse(readFileSync(new URL('./goldens/disabled-css-edge-variants.json', import.meta.url)));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const namedSheets = new Set(['apple-platinum-2', 'platinum-8', 'slimes', 'system7-nostalgia-silver']);
const caseId = 'declarative/push/auto/ink/horizontal/0.5/true/disabled';

/** Reconstruct the frozen whole plane, validating every old value before write.
 * Exported for corruption tests; acceptance never takes a caller-supplied row. */
export function reconstructDisabledCssEdge(row, canonicalPng) {
  if (sha256(canonicalPng) !== row.canonicalPngSha256) throw new Error('canonical PNG identity');
  const canonical = PNG.sync.read(canonicalPng);
  if (canonical.width !== row.dimensions[0] || canonical.height !== row.dimensions[1]) throw new Error('canonical dimensions');
  if (sha256(canonical.data) !== row.canonicalRgbaSha256) throw new Error('canonical RGBA identity');
  if (row.patches.length !== 27) throw new Error('replacement count');
  const data = Buffer.from(canonical.data), seen = new Set();
  for (const [x, y, before, after] of row.patches) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= canonical.width || y >= canonical.height) throw new Error('patch coordinates');
    const offset = (y * canonical.width + x) * 4;
    if (seen.has(offset)) throw new Error('duplicate replacement');
    seen.add(offset);
    if (![before, after].every(rgba => Array.isArray(rgba) && rgba.length === 4 && rgba.every(v => Number.isInteger(v) && v >= 0 && v <= 255))) throw new Error('patch RGBA');
    if (!data.subarray(offset, offset + 4).equals(Buffer.from(before))) throw new Error('before RGBA');
    if (before.every((v, i) => v === after[i])) throw new Error('unchanged replacement');
    data.set(after, offset);
  }
  if (sha256(data) !== row.variantRgbaSha256) throw new Error('variant whole RGBA identity');
  return { width: canonical.width, height: canonical.height, data };
}

/** Strict B-only extension. Wrong binding, malformed data, any additional pixel
 * or an unseen edge value returns false; the original matcher error survives. */
export function matchesDisabledCssEdgeB(binding, canonicalPng, actualPng) {
  if (!namedSheets.has(binding.slug) || binding.page !== 1 || binding.caseIndex !== 8 || binding.caseId !== caseId) return false;
  if (sha256(JSON.stringify(binding.environment)) !== evidence.environmentSha256) return false;
  const rows = evidence.variants.filter(row => row.slug === binding.slug && row.page === binding.page && row.caseIndex === binding.caseIndex && row.caseId === binding.caseId);
  if (rows.length !== 1) return false;
  try {
    const expected = reconstructDisabledCssEdge(rows[0], canonicalPng);
    const actual = PNG.sync.read(actualPng);
    return actual.width === expected.width && actual.height === expected.height &&
      sha256(actual.data) === rows[0].variantRgbaSha256 && actual.data.equals(expected.data);
  } catch { return false; }
}

/** Call the ordinary matcher once, reusing only its newly attached failed PNG.
 * testInfo.attachments/snapshotPath/attach are public APIs. Missing, ambiguous,
 * or renamed attachments fail closed. Keep expected/actual/diff attachments. */
export async function compareGoldenWithDisabledCssEdge(canonicalCompare, testInfo, binding) {
  const start = testInfo.attachments.length;
  let decision;
  try {
    await canonicalCompare();
    decision = { branch: 'canonical-stock', rawRgbaEquality: 'not established by stock AA comparator' };
  } catch (error) {
    const name = `${binding.slug}-page-${binding.page}.png`;
    const attachments = testInfo.attachments.slice(start);
    const actuals = attachments.filter(a => a.name === name.replace('.png', '-actual.png') && a.contentType === 'image/png');
    const expected = attachments.filter(a => a.name === name.replace('.png', '-expected.png') && a.contentType === 'image/png');
    const diffs = attachments.filter(a => a.name === name.replace('.png', '-diff.png') && a.contentType === 'image/png');
    let accepted = false;
    try {
      if (actuals.length === 1 && expected.length === 1 && diffs.length === 1) {
        const canonicalPng = readFileSync(testInfo.snapshotPath(name, { kind: 'screenshot' }));
        const actualPng = actuals[0].body ?? readFileSync(actuals[0].path);
        accepted = matchesDisabledCssEdgeB(binding, canonicalPng, actualPng);
      }
    } catch { /* A failed fallback must preserve the original stock failure. */ }
    decision = { branch: accepted ? 'finite-disabled-css-edge-B' : 'rejected',
      canonicalFailure: String(error.message ?? error),
      ...(accepted ? { actualRgbaSha256: evidence.variants.find(row => row.slug === binding.slug).variantRgbaSha256 } : {}) };
    await testInfo.attach('golden-comparison.json', { body: JSON.stringify(decision), contentType: 'application/json' });
    if (!accepted) throw error;
    return decision;
  }
  await testInfo.attach('golden-comparison.json', { body: JSON.stringify(decision), contentType: 'application/json' });
  return decision;
}
