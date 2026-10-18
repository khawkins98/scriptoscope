# Indexed cicn decoding: bounded independent fixtures

This contract covers the sequential indexed-color `cicn` payload consumed by
`tools/theme-loader/decoders/cicn.js`. It does not certify archive extraction,
resource selection, original drawing behavior, device color matching or the
complete decoder. Actual input identity is a separate
[load-provenance contract](resource-byte-provenance.md).

## Primary evidence

- Apple, *Inside Macintosh: Imaging With QuickDraw*, Color QuickDraw pp.4-105–106,
  Figure 4-18: PixMap, mask BitMap, monochrome BitMap and icon-data handle precede
  mask bytes, optional monochrome bytes, ColorTable and indexed pixel bytes.
  Pixel maps and indexed depths are described on pp.4-10–11; bitmap rows on
  pp.2-3–4. Local reviewed PDF SHA-256:
  `f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`.
- Apple [TN QD13, Principia Off-Screen Graphics Environments](https://leopard-adc.pepas.com/technotes/qd/qd_13.html),
  ColorTable discussion: when bit15 of `ctFlags` is clear, `ColorSpec.value`
  identifies the pixel; when set, record position identifies it. Bit14 requests
  destination-window palette interpretation and does not use stored RGB.
  Reviewed HTML SHA-256:
  `493a6ce9e1080363441908b16ca104278f22a243c7247195294450036243db36`.

No original engine code executes. Literal test bytes and expected RGBA are
hand-authored independently of the production parser, packing helpers and
encoder. These are finite format requirements, not render self-goldens.

## Implemented boundary

Indexed depths 1/2/4/8 use MSB-first packing and their declared rowBytes. Color
and mask strides are independent. Mask bits become binary alpha; monochrome
fallback pixels do not contribute to color output. A NIL monochrome fallback
has no bytes, including when its bounds are present and rowBytes is zero.

The decoder validates required sections, nonempty pixel-map/mask dimensions,
nonnegative monochrome dimensions and minimum populated-row strides before
allocating expanded pixels. Invalid/truncated payloads fail explicitly. The
shared reader and other resource decoders retain their own existing policies.
Destination-window palette mode fails explicitly because the standalone
resource decoder has no destination palette.

The remaining policies are deliberately narrower than historical truth:

- Undefined palette indices keep the existing black compatibility fallback.
- RGB16 components retain their existing high-byte conversion to RGBA8; no
  display/gamma/device-matching fidelity is established here.
- Duplicate `ColorSpec.value` records retain first-match compatibility. Their
  original interpretation is unverified.
- Mismatched mask dimensions retain top-left overlap and opaque pixels outside
  the mask. No original alignment/resampling rule is claimed.
- Direct 16/32-bit color icons remain unsupported. Packed/compressed or other
  pixel-map formats are outside the independently tested indexed contract.

## Acceptance and regression evidence

`tools/theme-loader/cicn.test.mjs` verifies four depths, row padding, byte-boundary
masks, binary mask polarity, nonzero bounds origins, NIL/ignored monochrome
fallbacks, sparse/permuted tables and bit15 positional tables. Negative fixtures
cover each truncated section, invalid dimensions/strides/table length and bit14.
Against pre-fix main `8df3b4d9`, permuted mapping, undefined-index lookup,
bit14 rejection and structural negatives fail; corrected decoder passes.

`cicn-corpus.test.mjs` separately preserves observed decoded output for all 3,325
cicns in the 18 explicitly pinned forks. `tests/decoder-fixtures/cicn-corpus.json`
records archive/fork identities plus ordered `[signedId,width,height]` JSON and
RGBA byte aggregate hashes from pre-fix `8df3b4d9`. This is regression evidence,
not independent pixel truth. The raw survey found depths 1/2/4/8 counts
493/685/1516/631; 3,324 tables use flags 0 and one uses 0x8000. There are 1,295 sparse
nonpositional tables, but correcting lookup changes no currently used corpus
pixel. Five undefined indices remain across 1984/-10139, 1990/-9504 and
dolphin-som/-9504. No required-range/stride or mask-dimension mismatch was found
in these pinned inputs; other inputs remain unassessed.

The four-theme availability candidate regeneration changes only its cicn decoder
toolchain hash. Candidates remain schema1/unreviewed; all archive, fork, resource,
presence and decoded-dimension facts remain identical. The independently reviewed
availability inventory stays version1.0.1, digest
`18780e634b364e281f24dab8b5f470d84ee6b8a7b58d5c853dbbbe8438ec9652`.
Its validator binds review version/digest to cases, separately from extraction
provenance, so no case review/version transition occurs in this fix.
