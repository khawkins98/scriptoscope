# kDEF layout recipes — the exact compositor spec (per chrome element)

Derived by decompiling Kaleidoscope's `kDEF 0` (68k). Goal: an exact,
code-grounded recipe the v2 pixel compositor can implement faithfully —
not screenshot approximations. See `tracking/kdef-disassembly-findings.md`
for the trace methodology and the window-specific deep dives (§8 recipe
walk, §9 anchor placement).

**Confidence legend:** `[CODE]` traced to instructions · `[DRAWER]`
drawer function + cicn IDs identified, layout model from code structure +
period docs, not yet instruction-exact · `[DOC]` from the period
"Creating Color Schemes" authoring doc.

---

## 0. Shared drawing model `[CODE]`

The kDEF is a QuickDraw compositor. Three reusable mechanisms underlie
every element:

1. **`CopyBits` sample-and-hold scale** — the blit primitive (~`0x738`,
   wrapped by `0xb64`) copies a cicn source rect into a dest rect,
   nearest-neighbor when sizes differ. Web equivalent: draw to a pixel
   buffer / canvas with `imageSmoothingEnabled = false`
   (`image-rendering: pixelated`). Never bilinear.
2. **Recipe walk** (window frames) — a `wnd#` side list partitions the
   cicn edge into segments; fixed segments copy 1:1, grow segments
   stretch (kdef-findings §8).
3. **Anchor placement** (`0x35b0`) — a 3×3 grid + center positions a
   piece in a rect by `part@44` (anchor), `@46/@48` (offsets),
   `@50` (title sub-anchor) (kdef-findings §9). Used for the title,
   grow box, and control parts — NOT the frame's baked widgets.

Two raster fits recur:
- **9-slice** (buttons, progress frame, scrollbar arrows boxes): four
  corners copied 1:1, four edges stretched along one axis, center
  stretched both. Corner inset comes from the cicn (buttons ≈ 6px).
- **3-slice / 1-px-column stretch** (titlebar fill, scrollbar track):
  fixed ends + a single stretched row/column between.

---

## 1. Windows `[CODE]` — drawers `0x9312`,`0xa5f4`,`0xad62`,`0xb7cc`,`0xc2c2` → frame `0x35b0`

Fully traced; see kdef-findings §8 + §9. Recipe:

- **Frame + stripe + baked widgets**: walk the `wnd#` side recipe.
  Fixed segments (corners, edges, the `p10`/`p4` border pieces, and the
  cicn columns that contain the close/zoom/windowshade glyphs) copy 1:1.
  Grow segments (part codes **5/6/8**) stretch their own pixels
  (sample-and-hold). This edge-anchors the baked widgets (left stays,
  right shifts) as the window grows.
- **Title text**: a centered part (anchor mode 0/3). The title region is
  erased to the header **fill** color and the text drawn in the header
  **text** color — both from the scheme's window-header cluts (`-14335`
  active / `-14336` inactive), part code 1 (fill) + part code 2 (text)
  per the "Creating Color Schemes" doc. (The doc also notes a 2px
  text-color marker line in the window cicn; the clut carries the same
  colors and is reliably decodable, so we read the clut.) Decoded by
  `tools/theme-loader/decoders/clut.js` → `theme.json` `headerColors`.
  Fallback when a scheme ships no header clut: sample the composed bar's
  dominant fill + pick text by contrast.
- **Frame thickness**: from `part-0`'s body rect inset.
- cicn IDs by state: `-14336` inactive doc / `-14335` active /
  `-14332` collapsed-inactive / `-14331` collapsed-active; utility
  windows `-14320..-14313`; modal/alert `-14328/-14326/-14324/-14322`.

Compositor status: implemented. All FOUR edges walk their recipe via one
axis-agnostic `composeEdgeFromRecipe` (top/bottom along X incl. corners;
left/right along Y between). Validated: 7 Le (plain) unchanged, acid
(24-segment Mondrian sides) + evolution (53px bulbous tube) now render
their full ornate frames instead of a 1px side-stretch. Masking is
automatic via the cicn PNG alpha. Open: exact grow-distribution rule
(currently proportional) + protruding ornaments beyond the part-0 inset.

