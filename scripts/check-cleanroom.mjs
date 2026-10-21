#!/usr/bin/env node
// Clean-room linter (v2 PLAN §5, reviewer contamination check part 2).
//
// The runtime is a clean-room replay of the Kaleidoscope 2.3.1 kDEF. Listings
// and register-level traces live in private evidence; what reaches `src/`, the
// rule tables and the behavioural docs implementers read must be prose, tables
// and code derived from those specs. This script fails when listing-shaped text
// leaks into any of them.
//
// Each rule has a scope: `all` (every scanned byte), `prose` (Markdown docs and
// the comments of code files), `docs` (Markdown only) or `code` (code files
// only, comments included). Comments are where narrative leaks; in code proper,
// `d0`/`a1` are ordinary variable names (dst offset, alpha), so register-name
// rules look only at comments there.
//
//   register       all    `%d0`-`%d7`, `%a0`-`%a7` (gas/MIT register syntax)
//   frame          all    `fp@` / `sp@` and the MIT indirect form on any
//                         register (`a4@`, `D0@`)
//   register-bare  prose  a 68k register name `d0`-`d7` / `a0`-`a7`, lower or
//                         upper case, as a whole word ("the handle in a2", "D3").
//                         Hex colours (`#a0a0a0`), dotted and hyphenated tokens
//                         (`local-D0`) are not words.
//   addressing     prose  Motorola operands `-(sp)`, `(sp)+`, `(a2)`, `(A7)+`
//   mnemonic       all    68k mnemonics as whole words, lower or upper case:
//                         - always: jsr bsr jmp moveq movel movew moveb movea
//                           movem unlk rts rtd rte dbf dbra, the Bcc family
//                           (bne beq bgt blt bge ble bhi bls bcc bcs bpl, plus
//                           s/w/l suffixes, and bras/braw/bral), addq subq cmpi
//                           cmpa cmpm tst clr lsl lsr asl asr roxl roxr, and the
//                           size-suffixed family (cmpib, tstw, addql, clrb, extl,
//                           andiw, lsrw, mulsw, divsw, negl, ...);
//                         - Motorola sized forms `move.l`, `cmp.w`, `tst.b`, ...;
//                         - with an operand only (they are also English): link
//                           lea pea bra cmp add sub and or not neg ext swap move,
//                           when followed by a register, `%`, `#imm,`, `-(` or a
//                           frame operand; link/lea/pea/bra also with a hex
//                           address ("lea a4@(2788)", "bra 0x264", "link a6,#-4";
//                           not "see the link below" or "0x00 or 0x07").
//                         `{@link X}` (JSDoc), `<link` (HTML) and hyphenated
//                         compounds (`deep-link`) are never words.
//   ghidra         all    decompiler names: `FUN_<hex>`, `LAB_`/`DAT_`/`PTR_<hex>`,
//                         `sVar5`/`uVar2`/`iVar1`/`cVar0`, `param_5`, `local_1c`,
//                         `auStack_`/`uStack_`/`iStack_<hex>`
//   listing-path   all    pointers to listings: `.scratch` (except on a line naming a `.sit` theme
//                         fixture), `*.asm`, `objdump`,
//                         `/tmp/kaleido-trace`, the `k231-kdef`/`k182-kdef`
//                         listing directories. (The implementer brief is exempt:
//                         it has to name what it forbids.)
//   listing-line   docs   an objdump line (`  4f18:  a888  .short 0xa888`)
//   hex-ident      code   a JS identifier containing `0x<hex>` not preceded by a
//                         digit (address-named code such as `tile0xfeae`;
//                         `empty80x20` is a dimension, not an address). Addresses
//                         belong in table `source` strings, doc comments and
//                         coverage.json, never in names (DECISIONS #2).
//   census         code   every numeric constant in `src/engine/` (outside
//                         `tables/` and tests) must appear in a behavioural spec
//                         `docs/spec/engine/*.md` (never `*.evidence.md`) or in
//                         `src/engine/tables/`. 0, 1, 2 and -1 are exempt as
//                         structural. Passes vacuously while `src/engine/` does
//                         not exist.
//   brief-scope    -      every path the implementer brief allows (its
//                         "Allowed paths" section) is inside this linter's scope,
//                         so the brief can never allow an unlinted file.
//
// Scope: every code file under `src/` and `tools/`, every behavioural spec under
// `docs/spec/engine/` (excluding `*.evidence.md`), the docs in ALLOWED_DOCS and
// the rule tables in RULE_TABLES. Lists only grow.
//
// Usage:
//   node scripts/check-cleanroom.mjs            # lint the repo; exit 1 on any hit
//   node scripts/check-cleanroom.mjs --root DIR # lint another tree (tests)
//   node scripts/check-cleanroom.mjs --json     # machine-readable hits
//   node scripts/check-cleanroom.mjs --files A.md B.ts  # lint just these files

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Docs implementers may read (IMPLEMENTER-BRIEF "Allowed paths"); each is
 * listing-free and linted. Split docs (from `docs/spec/compositor-spec.md` and
 * the second block below) joined as their asm narrative moved to
 * docs/spec/engine/*.evidence.md.
 */
