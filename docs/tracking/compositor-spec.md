# Compositor spec — the authoritative window-chrome model

This is the canonical artifact for (re)building `src/composeChrome.ts`. It
consolidates the Kaleidoscope **2.3.1** kDEF decode (`kdef231-recipe-walk.md`,
decoded from `kDEF231_0.asm`) PLUS the gaps we found while implementing it. The
schemes are **K2 / 2.x format** (they ship `wnd#` recipes + `cinf`); the 2.3.1
kDEF is the engine that draws them. Earlier 1.8.2 material is historical.

The litmus: this was a small, deterministic 68k routine. The model below is
simple and GENERAL — no per-theme special cases. If an implementation needs
per-theme branches, it has the model wrong.

## The three data sources (must be used TOGETHER)

A window type provides:
1. **cicn** — the minimum-window artwork bitmap (the template the recipe indexes).
2. **wnd#** — a **rect-list** (named widget rects: close/zoom/shade/marker + the
   body) and **4 side recipes** (top/bottom/left/right), each a list of
   `(partCode:int16, border:int16)`. Walking a side gives cells
   `[border[i-1], border[i])` tagged `partCode[i]`. Borders are cicn-template
   (SOURCE) coordinates. **theme.json `part-N` IS the raw partCode (identity —
   verified).** Loader: `tools/theme-loader/decoders/wnd.js`.
3. **cinf** — per chrome element: `cornerSize`, `sideThickness`, `tileSides`,
   `patternAnchor`, and the `textPixel` / `embossPixel` (title text colour) +
   `bgPixel`. Loader: `tools/theme-loader/decoders/cinf.js`. **Currently NOT
   surfaced in theme.json or used by the compositor — this is a gap.** (In the
   corpus, all elements have `tileSides=0` ⇒ stretch, `cornerSize`≈5–7.)

The compositor we built used only #1 and #2 (recipe) and mishandled the
rect-list; #3 (cinf) was ignored. That is the root of the remaining issues.

## Part-code classification (decoded jump table `0x49d6` + `0x5178`)

Per cell, keyed PURELY on the part code (not pixel content, not width):