## 2. Push / bevel buttons `[CODE]` — drawer `0x30a8`

- **State → cicn**: `-10240` normal/off, `-10239` pressed/on, `-10238`
  disabled. (Bevel buttons: same format, IDs `-10176`/`-10174..-10150`;
  mixed states `-10232`/`-10231` handled in `0x26e0`.) `[DOC]` confirms
  bevel buttons "use the same format as the push button cicns."
- **Fit**: **9-slice** of the chosen cicn into the button rect via
  repeated `0xb64` blits — corners 1:1, edges stretched, center
  stretched. The slice constants in `0x30a8` encode a ~6px corner inset.
- Per kdef-findings §2.2, standard buttons are normally drawn by the OS
  CDEF over a Kaleidoscope-prepared background; schemes that ship button
  cicns get this explicit 9-slice path.

Compositor status: NOT yet implemented (v2 renders windows only).

## 3. Scrollbars `[CODE]` — drawer `0x66b4` (+ thumb `0x72f0`)

State → cicn (decompiled `0x66b4`): two orientations × four states. The
control fields `@0x15` (orientation), `@0x32` (pressed), `@0x14`
(disabled), and active-flag (`*(*(ctl@4)+0x11)` in `1..0xfd`) select:

| orientation | normal-inactive | normal-active | disabled | pressed |
|---|---|---|---|---|
| `@0x15 != 0` (**horizontal**) | `-8286` | `-8285` | `-8287` | `-8288` |
| `@0x15 == 0` (**vertical**) | `-8278` | `-8277` | `-8279` | `-8280` |

- **Small-bar special case**: when `width (param_1[2]-param_1[0]) < 17`,
  the layout centers (`half = w/2`, `mid = left + w/2`) — a collapsed
  layout for short scrollbars, drawn via `FUN_1018`.
- **Track**: stretch a single row/column (1px) between the arrow boxes
  `[DOC]`: *"the row/column where the track meets the arrow is drawn
  using pixels from the track cicn."*
- **Arrows**: fixed boxes at each end.
- **Thumb**: positioned by value (`FUN_990` with the value/range from
  `ctl@4`); ghost cicn `-8272/-8271` is the drag preview (`0x72f0`).
- Accent thumbs start at `-9472` `[DOC]`.

Remaining: the exact track-stretch + thumb-position arithmetic
(`FUN_1018`/`FUN_990`).

## 4. Progress bars `[DRAWER]/[DOC]`

- Determinate: frame cicn `-10080` (active) / `-10077` (inactive) +
  track `-10075`; the fill is the accent color ramp.
- **Indeterminate (barber pole)** `[DOC]`: `ppat -10064` (accent
  variants `-10063..-10057`). *"Kaleidoscope uses only the top ten
  pixels... fills the entire bar with this pattern, animating it by
  shifting the pattern four pixels to the right each draw."*
- **Fit**: frame 9-slice into the bar rect; interior filled with the
  ppat (tiled), phase-shifted per animation frame.

## 5. Checkboxes / radio buttons `[DRAWER]` — `0x26e0`/`0x30a8`

- Fixed-size `ics`/cicn glyphs, stamped 1:1 (NOT scaled). State IDs incl.
  `-10238` and mixed `-10232/-10231` `[DOC]`. On 16-color displays the
  black-and-white `ics#` is used; on 16-gray the `ics8` `[DOC]`.

## 6. Popup (tabbed) windows `[DOC]` — cicns `-12320` frame / `-12319` tab

`[DOC]` verbatim: *"draws the four corners of the frame directly from the
cicn, and stretches the single row or column of pixels between the grow
regions to draw the sides. It then stamps the tab on top of the frame,
stretching the middle column of pixels (which includes the text color
pixel) to make room for the title. The bottom six pixels of the tab cicn
overwrite the top six pixels of the frame cicn."* Disabled tab `-12317`,
disabled frame `-12318`. Uses cicn masks for border thickness + grow
regions.

## 7. Menus / menu bar `[DRAWER]` — `0x11fe` region