export const ALLOWED_DOCS = [
  'docs/spec/compositor-spec.md',
  'docs/spec/cinf-resize-behavior.md',
  'docs/spec/cinf-lookup-contract.md',
  'docs/spec/control-face-geometry.md',
  'docs/spec/control-border-boundaries.md',
  'docs/spec/control-solid-background.md',
  'docs/spec/control-text-colors.md',
  'docs/spec/cicn-body-mode5.md',
  'docs/spec/push-button-selection.md',
  'docs/spec/default-button-caller-boundaries.md',
  'docs/spec/progress-caller-boundary.md',
  'docs/spec/slider-layout-cinf.md',
  'docs/spec/slider-interaction.md',
  'docs/spec/slider-selected-metadata.md',
  'docs/spec/header-surface.md',
  'docs/spec/header-sampled-lines.md',
  'docs/spec/finite-cicn-transfer.md',
  'docs/spec/cicn-decoding.md',
  'docs/spec/cicn-sparse-transfer.md',
  'docs/spec/ppat-decoding.md',
  'docs/spec/wnd-decoding.md',
  'docs/spec/display-profile.md',
  'docs/spec/indexed-sampling-equivalence.md',
  'docs/spec/managed-control-context.md',
  'docs/spec/prepared-bitmap-font.md',
  'docs/spec/fidelity-compatibility-contract.md',
  'docs/spec/apple-primary-source.md',
  'docs/spec/corpus-corroborated-ids.md',
  'docs/spec/kdef231-recipe-walk.md',
  'docs/spec/kdef-service-handlers.md',
  'docs/spec/kdef-faithfulness-ledger.md',
  'docs/spec/kdef-architecture.md',
  'docs/spec/kdef182-disassembly-findings.md',
  'docs/spec/cinf-extended-decode.md',
  'docs/spec/platinum-controls-decode.md',
  'docs/spec/platinum-controls-faithfulness-ledger.md',
  'docs/spec/platinum-wdef125-decode.md',
  'docs/spec/platinum-theme-provider-decode.md',
  'docs/spec/apple-cdef-geometry.md',
  'docs/spec/apple-cdef-button-geometry.md',
  'docs/spec/apple-cdef-button-vs-our-compose.md',
  'docs/spec/apple-drawtheme-decode.md',
  'docs/spec/apple-appearancelib-spike.md',
  'docs/spec/codebase-vs-primary-sources-audit.md',
  'docs/spec/control-pattern-context.md',
  'docs/spec/control-resolution-diagnostics.md',
  'docs/spec/fidelity-verification-plan.md',
  'docs/spec/resource-byte-provenance.md',
  'docs/spec/sampled-control-bands.md',
  'docs/spec/proxy-icon-modified-dot.md',
  'docs/spec/scheme-factory-vocabulary.md',
  'docs/spec/tab-body-investigation.md',
  'docs/spec/tab-cdef8-body.md',
  'docs/geometry-refactor-todo.md',
  'docs/tracking/title-text-color.md',
  'docs/v2/DECISIONS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
];

