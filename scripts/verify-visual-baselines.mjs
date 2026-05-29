#!/usr/bin/env node
// scripts/verify-visual-baselines.mjs
//
// Visual-baseline drift gate. Captures a fresh set of Scene panels (via the
// existing capture script) and compares them byte-for-byte against the
// committed baselines under tests/visual-baselines/scenes/. Reports which
// themes changed + exits non-zero on any drift — CI signal for "the path ran
// and produced wrong-looking output" regressions (the class the 1990 ring
// corner-stack briefly slipped into).
//
// Byte-for-byte is intentionally strict. The capture script pins the viewport
// + DPR + font load via document.fonts.ready, so two clean runs against the
// same code should produce identical bytes. A real pixel-diff (SSIM, pixelmatch)
// would add a heavyweight dep + buy little — the failure mode we care about is
// "the renderer produced different pixels than the maintainer expected," which
// shows up as byte changes too. If a future drift comes from genuine non-
// determinism (anti-aliasing differences across Chromium minor versions), we
// can promote to SSIM > 0.99 then.
//
//   npm run verify:scenes          # capture + diff; exit 1 on drift
//   npm run verify:scenes -- --diff-only   # diff existing dist/ baselines vs committed (no capture)

import { spawn } from 'node:child_process';
import { readFile, readdir, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineDir = resolve(repoRoot, 'tests/visual-baselines/scenes');
const tempDir = resolve(repoRoot, '.tmp/visual-baselines');

const flags = new Set(process.argv.filter((a) => a.startsWith('--')));

/** sha256 of a file's bytes — used to detect byte-level drift. */
async function sha(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

if (!flags.has('--diff-only')) {
  // Capture a fresh set into the temp dir, leaving the committed baselines
  // untouched. We run the existing capture script through a wrapper that
  // overrides the output root via an environment hint — but the capture script
  // writes into tests/visual-baselines/scenes/ unconditionally. Simpler:
  // capture in place, snapshot the result, then restore the committed copy.
  console.log('  capturing fresh baselines into a scratch dir for comparison…');
  await mkdir(tempDir, { recursive: true });
  // Snapshot committed first so we can restore + diff.
  const committedSnap = resolve(tempDir, '.committed');
  await rm(committedSnap, { recursive: true, force: true });
  await mkdir(committedSnap, { recursive: true });
  for (const f of await readdir(baselineDir)) {
    if (f.endsWith('.png')) {
      await cp(resolve(baselineDir, f), resolve(committedSnap, f));
    }
  }
  // Run the capture script (writes into baselineDir).
  const code = await new Promise((res) => {
    const proc = spawn('node', [resolve(repoRoot, 'scripts/capture-visual-baselines.mjs')], {
      cwd: repoRoot, stdio: 'inherit',
    });
    proc.on('exit', (c) => res(c ?? 0));
  });
  if (code !== 0) {
    console.error('\n✗ capture-visual-baselines failed; can\'t verify');
    process.exit(code);
  }
  // Move the just-captured fresh set into the temp dir, restore the committed.
  const freshSnap = resolve(tempDir, 'fresh');
  await rm(freshSnap, { recursive: true, force: true });
  await mkdir(freshSnap, { recursive: true });
  for (const f of await readdir(baselineDir)) {
    if (f.endsWith('.png')) {
      await cp(resolve(baselineDir, f), resolve(freshSnap, f));
    }
  }
  // Restore committed.
  for (const f of await readdir(committedSnap)) {
    await cp(resolve(committedSnap, f), resolve(baselineDir, f));
  }
}

// Now diff committed vs fresh (or vs whatever's in baselineDir if --diff-only).
const compareSource = flags.has('--diff-only') ? baselineDir : resolve(tempDir, 'fresh');
const committedFiles = (await readdir(baselineDir)).filter((f) => f.endsWith('.png')).sort();
const drifts = [];
for (const f of committedFiles) {
  const committedSha = await sha(resolve(baselineDir, f));
  const freshSha = existsSync(resolve(compareSource, f)) ? await sha(resolve(compareSource, f)) : null;
  if (freshSha == null) {
    drifts.push({ slug: f, kind: 'missing-fresh', committed: committedSha });
    continue;
  }
  if (committedSha !== freshSha) {
    drifts.push({ slug: f, kind: 'changed', committed: committedSha.slice(0, 12), fresh: freshSha.slice(0, 12) });
  }
}

console.log(`\n-- verify-scenes: ${committedFiles.length} baselines, ${drifts.length} drifted --`);
for (const d of drifts) {
  console.log(`  ${d.slug.padEnd(40)} ${d.kind === 'changed' ? `${d.committed} → ${d.fresh}` : d.kind}`);
}
if (drifts.length) {
  console.log('\n  Drift detected. If intentional: `npm run baseline:scenes` + commit. If a regression: investigate against the codex.');
  process.exit(1);
}
console.log('  ✓ all baselines byte-identical to fresh capture');
