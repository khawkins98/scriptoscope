# Title-text colour — sourcing (investigation + fix plan)

## Symptom
Rendered window-title text colour doesn't match the period references:

| scheme | reference title text | ours (`headerColors.text`) |
|---|---|---|
| 1984 (active) | **black** | `#99ccff` sky-blue |
| 1984 (inactive) | dark grey `#303030` | `#ffffff` |
| 1990 | **black** (on a light plate) | `#878700` olive |
| evolution | **black** (on light metal) | `#878700` olive |
| platinum | **black** | `#555555` grey |
| beos | **black** (on gold bar) | `#888888` grey |
| 1138 | **black** | `#000000` (coincidentally right) |

**Every scheme uses BLACK.** (An earlier pass wrongly read 1990/evolution as
white — they're black, drawn on a light area of the bar.)

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

## Runtime-fix plan (Scriptoscope is runtime-compute-from-resources)
Compute the title colour at **render time by sampling the loaded cicn** — do NOT
pre-bake it. In `renderWindow.ts`:
- Drop the `headerColors.text` priority (it's a frame tint).
- Sample the cicn marker swatch (text + adjacent shadow) like the kDEF; draw the
  shadow emboss when text ≠ shadow.
- `headerColors.fill/frame/bevels` stay (they ARE the frame appearance, used for
  the CSS title bar) — only `.text` is bogus.

## Why it must be derived, not pre-baked or hardcoded
Scriptoscope's whole premise is: load a Kaleidoscope scheme and **compute the
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

## Decision & current status — SHIPPED: title = black (dimmed when inactive)
The corpus check above settles it: **all six schemes draw a BLACK title**
(dimmed grey when inactive). `renderWindow.ts` now just uses
`state === 'inactive' ? '#808080' : '#000000'`, and `buildBaselineWindow`
derives black/white by contrast from its (light) fill. We dropped THREE things
that were each wrong:
- **C — `headerColors.text`** (clut part-2): a frame tint (1984 → sky-blue).
- **the "saturated cicn marker"** heuristic: it picked the saturated BAR colour,
  not a title marker — **this is what made beos invisible** (gold `#ffcc00`
  sampled → gold-on-gold) and would have mis-coloured 1990/evolution.
- **the luminance-contrast** rule: it measured the dark frame, not the light
  title plate the text actually sits on, so it wrongly WHITENED 1990/evolution.

Verified in the demo: 1984 / 1138 / platinum / beos / 1990 / evolution all show
a black, readable title (beos black-on-gold now visible; 1990 black on its light
plate; evolution black on the metal).

So both reported bugs (beos invisible, evolution white) had ONE root cause — the
heuristics — and the constant-black rule is simpler, correct for the whole
corpus, and matches the classic-Mac default.

### The "true fix" (per-scheme marker sample) — attempted, not pinnable
A follow-up pass tried to make the colour fully derive-from-scheme (sample the
kDEF marker so a colour-customised scheme would Just Work). It did not pan out,
and the negative result is itself informative:

- **Contrast at the actual glyph position** — *worse* than constant-black. 1990's
  title sits on a narrow LIGHT plate inside dark camo; averaging the text box
  reads dark (lum 29) → would pick white, but the reference is black-on-plate.
- **The kDEF marker (`0x5530`)** — its decoded coordinate (`(L+1,B-1)` of the
  `0x6582(0)` body rect) gives WHITE for 1984, contradicting the black reference,
  so the reading is incomplete; the decompile is truncated through
  `0x6582`/`0xfc5c`/`0x4a64`.
- **Exhaustive empirical search** for a single marker offset (body-rect corners,
  cicn corners, ±1) that is black in all six ACTIVE cicns and dimmed in the
  inactive ones: **none exists.** `body-TL` is dark→dimmed (marker-like) for 1984
  & beos, but 1990's `body-TL` is *light* and its dark pixel is one over — the
  opposite. There is no consistent per-scheme title-colour marker to read.

**Conclusion:** for this corpus the title colour is the **classic-Mac system
default** — black active / grey inactive, drawn by the Window Manager; schemes
theme the *frame* (cicn), not the title text. So constant-black is the faithful
answer, not a shortcut. A colour-CUSTOMISING scheme (if any exist) would use the
`0x5530` marker path; reopen only with such a scheme as a test case + a
non-truncated decode. Ground truth: `kdef231-reference.md` §1.4 + the asm.

### The marker's GEOMETRY is reliable — it anchors the title vertically (2026-05-25)

The marker's *colour* isn't pinnable (above), but its *position* is. The same
≤2px-wide vertical line — `composeChrome` already detects it (`titleMarkerX`, the
first ≤2px part with top inside the bar) — is drawn by the scheme AT the title, so
its **y-span is the title text's vertical band**. `composeChrome` now exposes the
band centre as `titleRegion.midY` (clamped into the bar) and `renderWindow` centres
the title there, else falls back to `frame.top/2`. This fixed titles sitting too
high on tall ornate bars (evolution, marker midY 28 of a 53px bar) while leaving
flat bars unchanged (1138, midY ≈ centre). Corner-sprite schemes ship no marker →
geometric fallback. Data-driven on import, no per-scheme code; the `title` rule in
`lint:themes` flags a marker band that overshoots the bar (clamp = likely a
misdetected stray part) or a document-window with no marker. So the marker the
colour analysis couldn't trust for *colour* turned out to be the faithful signal
for *placement*.
