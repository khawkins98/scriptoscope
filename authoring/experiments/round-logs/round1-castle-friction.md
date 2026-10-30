# Castle scheme — friction log

Format per item: **Trying to** / **Guidance said** / **What happened** / **Got past it by** / **Proposed fix**.
"+" items are things that worked well and should be kept.

## Reading phase

### + 1. The two docs together are a very good on-ramp
- The authoring guide's "five ideas" (§4) plus the catalogue's §A "geometry model in one paragraph" gave me the
  whole mental model (template + bands + cells, content is a hole, hidden swatches) in ~15 minutes.
- The catalogue's corpus precedents (animals' whale, beos' tab, apple-lisa's code-0 bottom) let me reason about
  towers/battlements without opening the compositor. The §8 "what windowLayout() can't express" table told me on
  day one that I'd need my own layout helper, which saved a dead-end attempt.
- Keep: the per-rule *Corpus:* lines and the "Web vs classic" flags.

### 2. Catalogue R24 says checkScheme doesn't warn about a missing -14330; it now does
- **Guidance said:** `docs/authoring-exotic-frames.md:372-373` "Halcyon ships no `-14330` … `checkScheme` doesn't warn about this."
- **What happened:** `tools/theme-author/check-scheme.js` (≈ line 142-146 of the file) already pushes
  `no pressed-widget strip (cicn -14330): …` when any wnd# has widgets.
- **Proposed fix:** replace the sentence with "`checkScheme` warns when a scheme has widgets but no `-14330`."

### 3. Pressed-strip x offsets are per window: a utility window with close + collapse (no zoom) reads the *zoom* piece
- **Trying to:** give the titled utility window close + collapse (the Halcyon layout) and make both clickable.
- **Guidance said:** R24: collapse at `x = width(close) + width(zoom)`; "give utility widgets the same rect sizes as
  the document widgets, so -14330 also reads right on them."
- **What happened:** reading `stripSource()` (`src/engine/families/window.ts`, `stripAfter: [1, 2]`), the offset is
  summed over the *current window's* rects. A utility window whose zoom rect is empty puts collapse at
  `x = width(close)`, i.e. on the document's **zoom** piece. "Same rect sizes" is necessary but not sufficient: the
  utility window must also have the same *set* of widgets, or its collapse press shows zoom art.
- **Got past it by:** Castle's titled utility ships a close box only (collapse via double-click on the title, which
  the web supports without a widget). Classic users lose the utility collapse box.
- **Proposed fix (catalogue R24, add a bullet):**
  > "The offsets are summed from the *pressing window's* own rects. A utility window with close + collapse but no zoom
  > reads its collapse piece at `x = width(close)`, which is the document strip's zoom piece. Either give utility
  > windows the same widget set as the document, give them close only, or make the zoom and collapse pressed art
  > interchangeable."
- **Proposed checker rule:** for each wnd# with widgets, compute each widget's strip x from that window's rects and
  warn when two window types map *different* roles onto the same strip column range.

### 4. "Title marker ≤ 2 px wide" is an undocumented constraint hidden in composeChrome
- `src/composeChrome.ts:211-221` only treats T4 as the "title marker" when it is ≤ 2 px wide (gives `midY`). The
  catalogue (R28) says "The ≤2px marker rect gives titleRegion.midY" but not whether anything consumes it. I grepped:
  nothing in `src/` or `demo/` reads `midY`, so a wide T4 (needed for a multi-px plate source, see below) is safe.
- **Proposed fix (R28):** add "Nothing in the web runtime reads `midY` today, so a T4 wider than 2px (e.g. spanning a
  12px plate source) only loses that field."

## Building phase

### 5. windowLayout() can't express any castle feature, so I wrote `authoring/schemes/castle/frame.mjs`
- **Trying to:** use towers above the bar, multi-px merlon tiles, 12+13 pairs, code-6 caps, mid-side arrow loops and a
  bottom edge with its own cells.
- **Guidance said:** catalogue §8 lists exactly these limits and sketches the fix ("explicit per-edge cell lists").
  That sketch was enough to write the helper in about 30 minutes. **+ Keep that table.**
