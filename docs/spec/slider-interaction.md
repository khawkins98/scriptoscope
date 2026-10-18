# Slider composition and native pointer geometry

A promoted native range uses layout produced by the exact composition that drew
its canvas. This is an internal rendering/interaction consistency contract, not
an assertion about original Kaleidoscope slider geometry.

`composeSliderWithLayout` and `platinumSliderWithLayout` return an internal
`SliderComposition`: the PixelBuffer plus backing-pixel orientation, axis length,
actual drawn thumb rectangle (or null), travel start/end and rendered normalized
value. Those fields are assigned beside the drawing coordinates. The interaction
adapter does not resolve resources again or infer thumb bounds from pixels.

Public `composeSlider` and `platinumSlider` retain their existing PixelBuffer
return types and pixel output. The native form adapter alone consumes the paired
layout. Public imperative sliders and scrollbars retain their existing pointer
mapping and callback contract.

The adapter commits a canvas and its layout under the same asynchronous
`paintVersion` check. A stale or disposed composition commits neither. Pointer
coordinates are converted from the actual canvas's CSS bounds into backing
pixels; a stretched host does not enlarge the hit surface. A drag captures its
starting native value and geometry, so a pressed repaint cannot re-anchor it.
The browser remains responsible for native numeric bounds, step sanitization,
keyboard and accessibility semantics.

The native control lifetime also reaches the internal composer. It checks before
each sequential image load and after awaited decodes, so a track completing after
disconnect cannot start a thumb/fallback request against revoked owned URLs.
This does not cancel an image request that already started, defer theme disposal,
or change public/imperative slider composition semantics.

See the [integration policy](../integration-edge-cases.md#theme-ownership-on-teardown)
for exact-value thumb grabs, track-click centering, zero-travel/missing-thumb
behavior and cancellation. The source/built `range-pointer.spec.mjs` contracts
use independently specified authored/engineered extents and real pointer events,
including held/reordered pressed decodes, rather than treating shared layout
metadata as an independent oracle.
