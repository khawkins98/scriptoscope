// Hash-only inventory bumps made after the 459 corrections were activated (1.0.17).
// Each bump changes only one document's full-file documentSha256 values plus the
// version and review block (prior review archived verbatim). peelHashOnlyBumps undoes
// them, newest first, so the 459 lifecycle tests can recover the exact accepted 1.0.17
// inventory they pin. A bump missing from this list (or one that changed anything else)
// fails the recovered digest check in the caller.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const HASH_ONLY_BUMPS = [
  { version: '1.0.18', priorVersion: '1.0.17', document: 'docs/spec/kdef231-reference.md',
    from: 'ce33a576981b9c145a48b1a41e5a71ca1e33e1d292480b0c6e5f762ec343ab37',
    to: '3efc5f35ce1b5b539a4c0b8255e5f95b2713c0486b08592516b9fc9cf584fbd2' },
];

const sha256 = s => createHash('sha256').update(s).digest('hex');

export function peelHashOnlyBumps(live) {
  let current = live;
  for (const bump of [...HASH_ONLY_BUMPS].reverse()) {
    if (current.inventoryVersion !== bump.version) continue;
    const prior = current.review.previousReview;
    assert.equal(current.review.inventoryVersion, bump.version);
    assert.equal(prior.inventoryVersion, bump.priorVersion, `${bump.version} archives the ${bump.priorVersion} review`);
    let swapped = 0;
    const cases = JSON.parse(JSON.stringify(current.cases), function (key, value) {
      if (key === 'documentSha256' && this.document === bump.document) {
        assert.equal(value, bump.to, `every ${bump.document} pin moved to the bumped hash`);
        swapped++;
        return bump.from;
      }
      return value;
    });
    assert.ok(swapped > 0, `${bump.version} must pin ${bump.document}`);
    assert.equal(sha256(JSON.stringify(cases)), prior.inventorySha256, `${bump.version} is hash-only: peeled cases recover ${bump.priorVersion}`);
    current = { ...current, inventoryVersion: prior.inventoryVersion, inventorySha256: prior.inventorySha256, review: prior, cases };
  }
  return current;
}
