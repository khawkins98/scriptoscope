#!/usr/bin/env node
// scripts/scene-coverage-audit.mjs
//
// The Scene codex: for each Scene slot the demo composes, walk the manifest and
// record which TIER of the lookup hierarchy resolved per theme. Plus a "shipped
// but unused" pass — resources the scheme ships that the Scene currently ignores —
// and a "multi-flavor" pass that flags resource families with variants the demo
// could expose (1990's 10 progress hues, monkey-paradise's 5 numbered ppats,
// per-state header colour pairs, etc).
//
// Output formats:
//   default       → markdown table to stdout (skim it)
//   --write       → writes docs/scene-codex.md (the committed codex)
//   --json        → JSON to stdout (for tooling)
//   --check       → exits non-zero if any slot drops to its hard fallback
//                   (CI signal — useful once we've raised every slot off the floor)
//   --theme=<slug>  filter to one theme
//
// The slot definitions live next to the demo's resolution code in spirit; the
// HUMAN contract for each slot (why this hierarchy?) is in
// docs/scene-slot-spec.md. Keep both in sync — if you add a tier here, document
// it there too.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');

const flags = new Set(process.argv.filter((a) => a.startsWith('--')));
const themeArg = process.argv.find((a) => a.startsWith('--theme='))?.slice('--theme='.length);

