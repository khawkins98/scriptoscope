# Changelog

All notable changes to Scriptoscope, in reverse chronological order. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows semver,
with the pre-1.0 caveat that the public API may change without a major bump while the
declarative front door, theme schema, and consumer-facing class names stabilize.

## [Unreleased]

### Added

- `WindowManager.setOuterSize(host, { width?, height? })`, an `outerSize` option on `WindowManager.add`, and `WindowManager.chromeExtent(host)`, for imperative callers that size windows by their outer box. `setContentSize` keeps its content-size meaning.

### Changed

- **Auto-sized windows now fit their chrome inside the element's box** ([#526](https://github.com/khawkins98/scriptoscope/issues/526)). The size measured from the source element, `data-scriptoscope-extra-width/-height` and px `max-width`/`max-height` caps now bound the whole window, frame included. Previously they sized the content area, and the frame (up to 116 px wide on dolphin-som) overhung the element. Full-width windows no longer push the page sideways, and capped cards no longer overlap what follows them. Thick-framed schemes therefore get a smaller content area, and content reflows when a theme switch changes the frame. Declared `data-scriptoscope-width/-height` are unchanged: they are content dimensions, with the frame drawn outside them.
- Every window host's inline `width`/`height` is now pinned to the full chrome size. In-flow hosts wrap the chrome instead of spanning their container, and the drag placeholder matches the window.

### Fixed

