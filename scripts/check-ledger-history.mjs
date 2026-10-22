#!/usr/bin/env node
// Ledger history guard (v2 L0).
//
// Each tests/rendering-requirements/families/<family>.json carries its own
// transition history. build-ledger.mjs proves a family's chain is internally
// consistent, but a self-consistent chain can still be rewritten: drop a
// transition, edit its summary or review and re-derive every digest after it.
// This guard compares against the history already merged. For every family file
// at the base (the PR's merge-base with v2), the head's `transitions` array must
// start with the base's records, unchanged, in the same order. Appending new
// transitions is the only allowed change. A family file may not disappear, and
// families/_base.json (the frozen split interleave) must be byte-identical.
//
//   node scripts/check-ledger-history.mjs                  # base = merge-base(HEAD, origin/v2)
//   node scripts/check-ledger-history.mjs --base <ref>     # base = merge-base(HEAD, <ref>)
//   node scripts/check-ledger-history.mjs --base-commit <sha>  # compare against exactly <sha>
//   --root <dir>   check another checkout (CI runs the base's copy of this script on the head)
//
// A base commit that cannot be read is an error (exit 2), never "nothing to guard":
// after a force-push the previous head is exactly the case this guard exists for.
// Only a readable base with no families directory passes as having nothing to guard.
//
// The head side is the working tree, so a local run checks what you are about
// to commit; CI runs it on a clean checkout of the PR.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAMILIES = 'tests/rendering-requirements/families';
const stable = value => JSON.stringify(value);

/**
 * Compare two family maps ({ name: parsed family }) plus the raw _base.json texts.
 * Returns a list of human-readable errors; empty means the head's history extends the base's.
 */
export function compareHistories(base, head, { baseText = null, headText = null } = {}) {
  const errors = [];
  if (baseText !== null && baseText !== headText) {
    errors.push('families/_base.json changed: the frozen split interleave is never edited');
  }
  for (const [name, b] of Object.entries(base)) {
    const h = head[name];
    if (!h) { errors.push(`${name}: family file present at the base was removed or renamed`); continue; }
    const bt = Array.isArray(b.transitions) ? b.transitions : [];
    const ht = Array.isArray(h.transitions) ? h.transitions : null;
    if (!ht) { errors.push(`${name}: head has no transitions array`); continue; }
    if (ht.length < bt.length) {
      errors.push(`${name}: head has ${ht.length} transition(s), the base already had ${bt.length}; recorded transitions are never removed`);
    }
    bt.forEach((t, i) => {
      if (i >= ht.length) return;
      if (stable(ht[i]) === stable(t)) return;
      const moved = ht.findIndex(x => stable(x) === stable(t));
      if (moved >= 0) { errors.push(`${name}: transition ${i} (${t.version}) moved to position ${moved}; recorded transitions are never reordered`); return; }
      const fields = [...new Set([...Object.keys(t), ...Object.keys(ht[i])])].filter(k => stable(t[k]) !== stable(ht[i][k]));
      errors.push(`${name}: transition ${i} (${t.version}) was edited after merge (${fields.join(', ')} differ); append a new transition instead`);
    });
  }
  return errors;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
}

/** Read every family file at a commit ({name: family}) and the raw _base.json text. */
export function familiesAt(root, commit) {
  const names = git(root, ['ls-tree', '--name-only', `${commit}:${FAMILIES}`]).split('\n').filter(n => n.endsWith('.json'));
  const out = {};
  let baseText = null;
  for (const n of names) {
    const text = git(root, ['show', `${commit}:${FAMILIES}/${n}`]);
    if (n === '_base.json') baseText = text;
    else out[n.replace(/\.json$/, '')] = JSON.parse(text);
  }
  return { families: out, baseText };
}

export function familiesInTree(root) {
  const dir = join(root, FAMILIES), out = {};
  let baseText = null;
  if (!existsSync(dir)) return { families: out, baseText };
  for (const n of readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const text = readFileSync(join(dir, n), 'utf8');
    if (n === '_base.json') baseText = text;
    else out[n.replace(/\.json$/, '')] = JSON.parse(text);
  }
  return { families: out, baseText };
}

export class BaseError extends Error {}
export class HeadError extends Error {}

export function checkLedgerHistory(root, { base = 'origin/v2', baseCommit = null } = {}) {
  let commit = baseCommit;
  if (!commit) {
    try { commit = git(root, ['merge-base', 'HEAD', base]).trim(); }
    catch { throw new BaseError(`cannot compute merge-base(HEAD, ${base}); fetch ${base} or pass --base-commit`); }
  }
  try { git(root, ['cat-file', '-e', `${commit}^{commit}`]); }
  catch { throw new BaseError(`base commit ${commit} is not readable here; fetch it first (git fetch origin ${commit})`); }
  try { git(root, ['cat-file', '-e', `${commit}:${FAMILIES}`]); }
  catch { return { commit, errors: [], note: `no ${FAMILIES} at ${commit.slice(0, 12)}; nothing to guard` }; }
  const atBase = familiesAt(root, commit);
  let head;
  try { head = familiesInTree(root); }
  catch (error) { throw new HeadError(`cannot read the head's family files: ${error.message}`); }
  const errors = compareHistories(atBase.families, head.families, { baseText: atBase.baseText, headText: head.baseText });
  return { commit, errors, families: Object.keys(atBase.families).length };
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf(n); return i < 0 ? undefined : args[i + 1]; };
  const root = opt('--root') ? resolve(opt('--root')) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let r;
  try { r = checkLedgerHistory(root, { base: opt('--base') ?? 'origin/v2', baseCommit: opt('--base-commit') ?? null }); }
  catch (error) {
    if (error instanceof HeadError) { console.error(`check-ledger-history: ${error.message}`); process.exit(1); }
    console.error(`check-ledger-history: ${error instanceof BaseError ? error.message : `cannot read the base: ${error.message.split('\n')[0]}`}`);
    process.exit(2);
  }
  if (r.note) { console.log(`check-ledger-history: ${r.note}`); process.exit(0); }
  for (const e of r.errors) console.error(`ledger history: ${e}`);
  if (r.errors.length) {
    console.error(`check-ledger-history: ${r.errors.length} problem(s) against base ${r.commit.slice(0, 12)}. Merged family transitions are append-only.`);
    process.exit(1);
  }
  console.log(`check-ledger-history: ${r.families} family histories at base ${r.commit.slice(0, 12)} are unchanged prefixes of the head`);
}
