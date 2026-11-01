# 0.7.0 pre-launch: installation and migration

**0.7.0** is a pre-launch release (GitHub release `v0.7.0`; no npm
publication). `v2` is an internal development branch label, not public release
2.0 or a 1.0 threshold, which [#168](https://github.com/khawkins98/scriptoscope/issues/168)
still has to define. It compares with `v0.6.0` at
`fa727e1f4edb9a83f48d25a50d78e5d20c887e62`.

## Try a matching build

Use Node.js 24, matching the [contributor toolchain](../../CONTRIBUTING.md).
From a checkout of the candidate:

```sh
npm ci
npm run build:demo
npm run preview:demo
```

Open the printed local `/scriptoscope/` URL. The public Pages site serves the
`main` build, which matches the latest release when it is cut. For self-hosting, copy the runtime chunks, CSS, helper modules and themes
from the **same demo build**, following [vendoring](../../README.md#vendoring-if-you-dont-want-a-third-party-cdn-dependency).
Do not mix the old deployment with the new example helper.

To try the library in a separate npm consumer, run `npm run build`, then
`npm pack --ignore-scripts` in this checkout and install the resulting tarball
by local path. Its filename is `scriptoscope-<version>.tgz` (for example `scriptoscope-0.8.0.tgz`). This does not publish a package.

| Import | Intended use |
|---|---|
| `scriptoscope` | Full ESM runtime, loaders, interaction and selected promotion APIs |
| `scriptoscope/renderer` | Shared rendering/composition API when a theme is already available |
| `scriptoscope/declarative` | Explicit window/control/field/tab/icon/picker/modal promotion primitives |
| `scriptoscope/scriptoscope.css` | Optional outer-shell styling |

These are the package's declared entries, with type declarations for the three
JavaScript entries. `scriptoscope/package.json` is also exported. The renderer
entry shares implementation and constructor identities with the root; it does
not provide the full loader/host surface. `mountExplicitPage` is **separate
application example code**, not an export from any package entry. Copy/adapt the
[example helper](../../demo/EXPLICIT-HOST.md) or implement the public host contract.

## Delivered behavior and migration

The [0.7.0 changelog](../../CHANGELOG.md#070--2026-10-29) records the delivered
changes. The following compatibility actions follow the adopted public contracts:

| Before | After on this candidate |
|---|---|
| `mountDeclarative` / `mountOwnedDeclarative` discovers and promotes sources | Those exports and mount-specific types are removed. Select sources explicitly; use promotion/restoration primitives or the example `mountExplicitPage` helper. |
| Appending or moving a node relies on discovery/retry | Attach later sources explicitly; detach before moving/removing them. Disconnect before replacing the root. Property/location observers synchronize already promoted controls only. |
| `interactiveCheckbox` / `radioGroup` factories and option types | Use labelled native checkbox/radio inputs with initial `checked`, shared radio `name` and native `change` listeners; explicitly promote them. |
| `interactiveButton` wrapper markup or pointerup/keyup timing | The factory/options remain, but its result is a native `type="button"` element. Use native activation, focus and disabled semantics; Enter may activate on keydown. |
| Owned catalog fields named `url` assigned directly to image sources | Resolve local references asynchronously with `themeImageUrl(theme, ref)` or `theme.imageUrl(ref)`; existing eager loaders still supply ready image URLs. |

With the example helper, late sources use:

```js
await handle.attach({ buttons: [saveButton], controls: [checkbox] });
await handle.whenReady();
// Before moving/removing these sources:
handle.detach({ buttons: [saveButton], controls: [checkbox] });
// Before replacing the root:
handle.disconnect();
```

Direct hosts must guard asynchronous preparation by source lifetime and theme
generation, abort before restoration, and release dependents before disposing
the resolver. Registered themes and their base chains are borrowed; their owner
disposes them after the last consumer disconnects. Native source identity, form
association and live values remain owned by the browser/application. Checkables
may move into a carrier while promoted; do not depend on their parent markup.
See [explicit host migration](../../EXPLICIT-HOST-API.md), the
[native-control example](../../README.md#native-form-control-migration-070-484)
and [owned-theme lifecycle](owned-theme-api.md).

Tabs and whole-header/list-column composition now use engine drivers
([#471](https://github.com/khawkins98/scriptoscope/pull/471),
[#473](https://github.com/khawkins98/scriptoscope/pull/473)). Unsupported tab inputs
report distinct no-paint diagnostics; typography, public tab sizing/contrast and
column layout/labels remain bounded compatibility policies. Redraw preserves
native input interaction during resize
([#493](https://github.com/khawkins98/scriptoscope/pull/493)). These do not require
consumers to adopt the optional renderer entry or owned loaders.

The demo now includes loading states and reading-page windows, and dragging
windows on a scrolled page uses corrected coordinates
([#510](https://github.com/khawkins98/scriptoscope/pull/510), merged into `v2`).
Story desk windows also account for their authored padding before promotion,
avoiding post-mount growth and changed wrapping
([#516](https://github.com/khawkins98/scriptoscope/pull/516), merged into `v2`).
Its two-line consumer CSS correction replaces the automatically closed #514
attempt; runtime behavior is unchanged.

Custom push allocators should provide dimensions without side effects tied to
incidental read counts: a removed no-op scan no longer triggers those getter
reads. See the [precise allocator change](../push-allocator-compatibility.md).
The [generated-name policy](../generated-name-compatibility.md) admits only
independently classified incidental minifier names, preserving exported names,
identity relationships and explicit errors.

## Snapshot timing and known limits

The adopted [owned API contract](owned-theme-api.md#references-and-images)
binds a selected asset's owner/transport identity before asynchronous pixel or
image work; later edits cannot redirect that prepared source. Tabs/headers retain
selected-owner and prepared-profile snapshots across decoding. Renderers borrow
source arrays; callers must not mutate those arrays. These statements do **not**
establish a general load-time metadata freeze or a new mutation protocol.
The [current consumer boundary](raster-asset-consumers.md#implemented-compatibility-boundary)
states that live manifest/base reads are preserved. Consumers should retain that
contract; any proposed broader metadata freeze requires a separate adopted public
contract and migration guidance.

Optional visual coverage restored by
[#482](https://github.com/khawkins98/scriptoscope/pull/482) completes #481; it does
not establish full native fidelity. The Windows 95 titlebar reference in
[#492](https://github.com/khawkins98/scriptoscope/pull/492) adds a bounded original
condition, **zero exact browser pixel oracles**, and no production runtime change.
Native font/provider/metrics, title geometry, device behavior and broader default
research remain unresolved. Browser goldens and modern smoke checks establish
only their stated regression scopes.

PRs [#475](https://github.com/khawkins98/scriptoscope/pull/475),
[#483](https://github.com/khawkins98/scriptoscope/pull/483) and
[#500](https://github.com/khawkins98/scriptoscope/pull/500) are closed unmerged;
Studio authoring and those bevel/header/allocator experiments are excluded.
The optimization audit records do not turn rejected prototypes into delivered
features or establish application-wide performance. A small raster kernel is
only one part of the runtime.

## Release gates and remaining work

- 0.7.0 is tagged only after the release candidate's own required checks pass
  and a smoke check of the deployed Pages site. Component PR checks certify
  their own exact heads; neither they nor the smoke check are universal fidelity
  certification.
- Fidelity-first stabilization continues under
  [#509](https://github.com/khawkins98/scriptoscope/issues/509) / #221. #209 remains
  canonical deferred scope, #472 remains parked authoring, and #190/#218/#277
  retain unresolved evidence/geometry/default research. Optimization goal477
  remains paused.
