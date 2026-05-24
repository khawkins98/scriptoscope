# Title-text colour — sourcing (investigation + fix plan)

## Symptom
Rendered window-title text colour doesn't match the period references:

| scheme | reference title text | ours (`headerColors.text`) |
|---|---|---|
| 1984 (active) | **black** | `#99ccff` sky-blue |
| 1984 (inactive) | dark grey `#303030` | `#ffffff` |
| 1990 | white | `#878700` olive |
| evolution | white | `#878700` olive |
| platinum | black | `#555555` grey |
| beos | black (on gold bar) | `#888888` grey |
| 1138 | black | `#000000` (coincidentally right) |

## Where the colour comes from now (and why it's wrong)
`scripts/add-header-colors.mjs` pre-bakes `headerColors.{active,inactive}.text`
into `theme.json` from the `-14335`/`-14336` cluts, **index 2** (`headerColorsFromClut`
in `tools/theme-loader/decoders/clut.js`). `renderWindow.ts` then uses that as the
title colour (priority 1).

But those cluts are the **frame/bevel appearance** palette — only 7 entries
(values 0–6), and the real title colours are in **none** of them (verified per
scheme). So index 2 is a frame tint we mis-labelled "Text".

## Where it ACTUALLY comes from (traced from the 2.3.1 kDEF asm)
The title is drawn by the kDEF routine at **`0x5530`** (see kdef231-reference.md §1.4):
1. `GetWTitle` (`$A919`) — the title string.
2. `0x6582(idx)` — look up a marker rect from the rect-list (`a4@1938`).
3. `0xfc5c` ×2 — a **GetPixel** (bit/byte offset for 1/2/4/8-bit depth → index →
   RGB via `0x10702`). Samples **two adjacent pixels** of the chrome pixmap
   (`a4@1934`): one → text colour (`fp@-28`), the neighbour → shadow (`fp@-22`).
4. `0x56b2`: if the two are equal → one `RGBForeColor`+`DrawString`; else text in
   colour1 + a ~1px-offset shadow in colour2 (emboss).

So **a scheme encodes its title colour as a small marker swatch baked into the
window cicn**. There is no per-scheme title-colour clut / `wctb` (the schemes
ship no `wctb`; the `Colr` resource is just metadata — "Scheme Resource Info":
format version + scroll-bar flags).

## Runtime-fix plan (Aaron UI is runtime-compute-from-resources)
Compute the title colour at **render time by sampling the loaded cicn** — do NOT
pre-bake it. In `renderWindow.ts`:
- Drop the `headerColors.text` priority (it's a frame tint).
- Sample the cicn marker swatch (text + adjacent shadow) like the kDEF; draw the
  shadow emboss when text ≠ shadow.
- `headerColors.fill/frame/bevels` stay (they ARE the frame appearance, used for
  the CSS title bar) — only `.text` is bogus.

## Why it must be derived, not pre-baked or hardcoded
Aaron UI's whole premise is: load a Kaleidoscope scheme and **compute the
appearance from its resources at runtime**. So the title colour has to be
DERIVED from the loaded scheme — it must work for a scheme nobody has tested,
including one whose title colour we've never seen. That rules out hardcoding
per-scheme colours, and it's the reason the faithful "sample the cicn" approach
is preferred over a heuristic: only sampling the scheme's own marker can
reproduce an arbitrary author-chosen colour (e.g. dark-red or gold), because the
marker pixel *is* the author's choice. A heuristic can only ever guess.

## Approaches considered (so we can pivot)
**A — Sample the cicn marker pixel (FAITHFUL, the target).**
Replicate the kDEF's deterministic rule (`0x5530`): read the marker swatch the
scheme baked into its window cicn (text pixel + adjacent shadow pixel; emboss
when they differ). Generalises to *any* conformant scheme by construction — it's
the authoring contract — and is the only option that reproduces a never-seen
colour. **Blocker:** the exact marker coordinate isn't pinned. From the asm the
sample is `text = cicn(left+1, bottom-1)`, `shadow = cicn(left, bottom-1)` taken
from the rect `0x6582(0)` returns. But for 1984 the obvious `part-0` body rect
`[24,27,87,65]` makes that `(28,86)/(27,86)` — **out of bounds** (cicn is 89×82),
which can't be right. So `0x6582(0)` is NOT the body part-0, or the rect/coord
convention differs. The decompile is truncated through `0x6582`/`0xfc5c`/`0x4a64`
(`halt_baddata`), so the next move is to pin it **empirically**: instrument the
renderer to try candidate marker rects/offsets and keep the one coordinate rule
that reproduces all six references (they're diverse — blue/gold/grey/camo/metal
bars, black & white text — so a single rule satisfying all six is almost
certainly the universal one).

**B — Luminance-contrast heuristic (FALLBACK / safety net).**
Title = black, flipped to white when the bar is dark. A threshold of ≈55–64 on
the *declared fill* luminance reproduces all six (1990/evolution fill ≈34 → white;
everyone else ≥98 → black; note 1984-active is black on a dark-ish blue bar, so
this keys on the fill, not per-pixel contrast). **Pro:** trivial, needs no marker.
**Con:** can only ever produce black/white — a scheme with a coloured title would
render wrong, so it does NOT truly generalise. Keep it only for malformed /
marker-less cicns where the sample (A) comes back degenerate.

**C — `clut` part-2 (CURRENT, wrong).**
What ships today: `headerColors.text` = `-14335`/`-14336` clut part-2. That's a
frame/bevel tint, wrong for 5/6 schemes. To be removed once A (or B) lands.

## Decision & current status — SHIPPED (B + partial A), C dropped
`renderWindow.ts` no longer uses `headerColors.text` (C, the bogus clut tint).
The title colour is now derived at runtime: **(1)** a SATURATED cicn marker
pixel near the title plate if present (best-effort A — catches a genuinely
coloured title), else **(2)** luminance-contrast b/w against the bar (B). The
baseline-window path (`buildBaselineWindow`, used by markerless schemes like
apple-platinum-2) likewise derives the title colour by contrast from the fill,
not `hc.text`.

Verified against the corpus (measured title-bar dominant luminance → picked
colour, vs. reference):
- 1990 (lum 17) → white ✓, evolution (0) → white ✓
- 1984 (plate ~138) → black ✓, beos (gold ~196) → black ✓, platinum (light) → black ✓

So B reproduces the whole corpus at the standard 128 threshold; the fix was
mainly *removing C* so the contrast fallback could win. Empirically the
discriminator is clean (dark schemes ≤17, light ≥138), no threshold tuning
needed.

**Still open (lower priority):**
- **Exact marker coordinate (full A)** — B can't reproduce a scheme that uses a
  non-b/w title colour; only sampling the real marker can. The kDEF marker
  coordinate isn't pinned (the `0x6582(0)` body rect's corners don't yield a
  consistent text pixel across schemes; decompile truncated through
  `0x6582`/`0xfc5c`). Resume by sampling candidate marker locations and matching
  the references; ground truth in `kdef231-reference.md` §1.4 + the asm.
- **beos title-text visibility** — beos pins the title into a narrow gold tab;
  "Hello!" wasn't visibly rendered in the playground. This is a title-PLACEMENT
  matter (titleRegion width for the tab), independent of this colour fix (which
  only changed `fgHex`). Worth a separate look.
