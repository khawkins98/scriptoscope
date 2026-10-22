#!/usr/bin/env node
// Engine diff gate (v2 PLAN §6). Renders the cases.mjs matrix in Node, reduces
// every cell to a trace digest and compares it with the committed baseline.
//
//   node tests/engine-diff/run.mjs --check                      head tree vs its own baselines
//   node tests/engine-diff/run.mjs --check --base-commit <sha>  vs the baselines at <sha> (CI, lane:ready)
//        [--declared window,scrollbar | --declared-from-diff]  families this PR may change
//   node tests/engine-diff/run.mjs --write [--family f]         re-seed baselines/<family>.json
//   node tests/engine-diff/run.mjs --dump <family>/<slug>/<cell key>   print one cell's trace
//   [--family f]  restrict to one family (default: all)
//
// The rule. For each family, every cell whose digest differs from the base
// baseline (and every added or removed cell) must be listed in
// expected/<family>.json as { key, rule, sha256, why }: `sha256` is the cell's new
// digest (null for a removed cell), `rule` a decision-table row id from the
// family's spec (cases.mjs `rules`) or an evidence id of the family's own ledger
// file (tests/rendering-requirements/families/<family>.json `evidence[].id`, e.g.
// kdef.too-short-step for window), `why` one sentence. The family must also be
// declared for the PR: the PR body line `engine-diff: <family>[, <family>]` in
// CI, or, with --declared-from-diff, a family whose expected/ or baselines/ file
// changed since the base. Every family with a baseline at the base must still be
// in cases.mjs (a deleted or renamed family fails), every committed baseline must
// belong to a family, and a seed may not reproduce a base family's digests.
// A family with no baseline at the base is being seeded:
// it must be declared, and its cells need no blessing. And the committed baseline must equal the head's
// output, so the merged baseline is current. Expected entries whose digest the
// base already has are inert (from an earlier PR) and only reported.
//
// The base copy of the harness also runs. With --base-commit, when the PR changed
// tests/engine-diff/cases.mjs, the base's cases.mjs is written next to this file
// (so its relative imports load the HEAD runtime), rendered, and compared with the
// base baselines: every cell it sees change must be listed (by key) in the head's
// expected/<family>.json and its family declared. So a cases.mjs edit cannot hide a
// runtime regression, e.g. by compensating for it before the digest. Digests are
// not compared there (an intended harness change legitimately gives the head's
// trace a different shape), and families the base harness does not know are
// judged by the head run alone. A base harness that cannot run on the head runtime
// fails the gate; only cases.mjs is taken from the base, its helpers are the head's.
//
// Run time: the full matrix (about 4,200 cells over 18 archives) takes a few
// seconds; most of it is archive decoding.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unlinkSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const baselinePath = f => join(HERE, 'baselines', `${f}.json`);
export const expectedPath = f => join(HERE, 'expected', `${f}.json`);
const REL = { baseline: f => `tests/engine-diff/baselines/${f}.json`, expected: f => `tests/engine-diff/expected/${f}.json` };

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}
/** Digest of a trace: sha256 of its canonical JSON (keys sorted, array order kept), first 16 hex. */
export const traceDigest = trace => createHash('sha256').update(JSON.stringify(sortKeys(trace))).digest('hex').slice(0, 16);

/** Decision-table row ids (first column `| ID |`) of the family's spec files. */
export function ruleIds(files, root = ROOT) {
  const ids = new Set();
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const m of text.matchAll(/^\|\s*\*{0,2}([A-Z]{1,3}[0-9]+[a-z]?)\*{0,2}\s*\|/gm)) ids.add(m[1]);
  }
  return ids;
}

/** Evidence ids of the family's ledger file; valid `rule` ids alongside the spec rows.
 *  Only the family's own file counts, so one family cannot bless with another's evidence. */
export function ledgerEvidenceIds(family, root = ROOT) {
  const p = join(root, 'tests/rendering-requirements/families', `${family}.json`);
  if (!/^[\w-]+$/.test(family) || !existsSync(p)) return new Set();
  return new Set((JSON.parse(readFileSync(p, 'utf8')).evidence ?? []).map(e => e?.id).filter(id => typeof id === 'string' && id));
}

/** Valid `rule` ids for a family: spec decision-table rows plus its ledger evidence ids. */
export const familyRules = (family, specFiles, root = ROOT) => new Set([...ruleIds(specFiles, root), ...ledgerEvidenceIds(family, root)]);

/** Compute { "<slug>/<cell key>": digest } for one family (optionally a slug subset or input
 *  mutation; `cases` is the harness module, default ./cases.mjs). */
