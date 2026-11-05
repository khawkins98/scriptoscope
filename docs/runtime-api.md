# Runtime API guide

For the complete application lifecycle, start with the [npm integration guide](./npm-consumer.md). This guide covers lower-level rendering, owned assets and advanced composition. The [hosted page reference](./hosted-reference.md) covers the separate `mountExplicitPage` example.

## Renderer-only entry

Renderer-only consumers that already have a `LoadedTheme` or `OwnedTheme` can
import the shared rendering API from `@khawkins98/scriptoscope/renderer`. The full
`@khawkins98/scriptoscope` entry continues to support theme loaders and declarative DOM
integration; use it when your application needs those features.

```ts
import { renderWindow, type ThemeInput } from '@khawkins98/scriptoscope/renderer';

async function showWindow(theme: ThemeInput, container: HTMLElement) {
  container.append(await renderWindow(theme, {
    title: 'Hello', width: 240, height: 120,
  }));
}
```

## Owned raster loading

`loadOwnedTheme()` and `loadOwnedKaleidoscopeScheme()` return a distinct
`OwnedTheme`. `createOwnedThemeResolver()` provides owned loading. The explicit page host
uses that resolver and owns its selected source lifetimes. Window/control composition
and interactive promotion accept owned inputs;
selected images export asynchronously through `themeImageUrl()`. Its `source`
fields contain local resource paths, including fields historically named `url`.
Existing loaders retain ready image URLs. See the [owned API and lifecycle
contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/owned-theme-api.md) for examples and the current adoption boundary.
Existing raw loading and factory APIs remain available. Registered themes are borrowed; release them only after host dependents are disconnected.

## Native form-control migration (0.7.0, #484)

The 0.7.0 release replaced the earlier checkbox and radio factories with native inputs. For the full migration, see the [release notes](./v2/integration-release-notes.md).
`interactiveCheckbox`, `radioGroup` and their corresponding option types are
removed from the public exports. Replace those factories with native checkbox/radio
inputs, labels, initial `checked` state and native `change` listeners. Shared
radio `name` values give the browser ownership of group selection and keyboard
behavior. Explicit hosts promote the native inputs selected by the application.

For standalone controls using an already loaded `OwnedTheme` named `theme`,
mount an empty attached container, register the borrowed theme, then append the
controls. This reuses the theme without another load:

```js
import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';

const root = document.createElement('div');
document.body.append(root);
const handle = await mountExplicitPage({
  root, pageThemeDefault: 'session', bootAffordance: 'none',
});
handle.registerTheme('session', theme);
root.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  console.log(input.name, input.type === 'checkbox' ? input.checked : input.value);
});
root.insertAdjacentHTML('beforeend', `
  <label><input type="checkbox" name="invisibles" checked>Show invisibles</label>
  <label><input type="radio" name="mode" value="on" checked>On</label>
  <label><input type="radio" name="mode" value="off">Off</label>
`);

await handle.attach({controls: [...root.querySelectorAll("input")]});

// Before replacing the container or its controls:
handle.disconnect();
root.replaceChildren();
```

The native inputs retain their identity, form association and values. Checkboxes
and radios may move into a themed carrier label while mounted; do not depend on
their parent markup. `disconnect()` does not dispose a registered borrowed theme;
its owner releases it after its last consumer finishes.

`interactiveButton(theme, options)` and its `onClick` option remain available,
but the returned themed element is now an actual `HTMLButtonElement` with
`type="button"`. Native click, Space, Enter, focus and disabled-fieldset behavior
apply, including programmatic `.click()`. Enter activation can occur on keydown;
do not depend on the former pointerup/keyup callback timing, wrapper spans or
internal ARIA structure. Decorative pointer/key handlers only update paint feedback;
activation follows the native button.

Closed selects keep the native `<select>` as their sole interaction surface;
themed art is passive. Low-level `composeCheckable`, `composeButton` and raster
APIs, the managed button binder, and standalone `interactiveSlider` and
`interactiveScrollbar` APIs (including vertical scrollbars) remain available.

## Imperative — `loadTheme()` + `renderWindow()`

A scheme bundle is a directory containing the **original Kaleidoscope archive** (`scheme.sit` preferred, `scheme.rsrc` fallback) plus `meta.json` + `PROVENANCE.md`. `loadTheme()` fetches the archive and decodes it in-browser via the bundled StuffIt + Kaleidoscope decoders; `renderWindow()` composites a window from the result. The ready-image path eagerly encodes its image assets. The declarative resolver caches bundle loads; direct calls load independently.

