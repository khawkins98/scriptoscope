# Executed font-result follow-up

**QUARANTINED_PARTIAL.** A later, separately identified private run adds executed
pointer and data-consumption evidence to the [historical observation](README.md).
Automated AI review is not human attestation. This changes no runtime, reference
admission, ledger assessment or eligibility policy.

Within one validated kDEF `DrawText` invocation, the trace records an actual
`FMSwapFont` call returning `FMOutput` at `0x998`. The pinned SDK types its `+2`
field as `fontHandle`; executed dereferences join `0x99a → 0xdd538 → 0x138400`.
These are addresses in this run, not a universal low-memory contract or Resource
Manager ownership claim. The selection call already sees the non-null handle.
Its observed input is family 0, **size 0**, face 0, needBits byte 255, device 0 and
unit scaling. Size 0 is not substituted with the caller’s separately recorded
port size 12. Returned metrics are ascent 12, descent 3, widMax 14 and leading 1.

At the consumed RAM strike, 188 recorded reads cover 574 distinct bytes:
13 header reads, 24 metric reads and 151 bitmap reads. Executed character/register
joins cover all six metric entries. The observed bytes match the retained
candidate representation at fixed structural offsets, including the addresses
of all 211 candidate ink bytes. This establishes consumption of an **observed
subset**, not whole-current-strike identity. A fetched byte, including bitfield
overread, does not establish its final pixel contribution.

The first matching invocation after acknowledged ARM passed source-derived
runtime-image checks at prepush, trap and continuation, exact title/stack checks,
and both channel acknowledgments. The bounded trace completed with 3,876 records.
The separately captured 160×80 port matches the sealed instrumentation-off port
at all 12,800 pixels, with stable public conditions and palette/gamma payloads.
Fixture redraws can precede capture: the intercepted invocation is **not proven
to be the capture-bracketed draw**. This follow-up neither replaces nor rebinds
the historical images and index.

No direct ROM operand read was recorded. Instruction-fetch/direct-pointer and
other uninstrumented paths, prior cache construction/publication, ultimate font
provider, whole-font identity and complete transfer semantics remain unknown.
Matching RAM bytes do not prove ROM-to-cache lineage. Clean guest-shutdown
acknowledgment also remains unknown. Private glyph values, operand streams,
engine/media payloads and host paths are excluded; [the receipt index](TRACE-FOLLOWUP.json)
contains external hash-only identities. The private strike input supplies no
repeatable public-CI labeled reference, so no labeled intake is proposed here.
