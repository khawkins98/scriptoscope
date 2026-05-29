#!/usr/bin/env node
// Static theme-data linter: checks each window type's wnd# + cicn against the
// STRUCTURAL ASSUMPTIONS the kDEF makes — WITHOUT rendering. The render-audit
// (audit-placement.mjs) verifies our output obeys our own part-code model; this
// linter verifies the INPUT DATA is shaped the way the kDEF expects, catching the
// data-shaped anomalies a render-audit is blind to (a glitch only becomes visible
// when a human looks at a render — these surface it the moment the theme builds).
//
// Usage:
//   node scripts/lint-themes.mjs                 # verify mode (the default)
//   node scripts/lint-themes.mjs --update        # re-lint every bundle and refresh themes/lint-baseline.json
//   node scripts/lint-themes.mjs --strict        # verify mode + exit 1 on any drift (CI-friendly)
//   node scripts/lint-themes.mjs <slug>          # single-theme full lint (skips the baseline entirely)
//
// Option A bundles ship only the original archive (scheme.sit / scheme.rsrc); the
// linter decodes each on the fly via loadKaleidoscopeScheme + holds the cicn rasters
// in memory. The themes/lint-baseline.json companion file records, per slug, the
// sha256 of the source archive + the lint outcome from the maintainer's last full
// run, so a fresh checkout or CI can confirm "lint was clean against THIS commit"
// without re-decoding 18 bundles.
//
// Each rule maps to a real bug class we hit reactively. The cited kDEF routines
// are the source of the assumption (see docs/spec/kdef-faithfulness-ledger.md
// and docs/spec/compositor-spec.md).
//
//   tail   — the cicn carries opaque art only up to col/row C, but the resource
//            is wider/taller. The kDEF blits with the mask and walks the recipe
//            over [0,lastBorder), so the slack past the art is NOT the window;
//            sizing an inset off the raw bounds inflates it. [beos document-window]
//   body   — part-0 (the content rect) must sit inside the drawable extent.
//   recipe — each side recipe should span the drawable art on its axis.
//   norecipe — a side with a non-zero inset but no recipe draws nothing.
//   title  — the title text centres on the scheme's title-text MARKER band.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

// PixelBuffer is only needed by the SLOW path (--update / single-slug mode that re-runs
// the full lint). Verify mode (the default) only computes sha256 of the source archive
// and reports the stored baseline — no decode needed. Lazy-import keeps verify mode
// runnable on a fresh checkout WITHOUT first having to `npm run build` to produce dist/.
let _PixelBuffer = null;
async function PixelBufferOnDemand() {
  if (_PixelBuffer) return _PixelBuffer;
  try {
    ({ PixelBuffer: _PixelBuffer } = await import('../dist/scriptoscope.js'));
  } catch (e) {
    console.error('✗ lint-themes (--update / single-slug mode): dist/scriptoscope.js not found.');
    console.error('  Run `npm run build` first to produce it. Default verify mode does not require dist/.');
    console.error(`  (underlying: ${e.message})`);
    process.exit(1);
  }
  return _PixelBuffer;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');
const baselinePath = resolve(themesRoot, 'lint-baseline.json');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const only = positional[0]; // single-theme mode skips the baseline entirely
const MODE_UPDATE = flags.has('--update');
const MODE_STRICT = flags.has('--strict');

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

/** Resolve the per-bundle source file (`scheme.sit` preferred; `scheme.rsrc` fallback)
 *  and its sha256 — the fingerprint that lets a verify-mode run trust a stored result. */
function sourceFingerprint(themeDir) {
  for (const name of ['scheme.sit', 'scheme.rsrc']) {
    const p = resolve(themeDir, name);
    if (!existsSync(p)) continue;
    const bytes = readFileSync(p);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return { source: name, bytes, sha256 };
  }
  return null;
}

/** Decode the bundle in-memory + return what the rules need: manifest, iconIndex,
 *  and a loadCicn(assetPath) helper that hands back a PixelBuffer wrapping the
 *  decoded RGBA — the same surface the on-disk loader exposed pre-Option-A. */
async function decodeBundle(slug, themeDir) {
  const fp = sourceFingerprint(themeDir);
  if (!fp) throw new Error(`no scheme.sit or scheme.rsrc in ${themeDir}`);
  const meta = existsSync(resolve(themeDir, 'meta.json'))
    ? JSON.parse(readFileSync(resolve(themeDir, 'meta.json'), 'utf8')) : {};
  const { manifest, assets, iconIndex } = await loadKaleidoscopeScheme(fp.bytes, {
    meta, source: `${slug}/${fp.source}`, encodeAssets: false,
  });
  const PixelBuffer = await PixelBufferOnDemand();
  const byPath = new Map(assets.map((a) => [a.path, a]));
  const loadCicn = (asset) => {
    const a = byPath.get(asset);
    if (!a) throw new Error(`asset not in decoded bundle: ${asset}`);
    return new PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba));
  };
  return { manifest, iconIndex, loadCicn, fingerprint: fp };
}

