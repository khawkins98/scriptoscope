#!/usr/bin/env node
// Static theme-data linter: checks each window type's wnd# + cicn against the
// STRUCTURAL ASSUMPTIONS the kDEF makes — WITHOUT rendering. The render-audit
// (audit-placement.mjs) verifies our output obeys our own part-code model; this
// linter verifies the INPUT DATA is shaped the way the kDEF expects, catching the
// data-shaped anomalies a render-audit is blind to (a glitch only becomes visible
// when a human looks at a render — these surface it the moment the theme builds).
//
// Usage:  node scripts/lint-themes.mjs [slug]
//
// Each rule maps to a real bug class we hit reactively. The cited kDEF routines
// are the source of the assumption (see docs/tracking/kdef-faithfulness-ledger.md
// and compositor-spec.md).
//
//   tail   — the cicn carries opaque art only up to col/row C, but the resource
//            is wider/taller. The kDEF blits with the mask and walks the recipe
//            over [0,lastBorder), so the slack past the art is NOT the window;
//            sizing an inset off the raw bounds inflates it. (drawableExtent in
//            composeChrome handles this — the rule records the dependency and
//            flags any cicn that newly relies on it.)  [beos document-window]
//   body   — part-0 (the content rect) must sit inside the drawable extent. A
//            body rect that overruns it means the wnd# rect was paired with the
//            WRONG cicn (the inset goes negative / samples OOB; the compositor
//            clamps, but the frame is wrong).  [1138 movable-modal grow-box]
//   recipe — each side recipe should span the drawable art on its axis: ending
//            well SHORT leaves frame art undrawn; running PAST the cicn samples
//            out of bounds.  [generalises the beos signature]
//   norecipe — a side with a non-zero inset but no recipe draws nothing (we no
//            longer fake-fill it). Expected for collapsed/topless types; flagged
//            so an unexpected one stands out.  [recipe-less edge back-off]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCicn } from './diag-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');
const only = process.argv[2];
const slugs = (only ? [only] : readdirSync(themesRoot)).filter((s) =>
  existsSync(resolve(themesRoot, s, 'theme.json')),
);

const ALPHA = 16; // matches composeChrome's opacity threshold