// ── slot definitions ──────────────────────────────────────────────────────
// Each slot has a list of tiers; the resolver walks them in order and returns
// the first that hits. The Scene's actual demo code in demo/index.html follows
// the SAME order — keep these in sync (if you add a tier in one place, mirror it).
// `terminalIsAcceptable: true` flags slots whose last tier is a legitimate
// answer (white body bg, checkerboard desk) rather than a regression-candidate
// fallback. --check only flags slots where terminalIsAcceptable=false AND the
// theme landed at the last tier.
const SLOTS = [
  {
    key: 'info-bar-bg',
    label: 'Info-bar background',
    where: 'demo/index.html buildScene',
    terminalIsAcceptable: false,
    tiers: [
      {
        name: 'cinf bgPattern',
        why: 'finder-header cinf -9567 carries the scheme-author-declared bgPatternId',
        resolve: (m) => {
          const ce = Object.values(m.chromeElements ?? {}).find((v) => v.sourceCicnId === -9567);
          if (!ce?.bgPattern) return null;
          const asset = m.patterns?.[ce.bgPattern]?.asset;
          return asset ? `patterns['${ce.bgPattern}'] → ${asset}` : null;
        },
      },
      {
        name: 'bodyBackground',
        why: 'cinf -9551 (Icon View) bgPatternId — the body texture, used as a substitute',
        resolve: (m) => m.bodyBackground?.pattern ? `bodyBackground.pattern → ${m.bodyBackground.pattern}` : null,
      },
      {
        name: 'headerFill',
        why: 'solid colour from the active title-bar fill — for schemes shipping no ppat',
        resolve: (m) => m.headerColors?.active?.fill ? `headerColors.active.fill → ${m.headerColors.active.fill}` : null,
      },
      { name: 'flat #e6e6e6', why: 'hard fallback', resolve: () => 'flat #e6e6e6' },
    ],
  },
  {
    key: 'volume-icon',
    label: 'Volume icon (info-bar leading slot)',
    where: 'demo/index.html gridProxyIcon',
    terminalIsAcceptable: false,
    tiers: [
      {
        name: 'ics4/8 -3790',
        why: 'Mac OS volume info icon — the canonical Finder slot for this position',
        resolve: (_m, ii) => ii.find((e) => e.id === -3790 && e.size === 16) ? 'ics -3790' : null,
      },
      {
        name: 'ics4/8 -14336',
        why: 'document-window collapse widget — schemes that don\'t theme -3790 typically draw their mark here',
        resolve: (_m, ii) => ii.find((e) => e.id === -14336 && e.size === 16) ? 'ics -14336' : null,
      },
      { name: 'FINDER_GRID_PNG', why: 'sliced from the reference screenshot — neutral fallback', resolve: () => 'FINDER_GRID_PNG' },
    ],
  },
  {
    key: 'window-body-bg',
    label: 'Window body background',
    where: 'src/renderWindow.ts bodyBackgroundStyle',
    terminalIsAcceptable: true, // white body is the classic Mac default — not a regression
    tiers: [
      {
        name: 'bodyBackground',
        why: 'cinf -9551 bgPatternId — the Icon View body texture',
        resolve: (m) => m.bodyBackground?.pattern ? `bodyBackground.pattern → ${m.bodyBackground.pattern}` : null,
      },
      { name: 'white', why: 'classic Mac default', resolve: () => 'flat #ffffff' },
    ],
  },
  {
    key: 'desktop-bg',
    label: 'Desktop background (Scene canvas)',
    where: 'demo/index.html buildScene desk',
    terminalIsAcceptable: true, // checkerboard is a deliberate "no themed desktop" choice
    tiers: [
      {
        name: 'desktop-pattern key',
        why: 'first pattern whose key matches /desktop/i — what 1138/1984/beos ship explicitly',
        resolve: (m) => {
          const key = Object.keys(m.patterns ?? {}).find((k) => /desktop/i.test(k));
          return key ? `patterns['${key}'] → ${m.patterns[key].asset}` : null;
        },
      },
      {
        name: 'ppat-17 (canonical Mac desktop)',
        why: 'Apple-reserved id 17 is the system Finder built-in desktop pattern — 5 themes ship it',
        resolve: (m) => m.patterns?.['ppat-17']?.asset ? `patterns['ppat-17'] → ${m.patterns['ppat-17'].asset}` : null,
      },
      { name: 'CSS checkerboard', why: 'fallback for schemes that ship neither (apple-platinum-2 / Platinums / Windows ports)', resolve: () => 'repeating-conic-gradient' },
    ],
  },
  {
    key: 'dialog-body-bg',
    label: 'Dialog (no-title-utility-window) body background',
    where: 'demo/index.html buildScene Options dialog',
    terminalIsAcceptable: true, // flat fill is a fine default for a utility dialog
    tiers: [
      {
        name: 'utility-pattern',
        why: 'ppat -9568 / utility-pattern slug — the classic Mac utility-window tile',
        resolve: (m) => {
          const p = m.patterns?.['utility-pattern']?.asset ?? m.patterns?.['ppat--9568']?.asset;
          return p ? `utility-pattern → ${p}` : null;
        },
      },
      {
        name: 'headerFill',
        why: 'solid colour from the active title-bar fill — for schemes shipping no utility ppat',
        resolve: (m) => m.headerColors?.active?.fill ? `headerColors.active.fill → ${m.headerColors.active.fill}` : null,
      },
      { name: 'flat #ececec', why: 'neutral fallback', resolve: () => 'flat #ececec' },
    ],
  },
  {
    key: 'info-bar-text-color',
    label: 'Info-bar volume-label text color',
    where: 'demo/index.html buildScene volume span',
    terminalIsAcceptable: false, // hard-coded black is a regression risk on dark info bars
    tiers: [
      {
        name: 'contrast-pick',
        why: 'sample the resolved info-bar bg luminance + pick #fff / #000 for contrast — always available',
        resolve: (m) => m.headerColors?.active?.fill ? `contrast-pick vs headerColors.active.fill (${m.headerColors.active.fill})` : null,
      },
      { name: 'flat #000', why: 'hardcoded fallback — illegible on dark info bars', resolve: () => 'flat #000' },
    ],
  },
  {
    key: 'progress-bar-hue',
    label: 'Progress-bar accent hue',
    where: 'src/controls.ts composeProgress (currently always lavender / role-3-part)',
    terminalIsAcceptable: true, // lavender canonical is a fine default
    tiers: [
      {
        name: 'role-3-part frame/fill/track',
        why: 'schemes shipping -10080/-10079/-10078 carry the artist-painted progress bar',
        resolve: (m) => {
          const has = (id) => Object.values(m.chromeElements ?? {}).some((v) => v.sourceCicnId === id);
          return (has(-10080) && has(-10079) && has(-10078)) ? 'role-3-part (-10080/-10079/-10078)' : null;
        },
      },
      {
        name: 'lavender 2-part canonical',
        why: 'shipped -10223 / -10224 — the kDEF default lavender progress',
        resolve: (m) => {
          const has = (id) => Object.values(m.chromeElements ?? {}).some((v) => v.sourceCicnId === id);
          return has(-10223) ? 'lavender canonical (-10223)' : null;
        },
      },
      {
        name: 'multi-hue',
        why: 'scheme ships 3+ alternate hues — runtime could expose a picker, currently picks default',
        resolve: (m) => {
          const ids = Object.values(m.chromeElements ?? {})
            .map((v) => v.sourceCicnId)
            .filter((id) => typeof id === 'number' && Math.abs(id) >= 10071 && Math.abs(id) <= 10080);
          return ids.length >= 3 ? `${ids.length} hue cicns shipped (variant picker candidate)` : null;
        },
      },
      { name: 'procedural Platinum', why: 'no progress cicn → platinumProgress fallback', resolve: () => 'procedural' },
    ],
  },
  {
    key: 'folder-scene-icons',
    label: 'Folder/scene icons inside the body',
    where: 'demo/index.html schemeIcons',
    terminalIsAcceptable: false, // a scheme falling to neutral SVG folders is a coverage gap
    tiers: [
      {
        name: 'FINDER_CONTENT_ICON_IDS (folder-priority)',
        why: 'standard folder ids the Mac always shipped: -3983 System / -3999 Generic / -3997 Open / …',
        resolve: (_m, ii) => {
          const ids = [-3983, -3999, -3997, -3994, -3976];
          const hit = ids.find((id) => ii.some((e) => e.id === id && e.size === 32));
          return hit ? `icl -${Math.abs(hit)}` : null;
        },
      },
      {
        name: 'coverage-ranked icl4/8',
        why: 'any 32px scene icon with 18–95% coverage when no folder id was hit',
        resolve: (_m, ii) => {
          const has = ii.some((e) => e.size === 32 && e.coverage > 0.18 && e.coverage < 0.95);
          return has ? '(coverage-ranked icl4/8)' : null;
        },
      },
      { name: 'neutral SVG folders', why: 'fall-through — schemes that theme no folders at all (1990, apple-platinum-2)', resolve: () => 'SVG' },
    ],
  },
];

