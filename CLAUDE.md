# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Scriptoscope is a web-native runtime that renders classic Mac **Kaleidoscope** themes 1:1 from their original binary resources (`cicn`, `wnd#`, `cinf`, `ppat`, `Colr`). The window-chrome compositor (`src/composeChrome.ts`) is a **clean-room reimplementation of the decompiled Kaleidoscope 2.3.1 kDEF** (a 68k `WDEF`), driven by a part-code jump table. Scriptoscope does **not** hand-author chrome — it replays the binary's rendering model.

Status: prototype mode, pre-1.0. The maintainer commits directly to the working branch; external contributions arrive via PR against `main`. (Consumer attribute surface: `data-scriptoscope-*` attributes, `.scriptoscope-*` CSS classes, `ScriptoscopeWindow` class — these went through a full sweep on 2026-05-29 reversing an earlier "Lodash-kept-`_`" decision; see `LEARNINGS.md` "Full `data-scriptoscope-*` sweep" entry.)

## Commands

```sh
npm install
npm run dev          # vite, http://localhost:5173 — opens demo/index.html (the consumer landing); the dev/contributor showcase + per-scheme inspectors live at /diagnostic.html
npm run preview:demo # serve the PROD bundle locally at http://localhost:4173/aaron-ui/ — catches bundling/minification regressions before push (the dev server hides them, then GH Pages silently fails)
npm run typecheck    # tsc --noEmit (the primary correctness gate in prototype mode)
npm test             # node --test on tools/theme-loader/*.test.mjs, tools/sit-wasm/*.test.mjs, src/declarative/*.test.mjs
npm run build        # vite build + tsc -p tsconfig.build.json (library output to dist/)
npm run build:demo   # builds the GitHub Pages demo

# Theme pipeline (Option A — bundles ship source-of-truth only; the bake commands below
# write into gitignored themes/<slug>/ paths for LOCAL diag, never committed)
npm run import -- <slug>   # one-command port: places a fresh scheme.sit/.rsrc + scaffolds meta.json + locally re-bakes for diag
npm run build:themes       # locally re-bake every bundle (extract-scheme + extract-icons + index-rasters + gen-resource-roles + gen-themes-manifest)
npm run lint:themes        # default: VERIFY each source archive's sha256 against themes/lint-baseline.json (fast)
npm run lint:themes -- --update   # re-lint in-memory + refresh the baseline (slow path — after a renderer or rule change)
npm run lint:themes -- --strict   # verify-mode + re-decode + check decodedSha256 fingerprint, exits 1 on any drift (CI signal)
npm run lint:themes -- --decoded  # like default but ALSO re-decodes + checks decodedSha256 (catches tools/theme-loader regressions that don't change source bytes)
npm run baseline:scenes    # re-capture per-theme Scene panel into tests/visual-baselines/scenes/<slug>.png (eyeball regression check)
npm run verify:scenes      # capture fresh + byte-diff against committed baselines (exit 1 on drift; --diff-only skips the capture)
npm run audit:scenes       # walk every bundle, audit per-slot tier resolution (10 slots), print per-theme table
npm run audit:scenes -- --write   # regenerate docs/scene-codex.md from the audit
npm run audit:scenes -- --check   # CI signal: exit 1 if any slot fell to its hard fallback (for slots where the floor is a regression candidate)
npm run gates              # umbrella pre-push gate: typecheck + test + lint --strict + audit --check (use this before pushing)

# Diagnostics (consume the locally-baked derivatives — run `build:themes` first if needed)
npm run diag:render        # render a window off a bundle to a PNG for eyeballing
npm run diag:audit         # audit part placement against the recipe
```

Run a single test file: `node --experimental-strip-types --test path/to/file.test.mjs`.

## Architecture

The runtime is a short pipeline: theme bundle → loader → compositor → pixel buffer → `<canvas>`. CSS does **only** positioning + integer upscale (`image-rendering: pixelated`); everything visual is drawn into a pixel buffer.

### The five layers (kept separable for a possible future repo split)

1. **Conversion** — `tools/theme-loader/` (`.sit`/`.rsrc` → in-memory `LoadedTheme`, pure/portable, no fs/zlib/canvas/src deps), plus `tools/sit-wasm/` (StuffIt decoder used by both the drop-zone and the runtime `.sit` path; lazy-loaded — `.rsrc` skips it). **Runtime dependency, not just a build-time tool**: `src/loadTheme.ts` calls `loadKaleidoscopeScheme` on every bundle load.
2. **Asset I/O shells** — PNG encode / OffscreenCanvas wrappers.
3. **Runtime** — `src/` (the published library).
4. **Visualization / controls** — themed (`src/controls.ts`, cicn-rendered) + procedural Platinum fallback (`src/platinum.ts`) for widgets a scheme omits.
5. **Debug UI** — `demo/`.

