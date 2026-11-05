import assert from 'node:assert/strict';

// npm 11 emits an array; npm 12 keys results by package name.
export function parsePackResult(output) {
  const result = JSON.parse(output);
  const entries = Array.isArray(result) ? result : Object.values(result ?? {});
  assert.equal(entries.length, 1, 'Expected exactly one packed package');
  const [packed] = entries;
  assert(packed && typeof packed.name === 'string' && typeof packed.filename === 'string', 'Invalid npm pack result');
  return packed;
}