- **What I built:** `frameLayout({ top, bottom, left, right: [{code, w, name}], topH, sideL, sideR, bottomH, collapsed,
  title: {cell, top, bottom}, widgets })`. It returns the size, `content`, `wnd`, named cell positions
  (`layout.named('plate')` → `{x0, x1, code}`) for the painter, plus checks: widgets in fixed cells, every 12 has a
  same-allocation recipient (R4), one 12 width per allocation (R5), T4 ≥ 17px (R28). There is also `stripLayout(layout)`
  (the R24 strip x offsets).
- **Proposed fix:** move `frameLayout` + `stripLayout` into `tools/theme-author/frame-layout.js` and export them from
  `index.js`. Keep `windowLayout()` as the simple path; it could be reimplemented as a preset over `frameLayout`. The
  *named cells* part matters most: painting by cell name (`named('crenL').x0`) is what kept art and recipe in sync.

### 6. My own validator caught a real mistake on the first build (good), but the toolkit has no such check
- The utility T4 was the banner rows (13..27, 14px). `frameLayout` threw "under 17px; descenders clip (R28)". With
  `windowLayout()` this can't happen because T4 is always `2..top−2`. With any hand-written wnd#, nothing catches it.
- **Proposed checker rule (warning):** "wnd# N: title rect T4 is H px tall; the web baseline is T4.bottom − 4 and a
  13px title needs ≈17px (R28)", firing when `T4.bottom − T4.top < clamp(A.top − 6, 8, 13) + 4`.

### 7. A 1px code-13 filler next to a transparent column becomes a dark block (my bug; worth a guide line)
- **What happened:** the first render showed a dark ~10px block beside each tower on wide windows. My tower shaft
  was inset 1px on both sides, so the filler column next to it touched a transparent pixel and my outline pass
  painted the whole column in outline colour. Code 13 then repeated that column across the leftover width.
- **Got past it by:** insetting the shaft on its outer side only.
- **Proposed guide text (§4.5 or catalogue R8):** "A grower or filler source column is repeated as it is, outline
  pixels included. If you run an outline/edge pass over the template, check that each 1px grower or filler column
  isn't next to a transparent pixel, or the outline gets tiled into a solid bar."
- **Proposed checker rule (warning):** flag a code 8/11/13/14 cell of width 1 whose source column is ≥ 80% one dark
  colour while its neighbours aren't. That's a heuristic, so it should be a warning at most.

### 8. `paintCoverage` / `fillRoundRectSmooth` reject fractional boxes, but the comment says coordinates are continuous
- **Guidance said:** `raster.js` comment block above the smooth shapes: "Coordinates are continuous here".
  `fillRoundRectSmooth` doc: "radius may be fractional".
- **What happened:** `fillRoundRectSmooth(1.5, 1.5, 11, 11, …)` threw "the box must use whole numbers". My own
  `paintCoverage` wrapper for arrowheads threw the same.
- **Got past it by:** using integer boxes, and snapping the box out with floor/ceil in my wrapper.
- **Proposed fix:** in `paintCoverage`, snap the box outward (`x = floor(x)`, `w = ceil(x + w) − x`, …) instead of
  throwing. The `inside` test already works in continuous space, so nothing is lost. Or reword the comment to:
  "Shape coordinates (centres, radii, line ends) are continuous; the bounding box of rectangles must be whole pixels."

### 9. The toolkit has only a *vertical* dithered gradient
- I wanted dithered left-to-right lighting on the tower faces (fixed cells, so allowed). `ditheredGradient` is
  vertical only, so I wrote `ditheredRampX` and `bayer(x, y)` in `castle/stone.mjs`.
- **Proposed toolkit API:** export `bayer(x, y)` from `raster.js` and generalise to
  `ditheredRamp({ axis: 'x' | 'y', start, length, colors })`, keeping `ditheredGradient` as the vertical alias.

### 10. The "never dither tiled art" rule is phrased for 1px stretch cells; multi-px tiles need a finer rule
- **Guidance said:** guide §4.5: "Never dither art the engine stretches or tiles along one axis."
- **Reality (R2):** every grower tiles its *whole* source. A 12px merlon tile with Bayer dither inside repeats
  seamlessly if the period is a multiple of 4. The rule as written forbids it. I followed the rule anyway (no dither
  in any tiled cell; textures in tiles use coordinate-wrapped hash noise via `ashlar({ periodX })`), but the rule
  pushed me to work out *why* myself.
