# Selected public compatibility delta — isolated prototype only

The coordinator selected a newly implemented thin PixelBuffer surface for the executable trial. The earlier raw-Raster/class-removal proposal is not selected. No shipping approval is implied for extension-observation changes.

## Preserved ordinary API

Both `scriptoscope` and `scriptoscope/renderer` retain `PixelBuffer` and `PixRect`. Constructor, static `alloc`, getPixel/setPixel/copyBits/nineSlice/fillRect/drawOver/toImageData names, signatures and result envelopes remain. All pixel-producing results remain PixelBuffer, including ComposedChrome/growBox, controls, ProgressFrame, SliderComposition, HeaderSurfaceResult, platinum functions, loadCicnBuffer, rasterizeText and ProgressIdle.compose. No ordinary consumer migration is required by this selection.

Width/height/data remain readonly-typed public fields; records are not frozen and data contents remain mutable. Supplied Uint8ClampedArray aliases exactly, with no copy, resize or ownership transfer. Asset cache identity, retained references and disposal remain. Construction stores width/height as supplied and uses `data ?? new Uint8ClampedArray(width * height * 4)`, with no new type/length/dimension validation or error before allocation. toImageData still allocates `new ImageData(width,height)`, then sets its data from the raster data, preserving platform exceptions, short-data padding and oversized-data failure. bufferToCanvas keeps its Canvas allocation/context/upload sequence.

Normal numeric pixel addressing, fractional coordinates, alpha, hidden RGB, self-copy write order, clipping and blend arithmetic remain required. All product window/control geometry/state, resource choice, metadata/resource errors, unknown branches, native form ownership, accessibility, host integration, callbacks/events and lifetime remain required.

## Exact proposed extension-observation changes

These are experimental changes for review, not claims that current extensions are unimportant:

| Operation | Observation retired by direct painting |
| --- | --- |
| PixelBuffer.fillRect | Nested calls to overridden/replaced destination setPixel no longer occur |
| PixelBuffer.drawOver | Nested calls to source getPixel and destination getPixel/setPixel no longer occur |
| PixelBuffer.nineSlice | Nested calls to overridden/replaced destination copyBits no longer occur |
| PixelBuffer.getPixel and direct backend operations | Exact count/order of width/height/data getter reads is unspecified; stable-valued getter-backed records remain readable |
| PixelBuffer.fillRect and nineSlice input rectangles/insets | Exact coordinate/inset getter-read count/order is unspecified; values are captured for immediate painting and must remain stable during the operation |
| Internally created rendering intermediates | Replaced prototype methods are not guaranteed to intercept all internal painting; internal header source-plane wrappers and pen-state callbacks have been removed |

An explicit external call to an overridden method still resolves that method normally. This proposal does not remove methods or subclasses as ordinary JavaScript constructs. Pixel storage values changing through accessor side effects during one primitive operation are unsupported under this trial boundary; ordinary typed-array mutation and write-through aliases remain supported. No freezing or byte snapshot substitutes for the latter.

Public diagnostic callbacks retain values and ordering. Live content-port callback mutation, metadata getter observation, resource provider/error ordering and Canvas factory observation remain required. Already approved mount/service retirements and bevel metadata entry snapshots are separate.
