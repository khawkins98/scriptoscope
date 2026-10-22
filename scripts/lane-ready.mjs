#!/usr/bin/env node
// Pre-review gate for v2 lanes (`npm run lane:ready`).
//
// Run it on the exact head you are asking to have reviewed, then paste the
// summary block it prints into the PR body. It fails when:
//
//   - the worktree is dirty (tracked changes or untracked files);
//   - HEAD is not pushed, or the pushed branch head differs from HEAD (checked at
//     the branch's upstream, @{u}; an upstream that is the base branch itself fails);
//   - a review placeholder is left in a reviewed inventory: `PENDING`,
//     `Awaiting independent review` or `PROPOSED verified` anywhere in
//     tests/rendering-requirements/families/**, tests/rendering-requirements/ledger.json
//     or tests/control-availability/expectations.json (exact case anywhere; any
//     case, e.g. `pending` or `Pending_review`, on lines new since the merge-base,
//     because older reviewed rows already say "review pending" in prose). One
//     exception: a single `PENDING` reviewer label in expectations.json passes
//     with a WARN when the file's diff against the base is a hash-only bump (see
//     isHashOnlyBump: 64-hex sha256 values with the same keys, the inventory
//     version, and a review block that archives the prior review). That label is the PM's to
//     replace after the Tier 0 check, so the WARN is a reminder, not a pass of the review;
//   - any of the checks below exits non-zero:
//       lint:cleanroom, gen-trap-table --check, report-coverage (with the
//       merge-base, so a frozen base keeps its pin), build-ledger --check, the
//       ledger history guard, the engine diff gate (tests/engine-diff; families
//       whose expected/ or baselines/ file changed count as declared),
//       validate-source (documentSha256 pins), typecheck,
//       npm test;
//   - HEAD moved or the worktree became dirty while the checks ran.
//
// gen-trap-table needs the private Traps.h: pass --traps-h <path> or set
// SCRIPTOSCOPE_TRAPS_H. Without it the trap-table check fails; it is never skipped.
//
// Options:
//   --skip-tests      skip typecheck and `npm test` (docs-only lanes). Refused unless
//                     every file changed since the merge-base is under docs/ or *.md.
//                     validate-source still runs, plus the docs-pinned tests (every
//                     control-availability test and every test file naming docs/ or a
//                     .md file), since a docs-only edit can break a document hash pin.
//   --base <ref>      base branch ref (default origin/v2; fetched first, best effort)
//   --remote <name>   remote the branch is pushed to (default origin)
//   --traps-h <path>  Traps.h for gen-trap-table
//   --verbose         stream each command's output instead of only the tail on failure
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Exact-case review placeholders: always fail (one PENDING exception, below). */
export const LABEL = /(?<![A-Za-z])PENDING(?![A-Za-z])|Awaiting independent review|PROPOSED verified/g;
/**
 * Any-case variants (`pending`, `Pending_review`, `awaiting independent review`). Older
 * reviewed rows already carry prose such as "independent integration review pending", so a
 * variant fails only on a line that is new or edited relative to the merge-base.
 * TODO(push-button cleanup lane): temporary. Once that lane replaces the stale
 * "independent integration review pending." rows in families/push-button.json (and the
 * regenerated ledger.json) through a recorded family transition, drop the base-line
 * exemption in labelHits so any-case labels fail everywhere.
 */
export const LOOSE_LABEL = /(?<![A-Za-z])pending(?![A-Za-z])|awaiting\s+independent\s+review|proposed\s+verified/gi;
const EXPECTATIONS = 'tests/control-availability/expectations.json';
const LEDGER = 'tests/rendering-requirements/ledger.json';
const FAMILIES = 'tests/rendering-requirements/families';

const posix = p => p.split(sep).join('/');
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).trim();
/** Porcelain status lines ('XY path'), untrimmed so the two status columns survive. */
const status = root => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const tryGit = (root, args) => { try { return git(root, args); } catch { return null; } };

