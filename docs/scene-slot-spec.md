# Scene slot spec

The hand-authored contract for every visual SLOT the demo's Scene panel composes.
Each slot is a small piece of the live render (the info bar, the volume icon, the
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

Implemented in: `demo/index.html buildScene`.

### `volume-icon` — Info-bar leading slot

The small (16px) icon that sits left of the volume name in the info bar.

| Tier | Source field | Why |
|---|---|---|
| T1 | `ics4/ics8 -3790` | Mac OS volume info icon — the canonical Finder slot for this position. |
| T2 | `ics4/ics8 -14336` | Document-window collapse-widget glyph. Schemes that don't theme -3790 (slimes, apple-platinum-2, platinum-8, …) typically draw a small theme-mark on -14336. |
| T3 | `FINDER_GRID_PNG` | Neutral Platinum-era grid, sliced from the reference screenshot. Hard fallback. |

Implemented in: `demo/index.html gridProxyIcon`.

The icon's transparency is preserved — placing the `<img>` on a coloured info
bar lets the bar fill show through the icon's transparent pixels. Owner-spotted
on slimes where `ics8 -14336` has ~50% transparent coverage.

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

Implemented in: `demo/index.html buildScene` (the `desk` element).

### `folder-scene-icons` — Folder/scene icons inside the body

Up to 8 32px icons rendered as the Finder window's "contents" in the Scene.

| Tier | Source field | Why |
|---|---|---|
| T1 | `iconIndex` filter for `FINDER_CONTENT_ICON_IDS` (`-3983` System Folder, `-3999` Generic Folder, `-3997` Open, `-3994`, `-3976`) | Standard Mac System-icon ids the Finder always used. When a scheme themes folders, these are the ids it themes. |
| T2 | Coverage-ranked icl4/8 at `size=32` with 18–95% opaque pixels | A scheme themes scene icons under non-folder ids; fall back to the most coverage-rich ones (skip near-blank and full-bleed). |
| T3 | Neutral SVG folders | Fall-through for schemes that theme NO icl/icl8 icons at all (1990 used to land here; apple-platinum-2, system7-nostalgia-silver still do). |

Implemented in: `demo/index.html schemeIcons`. Prefer the HIGHEST depth per id
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
