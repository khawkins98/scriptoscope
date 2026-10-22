#!/usr/bin/env node
// scripts/report-coverage.mjs
//
// Reports routine coverage against docs/spec/routine-inventory.json, the
// address-only denominator. This is a count of address ranges. It is NOT a
// fidelity percentage and must never be reported as one.
//
// The denominator is the frozen in-scope set (inventory `inScope`, one boolean
// column per range; rule in `inScope.rule`). Ranges are static-index bounds, not
// true function counts (round 2 sampled 2.5% bound defects, plus ~3.6% of ranges
// starting at fall-through fragments), so a re-segmentation is recorded as a
// denominator change (an inScope.changes entry), never folded in silently.
// The frozen set's identity is pinned: inScope.sha256 is the sha256 of the
// sorted '<binary> <start> <end>' lines (one per in-scope range, '\n'-joined, no
// trailing newline). Any swap, added/dropped range or moved bound exits 1. Once the
// inventory is frozen (status mentions "frozen" in any case, any pin field exists,
// or the base inventory was frozen), the pin is mandatory: `inScope.frozen` must be
// true and count, sha256 and every perBinary count must be present, so neither
// frozen:false, a reworded status nor a deleted pin switches the checks off. Against
// a frozen base, inScope.changes is append-only and a re-pin needs a new entry naming
// the new count (from/to/what). Classes are advisory only and are not used
// here. reachedFrom must be one of REACH below; an unknown value exits 1. In-scope
// ranges reached only by fallThrough (running off the end of a reached range)
// are counted like any other in-scope range and also reported separately, since
// a later re-segmentation may merge them (inventory inScope.pending).
//
//   cited    : a citation-bearing line names an address inside the range. Being
//              cited does not mean the range is decoded.
//   decoded  : an address inside the range is cited by a behavioural engine spec,
//              docs/spec/engine/<family>.md (not TEMPLATE.md or IMPLEMENTER-BRIEF.md,
//              not *.evidence.md).
//   mirrored : src/engine/coverage.json maps an address range overlapping the range
//              to a table row or driver. Entries marked 'out-of-scope' or
//              'unmirrored' don't count.
//
// Citation sources: docs/**/*.md except docs/research/** (observation data, whose
// hex values are measurements, not addresses) and docs/v2/** (plans name ranges
// to decode), LEARNINGS.md, comment lines in src/**, tests/rendering-requirements/**
// and tests/**/*-rules.mjs. Zero-padded hex (0x0080) never counts. Values below
// 0x200 (the CodeWarrior stub/glue region, where small constants like 0x100 also
// live) count only from docs/spec/** and the rule/ledger files, which cite
// addresses explicitly, and not where they read as struct offsets (inside an
// `@( )` operand, after '+', or in a '/'-joined offset list). Struct offsets in
// plain tables can still slip through; this cutoff is heuristic, like 'cited'.
//
// Addresses are attributed to a binary by a namespace heuristic. A line that
// mentions PACH (or a word starting with 'patch'; 'dispatch' does not count), a CDEF number or an Apple/1.8.2 source is attributed to that
// namespace. Otherwise the file decides: pach/header-surface paths count as
// PACH 130, cdef8/tab- paths as CDEF 8, and everything else as kDEF 0. Expect
// some misattribution: 'cited' is a heuristic count, never a denominator.
//
// Usage:
//   node scripts/report-coverage.mjs           # table on stdout
//   node scripts/report-coverage.mjs --json    # machine-readable
//   --root <dir>             report on another checkout (CI runs the base's copy of this script on the head)
//   --base-commit <sha>      also require the pin if the inventory at <sha> was frozen (exit 2 if unreadable)
//   --base-inventory <path>  the same, from a file (tests)
// Without --base-*, and without --inventory, the base is merge-base(HEAD, origin/v2) when
// that resolves; otherwise the base comparison is skipped with a note.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const argOf = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const repoRoot = argOf('--root') ? resolve(argOf('--root')) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --inventory <path> reads another inventory (tests only); citations still come from the repo.
const invArg = process.argv.indexOf('--inventory');
const invPath = invArg > 0 ? resolve(process.argv[invArg + 1]) : resolve(repoRoot, 'docs/spec/routine-inventory.json');
const inv = JSON.parse(readFileSync(invPath, 'utf8'));
const col = Object.fromEntries(inv.columns.map((c, i) => [c, i]));
if (col.inScope === undefined) { console.error('routine-inventory.json has no inScope column'); process.exit(2); }

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(md|ts|mjs|js|json)$/.test(name)) out.push(p);
  }
  return out;
}