// ── multi-flavor / variant detection ──────────────────────────────────────
// Each entry classifies a known variant FAMILY. The audit reports which themes
// ship multiple members of each family — those are candidates for runtime
// variant selection in the Scene / future theme picker.
const VARIANT_FAMILIES = [
  {
    key: 'progress-hues',
    label: 'Progress-bar hue variants',
    role: 'Some 1998–2000 schemes shipped a hue picker; cicns at -10071..-10080 / -10220..-10222 are the alternate fills',
    test: (m) => {
      const ids = [...new Set(
        Object.values(m.chromeElements ?? {})
          .map((v) => v.sourceCicnId)
          .filter((id) => typeof id === 'number'
            && ((Math.abs(id) >= 10071 && Math.abs(id) <= 10080)
              || (Math.abs(id) >= 10220 && Math.abs(id) <= 10222))),
      )].sort();
      return ids.length > 2 ? ids : null;
    },
  },
  {
    key: 'numbered-ppats',
    label: 'Sequential positive-id ppats',
    role: 'Positive-id ppat triples/quads with no slug are typically a scheme author\'s authored color variants',
    test: (m) => {
      const ids = Object.keys(m.patterns ?? {})
        .map((k) => parseInt(k.replace(/^ppat-/, ''), 10))
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      // Adjacent runs of 3+ likely indicate variants.
      const runs = [];
      let run = [ids[0]];
      for (let i = 1; i < ids.length; i++) {
        if (ids[i] === run[run.length - 1] + 1) run.push(ids[i]);
        else { if (run.length >= 3) runs.push(run); run = [ids[i]]; }
      }
      if (run.length >= 3) runs.push(run);
      return runs.length ? runs : null;
    },
  },
  {
    key: 'header-state-variants',
    label: 'headerColors active/inactive pair',
    role: 'Every themed scheme should have BOTH; an asymmetry flags an incomplete theme',
    test: (m) => {
      const hc = m.headerColors;
      if (!hc?.active && !hc?.inactive) return null;
      const aKeys = hc.active ? Object.keys(hc.active).length : 0;
      const iKeys = hc.inactive ? Object.keys(hc.inactive).length : 0;
      return { active: aKeys, inactive: iKeys, balanced: aKeys === iKeys };
    },
  },
];

