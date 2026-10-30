# Lessons ledger: Halcyon, round 1 (Castle), round 2 (Brickworks, Bonn), classic run

This ledger lists every lesson or proposed fix from the dogfooding rounds and
what became of it. It was written in a red-team pass on 2026-10-30, after
commit `f39e6efa`.

Sources:
- the three friction logs in this directory (ids `C*` Castle, `B*` Brickworks,
  `N*` Bonn, using the logs' own numbering);
- `LEARNINGS.md` (2026-10-30 entries) and the PR #540 body (`H*`);
- commit bodies `71879030`…`f39e6efa`, including their "not fixed here" and
  "not added as checks" lists (`K*` for the real-Kaleidoscope run);
- the per-scheme `classic/README.md` files.

Status values:
- **incorporated**: in the guide, toolkit or checker before this pass (where);
- **rejected**: deliberately not done, with the recorded reason;
- **dropped**: proposed, never done, no reason recorded. This pass either
  **fixed** it or left it **open**;
- **new**: found by this pass (the red team), then fixed or reported.

Guide shorthand: *guide* = `docs/authoring-a-scheme.md`, *catalogue* =
`docs/authoring-exotic-frames.md`, *AI* = `docs/authoring-art-with-ai.md`.

## Counts

| Status | Items |
|---|---|
| incorporated | 58 |
| rejected (reason recorded) | 10 |
| dropped → fixed in this pass | 13 |
| dropped → still open | 10 |
| new → fixed in this pass | 10 |
| new → reported (art or PR text: not mine to change) | 4 |
| new → open | 1 |

Six of the 58 "incorporated" items turned out wrong or ineffective, and this
pass corrected them: C3a (R24 framing), B3a (the dithering wording), B7a
(`outlineEdges` unused), N3a (`lint` unused and blind to 1px cells), K1 (stale
click-through text) and K3 (a narrow-window "divergence" that wasn't one).
They are marked "incorporated, **fixed**". Runtime issues are listed at the
end.

## Halcyon, red team and family modules (H)

| Id | Lesson / proposal | Status | Where / reason |
|---|---|---|---|
| H1 | A recipe paints only `[first, last)`; start edges at 0 | incorporated | guide §4.1 rule box; check-scheme.js:90-107 |
| H2 | Title colour is a hidden swatch at `(A.left, A.top)` | incorporated | guide §4.3; catalogue R27; check summary |
| H3 | Default ring is drawn after the face; inside must be transparent | incorporated | guide §5 item 3 |
| H4 | Push face without same-id `cinf` silently becomes Platinum | incorporated | check-scheme.js:153-158 |
| H5 | Gamma pre-compensation | incorporated | guide §4.4; color.js |
| H6 | Calibrate checks against the corpus | incorporated | guide §7; check-scheme.js header |
| H7 | `kdef231-reference.md` §1.4 says titles are black | rejected | hash-pinned by `tests/control-availability`; correction lives in `docs/tracking/title-text-color.md`; re-pin is the maintainer's call |
| H8 | Classic needs type `Colr` / creator `Acid` | incorporated | guide §2; macbinary.js |
| H9 | Native dialog/alert bodies are `#E7E7E7`, web paints white | rejected (runtime) | "not acted on here"; catalogue R22, guide §8a. Needs a maintainer issue |
| H10 | Imported art must have alpha snapped (1–127 = swatch) | incorporated | AI; `Raster.fromRgba` |
| H11 | Scroll thumbs opaque; track middles vary only across | incorporated | guide §5 item 6. The checker rule was rejected: fired on 12/18 corpus (check-scheme.js:181) |
| H12 | Tab-pane `textPixel` ≠ `bgPixel` | incorporated | guide §5; check-scheme.js:184-193 |
| H13 | Window scroll bars never get inactive/pressed states | rejected (runtime) | LEARNINGS "not fixed here"; Bonn N10 saw it again. Needs an issue |
| H14 | `composeDisclosure` id fallback picks wrong ids | rejected (runtime) | LEARNINGS "not fixed here". Needs an issue |
| H15 | No `-14330` → widgets dead on the web | incorporated | check-scheme.js:145-151; catalogue R24 |
| H16 | Red team: fractional pixels, oversized radii, inside-out layouts | incorporated | raster.js, window-layout.js, tests |
| H17 | 8 bpp: use exact system-palette colours for the desktop | incorporated | guide §5 item 6 |
| H18 | Progress frame corner ≤ side | incorporated | check-scheme.js:195-201 |
| H19 | Menu/tab/header/progress images need same-id `cinf` | incorporated | check-scheme.js:173-179 |
| H20 | Not done: text fields, Finder icons, cursors, sounds, About, accents | incorporated | guide §8 (as documented gaps) |
| H21 | Popup, side-floating, no-title utility not covered | incorporated | guide §8; catalogue R25/R26 |

## Round 1: Castle (C)

| Id | Lesson / proposal | Status | Where / reason |
|---|---|---|---|
| C1 | (+) the two-doc on-ramp, corpus lines, web/classic flags | incorporated | kept |
| C2 | R24 sentence "checkScheme doesn't warn about -14330" is stale | incorporated | catalogue R24 |
| C3a | R24: offsets come from the pressing window's own rects | incorporated, **fixed** | catalogue R24. It was framed as "a web gap", but `stripSource` (WD9/HT7) is the decode, so classic does the same with `-14298`. Rewritten to say so, with how to lay out `-14298` |
| C3b | Checker rule: different roles on the same strip column | rejected | fired on 12/18 corpus (commit 1b9a12af; check-scheme.js:141-143) |
| C4 | `midY` from the ≤2px marker is unused | incorporated | catalogue R28 |
| C5a | Promote `frameLayout` + `stripLayout` to the toolkit | incorporated | frame-layout.js |
| C5b | Reimplement `windowLayout` as a preset over `frameLayout` | rejected | "windowLayout() stays as the simple path" (commit 1b9a12af) |
| C6a | Warn on a title rect under ~17px | rejected (as a check) | 12/18 corpus (commit 1b9a12af); enforced in `frameLayout` instead |
| C6b | `frameLayout` enforces 17px | incorporated | frame-layout.js validate |
| C7a | Guide line: outlined 1px filler tiles into a solid bar | incorporated | catalogue R8 |
| C7b | Checker heuristic for an outline-coloured filler column | dropped → **fixed** (partly) | `uniform` groups in `layout.lint` catch a filler that stops matching its group; catalogue R8 now points at it. A pure heuristic check stays undone |
| C8 | Smooth shapes should accept fractional boxes | incorporated | raster.js:188-191 |
| C9 | Export `bayer`; horizontal dithered ramp | incorporated | raster.js `ditheredGradient({ axis })`, index.js |
| C10 | Dithering rule for multi-px tiles and the plate | incorporated | guide §4.5 |
| C11 | "Which code for which effect" table | incorporated | catalogue after R8 |
| C12 | Preview: `?layout=`, `?active=`, an active scroller | incorporated | demo/authoring-preview.html; preview-layouts/sizes.html |
| C13 | `pressedStripFrom` helper | incorporated | frame-layout.js |
| C14 | Per-scheme title size | rejected | needs a runtime change; the builder said no doc fix was needed |
| C15 | (+) things that worked | incorporated | kept |
| C16a | Utility close-only because of C3 | incorporated | catalogue R24; Castle |
| C16b | Ship `-14298` (cheap copy) for classic utilities | dropped → **open** | Castle (and Bonn) never shipped it. `npm run author` now prints it under "classic extras". Adding it is a scheme change for the maintainer |
| C16c | Flagstone and parchment bodies are web-only | incorporated | catalogue R22 |

## Round 2: Brickworks (B)

| Id | Lesson / proposal | Status | Where / reason |
|---|---|---|---|
| BW1–BW4 | (+) reading order, table, strip builders, dithering rules | incorporated | kept |
| B1 | `frameLayout` API sketch in catalogue §8 | incorporated, refined | catalogue §8. The sketch now runs as written, and shows `uniform`, `minWidthForTitle`, `lint`, `stripLayout` |
| B2 | R28: utility band ≥ 17px + ornament; Halcyon's 16px needs `windowLayout` | dropped → **fixed** | catalogue R28 |
| B3a | Colour-budget rule in guide §4.5 | incorporated, **fixed** | guide §4.5. It said dithering "adds colours fast", which contradicts `ditheredGradient`'s doc and B-W4. Rewritten |
| B3b | Encoder error gives the count | incorporated | encode-cicn.js:99 |
| B4 | `?active=` bug in the preview | incorporated | preview moves the match first. The runtime cause stays open (see R2 below) |
| B5a | Say how to see progress bars (no declarative element) | dropped → **fixed** | guide §8 |
| B5b | `?family=progress` strip in the preview | dropped → **open** | preview feature; recommended |
| B6a | Slider's white box on patterned bodies | incorporated | catalogue R23 |
| B6b | "Possibly a runtime gap" | dropped → **fixed** (reported) | it is: `slider.md` BG6 makes white the default when the host supplies no background; the web host could pass the body's. See R3 |
| BW2a | For a wide tile, 13 at both ends of each 12 run | dropped → **fixed** | catalogue "which code" table |
| BW2b | Narrow windows can show no ornament in a half | dropped → **fixed** | same table row |
| BW3 | Say what `-14298` holds for a close-only utility | dropped → **fixed** | catalogue R24 |
| BW4 | Dithering is the fix for the colour budget | dropped → **fixed** | guide §4.5 (see B3a) |
| B7a | Shared silhouette outliner | incorporated, **fixed** | guide §3 named `outlineEdges`, but Castle and Brickworks kept private copies; both now call `outlineEdges` (byte-identical output) |
| B7b | `checkFillerColumns(layout, raster)` | dropped → **fixed** (partly) | see C7b |
| B8 | Toolkit family builders (`scrollbarSet`, `sliderSet`, `progressSet`) | dropped → **open** | no reason recorded. The evidence is strong (§ "New lessons" below), but it is a big refactor. The guide now has a "copy this file" table instead |
| B9 | `npm run author -- <dir> --sheet` contact sheet | dropped → **open** | no reason recorded; three builders wrote scratch scripts for it |
| B10a | `?all-active=1` | dropped → **open** | preview feature |
| B10b | Header: click a body to activate, double-click a title to collapse | dropped → **open** | collapse is in an HTML comment lower down; activation isn't |
| B11a | R30: the resize overlay is live with no grow box | dropped → **fixed** | catalogue R30 |
| B11b | R28: visible plate ≥ title size + 4 rows | dropped → **fixed** | catalogue R28 |

## Round 2: Bonn (N)

| Id | Lesson / proposal | Status | Where / reason |
|---|---|---|---|
| NW1 | (+) one-line-per-edge recipe comment; named cells | incorporated | kept; guide §4.1 now points at all three examples' headers |
| N1a | Code 10 rather than 1 for a draw-once ornament | incorporated, refined | catalogue R6. Now gives the drop width (`F`, TS1) with Bonn's numbers, checked against `layoutWindow` |
| N1b | R6 cited R12 wrongly | incorporated | catalogue R6 |
| N1c | Title-room rule; report it from `frameLayout` | incorporated | catalogue R6; `fixedTop`, `minWidthForTitle`. Verified exact against the runtime plate width for all three schemes. Codes 15/16/17 are now excluded (the web always zeroes them) |
| N2 | `fitPalette` in the toolkit; guide line | incorporated | fit-palette.js; guide §3, §4.5 |
| N3a | Tile-uniformity check | incorporated, **fixed** | `uniform` + `layout.lint` were promoted but ineffective: no scheme called `lint`, it skipped 1px cells (Bonn's tree bug), and it checked the top edge only. Now: groups for 1px cells, every edge, R18. Bonn uses it (its private `checkTiles` is gone) and so does Brickworks; a test reproduces both of Bonn's bugs |
| N3b | …as a `check-scheme.js` warning | rejected | multi-px textured tiles are legitimate (the Bonn log itself), so it was made opt-in |
| N4 | R9: the code-0 skip needn't match the tile period | dropped → **fixed** | catalogue R9 |
| N5a | `?active=all` | dropped → **open** | preview feature |
| N5b | Match `?active=` by window type | incorporated | preview |
| N5c | `?press=`, `?collapsed=` | dropped → **open** | preview feature |
| N5d | Document the widget button selectors | incorporated | preview header |
| N5e | `?desktop=1` (tile `ppat 17`) | dropped → **open** | preview feature |
| N6a | (+) `frameLayout`/strip worked first time | incorporated | kept |
| N6b | `frameLayout` header should list codes 0 and 10 | dropped → **fixed** | frame-layout.js header |
| N7 | Name `SYSTEM_PALETTE_256` in §5 | incorporated | guide §5 item 6 |
| N8 | Two "which code" rows (skyline, code-0 bottom) | incorporated | catalogue table |
| N9 | Refactor Halcyon `parts/controls.mjs` colours into a `family()` block | dropped → **open** | the guide documents the cost instead, and now points at the already-recoloured copies (`bonn/families.mjs`, `brickworks/extras.mjs`) |
| N10a | Encoder error wording | incorporated | encode-cicn.js:99-100 |
| N10b | Inactive scroll bars use normal art | incorporated (as H13) | runtime finding |

## Real Kaleidoscope run of all three (K)

| Id | Finding | Status | Where / reason |
|---|---|---|---|
| K1 | Clicks pass through transparent frame pixels in classic | incorporated, **fixed** | catalogue R16. R16's lead-in ("we can't say") and R30's "click-through unknown" row were stale; both updated |
| K2 | The menu bar covers art above the title bar | incorporated | catalogue R16 |
| K3 | "Narrow windows behave differently from the web" | incorporated, **fixed** (wrong) | the classic window was ~105px, below Bonn's TS1 width (128px); the web preview's was 160px. At equal widths `layoutWindow` drops the same cells. R16 corrected |
| K4 | 8 bpp shifts subtle colours | incorporated | catalogue R16 |
| K5 | Print the "classic extras" | incorporated, extended | check-scheme.js; now also `-14298` for schemes with utility widgets; guide §7 explains the line |
| K6 | Click-through is a web/classic divergence | rejected (runtime) | recorded only; a maintainer decision (R1 below) |

## New lessons from this pass

| Id | Finding (evidence) | Status |
|---|---|---|
| X1 | **Castle ships the stray-art bug Bonn's lint was made for.** In `paintBanner` the left iron ring's highlight lands at `ring + 1 = capL.x0 + 10 = plate.x0`, so the code-5 plate tiles it every 12px along the coping above the banner. `castle/preview.png` row 80: pixels at x = 312, 336, 360 … 576. Castle predates `lint`, and nobody ran it after | reported (art) |
| X2 | **Castle's plate also carries gatehouse stone texture** (rows 5–17 vary by column), against the "plate one colour per row" rule: a cut block shows by the right cap. So Castle can't adopt `layout.lint` without an art change | reported (art) |
| X3 | **Halcyon never got the round-1 R24 fix.** Its utility windows have close + collapse and no zoom (`halcyon/scheme.mjs:121`), so pressed collapse reads the `+` zoom piece of `-14330` on the web, and of its three-piece `-14298` in classic (by the decode) | reported (scheme). Fix: close-only utility, or `-14298` from `stripLayout(utility)` (web stays wrong unless the art is interchangeable) |
| X4 | `layout.lint` promoted but unused and blind to 1px cells (see N3a) | fixed |
| X5 | Private copies of `outlineEdges` in two schemes (see B7a) | fixed |
| X6 | **Copy-and-reskin is how every scheme got its control families.** The same 10 scroll-bar functions (`barRaster`, `trackImage`, `thumbImage`, `paintTrack`, `paintArrow`, `littleArrows`, `inactiveImage`, `SB` …) are in all four schemes; `pushFace`/`pushCinf`/`ringFace`/`ringCinf`/`checkable`/`finderCinf` in all four; 12 progress/slider/tab helpers in three | fixed (guide §5 "starter files" table); toolkit builders open (B8) |
| X7 | Four schemes repeat the same frame epilogue (punch the content hole, title + shadow swatches) | open: candidate `layout.finish(raster, { title, shadow })` |
| X8 | Stale code citations: `src/interactive.ts:1549`, `:1837`, `:1167` had drifted | fixed (catalogue R15, R24, R26) |
| X9 | Guide §4.1 part-code table had no 13/14, called code 0 "rarely needed" (R9 calls it the main tool), and said code 10 drops below template width (it's below the fixed sum) | fixed |
| X10 | Stale text: guide §8a still said Halcyon has a blank picker icon; the AI guide said only Halcyon had run in the emulator and whole frames were untried; §2 said only Halcyon's tests check sync | fixed |
| X11 | Catalogue §8 still ended with the pre-`frameLayout` "simplest extension" proposal, and its "enforces" list was incomplete | fixed |
| X12 | `fixedTop` counted codes 15/16/17, which the web always zeroes | fixed (with a test) |
| X13 | LEARNINGS had no entry for rounds 1–2 or the classic run | fixed |
| X14 | Guide §6 `-14330` row said "same widget sizes" only, not "same set or close only" | fixed |
| X15 | PR body says Halcyon has 329 resources; the build writes 331 (`-14330` and `-14298` came later) | reported (PR text) |

## Needs the maintainer

Runtime issues to file (not changed here; `src/` untouched):
- **R1.** Click-through divergence (K6). Classic leaves transparent frame
  pixels out of the window; the web's drag handle is the full frame rectangle
  (`src/interactive.ts:1561-1569`).
- **R2.** `WindowManager.add` activates only the first window added
  (`src/interactive.ts:920`). A later window's `data-scriptoscope-state="active"`
  is ignored. The preview works around it (B4).
- **R3.** The slider erases its rect to white on patterned bodies. `slider.md`
  makes white the BG6 default when the host supplies no background, and the
  declarative host could pass the body's pattern or colour (B6).
- **R4–R6.** H9 (dialog grey), H13 (scroll-bar states) and H14 (disclosure
  ids) are still unfiled.

Scheme decisions (art, so not changed here):
- X1 (Castle's ring pixel, a one-pixel fix);
- X2 (Castle's plate texture);
- X3 (Halcyon's utility collapse);
- C16b (`-14298` for Castle and Bonn).

Still open, recommended:
- B9 `--sheet`;
- the preview options (B5b, B10, N5a/c/e);
- toolkit family builders (B8/X6);
- X7.
