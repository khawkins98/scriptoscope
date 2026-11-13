# Hosted helper and markup reference

`mountExplicitPage` is the published application helper in
[demo/explicit-host.mjs](../demo/explicit-host.mjs), not a package export. It uses
public promotion primitives and an owned theme resolver. Start with the
[hosted tutorial](../README.md#five-minute-setup) or [page recipes](./decorate-a-page.md).
For custom host implementation, see [runtime recipes](./runtime-api.md#guarded-promotion-and-restoration).

## The full `data-scriptoscope-*` vocabulary

All names below have the `data-scriptoscope-` prefix. Attributes describe the
initial selection/configuration; later application changes require the relevant
API, explicit attach or remount. This table describes the example host, which
selects through [selectPageSources](../demo/explicit-host.mjs).

| Suffix | Target | Meaning |
|---|---|---|
| `window` | element | Replace wrapper with managed chrome; children stay live HTML. |
| `title` | window | Optional title text. |
| `window-type` | window | Default `document-window`; other types below. |
| `x`, `y` | window | Initial CSS-pixel position; either opts into absolute positioning. |
| `width`, `height` | window | Declared **content** dimensions; frame lies outside. |
| `extra-width`, `extra-height` | window | Extra auto-captured **outer** bounds; ignored on a declared axis. |
| `state` | window | `active` or `inactive`; last active request wins within a manager. Unspecified first window starts active. |
| `z` | window | Initial stacking order. |
| `collapsed` | window | Initial window-shade request; popup windows remain expanded. |
| `widgets` | window | Comma-separated `close,zoom,collapse`; absent wires supported widgets, empty wires none. Art is retained. |
| `hit` | window | `region` (default) or `box`; detailed [hit rules](./interaction.md#1a-hit-area-and-frame-pass-through). |
| `theme` | window/ancestor | Nearest authored slug or URL override. |
| `window-id` | window | Stable layout-persistence key; ordinal is fallback. |
| `button` | button | Add themed native-button face; original owns form actions/listeners. |
| `default`, `disabled` | themed button | OK ring / disabled appearance; native disabled also applies. Sampled at promotion and retheme. |
| `control="off"` | native checkbox/radio/range/select | Exclude from the helper's initial control selection. Other matching controls are selected without requiring an opt-in marker. |
| `field` | text input/textarea | Opt-in bevel decoration. |
| `tabs` | container | Tab strip containing tab buttons and panels. |
| `tab="panel-id"` | button inside tabs | Associated panel id. |
| `panel="id"` | panel inside tabs | Panel identity. |
| `selected` | tab button | Initial selection; first tab is fallback. |
| `theme-switcher` | select | Options select runtime themes. |
| `theme-picker` | container | Folder tiles from `themes` catalog. |
| `cascade` | container | One-time absolute stagger; default 32×28 px step. |
| `cascade-step-x`, `cascade-step-y`, `cascade-base-x`, `cascade-base-y` | cascade container | Step/base CSS pixels; base defaults to 0×0. Explicit per-window coordinates win. |
| `icon` | img/span | Named Finder icon such as `folder`, `document` or `prefs`. |
| `icon-id` | img/span | Explicit Apple resource id instead of named lookup. |

Window types: `document-window`, `dialog`, `alert`, `movable-modal`,
`movable-alert`, `titled-utility-window`, `side-floating-utility-window`,
`no-title-utility-window`, `popup-window`; boot-shaded variants are
`collapsed-document-window`, `collapsed-titled-utility`, `collapsed-side-utility`
and `collapsed-no-title-utility`. The loader's
[window recipes](../tools/theme-loader/window-recipes.mjs) define supported names.
Art/state coverage varies by scheme. Runtime double-click shade is independent of
whether a boot-shaded variant has dedicated art.

`.scriptoscope-window-fallback` and `.scriptoscope-button-fallback` are initial
selection alternatives when a publishing system strips data attributes. There is
no automatic observation of sources added later.

## Explicit page host options

| Option | Contract |
|---|---|
| `root` | Element selection boundary; default `document.body`. |
| `sources` | Explicit finite selection, e.g. from `selectPageSources(root)`. |
| `themeBaseUrl` | Base directory for slug-addressed archives. |
| `pageThemeDefault` | Default slug or URL; default `1138`. |
| `baseSlug` | Optional base scheme for inheritance. |
| `registeredThemes` | Iterable `[ref, theme]` entries borrowed before initial paint. |
| `resolver` | Optional caller-owned theme resolver to share. The host loads and registers through it and never disposes it; its own options replace `themeBaseUrl`, `baseSlug` and `themes` source hints. Dispose it only after every host using it has disconnected. Omitted: the host creates and disposes its own, as before. |
| `themes` | Picker/cycle catalog; default empty. Entries include `slug`, optional `name`, `author`, `year`, `source`, `meta`; legacy `label` is accepted. |
| `hit` | Default frame input mode, region unless overridden. |
| `persistKey` | Layout storage namespace `scriptoscope:layout:<key>`. |
| `syncToUrlParam` | Optional URL parameter for initial theme and successful switches. |
| `autoCycle` | Interval in ms; disabled by restored URL selection, first root interaction or reduced motion. |
| `bootAffordance` | `auto` by default; `none`/`false` disables reveal. Reduced motion is respected. |
| `rejectOnEmptyMount` | Reject when a nonempty selected set has zero successes. |
| `onPromoteError(detail)` | Per-target `{ kind, el, cause }` failure callback. |

Await the call for selected promotions, post-attachment scrollbar refreshes and
boot reveals. A hidden/stalled reveal completes without an indefinite wait
(the bounded reveal wait is 360 ms). `ready` is queued for the next task so the
caller can subscribe after awaiting the handle.

| Handle member | Contract |
|---|---|
| `attach({ buttons, controls })` | Promise for explicitly added native sources and refresh work. No window/field/tab discovery. |
| `detach({ buttons, controls })` | Abort/restore those sources before moving or removing them. |
| `whenReady()` | Await latest requested explicit work. |
| `retheme(ref)` | Promise for the current theme replacement. |
| `registerTheme(ref, theme)` | Borrow a decoded theme/base graph. |
| `disconnect()` | Abort host work; restore native DOM before releasing owned themes. Idempotent. |
| `openModal(wrap, options)` | Public modal helper; returns `{ close() }`. See [modal interaction](./interaction.md#7-modals). |
| `stats` | Numeric `windows`, `buttons`, `controls`, `tabs`, `fields` counts. |
| `failures` | Collected per-target promotion failures. |

Events and their targets are defined once in the
[interaction reference](./interaction.md#8-events-reference). Listen for window
host events on a stable ancestor, since promotion detaches the source wrapper.

## Ownership and completion

Boot failures reject with `PagePromotionError`, retaining `cause` and `failures`.
Partial target failures keep usable results, append to `failures`, invoke the
callback and emit failure events. Retheme load/window preparation errors reject
and retain previously committed windows. Controls replace after the prepared
window batch: this is not an atomic transaction for the whole page.

The latest **request** owns completion, even if it fails. Superseded/disconnected
requests cannot publish completion; `attach` waits for current replacement work.
A failed or stale face replacement retains the preceding committed face and its
native synchronization until successful replacement or explicit restoration.
The guard gates pending preparation, not the ownership of an already committed face.

Detach/disconnect abort before restoration. Windows, buttons, controls, fields,
tabs and host-owned picker/cascade changes restore only still-owned mutations;
later application edits and native form state survive. Removed/reparented sources
are never pulled back to a captured parent. There is no automatic discovery or
retry service. An application can explicitly attach again after a failed attempt.

The resolver owns internally loaded themes. Registered themes and their bases are
borrowed: keep them alive until all dependents disconnect, then dispose through
their owner. A drop-zone owner must disconnect consuming hosts before releasing
its decoded themes. Direct resolver users call `dispose()` after releasing faces;
future loads/registrations on a disposed resolver fail.

URL synchronization, cascade, cycling, boot affordances and persistence are host
policy. Explicit theme overrides get separate managers; their activation/z-order
is independent of the shared manager. Persisted sizes use `acceptUserSize` to
avoid auto-fit growing them afterward. See [persistence](./interaction.md#persistence-and-cross-tab-restore-example-host-only).
