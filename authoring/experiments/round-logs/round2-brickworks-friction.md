# Brickworks build: friction log

Builder: new-to-repo engineer (agent), round-2 dogfood. Entries are in the order I hit them.

## Reading phase

### W1 (worked well) Reading order and the two-guide split
The authoring guide → exotic-frames catalogue → Castle order worked. §4.1's
"use frameLayout instead" pointer arrives at the right moment, and the
catalogue's §8 explains why. The "Which code for which effect" table gave
me the stud-row recipe (`12 + 13 filler`) and the dialog-centre recipe
(`12 | 13 … fixed … 13 | 12`) in one look, without reading R2–R8 first.

### F1 The frameLayout API is only documented in the source header
- Trying: learn what `frameLayout` takes and returns.
- Guide: §3 table and catalogue §8 describe it in prose ("explicit cell lists
  per edge (`{ code, w, name }`)"). The return shape (`named()`, `cells`,
  `content`, `widgets`, `titled`, `collapsed`) and the fact that left/right
  cells run over the *body rows only* (so their `x0` is actually a *y*) are
  only in `frame-layout.js` and Castle's `frames.mjs`.
- Got past it: read `frame-layout.js` (190 lines, clear).
- Fix: add a 10-line spec/return sketch to catalogue §8, e.g.
  ```
  frameLayout({ topH, sideL, sideR, bottomH, collapsed?, top, bottom, left, right,
                title: { cell, top, bottom }, widgets: { close, zoom, collapse } })
  → { width, height, content, cells: { top, bottom, left, right }, named(name), widgets, wnd }
  // cells[].x0/x1 are positions ALONG the edge: for left/right that is a y.
  ```

### F2 The 17px title-rect minimum is enforced but its interaction with utility bars isn't stated
- frameLayout throws if `title.bottom - title.top < 17`. Castle's utility bar is
  "13px" in spirit but its title rows are 17 tall, reaching up into the
  gatehouse. A builder wanting a slim utility bar (Halcyon's is 16px) learns
  only at build time that a titled utility needs ≥17 rows of top band below
  any ornament. Proposed text for catalogue R28: "This means a titled utility
  window's top band is at least 17px plus whatever rises above the bar;
  Halcyon's 16px bar is only possible with windowLayout()."

## Building phase

### F3 The 256-colour-per-image budget isn't in the guide
- Trying: first build of the frames (dithered sheen on fixed corner bricks,
  smooth round widgets, per-row gradients).
- Guide: §4.5 sells smooth shapes and gradients but never says a cicn holds
  at most 256 colours. The only mention is the encoder's header comment.
  The error (`more than 256 colours in a 152x53 image; reduce gradient steps
  or dither`) doesn't say *how many* colours there were, or which part of the
  art made them.
- What happened: build failed on the first run. Smooth-edge blends multiply
  colours fast: every AA edge pixel is a new mix, and `mix(rowColour, gloss)`
  in a sheen gives a new colour per row.
- Fix (guide §4.5, new bullet): "**Colour budget.** A cicn is indexed: at most
  256 colours per image (and 16 at 4 bpp if you want a small file). Every
  partly-covered smooth edge pixel is a new blend, and `mix()` of a per-row
  colour makes one colour per row. Mix against fixed colours, keep gradient
  stops few, and let `ditheredGradient` do the in-between." Toolkit: make the
  error say `N colours` (buildPalette already knows the count).

### F4 `?active=<title>` in the preview does nothing unless the window is first (bug)
- Trying: view the "Controls" and "Long document" windows active to check
  active slider/scrollbar/frame art.
- Preview header: "`?active=<title>` make the window with this title the active one".
- What happened: the frame stayed inactive. The page sets
  `data-scriptoscope-state="active"` on the match and `inactive` on the rest,
  but `WindowManager.add` (`src/interactive.ts` ~line 918) only activates the
  first window added: `active: this.windows.length === 0 && opts.state !== 'inactive'`.
  "Document Window" is first and now inactive, so nothing is active.
- Got past it: Playwright `page.mouse.click()` on the window body (focus
  works, which also proves the WindowManager path).
- Fix (demo/authoring-preview.html, in the `params.get('active')` block): move
  the match to the front so it is added first:
  ```js
  const match = [...desk.querySelectorAll('[data-scriptoscope-window]')]
    .find((w) => w.dataset.scriptoscopeTitle === params.get('active'));
  if (match) desk.prepend(match);   // WindowManager activates the first window added
  ```
  (the windows are absolutely positioned, so order only changes stacking).

### F5 Progress bars have no preview, and the guide doesn't say how to see them
- The preview page shows sliders, tabs, popups, fields and scrollbars, but no
  progress bar, and the declarative layer has no progress element. Guide §8
  lists "web doesn't draw" families but progress isn't in it, and it isn't in
  the preview either. I checked it by calling `composeProgress` from
  `src/controls.ts` in the page (see W-notes below).
- Fix: add a progress row to the preview's Controls window if the runtime can
  draw one declaratively; otherwise add "progress bars (low-level
  `composeProgress` only; no declarative element)" to guide §8's web list,
  plus a `?family=progress` debug strip in the preview.

