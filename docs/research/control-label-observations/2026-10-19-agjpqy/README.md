# System7 “AgjpQy” — conditioned label observation

**QUARANTINED_PARTIAL.** One native observation and one later public-API comparison,
prepared and reviewed by automated AI agents, not a human attestation. This note
adds no intake approval, ledger claim or runtime policy.

The native System 7.5.5/Kaleidoscope 2.3.1 fixture used `NewControl` procedure 0,
`HiliteControl(0)` and `Draw1Control`, with no default API. The active control is
80×20 at (20,20) in a 160×80 white port, title ASCII `AgjpQy`. Before and after
draw, the public port reports font 0/Chicago, size 12, face 0, mode 1;
`GetFontInfo` reports ascent 12, descent 3, widMax 14, leading 1. `TextWidth` of
the exact six title bytes in that port is 46. These queries do not identify the
font provider actually consumed by the control painter.

All eight condition payloads were stable, including the full indexed palette and
gamma table. Normal stopped HFS export retained all 19,809 telemetry bytes after
successful write-count, close, flush and read-only EOF checks. The full 640×480 PNG
matches all 1,228,800 raw producer bytes; the repeated plane is unchanged. The
[port](native-port.png) and [context](native-context.png) are exact coordinate crops
of the [full frame](native-frame.png). Clean guest-shutdown acknowledgment remains
unknown. The fixed sample at (60,30) may intersect the label.

The later [public comparison](comparison.json) used the actual published module,
public loader and `prepareBitmapFont` → `composeButton`, with the private candidate
strike and existing measured 194-tuple profile. Its 113 System7 conversion tuples
are covered; v17 device fields, palette and gamma match that profile’s recorded
v9 environment. No new mapping query or color interpolation was performed.
The independent kDEF placement formula gives pen (37,34), advance 46 and 211 ink
pixels in [38,25,82,37). With explicit source-over composition onto the recorded
white port, **all 12,800 RGBA pixels match exactly**. Raw buffer and displayed
plane identities are retained separately; opaque equality is not mask proof.

This extends the [earlier O/K observation](../2026-10-19/README.md) to six candidate
glyphs, including descenders, without fitting offsets. Active original provider,
whole-font identity, private resource/cache order and complete transfer semantics
remain unknown. The actual modern face is occurrence 50 (`cicn` −10239), with no paired `cinf`.
The modern System7 face uses the explicitly recorded legacy
compatibility painter; equality does not identify the original internal painter.
Original glyph masks, FONT/ROM/OS/native code and private host paths are excluded.
[The index](index.json) distinguishes included files from external hash-only pins;
external names are labels, not broken repository-relative links.