const NS_HINT = [
  // `patch` only as a word start, so 'dispatch' no longer reads as a PACH hint.
  ['PACH130', /PACH|pach130|\bpatch/i],
  ['CDEF8', /CDEF ?8|cdef8|tab-cdef8/i],
  ['CDEF3', /CDEF ?3\b/], ['CDEF4', /CDEF ?4\b/], ['CDEF5', /CDEF ?5\b/],
  ['CDEF6', /CDEF ?6\b/], ['CDEF7', /CDEF ?7\b/], ['CDEF1019', /CDEF ?1019\b/],
  ['apple', /Apple|AppearanceLib|WDEF ?125|CDEF ?-|Platinum Engine|PPC|PowerPC|capstone|1\.8\.2|k182/i],
];
// One to six hex digits: ranges start as low as 0xc and 0x28 (kDEF0 toolbox glue).
// Values below LOW still count only from the explicit files, outside struct offsets.
const ADDR = /0x([0-9a-fA-F]{1,6})\b/g;
const LOW = 0x200;
const REACH = new Set(['entry', 'pcRelative', 'relocated', 'jumpTable', 'fallThrough', 'unreached']);
const COMMENT = /^\s*(\/\/|\/?\*)/;

/** Which lines of a file are citations, and whether low (<0x200) values count. */
function policy(rel) {
  if (rel === 'docs/spec/routine-inventory.json' || rel.startsWith('docs/v2/') || rel.startsWith('docs/research/')) return null;
  const explicit = rel.startsWith('docs/spec/') || rel.startsWith('tests/');
  if (rel.startsWith('src/')) return { lines: (l) => COMMENT.test(l), low: false };
  if (rel.startsWith('docs/')) return rel.endsWith('.md') ? { lines: () => true, low: explicit } : null;
  return { lines: () => true, low: explicit };
}