- **Dialog and alert bodies use the scheme's dialog colour instead of white.** In real Kaleidoscope 2.3.1, an alert and a themed dialog get their content colour from the scheme's `actb`/`dctb` -14336 (entry 0), or from Kaleidoscope's own copies (`#DDDE`/`#DDDD` grey) when the scheme ships none; document windows stay white. Scriptoscope now fills the `dialog`, `movable-modal`, `alert` and `movable-alert` bodies the same way, and the built-in frame's 3 px gap around a dialog matches the body. For example, apple-platinum-2 and every scheme without the tables get the light grey (`#E3E3E3` under the default display policy), 1984 its dark blue. The body's default text colour is entry 2 of the same table (black, or white on 1984), so for these window types it replaces a `color` set on the host. Override them with `--scriptoscope-dialog-background` and `--scriptoscope-dialog-text`. Slotted content still paints over the fill. Source: Kaleidoscope's PACH 130 GetResource patch (docs/spec/engine/procedural-frame.md §3.6). Found while testing authored schemes in real Kaleidoscope ([#540](https://github.com/khawkins98/scriptoscope/issues/540)).
- The demo's `mountExplicitPage` (`demo/explicit-host.mjs`) now adds
  `.scriptoscope-ready`, removes `data-scriptoscope-loading`, lifts the root's
  boot `inert`, fires `ready` and resolves only after every boot reveal has
  finished ([#565](https://github.com/khawkins98/scriptoscope/issues/565)).
  Before, ready came about 30 ms after the last 180 ms clip-path reveal began,
  and a click on the still-clipped lower part of a window fell through to the
  page behind it. The wait starts after the last boot step and lasts until
  the reveals end, normally under 180 ms and at most 360 ms. So ready arrives
  at most 360 ms after the boot's own work is done. If the reveals aren't
  running, for example in a hidden tab, an off-screen iframe or because
  other code paused them, they are finished at once when the page is or
  becomes hidden, and otherwise once the wait has lasted twice their 180 ms
  duration. A cancelled reveal ends the wait, and reduced motion still plays
  no reveal.
- A press on the grow box that doesn't change the window's size is no longer a resize (#552). Releasing without moving, or after sub-pixel jitter under half a content pixel, used to switch an in-flow window to absolute positioning, insert the drag placeholder, re-render it at a different width and fire `scriptoscope:userresize`, which permanently turned auto-fit off. Like the classic Mac `GrowWindow`, which returns 0 when the size is unchanged, the window now stays in flow and no event fires. The hand-off waits for the first move that changes the size, and a drag released at its starting size commits nothing. A keyboard resize step that is clamped at the minimum size no longer hands off or fires the event either.
- Keyboard focus entering a window now activates it and raises it to the front, as on the classic Mac, where keyboard focus is always in the front window ([#550](https://github.com/khawkins98/scriptoscope/issues/550)). Before, Tab could land on links and chrome controls (title widgets, move handle, grow box, scrollbars) of a background window that a higher window fully covered, so the focused control was invisible (WCAG 2.2 SC 2.4.11). Raising changes z-order only; the window does not move. Focus stays on the control through the activation render.

- Showcase links keep WCAG AA contrast when hovered, pressed and focused. The
  browser's default focus ring put a light halo against 1990's and Evolution's
  light link text (1.3-2.0:1), so focused links now draw a solid 2px ring in
  the link's own colour, 1px clear of the text. That ring reaches 3:1 against
  the window body on every scheme. On the dark-body schemes it is paired
  with a 1px black line so it still shows next to white icon plates. The
  hover and press red is darkened from #cc0000 to #b00000, which raises
  Dolphin SOM's yellow body from 4.11:1 to 5.15:1. The new ring also
  replaces the gold `#b98942` focus ring from `demo/site-shell.css` on the
  four example-card links inside the showcase, which measured 2.75:1 (#548).
- A themed window scrollbar now follows its content when something other than
  the bar scrolls it: focus moving to an off-screen link, `scrollIntoView`,
  find-in-page or a script setting `scrollTop`/`scrollLeft`. The thumb and
  `aria-valuenow` update, and the next arrow key steps from the real position
  instead of jumping the content back to the bar's old value. Both axes (#549).
- Keyboard focus stays on the operated window control (move handle, grow box,
  title widgets, scrollbars) when the window re-renders on activation, collapse
  or keyboard resize; it no longer drops to `<body>`. Re-renders of windows
  that did not hold focus never move it (#525).
- Window overlay controls (title widgets, move handle, grow box, scrollbars)
  are reused across re-renders instead of rebuilt, so a keyboard move or
  resize step no longer makes screen readers re-announce the control. A
  pointer drag or resize of another window moves keyboard focus into that
  window, so the next arrow key no longer moves the previous one (#533).
- Showcase text reaches WCAG AA contrast under 1984, Animals, Floppies and
  Monkey Paradise. Their window bodies are mid-tone (blue, tan, light blue,
  olive green), where the default near-black text, grey credit and hint lines
  and #0000ee links measured 2.0-4.3:1. These four schemes now share one
  mid-tone override, like the dark-body group: black text, labels and
  decorative picker glyphs, navy links (#000080) and a dark visited purple.
  Monkey Paradise's links are black, because no coloured link clears AA on
  its olive speckle, and they stay underlined (#546).
- Showcase text reaches WCAG AA contrast under 1990 and Dolphin SOM. 1990
  paints a dark striped body behind the picker, cards and upload modal, so it
  now shares Evolution's light-text override; the override's link, visited and
  code colours were lightened so they also clear AA on 1990's lightest stripe.
  The picker author line and the upload modal's "Don't have one?" line use a
  darker grey (#333333) that clears AA on Dolphin SOM's yellow and the other
  light and mid-tone bodies except Monkey Paradise's darker green, instead of
  adding per-scheme lines (#539).
- Window title widgets (close, zoom, collapse) are reached by Tab in the order
  they appear on screen: top to bottom, then left to right. They were always
  close, zoom, collapse, which disagreed with the visual order on 9 theme and
  window combinations: the Windows 95 title bars (collapse, zoom, close) and
  the side-titled utility windows of 1990, Dolphin SOM, Evolution,
  Windows 3.1 and Monkey Paradise. A retheme that changes the order keeps the
  same elements and keyboard focus (#537).
- Showcase picker tile labels reach WCAG AA contrast on the evolution and
  monkey-paradise body patterns (#527).
- Showcase text stays readable under Black Platinum. The demo's light-text
  override assumed a dark window body, but Black Platinum paints white document
  and modal bodies, so the picker credit line, the cards and the upload modal
  measured 1.1-1.7:1. The override now covers only Evolution, the scheme with
  a dark body. The upload drop zone keeps its dark label on every scheme (#528).
- Window scrollbar end arrows are no longer covered by the bottom-right resize
  zone, so clicking the down or right arrow scrolls instead of resizing (#524).
  On base this hit the resize button for a single-axis bar on all 13 schemes
  without a grow-box resource. It also hit the button for the horizontal-only
  right arrow on all 5 grow-box schemes (apple-platinum-2, black-platinum,
  platinum-8, slimes, system7-nostalgia-silver). The resize button and both
  scrollbars now share one corner rect. This is a modern compatibility policy,
  not decoded kDEF behaviour: window scrollbars and the resize button are
  Scriptoscope's app-layer overlay, and the scheme resources don't size them.
  **Drawn scrollbar lengths change on every scheme** (unscaled px; double at
  scale 2):
  - Schemes without a grow box: a vertical-only or horizontal-only bar is
    15 px shorter (e.g. windows-95 vertical 140 → 125 on a 200 × 140 content
    area). Bars on a window with both scrollbars are unchanged.
  - Grow-box schemes: vertical-only is 3 px longer (122 → 125), vertical with
    both bars is 18 px longer (107 → 125), and horizontal-only is 15 px
    shorter (200 → 185). The vertical bar now ends at the gripper's top
    instead of leaving a 3 or 18 px gap above it.
  - The resize button shrinks by 1–5 px per axis on several schemes
    (apple-platinum-2 and the other grow-box schemes 24 → 22 square,
    apple-lisa 22 → 17, 1984 22 → 17 wide, beos-r503 22 → 20, windows-31
    22 → 19, windows-95 22 → 21 wide). Other schemes keep their size.
- Procedural Platinum push buttons (`baselineButton`, used by apple-platinum-2,
  platinum-8, black-platinum, slimes and system7-nostalgia-silver, and by any
  scheme without an admitted push face) now show a held state. Pointer, Space
  or Enter sinks the face, and it returns to normal on release, pointer leave
  or cancel, blur and keyup. Normal-state pixels and cicn-themed buttons are
  unchanged. This is an interim compatibility override, not decoded behaviour:
  it reuses the procedural `sunkenFace` palette because the original pressed
  pixels are unresolved (#218) (#551).
- Outer-box sizing follow-ups ([#542](https://github.com/khawkins98/scriptoscope/issues/542)). A collapsed window keeps its outer width bound, so a window that starts collapsed, or is rethemed to a thicker frame while collapsed, no longer widens past its element (513 px in a 400 px column on dolphin-som). Content growth while a window is zoomed now updates the size unzoom returns to, instead of resizing the zoomed window and being discarded on unzoom. The demo's persisted layout (`persistKey`) saves each window's outer width, so a window restored from another tab on a thicker scheme stays inside its column.
- Clicking a window's title bar without moving the pointer now only activates
  the window (#561). It used to switch an in-flow window to absolute
  positioning, insert the drag placeholder and fire `onChange`. Like the
  classic Mac `DragWindow`, the hand-off now waits for the first move that
  changes the position (half a CSS pixel or more), and a drag released where it
  started commits nothing.
- A cancelled window drag or grow-box resize now reverts (#563). Both capture
  the pointer, so a drag keeps tracking outside the window. A `pointercancel`
  or a lost capture puts the window back where it started, removes the resize
  outline and commits nothing, so no `onChange` or `scriptoscope:userresize`
  fires and a later unrelated release no longer moves or resizes the window.
- Window scrollbar clicks now act on the part under the pointer, as the classic
  Control Manager does (#567). Before, any click jumped the content to the
  pointer's fraction of the bar, so the down arrow could scroll most of the
  way to the end. Now an arrow steps one line and the track one page, and
  holding either repeats; a held track stops once the thumb reaches the
  pointer. The held part draws pressed through the engine's existing
  pressed-part state (scrollbar §4.8 part test, parts 20–23), and returns to
  normal on pointer up, pointer cancel or lost pointer capture. Dragging the
  thumb is unchanged. The 24 px line, the page (the client height less one
  line of overlap, the classic application convention), both shared with the
  bar's keys, and the 400 ms / 50 ms repeat are compatibility policy: the
  original left them to the application. PageUp/PageDown on the focused bar
  therefore now move one line less than before. Right and middle clicks no
  longer act on the bar. A press ends on window blur, when the page is hidden,
  and on a move with no button down, so a lost release can't leave a hold
  repeating. Bar steps from keys, arrows and the track now add whole pixels to
  the scroll position. The wheel also moves in whole pixels, carrying each
  event's fraction to the next, so slow trackpad scrolls add up to their sum
  in both directions. This fixes WebKit, where a step could land a pixel
  short (#556).
- A window that is already absolute or fixed but has no inline `left`/`top`
  now moves from where it sits (#569). Placed by consumer CSS (px, % or
  `auto`) or its static position, its first title-bar drag or arrow-key move
  used to start from (0, 0), so it jumped. The move now starts from the used
  `left`/`top`, also inside a scaled ancestor, and a host made absolute or
  fixed by a consumer class no longer gets the in-flow drag placeholder.
- A collapsed document window on the five built-in-frame schemes (apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver) now stays inside its outer width bound while collapsed. It used to keep its last expanded content width, so it overhung a 400 px column by the frame width (413 px collapsed at promote, 410 px collapsed on apple-lisa and rethemed). The built-in frame hides the content box of a collapsed window, so the width now comes from the theme's expanded frame extent; when none is cached yet, one hidden expanded preparation measures it, and the next expand reuses it. A collapsed side utility, whose bar does not follow its content width, keeps its last expanded width as before ([#566](https://github.com/khawkins98/scriptoscope/issues/566)).
- A short auto-sized window no longer grows each time the demo's persisted layout (`persistKey`) restores it ([#558](https://github.com/khawkins98/scriptoscope/issues/558)). The 80 × 40 px minimum is an outer size, for windows measured from their element, but it was also applied to declared `data-scriptoscope-width/-height`, which are content sizes. A 30 px content area saved by the layout came back as 40 px, so the window grew 10 px on every reload and pushed the content below it down. If you declare sizes directly, a declared `data-scriptoscope-width="50"` used to render 80 px of content and now renders 50: declared sizes keep their value, down to 1 px. A reload also restores each window's saved outer width, as the cross-tab restore already did, so reloading under a scheme with a thicker frame keeps the window inside its column.
- The demo's persisted layout (`persistKey`, `demo/explicit-layout.mjs`) no longer loses a drag when the page reloads or navigates within 250 ms of the drop ([#578](https://github.com/khawkins98/scriptoscope/issues/578)). Layout writes are debounced by 250 ms and a pending write was dropped on unload, so the reload restored the previous snapshot: the window came back in flow, or, if the activation re-render had triggered a write partway through a slow drag, at that mid-drag position. The pending write is now flushed on `pagehide`.
- A cancelled drag no longer leaves its mid-drag position in the demo's persisted layout (`persistKey`, `demo/explicit-layout.mjs`) ([#581](https://github.com/khawkins98/scriptoscope/issues/581)). Pressing a background window's frame activates it, and the activation re-render schedules a layout write. If the drag lasted past the 250 ms debounce, that write saved the position the drag loop was still moving, and other tabs moved the window there through the storage event. A normal drop saved again and replaced it, but a cancelled drag commits nothing (#563), so reloads and other tabs kept the mid-drag position. While a window holds a pointer capture the layer now saves the position it had when the capture began, and the end of the capture schedules a fresh write. Pending writes are also flushed when the page becomes hidden, because mobile browsers can discard a background tab without firing `pagehide`.
- Two tabs with the demo's persisted layout (`persistKey`, `demo/explicit-layout.mjs`) no longer move each other's windows back ([#584](https://github.com/khawkins98/scriptoscope/issues/584)). Each tab saved its whole layout, so a write from a tab that had not yet applied another tab's change (its first write after loading, or one already pending when the change arrived) put the older rows back, and the first tab's window jumped to where it had been. A tab now saves only the windows it changed since they last matched storage, keeps every other stored row, and skips the write when nothing differs, so applying the stored layout or another tab's write saves nothing. A tab that finishes loading also applies any write that landed while it loaded, which used to reach no window.
- A disposed `loadTheme` or `loadKaleidoscopeScheme` result no longer renders ([#589](https://github.com/khawkins98/scriptoscope/issues/589)). After `dispose()`, `composeButton`, `renderWindow`, `interactiveButton` and `WindowManager.add` still drew it in Firefox, which keeps serving revoked `blob:` URLs it has already decoded, and in every browser when a custom `assetUrlFactory` returned `data:` URLs. Chromium and WebKit rejected only because the revoked URL failed to decode, with `EncodingError`. These results now carry a lifetime marker with no pixels, so every renderer rejects with `AbortError` before it decodes anything. Copies made with `{ ...theme }` share the marker, because they carry the same `dispose`.
- An inactive window's scroll bars now draw the inactive art ([#594](https://github.com/khawkins98/scriptoscope/issues/594)). The 2.3.1 scroll-bar CDEF picks the track by state (inactive, disabled, normal, pressed; `docs/spec/engine/scrollbar.md` §4.2), but the window manager always asked for the normal or pressed bar, so a background window's bars looked active. They now repaint in place on every activate and deactivate, keeping the same element and ARIA state. A press on an inactive window's scroll bar now activates the window and does nothing else, as a first click in a classic Mac window. It used to scroll the window while leaving it inactive. The procedural fallback bar, used only when a scheme has no track art at the requested state, has no inactive art and draws the same in both states; every corpus scheme ships both tiers.
- Disclosure triangles now draw the scheme's own art for each direction and state ([#595](https://github.com/khawkins98/scriptoscope/issues/595)). `composeDisclosure` looked up a scheme's triangles by name first, and when the names didn't match it drew the pressed down-pointing triangle (`-10102`) for every right-pointing state and the normal down triangle (`-10103`) for every down-pointing state. So Windows 95 drew the same minus box for all six states, and crayon-os, which ships only the two normal triangles, fell back to the Platinum right triangle. It now resolves the signed ids first: right `-10111` normal, `-10110` pressed, `-10112` inactive; down `-10103`, `-10102`, `-10104`, which the corpus's author labels name. A missing pressed or inactive triangle uses the same direction's normal one. This changes 1984, 1990, apple-lisa, crayon-os, dolphin-som, evolution, floppies, windows-31 and windows-95; schemes whose names already matched (1138, animals, beos-r503) and schemes that ship no triangles are unchanged.

## [0.7.0] — 2026-10-29

Pre-launch release from the `v2` integration branch, continuing 0.y.z initial
development from 0.6.0 ([#168](https://github.com/khawkins98/scriptoscope/issues/168)).
`v2` is an internal development branch label, not public release 2.0 or the 1.0
threshold, which #168 still has to define. Applications now own attachment and
lifetime through explicit promotion primitives; see the
[integration and migration guide](docs/v2/integration-release-notes.md) for
installation and compatibility actions. GitHub release only; no npm publication.

### Added

- An integrated capability collection demonstrates live windows, controls and
  keyboard tabs, whole-header results, column helpers, decoded assets and
  reproducible runtime traces across schemes. Procedural menu samples, missing
  theme resources and the absence of a scheme-cursor API are labeled explicitly;
  the coverage map records example and diagnostic gaps.

- Owned decoded-raster loading through `loadOwnedTheme` and
  `loadOwnedKaleidoscopeScheme`, with asynchronous image export and explicit
  disposal (#480). Existing eager `LoadedTheme` loaders remain supported.
- Optional `scriptoscope/renderer` package entry for consumers that already have
  a theme; it shares rendering identities with the full root entry (#489).

### Changed

- **Breaking, merged in #484:** retire `interactiveCheckbox`, `radioGroup` and
  their corresponding option types in favor of native inputs, labels and
  `change` listeners through explicit promotion. Standalone owned-theme consumers
  can mount an empty attached root,
  register a borrowed theme, then append and explicitly attach controls; disconnect
  before replacement. Disconnect does not dispose registered borrowed themes. See the README migration
  example.
- In the same change, retain `interactiveButton` and its options while returning
  a native `type="button"` element. Native activation, focus, disabled fieldsets
  and `.click()` apply; Enter may activate on keydown. Former wrapper/ARIA markup
  and pointerup/keyup callback timing are not guaranteed. Closed selects retain
  native interaction with passive themed art. Low-level composition/raster APIs,
  managed button binding and standalone sliders/scrollbars remain available.
- **Breaking, merged in #491:** remove `mountDeclarative`,
  `mountOwnedDeclarative` and their mount-specific types. Applications now own
  source selection, attachment, theme replacement and teardown. Use public
  promotion/restoration primitives or the separate `mountExplicitPage` example
  helper; detach before source moves/removal and disconnect before root replacement.
  See [explicit host migration](EXPLICIT-HOST-API.md).
- Shared raster execution and redraw preserve native content interaction during
  resize (#493). Prepared header/push paths and title measurement were consolidated
  (#490, #494–#497); procedural frame data follows its existing lazy boundary
  (#501). These are bounded changes, not a whole-application performance claim.
- Custom push allocators must not rely on incidental dimension getter reads
  removed with a no-op scan (#497); see [allocator compatibility](docs/push-allocator-compatibility.md).
- Incidental minifier-generated function/constructor name strings may vary under
  the narrow [generated-name policy](docs/generated-name-compatibility.md) (#507).
  Export identifiers, import paths, identity relationships and explicit errors
  remain protected; no broader metadata-timing retirement is granted.
- Whole-header and list-column composition use typed engine drivers while
  keeping their public signatures and separate rendering contracts. Native
  window/list-view geometry stays distinct from modern column layout and labels;
  the replaced header painters are removed. Input snapshots retain their selected
  owner and prepared display-profile capability across asset decoding.
- Header diagnostics attribute completed writes, and empty clips or fully clear
  sampled bands avoid unused color/companion realization. Profile-chain checks,
  structural validation and real decode failures remain visible. Original fonts,
  resource-manager fallback, device state and sort interaction remain outside
  the supported header contract.
- Segmented tabs use a cited engine driver for full-source end strips, sampled
  bands and separate solid or patterned centers (#378). Pattern phase follows
  the incoming outer tab rectangle; the replaced three-slice fallback and
  tab-body helper are removed. Public selection, label sizing and contrast stay
  explicit modern policies; control-panel fallback artwork remains excluded.
- Unsupported tab metadata, sampling or patterns return null with distinct
  diagnostics instead of drawing the legacy body. Declared no-cinf inputs,
  unknown metadata and missing art remain distinguishable. Older manifests use
  the documented tab-only transport conventions in `docs/spec/engine/tab.md`;
  these declarations do not establish original resource or mask provenance.
  Native typography, device rendering and whole-control fidelity remain unknown.

### Fixed

- Windows inside a `transform: scale()` ancestor follow the pointer when
  dragged and resized, and land in the right place on the first drag (#515, #518).
- The same holds under rotated, skewed or general 2D `matrix()` ancestors,
  including the individual `rotate`/`scale` properties: pointer positions are
  mapped into the containing block's own CSS pixels (#519, #521). 3D transforms
  are flattened to their 2D part; a `rotate` about an axis other than z is ignored.
- Under those ancestors, promotion sizes an unsized window from its layout size
  rather than its tilted screen bounds. Slider, scrollbar-thumb and painted-part
  pointer mapping follow the control's own axis (#522). Managed content ports
  still report transformed geometry as unsupported.
- Story desk windows account for their authored padding before promotion,
  avoiding initial growth and changed wrapping (#516). Runtime behavior is unchanged.
- Demo loading states and reading-page windows are integrated, and window
  dragging uses correct coordinates when the page is scrolled (#510).
- Secondary and auxiliary clicks no longer invoke themed button primary actions
  through the imperative or promoted path; primary clicks, Space and Enter retain
  activation.
- Keep declarative tab panels outside the semantic tab list. The generated strip
  preserves native button identity, keyboard selection and retheme behavior while
  giving assistive technology the correct tab/panel structure.
- Keep visible title-widget buttons reachable when an enlarged WindowManager
  resize target overlaps them, including 1138's template-width side-floating
  utility window (#381). This is a modern web interaction policy; decoded
  original grow-before-widget precedence is unchanged. Ordinary pointer and
  keyboard resize remain available.

### Coverage and remaining limits

- Optional visual contract maintenance (#482, completing #481) adds coverage,
  not runtime behavior or full native fidelity. The Windows 95 titlebar reference
  (#492) adds a bounded original-condition reference, with **zero exact browser
  pixel oracles**; font/provider/metrics and geometry questions remain unresolved.
- PRs #475 (Studio), #483 (bevel experiment) and #500 (header/allocator prototype)
  are closed **unmerged**. They are not delivered features. Later optimization
  audit records do not establish additional runtime savings.
- The release candidate's own required checks and a smoke check of the deployed
  Pages site gate the tag. Earlier branch checks certify only their own revisions.

### Contributor workflow

- Document focused reproduction and spec checks, a small stable team, reviewer
  continuity, provenance preflight, targeted iteration and one final integrated
  validation chain. Required CI and independent evidence/review gates remain.

### Runtime size (0.6.0 → 0.7.0)

`npm run loc:src -- HEAD --base v0.6.0`:

| non-test source | 0.6.0 | 0.7.0 | delta |
|---|---:|---:|---:|
| logic | 17094 | 16081 | −1013 |
| cited engine tables | 2237 | 2329 | +92 |
| total | 19331 | 18410 | −921 |

Removing the declarative mount's scanner, persistence and cascade (#491), the
retired checkbox/radio wrappers (#484) and the replaced header, tab and
`controls.ts` painters outweighs the new drivers, QuickDraw region/tile/transfer
primitives, owned loading and transformed-ancestor mapping.

## [0.6.0] — 2026-10-23

Fifth incremental release from the `v2` integration branch (#459), moving push
buttons, default rings, checkboxes and radios onto decoded engine drivers.
Other families continue to migrate separately; this is not the all-family 1.0
milestone (DECISIONS #8).

### Controls and migration (0.5.0 → 0.6.0)

- Push/default-ring and checkable composition now use the engine through public
  facades. Selection preserves signed resource IDs and the selected owner and
  occurrence. Known absent (`NULL`) resources remain distinct from `UNKNOWN`
  dependencies; selected malformed records reject explicitly instead of silently
  choosing another state or provider. Retired named push aliases and cross-state
  substitutions no longer stand in for missing canonical art. Known art with
  proven absent local `cinf` retains its reviewed modern admission result,
  without implying completed paint.
- Ordinary raw `cinf` lookup consumes the first occurrence of the selected signed
  ID. A valid first record ignores later duplicates, unused defaults and later
  providers. Static `byteProvenance.cinfResourceIndex` identifies the builder pair
  and need not identify the consumed raw metadata occurrence.
- Sampled assets are prepared lazily for eligible operations, with abort and
  released-theme handling, immutable composition snapshots and opt-in diagnostics
  for completed operations. Missing optional sampling proof retains the bounded
  compatibility path; eligible decode errors remain errors. Diagnostics do not
  turn resource admission into proof of completed paint.
- Consumers retain visible labelled native/CSS fallback buttons when themed push
  painting is unavailable. Replacement buttons have neutral `type=button`
  behavior, preserving the original control's activation and form semantics.
  No Theme restores native controls; theme restoration reapplies the theme.
- **Layout changes:** public checkables allocate a nominal **20px single-line
  extent** and retain full transferred source bounds. Accommodate this allocation
  instead of depending on the former glyph/label-sized returned height. Visible
  native fallback adds **2px to ordinary flow** in affected layouts. Both are
  modern compatibility policy, not historical native geometry.
- Explicit public **mode 5** inputs require aligned **1:1** source/destination
  validation. Do not rely on an implicit scaled or misaligned mode 5 transfer.

### Validation and remaining limits

The finite modern public API compatibility cases cover selected resource identity,
malformed rejection, sampled preparation and visible fallback semantics. They do
not establish historical native geometry, provider/cache ordering, fonts,
device/depth behavior or transfer equivalence. The 39 unknown window rows and six
unsupported slider cases remain unchanged; no native ledger status is promoted.

The full ordinary browser suite passed **530 tests**, and pinned Linux verification
passed **36 sheets / 1260 cases**, at clean `12ff5a99826b1c0c6707573317bb9e9640e206fe`.
Independent visual review approved that bounded delta at the same actual head.
The later test-only `5b65c271e5dd316831633ee57acd643ab29b4a67` strengthens sampled
coverage with **64 complete source/static RGBA planes and four explicit no-output
errors** in a separate targeted run and independent review; it is not a rerun of
all 530 tests. Historical failed evidence retains its original scope and identity.
Browser goldens are regression evidence, not original-engine references.

### Runtime size (`npm run loc:src -- HEAD --base v0.5.0`)

Logic grows by 944 lines: bounded migration drivers/facades, resource admission,
preparation, trace and lifetime handling replace the legacy control drawers.
`src/controls.ts` itself loses a net 239 lines; the overall runtime grows rather
than shrinks. Cited engine tables add 90 lines. These release measurements are
separate from the final visual review's measurements at its actual `12ff5a9` head.

| src/ lines (non-test .ts) | v0.5.0 | HEAD | delta |
|---|---:|---:|---:|
| logic (all src except engine tables) | 16150 | 17094 | +944 |
| engine tables (cited data) | 2147 | 2237 | +90 |
| total | 18297 | 19331 | +1034 |

## [0.5.0] — 2026-10-23

Fourth incremental release from the `v2` integration branch (#459,
#460–#466): follow-ups to the existing window, progress and slider paths,
process boundaries, diagnostic links and contributor documentation. `v2`
remains the integration branch between releases (DECISIONS #8). Push buttons and
checkables remain future engine migration work; their specs do not ship those
migrations in this release.

- **Clean-room process boundaries** (#462): isolate independent oracles and verifier material from runtime implementer reading; retain separate spec, implementation and verification ownership.

- **Contributor orientation** (#459, #466): distinguish the current incremental v2 engine from historical renderer resets, route runtime implementers through the safe brief before any source-reference catalogue, and preserve role-specific evidence boundaries.

- **Declared slider resource chain** (#427, #459): the opt-in ordered `cinf` tier now supplies gate, corner and groove metadata together. Every declared provider must be complete before admission; missing declared metadata cannot borrow archive metadata. Ordinary resource resolution remains unchanged.
- **Slider pointer geometry** (#427): imperative sliders use the engine's committed thumb travel, direction, exact-value grab and track-click centering for both ordinary and declared layouts.
- **Breaking slider metadata cleanup** (#427): remove `ChromeElement.sliderLayoutCinf`, `SliderLayout.endpointPolicy`, the decoded slider summary fields and retired slider admission helper exports. Keep the preparation/binding option and generic IDs/data/body views; `sliderLayoutEnvironment` is now only the opaque frozen `{ environmentId, bindingId }` marker. Use engine traces for selected provider provenance.
- **Window titles** (#459): load raw title color samples and draw TX7's shadow before the foreground, preserving the declared substitute-font sizing, clip and alpha-over policies. When no glyph plus ellipsis fits, retain the ellipsis alone. The corpus-wide `window.title-fit` assertion checks that fitting titles stay whole; it does not claim original-font pixel equivalence.
- **Collapsed utility windows** (#423, #459): route the exact collapsed no-title utility type through the built-in frame engine on all five built-in schemes. Collapsing hides caller content and makes it inert and unfocusable while preserving its body slot, identity and value; expanding restores content and focus behavior.
- **Progress follow-ups** (#459): preserve the `progressSetData` flag byte, validate `ProgressIdle` phase inputs and enforce the public draw-path invariant. Correct the FB9 corpus count to 36.
- **Breaking title metadata cleanup** (#459): remove `ComposedChrome.titleFillSrcX` and `titleFillRgb`. Regenerate custom sliced-window manifests to supply `WindowType.titleSamples`; without exact samples, source-backed title colors remain unspecified and the title is suppressed. Built-in procedural titles retain their existing presentation.

- **Breaking inspector cleanup** (#436, #459): remove the deprecated `ThemeProgressModel` type, `ThemeInspector.resourceRoles.progress` and `progressSummary`. Progress rendering remains selected by the engine's `cinf` gate; inspector artwork roles no longer predict the drawing path. Consumers must stop reading the removed metadata.
- **Diagnostic theme links** (#459): honor valid URL hash themes and playground settings on initial load, hash changes and Back/Forward traversal, including rapid switching. The manual visual-baseline command includes independent diagnostic hash checks.

- **Window ledger housekeeping** (#459): the 39 retained-unknown flag, mask and remaining-fill obligations now cite their completed independent review. No status, evidence claim or case closure changes. The routine map points to the current window engine and drawing facade, replacing references to deleted compositor functions.

### Migration and limits (0.4.0 → 0.5.0)

- Stop importing `ThemeProgressModel` and reading
  `ThemeInspector.resourceRoles.progress` or `progressSummary`; these deprecated
  inspector fields are removed, with no replacement model predicting draw paths.
  Progress selection remains with the engine's `cinf` gate.
- Stop reading `ComposedChrome.titleFillSrcX` and `titleFillRgb`. Regenerate custom
  sliced-window manifests with exact `WindowType.titleSamples` from the original
  resources. Without those samples, source-backed title colors are unspecified and
  the title is suppressed; built-in procedural titles keep their presentation.
  Do not infer samples from composed browser output. The shadow draws before the
  foreground, retaining the substitute-font geometry (DECISIONS #13) and browser
  alpha-over policy. These accepted feature cases do not establish original-font,
  native text-transfer or device equivalence; remaining native conditions stay unknown.
- Remove uses of `ChromeElement.sliderLayoutCinf`, decoded slider summary fields,
  `SliderLayout.endpointPolicy` and the retired slider admission helper exports.
  Keep the opt-in preparation/binding option and generic IDs/data/body views.
  `sliderLayoutEnvironment` is only the opaque frozen `{ environmentId, bindingId }`
  marker; use engine traces for selected provider provenance. A declared provider
  must supply gate, corner and groove metadata completely, without borrowing missing
  declared metadata from the archive tier.
- Ordinary imperative sliders now use committed thumb travel and direction, retain
  the exact value when grabbed, and center the thumb on track clicks, matching the
  declared path. This is a pointer geometry correction, not a new slider family.
- Preserve existing golden capture provenance and independent approval: reviewed
  browser goldens establish regression stability only. This release neither
  recaptures goldens nor promotes ledger status, original-reference eligibility or
  all-family fidelity. The 39 window obligations retain their unknown status.

### Runtime size (`npm run loc:src -- HEAD --base v0.4.0`)

| src/ lines (non-test .ts) | v0.4.0 | 0.5.0 | delta |
|---|---:|---:|---:|
| logic (all src except engine tables) | 16112 | 16150 | +38 |
| engine tables (cited data) | 2145 | 2147 | +2 |
| total | 18257 | 18297 | +40 |

Measured with the repository tool against `v0.4.0`. The net logic growth includes
an 86-line typed declared-slider provider adapter accepted in independent #465
review: it routes complete declared metadata through the engine resource chain.
Legacy slider metadata/admission branches and title sampling branches are deleted;
the title, pointer and progress follow-ups account for the remaining changes.
The release metadata update preserves the accepted runtime behavior.

## [0.4.0] — 2026-10-23

Third incremental release from the v2 engine branch (#378). Three more families move onto the decoded Kaleidoscope 2.3.1 engine: the window recipe for the 13 schemes with a `wnd#` recipe, the slider and the progress bar.

- **Window recipe on the v2 engine** (#432, #444). Layout, title, widget remap, draw and hit test follow the decoded kDEF window widgets (`docs/spec/engine/window-widgets.md`), fixing runtime divergences F1–F10. Most `wnd#` windows change slightly; see the migration notes.
  - **Accessibility divergence (DECISIONS #12):** title-bar widgets on inactive windows stay focusable and keyboard-operable, although the original makes them inert.
  - **Font substitution (DECISIONS #13, #453):** the runtime can't draw the original's condensed title face, so titles are sized and truncated to the plate for the font we draw. They also move down when our taller font would clip their tops.
- **Slider on the v2 engine** (CDEF 3; #419, fixes #407). It adds `pressedPart`, `variant`, `tickMarks`, `thickness` and `background`. Vertical sliders now put 0 at the bottom.
- **Progress bar on the v2 engine** (CDEF 5; #440, #446). It adds integer `range` and `indeterminate`/`phase` (DECISIONS #10, #11). The 8 schemes without progress art now draw the original's own procedural bar, and `composeProgress` never returns `null`.
- **Loader:** the public `loadKaleidoscopeScheme` (npm export and the Pages `theme-loader/` module) passes the engine's `cinf` and icon-blit ids by default (#428, #434, #439; fixes #431). Dropped archives get the same output as bundled themes.
- **Fidelity ledger:** 340 verified, 0 mismatched, 6 unsupported and 1,486 unknown of 1,832 obligations. In 0.3.0 it was 257 verified and 33 mismatched.

### Also in this release

- **Specs:**
  - the progress CDEF 5 decode (#430, #443);
  - window-widgets answers and corrections (#437, #445, #450);
  - DECISIONS #10–#13 (#433, #435, #438, #441, #442, #449, #451, #454, #455).
- **Tooling:**
  - `lane:ready` now rejects silent reverts of base commits, and CI builds the demo (#447).
- **Known gaps:**
  - collapsed no-title utility windows on the five built-in-frame schemes render expanded (#423);
  - the title shadow (TX7) is not yet drawn;
  - with no condensed face, long titles truncate sooner than in the original (DECISIONS #13).

### Changes

- **v2 engine: `wnd#` windows now lay out and hit-test through the decoded 2.3.1 window recipe** (engine family `window`, `docs/spec/engine/window-widgets.md`). A new driver (`src/engine/families/window.ts`, tables in `src/engine/tables/window.ts`) follows the spec rows: part-code verdicts (PV), layout sums and placed ends (LS), the too-short step (TS), the allocation path (AP), per-cell widths with the unclamped budget (AW), the titled side (TT), cell rects (CR), the widget remap (RM), the pressed-widget draw (WD9) and the widget hit (HT). `composeChrome.ts` is now a facade over it; the legacy classifier, too-short negotiation, half split and placement-based widget remap are deleted. It fixes the window-widgets §7.2 findings F1–F10: a collapse box inside a dropped code-10 cell is now empty (not drawn, not hit, RM6); below the minimum the budget goes negative instead of clamping (AW8); the title plate is placed on the content centre with `W = SW + margins` and drops at ≤ 2 px of room (TT2–TT9); close, zoom and collapse are separate flags (F7); the collapse gate is re-read on every layout (F5, LC3); widget hits need the pressed-strip cicn and its mask (HT3–HT7, F8; inactive windows keep keyboard-reachable buttons, a runtime policy where HT2 would make them inert); the cell bands use the template cicn bounds (CR2/CR4, F6).

### Migration notes (window recipe)

- **Pixels change on most `wnd#` windows** (engine diff: 1530 of 1656 existing window cells, plus 156 new popup-family cells, each blessed in `tests/engine-diff/expected/window.json` with its spec row). Each side now ends at its placed end `P[N] = S[N] + content delta` (LS7, after the AW7 walk), so growers no longer absorb template slack past the last border. Untitled windows no longer draw the code-6 title bezels or plate (TT4, AW5); titled windows get a plate exactly `SW + margins` wide on the content centre instead of the measured width plus 18 px of padding, and at the template size a too-narrow side drops its title (TT3) rather than overflowing the frame.
- `composeWindowChrome` options: `titleWidthPx` is now `SW`, the bare title width (renderWindow no longer adds padding). New optional `titleWidthCondensedPx` (TT2; default the TT2a declared value `SW − titleLength`), `titleLength` (default 1 when `SW > 0`), `active` (`drawActive`, default true; renderWindow leaves it set), `widgetCicn` (the WD11 pressed strip, `cicn −14330`) and `pressedWidget`.
- `ComposedChrome` gains `widgets` (the reachable widget hit areas), `hitWidget(x, y)` (the HT rows, mask included) and `layout` (the engine layout). `shadeCleared` is removed. `titleRegion` is now the code-5 plate, not the run of 5/6 cells. New `titleRect`: the remapped title rect `t4p` (TX3).
- `resolveTitleWidgetRects(wt, composed)` returns `composed.widgets` for `wnd#` windows; it no longer remaps from `placement`. **Behaviour change:** a cleared or emptied collapse box has none, and a press inside a widget rect but outside the strip's mask falls through to the window (HT7). renderWindow loads the pressed strip through the engine resource chain; without it no widget is hit or drawn pressed.
- The title text follows the decode (TX2–TX5, TX8): left-aligned in the remapped title rect, baseline 4 px above its bottom, clipped to that rect + 2 px, truncated only when it does not fit; it is centred on the content (the layout centres the rect, TT6/TT7), no longer on the plate. Untitled windows and an empty title rect draw no text. The runtime has no condensed face, so TX5 only truncates, and TX7's shadow string and sampled colours are not drawn (runtime colour rule kept).
- `popup-window` titled sides now follow the decoded popup placement (AP1, PP1–PP7) with the creation values of the popup data (`pdMode 0`, `pdLen 33`): a 13 px plate 10 px in from the content's left edge, whatever the title; the titled-side rows do not run there. **This default visibly truncates every popup title** to the 13 px title rect (PP6/PP7 declare the creation values; who changes the popup data later is not decoded). Popup windows also draw the WD6 raw template blits: the type-5 and type-6 rect-list art at the content's top-left and top-right corners and the 15×15 corner ending at the body's bottom-right at the content's bottom-right (under the DOM content).
- Sides now draw in the decoded order (top, bottom, left, right) with CopyMask (WD4, qd-primitives Q5), so transparent template pixels no longer overwrite earlier sides.
- The leading region `[0, S[0])` and the trailing region past a side's end are left unpainted, as in the original (no full-draw routine paints them, window-widgets §6 Q3): the content behind the window shows through there. The placement map no longer reports them (no segment 0 or −1 slices).
- Inactive windows keep focusable, operable widget buttons, although the decode makes them inert (HT2), so keyboard and assistive-technology users can act on background windows; widget art still follows the decode (DECISIONS #12).
- Pressed `wnd#` widgets draw the scheme's pressed-strip cicn (WD9) instead of darkening the template; a scheme without it draws nothing.
- The L4 parity lock `src/engine/windowChromeParity.*` is removed. The engine diff covers its archives, window types, states and titles at native, 97×53 and 320×160, but not its 240×120 size. `tests/engine-diff/cases.mjs` accepts `window-widgets.md` row ids for the window family.

- **Window titles fit our title font (DECISIONS #13).** Two runtime limits of #432's decoded title draw are fixed. The runtime has no condensed face and draws titles at full width, so `composeWindowChrome` now defaults `SWc` to `SW` (TT2 no longer narrows the plate below the drawn text). Our title font is taller than the original's, so when its ascent would start above the remapped title rect, the baseline moves down by exactly that overflow, and no glyph is cut at the top. The decoded clip and baseline are kept otherwise.

### Migration notes (window title fit)

- `composeWindowChrome({ titleWidthCondensedPx })` now defaults to `titleWidthPx` (SW). It used to default to the TT2a value `SW − titleLength`. Pass a measured condensed width to get TT2's narrowing.
- Titled-utility titles on 1984, 1990, floppies, windows-31 and windows-95 now draw 1 px lower, inside the title rect: their letter tops were cut before. No title's descent leaves the rect (checked on every wnd# scheme with a descender title). Document-window titles are unchanged.
- Titles truncate to the plate: the truncation room is the title rect + 2 px (TX5) but never past the plate's right edge, so on dolphin-som and evolution, whose title rect ends flush with the plate, a truncated title no longer draws 1 px past it. The clip stays the decoded title rect + 2 px. The room never drops below the title rect's own width, so templates whose plate is narrower than the title rect (floppies, 1138) keep titles that fit whole.
- Unchanged by design: titles are left-aligned in a plate exactly `SW + margins` wide, so on schemes whose title rect fills the code-5 cell (evolution, dolphin-som) the text starts at the plate's first column. BeOS tabs follow the TT rows (no extra plate padding).

- **v2 engine: the progress bar now draws through the decoded 2.3.1 progress CDEF 5.** A new driver (`src/engine/families/progress.ts`, tables in `src/engine/tables/progress.ts`) follows `docs/spec/engine/progress.md`. It forces the control rect to 14 rows (RECT1). The path is chosen by the `cinf` gate: inactive (hilite 254 or 255) needs `cinf −10077`, and without it the whole bar draws with the active ids (GATE1/GATE1a). No `cinf −10080` or a missing frame cicn means CDEF 5's own procedural bar (GATE2/GATE3). Otherwise the frame is drawn as a body-less cinf border (FRAME1–FRAME8), with one-column bands as lines and `tile ≠ 0` bands tiled. The inner rect is inset by `k` when `k > 2`, else 2, and by `s` (INSET1/INSET2). The determinate split is `x = I.left + trunc(w · offset / range)`, unclamped (DET1–DET4). The fill `[I.left, x)` and the track `[x, I.right)` are each sliced from their own `cicn`/`cinf` pair: halves, caps, a one-column or tiled middle anchored at the start or end, with the art keeping its own height (SLICE1–SLICE7). Indeterminate mode uses pattern frames or a 4 px-per-phase shift (IND1–IND7). Art is copied through its mask (BLIT1–BLIT8) and nothing is erased (ERASE1–ERASE4). This fixes every §8 divergence: the eight procedural schemes (animals, apple-platinum-2, beos-r503, black-platinum, monkey-paradise, platinum-8, slimes, system7-nostalgia-silver) no longer use the "lavender 2-part" cicn −10223/−10224 model. They draw the procedural bar: bevel lines sampled from `cicn −10224`, a FrameRect, then dark grey and lavender PaintRects or `ppat −10064` (FB1–FB10). The removed behaviours are the per-part inactive→active fallback, disabled drawing as active, `null` returns, rounding, the pixel-scan inset, the track-under-frame draw order, the frame's centre cell overwriting the track, stretched bands and art, and the unmasked copies. Monkey-paradise's indeterminate procedural bar draws nothing inside the frame (FB9, an undecoded rect; the control-panel `ppat −10064` is not shipped, DECISIONS #5). The legacy progress drawing code is removed. The engine diff gate gains a `progress` family (1,458 cells), and reviewed progress goldens are re-recorded.

### Migration notes: progress bar

- `composeProgress` now always returns a `PixelBuffer` (it never returns `null`): schemes without progress art get CDEF 5's procedural bar. The buffer is always 14 px tall. Pixels nothing draws stay transparent.
- New optional `range: { value, min, max }` (DECISIONS #10): 16-bit signed integers, unclamped. A value outside `[min, max]` moves the split past the track, and the trace records the overflow. Non-integers or values outside −32768..32767 throw `RangeError`. The normalized `value` stays (clamped to 0..1, mapped to `trunc(v × 10000)` of 0..10000). Passing both `value` and `range` throws `TypeError`.
- New optional `indeterminate` and `phase` (integer 0..255, DECISIONS #11). New `composeProgressFrame(theme, opts)` returns `{ buffer, phase, path }`: one drawn frame plus the phase after the draw (frame mode resets an out-of-range phase to 0). New `ProgressIdle` helper (interactive layer) keeps the phase and advances it once 3 ticks have passed (IDLE2). Call `idle()` from a timer and redraw with `compose(theme, opts)` when it returns true. `progressTickCount()` is its 60 Hz TickCount stand-in.
- **Pixels change:** `state: 'disabled'` now draws as inactive; `'pressed'` draws as normal. An inactive scheme without `cinf −10077` (apple-lisa) draws the active bar. Fill and track art keep their height, so 14-row art covers the frame rows (floppies, windows-31, windows-95).
- `inspector.resourceRoles.progress` (`ThemeProgressModel`) and `progressSummary` are deprecated. They no longer describe how the bar is drawn. Removal is tracked in #436.
- Loads gain engine `cinf` bytes for the progress ids (−10080..−10075) when engine cinf ids are on (the default for `loadTheme` and the public `loadKaleidoscopeScheme`).

- The public `loadKaleidoscopeScheme` (the `scriptoscope.js` export and the Pages `theme-loader/` module) now also passes the engine's icon-blit cicn ids by default, the same as `loadTheme`. Archives loaded through it get the icon-blit depth and opaque companion for the scroll-bar arrow cells and the built-in frame's corner, stripe and sample cicns. Without them the icon blit fell back to the masked copy and traced `unimplemented`. No pixel changes on the 18 bundled themes (#434 review). Pass `iconBlitCicnIds: []` to opt out.

- **Pages: the published standalone decoder is the public wrapper** (fixes #431). `https://khawkins98.github.io/scriptoscope/theme-loader/loadKaleidoscopeScheme.js` used to be a verbatim copy of the conversion core, which leaves `engineCinfIds` off, so a consumer importing it got no engine `cinf`s and every slider would hand off to the Platinum fallback once 0.4.0 ships themed sliders. `npm run build:demo` now builds `src/loadKaleidoscopeScheme.ts` with the core into one ES module (`vite.loader.config.js`) and publishes it under the same URL, so existing imports, and `theme-loader/index.js`, which re-exports it, get the engine cinf ids by default. Pass `engineCinfIds: []` for the old behaviour. The `.sit` path still lazily imports the published `sit-wasm/index.mjs`. The rest of `theme-loader/` is copied unchanged, and the npm package and library build are unchanged.

- **Demo: dropped archives draw engine sliders.** `demo/_theme-drop.mjs` (used by `declarative-hostile-css.html`) and `demo/diagnostic.html` imported the conversion core `tools/theme-loader/loadKaleidoscopeScheme.js`, which leaves `engineCinfIds` off. A dropped `.sit`/`.rsrc` therefore had no engine `cinf`s and every slider fell back to Platinum. Both pages now import the public wrapper `src/loadKaleidoscopeScheme.ts`, which passes the engine cinf ids by default. No other demo page imports the loader. The library itself is unchanged. Leftover legacy slider-layout code is tracked in #427.

- **v2 engine: the slider now draws through the decoded 2.3.1 slider CDEF 3** (fixes #407). A new driver (`src/engine/families/slider.ts`, tables in `src/engine/tables/slider.ts`) follows `docs/spec/engine/slider.md`: the `cinf`-only gate (G1–G3), the per-control record (ID1–ID9), the track ladder `gb + tier → gb + 1 → base + tier → base + 1` with a `cinf` required at each id (TR3–TR6), cap/halves/tiled slicing with one-column middles drawn as lines (SL1–SL6, BL4–BL7), the thumb cell map 0 inactive/disabled, 1 normal, 2 pressed, 3 ghost (TH1–TH5), tick marks (TK1–TK5), the 16 px hit band (HT1–HT4), and tracking (messages 5, 6, 26). It fixes the six disagreement classes pinned in #407: floppies (slider cicns, no slider `cinf`) now hands off to the procedural Platinum slider (S1); disabled and inactive draw thumb cell 0, not the ghost cell (S2); the thumb is copied through its mask (S3); the whole control rect is erased to a background and copied opaque (S4); the thumb sits at `R.left + c + trunc((alongR − tA − 2c) · offset / range)` with the vertical minimum at the bottom (S5); and a one-column middle (`cinf` byte 2 = 0) is drawn as lines, not stretched (S6). One-column track lines take the BL8 colour-table colour (the loader's sampler companion, or the decoded colour where the loader found them equal; otherwise the shortcut is traced, BL12); a cicn with a non-zero bounds origin and a short `cinf` are traced (BL11, CF3). A composition bound to a caller signal stops decoding when the signal aborts or the theme's assets are released, including between the archive and base tiers. The legacy slider drawing code is removed. The engine diff gate gains a `slider` family (2,418 cells); reviewed slider goldens are re-recorded.

### Migration notes (0.3.0 → 0.4.0): slider

- `composeSlider` gains optional `pressedPart: 'thumb' | 'pageUp' | 'pageDown'` (DECISIONS #9; native 129 / 22 / 23). `state: 'pressed'` with no part means `thumb`; a page press draws the pressed track with the normal thumb. `interactiveSlider` sets the part from the hit under the pointer (part 0, outside the 16 px band, paints the normal state).
- New optional `variant: 'nonDirectional' | 'pointsDownOrRight' | 'pointsUpOrLeft'` (HISlider.h variation bits 3 / none / 2). The default, `nonDirectional`, is the slider every earlier release drew.
- New optional `tickMarks` (directional variants only; the original draws none for `nonDirectional`), `thickness` (control rect cross size, default 16, or 32 with tick marks) and `background` (the colour the control rect is erased to, default white).
- **Pixels change:** the output is now opaque (the control rect is erased to `background`; it used to be transparent outside the art), the thumb is masked, disabled/inactive thumbs use their own cell, and the thumb is inset by the scheme's corner `c`. Adapters do not pass `background`, so a themed slider in a themed window body shows a white control rect.
- **Behaviour change (vertical sliders):** value 0 is now at the bottom for every vertical slider, themed and Platinum fallback (`platinumSlider` / `platinumSliderWithLayout`, which now also report `valueDirection: -1`). For the same pointer position, `interactiveSlider({ orientation: 'vertical' })` reports `onChange` values that are 1 − the previous value; invert stored vertical values when upgrading.
- Floppies now returns `null` from `composeSlider` (the original hands it to the System slider), so callers draw the procedural Platinum slider.
- `value` 0..1 maps onto native 0..100 (rounded), a documented modern policy row.
- New loader option `engineCinfIds`: loads that pass it gain `manifest.engineCinfs` (raw `cinf` bytes by id). `loadTheme` and the public `loadKaleidoscopeScheme` export pass the engine's ids by default (pass `engineCinfIds: []` to opt out); the conversion module under `tools/theme-loader/` stays off by default, so lint and decoded fingerprints are unchanged. A theme loaded without engine cinfs hands every slider to the Platinum fallback.
- With a declared `sliderLayoutEnvironment`, `composeSlider` raises `UNSUPPORTED_CINF_ENVIRONMENT` when the declared corner differs from the corner the resource chain resolves, or when the thumb's cross cell is not 16 px.

### Runtime size (`npm run loc:src -- HEAD --base v0.3.0`)

| src/ lines (non-test .ts) | v0.3.0 | 0.4.0 | delta |
|---|---:|---:|---:|
| logic (all src except engine tables) | 15399 | 16112 | +713 |
| engine tables (cited data) | 1258 | 2145 | +887 |
| total | 16657 | 18257 | +1600 |

By family: the window recipe removes 405 logic lines (the title fit adds 11 back) and `composeChrome.ts` drops from 924 to 255 lines. The slider (+648) and the progress bar (+456) grow because they add behaviour the legacy drawers never had (procedural bar, indeterminate mode, page parts, tick marks). The legacy slider and progress drawers are deleted.

## [0.3.0] — 2026-10-22

Second incremental release from the v2 engine branch (#378). The five schemes with no `wnd#` recipe (apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver) now draw Kaleidoscope's own decoded built-in window frame instead of the old corner-sprite approximation.

- **Built-in window frame on the v2 engine** (fixes #387, #414). Document, dialog, alert, movable-modal and utility windows, including their collapsed forms, draw through the decoded kDEF built-in window definition. The window footprint changes; see the migration notes below. The old `composeCornerSpriteChrome` export is removed.
- **Known gap:** collapsed no-title utility windows still render expanded on these schemes (#423).
- **Slider:** the engine slider (#416/#419, issue #407) is held for 0.4.0.
- **Fidelity ledger:** 257 verified obligations, up from 229 on v2 at 0.2.0 (window families 1.2.0–1.4.0; #409, #418, #424). The ledger also records 33 known `composeSlider` mismatches (#407, slider ledger 1.1.0, #408), which the 0.4.0 engine slider resolves.

### Also in this release

- **Decisions** (#405): DECISIONS #7 (masked fallback) approved, and #9 (slider `pressedPart`) added.
- **Slider rule rows** (#408): CDEF 3 rule rows, with the current slider's disagreements pinned against #407. Tests and ledger only; no engine code.
- **Icon companions:** a mismatched opaque icon-blit companion now falls back to the masked asset and is traced (DECISIONS #7, #413). No pixel changes on the corpus.
- **Dead-code cleanup** (#410): unused internal exports are dropped, the resource-role rubric is de-duplicated, and the manual visual-baseline browser suites get an `npm run test:visual-baselines` script.
- **Engine-diff gate hardening** (#411):
  - it runs the base copy of the harness in its own process;
  - it accepts ledger evidence ids;
  - it compares against the merge-base for PRs into main.
  Release PRs must declare every changed family (`tests/engine-diff/README.md`).
- **Specs:**
  - procedural-frame revision 3 decodes the utility frame (#415);
  - the slider spec answers (#417);
  - the window-widget spec is split into an implementer-safe unit and an evidence file (#420). The split corrects three earlier readings and lists eight runtime divergences for the window-recipe migration.

### Changes

- Add `npm run loc:src` (`scripts/src-loc.mjs`). It reports non-test `src/` line counts, split into engine tables and logic, with an optional `--base <ref>` delta measured from the merge-base. CONTRIBUTING now asks every PR that changes `src/` to paste this table, every family migration to delete the legacy path it replaces, and every release to report the trend against the previous tag.

- **v2 engine: utility windows of the five built-in-frame schemes now draw Kaleidoscope's decoded utility frame** (procedural-frame §9, revision 3; fixes #414). This covers titled, side-floating, no-title and the collapsed variants. Before this change these windows had no frame. Horizontal bars draw UFH1–UFH12 and vertical (side) bars UFS1–UFS12. Collapsed windows draw a 2-px box (UFC1–UFC6). Every frame shape gets the drop shadow (UFT3). The art is cicn -14316 / -14320 for horizontal bars and -14315 / -14319 for side bars. Line colours are sampled from that cicn: fill P(4, 3), text P(5, 3), shadow P(7, 3), with transposed points on side bars. Stripes are cicn -14314 (side: -14318 first), tiled 1:1 in a 9-row band between the title limits. The title is erased into the band, then drawn with a shadow pass that is skipped when the shadow colour equals the fill. Too-long titles are condensed and truncated. Widgets are 10 × 10 boxes that plot 16 × 16 glyphs (-14320 / -14318 / -14319). The interior fill is painted last, around the stripes, the title and the widget boxes. Widget presence and the bar height are now derived from the window record: H is 15 with a title and 13 without, or on a side bar, and narrow windows drop widgets against a 7-px outset (UP1–UP4). The declared per-slug `utilityWidgets` / `utilityTitled` defaults are removed. The normal 16 × 16 grow box (-14313 / -14317) is drawn by message 6. The small one (variation bit 4) is part of the frame and crops the cicn's top-left 11/15, unscaled (UGB2). Utility hit testing is UH1–UH8: widget hits are the box inset by 1. Corrections to #412's document family: grow boxes are copied through their mask (GB1/GB3). A draw with a part below 4 clears the shared toggle bit; part 258 flips it in the document family only (TG1–TG4, UM2). The narrow-window drops follow WP1–WP4: without a close box the zoom box is never dropped. Colour-table "entry n" is found by value (CT1–CT4). Message 6 draws its two scroll-bar lines (M6L1–M6L6). Hit rows are cited HT1–HT9. Engine-diff: all 1,005 cells seeded by #412 change, and 90 new collapsed no-title cells bring the family to 1,095. The 450 utility cells draw the frame. The 555 document cells change in the trace only: every corpus grow cicn is fully opaque under its mask, so the masked copy changes no pixel. The `window` and `scrollbar` cells are unchanged. Not implemented: the procedural kind-5 grow box (GB4–GB6 / GL1–GL4, reached only with *thin* + *grow*, which no slug sets) and utility messages 7 and 8 (§9.10). No native capture backs this (§10 item 9).

### Migration (utility windows, built-in frame schemes)

- Utility windows of apple-platinum-2, black-platinum, platinum-8, slimes and system7-nostalgia-silver now have a frame. They are 4 px on the sides and bottom, with a 16-px bar (titled) or 14-px bar (untitled or side) and a 1-px shadow. `ComposedChrome.frame` reports the new insets.
- The side-floating utility window now shows its collapse box (the Kaleidoscope collapse option is on and there is no close box to collide with). It previously showed no widgets.
- `PfWindowSlugRow.utilityWidgets` / `utilityTitled` and `ProceduralFrameInput.utilityWidgets` / `utilityTitled` are removed. Widget presence and the bar height are derived. New optional inputs: `titleWidthCondensed`, and `font` for the utility title metrics.
- Collapsed utility windows of these schemes no longer draw a full document window. The facade resolves the window-type key through its canonical, legacy and raw-id equivalents (`equivalentWindowTypeKeys`). renderWindow and the WindowManager collapse path pass canonical slugs such as `collapsed-titled-utility-window`, and the record table had only the legacy names, so the lookup fell back to the document window. An unknown key still falls back to the document window, but now warns once and traces it (`proceduralFrameRecordFor(key).fallback`). A record is added for `collapsed-no-title-utility`.
- On these schemes the collapsed titled utility window keeps its title, so its bar stays 16 px like the expanded window's (UI10). wnd# schemes keep the old title gate.
- `collapsed-no-title-utility-window` still renders as the expanded no-title window on these schemes. The loader's built-in-frame window table has no such type, so the new `collapsed-no-title-utility` record is not reachable from the public path yet (#423).
- `PfTextPass` gains optional `condensed` / `truncateTo` (UT3). `TitleRaster` gains `fontAscent` / `fontDescent`. `rasterizeTitle` takes an optional `{ exactPx }`.

- **v2 engine: windows of the five schemes without a `wnd#` recipe now draw through Kaleidoscope's decoded built-in window frame** (engine family `proceduralFrame`, `docs/spec/engine/procedural-frame.md`; fixes #387). Affects apple-platinum-2, black-platinum, platinum-8, slimes and system7-nostalgia-silver. The frame is 6 px on the sides and bottom with a 1-px drop shadow. Its corners are copied from the scheme's own frame cicn (-14332 active, -14336 inactive) and every line colour is a pixel sampled from that cicn: the bar fill is P(6, 3), the title text P(7, 3) and the title shadow P(9, 3). The title bar is 22 px for the system font. Dialogs and alerts draw the 3-px ring, the content gap and the shadow from the dialog cicns (-14326/-14328, or -14322/-14324 for alert colouring). Movable modals draw a boxed title bar above the ring. Stripes fill the close-box rows: the scheme's `ppat` first, then its own cicn three-slice-stretched over it, with a 3-px gap around the title. Widgets are the scheme's `ics#`/`ics8` icons in fixed 16 × 16 slots. Zoom is -14334 (pressed -14331) and collapse is -14335 (pressed -14332); they were swapped before. Stripes and widgets are drawn only on the active window. The 17 × 17 grow box (-14330 active, -14334 inactive) sits at (C.r − 15, C.b − 15). The legacy compositor (`composeCornerSprite.ts`, `cornerSpriteGeometry.ts`) is deleted with its heuristics: `dominantColor`, the lighten/darken bevels, `headerColors` ring and panel colours, the 19-px title, the 7 × 7 procedural widgets, the stripe paddings and ink-bounds glyph trimming. The engine also answers hit testing (message 1), features (7) and regions (8). Utility windows (titled, side-floating, no-title and their collapsed variants) draw only their decoded parts, the widgets and grow box. The utility frame, stripes and title are not decoded yet (§9) and are traced `unimplemented`, so these windows had **no frame** at this point (superseded by the utility-frame entry above, #421, in this release). The slug → variation mapping and other environment inputs are declared defaults in `src/engine/tables/proceduralFrame.ts`, not decoded values; the spec questions are in the lane notes. One consequence of the literal §3.5 comparison: slimes' alert colour table has a white entry 0, equal to the declared default content colour, so slimes dialogs and movable modals use the alert art. The loader gains an additive `inspector.colorTables` (`actb`/`clut` entries; the raw-mode result gains `colorTables` and `iconMaskPlanes`), and the icon-blit loader set now includes the frame and grow cicns. `theme.json` and lint fingerprints are unchanged. A new engine-diff family `proceduralFrame` (1,005 cells) is seeded; the `window` and `scrollbar` cells are unchanged. No native capture backs this (§10 item 9).

### Migration (built-in frame windows)

- These windows are larger. The title bar is 22 px (was 19), sides and bottom are 6 px plus a 1-px shadow on the right and bottom (were 1–5 px), and dialogs are outset 6. `fullWidth` = content + 13 and `fullHeight` = content + 29 for a document window. Code that hard-coded the old insets should read `ComposedChrome.frame`.
- Widgets are 16 × 16 icon slots: close at bar left + 4, collapse at bar right − 17, zoom at bar right − 33 (− 17 without a collapse box). They were 7 × 7 boxes or ink-trimmed glyphs. Hit and press areas follow.
- Inactive windows show no widgets and no stripes.
- Long titles are clipped to the space between the widgets, as the original does; they are no longer truncated with an ellipsis.
- The public export `composeCornerSpriteChrome` (and the `CornerSpriteOptions` type) is removed. Render these windows with `renderWindow`. `scripts/render-window.mjs` now refuses corner-sprite types and points to the engine-diff `--dump`.
- `WindowType.sprites` and `WindowType.widgets` stay in the schema but the runtime no longer reads them.

### Runtime size (`npm run loc:src -- HEAD --base v0.2.0`)

| src/ lines (non-test .ts) | v0.2.0 | 0.3.0 | delta |
|---|---:|---:|---:|
| logic (all src except engine tables) | 14776 | 15399 | +623 |
| engine tables (cited data) | 461 | 1258 | +797 |
| total | 15237 | 16657 | +1420 |

The growth is the decoded frame family and its cited tables. The legacy corner-sprite compositor (about 700 lines) is deleted. The large legacy files (`controls.ts`, `interactive.ts`, `composeChrome.ts`) shrink when their families migrate.

## [0.2.0] — 2026-10-22

First release from the v2 engine-model branch (#378). This is an incremental cutover: further control families ship in later minor releases, and "every family on the engine" is the 1.0 milestone. The previous version label was 0.0.1; there was no 0.1.x release.

- **v2 engine core.** QuickDraw-style primitives, a ResourceChain, state normalisation and a per-call trace in `src/engine/`. Window chrome now draws through it with no pixel change.
- **Scroll bar on the decoded 2.3.1 CDEF** (fixes #374). Adds the `pressedPart` option. `proportional` and `thumbExtent` are now ignored; see the migration notes below.
- **Window too-short step and widget hit-rect remap**, carried over from main (#377).
- **Fidelity tooling:**
  - the `lane:ready` pre-review gate and a docs CI job;
  - a per-family requirement ledger with a history guard;
  - the engine trace-diff gate;
  - a clean-room linter and implementer brief;
  - a frozen routine denominator of 552 in-scope ranges.
- **Decoded specs** (docs only, no runtime change yet): the procedural window frame, the slider (CDEF 3) and answers to the QuickDraw primitive questions.

### Migration notes (0.0.1 → 0.2.0): scroll bar

- `composeScrollbar` gains an optional `pressedPart: 'up' | 'down' | 'pageUp' | 'pageDown' | 'thumb'`. `state: 'pressed'` with no part means `thumb`. `interactiveScrollbar` sets the part from the hit.
- `proportional` and `thumbExtent` are still accepted but now **ignored**: the thumb is always its cicn's length, as in the original under the declared defaults.
- Scroll-bar thickness is fixed at 16 px and `value` 0..1 maps onto 0..32767. Both are documented modern policy rows in the engine tables.
- New opt-in loader option `iconBlitCicnIds`, and a new additive `inspector.iconMaskPlanes` field on every load. Default loads and decoded fingerprints are unchanged.

### Changes

- Add the v2 engine diff gate (PLAN §6). `tests/engine-diff/run.mjs` renders a fixed matrix in Node for every archive. For window chrome that is every sliced window type, both states, three sizes and two title widths (1,656 cells). For the scroll bar it is both orientations, every public state with each pressed part, three lengths and three values (2,592 cells). Each call is reduced to a trace digest: resolved resource ids, named rects, ordered draw steps and the output pixels. The window trace comes from the public placement map, because `composeWindowChrome` passes no engine trace, so the pixel digest is what makes a tile-direction change visible. Each cell is compared with the baseline at the PR's merge-base. A changed, added or removed cell must be blessed in `tests/engine-diff/expected/<family>.json` with its new digest, a decision-table row id from the family spec and a reason. The family must be declared with an `engine-diff: <family>` PR body line, and the committed baseline must be the head's output. Every family with a baseline at the base is judged even if the head's `cases.mjs` drops it, so a deleted or renamed family fails, a baseline belonging to no family fails, and a seed may not reproduce an existing family's digests. Baselines for both families are seeded from current v2. The gate runs in the main CI job (Node only, a few seconds), in the v2 docs workflow (so a docs-only PR cannot delete a spec row an expected entry cites) and in `lane:ready`. Proof: flipping table W's code 11/14 tile direction in `src/engine/tables/windowBlit.ts` changes 28 animals and monkey-paradise window cells, and making TR3 pick tier 2 for pressed in `src/engine/tables/scrollbar.ts` changes 1,620 scroll-bar cells. The gate fails on both. `lane:ready` now checks the pushed head at the branch's upstream (`@{u}`) and fails when that upstream is the base branch itself (#378).

- **v2 engine: the scroll bar now draws through the decoded 2.3.1 scroll-bar CDEF** (#395, fixes the selection mismatches in #374). Track tier, the disabled and inactive thumb, the icon-lane arrows, the composite-art test (bounds > 16) and pressed non-hit arrow boxes now follow `docs/spec/engine/scrollbar.md`. All 144 sampled selection rows agree in source and built modes. Reviewed scroll-bar goldens are re-recorded; only scroll-bar cells change. The legacy scroll-bar drawing code is removed.

- Add the v2 pre-review gate and review tiers. `npm run lane:ready` fails on a dirty worktree, an unpushed head or a pushed head that differs from HEAD. It also fails on leftover review labels in the family ledger sources, `ledger.json` and the control-availability expectations: `PENDING`, "Awaiting independent review" or "PROPOSED verified" in exact case anywhere, or in any case on lines that are new since the merge-base. A single `PENDING` reviewer label on a hash-only expectations bump passes with a WARN for the PM. A hash-only bump means 64-hex sha256 values with unchanged keys, the inventory version, and a review block that archives the prior review. It then runs the clean-room linter, `gen-trap-table --check`, `report-coverage`, `build-ledger.mjs --check`, a new ledger history guard, `validate-source` (document hash pins), typecheck and `npm test`. It prints a markdown summary with the commit and each exit code for the PR body. `--skip-tests` is accepted only for docs-only diffs, and it still runs the document-pinned tests. A new `v2 docs + ledger` workflow runs the no-browser checks, `validate-source` and `npm test` on every PR and push to v2, including docs-only PRs that `ci.yml` skips. It fetches the base commit explicitly and fails if the base can't be read. It also runs the base commit's copy of the linter, coverage pin and history guard against the head, so a PR cannot weaken its own judge. By maintainer decision, Traps.h is not stored in CI, so the workflow checks only the trap table's structure and says so. The history guard (`scripts/check-ledger-history.mjs`) requires each family's merged transition history to be an unchanged prefix of the head's, and `_base.json` to be unchanged. This catches a rewrite that re-derives every digest, which the generator's own chain checks accept. It fails closed when its base commit can't be read. `npm run ledger:sync` regenerates and checks `ledger.json` for the second of two family-touching PRs, and the workflow prints that command when the ledger is stale; CI never commits. Hardening: `report-coverage` treats the inventory as frozen when its status mentions "frozen" in any case, when any pin field exists, or when the base inventory was frozen. In each case the full in-scope pin is then required, so neither `frozen: false`, a reworded status nor a deleted pin turns the checks off. Against a frozen base, `inScope.changes` is append-only, and a re-pin (a new count or sha256) needs a new entry recording `from`, `to` and `what`, so a self-consistent silent re-pin fails. The clean-room brief-scope check now also catches bare top-level directories (with or without backticks and trailing slashes), unbackticked paths, link targets including the repo root, and paths outside the repo. It rejects forbidden locations (`.scratch`, listings, `*.evidence.md`, lane and maintainer-store paths, absolute and `~` paths) in the Allowed paths section even when they don't exist on disk, along with any `scheme://` URL. The brief's listing-path exemption no longer covers that section. `package.json`, which the brief allows, is now linted. CONTRIBUTING records the tiers and the `lane:ready` requirement (#378).

- Correct the scroll-bar CDEF citations (v2 lane L5 verifier). The scroll-bar CDEF is service slot 1 `0x997e`, not slot 5 `0x8d36` as the scroll-bar selection entry below says; slot 5 is a separate, undecoded CDEF (`bevp` tags). `0xbbf4` is the track rect, not the thumb rect; a disabled control fills the whole track rect; the "together arrows" byte is never set, so arrow 0 is always drawn; arrow icons are `ics#` then `ics8`, never `ics4`, and cicns -10204..-10197 are never loaded. Docs, rule-table comments and the scroll-bar ledger family (1.1.0, evidence re-pinned) follow; no rule outcome or ledger status changes. Add scroll-bar geometry rules from `docs/spec/engine/scrollbar.md` (boxes, track rect, thumb length/position, segments, slicing, part codes, pattern underlay, offscreen rule) with a mutation table, and todo rows awaiting the scroll-bar driver.

- Drop window-edge part-code-10 cells when a side is too short, and map title-bar widget hit and press areas the way the original does on all four window edges. The decoded kDEF shows code 10 is a fixed cell that the original drops first when a side's placed length falls below the sum of its fixed cells; the same step removes the title plate and, if the side is still too short, the collapse-box gap. The earlier reading that untitled sides always collapse code 10 confused two argument bytes, so nothing changes at or above a window's template size: across 33,396 sampled compositions only below-template windows change. Widget hit areas now follow the original template-to-placed remap: each corner is matched against the edge cell that contains it on every side, cell ends are exclusive, and a widget that matches no cell gets no hit area. Collapse boxes on the left edge of side-floating utility windows (1138, apple-lisa, windows-95 and others) now move with the window height, widgets that start exactly on a cell border (windows-31, 1984, animals, apple-lisa, monkey-paradise and others) line up with their art, and collapsed side utilities get hit areas. Not all of these moves are decoded corrections: in 22 of 138 window types the rects move even at template size because they now follow the runtime's existing cell placement, which is not the identity there and is only as faithful as that placement. At template width the grow-box overlay still covers the left-edge collapse box of 1138's side-floating utility window (follow-up). A collapse box in a dropped code-10 cell stays clickable unless the collapse-box gap was also removed, following the decode; the maintainer may override this policy. The window rule check samples a below-template size and asserts code 10 from the decoded rule; a new source/built spec checks the WindowManager overlays. Ledger 1.24.0 re-cites the code-10 rows with no status change (216 verified, 18 mismatched, 1,494 unknown). Scene captures and control goldens are unchanged. No native capture backs this (#221).

- Add source-addressed tab and whole-header rules for all 18 archives. A Node rule table reads each archive's own resource map and transcribes two decodes. For tabs: CDEF 8 state selection (`-9976+state`, +3 for the selected tab), the NULL-icon-only fallback to `-9960+state`, and the 0x16e body (full-height ends, single-column or tiled bands, the centre erased in the raw background sample). For headers: PACH 130 zero/nonzero selection, clamped corners, independent bands, the transposed-inset body and the P pattern anchor. A source/built browser check compares the two public `composeTab` rows and 24 `composeHeaderSurface` rows per archive with that model; every row matches. The check pins which rows cannot tell the selection apart, which wrong reading each archive fails and the per-row tab widths. Append 36 open ledger cases (1.23.0, 324 obligations). Independent review verified 43 of them, as agreement with the decode under an archive-only resource chain: tab selection for states 1 and 4 (10), tab bands on the single-column branch (11), header raw dispatch (7), header region geometry (12) and the header pattern-body anchor (3). That makes 216 verified, 18 mismatched and 1,494 unknown in total. The decode also shows that 0x16e switches to the Gestalt(`Copl`) file before GetCIcon, and that the 2.3.1 control panel ships `clut`-recoloured fallback tabs (-9968..-9964, -9960..-9956). The runtime returns null for the four archives without tab art; the original probably draws a fallback tab there, so this is recorded as a probable divergence. Also recorded, not changed: the runtime retries the large tab id where the decode probes `-9960+state`; `composeTabBody` ignores `samplingEquivalence` (every corpus face is `equivalent`); animals ships tab cicn -9984 without a cinf. No archive discriminates four header readings: the c/s swap, single inset and body order are covered by `header-band-requirements.spec.mjs`, and the repeat flag only by `header-surface.spec.mjs`. Not covered: tab width, panes, disabled/pressed tabs, the centre fill colour, the original pattern offset and `composeListHeader` (#221).

- Add source-addressed scroll-bar selection rules for all 18 archives, decoded from the 2.3.1 scroll-bar CDEF (`0x8d36`): state bytes, the track `(-8288 | -8280) + tier` (0 inactive, 1 disabled, 2 normal, 3 pressed) with no cross-tier retry, the bounds-over-16 composite flag, the arrow-icon and arrow-box lanes, and the thumb (none while disabled). A Node rule table reads each archive's own resource map and a per-archive mutation table names what each wrong reading changes. A source/built browser check replaces every candidate cicn and arrow icon with a sentinel and compares the resources the public `composeScrollbar` draws in 144 rows. The 32 normal rows of 16 archives agree. The other 112 rows disagree with the decode and are pinned per class, not fixed: pressed and inactive use the wrong track tier everywhere, the thumb is drawn while disabled or inactive, the icon-lane archives draw the wrong arrow icons, crayon-os and windows-95 tracks are drawn as square cells with procedural arrows, and pressed composite tracks omit the normal-tier arrow boxes. Fixing them changes every archive's reviewed goldens, and pressed needs a part option. Sliders and progress bars have no selection decode and are added as explicit unknowns. After independent review, ledger 1.22.0 adds 54 cases and 365 obligations: 13 `scrollbar.normal-selection` verified (selection only, under the declared mapping and an archive-only chain; the five ppat-shipping archives stay unknown), 18 `scrollbar.state-selection` mismatched under issue #374, the rest unknown (173 verified, 18 mismatched, 1,213 unknown). The runtime's tier map does not follow the 1.8.2 drawer, which selects the same tiers as 2.3.1; its comment misreads FUN_000066b4. No images or goldens.

- Fix window-edge tiling for part codes 11 and 14. These cells now tile from the far end of their run (right on top and bottom edges, bottom on left and right edges), so a partial tile falls at the near end and shows the end of the source art. Every other tiling code still tiles from the start. This follows the decoded `0xfeae` direction byte, which sets the starting end, not the axis. It changes five cells in animals (four) and monkey-paradise (one), in both states. The window-chrome rule check now asserts both directions for runs longer than 1px and rejects scaled or wrongly anchored tiles. The check now also covers unknown-class cells and records which archives can tell a wrong blit from a right one. Seven can; 1138, 1984, apple-lisa, beos-r503, windows-31 and windows-95 cannot. Ledger 1.21.0 cites the decode for the 13 `window.tile-blit` obligations. After review, seven of them are verified: 1990, animals, crayon-os, dolphin-som, evolution, floppies and monkey-paradise. They agree with the decoded rule at sampled sizes, for opaque pixels, and only animals and monkey-paradise exercise the 11/14 direction. The other six stay unknown, giving 160 verified and 879 unknown in total. No native capture backs these. The kDEF reference also corrects the widget routing: `0x5ffc` is the hit-test, widgets draw through `0x632e`/`0x6062`, and their placement depends on side widths, so this gives no support for collapsing code 10 (#221).

- Add source-addressed checkbox/radio selection rules for all 18 archives. A Node rule table reads each archive's own resource map. It covers the 2.3.1 state bytes, the CICN lane (`-9504 + 12*kind + 3*value + tier`, value-2 same-tier retry), the branch into the icon lane after a CICN miss, and the pinned icon table with the missing-`ics#` retry. A source/built browser check compares all 216 public `composeCheckable` rows (checkbox/radio × off/on/mixed × normal/disabled, empty label) with the predicted archive raster. 178 rows discriminate; 38 share pixels with another resource. Append 18 open checkable ledger cases (1.20.0, 185 obligations). Independent review promoted only the 13 CICN-lane selection obligations, as agreement with the decode under the stated conditions (153 verified, 886 unknown). Icon-only selection stays unknown. Limits: the rows assume the modern public-to-native mapping, a clear Gestalt(`Acid`) byte and an archive-only resource chain. The original lanes switch resource files (`UseResFile`), and that is not resolved. Pressed and value-3 art, ics8/ics4 depth, glyph placement and the label pen are recorded as unknown. The runtime's normal-tier CICN retry has no counterpart in the decode, but no shipped archive reaches it, so it is recorded rather than changed. Popup buttons are not covered.

- Record the reviewed 32 bpp reference-environment findings: Floppies depth-then-scheme results and their limits; boot-counted Animals and Crayon OS hangs; the about-box picture-depth association; the `nosound` host setting; and the absence of a splash toggle. Receipts are in the private store; nothing is admitted.

- Tighten the nine-state follow-ups from review. Every 1990/Dolphin ledger row, case substitution list and evidence locator/limit must now carry `State-non-discriminating`, and no 1984 row may. The test fails when any single marker is removed. Reword "Only 1984 discriminates hilite->cicn selection" to say the 1984 face comparisons are state-discriminating and that original selection remains unknown for all nine. Only unhashed ledger prose and evidence excerpts change; the inventory digest, version 1.19.0 and all statuses stay the same. The sealed `nine-state-evidence.json` and reviewed `captureMethod` text are left as recorded, with clarifying notes in the reference-captures README. The six byte-identical 1984/1990/Dolphin palette and producer-table copies become aliases, and the intake validator and `readOriginal` now resolve aliases when the repository is reached through a symlinked path.

- Add nine independently reviewed empty 80×20 push-face records for 1984, 1990 and Dolphin (normal/pressed/inactive), each environment with its own measured 1,223-key profile and finite CIcon transfer data, and let recorded-face harnesses bind such transfer data to the ordinary loader with whole-load provenance. Only the nine face-output obligations are verified (ledger 1.19.0: 140 verified, 714 unknown). Limits: the 1990 and Dolphin faces are identical across states and schemes, so they do not test state selection; only 1984 does. Title colour is untested, and the transferred elements are a slider tick and a checkbox, not the faces. Shutdown acknowledgement, provider/cache order, mask/phase/font, whole-port equivalence and cold-cache behaviour remain unknown. First batch stored in the compact evidence format (#221).

- Document the lean fidelity method in CONTRIBUTING and the project guide: rules-first coverage with sampled native captures, many observations per boot with predictions frozen before capture, review that proves each check can fail, named capture conditions (8-bit calibrated vs 32 bpp direct, never pooled), a native attempt budget and durable lane workspaces. Record the 32 bpp `SetDepth32` condition and its limits in the reference-environment guide. Correct the corner-sprite scheme list (five, including slimes) and the display-gamma module path.

- Add source-addressed window-chrome rule tables for the 13 `wnd#` archives (the other 5 get only the corpus-split and author-label checks). They cover the 0x356c `wnd#` ladder, END-based cells, the 1:1 leading corner, flag-independent part-code widths, per-half 0x5178 allocation and 1px-run 0xfeae opaque tiling. The checks run over every sliced window type, both states and 15 sampled sizes, in Node and in the source/built browser modes. Append 18 open window-chrome ledger cases (1.18.0); independent review promoted only the 13 `wnd#` ladder obligations. Record one decode disagreement (code 10 under caller flag 1, failing `todo`) and one undecoded overrun (titled halves at the template minimum, kept as an observation).

- Store committed fidelity evidence compactly without weakening any check. Measured profiles, calibration measurements and calibration logs use one-row-per-line `compact-json-v1`, and byte checks recover the exact originally bound bytes through `tests/compact-evidence.json`. Byte-identical duplicate profiles and the duplicate BeOS calibration are replaced by declared aliases. Twelve unread Shared307 calibration screenshots now live in the private asset store under sha256-bound locators. All capture/review digests, ledger and registry identities are unchanged. New intakes should follow the documented format (#221).

- Add four independently reviewed empty-face records for Floppies normal/pressed/inactive and Evolution pressed, genuine separate measured profiles and state-specific bindings. Preserve prior Evolution records and all broader unknowns; independent review accepted only four output obligations after the registered source/built pair matched all45 faces/72,000 pixels per mode. Refine the fidelity delivery roadmap without changing its full target or exit criteria.

- Allow recorded-face comparisons to bind a complete measured profile per state while preserving each theme’s existing default profile and earlier capture bindings.

- Cover source-derived push/default state precedence, missing-ring branches and face-rectangle expansion through direct composition and actual promoted buttons, using owned literal art in mandatory source/built tests. Preserve original caller/provider and broader fidelity unknowns.

- Add three independently reviewed Monkey Paradise empty-state observations and their actual 288-key measured profile. Join normal output to the loaded same-owner pattern and completed body union; verify only the three registered output obligations after independent source/built review, and preserve all prior evidence and broader unknowns.

- Record completed patterned control-body unions with actual resource, phase policy and write counts; preserve lookup-only diagnostics on empty or failed compositions.

- Clarify fidelity batching, consolidated preboot review and separate acquisition/execution identities while retaining required evidence and validation gates.

- Bind titlebar close, zoom and shade actions to authored widget identities, including right-grouped and vertically stacked controls; put shade outermost in the synthetic document layout and remove the resize overlay while collapsed so shade can restore the window.

- Leave window shell shadows off by default, including the landing page, so rectangular CSS shadows do not fill transparent edges of custom chrome. Preserve the explicit shadow custom-property opt-in and theme-painted artwork.

- Add two independently reviewed empty Evolution normal/inactive observations, actual 1,971-key measured preparation, public comparison cases and narrow ledger bindings. Preserve all prior records and typography, provider, phase and whole-control unknowns; exclude labeled captures and native font payloads (#190, #221).

- Add opt-in finite CIcon transfer preparation with exact source/context bindings, explicit modern mask alpha, and owned loader/package acceptance; strict default and display-profile v1/v2 behavior remain unchanged.

- Refresh the reference-intake status and document claim-focused fidelity batches, explicit ownership, delta review and finite-adapter stopping criteria without changing evidence admission or required checks.

- Add the six-source Shared307 empty-face campaign with separate measured profiles, original state observations and source/built comparisons. Validate completion through paired metadata and actual paint dependencies, replacing theme-name dispatch; retain exact payload identities, explicit absent metadata, acquisition incidents and broader fidelity unknowns (#190, #221).

- Document independently reviewed sparse CIcon preparation and ordinary transfer observations, separating documented foreground/background coloration from the unresolved missing-index lookup rule. Preserve runtime compatibility, strict profile rejection and all fidelity/intake statuses (#221).

- Add three independently reviewed BeOS empty-face state observations with finite measured-profile source/built comparisons and narrow ledger bindings. Preserve prior capture/request records and explicit cross-run, provider, phase, mask and whole-control unknowns (#190, #221).

- Add an opt-in version 2 finite direct-RGB8 preparation policy for strictly bounded full-color patterns, separate from RGB16 mappings. Preserve version 1/default behavior and whole-load rejection; retain explicit paint-context and original-evidence limits. Add a measured BeOS test profile and source/built whole-load checks without promoting capture intake or ledger claims (#221, #190).

- Document the fidelity workflow: prefer shared-model corrections, retain evidence and limits for interim overrides, and consolidate them when independent references establish the common behavior.

- Select each owner's exact signed push-button resource before author-name aliases, correcting the Animals normal face mismatch without changing recorded pixels or measured profiles. Preserve explicit compatibility fallback when the canonical art is absent.

- Add Animals normal, logically highlighted and disabled empty-face acquisition evidence from one fixed-order boot, a separately measured 209-tuple display profile, and bounded cross-run calibration joins. Preserve prior capture/request bindings and all broader provider, phase, mask and whole-control unknowns (#221, #190).

- Document the private maintainer reference-asset store, verified fetch workflow, restore limits and separation from public CI; refresh the README to twelve reviewed scoped observations.

- Add four independently reviewed Crayon/Lisa highlighted and disabled empty-face observations, calibrated measured-profile comparisons and narrow recorded-output ledger bindings. Define one fixed empty-push campaign across 18 sources and three states, preserving prior bindings and leaving 42 unacquired campaign states and all broad fidelity claims unresolved (#221, #190).

- Register existing conditional slider endpoint and checkable icon selector assertions in the partial requirement ledger, binding owned inputs and actual source/built output while preserving all historical provider, decoder and whole-control unknowns (#221). Document coherent implementation/harness/ledger/documentation batches with one reviewed final check chain and retained unchanged-input receipts.

- Add an explicit group2 slider layout environment with independently owned cinf metadata, inset horizontal/reversed vertical endpoints and committed pointer geometry; preserve default compatibility behavior and reject unsupported inputs.

- Keep slider groove cap/tile metadata attached to the actual selected resource when a missing requested state falls back to active art; add literal public-loader checks without changing endpoint policy.

- Document the source-bound progress PaintRect interceptor and the unresolved upstream value-to-rectangle connection, without changing runtime behavior or fidelity status.

- Register eight exact owned mixed checkbox/radio selector and same-tier fallback cases in the partial requirement ledger, with actual source/built fork/occurrence/pixel joins and explicit historical-environment limits (#221).
- Correct checkbox/radio normal icon IDs from the pinned kDEF table, and retry checked art at the same tier only when the mixed `ics#` mask is absent. Expose a same-fork mask census; reject short/duplicate masks or contradictory catalogs while retaining unobserved manual-theme compatibility.

- Select mixed checkbox/radio CICNs before the source-defined same-tier checked fallback; preserve existing active-state and icon compatibility fallbacks. Add literal public-loader source/built state and ownership checks.

- Reject resource-fork reads beyond declared data/map sections even when trailing file bytes are readable; preserve empty lists, zero-length resources and valid corpus decoding.

- Extend existing push/bevel corpus checks with deduplicated tiny-height corner/side overlap cases at public width anchors, retaining all prior cases and unresolved provider/body limits (#221).

- Check omitted empty-label push/bevel dimensions across the existing corpus and declared-cinf tuples, preserving explicit-size cases and unknown fidelity boundaries; automatic dimensions remain modern public policy (#221).

- Exercise the 87 default missing-cinf push/bevel tuples with a separately declared owned cinf-0 provider in the existing source/built boundary harness; preserve default unknown rows and historical-provider limits (#221).

- Add an opt-in prepared cinf-only provider environment for standalone push/bevel faces, with separate consumed-owner diagnostics and explicit unknown/unsupported results; preserve common metadata and default loading behavior (#221).

- Add declared known-origin pattern full-face checks to the existing source/built border groups, binding actual ppat bytes and independent control-body phase while retaining unknown-origin invocations and original environment limits (#221).

- Extend existing border-boundary checks to conditional solid-body full face rectangles using bound raw background samples, actual modern null-pattern admission and explicitly transparent initialization; retain pattern/missing-cinf cases and original environment claims as unresolved (#221).

- Specify the source-derived cinf same-ID/default lookup sequence with synthetic conditional fixtures and explicit unknown provider environments; correct `$A9A0` to GetResource in the source reference without changing runtime loading or injecting defaults (#221).

- Add finite source/built push and bevel border-size checks across all 18 inputs, with independent opaque-writer coordinates, exact input/paint joins and explicit unreachable or unknown cases; broader fidelity and ledger closure remain OPEN (#221).

- Reject truncated wnd# counts/records and invalid negative list counts before decoding fabricated window geometry; preserve the signed empty sentinel and valid corpus outputs (#330).

- Add opt-in exact window construction byte provenance for sliced recipes and explicitly synthetic corner-sprite windows; carry those occurrence links into the full-envelope inventory without changing default manifests or paint.

- Bind all 18 sources and the full draft acceptance envelope to repeatable modern loader/resource/window-key inventories, retaining duplicate/error occurrences and explicit canonical-versus-loader selection comparisons. No fidelity or coverage promotion.

- Record a quarantined executed font-result and RAM-strike follow-up for the existing AgjpQy research note; retain cache/provider, whole-font and pixel-contribution limits without new intake or runtime claims (#221, #190, #315).

- Materialize a DRAFT acceptance envelope for all 18 source references and 15 contracted families across 33 public family/path bindings, preserving unresolved options, boundaries and evidence without coverage or closure claims.

- Admit direct full-color whole-header pattern bodies with explicit known pattern-origin state, shared original-Rect phase and clipped inset union; retain unsupported mode5, device/cache and unknown-origin paths.

- Support whole-header one-pixel line colors through the existing owner-bound sampled companion, preserving strict missing-data, mask and device-policy limits. Resolve only the existing collision sampled-color obligation in ledger1.8.0 (51 verified,218 unknown; all32 cases OPEN).

- Qualify the historical chrome QA punchlist and unversioned previews as visual context, preserving its findings without implying current all-type fidelity certification.

- Record exact pinned-source reproduction of the preserved emulator JS/WASM, with sanitized build identities and explicit unintegrated-observer/provider limits.

- Propose a full 18-scheme acceptance inventory with explicit API paths, option classes and unresolved boundary obligations; preserve existing evidence and open closure.

- Preserve one quarantined System7 AgjpQy observation and exact conditional public prepared-strike comparison, with public metrics and explicit provider/whole-font limits (#221, #190, #315).

- Document #315’s later exact public prepared-strike O/K comparison alongside the unchanged historical candidate observation and its provider/whole-font limits.

- Add one scoped Lisa normal-face reference with its measured 22-color profile, exact recorded-output comparison and stopped-export guidance; preserve prior scopes and broad unknowns.

- Add one scoped Crayon normal-face observation and exact recorded-profile comparison with explicit port placement. Original pattern phase/provider/mask and whole-request obligations remain unknown; existing six attestations retain their semantic bindings.

- Bind reference attestations to request-specific semantics and versioned eligibility rules, retaining global documentation/ledger versions as provenance. Preserve prior attestations through one reviewed metadata migration; admission outcomes and original artifacts stay unchanged.

- Register two existing prepared bitmap-font SOURCE assertions: declared strike identity, signed source pen and literal clipped mask paint. Ledger 1.5.0 keeps original typography/provider unknown; authority 0.1.11 requires metadata-only reference re-attestation.

### Added (2026-10-19)

- Add opt-in prepared bitmap strikes for single-line plain push labels, with
  immutable caller-owned identity, explicit glyph mappings, source-derived pen
  placement and completed clipped-ink diagnostics. Browser fonts remain the
  default; no original font data or provider certification is included (#314).

### Fixed (2026-10-19)

- Decouple themed push/bevel label size from face height. `fontSize` now accepts
  finite sizes of at least 6px, defaulting to an explicit 12px compatibility
  policy for measurement, foreground and emboss (#310).

### Added (2026-10-19)

- Preserve partial System7 default-item transition observations and clarify that
  `ButtonOptions.default` requests a kDEF-style painter ring, independently of
  DialogManager default selection and Return/Enter handling (#277).

- Track six exact recorded-condition empty button comparisons in the requirement
  ledger, with explicit measured-profile/original-intake/paint/execution bindings.
  Original masks, typography, private selection and broad control fidelity remain
  unknown; existing cases and assessments are unchanged.

- Admit two independently AI-reviewed original empty normal button observations
  for Windows 95 and System 7 under the bounded public-API face scope. Retain
  full frames, exact port/context crops, sanitized logs and recorded conditions;
  all broader requirements remain unresolved and neither whole request is
  satisfied. No original executable/font payloads, runtime change or ledger
  promotion is included (#190).

### Added (2026-10-18)

- Extend the existing empty-face reference scope to four recorded Windows95/System7
  logical-highlight/disabled states in active windows. Preserve normal v1 evidence,
  exact request inputs and every broader unresolved requirement; v2 excludes
  physical gestures and inactive-window claims. Admit four separately reviewed
  original observations and reuse existing profile comparisons for all six faces (#190).

- Add a narrow versioned reference-review scope for the two fixed empty normal
  Windows 95/System 7 faces. Preserve full context, palette/producer and public
  invocation evidence; report scoped observations separately with every broader
  requirement unresolved. Existing full/default-ring/Crayon gates and the empty
  capture corpus remain unchanged (#190).

- Report completed legacy push/bevel raster paint separately from source-backed
  band diagnostics, including System 7’s no-cinf face. Bind the actual loaded
  resource and clipped pre-label alpha occupancy; suppress aborted/failed paint
  without changing pixels or attributing the compatibility path to kDEF.
  Reuse existing profile renders for exact full-face comparisons against the two
  separately reviewed original observations under their recorded finite profile.

- Add explicit finite display profiles shared by raw theme conversion, browser
  loading and declarative mounts. Preserve exact RGB16 through one joint device
  mapping/producer stage, reject missing mappings before asset allocation, and
  keep the default assets, goldens and source provenance unchanged. The opt-in
  measured two-theme test input remains quarantined partial evidence (#190).

- Support bounded mode-5 color-icon push/bevel bodies: aligned 1:1 color copies,
  conventional one-bit masks, and genuine missing-body erasure. Preserve hidden
  ordinary RGB once through display preparation, exact resource occurrence and
  dependent asset cleanup; keep unsupported/scaled/provider cases explicit (#300).

- Register four exact whole-header and sampled-band requirement cases with
  independent literal pixels and actual owning byte joins (#301). Preserve the
  prior eighteen cases/150 assessments; keep all closures OPEN and explicitly
  separate unsupported header admission from verified source-model pixels.

- Clarify the fixed display LUT as a compatibility policy in source comments and
  historical notes; distinguish extraction/browser preparation from raw decoding
  and independently measured original display conditions (#190).
- Correct expanded push, bevel and default-ring band colors when the original
  palette sampler differs from indexed raster decoding (#296). Keep corners,
  ordinary raster assets and the display LUT unchanged; create occurrence-bound
  sampled companions only after a complete safe pass and decode only painted
  dependencies, with normal cancellation/disposal ownership.

- Add a separate whole-header surface compositor with explicit Rect/state/clip,
  raw background and mask/band composition, and list-view bottom extension before
  clipping (#292). Report unsupported sampling, pattern, special-origin and
  recording/device boundaries explicitly; preserve the existing multi-column
  text helper and distinguish admission work from actual paint diagnostics.

- Register two exact solid-background requirement cases with selected-owner byte
  joins and independent literal fill assertions. Preserve all sixteen prior cases
  and 134 assessments; the eighteen-case inventory remains OPEN with device,
  original ownership and broader geometry unknown (#289).

- Retain bounded indexed cicn sampler/current-display equivalence metadata for
  future source-sampled band admission (#295). Compare actual opaque raster
  colors, preserve occurrence ownership, and report unsafe/ambiguous inputs as
  unknown; existing control pixels and display conversion stay unchanged.

- Promote directly inserted declarative subtree roots and their moved child
  controls, retaining queued additions through theme/preparation barriers. Keep
  initial mount-root semantics and late initial control discovery. Existing
  window hosts now exclude both direct and wrapped late controls; this removes
  the accidental wrapped path that bypassed the documented boundary (#281).

- Correct supported solid push/bevel bodies to use the selected face owner's
  raw background sample beneath mask holes and opaque palette collisions. Keep
  pattern priority, explicit unsupported/legacy fallbacks and the existing LUT.

- Reconcile the control-face and kDEF reference notes with delivered full-color
  pattern and raw RGB16 text/background behavior. Preserve remaining device,
  font, transfer and list-header limits; refresh only the three affected
  availability document pins without changing its 27 cases or outcomes.

- Record the independent public Dialog Manager, kDEF default-data, and PACH
  FrameRoundRect contracts. Pin exact pen/color/erase guards without assigning
  the quarantined default-border observations to an unobserved painter (#277).

- Extend the partial rendering requirement inventory to sixteen exact direct
  cases, with bounded authored RGB16 text/emboss and pattern phase/clip evidence.
  Preserve the original eight cases, all OPEN closures and explicit unknown
  typography, transfer, device and original-port requirements. Synchronize draft
  authority 0.1.4 with the unchanged 13 capture requests (#274).

- Reject requirement assessments backed only by unrelated archive or synthetic
  inputs, while retaining general engine rules and explicitly shared source
  evidence. This adds an association guard without promoting any fidelity claim
  or changing the reviewed inventory (#274).

- Bind interactive push-button patterns to committed managed content ports, with
  explicit context/scale ownership, paired state repaint epochs and finite shared
  tracking. Same-mount declared buttons follow window scroll and reparenting;
  imperative binding is opt-in and exposes unsupported/pending states (#270).

- Preserve failed browser-test attachments and their hashes outside the next
  run's replaceable output, including original failure metadata and explicit
  incomplete-copy reporting. Slider lifetime probes measure the current canvas
  atomically across its initial repaint.

- Preserve four public Dialog Manager default-button observations as quarantined
  partial research. API/Return behavior is recorded separately from unknown
  border attribution; native images and fixture pins do not admit references
  or change rendering expectations (#190, #221).

- Preserve six original-environment control observations as quarantined partial
  research, with native frames, fixture sources, external input/tool pins and
  integrity checks. Palette/provider/font gaps remain open; reference intake
  still has no admitted captures or approvals (#190).

- Add opt-in tab paint diagnostics with actual selected owner/resource occurrence,
  source-band versus legacy branch reasons and independent byte-join negatives.
  Preserve output, decode counts and theme ownership; no fidelity assessment is
  promoted (#284).

- Portable browser-observation metadata binds the actual checkout, built assets
  and browser version. Environment commit claims and supplied metadata cannot
  silently replace observed execution identity; this remains regression evidence.

- Extend opt-in byte provenance to actual `ppat` catalog occurrences and preserve raw signed `cinf` body requests, including zero; no pattern-paint claim or rendering change (#260).

- Clean installed-tarball consumer check: strict public declaration resolution,
  isolated production bundling, real archive loading/native interaction and
  teardown, with missing assets and declaration-escape negatives in pinned CI.

- Reviewed exact source inputs for all 18 bundled schemes, with independent
  archive inventories/extraction hashes, explicit raw-source boundaries and
  tamper checks. This approves contract inputs, not original lookup or rendering.

- Versioned fidelity compatibility-contract draft defining proposed source inputs,
  family boundaries, evidence obligations and explicit substitutions. Its target
  remains OPEN; partial requirement and availability inventories do not establish
  an overall fidelity percentage.

- Corrected source evidence for cinf body dispatch and a reproducible raw-field
  survey of all 18 pinned scheme forks. Pixel-pattern fills apply outside mode5;
  mode5 requests color-icon art. Rendering behavior remains unchanged.

- Opt-in actual load-byte provenance joins selected control resources to archive,
  chosen fork and cicn/cinf payload hashes without default-path hashing. Frozen
  per-load evidence distinguishes inherited owners and concurrent loads; ambiguous
  duplicate asset bindings reject diagnostic loads instead of claiming a false join.

- Interactive period-ad landing with five live themed portrait windows, scheme
  switching and composition resets; the previous demonstration remains available
  at `showcase.html`, including legacy theme links. ([#245](https://github.com/khawkins98/scriptoscope/pull/245))

- Finite independently reviewed control availability expectations: 26 API-policy
  outcomes plus an explicit unknown, checked against actual source/built resource
  traces, pinned archive evidence and native fallback keyboard behavior.

- Versioned partial fidelity requirement inventory for eight exact control cases,
  with independent evidence, explicit unknown obligations, live mismatch tracking
  and CI reports separating reviewed requirements from actual test executions.

- Opt-in per-render resource-selection traces for push/default and bevel buttons,
  including actual owner/IDs, compatibility fallbacks and ring reservation versus
  paint. Direct matrix evidence records these observations separately from fidelity.

- Reviewed Linux control-rendering regression seed: 36 bounded contact sheets,
  pinned input provenance and explicit known fidelity/interaction limits, with
  exact comparisons in CI and optional missing-file/one-pixel failure probes.

- Compact rendering observations retained on successful and failed CI runs,
  including executed availability/dimensions and explicit fidelity limits.

- Reusable public-runtime control matrix with bounded and extended option cases,
  raw-art references, promoted DOM/style metadata, and grid/flex window fixtures
  for source-backed assertions and reviewed contact sheets (refs #213).

- Pinned browser CI for rendering-option contracts across the theme corpus,
  source and built entries, real promoted DOM, and independent source-art checks.
  Explicit Linux golden recording/verification preserves reviewable failure evidence.

- Explicit `ThemeEntry.meta` support for catalogs carrying a complete provenance
  sidecar; picker display labels no longer substitute for origin/license metadata.
  ([#198](https://github.com/khawkins98/scriptoscope/pull/198))
- Idempotent `ThemeResolver.dispose()` and mount-owned resource cleanup. Registered
  themes and their base chains remain caller-owned.
  ([#202](https://github.com/khawkins98/scriptoscope/pull/202))

### Changed (2026-10-18)

- Contributor and architecture guidance documents rendering acceptance, pinned
  golden review, and explicit fidelity limits. Historical ring-outset and cinf
  slicing heuristics are marked superseded by the verified source model.

- Background theme-picker previews decode only folder icons instead of complete
  schemes, reducing conversion work and asset allocation while retaining the
  source archives and icon fallback semantics.
  ([#201](https://github.com/khawkins98/scriptoscope/pull/201))
- Development tooling uses Vite 7 and Node.js 24. The library build explicitly
  preserves the previous browser target.
  ([#194](https://github.com/khawkins98/scriptoscope/pull/194))
- Updated architecture, integration, and vendoring guidance, including sibling
  lazy chunks and resource ownership; preserved superseded historical notes.
  ([#204](https://github.com/khawkins98/scriptoscope/pull/204))

### Documentation (2026-10-18)

- Clarify harness-driven development, regression versus fidelity evidence, and
  focused validation without redundant full-suite runs; retain required checks.

- Provisional independent reference-capture requests and evidence intake checks:
  exact source/condition/provenance bindings, separate independent review, known
  self-image contamination checks, and an honest report of thirteen missing
  captures. Nonzero-port experiments require reviewed direct invocation and
  observed pattern-origin state. Author previews and selfgoldens remain
  non-independent evidence.

- Reconcile the fidelity plan with delivered solid-face geometry and loaded-byte
  provenance; keep remaining decoder, pattern and reference requirements explicit.
  Correct the charter's landing/showcase paths and active reference tracking.

- Pin the PACH tab-investigation resources to a reconstructed installer/fork
  chain; preserve the unresolved body-painter and color-sample requirements.

### Fixed (2026-10-18)

- Render supported tab bodies with full-raster end strips, cinf-selected repeated
  bands and a separate solid center, preserving 1138/1990 middle strips without
  stretching semantic color markers. Pattern-backed centers and original tab
  typography remain explicit limitations (#223). The two existing exact tab
  geometry assessments now have source-backed executable acceptance; all other
  132 assessments and all OPEN case inventories are preserved.

- Push and bevel labels use their selected cicn/cinf RGB16 text samples and
  optional emboss pass, preserving masked colors and exact sentinel decisions
  before PNG transport; explicit foreground overrides remain supported.

- Resolve canonical, legacy and raw window identities before resource fallback,
  preserving authored collapsed utility chrome in sliced and corner-sprite
  themes. Keep exact custom names, emitted manifest keys and child/base policy.

- Declarative button teardown restores original native elements, display and focus;
  removes owned faces/listeners across retheme and insertion-observer races; and
  cancels pending theme/face work without adopting moved sources. The showcase
  No Theme/Restore flow preserves native form values and mounts one face per button.

- Paint full-color push/bevel pattern bodies from the actual face owner with explicit logical-port context, continuous corner-anchored phase, byte-linked diagnostics and cancellable preparation. Carry decoder-order pattern bindings even for numeric names and raw ID0; mounted layout propagation remains active separately (#218, #270).

- Native slider composition stops at disposal boundaries between image decodes;
  a held track cannot resume and request a thumb after owned theme URLs revoke.
  Native restoration stays synchronous; public/imperative rendering is unchanged.

- Packed public types now include the browser-loader declaration referenced by
  the root entrypoint, with its LoadedTheme import pointing at emitted types.
  Clean TypeScript consumers no longer need repository files or skipLibCheck.


- Promoted range pointer hit testing now uses the geometry that drew its canvas.
  Stationary thumb grabs preserve exact native values, dragging retains grab
  offsets, and track clicks center the thumb without changing imperative slider
  or scrollbar mapping. Late paints cannot replace newer hit geometry.

- Promoted ranges retain native keyboard and accessibility semantics: fractional
  steps, numeric bounds, `step="any"`, effective disabled fieldsets and live labels.
  Pointer values use native sanitization, with change only on a changed drag
  commit; live attributes/reset refresh the art and teardown releases owned work.
  The imperative normalized slider API is unchanged.

- Restore promoted checkbox/radio/range/select carriers on disconnect while
  preserving live form state and consumer attributes. Retheme and teardown release
  old face/global drag listeners and pending paints, cancel unfinished promotion,
  and remove mount-owned theme-switcher wiring (#232).

- Overlapping theme requests no longer let delayed chrome replace a newer window
  batch. Window preparation is isolated from live canvases, failed newer requests
  cannot revive superseded work, and declarative completion/default/URL updates
  follow successful work. Dynamic scans join the current request boundary; native
  focus and state survive face replacement. Direct public button/tab preparation
  remains usable in disconnected fragments; reentrant button insertion disposes
  discarded faces without leaving duplicate controls. (Refs #237.)

- Promoted range sliders retain associated labels and explicit ARIA naming,
  including naming precedence and live label references after retheming (#229).

- Indexed cicn decoding now respects ColorSpec pixel-value mappings and rejects
  truncated or impossible row layouts before pixel allocation. Independent
  byte fixtures cover masks, four depths and palette flags; all 3,325 pinned
  corpus images retain their exact decoded pixels. ([#256](https://github.com/khawkins98/scriptoscope/issues/256))

- Solid push and bevel faces with explicit cinf metadata now use square corners,
  independent masked edge bands and the source-defined inset-union body fill.
  Pattern-backed faces and list headers remain tracked separately under #218.

- Decode indexed pixel patterns using their explicit color-table offset and
  flag-dependent pixel-value mapping; unsupported destination-palette tables
  are skipped instead of using unrelated stored RGB colors.

- Fixed Firefox startup in the extended rendering workflow by matching the
  container user to its mounted home. Browser launch preflight now fails before
  running the matrix; optional focused workflow reruns retain the full default.

- Slider canvases retain the complete authored thumb cell and center the groove
  and thumb across their combined thickness, fixing clipped Windows 95 handles
  in horizontal and vertical orientations (refs #222).

- Corrected the rendering matrix tab fixture to place the tab strip before its
  panels, matching consumer markup and avoiding a misleading contact-sheet layout.

- Default-button rings use the original four-pixel outset, complete source raster,
  square corners, and independently thick masked edge bands. Pressed defaults
  select their authored ring when available. This removes Windows 95's detached
  bracket and preserves overlapping ring art in schemes such as 1990.

- Promoted selects keep one native keyboard target and show its focus indicator
  on the visible wrapper. Decorative faces stay out of the tab order and
  accessibility tree when their selected label is repainted.

- Solid button, bevel, and list-header faces sample their authored cinf background
  pixel instead of a guessed offset from the text marker. Windows 95 normal and
  disabled faces now use the source gray rather than white border pixels. Face
  fallbacks retain the selected resource's own slicing/sample metadata.

- Scope the optional window shadow to the actual rendered window part, including
  imperative windows and hosts stretched by consumer grid/flex layouts. Promoted buttons, selects, and checkables no longer receive an extra
  rectangular shadow over their scheme-authored art (related to #207).

- Share Scene info-bar background/text resolution between the diagnostic and its
  audit so textured bars report their actual black label instead of unused dark
  header-fill contrast. Rendering precedence stays unchanged (related to #183).

- Gate the boot wipe on inert targets so pending window content stays visible
  while keyboard focus remains available.

- Inventory every source resource in extraction diagnostics, with explicit skipped
  types, consumed header palettes, and totals that match the resource fork (#179).

- Tiny resizable button templates now use the standard face height when their
  label would otherwise be clipped. Fixes squashed Windows 95 showcase buttons
  and closed selects, including the press-state size jump; Apple Lisa and Windows
  3.1 push-button templates and undersized bevel labels receive the same general
  correction. Explicit heights are preserved.
  ([#207](https://github.com/khawkins98/scriptoscope/issues/207))

- Include lazy library chunks in the public deployment, extract archive-only
  themes locally, and release picker listeners/timers on teardown. Repair the
  boot smoke harness's server and browser cleanup.
  ([#192](https://github.com/khawkins98/scriptoscope/pull/192))
- Resolve utility-window aliases from canonical resource identity, including
  opaque asset URLs and legacy raw keys.
  ([#195](https://github.com/khawkins98/scriptoscope/pull/195))
- Evict rejected theme/raster promises to permit retry, and release assets from
  partially failed concurrent encodes.
  ([#196](https://github.com/khawkins98/scriptoscope/pull/196))
- Allocate whole tiles with the kDEF's two-pass division/remainder rules,
  preserving frame corners and avoiding rounding-induced gaps or clipping.
  ([#197](https://github.com/khawkins98/scriptoscope/pull/197))
- Prefer each theme's own button face before inheriting a base theme's named face.
  ([#200](https://github.com/khawkins98/scriptoscope/pull/200))
- Prepare window chrome before moving live content. Preserve layout/focus during
  setup and respect cancellation, removal, reparenting, failure, and immediate
  remount without stale commits.
  ([#199](https://github.com/khawkins98/scriptoscope/pull/199))
- Evict released raster URLs across raw and bundled loader copies; late loads
  clean up after disconnect without disposing caller-registered theme graphs.
  ([#202](https://github.com/khawkins98/scriptoscope/pull/202))
- Capture the diagnostic Scene using an isolated server and compare fresh scratch
  captures against committed fixtures. Refresh all 18 browser scene baselines;
  failed verification never overwrites them.
  ([#203](https://github.com/khawkins98/scriptoscope/pull/203))
- Constrain mobile showcase/blog grids and upload-modal measurements, reserve
  room for native chrome and card cascades, and keep Restore chrome mounted.
  ([#205](https://github.com/khawkins98/scriptoscope/pull/205))

### Security (2026-10-18)

- Refresh locked development dependency security patches and upgrade the vulnerable
  Vite/esbuild toolchain through the Vite 7 migration.
  ([#193](https://github.com/khawkins98/scriptoscope/pull/193),
  [#194](https://github.com/khawkins98/scriptoscope/pull/194))

### Fixed (rendering — 18 themes refreshed via the codex pattern, 2026-05-29)

The decoded `ThemeManifest` carries structured answers for every visual slot;
the runtime was guessing or hardcoding in many places. The fixes below all
share the same shape: **read the manifest field instead**. Captured in
`LEARNINGS.md`'s "codex pattern" entry as a 16-row table.

- `controls.ts:elementById` — resolve by `chromeElement.sourceCicnId` (numeric)
  instead of regex-on-asset-path. Asset paths become `blob:` URLs under the
  Option A in-memory load; the regex matched nothing, every `elementById` call
  returned null, buttons / default-rings / textAnchors silently un-themed.
- Default-button ring outset uses `(ring.width - face.width) / 2` (the
  artist-authored halo) when ring > face, instead of `ring.width / 4`. Crayon-os
  (ring 80×80 / face 74×74) went from 20px outset to the authored 3.
- `pixelBuffer.nineSlice` honours `slice.tile: true` (repeat side bands at
  native pixel rate rather than stretching). Wired into `composeFaceButton` +
  ring + `composeProgress` frame + `composeTab` middle + `composeScrollbar` +
  `composeSlider` tracks. Apple-lisa Lisa-frame, windows-31 double-rectangle
  border, crayon-os crayon-stroke patterns all preserved at button-display size.
- `pixelBuffer.nineSlice` honours `slice.side` for vertical inset (was
  collapsed to corner=side everywhere). The kDEF TMPL 129 declares them
  independently; 1138 / 1984 / animals / apple-lisa / dolphin-som etc. all
  have button-family elements with non-square slices.
- `pixelBuffer.nineSlice` clamps `(l+r) ≤ sr.w` and `(t+b) ≤ sr.h` —
  unclamped, the negative middle silently corrupted (corner blits overlapped,
  side spans early-returned) on 1990 + evolution rings authored as 21×21 with
  `slice.side=14`. The buggy renders briefly shipped before this clamp.
- `composeChrome.titleFillRgb` samples the kDEF 0x5530 title-text marker
  pixel; `renderWindow` uses the sampled colour when it contrasts with the
  bar (|markerLum − barLum| > 40), else falls back to the luminance-contrast
  B/W pick. Windows-31 "Hello!" now draws (the marker pixel sits on the dark
  blue title bg; contrast-rejection routes to the white fallback).
- `resolveTitleWidgetRects` maps source-x widget positions through the
  per-cell placement record to output-x. 1990's widgets stacked left of a
  growable title plate were claimed to be at source x=56-64 when the plate's
  growth had shifted them to output x≈92-100; the title-fit math saw negative
  available width and dropped the title. The `mapX(sx)` per-cell mapping now
  produces correct output positions; 1990 / apple-lisa / windows-31 "Hello!"
  all render.
- `loadTheme` preserves `bundleUrl` as `theme.baseUrl` (was `''` under
  Option A's in-memory decode). The empty key collapsed every theme into the
  first-loaded theme's slot in `_gridCache` / `_iconCache` /
  `interactive.titleStripCache` — 1138's folder icons leaked into 1984's
  Scene preview.

### Fixed (controls — push-button face resolves by manifest role, 2026-05-29)

- `composeButton` now resolves the push-button face via the manifest's
  STRUCTURED chromeElement key (`push-button-active` / `active-push-button`
  / `active-button` / `push-button`) first; falls back to id-based lookup
  that REJECTS anti-role keys (`/menu|tab-pane|pull-down|popup|window|dialog|scroll/`).
  When no active face exists, substitutes the pressed face — the
  AppearanceManager's documented "empty state slot" fallback. Resolves the
  long-deferred **monkey-paradise + animals** misroute: both bundles assign
  id -10239 to `solo-menu-background-2` and ship NO active push-button cicn
  (only pressed + inactive). Their OK button slot rendered menu wallpaper;
  it now renders the pressed-button face the author shipped. Logged in the
  kdef faithfulness ledger as an Accepted Divergence.

### Fixed (Scene composition — `demo/index.html` + slot wiring)

- Info bar lookup: `chromeElement(-9567).bgPattern` → `bodyBackground.pattern`
  → `headerColors.active.fill` → flat. Replaces the hardcoded `#e6e6e6`.
  Every theme now lands above the hard fallback. monkey-paradise's
  `ppat-129` (declared via cinf), 1990's army-camo, slimes' lemon-lime
  header fill — all picked up from the structured field rather than guessed.
- Volume icon lookup: `ics4/8 -3790` → `ics4/8 -14336` → `FINDER_GRID_PNG`.
  Slimes / floppies / apple-platinum-2 / platinum-8 / system7-nostalgia-
  silver pick up their theme-mark on `-14336` when `-3790` isn't shipped.
- Info-bar text colour contrast-picks against the resolved background
  luminance instead of hardcoded `#000`. Black-platinum / Windows-ports
  dark fills are legible now.
- `schemeIcons` excludes well-known document ids (Clippings -3800..-3803,
  Edition File -3989, App badge -16455) from coverage-rank, and drops the
  non-folder last-resort ids from the folder priority list. Apple-platinum-2
  + system7-nostalgia-silver fall through to neutral SVG folders instead
  of showing the Earth icon / App badge.
- Desktop pattern: adds `ppat-17` (Apple-reserved Mac OS canonical id) as
  T2 in the lookup. 1990 / animals / monkey-paradise / evolution / crayon-os
  ship it; previously fell to the CSS checkerboard.
- `renderWindow.bodyBackgroundStyle` skips the Icon-View ppat for modal-
  style windowTypes (`UTILITY_SLUG_RE = /utility|mini|floating|palette|dialog|alert|modal|popup/`).
  The Options dialog body across every textured-body theme stopped filling
  with the army-camo / aqua / etc and now matches the references' flat
  utility surface.
- 3-tone procedural pinstripe via `lightTinge → fill → darkTinge` (was
  only `darkTinge`; `lightTinge` was decoded but unconsumed). Only the
  `buildBaselineWindow` procedural path is affected; corner-sprite + sliced
  paths use their own pinstripe sprites.
- Scene geometry: `winW: 178 → 220` so multi-word volume names fit;
  `dlgTop: mainTop + 2` so the Options dialog stops covering windows-31's
  title bar entirely.

### Fixed (loadTheme + cascade hardening)

- `fetchFirst` rejects 200-with-bad-bytes (HTML SPA fallback) and continues
  the `.sit → .rsrc` cascade. Without it, a misconfigured CDN serving HTML
  for missing files made `parseResourceFork` explode with
  `dataOffset=1008813135` instead of falling through.
- `loadKaleidoscopeScheme` default asset factory adds a main-thread
  `<canvas>` fallback for Safari 16.0–16.3 (where `OffscreenCanvas` is
  undefined). Without it, ~5% of iOS traffic returned a broken `LoadedTheme`
  with un-rewritten asset paths.

### Added

- **Codex framework** — three coupled artifacts for "stop guessing, read
  the manifest field" discipline:
  - `scripts/scene-coverage-audit.mjs` — walks every bundle's decoded
    manifest, runs each Scene SLOT's tier resolver, prints per-theme
    table; modes: console / `--write` / `--json` / `--check` / `--theme=`.
  - `docs/scene-slot-spec.md` — hand-authored slot contract: 8 slots
    each with tier hierarchy, why each tier exists, where the runtime /
    demo implements it.
  - `docs/scene-codex.md` — auto-generated; committed; the corpus-wide
    audit. Per-theme tier table + tier distribution per slot + shipped
    resource counts + variant flags.
- `tests/visual-baselines/scenes/<slug>.png` — committed Scene-panel
  fixtures per theme. Regen via `npm run baseline:scenes`. Eyeball
  comparison net against the per-theme reference for "the path ran but
  produced empty / wrong-looking output" regressions (lint can't catch).
- `themes/lint-baseline.json` — sha256 + decoded-manifest fingerprint
  per slug from the maintainer's last full lint run. Default
  `npm run lint:themes` is fast-verify against this baseline;
  `--update` re-runs the slow rule walk; `--strict` re-decodes + checks
  the decoded fingerprint (CI signal).
- `npm run audit:scenes` — codex audit; `-- --check` is the CI signal
  for slot floor.
- `npm run baseline:scenes` — re-capture all 18 scene fixtures.
- New `ChromeElement` type fields, JSDoc-documented: `sourceCicnId`,
  `sourceCinfId`, `bgPattern`, `bgAnchor`, `embossAnchor`.
- New `ThemeManifest.patterns` field — the catalog of decoded ppats
  keyed by slug.
- New `ThemeProgressModel`, `ThemeScrollArrowMap` types covering the
  inspector catalog's role-classification shapes.
- `ButtonOptions.height` — caller-supplied override for the button face
  height. Without it, themes with big face cicns (crayon-os 74×74) blow
  up to 80-tall buttons. The demo passes `height: 22` for tab-sized
  cells.
- `LoadedTheme.dispose?: () => void` — revokes blob: URLs minted at
  decode (~500 per scheme). Without it, switching themes 50× leaks
  ~25k blob URLs.
- `loadTheme(url, opts.source?: string)` — hint to skip the
  `.sit → .rsrc` cascade. Catalog's `themes-manifest.json` carries
  the `source` field per slug; demo's `loadWithBase` passes it.

### Changed (renderer surface)

- `composeChrome` returns new `titleFillRgb` field on `ComposedChrome`
  (the sampled marker colour or null). Backwards-compat (optional).
- `bodyBackgroundStyle` now takes an optional `slug` parameter so it
  can gate the Icon-View ppat by windowType. Shared
  `UTILITY_SLUG_RE` between `renderWindow` and the body-bg style.

### Changed

- **Theme bundles ship only the original archive** (Option A migration, 2026-05-29).
  Per-bundle contents went from `{scheme.rsrc, theme.json, cicns/, ppats/, icons/,
  resource-roles.json, rasters.json, extraction-manifest.json, meta.json, PROVENANCE.md}`
  to just `{scheme.sit | scheme.rsrc, meta.json, PROVENANCE.md}`. The runtime decodes
  the archive in-browser via the bundled StuffIt + Kaleidoscope decoders — same path
  the demo's drop-zone has used since 2026-05-27. Repo footprint dropped from ~55 MB
  to 6.3 MB across 18 bundles. Per-bundle wire weight halved (the `.sit` averages
  ~30–50% of the unwrapped fork size). Per-load decode cost ~234 ms on a fast machine
  (Promise.all-parallelised OffscreenCanvas encoding); cached after first hit.
- **`loadTheme(bundleUrl, opts?)` gains `opts.source`** — a hint that names which file
  to fetch (`'scheme.sit' | 'scheme.rsrc' | string`). Skips the cascade and the 404
  noise when a bundle ships only one form. The demo reads it from `themes-manifest.json`'s
  new `source` field per slug.
- **Control resolution uses `chromeElement.sourceCicnId` rather than parsing the asset path.**
  Path strings get rewritten to `blob:` URLs by `rewriteAssetRefs`, so the old
  `/cicn-n?-?(\d+)/` regex broke silently — every `elementById` call returned null and
  default-button rings / scrollbar arrows / textAnchors went un-themed. The decoder
  already writes `sourceCicnId` on every element; the runtime now reads it directly.
  Full story in `LEARNINGS.md`'s 2026-05-29 entry.
- **`loadTheme` preserves the consumer-passed URL as `theme.baseUrl`** instead of
  inheriting the decoder's `''` default — `interactive.ts`'s title-strip cache and
  the demo's per-theme icon caches key on `baseUrl`, so an empty key was collapsing
  every theme into the first-loaded theme's identity (1138's folder icons leaking
  into 1984's Scene preview).

### Added

- **In-memory inspector catalog** on `LoadedTheme.inspector` — `iconIndex` + `cicns` +
  `ppats` + `resourceRoles`, each with baked-in blob URLs. Mirrors the on-disk shapes
  the demo's diagnostic panels used to fetch (`icons/index.json`, `rasters.json`,
  `resource-roles.json`). Built by `loadKaleidoscopeScheme` for browser callers; pure
  JS, no extra fetches.
- **`loadKaleidoscopeScheme` re-exported from `'scriptoscope'`** — the in-browser
  `.sit`/`.rsrc` decoder is reachable through the npm-package entry without crossing
  into `tools/theme-loader/` paths. Returns the same `LoadedTheme` `loadTheme` does.
- **`tests/visual-baselines/scenes/<slug>.png`** — committed Scene-panel fixtures per
  theme. Regen via `npm run baseline:scenes`. Eyeball comparison net for renderer
  regressions of the un-themed-but-no-error class.
- **`themes/lint-baseline.json`** — committed sha256 + status per slug from the
  maintainer's last full lint run. Default `npm run lint:themes` is a fast verify
  pass against this baseline; `--update` re-runs the slow rule walk; `--strict`
  exits 1 on drift (CI signal).
- **`tools/theme-loader/classifyResources.js`** — the portable id → role rubric,
  shared between the bake pipeline and the runtime inspector. Closes the dual-channel
  trap (same id different roles per scheme + per cicn/ics4 channel).
- **`fetchFirst` cascade hardening** in `loadTheme` — rejects 200-with-bad-bytes (HTML
  SPA fallback responses) and continues to the `.rsrc` alternative, instead of
  consuming the HTML and exploding deep in `parseResourceFork`.

### Removed

- `apple-platinum-replica` bundle — was a generated universal base that retired when
  the in-memory decode replaced its main consumer (the sparse-bundle inheritance hop).
  `mountDeclarative({ baseSlug })` callers can pick any other shipped slug as the base.
- The on-disk parity test in `tools/theme-loader/convert.test.mjs`. The replacement is
  the in-memory shape test (asserts every asset rewrites to a URL, inspector populates)
  + the lint baseline sha256.

## [0.0.1] — 2026-05-28

**First publish-prep cut.** No code changes from the prior committed state — this is the
mechanical packaging pass that gets the project on npm. The runtime is already feature-rich
(Phase 3 controls vocabulary shipped; declarative front door + Shadow DOM + persistence +
themed scrollbars + tabs + text fields + a four-page demo suite); this version exists so
consumers can `npm install scriptoscope` and start integrating.

### Renamed

- Project: **Aaron UI → Scriptoscope**. Rationale + scope in `LEARNINGS.md` 2026-05-28
  ("Scriptoscope pivot"). Forcing function: the `aaron-ui` npm name was taken by an
  unrelated package, so the publish couldn't go bare under the prior brand.
- Package: `scriptoscope` (was `aaron-ui`, never published under that name).
- Build artifacts: `dist/aaron-ui.js` → `dist/scriptoscope.js`, `src/aaron-ui.css` →
  `src/scriptoscope.css`, exports map updated.
- The GitHub repo (`khawkins98/aaron-ui`) and the GH Pages URL (`/aaron-ui/`) stay as-is
  for now — independent pivot, not coupled to the npm rename.

### Preserved (deliberate API stability)

- `data-aaron-*` consumer attribute namespace (window/title/x/y/width/height/state/
  button/default/control/field/tabs/etc.). Renaming this would be an API break with
  marginal brand value.
- `.aw-*` CSS class prefix (`.aw-window`, `.aw-content`, `.aw-button`, `.aw-chrome`, etc.).
- `AaronWindow` class name, exported from the declarative entry.
- Same model as underscore.js → Lodash keeping `_`.

### Tarball scope

- Slim: `dist/` + `README.md` + `LICENSE` + `CHANGELOG.md`. **NOT** included: `src/`,
  `themes/`, `PRD.md`, `LEARNINGS.md`, `docs/`, `tools/`. Consumers use the built
  `dist/scriptoscope.js` and fetch themes from a base URL they host. Packaged size:
  ~239 KB; unpacked ~782 KB (sourcemaps + .d.ts.map files account for the bulk of the
  unpacked footprint — kept for IDE jump-to-definition).

### License

- MIT (decided in #26; first-party code only). The slim tarball ships only `dist/` + the
  three top-level docs, so per-scheme freeware terms (themes), munbox MIT (sit-wasm),
  and demo-font terms (CC BY-SA / free-with-credit) are repo-level concerns — relevant
  for source-tree contributors, not consumers of the published package.

### Status

- Pre-alpha. The declarative API surface is the most stable; the imperative API
  (`loadTheme()`, `renderWindow()`, `WindowManager`) is also stable but may grow.
- 0.0.x cadence intentional — see `LEARNINGS.md` for the prototype-mode commit-cadence rule.

[Unreleased]: https://github.com/khawkins98/aaron-ui/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/khawkins98/aaron-ui/releases/tag/v0.0.1
