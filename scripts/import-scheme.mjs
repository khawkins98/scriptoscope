#!/usr/bin/env node
// scripts/import-scheme.mjs
// One-command import for a Kaleidoscope scheme: given a slug whose
// themes/<slug>/scheme.rsrc is already in place (see
// docs/porting-a-kaleidoscope-scheme.md §1-2 for getting the raw fork out of a
// .sit), run the FULL extraction pipeline scoped to that one scheme and print a
// REPORT CARD of what was figured out + what needs a human look.
//
//   node scripts/import-scheme.mjs <slug> [path/to/scheme.rsrc]
//   npm run import -- <slug>
//
// Steps (all slug-scoped, so no all-themes churn):
//   extract-scheme → extract-icons → index-rasters → gen-resource-roles → lint
// Scaffolds a meta.json STUB if absent (provenance is the one hand-authored bit).
// Exits non-zero if a step fails or lint reports an error.

import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const rsrcArg = process.argv[3];

if (!slug || slug.startsWith('-')) {
  console.error('Usage: node scripts/import-scheme.mjs <slug> [path/to/scheme.rsrc]');
  process.exit(2);
}

const dir = resolve(root, 'themes', slug);
const rsrc = resolve(dir, 'scheme.rsrc');

// ── 0. Get the raw fork in place ────────────────────────────────────────────
if (rsrcArg) {
  if (!existsSync(rsrcArg)) { console.error(`scheme.rsrc not found: ${rsrcArg}`); process.exit(1); }
  mkdirSync(dir, { recursive: true });
  copyFileSync(rsrcArg, rsrc);
  console.log(`· copied ${rsrcArg} → themes/${slug}/scheme.rsrc`);
}
if (!existsSync(rsrc)) {
  console.error(`No themes/${slug}/scheme.rsrc. Put the raw resource fork there first`);
  console.error(`(see docs/porting-a-kaleidoscope-scheme.md §1-2), or pass its path as the 2nd arg.`);
  process.exit(1);
}
const forkKB = (statSync(rsrc).size / 1024).toFixed(0);
if (statSync(rsrc).size < 4096) {
  console.error(`⚠ scheme.rsrc is only ${forkKB} KB — the resource fork was likely stripped in transit.`);
  console.error(`  Re-extract the .sit with \`unar\` and copy the ..namedfork/rsrc stream. Aborting.`);
  process.exit(1);
}

