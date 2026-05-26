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
| apple-platinum-2, platinum-8 | document | close/zoom widgets carry a brown/tan tint | shipped ics4 glyph color | confirm vs real scheme art | open (confirm authentic) |
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
