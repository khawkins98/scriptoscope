# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Scriptoscope is a web-native runtime that renders classic Mac **Kaleidoscope** themes using their original binary resources (`cicn`, `wnd#`, `cinf`, `ppat`, `Colr`). The window-chrome compositor (`src/composeChrome.ts`) is a **clean-room reimplementation of the decompiled Kaleidoscope 2.3.1 kDEF** (a 68k `WDEF`), driven by a part-code jump table. Scriptoscope does **not** hand-author chrome — it replays the binary's rendering model.

Status: prototype mode, pre-1.0. The maintainer commits directly to the working branch; external contributions arrive via PR against `main`. (Consumer attribute surface: `data-scriptoscope-*` attributes, `.scriptoscope-*` CSS classes, `ScriptoscopeWindow` class — these went through a full sweep on 2026-05-29 reversing an earlier "Lodash-kept-`_`" decision; see `LEARNINGS.md` "Full `data-scriptoscope-*` sweep" entry.)

## Commands

```sh
npm install
npm run dev          # vite, http://localhost:5173 — opens demo/index.html (the ad-style landing); the interactive demo lives at /showcase.html; the dev/contributor showcase + per-scheme inspectors live at /diagnostic.html
npm run preview:demo # serve the PROD bundle locally at http://localhost:4173/scriptoscope/ — catches bundling/minification regressions before push (the dev server hides them, then GH Pages silently fails)
# Dev/prod CSS parity: vite.config.js's `serve-scriptoscope-css` middleware
# serves src/scriptoscope.css at /scriptoscope.css in dev (matching prod's
# build-time copy). Without it, every CSS rule silently fails in dev — see
# LEARNINGS 2026-05-31 "Two :root blocks" for the prior failure mode.
npm run typecheck    # tsc --noEmit (the primary correctness gate in prototype mode)
npm test             # node --test on tools/theme-loader/*.test.mjs, tools/sit-wasm/*.test.mjs, src/declarative/*.test.mjs, src/*.test.mjs
npm run build        # vite build + tsc -p tsconfig.build.json (library output to dist/)
npm run build:demo   # builds the GitHub Pages demo
npm run test:rendering # required browser contracts: all 18 themes, source/built and real DOM/CSS
npm run test:rendering:extended # broader valid combinations, browsers and DPR
npm run test:rendering:container -- verify # pinned Linux golden comparison (Docker required)
# Golden updates create candidates for review, never proof of original fidelity.
# See tests/rendering-options/README.md and tests/rendering-options/CI.md for setup and coverage limits.

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

The runtime is a short pipeline: theme bundle → loader → compositor → pixel buffer → `<canvas>`. Scheme chrome and control art are drawn into pixel buffers; live content and native inputs remain DOM. CSS controls layout, pixel scaling, focus and optional window shadows, so visual acceptance must inspect actual DOM as well as buffers. Reviewed regression goldens do not certify full original-engine fidelity; known control-face limits are tracked in [#218](https://github.com/khawkins98/scriptoscope/issues/218).

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
- `proceduralFrameChrome.ts` + `engine/families/proceduralFrame.ts` — window chrome for the 5 schemes that ship no `wnd#` recipe (`apple-platinum-2`, `platinum-8`, `system7-nostalgia-silver`, `black-platinum`, `slimes`). They draw kDEF 0's decoded built-in frame (`docs/spec/engine/procedural-frame.md`), with colours sampled from the scheme's own frame cicns. (`composeCornerSprite.ts` is deleted.)
- `renderWindow.ts` — composes chrome + title text + body into a `<canvas>`.
- `controls.ts` — themed (cicn-rendered) widgets: buttons, scrollbars, sliders, progress, tabs, list headers.
- `platinum.ts` — procedural gray-Platinum fallback for the controls a scheme *omits* and defers to the OS. The discriminator is empirical: load the bundle and **inspect `theme.manifest.chromeElements`** (or re-bake with `npm run build:themes` and grep the local-only `themes/<slug>/theme.json`) before wiring a control — themed chrome is cicn-rendered, plain form widgets are CSS/procedurally drawn.
- `loadTheme.ts` — fetches a bundle directory (prefers `scheme.sit`, then falls back to `scheme.rsrc`), decodes the resource fork in-browser via `loadKaleidoscopeScheme`, and returns a `LoadedTheme` whose `chromeElements` + `patterns` assets are `blob:` URLs over OffscreenCanvases. **Resources resolve by their structured `source<X>Id` field, never by parsing the asset path** — paths become blob URLs that don't carry the id. Live cases: `chromeElement.sourceCicnId` (`src/controls.ts:elementById`), `chromeElement.sourceCinfId` (typed-only), `pattern.sourcePpatId` (`src/renderWindow.ts:patternByResourceId`). **This bug class has bitten three times in two months; read the LEARNINGS.md "Option-A blob URLs break asset-path-based id lookups" entry before writing any new resource-lookup helper.**
- `declarative/theme.ts` — resolver owns themes it loads; `dispose()` invalidates pending work and releases owned assets. Registration borrows the complete base graph. Scanner disconnect unmounts windows before disposal; owner lifetime notifications cancel owned preparation; per-blob release notifications evict image caches across bundled/raw module copies.
- `declarative/pickerIcons.ts` — folder-only background previews via `loadKaleidoscopeIcon`; does not load whole themes. Active theme previews reuse the resolver result. Display labels are not complete provenance: only explicit `ThemeEntry.meta` replaces the parallel `meta.json` fetch.
- `ownedTheme.ts` — explicit `ThemeInput`/internal `ThemeView` boundary for all low-level renderers. Capture `view.asset(ref)` synchronously from the selected owner before awaiting work. Owned manifests keep local paths; a realm-wide source-to-owner WeakMap supports source/built copies. There is no global raw-reference registry or private URI image decoder. Existing eager loaders remain compatible; `mountOwnedDeclarative` and `createOwnedThemeResolver` share the existing scanner/lifecycle; default eager contracts remain supported. Main demo loading/drops use the owned path; diagnostic catalog images export on demand in PR #480. See `docs/v2/owned-theme-api.md`.
- `baseChain.ts` — `LoadedTheme.base` inheritance walker (`resolveInChain`). Sparse bundles like `apple-platinum-2` defer to a base scheme (the consumer picks via `mountDeclarative({ baseSlug })`).
- `pixelBuffer.ts` — the offscreen QuickDraw-style buffer everything draws into.
- `textRaster.ts` — Charcoal 12 / Virtue bitmap title rasterizer (uses an ink-tight buffer; the compositor centres it).
- `declarative/` — the `data-scriptoscope-*` consumption layer (separate public entry — `mountDeclarative`, `ScriptoscopeWindow`, `promoteButton`, `parseWindowAttrs`, `openModal`). Dispatches `scriptoscope:ready`, `scriptoscope:promoted`, `scriptoscope:retheme`, `scriptoscope:promoteError`, `scriptoscope:unmounted` on the handle + `scriptoscope:close` (before unmount) + `scriptoscope:userresize` (after grow-box) on the host. Does **not** modify the runtime; imports it directly.
- `interactive.ts` — `WindowManager` + interactive widget wrappers (buttons, checkboxes, sliders, scrollbars, title widgets). Also owns the drag/resize handoff: an in-flow host converts to `position: absolute` on first pointer-drag / keyboard-arrow move / grow-box resize (Posture B, see below). The handoff inserts a `<div data-scriptoscope-placeholder>` in the host's static slot to reserve flow (siblings don't collapse upward); the placeholder is cleaned up in `WindowManager.remove`.

