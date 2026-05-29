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
import {
  KDEF_CONTROL_IDS, KDEF_DOC_WIDGET_IDS, KDEF_UTIL_WIDGET_IDS, KDEF_SCROLL_ARROW_IDS,
} from './lib/kdef-control-ids.mjs';

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
    key: 'finder-header-badge',
    label: 'Finder window-header badge (info-bar leading slot)',
    where: 'demo/index.html gridProxyIcon',
    terminalIsAcceptable: true, // FINDER_GRID_PNG IS the right answer for schemes that don't ship -3790
    tiers: [
      {
        name: 'ics4/8 -3790',
        why: 'Finder window-header "Snap-To-Grid" / "Grid Arrangement" badge (corpus author-labels confirm — see docs/spec/corpus-corroborated-ids.md). Shown when "Always Snap To Grid" is enabled. NOT the volume info icon as our LEARNINGS / spec / demo prose had claimed for two months — Apple\'s actual volume-icon path is GetIconRef(\'macs\',\'hdsk\') → kGenericHardDiskIconResource=-3995; -3790 is a separate Finder-header layer.',
        resolve: (_m, ii) => ii.find((e) => e.id === -3790 && e.size === 16) ? 'ics -3790' : null,
      },
      // An earlier iteration promoted ics4/8 -14336 here as a T2, on the
      // hypothesis that corner-sprite schemes "draw their mark on -14336"
      // when they don't ship -3790. WRONG: -14336 is the document-window
      // CLOSE/COLLAPSE WIDGET (drawn at the title-bar widget positions, not
      // in a Finder-header slot). Owner surfaced 2026-05-29 on apple-platinum-2,
      // where the Scene was showing the close-box glyph next to "Apple
      // Platinum 2" while the reference shows the system-default grid.
      // Retraction trigger: pixel-probe each corner-sprite scheme's reference
      // before reinstating — scripts/probe-reference-slot.mjs is the verifier
      // (18/18 themes confirm the grid is correct for the 5 schemes without -3790).
      { name: 'FINDER_GRID_PNG', why: 'period system-default grid — the right answer for schemes that ship no -3790. Confirmed via scripts/probe-reference-slot.mjs against per-bundle reference images.', resolve: () => 'FINDER_GRID_PNG' },
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
    label: 'Dialog / utility window body background',
    where: 'src/renderWindow.ts bodyBackgroundStyle (utility-slug branch)',
    terminalIsAcceptable: true, // flat white is acceptable when no utility ppat is shipped
    tiers: [
      // The runtime walks a structured hierarchy in bodyBackgroundStyle:
      //   T1 → patterns['utility-pattern']  (author-declared utility interior;
      //                                      shipped by monkey-paradise + animals
      //                                      + crayon-os as ppat-42).
      //   T2 → patterns['ppat--9568']       (canonical kDEF utility-window cinf
      //                                      slot; shipped by 1990 + others).
      //   T3 → flat #ffffff                 (period default for schemes that ship
      //                                      no utility pattern — 1984, the
      //                                      corner-sprite themes, etc.).
      // The Icon-View ppat (bodyBackground.pattern) is NEVER reused for utility
      // bodies — that's the army-camo-wrapping-the-Options-dialog regression
      // class; the document-window's body texture isn't meant for modal interiors.
      {
        name: 'ppat-42 (utility-window canonical)',
        why: 'kDEF utility-window pattern slot; each bundle named it differently in the friendly key (1984 "blue-utility", monkey-paradise "utility-pattern", crayon-os "utility-pattern") — resolved by `sourcePpatId` which survives Option-A blob-URL rewriting',
        resolve: (m) => {
          const hit = Object.values(m.patterns ?? {}).find((v) => Math.abs(v?.sourcePpatId ?? 0) === 42);
          return hit ? `ppat-42 (canonical utility slot)` : null;
        },
      },
      {
        name: 'ppat--9568 (utility cinf)',
        why: 'canonical kDEF utility-window cinf slot — shipped when the bundle doesnt ship ppat-42',
        resolve: (m) => {
          const hit = Object.values(m.patterns ?? {}).find((v) => Math.abs(v?.sourcePpatId ?? 0) === 9568);
          return hit ? `ppat--9568 (utility cinf)` : null;
        },
      },
      { name: 'flat #ffffff', why: 'period default for schemes that ship no utility pattern', resolve: () => 'flat #ffffff' },
    ],
  },
  {
    key: 'info-bar-text-color',
    label: 'Info-bar volume-label text color',
    where: 'demo/index.html buildScene volume span',
    terminalIsAcceptable: false, // hard-coded black is a regression risk on dark info bars
    tiers: [
      // The runtime contrast-picks against the resolved info-bar bg luminance —
      // sample the headerColors.active.fill (when no ppat is in play), threshold
      // at lum<128 → white, else black. The audit's two tiers split by which
      // ANSWER the demo's code lands on, so a 'flat-bar dark fill → white' theme
      // (slimes' #d6ff76 is light) shows T1; a 'pattern bg or light fill' theme
      // shows T2. The earlier degenerate-single-branch shape (T1 fires for every
      // theme with headerColors) gave no per-theme signal.
      {
        name: 'contrast-pick → white',
        why: 'resolved info-bar fill is dark (luminance < 128) — contrast pick returns white',
        resolve: (m) => {
          const f = m.headerColors?.active?.fill;
          if (!f) return null;
          const h = f.replace('#', '');
          if (h.length !== 6) return null;
          const r = parseInt(h.slice(0, 2), 16);
          const g = parseInt(h.slice(2, 4), 16);
          const b = parseInt(h.slice(4, 6), 16);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          return lum < 128 ? `headerColors.active.fill ${f} (lum ${Math.round(lum)}) → #fff` : null;
        },
      },
      {
        name: 'contrast-pick → black',
        why: 'resolved info-bar fill is light (luminance ≥ 128) OR a textured ppat (we keep black against varied pattern luminance)',
        resolve: (m) => {
          const f = m.headerColors?.active?.fill;
          if (!f) return 'no headerColors — defaults to #000 against unknown bg';
          const h = f.replace('#', '');
          if (h.length !== 6) return null;
          const r = parseInt(h.slice(0, 2), 16);
          const g = parseInt(h.slice(2, 4), 16);
          const b = parseInt(h.slice(4, 6), 16);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          return lum >= 128 ? `headerColors.active.fill ${f} (lum ${Math.round(lum)}) → #000` : null;
        },
      },
      { name: 'flat #000', why: 'hardcoded fallback for schemes with malformed headerColors', resolve: () => 'flat #000' },
    ],
  },
  {
    key: 'progress-bar-hue',
    label: 'Progress-bar accent hue',
    where: 'src/controls.ts composeProgress (currently always lavender / role-3-part)',
    terminalIsAcceptable: false, // a theme with no progress art is a coverage gap, not a deliberate fallback
    tiers: [
      // Audit tier order MUST mirror composeProgress's runtime lookup order:
      // -10223 lavender check fires FIRST (controls.ts ~L711); only when that
      // misses does the role-3-part branch take over. Previous tier order
      // (role-3-part as T1, lavender as T2) reported wrong tiers for the 5
      // themes that ship BOTH (apple-platinum-2 / black-platinum / system7-
      // nostalgia-silver / windows-31 / windows-95). Reviewer-flagged in the
      // framework-architecture pass.
      {
        name: 'lavender 2-part canonical',
        why: 'shipped -10223 — the kDEF default lavender progress (composeProgress checks this first)',
        resolve: (m) => {
          const has = (id) => Object.values(m.chromeElements ?? {}).some((v) => v.sourceCicnId === id);
          return has(-KDEF_CONTROL_IDS.progress.lavenderCanonical) ? `lavender canonical (-${KDEF_CONTROL_IDS.progress.lavenderCanonical})` : null;
        },
      },
      {
        name: 'role-3-part frame/fill/track',
        why: 'schemes shipping -10080/-10079/-10078 carry the artist-painted progress bar; runtime fallback when -10223 absent',
        resolve: (m) => {
          const has = (id) => Object.values(m.chromeElements ?? {}).some((v) => v.sourceCicnId === id);
          const { frame, fill, track } = KDEF_CONTROL_IDS.progress;
          return (has(-frame) && has(-fill) && has(-track)) ? `role-3-part (-${frame}/-${fill}/-${track})` : null;
        },
      },
      {
        name: 'multi-hue',
        why: 'scheme ships 3+ alternate hues — runtime could expose a picker, currently picks default',
        resolve: (m) => {
          const [lo, hi] = KDEF_CONTROL_IDS.progress.familyRanges[0]; // role-3-part hue range
          const ids = Object.values(m.chromeElements ?? {})
            .map((v) => v.sourceCicnId)
            .filter((id) => typeof id === 'number' && Math.abs(id) >= lo && Math.abs(id) <= hi);
          return ids.length >= 3 ? `${ids.length} hue cicns shipped (variant picker candidate)` : null;
        },
      },
      { name: 'procedural Platinum', why: 'no progress cicn → platinumProgress fallback', resolve: () => 'procedural' },
    ],
  },
  {
    key: 'title-widget-glyph',
    label: 'Title-bar widget glyph (close / zoom / collapse)',
    where: 'src/composeCornerSprite.ts loadWidgetGlyph + src/renderWindow.ts widget id arithmetic',
    terminalIsAcceptable: false, // procedural box fallback is a coverage gap
    tiers: [
      // The kDEF resolves widget glyphs by WINDOW MODEL:
      //   Native-recipe schemes BAKE the widget art into the chrome cicn (the
      //   wnd# recipe places widget cells AT the bar's grid). No separate glyph
      //   lookup — the widget IS the chrome at those coordinates.
      //   Corner-sprite schemes draw the bar procedurally + stamp ics4/ics8
      //   glyphs at -14336 (doc) or -14320 (utility) positions.
      // Both are period-faithful; the codex documents which model each theme uses.
      {
        name: 'baked into chrome cicn (native recipe)',
        why: 'sliced-recipe schemes embed widgets in the wnd# layout — no glyph lookup needed (faithful kDEF)',
        resolve: (m) => {
          const wt = m.windowTypes?.['document-window'];
          if (!wt) return null;
          return wt.model !== 'corner-sprite' ? 'chrome cicn (widget cells baked)' : null;
        },
      },
      {
        name: 'document widgets (-14336/-14335/-14334)',
        why: 'corner-sprite schemes ship ics4/ics8 -14336 family for doc windows',
        resolve: (_m, ii) => {
          const has = (id) => ii.some((e) => e.id === id && e.size === 16);
          return has(KDEF_DOC_WIDGET_IDS[0])
            ? `ics ${KDEF_DOC_WIDGET_IDS.join('/')} shipped (${KDEF_DOC_WIDGET_IDS.filter(has).length}/3)`
            : null;
        },
      },
      {
        name: 'utility widgets (-14320/-14319/-14318)',
        why: 'ics4/ics8 -14320 family — utility-window widgets where docs are absent',
        resolve: (_m, ii) => {
          const has = (id) => ii.some((e) => e.id === id && e.size === 16);
          return has(KDEF_UTIL_WIDGET_IDS[0])
            ? `ics ${KDEF_UTIL_WIDGET_IDS.join('/')} shipped (${KDEF_UTIL_WIDGET_IDS.filter(has).length}/3)`
            : null;
        },
      },
      { name: 'procedural box', why: 'composeCornerSpriteChrome stamps a 1px outline — no scheme art to draw', resolve: () => 'procedural box' },
    ],
  },
  {
    key: 'scroll-arrow-glyph',
    label: 'Scrollbar arrow glyph (raised + pressed × 4 directions)',
    where: 'src/controls.ts composeScrollbar (arrow lookup by id family)',
    terminalIsAcceptable: false,
    tiers: [
      // Same model split as title-widget-glyph: native-recipe schemes bake the
      // arrow ART into the scrollbar track cicn (the visible button-style cell
      // at each end), so they don't need separate glyphs. Corner-sprite schemes
      // need the ics4/8 -10197..-10204 family.
      {
        name: 'baked into scrollbar cicn (native recipe)',
        why: 'sliced-recipe schemes embed arrow art in the track cicn — no separate glyph lookup',
        resolve: (m) => {
          const wt = m.windowTypes?.['document-window'];
          if (!wt) return null;
          const [sbLo, sbHi] = KDEF_CONTROL_IDS.scrollbar.familyRanges[0];
          const hasScrollbarCicn = Object.values(m.chromeElements ?? {})
            .some((v) => typeof v.sourceCicnId === 'number' && Math.abs(v.sourceCicnId) >= sbLo && Math.abs(v.sourceCicnId) <= sbHi);
          return (wt.model !== 'corner-sprite' && hasScrollbarCicn) ? `scrollbar cicn (-${sbLo}..-${sbHi} family, arrow baked)` : null;
        },
      },
      {
        name: 'full 8-glyph set (-10197..-10204)',
        why: 'four directions × raised+pressed — the canonical kDEF231 CDEF arrow map (asm 9f0e-9f38)',
        resolve: (_m, ii) => {
          const got = KDEF_SCROLL_ARROW_IDS.filter((id) => ii.some((e) => e.id === id && e.size === 16));
          return got.length === KDEF_SCROLL_ARROW_IDS.length ? 'all 8 glyphs (4 dir × raised+pressed)' : null;
        },
      },
      {
        name: 'partial set (≥4 glyphs)',
        why: 'four directions covered, may be missing pressed variants',
        resolve: (_m, ii) => {
          const got = KDEF_SCROLL_ARROW_IDS.filter((id) => ii.some((e) => e.id === id && e.size === 16));
          return got.length >= 4 ? `${got.length}/${KDEF_SCROLL_ARROW_IDS.length} glyphs shipped` : null;
        },
      },
      { name: 'procedural arrows', why: 'platinumScrollbar draws CSS-procedural arrows', resolve: () => 'procedural' },
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
