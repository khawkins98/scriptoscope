# Declared group2 slider layout

`loadTheme` and `loadKaleidoscopeScheme` accept the optional
`sliderLayoutEnvironment: PreparedCinfEnvironment`. Prepare it with the existing
`prepareCinfEnvironment` factory and an explicit ordered, complete cinf-only
provider declaration. This option is independent of the push/bevel
`cinfEnvironment` option; omitting it preserves compatibility slider geometry and
existing prepared environment IDs, body views and common chrome fields.

The role tries horizontal cinf IDs `-10132`, then `-10144`, or vertical IDs
`-10116`, then `-10128`. It is attached to the actual group2 thumb (`-10129` or
`-10113`), not the currently selected groove. Each attempt retains its outcome
and the selected provider, fork hash, resource occurrence, signed ID, payload
length and hash. The manifest's `sliderLayoutEnvironment` and thumb's
`sliderLayoutCinf` describe this consumed role separately from the static local
cicn/cinf pair. No provenance option is needed for admission.

Only the selected cinf's first byte supplies the layout corner. A one-byte
payload and an explicit zero are valid; the body decoder's 18-byte requirement
does not apply to this role. An empty present payload, duplicate match, incomplete
provider/environment, or two missing results is unsupported. Unknown evidence
never becomes a NULL lookup. Horizontal and vertical views are prepared
independently, so unavailable vertical inputs do not prevent horizontal use.

Consumption snapshots the actual finalized thumb and immutable role before
image decoding. Transplanted views, cloned manifests, changed assets, wrong-axis
thumbs, absent thumbs and base inheritance reject explicitly. Unsupported
geometry or lookup results raise `CinfEnvironmentError` with code
`UNSUPPORTED_CINF_ENVIRONMENT`; they do not silently select zero or legacy
geometry. Provider and input bytes are copied before asynchronous preparation,
including loads without `provenance: true`.

## Conditional source rule

The pinned CDEF3 is 11,595 bytes, SHA-256
`d40e0c27be6b55a37c706b194828b9b6a74800e47eca65d4bf1561a92aef465a`.
At `0x043e–0x0480`, group-base lookup supplies the first corner byte. Two NULL
results leave the auxiliary field unchanged; its `NewHandle` allocation is not
`NewHandleClear`, so missing metadata does not establish corner zero.

For an admitted group2 rectangle, corner `c`, axis length `L`, thumb axis length
`t`, and positive native range, `0x0a82–0x0b5a` gives:

- Horizontal: `left + c + trunc((L - t - 2*c) * (value-min)/(max-min))`.
- Vertical: `top + c + trunc((L - t - 2*c) * (max-value)/(max-min))`.

The normalized public API uses that conditional direction and inset rule.
Vertical minimum is at the bottom. Group2 cross-axis layout is 16 pixels,
centered with signed truncation (`0x0866–0x0932`); four state cells retain that
cross-axis size (`0x10cc–0x10ee`). This opt-in requires an exact 16-pixel
thumb cross-cell, nonnegative axial travel and a groove no wider than that cross
span. The groove admission is bounded modern policy, not native transverse
painting or transfer proof. The committed slider layout carries its value
direction to pointer consumers. Default geometry and scrollbar behavior remain
compatibility paths.

This does not establish a historical Resource Manager search order, actual
provider/cache, native device/offscreen allocation success, exact original
value normalization, or original caller control identity. The declared resource
environment, decoded art and modern display realization remain explicit inputs.
Selected groove cap/tile metadata is a separate input, documented in
[slider selected metadata](slider-selected-metadata.md). No original bytes or
new original-reference acceptance are introduced.