```ts
import { loadTheme, renderWindow } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';

const theme = await loadTheme('https://khawkins98.github.io/scriptoscope/themes/beos-r503');
const win = await renderWindow(theme, {
  title: 'Hello!',
  width: 320, height: 200,
  state: 'active',
});
document.body.appendChild(win);
```

Window titles use substitute browser fonts. Recipe titles fit every nonzero-alpha
main glyph pixel of the complete request vertically before horizontal truncation.
They retain the preferred family and required face, choosing the largest fitting
eligible size; one resolved style governs advance, layout, prefix/ellipsis
measurement and painting. A demonstrated impossible slot omits ink while
preserving the full accessibility title. Procedural frames retain their own
font, geometry, baseline and truncation policies.

Coverage relies on the explicit modern **P1 finite envelope and guarded-placement
query-equivalence assumptions** for stable loaded text state. The signed actual
bounds expand on each side by the candidate size plus one internal-raster pixel.
Bounded guarded paint windows draw the complete request at translated coordinates;
owned query pixels must retain the original pen/baseline phase and coverage.
Geometric containment, a metric anchor or transparent readback cannot prove this
premise for arbitrary fonts, fallback sequences or native culling. This is
conditional modern compatibility, not native typography equivalence.

Every consumed measurement must be usable, including metrics-only advance,
prefix/ellipsis and procedural measurements. Unusable metrics/coordinates,
unsupported observation state, known envelope or placement violations, or host
allocation/readback/security failure reject the render/update with an error named
`TitleCoverageUnavailableError`. Handle that operation's failure; unresolved
coverage cannot silently select a smaller style, ellipsis or TF5 ink omission.
Existing non-DOM and null-Canvas-context fallbacks remain unchanged.

