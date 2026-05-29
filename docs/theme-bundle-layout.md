# Theme bundle layout

How an Scriptoscope theme bundle is organized on disk after the **Option A migration (2026-05-29)**: bundles ship only the original archive, the runtime decodes it in-browser. The in-memory `ThemeManifest` shape that used to serialise to `theme.json` is codified in [`src/types.ts`](../src/types.ts). How the runtime composites a decoded bundle is the kDEF model in [`docs/spec/compositor-spec.md`](./spec/compositor-spec.md) + [`docs/spec/kdef231-recipe-walk.md`](./spec/kdef231-recipe-walk.md).

## What's actually shipped (in git)

A canonical bundle lives at `themes/<scheme-slug>/`:

```
themes/<scheme-slug>/
├── scheme.sit                 # preferred: original StuffIt archive the author published
│                              # — or —
├── scheme.rsrc                # fallback: unwrapped resource fork (wayback-recovered schemes
│                              #   where the .sit is no longer reachable)
├── meta.json                  # hand-authored provenance sidecar (author/origin/license)
└── PROVENANCE.md              # human-readable origin + license record
```

That's it. Three files (sometimes two — bundles with `.sit` don't keep the `.rsrc`). The repo went from ~55 MB to 6.3 MB across 18 bundles when this layout shipped.

## What `npm run build:themes` produces locally (gitignored)

The bake pipeline is still useful for **local diagnostics** (lint-themes' `--update` mode, audit-placement, render-window, the inspector's reference data). It writes into the same `themes/<slug>/` directory but every output path below is `.gitignore`'d:

```
themes/<scheme-slug>/
├── theme.json                 # schema-conformant bundle manifest (generated, gitignored)
├── extraction-manifest.json   # generated diagnostic record of every decoded resource
├── rasters.json               # cicn + ppat catalog (used by demo inspector)
├── resource-roles.json        # per-id role classification (used by lint + demo inspector)
├── cicns/                     # chrome bitmaps decoded to PNG
│   ├── cicn-n14335-active-document-window.png
│   ├── cicn-n14336-inactive-document-window.png
│   └── …
├── ppats/                     # tile patterns
│   ├── ppat-17-desktop-background.png
│   └── …
├── icons/                     # icon-suite PNGs (icl4/icl8/ics4/ics8)
└── diag/                      # per-window-type render PNGs from `npm run diag:render`
```

Everything in this block is rebuilt from `scheme.sit`/`scheme.rsrc` + `meta.json`. The hand-authored inputs are only `scheme.sit` (or `.rsrc`), `meta.json`, and `PROVENANCE.md`.

## Files

### `scheme.sit` / `scheme.rsrc`

The source archive, committed alongside the bundle. The runtime's decoder (`loadKaleidoscopeScheme` in `tools/theme-loader/`) accepts both forms:

- **`scheme.sit`** is the preferred form — the original StuffIt archive the author published, redistribution-friendly (we ship the bits the author shipped, not a derivative). Decoded via the bundled `tools/sit-wasm/` munbox WASM (lazy-loaded on first `.sit` access).
- **`scheme.rsrc`** is the fallback — the unwrapped resource fork. Used when the upstream `.sit` is no longer reachable (e.g. wayback-recovered schemes like 1138, 1990, evolution, black-platinum, system7-nostalgia-silver).

`loadTheme(bundleUrl)` races them (`scheme.sit` first, then `scheme.rsrc`); the catalog's `themes-manifest.json` carries a `source` field per-bundle so consumers can skip the cascade.

### `meta.json`