// ── 1-5. Run the pipeline, scoped to this slug ──────────────────────────────
const step = (label, script, args = [slug]) => {
  process.stdout.write(`· ${label} … `);
  try {
    const out = execFileSync('node', [resolve(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
    console.log('ok');
    return { ok: true, out };
  } catch (e) {
    console.log('FAILED');
    process.stderr.write((e.stdout || '') + (e.stderr || '') + '\n');
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
};

console.log(`\nImporting "${slug}" (scheme.rsrc ${forkKB} KB)\n`);
const scheme = step('extract chrome (cicn/ppat/wnd#/clut → theme.json)', 'extract-scheme.mjs');
if (!scheme.ok) { console.error('\n✗ extract-scheme failed (theme.json did not validate). Fix and re-run.'); process.exit(1); }
const icons = step('extract icons (icl/ics + masks)', 'extract-icons.mjs');
step('index rasters', 'index-rasters.mjs');
step('generate resource-roles', 'gen-resource-roles.mjs');
step('update demo gallery list', 'gen-themes-manifest.mjs', []); // not slug-scoped — re-derives the whole list
const lint = step('lint', 'lint-themes.mjs');

// ── 6. Scaffold provenance if missing (never overwrite) ─────────────────────
const metaPath = resolve(dir, 'meta.json');
let metaState;
if (!existsSync(metaPath)) {
  const stub = {
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + '  // ← fill in the real scheme name',
    author: { name: '', email: '', url: '', year: null },
    origin: { kind: 'kaleidoscope-port', originalFormat: 'ksc', originalLicense: '// ← verbatim license string from the scheme readme', sourceUrl: '' },
  };
  writeFileSync(metaPath, JSON.stringify(stub, null, 2));
  metaState = 'SCAFFOLDED (fill in, then re-run to fold into theme.json)';
} else {
  const m = JSON.parse(readFileSync(metaPath, 'utf8'));
  const filled = m.name && !String(m.name).includes('←') && m.author?.name && m.origin?.originalLicense && !String(m.origin.originalLicense).includes('←');
  metaState = filled ? `present (${m.name})` : 'present but INCOMPLETE (placeholders remain)';
}

// ── 7. Report card ──────────────────────────────────────────────────────────
const readJson = (p) => { try { return JSON.parse(readFileSync(resolve(dir, p), 'utf8')); } catch { return null; } };
const theme = readJson('theme.json') || {};
const iconIdx = readJson('icons/index.json') || [];
const roles = readJson('resource-roles.json');

const wt = theme.windowTypes || {};
const wtNames = Object.keys(wt);
const model = wtNames.some((k) => wt[k].edges?.top?.length) ? 'native wnd# recipe (sliced)'
  : wtNames.some((k) => wt[k].model === 'corner-sprite') ? 'corner-sprite (procedural Platinum)'
  : 'baseline / inherited';
const chromeN = Object.keys(theme.chromeElements || {}).length;
const byType = (t) => iconIdx.filter((i) => i.type === t).length;
const keyed = lint.out; // reserved

// pull lint's slug result + the families-wired line + E/W/N tail from captured output
const lintLines = (lint.out || '').split('\n');
const familiesLine = (lintLines.find((l) => l.includes('glyph families wired')) || '').trim();
const tail = (lintLines.find((l) => /linted .* window/.test(l)) || '').trim();
const warns = lintLines.filter((l) => /\bwarn\b/.test(l) && !l.includes('error(s)')).length;
const errs = (tail.match(/(\d+) error/) || [0, 0])[1];

const ok = (b) => (b ? '✓' : '—');
console.log(`
┌─ import report · ${slug} ${'─'.repeat(Math.max(2, 46 - slug.length))}
│ scheme type     ${model}
│ window types    ${wtNames.length}  (${wtNames.slice(0, 6).join(', ')}${wtNames.length > 6 ? ', …' : ''})
│ header colors   ${ok(!!theme.headerColors)}${theme.headerColors ? `  active.frame=${theme.headerColors.active?.frame ?? '?'}` : ''}
│ chrome cicns    ${chromeN}
│ body pattern    ${theme.bodyBackground?.pattern ? theme.bodyBackground.pattern.replace(/^ppats\//, '') : 'none (white)'}
│ icons           ${iconIdx.length}  (icl4=${byType('icl4')} ics4=${byType('ics4')} icl8=${byType('icl8')} ics8=${byType('ics8')})
│ control roles   progress=${roles?.progress?.model ?? '?'}${roles?.scrollArrows ? ' · scroll-arrows mapped' : ''}${roles ? '' : ' (no resource-roles.json)'}
│ glyphs wired    ${familiesLine.replace(/^[·\s]*\(glyph families wired\)\s*/, '') || '(see lint)'}
│ provenance      meta.json ${metaState}
│ lint            ${errs} error(s) · ${warns} window-warning(s)${tail ? '  — ' + tail.replace(/^-+\s*/, '') : ''}
└${'─'.repeat(60)}`);

const clean = scheme.ok && icons.ok && lint.ok && Number(errs) === 0;
if (clean) {
  console.log(`\n✓ ${slug} imported. ${metaState.startsWith('present (') ? '' : '⚠ Fill in meta.json provenance. '}Next: add a reference at demo/assets/references/${slug}.png + smoke-test (npm run dev).`);
} else {
  console.log(`\n⚠ ${slug} imported with issues above — review the lint warnings/errors before relying on it.`);
  process.exit(1);
}
