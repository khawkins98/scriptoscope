# Mode-5 color-icon bodies

The push/bevel face compositor supports a bounded full-color/color-port mode-5
body before its ordinary border. This is source-derived compatibility, not an
original capture, device-color proof or a whole-control fidelity claim. The
current eighteen-scheme corpus contains no mode-5 requests.

## Migrated push transport

Migrated push/default consumes typed signed cicn/cinf resources and the actual
prepared source occurrence. The converter's older carried `cicnBody` record
remains a decoder observation and input to still-supported unmigrated paths;
deleting or rewriting that record alone is not a typed-resource override for
migrated push. Admission checks must perturb the consumed occurrence, raw
request, bounds, or actual transport rather than an unused legacy field.
This does not relax the mandatory same-selected-face-owner body policy.

A selected deep body can use its occurrence-bound opaque icon-blit companion;
its transport need not be the older `cicn-body/` companion. DECISIONS #7's
same-occurrence validation and current-asset masked fallback remain required.
Completed diagnostics must identify the transport actually copied, without
substituting a carried legacy URL or claiming an unconsumed derived asset.
Masked and opaque planes, hidden source RGB and signed/type identity remain
separate assertions.

Public resource admission can prepare owned planes before drawing, but a
wholly clipped body must start no dependent body decode in the current public
path. A visible nonaligned admission may decode to validate actual dimensions;
rejection still publishes no completed body operation. These obligations do not
impose a singleton count on unrelated face/pattern preparation. An already-issued
decode is a browser lifetime; no new owned decode may start after signalled
cancellation/disconnect. Decoding alone never proves visible paint. Cache eviction
and disposal must cover the actual owned transport and unused generated companions
without revoking a caller's unrelated assets.

## Source contract

The pinned Kaleidoscope 2.3.1 `kDEF` 0 has 107,726 bytes and SHA256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
The nine range hashes in
[`mode5-source-bindings.json`](../../tests/decoder-fixtures/mode5-source-bindings.json)
record independently checked static bytes (208 opcode rows); original binaries
are external and never run or shipped by this runtime or its tests.

| Source range | Bounded interpretation |
| --- | --- |
| `109aa–109da` | Body-enabled mode 5 requests a color icon, not a pattern. |
| `109da–10a1e` | Source Rect comes from the icon's monochrome bitmap bounds; destination is inset by the cinf side on all four edges. |
| `10a1e–10a6c` | Missing body erases the two transposed corner/side inset rectangles. |
| `fdf8–feae` | Color-port dispatch uses masked copy at depth 1 and unmasked ordinary color copy above depth 1. |
| `f30a–f378` | Icon pointer preparation/release. |
| `f378–f3aa` | Black foreground and white background setup, with prior port colors saved/restored. |
| `10472–104b0`, `1068c–106ae` | Resource switching/cache/GetCIcon boundary; not proof of the current same-owner policy. |

At `fe5c`, the one-bit color-port branch passes the **PixMap** as source and
`iconMask` at +50 as mask. Its source Rect still comes from `iconBMap` bounds.
The alternate path at `fe7e` uses the monochrome bitmap pixels; that path is not
implemented here. Requiring the two bitplanes to agree would invent a source
condition. Instead, initial one-bit admission requires conventional indexed
white 0 / black 1, which agrees with the established foreground/background setup.

## Loader and ownership boundary

A mode-5 requesting face may carry an immutable `CicnBodyBinding` at `cicnBody`.
The builder inspects **all** matching same-owner `cicn` records, including errors
and skipped variants. Exact signed ID 0 is valid; +N and -N are distinct, and a
`ppat` with the same ID cannot satisfy the request. The explicit compatibility
policy is `unique-same-face-owner`:

- No matching raw resource: `missing`.
- Multiple matching signed IDs or a nonunique asset binding: `ambiguous`.
- Present but undecodable, unsupported layout/palette or missing source facts:
  `unsupported`.
