# title-text-color — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/tracking/title-text-color.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`title-text-color.md`](../../tracking/title-text-color.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## Where it ACTUALLY comes from (traced from the 2.3.1 kDEF asm) (original)

````text
2. `0x6582(idx)` — look up a marker rect from the rect-list (`a4@1938`).
3. `0xfc5c` ×2 — a **GetPixel** (bit/byte offset for 1/2/4/8-bit depth → index →
   RGB via `0x10702`). Samples **two adjacent pixels** of the chrome pixmap
   (`a4@1934`): one → text colour (`fp@-28`), the neighbour → shadow (`fp@-22`).
````

## Approaches considered — A (decompiler truncation) (original)

````text
convention differs. The decompile is truncated through `0x6582`/`0xfc5c`/`0x4a64`
(`halt_baddata`), so the next move is to pin it **empirically**: instrument the
````
