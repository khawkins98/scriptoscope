# Bonn build: friction log (dogfooding round 2)

Format per item: **Trying to** / **Guidance said** / **What happened** / **Got past it by** / **Proposed fix**.

## Orientation (reading order: CLAUDE.md → authoring-a-scheme.md → authoring-exotic-frames.md → castle/halcyon)

### W1 (worked well). The reading order and two worked examples
- Trying to: learn the authoring model from scratch.
- The guide's §4.1 table + the exotic catalogue's R1–R12 were enough to plan a full frame before writing code. Castle's `frames.mjs` header comment (the per-edge recipe written as `towerL 1 | filler 13 | …`) is the single most useful artefact: it shows the cell list in one line per edge, and I copied that convention.
- `frameLayout` returning named cells (`layout.named('plate')`) removes the whole class of "art and recipe drift" bugs. Good.

### F1. R6 says "use a fixed code-1 cell for Bonn's skyline"; the allocator says code 10 is the better choice, and the catalogue doesn't connect the dots
- Trying to: decide the part code for a wide, draw-once skyline cell on the titled top edge.
- Guidance said: R6 "For art that must appear exactly once (Bonn's skyline), use a fixed code-1 cell with growers beside it (R12), not 12." (It cites R12 but R12 is code 10.) R10 says title + bezels drop when "the side is too short (TS1)". R12 says code 10 drops below template size and "below template size the web does not clamp (AW8): budgets go negative and cells overlap".
- What happened: I had to read `layoutSide()` in `src/engine/families/window.ts` to learn the actual consequence: `F` (the fixed sum, excluding 5/6 and growers) includes the skyline. When the window is narrower than `F` the **title is dropped anyway** (TS1 sets `W = 0, titleLen = 0`), and then: with code 1, the cells overlap (AW8); with code 10, the skyline is removed and the rest of the bar lays out cleanly. So for a big ornament, code 10 is strictly better than code 1 — the narrow window loses the skyline *and* title either way, but code 10 keeps the bar intact.
- Also: a wide fixed ornament directly raises the minimum titled window width (≈ sum of fixed cells). The catalogue never states "your minimum titled width = sum of codes 1/2/3/4/10 on the top edge"; that's the number a builder needs when choosing the ornament's width.
- Got past it by: reading the allocator; skyline is code 10; kept the fixed sum small.
- Proposed fix (exotic-frames R6, replace last bullet):
  > For art that must appear exactly once (a skyline), use a fixed cell with growers beside it, not 12. Prefer **code 10** over code 1 for a wide ornament: below the side's fixed sum (`F` = every code 1/2/3/4/10 width on that edge), the web drops the title anyway (TS1), and code 10 then also drops the ornament so the bar stays clean, whereas a code-1 ornament overlaps its neighbours (AW8). Your minimum *titled* width is `F` (+ the code-6 caps + ~2px), so size the ornament with that in mind.
  And `frameLayout()` could return `minTitledWidth` per titled edge so a scheme can print it.

### F1 (correction, after rendering). Code 10 does NOT protect the title; title room is the real budget
- What happened next: at 150px content the window showed the skyline but **no title at all**; at 200px "M…"; at 260px "Inactive Wi…". The title drops at `room = E − Fb − Fa ≤ 2` (TT3) long before code 10 drops (`E < F`). So the priority is inverted from what a designer wants (ornament survives, title dies), and every fixed px is a px of title room.
- Got past it by: shrinking the skyline 91→72px and the corners (22/40 → 20/36), and giving movable modals (no widgets) their own 9px corners and a 32px motif. "Inactive Window" now fits at 260.
- Proposed fix (exotic-frames, new rule after R12, "Title room budget"):
  > **The title's room is `E − (fixed + bezel widths on the top edge)`; the title is truncated when it doesn't fit and dropped entirely at room ≤ 2 (TT3).** Code 10 drops only when `E < F`, which is much narrower, so a wide ornament on a titled edge costs title room at every width, and narrow windows show the ornament without a title. Budget: `minimum width for a title of N px ≈ sum(code 1/2/3/4/6/10 widths) + N`. Keep ornaments on titled edges small; put big art on the bottom edge or on untitled windows.
  And a `frameLayout` return field: `titleRoom(windowWidth)` or at least `fixedTitled` (sum of non-growing cells on the titled top), which the build could print ("titles fit from 210px").

