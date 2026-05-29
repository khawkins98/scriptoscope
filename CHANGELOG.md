# Changelog

All notable changes to Scriptoscope, in reverse chronological order. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows semver,
with the pre-1.0 caveat that the public API may change without a major bump while the
declarative front door, theme schema, and consumer-facing class names stabilize.

## [Unreleased]

### Fixed (rendering — 18 themes refreshed via the codex pattern, 2026-05-29)

The decoded `ThemeManifest` carries structured answers for every visual slot;
the runtime was guessing or hardcoding in many places. The fixes below all
share the same shape: **read the manifest field instead**. Captured in
`LEARNINGS.md`'s "codex pattern" entry as a 16-row table.

- `controls.ts:elementById` — resolve by `chromeElement.sourceCicnId` (numeric)
  instead of regex-on-asset-path. Asset paths become `blob:` URLs under the
  Option A in-memory load; the regex matched nothing, every `elementById` call
  returned null, buttons / default-rings / textAnchors silently un-themed.
- Default-button ring outset uses `(ring.width - face.width) / 2` (the
  artist-authored halo) when ring > face, instead of `ring.width / 4`. Crayon-os
  (ring 80×80 / face 74×74) went from 20px outset to the authored 3.
- `pixelBuffer.nineSlice` honours `slice.tile: true` (repeat side bands at
  native pixel rate rather than stretching). Wired into `composeFaceButton` +
  ring + `composeProgress` frame + `composeTab` middle + `composeScrollbar` +
  `composeSlider` tracks. Apple-lisa Lisa-frame, windows-31 double-rectangle
  border, crayon-os crayon-stroke patterns all preserved at button-display size.
- `pixelBuffer.nineSlice` honours `slice.side` for vertical inset (was
  collapsed to corner=side everywhere). The kDEF TMPL 129 declares them
  independently; 1138 / 1984 / animals / apple-lisa / dolphin-som etc. all
  have button-family elements with non-square slices.
- `pixelBuffer.nineSlice` clamps `(l+r) ≤ sr.w` and `(t+b) ≤ sr.h` —
  unclamped, the negative middle silently corrupted (corner blits overlapped,
  side spans early-returned) on 1990 + evolution rings authored as 21×21 with
  `slice.side=14`. The buggy renders briefly shipped before this clamp.
- `composeChrome.titleFillRgb` samples the kDEF 0x5530 title-text marker
  pixel; `renderWindow` uses the sampled colour when it contrasts with the
  bar (|markerLum − barLum| > 40), else falls back to the luminance-contrast
  B/W pick. Windows-31 "Hello!" now draws (the marker pixel sits on the dark
  blue title bg; contrast-rejection routes to the white fallback).
- `resolveTitleWidgetRects` maps source-x widget positions through the
  per-cell placement record to output-x. 1990's widgets stacked left of a
  growable title plate were claimed to be at source x=56-64 when the plate's
  growth had shifted them to output x≈92-100; the title-fit math saw negative
  available width and dropped the title. The `mapX(sx)` per-cell mapping now
  produces correct output positions; 1990 / apple-lisa / windows-31 "Hello!"
  all render.