/** Globs of the npm test script, expanded (only `dir/*.test.mjs` forms are used there). */
function npmTestFiles(root) {
  const script = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts?.test ?? '';
  return script.split(/\s+/).filter(t => t.endsWith('.test.mjs')).flatMap(t => {
    if (!t.includes('*')) return existsSync(join(root, t)) ? [t] : [];
    const dir = dirname(t), re = new RegExp('^' + t.slice(dir.length + 1).replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*') + '$');
    return existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter(n => re.test(n)).map(n => `${dir}/${n}`) : [];
  });
}

/**
 * Tests a docs-only diff can still break: documentSha256 pins and other doc readers. They
 * run under --skip-tests: every control-availability test, plus every npm test file that
 * names a docs/ path or a .md file.
 */
export function docsPinnedTests(root) {
  return npmTestFiles(root).filter(f => f.startsWith('tests/control-availability/') || /docs\/|\.md['"`]/.test(readFileSync(join(root, f), 'utf8')));
}

/**
 * The checks lane:ready runs, in order. `tests: true` rows are dropped by --skip-tests;
 * `docsOnly: true` rows run only under --skip-tests (npm test already covers them).
 */
export function defaultCommands({ trapsH, baseCommit, root = null }) {
  return [
    { name: 'lint:cleanroom', cmd: process.execPath, args: ['scripts/check-cleanroom.mjs'] },
    trapsH
      ? { name: 'gen-trap-table --check', cmd: process.execPath, args: ['scripts/gen-trap-table.mjs', '--traps-h', trapsH, '--check'] }
      : { name: 'gen-trap-table --check', missing: 'no Traps.h: pass --traps-h <path> or set SCRIPTOSCOPE_TRAPS_H' },
    { name: 'report-coverage', cmd: process.execPath, args: ['scripts/report-coverage.mjs', '--base-commit', baseCommit] },
    { name: 'build-ledger --check', cmd: process.execPath, args: ['tests/rendering-requirements/build-ledger.mjs', '--check'], hint: 'run `npm run ledger:sync` and commit ledger.json' },
    { name: 'ledger history', cmd: process.execPath, args: ['scripts/check-ledger-history.mjs', '--base-commit', baseCommit] },
    { name: 'engine-diff', cmd: process.execPath, args: ['tests/engine-diff/run.mjs', '--check', '--base-commit', baseCommit, '--declared-from-diff'], tests: true, hint: 'bless each changed cell in tests/engine-diff/expected/<family>.json, then npm run engine-diff:write' },
    { name: 'validate-source', cmd: process.execPath, args: ['tests/control-availability/validate-source.mjs'], hint: 'a documentSha256 pin changed: a hash-only expectations bump (Tier 0) is needed' },
    { name: 'docs-pinned tests', cmd: process.execPath, args: ['--experimental-strip-types', '--test', ...(root ? docsPinnedTests(root) : [])], docsOnly: true },
    { name: 'typecheck', cmd: 'npm', args: ['run', '--silent', 'typecheck'], tests: true },
    { name: 'npm test', cmd: 'npm', args: ['test', '--silent'], tests: true },
  ];
}

const SHA = /^[0-9a-f]{64}$/;
const isShaKey = k => /sha256$/i.test(k);
/** Mask sha256-keyed values (keys kept, so an added or dropped hash key still differs); drop top-level bookkeeping. */
function masked(value, top = true) {
  if (Array.isArray(value)) return value.map(v => masked(v, false));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (top && ['inventoryVersion', 'review'].includes(k)) continue;
    out[k] = isShaKey(k) ? '<sha256>' : masked(v, false);
  }
  return out;
}
const shaValuesHex = value => Array.isArray(value) ? value.every(shaValuesHex)
  : value && typeof value === 'object' ? Object.entries(value).every(([k, v]) => (isShaKey(k) ? typeof v === 'string' && SHA.test(v) : shaValuesHex(v))) : true;
const REVIEW_KEYS = new Set(['date', 'reviewers', 'inventoryVersion', 'inventorySha256', 'transition', 'previousReview']);

/**
 * True when head differs from base only in sha256 values (each a 64-hex string, same keys),
 * inventoryVersion and the review block. The review block may only carry date, reviewers,
 * inventoryVersion/inventorySha256 (matching the top level), a transition note and a
 * previousReview that is the base's review archived verbatim (or the base's own
 * previousReview, unchanged, when the version did not move).
 */
export function isHashOnlyBump(baseText, headText) {
  if (baseText == null) return false;
  let b, h;
  try { b = JSON.parse(baseText); h = JSON.parse(headText); } catch { return false; }
  if (!shaValuesHex(h)) return false;
  if (JSON.stringify(masked(b)) !== JSON.stringify(masked(h))) return false;
  const hr = h.review ?? {}, br = b.review ?? {};
  if (Object.keys(hr).some(k => !REVIEW_KEYS.has(k))) return false;
  if ('inventoryVersion' in hr && hr.inventoryVersion !== h.inventoryVersion) return false;
  if ('inventorySha256' in hr && hr.inventorySha256 !== h.inventorySha256) return false;
  const archived = JSON.stringify(hr.previousReview) === JSON.stringify(br);
  const unchanged = h.inventoryVersion === b.inventoryVersion && JSON.stringify(hr.previousReview) === JSON.stringify(br.previousReview);
  return archived || unchanged;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); }
  return out;
}

