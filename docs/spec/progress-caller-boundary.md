# Progress: proven painter, unknown caller endpoints

The inspected Kaleidoscope 2.3.1 path intercepts an existing `PaintRect` call.
It does not yet establish how an original progress control converts its minimum,
maximum and value into filled/unfilled rectangles. Resource names and familiar
bar geometry cannot supply that missing connection.

## Source binding and immediate call chain

Component: **PACH 130**, 87,914 bytes, SHA-256
`bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`.
The bounded source review matched 374 disassembly rows to the pinned bytes.
Its private receipt SHA-256 is
`e75f05c18d14734c26820dc45c16e99ae700317e945c4e0762066cc57cb4275f`.
No engine payload or raw disassembly is included here.

| Offsets | Established connection |
| --- | --- |
| `0x2492/0x2498` | Select wrapper `0x9902`. |
| `0x2904–0x2914`, through `0x2428` | Install the wrapper for `PaintRect` (`A8A2`). |
| `0x990c/0x9910` | Forward the supplied rectangle to `0x81b4`. |
| `0x8d8e → 0x9496`, `0x922a → 0x95d8` | Invoke the two relevant painter helpers. |

The helper routes consume a rectangle and port-derived Boolean under
height/color/port guards. Recognition includes 9/10-pixel heights, an 11-pixel
case with a Wrap condition, and gray versus blue-tinted foreground tuples.
These conditions limit admission; they do not identify the originating control.

The helpers select frame cinf `−10080/−10077`, with an inactive-missing retry
to active at `0x94b2–0x94c4` / `0x95f4–0x9606`. They derive a bottom 10-pixel
rectangle, call `0x6e4c`, and use ID + 1 / ID + 2 through `0x6c6a`.
These are conditional painter facts about already supplied rectangles, not a
proof that either rectangle equals the complete public progress face. No
normalized value/minimum/maximum calculation is established in this path.

## Current implementation and remaining evidence

[`composeProgress`](../../src/controls.ts) currently accepts a normalized value,
clamps it to `[0,1]`, defaults it to `0.5`, and derives fill widths from the chosen
public length and resource model. That is the current modern compatibility
policy. The older 1.8.2 material marked `[DOC]` in the standing kDEF reference
is not a 2.3.1 endpoint proof; that pinned document remains unchanged.

The missing observation is the **upstream caller that forms the segmented
rectangles and foreground colors**: how it computes endpoints from value/min/max,
which calls it omits at zero/full, and their order. That connection is needed
before comparing source-defined endpoint behavior with the normalized API.
Slimes endpoints remain unknown; neither its resource IDs nor a matching-looking
bar establish the original caller or dispatch. Provider/cache/device conditions
also remain unresolved.

This finding justifies documenting the boundary, not a runtime correction,
new verified status, or original-reference admission. A future focused source
join should identify that upstream producer before adding endpoint expectations.
