# compositor-spec — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/compositor-spec.md` at v2 commit `1183816e`. The behavioural replacement text lives in
> [`compositor-spec.md`](../compositor-spec.md). Nothing here was re-decoded during the move; verifier
> CONFIRMED/REFUTED marks are added by the verifying lane.

## Introduction (lines 5–8): listing file name

```text
This is the canonical artifact for (re)building `src/composeChrome.ts`. It
consolidates the Kaleidoscope **2.3.1** kDEF decode (`kdef231-recipe-walk.md`,
decoded from `kDEF231_0.asm`) PLUS the gaps we found while implementing it. The
schemes are **K2 / 2.x format** (they ship `wnd#` recipes + `cinf`); the 2.3.1
```

## Widget draw (lines 69–73): rect-list storage location

```text
**Widget draw:** the kDEF draws the named widgets in a SEPARATE pass over the
rect-list (`0x632e` → `0x6062`), NOT in the recipe walk. `0x572e`'s side loop
never touches the rect-list `a4@1938`; after it, `0x5a3c` calls `0x632e` for the
zoom part only. `0x5ffc` → `0x5ddc` is the hit-test, not a draw pass
(corrected 2026-10-21). `0x6062`'s dst rect is the template-coordinate entry
```

## Per-cell blit (lines 115–122): direction-byte expression

```text
- **Per-cell blit:** the kDEF default blit (`0xfeae`) **always TILES** the src
  cell across the dst (`kdef231-recipe-walk.md` Q5) — there is no scaled CopyBits
  for ordinary fills, and `cinf.tileSides` does NOT gate it. Only code 18
  (`0x10320`) is a single scaled blit. A 1px src band ⇒ a uniform fill.
  Tiling runs along the side. The caller's direction byte
  `(pc==11||pc==14)?0:1` sets the anchor: codes 11/14 tile from the far end
  (right/bottom), so their partial tile sits at the near end. Every other code
  tiles from the start ([reference §5.1](kdef231-reference.md)).
```

## Title plate (lines 149–152): title-width storage location

```text
The **title PLATE** (the "pill" behind the text) is the chrome side of the same
mechanism, decoded at kDEF `0x4a64`: the kDEF measures the title via `StringWidth`
($A888 → `fp@(-2)`), gates it (title-fits at `0x4f58`), then sizes the title-
anchor cell's DEST span to that **measured title-text width**, centred (`0x5034`;
```

## References (lines 210–216): listing path and "verify against the asm"

```text
## References
- `kdef231-recipe-walk.md` — the full part-code / draw decode, from the
  Kaleidoscope **2.3.1** kDEF (the engine our K2 schemes use). The source of
  truth behind this spec. (The decompiled asm itself — `/tmp/kaleido-trace/
  kDEF231_0.asm` — is the ground truth; this doc + the recipe-walk are summaries,
  so verify against the asm when they disagree with a reference render.)
- `diagnostic-tooling.md` — the in-browser slice inspector + the
```

## Further original passages restated in place (moved verbatim during the completeness pass)

### Title TEXT + plate (original, old lines 152–152)

````text
($A888), gates it (title-fits at `0x4f58`), then sizes the title-
````

## Fill classification table (code 10 row) (original)

````text
always on non-title sides (`#1`).
````

## code 10 note (original)

````text
non-title sides pass flag `#1`

````


## Moved at the main→v2 sync of 2026-10-22 (main #377, `3d846c8e`)

> Verbatim from `docs/spec/compositor-spec.md` on main at `3d846c8e`. The behavioural replacement text
> lives in [`compositor-spec.md`](../compositor-spec.md). Nothing here was re-decoded during the move.

| 10 | **FIXED, dropped when too short.** `0x4a0c` returns the `0x49d6` flag, which `0x5178` reads from `fp@(24)` (`0x52fc`): `0x4a64`'s too-short byte `fp@(-3)`, set only at `0x4e0e` when the side's placed extent is below its fixed-cell sum. Then the cell gets width 0. Implemented (`negotiateSides`); see note. |

**code 10 note (2026-10-21, [window-widgets.evidence.md](window-widgets.evidence.md); spec [window-widgets.md](window-widgets.md)):**
`0x5178` takes two flag bytes. `fp@(24)` goes to `0x49d6` (`0x52fc`) and is
always `0x4a64`'s too-short byte `fp@(-3)`. `fp@(26)` (the `#1` at
`0x4db4`/`0x4dd4`, the title string length byte at `0x5100`/`0x5120`, or `0`
at `0x5148`) only gates 5/6 (`0x530c`). The earlier "untitled sides pass `#1`"
reading conflated the two. Per side, in the kDEF's side order (top, bottom,
left, right): if the placed extent (template extent + content delta) is below
`fixed0` (Σ segments 1..N that are fixed under flag 0, code 10 included), the
side drops its code-10 cells and its title (5/6 width 0). If it is still too
short and a shade gap is present, it also clears the shade/collapse widget for
the remaining layout (`0x4e24..0x4e42`). Popup-family titled sides skip this
(`0x4c64`). At or above the template size nothing changes. A dropped cell draws
nothing, as in the kDEF (`0x5990`), so its baked collapse-box art disappears,
but the widget's hit rect follows the cell through `0x5cb6` (below).

chrome template itself, not a widget cicn. In the full draw (`0x572e`) the
only `0x632e` call is the partial-zoom part 5 (`a4@(502) && a4@(508)`), so
types 1-3 (close/zoom/collapse) are drawn only by the side cells there. Under
`a4@(509)` (family 63) `0x5b7a..0x5c92` also blits rect-list types 5/6 and a
15px corner from the template at raw rects, without `0x5cb6`. We don't
…
