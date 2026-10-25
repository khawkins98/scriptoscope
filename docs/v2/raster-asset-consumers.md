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
| Separately bundled loader/runtime copies | Shared asset release notifications | Decoded pixel lookup must share realm-wide identities too. |

External consumers cannot be exhaustively enumerated. The public URL string
contract is the compatibility boundary, regardless of whether an in-repository
consumer happens to use a field today.

## Ownership rules

Each decoded theme owns only the URLs it creates and the pixel arrays transferred
from its conversion. A base theme is borrowed. Disposing a child must not dispose
its base. Repeated disposal has no further effect. Release notifications evict
both source-pixel registration and derived runtime caches across module copies.

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
`ThemeInput = LoadedTheme | OwnedTheme`. One cached internal `ThemeView` exposes
pixels, async image export, dimensions and lifetime, without `baseUrl` or disposal.
Live manifest/base reads and precise selected owner/reference pairs are preserved.
The prototype adapter and wrapper owner rebinding have been deleted.

Push/default buttons, window rendering and scrollbars use this boundary. Owned
window body CSS exports only selected tiles. Dimensions use decoded pixels when
available and dimension-only image decoding for external/unreadable images.
Baseline utility sizing retains its pre-migration document-pattern policy.
Owned lifetimes avoid whole-manifest URL enumeration; legacy release observers
remain supported. Requested public diagnostic image fields materialize valid URLs.

## Remaining consumers and retirement

Migrate the other family facades, declarative controls/icons, picker/inspector and
first-party loading onto this boundary. Preserve synchronous `assetUrl` and
`promoteIcon` contracts for existing loaded themes. An asynchronous owned mount
must share their selection and lifecycle implementation and check generation and
disconnect before adopting prepared DOM.

`WindowManager<Theme>` now stores and returns the original input identity; its
default remains `LoadedTheme`. A supported owned mount must use the same scanner
and resolver through this boundary, then replace ordinary demo startup and drops.

Private URI registration and prefix recognition are still transitional. Retire
them together only after auditing every cross-owner glyph, sampled-resource and
pattern handoff. Local paths alone cannot identify an asset across owners.
Compatibility adapters remain; a second engine or permanent experiment flag does
not. Net runtime reduction and retained-memory measurements remain merge conditions.