- One supported actual occurrence: `ready`, carrying its manifest key, depth,
  zero-origin source Rect, copy mode and asset reference.

This policy does not assert original Resource Manager ordering, cache conversion
or same-provider image/metadata behavior. Legacy missing metadata is unknown;
it is not synthesized into genuine resource absence. Caller-written metadata is
a declaration, not authenticated provenance. Opted-in load evidence joins the
selected target key to the actual consumed occurrence and payload hash.

Admission requires indexed depth 1/2/4/8; aligned, positive zero-origin PixMap,
mask and monochrome bitmap bounds; valid packed rows; a complete unambiguous
indexed palette; and conventional white/black colors for depth 1. Unsupported
sources retain explicit compatibility output and do not enable missing erasure.
No resampling is inferred from a valid source.

Only a referenced ready depth-2/4/8 target produces a `cicn-body/` companion.
The converter clones the **ordinary, already display-prepared RGB**, including
colors beneath mask holes, then sets alpha to 255. There is no second LUT and
no engine palette sampler involved. Ordinary masked assets remain unchanged.
Several requesting faces share one derived asset from the same actual target
occurrence; provenance does not invent a second original resource. Stable
`derivedPath` survives asset URL rewriting. Depth 1 uses its ordinary masked
asset. No raw vectors, sampler functions or persistent global owner caches are
added; normal load failure cleanup, disposal and per-URL cache eviction apply.

## Painter boundary

The public push/bevel options are unchanged. The painter admits only a destination
whose side-inset dimensions exactly equal the source Rect: aligned 1:1 copying.
It snapshots target identity and asset URL before decoding, checks cancellation
before and after dependent decode, and verifies decoded size and alpha policy.
One-bit alpha must be binary; an unmasked companion must be fully opaque.

The clip determines destination coverage without changing the source origin.
A wholly clipped body needs no dependent decode. Visible masked pixels or all
visible unmasked pixels copy before the ordinary border. Only actual nonzero
writes emit a `bodyPaint` step, with selected owner/key/occurrence, source and
destination rectangles, copy branch, pixel count and actual asset URL. Derived
path appears only for the unmasked companion. Missing bodies alone can use the
selected face's raw background sample for the transposed inset union; that
paint is separately identified as `missing-erase`.
Paint records are staged until the face succeeds and omitted from a failed
completed invocation, including a later sampled-border or default-ring failure.
Lookup observations remain separate. If the body is genuinely absent but the
raw background sample is unavailable, legacy raster-background output remains
an explicit `missing-cicn-body-background-unverified` approximation, without a
source-backed `bodyPaint` claim.

Arbitrary scaling/rounding, nonconventional one-bit palettes, the alternate
monochrome path, pictures, cache/device conversion, historical resource providers
and PACH header mode 5 remain unverified. The independently introduced header
primitive keeps its own conservative mode-5 exclusion.

## Independent regression evidence

The hand-encoded inputs and full RGBA literals in
[`mode5.mjs`](../../tests/decoder-fixtures/mode5.mjs) import no production decoder,
palette, geometry or display function. Public `{label:'', minWidth:24, height:6}`
returns an actual 24×6 face with c1/s2 and a 20×2 body. Four complete literals
require 40 opaque color pixels despite mask holes, 20 conventional one-bit masked
pixels, 84 missing-body green pixels, or exactly GBYR under D=(-3,5) and the
exclusive rectangular clip. Signed ID 0 and same-ID type collisions are tested.
All fourteen source/built assertions failed on main `426b624a` (correct dimensions,
zero opaque pixels), then passed with this implementation.

A separate hidden midtone fixture verifies raw green 33 becomes current display
48 exactly once before alpha promotion. These tests establish the declared
current display policy, not original device conversion. Further checks cover
owner/payload joins, duplicate/unsupported decisions, malformed caller bindings,
abort/decode failure, full clipping and actual URL/cache cleanup. No ledger status,
reference eligibility, capture, or golden baseline is promoted by these tests.