### Declarative layout model (Posture B, 2026-05-31)

The consumption layer defaults to **in-flow hosts** (`position: static`, inline cleared so consumer-class CSS for `position` is respected). Setting `data-scriptoscope-x` or `-y` opts into absolute positioning; the drag handler flips static→absolute on the first move so a dragged window lifts cleanly out of flow.

**Sizing contract (#526, 2026-10-30).** Measured and capped sizes are OUTER-box bounds: the auto-captured rect of the source element, `data-scriptoscope-extra-width/-height` added to it, and px `max-width`/`max-height` caps read from the host's computed style. The chrome is fitted inside them (content = bound − the current scheme's frame, re-derived on retheme, so content reflows when the frame changes). Declared `data-scriptoscope-width/-height` stay CONTENT dimensions, with the frame drawn outside them. The conversion lives in one place: `WindowManager.setOuterSize` / `add(..., { outerSize })` resolve the bound against the frame the prepared render actually composed (`prepareRender`), and `chromeExtent(host)` exposes that frame to the declarative layer. Every commit pins the host's inline `width`/`height` to the full chrome, so host box = canvas in every mode (in-flow included) and the drag placeholder is chrome-sized. A collapsed window keeps its width bound; while zoomed, `setOuterSize` updates the saved pre-zoom (user-state) bound that unzoom restores, not the zoomed window (#542).

A shared `ResizeObserver` is wired whenever at least one dimension is un-declared, so content growing after promote (picker tiles populated by the runtime, async-loaded images) auto-fits the chrome. The fit only GROWS past the captured baseline; baselines and the last fit are outer sizes (the measured content plus the frame). A 30 px / 500 ms growth warning fires once per window with a copy-paste hint pointing at `data-scriptoscope-extra-width/-height`.

Auto-fit is terminated when the user grow-box-resizes: `WindowManager` dispatches a bubbling `scriptoscope:userresize` event on commit, and `ScriptoscopeWindow.acceptUserSize(w, h)` unobserves the shared RO for that window. After a user resize, the chrome stays at the user's chosen size regardless of subsequent content growth (it's a "I'm in charge now" signal). Subsequent content overflow scrolls via the themed Kaleidoscope scrollbar.