Hand-authored sidecar carrying everything the binary archive doesn't: bundle name, author, license, source URL. `loadKaleidoscopeScheme` reads it via the consumer's options (passed by `loadTheme` after fetching the bundle's `meta.json`) and merges it into the in-memory `ThemeManifest`. Shape (from `themes/beos-r503/meta.json`):

```json
{
  "name": "BeOS R5.0.3",
  "author": {
    "name": "Jon Alexander",
    "email": "jon1101@chartermi.net",
    "year": 2002
  },
  "origin": {
    "kind": "kaleidoscope-port",
    "originalFormat": "ksc",
    "originalLicense": "Freeware Kaleidoscope scheme. BeOS r5.0.3 ©2002 Jon Alexander. …",
    "sourceUrl": "https://kaleidoscope.hryjksn.com/"
  }
}
```

`originalLicense` should be the verbatim license string from the scheme's own readme — not a SPDX identifier or our paraphrase. Keep the source's words intact.

### `PROVENANCE.md`

Human-readable companion: original author, source URL, readme excerpt, our license interpretation, and why this scheme is in the corpus. Markdown so it renders on GitHub. See `themes/beos-r503/PROVENANCE.md` (or any current corpus bundle's) as the canonical example.

The `PROVENANCE.md` and `meta.json` carry the same factual info in different forms — markdown for humans, JSON for the runtime. They must agree. If they ever drift, `PROVENANCE.md` is authoritative (human-curated) and `meta.json` should be corrected to match.

## URL convention at runtime

When the runtime loads a bundle via `loadTheme("/themes/beos-r503/")`:

1. **Race** `/themes/beos-r503/scheme.sit` and `/themes/beos-r503/scheme.rsrc` (sit first; rsrc fallback). With an `opts.source` hint from `themes-manifest.json`, the runtime fetches the right one directly.
2. **Fetch** `/themes/beos-r503/meta.json` (optional — silently absent → use defaults).
3. **Decode in-browser** via `loadKaleidoscopeScheme`: containers → resource fork → cicns + ppats + icons + windowTypes. StuffIt unpacking lazy-loads the ~70 KB munbox WASM only when a `.sit` is encountered.
4. **Encode** every decoded RGBA asset to a `blob:` URL via `OffscreenCanvas` (parallelised — `Promise.all` over ~500 assets per scheme; ~234 ms total on a fast machine).
5. **Rewrite** every asset path in the manifest to its blob URL. The returned `LoadedTheme` carries `manifest.chromeElements[*].asset = "blob:…"`; callers route through `assetUrl()` which passes blob URLs through unchanged.

No PNG file fetches happen after step 4 — the entire bundle is in-memory. A `LoadedTheme` works identically from any bundle URL: Vite dev server, GH Pages CDN, inlined inside an npm package, or in-memory from a dropped `.sit` (the BYO path).

## Regenerating local derivatives

```sh
# Re-bake one bundle (after updating its meta.json or to chase a renderer change):
node scripts/extract-scheme.mjs beos-r503
node scripts/extract-icons.mjs beos-r503

# Re-bake every bundle + regenerate the demo's themes-manifest.json:
npm run build:themes
```

`extract-scheme.mjs` reads `themes/<slug>/scheme.sit`/`scheme.rsrc` + `meta.json`, decodes the resources, writes the PNGs into `cicns/`/`ppats/`, runs `buildThemeJson` with `meta.json` merged in plus the decoded header cluts, validates via `validateTheme`, and writes `theme.json` + `extraction-manifest.json`. All of these outputs are gitignored — the runtime doesn't read them; only the on-disk diagnostic scripts (`diag:render`, `diag:audit`, `lint:themes --update`) do.

## Porting a new scheme

The full porting flow is in [`docs/porting-a-kaleidoscope-scheme.md`](./porting-a-kaleidoscope-scheme.md) (condensed in [`CONTRIBUTING.md`](../CONTRIBUTING.md#adding-a-theme-porting-a-kaleidoscope-scheme)). Short version:

1. Verify the scheme's readme grants redistribution rights.
2. Drop the original `.sit` (preferred) at `themes/<slug>/scheme.sit` — or unwrapped `.rsrc` if no `.sit` is reachable — and author `meta.json` + `PROVENANCE.md` beside it.
3. Run `npm run import -- <slug>` for a guided one-command flow, or `node scripts/extract-scheme.mjs <slug>` for the bare bake.
4. Run `npm run lint:themes -- --update <slug>` to lint + refresh the baseline.
5. Run `npm run baseline:scenes -- <slug>` to capture the Scene panel for visual regression.
6. Open a PR with the bundle, the updated `themes/lint-baseline.json`, and the captured scene baseline.

## What's *not* in a bundle

Per LEARNINGS 2026-05-16 "Themes don't bring sounds or desktop backgrounds":

- No `sounds/` — Kaleidoscope schemes in practice didn't carry them; Scriptoscope doesn't fabricate them.
- No `desktop.png` — same reason.
- No `fonts/` — Mac OS supplied system fonts; the corpus assumes them present.

A future `extras/` sidecar concept may permit opt-in sounds/desktop/fonts for first-party preset bundles (see PRD §What ported themes carry), but it's not a runtime built-in.

## Source-of-truth pairing

| Concern | Where |
|---|---|
| `.sit`/`.rsrc` decode (runtime + Node) | [`tools/theme-loader/`](../tools/theme-loader/) (loadKaleidoscopeScheme.js + convert.js + resource-fork.js + decoders/) |
| StuffIt unpack | [`tools/sit-wasm/`](../tools/sit-wasm/) (munbox C library compiled to WASM) |
| `ThemeManifest` shape | [`src/types.ts`](../src/types.ts) |
| `ThemeManifest` validator | [`tools/theme-loader/validateTheme.js`](../tools/theme-loader/validateTheme.js) |
| Decoder → ThemeManifest builder | [`tools/theme-loader/buildThemeJson.js`](../tools/theme-loader/buildThemeJson.js) |
| Resource role classifier (browser + Node) | [`tools/theme-loader/classifyResources.js`](../tools/theme-loader/classifyResources.js) |
| How the compositor draws a bundle | [`docs/spec/compositor-spec.md`](./spec/compositor-spec.md) + [`docs/spec/kdef231-recipe-walk.md`](./spec/kdef231-recipe-walk.md) (model); [`src/composeChrome.ts`](../src/composeChrome.ts) + [`src/renderWindow.ts`](../src/renderWindow.ts) (impl) |
| Local-only bake pipeline | [`scripts/extract-scheme.mjs`](../scripts/extract-scheme.mjs) + [`scripts/extract-icons.mjs`](../scripts/extract-icons.mjs) |
| Fingerprint lint baseline | [`themes/lint-baseline.json`](../themes/lint-baseline.json) + [`scripts/lint-themes.mjs`](../scripts/lint-themes.mjs) |
| Visual regression fixtures | [`tests/visual-baselines/`](../tests/visual-baselines/) + [`scripts/capture-visual-baselines.mjs`](../scripts/capture-visual-baselines.mjs) |
| Canonical bundle layout *(this doc)* | `docs/theme-bundle-layout.md` |