// ── corpus walk ───────────────────────────────────────────────────────────
async function loadAllBundles() {
  const out = [];
  const slugs = (await readdir(themesRoot)).sort();
  for (const slug of slugs) {
    if (themeArg && slug !== themeArg) continue;
    const dir = resolve(themesRoot, slug);
    const sit = resolve(dir, 'scheme.sit');
    const rsrc = resolve(dir, 'scheme.rsrc');
    const sourcePath = existsSync(sit) ? sit : existsSync(rsrc) ? rsrc : null;
    if (!sourcePath) continue;
    const bytes = new Uint8Array(await readFile(sourcePath));
    const t = await loadKaleidoscopeScheme(bytes, { meta: { name: slug }, source: slug, encodeAssets: false });
    out.push({ slug, manifest: t.manifest, iconIndex: t.iconIndex });
  }
  return out;
}

function resolveSlot(slot, manifest, iconIndex) {
  for (let i = 0; i < slot.tiers.length; i++) {
    const tier = slot.tiers[i];
    const value = tier.resolve(manifest, iconIndex);
    if (value) return { tierIdx: i, tier, value };
  }
  return { tierIdx: slot.tiers.length, tier: null, value: '—' };
}

function classifyVariants(manifest) {
  const out = [];
  for (const fam of VARIANT_FAMILIES) {
    const v = fam.test(manifest);
    if (v) out.push({ ...fam, value: v });
  }
  return out;
}

function unusedResources(manifest, iconIndex) {
  // Heuristic: report counts of obvious "unconsumed by Scene" resources so the
  // codex hints at where the Scene could be richer. Not exhaustive — the Scene
  // is intentionally a snapshot, not a full theme tour.
  const ppats = Object.keys(manifest.patterns ?? {});
  const cicns = Object.values(manifest.chromeElements ?? {}).length;
  const ics = iconIndex.filter((e) => e.size === 16).length;
  const icl = iconIndex.filter((e) => e.size === 32).length;
  return { ppats: ppats.length, cicns, ics, icl };
}

