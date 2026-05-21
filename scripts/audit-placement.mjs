#!/usr/bin/env node
// Placement audit: render every theme's window types headlessly and check the
// slice placement against invariants the kDEF model implies. Flags likely
// mis-renders in ABSOLUTE terms (theme · window · edge · slice) so we don't
// have to eyeball screenshots to find regressions.
//
// Usage:  npm run build  &&  node scripts/audit-placement.mjs [slug]
//
// Checks per window:
//   coverage   — each edge's output rects tile it with no internal gaps
//   code→mode  — code 0 stays fixed (corner); 18 is gradient; widget refs
//                (1–4) stay fixed (stretching them smears the baked widget)
//   widgets    — every top rectList widget is stamped or sits in a fixed seg
//   mega-tile  — no slice tiled an implausible number of times (mis-classified)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeWindowChrome } from '../dist/aaron-ui.js';
import { loadCicn, resolveWindow } from './diag-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');

const only = process.argv[2];
const slugs = (only ? [only] : readdirSync(themesRoot)).filter((s) => existsSync(resolve(themesRoot, s, 'theme.json')));

let totalWarn = 0, totalWin = 0;

for (const slug of slugs) {
  const themeDir = resolve(themesRoot, slug);
  const manifest = JSON.parse(readFileSync(resolve(themeDir, 'theme.json'), 'utf8'));
  const wts = manifest.windowTypes || {};
  // every window type that ships a renderable active chrome + a top recipe
  const keys = Object.keys(wts).filter((k) => wts[k]?.chrome?.active && wts[k]?.edges?.top?.length && !/collapsed/.test(k));
  if (!keys.length) { console.log(`\n${slug}: (no recipe-based window types — baseline/procedural)`); continue; }
  console.log(`\n${slug}:`);
  for (const key of keys) {
    const { wt } = resolveWindow(manifest, key);
    let cicn;
    try { cicn = loadCicn(themeDir, wt.chrome.active); } catch (e) { console.log(`  ${key}: LOAD FAIL ${e.message}`); totalWarn++; continue; }
    // a representative resize: ~2× the cicn body, with a title plate.
    const composed = composeWindowChrome(cicn, wt, Math.max(120, cicn.width + 80), Math.max(60, cicn.height + 40), { titlePlateWidth: 44 });
    totalWin++;
    const warns = [];
    const P = composed.placement;

    // ── code → mode invariants ──
    for (const s of P) {
      if (s.edge === 'widget') continue;
      if (s.code === 0 && s.mode !== 'fixed') warns.push(`${s.edge} p0 corner rendered '${s.mode}' (expected fixed)`);
      if (s.code === 18 && s.mode !== 'gradient') warns.push(`${s.edge} p18 gradient rendered '${s.mode}'`);
      if (s.code >= 1 && s.code <= 4 && (s.mode === 'tile' || s.mode === 'stretch' || s.mode === 'gradient'))
        warns.push(`${s.edge} p${s.code} widget-ref rendered '${s.mode}' (would smear the baked widget)`);
      if (s.mode === 'tile' && s.rects.length > 30) warns.push(`${s.edge} p${s.code} tiled ×${s.rects.length} (implausible — mis-classified widget/motif?)`);
    }

    // ── coverage: each horizontal edge's output rects tile [minX, fullW] ──
    const coverGap = (edge, span, axis) => {
      const rs = P.filter((s) => s.edge === edge).flatMap((s) => s.rects);
      if (!rs.length) return;
      const iv = rs.map((r) => axis === 'x' ? [r.x, r.x + r.w] : [r.y, r.y + r.h]).sort((a, b) => a[0] - b[0]);
      let cursor = iv[0][0];
      for (const [a, b] of iv) {
        if (a - cursor > 1) warns.push(`${edge} coverage gap ${cursor}→${a}px`);
        cursor = Math.max(cursor, b);
      }
      if (span - cursor > 1) warns.push(`${edge} coverage stops at ${cursor} of ${span}px`);
    };
    // top/bottom span the full width (corners included); left/right fill only
    // BETWEEN the top and bottom frames (corners belong to top/bottom).
    coverGap('top', composed.fullWidth, 'x');
    coverGap('bottom', composed.fullWidth, 'x');
    coverGap('left', composed.fullHeight - composed.frame.bottom, 'y');
    coverGap('right', composed.fullHeight - composed.frame.bottom, 'y');

    // ── widgets: each top rectList widget stamped, or in a fixed segment ──
    const stampSrcs = new Set(P.filter((s) => s.edge === 'widget').map((s) => `${s.src.x},${s.src.y}`));
    for (const [k, part] of Object.entries(wt.parts)) {
      if (k === 'part-0' || !part.rect) continue;
      const [l, t, r, b] = part.rect;
      if (t >= composed.frame.top || r <= l) continue; // not a top widget
      const stamped = stampSrcs.has(`${l},${t}`);
      const inFixed = P.some((s) => s.edge === 'top' && s.mode === 'fixed' && l >= s.src.x && r <= s.src.x + s.src.w);
      if (!stamped && !inFixed) warns.push(`top widget ${k} [${l},${t} ${r - l}×${b - t}] neither stamped nor in a fixed segment (smear risk)`);
    }

    const status = warns.length ? `WARN ×${warns.length}` : 'ok';
    console.log(`  ${key.padEnd(34)} ${composed.placement.length} slices  ${status}`);
    for (const w of warns) console.log(`      ⚠ ${w}`);
    totalWarn += warns.length;
  }
}

console.log(`\n── audited ${totalWin} window(s); ${totalWarn} warning(s) ──`);
process.exit(totalWarn ? 1 : 0);
