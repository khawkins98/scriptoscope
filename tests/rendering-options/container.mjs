import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const commands = {
  record: 'test:rendering:goldens:update', verify: 'test:rendering:goldens',
  contracts: 'test:rendering', extended: 'test:rendering:extended',
  // Scene fixtures (tests/visual-baselines/README.md, #599): recorded and
  // verified in this same image so CI's byte comparison matches.
  'scenes-record': 'baseline:scenes', 'scenes-verify': 'verify:scenes',
};
const mode = process.argv[2] ?? 'verify';
// Extra arguments (a slug, --diff-only) pass through to the npm script.
const extra = process.argv.slice(3);
if (extra.some(arg => !/^[\w.:-]+$/.test(arg))) throw new Error(`Unsupported argument: ${extra.join(' ')}`);
if (!commands[mode]) throw new Error(`Expected one of ${Object.keys(commands).join(', ')}`);
const root = fileURLToPath(new URL('../..', import.meta.url));
const commit = process.env.SCRIPTOSCOPE_GIT_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const image = 'mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f';
const result = spawnSync('docker', ['run', '--rm', '--platform', 'linux/amd64', '--ipc=host',
  '--mount', `type=bind,source=${root},target=/work`, '--mount', 'type=volume,target=/work/node_modules',
  '--workdir', '/work', '--env', `SCRIPTOSCOPE_GIT_COMMIT=${commit}`, image,
  'bash', '-lc', `npm ci && npm run build:themes && npm run ${commands[mode]}${extra.length ? ` -- ${extra.join(' ')}` : ''}`], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
