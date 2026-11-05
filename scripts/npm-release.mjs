import { parsePackResult } from './npm-pack-result.mjs';
// Release artifact/registry checks. Publishing itself lives in the manual workflow.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageName = '@khawkins98/scriptoscope';
const registry = 'https://registry.npmjs.org';
const root = fileURLToPath(new URL('..', import.meta.url));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const integrity = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

export function validateRelease(manifest, lock, example, source, tag) {
  assert.equal(manifest.name, packageName, 'Unexpected npm package name');
  assert.equal(manifest.publishConfig?.access, 'public', 'The scoped package must be public');
  assert.equal(tag, `v${manifest.version}`, 'Tag must match package version');
  assert(/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag), 'Invalid release tag');
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.packages[''].name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.equal(example.dependencies[manifest.name], `^${manifest.version}`, 'Align the example dependency with the release');
  assert.equal(source.match(/export const VERSION = '([^']+)'/)?.[1], manifest.version, 'VERSION must match package version');
}

export function selectReleaseGate(runs, sha) {
  const run = runs.find(run => run.head_sha === sha && run.status === 'completed' && run.conclusion === 'success'
    && ['workflow_dispatch', 'schedule'].includes(run.event));
  assert(run, 'No successful dispatch/scheduled release gate for this exact commit');
  return run;
}

async function tagCommit(github, repository, tag) {
  assert(/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag), 'Supply a version tag');
  let object = (await github.rest.git.getRef({ ...repository, ref: `tags/${tag}` })).data.object;
  for (let depth = 0; object.type === 'tag' && depth < 8; depth++) {
    object = (await github.rest.git.getTag({ ...repository, tag_sha: object.sha })).data.object;
  }
  assert.equal(object.type, 'commit', 'Tag must resolve to a commit');
  return object.sha;
}

export async function resolveReleaseTag(github, repository, tag, workflowSha) {
  const sha = await tagCommit(github, repository, tag);
  assert.equal(sha, workflowSha, 'Dispatch from the release tag so provenance identifies the published commit');
  const comparison = await github.rest.repos.compareCommitsWithBasehead({ ...repository, basehead: `${sha}...main` });
  assert(['ahead', 'identical'].includes(comparison.data.status), 'Release commit must already belong to main');
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...repository, workflow_id: 'release-gate.yml', head_sha: sha, status: 'success', per_page: 100,
  });
  return { sha, gate: selectReleaseGate(runs, sha) };
}

export async function pagesReady(github, repository, manifest, fetcher = fetch) {
  assert.equal(manifest.name, packageName, 'Unexpected Pages package name');
  const latest = await registryVersion('latest', fetcher);
  if (latest?.name !== packageName || latest.version !== manifest.version) return false;
  let sha;
  try { sha = await tagCommit(github, repository, `v${manifest.version}`); }
  catch (error) { if (error.status === 404) return false; throw error; }
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
    ...repository, workflow_id: 'publish-npm.yml', head_sha: sha, status: 'success', per_page: 100,
  });
  // This title is the publish workflow's contract: prepare/next runs cannot unlock Pages.
  return runs.some(run => run.head_sha === sha && run.event === 'workflow_dispatch'
    && run.status === 'completed' && run.conclusion === 'success'
    && run.display_title === `npm v${manifest.version} (latest)`);
}

export async function registryVersion(version, fetcher = fetch) {
  const response = await fetcher(`${registry}/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`, {
    signal: AbortSignal.timeout(30_000), headers: { 'cache-control': 'no-cache' },
  });
  if (response.status === 404) return null;
  assert(response.ok, `npm registry lookup failed: HTTP ${response.status}`);
  return response.json();
}

export function matchesRegistry(actual, expected) {
  assert(actual, 'Package version is not available on npm');
  assert.equal(actual.name, expected.name, 'Registry package name differs');
  assert.equal(actual.version, expected.version, 'Registry package version differs');
  if (expected.integrity) assert.equal(actual.dist?.integrity, expected.integrity, 'Registry integrity differs from the tested candidate');
}

export async function waitForRegistry(expected, { fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 6 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const actual = await registryVersion(expected.version, fetcher);
    if (actual) { matchesRegistry(actual, expected); return actual; }
    // Only publication propagation (404) is retried. Outages or wrong bytes fail.
    if (attempt + 1 < attempts) await sleep(5_000);
  }
  throw new Error('Published version is not visible on npm after bounded retries; retry the workflow without changing the version');
}

export async function verifyCandidate(directory) {
  const metadata = await json(join(directory, 'release.json'));
  assert.equal(metadata.name, packageName);
  assert.equal(metadata.filename, basename(metadata.filename), 'Tarball filename must stay inside its artifact');
  const tarball = join(directory, metadata.filename);
  assert.equal(integrity(await readFile(tarball)), metadata.integrity, 'Candidate tarball changed');
  return { ...metadata, tarball };
}

async function output(key, value) {
  assert(!String(value).includes('\n'), 'Action output must be a single line');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

async function main(command, directory = '.tmp/npm-release') {
  const manifest = await json(join(root, 'package.json'));
  assert.equal(manifest.name, packageName);
  directory = resolve(directory);
  if (command === 'pack') {
    validateRelease(manifest, await json(join(root, 'package-lock.json')), await json(join(root, 'examples/npm/package.json')),
      await readFile(join(root, 'src/renderer.ts'), 'utf8'), process.env.RELEASE_TAG);
    await mkdir(directory, { recursive: true });
    const packed = parsePackResult(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', directory], { cwd: root, encoding: 'utf8' }));
    const metadata = { name: packed.name, version: packed.version, filename: packed.filename,
      integrity: integrity(await readFile(join(directory, packed.filename))), sha: process.env.RELEASE_SHA };
    assert(/^[a-f0-9]{40}$/.test(metadata.sha), 'A full source commit is required');
    await writeFile(join(directory, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');
    await output('tarball', join(directory, packed.filename));
    return;
  }
  const candidate = await verifyCandidate(directory);
  assert.equal(candidate.sha, process.env.RELEASE_SHA, 'Candidate is from another commit');
  assert.equal(candidate.version, manifest.version, 'Candidate version differs from checkout');
  if (command === 'verify') { await output('tarball', candidate.tarball); return; }
  if (command === 'exists') {
    const actual = await registryVersion(candidate.version);
    if (actual) matchesRegistry(actual, candidate);
    await output('exists', !!actual);
    return;
  }
  assert.equal(command, 'registry-smoke', 'Unknown release command');
  await waitForRegistry(candidate);
  const target = join(directory, 'registry');
  await mkdir(target, { recursive: true });
  const packed = parsePackResult(execFileSync('npm', ['pack', `${packageName}@${candidate.version}`, '--json', '--ignore-scripts',
    '--registry', registry, '--pack-destination', target], { encoding: 'utf8' }));
  const downloaded = join(target, packed.filename);
  assert.equal(integrity(await readFile(downloaded)), candidate.integrity, 'Downloaded npm artifact differs');
  execFileSync(process.execPath, [join(root, 'tests/package-consumer/run.mjs'), '--tarball', downloaded], {
    cwd: root, stdio: 'inherit', env: { ...process.env, SCRIPTOSCOPE_PACKAGE_EVIDENCE: join(root, 'test-results/npm-release/registry') },
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv[2], process.argv[3]);
}
