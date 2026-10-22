// Built-in frame facade: window-type keys resolve to their declared window
// record through every equivalent identity (#421 review B1). renderWindow
// passes canonical slugs; the WindowManager collapse path swaps to the
// collapsed canonical slug; manifests may carry legacy keys.
import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { proceduralFrameRecordFor } = await import('./proceduralFrameChrome.ts');
const { canonicalWindowTypeSlug, collapsedWindowTypeSlug } = await import('./wndCascade.ts');
const { WINDOW_TYPE_IDENTITIES } = await import('../tools/theme-loader/window-type-identities.js');

const utility = WINDOW_TYPE_IDENTITIES.filter(i => /utility/.test(i.canonicalSlug));

test('every utility window type, canonical and legacy, resolves to a utility-family record', () => {
  assert.ok(utility.length >= 6);
  for (const identity of utility) {
    for (const key of [identity.canonicalSlug, identity.preferredManifestSlug, ...identity.legacySlugs, canonicalWindowTypeSlug(identity.canonicalSlug)]) {
      const r = proceduralFrameRecordFor(key);
      assert.equal(r.fallback, false, key);
      assert.equal(r.row.family, 'utility', key);
      assert.equal(r.row.collapsed, /^collapsed-/.test(identity.canonicalSlug), `${key} collapsed flag`);
    }
  }
});

test('the WindowManager collapse swap lands on a collapsed utility record', () => {
  for (const identity of utility.filter(i => i.collapsedId !== undefined)) {
    const collapsed = collapsedWindowTypeSlug(identity.canonicalSlug);
    assert.ok(collapsed, identity.canonicalSlug);
    const r = proceduralFrameRecordFor(collapsed);
    assert.deepEqual([r.fallback, r.row.family, r.row.collapsed], [false, 'utility', true], collapsed);
    // Collapsing keeps the window record: same variation as the expanded window, minus nothing but the collapse.
    const expanded = proceduralFrameRecordFor(identity.canonicalSlug).row;
    assert.equal(r.row.goAway, expanded.goAway, collapsed);
  }
});

test('an unknown key falls back to the document window and says so', () => {
  const r = proceduralFrameRecordFor('no-such-window-type');
  assert.deepEqual([r.fallback, r.row.slug, r.resolvedFrom], [true, 'document-window', null]);
});
