#!/usr/bin/env node
// CI shard support for the rendering contracts (#576). Two subcommands:
//
//   evidence --out <dir> [--expect-executions N] <shard-evidence-dir>...
//     Union shard `test-results/rendering-evidence` trees in run order. A serial
//     run overwrote same-named observations with the later writer; shards are
//     contiguous slices of that order, so the later directory wins and each
//     collision is reported. Each shard's requirements/execution.json covers a
//     subset of assertions; they are concatenated into one record with the same
//     identity, which `npm run test:requirements -- --require-execution` reads.
//
//   parity --list <list.json> [--expect-reports N] <shard-report.json>...
//     Compare `playwright test --list --reporter=json` for the unsharded config
//     with the union of the shard JSON reports: every listed test must have run
//     exactly once in exactly one shard, and nothing else may have run.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXECUTION = join('requirements', 'execution.json');
const SAME_ACROSS_SHARDS = ['schemaVersion', 'evidence', 'executionCommit', 'identitySource', 'platform', 'arch'];

export function mergeExecutions(records) {
  if (!records.length) throw new Error('no shard execution records');
  const errors = [];
  for (const key of SAME_ACROSS_SHARDS) {
    const values = new Set(records.map(({ data }) => JSON.stringify(data[key] ?? null)));
    if (values.size > 1) errors.push(`execution ${key} differs between shards: ${[...values].join(', ')}`);
  }
  for (const { source, data } of records) if (!Array.isArray(data.assertions)) errors.push(`${source}: assertions is not an array`);
  if (errors.length) throw new Error(errors.join('\n'));
  const dirty = records.map(({ data }) => data.workingTreeDirty);
  const statuses = records.map(({ data }) => data.status);
  const first = records[0].data;
  return {
    ...first,
    workingTreeDirty: dirty.includes(true) ? true : dirty.every(value => value === false) ? false : null,
    startedAt: records.map(({ data }) => data.startedAt).sort()[0],
    completedAt: records.map(({ data }) => data.completedAt).sort().at(-1),
    status: statuses.every(status => status === 'passed') ? 'passed' : statuses.find(status => status !== 'passed'),
    assertions: records.flatMap(({ data }) => data.assertions),
    shards: records.map(({ source, data }) => ({ source, status: data.status, startedAt: data.startedAt, completedAt: data.completedAt, assertions: data.assertions.length })),
  };
}

function walk(root, base = root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path, base) : [relative(base, path)];
  });
}

export function mergeEvidence(out, sources, { expectExecutions } = {}) {
  const owner = new Map(), collisions = [], records = [];
  for (const source of sources) {
    for (const file of walk(source)) {
      if (file === EXECUTION) { records.push({ source, data: JSON.parse(readFileSync(join(source, file), 'utf8')) }); continue; }
      if (owner.has(file)) collisions.push(`${file}: ${owner.get(file)} replaced by ${source}`);
      owner.set(file, source);
    }
  }
  if (expectExecutions !== undefined && records.length !== expectExecutions)
    throw new Error(`expected ${expectExecutions} shard execution records, found ${records.length}: ${records.map(r => r.source).join(', ') || 'none'}`);
  mkdirSync(out, { recursive: true });
  for (const [file, source] of owner) { mkdirSync(dirname(join(out, file)), { recursive: true }); cpSync(join(source, file), join(out, file)); }
  if (records.length) {
    mkdirSync(join(out, 'requirements'), { recursive: true });
    writeFileSync(join(out, EXECUTION), JSON.stringify(mergeExecutions(records), null, 2) + '\n');
  }
  return { files: owner.size, collisions, executions: records.length };
}

/** Flatten a Playwright JSON report into `project › file:line:col › title path` rows. */
export function reportTests(report) {
  const rows = [];
  const visit = (suite, titles) => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? [])
      rows.push({ id: `${test.projectName} › ${spec.file}:${spec.line}:${spec.column} › ${[...titles, spec.title].join(' › ')}`, file: spec.file, results: test.results ?? [], status: test.status });
    for (const child of suite.suites ?? []) visit(child, child.title === child.file ? titles : [...titles, child.title]);
  };
  for (const suite of report.suites ?? []) visit(suite, []);
  return rows;
}

