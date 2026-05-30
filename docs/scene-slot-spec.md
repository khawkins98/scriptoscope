# Scene slot spec

The hand-authored contract for every visual SLOT the demo's Scene panel composes.
Each slot is a small piece of the live render (the info bar, the Finder-header badge, the
folder icons inside the body, etc) whose visual fill is resolved from the scheme's
DECODED data by walking a lookup hierarchy. This document is the CONTRACT —
what each slot reads, in what order, and why. The auto-generated
[scene-codex.md](./scene-codex.md) records the resolved tier per-theme.

## Why this exists

Two patterns surfaced repeatedly while landing the corpus:

1. **Wrong-fallback bugs are invisible to lint.** A scheme decodes cleanly,
   its bundle validates, the demo renders without errors — and yet the live
   Scene picks the wrong source field for some slot. The bug only shows up
   against the period reference image, where a human spots that the info bar
   is gray instead of army camo. Lint can't catch this because the manifest
   is fine; the LOOKUP CHOICE is wrong.
2. **Schemes vary in which fields they ship.** Slimes carries no
   `bodyBackground.pattern`, no `cinf -9567`, no `ics -3790`. monkey-paradise
   ships ppats 128/129/130/132 but only one is the info-bar texture
   (`-9567.bgPattern → ppat-129`); the others are likely color variants for
   slots the demo doesn't currently expose. A robust lookup walks a HIERARCHY
   so that each scheme falls to the most appropriate themed answer.

This spec keeps the hierarchies REVIEWABLE. The codex keeps them HONEST
(per-theme audit + tier counts).

## Reading the codex