/** Rule tables implementers read (PLAN §5); scrubbed of listing narrative. */
export const RULE_TABLES = [
  'tests/rendering-options/window-chrome-rules.mjs',
  'tests/rendering-options/window-chrome-rules.spec.mjs',
  'tests/rendering-options/window-chrome-rules.test.mjs',
  'tests/rendering-options/checkable-rules.mjs',
  'tests/rendering-options/checkable-rules.spec.mjs',
  'tests/rendering-options/checkable-rules.test.mjs',
];

/** Code trees implementers read and write; linted (comments with the prose rules). */
export const CODE_DIRS = ['src', 'tools'];

/** The brief names the listing paths it forbids, so it is exempt from listing-path. */
const BRIEF = 'docs/spec/engine/IMPLEMENTER-BRIEF.md';

const SCANNED_EXT = /\.(ts|mts|cts|js|mjs|cjs|css|html|json|md)$/;
const COMMENTED_CODE = /\.(ts|mts|cts|js|mjs|cjs)$/;

const both = list => [...list, ...list.map(m => m.toUpperCase())];
const BCC = ['ne', 'eq', 'gt', 'lt', 'ge', 'le', 'hi', 'ls', 'cc', 'cs', 'pl'];
const SIZED = ['cmp', 'cmpi', 'cmpa', 'tst', 'clr', 'add', 'addq', 'addi', 'adda', 'addx', 'sub', 'subq', 'subi', 'suba', 'subx',
  'and', 'andi', 'or', 'ori', 'eor', 'eori', 'ext', 'neg', 'negx', 'not', 'lsl', 'lsr', 'asl', 'asr', 'rol', 'ror', 'roxl', 'roxr',
  'muls', 'mulu', 'divs', 'divu', 'move', 'movea', 'movem'];
const ALWAYS = [
  'jsr', 'bsr', 'jmp', 'moveq', 'movea', 'movem', 'unlk', 'rts', 'rtd', 'rte', 'dbf', 'dbra',
  ...BCC.flatMap(c => ['b' + c, 'b' + c + 's', 'b' + c + 'w', 'b' + c + 'l']), 'bras', 'braw', 'bral', 'bsrs', 'bsrw', 'bsrl',
  'addq', 'subq', 'cmpi', 'cmpa', 'cmpm', 'tst', 'clr', 'lsl', 'lsr', 'asl', 'asr', 'roxl', 'roxr',
  // size-suffixed family; `orb` and `roll` (English) are excluded
  ...SIZED.flatMap(m => ['b', 'w', 'l'].filter(s => !((m === 'or' && s === 'b') || (m === 'rol' && s === 'l'))).map(s => m + s)),
];
const OPERAND_BRANCH = ['link', 'lea', 'pea', 'bra']; // may take a bare address ("bra 0x264")
const OPERAND_ONLY = ['cmp', 'add', 'sub', 'and', 'or', 'not', 'neg', 'ext', 'swap', 'move']; // register-shaped operands only
// An operand: register (with comma/indirect), %reg, #imm followed by a comma, -( , (reg), frame form, hex address.
const OPERAND_REG = String.raw`[ \t]+(?:%(?:[ad][0-7]|fp|sp|pc)|[ad][0-7](?:,|@|\b(?![\w$-]))|[AD][0-7](?:,|@)|#-?(?:0x)?[0-9a-fA-F]+,|-\(|\((?:sp|SP|[aAdD][0-7])\)|(?:fp|sp)@)`;
const OPERAND_ADDR = String.raw`[ \t]+(?:\$?0x[0-9a-fA-F]+\b|\$[0-9a-fA-F]{3,}\b)`;
const W0 = String.raw`(?<![\w$@<\-.])`;
const W1 = String.raw`(?![\w$\-])`;

