#!/usr/bin/env node
// scripts/gen-trap-table.mjs
//
// Generates the `name` column of the A-trap table in
// docs/spec/kdef231-reference.md §6 (between the trap-table markers) from Apple
// Universal Interfaces 3.0.1 `Traps.h`. Trap names are never hand-typed.
//
// Traps.h is Apple-copyrighted and NOT committed. Pass the maintainer copy
// (private store; sha256 below) with --traps-h or SCRIPTOSCOPE_TRAPS_H.
//
// Usage:
//   node scripts/gen-trap-table.mjs --traps-h <path> --check   # exit 1 on any drift
//   node scripts/gen-trap-table.mjs --traps-h <path> --write   # rewrite the name column
//
// Lookup rules: a toolbox trap ($A800–$AFFF) is matched as-is, then with the
// auto-pop bit ($0400) cleared. An OS trap ($A000–$A7FF) is matched as-is, then
// with its flag bits (bits 8–10) varied. When Traps.h has several aliases for one
// number (DisposRgn/DisposeRgn), the longest is used.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_SHA256 = 'b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = resolve(repoRoot, 'docs/spec/kdef231-reference.md');
const BEGIN = '<!-- trap-table:begin -->';
const END = '<!-- trap-table:end -->';
const MISSING = '*(not in Traps.h 3.0.1)*';
const HEADER = '| trap | name | role in kDEF | example addr(s) |';
const SEPARATOR = '|---|---|---|---|';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const trapsPath = opt('--traps-h') ?? process.env.SCRIPTOSCOPE_TRAPS_H;
if (!trapsPath || (!flag('--check') && !flag('--write'))) {
  console.error('usage: gen-trap-table.mjs --traps-h <Traps.h> (--check | --write)');
  process.exit(2);
}

const raw = readFileSync(trapsPath);
const sha = createHash('sha256').update(raw).digest('hex');
if (sha !== EXPECTED_SHA256) {
  console.error(`Traps.h sha256 ${sha} does not match the pinned UI 3.0.1 copy ${EXPECTED_SHA256}`);
  process.exit(1);
}

const aliases = new Map();
for (const m of raw.toString('latin1').matchAll(/\b_(\w+)\s*=\s*0x(A[0-9A-F]{3})\b/gi)) {
  const code = parseInt(m[2], 16);
  const list = aliases.get(code) ?? [];
  if (!list.includes(m[1])) list.push(m[1]);
  aliases.set(code, list);
}
const pick = (list) => [...list].sort((a, b) => b.length - a.length || list.indexOf(a) - list.indexOf(b))[0];

export function trapName(code) {
  if (aliases.has(code)) return pick(aliases.get(code));
  if (code & 0x0800) {
    const alt = code & ~0x0400;
    return aliases.has(alt) ? pick(aliases.get(alt)) : null;
  }
  const base = code & 0xf0ff;
  for (const f of [0, 0x100, 0x200, 0x400, 0x600, 0x700, 0x300, 0x500]) {
    if (aliases.has(base | f)) return pick(aliases.get(base | f));
  }
  return null;
}

const doc = readFileSync(DOC, 'utf8');
const a = doc.indexOf(BEGIN);
const b = doc.indexOf(END);
if (a < 0 || b < a) { console.error('trap-table markers not found in ' + DOC); process.exit(1); }

let drift = 0;
const lines = doc.slice(a + BEGIN.length, b).split('\n').map((line) => {
  const m = line.match(/^\| `\$(A[0-9A-F]{3})` \| ([^|]*?) \|(.*)$/);
  if (!m) {
    // Fail closed: inside the markers, every table row except the header and
    // separator must be one canonical uppercase single-trap row.
    const isTableRow = line.trim().startsWith('|');
    if (isTableRow && line !== HEADER && line !== SEPARATOR) {
      drift++;
      console.error(`unparseable trap-table row (one uppercase \`$Axxx\` per row): ${line}`);
    }
    return line;
  }
  const name = trapName(parseInt(m[1], 16)) ?? MISSING;
  if (m[2] !== name) {
    drift++;
    console.error(`$${m[1]}: doc says "${m[2]}", Traps.h says "${name}"`);
  }
  return `| \`$${m[1]}\` | ${name} |${m[3]}`;
});

if (flag('--write')) {
  writeFileSync(DOC, doc.slice(0, a + BEGIN.length) + lines.join('\n') + doc.slice(b));
  console.log(`trap table regenerated (${drift} row(s) changed or unparseable)`);
  if (lines.some((l) => l.trim().startsWith('|') && l !== HEADER && l !== SEPARATOR && !/^\| `\$A[0-9A-F]{3}` \| /.test(l))) process.exit(1);
} else if (drift) {
  console.error(`${drift} trap-table row(s) drift from Traps.h or do not parse`);
  process.exit(1);
} else {
  console.log('trap table matches Traps.h');
}
