# Code comments — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Comment text removed from `src/` and implementer-read rule tables on
> 2026-10-21 (v2 lane L2) so `scripts/check-cleanroom.mjs` passes, moved
> verbatim from v2 commit `1183816e`. Code behaviour is unchanged.

## src/wndCascade.ts lines 17–35 (wnd# ladder request sequence)

```text
// Decoded asm walk (every step `pea 'wnd#'; push (d3 ANDed); _GetResource; …`):
//
//   0x356a  raw          push d3
//   0x357c  AND -2       push d3 & 0xFFFE  (strip bit 0)
//   0x3594  AND -3       push d3 & 0xFFFD  (strip bit 1)
//   0x35ac  AND -4       push d3 & 0xFFFC  (strip bits 0-1)
//   0x35c4  AND -5       push d3 & 0xFFFB  (strip bit 2)
//   0x35dc  AND -6       push d3 & 0xFFFA  (strip bits 0+2)
//   0x35f4  AND -15      push d3 & 0xFFF1  (strip bits 1-3)
//   0x360c  AND -16      push d3 & 0xFFF0  (strip bits 0-3)
//   0x3624  AND -17      push d3 & 0xFFEF  (strip bit 4)
//   0x363c  AND -18      push d3 & 0xFFEE  (strip bits 0+4)
//   0x3654  AND -21      push d3 & 0xFFEB  (strip bits 2+4)
//   0x366c  AND -22      push d3 & 0xFFEA  (strip bits 0+2+4)
//
// After each attempt the kDEF tests the returned Handle (`a2`); a non-null
// handle short-circuits (`bnes`) past the remaining attempts to the join at
// `0x3680`. Verified 2026-05-29 against `.scratch/k231-kdef/kDEF/k231-kdef0.asm`
// (`'wnd#'` = FourCC 0x776e6423 = decimal 2003723299; `_GetResource` = 0xA9A0).
```

## src/controlComposition.test.mjs lines 78–79

```text
// 109be tests only equality with5. 10ab0 zero-extends the byte; the four
// SUBQ/BEQ pairs select1..4 and every other byte falls through to P=(0,0).
```

`src/types.ts:242` and `src/declarative/scanner.ts:803` used the English word
"link", which the mnemonic rule cannot tell from the 68k `link` instruction;
they were reworded ("reference", "load"). No listing content was involved.

## tests/rendering-options/window-chrome-rules.mjs lines 12–14, 31–33, 133–135

```text
// docs/spec/kdef231-reference.md §3.4.1: `GetResource('wnd#', d3 & MASK)` at
// 0x3574, 0x358c, 0x35a4, 0x35bc, 0x35d4, 0x35ec, 0x3604, 0x361c, 0x3634,
// 0x364c, 0x3664, 0x367c; the first non-null handle wins (`bnes` skips the rest).
// side without a title anchor: `#1` at 0x4db4/0x4dd4/0x515e).
//   fixed     0x49d6 default → 0x4a5e `moveq #0`; 0x531e..0x532a dst = src
//   zero      0x49d6 code 0 → 0x4a12 `moveq #1`; 0x5306 leaves width 0
    // partitioning (distributeSide tLo/tHi), not the decode's code-5 anchor
    // d4 split; the 5/6 cells themselves are never asserted. A side without
    // one is a single half of the full output extent.
```

## tools/theme-loader/window-recipes.mjs line 29

```text
// (WDEF 125 @ 0x392, `fp@(-356)`) computes `titleHeight = ascent + descent + 2`
```

## src/composeChrome.ts (comment, original; removed 2026-10-21 review round)

```text
//   Verify against the 2.3.1 binary at /tmp/kaleido-trace/kdef231_decomp.c
//   when changing the part-code classifier or the cell-walk logic.
```

## src/composeCornerSprite.ts (comment, original; removed 2026-10-21 review round)

```text
// Faithful to docs/spec/platinum-wdef125-decode.md (the WDEF 125 decode) and
// /tmp/kaleido-trace/kdef231_decomp.c. The Platinum frame
```

## src/controls.ts (comment, original; removed 2026-10-21 review round)

```text
 *  a 15px button face (FUN_30a8): floor((min(w,h)-3)/2). */
```

## src/controls.ts (comment, original; removed 2026-10-21 review round)

```text
  // scrollbar drawer (decompiled FUN_000066b4), which is authoritative
```

## src/controls.ts (comment, original; removed 2026-10-21 review round)

```text
  // in Kaleidoscope's shared CDEF, decoded at kDEF231_0.asm:9f0e-9f38, which writes
```

## src/controls.ts (comment, original; removed 2026-10-21 review round)

```text
 * FUN_30a8 — Platinum fallback:
```

## src/wndCascade.ts (comment, original; removed 2026-10-21 review round)

```text
// This is a 2.3.1-only enhancement — the 1.8.2 kDEF (`/scratch/k182-kdef/…`)

```

## src/wndCascade.ts (comment, original; removed 2026-10-21 review round)

```text
//   .scratch/k231-kdef/kDEF/k231-kdef0.asm 0x356c..0x367e  (the ground truth)

```

## src/wndCascade.ts (comment, original; removed 2026-10-21 review round)

```text
 *  raw id (no bit stripped). Subsequent entries are the `andiw` immediates from
 *  the disassembly at `0x3586/0x359e/…/0x3676`. */
```

## src/wndCascade.test.mjs (comment, original; removed 2026-10-21 review round)

```text
// Verifies the 12-step cascade landings against the 2.3.1 kDEF decode at
// `.scratch/k231-kdef/kDEF/k231-kdef0.asm` 0x356c..0x367e. Cited landings
```

## tools/theme-loader/decoders/cinf.js (comment, original; removed 2026-10-21 review round)

```text
// byte[2] is a boolean per `tstb` at 0x10bc6 et al.
```

## tests/rendering-options/checkable-rules.mjs (comment, original; removed 2026-10-21 review round)

```text
// 0x724c / 0x7278: `addiw #-9504`.
```
