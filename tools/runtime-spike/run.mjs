import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createServer } from 'vite';
import { writeReport } from './report.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const session = `raster-spike-${process.pid}`;
const bevelDelivery = process.argv.includes('--bevel-delivery');
const bevelCompatibility = process.argv.some(arg => /^--bevel-compatibility(?:=cinf)?$/.test(arg));
const compatibilityMode = process.argv.includes('--bevel-compatibility=cinf') ? 'cinf' : 'rectangular';
const bevelProposal = bevelDelivery || bevelCompatibility || process.argv.includes('--bevel-proposal');
const production = bevelProposal || process.argv.includes('--production');
const referenceEntry = process.env.SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY ? resolve(process.env.SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY) : null;
if (bevelProposal && !referenceEntry) throw new Error('Bevel proposal requires a frozen compiled reference');
const referenceBuild = referenceEntry ? JSON.parse(await readFile(resolve(dirname(referenceEntry), '../build.json'), 'utf8')) : null;
if (referenceBuild) {
  if (!production || referenceBuild.status !== 'pass') throw new Error('Reference comparison requires production mode and a passed build');
  for (const file of referenceBuild.files) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file.path)) throw new Error('Invalid reference artifact filename');
    const bytes = await readFile(resolve(dirname(referenceEntry), file.path));
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Reference artifact hash mismatch');
  }
}
const browser = async (...args) => {
  const { stdout } = await exec('agent-browser', ['--session', session, '--json', ...args], { maxBuffer: 16 << 20 });
  const response = JSON.parse(stdout);
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data.result;
};
// Pin the actual runtime and driver bytes; reject a run whose inputs change.
async function fingerprints() {
  const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'tools/theme-loader'], { cwd: root });
  const runtime = stdout.trim().split('\n').filter(p => /\.(?:ts|js)$/.test(p) && !/\.test\.|\.d\.ts$/.test(p));
  const built = (await readdir(new URL('../../dist/', import.meta.url))).filter(p => p.endsWith('.js')).map(p => `dist/${p}`);
  if (referenceEntry) built.push(resolve(dirname(referenceEntry), '../build.json'), ...referenceBuild.files.map(file => resolve(dirname(referenceEntry), file.path)));
  const driver = ['tools/runtime-spike/index.html', 'tools/runtime-spike/report.mjs', 'tools/runtime-spike/run.mjs',
    ...(bevelProposal ? ['tools/runtime-spike/bevel-proposal.mjs', 'tools/runtime-spike/bevel-candidate.mjs', 'tools/runtime-spike/bevel-compatibility.mjs', 'tools/runtime-spike/bevel-synthetic.mjs']
      : [...(production ? ['tools/runtime-spike/mounts.mjs'] : []), `tools/runtime-spike/${production ? 'production' : 'spike'}.mjs`])];
  const hash = async files => {
    const digest = createHash('sha256');
    for (const file of files.sort()) { digest.update(file); digest.update(await readFile(resolve(root, file))); }
    return digest.digest('hex');
  };
  return { runtime: await hash(runtime), built: await hash(built), driver: await hash(driver) };
}
const inputs = await fingerprints();
const { stdout: revision } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
const server = await createServer({ configFile: false, root, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [root, ...(referenceEntry ? [dirname(referenceEntry)] : [])] } }, resolve: { alias: referenceEntry ? { '/runtime-reference.js': referenceEntry } : {} } });
try {
  await server.listen();
  await browser('open', `${server.resolvedUrls.local[0]}tools/runtime-spike/index.html${bevelDelivery ? '?bevel-proposal&prepared=rectangular&delivery' : bevelCompatibility ? `?bevel-proposal&prepared=${compatibilityMode}` : bevelProposal ? '?bevel-proposal' : production ? referenceEntry ? '?production&reference' : '?production' : ''}`);
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
  if (referenceBuild) report.referenceBuild = referenceBuild;
  if (JSON.stringify(inputs) !== JSON.stringify(finalInputs)) { report.status = 'unstable-inputs'; report.error = 'Runtime, built output or driver changed during the run'; }
  await writeReport(bevelDelivery ? 'bevel-delivery-results.json' : bevelCompatibility ? 'bevel-compatibility-results.json' : bevelProposal ? 'bevel-proposal-results.json' : referenceEntry ? 'production-reference-results.json' : production ? 'production-results.json' : 'results.json', report);
  console.log(JSON.stringify({ status: report.status, themes: report.rows ? new Set(report.rows.filter(row => !row.slug.startsWith('synthetic:')).map(row => row.slug)).size : 0,
    compared: report.compared, painted: report.painted, windows: report.windows, rasters: report.rasters, referenceRasters: report.referenceRasters, rendererComparisons: report.rendererComparisons, diagnosticComparisons: report.diagnosticComparisons, mismatches: report.mismatches?.length,
    ...(bevelProposal ? { mode: report.mode, corpusCompared: report.corpusCompared,
      syntheticFixtures: report.rows?.filter(row => row.slug.startsWith('synthetic:')).length,
      outcomes: report.outcomes, purpose: report.purpose } : {}) }, null, 2));
  if (report.status !== (bevelProposal ? 'measured' : 'pass')) process.exitCode = 1;
} finally {
  await browser('close').catch(() => {});
  await server.close();
}
