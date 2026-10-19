import test from 'node:test';
import assert from 'node:assert/strict';
import { readInventory } from './validate-source.mjs';
import { validateInventory } from './inventory.mjs';
import { sha256 } from './source.mjs';
const seal = i => { i.inventorySha256 = sha256(JSON.stringify(i.cases)); if (i.review) i.review.inventorySha256 = i.inventorySha256; return i; };
const reviewed = () => {
  const i = readInventory().inventory; i.reviewStatus = 'reviewed';
  for (const c of i.cases) { c.reviewStatus = 'reviewed'; c.effectiveAvailability = c.proposed?.outcome ?? 'unknown'; }
  i.review = { inventoryVersion: i.inventoryVersion, reviewers: ['unit-fixture-reviewer'] }; return seal(i);
};
test('review consistency permits exact known outcomes and explicit UNKNOWN without promoting draft data', () => {
  validateInventory(readInventory().inventory); validateInventory(reviewed());
});
test('duplicate case IDs fail even with a matching inventory digest', () => {
  const i = reviewed(); i.cases.push(i.cases[0]); seal(i);
  assert.throws(() => validateInventory(i), /Duplicate or missing case ID/);
});
test('unreviewed activation and reviewed effective/outcome disagreements fail', () => {
  const draft = readInventory().inventory; draft.cases[0].reviewStatus = 'draft-requires-independent-review'; draft.cases[0].effectiveAvailability = 'themed'; seal(draft);
  assert.throws(() => validateInventory(draft), /unreviewed outcome cannot be active/);
  const i = reviewed(); i.cases[0].effectiveAvailability = 'unavailable'; seal(i);
  assert.throws(() => validateInventory(i), /disagrees with declared outcome/);
  const unknown = reviewed(); unknown.cases[0].proposed = null; unknown.cases[0].effectiveAvailability = 'themed'; seal(unknown);
  assert.throws(() => validateInventory(unknown), /disagrees with declared outcome/);
});
test('stale review digest/version and direct-native conflation fail', () => {
  const i = reviewed(); i.review.inventorySha256 = '0'.repeat(64);
  assert.throws(() => validateInventory(i), /matching review version\/digest/);
  const native = reviewed(); native.cases[0].proposed.outcome = 'native-procedural'; native.cases[0].effectiveAvailability = 'native-procedural'; seal(native);
  assert.throws(() => validateInventory(native), /direct null is not a native realization/);
});
