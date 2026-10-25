# Owned theme loading

The render-focused loaders return an `OwnedTheme`, distinct from the existing
ready-image `LoadedTheme`. Push/default button composition and interactive push
buttons accept either contract. Other renderer entry points and default scanner
loading are still being migrated in feature PR #480.

```ts
import { loadOwnedTheme, interactiveButton, themeImageUrl } from 'scriptoscope';

const theme = await loadOwnedTheme('/themes/1138');
const button = await interactiveButton(theme, { label: 'OK', onClick: save });
document.body.append(button);

const icon = theme.source.inspector?.iconIndex.find(entry => entry.id === -3999);
if (icon?.url) image.src = await themeImageUrl(theme, icon.url);

// After its consumers have been unmounted:
theme.dispose();
```

`loadOwnedKaleidoscopeScheme(bytes)` provides the same contract for dropped or
already fetched archives. Both loaders use the existing converter and family
renderer; they do not introduce another rendering engine.

## References and images

`theme.source` contains the resource manifest and catalogs. Every asset string
there, including catalog fields historically named `url`, is a resource reference,
not an image source. `theme.origin` identifies a fetched bundle. The source lacks
the required `baseUrl` of `LoadedTheme`, so TypeScript rejects passing it to
synchronous ready-image APIs such as `assetUrl` or `promoteIcon`.

Use `theme.imageUrl(ref)` or `themeImageUrl(theme, ref)` at an actual image boundary.
Both accept returned owned references; owned original asset paths are also
supported. Repeated requests share image work. A failed request can retry while
the owner lives. Generated blob URLs remain owned by the theme and are revoked
at disposal, including URLs completed by encoders after disposal.

Eligible built-in raster inputs render without creating PNGs. Fractional-alpha
inputs retain browser readback to preserve channel rounding. A custom
`assetUrlFactory` remains authoritative: drawing must export and decode its image,
because the factory may transform the supplied pixels. Requested public control
diagnostics materialize selected image URLs instead of exposing private references.

Existing `loadTheme` and `loadKaleidoscopeScheme` calls still return ready image URL
strings. They eagerly materialize the same owner implementation and then release
its private pixel references. Existing synchronous image consumers stay supported.

## Ownership and validation

An owned theme borrows its configured base. Disposing a child does not dispose
that base. Aborted or disposed button composition does not publish a completed
buffer. Renderers borrow source arrays; callers must not mutate those arrays.

The owner tracks registered backing buffers, in-flight encoding buffers, image
exports and pending work. These counters do not include externally borrowed
buffers or total browser/process memory; final migration measurements must cover
those separately. An in-flight encoder can retain pixels until it settles even
after disposal begins.

The production transport comparator exercises source and built entries, legacy
and owned base inheritance, clipped and unclipped composition, browser and
synthetic prepared bitmap labels, real image exports, diagnostic URL fields,
interactive activation and disposal. It establishes transport regression parity,
not additional historical engine or font fidelity.
