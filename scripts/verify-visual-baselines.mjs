#!/usr/bin/env node
// Compare captures with committed fixtures. This flags browser-render drift;
// it does not establish pixel fidelity to the original Kaleidoscope engine.
import { readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { captureVisualBaselines, baselineDir, freshDir, parseArgs } from './capture-visual-baselines.mjs';

try {
  const { slug, diffOnly } = parseArgs(process.argv.slice(2), { verify: true });
  if (!diffOnly) {
    // Never write into baselineDir. A failed or interrupted capture can leave
    // only partial scratch output, never changed or silently restored fixtures.
    await rm(freshDir, { recursive: true, force: true });
    await mkdir(freshDir, { recursive: true });
    await captureVisualBaselines({ slug, outDir: freshDir });
  }
  if (!existsSync(freshDir)) throw new Error('No fresh captures; run verify:scenes without --diff-only first');
  const pngs = async dir => (await readdir(dir)).filter(f => f.endsWith('.png'));
  const committed = await pngs(baselineDir), fresh = await pngs(freshDir);
  const files = slug ? [`${slug}.png`] : [...new Set([...committed, ...fresh])].sort();
  if (!files.length) throw new Error('No baseline files to compare');
  const sha = async path => createHash('sha256').update(await readFile(path)).digest('hex');
  let drift = 0;
  for (const file of files) {
    const old = resolve(baselineDir, file), next = resolve(freshDir, file);
    if (!existsSync(old) || !existsSync(next)) {
      console.log(`  ${file}: ${!existsSync(old) ? 'missing-committed' : 'missing-fresh'}`);
      drift++;
    } else if (await sha(old) !== await sha(next)) {
      console.log(`  ${file}: changed`);
      drift++;
    }
  }
  console.log(`\n-- verify-scenes: ${files.length} baseline(s), ${drift} drifted --`);
  if (drift) {
    console.log('Review .tmp/visual-baselines/fresh. If intentional, regenerate and review the committed fixtures.');
    process.exitCode = 1;
  } else console.log('  ✓ all selected baselines byte-identical to fresh capture');
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
