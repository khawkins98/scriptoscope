#!/usr/bin/env node
// Pre-review gate for v2 lanes (`npm run lane:ready`).
//
// Run it on the exact head you are asking to have reviewed, then paste the
// summary block it prints into the PR body. It fails when:
//
//   - the worktree is dirty (tracked changes or untracked files);
//   - HEAD is not pushed, or the pushed branch head differs from HEAD;
//   - a review placeholder is left in a reviewed inventory: `PENDING`,
//     `Awaiting independent review` or `PROPOSED verified` anywhere in
//     tests/rendering-requirements/families/**, tests/rendering-requirements/ledger.json
//     or tests/control-availability/expectations.json. One exception: a single
//     `PENDING` reviewer label in expectations.json passes with a WARN when the
//     file's diff against the base is a hash-only bump (only sha256 values, the
//     inventory version and the review block change). That label is the PM's to
//     replace after the Tier 0 check, so the WARN is a reminder, not a pass of the review;
//   - any of the checks below exits non-zero:
//       lint:cleanroom, gen-trap-table --check, report-coverage,
//       build-ledger --check, the ledger history guard, typecheck, npm test;
//   - HEAD moved or the worktree became dirty while the checks ran.
//
// gen-trap-table needs the private Traps.h: pass --traps-h <path> or set
// SCRIPTOSCOPE_TRAPS_H. Without it the trap-table check fails; it is never skipped.
//
// Options:
//   --skip-tests      skip typecheck and `npm test` (docs-only lanes). Refused unless
//                     every file changed since the merge-base is under docs/ or *.md.
//   --base <ref>      base branch ref (default origin/v2; fetched first, best effort)
//   --remote <name>   remote the branch is pushed to (default origin)
//   --traps-h <path>  Traps.h for gen-trap-table
//   --verbose         stream each command's output instead of only the tail on failure
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = /\bPENDING\b|Awaiting independent review|PROPOSED verified/g;
const EXPECTATIONS = 'tests/control-availability/expectations.json';
const LEDGER = 'tests/rendering-requirements/ledger.json';
const FAMILIES = 'tests/rendering-requirements/families';

const posix = p => p.split(sep).join('/');
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).trim();
/** Porcelain status lines ('XY path'), untrimmed so the two status columns survive. */
const status = root => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const tryGit = (root, args) => { try { return git(root, args); } catch { return null; } };

/** The checks lane:ready runs, in order. `tests: true` rows are dropped by --skip-tests. */
export function defaultCommands({ trapsH, baseCommit }) {
  return [
    { name: 'lint:cleanroom', cmd: process.execPath, args: ['scripts/check-cleanroom.mjs'] },
    trapsH
      ? { name: 'gen-trap-table --check', cmd: process.execPath, args: ['scripts/gen-trap-table.mjs', '--traps-h', trapsH, '--check'] }
      : { name: 'gen-trap-table --check', missing: 'no Traps.h: pass --traps-h <path> or set SCRIPTOSCOPE_TRAPS_H' },
    { name: 'report-coverage', cmd: process.execPath, args: ['scripts/report-coverage.mjs'] },
    { name: 'build-ledger --check', cmd: process.execPath, args: ['tests/rendering-requirements/build-ledger.mjs', '--check'], hint: 'run `npm run ledger:sync` and commit ledger.json' },
    { name: 'ledger history', cmd: process.execPath, args: ['scripts/check-ledger-history.mjs', '--base-commit', baseCommit] },
    { name: 'typecheck', cmd: 'npm', args: ['run', '--silent', 'typecheck'], tests: true },
    { name: 'npm test', cmd: 'npm', args: ['test', '--silent'], tests: true },
  ];
}

/** Drop sha256-named values everywhere and the version/review bookkeeping at the top. */
function hashFree(value, top = true) {
  if (Array.isArray(value)) return value.map(v => hashFree(v, false));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (/sha256$/i.test(k)) continue;
    if (top && ['inventoryVersion', 'review'].includes(k)) continue;
    out[k] = hashFree(v, false);
  }
  return out;
}

/** True when head differs from base only in sha256 values, inventoryVersion and the review block. */
export function isHashOnlyBump(baseText, headText) {
  if (baseText == null) return false;
  let b, h;
  try { b = JSON.parse(baseText); h = JSON.parse(headText); } catch { return false; }
  return JSON.stringify(hashFree(b)) === JSON.stringify(hashFree(h));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); }
  return out;
}

