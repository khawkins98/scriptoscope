# Changelog

All notable changes to Scriptoscope, in reverse chronological order. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows semver,
with the pre-1.0 caveat that the public API may change without a major bump while the
declarative front door, theme schema, and consumer-facing class names stabilize.

## [Unreleased]

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
