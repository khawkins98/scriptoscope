import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { packageRoot, sha256, validateResearch } from './validate.mjs';
function fixture(t) { const root = mkdtempSync(join(tmpdir(), 'quarantined-observations-')); cpSync(packageRoot, root, { recursive: true }); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }
function edit(root, name, change, reseal = true) {
  const file = join(root, name), obj = JSON.parse(readFileSync(file)); change(obj); writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  if (reseal && name !== 'files.json') { const bytes = readFileSync(file); edit(root, 'files.json', index => Object.assign(index.files.find(f => f.path === name), { bytes: bytes.length, sha256: sha256(bytes) }), false); }
}
test('research integrity passes without supplying any capture approval', () => {
  assert.deepEqual(validateResearch(), { status: 'QUARANTINED_PARTIAL', observations: 6, pngFiles: 20, check: 'integrity-and-scope-only; no eligibility or fidelity result' });
});
test('changed PNG bytes fail even when dimensions remain unchanged', t => {
  const root = fixture(t), path = join(root, 'images/windows-95-normal-port.png'), bytes = readFileSync(path); bytes[bytes.length - 1] ^= 1; writeFileSync(path, bytes);
  assert.throws(() => validateResearch(root), /hash\/size mismatch/);
});
test('resealing invalid PNG bytes cannot bypass structural checks', t => {
  const root = fixture(t), name = 'images/windows-95-normal-port.png', bytes = Buffer.from('not a PNG'); writeFileSync(join(root, name), bytes);
  edit(root, 'files.json', i => Object.assign(i.files.find(f => f.path === name), { bytes: bytes.length, sha256: sha256(bytes) }));
  assert.throws(() => validateResearch(root), /PNG: invalid/);
});
test('missing image and extra compiled binary are rejected', t => {
  const root = fixture(t); rmSync(join(root, 'images/windows-95-normal-port.png'));
  assert.throws(() => validateResearch(root), /unexpected\/missing file/);
  cpSync(join(packageRoot, 'images/windows-95-normal-port.png'), join(root, 'images/windows-95-normal-port.png'));
  writeFileSync(join(root, 'fixture.bin'), Buffer.from([0, 1, 2]));
  assert.throws(() => validateResearch(root), /binaries and unlisted/);
});
test('manifest path escape and symlink to identical external bytes are rejected', t => {
  const root = fixture(t); edit(root, 'files.json', i => { i.files[0].path = '../outside.png'; });
  assert.throws(() => validateResearch(root), /inventory mismatch/);
  cpSync(join(packageRoot, 'files.json'), join(root, 'files.json'));
  const path = join(root, 'images/windows-95-normal-port.png'); rmSync(path); symlinkSync(join(packageRoot, 'images/windows-95-normal-port.png'), path);
  assert.throws(() => validateResearch(root), /symlink/);
});
test('rehashed scope escalation cannot create approved observations', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.observations[0].status = 'reviewed-independent-capture'; });
  assert.throws(() => validateResearch(root), /scope escalation/);
});
test('rehashed eligibility flag or human approval is not accepted', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.eligible = true; });
  assert.throws(() => validateResearch(root), /eligibility field/);
  edit(root, 'observations.json', o => { delete o.eligible; o.review = { reviewer: 'invented human' }; });
  assert.throws(() => validateResearch(root), /review scope escalation/);
});
test('fixture/version and rejected-color-proof relabeling fail after resealing', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.observations[0].externalExecutableId = 'fixture-v5-appl'; });
  assert.throws(() => validateResearch(root), /fixture binding/);
  cpSync(join(packageRoot, 'observations.json'), join(root, 'observations.json')); cpSync(join(packageRoot, 'files.json'), join(root, 'files.json'));
  edit(root, 'color-probes.json', p => { p.transport.beforeFrameStatus = 'CORRECTED'; });
  assert.throws(() => validateResearch(root), /proof reclassified/);
});
test('external assets cannot claim an included path', t => {
  const root = fixture(t); edit(root, 'environment.json', e => { e.externalAssets[0].path = 'original.dsk'; });
  assert.throws(() => validateResearch(root), /external asset must not/);
});
