# kDEF layout recipes — the exact compositor spec (per chrome element)

Derived by decompiling Kaleidoscope's `kDEF 0` (68k). Goal: an exact,
code-grounded recipe the pixel compositor can implement faithfully — not
screenshot approximations.

> **AUTHORITATIVE WINDOW-CHROME DECODE: [`tracking/kdef231-recipe-walk.md`](./tracking/kdef231-recipe-walk.md)
> + [`tracking/compositor-spec.md`](./tracking/compositor-spec.md).**
> Those decode the **2.3.1** kDEF — the engine our K2 schemes actually use —
> and they SUPERSEDE the window-frame material in this file. This doc predates
> the 2.3.1 part-code model; its window sections (§1, §11.5, §11.6) describe an
> earlier, **contradicted** reading (a grow set of `{5,6,8,18}` and a
> pixel-variance "find the title plate" heuristic). The 2.3.1 decode is the
> opposite on the load-bearing points: fixed-vs-stretch is a **part-code jump
> table** (5/6 are FIXED and only collapse; 8/11/13/14 stretch; 12 tiles; 18 is
> a single scaled blit), and the title plate is the **code-5 cell grown to the
> title width** — found by part code, not by scoring pixel columns. Read §1 /
> §11.x below only as historical context; trust the tracking docs for windows.

What is STILL useful here and not covered by the tracking docs: the CONTROLS
recipes (scrollbars §3, progress §4, checkboxes/radios §5, popup/tab windows §6,
menus §7, sliders §8, disclosure §9, grow box §10) and the procedural Platinum
fallback (§11). NOTE: this controls material has NOT been re-verified against the
2.3.1 binary the way the window model was — treat its claims with caution and
verify against the asm when a render disagrees.

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
   cicn edge into segments; fixed cells copy 1:1, stretch cells grow,
   code 12 tiles, code 18 scales. **(For the exact 2.3.1 mechanism — the
   part-code jump table that decides this — see
   [`tracking/kdef231-recipe-walk.md`](./tracking/kdef231-recipe-walk.md);
   the description here is the older approximation.)**
3. **Anchor placement** (`0x35b0`) — used for the grow box and control
   parts. (For window TITLES the 2.3.1 decode found no separate 3×3
   anchor fn — it's a 4-way side switch plus title-centre math; see the
   recipe-walk Q4. Trust the tracking doc for window-frame placement.)

Two raster fits recur:
- **9-slice** (buttons, progress frame, scrollbar arrows boxes): four
  corners copied 1:1, four edges stretched along one axis, center
  stretched both. Corner inset comes from the cicn (buttons ≈ 6px).
- **3-slice / 1-px-column stretch** (titlebar fill, scrollbar track):
  fixed ends + a single stretched row/column between.

**Per-region resize policy.** Each region resizes as one of: **fixed** (copy
1:1, anchor to an end — corners, baked widgets, grow box), **fill-container**
(tile/stretch to absorb leftover space), **grow-to-content** (expand to a
content-driven size — a tab grows to its label, a progress fill to its value),
or **repeat-per-item** (one cell per data item — list rows). These categories are
still a useful lens for the CONTROLS below.

> **Correction for WINDOW FRAMES:** an earlier version of this note claimed the
> resize policy "cannot be read off the part code alone — you classify by the
> cicn pixels (variance + saturation)." The 2.3.1 decode shows that is **wrong
> for window frames**: fixed-vs-stretch-vs-tile-vs-scale is read **purely from
> the part code** via the `0x49d6` jump table + `0x5178` chains — no pixel
> classification, no width threshold. The title plate is the code-5 cell grown
> to the title width, not the lowest-variance column. See
> [`tracking/kdef231-recipe-walk.md`](./tracking/kdef231-recipe-walk.md). The
> pixel-classification model below applies (if at all) only to controls whose
> recipes are not yet instruction-traced.

---

## 1. Windows — SUPERSEDED (see the 2.3.1 tracking docs)

> The window-frame model is now authoritatively decoded in
> [`tracking/kdef231-recipe-walk.md`](./tracking/kdef231-recipe-walk.md) +
> [`tracking/compositor-spec.md`](./tracking/compositor-spec.md), implemented in
> `src/composeChrome.ts`. The earlier reading that lived here — a grow set of
> `{5,6,8,18}` with code 18 as a "gradient" part, plus a pixel-variance plate
> search — is **contradicted** by the 2.3.1 decode and has been removed to avoid
> two conflicting window specs. Use the tracking docs.

The few facts here that the tracking docs assume rather than restate:

- **cicn IDs by state:** `-14336` inactive doc / `-14335` active /
  `-14332` collapsed-inactive / `-14331` collapsed-active; utility windows
  `-14320..-14313`; modal/alert `-14328/-14326/-14324/-14322`.
- **Frame thickness** comes from `part-0`'s body-rect inset (the `drawableExtent`
  refinement is in `compositor-spec.md`).
- **Title text colour** = the header text colour from the window-header cluts
  (`-14335` active / `-14336` inactive), decoded by
  `tools/theme-loader/decoders/clut.js` → `theme.json.headerColors`; fallback =
  contrast vs. the composed plate.

## 2. Push / bevel buttons `[CODE]` — drawer `0x30a8`

- **State → cicn**: `-10240` normal/off, `-10239` pressed/on, `-10238`
  disabled. (Bevel buttons: same format, IDs `-10176`/`-10174..-10150`;
  mixed states `-10232`/`-10231` handled in `0x26e0`.) `[DOC]` confirms
  bevel buttons "use the same format as the push button cicns."
- **Fit**: **9-slice** of the chosen cicn into the button rect via
  repeated `0xb64` blits — corners 1:1, edges stretched, center
  stretched. The slice constants in `0x30a8` encode a ~6px corner inset.
- Standard buttons are normally drawn by the OS CDEF over a
  Kaleidoscope-prepared background; schemes that ship button cicns get
  this explicit 9-slice path.

Compositor status: NOT yet implemented (the compositor renders window chrome only).

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

## 11.5 / 11.6 Title placement — SUPERSEDED by the 2.3.1 decode

> The title-plate model is now decoded in
> [`tracking/compositor-spec.md` § Title TEXT + plate](./tracking/compositor-spec.md)
> and [`tracking/kdef231-recipe-walk.md` Q4](./tracking/kdef231-recipe-walk.md).
> The long write-ups that used to live here (a `colNoise` pixel-variance search
> for the plate column, and a "window title → center on the bar, there's no
> per-scheme signal" conclusion) are **contradicted** by the 2.3.1 trace and
> have been removed.

What the 2.3.1 decode actually establishes (use the tracking docs for detail):

- The plate is the **code-5 cell**, flanked by code-6 bezels. The kDEF measures
  the title via `StringWidth`, gates it (title-fits at `0x4f58`), and grows the
  code-5 DEST span to the **measured title width**, centred — found by part
  code, NOT by scoring pixel columns for luminance variance.
- The plate src is **tiled** across the reserved width (`0xfeae`), and the two
  fill halves pin to its edges. Growth is distributed **symmetrically about the
  title** (the side splits into left/right halves at the title cell).
- Title **text** is a centred part drawn at the content centre in the header
  text colour (`renderWindow.ts`), independent of frame growth.

The one still-useful control-side finding: the **cinf `textPixel`** is the
per-element label anchor + text-colour pixel (surfaced as
`chromeElement.textAnchor`), used so a button label renders in the scheme's
authored colour rather than a luminance guess. That remains relevant for the
CONTROLS work below.

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