/** Single-bundle lint pass. Returns { status, errors, warnings, notes, lines } — `lines`
 *  is the console output for that bundle so the caller controls when to print it. */
async function lintBundle(slug) {
  const themeDir = resolve(themesRoot, slug);
  const { manifest, iconIndex, loadCicn, fingerprint } = await decodeBundle(slug, themeDir);
  // Compute a stable fingerprint of the DECODED manifest + iconIndex, so the baseline
  // catches decoder/rule regressions that change the output without changing the source
  // bytes (a `tools/theme-loader/convert.js` change is the canonical case). Asset paths
  // get blob: URLs at runtime but encodeAssets:false here keeps them as relative paths;
  // however a Set of asset PATHS would still drift under any decoder change that
  // renames/reorders cicns. Stringify with sorted keys to keep the hash deterministic.
  const decodedSha256 = createHash('sha256').update(stableJSON({
    manifest, iconIndex,
  })).digest('hex');
  const wts = manifest.windowTypes || {};
  const keys = Object.keys(wts).filter((k) => wts[k]?.chrome?.active);
  const lines = [];
  let errors = 0, warns = 0, notes = 0;
  if (!keys.length) {
    lines.push(`${slug}: (no chrome cicns — baseline/procedural)`);
    return { status: 'ok', errors: 0, warnings: 0, notes: 0, lines, fingerprint };
  }
  lines.push(`${slug}:`);

  for (const key of keys) {
    const wt = wts[key];

    // Corner-sprite windows render procedurally — sliced rules don't apply.
    if (wt.model === 'corner-sprite') {
      const out = [];
      const ERR = (m) => { out.push(['E', m]); errors++; };
      const NOTE2 = (m) => { out.push(['n', m]); notes++; };
      const checkSprite = (label, rel) => {
        if (!rel) return;
        try { loadCicn(rel); }
        catch (e) { ERR(`sprite ${label}: cannot load ${rel} (${e.message})`); }
      };
      const topInset = Array.isArray(wt.parts?.['part-0']?.rect) ? wt.parts['part-0'].rect[1] : 0;
      const titled = topInset > 1;
      const hasHeaderFill = !!manifest.headerColors?.active?.fill;
      if (titled && !wt.sprites?.pinstripe) {
        if (hasHeaderFill) NOTE2('corner-sprite: titled type uses solid headerColors fill (no striped sprite)');
        else ERR('corner-sprite: titled type missing sprites.pinstripe and no headerColors.active.fill fallback');
      }
      else if (!titled && !wt.sprites?.pinstripe) NOTE2('corner-sprite: title-less frame (no pinstripe — frame-only, expected)');
      checkSprite('pinstripe', wt.sprites?.pinstripe);
      checkSprite('growBox', wt.sprites?.growBox);
      checkSprite('chrome.active', wt.chrome?.active);
      if (!Array.isArray(wt.parts?.['part-0']?.rect)) ERR('corner-sprite: missing part-0 frame thicknesses');
      const tag = out.some(([s]) => s === 'E') ? 'ERROR' : out.length ? 'note' : 'ok';
      lines.push(`  ${key.padEnd(32)} ${tag}`);
      for (const [s, m] of out) lines.push(`      ${s === 'E' ? '✗' : '·'} ${m}`);
      continue;
    }

    let cicn;
    try { cicn = loadCicn(wt.chrome.active); }
    catch (e) { lines.push(`  ${key.padEnd(32)} LOAD FAIL ${e.message}`); errors++; continue; }
    const out = [];
    const ERR = (m) => { out.push(['E', m]); errors++; };
    const WARN = (m) => { out.push(['W', m]); warns++; };
    const NOTE = (m) => { out.push(['n', m]); notes++; };

    const raw = { w: cicn.width, h: cicn.height };
    const draw = drawableExtent(cicn);
    const ed = wt.edges || {};
    const wRecipe = Math.max(lastBorder(ed.top) ?? 0, lastBorder(ed.bottom) ?? 0) || null;
    const hRecipe = Math.max(lastBorder(ed.left) ?? 0, lastBorder(ed.right) ?? 0) || null;

    if (raw.w - draw.w > 1)
      NOTE(`tail: cicn ${raw.w}px wide, art ends at ${draw.w} (${raw.w - draw.w}px transparent tail — inset sized off the drawable extent)`);
    if (raw.h - draw.h > 1)
      NOTE(`tail: cicn ${raw.h}px tall, art ends at ${draw.h} (${raw.h - draw.h}px transparent tail)`);

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

    const sideTitled = key === 'side-floating-utility-window' || key === 'collapsed-side-utility'
      || (body != null && Array.isArray(body) && body[0] > body[1]);
    if (wRecipe != null) {
      if (wRecipe > raw.w + 1) NOTE(`recipe: top/bottom ends at ${wRecipe}, past cicn ${raw.w} (samples a transparent corner — benign)`);
      else if (draw.w - wRecipe > 2) {
        if (sideTitled) NOTE(`recipe: top/bottom ends at ${wRecipe} (body right edge); the ${draw.w - wRecipe}px tail is the side title strip — drawn by the LEFT recipe, not a bug`);
        else WARN(`recipe: top/bottom ends at ${wRecipe} but frame art reaches ${draw.w} (${draw.w - wRecipe}px of width undrawn)`);
      }
    }
    if (hRecipe != null && hRecipe > raw.h + 1)
      NOTE(`recipe: left/right ends at ${hRecipe}, past cicn ${raw.h} (samples a transparent corner — benign)`);

    if (body) {
      const [l, t, r, b] = body;
      const insets = { top: t, left: l, right: draw.w - r, bottom: draw.h - b };
      for (const side of ['top', 'left', 'right', 'bottom']) {
        if (insets[side] > 1 && !(ed[side]?.length))
          NOTE(`norecipe: ${side} inset ${insets[side]}px but no ${side} recipe (edge not drawn — ok for collapsed/topless)`);
      }
    }

    if (body && body[1] > 6 && !/utility|mini|floating|palette/.test(key)) {
      const barH = body[1];
      let marker = null;
      for (const [pk, p] of Object.entries(wt.parts || {})) {
        if (pk === 'part-0' || !Array.isArray(p.rect)) continue;
        const [pl, pt, pr, pb] = p.rect;
        if (pr <= pl || pb <= pt) continue;
        if (pt < barH && pr - pl <= 2) { marker = [pt, pb]; break; }
      }
      if (marker) {
        const midY = Math.min(barH - 1, (marker[0] + marker[1]) / 2);
        if (marker[1] > barH)
          NOTE(`title: marker band y[${marker[0]},${marker[1]}] runs past the ${barH}px bar → midY clamped to ${midY.toFixed(0)} (check it's the title line, not a stray thin part)`);
        else if (midY < barH * 0.2 || midY > barH * 0.8)
          NOTE(`title: marker midY ${midY.toFixed(1)} sits in the outer fifth of the ${barH}px bar (verify placement)`);
      } else if (key === 'document-window') {
        NOTE(`title: document-window ships no title marker → title centres geometrically (verify on a tall/ornate bar)`);
      }
    }

    const tag = out.some(([s]) => s === 'E') ? 'ERROR'
      : out.some(([s]) => s === 'W') ? 'warn'
      : out.length ? 'note' : 'ok';
    lines.push(`  ${key.padEnd(32)} ${tag}`);
    for (const [s, m] of out) lines.push(`      ${s === 'E' ? '✗' : s === 'W' ? '!' : '·'} ${m}`);
  }

  // ── control coverage ────────────────────────────────────────────────────
  const cicnIds = new Set(
    Object.values(manifest.chromeElements || {})
      .map((e) => (typeof e.sourceCicnId === 'number' ? Math.abs(e.sourceCicnId) : null))
      .filter((n) => n != null),
  );
  const hasAny = (ids) => ids.some((id) => cicnIds.has(id));
  const inFamily = (fams) => [...cicnIds].some((id) => fams.some(([lo, hi]) => id >= lo && id <= hi));
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
    lines.push(`  ${'(control coverage)'.padEnd(32)} warn`);
    for (const m of cwarn) lines.push(`      ! ${m}`);
  }

  // ── glyph orphans (iconIndex from the in-memory decode) ────────────────
  const GLYPH_FAMILIES = [
    [-10208, -10197, 'scroll/slider-arrow'],
    [-10224, -10214, 'radio'],
    [-10240, -10229, 'checkbox'],
    [-14336, -14331, 'doc-widget'],
    [-14320, -14315, 'util-widget'],
  ];
  if (iconIndex?.length) {
    const counts = {};
    const unmapped = [];
    for (const i of iconIndex) {
      if (i.size !== 16) continue;
      const fam = GLYPH_FAMILIES.find(([lo, hi]) => i.id >= lo && i.id <= hi);
      if (fam) { counts[fam[2]] = (counts[fam[2]] || 0) + 1; continue; }
      if (i.id <= -10197 && i.id >= -14336) unmapped.push(`${i.type} ${i.id} (${i.file})`);
    }
    const covered = GLYPH_FAMILIES.map(([, , l]) => l).filter((l) => counts[l]);
    if (covered.length) {
      lines.push(`  ${'(glyph families wired)'.padEnd(32)} ${covered.map((l) => `${l}:${counts[l]}`).join(' · ')}`);
    }
    if (unmapped.length) {
      notes += unmapped.length;
      lines.push(`  ${'(unmapped control glyphs)'.padEnd(32)} note`);
      for (const m of unmapped) lines.push(`      · ${m} — in the control id-span but no wired family`);
    }
  }

  const status = errors ? 'error' : warns ? 'warn' : 'ok';
  return { status, errors, warnings: warns, notes, lines, fingerprint, decodedSha256 };
}

