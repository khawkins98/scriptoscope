import '../../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ResourceChain, mapProvider } = await import('./chain.ts');
const { createTrace } = await import('../trace.ts');

const archive = mapProvider('scheme', 'archive', [['cicn:900', 'A'], ['ppat:17', 'P']]);
const base = mapProvider('base', 'base', [['cicn:900', 'B'], ['cicn:901', 'B2']]);
const proc = mapProvider('procedural:platinum', 'procedural', [['cicn:902', 'X'], ['cicn:900', 'Y']]);

test('GetResource walks archive then base; first non-null wins', () => {
  const chain = new ResourceChain([archive, base, proc]);
  assert.equal(chain.getResource('cicn', 900).value, 'A');
  assert.equal(chain.getResource('cicn', 901).value, 'B2');
  assert.equal(chain.getResource('cicn', 901).provider.tier, 'base');
  assert.equal(chain.getResource('ppat', 900), null, 'type is part of the key');
});

test('procedural tier is searched only when a row authorises it', () => {
  const chain = new ResourceChain([archive, base, proc]);
  assert.equal(chain.getResource('cicn', 902), null);
  const t = createTrace('test');
  const hit = chain.getResource('cicn', 902, { procedural: 'PF1', trace: t });
  assert.equal(hit.value, 'X');
  assert.deepEqual(t.resolved, [{ type: 'cicn', id: 902, found: true, provider: 'procedural:platinum', tier: 'procedural' }]);
  assert.equal(chain.getResource('cicn', 900, { procedural: 'PF1' }).value, 'A', 'archive still wins');
});

test('probe requests exactly the table ids in order, repeats included, and stops at the first hit', () => {
  const chain = new ResourceChain([archive, base]);
  const t = createTrace('test');
  const hit = chain.probe('cicn', [903, 903, 901, 900], { row: 'TR7', trace: t });
  assert.equal(hit.id, 901);
  assert.deepEqual(t.resolved.map(r => [r.id, r.found, r.row]), [[903, false, 'TR7'], [903, false, 'TR7'], [901, true, 'TR7']]);
  const miss = createTrace('test');
  assert.equal(chain.probe('cicn', [1, 2], { trace: miss }), null);
  assert.equal(miss.resolved.length, 2, 'no extra request after the list is exhausted');
});

test('Get1Resource searches one provider only', () => {
  const chain = new ResourceChain([archive, base]);
  assert.equal(chain.get1Resource('cicn', 901, archive), null);
  assert.equal(chain.get1Resource('cicn', 901, base).value, 'B2');
});

test('providers must be in tier order, with at most one archive', () => {
  assert.throws(() => new ResourceChain([base, archive]), /tier order/);
  assert.throws(() => new ResourceChain([proc, base]), /tier order/);
  assert.throws(() => new ResourceChain([archive, archive]), /one archive/);
  assert.doesNotThrow(() => new ResourceChain([archive, base, base, proc]));
});
