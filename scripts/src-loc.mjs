#!/usr/bin/env node
// Runtime size report for family migrations and releases (CONTRIBUTING: "Measure and
// shrink the runtime"). Counts lines of non-test .ts files under src/ at a git ref,
// split into engine tables (cited data rows), the rest of the engine, and everything
// else. `--base <ref>` also prints the delta from that ref, e.g. `--base origin/v2`
// in a PR or `--base v0.2.0` for a release note.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const isRuntime = f => f.endsWith('.ts') && !/\.test\.|\.d\.ts$/.test(f);

function measure(ref) {
  const files = git('ls-tree', '-r', '--name-only', ref, 'src').split('\n').filter(isRuntime);
  const out = { tables: 0, engine: 0, other: 0 };
  for (const f of files) {
    const lines = git('show', `${ref}:${f}`).split('\n').length - 1;
    out[f.startsWith('src/engine/tables/') ? 'tables' : f.startsWith('src/engine/') ? 'engine' : 'other'] += lines;
  }
  return { ...out, logic: out.engine + out.other, total: out.tables + out.engine + out.other };
}

const args = process.argv.slice(2);
const at = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--base') ?? 'HEAD';
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? args[baseIdx + 1] : null;
const head = measure(at);
const rows = ['logic', 'tables', 'total'];
const sign = n => (n > 0 ? `+${n}` : `${n}`);
console.log(`| src/ lines (non-test .ts) | ${base ? `${base} | ` : ''}${at} |${base ? ' delta |' : ''}`);
console.log(`|---|${base ? '---:|' : ''}---:|${base ? '---:|' : ''}`);
const b = base ? measure(base) : null;
for (const r of rows) {
  const label = r === 'logic' ? 'logic (all src except engine tables)' : r === 'tables' ? 'engine tables (cited data)' : 'total';
  console.log(`| ${label} | ${b ? `${b[r]} | ` : ''}${head[r]} |${b ? ` ${sign(head[r] - b[r])} |` : ''}`);
}