- **Proposed guide text:** "…tiles along one axis **from a 1px source**. A multi-pixel tile (R2) repeats whole, so
  texture inside it is fine as long as it wraps at the tile size; for a 4×4 ordered dither the tile must be a
  multiple of 4 along that axis. The plate (code 5) tiles from its left edge but ends on a partial tile, so dither
  there shows a seam at the right cap: keep the plate one colour per row."

### 11. Partial-tile seams and code choice: a short decision table would have saved trial and error
- With 11/8 merlon tiles I worked out on paper that a partial tile leaves a 1–2px merlon sliver next to a fixed wall
  section. Switching to 12 + 13 filler (R4/R8) fixed it, because merlons are always whole and the remainder becomes a
  wider crenel next to the tower. For stone courses down the sides, a partial course looks fine, so 11/loop/8 is
  right there.
- I also had to read `allocate()` in `src/engine/families/window.ts` to confirm that two 13 fillers in one untitled
  allocation split the remainder evenly (`trunc(rem / recipients)`), so a centre crest stays centred to ±1px.
- **Proposed catalogue addition (after R8):**
  > | You want | Use |
  > |---|---|
  > | an ornament repeated only whole (merlons, studs) | 12 + a 1px 13 filler at the outer end of the same allocation |
  > | a texture where a cut copy looks fine (stone courses, planks) | 11 before the fixed piece, 8 after it |
  > | a centred fixed ornament on an untitled edge | 12 \| 13 … fixed … 13 \| 12, or 11 \| fixed \| 8; two 13s share the remainder evenly (±1px) |

### 12. The preview page can't be parameterised (sizes, titles, active state)
- **Trying to:** test small and large windows, long titles and an *active* scroller (the preview's "Long document"
  is inactive, so active scrollbar art never shows).
- **Guidance said:** the brief suggested copying the page under /tmp and running my own vite. A page under /tmp can't
  import `../src/*.ts` from the repo, and the inline module script is served through vite's `?html-proxy`, keyed by
  the page URL.
- **Got past it by:** Playwright `page.route()` on the *document request only* for `/authoring-preview.html`, replacing
  the `#desk` markup and letting vite's html-proxy module requests through
  (`/tmp/castle-build/custom.mjs`). A glob route `'**/authoring-preview.html*'` silently didn't match the
  query-string URL, so I needed a predicate `(u) => u.pathname === …`.
- **Proposed fix:** have `demo/authoring-preview.html` accept `?layout=<url-of-html-fragment>` (or `?desk=` base64) to
  replace `#desk`, and add a `?active=<title>` switch. Also make "Long document" active, or add an active scroller,
  so that scrollbar art is visible by default.

### 13. Pressed-strip silhouettes: copying frame pixels under the piece worked well
- **+** Building the strip by copying the active frame's pixels under each widget's at-rest silhouette, then drawing
  the pressed art on top, gave seamless smooth edges and a mask that equals the visible widget (= hit region).
  Proposed helper: `pressedStripFrom(layout, activeRaster, drawPressed)` in the toolkit.

### 14. Catalogue R28/title size: tall tower bands force a 13px title everywhere (known, but it bites utilities)
- My utility window has towers too, so its A.top is 30 and its title is 13px, the same size as the document's. I
  made the utility banner 16 rows to fit it. No fix needed in the docs (R28 says this); a scheme-level "title size"
  would need a runtime change, so I'm only noting it.

### + 15. Things that just worked
- `npm run author` output: the sampled title/button colours in the summary confirmed my hidden swatches on the first
  try.
- The checker's warning list was empty on the first successful build. The swatch rules in §4.3 and the push-face
  rules in §5 item 3 are precise enough to get right blind.
- Halcyon's `parts/scrollbars.mjs` header comment is an excellent spec digest. I reused its geometry wholesale and
  only restyled it.
- R13/R14 (towers = rows of the top band; gutter columns in the side band) mapped directly onto the design.
- R24 made the widgets clickable on the first try.

### 16. Classic-Kaleidoscope design notes for the combined emulator run (not verified by me)
- Castle's utility window has no collapse box (item 3), so the classic utility is close-only.
- `-14298` (pressed utility widgets) isn't shipped. Classic utility windows may show no pressed art (R24). The utility
  close rect matches the document close size (13×13), so shipping `-14298` = a copy of the close piece would be cheap.
- The flagstone document body and parchment `ppat 42` are web-only for ordinary windows (R22). Classic shows system
  grey there.
- The title bands are tall (36/30px); classic draws Chicago 12 on the bar rows, baseline T4.bottom − 4.
