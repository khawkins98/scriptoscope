import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defaultDialogRoot, validateDefaultDialog } from './default-dialog.mjs';
import { sha256 } from './validate.mjs';
function fixture(t) { const root = mkdtempSync(join(tmpdir(), 'default-dialog-quarantine-')); cpSync(defaultDialogRoot, root, { recursive: true }); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }
function edit(root, name, change) {
  const p = join(root, name), data = JSON.parse(readFileSync(p)); change(data); writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  if (name !== 'files.json') { const bytes = readFileSync(p); edit(root, 'files.json', i => Object.assign(i.files.find(f => f.path === name), { bytes: bytes.length, sha256: sha256(bytes) })); }
}
test('four public-dialog observations remain quarantined without admitting captures', () => {
  assert.equal(validateDefaultDialog().observations, 4);
});
test('PNG corruption cannot pass unchanged size and resealed invalid PNG cannot pass integrity', t => {
  const root = fixture(t), name = 'images/windows-95-normal-default-attempt-port.png', p = join(root, name), bytes = readFileSync(p); bytes[bytes.length - 1] ^= 1; writeFileSync(p, bytes);
  assert.throws(() => validateDefaultDialog(root), /hash\/size mismatch/);
  writeFileSync(p, 'invalid'); edit(root, 'files.json', i => Object.assign(i.files.find(f => f.path === name), { bytes: 7, sha256: sha256(Buffer.from('invalid')) }));
  assert.throws(() => validateDefaultDialog(root), /PNG: invalid/);
});
test('missing frame, extra binary, path escape and symlink cannot enter the package', t => {
  const root = fixture(t), name = 'images/windows-95-normal-default-attempt-frame.png', p = join(root, name);
  rmSync(p); assert.throws(() => validateDefaultDialog(root), /unexpected\/missing file/);
  cpSync(join(defaultDialogRoot, name), p); writeFileSync(join(root, 'app.bin'), Buffer.from([0, 1]));
  assert.throws(() => validateDefaultDialog(root), /binaries forbidden/); rmSync(join(root, 'app.bin'));
  edit(root, 'files.json', i => { i.files[0].path = '../outside'; }); assert.throws(() => validateDefaultDialog(root), /inventory mismatch/);
  cpSync(join(defaultDialogRoot, 'files.json'), join(root, 'files.json')); rmSync(p); symlinkSync(join(defaultDialogRoot, name), p);
  assert.throws(() => validateDefaultDialog(root), /symlink/);
});
test('rehashed attribution escalation does not turn flag0 into a verified authored ring', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.observations[0].invocation.authoredRingAttribution = 'VERIFIED'; });
  assert.throws(() => validateDefaultDialog(root), /unknown attribution promoted/);
});
test('rehashed eligibility and human-review escalation remain forbidden', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.eligible = true; }); assert.throws(() => validateDefaultDialog(root), /eligibility\/approval field/);
  edit(root, 'observations.json', o => { delete o.eligible; o.review = { human: true }; }); assert.throws(() => validateDefaultDialog(root), /review scope escalation/);
});
test('relabeling idempotent setter as a transition is rejected after resealing', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.observations[0].observedNativeTelemetry.initialDefaultItem = 0; });
  assert.throws(() => validateDefaultDialog(root), /default fields changed/);
});
test('before-return cannot be relabeled as a successful keyboard observation', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.observations[0].observedNativeTelemetry.returnedItem = 1; });
  assert.throws(() => validateDefaultDialog(root), /keyboard phase mismatch/);
});
test('external executable swap or included-path claim fails after resealing', t => {
  const root = fixture(t); edit(root, 'environment.json', e => { e.externalAssets[0].sha256 = '0'.repeat(64); }); assert.throws(() => validateDefaultDialog(root), /recorded executable changed/);
  edit(root, 'environment.json', e => { e.externalAssets[0].path = 'app.bin'; }); assert.throws(() => validateDefaultDialog(root), /external path/);
});
test('historical authority, hash and path cannot be silently rebound', t => {
  const root = fixture(t); edit(root, 'environment.json', e => { e.historicalReferences[0].sha256 = '0'.repeat(64); }); assert.throws(() => validateDefaultDialog(root), /historical hash/);
  edit(root, 'environment.json', e => { e.historicalReferences[0].path = '../outside'; }); assert.throws(() => validateDefaultDialog(root), /historical reference/);
});
test('private paths and inferred window kind fail even with a valid file seal', t => {
  const root = fixture(t); edit(root, 'observations.json', o => { o.observations[0].observedNativeTelemetry.windowKind = 'dialog'; }); assert.throws(() => validateDefaultDialog(root), /unknown kind/);
  edit(root, 'observations.json', o => { o.privateNote = '/Users/example/private'; }); assert.throws(() => validateDefaultDialog(root), /private absolute path/);
});