/** Label hits in text: exact-case ones always, any-case ones only on lines absent from the base. */
function labelHits(text, baseText, scannable = line => line) {
  const baseLines = baseText == null ? null : new Set(baseText.split('\n'));
  return text.split('\n').flatMap((raw, i) => {
    const line = scannable(raw);
    const strict = [...line.matchAll(LABEL)].map(m => ({ line: i + 1, label: m[0], strict: true }));
    if (strict.length) return strict;
    if (baseLines?.has(raw)) return [];
    return [...line.matchAll(LOOSE_LABEL)].map(m => ({ line: i + 1, label: m[0], strict: false }));
  });
}

/**
 * Review-placeholder scan. `baseFile(rel)` returns that file's text at the merge-base, or
 * null (no base: every any-case variant counts). Returns { errors, warnings }.
 */
/**
 * Recorded history is not a placeholder: a family transition's `replaced` rows are undo
 * copies of the prior rows (they may legitimately hold the label the transition removed),
 * and ledger.json re-emits the frozen 1.22.0 `scope.review` text from families/_base.json
 * (which carries it too; the history guard keeps _base.json byte-identical). Both are blanked before the label scan. Everything else on those lines is still scanned.
 */
export function historyFilter(root, rel) {
  if (rel.startsWith(`${FAMILIES}/`) && rel !== `${FAMILIES}/_base.json`) {
    return line => {
      const body = line.trim().replace(/,$/, '');
      if (!body.startsWith('{') || !body.includes('"replaced"')) return line;
      try {
        const t = JSON.parse(body);
        if (!t || typeof t !== 'object' || !('priorVersion' in t) || !('resultSha256' in t)) return line;
        const { replaced: _, ...rest } = t;
        return JSON.stringify(rest);
      } catch { return line; }
    };
  }
  if (rel === LEDGER || rel === `${FAMILIES}/_base.json`) {
    let frozen = null;
    try { frozen = JSON.parse(readFileSync(join(root, FAMILIES, '_base.json'), 'utf8')).scope?.review ?? null; } catch {}
    if (typeof frozen !== 'string' || !frozen) return line => line;
    const forms = [frozen, JSON.stringify(frozen).slice(1, -1)];
    return line => forms.reduce((l, f) => l.split(f).join(''), line);
  }
  return line => line;
}

