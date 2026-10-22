# cinf-resize-behavior — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/cinf-resize-behavior.md` at v2 commit `1183816e`. The behavioural replacement text lives in
> [`cinf-resize-behavior.md`](../cinf-resize-behavior.md). Nothing here was re-decoded during the move; verifier
> CONFIRMED/REFUTED marks are added by the verifying lane.

## Body table, mode != 5 row (line 49): pattern-cache flag location

```text
| Body enabled, `mode != 5` | `0x109c4 → 0x10a6c` | Pass the **same** `backgroundId` to cached `0xeeea` or uncached `0x10440`, selected by `a4+1220`. Both use GetPixPat (`0xef24`, `0x10460`). This is a **ppat** request. |
```

## Pixel-pattern phase helper (lines 76–80): fill-path flag location

```text
`0x10b14..0x10b22` passes phase and first rectangle to `0xf930`; the transposed
rectangle follows at `0x10b48..0x10b56`. That helper adjusts port origin and
rectangle coordinates before `0xf7cc`, then restores them. `0xf7cc` has a
FillCRect path at `0xf85e` and a separate FillRect path at `0xf848` selected by
`a4+1222`. The phase arguments are established; translating all port-origin,
```
