// scripts/generate-platinum/bundle.smoke.test.mjs
// End-to-end smoke test for the committed apple-platinum-replica bundle: the
// failure mode that actually matters is "did we ship a control-complete, valid,
// renderer-resolvable theme with no dangling assets". Read-only (asserts against
// the committed theme.json + cicns; does not regenerate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTheme } from '../../tools/theme-loader/validateTheme.js';

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, '../../themes/apple-platinum-replica');
const theme = JSON.parse(readFileSync(resolve(dest, 'theme.json'), 'utf8'));

// Resource IDs the runtime renderer (src/controls.ts) resolves by sourceCicnId.
const REQUIRED_IDS = [
  -9500, -9503, -9488, -9491,              // checkbox checked/empty, radio on/off
  -8277, -8278, -8285, -8286,              // scrollbar tracks (V/H)
  -10205, -10206, -10207, -10208,          // scroll thumbs (H/V, normal/pressed)
  -10238, -10239, -10240, -10231, -10232,  // button face + default ring
  -10078, -10079,                          // progress track + fill
  -10129, -10131,                          // slider thumb + track
  -14330, -14334,                          // grow box active/inactive
  -9972, -9975, -9980, -9983,              // tabs (small/large front/back)
];
// Disclosure resolves by KEY name, not id.
const REQUIRED_KEYS = ['right-pointing-disclosure-triangle', 'down-pointing-disclosure-triangle'];

test('committed bundle validates against the theme schema', () => {
  assert.doesNotThrow(() => validateTheme(theme));
});

test('control-complete: every renderer-required resource id resolves', () => {
  const ids = new Set(Object.values(theme.chromeElements || {}).map((e) => e.sourceCicnId));
  const missing = REQUIRED_IDS.filter((id) => !ids.has(id));
  assert.equal(missing.length, 0, `missing control cicn ids: ${missing.join(', ')}`);
});

test('control-complete: every renderer-required key resolves', () => {
  const ce = theme.chromeElements || {};
  for (const k of REQUIRED_KEYS) assert.ok(ce[k], `missing chrome key ${k}`);
});

test('no dangling assets: every chromeElement + window-chrome asset exists on disk', () => {
  for (const [k, el] of Object.entries(theme.chromeElements || {}))
    assert.ok(existsSync(resolve(dest, el.asset)), `${k}: missing asset ${el.asset}`);
  for (const [slug, wt] of Object.entries(theme.windowTypes || {}))
    for (const state of ['active', 'inactive'])
      if (wt.chrome?.[state]) assert.ok(existsSync(resolve(dest, wt.chrome[state])), `${slug}.${state}: missing ${wt.chrome[state]}`);
});

test('all 13 canonical window types are present', () => {
  assert.equal(Object.keys(theme.windowTypes || {}).length, 13);
});

// As the universal BASE theme, the replica must ship BOTH chrome states for every
// window type: a scheme with no window chrome of its own defers here, and its
// UNFOCUSED windows render the base's `inactive` chrome (WindowManager flips the
// state on focus change). A missing inactive would silently fall back to the
// active raster — wrong focus cue for every deferring scheme.
test('base-completeness: every window type ships active AND inactive chrome', () => {
  for (const [slug, wt] of Object.entries(theme.windowTypes || {})) {
    assert.ok(wt.chrome?.active, `${slug}: missing active chrome`);
    assert.ok(wt.chrome?.inactive, `${slug}: missing inactive chrome`);
  }
});
