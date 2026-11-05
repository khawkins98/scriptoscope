# Decorate a page without a build step

Start with the [complete hosted example](../README.md#five-minute-setup). This
reference covers the example host, markup, theme switching, imported schemes and
self-hosting. For application-owned attachment and teardown, use the
[npm guide](./npm-consumer.md). `mountExplicitPage` is an example helper, not a
package mount export.

## Style the window shell and dialog body

The optional stylesheet applies `--scriptoscope-window-shadow` to the rendered
window's `::part(window)`. WindowManager marks its outer hosts with
`data-scriptoscope-window-host`, including imperative windows. The default is
`none`: shell shadows are optional page decoration, and a CSS
box shadow fills a rectangle even when theme artwork has transparent or jagged
edges. To opt in, set e.g. `--scriptoscope-window-shadow: 2px 2px 0 #0006` on
`:root`, a desktop container or a window host. The shadow bounds stay aligned
with the frame when grid or flex stretches the outer host; theme-painted pixels
are unchanged.

Dialog and alert windows (`dialog`, `movable-modal`, `alert`, `movable-alert`)
fill their body with the scheme's dialog colour, as Kaleidoscope does: entry 0
of the scheme's `dctb`/`actb` -14336, or Kaleidoscope's own light grey when the
scheme ships none. Document windows stay white or use the scheme's body
pattern. The body's text colour comes from the same table (black, or white on
1984's dark blue), so it replaces a `color` set on the window host. Your content
sits on top of the fill, so a background or colour on your own elements wins. To
change the defaults, set `--scriptoscope-dialog-background` (e.g. `#ffffff`) and
`--scriptoscope-dialog-text` on `:root` or a window host.

## Three things to know up front

If you only need it to work, you can skip this section. If something looks slightly off after you've dropped Scriptoscope on your page, one of these is probably why:

1. **Your element stays where you put it.** No `-x`/`-y` attributes = the runtime host sits in normal flow at the source element's DOM position (CSS Grid / Flex / normal flow all respected). Set `data-scriptoscope-x="N"` / `-y="N"` (px only, no `%` / `em` / `vh`) to opt into a floating overlay. Dragging an in-flow window converts it to a floater on the first drag.
2. **Your `.my-class { display: grid }` won't reach the host.** Host CSS properties (including `display`, `box-sizing`, `padding`, `border`, `background`, `overflow`, `margin`, `transform`, `filter`, `contain` and `clip-path`) are locked down inline on the runtime host so consumer-class CSS can't break the host ↔ chrome-canvas correspondence. Everything else — color, font, custom properties, your `position: relative` for stacking — still applies.
3. **Promotion replaces the wrapper.** The runtime moves your element's children into its slot and removes the original element. Framework refs to the wrapper become detached. Mount Scriptoscope AFTER your framework's first paint (`useEffect(() => mountExplicitPage(...), [])` in React; `onMounted` in Vue).

The full set of behaviours, with the gotchas + framework integration notes + known incompatibilities ([`* { transform: translateZ(0) }`, `box-sizing: content-box`, `body { overflow: hidden }`, etc.), lives in **[docs/integration-edge-cases.md](https://github.com/khawkins98/scriptoscope/blob/main/docs/integration-edge-cases.md)**. Open it when you hit a weird CSS issue and the cause isn't obvious; you don't need to read it first.

## Choose a theme

Browse the [live catalog](https://khawkins98.github.io/scriptoscope/) or read the
[theme manifest](https://khawkins98.github.io/scriptoscope/themes-manifest.json)
for slugs, authors and metadata. A bundle contains its original archive,
`meta.json` and `PROVENANCE.md`; retain those terms when redistributing it.

## The full `data-scriptoscope-*` vocabulary

| Attribute | Where | What it does |
|---|---|---|
| `data-scriptoscope-window` | any element | Promote into a Mac window. Children become the window body. |
| `data-scriptoscope-title="…"` | a window | Title-bar text. Optional. |
| `data-scriptoscope-window-type="…"` | a window | One of: `document-window`, `dialog`, `alert`, `movable-modal`, `movable-alert`, `titled-utility-window`, `side-floating-utility-window`, `no-title-utility-window`, `popup-window`, plus boot-shaded variants `collapsed-document-window`, `collapsed-titled-utility`, `collapsed-side-utility`, `collapsed-no-title-utility` (most schemes ship art for `collapsed-document-window` only; double-click any window's title at runtime to shade regardless of boot-type). Default: `document-window`. |
| `data-scriptoscope-x="…"` / `data-scriptoscope-y="…"` | a window | Initial position (px), relative to the nearest positioned ancestor. **Setting either flips the host to `position: absolute`** — the opt-in to the floater posture (overlays, desktop scatters, palettes). When BOTH are omitted, the host stays in flow at the source element's DOM position — `getBoundingClientRect` is never consulted for layout; the browser places it natively. The cascade fallback (`24+26·n`, `24+26·n`) applies only on this absolute path when the source element has no bounding rect (e.g. `display:none` at promotion time). |
| `data-scriptoscope-width="…"` / `data-scriptoscope-height="…"` | a window | **Declared content size** in px; the frame is added outside it. **Optional** — omitted values capture the element's outer box; chrome is fitted inside that bound. When declared, the size is fixed: the auto-resize observer is suppressed for that dimension. Use for overlay-style windows that should be a specific size regardless of where the source element sits in the DOM. |
| `data-scriptoscope-extra-width="…"` / `data-scriptoscope-extra-height="…"` | a window | **Additive** padding (in px) on the auto-captured natural rect — pre-reserves space for content that will grow after promote. **Mutually exclusive** with `data-scriptoscope-width` / `-height` (ignored when the absolute form is set). Use case: a theme-picker whose tile children are populated by the runtime itself; without `extra-height`, the chrome boots at the empty-strip size and momentarily shows nested scrollbars until the auto-resize observer catches up. Setting `extra-height` synchronously reserves the space and avoids the visual pop. (The runtime ALSO auto-resizes via `ResizeObserver` regardless — `extra-*` is the synchronous version that skips the pop.) |
| `data-scriptoscope-state="active"` or `"inactive"` | a window | Initial focus state. Default `active` for first window, `inactive` after. One window per manager is active: if several declare `active`, the last promoted wins. |
| `data-scriptoscope-z="…"` | a window | Initial stacking order. Higher = on top. |
| `data-scriptoscope-collapsed` | a window | Boot pre-shaded (just title bar visible). Double-click the title to toggle at runtime. |
| `data-scriptoscope-widgets` | a window | Comma-separated subset of `close,zoom,collapse` whose click handlers wire up. Omitted widgets are still painted by the cicn art (we don't paint over chrome) but clicking does nothing. Default (attribute absent): every widget the type supports is wired. The demo uses `document-window` + `widgets="zoom,collapse"` for both the Read Me and the Schemes Folder — page-essential content, not dismissible. `widgets=""` makes every painted widget inert. |
| `data-scriptoscope-hit="region"` or `"box"` | a window | Where the window takes pointer input. **`region`** (the default): on schemes whose frames have see-through gaps (merlons, ornaments, a popup window's band beside its tab), a press, hover or wheel over a transparent frame pixel goes to whatever is beneath, as in real Kaleidoscope; the content area and every opaque frame pixel stay the window's. A press on page content outside every window deactivates the active window (touch: a completed tap). **`box`** restores the behaviour before frame pass-through (#597): the whole rectangle is the window, and outside presses leave it active. Trimmed and case-insensitive; an empty or unknown value is ignored, so the window inherits the page default (`new WindowManager({ hit })`, `setDefaultHit()`). Read at promotion; change it later with `WindowManager.applyState(host, { hit })`. The host reports the mode in force as `data-scriptoscope-hit-effective` (read-only). Built-in-frame schemes (`apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes`, `system7-nostalgia-silver`) and windows inside an open `openModal` wrap always keep the box; built-in-frame windows still deactivate on outside presses unless `box` is requested. In `region` mode, content that escapes the content box (`position: fixed` children) is clipped to the frame: put menus and tooltips in the top layer (`popover`, `<dialog>.showModal()`) or outside the window, or use `box`. Hosts inside a closed shadow root keep pass-through but never deactivate on outside presses. A consumer `box-shadow` on `::part(window)` keeps working. |
| `data-scriptoscope-theme="…"` | a window OR any ancestor | Per-element theme override (slug or URL). Nearest-ancestor wins. |
| `data-scriptoscope-theme-switcher` | a `<select>` | Runtime theme picker. Selecting an option re-skins every window + control. |
| `data-scriptoscope-button` | a `<button>` | Themed push button. Native button stays underneath (form/keyboard/a11y preserved). |
| `data-scriptoscope-default` | a `<button data-scriptoscope-button>` | Adds the "OK ring" (the period-correct default-button outline). |
| `data-scriptoscope-disabled` | a `<button data-scriptoscope-button>` | Disabled state — flatten + grey. |
| `data-scriptoscope-control` | `<input type=checkbox\|radio\|range>` or `<select>` | **Auto-applied** to every matching input — themed chrome over the native control. Opt out per-input with `data-scriptoscope-control="off"`. |
| `data-scriptoscope-field` | `<input type=text\|email\|password\|…>` or `<textarea>` | Mac OS 8 sunken-bevel chrome over a native text input. Opt-in (consumer CSS can conflict). |
| `data-scriptoscope-tabs` | a `<div>` containing `data-scriptoscope-tab` buttons + `data-scriptoscope-panel` siblings | Tab strip. Pressing a tab selects it and shows its panel; Arrow keys move and select (wrapping), Home/End jump; ARIA + roving tabindex wired. |
| `data-scriptoscope-tab="<panel-id>"` | a `<button>` inside `data-scriptoscope-tabs` | One tab. Value references the panel id. |
| `data-scriptoscope-panel="<id>"` | a `<div>` inside `data-scriptoscope-tabs` | A panel. Hidden unless its id matches the selected tab. |
| `data-scriptoscope-selected` | a `<button data-scriptoscope-tab>` | Initial selected tab. Default: first tab. |
| `data-scriptoscope-window-id="…"` | a window | Stable identity for layout persistence (see `persistKey` below). Without it, DOM ordinal is used. |
| `data-scriptoscope-theme-picker` | a `<div>` | Promote into a folder-strip theme switcher. The runtime auto-populates one tile per entry in `mountOptions.themes` (icon + name + author/year). Full ARIA tab pattern + keyboard nav; clicking a tile calls `handle.retheme(slug)` internally. |
| `data-scriptoscope-cascade` | a container `<div>` | Mac-OS-classic "newly-opened windows cascade" layout for the descendant `data-scriptoscope-window` elements. Each window flips to `position: absolute` at a cumulative offset from the container's top-left; later windows sit on top in z-order. Defaults: 32px right + 28px down per window. Override via `data-scriptoscope-cascade-step-x="N"` / `-step-y="N"` / `-base-x="N"` / `-base-y="N"` on the same container. Per-window `data-scriptoscope-x` / `-y` always wins; cascade skips windows that have either. One-shot at mount; after drag or resize, the window owns its position. The consumer-friendly answer to "I want a bunch of windows to scatter like a real desktop without hand-writing position math." |
| `data-scriptoscope-icon="<name>"` | `<img>` or `<span>` | Render a scheme-resolved Finder icon by named key (`folder`, `system-folder`, `document`, `prefs`, etc.). Re-resolves on every retheme so the icon follows the active scheme. |
| `data-scriptoscope-icon-id="<id>"` | `<img>` or `<span>` | Raw Apple resource id (e.g. `-3999`) — bypasses the named-key lookup for power users. |

For what each window and control does once promoted (pointer, keyboard and touch behaviour, and every event you can listen for), see the **[interaction reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md)**.

## Explicit page host options

```ts
await mountExplicitPage({
  themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes', // where bundles live
  pageThemeDefault: '1138',         // theme slug or URL for windows w/o explicit data-scriptoscope-theme
  persistKey: 'my-app-layout',      // optional: save window positions to localStorage.scriptoscope:layout:<key>
  baseSlug: 'apple-platinum-2',     // optional: base scheme to inherit from (any slug in your themeBaseUrl)
  hit: 'box',                       // optional: page-wide frame hit mode, 'region' (default) or 'box' (#597)
  root: document.body,              // optional: application-owned source-selection boundary
  themes: THEMES,                   // optional: catalog for <div data-scriptoscope-theme-picker> tiles + autoCycle.
                                    //   ThemeEntry[] — { slug, name?, author?, year?, source?, meta? }. Imported from
                                    //   your themes-manifest.json or hand-built. (Pre-2026-05 manifests used a
                                    //   combined `label` field; still accepted as a fallback if `name` is absent.)
  autoCycle: 4000,                  // optional: ms between picker auto-cycle steps (suppressed when
                                    //   syncToUrlParam restored a deep-link or first user interaction fired).
  syncToUrlParam: 'theme',          // optional: mirror current theme to ?theme=<slug>; restored on load.
                                    //   Makes the landing the shareable URL.
  rejectOnEmptyMount: true,         // optional: throw PagePromotionError if selected sources exist but
                                    //   ZERO promoted (catches theme-bundle 404s + decoder errors in one place).
  onPromoteError: detail => {…},// optional: hook per-target promotion failures (vs the rejectOnEmpty above).
  bootAffordance: 'auto',           // optional: chrome wipe-in animation + boot-state CSS hook
                                    //   (data-scriptoscope-loading on the root + .scriptoscope-ready class
                                    //   on the root once promotion and the wipe-in finish, so the class
                                    //   means "clickable"). 'auto' (default) picks per
                                    //   element; 'none' (alias false) suppresses entirely. Respects
                                    //   prefers-reduced-motion automatically.
});
```

This is a public example helper, not a package runtime mount export. The call
returns an `EventTarget` handle after selected promotions, scrollbar refreshes and
the boot wipe-in settle. A wipe-in that stops advancing (a hidden tab, an off-screen
iframe) is finished at once when the page is or becomes hidden, and otherwise once
the wait for it has lasted 360 ms. Boot load errors reject; with `rejectOnEmptyMount`, an all-failed boot
rejects with `PagePromotionError` and its `failures`. Partial target errors call
`onPromoteError(detail)`, bubble `scriptoscope:promoteError`, and remain available
in `handle.failures`; other sources remain usable. Retheme load errors reject and
retain previous faces. Superseded work cannot publish a completion event.

The handle API:

```ts
const handle = await mountExplicitPage({…});
await handle.attach({controls: [newInput]});
handle.detach({controls: [newInput]});
await handle.whenReady(); // latest requested explicit work

// Event API — four events on the handle
handle.addEventListener('ready', (e) => { /* initial selected sources complete; e.detail.stats has counts */ });
handle.addEventListener('retheme', (e) => { /* theme just switched; e.detail.ref is the slug or URL */ });
handle.addEventListener('promoteError', (e) => { /* a promotion failed; e.detail = { kind, el, cause } */ });
handle.addEventListener('unmounted', () => { /* disconnect() finished */ });

// On the runtime-inserted HOST element (the original consumer element is removed
// at promote time — its children move into the host's slot). The event bubbles
// UP from the host, so listen on a stable ancestor of the source element's
// original position (document, document.body, your app root). Do NOT cache a
// ref to the original element and listen on it — it's detached by the time
// this fires.
document.body.addEventListener('scriptoscope:promoted', (e) => { /* e.detail = { kind: 'window', host } */ });

// On the runtime-inserted HOST element: bubbling + composed CustomEvents that cross
// the shadow boundary into your consumer wraps (modal overlays, etc.). Same listener
// rule as scriptoscope:promoted — listen on an ancestor, not the original element.
document.body.addEventListener('scriptoscope:close', (e) => { /* the window is being unmounted (close widget or a direct ScriptoscopeWindow.unmount()); fires before the bare HTML is restored. Not fired by handle.disconnect() */ });
document.body.addEventListener('scriptoscope:userresize', (e) => { /* user finished grow-box drag; e.detail = { w, h } */ });

// On the ORIGINAL consumer element (or any ancestor): a per-target failure event
// when promotion throws. Bubbles. Same shape as the handle's 'promoteError'.
document.body.addEventListener('scriptoscope:promoteError', (e) => { /* e.detail = { kind, el, cause } */ });

// Methods
handle.disconnect();                       // abort selected source lifetimes + restore windows and native form controls
handle.retheme(slugOrUrl);                 // programmatic theme switch ('retheme' after current request succeeds)
handle.registerTheme(ref, loadedTheme);    // register a runtime-decoded theme (used by drop-zones)
handle.openModal(wrap, { returnFocusTo }); // themed modal helper: focus trap (including shadow-DOM chrome
                                           //   focusables), Esc, backdrop-click, listens for the inner
                                           //   window's scriptoscope:close. Toggles `data-scriptoscope-modal-open`
                                           //   on the wrap; your CSS scopes visibility off that attribute.
                                           //   Returns { close() }. Idempotent on the same wrap.

// Properties
handle.stats;  // { windows, buttons, controls, tabs, fields } — five numeric counts updated on each promote
```

Overlapping `handle.retheme(ref)` calls use the latest **request**, even if that
request fails. Superseded or disconnected requests settle without a completion
event; a current load/window-preparation failure rejects. Window chrome prepares
as a batch before it commits, so such a failure leaves existing windows intact.
The completed theme URL/default and picker selection advance only on success.
Controls replace after the window batch; this is not a rollback transaction for
the entire desktop. Explicit attach calls wait for the current request to settle;
`whenReady()` includes their promotion and post-attachment scrollbar work.

`disconnect()` releases themes loaded internally by that mount and their decoded
raster caches. Pending loads release their assets when they finish. Themes passed
to `registerTheme`, including their base chains, are borrowed: the caller owns
their lifetime and calls `theme.dispose?.()` after their last consumer unmounts.
Standalone `createThemeResolver()` users should call `resolver.dispose()` at the
same point; disposed resolvers reject loads and registrations.

Teardown restores mounted windows and promoted buttons, checkbox, radio, range
and select controls. Their live values, checked state, selection and form association survive;
only runtime-owned visibility, focus/ARIA attributes, label styles and select
wrappers are restored. Replacement-face listeners, active slider drags, pending
paints and mount-owned theme-switcher listeners are released. Unrelated consumer
attribute/style changes are preserved. Pending preparation cannot insert a form
face after disconnect or move a removed/reparented source back.

Promoted ranges retain the original input as their sole keyboard and accessibility
control. Native bounds, fractional steps, `step="any"`, labels, disabled fieldsets
and keyboard event timing remain browser-owned. The themed canvas handles pointer
position; the native input sanitizes each value. The pointer adapter dispatches synthetic
`input` when it changes and `change` when a drag commits a changed value. The optional stylesheet paints native
focus on the visible canvas. Live constraint/disabled attributes and form reset
refresh the art; after assigning `.value` in script, dispatch `input` or `change`
to refresh it immediately. A bare property assignment is sampled on the next
interaction, persisted pageshow or retheme. The imperative `interactiveSlider`
API still uses normalized values and its existing keyboard/callback behavior.
Promoted native ranges use the thumb geometry from the composition that drew the
canvas: stationary grabs preserve exact values, dragging retains the grab offset,
and track clicks center the thumb under the pointer before native sanitization.
The imperative slider and scrollbar pointer contracts remain unchanged.

Button teardown removes every mount-owned face and its click/keyboard listeners,
restores the original element's display (including priority) and promotion stamp,
and returns owned focus after enclosing window content is restored. Native form
actions and consumer listeners remain attached to the same source element. Button
disabled/default state is sampled on promotion and retheme; this does not add live
button-attribute observation. Tab and text-field decoration restoration remains
outside this contract. Latest-request theme ordering and its window-batch scope
are described in the [runtime ownership spec](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/compositor-spec.md#runtime-theme-request-ownership).

The `promoteError` event is the per-target failure hook; pair with `rejectOnEmptyMount: true` for the "did everything fail" gate.

## CSS classes (fallback if `data-scriptoscope-*` isn't an option)

For environments that strip data attributes (some CMSes, some CSP setups), use the class equivalents: `.scriptoscope-window-fallback`, `.scriptoscope-button-fallback` — the example host can select both during its initial capture. The data-attribute path is preferred.

## Theme switching at runtime

```html
<select data-scriptoscope-theme-switcher>
  <option value="1138">1138</option>
  <option value="beos-r503">BeOS R5</option>
  <option value="crayon-os">Crayon OS</option>
  <option value="https://example.com/themes/your-own/">A theme from somewhere else</option>
</select>
```

Selecting an option fires the existing `retheme()` flow; every promoted window flips chrome live.

## Bring your own theme — drop a `.sit` / `.rsrc` and see it render

Two ways to wire it. The simpler one is a button or any element that doubles as a drop target:

```html
<link rel="stylesheet" href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
<article data-scriptoscope-window data-scriptoscope-title="Your page">
  <p>Pick a scheme to change this window.</p>
</article>
<button id="pick-theme" type="button">Pick or drop a Kaleidoscope theme</button>
<p id="theme-status" role="status"></p>
<script type="module">
  import {
    attachThemeDropZone, loadOwnedKaleidoscopeScheme,
  } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';
  import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
  const handle = await mountExplicitPage({
    themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
    pageThemeDefault: '1138',
  });
  const themes = new Set();
  let active = true;
  let generation = 0;
  const drop = attachThemeDropZone(document.getElementById('pick-theme'), {
    onFile: async file => {
      const token = ++generation;
      const status = document.getElementById('theme-status');
      status.textContent = `Decoding ${file.name}…`;
      try {
        const theme = await loadOwnedKaleidoscopeScheme(file, { source: file.name });
        if (!active || token !== generation) { theme.dispose(); return; }
        themes.add(theme);
        handle.registerTheme('my-scheme', theme);
        await handle.retheme('my-scheme');
        if (active && token === generation) status.textContent = `Loaded ${file.name}`;
      } catch (error) {
        if (active && token === generation) status.textContent = `Could not load this scheme: ${error.message}`;
      }
    },
  });
  addEventListener('pagehide', () => {
    active = false; ++generation; drop.detach(); handle.disconnect();
    for (const theme of themes) theme.dispose();
  }, { once: true });
</script>
```

That's the full BYO path. `loadKaleidoscopeScheme` accepts every container the [Mac Themes Garden](https://macthemes.garden/) and [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/) archives ship (`.sit`, `.hqx`, `.bin`, AppleSingle/Double, raw `.rsrc`); the decode runs entirely client-side via the bundled StuffIt WASM. The dropped theme persists for the session; reload restores the default.

**The richer pattern** (used by the demo's "Load your own" picker tile) opens a themed `movable-modal` window with the drop zone inside it. Use `handle.openModal(wrap, { returnFocusTo: triggerButton })` — the helper toggles `data-scriptoscope-modal-open` on the wrap (your CSS scopes off the attribute), traps focus inside (including the shadow-DOM chrome focusables), dismisses on Esc + backdrop click, and listens for the chrome's close widget via `scriptoscope:close`. The full markup is in [`demo/showcase.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/showcase.html) (search for `powers-byo-modal-wrap`): a `position: fixed` wrap with `visibility: hidden; opacity: 0; pointer-events: none` until `[data-scriptoscope-modal-open]` flips them on, with a themed `<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal">` inside.

## CDN paths reference

| URL | What |
|---|---|
| `https://khawkins98.github.io/scriptoscope/scriptoscope.js` | Runtime ESM entry; imports a sibling lazy decoder chunk for `.sit` sources |
| `https://khawkins98.github.io/scriptoscope/scriptoscope.css` | Optional outer-shell stylesheet |
| `https://khawkins98.github.io/scriptoscope/themes/<slug>/scheme.sit` (or `scheme.rsrc`) | The bundle's source archive — fetched + decoded client-side by `loadTheme()` |
| `https://khawkins98.github.io/scriptoscope/themes-manifest.json` | Catalog of every bundled slug (label, author, source filename, ref screenshot) |
| `https://khawkins98.github.io/scriptoscope/theme-loader/loadKaleidoscopeScheme.js` | Standalone decoder ESM: the public `loadKaleidoscopeScheme` wrapper (engine `cinf` and icon-blit cicn ids on by default, so themed sliders draw and icon blits get their companions; pass `engineCinfIds: []` / `iconBlitCicnIds: []` to opt out) bundled with the conversion core. Same function `scriptoscope.js` exports; use it when you want the decoder without the runtime. `theme-loader/index.js` re-exports it. Lazily imports `../sit-wasm/index.mjs` for `.sit` input |
| `https://khawkins98.github.io/scriptoscope/sit-wasm/dist/munbox.wasm` | Standalone decoder WASM; the bundled runtime embeds its WASM in the lazy JavaScript chunk |

The hosted URLs track the project's `main` deployment. To control when your
runtime updates, use npm with a committed lockfile and your own deployment, or
vendor the files from a chosen commit as described below.

## Vendoring (if you don't want a third-party CDN dependency)

If you want to host the no-build starter yourself, copy a chosen build rather
than importing the GitHub Pages URLs:

1. Build a chosen commit with `npm run build:demo`. Copy every top-level `dist/*.js` file, `dist/scriptoscope.css`, `dist/demo/explicit-host.mjs`, `dist/demo/explicit-layout.mjs`, and the theme bundles you use from `dist/demo/themes/`, retaining their metadata and provenance. Keep the JavaScript and helper files beside each other so relative imports resolve. If importing the standalone decoder for a drop zone, also copy `dist/demo/theme-loader/` and `dist/demo/sit-wasm/` beside them; `dist/demo/theme-loader/loadKaleidoscopeScheme.js` there is the built public wrapper (engine `cinf` ids on by default), not the raw `tools/theme-loader/` file, which leaves them off and hands every slider to the Platinum fallback.
2. Host them alongside your site, retaining `LICENSE` and `THIRD_PARTY_NOTICES`
   with the runtime files.
3. Change the starter's stylesheet URL to your local `./scriptoscope.css`, import
   `mountExplicitPage` from `./explicit-host.mjs`, and set `themeBaseUrl` to your
   local `./themes`. Adjust those paths if you host the files in a subdirectory.

The page still loads an ESM module from a URL; it does not need npm or a bundler
to run. Building the vendored files is a maintainer/setup step.

