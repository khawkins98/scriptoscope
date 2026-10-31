# Exotic window frames: rules R1–R30

*A reference for building window frames: what the format, the web runtime and
real Kaleidoscope support. Read [`authoring-a-scheme.md`](./authoring-a-scheme.md)
first; it owns the workflow and links here by rule number. Every rule cites the
spec row or code, gives a corpus precedent, and flags runtime limits. Paths are
relative to the repo root. "Web" is Scriptoscope's runtime; "classic" is
Kaleidoscope 2.3.1. Corpus recipes are written `code@border`, so `12@47` is a
code-12 cell ending at border 47.*

Evidence comes from the specs and code, plus headless renders of corpus
windows through the real compositor.

---

## A. The geometry model in one paragraph (the thing everything else follows from)

A window is drawn from one template cicn. The content rect `A` (rect
0) splits it into four **bands**, and each band has a fixed thickness
across its side:

- **top**: rows `[0, A.top)`, the full width;
- **bottom**: rows `[A.bottom, B.bottom)`;
- **left**: columns `[0, A.left)`;
- **right**: columns `[A.right, B.right)`.

Source: `docs/spec/engine/window-widgets.md` §4.8 CR1–CR4; `src/engine/tables/window.ts:162-167`; `src/engine/families/window.ts:247-255`.

Each side's recipe cuts its band into cells **along** the side; only cells
grow. The window footprint is exactly `frame + content`, where frame is the
four insets from `A`. Nothing is ever drawn outside that rectangle
(`src/composeChrome.ts:39-43, 151-154`). So an "irregular silhouette" means
transparent pixels **inside** the rectangular footprint. Art can never stick
out past it.

---

## 1. Cell codes (rules R1–R12)

**R1. Cells are end-based and only `[S[0], S[N])` is painted.** Cell *i* is
`[S[i−1], S[i])` and takes `code(i)`; entry 0's code is never read.

- The region before the first border and after the last is never drawn
  (LS9, Q3: `window-widgets.md` §4.2, §6.1 Q3; `src/composeChrome.ts:12-14, 186-194`).
- Top and bottom recipes must run from 0 to the full width.
- Left and right recipes only need `[A.top, A.bottom)`, because the top and
  bottom bands already cover the corners.
- *Corpus:* 1138, animals and monkey-paradise start their left/right lists at
  `A.top` (`L: 0@33 …`). beos and 1990 start them at 0.

**R2. Every drawn cell TILES its source; nothing stretches except code 18.**
- The blit is `0xfeae`, unconditional tiling along the side
  (`compositor-spec.md` "Per-cell blit"; `qd-primitives.md` T1–T8;
  `src/engine/tables/windowBlit.ts:13-17`).
- A 1px source makes a flat fill. A multi-pixel grower cell repeats its whole
  source, so **a textured or patterned grower works if the cell holds exactly
  one period**.
- The authoring guide's "1px growers" is a `windowLayout()` simplification,
  not a format rule.
- *Corpus:* animals' left side is code 12 over 14 rows of giraffe neck
  (`12@47`). Monkey-paradise's bottom tiles a 31px leaf-and-water scallop
  (`12@69`).

**R3. Tile anchoring (direction byte).**
- Codes **11 and 14** tile from the **far** end (right or bottom), so their
  partial tile sits at the near end.
- **Every other** tiled code (8, 12, 13, 5, 6, 1 …) tiles from the near end,
  with its partial tile at the far end (W2/W3 rows;
  `qd-primitives.md` T5/T6; `windowBlit.ts:15-16`).
- Use **11 left of the plate and 8 right of it**: both then phase-lock to the
  plate edges, and the partial tiles land at the outer corners. This is why
  1138, animals and apple-lisa put 11 before the plate.
- For a symmetric crenellation or stud run on a single-allocation edge
  (bottom, or an untitled top), use `11 | fixed centre | 8`.

**R4. Code 12 = whole tiles only, and its leftovers need a home.**
- The primary share is truncated to a multiple of the source width (AW1).
- The unused fraction goes to the remainder pool, which only codes **8, 11,
  13, 14, 18** in the **same allocation** can take
  (`compositor-spec.md` "Distribution"; `src/engine/families/window.ts:144-171`).
- With no recipient, the side ends short of the corner and leaves a gap
  (LS9: animals' collapsed no-title-utility right side).
- **Pair every 12 with a 13/14 (or 8/11) cell in the same half.**
- *Corpus:* animals' document top is
  `2@57 13@58 12@75 6@86 5@94 6@105 12@122 13@123 3@148`. That is a 17px
  "orange critter" tile on each side of the title, with a 1px code-13 filler
  at the outer end of each half.

**R5. Code-12 trap: unequal tile widths in one allocation.**
- The primary share is `budget / growers`, then each 12 gets
  `trunc(share / w) · w`.
- At template size, two 12-cells of widths 17 and 40 share 58px: each share
  is 29, so the 17-cell gets one tile and the **40-cell gets 0**. Its art
  vanishes.
- Keep one tile width per half, or put each differently sized tile in its own
  half or side.

**R6. Code 12 repeats once there's room ("drawn once" is only true until the
window is big enough for a second copy).**
- *Corpus:* animals' titled-utility top is one 154px code-12 cell, a whale
  that rises 55px above the bar. At content width 300 it draws once. At 520
  it draws **three whales**.