- `loadTheme` preserves `bundleUrl` as `theme.baseUrl` (was `''` under
  Option A's in-memory decode). The empty key collapsed every theme into the
  first-loaded theme's slot in `_gridCache` / `_iconCache` /
  `interactive.titleStripCache` — 1138's folder icons leaked into 1984's
  Scene preview.

### Fixed (controls — push-button face resolves by manifest role, 2026-05-29)

- `composeButton` now resolves the push-button face via the manifest's
  STRUCTURED chromeElement key (`push-button-active` / `active-push-button`
  / `active-button` / `push-button`) first; falls back to id-based lookup
  that REJECTS anti-role keys (`/menu|tab-pane|pull-down|popup|window|dialog|scroll/`).
  When no active face exists, substitutes the pressed face — the
  AppearanceManager's documented "empty state slot" fallback. Resolves the
  long-deferred **monkey-paradise + animals** misroute: both bundles assign
  id -10239 to `solo-menu-background-2` and ship NO active push-button cicn
  (only pressed + inactive). Their OK button slot rendered menu wallpaper;
  it now renders the pressed-button face the author shipped. Logged in the
  kdef faithfulness ledger as an Accepted Divergence.

### Fixed (Scene composition — `demo/index.html` + slot wiring)

- Info bar lookup: `chromeElement(-9567).bgPattern` → `bodyBackground.pattern`
  → `headerColors.active.fill` → flat. Replaces the hardcoded `#e6e6e6`.
  Every theme now lands above the hard fallback. monkey-paradise's
  `ppat-129` (declared via cinf), 1990's army-camo, slimes' lemon-lime
  header fill — all picked up from the structured field rather than guessed.
- Volume icon lookup: `ics4/8 -3790` → `ics4/8 -14336` → `FINDER_GRID_PNG`.
  Slimes / floppies / apple-platinum-2 / platinum-8 / system7-nostalgia-
  silver pick up their theme-mark on `-14336` when `-3790` isn't shipped.
- Info-bar text colour contrast-picks against the resolved background
  luminance instead of hardcoded `#000`. Black-platinum / Windows-ports
  dark fills are legible now.
- `schemeIcons` excludes well-known document ids (Clippings -3800..-3803,
  Edition File -3989, App badge -16455) from coverage-rank, and drops the
  non-folder last-resort ids from the folder priority list. Apple-platinum-2
  + system7-nostalgia-silver fall through to neutral SVG folders instead
  of showing the Earth icon / App badge.
- Desktop pattern: adds `ppat-17` (Apple-reserved Mac OS canonical id) as
  T2 in the lookup. 1990 / animals / monkey-paradise / evolution / crayon-os
  ship it; previously fell to the CSS checkerboard.
- `renderWindow.bodyBackgroundStyle` skips the Icon-View ppat for modal-
  style windowTypes (`UTILITY_SLUG_RE = /utility|mini|floating|palette|dialog|alert|modal|popup/`).
  The Options dialog body across every textured-body theme stopped filling
  with the army-camo / aqua / etc and now matches the references' flat
  utility surface.
- 3-tone procedural pinstripe via `lightTinge → fill → darkTinge` (was
  only `darkTinge`; `lightTinge` was decoded but unconsumed). Only the
  `buildBaselineWindow` procedural path is affected; corner-sprite + sliced
  paths use their own pinstripe sprites.
- Scene geometry: `winW: 178 → 220` so multi-word volume names fit;
  `dlgTop: mainTop + 2` so the Options dialog stops covering windows-31's
  title bar entirely.

### Fixed (loadTheme + cascade hardening)

- `fetchFirst` rejects 200-with-bad-bytes (HTML SPA fallback) and continues
  the `.sit → .rsrc` cascade. Without it, a misconfigured CDN serving HTML
  for missing files made `parseResourceFork` explode with
  `dataOffset=1008813135` instead of falling through.
- `loadKaleidoscopeScheme` default asset factory adds a main-thread
  `<canvas>` fallback for Safari 16.0–16.3 (where `OffscreenCanvas` is
  undefined). Without it, ~5% of iOS traffic returned a broken `LoadedTheme`
  with un-rewritten asset paths.

### Added

- **Codex framework** — three coupled artifacts for "stop guessing, read
  the manifest field" discipline:
  - `scripts/scene-coverage-audit.mjs` — walks every bundle's decoded
    manifest, runs each Scene SLOT's tier resolver, prints per-theme
    table; modes: console / `--write` / `--json` / `--check` / `--theme=`.
  - `docs/scene-slot-spec.md` — hand-authored slot contract: 8 slots
    each with tier hierarchy, why each tier exists, where the runtime /
    demo implements it.
  - `docs/scene-codex.md` — auto-generated; committed; the corpus-wide
    audit. Per-theme tier table + tier distribution per slot + shipped
    resource counts + variant flags.
- `tests/visual-baselines/scenes/<slug>.png` — committed Scene-panel
  fixtures per theme. Regen via `npm run baseline:scenes`. Eyeball
  comparison net against the per-theme reference for "the path ran but
  produced empty / wrong-looking output" regressions (lint can't catch).
- `themes/lint-baseline.json` — sha256 + decoded-manifest fingerprint
  per slug from the maintainer's last full lint run. Default
  `npm run lint:themes` is fast-verify against this baseline;
  `--update` re-runs the slow rule walk; `--strict` re-decodes + checks
  the decoded fingerprint (CI signal).
- `npm run audit:scenes` — codex audit; `-- --check` is the CI signal
  for slot floor.
- `npm run baseline:scenes` — re-capture all 18 scene fixtures.
- New `ChromeElement` type fields, JSDoc-documented: `sourceCicnId`,
  `sourceCinfId`, `bgPattern`, `bgAnchor`, `embossAnchor`.
- New `ThemeManifest.patterns` field — the catalog of decoded ppats
  keyed by slug.
- New `ThemeProgressModel`, `ThemeScrollArrowMap` types covering the
  inspector catalog's role-classification shapes.
- `ButtonOptions.height` — caller-supplied override for the button face
  height. Without it, themes with big face cicns (crayon-os 74×74) blow
  up to 80-tall buttons. The demo passes `height: 22` for tab-sized
  cells.
- `LoadedTheme.dispose?: () => void` — revokes blob: URLs minted at
  decode (~500 per scheme). Without it, switching themes 50× leaks
  ~25k blob URLs.
- `loadTheme(url, opts.source?: string)` — hint to skip the
  `.sit → .rsrc` cascade. Catalog's `themes-manifest.json` carries
  the `source` field per slug; demo's `loadWithBase` passes it.

### Changed (renderer surface)

- `composeChrome` returns new `titleFillRgb` field on `ComposedChrome`
  (the sampled marker colour or null). Backwards-compat (optional).
- `bodyBackgroundStyle` now takes an optional `slug` parameter so it
  can gate the Icon-View ppat by windowType. Shared
  `UTILITY_SLUG_RE` between `renderWindow` and the body-bg style.

### Changed

- **Theme bundles ship only the original archive** (Option A migration, 2026-05-29).
  Per-bundle contents went from `{scheme.rsrc, theme.json, cicns/, ppats/, icons/,
  resource-roles.json, rasters.json, extraction-manifest.json, meta.json, PROVENANCE.md}`
  to just `{scheme.sit | scheme.rsrc, meta.json, PROVENANCE.md}`. The runtime decodes
  the archive in-browser via the bundled StuffIt + Kaleidoscope decoders — same path
  the demo's drop-zone has used since 2026-05-27. Repo footprint dropped from ~55 MB
  to 6.3 MB across 18 bundles. Per-bundle wire weight halved (the `.sit` averages
  ~30–50% of the unwrapped fork size). Per-load decode cost ~234 ms on a fast machine
  (Promise.all-parallelised OffscreenCanvas encoding); cached after first hit.
- **`loadTheme(bundleUrl, opts?)` gains `opts.source`** — a hint that names which file
  to fetch (`'scheme.sit' | 'scheme.rsrc' | string`). Skips the cascade and the 404
  noise when a bundle ships only one form. The demo reads it from `themes-manifest.json`'s
  new `source` field per slug.
- **Control resolution uses `chromeElement.sourceCicnId` rather than parsing the asset path.**
  Path strings get rewritten to `blob:` URLs by `rewriteAssetRefs`, so the old
  `/cicn-n?-?(\d+)/` regex broke silently — every `elementById` call returned null and
  default-button rings / scrollbar arrows / textAnchors went un-themed. The decoder
  already writes `sourceCicnId` on every element; the runtime now reads it directly.
  Full story in `LEARNINGS.md`'s 2026-05-29 entry.
- **`loadTheme` preserves the consumer-passed URL as `theme.baseUrl`** instead of
  inheriting the decoder's `''` default — `interactive.ts`'s title-strip cache and
  the demo's per-theme icon caches key on `baseUrl`, so an empty key was collapsing
  every theme into the first-loaded theme's identity (1138's folder icons leaking
  into 1984's Scene preview).

### Added

- **In-memory inspector catalog** on `LoadedTheme.inspector` — `iconIndex` + `cicns` +
  `ppats` + `resourceRoles`, each with baked-in blob URLs. Mirrors the on-disk shapes
  the demo's diagnostic panels used to fetch (`icons/index.json`, `rasters.json`,
  `resource-roles.json`). Built by `loadKaleidoscopeScheme` for browser callers; pure
  JS, no extra fetches.
