import test from 'node:test';
import assert from 'node:assert/strict';
import { readInventory, validateSourceEvidence } from './validate-source.mjs';
import { sha256 } from './source.mjs';
const changed = mutate => {
  const draft = readInventory(); mutate(draft);
  draft.inventory.inventorySha256 = sha256(JSON.stringify(draft.inventory.cases));
  draft.inventory.review.inventorySha256 = draft.inventory.inventorySha256;
  return draft;
};
test('every finite source reference and all 18 archive identities validate without runtime observations', async () => {
  const result = await validateSourceEvidence(readInventory());
  assert.equal(result.sourceArchives, 18); assert.equal(result.cases, 27);
});
test('dangling resource evidence and forged presence/payload pins fail independently of case digest', async () => {
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases[0].sourceEvidence[0].signedId = -1)), /resource cicn\/-1/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases[0].sourceEvidence[0].presence = 'absent-from-selected-fork')), /presence mismatch/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases[0].sourceEvidence[0].payloadSha256 = '0'.repeat(64))), /payload hash/);
});
test('missing cinf evidence, fabricated cinf on absent source and wrong synthetic key fail', async () => {
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases[0].sourceEvidence = d.inventory.cases[0].sourceEvidence.filter(r => r.type !== 'cinf'))), /painted cinf evidence/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases.find(c => c.id === 'system7-nostalgia-silver.push.normal').proposed.admission[0].sourceCinfId = -10239)), /admitted cinf presence/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases.find(c => c.id === 'synthetic.named-preference').proposed.admission[0].manifestKey = 'cicn--123')), /admitted key/);
});
test('candidate payload drift and fixture evidence drift cannot hide behind matching references', async () => {
  await assert.rejects(validateSourceEvidence(changed(d => d.candidates.themes[0].candidates.find(r => r.presence === 'present').payloadSha256 = '0'.repeat(64))), /source candidate bytes/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases.find(c => c.id === 'synthetic.child-canonical').sourceEvidence[0].sha256 = '0'.repeat(64))), /fixture evidence hash/);
});
test('missing exact keys and stale engine reference hashes fail', async () => {
  await assert.rejects(validateSourceEvidence(changed(d => delete d.inventory.cases[0].proposed.paint[0].manifestKey)), /missing exact manifest key/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases.find(c => c.id === 'windows-95.default.pressed').sourceEvidence.find(r => r.engine).detailDocumentSha256 = '0'.repeat(64))), /detailed engine document hash/);
});
test('case input and base declaration cannot disagree with the selected fixture graph', async () => {
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases.find(c => c.id === 'synthetic.child-canonical').input = 'fixture.empty-cycle')), /input\/fixture evidence mismatch/);
  await assert.rejects(validateSourceEvidence(changed(d => d.inventory.cases.find(c => c.id === 'synthetic.child-canonical').baseInputs = [])), /baseInputs disagree/);
});

test('normal body dependencies bind raw ppat bytes and actual cinf request', async () => {
  const change = fn => changed(d => fn(d.inventory.cases.find(c => c.id === 'animals.push.normal')));
  await assert.rejects(validateSourceEvidence(change(c => c.sourceEvidence.find(r => r.type === 'ppat').payloadSha256 = '0'.repeat(64))), /ppat payload/);
  await assert.rejects(validateSourceEvidence(change(c => c.proposed.paint.find(p => p.type === 'ppat').signedId = 128)), /painted ppat evidence/);
  await assert.rejects(validateSourceEvidence(change(c => c.proposed.paint[0].sourceCinfId = -10238)), /pattern request mismatch/);
});

// Every migrated row starts as a valid control. Mutations use the exact declared
// identity, and must reach the validator's own rejection (never a setup TypeError).
test('all nine admission identities retain source joins with valid controls', async () => {
  const baseline = readInventory();
  const admissions = baseline.inventory.cases.filter(c => c.proposed.admission?.length);
  assert.equal(admissions.length, 9);
  await validateSourceEvidence(baseline);
  for (const original of admissions) {
    const alter = mutation => changed(d => mutation(d.inventory.cases.find(c => c.id === original.id)));
    const rejects = async (mutation, pattern) => {
      await assert.rejects(validateSourceEvidence(alter(mutation)), error => {
        assert.equal(error instanceof TypeError, false, `${original.id}: harness failure`);
        assert.match(error.message, pattern, original.id);
        return true;
      });
    };
    await rejects(c => delete c.proposed.admission[0].manifestKey, /missing exact manifest key/);
    await rejects(c => c.proposed.admission[0].ownerId = 'wrong-owner', /real input has no base|admitted owner/);
    await rejects(c => c.proposed.admission[0].signedId = -1, /admitted cicn evidence|admitted resource metadata/);
    await rejects(c => c.proposed.admission[0].sourceCinfId = original.proposed.admission[0].signedId, /admitted cinf presence|admitted resource metadata/);
    if (original.input.startsWith('theme.')) {
      await rejects(c => c.sourceEvidence = c.sourceEvidence.filter(r => r.type !== 'cinf'), /admitted cinf evidence/);
      await rejects(c => c.proposed.admission[0].chainDepth = 1, /real input has no base/);
    } else {
      await rejects(c => c.proposed.admission[0].manifestKey = 'cicn--123', /admitted key/);
      await rejects(c => c.proposed.admission[0].type = 'ics8', /admitted resource metadata/);
    }
  }
  await validateSourceEvidence(readInventory());
});
