import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareParity, mergeEvidence, mergeExecutions } from './shards.mjs';

const execution = (assertions, extra = {}) => ({ schemaVersion: 1, evidence: 'observed-assertion-execution', executionCommit: 'abc', workingTreeDirty: false,
  identitySource: 'git-checkout', platform: 'linux', arch: 'x64', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', status: 'passed', assertions, ...extra });
const report = (...tests) => ({ suites: [{ title: 'a.spec.mjs', file: 'a.spec.mjs', specs: tests.map(([title, ran]) => ({ title, file: 'a.spec.mjs', line: 1, column: 1,
  tests: [{ projectName: 'chromium-dpr1', status: 'expected', results: ran ? [{ status: 'passed' }] : [] }] })) }] });

test('shard executions concatenate under one identity and keep the worst status', () => {
  const merged = mergeExecutions([{ source: '1', data: execution([{ id: 'x' }]) }, { source: '2', data: execution([{ id: 'y' }], { status: 'failed', completedAt: '2026-01-01T00:02:00Z' }) }]);
  assert.deepEqual(merged.assertions.map(a => a.id), ['x', 'y']);
  assert.equal(merged.status, 'failed');
  assert.equal(merged.workingTreeDirty, false);
  assert.equal(merged.completedAt, '2026-01-01T00:02:00Z');
  assert.equal(mergeExecutions([{ source: '1', data: execution([]) }, { source: '2', data: execution([], { workingTreeDirty: null }) }]).workingTreeDirty, null);
  assert.throws(() => mergeExecutions([{ source: '1', data: execution([]) }, { source: '2', data: execution([], { executionCommit: 'def' }) }]), /executionCommit differs/);
});

test('evidence merge keeps the later shard on collision and requires every execution record', () => {
  const root = mkdtempSync(join(tmpdir(), 'shards-'));
  for (const [shard, body] of [['1', 'first'], ['2', 'second']]) {
    mkdirSync(join(root, shard, 'requirements'), { recursive: true });
    writeFileSync(join(root, shard, 'requirements', 'execution.json'), JSON.stringify(execution([{ id: shard }])));
    writeFileSync(join(root, shard, 'same.json'), JSON.stringify({ body }));
  }
  const result = mergeEvidence(join(root, 'out'), [join(root, '1'), join(root, '2')], { expectExecutions: 2 });
  assert.equal(result.collisions.length, 1);
  assert.equal(JSON.parse(readFileSync(join(root, 'out', 'same.json'))).body, 'second');
  assert.equal(JSON.parse(readFileSync(join(root, 'out', 'requirements', 'execution.json'))).assertions.length, 2);
  assert.throws(() => mergeEvidence(join(root, 'out2'), [join(root, '1')], { expectExecutions: 2 }), /expected 2 shard execution records, found 1/);
});

test('parity fails on missing, duplicated, unlisted and empty runs', () => {
  const list = report(['t1', false], ['t2', false]);
  assert.deepEqual(compareParity(list, [report(['t1', true]), report(['t2', true])]).errors, []);
  assert.match(compareParity(list, [report(['t1', true])]).errors.join('\n'), /listed but not run: .*t2/);
  assert.match(compareParity(list, [report(['t1', true], ['t2', true]), report(['t2', true])]).errors.join('\n'), /more than one shard: .*t2/);
  assert.match(compareParity(list, [report(['t1', true], ['t2', true], ['t3', true])]).errors.join('\n'), /ran but not listed: .*t3/);
  assert.match(compareParity(report(), [report()]).errors.join('\n'), /list is empty/);
});

test('a subset suite requires every listed project and spec file to list and run tests', () => {
  const at = (project, file, title, ran) => ({ title: file, file, specs: [{ title, file, line: 1, column: 1, tests: [{ projectName: project, status: 'expected', results: ran ? [{ status: 'passed' }] : [] }] }] });
  const list = { suites: [at('firefox-dpr1', 'a.spec.mjs', 't', false), at('firefox-dpr1', 'b.spec.mjs', 't', false)] };
  const ran = { suites: [at('firefox-dpr1', 'a.spec.mjs', 't', true), at('firefox-dpr1', 'b.spec.mjs', 't', true)] };
  const ok = compareParity(list, [ran], { requireProjects: ['firefox-dpr1'], requireFiles: ['a.spec.mjs', 'b.spec.mjs'] });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.required.map(r => [r.file, r.listed, r.ran]), [['a.spec.mjs', 1, 1], ['b.spec.mjs', 1, 1]]);
  // A renamed or emptied spec: nothing listed, nothing ran, plain parity would pass.
  assert.match(compareParity(list, [ran], { requireFiles: ['a.spec.mjs', 'c.spec.mjs'] }).errors.join('\n'), /required spec lists no tests: firefox-dpr1 c\.spec\.mjs/);
  assert.match(compareParity(list, [ran], { requireProjects: ['firefox-dpr1', 'webkit-dpr1'], requireFiles: ['a.spec.mjs'] }).errors.join('\n'), /required project not listed: webkit-dpr1/);
  assert.match(compareParity(list, [{ suites: [at('firefox-dpr1', 'a.spec.mjs', 't', true)] }], { requireFiles: ['b.spec.mjs'] }).errors.join('\n'), /required spec ran no tests: firefox-dpr1 b\.spec\.mjs/);
});
