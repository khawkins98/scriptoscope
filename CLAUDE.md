# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Scriptoscope is a web-native runtime that renders classic Mac **Kaleidoscope** themes 1:1 from their original binary resources (`cicn`, `wnd#`, `cinf`, `ppat`, `Colr`). The window-chrome compositor (`src/composeChrome.ts`) is a **clean-room reimplementation of the decompiled Kaleidoscope 2.3.1 kDEF** (a 68k `WDEF`), driven by a part-code jump table. Scriptoscope does **not** hand-author chrome — it replays the binary's rendering model.

Status: prototype mode, pre-1.0. The maintainer commits directly to the working branch; external contributions arrive via PR against `main`. (Internal API surface — `data-aaron-*` attributes, `.aw-*` CSS classes, `AaronWindow` class — is intentionally stable across the package rebrand from Aaron UI; see `LEARNINGS.md` 2026-05-28 Scriptoscope pivot.)

## Commands

```sh
npm install
npm run dev          # vite, http://localhost:5173 — opens demo/index.html
npm run typecheck    # tsc --noEmit (the primary correctness gate in prototype mode)
npm test             # node --test on scripts/generate-platinum/*.test.mjs, tools/theme-loader/*.test.mjs, tools/sit-wasm/*.test.mjs, src/declarative/*.test.mjs
npm run build        # vite build + tsc -p tsconfig.build.json (library output to dist/)
npm run build:demo   # builds the GitHub Pages demo

# Theme pipeline
npm run import -- <slug>   # one-command port for a single scheme in themes/<slug>/ (extract chrome + icons + rasters + roles + lint + report card)
npm run build:themes       # re-extract every theme bundle (extract-scheme --all + extract-icons --all + index-rasters + gen-resource-roles + gen-themes-manifest)
npm run lint:themes        # validate every theme bundle (proactive divergence detection — preferred over eyeballing renders)

# Diagnostics
npm run diag:render        # render a window off a bundle to a PNG for eyeballing
npm run diag:audit         # audit part placement against the recipe
```

Run a single test file: `node --experimental-strip-types --test path/to/file.test.mjs`.

## Architecture

The runtime is a short pipeline: theme bundle → loader → compositor → pixel buffer → `<canvas>`. CSS does **only** positioning + integer upscale (`image-rendering: pixelated`); everything visual is drawn into a pixel buffer.

### The five layers (kept separable for a possible future repo split)

1. **Conversion** — `tools/theme-loader/` (`.rsrc` → `theme.json`, pure/portable, no fs/zlib/canvas/src deps), plus `tools/sit-wasm/` (StuffIt decoder for the in-browser drop-zone).
2. **Asset I/O shells** — PNG encode / OffscreenCanvas wrappers.
3. **Runtime** — `src/` (the published library).
4. **Visualization / controls** — themed (`src/controls.ts`, cicn-rendered) + procedural Platinum fallback (`src/platinum.ts`) for widgets a scheme omits.
5. **Debug UI** — `demo/`.

Dependencies are acyclic: demo → {runtime, conversion}; conversion → nothing app-specific. The seam between layers is the `theme.json` contract in `src/types.ts` (`ThemeManifest`).

### Key files in `src/`

- `index.ts` — public exports (`loadTheme`, `renderWindow`, `composeWindowChrome`, controls, declarative is a separate entry).
- `composeChrome.ts` — the heart of the project. Clean-room replay of the 2.3.1 kDEF, driven by `wnd#` rect-list + 4 side recipes (`(partCode, border)` pairs). Part-code classification (FIXED / STRETCH / TILE / SCALE / FLAG-GATED) is in `docs/spec/compositor-spec.md`.
- `composeCornerSprite.ts` — alternative chrome path for the 4 corner-sprite schemes (`apple-platinum-2`, `platinum-8`, `system7-nostalgia-silver`, `black-platinum`) that draw the frame procedurally coloured by `headerColors` rather than 9-slicing a cicn template.
- `renderWindow.ts` — composes chrome + title text + body into a `<canvas>`.
- `controls.ts` — themed (cicn-rendered) widgets: buttons, scrollbars, sliders, progress, tabs, list headers.
- `platinum.ts` — procedural gray-Platinum fallback for the controls a scheme *omits* and defers to the OS. The discriminator is empirical: **grep `chromeElements` in `theme.json` before wiring a control** — themed chrome is cicn-rendered, plain form widgets are CSS/procedurally drawn.
- `loadTheme.ts` — fetches a bundle directory and indexes every chrome element by **resource id**. Controls resolve by id, never by bundle slug.
- `baseChain.ts` — `LoadedTheme.base` inheritance walker (`resolveInChain`). `apple-platinum-replica` is the generated universal base; sparse bundles like `apple-platinum-2` defer to it.
- `pixelBuffer.ts` — the offscreen QuickDraw-style buffer everything draws into.
- `textRaster.ts` — Charcoal 12 / Virtue bitmap title rasterizer (uses an ink-tight buffer; the compositor centres it).
- `declarative/` — the `data-aaron-*` consumption layer (separate public entry — `mountDeclarative`, `AaronWindow`, `promoteButton`, `parseWindowAttrs`). Does **not** modify the runtime; imports it directly.
- `interactive.ts` — `WindowManager` + interactive widget wrappers (buttons, checkboxes, sliders, scrollbars, title widgets).

### Theme bundles (`themes/<slug>/`)

Each bundle is a directory containing the original `scheme.rsrc`, a decoded `theme.json`, decoded PNGs (`cicns/`, `ppats/`, `icons/`), `meta.json` (author/origin/license — `origin.originalLicense` is the readme-stated terms verbatim), `PROVENANCE.md`, `resource-roles.json`, and `rasters.json`. **Never infer a resource's role from its filename slug or id** — read `resource-roles.json` (the same id has different roles per scheme and per cicn/ics4 channel).

The corpus: `1138`, `1984`, `1990`, `apple-platinum-2`, `apple-platinum-replica` (generated universal base), `beos-r503`, `black-platinum`, `evolution`, `platinum-8`, `system7-nostalgia-silver`. `platinum-8` and `system7-nostalgia-silver` are controls-only (no window recipes).

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

- `docs/history.md` — full project arc (v1 → v2 clean-break → v3) and the **"Dead ends — don't relitigate these"** list. Read first.
- `docs/spec/kdef-architecture.md` — the "how does it work?" tour.
- `docs/spec/compositor-spec.md` — the authoritative window-chrome model (the implemented spec).
- `docs/spec/kdef231-reference.md` — standing 2.3.1 kDEF lookup: every routine address, resource id, struct offset, coordinate mapping. First stop for "where is X?".
- `docs/spec/kdef231-recipe-walk.md` — decoded recipe walk (truth).
- `docs/spec/kdef-faithfulness-ledger.md` — every deliberate divergence from the binary, with intent.
- `docs/spec/platinum-controls-decode.md` + `platinum-wdef125-decode.md` — Platinum CDEF/WDEF decodes.
- `docs/theme-bundle-layout.md` — `theme.json` schema.
- `docs/porting-a-kaleidoscope-scheme.md` — full porting walk-through.
- `docs/adr/0001` — the consumption-layer architecture decision (CSS-first hybrid, Shadow DOM, `data-aaron-*` front door).
- `LEARNINGS.md` — running log of gotchas; the historical record matters, so mark superseded entries rather than deleting them.