Coverage scratch is one canvas of at most 4096×32 pixels plus same-size RGBA
readback: at most 1,048,576 bytes across those two explicit RGBA planes.
Destination-sized publication/frame output, input strings, opaque host memory,
garbage collection and cumulative readback traffic are separate. Work is finite
but can be quadratic, with no hard realtime or total-memory guarantee.
[Measured long-title costs](https://github.com/khawkins98/scriptoscope/blob/main/LEARNINGS.md#2026-11-02--bounded-title-coverage-needs-a-declared-raster-envelope-637)
include seconds-scale regressions with guarded observation. See the
[title-coverage contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/engine/window-title-fit.md) for support
premises, placement, failure semantics and resource limits.

`loadTheme` tries `scheme.sit` first, then falls back to `scheme.rsrc` by default. When you already know which form the bundle ships (e.g. from a catalog manifest), pass `{ source: 'scheme.sit' }` to skip the cascade and avoid the dev-console 404 noise on `.rsrc`-only bundles:

```ts
const theme = await loadTheme('/themes/1990', { source: 'scheme.rsrc' });
```

Picker `name`, `author`, and `year` are display labels. The loader fetches the complete
`meta.json` sidecar alongside the archive to retain source and license provenance.
If your catalog already includes that complete sidecar, pass it as `ThemeEntry.meta`
(or `loadTheme`’s `meta` option) to avoid the metadata request.

The `LoadedTheme` returned carries optional `dispose()` to revoke its blob URLs and evict its raster-cache entries; call it after its last consumer permanently unmounts.

The released control facades include `composeScrollbar` / `composeSlider` with
optional `pressedPart` (a pressed state without a part means the thumb).
`composeProgress` accepts normalized `value` or signed 16-bit native `range`,
never both, plus `indeterminate` and a phase byte. `composeProgressFrame` returns
the phase after drawing; `ProgressIdle` handles idle advancement in the interactive
layer. These are public exports; `src/engine/` remains internal. The option types
in [`src/controls.ts`](https://github.com/khawkins98/scriptoscope/blob/main/src/controls.ts) describe the released wrapper contract.

See [`demo/diagnostic.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/diagnostic.html) for the full integration, [`docs/spec/compositor-spec.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/compositor-spec.md) for the chrome model, and [`docs/scene-slot-spec.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/scene-slot-spec.md) + [`docs/scene-codex.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/scene-codex.md) for the per-theme tier resolution of every Scene visual slot.

## Optional measured display preparation

Load raw scheme colors through an explicit finite display profile when you have
reviewed mappings for a particular device/producer environment:

```js
import { prepareDisplayProfile, loadTheme } from '@khawkins98/scriptoscope';
const data = await fetch('/my-reviewed-display-profile.json').then(r => r.json());
const displayProfile = await prepareDisplayProfile(data);
const theme = await loadTheme('/themes/windows-95', { displayProfile });
```

The same option is available to `loadKaleidoscopeScheme` and the example host resolver.
Missing exact RGB16 mappings reject the load before asset URLs are allocated;
base themes must use the same profile. Omitting the option preserves the default
colors and reviewed goldens. A profile is finite environment data, not a general
original-device emulator or whole-theme fidelity claim. See the
[display-profile contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/display-profile.md) for producer tables,
fixed-icon conventions, ownership and unsupported inputs.

## Whole-header pixel surfaces

`composeHeaderSurface` draws a whole Appearance header rectangle without labels
or column layout. `composeListHeader` and `platinumListHeader` retain their
existing multi-column behavior. The new API requires explicit dimensions, raw
state and a declared coordinate/clip context:

```js
import { composeHeaderSurface, bufferToCanvas } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';

const result = await composeHeaderSurface(theme, {
  kind: 'list-view-header', width: 180, height: 18, drawState: 1,
  compositionContext: {
    controlOrigin: [12, 24], portOrigin: [0, 0],
    patternOrigin: { status: 'unknown' },
    clip: { kind: 'rect', rect: { x: 12, y: 24, w: 180, h: 18 } },
  },
});
if (result.status === 'rendered') document.body.append(bufferToCanvas(result.buffer));
```

Handle `unavailable` and `unsupported` explicitly. The initial supported subset
uses solid bodies, binary masks and verified current-display sampling; patterns,
device caches and recording remain outside it. See the [header-surface contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/header-surface.md)
for state selection, list-view extension before clipping, diagnostics and limits.

## Button label sizing

Themed push and bevel buttons accept an explicit `fontSize` (finite, at least
6px), with a 12px compatibility default independent of face height. See the
[font-size policy and source boundary](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/control-font-size.md).

Plain push buttons also accept an opt-in caller-owned `bitmapFont`, prepared with
`prepareBitmapFont`. It keeps advances, line metrics and signed ink bearings
separate and uses the bounded source-derived single-line layout. Browser fonts
remain the default; see [the prepared-strike contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/prepared-bitmap-font.md).

## Managed button pattern context

Push buttons promoted inside a window owned by the same declarative mount follow
that content viewport's logical position and scroll. Standalone controls keep
local context. Imperative consumers opt in explicitly:

```ts
import { interactiveButton, WindowManager, bindButtonToContentPort } from '@khawkins98/scriptoscope';

const content = document.createElement('div');
const button = await interactiveButton(theme, { label: 'OK', default: true });
content.append(button);
const manager = new WindowManager();
const host = await manager.add(theme, { width: 320, height: 180, scale: 2 }, {}, { contentEl: content });
document.body.append(host);
const binding = bindButtonToContentPort(button, manager.contentPort(host)!);
await binding.refresh();
// binding.state separates requested measurement from committedContext/pending/error.
// Before releasing the theme:
await binding.dispose();
manager.remove(host);
host.remove();
```

Import these functions from `@khawkins98/scriptoscope`. Binding adopts the committed window
scale by default, so a 1x button deliberately grows to 2x in this example; ordinary
HTML siblings do not. `{ scale: 'preserve' }` keeps the caller's size and reports
incompatible units explicitly. A direct `setButtonCompositionContext(button,
context)` replaces provider ownership. Unbind preserves newer consumer style
edits. Unsupported mappings use explicit compatibility defaults; measured browser
coordinates do not establish original GrafPort state. See the
[managed-context contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/managed-control-context.md) for lifetimes,
coordinate limits and automatic/foreign-manager boundaries.

## Hosted markup and local-file themes

Use the [hosted page reference](./hosted-reference.md) for `data-scriptoscope-*` options and the [local-file theme recipe](./hosted-recipes.md#bring-your-own-theme--drop-a-sit--rsrc-and-see-it-render) for drop-zone conversion. The public `loadKaleidoscopeScheme` wrapper decodes entirely in-browser; its conversion design is archived in [the browser-conversion design](./superpowers/specs/2026-05-27-browser-conversion-design.md).
