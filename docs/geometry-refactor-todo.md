# Geometry & Wiring Refactor — Working TODO + Context

**Status:** in progress · **Last updated:** 2026-05-26 · **Branch:** main (HEAD `ae303df`)

A living doc for the effort to move the System 7/8 (Platinum-family) window/control
**geometry + pictogram wiring** from hand-tuned guesses to **decode-grounded data**,
and to settle the rendering model so it stops accreting special cases. Read this
before continuing — it captures what we're doing, how, why, what's done, and what's left.

---

## The goal (why this exists)

Kaleidoscope schemes are *data* — they ship `cicn`/`wnd#`/`cinf`/`ics4` resources and
a clean compositor plays the recipe. Apple **Platinum** (System 7/8) is *code* — the
OS draws chrome with `WDEF`/`CDEF` procedures and ships almost no window/control
resources. The "maturity wall" is the special-casing that accreted from forcing the
procedural Platinum look through the resource pipeline: ad-hoc geometry constants,
three competing art strategies, scattered `if`s.

The fix, validated by the AppearanceLib decode: **Apple itself separates theme DATA
from a generic DRAWER** (`DrawThemeButton` is a thin dispatcher over theme data). So we
express the geometry + wiring as DATA, sourced from the decode where we have it, and a
generic composer reads it. No procedural redraw of art that ships as a resource.

## Principles (the decisions to honor)

