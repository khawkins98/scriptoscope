#!/usr/bin/env node
// Vet a Kaleidoscope scheme for use as a BASELINE fallback: report whether it
// ships the full chrome set (window frame recipe + window cicns + the standard
// controls). A good baseline needs window definitions (wnd#) AND a document
// window cicn AND scrollbar/button/checkbox/etc cicns — apple-platinum-2 fails
// because it ships no wnd# and only 16px icon stubs.
//
// Usage:
//   node scripts/check-completeness.mjs <slug>            # an extracted themes/<slug>
//   node scripts/check-completeness.mjs --rsrc <file>     # a raw scheme.rsrc
//   node scripts/check-completeness.mjs --all             # all themes/

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';
import { KDEF_CONTROL_IDS } from './lib/kdef-control-ids.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Resource ids that matter for a complete baseline. Window-type ids stay inline
// (this script's concern); control ids are sourced from the shared catalogue so
// the lint / audit / completeness check can't drift — same prophylactic as the
// 2026-05-29 refactor that landed `kdef-control-ids.mjs`. lookupIds carry their
// canonical signs (`kbutton-face-active` is negative-resource -10239 → 10239
// positive in the catalogue); we negate here because completeness checks
// against the raw resource-fork id (negative).
const neg = (xs) => xs.map((n) => -Math.abs(n));
const C = KDEF_CONTROL_IDS;
const CHECKS = [
  ['document window frame', 'wnd#', [-14336, -14335]],
  ['document window cicn', 'cicn', [-14335, -14336]],
  ['utility window', 'wnd#', [-14320, -14316, -14319, -14315]],
  ['h scrollbar', 'cicn', neg([C.scrollbar.lookupIds[4]])], // -8285
  ['v scrollbar', 'cicn', neg([C.scrollbar.lookupIds[1]])], // -8278
  ['scroll thumb', 'cicn', [-10206, -10208]],
  ['push button', 'cicn', neg([C.button.active])],
  ['button ring', 'cicn', neg([C.button.ringActive])],
  ['checkbox', 'cicn', neg(C.checkbox.lookupIds.slice(0, 2))],
  ['radio', 'cicn', neg(C.radio.lookupIds.slice(0, 2))],
  ['slider', 'cicn', [-10131, -10115]],
  // Progress: include the role-3-part canonical (-10080/-10078) AND the
  // lavender 2-part canonical (-10223) so a Platinum-family scheme that
  // ships only the lavender doesn't read as incomplete (the audit's
  // progress-bar-hue T1).
  ['progress', 'cicn', neg([C.progress.frame, C.progress.track, C.progress.lavenderCanonical])],
];

function check(label, entries) {
  const byType = {};
  for (const e of entries) (byType[e.type] ??= new Set()).add(e.id);
  // A window cicn is "real" only if it's bigger than an icon (≥ ~30px); the
  // -14332/-14336 in apple-platinum-2 are 16px stubs. We can't read size here
  // without decoding, so we flag presence and note size separately below.
  let score = 0;
  const lines = [];
  for (const [name, type, ids] of CHECKS) {
    const have = ids.some((id) => byType[type]?.has(id));
    if (have) score++;
    lines.push(`  ${have ? 'OK ' : '-- '} ${name} (${type} ${ids.join('/')})`);
  }
  console.log(`\n=== ${label} ===  completeness ${score}/${CHECKS.length}`);
  console.log(lines.join('\n'));
  return score;
}

const args = process.argv.slice(2);
if (args[0] === '--rsrc') {
  const f = resolve(args[1]);
  check(args[1], parseResourceFork(new Uint8Array(readFileSync(f))));
} else {
  const slugs = args.includes('--all')
    ? readdirSync(resolve(repoRoot, 'themes')).filter((s) => existsSync(resolve(repoRoot, 'themes', s, 'scheme.rsrc')))
    : args;
  for (const slug of slugs) {
    const f = resolve(repoRoot, 'themes', slug, 'scheme.rsrc');
    if (!existsSync(f)) { console.log(`${slug}: no scheme.rsrc`); continue; }
    check(slug, parseResourceFork(new Uint8Array(readFileSync(f))));
  }
}
