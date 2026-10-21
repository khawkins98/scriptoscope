# Push and bevel label color samples

This implements one color-selection requirement for the full-color push/bevel
path. It does **not** verify complete label rendering: browser glyphs, font
metrics, placement, alpha compositing, original QuickDraw text transfer modes,
device palette and producer/display transforms remain separate obligations.
List headers and tabs are outside this call-site proof.

## Primary source and dispatch

The source is the pinned Kaleidoscope 2.3.1 `kDEF`0 component, 107726 bytes,
SHA256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
See [the reproducible source chain](kdef231-reference.md) for extraction and
address conventions. No original code is executed or redistributed by this work.

Push drawing passes text/emboss RGB output pointers at `0x756a/0x756e` to
`0x10fc0` at `0x7594`; bevel does so at `0x7770–0x7778`. In `0x107fe`:

| Addresses | Established requirement |
| --- | --- |
| `0x10904–0x1091a` | Sample background at signed cinf y/x offsets6/8. |
| `0x10922–0x10934` | Sample text at offsets10/12. |
| `0x1093e–0x10954` | Emboss coordinate(0,0) means absent; set red sentinel 0x1234. |
| `0x1095a–0x1096a` | Otherwise sample emboss at offsets14/16. |
| `0x10970–0x10990` | Exact equality of all three emboss/background RGB16 words disables emboss. |
| `0x759a`, `0x75ca–0x75ea`, `0x70a6–0x70ba` | Sentinel suppresses emboss; otherwise draw it first at(+1,+1), then text at the unchanged position. |
| `0x89bc–0x8a08` | Bevel uses the same optional emboss-first order and offset. |

`0xfc5c` reads local raster x/y directly, without subtracting PixMap bounds.
The mask bit is computed separately; RGB sampling continues even for mask0.
Its full-color branch (`0xfd34–0xfde8`) obtains a palette index and calls
`0x10702`. That routine has source-specific search rules, independent of the
raster decoder's TN QD13 `ctFlags` policy:

1. If the indexed entry exists and its `ColorSpec.value` matches the index, use it.
2. Otherwise, if the final entry's value is zero, use the indexed position.
3. Otherwise search backwards for a matching value; if none matches, use entry0.

The runtime does not emulate out-of-bounds reads: invalid coordinates, empty
tables or a positional shortcut outside the actual table produce an unknown
sample. These are explicit safety policies, not historical wrapping behavior.
The original routine ignores table flags; the ordinary raster decoder remains
unchanged and continues honoring its documented flag policy.

## Loader boundary and output policy

`decodeCicn` optionally exposes a transient RGB16 sampler backed by its existing
decoded index array and serialized palette. `convertChrome` supplies it only to
`buildThemeJson`, which pairs the exact cicn occurrence with the consumed last
successful same-ID cinf. The returned theme, assets and extraction manifest
contain no sampler, palette/index buffer or closure. No default cinf0/1 is
synthesized; absent same-ID metadata remains unknown.

Unobserved loads retain their existing last-encoded image alias behavior for
duplicate generated cicn paths. Such entries receive null samples and the
explicit `ambiguous-asset-path` reason: metadata from one occurrence must not
certify pixels encoded from another. Diagnostic loads continue rejecting this
ambiguity before allocating any asset URLs. Broader image/geometry alias policy
is unchanged.

Each chrome entry carries optional immutable `colorSamples`: model identifier,
background/text/emboss RGB16 and display triples, plus an explicit emboss
decision. This shares the entry's actual cicn/cinf byte-provenance binding when
the load opted into provenance. Sampling happens before PNG transport, preserving
RGB that canvas premultiplication would erase beneath alpha0. Raw16 equality and
the red 0x1234 sentinel are decided before high-byte truncation or gamma conversion.

Display triples apply the existing high-byte plus 1.8/2.2 project LUT once.
Manifest validation checks channels and consistency with that declared policy;
consumer-supplied metadata remains a declaration, not an independently verified
source observation. The LUT is not proof of an original device's displayed RGB.

Push/bevel labels use the selected face's text sample. An explicit `fg` remains a
compatibility override and suppresses automatic emboss. Legacy/missing text
samples retain the prior contrast heuristic; unknown emboss is separately
reported and suppressed. Diagnostics identify that distinction, the actual face
key/owner depth, whether a nonempty label was painted and the full-color policy.
They do not certify historical truth.

No font/size/placement formula changes. The existing browser alpha-over painter
draws the optional shifted emboss and then foreground. Original `TextMode1`
(`srcOr`) and low-depth disabled `grayishTextOr49` are **not** established as
equivalent to this browser operation. The push callback depth comes from
`DeviceLoop` (`0xf112–0xf290`); disabled push and bevel hilite254/255 select mode49
only when depth<4, otherwise mode1. The sampler's mono switch at `0xf488` depends
on device depth/flags, not active/inactive window state. See Apple
[*Imaging With QuickDraw*](https://vintageapple.org/inside_r/pdf/Imaging_With_QuickDraw_1994.pdf),
printed p5-36 (DeviceLoop callback), SHA256
`f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`.

## Independent checks and limits

Hand-encoded cicn/cinf fixtures exercise positional/reverse/duplicate/missing
palette branches, mask0 samples, nonzero PixMap bounds, raw16 collisions hidden
by high-byte/display conversion, sentinel collisions, actual last-cinf pairing,
unsafe coordinates, metadata validation and no retained sampler. The generic
raster's pixels/flag policy are checked separately and remain unchanged.

Browser tests load those real resource forks through source and built public
APIs, then check foreground/emboss order, shifted coverage, state/base ownership
and explicit `fg`. A separately drawn browser-font mask tests composition only;
it is not an original glyph oracle. Crayon push and small bevel normal/pressed
samples are independently pinned RGB16 `0x2121` per channel, disabled `0x8888`;
current display outputs are respectively48 and152. Their emboss coordinate is
absent. Payload hashes join the actual selected entry, input and fork.

An independent raw-byte survey found231 same-ID-cinf cases among345 enumerated
push/bevel resource candidates in18 source inputs (114 lack that metadata).
Those are candidate counts, not supported or verified control counts. Although
their text/nonabsent emboss samples were opaque, background RGB can be masked;
the generic metadata seam therefore preserves all relevant raw colors. Golden
updates are reviewed regressions, never independent original text evidence.