export function scanLabels(root, baseFile = () => null) {
  const errors = [], warnings = [];
  const strict = [...walk(join(root, FAMILIES)).map(f => posix(relative(root, f))), LEDGER].filter(f => existsSync(join(root, f)));
  for (const f of strict) for (const h of labelHits(readFileSync(join(root, f), 'utf8'), baseFile(f), historyFilter(root, f))) errors.push(`${f}:${h.line}: leftover review label "${h.label}"${h.strict ? '' : ' (new line; any case counts)'}`);
  if (existsSync(join(root, EXPECTATIONS))) {
    const text = readFileSync(join(root, EXPECTATIONS), 'utf8');
    const baseText = baseFile(EXPECTATIONS);
    const hits = labelHits(text, baseText);
    if (hits.length) {
      let inReviewers = false;
      const one = new RegExp(LABEL.source);
      try { inReviewers = (JSON.parse(text).review?.reviewers ?? []).filter(r => typeof r === 'string' && one.test(r)).length === 1; } catch {}
      const single = hits.length === 1 && hits[0].strict && hits[0].label === 'PENDING' && inReviewers;
      if (single && isHashOnlyBump(baseText, text)) {
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
    // The branch's upstream (@{u}: branch.<b>.remote + branch.<b>.merge), so a lane
    // branch pushed under another name is checked where it actually lives. Without an
    // upstream, fall back to <remote>/<local branch name> and say so.
    const upRemote = tryGit(root, ['config', `branch.${branch}.remote`]);
    const upMerge = tryGit(root, ['config', `branch.${branch}.merge`]);
    const baseBranch = base.includes('/') ? base.slice(base.indexOf('/') + 1) : base;
    const [r, ref] = upRemote && upMerge && upRemote !== '.' ? [upRemote, upMerge] : [remote, `refs/heads/${branch}`];
    const label = `pushed head = HEAD (${r}/${ref.replace(/^refs\/heads\//, '')}${upMerge ? '' : ', no upstream'})`;
    if (!upMerge) warnings.push(`branch ${branch} has no upstream; checked ${remote}/${branch}. Set one with: git push -u ${remote} HEAD:${branch}`);
    if (upMerge && upMerge === `refs/heads/${baseBranch}`) {
      row(label, false, '–', `the upstream is the base branch ${baseBranch} (a worktree created from ${base}); push the lane branch with: git push -u ${remote} HEAD:${branch}`);
    } else {
      const ls = tryGit(root, ['ls-remote', r, ref]);
      const pushed = ls ? ls.split(/\s+/)[0] : '';
      if (ls === null) row(label, false, '–', `cannot reach remote ${r}`);
      else if (!pushed) row(label, false, '–', `HEAD is not pushed: ${r} has no branch ${ref.replace(/^refs\/heads\//, '')}`);
      else row(label, pushed === head, '–', pushed === head ? '' : `pushed head ${pushed.slice(0, 12)} differs from HEAD ${head.slice(0, 12)}; push (or pull) first`);
    }
  }

  if (fetch && base.startsWith(`${remote}/`)) {
    if (tryGit(root, ['fetch', '--quiet', remote, base.slice(remote.length + 1)]) === null) warnings.push(`could not fetch ${base}; comparing against the local ref`);
  }
  const mergeBase = tryGit(root, ['merge-base', 'HEAD', base]);
  if (!mergeBase) row(`merge-base with ${base}`, false, '–', `cannot resolve ${base}`);

  const baseFile = rel => (mergeBase ? tryGit(root, ['show', `${mergeBase}:${rel}`]) : null);
  const labels = scanLabels(root, baseFile);
  warnings.push(...labels.warnings);
  row('review labels', labels.errors.length === 0, '–', labels.errors.length ? `${labels.errors.length} leftover label(s); first: ${labels.errors[0]}` : labels.warnings.length ? `${labels.warnings.length} WARN` : '');
  for (const e of labels.errors.slice(1)) log(`  ${e}`);

  let list = (commands ?? defaultCommands({ trapsH, baseCommit: mergeBase ?? base, root })).filter(c => skipTests || !c.docsOnly);
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