- **`loadKaleidoscopeScheme` re-exported from `'scriptoscope'`** — the in-browser
  `.sit`/`.rsrc` decoder is reachable through the npm-package entry without crossing
  into `tools/theme-loader/` paths. Returns the same `LoadedTheme` `loadTheme` does.
- **`tests/visual-baselines/scenes/<slug>.png`** — committed Scene-panel fixtures per
  theme. Regen via `npm run baseline:scenes`. Eyeball comparison net for renderer
  regressions of the un-themed-but-no-error class.
- **`themes/lint-baseline.json`** — committed sha256 + status per slug from the
  maintainer's last full lint run. Default `npm run lint:themes` is a fast verify
  pass against this baseline; `--update` re-runs the slow rule walk; `--strict`
  exits 1 on drift (CI signal).
- **`tools/theme-loader/classifyResources.js`** — the portable id → role rubric,
  shared between the bake pipeline and the runtime inspector. Closes the dual-channel
  trap (same id different roles per scheme + per cicn/ics4 channel).
- **`fetchFirst` cascade hardening** in `loadTheme` — rejects 200-with-bad-bytes (HTML
  SPA fallback responses) and continues to the `.rsrc` alternative, instead of
  consuming the HTML and exploding deep in `parseResourceFork`.

### Removed