### F2. 256-colour cicn limit hit on the first build; no quantiser in the toolkit
- Trying to: build a 180×58 document frame with smooth widgets (§4.5's recommended `*Smooth` methods), a vertical bar gradient and a dithered river.
- Guidance said: §4.5 recommends smooth shapes and dithering; `encodeCicn` errors "more than 256 colours … reduce gradient steps or dither". Nothing tells you that smooth edges are the main colour cost (each blended edge pixel is a new colour), or how to fix it besides removing quality.
- What happened: 290 colours on the first build, all from widget edge blends (the movable modal, same frame without widgets, was 174).
- Got past it by: a 50-line `authoring/schemes/bonn/quantize.mjs` (`fitPalette`): merge the rarest colours into their nearest surviving colour until ≤254; hidden swatches are locked; per-row uniformity is preserved because a merge maps a colour to one colour everywhere.
- Proposed fix: promote `fitPalette(raster, max = 256)` to `tools/theme-author/raster.js` (or `encodeCicn(raster, { fit: true })`), and add to §4.5: "Smooth edges cost a colour per blended pixel. If `encodeCicn` reports more than 256 colours, `fitPalette()` merges the rarest blends first; flat fills and gradient rows survive."

### F3. Stray art inside tiled cells: two bugs of the same class in one build, neither caught by any check
- Trying to: paint a skyline and a pennant by named cells.
- Guidance said: R8 warns about outline pixels next to 1px fillers; §4.5 says 1px growers repeat one column. All true, but it is advice, not a check.
- What happened: (a) a blossom tree's puff reached 1px left of the skyline cell, into the code-8 grower: on wide windows it became a pink/brown horizontal line. (b) a yellow grommet on the right pennant cap reached 1px into the code-5 plate: the plate tiles every 4px, so a dotted yellow line ran behind the title ("Document·Window"). Both only visible in the browser, at sizes other than the default.
- Got past it by: a local guard `checkTiles()` in `frames.mjs` that fails the build when any column of a 5/8/11 top cell differs from the cell's first column, or the 1px bar growers differ from each other. Verified it fails on bug (b) and passes after the fix.
- Proposed fix: a checker rule (warning) in `check-scheme.js`: "a code 5/8/11/13/14 cell on any edge whose template columns (rows, on left/right) are not all identical — it tiles, so the variation repeats". It should be a warning, not an error, because multi-px textured tiles (Castle's merlons, R2) are legitimate. Multi-px tiles could be exempted when `w > 1` and the author marks them, or `frameLayout` cells could carry `uniform: true` (the default for 1px cells and code 5) and `frameLayout().lint(raster)` checks those.

### F4. My own mistake, worth a sentence in R3: wave tile phase vs. the code-0 skip
- I first required the code-0 skip width to be a multiple of the wave period "so the phase matches at the bridge". Wrong: a tile cell that is exactly one period of a pattern painted in template coordinates repeats seamlessly wherever it sits, and only cells that are **adjacent in the recipe** need to join. A one-line note in R2/R9 would save the detour: "a skipped (code 0) run doesn't break continuity between its neighbours only if they don't need to join; put it next to a fixed corner where a cut tile lands anyway."

### F5. Preview page: good for the common path, missing three things I needed
- Worked well: the header comment documents `?scheme`, `?layout`, `?active`; `data-preview-ready` makes Playwright scripting trivial; `preview-layouts/sizes.html` (narrow, long title, wide, active scroller) is exactly the right stress set and caught both F1 and F3(b).
- Missing:
  1. **No way to show every window type active at once.** `?active=<title>` matches by title, so dialogs and alerts (no title) can never be selected, and only one window is active at a time. I clicked each window in Playwright and clipped screenshots. Proposed: `?active=all` (every window `data-scriptoscope-state="active"`), and match `?active=` against `data-scriptoscope-window-type` too.
  2. **No pressed-widget or collapsed view.** Checking `-14330` art means a Playwright `mouse.down()` on `button[aria-label="Close window"]` inside the shadow root, screenshot, drag off, `mouse.up()`. Proposed: `?press=close|zoom|collapse` holding the pressed state on the active window, and `?collapsed=<title>`. Even documenting "widgets are `button[aria-label='Close window']` in the host's shadow root" in the header would have saved a probe script.
  3. **Desktop pattern (`ppat 17`) is never shown**: `#desk` has a fixed `#7f8fa3` background. Proposed: `?desktop=1` tiles the scheme's ppat 17 behind the desk (classic shows it; it's the first thing a classic user sees).
- Also: the move handle covers the whole top band including the transparent sky above the bar (R15 says this; confirmed: 390×40 handle). Fine, just noting the catalogue was right.

### F6. `frameLayout` / `stripLayout` / `pressedStripFrom`: worked as documented (no friction)
- `frameLayout` validation never fired on me, because I followed Castle's shape; its errors read well when I tried bad input mentally (12 without a recipient etc.). Named cells made the painter simple.
- `stripLayout` + `pressedStripFrom` gave working, clickable widgets first time, with silhouette-shaped hit areas. The R24 note "give utilities close only, at the document size" was the right call and is now asserted in my test.
- One gap: `frameLayout` doesn't know about the 256-colour limit or the tile-uniformity rule (F2, F3), which are where my time went.
- Small: `frameLayout` silently accepts a code-0 cell (good) but its doc comment lists only codes 1/5/6/8/11/12/13; adding "0 (skip template columns, R9) and 10 (droppable, R12)" to the header would confirm they're supported.

### F7. Dithering rules: correct and sufficient
- §4.5's rules (never dither a 1px grower; multi-px tile must be a multiple of 4; plate one colour per row; ppat dithers fine) were exactly what I needed for the 16px Rhine wave tile (dithered vertically, period 4 in x) and the frame bar (one colour per row). No surprises. The 8 bpp desktop note (exact system-palette colours, `gamma: false`) pointed at Halcyon's `menus.mjs`, which I copied the approach from.
- Suggestion: name `SYSTEM_PALETTE_256` in §5's 8 bpp bullet (it's exported but the guide doesn't mention it; I read Halcyon's source to find which colours are "exactly in the system palette").

