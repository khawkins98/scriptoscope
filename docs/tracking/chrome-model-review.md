# Chrome-model review — replacing the `composeEdgeFromRecipe` heuristic pile

**Date:** 2026-05-22  ·  **Branch:** `v2-reset`  ·  **Status:** research + proposal, NO code changed.

Reviews `src/composeChrome.ts` (`composeEdgeFromRecipe`), traces the decompiled
Kaleidoscope 1.8.2 kDEF (`/tmp/kaleido-trace/`), and proposes a principled model
to replace the accreted heuristics. The 1138 title-centering regression is the
forcing case.

---

## 1. Current-logic map — what each heuristic approximates, where it is fragile

`composeEdgeFromRecipe` (`src/composeChrome.ts:224–521`). Six interacting rules:

| # | Heuristic | file:line | What it really approximates | Fragility |
|---|---|---|---|---|
| 1 | **stretch-vs-fixed = walk-axis uniformity** (`isStretchable`, `STRETCH_UNIFORMITY=0.9`, `COLOR_TOL=16`) | `323–347`, `354–372` | "stretch the single row/column of pixels between the grow regions" — only a region uniform along the stretch axis stretches losslessly | Mostly sound (it is the closest of all the heuristics to the kDEF). But it is a *content guess* standing in for a *structural fact* the recipe already encodes: the kDEF stretches the 1px lines bracketed by `at` markers and copies everything else. Uniformity mis-fires when decorative art happens to be uniform (a flat-black bezel column) or when a grow line happens to be 2px of near-but-not-equal pixels. |
| 2 | **plate column = score `stddev(lum)+mean(sat)`, lowest wins** | `251–288` | Locating "the middle column of pixels which includes the text color pixel" (authoring doc) | Pure guess. The kDEF does **not** score columns — it reads the **text-color marker pixel** (see §2b). Scoring picks the *visually cleanest* column, which is not always the marked one. |
| 3 | **dark-outlier "bezel" drop** (`meanLum < median*0.5`) | `281–293`, `364` | Avoiding a flat-black inner-bezel column out-"cleaning" the real bar (evolution col70) | **This is the 1138 bug.** It is a patch on top of patch #2, and it is data-dependent on the *median of the candidate set*, which shifts with the recipe. |
| 4 | **growth distribution: plate absorbs `titleW−plateNative`, rest ∝ native width, last grow soaks remainder** | `394–404`, `442–479` | Distributing the window's extra width across grow columns | Asymmetric and order-dependent. Does **not** keep the title centered (see §1 / 1138). The kDEF splits symmetrically about the title center (§2c). |
| 5 | **coverage fallback: promote thinnest non-corner segment** | `381–388` | Edge must reach full width even if nothing classed stretch | Band-aid for recipes whose true grow column was mis-classed fixed; also hides real frame-geometry bugs (trailing-transparent padding). |
| 6 | **widget-overlap + code-0 corners → fixed** | `305`, `356–357` | rectList widgets are baked / stamped once; corners copy 1:1 | Correct and matches the kDEF. Keep. |

### The 1138 regression, mechanically (confirmed)

`diag:render -- 1138 document-window --title "Hello!" --plate 44`. Top recipe:
`p0@1 p1@35 p11@36 p6@46 p5@47 p6@55 p8@56 p1@102` (cicn 103px → output 262px,
117px of growth). Resulting top-edge placement (from the diag JSON):

```
src.x=1  p0  fixed    out 1..35
src.x=35 p1  stretch  out 35..152   ← the ONLY grow column: absorbs ALL 117px
src.x=36 p11 fixed    out 152..162
src.x=46 p6  plate    out 162..206  ← title plate (grew 1→44)
src.x=47 p5  fixed    out 206..214
src.x=55 p6  fixed    out 214..215  ← dropped as "dark outlier" (lum 60 < median*0.5=64.5) → forced FIXED
src.x=56 p8  fixed    out 215..261
```

Two heuristics collide: rule #3 flags `p6@55` (lum 60, the right divider of the
sandwich) a dark-outlier and forces it fixed (`364`), removing the only RIGHT
grow column. Rule #4 then has just one grow column left (`p1@35`), so it absorbs
all 117px and shoves the plate (and "Hello!") to x=162. With a centered split,
the title region center should land near the window center (~131), not 184.

The candidate luminances cited (col46=221, col51=129, col55=60) confirm rule #3:
median=129, `median*0.5=64.5`, col55=60<64.5 → wrongly dropped.

### Other live fragilities (from `diag:audit`, 9 warnings)