Ten host CSS properties are locked down via inline styles (`display`, `box-sizing`, `padding`, `border`, `background`, `overflow`, `margin`, `transform`, `filter`, `contain`) so inherited consumer classes can't break the host↔chrome box correspondence. Consumer styles for color/font/position/custom-properties still apply. The set grows monotonically; see the Posture B LEARNINGS entry for the history.

**Geometry mutation chokepoint:** all `host.style.left/top` changes route through `WindowManager.setPosition(host, x, y)` and `WindowManager.toAbsolute(host)` in `src/interactive.ts` (~lines 680-720). Drag commit, keyboard-arrow move, Posture-B handoff, cross-tab restore, and the initial absolute placement on promote all funnel through them. The pointermove hot loop (around line 1199) intentionally bypasses for 60Hz smoothness; pointerup commits through `setPosition`. Don't introduce a new `host.style.left = …` site outside that hot loop — reach for the chokepoint instead.

**Read `src/declarative/ScriptoscopeWindow.ts:promote` first when touching this layer** — the comment blocks at lines 85-103 (Posture B narrative) and 260-310 (lockdown rationale + chokepoint routing) are the authoritative narrative. The `LEARNINGS.md` "2026-05-31 — The layout-patch chain" and "2026-06-01 — Post-Posture-B polish" entries have the design history.

### Theme bundles (`themes/<slug>/`)

Each bundle is a directory containing the original archive (`scheme.sit` preferred — the upstream StuffIt the author published; `scheme.rsrc` fallback for wayback-recovered schemes whose `.sit` is no longer reachable), `meta.json` (author/origin/license — `origin.originalLicense` is the readme-stated terms verbatim), and `PROVENANCE.md`. The runtime decodes the archive in-browser via `loadKaleidoscopeScheme` (the same path the demo drop-zone uses). Pre-extracted artifacts (`theme.json`, `cicns/`, `ppats/`, `icons/`, `resource-roles.json`, `rasters.json`, `extraction-manifest.json`) are produced on-demand by `npm run build:themes` for local lint / diag / audit work but are gitignored — see `.gitignore`'s "Option A (2026-05-29)" block. **Never infer a resource's role from its filename slug or id** — re-bake locally and read the generated `resource-roles.json` (the same id has different roles per scheme and per cicn/ics4 channel).

