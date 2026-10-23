# Declared group2 slider layout

`loadTheme` and `loadKaleidoscopeScheme` accept the optional
`sliderLayoutEnvironment: PreparedCinfEnvironment`. Prepare it with the existing
`prepareCinfEnvironment` factory and an explicit ordered, complete cinf-only
provider declaration. This option is independent of the push/bevel
`cinfEnvironment` option; omitting it preserves ordinary engine resource resolution and existing prepared
environment IDs, body views and common chrome fields.

The engine adapter uses the declared ordered providers as an authoritative
`cinf` tier for every opted-in slider request: gate, group-base corner and groove
slicing. Archive/base `cinf` inputs are suppressed for that composition; cicn art
keeps its ordinary archive provider. Missing declared metadata never falls back
to unrelated archive metadata. No-opt-in resource resolution is unchanged.

The corner tries horizontal IDs `-10132`, then `-10144`, or vertical IDs
`-10116`, then `-10128`. Only its first byte supplies the corner: a one-byte
payload and explicit zero are valid. An empty present payload, duplicate match,
incomplete provider/environment, or two missing corner results is unsupported.
Unknown evidence never becomes a NULL lookup. Other requests consume the complete
copied payload, including the gate's presence test and the groove slicer's bytes
0, 2 and 3. A short groove payload follows engine/slider.md CF3: that candidate
fails, rather than inventing missing bytes. Consequently an opted-in environment
can change gate and groove selection as well as endpoints.

The loader attaches an opaque frozen `sliderLayoutEnvironment` marker containing
only `environmentId` and `bindingId`, using a generic load-bound owner/asset
capability. The typed engine adapter interprets and validates the slider inputs
before image decoding. Private owner identity rejects cloned manifests,
transplanted markers, marker deletion on the original owner, changed assets,
wrong-axis or absent thumbs and base inheritance. Each orientation is admitted
independently. Unsupported geometry or lookups raise `CinfEnvironmentError` with
code `UNSUPPORTED_CINF_ENVIRONMENT`; they never select zero or legacy geometry.
Provider and input bytes are copied before asynchronous preparation, including
loads without `provenance: true`.

### Migration

The `sliderLayoutEnvironment` input option, generic preparation/binding, existing
prepared IDs/data and push/bevel body views are preserved. The retired decoded
`ChromeElement.sliderLayoutCinf` view and slider summary fields (`scope`,
`policy`, `themeForkSha256`) are removed; the manifest marker is identity only.
Consumers needing provider provenance should inspect opted-in engine resource
traces (`tier: 'cinf'`, declared provider ID). The engine adapter's private role
snapshot also retains corner lookup attempts and selected resource identity.
`SliderLayout.endpointPolicy` is removed: all sliders use the committed engine
layout for pointer mapping. This also updates ordinary imperative sliders from
full-canvas value mapping to the drawn thumb travel, exact-value grabs and
track-click centering already used by the native adapter.

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
thumb cross-cell, nonnegative axial travel and a declared corner equal to the
corner the resource chain resolves. Track art of any cross size is admitted:
engine/slider.md §5.5 SL1 centres it in the 16-pixel band `B` with signed
truncation, and §5.1 never draws outside the control rect, so no groove-width
admission applies. The committed slider layout carries its value
direction to pointer consumers. Ordinary and declared sliders share the engine
layout, and the pointer adapter consumes that committed layout in both cases.
Scrollbar behavior is unchanged.

This does not establish a historical Resource Manager search order, actual
provider/cache, native device/offscreen allocation success, exact original
value normalization, or original caller control identity. The declared resource
environment, decoded art and modern display realization remain explicit inputs.
Selected groove cap/tile metadata is a separate input, documented in
[slider selected metadata](slider-selected-metadata.md). No original bytes or
new original-reference acceptance are introduced.