// ── output ────────────────────────────────────────────────────────────────
function renderMarkdown(rows) {
  const lines = [];
  lines.push('<!-- AUTO-GENERATED by scripts/scene-coverage-audit.mjs — do not edit by hand.');
  lines.push('     Regenerate via `npm run audit:scenes -- --write`.');
  lines.push('     The human-curated SLOT contract lives in docs/scene-slot-spec.md. -->');
  lines.push('');
  lines.push('# Scene codex');
  lines.push('');
  lines.push('Per-theme tier resolution for every Scene slot, plus shipped-resource counts and');
  lines.push('multi-flavor variant flags. Generated by walking each bundle\'s decoded manifest.');
  lines.push('');
  lines.push('See [docs/scene-slot-spec.md](./scene-slot-spec.md) for the hand-authored contract behind each slot.');
  lines.push('');
  lines.push('## Slot resolution per theme');
  lines.push('');
  const header = ['theme', ...SLOTS.map((s) => s.key)];
  lines.push('| ' + header.join(' | ') + ' |');
  lines.push('|' + header.map(() => '---').join('|') + '|');
  for (const row of rows) {
    const cells = [row.slug];
    for (const s of SLOTS) {
      const r = row.slots[s.key];
      const tag = r.tier ? `T${r.tierIdx + 1}` : 'miss';
      cells.push(`${tag} · ${r.tier?.name ?? '—'}`);
    }
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  lines.push('');
  lines.push('## Tier distribution per slot');
  lines.push('');
  for (const slot of SLOTS) {
    lines.push(`### ${slot.label}  \`${slot.key}\``);
    lines.push('');
    lines.push(`Resolved in: \`${slot.where}\``);
    lines.push('');
    lines.push('| Tier | Field | Why | Themes |');
    lines.push('|---|---|---|---|');
    for (let i = 0; i < slot.tiers.length; i++) {
      const tier = slot.tiers[i];
      const themesAtTier = rows.filter((r) => r.slots[slot.key].tierIdx === i).map((r) => r.slug);
      lines.push(`| T${i + 1} | \`${tier.name}\` | ${tier.why} | ${themesAtTier.length ? themesAtTier.join(', ') : '—'} |`);
    }
    lines.push('');
  }
  lines.push('## Shipped resource counts');
  lines.push('');
  lines.push('| theme | ppats | cicns | ics4/8 (16px) | icl4/8 (32px) |');
  lines.push('|---|---|---|---|---|');
  for (const row of rows) {
    const c = row.unused;
    lines.push(`| ${row.slug} | ${c.ppats} | ${c.cicns} | ${c.ics} | ${c.icl} |`);
  }
  lines.push('');
  lines.push('## Multi-flavor / variant flags');
  lines.push('');
  for (const fam of VARIANT_FAMILIES) {
    lines.push(`### ${fam.label}  \`${fam.key}\``);
    lines.push('');
    lines.push(fam.role);
    lines.push('');
    lines.push('| theme | variant evidence |');
    lines.push('|---|---|');
    for (const row of rows) {
      const hit = row.variants.find((v) => v.key === fam.key);
      if (!hit) continue;
      let evidence;
      if (Array.isArray(hit.value) && hit.value.every(Array.isArray)) {
        evidence = hit.value.map((run) => `runs ${run[0]}..${run[run.length - 1]} (${run.length})`).join('; ');
      } else if (Array.isArray(hit.value)) {
        evidence = hit.value.join(', ');
      } else if (typeof hit.value === 'object') {
        evidence = `active:${hit.value.active} keys · inactive:${hit.value.inactive} keys${hit.value.balanced ? '' : ' (ASYMMETRIC)'}`;
      } else {
        evidence = String(hit.value);
      }
      lines.push(`| ${row.slug} | ${evidence} |`);
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function renderConsoleTable(rows) {
  const lines = [];
  lines.push('');
  lines.push('Scene codex — tier per slot per theme');
  lines.push('-'.repeat(72));
  const colW = 12;
  lines.push('  ' + 'theme'.padEnd(28) + SLOTS.map((s) => s.key.padEnd(colW)).join(' '));
  for (const row of rows) {
    const cells = SLOTS.map((s) => {
      const r = row.slots[s.key];
      return (r.tier ? `T${r.tierIdx + 1}` : 'miss').padEnd(colW);
    }).join(' ');
    lines.push('  ' + row.slug.padEnd(28) + cells);
  }
  return lines.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────
const bundles = await loadAllBundles();
const rows = bundles.map(({ slug, manifest, iconIndex }) => ({
  slug,
  slots: Object.fromEntries(SLOTS.map((s) => [s.key, resolveSlot(s, manifest, iconIndex)])),
  variants: classifyVariants(manifest),
  unused: unusedResources(manifest, iconIndex),
}));

if (flags.has('--json')) {
  console.log(JSON.stringify({ slots: SLOTS.map((s) => ({ key: s.key, label: s.label })), rows }, null, 2));
} else if (flags.has('--write')) {
  const out = resolve(repoRoot, 'docs/scene-codex.md');
  await writeFile(out, renderMarkdown(rows));
  console.log(`wrote ${out.replace(repoRoot + '/', '')} — ${rows.length} themes × ${SLOTS.length} slots`);
} else {
  console.log(renderConsoleTable(rows));
}

if (flags.has('--check')) {
  // CI signal: a slot resolved to its hard fallback (last tier) is a regression
  // candidate ONLY when terminalIsAcceptable is false. Some slots' last tier is
  // a legitimate answer (white body bg, checkerboard desk) and shouldn't fire.
  const offenders = [];
  for (const row of rows) {
    for (const slot of SLOTS) {
      if (slot.terminalIsAcceptable) continue;
      const r = row.slots[slot.key];
      if (r.tierIdx === slot.tiers.length - 1) offenders.push(`${row.slug}.${slot.key}`);
    }
  }
  if (offenders.length) {
    console.error(`\n✗ ${offenders.length} slot(s) fell to hard fallback (gap in the lookup chain or in the bundle):`);
    for (const o of offenders) console.error(`    ${o}`);
    process.exit(1);
  }
  console.log('\n✓ no slot fell to hard fallback');
}