- `apple-platinum-replica` bundle — was a generated universal base that retired when
  the in-memory decode replaced its main consumer (the sparse-bundle inheritance hop).
  `mountDeclarative({ baseSlug })` callers can pick any other shipped slug as the base.
- The on-disk parity test in `tools/theme-loader/convert.test.mjs`. The replacement is
  the in-memory shape test (asserts every asset rewrites to a URL, inspector populates)
  + the lint baseline sha256.

## [0.0.1] — 2026-05-28

**First publish-prep cut.** No code changes from the prior committed state — this is the
mechanical packaging pass that gets the project on npm. The runtime is already feature-rich
(Phase 3 controls vocabulary shipped; declarative front door + Shadow DOM + persistence +
themed scrollbars + tabs + text fields + a four-page demo suite); this version exists so
consumers can `npm install scriptoscope` and start integrating.

### Renamed

- Project: **Aaron UI → Scriptoscope**. Rationale + scope in `LEARNINGS.md` 2026-05-28
  ("Scriptoscope pivot"). Forcing function: the `aaron-ui` npm name was taken by an
  unrelated package, so the publish couldn't go bare under the prior brand.
- Package: `scriptoscope` (was `aaron-ui`, never published under that name).
- Build artifacts: `dist/aaron-ui.js` → `dist/scriptoscope.js`, `src/aaron-ui.css` →
  `src/scriptoscope.css`, exports map updated.
- The GitHub repo (`khawkins98/aaron-ui`) and the GH Pages URL (`/aaron-ui/`) stay as-is
  for now — independent pivot, not coupled to the npm rename.

### Preserved (deliberate API stability)

- `data-aaron-*` consumer attribute namespace (window/title/x/y/width/height/state/
  button/default/control/field/tabs/etc.). Renaming this would be an API break with
  marginal brand value.
- `.aw-*` CSS class prefix (`.aw-window`, `.aw-content`, `.aw-button`, `.aw-chrome`, etc.).
- `AaronWindow` class name, exported from the declarative entry.
- Same model as underscore.js → Lodash keeping `_`.

### Tarball scope

- Slim: `dist/` + `README.md` + `LICENSE` + `CHANGELOG.md`. **NOT** included: `src/`,
  `themes/`, `PRD.md`, `LEARNINGS.md`, `docs/`, `tools/`. Consumers use the built
  `dist/scriptoscope.js` and fetch themes from a base URL they host. Packaged size:
  ~239 KB; unpacked ~782 KB (sourcemaps + .d.ts.map files account for the bulk of the
  unpacked footprint — kept for IDE jump-to-definition).

### License

- MIT (decided in #26; first-party code only). The slim tarball ships only `dist/` + the
  three top-level docs, so per-scheme freeware terms (themes), munbox MIT (sit-wasm),
  and demo-font terms (CC BY-SA / free-with-credit) are repo-level concerns — relevant
  for source-tree contributors, not consumers of the published package.

### Status

- Pre-alpha. The declarative API surface is the most stable; the imperative API
  (`loadTheme()`, `renderWindow()`, `WindowManager`) is also stable but may grow.
- 0.0.x cadence intentional — see `LEARNINGS.md` for the prototype-mode commit-cadence rule.

[Unreleased]: https://github.com/khawkins98/aaron-ui/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/khawkins98/aaron-ui/releases/tag/v0.0.1
