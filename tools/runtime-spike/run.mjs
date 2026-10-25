import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
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
  await writeFile(new URL(production ? './production-results.json' : './results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, themes: report.rows ? new Set(report.rows.map(row => row.slug)).size : 0,
    compared: report.compared, painted: report.painted, rasters: report.rasters, mismatches: report.mismatches?.length }, null, 2));
  if (report.status !== 'pass') process.exitCode = 1;
} finally {
  await browser('close').catch(() => {});
  await server.close();
}
