# Checkable icon selection

This corrects the modern self-owned icon fallback after CICN selection. It does
not establish an original Resource Manager provider, device depth, mask decoder,
text, or whole-control placement claim. There is no new pressed public option.

## Pinned source

kDEF SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`:
A4 setup at `0x104/0x108` yields base + `0x18a0a`; `0x710e–0x712c` copies
48 bytes from A4 + `0x17e`, resource offsets `[0x18b88,0x18bb8)`.
The table SHA-256 is
`a04ff620dd05d109fbe0fc76247940f15657e9c603381bc30ed92c1264399095`.
These signed values are metadata, not shipped engine bytes.

| Kind | Tier | Value 0 | Value 1 | Value 2 | Value 3 |
| --- | --- | ---: | ---: | ---: | ---: |
| Checkbox | Normal | -10236 | -10235 | -10234 | -10233 |
| Checkbox | Pressed | -10232 | -10231 | -10230 | -10229 |
| Checkbox | Disabled | -10240 | -10239 | -10238 | -10237 |
| Radio | Normal | -10220 | -10219 | -10218 | -10219 |
| Radio | Pressed | -10216 | -10215 | -10214 | -10215 |
| Radio | Disabled | -10224 | -10223 | -10222 | -10223 |

`0x731c–0x732c` starts tier 0, selects tier 1 for blob byte 9, then tier 2
for blob byte 8. `0x73b6–0x73ce` and `0x73da–0x73f2` index
`kind*24 + tier*8 + value*2`. For value 2/3, `0x73ae–0x73d8` probes the
selected `ics#` with GetResource; NULL changes only the value to 1. The final
draw helper also requires the selected mask (`0xf50c–0xf51e`). A missing color
resource is not that NULL result. The source's subsequent color-depth and mask
owner lookup remain outside this modern compatibility implementation.

## Public behavior and evidence boundary

The public Boolean mapping remains mixed → value 2 before checked → value 1,
and disabled → tier 2, otherwise tier 0. That mapping is modern policy. The
normal icon row previously used the source's pressed IDs; it now uses tier 0.
CICN priority, its existing fallback, and all other glyph consumers are unchanged.

The loader exposes optional `inspector.iconMaskResources`: every raw same-fork
`ics#` occurrence, with signed ID, resource index and byte length. A present
empty array establishes no masks in this modern input fork. An absent field is
unknown. This census also includes masks without decoded color art. Color
`iconIndex` entries carry their actual raw `resourceIndex`; checkables require
the exact glyph URL, signed ID, 16px size, matching type/depth and decoded mask.
The highest available color depth remains the existing loader policy.

Only an absent mixed mask triggers same-tier checked retry. Present masks shorter
than 64 bytes or duplicate IDs are unsupported and return null, without treating
them as native NULL. A selected mask without supported color art also returns
null; mono fallback is not added here. A present incomplete or contradictory
inspector cannot bypass these checks. Hand-built themes with no inspector retain
the explicitly unobserved color-art/active-row compatibility fallback.

`checkable-icons.spec.mjs` uses owned forks, independently literal signed IDs and
black/white planes through the public source/built loader. It joins observed
decode URLs to the exact color entry and raw occurrence, separately checks mask
occurrences, and compares every output pixel. It asserts no band-paint event or
historical provider. Two icon-only expectations in the older mixed-CICN fixture
now exercise same-tier checked fallback; all its CICN cases remain unchanged.
No regression golden or synthetic output becomes an original reference.