export async function computeFamily(family, { slugs = null, mutate, cases } = {}) {
  const { FAMILIES, themeSlugs, decode } = cases ?? await import('./cases.mjs');
  const fam = FAMILIES[family];
  if (!fam) throw new Error(`unknown family ${family} (known: ${Object.keys(FAMILIES).join(', ')})`);
  const cells = {};
  for (const slug of slugs ?? themeSlugs()) {
    const decoded = await decode(slug);
    for await (const { key, trace } of fam.cells({ slug, decoded, ...(mutate ? { mutate } : {}) })) {
      const k = `${slug}/${key}`;
      if (k in cells) throw new Error(`${family}: duplicate cell key ${k}`);
      cells[k] = traceDigest(trace);
    }
  }
  return cells;
}

export function formatBaseline(family, cells) {
  const keys = Object.keys(cells).sort();
  return `{\n  "family": ${JSON.stringify(family)},\n  "cells": {\n${keys.map(k => `    ${JSON.stringify(k)}: ${JSON.stringify(cells[k])}`).join(',\n')}\n  }\n}\n`;
}

/**
 * The pure gate. base/head: cell maps. expected: [{key, rule, sha256, why}]. Returns
 * { diffs, errors, inert }. A diff is { key, from, to } (null = absent).
 */
export function compare({ family, base, head, expected = [], declared = true, rules }) {
  const errors = [], inert = [];
  const diffs = [...new Set([...Object.keys(base), ...Object.keys(head)])].sort()
    .filter(k => base[k] !== head[k]).map(k => ({ key: k, from: base[k] ?? null, to: head[k] ?? null }));
  const byKey = new Map();
  for (const e of expected) {
    if (!e || typeof e.key !== 'string') { errors.push(`${family}: expected entry without a key`); continue; }
    if (byKey.has(e.key)) errors.push(`${family}: expected lists ${e.key} twice`);
    byKey.set(e.key, e);
    if (!rules.has(e.rule)) errors.push(`${family}: expected ${e.key} names rule ${JSON.stringify(e.rule)}, not a decision-table row of the family spec or an evidence id of its ledger family`);
    if (typeof e.why !== 'string' || !e.why.trim()) errors.push(`${family}: expected ${e.key} needs a one-sentence why`);
  }
  for (const d of diffs) {
    const e = byKey.get(d.key);
    if (!e) { errors.push(`${family}: ${d.key} changed (${d.from ?? 'absent'} -> ${d.to ?? 'removed'}) and is not listed in expected/${family}.json`); continue; }
    if ((e.sha256 ?? null) !== d.to) errors.push(`${family}: ${d.key} changed to ${d.to ?? 'removed'}, but expected/${family}.json blesses ${e.sha256 ?? 'removed'}`);
  }
  if (diffs.length && !declared) errors.push(`${family}: ${diffs.length} cell(s) changed but the PR does not declare "engine-diff: ${family}"`);
  const changed = new Set(diffs.map(d => d.key));
  for (const e of expected) if (e?.key && !changed.has(e.key)) {
    if ((e.sha256 ?? null) === (head[e.key] ?? null)) inert.push(e.key);
    else errors.push(`${family}: expected ${e.key} blesses ${e.sha256 ?? 'removed'}, but the cell is unchanged at ${head[e.key] ?? 'absent'}`);
  }
  return { diffs, errors, inert };
}

/**
 * The base-harness check (pure). base: the base baseline cells; head: the BASE copy of
 * cases.mjs rendered on the head runtime. Every changed cell must be listed by key in
 * the head's expected entries, and the family declared. Returns { diffs, errors }.
 */
export function compareBaseHarness({ family, base, head, expected = [], declared = true }) {
  const listed = new Set(expected.filter(e => e && typeof e.key === 'string').map(e => e.key));
  const diffs = [...new Set([...Object.keys(base), ...Object.keys(head)])].sort()
    .filter(k => base[k] !== head[k]).map(k => ({ key: k, from: base[k] ?? null, to: head[k] ?? null }));
  const errors = diffs.filter(d => !listed.has(d.key))
    .map(d => `${family}: the base copy of cases.mjs sees ${d.key} change (${d.from ?? 'absent'} -> ${d.to ?? 'removed'}) on the head runtime, and expected/${family}.json does not list it; the head harness may be hiding a runtime change`);
  if (diffs.length && !declared) errors.push(`${family}: the base copy of cases.mjs sees ${diffs.length} cell(s) change but the PR does not declare "engine-diff: ${family}"`);
  return { diffs, errors };
}

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const tryGit = args => { try { return git(args); } catch { return null; } };
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);

