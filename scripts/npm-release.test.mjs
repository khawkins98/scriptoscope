import { parsePackResult } from './npm-pack-result.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { matchesRegistry, packageName, pagesReady, registryVersion, resolveReleaseTag, selectReleaseGate, validateRelease, verifyCandidate, waitForRegistry } from './npm-release.mjs';

test('release identity rejects a mismatched tag, version constant or example dependency', () => {
  const manifest = { name: packageName, version: '0.10.0', publishConfig: { access: 'public' } };
  const lock = { name: packageName, version: '0.10.0', packages: { '': { name: packageName, version: '0.10.0' } } };
  const example = { dependencies: { [packageName]: '^0.10.0' } };
  const source = "export const VERSION = '0.10.0';";
  validateRelease(manifest, lock, example, source, 'v0.10.0');
  assert.throws(() => validateRelease(manifest, lock, example, source, 'v0.9.0'));
  assert.throws(() => validateRelease(manifest, lock, example, "export const VERSION = '0.9.0';", 'v0.10.0'));
  assert.throws(() => validateRelease(manifest, lock, { dependencies: {} }, source, 'v0.10.0'));
});

test('only a completed green dispatch/schedule on the exact commit qualifies', () => {
  const valid = { head_sha: 'target', status: 'completed', conclusion: 'success', event: 'workflow_dispatch' };
  assert.equal(selectReleaseGate([valid], 'target'), valid);
  for (const changed of [{ head_sha: 'preview' }, { status: 'in_progress' }, { conclusion: 'failure' }, { event: 'pull_request' }]) {
    assert.throws(() => selectReleaseGate([{ ...valid, ...changed }], 'target'));
  }
});

test('release tags must belong to main and match the workflow provenance commit', async () => {
  const gate = { head_sha: 'tagged', status: 'completed', conclusion: 'success', event: 'schedule' };
  const github = {
    rest: {
      git: { getRef: async () => ({ data: { object: { type: 'commit', sha: 'tagged' } } }) },
      repos: { compareCommitsWithBasehead: async () => ({ data: { status: 'ahead' } }) },
      actions: { listWorkflowRuns() {} },
    },
    paginate: async () => [gate],
  };
  assert.equal((await resolveReleaseTag(github, {}, 'v0.10.0', 'tagged')).sha, 'tagged');
  await assert.rejects(() => resolveReleaseTag(github, {}, 'v0.10.0', 'newer-main'), /provenance/);
  github.rest.repos.compareCommitsWithBasehead = async () => ({ data: { status: 'diverged' } });
  await assert.rejects(() => resolveReleaseTag(github, {}, 'v0.10.0', 'tagged'), /belong to main/);
});

test('registry absence is distinct from outage and integrity mismatch', async () => {
  assert.equal(await registryVersion('latest', async () => ({ status: 404 })), null);
  await assert.rejects(() => registryVersion('latest', async () => ({ status: 503, ok: false })), /503/);
  const expected = { name: packageName, version: '0.10.0', integrity: 'sha512-tested' };
  matchesRegistry({ ...expected, dist: { integrity: expected.integrity } }, expected);
  assert.throws(() => matchesRegistry({ ...expected, dist: { integrity: 'sha512-other' } }, expected), /integrity/);
  assert.throws(() => matchesRegistry(null, expected), /not available/);
});

test('publication propagation retries are bounded and never hide wrong bytes or outages', async () => {
  const expected = { name: packageName, version: '0.10.0', integrity: 'sha512-tested' };
  let requests = 0, waits = 0;
  const sleep = async () => { waits++; };
  const fetcher = async () => ++requests < 3 ? { status: 404 } : {
    ok: true, json: async () => ({ ...expected, dist: { integrity: expected.integrity } }),
  };
  await waitForRegistry(expected, { fetcher, sleep });
  assert.deepEqual([requests, waits], [3, 2]);
  requests = 0; waits = 0;
  await assert.rejects(() => waitForRegistry(expected, { fetcher: async () => { requests++; return { status: 404 }; }, sleep, attempts: 3 }), /bounded retries/);
  assert.deepEqual([requests, waits], [3, 2]);
  waits = 0;
  await assert.rejects(() => waitForRegistry(expected, { fetcher: async () => ({ ok: true, json: async () => ({ ...expected, dist: { integrity: 'wrong' } }) }), sleep }), /integrity/);
  await assert.rejects(() => waitForRegistry(expected, { fetcher: async () => ({ ok: false, status: 503 }), sleep }), /503/);
  assert.equal(waits, 0);
});

test('Pages requires matching latest plus a completed successful promotion, not prepare/next', async () => {
  const manifest = { name: packageName, version: '0.10.0' };
  const fetcher = async () => ({ ok: true, json: async () => manifest });
  const run = { head_sha: 'released', status: 'completed', conclusion: 'success', event: 'workflow_dispatch', display_title: 'npm v0.10.0 (latest)' };
  let runs = [run];
  const github = { rest: { git: { getRef: async () => ({ data: { object: { type: 'commit', sha: 'released' } } }) }, actions: { listWorkflowRuns() {} } }, paginate: async () => runs };
  assert.equal(await pagesReady(github, {}, manifest, fetcher), true);
  for (const changed of [{ display_title: 'npm v0.10.0 (prepare)' }, { display_title: 'npm v0.10.0 (next)' }, { conclusion: 'failure' }, { status: 'in_progress' }, { head_sha: 'moved' }]) {
    runs = [{ ...run, ...changed }];
    assert.equal(await pagesReady(github, {}, manifest, fetcher), false);
  }
  runs = [run];
  assert.equal(await pagesReady(github, {}, { ...manifest, version: '0.11.0' }, fetcher), false);
  assert.equal(await pagesReady(github, {}, manifest, async () => ({ status: 404 })), false);
  await assert.rejects(() => pagesReady(github, {}, manifest, async () => ({ status: 503, ok: false })), /503/);
});

test('artifact verification rejects changed bytes and escaping filenames', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'npm-release-check-'));
  try {
    const bytes = Buffer.from('tested candidate');
    const metadata = { name: packageName, version: '0.10.0', filename: 'candidate.tgz',
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
    await writeFile(join(dir, 'candidate.tgz'), bytes);
    await writeFile(join(dir, 'release.json'), JSON.stringify(metadata));
    await verifyCandidate(dir);
    await writeFile(join(dir, 'candidate.tgz'), 'modified');
    await assert.rejects(() => verifyCandidate(dir), /changed/);
    await writeFile(join(dir, 'release.json'), JSON.stringify({ ...metadata, filename: '../candidate.tgz' }));
    await assert.rejects(() => verifyCandidate(dir), /inside/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('npm pack identity supports npm 11 arrays and npm 12 keyed results', () => {
  const packed = { name: packageName, filename: 'candidate.tgz', integrity: 'sha512-test' };
  for (const result of [[packed], { [packageName]: packed }]) {
    assert.deepEqual(parsePackResult(JSON.stringify(result)), packed);
  }
  for (const result of [[], {}, [packed, packed], { error: { code: 'E401' } }]) {
    assert.throws(() => parsePackResult(JSON.stringify(result)));
  }
});
