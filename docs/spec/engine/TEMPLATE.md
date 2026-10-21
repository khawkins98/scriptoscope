# `<unit-id>` — behavioural spec template

*Copy this file to `docs/spec/engine/<unit>.md` and its evidence appendix to
`docs/spec/engine/<unit>.evidence.md`. Skeleton from [v2 PLAN §5](../../v2/PLAN.md).*

**Writing rules (spec writers).** A spec is behavioural prose, decision tables
and formulas, each carrying an address citation. It contains **no** assembly,
no register or stack narrative, no struct offsets and no pseudo-code. Name
things by what they mean ("the requested window id", "the direction byte"),
never by where the binary keeps them. Addresses appear only as citations:
`` `0x10074` ``, `` `0xa032..0xa10e` ``. Trap names are Apple API identities
(`$A8EC` CopyBits) and are allowed. Everything else you read in a listing goes
in the evidence appendix. `node scripts/check-cleanroom.mjs` lints every `docs/spec/engine/*.md` except
`*.evidence.md`.

**Who reads what.** Implementers read this file, Apple Inside Macintosh /
Universal Interfaces and `tests/rendering-options/*-rules.mjs`. They never read
the evidence appendix ([implementer brief](IMPLEMENTER-BRIEF.md)). Anything an
implementer needs must therefore be stated here.

---

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `<family>.<message>` (e.g. `scrollbar.draw`) |
| family | `<family>` |
| message | `<message>`, and the Toolbox message number it answers |
| binary | e.g. Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276…c342` ([inventory](../kdef-binary-inventory.md)) |
| cited range | `0x…..0x…` (a citation, not a narrative) |
| out of scope | what this unit deliberately does not cover, and which unit does |

## 2. Inputs

Named engine inputs with their meaning. No struct offsets.

| input | meaning | values / domain |
|---|---|---|
| e.g. `orientation` | which way the control runs | `horizontal` \| `vertical` |
| e.g. `part` | the pressed part | `none`, `up` (20), … |
| e.g. `available resources` | which resource ids the archive and base chain hold | set of `(type, id)` |

## 3. Outputs

- **Resources requested, in order**, with retry semantics: what happens on
  NULL (retry at another id, skip the stage, or fall through to the next tier)
  and which requests are never retried.
- **Rects** produced (with the coordinate space they are in).
- **Draw order**: the sequence of primitive calls, each with its source citation.

## 4. Decision tables

One row per decision; every row carries its `source` citation. These rows are
what `src/engine/tables/<family>.ts` mirrors (one table row per spec row, same
`source` string).

| # | condition (inputs) | output | source |
|---|---|---|---|
| 1 | … | … | `0x…..0x…` |

## 5. Geometry

Formulas, not procedures. Example:
`thumbLen = max(minThumb, floor(track * extent))` (`0x…`).
State integer division, rounding and clamping explicitly.

## 6. Not decoded / unknown; corpus impact

- What the listing does that this spec does not establish, as a list of open
  questions. Implementers stop at these; they do not guess.
- Corpus impact: which of the 18 archives exercise which table rows (and which
  rows no archive exercises).

## 7. Test hooks

- Rule rows in `tests/rendering-options/<family>-rules.mjs` that assert each
  decision-table row (by row number).
- Mutations that must fail: for each row, the flipped/removed variant and the
  rule row or archive that catches it. A row no mutation can fail is a finding.

---

## Appendix: `<unit>.evidence.md` (never read by implementers)

Lives in a separate file next to this one. Contents:

- address-by-address trace of the cited range;
- trap list with Traps.h identities;
- register / stack narrative and listing excerpts;
- verifier marks: each cited address **CONFIRMED** or **REFUTED**, with the
  verifier's identity, date and the listing checked.
