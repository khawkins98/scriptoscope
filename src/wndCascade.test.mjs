// Node test for the wnd# fallback-ladder helper (pure id-math, DOM-free).
// Verifies the 12-step cascade landings against the 2.3.1 kDEF decode at
// `.scratch/k231-kdef/kDEF/k231-kdef0.asm` 0x356c..0x367e. Cited landings
// match the table in src/wndCascade.ts header comment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascadeFallbackIds, cascadeFallbackSlugs } from './wndCascade.ts';

// ── ID-space landings (the kDEF's actual mask outputs) ──────────────────────

test('cascadeFallbackIds: -14336 (document-window) is terminal — no fallback', () => {
  assert.deepEqual(cascadeFallbackIds(-14336), []);
});

test('cascadeFallbackIds: -14304 (titled-utility) is terminal — no fallback', () => {
  assert.deepEqual(cascadeFallbackIds(-14304), []);
});

test('cascadeFallbackIds: -14332 (collapsed-document) → -14336 (document-window)', () => {
  // 0xC804 & 0xFFFB = 0xC800; the `& -5` strip at 0x35c6 lands on -14336.
  assert.deepEqual(cascadeFallbackIds(-14332), [-14336]);
});

test('cascadeFallbackIds: -14328 (dialog) → -14336 via the -15 strip', () => {
  // 0xC808 & 0xFFF1 = 0xC800; the `& -15` strip at 0x35fe lands on -14336.
  assert.deepEqual(cascadeFallbackIds(-14328), [-14336]);
});

test('cascadeFallbackIds: -14322 (movable-alert) walks 3 ids before terminal', () => {
  // & -3 → -14324 (movable-modal); & -5 → -14326 (alert); & -15 → -14336.
  assert.deepEqual(cascadeFallbackIds(-14322), [-14324, -14326, -14336]);
});

test('cascadeFallbackIds: -14292 (collapsed-side-utility) → side-utility → titled-utility', () => {
  // 0xC82C: & -5 → 0xC828 = -14296; & -15 → 0xC820 = -14304.
  assert.deepEqual(cascadeFallbackIds(-14292), [-14296, -14304]);
});

test('cascadeFallbackIds: -14284 (collapsed-no-title-utility) walks 3 ids', () => {
  // 0xC834: & -5 → 0xC830 = -14288; & -17 → 0xC824 = -14300; & -21 → 0xC820 = -14304.
  assert.deepEqual(cascadeFallbackIds(-14284), [-14288, -14300, -14304]);
});

test('cascadeFallbackIds: non-canonical id (e.g. -9999) drops out with whatever it can reach', () => {
  // Smoke check that the helper doesn't throw on off-grid ids; ordering still
  // walks the masks, distinct landings only.
  const out = cascadeFallbackIds(-9999);
  assert.ok(Array.isArray(out));
});

// ── Slug-space landings (the runtime's resolver consumes these) ─────────────

test('cascadeFallbackSlugs: collapsed-side-utility → [side-floating-utility, titled-utility]', () => {
  assert.deepEqual(
    cascadeFallbackSlugs('collapsed-side-utility'),
    ['side-floating-utility-window', 'titled-utility-window'],
  );
});

test('cascadeFallbackSlugs: collapsed-no-title-utility unrolls the full utility chain', () => {
  assert.deepEqual(
    cascadeFallbackSlugs('collapsed-no-title-utility'),
    ['no-title-utility-window', 'collapsed-titled-utility', 'titled-utility-window'],
  );
});

test('cascadeFallbackSlugs: movable-alert chains to movable-modal → alert → document', () => {
  assert.deepEqual(
    cascadeFallbackSlugs('movable-alert'),
    ['movable-modal', 'alert', 'document-window'],
  );
});

test('cascadeFallbackSlugs: unknown slug → []', () => {
  assert.deepEqual(cascadeFallbackSlugs('not-a-real-window-type'), []);
});

test('cascadeFallbackSlugs: document-window is terminal', () => {
  assert.deepEqual(cascadeFallbackSlugs('document-window'), []);
});

test('cascadeFallbackSlugs: popup-window has no canonical fallback (off the mask grid)', () => {
  // -12320 = 0xCFE0; the masks don't strip its bits to land on any other
  // canonical id, so the cascade returns no canonical fallback. The kDEF would
  // still attempt the masked ids, but none collide with a canonical entry.
  assert.deepEqual(cascadeFallbackSlugs('popup-window'), []);
});