/** ns -> Set(addr) for the given files. */
function citations(files) {
  const out = new Map();
  for (const f of files) {
    const rel = relative(repoRoot, f);
    const pol = policy(rel);
    if (!pol) continue;
    let fdefault = /pach/i.test(rel) || rel.includes('header-surface') ? 'PACH130'
      : rel.includes('cdef8') || rel.includes('tab-') ? 'CDEF8' : 'kDEF0';
    if (/apple|platinum-(wdef|controls|theme)|kdef182/.test(rel)) fdefault = 'apple';
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!pol.lines(line)) continue;
      const ns = NS_HINT.find(([, rx]) => rx.test(line))?.[0] ?? fdefault;
      for (const m of line.matchAll(ADDR)) {
        const v = parseInt(m[1], 16);
        if (m[1].startsWith('00')) continue;
        // Low values are mostly struct offsets in the spec prose (`a4@(0x1f0)`,
        // `A4 + 0x17e`, `0x104/0x108`): skip them inside an @( ) operand, after a
        // '+' or in a '/'-joined list.
        if (v < LOW && (!pol.low || /@\(/.test(line) || /(\+\s*`?|\/)$/.test(line.slice(0, m.index)) || line[m.index + m[0].length] === '/')) continue;
        if (!out.has(ns)) out.set(ns, new Set());
        out.get(ns).add(v);
      }
    }
  }
  return out;
}

const citedFiles = [
  ...walk(resolve(repoRoot, 'docs')), ...walk(resolve(repoRoot, 'src')),
  ...walk(resolve(repoRoot, 'tests/rendering-requirements')),
  ...walk(resolve(repoRoot, 'tests')).filter((f) => f.endsWith('-rules.mjs')),
  resolve(repoRoot, 'LEARNINGS.md'),
].filter(existsSync);
const engineSpecs = walk(resolve(repoRoot, 'docs/spec/engine'))
  .filter((f) => f.endsWith('.md') && !f.endsWith('.evidence.md') && !/\/(TEMPLATE|IMPLEMENTER-BRIEF)\.md$/.test(f));
const cited = citations([...new Set(citedFiles)]);
const decoded = citations(engineSpecs);

// src/engine/coverage.json (generated by the engine; may not exist yet).
// Accepted shape: { "<binary>": [ { "range": ["0x..", "0x.."], "kind": "row"|"driver"|"out-of-scope"|"unmirrored" } ] }
const covPath = resolve(repoRoot, 'src/engine/coverage.json');
const mirrored = new Map();
if (existsSync(covPath)) {
  const cov = JSON.parse(readFileSync(covPath, 'utf8'));
  for (const [bin, entries] of Object.entries(cov)) {
    if (!Array.isArray(entries)) continue;
    mirrored.set(bin, entries.filter((e) => e.kind === 'row' || e.kind === 'driver')
      .map((e) => e.range.map((x) => parseInt(x, 16))));
  }
}

const inRange = (set, s, e) => { if (!set) return false; for (const a of set) if (a >= s && a < e) return true; return false; };
let errors = 0;
// The pin is mandatory once the inventory is frozen. Frozen means the status mentions
// "frozen" in any case, or any pin field exists (frozen:true, count, sha256, frozenOn,
// perBinary, a non-empty changes list), or the base inventory was frozen. So flipping
// frozen to false, rewording the status or deleting pin fields cannot switch the checks
// off; an unfreeze is a denominator change that must change this rule.
const isFrozen = (x) => {
  const pin = x?.inScope ?? {};
  return /frozen/i.test(String(x?.status ?? '')) || pin.frozen === true || ['count', 'sha256', 'frozenOn', 'perBinary'].some((k) => pin[k] !== undefined) || (Array.isArray(pin.changes) && pin.changes.length > 0);
};
let baseInv = null, baseNote = null;
const INV_REL = 'docs/spec/routine-inventory.json';
const gitOut = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
if (argOf('--base-inventory')) baseInv = JSON.parse(readFileSync(resolve(argOf('--base-inventory')), 'utf8'));
else if (argOf('--base-commit')) {
  const sha = argOf('--base-commit');
  try { gitOut(['cat-file', '-e', `${sha}^{commit}`]); } catch { console.error(`report-coverage: base commit ${sha} is not readable; fetch it first`); process.exit(2); }
  try { baseInv = JSON.parse(gitOut(['show', `${sha}:${INV_REL}`])); } catch { baseNote = `no ${INV_REL} at base ${sha.slice(0, 12)}`; }
} else if (invArg < 0) {
  try { const mb = gitOut(['merge-base', 'HEAD', 'origin/v2']).trim(); baseInv = JSON.parse(gitOut(['show', `${mb}:${INV_REL}`])); }
  catch { baseNote = 'base comparison skipped (no origin/v2 merge-base or no inventory there)'; }
}
const baseFrozen = baseInv !== null && isFrozen(baseInv);
const inScopeFrozen = isFrozen(inv) || baseFrozen;
if (inScopeFrozen) {
  const pin = inv.inScope ?? {};
  const why = baseFrozen && !isFrozen(inv) ? 'the base inventory is frozen' : 'the inventory is frozen';
  if (pin.frozen !== true) { errors++; console.error(`${why} but inScope.frozen is ${JSON.stringify(pin.frozen)}; a frozen denominator must keep its pin`); }
  if (!Number.isInteger(pin.count)) { errors++; console.error(`${why} but inScope.count is not an integer`); }
  if (!/^[0-9a-f]{64}$/.test(pin.sha256 ?? '')) { errors++; console.error(`${why} but inScope.sha256 is not a sha256`); }
  if (!pin.perBinary || typeof pin.perBinary !== 'object') { errors++; console.error(`${why} but inScope.perBinary is missing`); }
  else for (const name of Object.keys(inv.binaries)) if (!Number.isInteger(pin.perBinary[name])) { errors++; console.error(`${why} but inScope.perBinary.${name} is missing`); }
}
// Against a frozen base, inScope.changes is append-only, and any re-pin (a different
// sha256 or count) must be recorded by new entries, the last naming the new count. A
// consistent but unrecorded re-pin (drop a range, recompute count/perBinary/sha256) fails.
if (baseFrozen) {
  const bc = Array.isArray(baseInv.inScope?.changes) ? baseInv.inScope.changes : [];
  const hc = Array.isArray(inv.inScope?.changes) ? inv.inScope.changes : [];
  const prefixOk = hc.length >= bc.length && bc.every((e, i) => JSON.stringify(e) === JSON.stringify(hc[i]));
  if (!prefixOk) { errors++; console.error(`inScope.changes must keep the base's ${bc.length} entries unchanged and in order (append-only)`); }
  const repinned = baseInv.inScope?.sha256 !== inv.inScope?.sha256 || baseInv.inScope?.count !== inv.inScope?.count;
  if (repinned) {
    const last = hc.at(-1);
    if (!prefixOk || hc.length === bc.length) {
      errors++; console.error(`the frozen in-scope set was re-pinned (count ${baseInv.inScope?.count} -> ${inv.inScope?.count}, sha256 ${String(baseInv.inScope?.sha256).slice(0, 12)} -> ${String(inv.inScope?.sha256).slice(0, 12)}) without a new inScope.changes entry`);
    } else if (!last || last.to !== inv.inScope?.count || last.from !== baseInv.inScope?.count || typeof last.what !== 'string' || !last.what.trim()) {
      errors++; console.error(`the new inScope.changes entry must record from: ${baseInv.inScope?.count}, to: ${inv.inScope?.count} and a non-empty what`);
    }
  }
}
const report = { status: inv.status, inScopeFrozen, inScopeCount: inv.inScope?.count ?? null, binaries: {} };
const total = { ranges: 0, inScope: 0, cited: 0, decoded: 0, mirrored: 0, fallThrough: 0 };
const inScopeLines = [];
for (const [name, b] of Object.entries(inv.binaries)) {
  const r = { ranges: 0, inScope: 0, cited: 0, decoded: 0, mirrored: 0, fallThrough: 0 };
  for (const row of b.routines) {
    r.ranges++;
    const how = row[col.reachedFrom];
    if (!REACH.has(how)) { errors++; console.error(`${name} ${row[col.start]}: unknown reachedFrom ${JSON.stringify(how)}`); }
    if (row[col.inScope] !== true) continue;
    if (how === 'unreached') { errors++; console.error(`${name} ${row[col.start]}: in scope but unreached`); }
    if (how === 'fallThrough') r.fallThrough++;
    const s = parseInt(row[col.start], 16), e = parseInt(row[col.end], 16);
    r.inScope++;
    inScopeLines.push(`${name} ${row[col.start]} ${row[col.end]}`);
    if (inRange(cited.get(name), s, e)) r.cited++;
    if (inRange(decoded.get(name), s, e)) r.decoded++;
    if ((mirrored.get(name) ?? []).some(([ms, me]) => ms < e && me > s)) r.mirrored++;
  }
  const want = inv.inScope?.perBinary?.[name];
  if (want !== undefined && want !== r.inScope) { errors++; console.error(`${name}: ${r.inScope} in-scope rows, inventory says ${want}`); }
  report.binaries[name] = r;
  for (const k of Object.keys(total)) total[k] += r[k];
}
report.total = total;
if (report.inScopeFrozen && total.inScope !== report.inScopeCount) { errors++; console.error(`in-scope rows ${total.inScope} != frozen count ${report.inScopeCount}`); }
report.inScopeSha256 = createHash('sha256').update(inScopeLines.sort().join('\n')).digest('hex');
if (report.inScopeFrozen && report.inScopeSha256 !== inv.inScope?.sha256) {
  errors++;
  console.error(`in-scope set sha256 ${report.inScopeSha256} != frozen inScope.sha256 ${inv.inScope?.sha256}: the frozen set changed (swap, add/drop or moved bound). Record it in inScope.changes and re-pin.`);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const pad = (v, n) => String(v).padStart(n);
  console.log(`routine coverage (inventory: ${inv.status}; in-scope ${report.inScopeFrozen ? 'frozen at ' + report.inScopeCount : 'NOT frozen'})`);
  console.log('counts of address ranges, not a fidelity percentage; columns after in-scope count in-scope ranges only');
  console.log('binary      ranges  in-scope   cited  decoded  mirrored  fallThrough');
  for (const [n, r] of [...Object.entries(report.binaries), ['total', total]]) {
    console.log(`${n.padEnd(9)} ${pad(r.ranges, 8)} ${pad(r.inScope, 9)} ${pad(r.cited, 7)} ${pad(r.decoded, 8)} ${pad(r.mirrored, 9)} ${pad(r.fallThrough, 12)}`);
  }
  for (const pnd of inv.inScope?.pending ?? []) console.log(`pending denominator change -> ${pnd.to}: ${pnd.what}`);
  if (baseNote) console.log(baseNote);
}
if (errors) process.exit(1);