/** JSON.stringify with object keys sorted at every level — gives a deterministic byte
 *  stream from the manifest so its sha256 doesn't flap on insertion-order changes. */
function stableJSON(value) {
  const replace = (v) => {
    if (Array.isArray(v)) return v.map(replace);
    if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = replace(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(replace(value));
}

// ── main ────────────────────────────────────────────────────────────────
const allSlugs = readdirSync(themesRoot).filter((s) =>
  existsSync(resolve(themesRoot, s, 'scheme.sit')) || existsSync(resolve(themesRoot, s, 'scheme.rsrc')),
);
const slugs = only ? [only] : allSlugs;

if (only) {
  // Single-theme mode — full lint, no baseline touch.
  let errors = 0, warns = 0, notes = 0;
  for (const slug of slugs) {
    const r = await lintBundle(slug);
    for (const line of r.lines) console.log(line);
    errors += r.errors; warns += r.warnings; notes += r.notes;
  }
  console.log(`\n-- linted ${slugs.length} bundle(s): ${errors} error(s), ${warns} warning(s), ${notes} note(s) --`);
  process.exit(errors ? 1 : 0);
} else if (MODE_UPDATE) {
  // Update mode — re-lint every bundle, write the baseline.
  const out = {
    _generator: 'scripts/lint-themes.mjs --update',
    _note: 'Fingerprint baseline for `npm run lint:themes`: sha256 of each bundle\'s source archive + the lint outcome from the maintainer\'s last full run. Default `npm run lint:themes` is a fast verify pass (hash + report stored result); the slow decode-and-rule-walk only runs on `--update` or when the hash drifts. Keep this file in git; let CI run `--strict` to fail on drift.',
    ranAt: new Date().toISOString(),
    themes: {},
  };
  let errors = 0, warns = 0, notes = 0;
  for (const slug of slugs) {
    const r = await lintBundle(slug);
    for (const line of r.lines) console.log(line);
    errors += r.errors; warns += r.warnings; notes += r.notes;
    out.themes[slug] = {
      source: r.fingerprint.source,
      sha256: r.fingerprint.sha256,
      decodedSha256: r.decodedSha256,
      status: r.status,
      errors: r.errors,
      warnings: r.warnings,
      notes: r.notes,
    };
  }
  writeFileSync(baselinePath, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n-- linted ${slugs.length} bundle(s): ${errors} error(s), ${warns} warning(s), ${notes} note(s) --`);
  console.log(`-- wrote ${baselinePath.replace(repoRoot + '/', '')} --`);
  process.exit(errors ? 1 : 0);
} else {
  // Default (verify) mode — read the baseline, hash each source, report drift.
  // Strict mode (--strict) is the same flow but exits 1 on any mismatch.
  if (!existsSync(baselinePath)) {
    console.error(`✗ no baseline at ${baselinePath.replace(repoRoot + '/', '')} — run \`npm run lint:themes -- --update\` first`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const baselineThemes = baseline.themes ?? {};
  let drift = 0, missing = 0, extra = 0, decoderDrift = 0;
  const baselineSlugs = Object.keys(baselineThemes);
  const liveSlugs = new Set(slugs);
  // Decoded-fingerprint check (re-decodes every bundle, recomputes the manifest
  // hash, compares against the stored decodedSha256) catches `tools/theme-loader/
  // convert.js` regressions that don't change source bytes. Opt in via --decoded;
  // --strict implies it. Default mode trusts the source hash only (no dist/
  // required — keeps the "lint works on fresh checkout" property).
  const recheckDecoded = MODE_STRICT || flags.has('--decoded');
  console.log(`-- verify against ${baselinePath.replace(repoRoot + '/', '')} (ranAt ${baseline.ranAt ?? '?'}${recheckDecoded ? ', re-decode' : ''}) --`);
  for (const slug of slugs) {
    const themeDir = resolve(themesRoot, slug);
    const fp = sourceFingerprint(themeDir);
    if (!fp) { console.log(`  ${slug.padEnd(28)} ✗ no source archive`); drift++; continue; }
    const stored = baselineThemes[slug];
    if (!stored) {
      console.log(`  ${slug.padEnd(28)} + NEW bundle (no baseline entry) — run --update`);
      extra++; continue;
    }
    if (stored.sha256 !== fp.sha256) {
      console.log(`  ${slug.padEnd(28)} ✗ DRIFT (source sha256: ${stored.sha256.slice(0, 12)} → ${fp.sha256.slice(0, 12)}) — re-lint via --update`);
      drift++; continue;
    }
    // Decoder-output check (slow). Recomputes the manifest hash against what the live
    // decoder produces from the same source bytes. Catches decoder/rule regressions
    // that ship green when only the SOURCE hash is checked — the parity-gate hole the
    // retired convert.test.mjs deepEqual test used to plug.
    if (recheckDecoded && stored.decodedSha256) {
      try {
        const r = await lintBundle(slug);
        if (r.decodedSha256 !== stored.decodedSha256) {
          console.log(`  ${slug.padEnd(28)} ✗ DECODER DRIFT (manifest sha256: ${stored.decodedSha256.slice(0, 12)} → ${r.decodedSha256.slice(0, 12)}) — decoder produced different output from the SAME source bytes; re-lint via --update`);
          decoderDrift++; continue;
        }
      } catch (e) {
        console.log(`  ${slug.padEnd(28)} ✗ DECODE FAILED (${e.message}) — re-lint via --update`);
        drift++; continue;
      }
    }
    const counts = `${stored.errors}E ${stored.warnings}W ${stored.notes}N`;
    const decBadge = stored.decodedSha256 ? ` · dec:${stored.decodedSha256.slice(0, 8)}` : '';
    console.log(`  ${slug.padEnd(28)} ${stored.status.padEnd(5)} ${counts}  · via ${stored.source} src:${stored.sha256.slice(0, 8)}${decBadge}`);
  }
  for (const slug of baselineSlugs) {
    if (!liveSlugs.has(slug)) {
      console.log(`  ${slug.padEnd(28)} - REMOVED bundle (baseline entry orphaned) — run --update`);
      missing++;
    }
  }
  const exitNonZero = MODE_STRICT && (drift || missing || extra || decoderDrift);
  const driftBadge = decoderDrift ? `, decoder-drift=${decoderDrift}` : '';
  console.log(`\n-- verify: ${slugs.length} bundle(s), drift=${drift}, new=${extra}, removed=${missing}${driftBadge}${MODE_STRICT ? ' (strict, re-decoded)' : ''} --`);
  if (exitNonZero) process.exit(1);
  if (drift || extra || decoderDrift) console.log('   (run `npm run lint:themes -- --update` to refresh the baseline)');
  process.exit(0);
}