### F8. "Which code for which effect" table: right for Castle, missing the two Bonn rows
- The table covered my wave (11 before the fixed piece, 8 after). It doesn't cover:
  | You want | Use |
  |---|---|
  | one large ornament on a titled edge, drawn once (a skyline) | code 10 between two code-8 growers (it floats midway in its half); keep it narrow, it costs title room 1:1 (F1) |
  | a bottom edge with less art than the top is wide | a code-0 cell next to a fixed corner (R9), so the skipped columns don't sit between cells that must join |
- R6 already names "Bonn's skyline" (nice foreshadowing) but steers to code 1; see F1.

### F9. Reusing another scheme's family code: possible, but parts hard-code their palette
- Trying to: add sliders, tabs, bevels, popups, progress, list headers, disclosure triangles, grow boxes quickly.
- Guidance said: §5 item 6: "Each exports `build(add, { C })`", which suggests you can pass your own palette.
- What happened: `controls.mjs` reads only 7 keys from `C` but hard-codes ~30 slate hex colours; `progress.mjs` keeps all its colours in one `family(C)` block. So importing Halcyon's parts as-is gives slate sliders in a sandstone scheme.
- Got past it by: copying both files into `bonn/` and recolouring (a hex→hex map for `controls.mjs`; replacing the `family()` block in `progress.mjs`). Took ~10 minutes and produced fully themed families, so it's a good path.
- Proposed fix: refactor Halcyon's `parts/controls.mjs` to the `progress.mjs` pattern (all colours in one `family(C)` block keyed by role), and say in §5: "To reuse a family in your scheme, copy the part file and replace its `family()` colours; geometry and engine rules carry over." Longer term these could become toolkit "family builders" taking a role palette (`buildSliders(add, { track, knob, tick, matte })`).

### F10. Small things
- `encodeCicn` error says "reduce gradient steps or dither" — dithering *adds* colours less than gradients do, but smooth edges were the real cause; message could say "smooth edges, gradients and dithers each add colours; see fitPalette".
- Castle's `scrollbars.mjs` was easy to retheme (colours in one `SB` object at the top, ~15 replacements). That's the model to copy.
- Observed (runtime, not authoring): inactive windows' scrollbars use the normal-tier art, not my inactive track; Castle shows the same. Possibly intended; not investigated.
- The build output prints sampled title/button colours — handy; it confirmed my swatches without a browser.

## What worked well (summary)
- Reading order and both worked examples; Castle's one-line recipe header per edge.
- `frameLayout` named cells; `pressedStripFrom` (clickable widgets on the first try).
- Exotic catalogue R3 (11 before / 8 after), R9 (code 0 skip), R13 (sky rows above the bar), R18 (opaque last row with a wavy bottom), R21 (which ppat feeds which body), R24 (strip rules) — all accurate.
- `npm run author` fast feedback; `checkScheme` produced zero noise; deterministic output made the "committed rsrc current" test trivial.