Dependencies are acyclic: demo → {runtime, conversion}; conversion → nothing app-specific. The seam between layers is the in-memory `LoadedTheme` / `ThemeManifest` shape in `src/types.ts` (the same shape the retired `theme.json` used to serialise — bundles no longer ship it on disk, but the contract is unchanged).

### Key files in `src/`

- `index.ts` — public exports (`loadTheme`, `renderWindow`, `composeWindowChrome`, controls, declarative is a separate entry).
- `composeChrome.ts` — the heart of the project. Clean-room replay of the 2.3.1 kDEF, driven by `wnd#` rect-list + 4 side recipes (`(partCode, border)` pairs). Part-code classification (FIXED / STRETCH / TILE / SCALE / FLAG-GATED) is in `docs/spec/compositor-spec.md`.
- `composeCornerSprite.ts` — alternative chrome path for the 4 corner-sprite schemes (`apple-platinum-2`, `platinum-8`, `system7-nostalgia-silver`, `black-platinum`) that draw the frame procedurally coloured by `headerColors` rather than 9-slicing a cicn template.
- `renderWindow.ts` — composes chrome + title text + body into a `<canvas>`.
- `controls.ts` — themed (cicn-rendered) widgets: buttons, scrollbars, sliders, progress, tabs, list headers.
- `platinum.ts` — procedural gray-Platinum fallback for the controls a scheme *omits* and defers to the OS. The discriminator is empirical: load the bundle and **inspect `theme.manifest.chromeElements`** (or re-bake with `npm run build:themes` and grep the local-only `themes/<slug>/theme.json`) before wiring a control — themed chrome is cicn-rendered, plain form widgets are CSS/procedurally drawn.
- `loadTheme.ts` — fetches a bundle directory (races `scheme.sit` → `scheme.rsrc`), decodes the resource fork in-browser via `loadKaleidoscopeScheme`, and returns a `LoadedTheme` whose `chromeElements` + `patterns` assets are `blob:` URLs over OffscreenCanvases. **Resources resolve by their structured `source<X>Id` field, never by parsing the asset path** — paths become blob URLs that don't carry the id. Live cases: `chromeElement.sourceCicnId` (`src/controls.ts:elementById`), `chromeElement.sourceCinfId` (typed-only), `pattern.sourcePpatId` (`src/renderWindow.ts:patternByResourceId`). **This bug class has bitten three times in two months; read the LEARNINGS.md "Option-A blob URLs break asset-path-based id lookups" entry before writing any new resource-lookup helper.**
- `baseChain.ts` — `LoadedTheme.base` inheritance walker (`resolveInChain`). Sparse bundles like `apple-platinum-2` defer to a base scheme (the consumer picks via `mountDeclarative({ baseSlug })`).
- `pixelBuffer.ts` — the offscreen QuickDraw-style buffer everything draws into.
- `textRaster.ts` — Charcoal 12 / Virtue bitmap title rasterizer (uses an ink-tight buffer; the compositor centres it).
- `declarative/` — the `data-scriptoscope-*` consumption layer (separate public entry — `mountDeclarative`, `ScriptoscopeWindow`, `promoteButton`, `parseWindowAttrs`). Does **not** modify the runtime; imports it directly.
- `interactive.ts` — `WindowManager` + interactive widget wrappers (buttons, checkboxes, sliders, scrollbars, title widgets).

### Theme bundles (`themes/<slug>/`)

Each bundle is a directory containing the original archive (`scheme.sit` preferred — the upstream StuffIt the author published; `scheme.rsrc` fallback for wayback-recovered schemes whose `.sit` is no longer reachable), `meta.json` (author/origin/license — `origin.originalLicense` is the readme-stated terms verbatim), and `PROVENANCE.md`. The runtime decodes the archive in-browser via `loadKaleidoscopeScheme` (the same path the demo drop-zone uses). Pre-extracted artifacts (`theme.json`, `cicns/`, `ppats/`, `icons/`, `resource-roles.json`, `rasters.json`, `extraction-manifest.json`) are produced on-demand by `npm run build:themes` for local lint / diag / audit work but are gitignored — see `.gitignore`'s "Option A (2026-05-29)" block. **Never infer a resource's role from its filename slug or id** — re-bake locally and read the generated `resource-roles.json` (the same id has different roles per scheme and per cicn/ics4 channel).

The corpus (18 bundles): `1138`, `1984`, `1990`, `animals`, `apple-lisa`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `crayon-os`, `dolphin-som`, `evolution`, `floppies`, `monkey-paradise`, `platinum-8`, `slimes`, `system7-nostalgia-silver`, `windows-31`, `windows-95`. `platinum-8` and `system7-nostalgia-silver` are controls-only (no window recipes).

