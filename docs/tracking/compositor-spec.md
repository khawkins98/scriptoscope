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

- **Distribution** (`0x5178`): budget = (output edge extent − Σ fixed-cell src
  widths); each stretch cell gets `budget / numStretch` (EVEN, not proportional),
  remainder spread L→R. **Symmetric about the title:** find the title-region
  cell, split the side into left/right halves, distribute each half independently
  so the (centred) title stays centred.
- **Per-cell blit:** the kDEF default blit (`0xfeae`) **always TILES** the src
  cell across the dst (`kdef231-recipe-walk.md` Q5) — there is no scaled CopyBits
  for ordinary fills, and `cinf.tileSides` does NOT gate it. Only code 18
  (`0x10320`) is a single scaled blit. A 1px src band ⇒ a uniform fill.
  (Correction: an earlier draft of this spec said tileSides selects tile-vs-
  stretch; the 2.3.1 decode shows the blit is unconditional tiling.)
- **THE WIDGET GAP (the bug that produced garbage):** widgets are BAKED INTO the
  cicn inside stretch cells (e.g. 1138's zoom/shade live inside the code-8
  pinstripe band at cicn x75–95). You must NOT tile/scale that baked art across
  the grown cell. Instead: **carve the rect-list widget rects out of the stretch
  cell** — draw the fill segments around them (stretch/tile), and draw each
  widget ONCE from its rect-list rect, anchored. As the fill grows, left widgets
  stay left and right widgets ride the right edge automatically (the fill before
  a right widget absorbs the slack). This is the kDEF's widget anchoring.

## Title TEXT (separate from the frame)

The title text is a **centred part** (placement mode 0, kDEF `0x35b0`/§9.4):
positioned at the window content centre (`cx = frame.left + contentW/2`),
independent of frame growth, in the cicn's text-colour (the `textPixel`/marker;
white for evolution, blue for 1984, etc., NOT the clut). Already implemented in
`renderWindow.ts`. Vertical band comes from the marker rect's y-extent.

## Validation cases (the reference images are ground truth)

Render at a few sizes and compare to `demo/assets/references/<slug>.png`:
- **1138**: clean platinum title bar (pinstripe = code 8) that FILLS as it
  widens; close box anchored left, zoom/shade right; title centred; corners fixed.
- **1990**: camo/LED border; the "1990" + star drawn once; rods stretch.
- **1984**: gray bar, light-blue centred title, button row drawn once.
- **evolution**: metallic pipe border, "XPe" once, white centred title, no stray
  dark box beside the title.
- **beos**: yellow tab, clean uniform thin border that fills the bottom.

## Known gaps to close in the rebuild

1. **Surface `cinf`** (cornerSize / sideThickness / tileSides / textPixel) into
   the theme data + use it (corner size, tile-vs-stretch, title colour/position).
   Needs an extractor pass + the runtime loader.
2. **Carve rect-list widgets out of stretch cells** (the anchoring above) instead
   of clean-filling + stamping — so widget regions stay crisp and the fill keeps
   its texture instead of collapsing to one sampled column.
3. **Structured wide fills** (camo/pipes): decide scale-band vs tile-per-cinf so
   they keep texture instead of reading flat. Validate against the references.
4. **Rewrite `diag:audit`** to the part-code model (its invariants assume the old
   model — "code 0 fixed", "no tile" — and now throw ~163 false warnings).

## References
- `kdef231-recipe-walk.md` — the full part-code / draw decode, from the
  Kaleidoscope **2.3.1** kDEF (the engine our K2 schemes use). The source of
  truth behind this spec. (The decompiled asm itself — `/tmp/kaleido-trace/
  kDEF231_0.asm` — is the ground truth; this doc + the recipe-walk are summaries,
  so verify against the asm when they disagree with a reference render.)
- `diagnostic-tooling.md` — the in-browser slice inspector + the
  `diag:render` / `diag:audit` CLIs for validating against the reference images.
