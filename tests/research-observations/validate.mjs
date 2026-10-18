import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectPNG } from '../reference-captures/png.mjs';

export const packageRoot = fileURLToPath(new URL('../../docs/research/original-observations/2026-10-18/', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, reason) => { if (!ok) throw new Error(`Quarantined research: ${reason}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const schemes = ['system7-nostalgia-silver', 'windows-95'];
const states = ['normal', 'pressed', 'disabled'];
const views = { frame: [640, 480], port: [160, 80], controlWithMargin: [96, 36] };
const expectedIds = schemes.flatMap(s => states.map(t => `${s}.${t}`)).sort();
const expectedFiles = [
  'README.md', 'observations.json', 'environment.json', 'color-probes.json',
  'fixtures/v4.c', 'fixtures/v5.c',
  'images/transport-before-rejected.png', 'images/face-color-v5-frame.png',
  ...schemes.flatMap(s => states.flatMap(t => Object.keys(views).map(v => `images/${s}-${t}-${v}.png`))),
].sort();

/** Integrity/scope only. No original engine, intake assessment, renderer or approval writes. */
export function validateResearch(root = packageRoot) {
  const base = realpathSync(root);
  function included(path) {
    check(typeof path === 'string' && !path.includes('\\') && !path.startsWith('/') && !path.split('/').includes('..'), `unsafe included path: ${path}`);
    const full = resolve(base, path), rel = relative(base, realpathSync(full));
    check(rel !== '..' && !rel.startsWith(`..${sep}`), `path escapes package: ${path}`);
    check(lstatSync(full).isFile() && !lstatSync(full).isSymbolicLink(), `not a regular included file: ${path}`);
    return readFileSync(full);
  }
  function inventory(dir = base) {
    return readdirSync(dir).flatMap(name => {
      const path = resolve(dir, name), st = lstatSync(path);
      check(!st.isSymbolicLink(), `symlink is not an included observation: ${name}`);
      return st.isDirectory() ? inventory(path) : [relative(base, path).split(sep).join('/')];
    });
  }
  check(same(inventory().sort(), [...expectedFiles, 'files.json'].sort()), 'unexpected/missing file; binaries and unlisted artifacts are forbidden');
  const read = name => JSON.parse(included(name));
  const index = read('files.json');
  check(index.schemaVersion === 1 && index.status === 'QUARANTINED_PARTIAL' && index.scope === 'included-file-integrity-only', 'index scope escalation');
  check(same(index.files.map(f => f.path).sort(), expectedFiles), 'included manifest inventory mismatch or duplicate');
  for (const entry of index.files) {
    const bytes = included(entry.path);
    check(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, `hash/size mismatch: ${entry.path}`);
    if (entry.path.endsWith('.png')) inspectPNG(bytes);
    else { const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); check(!text.includes('\0'), `binary disguised as text: ${entry.path}`); }
  }
  const obs = read('observations.json'), env = read('environment.json'), probes = read('color-probes.json');
  for (const document of [obs, env, probes]) {
    check(document.schemaVersion === 1 && document.status === 'QUARANTINED_PARTIAL', 'research scope escalation');
    check(!/"(?:eligible|accepted|approved|humanAttestation)"\s*:/.test(JSON.stringify(document)), 'approval/eligibility field forbidden in quarantine');
  }
  check(obs.review === null && obs.producer.includes('automated') && obs.producer.includes('not a human attestation'), 'producer/review scope escalation');
  check(same(obs.observations.map(o => o.id).sort(), expectedIds), 'six-observation inventory mismatch');
  const external = new Map();
  for (const item of env.externalAssets) {
    check(!external.has(item.id) && item.availability === 'EXTERNAL_NOT_INCLUDED' && /^[a-f0-9]{64}$/.test(item.sha256) && Number.isSafeInteger(item.bytes) && item.bytes > 0, 'invalid/duplicate external identity');
    check(!('path' in item), 'external asset must not masquerade as included file binding');
    external.set(item.id, item);
  }
  for (const o of obs.observations) {
    const [slug, state] = o.id.split('.');
    check(o.status === 'QUARANTINED_PARTIAL' && o.review === null, `observation scope escalation: ${o.id}`);
    check(o.fixture === 'v4' && o.fixtureSource === 'fixtures/v4.c' && o.externalExecutableId === 'fixture-v4-appl' && external.get(o.externalExecutableId)?.source === o.fixtureSource, `fixture binding mismatch: ${o.id}`);
    check(o.source.canonicalRegistry.slug === slug && o.source.canonicalRegistry.path === 'tests/control-availability/source-choices.json' && /^[a-f0-9]{40}$/.test(o.source.canonicalRegistry.commit), 'invalid historical source reference');
    check(/^[a-f0-9]{64}$/.test(o.source.observedArchiveSha256) && /^[a-f0-9]{64}$/.test(o.source.observedForkSha256), 'missing observed source byte identity');
    check(o.invocation.hilite === { normal: 0, pressed: 10, disabled: 255 }[state] && o.observedTelemetry.actualHilite === o.invocation.hilite, `state/telemetry mismatch: ${o.id}`);
    check(same(o.observedTelemetry.portBounds, [0, 0, 160, 80]) && same(o.observedTelemetry.actualControlLTRB, [20, 20, 100, 40]) && o.observedTelemetry.guestDevicePixelSize === 8, `observed geometry/depth mismatch: ${o.id}`);
    for (const [view, size] of Object.entries(views)) {
      check(o.images[view] === `images/${slug}-${state}-${view}.png`, `image binding mismatch: ${o.id}/${view}`);
      const png = inspectPNG(included(o.images[view]));
      check(same([png.width, png.height], size), `image dimensions mismatch: ${o.id}/${view}`);
    }
  }
  check(probes.transport.beforeFrameStatus === 'REJECTED_COLOR_TRANSPORT' && probes.transport.beforeFrame === 'images/transport-before-rejected.png', 'rejected transport proof reclassified');
  check(probes.transport.fixture === 'v4' && probes.deviceGray.fixture === 'v5' && probes.deviceGray.source === 'fixtures/v5.c' && probes.deviceGray.externalExecutableId === 'fixture-v5-appl', 'probe fixture binding mismatch');
  check(external.get('fixture-v5-appl')?.source === 'fixtures/v5.c', 'v5 external executable binding mismatch');
  for (const path of [probes.transport.beforeFrame, probes.deviceGray.frame]) {
    const png = inspectPNG(included(path)); check(png.width === 640 && png.height === 480, 'proof must retain native frame');
  }
  return { status: 'QUARANTINED_PARTIAL', observations: 6, pngFiles: 20, check: 'integrity-and-scope-only; no eligibility or fidelity result' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(validateResearch(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