/** Families declared in a PR body: lines `engine-diff: a, b` (or `none`). */
export function declaredFromBody(body) {
  const out = new Set();
  for (const m of String(body ?? '').matchAll(/^\s*engine-diff:\s*([^\n]+)$/gim)) for (const f of m[1].split(/[\s,]+/)) if (f && f !== 'none') out.add(f.replace(/[`*]/g, ''));
  return out;
}

async function main(argv) {
  const opt = n => { const i = argv.indexOf(n); return i < 0 ? undefined : argv[i + 1]; };
  const { FAMILIES } = await import('./cases.mjs');
  const families = opt('--family') ? [opt('--family')] : Object.keys(FAMILIES);
  if (argv.includes('--dump')) {
    const [family, slug, ...rest] = opt('--dump').split('/');
    const { decode } = await import('./cases.mjs');
    for await (const c of FAMILIES[family].cells({ slug, decoded: await decode(slug) })) if (c.key === rest.join('/')) { console.log(JSON.stringify(c.trace, null, 1)); return 0; }
    console.error(`no cell ${opt('--dump')}`); return 2;
  }
  const t0 = Date.now();
  if (argv.includes('--write')) {
    mkdirSync(join(HERE, 'baselines'), { recursive: true });
    for (const f of families) { const cells = await computeFamily(f); writeFileSync(baselinePath(f), formatBaseline(f, cells)); console.log(`engine-diff: wrote baselines/${f}.json (${Object.keys(cells).length} cells)`); }
    return 0;
  }
  const baseCommit = opt('--base-commit');
  if (baseCommit) {
    try { git(['cat-file', '-e', `${baseCommit}^{commit}`]); } catch { console.error(`engine-diff: base commit ${baseCommit} is not readable; fetch it first`); return 2; }
  }
  let declared = null; // null = every family may change (local --check without a base)
  if (opt('--declared') !== undefined) declared = new Set(opt('--declared').split(/[\s,]+/).filter(f => f && f !== 'none'));
  else if (argv.includes('--declared-from-diff') && baseCommit) {
    const changed = git(['diff', '--name-only', baseCommit, '--', 'tests/engine-diff/expected', 'tests/engine-diff/baselines']).split('\n').filter(Boolean);
    declared = new Set(changed.map(p => p.match(/\/(?:expected|baselines)\/([\w-]+)\.json$/)?.[1]).filter(Boolean));
  } else if (process.env.ENGINE_DIFF_PR_BODY !== undefined) declared = declaredFromBody(process.env.ENGINE_DIFF_PR_BODY);
  for (const f of declared ?? []) if (!FAMILIES[f]) { console.error(`engine-diff: declared family ${f} is unknown (known: ${Object.keys(FAMILIES).join(', ')})`); return 1; }

  let failed = 0;
  // Families are judged from the base, not only from the head's cases.mjs: a family
  // with a baseline at the base must still exist (deleting or renaming one would
  // otherwise skip its cells, or re-seed them under a new name with no blessing).
  // Every committed baseline must belong to a known family, and a seed may not
  // reproduce any base family's digests.
  const baseFamilies = baseCommit ? (tryGit(['ls-tree', '--name-only', `${baseCommit}:tests/engine-diff/baselines`]) ?? '').split('\n').filter(n => n.endsWith('.json')).map(n => n.replace(/\.json$/, '')) : [];
  const baseDigests = new Map();
  for (const f of baseFamilies) {
    if (!FAMILIES[f]) {
      console.error(`engine-diff: ${f}: has a baseline at base ${baseCommit.slice(0, 12)} but is not a family in cases.mjs. Removing or renaming a family is not allowed by this gate; restore it (a deliberate removal is a maintainer change to the gate).`);
      failed++;
    }
    for (const d of Object.values(JSON.parse(git(['show', `${baseCommit}:${REL.baseline(f)}`])).cells ?? {})) baseDigests.set(d, f);
  }
  for (const n of existsSync(join(HERE, 'baselines')) ? readdirSync(join(HERE, 'baselines')).filter(x => x.endsWith('.json')) : []) {
    const f = n.replace(/\.json$/, '');
    if (!FAMILIES[f]) { console.error(`engine-diff: baselines/${n} belongs to no family in cases.mjs`); failed++; }
  }
  for (const family of families) {
    const head = await computeFamily(family);
    const committed = readJson(baselinePath(family), null);
    const expected = readJson(expectedPath(family), { entries: [] }).entries ?? [];
    let base, seed = false;
    if (baseCommit) {
      try { base = JSON.parse(git(['show', `${baseCommit}:${REL.baseline(family)}`])).cells; }
      catch { base = head; seed = true; }
    } else base = committed?.cells ?? {};
    const rules = familyRules(family, FAMILIES[family].rules);
    const isDeclared = declared === null || declared.has(family);
    const r = compare({ family, base, head, expected, declared: isDeclared, rules });
    // A family with no baseline at the base is being seeded: there is nothing to
    // regress against, so no per-cell blessing, but the seed must be declared.
    if (seed) {
      console.log(`engine-diff: ${family}: no baseline at base ${baseCommit.slice(0, 12)}; seeding ${Object.keys(head).length} cells`);
      const taken = [...new Set(Object.values(head).map(d => baseDigests.get(d)).filter(Boolean))];
      if (taken.length) r.errors.push(`${family}: the seed reproduces cells of base famil${taken.length === 1 ? 'y' : 'ies'} ${taken.join(', ')}; a new family cannot take over existing cells`);
      if (!isDeclared) r.errors.push(`${family}: seeding a new baseline requires declaring the family ("engine-diff: ${family}" in the PR body)`);
    }
    if (!committed) r.errors.push(`${family}: no committed baseline; run node tests/engine-diff/run.mjs --write --family ${family}`);
    else if (JSON.stringify(committed.cells) !== JSON.stringify(Object.fromEntries(Object.keys(head).sort().map(k => [k, head[k]])))) {
      r.errors.push(`${family}: baselines/${family}.json is not the head's output; after blessing the diffs run: npm run engine-diff:write`);
    }
    const cells = Object.keys(head).length;
    console.log(`engine-diff: ${family}: ${cells} cells, ${r.diffs.length} changed vs ${baseCommit ? `base ${baseCommit.slice(0, 12)}` : 'committed baseline'}${r.inert.length ? `, ${r.inert.length} inert expected entr${r.inert.length === 1 ? 'y' : 'ies'}` : ''}`);
    for (const d of r.diffs.slice(0, 20)) console.log(`  ${d.key}: ${d.from ?? 'absent'} -> ${d.to ?? 'removed'}`);
    if (r.diffs.length > 20) console.log(`  ... ${r.diffs.length - 20} more`);
    for (const e of r.errors.slice(0, 30)) console.error(`engine-diff: ${e}`);
    if (r.errors.length > 30) console.error(`engine-diff: ... ${r.errors.length - 30} more problem(s) in ${family}`);
    if (r.errors.length) failed++;
  }
  if (baseCommit) failed += await baseHarness({ baseCommit, families, declared });
  console.log(`engine-diff: ${failed ? `FAIL (${failed} famil${failed === 1 ? 'y' : 'ies'})` : 'pass'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return failed ? 1 : 0;
}

/** Run the base's cases.mjs on the head runtime (see the header). Returns the failed-family count. */
async function baseHarness({ baseCommit, families, declared }) {
  const baseCases = tryGit(['show', `${baseCommit}:tests/engine-diff/cases.mjs`]);
  if (baseCases === null) { console.log(`engine-diff: no cases.mjs at base ${baseCommit.slice(0, 12)}; base harness skipped`); return 0; }
  if (baseCases === readFileSync(join(HERE, 'cases.mjs'), 'utf8')) { console.log('engine-diff: cases.mjs unchanged since the base; the base harness is the head harness'); return 0; }
  const tmp = join(HERE, `.cases-base-${process.pid}.mjs`);
  let failed = 0;
  try {
    writeFileSync(tmp, baseCases);
    const cases = await import(pathToFileURL(tmp).href);
    for (const family of families) {
      if (!cases.FAMILIES?.[family]) continue;
      let base;
      try { base = JSON.parse(git(['show', `${baseCommit}:${REL.baseline(family)}`])).cells; } catch { continue; }
      const head = await computeFamily(family, { cases });
      const expected = readJson(expectedPath(family), { entries: [] }).entries ?? [];
      const r = compareBaseHarness({ family, base, head, expected, declared: declared === null || declared.has(family) });
      console.log(`engine-diff: ${family}: base copy of cases.mjs on the head runtime: ${r.diffs.length} changed vs base ${baseCommit.slice(0, 12)}`);
      for (const e of r.errors.slice(0, 30)) console.error(`engine-diff: ${e}`);
      if (r.errors.length > 30) console.error(`engine-diff: ... ${r.errors.length - 30} more problem(s) in ${family} (base harness)`);
      if (r.errors.length) failed++;
    }
  } catch (e) {
    console.error(`engine-diff: the base copy of cases.mjs (${baseCommit.slice(0, 12)}) failed on the head runtime: ${e?.message ?? e}. A harness change that the base copy cannot run is a maintainer change to the gate.`);
    failed++;
  } finally { try { unlinkSync(tmp); } catch {} }
  return failed;
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) process.exit(await main(process.argv.slice(2)));
