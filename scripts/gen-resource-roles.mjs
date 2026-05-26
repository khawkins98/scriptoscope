#!/usr/bin/env node
// Write a per-theme `resource-roles.json`: every shipped resource id → its DECODED
// role, so the renderer (and humans) don't re-guess a resource's purpose from its
// filename slug. The recurring trap this closes: the SAME id means different things
// across schemes (e.g. -10078 = "french-blue" hue in apple-platinum-2 but the
// "track-active" role in 1990) AND across the cicn/ics4 dual channel (e.g. -10239
// cicn = push-button face, -10239 ics4 = checkbox glyph). Inferring roles from one
// scheme's slugs on a SUBSET of ids is how the progress bar got modelled wrong three
// times — so this makes the id→role mapping DATA, derived from a rubric + the
// scheme's actual resource set.
//
// Output per theme:
//   { theme, progress:{…resolved model…}, scrollArrows:{…}, resources:[ {id,type,slug,family,role} … ] }
// The `progress` + `scrollArrows` summaries resolve the per-scheme model (the two
// families that historically bit us); `resources` is the full classified list.
//
// Deterministic (sorted, no timestamp). Run in build:themes so every import regen's it.
// Usage:  node scripts/gen-resource-roles.mjs [slug]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');
const only = process.argv[2];
const slugs = (only ? [only] : readdirSync(themesRoot)).filter((s) =>
  existsSync(resolve(themesRoot, s, 'theme.json')),
);

const listPng = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []);
const num = (sign, digits) => (sign === 'n' ? -1 : 1) * Number(digits);

/** Classify a resource by id + channel (cicn body vs ics4/ics8 pictogram). The same
 *  id has DIFFERENT roles per channel — the dual-channel pattern — so type matters.
 *  Ranges from docs/spec/kdef231-reference.md §2.4 + the progress/scroll-arrow decodes. */
function classify(id, type, slug) {
  const a = Math.abs(id);
  const s = slug || '';
  const isIcon = type === 'ics4' || type === 'ics8' || type === 'icl4' || type === 'icl8';

  if (isIcon) {
    // PICTOGRAM channel (ics4/ics8 = 16px, icl4/icl8 = 32px)
    if (a >= 10197 && a <= 10204) {
      const dir = { 10197: 'right', 10198: 'left', 10199: 'down', 10200: 'up', 10201: 'right', 10202: 'left', 10203: 'down', 10204: 'up' }[a];
      return { family: 'scroll-arrow', role: `scroll arrow ${dir} (${a <= 10200 ? 'PRESSED' : 'RAISED'})` };
    }
    if (a >= 10205 && a <= 10208) return { family: 'slider', role: 'slider thumb pictogram (h/v × normal/pressed)' };
    if (a >= 10229 && a <= 10240) return { family: 'checkbox', role: 'checkbox glyph (empty/check/dash/x × states)' };
    if (a >= 10214 && a <= 10228) return { family: 'radio', role: 'radio glyph (off/on/mixed × states)' };
    if ((a >= 14331 && a <= 14336) || (a >= 14315 && a <= 14320)) return { family: 'window-widget', role: 'title-bar widget pictogram (close/zoom/collapse × active/pressed)' };
    if (a >= 10102 && a <= 10112) return { family: 'disclosure', role: 'disclosure triangle (right/down × states)' };
    if (a >= 3800 && a <= 20800) return { family: 'finder-icon', role: s ? `Finder/system icon (${s})` : 'Apple Icon Services Finder/system icon' };
    return { family: 'pictogram', role: s ? `pictogram (${s})` : 'pictogram (unclassified)' };
  }

  // BODY (cicn) channel
  if ((a >= 10071 && a <= 10080) || (a >= 10220 && a <= 10224)) {
    if (a === 10224) return { family: 'progress', role: 'progress TRACK (empty trough)' };
    if (a === 10223) return { family: 'progress', role: 'progress FILL — lavender (canonical default)' };
    if (/frame/.test(s)) return { family: 'progress', role: `progress FRAME${/inactive/.test(s) ? ' (inactive)' : ''}` };
    if (/track/.test(s)) return { family: 'progress', role: `progress TRACK${/inactive/.test(s) ? ' (inactive)' : ''}` };
    if (/full|fill|section/.test(s)) return { family: 'progress', role: `progress FILL${/inactive/.test(s) ? ' (inactive)' : ''}` };
    return { family: 'progress', role: `progress FILL hue (${s || 'alt'})` };
  }
  if (a >= 8277 && a <= 8288) return { family: 'scrollbar', role: 'scrollbar track cicn (h/v × active/inactive/disabled/pressed)' };
  if (a >= 10197 && a <= 10208) return { family: 'scroll-arrow', role: 'scroll/slider arrow button FACE (cicn body; dual-channel with the same-id ics4 arrow pictogram)' };
  if (a === 10230 || a === 10231 || a === 10232) return { family: 'button', role: 'default-button ring (active/inactive/mixed)' };
  if (a >= 10238 && a <= 10240) return { family: 'button', role: 'push-button face (normal/pressed/disabled)' };
  if (a >= 10162 && a <= 10176) return { family: 'bevel-button', role: 'bevel-button face' };
  if (a >= 10113 && a <= 10132) return { family: 'slider', role: 'slider track/thumb cicn' };
  if (a === 9567 || a === 9568) return { family: 'list-header', role: 'Finder list-column header' };
  if (a >= 14301 && a <= 14336) return { family: 'window', role: s ? `window chrome (${s})` : 'window frame proxy / grow box / racing-stripe / widget cicn' };
  if (a >= 9548 && a <= 9984) return { family: 'window-info', role: s ? `cinf / window metadata (${s})` : 'cinf / window metadata' };
  if (a >= 12303 && a <= 12320) return { family: 'popup-menu', role: 'popup-menu / tab frame' };
  // (Finder/system icons live in the ics/icl channel, not cicn — so unmatched cicns
  // are control/chrome bodies, NOT Finder icons.)
  return { family: 'other', role: s ? `cicn body (${s})` : 'unclassified cicn body' };
}

