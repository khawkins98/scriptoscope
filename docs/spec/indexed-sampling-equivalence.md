# Indexed sampler/current-display equivalence

The optional `ChromeElement.samplingEquivalence` record is an admission condition,
not historical color certification. #295 adds it without changing existing
compositors. #292 separately consumes it for source-sampled header bands.

The pinned kDEF0 (107726 bytes, SHA256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`)
and PACH130 (87914 bytes, SHA256
`bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`)
have corresponding one-column/row expansion paths:

| Boundary | kDEF0 offsets | PACH130 offsets |
| --- | --- | --- |
| Band helper | feae | 5cb8 |
| Width1 expanded horizontally | ff3e–ffba | 5d48–5dc4 |
| Height1 expanded vertically | ffba–1001c | 5dc4–5e26 |
| Mask-check sampler | f9f6→fa8a | 5810→5874 |
| Full-color palette lookup | fc48→10702 | 5a32→687e |

These branches can occur with either tiling flag. Mask-zero pixels skip color
sampling. Opaque lines use the engine's RGB16 palette search: matching positional
value first, final-zero positional shortcut, reverse value search, then entry0.
It ignores ctFlags. The indexed raster decoder instead uses position for bit15,
otherwise first matching value, and black for a missing value. See
[raw sample semantics](control-text-colors.md) and [cicn decoding](cicn-decoding.md).
A decoded raster's successful availability therefore does not imply identical
source-sampled line colors.

The immutable scalar record is:

```ts
interface CicnSamplingEquivalence {
  model: 'kaleidoscope-2.3.1-opaque-sampling-v1';
  comparison: 'opaque-current-display-rgb';
  displayPolicy: 'mac-1.8-to-2.2-high-byte';
  width: number;
  height: number;
  status: 'equivalent' | 'different' | 'unknown';
  reason: 'all-opaque-display-rgb-equal' | 'opaque-display-mismatch'
    | 'unsupported-layout' | 'missing-sampler' | 'unsafe-palette-access'
    | 'ambiguous-asset-path';
}
```

During actual indexed decoding, every opaque pixel compares engine RGB16 high
bytes through the existing LUT with the actual decoded RGB8 through that same
LUT. The result is memoized per used opaque index (at most256); no extra index
plane, palette, vector or function escapes conversion. Masked mismatches are
irrelevant to this domain. A safe all-transparent raster is vacuously equivalent.
Different raw16 or even different high bytes can have equal current display RGB.

Admission requires zero-origin matching PixMap/mask bounds, positive equal
sizes and the decoder's independently valid packed strides, not equal strides.
Only the uncompressed indexed PixMap layout with pixelType0, one component and
matching component depth is admitted. Unsafe positional palette access is
unknown; any observed opaque mismatch establishes different. That early result does not
certify safety of unvisited samples; a future sampled-color asset needs its own
complete safe pass. Unsupported layouts
are unknown before comparison. Malformed input keeps decoder errors; unsupported
bit14 remains skipped, without invented metadata/assets.

The record follows the exact consumed cicn occurrence, independent of cinf.
Duplicate emitted asset paths become unknown; provenance-opted loads retain the
existing pre-allocation rejection. Optional byte provenance joins occurrence,
load and manifest key. Legacy absent/null metadata is unknown. Manifest validation
checks dimensions/model/reason shape, not authenticity of caller-created claims.
Extraction and raw/encoded loaders carry the same additive record.

This does not prove original selected ownership, destination palette/gamma,
cache conversion, mono drawing, picture recording, text transfer or original
pixels. Whole-raster differences can reject a resource whose particular bands
would agree; no second geometry resolver is introduced here. The metadata-only introduction left existing consumers unchanged. The separate
[sampled-band correction](sampled-control-bands.md) uses the record and an
optional complete-safe companion in push/bevel/ring line branches (#296).
No ledger status is promoted.

## Validation and observed corpus

`samplingEquivalence.test.mjs` uses hand-encoded palette branches, masks, raw16
and high-byte collisions, unsafe layouts, occurrence identities and
ambiguous bindings. The source/built browser contract verifies encoded colors,
exact payload hashes and distinct parallel load IDs with the same key/ID. Tests
establish this comparison and transport contract, not original rendered colors.

Run `node scripts/survey-sampling-equivalence.mjs` for an explicitly observed
status inventory using the canonical18 input choices. The initial survey finds
3325/3325 equivalent cicn records, including a separately labeled survey of the proven PACH header dispatch
IDs−9568/−9567 and catalog IDs−9551/−9550; author labels do not establish
original dispatch.
This is not an independently reviewed availability or fidelity denominator, nor
a survey of actual line-sampler incidence. All3325 prior raw RGBA hashes remain
identical. Removing only this new manifest field reproduces all18 prior decoded
manifest fingerprints; updated fingerprints account for additive metadata only.
No image goldens change.
