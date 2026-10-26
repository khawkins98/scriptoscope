import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const session = `raster-spike-${process.pid}`;
const production = process.argv.includes('--production');
const browser = async (...args) => {
  const { stdout } = await exec('agent-browser', ['--session', session, '--json', ...args], { maxBuffer: 16 << 20 });
  const response = JSON.parse(stdout);
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data.result;
};
// Pin the actual runtime and driver bytes; reject a run whose inputs change.
async function fingerprints() {
  const { stdout } = await exec('git', ['ls-files', 'src', 'tools/theme-loader'], { cwd: root });
  const runtime = stdout.trim().split('\n').filter(p => /\.(?:ts|js)$/.test(p) && !/\.test\.|\.d\.ts$/.test(p));
  const built = (await readdir(new URL('../../dist/', import.meta.url))).filter(p => p.endsWith('.js')).map(p => `dist/${p}`);
  const driver = [...(production ? ['tools/runtime-spike/mounts.mjs'] : []), 'tools/runtime-spike/run.mjs', `tools/runtime-spike/${production ? 'production' : 'spike'}.mjs`];
  const hash = async files => {
    const digest = createHash('sha256');
    for (const file of files.sort()) { digest.update(file); digest.update(await readFile(new URL(`../../${file}`, import.meta.url))); }
    return digest.digest('hex');
  };
  return { runtime: await hash(runtime), built: await hash(built), driver: await hash(driver) };
}
const inputs = await fingerprints();
const { stdout: revision } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
const server = await createServer({ configFile: false, root, server: { host: '127.0.0.1', port: 0, hmr: false } });
try {
  await server.listen();
  await browser('open', `${server.resolvedUrls.local[0]}tools/runtime-spike/index.html${production ? '?production' : ''}`);
  const deadline = Date.now() + (production ? 600_000 : 180_000);
  let report;
  while (Date.now() < deadline) {
    report = await browser('eval', 'window.spikeReport ?? null');
    if (report) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!report) throw new Error('Spike timed out');
  const finalInputs = await fingerprints();
  report.provenance = { revision: revision.trim(), ...inputs };
  if (JSON.stringify(inputs) !== JSON.stringify(finalInputs)) { report.status = 'unstable-inputs'; report.error = 'Runtime, built output or driver changed during the run'; }
  await writeFile(new URL(production ? './production-results.json' : './results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, themes: report.rows ? new Set(report.rows.map(row => row.slug)).size : 0,
    compared: report.compared, painted: report.painted, windows: report.windows, rasters: report.rasters, mismatches: report.mismatches?.length }, null, 2));
  if (report.status !== 'pass') process.exitCode = 1;
} finally {
  await browser('close').catch(() => {});
  await server.close();
}
