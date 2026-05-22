#!/usr/bin/env node
// Placement audit: render every theme's window types headlessly and check the
// slice placement against the PART-CODE model invariants (compositor-spec.md).
// Flags likely mis-renders in ABSOLUTE terms (theme · window · edge · slice) so
// regressions surface without eyeballing screenshots.
//
// Usage:  npm run build  &&  node scripts/audit-placement.mjs [slug]
//
// Invariants (the part-code model — NOT the old uniformity model):
//   coverage   — each edge's output rects tile it with no internal gaps and
//                reach the full extent (top/bottom = full width; left/right =
//                full height between the top and bottom frames).
//   code→mode  — every cell's render mode matches its part-code class:
//                  fixed codes (1,5,6,7,9,10,default + gated-off widgets) ⇒
//                    fixed/collapse (drawn 1:1, never stretched/tiled)
//                  stretch codes (0,8,11,13,14 + gated-on widget cells) ⇒
//                    stretch (or tile, only when cinf.tileSides=1)
//                  code 12 ⇒ tile;  code 18 ⇒ scale
//   widgets    — every rect-list widget is STAMPED (carved out of its fill
//                cell) or sits in a fixed cell — never tiled (which would
//                duplicate the baked widget art).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeWindowChrome } from '../dist/aaron-ui.js';
import { loadCicn, resolveWindow } from './diag-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');

const only = process.argv[2];
const slugs = (only ? [only] : readdirSync(themesRoot)).filter((s) => existsSync(resolve(themesRoot, s, 'theme.json')));

// Part-code → expected render-mode family (the spec classification table).
// `present` = the named widget is present (corpus is always so). Returns the
// set of modes that are VALID for this code; an actual mode outside it warns.
function expectedModes(code, present = true) {
  switch (code) {
    case 0: case 8: case 11: case 13: case 14:
      return new Set(['stretch', 'tile', 'fixed']); // stretch (tile if cinf); corner-split end ⇒ fixed
    case 12:
      return new Set(['tile', 'fixed']);
    case 18:
      return new Set(['scale', 'fixed']);
    case 5: case 6:
      return new Set(['collapse', 'fixed']);
    case 2: case 3: case 4:
      return present ? new Set(['fixed']) : new Set(['stretch', 'tile', 'fixed']);
    case 15: case 16: case 17:
      return present ? new Set(['stretch', 'tile', 'fixed']) : new Set(['fixed']);
    default:
      return new Set(['fixed', 'collapse']); // 1, 7, 9, 10, unknown
  }
}

let totalWarn = 0, totalWin = 0;

for (const slug of slugs) {
  const themeDir = resolve(themesRoot, slug);
  const manifest = JSON.parse(readFileSync(resolve(themeDir, 'theme.json'), 'utf8'));
  const wts = manifest.windowTypes || {};
  const keys = Object.keys(wts).filter((k) => wts[k]?.chrome?.active && wts[k]?.edges?.top?.length && !/collapsed/.test(k));
  if (!keys.length) { console.log(`\n${slug}: (no recipe-based window types — baseline/procedural)`); continue; }
  console.log(`\n${slug}:`);
  for (const key of keys) {
    const { wt } = resolveWindow(manifest, key);
    let cicn;
    try { cicn = loadCicn(themeDir, wt.chrome.active); } catch (e) { console.log(`  ${key}: LOAD FAIL ${e.message}`); totalWarn++; continue; }
    // A representative resize: comfortably larger than the cicn template on
    // BOTH axes so every stretch cell actually grows (and the corners never
    // dominate the budget — that only happens at sub-template sizes the kDEF
    // would itself collapse). Matches the diag default (w240 h160-ish).
    const composed = composeWindowChrome(cicn, wt, Math.max(240, cicn.width + 120), Math.max(160, cicn.height + 80), { cinf: wt.cinf ?? null });
    totalWin++;
    const warns = [];
    const P = composed.placement;

    // ── code → mode invariants ──
    for (const s of P) {
      if (s.edge === 'widget') continue;
      const ok = expectedModes(s.code);
      if (!ok.has(s.mode)) warns.push(`${s.edge} p${s.code} (${s.role}) rendered '${s.mode}' (expected one of ${[...ok].join('/')})`);
      // A baked rect-list widget must never be TILED (it would duplicate the art).
    }

    // ── coverage: each edge's output rects span the edge with no gaps ──
    const coverGap = (edge, span, axis, start) => {
      const rs = P.filter((s) => s.edge === edge).flatMap((s) => s.rects);
      if (!rs.length) return;
      const iv = rs.map((r) => axis === 'x' ? [r.x, r.x + r.w] : [r.y, r.y + r.h]).sort((a, b) => a[0] - b[0]);
      let cursor = Math.min(start, iv[0][0]);
      for (const [a, b] of iv) {
        if (a - cursor > 1) warns.push(`${edge} coverage gap ${cursor}→${a}px`);
        cursor = Math.max(cursor, b);
      }
      if (span - cursor > 1) warns.push(`${edge} coverage stops at ${cursor} of ${span}px`);
    };
    coverGap('top', composed.fullWidth, 'x', 0);
    coverGap('bottom', composed.fullWidth, 'x', 0);
    coverGap('left', composed.fullHeight - composed.frame.bottom, 'y', composed.frame.top);
    coverGap('right', composed.fullHeight - composed.frame.bottom, 'y', composed.frame.top);

    // ── widgets: each rect-list widget is stamped or in a fixed cell, never tiled ──
    const stampSrcs = new Set(P.filter((s) => s.edge === 'widget').map((s) => `${s.src.x},${s.src.y}`));
    for (const [k, part] of Object.entries(wt.parts)) {
      if (k === 'part-0' || !part.rect) continue;
      const [l, t, r, b] = part.rect;
      if (r <= l || b <= t) continue; // empty rect
      const isTopBand = t < composed.frame.top && r > l;
      if (!isTopBand) continue; // audit the top widgets (the carving hot-spot)
      if (r - l <= 2) continue; // ≤2px = title text-colour MARKER, not a widget
      const stamped = stampSrcs.has(`${l},${t}`);
      const inFixed = P.some((s) => (s.edge === 'top') && (s.mode === 'fixed' || s.mode === 'collapse') && l >= s.src.x && r <= s.src.x + s.src.w);
      if (!stamped && !inFixed) warns.push(`top widget ${k} [${l},${t} ${r - l}×${b - t}] neither stamped nor in a fixed cell (carve/smear risk)`);
    }

    const status = warns.length ? `WARN ×${warns.length}` : 'ok';
    console.log(`  ${key.padEnd(34)} ${composed.placement.length} slices  ${status}`);
    for (const w of warns) console.log(`      ! ${w}`);
    totalWarn += warns.length;
  }
}

console.log(`\n-- audited ${totalWin} window(s); ${totalWarn} warning(s) --`);
process.exit(totalWarn ? 1 : 0);
