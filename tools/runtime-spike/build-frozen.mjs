// Compiler-only reconstruction. Historical inputs stay outside the working tree;
// only compiled JavaScript, CSS and provenance are exposed to the comparator.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, symlink, readFile, writeFile, readdir, copyFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build, version as viteVersion } from 'vite';
const exec = promisify(execFile), root = resolve(import.meta.dirname, '../..');
const revision = process.argv[2] ?? 'de942c6399c81d1f15d23247dfd62a36e11a64bc';
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Provide an exact commit SHA');
const workspace = await mkdtemp(join(tmpdir(), 'scriptoscope-frozen-'));
const input = join(workspace, 'input'), output = join(workspace, 'compiled');
await mkdir(input);
const result = { revision, createdAt: new Date().toISOString(), toolchainLockSha256: createHash('sha256').update(await readFile(join(root, 'package-lock.json'))).digest('hex'), buildRecipeSha256: createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'), status: 'building', node: process.version, vite: viteVersion,
  method: 'Isolated compiler-only reconstruction using the current pinned toolchain and explicit library configuration; historical source/configuration/logs are not inspected. Source maps and legal comments disabled. Not an original release artifact.', files: [] };
try {
  const { stdout } = await exec('git', ['ls-tree', '-r', '--name-only', revision, '--', 'src', 'tools', 'package.json'], { cwd: root });
  const paths = stdout.trim().split('\n').filter(path => !/(?:\.test\.|\.spec\.|-rules\.|\/tests\/)/.test(path)
    && /\.(?:ts|js|mjs|json|css|wasm)$/.test(path));
  const archive = join(workspace, 'inputs.tar');
  await exec('git', ['archive', '--format=tar', `--output=${archive}`, revision, '--', ...paths], { cwd: root });
  result.inputArchiveSha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
  await exec('tar', ['-xf', archive, '-C', input]);
  await symlink(join(root, 'node_modules'), join(input, 'node_modules'), 'dir');
  await build({ configFile: false, root: input, publicDir: false, logLevel: 'silent',
    esbuild: { legalComments: 'none' },
    build: { target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'], outDir: output,
      emptyOutDir: true, sourcemap: false, minify: 'esbuild',
      lib: { entry: join(input, 'src/index.ts'), formats: ['es'], fileName: () => 'scriptoscope.js' },
      rollupOptions: { external: [], output: { compact: true } } } });
  await copyFile(join(input, 'src/scriptoscope.css'), join(output, 'scriptoscope.css'));
  for (const path of (await readdir(output)).filter(path => /\.(?:js|css)$/.test(path)).sort()) {
    const bytes = await readFile(join(output, path));
    result.files.push({ path, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length,
      sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  result.status = 'pass';
} catch (error) {
  // Report build status/code only: compiler diagnostics can reproduce old source.
  result.status = 'error'; result.error = { name: error.name, code: error.code ?? null };
  process.exitCode = 1;
} finally {
  await rm(input, { recursive: true, force: true });
  await rm(join(workspace, 'inputs.tar'), { force: true });
  await writeFile(join(workspace, 'build.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, directory: output }));
}