- For art that must appear exactly once on a **titled** edge, use a **code-10
  cell** between growers (R12). Bonn's skyline does this. Code 10 is dropped
  when the window is narrower than the edge's fixed sum `F` (TS1: every code
  1/2/3/4/10 cell; bezels, plate and growers don't count), together with the
  title and bezels. Bonn's document template is 155px wide and `F` is 128px.
  A fixed code-1 cell also works, but never gives way: below `F` its
  neighbours overlap (AW8).
- **Every fixed pixel on a titled edge is taken from the title's room.** The
  narrowest window that still shows a title is about the sum of the top edge's
  non-growing cells plus the title's width. `frameLayout` reports it as
  `fixedTop` and `minWidthForTitle(px)`. The title is dropped at room ≤ 2
  (TT3), long before a code-10 cell is dropped (`E < F`), so a window between
  the two widths shows the ornament and no title. Bonn's first 91px skyline
  made a 260px window truncate its title and a 150px window lose it. Keep big
  ornaments narrow, and put big art on the bottom edge or on untitled windows.

**R7. Code 18 = one scaled blit** (`0x10320`, nearest-neighbour
`floor(k·sw/dw)`, declared modern policy, `qd-primitives.md` Q4).
- It is a primary grower like 8 and 11.
- *Corpus:* evolution's pipe frame (18 on 1–2px sources everywhere).
  beos-r503's document bottom is `1@5 18@70 1@75`: 65px scaled once.
- Pixel art gets distorted when scaled. Use 18 only for gradients or flat
  runs.

**R8. Codes 13/14 are remainder-only.**
- They get **only** leftover pixels, never a primary share, and they get 0
  when the allocation has no primary grower (AW3, AW9).
- A 13/14 cell's template width is not kept: at template size it has width 0.
- Its source still tiles, so make it a flat 1px "filler" column whose look
  survives being 0 to (tile−1) px wide.
- **A grower or filler column is repeated exactly as drawn, outline pixels
  included.** If you run an outline pass over the template, make sure no 1px
  grower or filler column sits next to a transparent pixel. Otherwise the
  outline colour fills the column and gets tiled into a solid bar. (Castle's
  first render had a dark block beside each tower for this reason.) The
  toolkit's outliner is `raster.outlineEdges(0, 0, w, h, colour)`. To catch
  it, give the 1px growers that should look alike one `uniform` group
  (`frameLayout`, §8): `layout.lint` fails when one of them stops matching.
- *Corpus:* animals, monkey-paradise.

**Which code for which effect** (worked out building Castle, Brickworks and
Bonn; the allocation rules are in `allocate()`, `src/engine/families/window.ts`):