cicn/ppat `-12288`/`-12287`/`-12272`; accent menu-highlight cicns +
ppats start at `-12256` `[DOC]`. Menu bar + menu backgrounds are ppat
fills; highlight is an accent cicn/ppat overlay.

## 8. Sliders `[DRAWER]` — `0x4e4e`/`0x5a80`/`0x653c` region (cicns `-10208..-10197`)

A 12-part control (the `0x4f7e` code stores 12 cicn IDs `-10208..-10197`
into a part-table). Track + directional thumb variants. Thumb positioned
by value; non-directional vs directional thumbs per scheme. Layout not
yet instruction-traced.

## 9. Disclosure triangles `[DRAWER]/[DOC]` — cicns `-10102..-10112`

Fixed-size state glyphs (right/down × normal/pressed/inactive), stamped
1:1; 5-frame rotation animation `[DOC]`.

## 10. Grow box `[CODE]`

Anchored bottom-right via the §9 placement path (mode 8). Sizes
15×15–21×21 (doc-window) / 14×14–18×18 (utility) `[DOC]`; old 17×17
scaled to fit if wrong size.

## 11.5 Title placement — what the SIGNAL actually is `[CODE]/[DOC]`

The question: how does a scheme indicate where the title goes, and how does the
bar accommodate it? Investigated via the decompiled placement fn `0x35b0`, the
cinf (TMPL 129) spec, and a full dump of every cinf in 1990/1138.

**Two separable things — position (anchor) vs background (repeat):**

1. **Background fill repeats; the title is stamped on top.** Per *Creating
   Color Schemes* (§8.1): corners copy 1:1, the **"single row/column between
   the grow regions"** stretches/tiles to draw the sides (our recipe walk +
   grow-segment tiling), then the title region is **erased to the solid header
   fill color** (clut part 1) and text drawn in the **text color** (part 2).
   The title does NOT get its own repeating tile — it sits on the stretched
   fill. (1138's apparent "title tile" is just the grow fill tiled behind it.)

2. **Position = an ANCHOR, not a repeat.** `0x35b0` anchors the title in a
   title RECT (the available bar region) by the part anchor byte `@0x11` +
   margin `@0x2a`, with a fit check (`barWidth − margin < titleWidth` →
   truncate). The PER-ELEMENT anchor signal is the **cinf `textPixel` (x,y)**
   (TMPL 129): the coordinate that anchors the label AND whose pixel is the
   text color. Confirmed across control cinf — buttons `textPx=(4,4)`, large
   bevel `(7,7)`, tabs/SSF `(15,8)`, placards, text/arrow parts all carry it.

**The catch for WINDOW TITLES: there is no window-title cinf.** Dumping all 91
cinf in 1990 (and 1138): every cinf is a *control* background (view-BG, SBB/
NBB/LBB buttons, progress, tabs, placard, dialog/alert BG, text/arrow parts) —
**none** is the window title, and the window cicns (`-14335/-14336`) are
cinf-less. So the window title has **no per-scheme position signal**; the kDEF
falls back to its default anchor (centered in the bar / available region).

**Heuristics from fill geometry DON'T work** (tested): centering in the
first-fill→last-fill grow span put 1990 +23px right of center; the *widest*
grow segment put it +77px right — but the 1990/BeOS *references* show the title
left. Those references are the **old web renderer's** output (the user flagged
this), an approximation — not genuine kDEF — so they're not ground truth for
the default anchor.

**Conclusion / what we do:** window title → **center on the bar** (the kDEF
default; faithful for cinf-less windows). `composeWindowChrome.titleRegion`
still exposes the grow-fill span for diagnostics. Text height capped (~Chicago
12), erase band sized to the text + vertically centered, so the fill keeps
repeating around it.