/** Last opaque column/row +1 — the drawable extent (see composeChrome.drawableExtent). */
function drawableExtent(cicn) {
  let maxX = -1, maxY = -1;
  for (let y = 0; y < cicn.height; y++) {
    for (let x = 0; x < cicn.width; x++) {
      if (cicn.getPixel(x, y)[3] > ALPHA) {
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { w: maxX < 0 ? cicn.width : maxX + 1, h: maxY < 0 ? cicn.height : maxY + 1 };
}

const lastBorder = (edge) => (edge?.length ? Math.max(...edge.map((s) => s.at)) : null);

let errors = 0, warns = 0, notes = 0, wins = 0;

for (const slug of slugs) {
  const themeDir = resolve(themesRoot, slug);
  const manifest = JSON.parse(readFileSync(resolve(themeDir, 'theme.json'), 'utf8'));
  const wts = manifest.windowTypes || {};
  const keys = Object.keys(wts).filter((k) => wts[k]?.chrome?.active);
  if (!keys.length) { console.log(`\n${slug}: (no chrome cicns — baseline/procedural)`); continue; }
  console.log(`\n${slug}:`);

  for (const key of keys) {
    const wt = wts[key];

    // Corner-sprite windows (look-only Platinum schemes: apple-platinum-2,
    // platinum-8, system7-nostalgia-silver) are NOT the sliced kDEF cicn-walk —
    // they render procedurally from sprite cicns (composeCornerSprite.ts). The
    // sliced rules below (body rect inside the chrome cicn's drawable extent,
    // per-edge recipe span) don't apply: chrome.active is a 16px proxy ICON, not
    // a frame template, and part-0 carries the four frame THICKNESSES, not a body
    // rect (so r<=l, etc. is by design). Verify the sprite set exists instead.
    if (wt.model === 'corner-sprite') {
      wins++;
      const out = [];
      const ERR = (m) => { out.push(['E', m]); errors++; };
      const checkSprite = (label, rel) => {
        if (!rel) return;
        try { loadCicn(themeDir, rel); }
        catch (e) { ERR(`sprite ${label}: cannot load ${rel} (${e.message})`); }
      };
      if (!wt.sprites?.pinstripe) ERR('corner-sprite: missing sprites.pinstripe');
      checkSprite('pinstripe', wt.sprites?.pinstripe);
      checkSprite('growBox', wt.sprites?.growBox);
      checkSprite('chrome.active', wt.chrome?.active);
      if (!Array.isArray(wt.parts?.['part-0']?.rect)) ERR('corner-sprite: missing part-0 frame thicknesses');
      const tag = out.some(([s]) => s === 'E') ? 'ERROR' : out.length ? 'note' : 'ok';
      console.log(`  ${key.padEnd(32)} ${tag}`);
      for (const [s, m] of out) console.log(`      ${s === 'E' ? '✗' : '·'} ${m}`);
      continue;
    }

    let cicn;
    try { cicn = loadCicn(themeDir, wt.chrome.active); }
    catch (e) { console.log(`  ${key.padEnd(32)} LOAD FAIL ${e.message}`); errors++; continue; }
    wins++;
    const out = [];
    const ERR = (m) => { out.push(['E', m]); errors++; };
    const WARN = (m) => { out.push(['W', m]); warns++; };
    const NOTE = (m) => { out.push(['n', m]); notes++; };

    const raw = { w: cicn.width, h: cicn.height };
    const draw = drawableExtent(cicn);
    const ed = wt.edges || {};
    const wRecipe = Math.max(lastBorder(ed.top) ?? 0, lastBorder(ed.bottom) ?? 0) || null;
    const hRecipe = Math.max(lastBorder(ed.left) ?? 0, lastBorder(ed.right) ?? 0) || null;

    // ── tail: transparent slack past the art ──
    if (raw.w - draw.w > 1)
      NOTE(`tail: cicn ${raw.w}px wide, art ends at ${draw.w} (${raw.w - draw.w}px transparent tail — inset sized off the drawable extent)`);
    if (raw.h - draw.h > 1)
      NOTE(`tail: cicn ${raw.h}px tall, art ends at ${draw.h} (${raw.h - draw.h}px transparent tail)`);

    // ── body: content rect must sit inside the drawable extent ──
    // A full window's body rect that overruns the drawable extent means the wnd#
    // rect was paired with the WRONG cicn (negative inset, OOB sampling). Collapsed
    // types intentionally REUSE the full type's body rect against a shorter cicn,
    // so their overrun is expected (the inset clamps to 0 — no bottom edge).
    const isCollapsed = /collapsed/.test(key);
    const body = wt.parts?.['part-0']?.rect;
    if (body) {
      const [l, t, r, b] = body;
      if (r <= l || b <= t) ERR(`body: degenerate rect [${body}]`);
      else if (l < 0 || t < 0 || r > draw.w + 1 || b > draw.h + 1) {
        const m = `body: rect [${body}] overruns drawable extent ${draw.w}×${draw.h}`;
        if (isCollapsed) NOTE(`${m} (body reused from the full type — inset clamps, expected)`);
        else ERR(`${m} (cicn↔rect mispairing → bad insets)`);
      }
    } else {
      ERR(`body: no part-0 rect`);
    }

    // ── recipe: the TOP/BOTTOM recipe spans the full width corner-to-corner, so
    // it should reach the drawable width; ending short leaves frame art undrawn
    // (the beos-class bug, caught against the DRAWABLE extent — beos's own top
    // recipe ends at 75 == its drawable width, so it reads clean; only the raw
    // bounds were off). LEFT/RIGHT recipes are NOT checked for span: they cover
    // only the content-height middle (the corners belong to top/bottom), so they
    // legitimately stop well short of the cicn height.
    if (wRecipe != null) {
      if (wRecipe > raw.w + 1) NOTE(`recipe: top/bottom ends at ${wRecipe}, past cicn ${raw.w} (samples a transparent corner — benign)`);
      else if (draw.w - wRecipe > 2) WARN(`recipe: top/bottom ends at ${wRecipe} but frame art reaches ${draw.w} (${draw.w - wRecipe}px of width undrawn)`);
    }
    if (hRecipe != null && hRecipe > raw.h + 1)
      NOTE(`recipe: left/right ends at ${hRecipe}, past cicn ${raw.h} (samples a transparent corner — benign)`);

    // ── norecipe: a non-zero inset with no side-list draws nothing ──
    if (body) {
      const [l, t, r, b] = body;
      const insets = { top: t, left: l, right: draw.w - r, bottom: draw.h - b };
      for (const side of ['top', 'left', 'right', 'bottom']) {
        if (insets[side] > 1 && !(ed[side]?.length))
          NOTE(`norecipe: ${side} inset ${insets[side]}px but no ${side} recipe (edge not drawn — ok for collapsed/topless)`);
      }
    }

    const tag = out.some(([s]) => s === 'E') ? 'ERROR'
      : out.some(([s]) => s === 'W') ? 'warn'
      : out.length ? 'note' : 'ok';
    console.log(`  ${key.padEnd(32)} ${tag}`);
    for (const [s, m] of out) console.log(`      ${s === 'E' ? '✗' : s === 'W' ? '!' : '·'} ${m}`);
  }

  // ── control coverage: each control composer (src/controls.ts) resolves a
  // control by RESOURCE ID. If a scheme ships that control's art under a
  // DIFFERENT id than the composer looks up, the control silently falls back to
  // a procedural/CSS rendering even though the RASTER exists — the exact bug
  // behind the On/Off (composeTab looked up the never-shipped popup tab -12319
  // while schemes ship the -998x tab family) and the beos progress (-10223/4 vs
  // the -10080 family). Flag when a control's id FAMILY is present but the
  // composer's own ids are not. (Family absent = a genuine fallback, e.g.
  // apple-platinum-2 ships no checkbox/radio art — fine.)
  const cicnIds = new Set(
    Object.values(manifest.chromeElements || {})
      .map((e) => (typeof e.sourceCicnId === 'number' ? Math.abs(e.sourceCicnId) : null))
      .filter((n) => n != null),
  );
  const hasAny = (ids) => ids.some((id) => cicnIds.has(id));
  const inFamily = (fams) => [...cicnIds].some((id) => fams.some(([lo, hi]) => id >= lo && id <= hi));
  // control → { composer ids it loads (controls.ts), the id FAMILY meaning "art exists" }
  const CONTROLS = [
    { n: 'button',    ids: [10239, 10238, 10240],                              fam: [[10238, 10240]] },
    { n: 'checkbox',  ids: [9500, 9503, 9501, 9504],                           fam: [[9500, 9504]] },
    { n: 'radio',     ids: [9488, 9491, 9489, 9492],                           fam: [[9488, 9492]] },
    { n: 'slider',    ids: [10205, 10206, 10207, 10208],                       fam: [[10205, 10208]] },
    { n: 'scrollbar', ids: [8277, 8278, 8279, 8280, 8285, 8286, 8287, 8288],   fam: [[8277, 8288]] },
    { n: 'progress',  ids: [10075, 10076, 10077, 10078, 10079, 10080, 10223, 10224], fam: [[10075, 10080], [10223, 10224]] },
    { n: 'tab',       ids: [9972, 9975, 9980, 9983],                           fam: [[9969, 9984]] },
    { n: 'growbox',   ids: [14330, 14333, 14334],                             fam: [[14330, 14334]] },
  ];
  const cwarn = [];
  for (const c of CONTROLS) {
    if (inFamily(c.fam) && !hasAny(c.ids))
      cwarn.push(`control ${c.n}: ships art in its id family but composeX looks up [${c.ids.join(',')}] — none present → SILENT procedural fallback despite raster`);
  }
  if (cwarn.length) {
    warns += cwarn.length;
    console.log(`  ${'(control coverage)'.padEnd(32)} warn`);
    for (const m of cwarn) console.log(`      ! ${m}`);
  }
}

console.log(`\n-- linted ${wins} window(s): ${errors} error(s), ${warns} warning(s), ${notes} note(s) --`);
process.exit(errors ? 1 : 0);