## Working norms (project-specific — these override common reflexes)

- **Faithful to the decode, never hack the compositor.** When a render is wrong, fix the kDEF interpretation against the 2.3.1 decompile — don't add a per-theme branch. If the model needs per-theme special cases, it has the model wrong.
- **Clean-room only.** Never re-ship or execute the original 68k code. The compositor mimics the binary's behaviour; it does not contain it.
- **Detect divergence statically, not by eyeballing.** `npm run lint:themes` + the `kdef-faithfulness-ledger` are the proactive nets. Reach for `diag:render` to confirm a hypothesis, not as the first move.
- **Reference image first.** When the user surfaces a "glitchy" render, check the reference image in `themes/<slug>/` *before* iterating — structural rewrites beat reactive fixes.
- **Discriminator first.** Before wiring any control, grep the bundle's `chromeElements` to know whether it's themed (cicn-rendered) or plain (CSS-drawn).
- **Don't infer roles from slugs or ids.** Read `themes/<slug>/resource-roles.json`. The same id (e.g. `-10239`) is a button cicn in one scheme and a checkbox ics4 in another.
- **Mac 1.8 → sRGB 2.2 gamma is a BAKE-time transform.** It lives in `scripts/lib/mac-gamma.mjs` and runs during `extract-scheme` / `extract-icons`. It does **not** belong in decoders — `lint:themes` and `resource-roles` need raw bytes.
- **Prototype-mode commit cadence.** Batch into bigger commits; delete non-critical tests; skip non-critical PRs; commit directly to the working branch. Commit messages follow Conventional Commits with a detailed body, **no `Co-Authored-By:` line**.

## Pointers into `docs/`

- `docs/spec/README.md` — index of every primary-source decode under `docs/spec/` (citation chain: corpus → Scheme Factory → Apple → kDEF231 → kDEF182). Start there when chasing "what does id/field/address X mean?".
- `docs/history.md` — full project arc (v1 → v2 clean-break → v3) and the **"Dead ends — don't relitigate these"** list. Read first.
- `docs/spec/kdef-architecture.md` — the "how does it work?" tour.
- `docs/spec/compositor-spec.md` — the authoritative window-chrome model (the implemented spec).
- `docs/spec/kdef231-reference.md` — standing 2.3.1 kDEF lookup: every routine address, resource id, struct offset, coordinate mapping. First stop for "where is X?".
- `docs/spec/kdef231-recipe-walk.md` — decoded recipe walk (truth).
- `docs/spec/kdef-faithfulness-ledger.md` — every deliberate divergence from the binary, with intent.
- `docs/spec/platinum-controls-decode.md` + `platinum-wdef125-decode.md` — Platinum CDEF/WDEF decodes.
- **`docs/spec/corpus-corroborated-ids.md`** — author-supplied NAMED resource labels aggregated across 17 of 18 bundles (6,842 labels). The **primary source** for "what role does id X play". Refresh: `node scripts/dump-author-hints.mjs`.
- **`docs/spec/apple-primary-source.md`** — Apple `Appearance.h` / `IconsCore.h` / `MacWindows.h` enum tables (kThemeBrush*, kThemeTextColor*, kThemeWidget*, kGenericFolderIconResource, etc.). The Apple-side role pegs Kaleidoscope schemes were authored against.
- `docs/spec/kaleidoscope-author-docs.md` — surviving Kaleidoscope-era public docs (Companion + FAQ + Scheme Factory tutorial) with archived Wayback URLs.
- `docs/spec/kdef182-disassembly-findings.md` — May 2026 Kaleidoscope 1.8.2 binary archaeology. Establishes structural facts: QuickDraw + CopyBits, kDEF themes surroundings + Appearance Manager draws controls, only 4 hardcoded `_GetResource` calls.
- `docs/spec/apple-appearancelib-spike.md` + `apple-cdef-{geometry,button-geometry}.md` — Apple Mac OS 8.5 System file decompile. DrawThemeButton TVector decoded (thin dispatcher → theme-provider vtable +0xCC, data/drawer split).
- `docs/theme-bundle-layout.md` — `theme.json` schema.
- `docs/porting-a-kaleidoscope-scheme.md` — full porting walk-through.
- `docs/adr/0001` — the consumption-layer architecture decision. **Decision 1 RETIRED (2026-05-28)** after three CSS-emitter spike rounds couldn't reach fidelity on exotic schemes (BeOS asymmetric title bar, etc.); architecture is now explicitly "DOM structure + canvas decoration" — what already ships. Decisions 2 (Shadow DOM), 3 (`data-scriptoscope-*` front door), 4 (ingestion) all accepted/shipped.
- `LEARNINGS.md` — running log of gotchas; the historical record matters, so mark superseded entries rather than deleting them.