1. **Prefer the decode over manual geometry.** Existing geometry was created mostly by
   hand. Where the decompiled code pins a value, use it. Tag every spec value
   `decode:` (cite the `0xADDR`) vs `tuning:` (calibration — e.g. colors are runtime
   `wctb` data, not in the binary, so bevel amounts can't be decoded).
2. **Don't redraw what ships as a resource.** Buttons/scrollbars are real `cicn`s
   (graft/slice); checkbox/radio are real `ics4`/`ics8` pictograms stamped 1:1. The
   procedural drawer is a FALLBACK for cicn-less schemes, never a replacement for real
   Platinum art. (A procedural control generator was built and **reverted** for exactly
   this reason — see commit `faf2462`.)
3. **Verify before building.** Twice this session we nearly rebuilt things that already
   existed (a button CDEF that isn't in the corpus; ics8 decoding that was already done).
   Check the spec files + the actual resource set first.
4. **Behavior-preserving refactors are proven byte-identical.** Use the verification
   recipe below; a constant-extraction must produce identical renders.
5. **Single source of truth.** Geometry should live in one place, imported by both the
   runtime and the generator — not duplicated.

---

## Done (do NOT redo)

- **Controls decode complete** → `docs/spec/platinum-controls-decode.md` +
  `platinum-controls-faithfulness-ledger.md`. Verdict: **FALLBACK** — controls can't be
  pixel-decoded (CDEF-n63 AND CDEF-n1 are both track procs; pixels live in `AppearanceLib`
  PPC; `DrawThemeButton` is a vtable dispatcher). Color data extracted →
  `themes/apple-platinum-replica/sources/platinum-palette.json` (21 accents, `cctb`
  grays incl. the genuine lavender/indigo highlight, 256 system palette).
- **Corner-sprite window geometry → decode-grounded data.** `src/cornerSpriteGeometry.ts`
  is the composer's **complete single source of truth** (commits `7dffbeb` + `ae303df`).
  `composeCornerSprite.ts` has ZERO inline geometry literals. Real fix: title-bar widgets
  are **7×7 fixed** (was a manual ~12px), close at `title.left+4` (was +3).
- **Pictogram wiring verified complete** across all 4 corner-sprite schemes: ics4 widget
  + arrow glyphs for apple-platinum-2 / platinum-8 / system7-nostalgia-silver; ics8 for
  black-platinum (decoded + wired in `87ef871`). No orphan-glyph backlog.

---

## Ongoing workstream: geometry-glitch reconciliation

The owner is still seeing **lots of small geometry glitches** in the live render.
Chasing these down is a CONTINUOUS workstream that runs alongside the structural items
below — not a one-time pass. The loop, every time:

1. **Spot** a glitch (live app, or `diag:render` matrix — see "How to work").
2. **Trace** it to the specific geometry value (which field in `cornerSpriteGeometry.ts`
   / `CORNER_SPRITE_WINDOWS` / `window-types.mjs`, or which composer line).
3. **Reconcile against the source of truth** — the decode (`platinum-wdef125-decode.md`
   Constants, cited `0xADDR`) first; the real shipped resource second; a measured
   reference only as last resort. Prefer the decode; never re-guess.
4. **Validate** — `diag:render` before/after + `lint:themes` 0/0; eyeball against the
   reference. Behavior-preserving when consolidating; deliberate + noted when correcting.
5. **Record** the glitch + its fix in the catalog below.

### Glitch catalog (fill in as found / fixed)
| scheme | window type | glitch (what looks wrong) | root-cause value | source of truth | status |
|---|---|---|---|---|---|
| platinum-8 | document | (NOT A BUG) bar looked "washed out" | platinum-8's `cicn -14331` is a flat gray block BY DESIGN | platinum-8 itself | **CLOSED — FAITHFUL.** Owner confirmed: platinum-8's document bar IS flat (no pinstripe). ⚠️ GUARDRAIL: do NOT add stripes — a PRIOR agent wrongly "fixed" this and it had to be reverted. The flat `-14331` is correct; the render path is correct. This is the punch-list trap (special-casing a non-bug); the reconcile loop correctly closed it. |
| all platinum/system7 | document | title-bar widgets too big (~16px) + ~1px too high | composer sized the box by the full 16×16 ics resource, not the glyph's INK (mark is 13×13/11×11, corner-anchored) | kDEF drawable-extent rule (trim transparent tails) | **CLOSED** — `composeCornerSprite` now sizes+centers widgets by glyph ink bbox; 16×16@y2 → 13×13@y3. Also widens the gripper region. |
| apple-platinum-2, platinum-8, system7 | document | widgets flat / poor color (tan tint on aplat2) | `extract-icons.mjs` preferred **ics4 (4-bit/16-col) over ics8 (8-bit/256-col)** at the same id — discarded the richer shipped ics8; the tan was a 4-bit palette artifact | the scheme's own shipped ics8 (8-bit) | **CLOSED** — extractor now emits ALL depths (full gallery inventory — every shipped asset); the renderer's glyph map picks the HIGHEST depth per id. Re-extracted ALL schemes. Widgets gain depth/sheen + correct gray (no tan); ics4-n14336=4 colors → ics8=9. Stretch goal: let users pick a lower depth in the viewer. |
| all platinum/system7 | document | title bar ~1px too high / **top frame highlight cropped** (the gradient at the top of the border box) | **NOT the chrome buffer** — verified composeCornerSprite draws row 0 = black outline + row 1 = highlight (240,240,240) correctly. The crop is DOWNSTREAM: renderWindow's chrome-canvas placement, or a clipping container in the live diagnostic DOM/CSS. | buffer is correct → fix the layout layer | **traced, OPEN** — needs a LIVE DOM/browser inspect (renderWindow + demo CSS); fresh session. ⚠️ Don't hunt in composeCornerSprite — the geometry is fine. |
| apple-platinum-2 | controls (radio etc.) | icons look flatter / "shades missing" vs reference | **NOT a fidelity loss on our side.** Verified: ics8 radio = 12 shades (exact Mac 17-step grays + indigo); PALETTE256 is the real Mac palette. AND ics8 is the RICHEST resource the scheme ships for these roles — the cicns at the same ids are DIFFERENT roles (cicn -10216=progress-bar, -14334=grow-box, -14336=window-proxy) with FEWER colors (5–7) than the ics8 (9). Stamped 1:1, no stretch/quantization; the scheme's purples are system-palette colors. | apple-platinum-2's own ics8 — and we use it at full fidelity (= what Kaleidoscope rendered) | **CLOSED — we match the original theme.** The reference is APPLE's real Platinum (blue, live Appearance-Manager gradients); apple-platinum-2 is the PURPLE 1999 recreation, flatter by its author's design. Apple's richer look = the `.thme` STRETCH goal (a DIFFERENT scheme), NOT needed for apple-platinum-2 fidelity. Earlier framing conflated the two. |
| _(owner is seeing more — add each: scheme · type · symptom · suspected value)_ | | | | | |

> When the owner reports a glitch, capture it here FIRST (scheme + window type + what's
> visibly wrong), then run the loop. The catalog is the worklist.

## Remaining work (priority order)

### 1. Unify the split window-recipe spec  ← the big one
Geometry currently lives in **three** places that must agree by hand:
- `src/cornerSpriteGeometry.ts` — runtime composer's algorithm constants (clean now).
- `tools/theme-loader/buildThemeJson.js` `CORNER_SPRITE_WINDOWS` — per-type title-bar
  height, widget set, sprite ids (flows to `theme.json`).
- `scripts/generate-platinum/window-types.mjs` — the Platinum replica generator's version.

**Do:** consolidate into ONE window-recipe spec that both the runtime and the generator
import. Multi-file (touches generator + theme-builder + runtime together). **Verify
across ALL schemes**, not just the 2 usual spot-checks. Behavior-preserving where the
values already agree; where they don't, prefer the decode-grounded value and note the delta.

### 2. Visible fidelity fixes (from the 4-scheme visual baseline)
- **platinum-8 pinstripe is washed out / low-contrast** vs apple-platinum-2 + system7 —
  its title bar reads flatter than it should. Investigate the pinstripe source (shipped
  `cicn` vs the tile/stretch detection in `composeCornerSprite` `isHorizontalLineStripe`).
- **Confirm the apple-platinum-2 / platinum-8 widget tan tint** is authentic (its shipped
  ics4 glyph color) vs a tint artifact.

### 3. Extend decode-grounded values (limited surface — be honest)
The title-bar bevel STRUCTURE is already decode-consistent (raised, 1px inset, top/left
light, bottom/right dark — matches WDEF 125). The remaining `tuning:` values (lighten/
darken amounts, pinstripe inset fractions) are **inherently not in the decode** (colors
are runtime `wctb`). So "more decode-grounding" has diminishing returns here — don't
chase values the binary doesn't contain; pin only what's genuinely decoded.

### 4. Title text on the plate (clarity, not a bug)
Diag renders (`scripts/render-window.mjs`) are CHROME-ONLY — the title plate is left
clear because the title string is app-drawn at composite time. In the live app the
"Hello!" text lands on the plate. Not a defect; noted so it isn't mistaken for one.

### 5. (Deferred) Phase-B procedural control generator
A data-driven control DRAWER exists (`scripts/generate-platinum/{control-metrics,
draw-control,build-controls,raster}.mjs`) but is NOT wired (reverted — real art is more
faithful). Keep as the documented fallback model. Only revisit if a faithful path is
wanted for cicn-less schemes beyond the existing baseline.

---

## Future directions

### KEY INSIGHT — why the Platinum-family CONTROLS look off (the unifying cause)
apple-platinum-2 and the System-7 corner-sprite schemes are **lightly skinned**: they
defer standard controls to **Mac OS 8's native Appearance Manager drawing**, shipping only
a *partial* art set. Evidence: apple-platinum-2 ships **no `cicn` radio control face**
(-9488/-9491) — only small ics glyphs. In Kaleidoscope, a scheme with no control `cicn`
**falls through to the OS** to draw that control. So the period-correct radio/checkbox/
buttons were **OS-drawn**, not the scheme's art — and the odd ics8 glyphs we render
(e.g. the black-slash disabled radio `-10224`) are *fallback/partial* art Kaleidoscope
likely never showed. This is NOT a decode bug (the decode is verified correct); it's that
we substitute the scheme's partial art where the period used native OS drawing we don't
reproduce. Two fixes, below.

### Near-term / practical (do next, bounded)
- **Mine `kdef231` (decompiled Kaleidoscope) for the control DEFER LOGIC** — which
  controls/states a scheme draws from its own `cicn`/ics vs hands to the OS default. That
  tells us when a scheme glyph is REAL vs a fallback we shouldn't trust; for fallbacks,
  draw our procedural Platinum baseline (closer to OS-native) instead of the odd glyph.
  (Decompile via the `.scratch/iso-recon` toolchain; house style in `docs/spec/kdef231-reference.md`.)
- **Fix the title-bar-top crop** (catalog row above) — a layout-layer fix in renderWindow /
  the demo CSS, found via a live DOM inspect. The geometry buffer is already correct.
- **Analyze the `Mac OS 8.5b6 Beta Themes`** (`~/Downloads/Mac OS 8.5b6 Beta Themes/` +
  `.sit`). Strong, bounded lead: the AppearanceLib decode established that Platinum's look
  is DATA-driven — the gradients/colors/bevel params live in the theme file / `wctb`, NOT
  in the code (which is why our `tuning:` values in `cornerSpriteGeometry.ts` are calibrated
  guesses). Those beta theme files ARE that data layer. Enumerating one (via
  `tools/theme-loader/resource-fork.js`) for `thme`/`clut`/`ppat`/gradient resources could
  turn `tuning:` guesses into SOURCED values. Research task, not a refactor.

### STRETCH goals (later — bigger bridges, not now)
- **Native Appearance Manager (`.thme`) theme support** as a first-class theme kind. The
  natural endpoint of the data/drawer architecture we validated: a `.thme` file IS the DATA,
  our compositor IS the generic DRAWER. Higher fidelity than the Kaleidoscope recreations
  (Apple's actual theme data vs a third-party's interpretation). Big bridge: parse the theme
  format, map its params → the renderer. Aligned, but a real project of its own.
- **Bit-depth picker in the diagnostic viewer.** We now extract + inventory every depth and
  render the highest per id; a later UI affordance could let the user select a lower depth
  to preview how a scheme looked on a 4-bit display. Nice-to-have, not load-bearing.

## How to work here

**Verification recipe (corner-sprite render changes):**
```bash
npm run build
node scripts/render-window.mjs <slug> <windowType> --w 260 --h 96 --title "Hello!"
#   → writes themes/<slug>/diag/<windowType>.png  (git-ignored)
# behavior-preserving check: cmp the PNG against a pre-change copy → byte-identical
npm run lint:themes        # must stay 0 errors / 0 warnings
```
Spot-check schemes: **black-platinum** (procedural-box fallback) + **platinum-8** (glyph
widgets). For the unification, render all 4 corner-sprite schemes (apple-platinum-2,
platinum-8, system7-nostalgia-silver, black-platinum) + a few window types.

**Key files:**
- `src/cornerSpriteGeometry.ts` — the geometry DATA spec (decode: vs tuning: tags).
- `src/composeCornerSprite.ts` — the runtime corner-sprite composer (reads the spec; NO
  scheme-name checks — per-scheme variation is ALL `headerColors` + sprites).
- `tools/theme-loader/buildThemeJson.js` (`CORNER_SPRITE_WINDOWS`) + `scripts/generate-platinum/window-types.mjs` — the other two geometry sources to unify.
- `docs/spec/platinum-wdef125-decode.md` — the window-geometry decode (the source of truth).
- `docs/spec/platinum-controls-decode.md` + `platinum-controls-faithfulness-ledger.md`.
- `themes/<slug>/resource-roles.json` — id→role wiring; READ it, don't guess roles
  (same id differs per scheme + per cicn/ics4 channel).

**Decode tooling** (git-ignored, `.scratch/iso-recon/`): `m68k-elf-objdump` for 68k
WDEF/CDEF; capstone in `/tmp/ppc-venv` + `pef-locate.py` / `pef-decompress.py` for the
PPC AppearanceLib. Clean-room: binaries stay in `.scratch`, docs cite `0xADDR`, never
commit Apple's listing.

**Cadence:** detailed commit bodies, no Co-Authored-By line, commit direct to the
working branch. Small, verified increments over big-bang refactors.
