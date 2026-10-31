// #608: every PF rule check must be able to fail. Literal rows only; no runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPf3Unavailable, checkPf2Themed, checkPf2FromBase, completedFacePaint, PB9_REASON } from './controls459/push-facade-rules.mjs';

const admission = (id, depth = 0) => ({ role: 'face', requestedId: id, action: 'selected', basis: 'source-dispatch', usage: 'admission',
  reason: 'resource-id', owner: { baseUrl: '/themes/x', chainDepth: depth }, resource: { type: 'cicn', signedId: id } });
const cinfNull = id => ({ role: 'face', requestedId: id, action: 'missing', basis: 'source-dispatch', usage: 'admission', reason: 'engine:cinf-request,cinf-retry-face:cinf:NULL' });
const pb9 = () => ({ role: 'face', requestedId: 0, action: 'missing', basis: 'source-dispatch', usage: 'paint', reason: PB9_REASON });
const unavailable = () => ({ faceId: -10239, size: null, opaque: 0,
  trace: { outcome: { status: 'unavailable' }, steps: [admission(-10239), cinfNull(-10239), cinfNull(0), pb9()] } });
const themed = () => ({ faceId: -10239, size: [64, 24], opaque: 900,
  trace: { outcome: { status: 'themed', width: 64, height: 24 }, bandPaints: [{ role: 'face', region: 0 }],
    steps: [admission(-10239), { role: 'face', action: 'selected', usage: 'admission', reason: 'engine:cinf-request,cinf-retry-face:cinf:base', owner: { chainDepth: 1 } }] } });

test('PF3 literal unavailable row passes; each PF3/PF6 defect fails with its own message', () => {
  assert.deepEqual(checkPf3Unavailable(unavailable()), []);
  const cases = [
    ['transparent buffer (mutation 1)', r => { r.size = [64, 24]; r.trace.outcome = { status: 'themed', width: 64, height: 24 }; }, 'facade must return null'],
    ['null but themed (mutation 3)', r => { r.trace.outcome = { status: 'themed' }; }, 'outcome must be unavailable'],
    ['blank buffer', r => { r.size = [64, 24]; }, '0 opaque pixels'],
    ['invented band face (mutation 4)', r => { r.trace.bandPaints = [{ role: 'face' }]; }, 'completed face paint'],
    ['invented legacy face (mutation 4)', r => { r.trace.legacyFacePaint = { slice: 1 }; }, 'completed face paint'],
    ['invented body face (mutation 4)', r => { r.trace.steps.splice(1, 0, { role: 'face', bodyPaint: { branch: 'masked-copy' } }); }, 'completed face paint'],
    ['face paint selection', r => { r.trace.steps.splice(1, 0, { ...admission(-10239), usage: 'paint' }); }, 'face selected for paint'],
    ['missing PB9 step', r => { r.trace.steps.pop(); }, 'missing face step'],
    ['PB9 not terminal', r => { r.trace.steps.push({ role: 'face', action: 'rejected', usage: 'admission', reason: 'later' }); }, 'terminal step'],
    ['PB9 wrong usage', r => { r.trace.steps.at(-1).usage = 'admission'; }, 'missing face step'],
    ['PB9 wrong basis', r => { r.trace.steps.at(-1).basis = 'compatibility-policy'; }, 'missing face step'],
    ['lost admission identity', r => { r.trace.steps[0].resource.signedId = -10238; }, 'admission identity lost'],
    ['admission from base', r => { r.trace.steps[0].owner.chainDepth = 1; }, 'admission identity lost'],
    ['metadata hit instead of NULL', r => { r.trace.steps[1].action = 'selected'; }, 'cinf0 NULL transcript'],
    ['missing cinf0 request', r => { r.trace.steps.splice(2, 1); }, 'cinf0 NULL transcript'],
  ];
  for (const [name, mutate, message] of cases) {
    const row = unavailable(); mutate(row);
    assert.ok(checkPf3Unavailable(row).some(e => e.includes(message)), name);
  }
});

test('PF2 literal themed row passes; null, blank, mismatched or unpainted rows fail', () => {
  assert.deepEqual(checkPf2Themed(themed()), []);
  const cases = [
    ['null everywhere (mutation 2)', r => { r.size = null; r.trace.outcome = { status: 'unavailable' }; }, 'returned null'],
    ['unavailable outcome', r => { r.trace.outcome.status = 'unavailable'; }, 'must be themed'],
    ['dimension mismatch', r => { r.trace.outcome.width = 63; }, 'dimensions differ'],
    ['blank', r => { r.opaque = 0; }, '0 opaque'],
    ['no face paint record', r => { r.trace.bandPaints = [{ role: 'body' }]; }, 'without a completed face paint'],
  ];
  for (const [name, mutate, message] of cases) {
    const row = themed(); mutate(row);
    assert.ok(checkPf2Themed(row).some(e => e.includes(message)), name);
  }
});

test('PF-H3 requires the face cinf from chainDepth 1', () => {
  assert.deepEqual(checkPf2FromBase(themed()), []);
  const local = themed(); local.trace.steps[1].owner.chainDepth = 0;
  assert.ok(checkPf2FromBase(local).some(e => e.includes('chainDepth 1')));
  const ringOnly = themed(); ringOnly.trace.steps[1].role = 'default-ring';
  assert.ok(checkPf2FromBase(ringOnly).some(e => e.includes('chainDepth 1')));
});

test('completed face paint recognises only face records', () => {
  assert.equal(completedFacePaint({ steps: [{ role: 'default-ring', bodyPaint: {} }], bandPaints: [{ role: 'default-ring' }] }), false);
  assert.equal(completedFacePaint({ steps: [], legacyFacePaint: {} }), true);
});
