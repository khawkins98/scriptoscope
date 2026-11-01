# Raster ownership and consumer contract

Starting revision: `de942c6399c81d1f15d23247dfd62a36e11a64bc` on
`refactor/runtime-streamlining`, based on `origin/v2`.

## Consumer inventory

| Consumer | Starting access | Ownership and migration requirement |
| --- | --- | --- |
| Window chrome | `renderWindow.ts` loads chrome through `loadCicnBuffer` | Borrow decoded pixels without changing window resolution or geometry. |
| Engine families | `engine/resources/theme.ts` prepares cicn, sampled, unmasked, ppat and icon sources through `loadCicnBuffer` | Preserve occurrence identity, display policy, owner, base order, unknown outcomes and pending-load cancellation. |
| Control facades | `controls.ts`, `pushButtonFacade.ts`, `headerFacade.ts`, `tabFacade.ts` use `loadCicnBuffer` | Share the same pixel access; retain family admission and source-selection rules. |
| Window body CSS | `renderWindow.ts` uses synchronous `assetUrl` strings for background images | A real image URL is required before applying CSS. |
| Window background sampling | `renderWindow.ts` creates an Image for pattern sampling | Can consume the shared source buffer in a later bounded change. |
| Declarative icons | `declarative/icon.ts` synchronously returns success and assigns inspector icon URLs | Preserve synchronous behavior and usable URLs for existing callers. |
| Active theme picker previews | `declarative/themePicker.ts` reads inspector icon URLs | Existing returned strings remain valid image sources. |
| Inactive picker previews | `declarative/pickerIcons.ts` uses the separate lightweight icon loader | Already avoids full-theme decoding; retain its independent data URL cache. |
| Public manifest, glyph and inspector fields | `types.ts` exposes image URLs; `assetUrl` synchronously resolves relative or absolute references | External consumers may assign these strings to images, CSS or fetch. Do not silently substitute handles. |
| Custom factories and raw conversion | Loader options expose `assetUrlFactory` and `encodeAssets:false` | A custom factory may transform pixels; its returned image remains authoritative. Raw output is caller-owned and is not registered. |
| Legacy/pre-extracted or externally constructed themes | Relative, HTTP and data URLs reach `loadCicnBuffer` | Retain image decoding on cache misses; borrowing does not transfer disposal ownership. |
| Separately bundled loader/runtime copies | Shared asset release notifications | Share source-to-owner lookup; captured descriptors carry the actual owner. |

External consumers cannot be exhaustively enumerated. The public URL string
contract is the compatibility boundary, regardless of whether an in-repository
consumer happens to use a field today.

## Ownership rules

Each decoded theme owns only the URLs it creates and the pixel arrays transferred
from its conversion. A base theme is borrowed. Disposing a child must not dispose
its base. Repeated disposal has no further effect. Owner disposal invalidates captured sources and clears private storage. Blob-release
notifications evict derived image caches across module copies.

The built-in image encoder has known pixel semantics. Its binary-alpha rasters
can be read directly, with transparent RGB zeroed to match historical Canvas
readback. Fractional alpha stays on the browser decoding path because browser
premultiplication may round channels. Custom encoders retain image decoding:
their output is allowed to differ from their input.

Source arrays are borrowed as immutable by renderers. The store may normalize its
private transferred arrays on first access; callers must not mutate a borrowed
source. Raw-mode conversion results stay caller-owned and unchanged.

All encoder workers must settle before cleanup, including late successful work
after an earlier failure. Lazy materialization revokes a URL produced after its owner is disposed and
never reinserts the owner's data.

## Implemented compatibility boundary

Existing `loadTheme` and `loadKaleidoscopeScheme` loaders retain their eager
ready-image contract, materializing every occurrence through the shared owner
and releasing its private source arrays. Legacy renderers keep browser decoding;
the earlier registration behind PNG URLs was removed to preserve that observable
boundary. No placeholder, Promise or internal identity escapes as an image URL.

The additive `OwnedTheme` keeps reference-bearing manifests under `source`,
structurally distinct from `LoadedTheme`. Public migrated entries accept
`ThemeInput = LoadedTheme | OwnedTheme`. One cached internal `ThemeView` captures an asset source with pixel, async
image and dimension access. The view has lifetime observation, without `baseUrl`
or disposal. Asset capture binds transport identity synchronously and starts no
encoding or decoding.
Live manifest/base reads and precise selected owner/reference pairs are preserved.
The prototype adapter and wrapper owner rebinding have been deleted.

All low-level control families and window rendering use this boundary. Button,
form-control and tab promotion accept owned inputs as well. Owned
window body CSS exports only selected tiles. Dimensions use decoded pixels when
available and dimension-only image decoding for external/unreadable images.
Baseline utility sizing retains its pre-migration document-pattern policy.
Owned lifetimes avoid whole-manifest URL enumeration; legacy release observers
remain supported. Requested public diagnostic image fields materialize valid URLs.

## Remaining consumers and retirement

The owned resolver/mount now share the existing scanner and lifecycle. Declarative
icons and active picker previews await selected image exports; cancellation,
changed icon attributes and scope changes cannot publish stale results. Existing
synchronous `assetUrl` and `promoteIcon` contracts remain intact. Main demo startup
and drops use owned loading. The diagnostic inspector exports images at scene/sprite boundaries and opens
inventory images lazily. Detached panels ignore late image results. Final mounted
performance and retained-memory measurements remain open.

`WindowManager<Theme>` now stores and returns the original input identity; its
default remains `LoadedTheme`. `createOwnedThemeResolver` (used by the example
host `mountExplicitPage`) uses the same resolver lifecycle through this boundary;
`mountOwnedDeclarative` and its scanner were removed in #491.

## Owner-local transport retirement

Captured entries replace the global raw-reference registry. Owned manifests keep
local paths; only capture against the selected owner identifies pixels. The
realm-wide state contains a source-to-owner WeakMap and monotonic identity counter.
The image decoder accepts real image URLs only; private-prefix recognition,
per-reference cache invalidation and the exported global lookup helpers are removed.
Owner lifetime notifications and actual blob-release notifications remain.

Capture rejects unknown local paths, retains custom encoder and fractional-alpha
semantics, and invalidates later access after disposal or eager pixel release.
Clearing an entry removes raw arrays, normalized pixels and settled image promises
even if callers retain its descriptor. Pending encoders keep their temporary input
accounted for until settlement and revoke late blobs. Buffers already borrowed by
callers and external URL caches remain outside that reclamation promise.

Compatibility adapters remain; a second engine or permanent experiment flag does
not. Net runtime reduction and retained-memory measurements remain merge conditions.