| You want | Use |
|---|---|
| an ornament that must only ever appear whole (merlons, studs) | code 12 + a 1px code-13 filler at the outer end of the same allocation; leftover width becomes a slightly wider gap. For a wide tile, put a 13 at *both* ends of each 12 run (13 \| 12 \| 13), so the leftover (up to tile − 1 px) is split in two (Brickworks' 24px bricks). Below about template width + one tile, a half can show no ornament at all: "never a part tile" working as designed |
| a texture where a cut copy looks fine (stone courses, planks, a wave) | code 11 before the fixed piece, code 8 after it, so partial tiles land at the corners (R3) |
| a fixed ornament centred on an untitled edge | 12 \| 13 … fixed … 13 \| 12, or 11 \| fixed \| 8. Two code-13 cells share the remainder evenly, so the ornament stays centred to ±1px |
| a large ornament drawn once on a titled edge (a skyline) | a code-10 cell between code-8 growers, kept narrow, because it takes the title's room (R6) |
| a bottom edge narrower than the top (piers, a bridge) | a code-0 skip next to the fixed corner (R9) |

**R9. Code 0 collapses to zero.** It lets one edge skip template columns that
exist only for the other edge's sake.
- Put the skip next to a fixed corner, where a cut tile lands anyway. A
  tile that is exactly one period of a pattern painted in template
  coordinates repeats seamlessly wherever it sits, so the skip's width
  doesn't have to match the period. Only cells **adjacent in the recipe**
  need to join (Bonn first sized its skip to the wave period for nothing).
- *Corpus:* apple-lisa's bottom is `1@2 0@50 8@51 0@121 1@123`. Monkey's
  bottom (`0@139`) and animals' alert bottom (`0@43 … 0@97`) do the same.
- This is the main tool for **a bottom edge different from the top** with
  one template width.

**R10. Codes 5/6, the title plate and bezels (AP2, TT1–TT10, `window.ts:174-219`).**
- The anchor is the last code-5 cell, only on a horizontal side.
- Its placed width is `W = SW + (T4.left − S[a−1]) + (S[a] − T4.right)`: the
  measured title width plus T4's margins inside the cell. The plate source
  tiles across it.
- Code-6 bezels are fixed end caps, zeroed when there is no title (untitled,
  dropped, or room ≤ 2: TT3, TT4, TT10, AW5).
- The two halves `[1, a−1]` and `[a+1, N]` are allocated **independently**.
  - With growers in both halves, the plate is centred on the **content
    rect's** centre `mid = (C.left + C.right)/2`, not the window's (TT6/TT7).
    Asymmetric left/right frames shift it.
  - With no grower in one half, the plate is pinned to that half's fixed
    edge. *Corpus:* beos-r503's yellow tab (TT7) and dolphin-som's tab.
- **Title doesn't fit:** the plate is capped to the room left between the
  halves, and the title is truncated with an ellipsis.
  - Web room = `min(t4p.w+2, max(plateRight−t4p.x, t4p.w))` (TF1,
    `src/renderWindow.ts:207`).
  - Classic condenses first. The web has no condensed face (F11, DECISIONS
    #13), so it truncates sooner.
  - Room ≤ 2, or the side too short (TS1): the title and bezels are dropped.

**R11. Widget-gated codes. Web: every widget is always present (F7, one flag).**
- **2/3/4** (close/zoom/collapse gap) keep their template width when the
  widget is present and become 0 when it's absent (PV2–PV4).
- **15/16/17** are the opposite: 0 when present, fixed when absent (PV6–PV8).
- Classic varies per window; the web always takes the "present" branch, so
  15/16/17 always collapse and 2/3/4 always draw.
- Put widget art in 2/3/4 cells (or code 1) and the "no widget here" bar art
  in a neighbouring 15/16/17 cell.
- *Corpus:* 1138 titled-utility is `1@7 15@8 2@18 11@19 … 8@26 16@27 3@37 1@38 10@48`.
- A widget whose rect touches a grower gets smeared. Checker error; corpus V1(b) in
  `glitch-punchlist.md`.

**R12. Code 10: fixed, dropped when the side is too short.**
- It only matters when the window is narrower than the side's fixed sum,
  `E < F` (TS1), which is less than the template width (R6 has Bonn's
  numbers). Otherwise it is a plain fixed cell.
- A widget wholly inside a dropped cell becomes an empty rect, so it is not
  drawn and not hit (RM6).
- *Corpus:* 1138 and apple-lisa collapse boxes; the animals bottom `10@44`.
- Use it for ornaments that should disappear on tiny windows. Also note that
  **below template size the web does not clamp** (AW8): budgets go negative
  and cells overlap. Keep the template body small.

**Many growers on a side spread fixed ornaments evenly.**
- Every primary grower gets an equal share, with the extras going to the
  later cells. So fixed ornaments separated by growers drift apart evenly as
  the window grows.
- *Corpus:*
  - 1990's document top has eight 1px code-8 cells between fixed rivet/LED
    blocks;
  - evolution's pipe joints;
  - floppies' bottom has 5 growers between fixed disk-shutter pieces.
- Good for landmarks spaced along the bottom, arrow-slits down the sides, or
  toy-brick seams.

---

## 2. Art outside the body / irregular silhouettes (R13–R19)

**R13. A top band taller than the title bar is normal: towers and ornaments
"above the bar" are just rows of the top band.**
- Make `A.top` the full height including towers. Draw the bar in its bottom
  rows and leave everything above it transparent except the merlons and
  towers.
- *Corpus:*
  - animals' document: the giraffe head and critters rise above the green bar
    (top inset 33);
  - animals' titled utility: the whale, inset 68 with a 13px bar;
  - monkey-paradise's palm trees, inset 36.
- Merlons: a code-12 cell (or 11/8 pair) whose source is one merlon plus one
  gap, with the gap rows transparent. Towers: fixed code-1 corner cells.

**R14. A tower or ornament that continues *down the side* is part of the
left/right band.**
- The band is `A.left` wide over every row it covers. A tower wider than the
  wall therefore needs `A.left` = tower width, with the columns outside the
  wall transparent below the tower.
- Use a fixed cell in the left recipe for the tower base (rows
  `[A.top, A.top+k)`), then a grower.
- The content is inset by the full band width: the transparent gutter is part
  of the window.
- Left and right insets are independent: `frame.left = A.left`,
  `frame.right = drawW − A.right`.
- *Corpus asymmetry:*
  - 1984 document (L24 / R2): the Apple tab protrudes down-left;
  - beos side-floating (L20 / R4);
  - floppies document (L25 / R31 / B60).

**R15. Transparent frame pixels show the page in the web.** Every chrome blit is CopyMask
(`src/composeChrome.ts:28-29`, WD4/WD13). The canvas is transparent there and
the page shows through. **But the window still owns those pixels.**
- The drag handle is "window rect minus content rect", purely rectangular
  (`inFrame`, `src/interactive.ts:1561-1569`).
- A click between merlons or beside the BeOS tab starts a window drag. It does
  not reach the page underneath.
- Title-widget hits are the only mask-shaped hit test (R24).

**R16. Classic: transparent pixels show what's behind, and clicks on them pass
through.**
- Kingfisher's real-Kaleidoscope capture (`authoring/schemes/kingfisher/classic/desktop@2x.png`)
  shows its rounded-corner mask pixels displaying the desktop pattern and the
  window behind.
- **Click-through, observed in real Kaleidoscope 2.3.1** (Castle and
  Brickworks): a single click on a gap between merlons or studs, where the
  desktop disk icon showed through, selected the icon and made the window
  inactive. So classic leaves transparent frame pixels out of the window's
  region, while **the web keeps them in the window (R15). This is a divergence.**
  The original `wCalcRgns` (structure region) is **not traced**
  (`window-widgets.md` §1 out-of-scope, §6 Q3), so this is an observation, not
  a decode.
- The captures are illustrations, not admitted fidelity evidence (their READMEs).
- What the real-Kaleidoscope runs of all five first-party schemes showed, for
  anyone designing tall or irregular frames:
  - **The menu bar covers art above the title bar.** A window placed just under
    the menu bar loses its tower tops or skyline beneath it
    (`authoring/schemes/bonn/classic/menubar-clips-skyline@3x.png`). Keep the
    essential look in the bar rows, and treat art above them as decoration.
  - **Narrow windows lose the title first, in both engines.** Below the top
    edge's fixed sum (TS1) the title, its bezels and any code-10 ornament go
    together; above it, the title truncates before anything else gives way
    (R6). At equal widths the web's `layoutWindow` drops the same cells as
    classic (`bonn/classic/narrow-title-drop@3x.png`). Classic titles are
    bitmap Chicago 12, narrower than the web font, so classic keeps a few more
    letters.
  - **8 bpp shifts subtle colours.** A warm beige stone came out grey with
    pink mortar and yellow flecks, while saturated cube colours held up. Pick
    key colours from `SYSTEM_PALETTE_256` and run `npm run sim8` before the
    boot.
  - **Classic dialog and alert bodies are a flat colour, not a pattern**: the
    scheme's `dctb`/`actb -14336`, or Kaleidoscope's light grey when it ships
    none. The web uses the same colour, but patterned bodies are web-only (R22).

**R17. Silhouette edges are 1-bit.**
- cicn masks are binary, so there is no alpha.
- Smooth curves need `matte`-blended edge pixels, and a matte only suits the
  background you assume (authoring guide §3.5).
- For battlements and towers seen against an unknown page, use hard pixel
  edges or a dark 1px outline.

**R18. Keep at least one opaque pixel in the last column and the last row of
the template.**
- The web sizes the window to the template's **drawable** extent (last
  opaque column/row + 1, `src/composeChrome.ts:45-52`). Classic uses the
  cicn bounds (F6).
- A wholly transparent final column or row makes the two disagree, and the
  bottom/right recipe can then fall short.
- *Corpus:* beos-r503's 92px cicn is drawn as 75px.
- A wavy bottom edge is fine as long as some pixel in the last row is opaque.
- `frameLayout`'s `layout.lint(raster)` fails a wholly transparent last
  column, or last row on a non-collapsed frame.

**R19. Drop shadows: bake them yourself, and keep the CSS shadow off.**
- The `wnd#` kDEF adds no window shadow. Only the built-in procedural frame
  has a 1px structure shadow (`procedural-frame.md` §3.3).
- *Corpus:* apple-lisa's frames bake a solid 1px shadow on the right and
  bottom (insets L1 / R2 / B2; alert 16×16 with `##` right/bottom columns).
- A true offset shadow is possible: right/bottom band pixels with transparent
  notches at the shadow's start.
- `--scriptoscope-window-shadow` is a rectangle; it fills transparent areas,
  so leave it `none` (`src/scriptoscope.css:28-31, 59-65`; LEARNINGS
  2026-10-20).

**BeOS asymmetric tab, how it's built** (`beos-r503 -14336`):
- Top recipe: `1@5 2@19 6@34 5@35 6@50 3@64 1@69 8@70 1@75`, with
  `A = [5,24,70,25]`.
- The tab is the close gap, bezel, 1px plate, bezel, zoom gap and a fixed tab
  end `[64,69)`.
- The **only grower is the 1px column 69**, which is transparent in rows
  0–18 and opaque in the body-border rows 19–23. As the window widens, that
  column repeats: the transparent area right of the tab widens while the
  border under it stays continuous.
- With no grower before the plate, the tab is left-pinned and grows with the
  title (TT7).
- **Notched or zig-zag edges:** dolphin-som's document has saw-tooth outer
  edges and a disc ornament on its corner, with all four insets 58.

---

## 3. Different art per edge, per corner, per side (R20)

**R20. All four recipes are independent lists over one template.**
- Each corner is simply that side's first or last fixed cell. Make them all
  different.
- The bottom band has its own rows (`[A.bottom, H)`) and its own cell list,
  using code 0 to skip columns (R9).
- Left and right differ in band width (`A.left` vs `W − A.right`) and in
  cells.
- **Draw order is top, bottom, left, right**, all masked (WD4). Where bands
  overlap at a corner, the later band's opaque pixels win.
  - If a left/right recipe starts at 0, its first fixed cell must show the
    same template pixels the top's corner cell shows.
  - That holds when the top's corner cell is at least as wide as the side
    band. Otherwise the side repaints grower columns over the corner.
  - Starting left/right lists at `A.top` avoids the question.
- *Corpus:*
  - floppies: the bottom is a disk shutter, completely different from the top;
  - monkey-paradise: the bottom is a 12-tiled water/leaf scallop, which is
    the "wavy Rhine" precedent;
  - animals: the bottom is a crocodile plus a rope tile;
  - 1984: the right recipe is `1@27 8@28 10@64`, the left `1@63 8@64`.

---

## 4. Window body textures (R21–R23)

**R21. The web paints the content area with CSS, from a pattern, and only
there** (`src/renderWindow.ts:477-548`).
- **Document windows:**
  - the loader reads the `bgPatternId` (int16 at offset 4) of `cinf -9551`
    ("Icon View Background"), else of `cinf -9550`;
  - it then finds the `ppat` with that id
    (`tools/theme-loader/convert.js:305-326`).
- **Utility, dialog, alert, modal, movable-modal and popup** (slug regex
  `/utility|mini|floating|palette|dialog|alert|modal|popup/`): `ppat 42`,
  else `ppat -9568`, else white.
- Never cross-use them: the document pattern is never used for utility bodies.
- The pattern repeats from the content box's top-left (CSS default position).
  At scale > 1 it is scaled pixelated.
- *Corpus:*
  - document: 1984 `cinf -9551 → ppat 4035` (64×64), floppies `→ 803`,
    monkey-paradise `→ 132`, crayon-os `→ 17`, 1990, dolphin-som, evolution
    and animals `→ -9551`;
  - utility: `ppat 42` in 1138, 1984, 1990, animals, apple-lisa, crayon-os,
    monkey-paradise, windows-31, windows-95.
- Kingfisher ships `cinf -9551`/`-9550` with `bgPatternId 0`, so its document
  bodies are white, plus `ppat 42` for utility bodies. To texture a document
  body, set `bgPatternId` and ship that ppat id.

**R22. Classic does not use these for ordinary window bodies.**
- The kDEF never paints the content region. The application or Dialog
  Manager does.
- Dialog and alert bodies are filled by Kaleidoscope's dialog patch from the
  scheme's `dctb`/`actb -14336` colour tables, or its own light grey
  (`procedural-frame.md` §3.6). The web uses the same colour, but still tiles
  `ppat 42` over it, so a dialog pattern only shows on the web.
- `-9551`/`-9550` are Finder Icon/List-View backgrounds, and the Finder
  Colors trigger isn't decoded.
- The Appearance-brush peg (`docs/spec/apple-primary-source.md`) is an
  analogy, not a decode.
- **Treat stone, baseplate and Rhine bodies as web-only decoration.**
- Whether classic paints utility windows from `ppat 42` is not established.
- Per-window-type `cinf` (with `bgPatternId`) is ignored by the compositor
  (compositor-spec Open #1).

**R23. Pattern limits.**
- `encodePpat` needs power-of-two sizes ≤ 1024 and no transparency
  (`tools/theme-author/encode-ppat.js:19-43`).
- The corpus goes up to 128×128 (windows-31 desktop) and 1024×8 (beos alert
  background `-9774`, which no web path draws).
- A busy body pattern sits behind live DOM text. Keep contrast low (a stud
  baseplate tint, faint stone).
- Sliders, like the other controls, leave everything outside their track and
  thumb masks transparent, so the body pattern shows through. (Before #596
  the web cleared a slider's area to white, which left a white box on
  Brickworks' baseplate.)

---

## 5. Pressed widgets (R24)

**R24. Ship `cicn -14330`. Without it, close/zoom/collapse are dead in the
web.**
- The pressed strip is laid out **across**, in this order:
  - close at x = 0;
  - zoom at x = width(close rect);
  - collapse at x = width(close) + width(zoom).
- Each piece is the size of its rect-list rect (WD9). A second row is used for
  collapsed windows when the strip is at least twice as tall.
- The strip's **mask is the hit region**: offset 1:1, not scaled (HT7/HT8).
- The web draws it on press (`src/composeChrome.ts:202-208`;
  `src/engine/families/window.ts:321-348`). It makes a widget hittable **only
  if the strip exists** (`widgetHittable … && !!strip`,
  `src/engine/families/window.ts:344-348`), and `overlayWidgets`
  (`src/interactive.ts:1767`) creates buttons only for hittable widgets.
- `checkScheme` warns when a scheme has widgets but no `-14330`.
- **Offsets are summed from the pressing window's own rects** (WD9/HT7,
  `stripSource`). This is the decoded kDEF rule, so it holds in classic too.
  A utility window with close + collapse but no zoom reads its collapse piece
  at `x = width(close)`, which in the document strip is the *zoom* piece.
  - On the web this can't be laid out away, because the web reads `-14330`
    for every window (below). Give every window the document's widget set
    and sizes (Kingfisher), or give utilities close only (Castle, Brickworks,
    Bonn), or make the zoom and collapse pressed art interchangeable.
  - In classic, utility windows read `-14298`, at the same per-window
    offsets. So lay `-14298` out from the **utility** window:
    `pressedStripFrom(stripLayout(utilityLayout), …)`. For a close-only
    utility at the document's close size, the document strip is already
    right (Brickworks ships it).
  - It affects 12 of 18 corpus schemes too, so it isn't a checker rule.
- `pressedStripFrom` (`tools/theme-author/frame-layout.js`) builds the strip
  from the active frame. Each piece is the widget's own frame pixels with the
  pressed art on top, so its edges match and its mask equals the visible widget.
- Corpus sizes:

  | scheme | strip size | widget rects |
  |---|---|---|
  | 1138 | 24×8 | 8+8+8 |
  | animals | 56×32 | 15+25+15, 31 tall |
  | beos | 42×14 | |
  | 1984 | 33×11 | |

- **Variants:**
  - `-14298` (base+32, `altWidgets`): pressed utility widgets;
  - `-14290` (+8 more, `sideTitle`): side-floating;
  - `-14329` (base+1): partial-zoom/"alternate zoom" (WD8, unexercised).
- **The web always requests `-14330`** (`widgetCicnIds()` with default flags,
  `src/renderWindow.ts:184`; WD11 `src/engine/tables/window.ts:214`). Utility
  windows therefore use the document strip.
- Ship `-14298`/`-14290` for classic, but give utility widgets the same rect
  sizes as the document widgets, so `-14330` also reads right on them.
  `npm run author` prints whether a scheme with utility widgets ships
  `-14298` ("classic extras"). All five first-party schemes do.
- At rest, widget art is the frame's own pixels (WD10); there is no separate
  rollover art.

---

## 6. Popup and side-floating windows (R25–R26)

**R25. Popup window (`wnd# -12320`, procID family 63; web: `popup-window`).**
- Shape: a narrow tab on the top side (code-5 anchor) above a body.
  Typically there's **no bottom recipe** (it sits on the screen edge).
- *Corpus:* floppies' top is `1@10 8@11 1@35 6@45 5@48 6@58 1@81 8@82 1@94`,
  with no bottom.
- Placement is AP1 / PP1–PP7. The plate is placed from the popup data, not
  the title.
  - With the creation values (PP6: `pdLen 33`), the plate is
    `[C.left+10, C.left+23)` and `t4p` is 13px wide.
  - **In the web every popup title truncates to ~15px** (PP7 limit;
    `window.ts:221-236`, confirmed by render: `title w=13`).
- Extra raw blits (WD6): rect-list **types 5 and 6** (the body "shoulders"
  either side of the tab) are copied 1:1 from the template. Type 5 moves with
  C's top-left, type 6 with its top-right. A **15×15 block at A's
  bottom-right** moves with C's bottom-right.
- The title colour uses the **lower** swatch `(A.left, A.bottom−1)` /
  `(A.left+1, A.bottom−1)` (TC3).
- The too-short step never runs.
- **Authoring needs:**
  - the top recipe with one code-5 cell (bezels 6 optional);
  - rects 0, 4, 5, 6;
  - the lower swatches;
  - left/right recipes, and art for the 15×15 corner.
- Treat it as low value on the web.

**R26. Side-floating utility (`wnd# -14296`, collapsed `-14292`).**
- The title strip is the **left** band: `A.left` is large (1138: 13,
  beos: 20, windows-95: 18).
- The **left recipe** carries the widgets and the 15/2/16/3/10 codes. The
  top, bottom and right recipes are thin.
  - *Corpus:* 1138 left is `0@5 15@6 2@16 8@17 16@18 3@28 1@29 10@39 1@41`.
  - The collapsed form (`-14292`) has only a left recipe.
- Widgets sit in left-band fixed cells.
- **No visible title in the web** (`HEADLESS_TITLE_SLUG_RE`,
  `src/renderWindow.ts:483`).
- **Web limits:**
  - `sideTitle` is never set, so the pressed strip is `-14330`, not `-14290`;
  - collapse always zeroes **height** (`src/interactive.ts:1179`), where the
    decode zeroes **width** for side-titled windows (§2.2 `sideTitle`). The
    collapsed side window renders wrong.
  - Drag works on any frame pixel.
- No-title utility (`-14288`/`-14284`): widgets in the thin top band, no
  plate needed.

---

## 7. Other features and known gaps (R27–R30)

**R27. Title colour and shadow per state.**
- Text is read from the template pixel `(A.left, A.top)`, the shadow from
  `(A.left+1, A.top)` (TC2). Each state reads its own cicn (active −N+1,
  inactive N).
- When the two differ, the shadow is drawn at (+1, +1) first (TC4/TC5,
  TX7). The mask is ignored, so swatches can sit on transparent content-hole
  pixels.
- TC1 also samples the background at `(T4.left, T4.bottom−4)`.
- Engraved title: make the shadow lighter than the text. Embossed: darker.

**R28. Title size and placement.**
- The web title size is `clamp(A.top − 6, 8, 13)` (`src/renderWindow.ts:148`).
  **A tall tower band makes it 13px whatever the bar height.**
- The text is left-aligned in the remapped T4 rect: baseline at
  `t4p.bottom − 4`, clip `t4p` + 2 px on the right (TX4/TX8). The plate
  centring does the centring.
- The web moves the baseline down to `t4p.top + ascent` when the font is too
  tall (`src/renderWindow.ts:214`; F11).
- **Put T4 on the bar's rows only, and make it at least ~17px tall** (about
  title size + 4). Otherwise descenders clip, and in a tower band T4 would float
  in the sky. `frameLayout` enforces 17px. It isn't a checker rule, because most
  corpus title rects are shorter and their authors accepted the clipping.
  - So with `frameLayout` a titled utility's top band is at least 17px plus
    whatever rises above the bar. A slimmer utility bar is only possible
    through `windowLayout()`, which doesn't apply the rule.
  - Make the *visible* plate art at least title size + 4 rows too, not just
    the rect. Brickworks' first 14-row utility tile clipped "Tools".
- The ≤2px marker rect gives `titleRegion.midY` (`composeChrome.ts:211-221`),
  but nothing in the web runtime reads `midY` today. A T4 wider than 2px (e.g.
  spanning a 12px plate source) only loses that field.

**R29. Window types, and which ones the web titles.**
- Each `wnd#` id N pairs with cicn N (inactive) and N+1 (active), and both
  must be the same size.
- The types:
  - −14336 document;
  - −14332 collapsed document;
  - −14328 dialog;
  - −14326 alert;
  - −14324 movable modal;
  - −14322 movable alert;
  - −14304 titled utility and −14300 its collapsed form;
  - −14296 side-floating and −14292 its collapsed form;
  - −14288 no-title utility and −14284 its collapsed form;
  - −12320 popup.
- Source: `tools/theme-loader/window-type-identities.js`.
- Collapsed types are title-band-only recipes (no bottom/left/right).
- The web hides titles on dialog, alert, no-title utility and side-floating,
  and shows them on document, titled utility (including collapsed), movable
  modal/alert and popup (`src/renderWindow.ts:123-126, 483`).

**R30. Known runtime gaps relevant to striking frames.**

| Gap | Effect for builders | Source |
|---|---|---|
| Grow box on `wnd#` windows not drawn | `-14334`/`-14333` art is classic-only | authoring guide §9 |
| One widget-presence flag | 15/16/17 always collapse; disabled widgets still show art | F7 |
| No condensed title face | titles truncate sooner than classic | F11, TT2a |
| Below-template budgets unclamped | tiny windows overlap cells | AW8; compositor-spec |
| Window `cinf` ignored | it can't carry a body pattern or a 9-slice | compositor-spec Open #1 |
| Popup plate frozen at creation data | popup titles are useless | PP7 |
| Side-titled collapse zeroes height | collapsed side windows render wrong | R26 |
| `altWidgets`/`sideTitle` never set | only `-14330` is used | R24 |
| Big baked ornament split across a grower | the ornament repeats | 1984 V1(b), `glitch-punchlist.md` |
| Classic structure region (click shape) untraced | classic lets clicks through transparent frame pixels (observed, R16); the web keeps them in the window | Q3, R15, R16 |
| Grow box not drawn, but the resize overlay is live | the bottom-right corner of every `wnd#` window resizes with no visual cue | authoring guide §9 |
| No golden reference diff | eyeball your classic test boot | ledger "What no automated net catches" |

---

## 8. frameLayout and windowLayout

`frameLayout()` (`tools/theme-author/frame-layout.js`) builds any frame these
rules allow. `windowLayout()` (`tools/theme-author/window-layout.js`) is a
shorter helper for a plain rounded rectangle; the table at the end lists what
it can't express.

```js
const layout = frameLayout({
  topH: 36, sideL: 8, sideR: 8, bottomH: 10,          // band sizes (A.top, A.left, W − A.right, H − A.bottom)
  top: [{ code: 1, w: 24, name: 'towerL' }, { code: 12, w: 8 }, { code: 13, w: 1, uniform: 'gap' },
        { code: 6, w: 6 }, { code: 5, w: 12, name: 'plate' }, { code: 6, w: 6 },
        { code: 13, w: 1, uniform: 'gap' }, { code: 12, w: 8 }, { code: 1, w: 24, name: 'towerR' }],
  bottom: [{ code: 1, w: 8 }, { code: 8, w: 74 }, { code: 1, w: 8 }],  // must add up to the same width
  left: [{ code: 8, w: 4 }], right: [{ code: 8, w: 4 }],  // body rows only; same total height both sides
  title: { cell: 'plate', top: 16, bottom: 34 },      // the title rect: that cell's columns, these rows (≥ 17px)
  widgets: { close: { x: 6, y: 18, w: 13, h: 13 } },  // template coordinates, inside fixed cells
});
layout.width; layout.height; layout.content; layout.wnd;  // → paint a Raster this size, encodeWnd(layout.wnd)
layout.named('plate');            // { code, w, x0, x1 }; for left/right cells, x0/x1 are rows
layout.fixedTop;                  // width taken from the title's room (R6)
layout.minWidthForTitle(90);      // narrowest window (whole width) that shows a 90px title
layout.lint(raster);              // after painting: throws on stray art (below) and on R18
stripLayout(layout);              // where each pressed piece goes in -14330 (R24)
```
`uniform: true` makes `lint` check that every column of the cell (every row,
on the left and right) is the same. A 1px cell always passes that, so give 1px
growers that should match each other one group name (`uniform: 'gap'`, `'bar'`)
and `lint` compares them. Code-5 plates are always checked, or only their
title rows when the cell is marked `tiled: true`. Every first-party scheme
runs `lint` on every frame; stray art in a tiled cell was the bug every
builder hit at least once.

You give `frameLayout` explicit cell lists per edge (`{ code, w, name }`), the
band sizes, the title cell and rows, and the widget boxes. It returns the
template size, the content rect, the `wnd#`, and the named cell positions to
paint by. Codes 0 and 10 are supported. It enforces:
- top and bottom cells of equal total width, and left and right of equal height;
- widgets in fixed top cells, inside the top band;
- every code 12 with a same-allocation recipient, and one code-12 width per allocation;
- a growing cell on every edge but the top halves;
- a title rect of at least 17px, inside the top band, on the code-5 cell.

`stripLayout()` and `pressedStripFrom()` lay out and build the `-14330` strip
(and `-14298`, from the utility layout).

What `windowLayout()` lacks, and the format feature that `frameLayout` gives
you instead:

| Limit in the helper | Needed by | Format feature |
|---|---|---|
| Only 1px growers (11 / 5 / 8 on top; one 8 elsewhere) | merlons, studs, stone courses, Rhine wave | multi-px code 8/11 tiles, code 12 and 13/14 fillers (R2–R5, R8) |
| One grower per edge | evenly spaced towers, arrow-slits, landmarks | many growers between fixed ornaments (§1 end) |
| The top band is the title bar, and T4 is rows `2..top−2` | towers or skyline above the bar; title on the bar's lower rows | a separate ornament height vs bar rows, with T4 placed on the bar (R13, R28) |
| A single `side` for left and right | towers wider than the wall; asymmetric frames | independent `A.left` / `W − A.right` (R14) |
| Identical left/right recipes from 0 to height; one grower | tower bases, mid-side ornaments, tiled walls | fixed cells mid-side; different cells per side (R14, R20) |
| Bottom = corner, 1px grower, corner | wavy bottom, distinct bottom ornaments | the bottom's own cells, code 0 skips, 12 + 14 filler (R9, R20) |
| Template height `top + 1 + bottom` (one content row) | any side tile with period > 1 | template body ≥ one tile period per side grower |
| No code-6 bezels | pennant ends that vanish without a title | 6 around 5 (R10) |
| No 2/3/4 or 15/16/17 cells | correct art when a widget is absent (classic) | widget-gated cells (R11) |
| No code 10, 18, 0 | droppable ornaments, scaled gradients, skipping template columns | R7, R9, R12 |
| Plate always symmetric (growers both sides) | BeOS-style pinned tab | a half with no grower (R10) |
| No popup or side-floating forms | those window types | R25, R26 |
| No pressed-strip layout | working widgets in the web | `-14330` strip derived from the widget rects (R24) |

What `frameLayout` still leaves to you:
- the colour budget: call `fitPalette` on big frames (authoring guide §3.5);
- the title room: print `minWidthForTitle` and size ornaments by it (R6);
- the strip offsets of windows with a different widget set (R24);
- popup and side-floating forms (R25, R26), and the classic-only 2/3/4 and
  15/16/17 branches (R11).