const RULES = [
  { id: 'register', scope: 'all', re: /%[daDA][0-7](?![0-9])/g },
  { id: 'frame', scope: 'all', re: /\b(?:fp|sp|FP|SP|[adAD][0-7])@/g },
  { id: 'register-bare', scope: 'prose', re: /(?<![\w$#.\-])[adAD][0-7](?![\w$@\-])/g },
  { id: 'addressing', scope: 'prose', re: /-\((?:sp|SP|[aA][0-7])\)|(?<![\w$])\((?:sp|SP|[aA][0-7])\)\+?/g },
  {
    id: 'mnemonic',
    scope: 'all',
    re: new RegExp(
      `${W0}(?:${both([...new Set(ALWAYS)]).join('|')})${W1}` +
      `|${W0}(?:${both(SIZED).join('|')}|bcc|BCC)\\.[bwlsBWLS]${W1}` +
      `|${W0}(?:${both([...OPERAND_BRANCH, ...OPERAND_ONLY]).join('|')})(?=${OPERAND_REG})` +
      `|${W0}(?:${both(OPERAND_BRANCH).join('|')})(?=${OPERAND_ADDR})`,
      'g',
    ),
  },
  { id: 'ghidra', scope: 'all', re: /\b(?:FUN|LAB|DAT|PTR)_[0-9a-fA-F]{3,}\b|\b[siuc]Var\d+\b|\bparam_\d+\b|\blocal_[0-9a-fA-F]+\b|\b(?:au|u|i|s)Stack_[0-9a-fA-F]+\b/g },
  { id: 'listing-path', scope: 'all', re: /\.scratch\b(?![^\n]*\.sit\b)|\.asm\b|\bobjdump\b|\/tmp\/kaleido-trace|\bk(?:231|182)-kdef\b/g },
  { id: 'listing-line', scope: 'docs', re: /^\s*[0-9a-f]{3,6}:\s+[0-9a-f]{4}(?: [0-9a-f]{4})*\s+\S/g },
  { id: 'hex-ident', scope: 'code', re: /(?<![\w$])[A-Za-z_$][\w$]*?(?<![0-9])0x[0-9a-fA-F]+[\w$]*|(?<![\w$])0x[0-9a-fA-F]+(?:[g-mo-zG-MO-Z_$]|n[\w$])[\w$]*/g },
];

/**
 * Comment text of a JS/TS source with every non-comment character blanked
 * (newlines kept, so line numbers survive). Strings, template literals and regex
 * literals are skipped so `//` inside them is not a comment.
 */
export function commentsOf(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = s => s.replace(/[^\n]/g, ' ');
  let prev = ''; // last significant code char, for regex-vs-division
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const j = e < 0 ? n : e; out += src.slice(i, j); i = j; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const j = e < 0 ? n : e + 2; out += src.slice(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; else if (c !== '`' && src[j] === '\n') break; j++; }
      out += blank(src.slice(i, j + 1)); i = j + 1; prev = 'a'; continue;
    }
    if (c === '/' && (prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev))) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n') { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break; j++; }
      out += blank(src.slice(i, j + 1)); i = j + 1; prev = 'a'; continue;
    }
    if (!/\s/.test(c)) prev = c;
    out += c === '\n' ? '\n' : ' ';
    i++;
  }
  return out;
}

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

/**
 * Scan text with the pattern rules; returns [{rule, line, text}].
 * kind: 'docs' (Markdown), 'code' (JS/TS: prose rules see only comments),
 * 'data' (CSS/HTML/JSON: all/code rules only). `exempt` lists rule ids to skip.
 */
export function scanText(text, { docs = false, kind = docs ? 'docs' : 'code', exempt = [] } = {}) {
  const hits = [];
  const full = text.split('\n');
  const prose = kind === 'docs' ? full : kind === 'code' ? commentsOf(text).split('\n') : null;
  for (const { id, re, scope } of RULES) {
    if (exempt.includes(id)) continue;
    let lines;
    if (scope === 'all') lines = full;
    else if (scope === 'prose') lines = prose;
    else if (scope === 'docs') lines = kind === 'docs' ? full : null;
    else if (scope === 'code') lines = kind === 'docs' ? null : full;
    if (!lines) continue;
    lines.forEach((line, i) => {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) hits.push({ rule: id, line: i + 1, text: m[0] });
    });
  }
  return hits.sort((x, y) => x.line - y.line);
}