### F6 Sliders sit in a white box on a patterned body
- Slider control rects are erased to white before drawing (Halcyon's
  controls.mjs cites O4/BG6), so on a document with a body ppat the slider
  shows a white rectangle. Not mentioned in exotic-frames R21–R23 (body
  textures). Not something an author can fix.
- Fix (catalogue R23, one bullet): "Sliders erase their control rect to
  white first, so they show a white box on a patterned body. Keep body
  patterns pale enough that this reads as a label strip, or keep sliders in
  utility windows." Possibly a runtime gap worth a ledger entry.

### W2 (worked well) frameLayout + "which code for which effect" table
- The table's first row (`12 + 1px 13 filler`) is exactly right for studs.
  Every stud is whole at every size I tried (small, 776px wide, collapsed).
  The third row (`12 | 13 … fixed … 13 | 12`) centred the dialog/alert
  centre brick first time. I used four fillers (13 | 12 | 13 | fixed | 13 |
  12 | 13), which keeps gaps under 12px for a 24px tile; that's worth a line
  in the table: "for a wide tile, put a 13 at *both* ends of each 12 run so the
  leftover (up to tile−1 px) is split in two".
- frameLayout's validation (one 12 width per allocation, recipient present,
  widgets in fixed cells, 17px title) never fired on me, because the table
  had already steered me right. Painting by `named('capL')` kept art and
  recipe in step with zero off-by-one bugs.
- One surprise worth documenting: on a narrow window a whole half of the bar
  can lose its studs (the 12 gets 0 tiles, the fillers take everything). This
  is "never a half stud" working as designed, but the table could say so:
  "below about template width + one tile, a half may show no ornament at all".

### W3 (worked well) stripLayout / pressedStripFrom
- Two lines in scheme.mjs, and the pressed tiles came out exactly on the
  frame pixels with a round hit mask (Playwright: every widget got a 14×14
  overlay; pressed art showed on mouse-down for close/zoom/collapse). The R24
  advice "give utilities close only" avoided the zoom/collapse offset trap
  without me having to think about it.
