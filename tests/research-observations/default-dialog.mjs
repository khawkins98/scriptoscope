import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './validate.mjs';
import { inspectPNG } from '../reference-captures/png.mjs';

export const defaultDialogRoot = fileURLToPath(new URL('../../docs/research/default-dialog-observations/2026-10-18/', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const historical = 'docs/research/original-observations/2026-10-18/';
const historicalCommit = '2295dba63e831259b482b0c51af72121f3a18d06';
const slugs = ['windows-95', 'system7-nostalgia-silver'];
const phases = ['normal-default-attempt', 'after-return'];
const views = { frame: [640, 480], port: [160, 80], controlWithMargin: [96, 36] };
const ids = slugs.flatMap(s => phases.map(p => `${s}.${p}`)).sort();
const files = ['README.md', 'CONTEXT.md', 'observations.json', 'environment.json', 'comparison.json', 'fixtures/v6.c',
  ...slugs.flatMap(s => phases.flatMap(p => Object.keys(views).map(v => `images/${s}-${p}-${v}.png`)))].sort();
const check = (ok, why) => { if (!ok) throw new Error(`Default-dialog quarantine: ${why}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Finite preservation check only: never runs the engine, admits captures or assesses fidelity. */
export function validateDefaultDialog(root = defaultDialogRoot) {
  const base = realpathSync(root);
  function inventory(dir = base) {
    return readdirSync(dir).flatMap(name => {
      const path = resolve(dir, name), st = lstatSync(path);
      check(!st.isSymbolicLink(), 'symlink forbidden');
      return st.isDirectory() ? inventory(path) : [relative(base, path).split(sep).join('/')];
    });
  }
  check(same(inventory().sort(), [...files, 'files.json'].sort()), 'unexpected/missing file; binaries forbidden');
  function included(path) {
    check(files.includes(path) || path === 'files.json', 'included path not in finite inventory');
    return readFileSync(resolve(base, path));
  }
  const read = p => JSON.parse(included(p));
  const index = read('files.json');
  check(index.schemaVersion === 1 && index.status === 'QUARANTINED_PARTIAL' && index.scope === 'included-file-integrity-only', 'index scope escalation');
  check(same(index.files.map(f => f.path).sort(), files), 'index inventory mismatch');
  for (const f of index.files) {
    const bytes = included(f.path);
    check(sha256(bytes) === f.sha256 && bytes.length === f.bytes, `hash/size mismatch: ${f.path}`);
    if (f.path.endsWith('.png')) inspectPNG(bytes);
    else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      check(!text.includes('\0'), 'binary disguised as text');
      check(!/\/(?:Users|home|private\/tmp|tmp)\//.test(text), 'private absolute path forbidden');
    }
  }
  const obs = read('observations.json'), env = read('environment.json'), comparison = read('comparison.json');
  for (const doc of [obs, env, comparison]) {
    check(doc.status === 'QUARANTINED_PARTIAL', 'document scope escalation');
    check(!/"(?:eligible|accepted|approved|humanAttestation)"\s*:/.test(JSON.stringify(doc)), 'eligibility/approval field forbidden');
  }
  check(obs.schemaVersion === 1 && env.schemaVersion === 1 && obs.review === null && obs.producer.includes('automated; not a human attestation'), 'producer/review scope escalation');
  check(same(obs.observations.map(o => o.id).sort(), ids), 'four-observation inventory mismatch');
  const external = new Map();
  for (const x of env.externalAssets) {
    check(!external.has(x.id) && x.availability === 'EXTERNAL_NOT_INCLUDED' && /^[a-f0-9]{64}$/.test(x.sha256) && Number.isSafeInteger(x.bytes) && x.bytes > 0, 'external identity invalid');
    check(!('path' in x), 'external path masquerades as included'); external.set(x.id, x);
  }
  check(external.get('fixture-v6-appl')?.source === 'fixtures/v6.c', 'executable/source mismatch');
  check(external.get('fixture-v6-appl')?.sha256 === 'f47d4eca434e1fcb034f3c4bf2f5055334ce27d789421d1236ef29d047de4666', 'recorded executable changed');
  check(sha256(included('fixtures/v6.c')) === '74060145293c431ccff8dfaca988597c03a2af3ac2d9ea721ee4845c58b214a8', 'recorded fixture source changed');
  function historic(ref, suffix) {
    check(ref.path === historical + suffix && ref.commit === historicalCommit, 'historical reference mismatch');
    const full = resolve(repository, ref.path);
    check(!lstatSync(full).isSymbolicLink() && sha256(readFileSync(full)) === ref.sha256, 'historical hash mismatch');
  }
  const suffixes = ['environment.json', 'observations.json', 'color-probes.json', 'fixtures/v4.c'];
  check(env.historicalReferences.length === suffixes.length, 'historical inventory mismatch');
  for (const [i, ref] of env.historicalReferences.entries()) historic(ref, suffixes[i]);
  const original = JSON.parse(readFileSync(resolve(repository, historical, 'observations.json')));
  check(same(obs.historicalAuthority, original.authorityAtRecording), 'historical authority rewritten');
  const oldEnvironment = JSON.parse(readFileSync(resolve(repository, historical, 'environment.json')));
  check(same(env.originalComponents, oldEnvironment.originalEnvironment.installedComponents), 'historical engine components changed');
  for (const o of obs.observations) {
    check(o.id === `${o.slug}.${o.phase}` && o.status === 'QUARANTINED_PARTIAL' && o.review === null, 'observation scope/id mismatch');
    check(o.fixtureSource === 'fixtures/v6.c' && o.externalExecutableId === 'fixture-v6-appl', 'fixture binding mismatch');
    check(same(o.source, original.observations.find(x => x.id === `${o.slug}.normal`)?.source), 'historical source selection changed');
    const i = o.invocation, t = o.observedNativeTelemetry;
    check(i.setDefaultErr === 0 && i.getStdFilterErr === 0 && i.dialogProcId === 0 && i.controlHilite === 0 && i.initialDefaultItem === 1 && i.setterRequestedItem === 1, 'recorded invocation changed');
    check(i.authoredRingAttribution === 'UNKNOWN' && i.controlVariant === 'NOT_INSTRUMENTED' && i.controlValueMinMax === 'NOT_INSTRUMENTED', 'unknown attribution promoted');
    check(t.initialDefaultItem === 1 && t.actualDefaultItem === 1 && t.defaultFlag === 0 && t.beforeSetterDefaultFlag === 0 && t.AcidMagic === true && t.beforeSetterAcidMagic === true, 'recorded default fields changed');
    check(t.standardFilterParticipated === true && t.frontWindowIsDialog === true && t.emptyTitle === true && t.itemType === 4, 'recorded native condition changed');
    check(t.windowKind === 'not instrumented; no inferred value' && t.guestPixelDepth === 8 && t.systemVersionHex === '755', 'unknown kind or guest context changed');
    check(same(t.portLTRB, [0, 0, 160, 80]) && same(t.portGlobalOrigin, [80, 90]) && same(t.controlLTRB, [20, 20, 100, 40]), 'recorded geometry changed');
    const hit = o.phase === 'after-return' ? 1 : 0;
    check(t.returnedItem === hit && t.itemHitCount === hit, 'keyboard phase mismatch');
    check(o.capture.toolSourceSha256 === external.get('capture-tool-v6')?.sha256, 'capture tool identity mismatch');
    check(same(o.capture.canvasSize, [640, 480]) && same(o.capture.portFrameRect, [80, 90, 160, 80]) && same(o.capture.marginFrameRect, [92, 102, 96, 36]), 'capture geometry changed');
    for (const [view, size] of Object.entries(views)) {
      check(o.images[view] === `images/${o.slug}-${o.phase}-${view}.png`, 'image/phase binding mismatch');
      const png = inspectPNG(included(o.images[view])); check(same([png.width, png.height], size), 'PNG dimensions mismatch');
    }
  }
  check(same(comparison.observations.map(x => x.slug).sort(), [...slugs].sort()), 'comparison inventory mismatch');
  for (const c of comparison.observations) {
    historic(c.inputs[0], `images/${c.slug}-normal-port.png`);
    check(c.inputs[1].kind === 'included-file' && c.inputs[1].path === `images/${c.slug}-normal-default-attempt-port.png` && c.inputs[1].sha256 === sha256(included(c.inputs[1].path)), 'comparison input mismatch');
    const win = c.slug === 'windows-95';
    check(c.port.changedPixels === (win ? 204 : 628) && c.face.changedPixels === (win ? 0 : 4), 'recorded comparison changed');
  }
  return { status: 'QUARANTINED_PARTIAL', observations: 4, pngFiles: 12, check: 'integrity-and-scope-only; border attribution and eligibility UNKNOWN' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(validateDefaultDialog(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