const kindOf = f => (f.endsWith('.md') ? 'docs' : COMMENTED_CODE.test(f) ? 'code' : 'data');

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

/** Files the pattern rules apply to, absolute. */
export function targets(root) {
  const files = CODE_DIRS.flatMap(d => walk(join(root, d))).filter(f => SCANNED_EXT.test(f) && !/[\\/]node_modules[\\/]|[\\/]dist[\\/]/.test(f));
  for (const f of walk(join(root, 'docs/spec/engine'))) if (f.endsWith('.md') && !f.endsWith('.evidence.md')) files.push(f);
  for (const d of [...ALLOWED_DOCS, ...RULE_TABLES]) if (existsSync(join(root, d))) files.push(join(root, d));
  return files;
}

/** Backticked repo paths in the brief's "Allowed paths" section that this linter does not scan. */
export function briefScope(root, scanned) {
  const brief = join(root, BRIEF);
  if (!existsSync(brief)) return [];
  const text = readFileSync(brief, 'utf8');
  const start = text.indexOf('## Allowed paths');
  if (start < 0) return [{ file: BRIEF, rule: 'brief-scope', line: 1, text: 'no "## Allowed paths" section' }];
  const end = text.indexOf('\n## ', start + 1);
  const section = text.slice(start, end < 0 ? undefined : end);
  const base = text.slice(0, start).split('\n').length;
  const set = new Set(scanned.map(f => posix(relative(root, f))));
  const hits = [];
  section.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/`([\w./*-]+)`/g)) {
      const p = m[1].replace(/\/$/, '');
      if (p.startsWith('*') || !/[/.]/.test(p) || !/^(src|tools|tests|docs)\b|\.md$/.test(p)) continue;
      const rel = /^(docs|src|tools|tests)\b/.test(p) || existsSync(join(root, p)) ? p : `docs/spec/${p}`;
      if (rel === 'docs/spec/engine/*.md' || CODE_DIRS.includes(rel)) continue;
      if (rel.includes('*')) {
        const re = new RegExp('^' + rel.replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*') + '$');
        const any = [...set].some(f => re.test(f));
        if (!any) hits.push({ file: BRIEF, rule: 'brief-scope', line: base + i, text: rel });
        continue;
      }
      if (existsSync(join(root, rel)) && !set.has(rel)) hits.push({ file: BRIEF, rule: 'brief-scope', line: base + i, text: rel });
    }
  });
  return hits;
}

/** Run every rule over root; returns {hits, censusSkipped}. */
export function checkCleanroom(root) {
  const hits = [];
  const files = targets(root);
  for (const f of files) {
    const rel = posix(relative(root, f));
    for (const h of scanText(readFileSync(f, 'utf8'), { kind: kindOf(f), exempt: rel === BRIEF ? ['listing-path'] : [] })) hits.push({ file: rel, ...h });
  }
  hits.push(...briefScope(root, files));
  const c = census(root);
  hits.push(...c.hits);
  return { hits, censusSkipped: c.skipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const rootArg = args.indexOf('--root');
  const root = rootArg >= 0 ? args[rootArg + 1] : join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const filesArg = args.indexOf('--files');
  const { hits, censusSkipped } = filesArg >= 0
    ? { hits: args.slice(filesArg + 1).filter(a => !a.startsWith('--')).flatMap(f => scanText(readFileSync(f, 'utf8'), { kind: kindOf(f), exempt: f.endsWith(BRIEF) ? ['listing-path'] : [] }).map(h => ({ file: f, ...h }))), censusSkipped: true }
    : checkCleanroom(root);
  if (args.includes('--json')) console.log(JSON.stringify({ hits, censusSkipped }, null, 2));
  else {
    for (const h of hits) console.log(`${h.file}:${h.line}: [${h.rule}] ${h.text}`);
    console.log(`check-cleanroom: ${hits.length} hit(s)${censusSkipped ? '; constant census skipped (no src/engine/)' : ''}`);
  }
  process.exit(hits.length ? 1 : 0);
}
