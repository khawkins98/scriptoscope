# kdef-faithfulness-ledger — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/kdef-faithfulness-ledger.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`kdef-faithfulness-ledger.md`](../kdef-faithfulness-ledger.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## Introduction: listing path (original, lines 5–9)

````text
A one-to-one map of the Kaleidoscope **2.3.1** kDEF (the decompiled 68k WDEF at
`/tmp/kaleido-trace/kDEF231_0.asm`) to our clean-room reimplementation in
`src/composeChrome.ts`. We do **not** ship or execute the original code — this
ledger is how we keep our own code a faithful mimic and make every divergence
*explicit* instead of tribal.
````

## How to use it (original, lines 25–27)

````text
How to use it:
- **Adding/changing compose logic?** Find the routine here first; the asm address
  is the ground truth (verify against it when a render disagrees).
````

## Routine table: `0x4a0c` row (original, lines 39–39)

````text
| `0x4a0c` | Code-10 returns the **caller's** flag (stretches iff title-fits set) | `classifyPart` → `fixed` | ✗ (deliberate; render-correctness not demonstrated) | render (1138 utility, 1984 doc); failing `todo` in `tests/rendering-options/window-chrome-rules.test.mjs` | We classify 10 as FIXED. Under the corrected `0x5178` reading, a stretch verdict means width 0. Untitled sides pass flag `#1` (`0x4db4`/`0x4dd4`/`0x515e`), so the decode collapses those code-10 cells; the older "fixed≡stretch" rationale predates that correction. There are 20 corpus code-10 cells (6 on titled sides). Collapsing them without the rect-list widget pass (`0x632e` → `0x6062`; `0x5ffc` is only the hit-test) would drop baked widgets. That pass's placement depends on side-list widths via `0x5cb6`, so its effect on a collapse is not established. The divergence stays. |
````

## Routine table: `0x4a64` row (original, lines 40–40)

````text
| `0x4a64` | Layout precompute: walk borders, measure title width (QuickDraw text traps → `fp@(-2)`), sum fixed-cell widths, per-half stretch-capacity flags (`fp@(-18)`/`-20`) | `distributeSide` / `distributeHalf` | ✓ | recipe-walk doc; render | — |
````

## Routine table: `0x572e` row (original, lines 45–45)

````text
| `0x572e` | Main draw loop — walks segments, never touches the rect-list (`a4@1938`) | `composeEdge` draw loop | ✓ | render | — |
````

## Routine table: `0xfeae` row (original, lines 47–47)

````text
| `0xfeae` | Default blit — **always TILES** the src cell along the side. The direction byte `(pc==11\|\|pc==14)?0:1` sets the anchor: 11/14 tile from the far end, everything else from the start (reference §5.1) | `composeEdge` `drawTile` (anchor from the part code) | ✓ as a source rule (`window-chrome-rules.mjs`); no native capture | recipe-walk Q5; reference §5.1; rule check | `cinf.tileSides` does NOT gate this (corrected from an earlier draft). A 1px src band ⇒ uniform fill. Before 2026-10-21 the runtime tiled 11/14 forward. Not modelled: opaque CopyBits when `grafProcs` is set, transparent pixels, and the 1px LineTo fast path's colour. |
````

## Scroll-arrow id→state mapping: listing citation (original, lines 84–87)

````text
- **Scroll-arrow id→state mapping is the 2.3.1 CDEF's, applied universally.** The
  shared CDEF (no per-scheme control template exists) fixes RAISED/normal =
  `-10201..-10204`, PRESSED = `-10197..-10200` (`kDEF231_0.asm:9f0e-9f38`; see
  kdef231-reference §2.4 "Scroll-arrow ics4 family" and `controls.ts composeScrollbar`).
````


## Moved at the main→v2 sync of 2026-10-22 (main #377, `3d846c8e`)

> Verbatim from `docs/spec/kdef-faithfulness-ledger.md` on main at `3d846c8e`. The behavioural replacement text
> lives in [`kdef-faithfulness-ledger.md`](../kdef-faithfulness-ledger.md). Nothing here was re-decoded during the move.

| `0x4a0c` + `0x4dfe..0x4e42` | Code 10 returns the `0x49d6` flag, which is `0x4a64`'s too-short byte `fp@(-3)` (`0x5178` `fp@(24)`, read at `0x52fc`). It is set only when the side's placed extent is below its fixed-cell sum; then code 10 and the title drop to width 0, and if still short the shade widget is cleared | `negotiateSides` + `classifyPart` (`src/composeChrome.ts`) | ✓ as a source rule; no native capture | `window-chrome-rules` (below-template sample, sourced `[14,4,2]`/`[3,0,2]` traces) | Supersedes the "untitled sides pass `#1`" reading, which conflated `fp@(26)` with `fp@(24)` ([kdef231-code10-widgets.md](kdef231-code10-widgets.md)). Fixed at every size from the template up. Remaining approximations: widget presence is one runtime flag (`widgetPresent`) rather than goAway/`a4@(501)`/`0x487e`; the titled-half split after a title drop keeps the runtime's undecoded split; title-text drawing for a dropped title is unchanged. |
| `0x632e` → `0x6062` (+ `0x5cb6` remap) | **Separate** rect-list widget-draw pass (close/zoom/shade). `0x5ffc` → `0x5ddc` is the hit-test, not this pass (corrected 2026-10-21) | — | ✗ | `diag:audit` widgets; `lint:themes` (no widget in a stretch cell) | **Deliberate divergence.** We don't run a second pass; the widgets ride the FIXED title-bar cells they sit in (drawn 1:1 by the edge walk). Holds *only* while no widget lands in a growing cell — both nets guard that assumption. The full draw itself only calls `0x632e` for partial-zoom part 5 (`0x5a3c`), which we don't model. Hit/press rects DO follow the `0x5cb6` remap (`resolveTitleWidgetRects`, all four sides; a collapse box in a dropped code-10 cell stays hit-testable unless `a4@(500)` was cleared — PM decision, follows the decode). |
