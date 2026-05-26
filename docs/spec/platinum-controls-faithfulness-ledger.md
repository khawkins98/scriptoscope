# Platinum controls — faithfulness ledger (Phase-B contract)

*Seeded sibling to [`kdef-faithfulness-ledger.md`](./kdef-faithfulness-ledger.md).
One row per control kind × feature, mapping it to its decode/data source and a
faithfulness status. Phase-B may only build on `confirmed` / `data` /
`model-reuse` rows; `could-NOT-pin` rows must be resolved (or explicitly waived)
before they are rendered. Divergence is detected against this ledger +
`npm run lint:themes`, not by eyeballing renders.*

**Status legend:** `confirmed` (instruction-decoded) · `data` (extracted clut/cctb
value) · `model-reuse` (reuses the verified WDEF-125 bevel model) ·
`could-NOT-pin` (ambiguous — gates Phase-B).

| control kind | feature | source (CDEF `0xADDR` / AppearanceLib off / `cctb` slot / WDEF-model) | status | planned Phase-B impl |
|---|---|---|---|---|
| _(seeded in Task 5 from the T2/T3/T4 findings)_ | | | | |
