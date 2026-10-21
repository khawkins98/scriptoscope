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

## Lane order, state bytes, resource files and placement (2.3.1 decode)

Same kDEF SHA-256 as above; file offsets. These rows back the corpus rule
table in `tests/rendering-options/checkable-rules.mjs`. They are read from the
local disassembly and cited by address. They are not executed or shipped.

- State bytes (0x66e8–0x6770): blob byte8 is set when ControlRecord hilite is 254 or 255, so disabled and inactive are one state; byte9 is set for any other nonzero hilite; varCode&7 in {1,3} clears byte10 and byte11, and in {2,4} clears byte10 and sets byte11 (radio).
- CICN lane (0x71ec–0x728a): value is ControlRecord+18; tier starts 1, byte9 makes it 2, byte8 makes it 0; for value 2 or 3 the id -9504+12*kind+3*value+tier is fetched through 0x10472 and a NULL result sets value to 1; the id is then recomputed and fetched again at the same kind and tier. There is no retry at another tier.
- Lane order (0x728c–0x7318): a non-NULL CICN is drawn and the routine exits at 0x7310; a NULL CICN branches to the icon lane at 0x7314, which re-reads value from ControlRecord+18, so the CICN value-1 retry does not carry over.
- Value 3 (0x720a–0x7232, 0x7380–0x73a2): when value is 1 and the Gestalt('Acid') response byte +20 is nonzero, value becomes 3; the CICN lane also requires byte11 = 0 (checkbox), the icon lane does not. What sets that byte is not decoded.
- Resource files (0x10472–0x106ac, 0x7364–0x736c): when Gestalt('Copl') returns noErr (0x104a8), 0x10472 calls UseResFile with the low word of its response, otherwise the current file stays; ids outside its 18-slot cache, or any id when the cache base a4@(3436) is NULL (0x104b0), reach _GetCIcon (0xaa1e), which searches from that file down the resource chain; the icon lane calls UseResFile(0), the System file, before GetResource('ics#'). Which open file owns a found resource is not established for either lane.
- Placement (0x72a0–0x72d2, 0x732e–0x7360, 0x7060–0x70a4): the CICN lane computes h = left + 8 - trunc(width/2) and v = trunc((top + bottom - height)/2) from the control Rect and the CIcon bounds before calling 0xf68c and 0x102d0; the icon lane offsets the global a4@(430) rect by (left + 2, (top + bottom - 12) >> 1), widens it by 2 on each side, erases it (0xa8a3) and adds 4 to its bottom; the shared label routine 0x6d22 moves the pen to left + 18 when byte10 is 0. The helper destination semantics, the a4@(430) rect and the label baseline are not decoded.

### What the modern runtime does with these rows

`composeCheckable` takes `{checked, mixed, disabled}` and has no control Rect,
pressed option or Gestalt state. The corpus rule table therefore declares:
value = mixed ? 2 : checked ? 1 : 0, hilite 255 for `disabled` and 0 otherwise,
`Acid` byte +20 clear, and a resource chain holding only the archive's own
fork. Each of these is an assumption, not an original observation. After a
same-tier CICN miss the runtime retries the normal-tier CICN before the icon
lane. The CICN lane above has no such retry. No shipped archive reaches that
branch, and `mixed-checkable.spec.mjs` keeps it as recorded compatibility
policy. The runtime draws the glyph at x = 0 and the label raster at
glyph width + 5. Comparing that with the pen at left + 18 needs the
label font's side bearing, so geometry stays unknown.