- Small gap: R24 says "ship -14298 for classic", but neither Castle nor
  pressedStripFrom says what -14298 should contain for a close-only utility.
  I shipped the same strip. A sentence in R24 ("for a close-only utility the
  document strip is a valid -14298") would remove the doubt.

### W4 (worked well) The dithering rules
- "Never dither a 1px stretch cell", "a multi-pixel tile repeats whole, so
  texture is fine if it wraps at the tile size (multiple of 4)" and "plate one
  colour per row" were all I needed. I dithered studs (24px tiles), corner
  bricks (fixed), widget faces (fixed) and the ppat; the bar, fillers and
  title tile are one colour per row. No seams anywhere.
- Missing: the colour-budget consequence (F3). Dithering is also the *fix*
  for the 256-colour error, and the guide could say so in the same place.

### F7 The outline-pass gotcha generalises; a shared outline helper would help
- Castle and I both wrote the same `outlineSilhouette(r, colour)` (8 lines).
  R8's warning about outline + 1px fillers is right, and I checked my fillers
  against it by hand (bar fillers: transparent above, opaque either side,
  safe). A shared helper could make that check automatic.
- Proposed toolkit addition (raster.js):
  ```js
  /** 1px outline on every opaque pixel touching a transparent one (or the edge). */
  outlineSilhouette(color) { /* Castle's stone.mjs body */ }
  ```
  and a frameLayout-side check, `checkFillerColumns(layout, raster)`, that
  fails when a code-8/11/13/14 column of width 1 changes colour after the
  outline pass compared with its neighbours (Castle's dark-block bug).

### F8 Family code is copy-paste between schemes
- For scrollbars I copied Castle's `scrollbars.mjs` (barRaster, track,
  arrows, ghosts, little arrows) and changed the palette and thumb. For
  progress, sliders and tabs I copied Halcyon's and changed the art. That
  worked, and Halcyon's comments carried the engine rules with me. But the
  rule-carrying geometry (`barRaster`, `trackImage`, `transpose`, `flipCells`,
  `thumbCell` underlay + mask-back, progress `rolled`) is now in three schemes.
- Proposed toolkit addition: `tools/theme-author/families/` with
  `scrollbarSet({ paintTrack, paintArrow, paintThumb, … })`,
  `sliderSet({ trackArt, thumbCell })`, `progressSet({ frame, fill, track, stripes })`
  and `transpose`/`flipY` on Raster. Each would own the ids, cinfs and
  engine invariants (opaque thumbs, flat track middle, cell order), so a
  scheme supplies only paint callbacks.

### F9 No offline way to look at a raster
- I wanted to see all 16 frame templates (8 types × active/inactive) on
  magenta without the runtime, especially the dialog/alert/modal active
  states the preview never shows active (F4). The catalogue says its
  author used "small scratch scripts that aren't committed". I wrote another
  (`/tmp/brickworks-build/sheet.mjs` + PIL). `scripts/lib/png-encode.mjs`
  exists, but nothing in the guide points at it.
- Proposed: `npm run author -- <dir> --sheet` writing `<tmp>/sheet.png` with
  every cicn at 4× on magenta (frames grouped by wnd# id, active next to
  inactive). That would have replaced half my Playwright crops.

### F10 Preview page: what worked, what's missing
- Worked: `?scheme=` and `?layout=/authoring/preview-layouts/sizes.html`
  (small/wide/long title/utility/tiny alert) is a great stress test, and
  `data-preview-ready` made Playwright reliable.
- Missing: `?active=` (F4); there's no way to see dialog, alert, movable
  modal or utility *active*, because only the first window is active. A
  `?all-active=1` mode (every window drawn active, no WindowManager focus)
  would cover it. No progress row (F5). The header comment could mention
  that clicking a window body activates it, and that double-clicking the
  title collapses it (it does mention the latter in an HTML comment lower down).

### F11 Smaller notes
- Guide §6 says utility collapsed is `-14300`; frameLayout `collapsed: true`
  + same cells just worked, and so did the double-click-to-collapse path.
- The "Resize window" overlay is present on every window even though the web
  doesn't draw `wnd#` grow boxes (§8). The bottom-right corner is draggable
  with no visual cue; worth one line in R30's gap table.
- Title text size: with a 32px top band the title is 13px (R28). That's
  right for chunky bricks, but the plate needs ≥16 visible rows or text
  touches the edges. My first utility tile (14 rows) clipped "Tools". R28
  could add: "make the visible plate at least title size + 4 rows".