/** Resolve the per-scheme PROGRESS model from the set of cicn ids present. */
function progressSummary(cicnIds, cicnSlug) {
  const has = (id) => cicnIds.has(id);
  if (has(-10223)) {
    const hues = [...cicnIds].filter((id) => ((Math.abs(id) >= 10071 && Math.abs(id) <= 10080) || (Math.abs(id) >= 10220 && Math.abs(id) <= 10222)) && /french-blue|copper|aquamarine|teal|rose|plum|olive|nutmeg|lime|ivy|turquoise|emerald|gold/.test(cicnSlug.get(id) || '')).sort((x, y) => x - y);
    return { model: 'lavender-2-part', fill: -10223, track: has(-10224) ? -10224 : null, frame: null, alternateHues: hues };
  }
  if (has(-10080) || has(-10079) || has(-10078)) {
    return {
      model: 'role-3-part',
      frame: has(-10080) ? -10080 : null,
      fill: has(-10079) ? -10079 : null,
      track: has(-10078) ? -10078 : null,
      inactive: { frame: has(-10077) ? -10077 : null, fill: has(-10076) ? -10076 : null, track: has(-10075) ? -10075 : null },
    };
  }
  return { model: 'none' };
}

/** Resolve the SCROLL-ARROW model (universal kDEF mapping) for arrows the scheme ships. */
function scrollArrowSummary(iconIds) {
  const present = [...iconIds].filter((id) => Math.abs(id) >= 10197 && Math.abs(id) <= 10204);
  if (!present.length) return null;
  const pick = (id) => (iconIds.has(id) ? id : null);
  return {
    note: 'UNIVERSAL kDEF231 CDEF mapping (asm 9f0e-9f38) — RAISED is the resting/default state',
    raised: { right: pick(-10201), left: pick(-10202), down: pick(-10203), up: pick(-10204) },
    pressed: { right: pick(-10197), left: pick(-10198), down: pick(-10199), up: pick(-10200) },
  };
}

let total = 0;
for (const slug of slugs) {
  const dir = resolve(themesRoot, slug);
  const resources = [];
  const cicnIds = new Set();
  const cicnSlug = new Map();
  const iconIds = new Set();

  for (const f of listPng(resolve(dir, 'cicns'))) {
    const m = /^cicn-([np])(\d+)(?:-(.*))?\.png$/.exec(f);
    if (!m) continue;
    const id = num(m[1], m[2]); const sl = m[3] || null;
    cicnIds.add(id); if (sl) cicnSlug.set(id, sl);
    const { family, role } = classify(id, 'cicn', sl);
    resources.push({ id, type: 'cicn', slug: sl, family, role });
  }

  const iconIndex = resolve(dir, 'icons', 'index.json');
  if (existsSync(iconIndex)) {
    let idx = [];
    try { idx = JSON.parse(readFileSync(iconIndex, 'utf8')); } catch { /* ignore */ }
    for (const e of idx) {
      if (typeof e.id !== 'number') continue;
      iconIds.add(e.id);
      const { family, role } = classify(e.id, e.type || 'ics4', e.name ? String(e.name).trim() : null);
      resources.push({ id: e.id, type: e.type || 'ics4', size: e.size, slug: e.name ? String(e.name).trim() : null, family, role });
    }
  }

  for (const f of listPng(resolve(dir, 'ppats'))) {
    const m = /^ppat-(.+)\.png$/.exec(f);
    const label = m ? m[1] : f.replace(/\.png$/, '');
    resources.push({ id: null, type: 'ppat', slug: label, family: 'pattern', role: /1006[0-9]|spinner|barber/.test(label) ? 'pattern (possible spinner/indeterminate-progress)' : 'fill pattern (ppat)' });
  }

  if (!resources.length) continue;
  resources.sort((x, y) => (x.type < y.type ? -1 : x.type > y.type ? 1 : (x.id ?? 0) - (y.id ?? 0)));

  const out = {
    _generator: 'scripts/gen-resource-roles.mjs',
    _note: 'Per-theme resource id → DECODED role. Roles come from a rubric + the actual resource set, NOT guessed from filename slugs. The same id differs across schemes and across the cicn/ics4 dual channel. See docs/spec/kdef231-reference.md.',
    theme: slug,
    progress: progressSummary(cicnIds, cicnSlug),
    scrollArrows: scrollArrowSummary(iconIds),
    resources,
  };
  writeFileSync(resolve(dir, 'resource-roles.json'), JSON.stringify(out, null, 1) + '\n');
  total++;
  console.log(`  ${slug.padEnd(28)} ${resources.length} resources · progress=${out.progress.model} · arrows=${out.scrollArrows ? 'yes' : 'no'}`);
}
console.log(`\n-- wrote resource-roles.json for ${total} theme(s) --`);
