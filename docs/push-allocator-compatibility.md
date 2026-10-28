# Push compositor allocator compatibility

The push compositor's final visibility scan now runs only for normalized
rectangular clips. For default, unknown, or unbounded clips, the omitted scan
previously wrote no pixels. Normal pixel output is unchanged.

This changes observations for custom `PixelBuffer.alloc` implementations whose
returned buffer exposes `width` or `height` through getters: output dimensions
are no longer read solely for that omitted scan.

Side effects, getter errors, cancellation, or disposal triggered solely by those
removed reads no longer occur. For example, a getter that previously threw only
during that scan will no longer cause that error there. Getters whose behavior
depends on read counts may also behave differently at later observations.

Actual drawing, rectangular clipping, dimension reads used for diagnostics, and
lifetime checks are retained. An unknown clip remains unknown in diagnostics;
it is not reclassified as unbounded. Applying no additional clip does not
establish knowledge of the original clip state.

Custom allocators should provide dimensions without relying on incidental
internal read counts. Trigger cancellation or disposal explicitly through the
applicable lifetime APIs. This note does not guarantee a global getter order or
number of dimension reads.

This compatibility change applies only to the push compositor. It does not
change other controls or raw `PixelBuffer` methods, or retire any broader API.