**Implemented (the extractable signal):** the cinf `textPixel` is surfaced as
`chromeElement.textAnchor` and `composeButton` now colors the label with the
**authored** pixel there (e.g. 1990's buttons render their intended mid-gray
`#777` label, not a luminance-guessed white; 1984 white / beos black already
matched). Position stays centered — for a 9-slice button the textAnchor sits at
the (re-centered) face center, so it doesn't move; the signal's real payoff
here is color fidelity. Falls back to the contrast pick for cinf-less schemes
(apple-platinum-2). Window-title anchoring still needs a window cinf (absent) or
the `wnd#` part anchor `@44/@50` (`decodeWnd` doesn't parse it; kdef-findings §9.6).

## 11. Procedural Platinum baseline (`src/platinum.ts`)

The genuine Mac OS 8 "Platinum" chrome is NOT shippable as Kaleidoscope
cicn/ppat: the 8.5/8.6 System files draw it with `WDEF`/`CDEF` *code* (no
`wnd#`, no `thme`, no window-range cicns), and every "Platinum" Kaleidoscope
scheme (Apple Platinum 2, Black/Carl's/Chiper's Platinum) ships a partial set
that *defers* windows + standard controls to the OS. So a scheme that omits a
control's cicn falls back to a procedural gray-Platinum reimplementation.

**Geometry (native px, classic Appearance):**
- **checkbox / radio**: 12×12. 1px `#555` frame; checkbox has a 1px white
  top-left inner highlight + `#9a9a9a` bottom-right shadow (raised). Checkmark
  = 2px-thick stroke (short descend (3,6)→(5,8), long ascend (5,8)→(9,3)).
  Radio = ø12 ring, ø4 center dot. Mixed = a 2px dash at y6.
- **slider**: 16px control thickness; 6px sunken groove centered on the cross
  axis (`#9a9a9a` near edge / white far edge, `#c8c8c8` fill); raised thumb
  11 (cross) × 16 (along), 1px frame + top-left highlight, white→`#cdcdcd`
  vertical face gradient, positioned by value over `length − 11` of travel.

Disabled swaps the frame/mark to `#888`. Buttons + checkboxes/radios that the
scheme DOES ship still render from its cicns (resolve-by-id); these only fill
the gaps (e.g. apple-platinum-2 ships scrollbars/buttons but no
checkbox/radio/slider).

---

## Element → drawer reference (kDEF 0, 68k)

| Element | drawer fn | cicn IDs |
|---|---|---|
| document/utility windows | `0x9312`,`0xa5f4`,`0xad62`,`0xb7cc`,`0xc2c2`,`0xd368`,`0xe1b8` → frame `0x35b0` | `-14336..-14313` |
| push/bevel buttons | `0x30a8` (+ `0x26e0` mixed, `0x2f88` bevel) | `-10240..-10231`, `-10176..-10150` |
| sliders | `0x4e4e`,`0x5a80`,`0x653c` | `-10208..-10197` |
| scrollbars | `0x66b4` (+ thumb `0x72f0`) | `-8288..-8279`, `-8272/-8271`, `-9472` |
| menus / menu bar | `0x11fe` | `-12288..-12256` |
| checkbox / radio | `0x26e0`,`0x30a8` | `-10238`,`-10232/-10231` (ics) |
| popup windows | (doc) | `-12320..-12317` |
| progress bars | (doc) | `-10080..-10057`, ppat `-10064` |
| disclosure | (doc) | `-10102..-10112` |

## Reproduce / continue the trace

```
# extract + disassemble (working dir /tmp/kaleido-trace, not committed)
unar "~/Downloads/Kaleidoscope 1.8.2 Installer.app"
# kDEF 0 dumped via tools/theme-loader resource parser
m68k-elf-objdump -D -b binary -m m68k:68020 -EB kDEF_0.bin > kDEF_0_020.asm
# Ghidra full decompile (NOP-patch A-traps first so control flow survives):
#   replace every objdump-identified ".short 0xaXXX" word with 0x4e71 (NOP)
#   analyzeHeadless ... -import kDEF_0_nop.bin -processor 68000:BE:32:MC68020
#   -postScript DecompAll.java   (defines the 14 jump tables as data)
# → kdef_decomp_nop.c : 198/210 functions as readable C (traps appear as gaps)
```

Next: instruction-trace the scrollbar (`0x66b4`), progress, and slider
(`0x4e4e`) drawers to lift §3/§4/§8 from `[DRAWER]` to `[CODE]`.