const labelHits = (text) => text.split('\n').flatMap((line, i) => [...line.matchAll(LABEL)].map(m => ({ line: i + 1, label: m[0] })));

/** Review-placeholder scan. Returns { errors, warnings }. `baseExpectations` is the base's file text (or null). */
export function scanLabels(root, baseExpectations) {
  const errors = [], warnings = [];
  const strict = [...walk(join(root, FAMILIES)).map(f => posix(relative(root, f))), LEDGER].filter(f => existsSync(join(root, f)));
  for (const f of strict) for (const h of labelHits(readFileSync(join(root, f), 'utf8'))) errors.push(`${f}:${h.line}: leftover review label "${h.label}"`);
  if (existsSync(join(root, EXPECTATIONS))) {
    const text = readFileSync(join(root, EXPECTATIONS), 'utf8');
    const hits = labelHits(text);
    if (hits.length) {
      let inReviewers = false;
      const one = new RegExp(LABEL.source);
      try { inReviewers = (JSON.parse(text).review?.reviewers ?? []).filter(r => typeof r === 'string' && one.test(r)).length === 1; } catch {}
      const single = hits.length === 1 && hits[0].label === 'PENDING' && inReviewers;
      if (single && isHashOnlyBump(baseExpectations, text)) {
        warnings.push(`${EXPECTATIONS}:${hits[0].line}: one PENDING reviewer label on a hash-only bump. PM: run the Tier 0 check and replace the label before merge.`);
      } else {
        const why = !single ? 'only a single PENDING reviewer label is tolerated' : 'the diff against the base is not hash-only';
        for (const h of hits) errors.push(`${EXPECTATIONS}:${h.line}: leftover review label "${h.label}" (${why})`);
      }
    }
  }
  return { errors, warnings };
}

function runCommand(root, c, verbose) {
  if (c.missing) return { exit: null, detail: c.missing };
  const r = spawnSync(c.cmd, c.args, { cwd: root, encoding: 'utf8', stdio: verbose ? 'inherit' : 'pipe', maxBuffer: 1 << 30, env: process.env });
  const exit = r.status ?? (r.signal ? `signal ${r.signal}` : 'spawn error');
  let detail = '';
  if (exit !== 0 && !verbose) {
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trimEnd().split('\n');
    detail = out.slice(-25).join('\n');
  }
  return { exit, detail };
}

/**
 * Run every check. `commands` overrides the default list (tests). Returns
 * { ok, rows, warnings, failures, summary, head }.
 */