The corpus (18 bundles): `1138`, `1984`, `1990`, `animals`, `apple-lisa`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `crayon-os`, `dolphin-som`, `evolution`, `floppies`, `monkey-paradise`, `platinum-8`, `slimes`, `system7-nostalgia-silver`, `windows-31`, `windows-95`. `apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes` and `system7-nostalgia-silver` ship no `wnd#` recipe and use corner-sprite window rendering (model `corner-sprite`). Their original drawing path is decoded: Kaleidoscope's own built-in window definition at kDEF `0x11ee2–0x1525a` (`docs/spec/engine/procedural-frame.md`). The runtime draws that decoded frame for document, dialog, alert, modal and utility windows (#412, #421). Collapsed no-title utility windows still render expanded (#423).

## Working norms (project-specific — these override common reflexes)

- **Faithful to the decode, never hack the compositor.** When a render is wrong, fix the kDEF interpretation against the 2.3.1 decompile — don't add a per-theme branch. If the model needs per-theme special cases, it has the model wrong.
- **Clean-room only.** Never ship the original 68k code, and never run it as Scriptoscope's runtime. Running it inside the private reference emulator for research and native captures is allowed (see `docs/maintainer-reference-environment.md`). The compositor mimics the binary's behaviour; it does not contain it.
- **Detect divergence statically, not by eyeballing.** `npm run lint:themes` + the `kdef-faithfulness-ledger` are the proactive nets. Reach for `diag:render` to confirm a hypothesis, not as the first move.
- **Reference image first.** When the user surfaces a "glitchy" render, check the reference image in `themes/<slug>/` *before* iterating — structural rewrites beat reactive fixes.
- **Discriminator first.** Before wiring any control, grep the bundle's `chromeElements` to know whether it's themed (cicn-rendered) or plain (CSS-drawn).
- **Don't infer roles from slugs or ids.** Read `themes/<slug>/resource-roles.json`. The same id (e.g. `-10239`) is a button cicn in one scheme and a checkbox ics4 in another.
- **Mac 1.8 → sRGB 2.2 gamma is a conversion-time transform.** It lives in `tools/theme-loader/mac-gamma.js` and is applied by default by the theme-loader conversion (`convert.js`, used by both runtime loading and local bakes; a supplied measured display profile replaces it), never in the decoders — `lint:themes` and `resource-roles` need raw bytes. Native 32 bpp comparisons must say whether they compare the default display policy or an analysis-only pre-gamma plane (not a public runtime mode).
- **Fidelity evidence is lean and rules-first.** Follow CONTRIBUTING's "Fidelity acquisition and implementation batches": source-addressed rule tables across all themes first, native captures as sampled spot checks (many observations per boot, predictions frozen before boot), compact committed evidence with raw native data kept private by sha256, a named capture condition (8-bit calibrated vs 32 bpp direct, never pooled), and an independent review that proves each check can fail.
- **Prototype-mode commit cadence.** Batch into bigger commits; delete non-critical tests; skip non-critical PRs; commit directly to the working branch. Commit messages follow Conventional Commits with a detailed body, **no `Co-Authored-By:` line**.
- **Doc sweep after heavy iteration days.** See [`docs/doc-sweep.md`](./docs/doc-sweep.md) — run after any 5+ commit day to keep the four context docs (this file + LEARNINGS + README + integration-edge-cases) synced with code reality. Heavy days drift docs fast; the sweep is ~20 minutes and prevents every future session paying 5-10 minutes of "doc says X, code says Y" reconciliation.

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
