# Code 10 and the baked widgets — split (stub)

This 2026-10-21 decode note was split on 2026-10-22 (v2 lane L2):

- **Behavioural spec (implementers):** [engine/window-widgets.md](engine/window-widgets.md).
  It covers the part-code verdicts, the too-short step, the titled side, the
  layout cache, and the rect-list widget remap, draw and hit, with rule ids.
  It also records three corrections to this note.
- **Evidence (spec writers and verifiers only):**
  [engine/window-widgets.evidence.md](engine/window-widgets.evidence.md). Part A
  holds this note's full text, moved verbatim; Part B is the re-trace with marks.

Implementers do not open this stub. The excerpt below stays byte-identical
because the requirement ledger's evidence row `kdef.too-short-step`
(`tests/rendering-requirements/families/window.json`) pins it by `locator`
and `excerptSha256`. Remove this stub only after a recorded window-family
transition repoints that row's `document` to the evidence appendix, which
holds the same text in Part A §2.

## Ledger-pinned excerpt (from §2, "When code 10 collapses")

3. `0x4dfe..0x4e0c`: if `destBorder[N] − destBorder[0] < fp@(-16)`, then
   `fp@(-3) = 1`, `fp@(-16) −= fp@(-30)`, title width `fp@(-2) = 0` and the
   title string's length byte `fp@(-290) = 0` (`0x4e0e..0x4e20`). `fp@(-290)`
   is the GetWTitle Str255 (`0x4a98` `pea fp@(-290)`, `$A919`; `StringWidth`
   `$A88C` → `fp@(-2)`); its length byte is what reaches `fp@(26)` on the title
   path. It is also zeroed at `0x4f5e` when ≤2px of title room is left.
4. `0x4e24..0x4e42`: if the side is still too short and `fp@(-6) > 0`, it
   clears `a4@(500)` (the collapse/shade widget, which `0x487e` reads) and
   subtracts `fp@(-6)`.
5. In `0x5178`, code 10 with flag 1 goes `0x4a0c` → 1 → `bnes 0x532e`, with
   `d6 = 0` from `0x5260`. That gives **width 0**. With flag 0 the code is FIXED
   (`0x531e..0x532a`). Because the title length byte is now 0, codes 5/6 also
   collapse. (Code 0 returns 1 under either flag, `0x49ec` → `0x4a12`, so it is
   zero-width in both cases. Codes 2/3/4 are fixed iff goAway `+112` /
   `a4@(501)` / `0x487e`; 15/16/17 the inverse.)
