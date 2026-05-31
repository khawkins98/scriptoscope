# Integration edge cases

This is the long-form companion to the README's quick-start. It exists for the times when you've dropped the script tag in, tagged some HTML, and something is slightly off — odd geometry, your CSS isn't reaching where you expect, a window grew when you didn't want it to. Each section here documents a real behaviour the runtime has and how to work with (or around) it.

If you only want to drop Scriptoscope onto a static HTML page and not touch it again, you probably don't need this doc. The defaults are tuned for the common case.

**Contents**
- [How positioning works](#how-positioning-works-posture-b-2026-05-31)
- [Auto-resize: content growing after promote](#auto-resize-content-growing-after-promote)
- [Class inheritance and the locked-down properties](#class-inheritance-and-the-locked-down-properties)
- [Common pitfall — don't change child layout after mount-class flips](#common-pitfall--dont-change-child-layout-after-mount-class-flips)
- [Shadow DOM — what's reachable from your CSS, what isn't](#shadow-dom--whats-reachable-from-your-css-what-isnt)
- [Promotion is destructive](#promotion-is-destructive--your-original-element-is-moved--removed)
- [Known incompatibilities](#known-incompatibilities)
- [Internal stamps — don't set these yourself](#internal-stamps--dont-set-these-yourself)
- [Framework integration notes](#framework-integration-notes)

## How positioning works (Posture B, 2026-05-31)

Two postures, decided by whether you set `data-scriptoscope-x` or `data-scriptoscope-y`:

- **In-flow (default).** No `-x`/`-y` → the host is created as `position: static` and sits exactly where your source element sat in the DOM. Grid cells, flex children, normal flow, everything works because the browser's own layout engine places it. Siblings push down naturally — the runtime doesn't pin ancestor heights or cascade-shift. Inline `position` is cleared, so your own `.my-class { position: relative }` for stacking contexts is respected.
- **Absolute (opt-in via `-x`/`-y`).** Either coordinate present → host flips to `position: absolute` resolved against the nearest positioned ancestor. Use for desktop scatters, overlays, palettes. The `cascade` fallback (`24+26·n`, `24+26·n`) applies only when the source element has no bounding rect (e.g. `display: none` at promotion time). Coordinates must be in **px**; percentages / em / vh aren't parsed.

Width/height inherit from the source element's bounding rect either way. The drag handler converts a static host to absolute on the first drag / keyboard-arrow move (you can drag an in-flow window and it lifts out of flow at the captured page position); once converted, it stays a floater for the rest of its life. Reload restores the in-flow default unless you pass `persistKey` (persisted absolute positions also restore as absolute).

## Auto-resize: content growing after promote

Any window with at least one un-declared dimension (no `data-scriptoscope-width` OR no `-height`) is wired to a shared `ResizeObserver` on its content. If consumer content grows after promote — an async-loaded image, a runtime-populated picker, a framework that paints children in a follow-up tick — the chrome re-fits to the new size automatically. The fit only GROWS past the captured baseline, never shrinks (transient layout collapses don't yank the window smaller).

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

- `data-scriptoscope-promoted` (on windows, buttons, controls — "I've processed this")
- `data-scriptoscope-tabs-promoted`, `data-scriptoscope-field-promoted`, `data-scriptoscope-icon-promoted`, `data-scriptoscope-theme-picker-promoted` (per-kind stamps)
- `data-scriptoscope-switcher-wired` (on `<select data-scriptoscope-theme-switcher>`)
- `data-scriptoscope-current-state="active|inactive"` (on the inner `.scriptoscope-window`, indicates focus state)
- `data-scriptoscope-theme="<slug>"` (on each window host, indicates which theme is painted)

`SCRIPTOSCOPE_PROMOTED_ATTR` is exported as a constant for SSR setups that need to assert the attribute is absent.

## Framework integration notes

- **React**: promote AFTER React's first render — wrap `mountDeclarative` in a `useEffect(() => { mountDeclarative(...) }, [])` that runs once. React's reconciler doesn't know the host's children were moved into a slot; treat the promoted host as managed by Scriptoscope, not React. If you need React state changes to drive content INSIDE a window, render that content normally (React still owns the slot's content) — just don't re-render the wrapper element.
- **Vue / Svelte**: same shape. Mount Scriptoscope in `onMounted` / `onMount`, after the framework's first paint.
- **Astro / 11ty / static-render**: works perfectly — the bare HTML is what the static render produces; the script runs and promotes on client hydrate.
- **Server-rendered HTML with sticky elements**: if your server emits any of the "internal stamps" above (you shouldn't), the scanner skips those elements as already-promoted. Strip them in your render layer.
