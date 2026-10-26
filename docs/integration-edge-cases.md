# Integration edge cases

This is the long-form companion to the README's quick-start. It exists for the times when you've dropped the script tag in, tagged some HTML, and something is slightly off — odd geometry, your CSS isn't reaching where you expect, a window grew when you didn't want it to. Each section here documents a real behaviour the runtime has and how to work with (or around) it.

If you only want to drop Scriptoscope onto a static HTML page and not touch it again, you probably don't need this doc. The defaults are tuned for the common case.

**Contents**
- [Mobile + responsive](#mobile--responsive)
- [Content Security Policy](#content-security-policy)
- [Controlling which widgets do something: `data-scriptoscope-widgets`](#controlling-which-widgets-do-something-data-scriptoscope-widgets)
- [Cascade layout: `data-scriptoscope-cascade`](#cascade-layout-data-scriptoscope-cascade)
- [How positioning works](#how-positioning-works-posture-b-2026-05-31)
- [Auto-resize: content growing after promote](#auto-resize-content-growing-after-promote)
- [Class inheritance and the locked-down properties](#class-inheritance-and-the-locked-down-properties)
- [Common pitfall — don't change child layout after mount-class flips](#common-pitfall--dont-change-child-layout-after-mount-class-flips)
- [Shadow DOM — what's reachable from your CSS, what isn't](#shadow-dom--whats-reachable-from-your-css-what-isnt)
- [Promotion is destructive](#promotion-is-destructive--your-original-element-is-moved--removed)
- [Known incompatibilities](#known-incompatibilities)
- [Internal stamps — don't set these yourself](#internal-stamps--dont-set-these-yourself)
- [Framework integration notes](#framework-integration-notes)

## Mobile + responsive

Scriptoscope is **desktop windowing**. Classic Mac chrome assumes pointer + keyboard, multi-pixel-per-rem displays, and viewports wider than ~600px. There's no first-class touch redesign — what you get on a phone:

- Drag still works via pointer events (touch fires `pointerdown`).
- The chrome canvas is `image-rendering: pixelated`; on high-DPR displays the integer-upscale looks clean.
- Window-types sized larger than the viewport overflow horizontally. There's no auto-shrink mode.

**Choose a responsive layout or skip mounting below your breakpoint.** Consumer grids should allow tracks to shrink (`minmax(0, 1fr)` and `min-width: 0`) and reserve space for cascade offsets before promotion measures their content. Fixed-art chrome still has a minimum useful width, so test your selected themes at the narrowest supported viewport. If your layout cannot fit, conditional mounting keeps the bare HTML available. The chrome canvas and interactive overlays share a shadow root; hiding only the canvas leaves invisible click targets.

```js
// Conditional mount — the cleanest pattern.
if (!window.matchMedia('(max-width: 600px)').matches) {
  await mountDeclarative({ /* ... */ });
}
// Bare HTML renders untouched below the breakpoint.
```

If you want chrome to appear/disappear on viewport changes (rotate to landscape, browser resize), wire a `matchMedia` change listener that calls `handle.disconnect()` or re-mounts:

```js
const mq = window.matchMedia('(min-width: 600px)');
let handle;
const sync = async () => {
  if (mq.matches && !handle) handle = await mountDeclarative({ /* ... */ });
  else if (!mq.matches && handle) { handle.disconnect(); handle = undefined; }
};
mq.addEventListener('change', sync);
sync();
```

### ⚠️ The CSS-only fallback is a footgun. Use the JS conditional-mount above.

A CSS-only "hide chrome below the breakpoint" approach exists but has an asymmetry you'll regret in production. Here's why and what NOT to do:

```css
/* DO NOT DO THIS — leaves desktop-resize-down users with NO content */
@media (max-width: 600px) {
  [data-scriptoscope-promoted] { display: none; }
}
```

The asymmetry: when promotion happens, the runtime MOVES your consumer content from the source element's children INTO the promoted host's slot, then removes the source element. So:

  - **User loads on mobile**: viewport < 600px → if you used the conditional-mount JS pattern above, `mountDeclarative` doesn't run → bare HTML stays visible. ✅ Fine.
  - **User loads on desktop, resizes to mobile**: promotion already ran → consumer content lives INSIDE the promoted hosts → CSS hides the hosts → **content disappears entirely**. ❌ Broken.

The CSS-only fallback only works if you ship a duplicate mobile-only DOM tree:

```html
<!-- Parallel DOM trees, one shown per breakpoint. Heavyweight + duplicates content -->
<article data-scriptoscope-window>…desktop tree…</article>
<aside class="my-mobile-fallback">…parallel mobile tree…</aside>
```

```css
@media (max-width: 600px) {
  [data-scriptoscope-promoted] { display: none; }
  .my-mobile-fallback { display: block; }
}
@media (min-width: 601px) { .my-mobile-fallback { display: none; } }
```

If you don't want a parallel DOM tree (you usually don't): **use the JS conditional-mount pattern with the matchMedia change-listener above**. It handles resize-across-breakpoint cleanly by calling `handle.disconnect()` (which restores your original source elements into the DOM) before the CSS would have hidden them. That's the only path that works for both initial-load AND resize directions without content loss.

The library does not itself listen for viewport changes — that's intentionally consumer-controlled.

## Content Security Policy

The runtime touches a few CSP-restricted features:

- **WebAssembly** for the `.sit` decoder (`tools/sit-wasm/`). Required if the consumer's themes ship as `scheme.sit`. Needs `script-src 'wasm-unsafe-eval'` in strict CSP.
- **`blob:` URLs** for decoded chrome / pattern assets (`tools/theme-loader/loadKaleidoscopeScheme.js`). The runtime creates `URL.createObjectURL(blob)` and references those URLs from `<canvas>` draws and `<img>` swaps. Needs `blob:` in `img-src` and `connect-src` (or relaxed `default-src`).
- **`data:` images** for small folder-only theme-picker previews and the placeholder icon. Keep `data:` in `img-src`; preview images remain self-contained when the picker retains its tiles in bare-HTML mode.
- **Inline-style writes** (`el.style.x = ...` throughout the codebase). These use the IDL setter, which CSP3 allows even under strict `style-src 'self'`. Older CSP-level-2 enforcement may complain about the resulting baked-in `style="..."` HTML; the impact is cosmetic (the styles still apply via the setter).

Recommended CSP header for a site using Scriptoscope:

```
script-src 'self' https://khawkins98.github.io 'wasm-unsafe-eval';
style-src  'self' https://khawkins98.github.io;
img-src    'self' https://khawkins98.github.io blob: data:;
connect-src 'self' https://khawkins98.github.io blob:;
```

**Strict-CSP escape hatch**: if you can't allow `wasm-unsafe-eval`, ship your themes as `scheme.rsrc` (the raw resource fork) instead of `scheme.sit`. The `.rsrc` path skips the WASM decoder entirely. Pass `{ source: 'scheme.rsrc' }` to `loadTheme` (or set the catalog entry's `source`) to select it directly. Bundled themes generally ship one source format; a raw-fork alternative is not guaranteed. Without a source hint, the runtime tries `.sit` first and then `.rsrc`.

## Controlling which widgets do something: `data-scriptoscope-widgets`

The chrome paints whatever widgets a scheme's cicn defines for the window-type — close, zoom, collapse. By default every painted widget is wired (clicking close dismisses, clicking zoom grows-to-fit, clicking collapse window-shades). To leave a widget *painted but inert*, opt into the subset:

```html
<article data-scriptoscope-window
         data-scriptoscope-window-type="document-window"
         data-scriptoscope-widgets="zoom,collapse">
  Read Me content. The close widget paints (cicn art preserved) but the click does nothing.
</article>
```

Semantics:
- **Attribute absent** (default): every widget the type supports is wired.
- **`widgets="zoom,collapse"`**: only the listed widgets are wired; the others paint but are inert.
- **`widgets=""`** (empty): every painted widget is inert. Useful for non-dismissible picker palettes whose scheme happens to paint a close box.

The demo uses `document-window` + `widgets="zoom,collapse"` for both the Read Me and the Schemes Folder picker — they're page-essential content, not dismissible.

When close IS wired, clicking it dismisses the window — the runtime restores your original bare HTML in place. Event listeners on children (picker tiles, buttons) survive the unmount, so a "closed" window's interactive children keep working as plain HTML.

**Detecting close from JS:** listen for the bubbling `scriptoscope:close` CustomEvent on the host (or any ancestor — it bubbles + is composed, so consumer wraps outside the shadow tree catch it too):

```js
host.addEventListener('scriptoscope:close', () => {
  // Runtime is about to teardown + restore bare HTML.
});
```

> Earlier guidance (pre-2026-05-31) suggested picking `movable-modal` as the "no close widget" type. That was a workaround; the widgets attribute is the right primitive. Some schemes paint close on movable-modal anyway — `widgets=""` is the unambiguous opt-out.

## Cascade layout: `data-scriptoscope-cascade`

If you want a group of windows to scatter like real Mac OS windows (each one offset from the previous, later ones on top), add `data-scriptoscope-cascade` to a container. The runtime walks the descendant `data-scriptoscope-window` elements in DOM order and positions each absolutely at a cumulative offset.

```html
<div data-scriptoscope-cascade
     data-scriptoscope-cascade-step-x="24"
     data-scriptoscope-cascade-step-y="20">
  <article data-scriptoscope-window data-scriptoscope-title="Window 1">…</article>
  <article data-scriptoscope-window data-scriptoscope-title="Window 2">…</article>
  <article data-scriptoscope-window data-scriptoscope-title="Window 3">…</article>
</div>
```

Defaults: `step-x="32"`, `step-y="28"` (matches the period Mac OS "new window stagger"). The base offset (the first window's position inside the container) defaults to `(0, 0)`; override via `-base-x` / `-base-y`.

Precedence:
- Per-window `data-scriptoscope-x` / `-y` always wins. Cascade skips any window that declared either coordinate explicitly.
- Cascade is one-shot at mount time. After the user drags or grow-box-resizes a window, that window owns its position; subsequent scans don't re-cascade it (stamped via the internal `data-scriptoscope-cascaded` marker).
- Nested cascade containers cascade independently. Each container iterates its own descendant windows.

The container is set to `position: relative` (only if it wasn't already positioned) so the absolute children resolve against it, and gets a `min-height` reserving the cascade's vertical span so siblings below don't overlap. The library answer to "scatter a bunch of windows without writing per-window position math."

## How positioning works (Posture B, 2026-05-31)

Two postures, decided by whether you set `data-scriptoscope-x` or `data-scriptoscope-y`:

- **In-flow (default).** No `-x`/`-y` → the host is created as `position: static` and sits exactly where your source element sat in the DOM. Grid cells, flex children, normal flow, everything works because the browser's own layout engine places it. Siblings push down naturally — the runtime doesn't pin ancestor heights or cascade-shift. Inline `position` is cleared, so your own `.my-class { position: relative }` for stacking contexts is respected.
- **Absolute (opt-in via `-x`/`-y`).** Either coordinate present → host flips to `position: absolute` resolved against the nearest positioned ancestor. Use for desktop scatters, overlays, palettes. The `cascade` fallback (`24+26·n`, `24+26·n`) applies only when the source element has no bounding rect (e.g. `display: none` at promotion time). Coordinates must be in **px**; percentages / em / vh aren't parsed.

Chrome preparation is asynchronous, but the original content stays connected and
readable until the prepared host is ready. The runtime moves the same child nodes
and replaces the source element in one synchronous commit, preserving listeners
and the focused descendant without scrolling. If preparation or initial content
fitting fails, it restores the original element and clears the promotion stamp so
it can be retried. Removing or reparenting the source during preparation cancels
that promotion; the runtime does not move it back. Disconnect also cancels pending
window preparation, so a late completion cannot attach chrome after teardown or
interfere with a newer mount. The final frame dimensions can still change the page layout;
this avoids an intermediate empty source element, not every possible layout shift.

Width/height inherit from the source element's bounding rect either way. The drag handler converts a static host to absolute on the first drag, keyboard-arrow move, or grow-box resize. When the handoff happens, the runtime inserts an invisible `<div data-scriptoscope-placeholder>` in the host's original static slot so siblings don't collapse upward — the page stays put while the window floats out. The placeholder persists until the window is unmounted (cleaned up by `WindowManager.remove`). Once converted, the host stays a floater for the rest of its life. Reload restores the in-flow default unless you pass `persistKey` (persisted absolute positions also restore as absolute).

## Auto-resize: content growing after promote

Any window with at least one un-declared dimension (no `data-scriptoscope-width` OR no `-height`) is wired to a shared `ResizeObserver` on its content. If consumer content grows after promote — an async-loaded image, a runtime-populated picker, a framework that paints children in a follow-up tick — the chrome re-fits to the new size automatically. The fit only GROWS past the captured baseline, never shrinks (transient layout collapses don't yank the window smaller).

Auto-fit also terminates the first time the user grow-box-resizes the window. The runtime treats the user-chosen size as authoritative from that point: `WindowManager` fires a bubbling `scriptoscope:userresize` event, and the shared `ResizeObserver` is unobserved for that window. After a user resize, subsequent content growth WILL clip (the slot's `overflow: auto` will scroll the themed Kaleidoscope scrollbar). This is intentional — the alternative is fighting the user's resize gesture with auto-grow.

Past a 30 px / 500 ms growth threshold the runtime emits a one-shot `console.warn` suggesting you pre-declare via `data-scriptoscope-extra-width="N"` / `-extra-height="N"` to skip the visual pop on initial load. **To suppress the warning**: either set the suggested `-extra-*` attribute, or declare absolute `-width`/`-height` (auto-resize is suppressed entirely for declared dimensions).

If you set a px-valued `max-width` / `max-height` on the host via CSS, the auto-resize respects it as a hard cap and the slot scrolls instead. Percentage / em / vh-based caps are ignored (treated as no cap) — if you need a viewport-relative max you'll need to convert to px in JS and re-apply on resize.

## Class inheritance and the locked-down properties

The runtime copies the source element's `id`, classes, ARIA attributes, non-`data-scriptoscope-*` `data-*`, `lang`, `dir`, and `title` onto the host so your selectors keep matching after promotion. Ten layout/decoration properties are then **locked down** via inline styles on the host, overriding any inherited class CSS:

- `display: block` — your `.card { display: grid }` would collapse the host's box and decouple it from the chrome canvas.
- `box-sizing: border-box`
- `padding: 0` — padding pushes the canvas inside the host's box and leaves stripes of host-background showing around the chrome edges.
- `border: 0` — your border was for the bare HTML; the chrome IS the intended frame.
- `background: transparent` — paints under the chrome (invisible if chrome is opaque, ugly if chrome has transparent corners).
- `overflow: visible` — the chrome canvas can extend 2-6 px past the host's CSS box (depends on theme); a consumer `overflow: auto` would clip those edge pixels. The slot inside still has its own `overflow: auto` for content scrolling.
- `margin: 0` — would shift the host away from its source DOM position.
- `transform: none` / `filter: none` / `contain: none` — would silently turn the host into the positioned ancestor for its own absolute descendants (CSS containing-block rule — the same iOS scroll-perf hack pattern that breaks naive `findPositionedAncestor` walks). `contain: layout` / `contain: paint` create a containing block the same way; modern utility CSS frameworks (Material, Tailwind v4) ship `contain` rules.

Consumer styles for color, font, `position` (yes — `position: relative` from your class works), `max-width`/`max-height` (px caps), and custom properties still apply — they're not in the lockdown set. The set grows monotonically as new consumer-CSS bleeds surface; see `LEARNINGS.md` for the history.

**Native scrollbar hidden on slot + theme-picker.** The runtime's themed scrollbar drives `.scriptoscope-slot`'s scrollTop; without hiding the OS-painted native bar, both would appear at once (visible under macOS "always show scrollbars"). The theme-picker strip is similarly hidden — a themed horizontal scrollbar isn't yet shipped, so the demo's right-edge mask gradient signals scrollability. Opt out per-element with `scrollbar-width: auto` in your stylesheet.

After mount, drag + resize update the host's inline `style.left/top/width/height` directly; CSS is the initial state, runtime owns runtime state. Reload restores CSS defaults (unless you pass `persistKey`).

## Common pitfall — don't change child layout after mount-class flips

The runtime captures each window's `getBoundingClientRect()` at scan time. If your CSS reflows / hides / re-displays children based on a "mounted" or "ready" class your boot script adds, AND you add that class before `mountDeclarative()` runs, the runtime captures the **wrong** geometry — windows end up positioned and sized as if the page were already mid-mount.

Bad:
```css
/* This rule changes display when .ready is added → cards stack on top of each other */
.app.ready .card-row { display: block; }
```
```js
container.classList.add('ready');           // ← layout changes here
await mountDeclarative({ root: container }); // ← runtime sees the WRONG geometry
```

Good — scope CSS off the runtime's structural marker `.scriptoscope-slot` (added at promotion) instead of a custom class your code manages:
```css
/* Fires AFTER promotion → measurement already happened */
.scriptoscope-slot .glyph { display: none; }
```

Or: keep custom `.skinned`-style classes for **visual** changes only (filter, mask, border, background). Never let them change `display`, `grid-template`, `max-width`, `padding`, `margin`, or anything that moves siblings.

## Shadow DOM — what's reachable from your CSS, what isn't

Each promoted window's CHROME (the canvas, the scrollbars, the title-bar widgets, the inner `.scriptoscope-window` / `.scriptoscope-content` wrappers) lives inside a **shadow root** attached to the window host. That shadow is opened-mode but isolated from page CSS — selectors like `.scriptoscope-window { box-shadow: ... }` or `canvas { … }` from your stylesheet will **not** reach inside. Your consumer content moved into the slot (`.scriptoscope-slot > .scriptoscope-fit > your children`) stays in the LIGHT DOM, so your normal styling still applies to it.

Practical rules:

- Restyle the **host** (the runtime-created `<div>` mountDeclarative inserted): `.scriptoscope-ready [data-scriptoscope-window] { filter: drop-shadow(…) }`. The host is light-DOM and reachable.
- Restyle your CONTENT (`h3`, `p`, your custom classes): works normally — content's in light DOM.
- Do NOT try to style chrome (canvas, scrollbar art, title bar): the shadow root quarantines them by design (ADR-0001 Decision 2). If you need a chrome tweak, file an issue — the right answer is usually a runtime knob, not consumer CSS.

## Promotion is destructive — your original element is moved + removed

`ScriptoscopeWindow.promote` takes your `<article data-scriptoscope-window>` (or whatever element), moves its CHILDREN into the runtime's slot wrapper, then removes the original element from the DOM. The host is inserted where the original sat. Two consequences:

- Refs to the original element (from your framework's binding, jQuery cache, etc.) are now pointing at a detached node.
- Event listeners on **children** survive (the nodes themselves moved); listeners on the **wrapper element** are lost (that element is gone).

If your framework expects to manage the lifecycle of the wrapper (React owns the DOM, Vue mounts here), promote AFTER the framework has rendered + use the `scriptoscope:promoted` event on `document` to react to the swap.

### Theme ownership on teardown

`handle.disconnect()` restores mounted windows and promoted buttons and checkbox/radio/range/select controls, then releases themes loaded by that mount. It removes the form faces and select wrappers while retaining the same native elements and their current value/checked/selection state. It restores only properties the runtime changed (visibility styles, tabindex, aria-hidden, autocomplete and hidden label styles); consumer naming, form association and unrelated style/attribute edits stay intact. If a consumer has since changed an owned property, that newer value is retained.

A promoted range retains its original native keyboard/AT target; the canvas is
`aria-hidden` and has no tab stop. Native min/max/step, accessible naming and
`:disabled` rules (including the first-legend exemption) stay browser-owned.
Pointer positions use the authored canvas bounds and the native value setter's
step/bounds sanitization. The pointer adapter dispatches synthetic `input` only for changed values;
release dispatches one `change` when the final value differs from the drag start.
Disposal or becoming disabled cancels a drag without a late commit. Keyboard
input/change timing is the browser's own. The optional stylesheet mirrors native
focus onto the adjacent visible canvas.

Constraint attributes, disabled ancestors and form reset refresh the range art.
Script assignments to `.value` should dispatch `input` or `change` to request an
immediate repaint; silent assignments are sampled on later interaction, persisted
pageshow or retheme. No input property descriptors are replaced. These native form
semantics do not change the standalone normalized `interactiveSlider` API.
Promoted range hit testing consumes backing-pixel layout from the same themed or
procedural composition that produced the displayed canvas. A press/release inside
the rendered thumb preserves the exact native value without input/change events,
even when its pixel position was rounded. Dragging retains the grab offset and
uses the available thumb travel; returning to the starting coordinate restores
the exact starting value. The native setter still owns step/bounds sanitization.

Track clicks are a separate policy: center the thumb under the pointer, clamp,
and then anchor any drag to the sanitized value. A visible track with no thumb
art uses its full axis; a thumb with zero travel is inert. Blank stretched wrapper
space outside the actual canvas cannot start interaction. Active drags can leave
the canvas and clamp at endpoints. Geometry and pixels commit together, so stale
asynchronous paints cannot change hit testing. These rules apply only to native
promoted ranges; imperative slider and scrollbar pointer mapping is unchanged.
This establishes rendering/interaction consistency, not original kDEF geometry.

Each form face owns its listeners, slider drag handlers and pending paint work. Retheme disposes the old face after preparing its replacement; disconnect cancels pending form preparation before it can commit. Removed or reparented sources are never pulled back to a captured parent. Mount-owned theme-switcher callbacks and stamps are also removed. You can mount again on the same root immediately.

Buttons retain the same hidden native source and forward native click/form actions. Disconnect removes every owned replacement face and its listeners, restores only the owned display value/priority and promotion stamp, and restores focus after enclosing windows return their content. Ownership is registered before insertion observers can disconnect the mount. Moving a pending source cancels that attempt. A connected source still inside the mount retries under its current parent/theme, at most once per animation frame, until stable or disconnected. Cancellation also stops sequential face/ring/pressed preparation before released mount-owned asset URLs can be requested again. Disabled/default state is sampled on promotion and retheme, without a live button-attribute observer.

This restoration contract does not yet cover tab or text-field decorations. The [runtime ownership spec](spec/compositor-spec.md#runtime-theme-request-ownership) defines latest-request theme ordering and the window-only atomic commit boundary.

`handle.registerTheme(ref, theme)` borrows the supplied theme and its base chain. Keep those assets alive while any consumer uses them, then call their own `dispose?.()` methods when finished. Disconnect never disposes caller-registered graphs. Standalone resolver users call `resolver.dispose()` when finished; subsequent loads and registrations fail.

## Known incompatibilities

Things that work in the lab but bite once integrated:

- **`* { box-sizing: content-box }` global resets** — the WindowManager's width math is based on content-box content sizes. Most CSS frameworks already set `border-box`, which we expect; flipping global box-sizing on `*` for `<div>` or `canvas` will produce windows wider than declared geometry by `padding + border`.
- **`* { transform: translateZ(0) }` iOS scroll-perf hacks** — only matters for windows on the absolute path (those with `data-scriptoscope-x`/`-y` declared, or that have been dragged). `transform` on any element creates a CSS containing block, so `findPositionedAncestor` resolves to a different anchor than the consumer expected. In-flow (default) windows aren't affected — the browser places them via normal flow.
- **`body { overflow: hidden }` from modal libraries** — promoted windows use viewport-coordinate drag handlers. Freezing scroll while drag is in progress means the pointer/window math diverges; release works but the visual lags. Toggle this off while a Scriptoscope window has focus.
- **`position: fixed` on consumer content INSIDE a promoted window** — the inner fixed element now anchors to the window host's transformed ancestor (if any), not the viewport. The runtime doesn't warn; this is a CSS spec edge that breaks consumers' assumptions.
- **Heavy CSS reset on `<button>` and `<input>` (Tailwind preflight, Bootstrap reset)** — generally OK because we set chrome inside the shadow root. The HOST checkbox/select gets the reset normally, which is what you want.

If you hit one of these and the fix isn't obvious, the diagnostic page at `/diagnostic.html` has DOM inspectors that surface the actual measured rects.

## Internal stamps — don't set these yourself

The runtime uses these DOM attributes as re-entrancy guards. Consumers should not set them; SSR / static-render consumers should specifically AVOID emitting them:

- `data-scriptoscope-promoted` (on source windows, buttons, controls — "I've processed this")
- `data-scriptoscope-window-host` (on actual WindowManager hosts, imperative and declarative; optional shell CSS targets the inner frame through `::part(window)` so grid/flex stretching does not stretch its shadow)
- `data-scriptoscope-tabs-promoted`, `data-scriptoscope-field-promoted`, `data-scriptoscope-icon-promoted`, `data-scriptoscope-theme-picker-promoted` (per-kind stamps)
- `data-scriptoscope-switcher-wired` (on `<select data-scriptoscope-theme-switcher>`)
- `data-scriptoscope-current-state="active|inactive"` (on the inner `.scriptoscope-window`, indicates focus state)
- `data-scriptoscope-theme="<slug>"` (on each window host, indicates which theme is painted)
- `data-scriptoscope-placeholder` (a hidden `<div>` inserted in the original static slot when a host converts to absolute via drag/keyboard-move/grow-box-resize; reserves the flow position so siblings don't collapse upward)
- `data-scriptoscope-modal-open` (on a wrap passed to `handle.openModal` — consumer CSS scopes visibility off this attribute; the runtime toggles it)

`SCRIPTOSCOPE_PROMOTED_ATTR` is exported as a constant for SSR setups that need to assert the attribute is absent.

## Dynamically inserted declarative targets

After mount, append a new declared window together with its child controls, or
append supported standalone controls directly. Both the added Element and its
descendants are scanned. Preparation/theme barriers retain later additions in a
scoped queue; an initial Element mount root itself is still not a target.

Later additions inside an existing window host are excluded for both direct and
container-wrapped controls. Before #281, wrapped additions could accidentally
promote because the shadow-DOM chrome was invisible to the ancestry check; this
path is now excluded to enforce the documented ownership boundary. Initial
children moved into a newly promoted window remain supported. Ancestor cascade
containers are not re-laid out by this change. See the
[scanner insertion contract](spec/scanner-insertion.md) for ordering and limits.

## Framework integration notes

- **React**: promote AFTER React's first render — wrap `mountDeclarative` in a `useEffect(() => { mountDeclarative(...) }, [])` that runs once. React's reconciler doesn't know the host's children were moved into a slot; treat the promoted host as managed by Scriptoscope, not React. If you need React state changes to drive content INSIDE a window, render that content normally (React still owns the slot's content) — just don't re-render the wrapper element.
- **Vue / Svelte**: same shape. Mount Scriptoscope in `onMounted` / `onMount`, after the framework's first paint.
- **Astro / 11ty / static-render**: works perfectly — the bare HTML is what the static render produces; the script runs and promotes on client hydrate.
- **Server-rendered HTML with sticky elements**: if your server emits any of the "internal stamps" above (you shouldn't), the scanner skips those elements as already-promoted. Strip them in your render layer.
- **Modal patterns**: if you're building a "click this button → show a themed window in an overlay" flow, use `handle.openModal(wrap, { returnFocusTo: triggerButton })`. It handles focus trap (including shadow-DOM chrome focusables via the `focusin` redirect pattern), Esc, backdrop-click dismissal, and listens for `scriptoscope:close` so the chrome's close widget closes the overlay. Pass `returnFocusTo` explicitly — `document.activeElement` at the moment a mouse click opens the modal is BODY, not the trigger button. The wrap is your `position: fixed` container; the runtime toggles `data-scriptoscope-modal-open` on it, your CSS scopes visibility/opacity/pointer-events off the attribute.

## Owned theme inputs during the transport migration

The additive owned loaders return `OwnedTheme`, whose `source` fields are local
resource paths. Use `await themeImageUrl(theme, ref)` before assigning an image
or CSS background. Do not pass `theme.source` to APIs expecting ready-image
`LoadedTheme`; its missing `baseUrl` deliberately prevents that substitution.
Window/control composition and interactive promotion accept owned inputs. A
`WindowManager<OwnedTheme>` preserves that input in `describe()`; the default
manager and declarative mount retain their existing loaded-theme contract.

Dispose only after unmounting consumers. A child borrows its base, and disposal
does not release that base. Captured sources reject future reads after disposal,
and pending encoders revoke late images. Already returned pixel arrays are
borrowed and must remain immutable. See the [owned API](v2/owned-theme-api.md)
for the supported boundary while feature PR #480 is in progress.
