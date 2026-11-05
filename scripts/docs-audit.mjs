#!/usr/bin/env node
// Documentation-maintainer tool. Scans the full documentation corpus; not an
// allowed reading shortcut for clean-room runtime implementer lanes.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const wordCount = text => (text.trim().match(/\S+/g) ?? []).length;
export function compileRules(map) {
  if (map.schema !== 1 || !Array.isArray(map.rules) || !map.rules.length) {
    throw new Error('Documentation map must use schema 1 with nonempty rules');
  }
  return map.rules.map(rule => {
    if (!rule.match || !rule.kind || !rule.audience ||
        (rule.reviewWords !== undefined && (!Number.isInteger(rule.reviewWords) || rule.reviewWords < 1))) {
      throw new Error(`Invalid documentation rule: ${JSON.stringify(rule)}`);
    }
    return { ...rule, pattern: new RegExp(rule.match) };
  });
}

export function audit(root, base) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  // Validate the base once. A typo must not make every existing page appear new.
  git('rev-parse', '--verify', `${base}^{commit}`);
  const rules = compileRules(JSON.parse(readFileSync(resolve(root, 'docs/documentation-map.json'), 'utf8')));
  const documentation = path => path.endsWith('.md') || path === 'llms.txt';
  const currentPaths = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
    .split('\0').filter(documentation))].sort();
  const basePaths = git('ls-tree', '-r', '--name-only', '-z', base).split('\0').filter(documentation);
  const names = [...new Set([...currentPaths, ...basePaths])].sort();
  const currentSet = new Set(currentPaths);
  const baseSet = new Set(basePaths);
  const errors = [], warnings = [], documents = [];
  let beforeWords = 0, afterWords = 0;
  const kinds = {};
  for (const path of names) {
    let current = null;
    if (currentSet.has(path)) {
      try { current = readFileSync(resolve(root, path), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const previous = baseSet.has(path) ? git('show', `${base}:${path}`) : null;
    const before = wordCount(previous ?? ''), after = wordCount(current ?? '');
    beforeWords += before; afterWords += after;
    const rule = rules.find(candidate => candidate.pattern.test(path));
    if (!rule) {
      // Removed legacy pages need not get new map entries, but every live page does.
      if (current !== null) errors.push(`${path}: no documentation-map rule`);
      documents.push({ path, beforeWords: before, words: after, kind: 'unclassified' });
      continue;
    }
    const group = kinds[rule.kind] ??= { documents: 0, beforeWords: 0, words: 0 };
    if (current !== null) group.documents++;
    group.beforeWords += before; group.words += after;
    if (rule.preserveBody && previous !== null && (current === null || !current.includes(previous))) {
      errors.push(`${path}: existing record body changed or removed; retain it and add a dated route/superseding record`);
    }
    if (current !== null && rule.reviewWords && after > rule.reviewWords) {
      warnings.push(`${path}: ${after} words exceeds ${rule.reviewWords} review budget (${before} at base); review task, duplication and reference scope`);
    }
    documents.push({ path, kind: rule.kind, audience: rule.audience, beforeWords: before, words: after,
      changed: current !== previous, ...(rule.preserveBody ? { preserveBody: true } : {}) });
  }
  return { base, documents: documents.filter(doc => currentSet.has(doc.path) && doc.words > 0).length,
    beforeWords, words: afterWords, deltaWords: afterWords - beforeWords, kinds, errors, warnings, pages: documents };
}

export function main(args = process.argv.slice(2)) {
  let base = 'origin/main', json = false, check = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) base = args[++i];
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--check') check = true;
    else throw new Error('Usage: node scripts/docs-audit.mjs [--check] [--base <git-ref>] [--json]');
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const report = audit(root, base);
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`Documentation: ${report.documents} pages; ${report.beforeWords} -> ${report.words} words (${report.deltaWords >= 0 ? '+' : ''}${report.deltaWords}) against ${base}`);
    for (const [kind, stats] of Object.entries(report.kinds)) {
      console.log(`  ${kind}: ${stats.documents} pages, ${stats.words} words (${stats.words - stats.beforeWords >= 0 ? '+' : ''}${stats.words - stats.beforeWords})`);
    }
    for (const warning of report.warnings) console.log(`REVIEW ${warning}`);
    for (const error of report.errors) console.error(`ERROR ${error}`);
    console.log(`${report.errors.length} errors; ${report.warnings.length} editorial review signals. Links, examples and engine correctness are not assessed.`);
  }
  if (check && report.errors.length) process.exitCode = 1;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