Each slot row in [scene-codex.md](./scene-codex.md) reports the tier each theme
landed on. `T1` = preferred / scheme-decoded; deeper tiers are progressively
more heuristic. Themes landing in the LAST tier (the hard fallback — "flat
gray", "white", "checkerboard") are candidates for either:

- Raising the floor with a richer in-between tier (data-driven, applies to many themes), OR
- Wiring a per-theme override (one-off, surgical).

`npm run audit:scenes -- --check` exits non-zero on any slot that fell to its
hard fallback (CI signal — useful once the corpus is at-or-near full coverage).

## Slot contracts

### `info-bar-bg` — Info-bar background

The Finder volume-header strip the demo draws at top:0 of the Hello! window
content area (the strip showing `slimes 1.5` / `1990` / etc.).

| Tier | Source field | Why |
|---|---|---|
| T1 | `chromeElements[<key for sourceCicnId=-9567>].bgPattern → patterns[…].asset` | Scheme-decoded. The finder-header cinf carries the bgPatternId the scheme author wired in. Authoritative when present. |
| T2 | `bodyBackground.pattern` | The Icon-View body texture (cinf -9551). Most textured schemes ship this; reads as part of the window content. |
| T3 | `headerColors.active.fill` | Solid colour from the active title-bar fill. Reads as a "this scheme is themed even if the artist didn't make a separate info-bar texture" choice. |
| T4 | `flat #e6e6e6` | Hard fallback. No corpus theme lands here at HEAD. |

Implemented in: `demo/diagnostic.html buildScene`.

### `finder-header-badge` — Info-bar leading slot

The small (16px) icon that sits left of the title text in the Finder window header. **NOT a volume icon** — this slot is the Finder's "Snap-To-Grid" / "Arrange By" / read-only badge that appears at the leading edge of every Finder window's header bar (mollusc Companion + 3 corpus author labels confirm; see `docs/spec/corpus-corroborated-ids.md`). The historical mis-label as "volume-icon" was a two-month assumption from the codex's first draft — corrected 2026-05-29 when agent research surfaced that `-3790` is not in Apple's `IconsCore.h` (which would be Apple's authoritative source for a volume-icon constant), but IS labeled `"Snap-To-Grid"` / `"Grid Arrangement"` in 3 bundle author labels.

| Tier | Source field | Why |
|---|---|---|
| T1 | `ics4/ics8 -3790` | Finder window-header snap-to-grid badge — author-labeled "Snap-To-Grid" / "Grid Arrangement" by corpus authors. Apple's actual volume-icon path is a separate slot (`GetIconRef('macs', 'hdsk') → kGenericHardDiskIconResource = -3995`). |
| T2 | `FINDER_GRID_PNG` | Period system-default grid. The right answer for schemes that don't ship -3790; the reference image's header badge in every such case IS this grid. |

Implemented in: `demo/diagnostic.html gridProxyIcon`.

The icon's transparency is preserved — placing the `<img>` on a coloured info bar lets the bar fill show through the icon's transparent pixels.

**Verification:** `scripts/probe-reference-slot.mjs` pixel-matches each bundle's reference PNG against the candidates; 18/18 themes confirm the runtime's current Pass-1/Pass-2 hierarchy.

**Retraction trigger:** an earlier iteration promoted `ics4/8 -14336` as a T2 fallback on the hypothesis that corner-sprite schemes "draw their mark on -14336" when they don't ship -3790. **Wrong:** -14336 is the document-window CLOSE/COLLAPSE widget (drawn at title-bar widget positions, not in this slot). Owner surfaced this 2026-05-29 on apple-platinum-2, where the Scene showed the close-box glyph while the reference shows the system-default grid. Before reinstating any -14336-style tier, run `node scripts/probe-reference-slot.mjs` and confirm the slot is NOT the system grid in the reference (it is, in all current corner-sprite cases).

### `window-body-bg` — Window body background

The fill behind the window's content area (NOT the chrome — the body inside
the chrome). Used by every render call, not just the Scene.

| Tier | Source field | Why |
|---|---|---|
| T1 | `bodyBackground.pattern` | Icon-View body texture from cinf -9551's bgPatternId. |
| T2 | `flat #ffffff` | Classic Mac default. |

Implemented in: `src/renderWindow.ts bodyBackgroundStyle`.

### `desktop-bg` — Desktop background (Scene canvas)

The "desk" behind the Hello! window in the Scene panel. Tiled at native pixel
size; not a window contents background.

| Tier | Source field | Why |
|---|---|---|
| T1 | `patterns[<key matching /desktop/i>].asset` | The scheme's own desktop ppat — 1138, 1984, beos-r503, apple-lisa ship one with an explicit `desktop-pattern` / `blue-desktop` / `desktop-background` key. |
| T2 | `repeating-conic-gradient` CSS checkerboard | Neutral fallback for schemes that don't ship a desktop ppat. |

Implemented in: `demo/diagnostic.html buildScene` (the `desk` element).

### `dialog-body-bg` — Dialog / utility window body background

The content area behind the Options dialog (`no-title-utility-window`).

| Tier | Source field | Why |
|---|---|---|
| T1 | `ppat-42` (resolved by canonical resource id) | The kDEF utility-window pattern slot. Each bundle author chose a different friendly key — monkey-paradise / animals / crayon-os ship "utility-pattern", 1984 ships "blue-utility", others ship under their own name. All decode to `ppat-42-*.png`. Reading by resource id (the asset-path id), not the friendly key, is the codex move: the resource id is the structured truth, the key is decorative. |
| T2 | `ppat--9568` (resolved by canonical resource id) | Canonical kDEF utility-window cinf slot — schemes that don't ship `ppat-42` may carry the utility pattern under cinf -9568 instead (1990 lands here). |
| T3 | `flat #ffffff` | Period default for schemes that ship no utility pattern at all (the corner-sprite Platinums, the Windows ports, dolphin-som, etc.). |

The Finder Icon-View ppat (`bodyBackground.pattern`, cinf -9551) is **never** reused for utility bodies — that's the army-camo-wrapping-the-Options-dialog regression class (the document-window's body texture isn't meant for modal interiors).

An earlier iteration retired the hierarchy after a visual misread that thought all the references showed flat. The user's screenshot review on 2026-05-29 surfaced that monkey-paradise / 1990 / etc. references actually show a themed utility body; reinstated the structured-field walk.

**Retraction trigger:** before retiring T1/T2 again, pixel-probe the per-bundle reference images at native resolution (not the thumbnails in the demo's index — that was the misread that originally retired the hierarchy). Use a PNG decoder on the bundle's reference image and sample the rectangle the slot occupies; if the dialog body has any non-fffffff pixels, the hierarchy stays.

Implemented in: `src/renderWindow.ts:bodyBackgroundStyle` (utility-slug branch).

### `info-bar-text-color` — Info-bar volume-label colour

The label colour applied to the volume name in the Scene's Finder info bar.

| Tier | Source field | Why |
|---|---|---|
| T1 | contrast-pick → `#fff` (when `headerColors.active.fill` luminance < 128) | Dark info-bar fills (1990 / animals / dolphin-som / evolution) need white text for legibility |
| T2 | contrast-pick → `#000` (when fill ≥ 128 OR a textured ppat is in play) | Light fills + textured backgrounds keep black text |
| T3 | `flat #000` | Hardcoded fallback for schemes with malformed headerColors (none in corpus) |

Implemented in: `demo/diagnostic.html` buildScene's volume span — luminance threshold mirrors the trick `composeCornerSpriteChrome` uses for the title bar.

### `progress-bar-hue` — Progress-bar accent

| Tier | Source field | Why |
|---|---|---|
| T1 | shipped `-10223` lavender canonical | `composeProgress` checks this FIRST — the kDEF default. Most platinum-family + Windows-port + dolphin-som themes land here |
| T2 | role-3-part `-10080/-10079/-10078` (frame/fill/track) | Native-recipe schemes that paint a custom progress bar — runtime fallback when `-10223` isn't shipped |
| T3 | multi-hue variant flag (informational) | When a scheme ships 3+ alternate hue cicns (apple-platinum-2, black-platinum, system7-nostalgia-silver ship 13 hues), exposing a picker is a future feature |
| T4 | procedural Platinum | No progress art → `platinumProgress` fallback (no theme currently lands here) |

Implemented in: `src/controls.ts:composeProgress`.

Tier order **MUST mirror** composeProgress's runtime lookup order. The audit's tier order was reversed in an earlier draft (role-3-part as T1); the framework-architecture reviewer caught this and the order was corrected to match runtime. Future tier reordering must update both.

### `title-widget-glyph` — Title-bar widget (close / zoom / collapse)

The close / zoom / collapse boxes drawn in the title bar.

| Tier | Source field | Why |
|---|---|---|
| T1 | baked into chrome cicn (native recipe) | Sliced-recipe schemes embed widget art in the wnd# recipe — no separate glyph lookup. Period-faithful: the kDEF blits the widget cells from the chrome cicn at their authored coordinates |
| T2 | ics4/ics8 `-14336/-14335/-14334` (document widgets) | Corner-sprite schemes draw the bar procedurally + stamp these glyphs at the widget positions |
| T3 | ics4/ics8 `-14320/-14319/-14318` (utility widgets) | Used by utility window types when the document family isn't shipped |
| T4 | procedural 1px box | `composeCornerSpriteChrome` fallback stamps an outline when no widget art is available |

Two distinct rendering models are at play (native-recipe vs corner-sprite), both period-faithful. The codex documents which model each theme uses.

### `scroll-arrow-glyph` — Scrollbar arrow (raised + pressed × 4 directions)

The 8-glyph arrow set for scrollbar end-buttons.

| Tier | Source field | Why |
|---|---|---|
| T1 | baked into scrollbar cicn (native recipe) | Sliced-recipe schemes embed arrow art in the track cicn (the visible button-style cell at each end). No separate glyph lookup |
| T2 | full 8-glyph set `-10197..-10204` | Corner-sprite schemes ship the canonical kDEF231 CDEF arrow map (asm 9f0e-9f38) — 4 directions × raised+pressed |
| T3 | partial set (≥4 glyphs) | Direction coverage with missing pressed variants |
| T4 | procedural arrows | `platinumScrollbar` CSS fallback |

### `folder-scene-icons` — Folder/scene icons inside the body

Up to 8 32px icons rendered as the Finder window's "contents" in the Scene.

| Tier | Source field | Why |
|---|---|---|
| T1 | `iconIndex` filter for `FINDER_CONTENT_ICON_IDS` (`-3983` System Folder, `-3999` Generic Folder, `-3997` Open, `-3994`, `-3976`) | Standard Mac System-icon ids the Finder always used. When a scheme themes folders, these are the ids it themes. |
| T2 | Coverage-ranked icl4/8 at `size=32` with 18–95% opaque pixels | A scheme themes scene icons under non-folder ids; fall back to the most coverage-rich ones (skip near-blank and full-bleed). |
| T3 | Neutral SVG folders | Fall-through for schemes that theme NO icl/icl8 icons at all (1990 used to land here; apple-platinum-2, system7-nostalgia-silver still do). |

Implemented in: `demo/diagnostic.html schemeIcons`. Prefer the HIGHEST depth per id
(icl8 over icl4) — matches the renderer's glyph policy in
`src/loadTheme.loadGlyphMap`.

## Multi-flavor / variant flags (informational)

These don't drive slot selection today, but the codex flags them so we can
decide whether to expose them in future:

### `progress-hues`

Some schemes ship 6–13 progress-bar fill cicns at `-10071..-10080` and
`-10220..-10222` — a hue picker the original installer offered. The runtime
currently picks ONE (the canonical lavender or the role-3-part frame/fill/track
trio). Exposing the picker at runtime would let a consumer match the progress
bar to their accent.

### `numbered-ppats`

Schemes shipping a run of 3+ consecutive positive-id ppats with no slug are
candidates for "the author wired these as variants for adjacent slots."
monkey-paradise's `128..130` run is the canonical example: 129 IS the
info-bar pattern (verified via cinf -9567), 128/130 are unused by the Scene
today. Investigating which slot they're authored for is a future audit step.

### `header-state-variants`

`headerColors.active` + `headerColors.inactive` both ship 6 keys (`frame`,
`fill`, `lightTinge`, `darkTinge`, `lightBevel`, `darkBevel`). An asymmetry
between the two would flag an incomplete theme. All 18 corpus bundles are
symmetric; this check is here as a guardrail for future imports.

## Adding a new slot

1. Add it to `SLOTS` in `scripts/scene-coverage-audit.mjs` with:
   - `key` / `label` / `where` (the impl file:function)
   - `tiers[]` — ordered hierarchy. Each tier's `resolve(manifest, iconIndex)`
     returns a short string when it hits, or `null` to fall through. The LAST
     tier must always hit (it's the hard fallback).
2. Add a `### <key>` section here documenting the contract + why.
3. Run `npm run audit:scenes -- --write` to regenerate the codex.
4. Commit `scripts/scene-coverage-audit.mjs`, the updated `docs/scene-slot-spec.md` itself, and the regenerated `docs/scene-codex.md` together.

## Adding a new variant family

1. Add an entry to `VARIANT_FAMILIES` in the audit script with:
   - `key` / `label` / `role` (one-line "why care")
   - `test(manifest)` — returns the variant evidence (array of ids, run-of-runs,
     `{active, inactive, balanced}`, etc) or `null` if the theme has none.
2. Add a `### <key>` section under "Multi-flavor / variant flags" above.
3. Run `npm run audit:scenes -- --write`.

## See also

- [scene-codex.md](./scene-codex.md) — auto-generated per-theme audit.
- `tests/visual-baselines/scenes/` — eyeball baselines per theme.
- `themes/lint-baseline.json` — sha256 + decoded-manifest fingerprint per theme.
- `scripts/scene-coverage-audit.mjs` — the audit's source code.