| code(s) | behaviour |
|---|---|
| 1, 5, 6, 7, 9, 10, default | **FIXED** — drawn 1:1 at src width. (5/6 are the title bezel: fixed when the title fits; collapse to 0 when it doesn't; never grow.) |
| 0, 8, 11, 13, 14 | **STRETCH** — even share of the slack. |
| 15, 16, 17 | stretch iff the corresponding widget is PRESENT (cinf flag); else fixed. |
| 2, 3, 4 | the close/zoom/shade GAP cells — fixed when widget present; stretch (gap fills) when absent. |
| 12 | **TILE** — like stretch but the dst width is rounded to a whole multiple of src width. |
| 18 | **SCALE** — a single scaled CopyBits (drawn once, mapped src→dst). |

## Draw + distribution

- **Cell↔partCode is END-BASED** (`0x5356`): segment i is `[border[i-1],
  border[i])` tagged `part[i]` — the part code travels with the border that
  CLOSES its cell. The segment loop (`0x4a64`) starts at index 1, so the
  pre-first-border region `[0, border[0])` is never a growing segment — it is the
  **fixed leading CORNER, drawn 1:1**. The trailing `[border[N-1], srcExtent)` is
  likewise a 1:1 corner. (Corner preservation is intrinsic to the walk — there is
  no separate cornerSize heuristic.)
- **Distribution** (`0x5178`): budget = (output edge extent − Σ fixed-cell src
  widths); each stretch cell gets `budget / numStretch` (EVEN, not proportional),
  remainder spread L→R. **Symmetric about the title:** find the title-region
  cell, split the side into left/right halves, distribute each half independently
  so the (centred) title stays centred. A half with NO stretch cell keeps its
  source width and cedes the slack to the other half (asymmetric schemes like
  1990's left-third title).
- **Per-cell blit:** the kDEF default blit (`0xfeae`) **always TILES** the src
  cell across the dst (`kdef231-recipe-walk.md` Q5) — there is no scaled CopyBits
  for ordinary fills, and `cinf.tileSides` does NOT gate it. Only code 18
  (`0x10320`) is a single scaled blit. A 1px src band ⇒ a uniform fill.
  (Correction: an earlier draft of this spec said tileSides selects tile-vs-
  stretch; the 2.3.1 decode shows the blit is unconditional tiling.)
- **Widgets ride the FIXED cells (no carving):** the close/zoom/shade widgets are
  baked into the cicn title bar, and with the end-based association they fall
  inside the wide FIXED title-bar cells (code 1) — drawn 1:1 by the edge walk,
  anchored, never tiled. Verified: 0 widgets land in a growing cell across all
  corpus window types. (An earlier model carved the rect-list widget rects out of
  stretch cells and stamped them in a second pass; that was a workaround for the
  start-based off-by-one putting widgets in stretch cells, and is now retired.)

## Title TEXT + plate

The title text is a **centred part**: positioned at the window content centre
(`cx = frame.left + contentW/2`), independent of frame growth, in the header
text colour. Drawn in `renderWindow.ts`.

The **title PLATE** (the "pill" behind the text) is the chrome side of the same
mechanism, decoded at kDEF `0x4a64`: the kDEF measures the title via `StringWidth`
($A888 → `fp@(-2)`), gates it (title-fits at `0x4f58`), then sizes the title-
anchor cell's DEST span to that **measured title-text width**, centred (`0x5034`;
the `/2` at `0x4ff8`/`0x501c`). That anchor cell is **code 5** — flanked by
code-6 bezels (`0x4f74`/`0x4f90`) — and its src (a 1px pill column in 1138) is
tiled across the reserved width (`0xfeae`); the two fill halves pin to its edges.
So the plate **grows to fit the title**, not the other way round. Implemented:
`renderWindow` passes the measured `titleWidthPx` into `composeWindowChrome`;
`distributeSide` grows the code-5 cell to it (code-6 fixed); the edge walk tiles
the plate src across it. Without this the plate stays its tiny src width and dark
header text spills onto the bezel (the 1138 symptom).

## Validation cases (the reference images are ground truth)

Render at a few sizes and compare to `demo/assets/references/<slug>.png`:
- **1138**: clean platinum title bar (pinstripe = code 8) that FILLS as it
  widens; close box anchored left, zoom/shade right; title centred; corners fixed.
- **1990**: camo/LED border; the "1990" + star drawn once; rods stretch.
- **1984**: gray bar, light-blue centred title, button row drawn once.
- **evolution**: metallic pipe border, "XPe" once, white centred title, no stray
  dark box beside the title.
- **beos**: yellow tab, clean uniform thin border that fills the bottom.

## Status / remaining

The model above is implemented in `composeChrome.ts` and the corpus renders
faithfully (see `glitch-punchlist.md`). Resolved since the first draft: tile-not-
stretch blit, end-based cell association, grounded corners, and the retirement of
the widget-carving + cornerSize-split heuristics (widgets ride fixed cells now).
Open:
1. **`cinf` is not surfaced/used** (cornerSize / sideThickness / tileSides /
   textPixel). The corpus ships no window `cinf`, so the compositor derives the
   corner from the recipe and tiles unconditionally — faithful for this corpus,
   but a scheme that DID ship a window cinf wouldn't be honoured.
2. **Structured wide fills** at very large sizes (camo/pipes): tiling keeps the
   texture; a couple of corner joints read marginally off at extreme widths (M5).
3. **1984 title-bar arch** (V1b): a baked tab-curve in a `part-15` stretch cell
   that exceeds the corner — the one remaining ornament-in-stretch-cell case.

## References
- `kdef231-recipe-walk.md` — the full part-code / draw decode, from the
  Kaleidoscope **2.3.1** kDEF (the engine our K2 schemes use). The source of
  truth behind this spec. (The decompiled asm itself — `/tmp/kaleido-trace/
  kDEF231_0.asm` — is the ground truth; this doc + the recipe-walk are summaries,
  so verify against the asm when they disagree with a reference render.)
- `diagnostic-tooling.md` — the in-browser slice inspector + the
  `diag:render` / `diag:audit` CLIs for validating against the reference images.