export function laneReady({ root, remote = 'origin', base = 'origin/v2', skipTests = false, trapsH = null, verbose = false, fetch = true, commands = null, log = () => {} }) {
  const rows = [], warnings = [], failures = [];
  const row = (name, ok, exit = '–', note = '') => { rows.push({ name, ok, exit, note }); if (!ok) failures.push(note ? `${name}: ${note}` : name); };
  const head = git(root, ['rev-parse', 'HEAD']);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);

  const dirty = status(root);
  row('worktree clean', !dirty.length, '–', dirty.length ? `${dirty.length} uncommitted path(s): ${dirty.slice(0, 5).map(l => l.slice(3)).join(', ')}` : '');

  if (branch === 'HEAD') row(`pushed head = HEAD`, false, '–', 'detached HEAD; check out the lane branch');
  else {
    const ls = tryGit(root, ['ls-remote', remote, `refs/heads/${branch}`]);
    const pushed = ls ? ls.split(/\s+/)[0] : '';
    if (ls === null) row(`pushed head = HEAD (${remote}/${branch})`, false, '–', `cannot reach remote ${remote}`);
    else if (!pushed) row(`pushed head = HEAD (${remote}/${branch})`, false, '–', `HEAD is not pushed: ${remote} has no branch ${branch}`);
    else row(`pushed head = HEAD (${remote}/${branch})`, pushed === head, '–', pushed === head ? '' : `pushed head ${pushed.slice(0, 12)} differs from HEAD ${head.slice(0, 12)}; push (or pull) first`);
  }

  if (fetch && base.startsWith(`${remote}/`)) {
    if (tryGit(root, ['fetch', '--quiet', remote, base.slice(remote.length + 1)]) === null) warnings.push(`could not fetch ${base}; comparing against the local ref`);
  }
  const mergeBase = tryGit(root, ['merge-base', 'HEAD', base]);
  if (!mergeBase) row(`merge-base with ${base}`, false, '–', `cannot resolve ${base}`);

  const baseExpectations = mergeBase ? tryGit(root, ['show', `${mergeBase}:${EXPECTATIONS}`]) : null;
  const labels = scanLabels(root, baseExpectations);
  warnings.push(...labels.warnings);
  row('review labels', labels.errors.length === 0, '–', labels.errors.length ? `${labels.errors.length} leftover label(s); first: ${labels.errors[0]}` : labels.warnings.length ? `${labels.warnings.length} WARN` : '');
  for (const e of labels.errors.slice(1)) log(`  ${e}`);

  let list = commands ?? defaultCommands({ trapsH, baseCommit: mergeBase ?? base });
  if (skipTests) {
    const changed = mergeBase ? git(root, ['diff', '--name-only', mergeBase, 'HEAD']).split('\n').filter(Boolean) : null;
    const code = changed === null ? ['(no merge-base)'] : changed.filter(f => !f.startsWith('docs/') && !f.endsWith('.md'));
    if (code.length) row('--skip-tests allowed', false, '–', `--skip-tests is for docs-only diffs; changed outside docs/ and *.md: ${code.slice(0, 5).join(', ')}`);
    for (const c of list.filter(c => c.tests)) rows.push({ name: c.name, ok: true, exit: 'skipped', note: '--skip-tests (docs-only diff)' });
    list = list.filter(c => !c.tests);
  }
  for (const c of list) {
    log(`lane:ready: ${c.name} ...`);
    const { exit, detail } = runCommand(root, c, verbose);
    const ok = exit === 0;
    if (!ok && detail) log(detail.split('\n').map(l => `  | ${l}`).join('\n'));
    row(c.name, ok, exit === null ? 'not run' : String(exit), ok ? '' : c.missing ?? (c.hint ?? 'see output above'));
  }

  const headAfter = git(root, ['rev-parse', 'HEAD']);
  const dirtyAfter = status(root);
  if (headAfter !== head) row('HEAD unchanged during run', false, '–', `HEAD moved to ${headAfter.slice(0, 12)}`);
  if (!dirty.length && dirtyAfter.length) row('worktree still clean after checks', false, '–', `checks left changes: ${dirtyAfter.slice(0, 5).map(l => l.slice(3)).join(', ')}`);

  const ok = failures.length === 0;
  const lines = [
    `### lane:ready: ${ok ? 'PASS' : 'FAIL'}`,
    '',
    `- commit: \`${head}\` (branch \`${branch}\`)`,
    `- base: \`${base}\` merge-base \`${mergeBase ?? 'unresolved'}\``,
    `- node ${process.version}, ${new Date().toISOString()}${skipTests ? ', --skip-tests' : ''}`,
    '',
    '| check | result | exit |',
    '|---|---|---|',
    ...rows.map(r => `| ${r.name} | ${r.exit === 'skipped' ? 'SKIP' : r.ok ? 'pass' : 'FAIL'}${r.note ? `: ${r.note.replace(/\|/g, '\\|').replace(/\n/g, ' ')}` : ''} | ${r.exit} |`),
    ...warnings.map(w => `\n> WARN: ${w}`),
  ];
  return { ok, rows, warnings, failures, head, summary: lines.join('\n') };
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf(n); return i < 0 ? undefined : args[i + 1]; };
  const known = new Set(['--skip-tests', '--verbose', '--base', '--remote', '--traps-h']);
  const unknown = args.filter((a, i) => a.startsWith('--') && !known.has(a) && !['--base', '--remote', '--traps-h'].includes(args[i - 1]));
  if (unknown.length) { console.error(`lane:ready: unknown option(s) ${unknown.join(' ')}`); process.exit(2); }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const trapsH = opt('--traps-h') ?? process.env.SCRIPTOSCOPE_TRAPS_H ?? null;
  const r = laneReady({
    root, remote: opt('--remote') ?? 'origin', base: opt('--base') ?? 'origin/v2', skipTests: args.includes('--skip-tests'),
    trapsH: trapsH ? resolve(trapsH) : null, verbose: args.includes('--verbose'), log: m => console.error(m),
  });
  console.log('\n<!-- lane:ready summary: paste into the PR body -->');
  console.log(r.summary);
  process.exit(r.ok ? 0 : 1);
}
