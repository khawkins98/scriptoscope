#!/usr/bin/env node
// Clean-room linter (v2 PLAN §5, reviewer contamination check part 2).
//
// The runtime is a clean-room replay of the Kaleidoscope 2.3.1 kDEF. Listings
// and register-level traces live in private evidence; what reaches `src/` (and
// the behavioural specs implementers read) must be prose, tables and code
// derived from those specs. This script fails when listing-shaped text leaks
// into either.
//
// Rules (every hit is reported with file:line and the matched text):
//   register   `%d0`-`%d7`, `%a0`-`%a7` (gas/MIT register syntax)
//   frame      `fp@` / `sp@` (MIT frame- and stack-pointer addressing), and the
//              same MIT indirect form on any register (`a4@`, `d0@`)
//   register-bare  (docs only) a lower-case 68k register name `d0`-`d7` /
//              `a0`-`a7` as a whole word (register narrative such as "the
//              handle in a2"). Not applied to code, where `d0`/`a1` are
//              ordinary variable names (dst offset, alpha); hex colours
//              (`#a0a0a0`), dotted and hyphenated tokens are not words.
//   mnemonic   68k mnemonics as whole words: jsr bsr moveq movel movew lea pea
//              link unlk bne beq bra dbf rts, in all-lower or all-upper case,
//              plus the MIT short-branch spellings bnes/beqs/bras and the
//              Motorola sized forms move.b/.w/.l. A word is bounded by
//              non-identifier characters; `{@link X}` (JSDoc), `<link` (HTML)
//              and hyphenated compounds (`deep-link`) are English/markup, not
//              mnemonics, and are not words for this rule.
//   hex-ident  a JS identifier containing `0x<hex>` (address-named code, e.g.
//              `tile0xfeae`); addresses belong in table `source` strings, doc
//              comments and coverage.json, never in names (DECISIONS #2).
//   census     every numeric constant in `src/engine/` (outside `tables/` and
//              tests) must appear in a behavioural spec `docs/spec/engine/*.md`
//              (never `*.evidence.md`) or in `src/engine/tables/`. 0, 1, 2 and
//              -1 are exempt as structural. Passes vacuously while
//              `src/engine/` does not exist.
//
// Scope: every file under `src/`, every behavioural spec under
// `docs/spec/engine/` (excluding `*.evidence.md`), the main spec docs listed in
// SPLIT_DOCS once their asm narrative has moved to evidence, and the rule
// tables in RULE_TABLES once scrubbed. Lists only grow.
//
// Usage:
//   node scripts/check-cleanroom.mjs            # lint the repo; exit 1 on any hit
//   node scripts/check-cleanroom.mjs --root DIR # lint another tree (tests)
//   node scripts/check-cleanroom.mjs --json     # machine-readable hits

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Main spec docs whose listing narrative has moved to docs/spec/engine/*.evidence.md. */
export const SPLIT_DOCS = [
  'docs/spec/compositor-spec.md',
  'docs/spec/cinf-resize-behavior.md',
];

/** Rule tables implementers read (PLAN §5); scrubbed of listing narrative. */
export const RULE_TABLES = [
  'tests/rendering-options/window-chrome-rules.mjs',
  'tests/rendering-options/window-chrome-rules.test.mjs',
];

const MNEMONICS = ['jsr', 'bsr', 'moveq', 'movel', 'movew', 'lea', 'pea', 'link', 'unlk', 'bne', 'beq', 'bra', 'dbf', 'rts', 'bnes', 'beqs', 'bras'];
const SCANNED_EXT = /\.(ts|mts|cts|js|mjs|cjs|css|html|json|md)$/;

const RULES = [
  { id: 'register', re: /%[da][0-7](?![0-9])/g },
  { id: 'frame', re: /\b(?:fp|sp|[ad][0-7])@/g },
  { id: 'register-bare', docsOnly: true, re: /(?<![\w$#.\-])[ad][0-7](?![\w$@\-])/g },
  {
    id: 'mnemonic',
    re: new RegExp(
      `(?<![\\w$@<\\-.])(?:${MNEMONICS.join('|')}|${MNEMONICS.map(m => m.toUpperCase()).join('|')}|move\\.[bwl]|MOVE\\.[BWL])(?![\\w$\\-])`,
      'g',
    ),
  },
  { id: 'hex-ident', re: /(?<![\w$])[A-Za-z_$][\w$]*?0x[0-9a-fA-F]+[\w$]*|(?<![\w$])0x[0-9a-fA-F]+[g-zG-Z_$][\w$]*/g },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const posix = p => p.split(sep).join('/');

/** Scan text with the pattern rules; returns [{rule, line, text}]. */
export function scanText(text, { docs = false } = {}) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const { id, re, docsOnly } of RULES) {
      if (docsOnly && !docs) continue;
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) hits.push({ rule: id, line: i + 1, text: m[0] });
    }
  });
  return hits;
}

