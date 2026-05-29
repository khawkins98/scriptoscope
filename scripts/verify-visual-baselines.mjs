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
  // Capture flow: snapshot committed → overwrite baselineDir via the capture
  // script → snapshot the fresh set → ALWAYS restore committed. The restore
  // is in a try/finally so a Ctrl-C / OOM / segfault in the capture script
  // can't strand the working tree with the wrong baselines (the bug class the
  // code-quality reviewer flagged). Restore wipes baselineDir and re-cp's the
  // ENTIRE committed snapshot — not just files present at snapshot time — so a
  // newly-captured theme that doesn't exist in committed is also cleaned up
  // and surfaces in the diff loop as a `missing-committed` drift entry.
  console.log('  capturing fresh baselines into a scratch dir for comparison…');
  await mkdir(tempDir, { recursive: true });
  const committedSnap = resolve(tempDir, '.committed');
  const freshSnap = resolve(tempDir, 'fresh');
  await rm(committedSnap, { recursive: true, force: true });
  await rm(freshSnap, { recursive: true, force: true });
  await mkdir(committedSnap, { recursive: true });
  await mkdir(freshSnap, { recursive: true });
  for (const f of await readdir(baselineDir)) {
    if (f.endsWith('.png')) await cp(resolve(baselineDir, f), resolve(committedSnap, f));
  }
  /** Restore the committed snapshot over baselineDir. Idempotent. */
  const restoreCommitted = async () => {
    for (const f of await readdir(baselineDir)) {
      if (f.endsWith('.png')) await rm(resolve(baselineDir, f), { force: true });
    }
    for (const f of await readdir(committedSnap)) {
      await cp(resolve(committedSnap, f), resolve(baselineDir, f));
    }
  };
  try {
    const code = await new Promise((res) => {
      const proc = spawn('node', [resolve(repoRoot, 'scripts/capture-visual-baselines.mjs')], {
        cwd: repoRoot, stdio: 'inherit',
      });
      proc.on('exit', (c) => res(c ?? 0));
    });
    if (code !== 0) {
      await restoreCommitted();
      console.error('\n✗ capture-visual-baselines failed; can\'t verify');
      process.exit(code);
    }
    // Snapshot the fresh capture BEFORE restoring committed.
    for (const f of await readdir(baselineDir)) {
      if (f.endsWith('.png')) await cp(resolve(baselineDir, f), resolve(freshSnap, f));
    }
  } finally {
    await restoreCommitted();
  }
}

// Now diff committed vs fresh (or vs whatever's in baselineDir if --diff-only).
// Walk the UNION of committed + fresh file names so a newly-captured theme that
// isn't yet committed surfaces as a `missing-committed` drift entry (and a
// removed theme surfaces as `missing-fresh`). Walking only `committed` would
// silently ignore new themes.
const compareSource = flags.has('--diff-only') ? baselineDir : resolve(tempDir, 'fresh');
const committedFiles = (await readdir(baselineDir)).filter((f) => f.endsWith('.png'));
const freshFiles = existsSync(compareSource)
  ? (await readdir(compareSource)).filter((f) => f.endsWith('.png'))
  : [];
const all = Array.from(new Set([...committedFiles, ...freshFiles])).sort();
const drifts = [];
for (const f of all) {
  const cExists = existsSync(resolve(baselineDir, f));
  const fExists = existsSync(resolve(compareSource, f));
  if (!cExists) {
    drifts.push({ slug: f, kind: 'missing-committed (new theme not yet baselined)' });
    continue;
  }
  if (!fExists) {
    drifts.push({ slug: f, kind: 'missing-fresh (baseline orphaned — theme removed?)' });
    continue;
  }
  const committedSha = await sha(resolve(baselineDir, f));
  const freshSha = await sha(resolve(compareSource, f));
  if (committedSha !== freshSha) {
    drifts.push({ slug: f, kind: 'changed', committed: committedSha.slice(0, 12), fresh: freshSha.slice(0, 12) });
  }
}

console.log(`\n-- verify-scenes: ${all.length} baselines (${committedFiles.length} committed, ${freshFiles.length} fresh), ${drifts.length} drifted --`);
for (const d of drifts) {
  console.log(`  ${d.slug.padEnd(40)} ${d.kind === 'changed' ? `${d.committed} → ${d.fresh}` : d.kind}`);
}
if (drifts.length) {
  console.log('\n  Drift detected. If intentional: `npm run baseline:scenes` + commit. If a regression: investigate against the codex.');
  process.exit(1);
}
console.log('  ✓ all baselines byte-identical to fresh capture');
