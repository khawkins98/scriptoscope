# Owned theme loading

The render-focused loaders return an `OwnedTheme`, distinct from the existing
ready-image `LoadedTheme`. All low-level window and control composition entry points accept either
contract. Interactive sliders and disclosure controls, and button,
form-control and tab promotion, use the same owned path. The main demo startup
and drop flows use owned loading; diagnostic catalog images export asynchronously.
Native checkbox/radio inputs replace the retired interactive checkable factories.

```ts
import { loadOwnedTheme, interactiveButton, WindowManager, themeImageUrl, type OwnedTheme } from 'scriptoscope';

const theme = await loadOwnedTheme('/themes/1138');
const button = await interactiveButton(theme, { label: 'OK', onClick: save });
const manager = new WindowManager<OwnedTheme>();
const content = document.createElement('div');
content.append(button);
const host = await manager.add(theme, { title: 'Owned theme' }, {}, { contentEl: content });
document.body.append(host);
// manager.describe(host)?.theme is the original theme object.

const icon = theme.source.inspector?.iconIndex.find(entry => entry.id === -3999);
if (icon?.url) image.src = await themeImageUrl(theme, icon.url);

// After its consumers have been unmounted:
manager.remove(host);
host.remove();
theme.dispose();
```

`loadOwnedKaleidoscopeScheme(bytes)` provides the same contract for dropped or
already fetched archives. Both loaders use the existing converter and family
renderer; they do not introduce another rendering engine.

## Explicit host loading

```ts
import { loadOwnedKaleidoscopeScheme } from 'scriptoscope';
// Application example helper, separate from the package exports.
import { mountExplicitPage } from './explicit-host.mjs'; // copy/adapt demo helper into your app

const handle = await mountExplicitPage({ root, themeBaseUrl: '/themes', pageThemeDefault: '1138' });
const dropped = await loadOwnedKaleidoscopeScheme(file);
handle.registerTheme('dropped:example', dropped);
await handle.retheme('dropped:example');
handle.disconnect();
// Registration borrows the theme; dispose after its last consumer unmounts.
dropped.dispose();
```

`createOwnedThemeResolver()` caches owned loads and supports registered legacy or
owned inputs through `ThemeResolver<ThemeInput>`. `createThemeResolver()` retains
its `LoadedTheme` contract. `mountDeclarative` and `mountOwnedDeclarative` are
removed; use public promotion/restoration primitives or the separate example
helper above. The helper owns selected sources and uses owned loading. Later
controls require `await handle.attach({controls: [input]})`; detach before moving
or removing them, and disconnect before replacing the root. See the
[public migration contract](../../EXPLICIT-HOST-API.md) and
[example host guide](../../demo/EXPLICIT-HOST.md).

Icons in the explicit host export selected images asynchronously and ignore stale
completion after cancellation, changed attributes or movement into another theme
scope. The existing synchronous `promoteIcon` remains supported for ready-image
themes; `promoteIconAsync` in `scriptoscope/declarative` accepts either contract.
Active picker previews retain the actual selected base owner; background tiles
keep their separate folder-only loader.

## References and images

`theme.source` contains the resource manifest and catalogs. Every asset string
there, including catalog fields historically named `url`, is a resource reference,
not an image source. `theme.origin` identifies a fetched bundle. The source lacks
the required `baseUrl` of `LoadedTheme`, so TypeScript rejects passing it to
synchronous ready-image APIs such as `assetUrl` or `promoteIcon`.

Use `theme.imageUrl(ref)` or `themeImageUrl(theme, ref)` at an actual image boundary.
Owned references are local asset paths, interpreted only by their selected
owner. Unknown local paths reject; explicit HTTP, data and blob URLs stay borrowed. Repeated requests share image work. A failed request can retry while
the owner lives. Generated blob URLs remain owned by the theme and are revoked
at disposal, including URLs completed by encoders after disposal.

Eligible built-in raster inputs render without creating PNGs. Windows export
only their selected CSS body tiles; their native dimensions come from the shared
pixel source. Internal render views expose neither synchronous image URLs nor
theme disposal. A captured asset binds its owner and transport identity before
awaiting pixels or a diagnostic image; later edits to a manifest or legacy bundle
URL do not redirect that prepared source. Fractional-alpha
inputs retain browser readback to preserve channel rounding. A custom
`assetUrlFactory` remains authoritative: drawing must export and decode its image,
because the factory may transform the supplied pixels. Requested public control
diagnostics materialize selected image URLs instead of exposing private references.

Existing `loadTheme` and `loadKaleidoscopeScheme` calls still return ready image URL
strings. They eagerly materialize the same owner implementation and then release
its private pixel references. Existing synchronous image consumers stay supported.

## Ownership and validation

An owned theme borrows its configured base. Disposing a child does not dispose
that base. `WindowManager` defaults to its existing `LoadedTheme` contract;
parameterize it with `OwnedTheme` or `ThemeInput` for the owned path. Its
`describe()` result preserves the original input identity. The example
`mountExplicitPage` host uses owned loading; neither retired mount is exported.

Disposed composition does not publish a completed buffer. Shared renderer
preparation checks theme and base lifetimes before and after asynchronous work. Renderers borrow source arrays; callers must not mutate those arrays.

The owner tracks transferred backing buffers, in-flight encoding buffers, image
exports and pending work. These counters do not include externally borrowed
buffers or total browser/process memory; final migration measurements must cover
those separately. An in-flight encoder can retain pixels until it settles even
after disposal begins.

The production transport comparator exercises every renderer family through
source and built entries, legacy and owned base inheritance, clipped and
unclipped composition, browser and synthetic prepared bitmap labels, real image
exports, diagnostic URL fields, interactive activation and disposal. Missing art
and unsupported census outcomes are compared separately from painted buffers;
a declared-empty base tier is distinct from an unobserved one. Window comparisons cover chrome pixels,
layout, CSS tile pixels and scale, and inherited owner selection. A mounted
owned window also retains its interactive content through retheming. It establishes transport regression parity,
not additional historical engine or font fidelity.

Owned diagnostic export failures occur within renderer preparation. Completion
runs once with an error outcome and preserves the original renderer/export error
if the diagnostic callback also throws. An unresolved private reference is never
reported as a usable diagnostic image URL.