/** Normalised numeric value of a JS/spec numeric token, or null. */
function numberOf(token) {
  const t = token.replace(/_/g, '');
  const neg = t.startsWith('-') || t.startsWith('−');
  const body = t.replace(/^[-−]/, '');
  let v;
  if (/^0x[0-9a-f]+$/i.test(body)) v = parseInt(body, 16);
  else if (/^0b[01]+$/i.test(body)) v = parseInt(body.slice(2), 2);
  else if (/^\d+(\.\d+)?$/.test(body)) v = Number(body);
  else return null;
  return neg ? -v : v;
}

const NUMBER_TOKEN = /(?<![\w$.])[-−]?(?:0x[0-9a-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.\d+)?)(?![\w$])/g;

function numbersIn(text) {
  const set = new Set();
  for (const m of text.matchAll(NUMBER_TOKEN)) {
    const v = numberOf(m[0]);
    if (v !== null) { set.add(v); set.add(Math.abs(v)); }
  }
  return set;
}

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Constant census for src/engine: returns [{file, line, text}] for unanchored constants. */
export function census(root) {
  const engine = join(root, 'src/engine');
  if (!existsSync(engine)) return { skipped: true, hits: [] };
  const tablesDir = join(engine, 'tables');
  const specDir = join(root, 'docs/spec/engine');
  const anchored = new Set([0, 1, 2, -1]);
  for (const f of walk(specDir)) if (f.endsWith('.md') && !f.endsWith('.evidence.md')) for (const v of numbersIn(readFileSync(f, 'utf8'))) anchored.add(v);
  for (const f of walk(tablesDir)) if (!/\.test\./.test(f)) for (const v of numbersIn(stripComments(readFileSync(f, 'utf8')))) anchored.add(v);
  const hits = [];
  for (const f of walk(engine)) {
    if (f.startsWith(tablesDir + sep) || /\.test\.|\.json$/.test(f) || !/\.(ts|mts|js|mjs)$/.test(f)) continue;
    stripComments(readFileSync(f, 'utf8')).split('\n').forEach((line, i) => {
      for (const m of line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""').matchAll(NUMBER_TOKEN)) {
        const v = numberOf(m[0]);
        if (v !== null && !anchored.has(v) && !anchored.has(Math.abs(v))) hits.push({ file: posix(relative(root, f)), rule: 'census', line: i + 1, text: m[0] });
      }
    });
  }
  return { skipped: false, hits };
}

/** Files the pattern rules apply to, relative to root. */
export function targets(root) {
  const files = walk(join(root, 'src')).filter(f => SCANNED_EXT.test(f));
  for (const f of walk(join(root, 'docs/spec/engine'))) if (f.endsWith('.md') && !f.endsWith('.evidence.md')) files.push(f);
  for (const d of [...SPLIT_DOCS, ...RULE_TABLES]) if (existsSync(join(root, d))) files.push(join(root, d));
  return files;
}

/** Run every rule over root; returns {hits, censusSkipped}. */
export function checkCleanroom(root) {
  const hits = [];
  for (const f of targets(root)) for (const h of scanText(readFileSync(f, 'utf8'), { docs: f.endsWith('.md') })) hits.push({ file: posix(relative(root, f)), ...h });
  const c = census(root);
  hits.push(...c.hits);
  return { hits, censusSkipped: c.skipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const rootArg = args.indexOf('--root');
  const root = rootArg >= 0 ? args[rootArg + 1] : join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const { hits, censusSkipped } = checkCleanroom(root);
  if (args.includes('--json')) console.log(JSON.stringify({ hits, censusSkipped }, null, 2));
  else {
    for (const h of hits) console.log(`${h.file}:${h.line}: [${h.rule}] ${h.text}`);
    console.log(`check-cleanroom: ${hits.length} hit(s)${censusSkipped ? '; constant census skipped (no src/engine/)' : ''}`);
  }
  process.exit(hits.length ? 1 : 0);
}