- **Coverage stops short** (evolution `wnd--14296/14328`, `popup-window`; 1990
  `wnd--14324`; beos `document-window`). Two causes per `diagnostic-findings.md`
  §1: (a) trailing-transparent cicn padding overstating `frame.right/bottom`
  (beos); (b) recipes whose grow column the classifier missed, so the fallback
  (#5) picks too-small a segment. Both are downstream of the heuristic pile.
- **Side-edge widgets not stamped** (evolution `wnd--14296` part-2/3 at x=15) —
  pass 2 only handles top-band widgets (`composeChrome.ts:716–737`).

---

## 2. kDEF findings — what the binary + authoring doc actually say

Sources: decompiled C `/tmp/kaleido-trace/kdef_decomp_nop.c` (the bad-data-NOP'd
build — fuller than `kdef_decomp.c`), assembly `kDEF_0_020.asm`, and the period
authoring doc `…/Creating Schemes/Creating Color Schemes`.

### (a) fixed-vs-stretch: it is STRUCTURAL (corners fixed, the rest is a 1px line stretched between them), NOT a content test

The frame edge-draw is **`FUN_000066b4` (@0x66b4)**. For an edge wide enough
(`width >= 0x11 = 17px`, `kdef_decomp_nop.c:2932/3110`):

- Draws a **fixed 8px LEFT corner** (`local_8=8`, dst `[*param_1, *param_1+8]`,
  `:3000–3012`) via `FUN_00000e02`/`FUN_00001018` (the two blit-setups that wrap
  the CopyBits/CopyMask primitive @0x738).
- Draws a **fixed 8px RIGHT corner** (`local_14 = param_1[2]-8`, `:3029–3042`).
- Fills the MIDDLE with a **per-line loop**
  `for (sVar5=0; sVar5 < height; sVar5++)` (`:3067`) that blits **one cross-line
  at a time, stretched** across `[*param_1+8, param_1[2]-9]` (`:3091–3097`).

For a too-narrow edge (`width < 17`) it splits the corner art `sVar5/2` left /
`sVar5 - sVar5/2` right (`:2933–2997`, rounding remainder to the RIGHT). The
authoring doc states the same rule in prose (line 7 / line 52 / line 57):

> "It draws the four corners of the frame directly from the cicn, and **stretches
> the single row or column of pixels between the various grow regions** to draw
> the sides."

> "draws the four corners first, then it draws the edges by **stretching the
> colors along the edge** of the icon, and finally fills the inside with the
> background color at the center."

**So the signal is NOT the part code, NOT segment width, NOT a uniformity test of
the pixels.** The recipe's `at` markers ARE the grow-region boundaries: the cicn
columns between markers that the doc calls "the single row or column of pixels"
are the 1px lines that get stretched; everything bracketed as a corner/widget is
copied 1:1. The current `isStretchable` content-test is a *re-derivation* of
information the recipe already carries. (This matches and supersedes
`kdef-disassembly-findings §8.6`, which had concluded "uniformity" empirically —
the binary shows uniformity was a proxy for "is this one of the inter-marker 1px
grow lines.")

### (b) title-bar column / text-color pixel: it is the MARKED pixel, read from data — NOT a scored column

The tab/title stamp is **`FUN_000072f0` (@0x72f0)** → calls **`FUN_00005eb4`
(@0x5eb4)**, the 3-piece centered stretch. The doc (line 7, line 58):

> "It then stamps the tab on top of the frame, **stretching the middle column of
> pixels (which includes the text color pixel)** to make room for the title."

> "Near the top of the various window icons, there is a **two pixel horizontal
> line which Kaleidoscope uses to determine the text color** for the window title
> bar… the pixel immediately to the right of the two text color pixels [is the
> embossing color]."

The decompiled scheme data confirms this is **a recorded marker, not a guess.**
In `theme.json`, `part-4` is exactly that marker rect — a 1px-wide vertical span
at the top, and in **every bundled theme it sits at the left edge of the title
region**:

| theme | title-region `at`s (p5/p6) | `part-4` (text-marker) rect | plate col picked today |
|---|---|---|---|
| 1138 | 46, 47, 55 | `[46,1,47,18]` (x=46) | 46 ✓ |
| 1984 | 41, 46 | `[40,6,41,24]` (x≈41) | 43 |
| 1990 | 46, 47, 55 | `[46,14,47,32]` (x=46) | 46 ✓ |
| evolution | 69, 70, 71 | `[69,12,70,44]` (x=69) | 69 ✓ (after the outlier patch) |
| beos | 34, 35, 50 | `[34,3,35,19]` (x=34) | 34 |

The marker's x **is** the plate column. The stddev+saturation scoring (#2) and
the dark-outlier drop (#3) exist only because the composer was *guessing* this
column from pixels instead of reading the marker rect that the recipe + part-list
already provide. (`kdef-disassembly-findings §13.4` flagged this: cinf carries
explicit `Text Pixel x/y`; for the cinf-less window cicns the equivalent marker
is the `part-4` rect / the doc's "two-pixel horizontal line.")

### (c) growth distribution: SYMMETRIC about the title center — this is the 1138 fix

`FUN_00005eb4` (@0x5eb4, `kdef_decomp_nop.c:2606–2791`) is the routine that grows
the title region. Decoded (top-title branch, `param_2` = `[left,top,right,bottom]`,
`sVar1` = native tab width):

```c
if (sVar1 < dstWidth) {                       // window wider than native tab
  sVar4 = (left + right) / 2;                  // CENTER of the destination span
  // LEFT piece : src cols [3 .. sVar1/2] → dst [left+3 .. (center - native/2)+2]
  // MIDDLE     : the 1px text-color column stretched across the center gap
  // RIGHT piece: src cols [sVar1/2 .. ] → dst [(center + native/2)-2 .. right-3]
}
else  FUN_00001018(...)                        // exact fit → copy 1:1
```

The left half of the native tab art is pinned to the **left** of center
(`center - native/2`) and the right half to the **right** of center
(`center + native/2`); the **middle marked column is stretched to fill the gap**.
i.e. the extra width is added **symmetrically at the center**, keeping the title
centered. `FUN_000066b4`'s narrow-window corner split (`sVar5/2` / `sVar5-sVar5/2`,
`:2938/2967`) shows the same symmetric-halving idiom for the frame corners.

This is the single most important finding: **growth is centered, not "plate first,
then proportional with the remainder on the last column."** Rule #4's
distribution is the wrong shape, which is why 1138 cannot center.

### What could NOT be pinned to the instruction

- The exact px **rounding** when a window has MORE than one independent grow line
  per side besides the title (e.g. evolution's many 1px `p1` gaps between `p18`
  links). The kDEF stretches each inter-marker grow line; the doc says only that
  the title middle is centered. I did not find arithmetic that *proportionally
  weights* multiple grow lines — the structural reading (each grow line stretches
  to fill its own inter-marker gap, scaled by the same content/native ratio) is
  consistent with the assembly's per-line loop but is not a single decoded
  formula. Treat the multi-grow-line split as "best-effort, must satisfy the
  corpus" rather than "proven."
- The full **part-code → behaviour table**. Confirmed structurally: corners +
  widget columns fixed, inter-marker 1px lines stretched, racing-stripe TILED for
  utility windows (doc line 60: *"does not stretch the icon; rather, it tiles
  it"*). The numeric codes (5/6/8/11/18) are a frame-piece vocabulary, not a
  fixed/stretch flag — consistent with `kdef-disassembly-findings §8.2/§8.6`.

---

## 3. Proposed unified model — replace the heuristic pile

Three principled rules, grounded in §2. Keep rule #6 (corners/widgets fixed).

### Rule A — stretch-vs-fixed is RECIPE-STRUCTURAL, with uniformity as a tiebreak only

The recipe's `at` markers bracket the segments. A segment is a **grow line** iff
it is one of the thin inter-marker lines the kDEF stretches; everything else is
fixed art drawn once. Concretely:

- `code === 0` (corner) → fixed. (unchanged)
- overlaps a rectList widget → fixed. (unchanged)
- otherwise → **stretch iff native width ≤ a small grow-line width** (the doc's
  "single row or column" — i.e. 1, with a tolerance of ~2 for authored 2px
  bevels), AND it is uniform along the walk axis. Wide segments (`p8` panels,
  button rows, decoration blobs) are fixed regardless of uniformity.

This keeps the current `isStretchable` *as the tiebreaker* for the rare 2px line,
but the primary signal becomes "is this a thin inter-marker line", which is what
the kDEF actually keys on. It removes the failure mode where a wide uniform
decoration is wrongly stretched, and is faithful to the structural reading in
§2a. (Note: the prior pure-width cut failed on beos's wide-but-uniform 65px
border — but that border IS a single grow region in beos's recipe; the fix is to
trust the recipe markers there, not to widen the width threshold globally. Verify
beos's bottom recipe brackets that 65px as one inter-marker span before relying
on this.)

### Rule B — plate column = the text-color MARKER, read from data

Replace the stddev+saturation scoring (#2) AND the dark-outlier drop (#3)
entirely:

- The plate column = **`part-4`'s x** (the text-color marker rect) when present,
  clamped into the title region (`p5/p6`) span. Fall back to the **left edge of
  the title region** when no marker rect exists (the marker sits there in every
  bundled theme — §2b table).
- The plate SEGMENT is the title-region segment containing that column. It grows
  (see Rule C). The other title-region segments (the sandwich's outer `p6`
  dividers) are **fixed 1px** — not because they are "dark outliers" but because
  they are the bracket lines around the marked middle column, exactly as
  `FUN_00005eb4` pins the left/right halves of the tab and stretches only the
  middle.

This deletes the median/`*0.5` logic that broke 1138, and the `bezelKeys` set.
It fixes evolution (marker x=69, no scoring needed) and keeps 1990's black LED
bar (marker x=46) without the "is it an outlier" gymnastics.

### Rule C — growth is distributed SYMMETRICALLY about the title center

Replace rule #4 with the kDEF's `FUN_00005eb4` shape:

1. Compute the title region's target **center** = window content center
   (`fullW/2`), per §2c (`sVar4 = (left+right)/2`).
2. The title plate grows so the **marked column sits at center** and the plate
   spans the title width, with the two halves of the native title art pinned at
   `center ± nativeTitle/2`.
3. The window's remaining extra (`fullW − cicnW − plateGrowth`) splits **evenly
   between the grow line(s) LEFT of the title and the grow line(s) RIGHT of the
   title**. With one grow line each side (the common case — 1138's `p1@35` left,
   and the `p8@56`/right border which must become a grow region), each absorbs
   half → the title stays centered. Multiple grow lines on a side share that
   side's half proportionally (best-effort, per §2c caveat).

For 1138 this means: 117px of growth → ~58px to the left grow line, the plate
centers, ~58px to a right grow line, "Hello!" lands centered. **This requires
that the right side actually HAS a grow line** — which is why Rule A must not
force `p6@55`/`p8@56` fixed. Under Rule A, `p8@56` (the right side fill) is a
fixed *panel* only if wide+structured; if 1138's `p8` is the uniform side border
it stretches. (Confirm against the cicn: 1138 `p8@56` is the flat side row noted
in `kdef-disassembly §8.6` — it must be a grow region for the right half to
absorb growth. If it is genuinely fixed art, the right grow line is the border
`p1@102`-adjacent column, and growth still splits about center.)

### Net deletions

- `colStats` scoring (`251–293`) → replaced by marker lookup.
- `bezelKeys` set + the `median*0.5` outlier logic (`281–293`, `364`).
- Rule #4's proportional+remainder distribution (`394–404`, `442–451`) →
  symmetric-about-center.
- Keep: corners/widgets fixed (#6), the per-segment independent walk, the
  pass-2 widget stamp, the far-edge cap.

---

## 4. Risk assessment

**Medium risk.** It is a rewrite of the core distribution, but each rule is
grounded in the binary and the changes are *deletions of guesswork*, which lowers
the surface for new edge cases.

What must NOT regress (cases from `diagnostic-findings.md` the model must still
satisfy):

- **evolution metallic plate, not black bezel** — Rule B (marker x=69) gives this
  directly; no scoring to mis-fire. LOW risk.
- **evolution no stray dark box beside the title** — Rule B fixes the outer `p6`
  as 1px bracket lines (not stretched). LOW risk.
- **1990 black-LED title bar** — marker x=46; no outlier test to fight. LOW risk.
- **BeOS uniform bottom border stretches** — Rule A leans on the recipe markers;
  **must verify** beos's bottom recipe brackets the 65px border as a single grow
  span, else the width cap would wrongly fix it. MEDIUM risk — verify first.
- **1984 button row drawn once** — wide+structured → fixed under Rule A. LOW risk.
- **evolution `p18` links/corners once, 1px gaps stretch** — links/corners are
  wide → fixed; 1px gaps are inter-marker grow lines → stretch. LOW risk
  (same outcome as today, reached structurally instead of by uniformity).

Biggest specific risk: **Rule C's multi-grow-line split is the least
binary-proven part** (§2c caveat). evolution document-window has many 1px grow
gaps; an even left/right-of-center split must still give each gap enough width to
not collapse. Mitigation: implement Rule C as "split extra evenly between the
left-of-title and right-of-title grow SETS, then within each set proportional to
count," and gate the change behind a full `diag:audit` run on all five themes
before relying on it.

Secondary risk: themes where `part-4` is **absent or mis-extracted** fall back to
"left edge of title region." Verify the extractor populates `part-4` for all
recipe-bearing window types (it does for the five document-windows; dialogs/alerts
without a title region simply have no plate, which is correct).

Coverage-gap warnings (§1) are **orthogonal** — they are frame-geometry
(trailing-transparent padding) bugs, not distribution bugs, and this model neither
fixes nor worsens them. Address separately (the documented coordinated recipe +
body + opaque-bound trim).

### Suggested sequencing
1. Land Rule B alone (marker-based plate column) — smallest, removes the 1138
   *trigger* (the outlier drop) and is independently verifiable.
2. Land Rule C (symmetric distribution) — the actual centering fix.
3. Re-evaluate Rule A only if A-via-uniformity still mis-classes a case; today's
   uniformity test is close enough that A is the lowest-priority change.