export function compareParity(list, shards) {
  const listed = reportTests(list), errors = [];
  const listedIds = new Set(listed.map(row => row.id));
  if (!listed.length) errors.push('the unsharded list is empty');
  if (listedIds.size !== listed.length) errors.push('the unsharded list contains duplicate test ids');
  const ran = new Map();
  for (const [index, report] of shards.entries()) for (const row of reportTests(report)) {
    if (!row.results.length) continue; // a shard's JSON report lists only its own tests, but guard anyway
    if (ran.has(row.id)) errors.push(`ran in more than one shard: ${row.id}`);
    else ran.set(row.id, { shard: index + 1, row });
  }
  for (const id of listedIds) if (!ran.has(id)) errors.push(`listed but not run: ${id}`);
  for (const id of ran.keys()) if (!listedIds.has(id)) errors.push(`ran but not listed: ${id}`);
  const perFile = new Map();
  for (const row of listed) { const entry = perFile.get(row.file) ?? { listed: 0, ran: 0 }; entry.listed++; perFile.set(row.file, entry); }
  for (const { row } of ran.values()) { const entry = perFile.get(row.file) ?? { listed: 0, ran: 0 }; entry.ran++; perFile.set(row.file, entry); }
  const statuses = {};
  for (const { row } of ran.values()) statuses[row.status] = (statuses[row.status] ?? 0) + 1;
  const perShard = shards.map((_, index) => [...ran.values()].filter(entry => entry.shard === index + 1).length);
  return { listed: listed.length, ran: ran.size, files: perFile.size, perFile, perShard, statuses, errors };
}

function main(argv) {
  const [command, ...rest] = argv;
  const options = {}, positional = [];
  for (let i = 0; i < rest.length; i++) rest[i].startsWith('--') ? options[rest[i].slice(2)] = rest[++i] : positional.push(rest[i]);
  if (command === 'evidence') {
    if (!options.out || !positional.length) throw new Error('usage: shards.mjs evidence --out <dir> [--expect-executions N] <dir>...');
    const result = mergeEvidence(resolve(options.out), positional.map(p => resolve(p)),
      { expectExecutions: options['expect-executions'] === undefined ? undefined : Number(options['expect-executions']) });
    console.log(`shards: merged ${result.files} evidence files and ${result.executions} execution records from ${positional.length} directories`);
    for (const collision of result.collisions) console.log(`shards: later writer kept for ${collision}`);
    return 0;
  }
  if (command === 'parity') {
    if (!options.list || !positional.length) throw new Error('usage: shards.mjs parity --list <list.json> [--expect-reports N] <report.json>...');
    const read = path => JSON.parse(readFileSync(path, 'utf8'));
    const result = compareParity(read(options.list), positional.map(read));
    if (options['expect-reports'] !== undefined && positional.length !== Number(options['expect-reports']))
      result.errors.unshift(`expected ${options['expect-reports']} shard reports, found ${positional.length}`);
    console.log(`shards: listed ${result.listed} tests in ${result.files} files; ran ${result.ran} across ${positional.length} shards (${result.perShard.join(' + ')})`);
    console.log(`shards: statuses ${JSON.stringify(result.statuses)}`);
    for (const [file, { listed, ran }] of [...result.perFile].sort()) if (listed !== ran) console.log(`shards: ${file}: listed ${listed}, ran ${ran}`);
    for (const error of result.errors.slice(0, 50)) console.error(`shards: ${error}`);
    if (result.errors.length > 50) console.error(`shards: ... ${result.errors.length - 50} more`);
    return result.errors.length ? 1 : 0;
  }
  throw new Error(`unknown command ${command ?? '(none)'}; expected evidence or parity`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
