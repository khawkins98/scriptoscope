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
