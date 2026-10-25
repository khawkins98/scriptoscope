# Raster ownership and consumer contract

Starting revision: `de942c6399c81d1f15d23247dfd62a36e11a64bc` on
`refactor/runtime-streamlining`, based on `origin/v2`.

## Consumer inventory

| Consumer | Current access | Ownership and migration requirement |
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
after an earlier failure. Future lazy materialization must additionally revoke a
URL produced after its owner is disposed, and must not reinsert the owner's data.

## URL compatibility decision

Stage 2 retains ready image URLs and eager encoding. It removes image readback
from renderer calls for eligible built-in assets. It does not claim the spike's
full loading reduction, and it temporarily retains all transferred raw arrays;
memory measurement is required before final adoption.

Stage 3 must keep the existing ready-URL API intact. A render-focused loading
surface can be additive and explicit, with asynchronous image materialization
for callers that opt into it. Internal consumers can adopt that surface where
their own contracts permit awaiting image preparation. Existing `loadTheme` and
`loadKaleidoscopeScheme` calls must continue to supply valid image URL strings.
No placeholder blob, Promise or internal identity may escape as an image URL on
those existing paths.

## Next production slice

Astra's follow-up review recommends a structurally distinct `OwnedTheme` whose
reference-bearing manifest lives under `source`, rather than a top-level
`LoadedTheme.manifest`. Public render/composition entry points accept
`ThemeInput = LoadedTheme | OwnedTheme` and normalize through one internal
`ThemeView`. Views provide `pixels(ref)`, `imageUrl(ref)` and owner lifetime;
family selectors continue returning the selected owner and reference. The same
painters and selectors serve both public inputs.

Implement one additive owned loader and push/default composition first. Prove
that owned loading plus an eligible button creates zero PNG URLs, and that a
catalog image request creates one reusable real URL. The existing loader must
materialize its ready-image contract over this same owner. Include mixed
owned-child/legacy-base inputs. Preserve live reads of mutable legacy manifests
and base chains rather than freezing copies during normalization.

Replace whole-manifest URL enumeration in `engine/resources/theme.ts` with owner
lifetime subscriptions for owned views, including an already-disposed check.
Keep the legacy observer only for sources without an owner. A public diagnostic
field named `assetUrl` must contain a usable image URL, never a private reference;
materialize selected diagnostics only when requested.

Retain synchronous `assetUrl` and `promoteIcon` for existing loaded themes. A
separate asynchronous image helper/promotion path serves owned themes, sharing
selection and DOM assignment logic and checking scanner generation/disconnect
before adoption. Migrate first-party loading to the owned surface before retiring
the transitional URL-indexed registration. Compatibility adapters remain; a
second conversion engine or permanent experimental flag does not.
