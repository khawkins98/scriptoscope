# Aaron UI — Architecture Specification

**Status:** v1.0 — written 2026-05-19 as the single source of truth for Aaron UI's runtime, replacing the accreted multi-document architecture set that came before.

**Audience:** maintainers + external implementers building Kaleidoscope-compatible renderers.

**Primary sources** (in order of authority):

1. **Kaleidoscope 2.3.1 "K2 Scheme Reference"** — the format authors' own document, bundled in `Kaleidoscope Goodies/K2 Scheme Reference` inside the Kaleidoscope 2.3.1 installer. The authoritative format spec.
2. **Scheme Factory 1.0PR2** (Stenger + Rose) — the official scheme editor; its resource fork enumerates the canonical region vocabulary (STR# 128) and the resize-behavior options (MENU 139).
3. **Apple Inside Macintosh: Macintosh Toolbox Essentials, Window Manager chapter** — the WDEF protocol Kaleidoscope implements.
4. **TMPLs embedded in every scheme file** — the binary layout templates Kaleidoscope itself reads against. We extract these from real schemes.
5. **Cross-corpus empirical audit** of 7 schemes (1138, 1990, acid, big-blue, evolution, masswerk-7-le, masswerk-dark-ergobox2) — fills gaps the documents leave open.

**Supersedes** (kept as historical artifacts, not load-bearing going forward):
- `docs/kaleidoscope-geometry-spec.md`
- `docs/chrome-rendering-architecture.md`
- `docs/control-rendering-architecture.md`
- `docs/kaleidoscope-asset-catalog.md`

---

## 1. What Kaleidoscope was, and what Aaron UI is

Kaleidoscope (Arlo Rose + Greg Landweber, 1996–2003) was a third-party **Window Definition Procedure (WDEF) replacement** for classic Mac OS. It hooked into the Window Manager and Appearance Manager, intercepted the `wDraw` / `wHit` / `wCalcRgns` / `wGrow` messages, and rendered chrome from a plug-in **scheme file** (`.ksc`) — a Mac resource fork containing `cicn` color icons, `cinf` geometry info, `wnd#` window-type definitions, `ppat` patterns, and `Colr` scheme settings.

Aaron UI is a **web-native runtime for Kaleidoscope schemes**. It decodes `.ksc` (or `.rsrc`) files in the browser and renders the chrome via DOM + CSS, recreating period Mac OS visuals on arbitrary HTML window sizes.

Aaron UI's runtime is the **only third-party Kaleidoscope renderer ever shipped outside Classic Mac OS** (confirmed via research: even Damien Erambert's 4,000-scheme archive at macthemes.garden renders previews by running real Kaleidoscope in a Mac OS 9 VM via UTM).

---

## 2. The Kaleidoscope resource model

A scheme file contains roughly 270–530 resources across ~19 types. **Five types** carry chrome-rendering data; the rest are file icons, ResEdit templates, About dialogs, or other classic-Mac concerns out of scope.

| Type | Purpose | Aaron UI role |
|---|---|---|
| **`cicn`** | Color icon — bitmap pixels for every chrome element | The raster asset |
| **`cinf`** | "Color INFo" — per-cicn geometry + composition metadata | The 9-slice + fill spec |
| **`wnd#`** | Window definition — per-window-type parts + per-side recipes | Hit-test regions + paint slice boundaries |
| **`ppat`** | Pixel pattern — tileable bitmap | Body-fill textures |
| **`Colr`** | Scheme-level options | Global settings (transparency, scrollbar style, etc.) |

### 2.1 `cinf` — control geometry per cicn

Per `TMPL 129` (embedded in every scheme):

```
Offset  Bytes  Field                 Type
0       1      Corner Size           BYTE
1       1      Side Thickness        BYTE
2       1      Tile Sides            BYTE  (0=stretch first pixel, 1=tile)
3       1      Pattern Anchor        BYTE  (0=no anchor / 1-4 corners / 5=scaled)
4       2      Background Pattern ID DWRD  (ppat ID, 0=none)
6       2      Background Pixel y    DWRD
8       2      Background Pixel x    DWRD
10      2      Text Pixel y          DWRD
12      2      Text Pixel x          DWRD
14      2      Embossing Pixel y     DWRD
16      2      Embossing Pixel x     DWRD
```

Total: **18 bytes per cinf**.

**Per the K2 Scheme Reference**, the canonical meanings:

- **Corner Size / Side Thickness** — 9-slice geometry. Corners pin at native pixel size, sides are `Side Thickness` wide.
- **Tile Sides** — `1` = tile the side strip (slow but supports patterns); `0` = "stretch the first pixel of the side" (fast — a single pixel column expanded to fill the side). Authors recommend `0` whenever possible.
- **Pattern Anchor** — where the *background pattern* sits within the body:
  - `0` = no anchor (no bg pattern, OR pattern tiles from origin)
  - `1` = top-left
  - `2` = top-right
  - `3` = bottom-left
  - `4` = bottom-right
  - `5` = scaled cicn (use a separate cicn as gradient fill — added for Kaleidoscope 2.2+)
- **Background Pattern ID** — ppat resource ID (or cicn ID when `Pattern Anchor = 5`)
- **Text/Background/Embossing Pixel** — sample pixel positions in the cicn from which Kaleidoscope extracts text color, background color, and emboss color

### 2.2 `wnd#` — window-type definition

Per `TMPL 1240`:

```
Rectangle List:
  ZCNT                  2 bytes (count − 1)
  for each entry:
    Part                DWRD (int16, scheme-internal index)
    Rectangle           RECT (4 × int16: top, left, bottom, right) in cicn pixels

Top Side / Bottom Side / Left Side / Right Side (4 lists):
  ZCNT                  2 bytes (count − 1)
  for each entry:
    Part                DWRD
    Border              DWRD  (pixel position along the edge axis)
```

**The rectangle list** names regions in the cicn — typically widgets (close box, zoom box, windowshade) and the body rect. The first entry is conventionally the **body rect** (`part-0`); subsequent entries are widget rects (`part-1` through `part-N`).

**The four side recipes** describe each edge of the window. Each `(part, border)` entry is a **slice boundary** at position `border` (in cicn pixels along the edge axis). The `part` field at each entry identifies what kind of region the SEGMENT starting at that boundary contains (see §3 for part-code semantics).

**The body rect (`part-0`) gives the frame thicknesses** — top thickness = `rect.top`, left = `rect.left`, right = `cicnW − rect.right`, bottom = `cicnH − rect.bottom`. This is the most reliable signal for chrome geometry; do not pixel-scan.

### 2.3 `ppat` — pixel patterns

Tileable bitmaps. Used for body backgrounds (referenced via `cinf.bgPatternId`), titlebar pinstripes, scrollbar track stipple, indeterminate-progress barber pole. Aaron UI decodes ppats to PNGs at extraction time.

### 2.4 `Colr` — scheme-level options

Per `TMPL 128`. Flags include:

- "Stretch Scroll Bar Thumb from Center" — controls how the scrollbar thumb stretches under Smart Scrolling
- "Menu highlight cicn overlays normal menu cicn" — toggles how the selected-menu-item cicn composites with the menu background
- "Unified Scroll Bar Track" — track extends behind thumb (vs split-arrows default)
- "Windows-style Scrollbars" — both arrows at one end
- Minimum Kaleidoscope Version — gates feature use (e.g., extended menu borders need $23+)

---

## 3. Part code semantics (the K2 vocabulary)

The wnd# recipe's `part` field is a small integer with **specific, documented semantics**. We had reverse-engineered most of these from cross-scheme audit; the K2 Scheme Reference confirms and clarifies.

| Part code | Semantic | Source |
|---:|---|---|
| **0** | **Null region — does not draw.** Used for "the remainder of a stretch region" trick: split a wide stretch zone into 1px-stretch + (width−1)px part-0 to keep the stretch region fast. | K2 Reference §Speed Note |
| 1–4 | Named widget references — index into the `rectangleList`. Render the rect's bitmap. | K2 Reference §Multiple Widgets |
| 5, 6 | Empirically: divider sandwich — `(N:6)(N+1:5)(N+M:6)` appears around the title pill in every scheme audited. Treat as stretch fill of cicn pixels at segment range. | Cross-scheme audit |
| 8 | Universal stretchable fill — 263 references across all 7 schemes | K2 / audit |
| **18** | **Gradient stretch part — scales the section, stretching each pixel by the same amount.** Used for gradient effects (NEXTSTEP 4, Windows 98 schemes). 437 refs across Acid + evolution. | K2 Reference §Window Gradients |
| 10, 11, 15, 17 | Scheme-specific variants — present in only one or two schemes. Per K2 §Speed Note ("everything but null + tile is stretch") treat as stretch. | Cross-scheme audit |

**Apple's window part codes** (`wInGoAway = 4`, `wInZoomIn = 5`, etc.) are a **separate enum** — the WDEF's `wHit` return values, mapping clicks to standard Mac OS actions. Kaleidoscope's scheme-internal part codes do NOT verbatim equal Apple's part codes; they're translated at runtime via the rectList's conventional ordering. See §6.

---

## 4. The rendering algorithm

This is the section that has shifted the most as we've learned. The authoritative answer per K2:

### 4.1 Speed Note: stretch is the default

> "Tiling parts of icons, while cool, can be slow, so to make your scheme as fast as possible, use stretching instead of tiling wherever you can. For cicn's, turn off the Tile Sides option in the cinf resource whenever it is not needed. For windows, Kaleidoscope runs fastest if the stretch regions are only one pixel high or wide (so it can stretch the pixels instead of tiling them). If a one pixel stretch region does not fit into your window frame, you can split a larger stretch region into two regions, making the first pixel the stretch region and the remainder a null region (part code 0) that does not draw."

**Translation:**
- Default rendering for all segments is **stretch** (CSS `border-image-repeat: stretch`).
- The fastest stretch regions are **1-pixel-wide** (visually = solid bar of that pixel's color).
- Authors broke wider regions into `1-px-stretch + (N−1)-px-null` to keep the stretch path fast.
- Tiling is opt-in via `cinf.tileSides = 1`.

### 4.2 Per-segment rules

For each wnd# recipe entry `(part, border)` paired with the next entry's `border` to define a segment `[border, nextBorder)`:

| Part code | Render behavior |
|---|---|
| `0` | **Don't draw.** Skip this segment entirely. |
| In rectList (1-4) | Stamp the rectangle's bitmap at the segment position at native cicn-pixel size. Hit-test region is the segment range. |
| All others (5, 6, 8, 10, 11, 15, 17, 18) | **Stretch the cicn pixels at the segment's edge slice across the segment's rendered width.** |

For chrome `cicn`'s, this implies:
- **Corners** = explicit recipe segments at edge start + edge end with named-widget or non-zero part codes — pin at native via CSS `border-image-slice`
- **Edges** = interior recipe segments — stretch via CSS `border-image-repeat: stretch`
- **Center** = the body region (defined by `cinf.cornerSize + cinf.sideThickness` OR by `part-0.rect`) — filled by `cinf.bgPattern` if specified, otherwise transparent

### 4.3 Per-control rules (K2 §Buttons, §Menus, §Tabs, etc.)

| Control family | Rule |
|---|---|
| Push buttons / bevel buttons | Standard cicn + cinf 9-slice |
| Checkboxes / radios | No cinf; cicn drawn at native, mask erases excluded pixels per state |
| Menus (pull-down, free) | "Simply stretched" |
| Menu dividers | "Stretched horizontally but not vertically" — corner = left/right cap; side ignored |
| Tabs | Tabs stretched horizontally only; pane stretched both ways |
| Window headers | "Simply stretched" |
| Placards | "Simply stretched" |
| Scrollbars | No cinf; mask hole + bg pattern of same ID |
| Sliders | Tracks stretched along main axis only; thumbs at native size in 4-state stacked cicn |
| Progress bars | Frame is 9-slice; fill + track stretched horizontally only |
| Popup menus | Text half + arrow half side-by-side, both "simply stretched"; arrow cicn stamped on top |
| Disclosure triangles | No cinf; cicn at native size; optional 5-frame animation |

### 4.4 Tile-vs-stretch decision tree

```
                  ┌─────────────────────────────┐
                  │ Recipe segment with part X  │
                  └─────────────┬───────────────┘
                                │
                  ┌─────────────┴───────────────┐
                  │ Is X == 0?                  │
                  └─────────┬─────────────┬─────┘
                          yes             no
                            │             │
                  ┌─────────▼─────────┐   │
                  │ Don't draw        │   │
                  └───────────────────┘   │
                                          │
                            ┌─────────────┴──────────────┐
                            │ Is X in rectList (1-4)?    │
                            └─────────┬──────────┬───────┘
                                    yes          no
                                      │          │
                            ┌─────────▼─┐ ┌──────▼──────────────────┐
                            │ Stamp     │ │ Is this a control with   │
                            │ rect      │ │ cinf, and cinf.tileSides │
                            │ bitmap at │ │ = 1?                     │
                            │ native    │ └──────┬─────────────┬─────┘
                            │ size      │      yes              no
                            └───────────┘        │              │
                                       ┌────────▼─────┐ ┌──────▼──────────┐
                                       │ Tile the cicn │ │ Stretch the cicn│
                                       │ slice across  │ │ slice across the │
                                       │ segment width │ │ segment width    │
                                       └───────────────┘ └─────────────────┘
```

---

## 5. The WDEF protocol — what Kaleidoscope implements

Kaleidoscope replaces Mac OS's default WDEF (Window Definition Procedure). The Window Manager dispatches messages to the WDEF; Kaleidoscope's WDEF responds by reading the loaded scheme.

### 5.1 Messages a WDEF receives (Inside Macintosh)

| Message | Purpose |
|---|---|
| `wDraw` | Paint the window chrome at the current size |
| `wHit` | Hit-test a point; return one of the `wInXxx` part codes |
| `wCalcRgns` | Compute structure + content regions for the Window Manager |
| `wNew` | Initialize window-specific state |
| `wDispose` | Tear down |
| `wGrow` | Draw the resize feedback outline during grow |
| `wDrawGIcon` | Draw the grow icon (size box) |

### 5.2 Apple's window part codes (returned from `wHit`)

| Const | Value | Region |
|---|---:|---|
| `wNoHit` | 0 | Missed |
| `wInContent` | 1 | Content area |
| `wInDrag` | 2 | Titlebar drag |
| `wInGrow` | 3 | Resize handle |
| `wInGoAway` | 4 | Close box |
| `wInZoomIn` | 5 | Zoom box (zoomed-in state) |
| `wInZoomOut` | 6 | Zoom box (zoomed-out state) |
| `wInCollapseBox` | 7 | Windowshade (Mac OS 8.0+) |
| `wInCollapseBoxAll` | 8 | Windowshade-all (Mac OS 8.0+) |
| `wInProxyIcon` | 9 | Document proxy icon |

These are the WHAT-WAS-CLICKED enum returned by `wHit`. Kaleidoscope's scheme-internal part codes (§3) are SEPARATE — they identify segment KINDS in the recipe. The mapping from "click in segment with internal part X" → "return Apple wInXxx" is by **rectList convention**: rectList[1] = close box → return `wInGoAway`; rectList[2] = zoom box → return `wInZoomIn`/`wInZoomOut`; etc.

### 5.3 What this means for Aaron UI

- **For paint:** we don't need the Apple part codes. Just render per §4.
- **For interaction:** when wiring click handlers, map a click position to the recipe segment it falls in, look up that segment's part in rectList, infer which Apple `wInXxx` would apply via the conventional ordering, and dispatch the appropriate AaronWindow event (`close()`, `zoom()`, `collapse()`).

---

## 6. Canonical resource ID conventions

From the K2 Scheme Reference. Aaron UI uses these as the primary signal for "what kind of chrome is this cicn?" — more reliable than name matching.

### 6.1 Window chrome (-14336 range)

| ID | Resource |
|---:|---|
| -14336 | Inactive Document Window |
| -14335 | Active Document Window |
| -14334 | Inactive Grow Box |
| -14333 | Active Grow Box |
| -14332 | Inactive Collapsed State |
| -14331 | Active Collapsed State |
| -14330 | Widget Down States (pressed-widget overlay) |
| -14329 | Alternate Zoom Box Up + Down States |
| -14328 / -14327 | Inactive / Active Modal Dialog |
| -14326 / -14325 | Inactive / Active Alert |
| -14324 / -14323 | Inactive / Active Movable Modal Dialog |
| -14322 / -14321 | Inactive / Active Movable Alert |
| -14310 / -14309 | Movable Modal Dialog Grow Box (inactive / active) |
| -14304 / -14303 | Inactive / Active Utility Window |
| -14302 / -14301 | Utility Window Grow Box (large variant) |
| -14300 / -14299 | Inactive / Active Collapsed Utility Window |
| -14298 | Utility Window Widget Down States |
| -14297 | Utility Window Alternate Zoom Boxes |
| -14296…-14289 | Side floating utility window equivalents |
| -14288 / -14287 | Inactive / Active Utility Window (No Title) |
| -14286 / -14285 | Small variant utility window grow box |
| -12320 / -12318 | Active / Inactive Popup Window |

### 6.2 Buttons + selection (-10238 range)

Push button: -10238 (pressed) / -10237 (normal) / -10236 (disabled) / -10235 (active default ring) / others
Default ring pressed: -10230 (Kaleidoscope ≥ 2.x)

### 6.3 Checkboxes (-9504 range)

-9504..-9502: unchecked (disabled/normal/pressed)
-9501..-9499: checked
-9498..-9496: mixed
-9495..-9493: alternate-checked

### 6.4 Radio buttons (-9492 range)

-9492..-9484: 3 values × 3 states

### 6.5 Menus (-12240 range)

-12240: menu bar background
-12239 / -12238: menu title tile (normal / pressed)
-12237 / -12236 / -12235: pull-down menu (background / item pressed / divider)
-12234 / -12233 / -12232: free menu (same)
-12231..-12229: application menu grip
-12228..-12225: extended menu borders + alpha masks (Kaleidoscope ≥ 2.3)

### 6.6 Disclosure triangles (-10112 range)

Right-facing: -10112..-10110 + animation -10109..-10105 + down-facing -10104..-10102 + animation back -10101..-10097
Left-facing: -10096..-10086 + animations

### 6.7 Little arrows (-10048 range)

-10048..-10045: up/down arrow pair (disabled, normal, up-pressed, down-pressed)

### 6.8 Tabs (-9984 range)

Large: -9984..-9977
Small: -9976..-9969
Reserved: -9968 through -9956 (do NOT override)

### 6.9 Scrollbars (-10208 / -8288 range)

Thumbs: -10208..-10205, -8272/-8271 ghosts (large variant)
Tracks: -8288..-8273 (horizontal/vertical × single/double arrows × 4 states)
Small variant: -8270..-8249

### 6.10 Popup menus (-8208 range)

-8208..-8203: text half + arrow half × 3 states
-8202..-8200: arrow-only variant background
-8199..-8197 / -8196..-8194: large / small arrow glyphs (text variant)
-8193..-8188: arrows for arrow-only variant

### 6.11 Sliders (-10144 range)

Tracks + thumbs + tick marks × 4 directions × states

### 6.12 Progress bars (-10080 range)

-10080..-10075: determinate (frame + fill + track × enabled/disabled)
-10080..-10073: indeterminate animation patterns (cycle through 8 ppat IDs)

### 6.13 Dialog/alert colors (-9776 range)

-9776..-9773: dialogs + alerts (color-extraction only, not rendered)

### 6.14 Finder window colors (-9552 range)

-9552..-9548: desktop icon, icon view, list views, separators

### 6.15 Window headers (-9568 range)

-9568 / -9567: inactive / active window header

### 6.16 Placards (-9792 range)

-9792 / -9791 / -9790: inactive / normal / pressed

### 6.17 Mac OS 9 notification window (-9547)

Color extraction only, not rendered directly.

### 6.18 Misc

- ppat 17: desktop pattern
- ppat 42: utility pattern
- crsr 0: arrow cursor
- crsr -20488..-20486: contextual menu / alias / copy cursors
- clut 1323: Photoshop palette colors
- STR# -14320: scheme name + description + URL

---

## 7. Mapping to web (DOM + CSS)

### 7.1 DOM contract

A themed window:

```
<.aaron-window data-state="active">
  <.aaron-titlebar>
    <.aaron-titlebar__title>
      <span id="title-N">Window Title</span>
    </>
  </>
  <.aaron-content>...consumer-provided body content...</>
  <[data-aaron-resize-handle="<dir>"]>...</>  ← 8 hit targets (n/s/e/w/ne/nw/se/sw)
</>
```

The chrome composer paints **on the window root** via CSS `border-image` (9-slice from cinf or part-0 body rect). The titlebar element is a child of the window root, positioned absolute over the top border. The content area sits in the window root's content box (inside the border).

### 7.2 CSS render strategy per the K2 rules

For window chrome (Kind A and Kind B both):

```css
.aaron-window {
  box-sizing: border-box;
  border-style: solid;
  border-color: transparent;
  border-top-width: <topThickness>px;
  border-right-width: <rightThickness>px;
  border-bottom-width: <bottomThickness>px;
  border-left-width: <leftThickness>px;
  border-image-source: url("<cicn>.png");
  border-image-slice: <T> <R> <B> <L> fill;
  border-image-width: <T>px <R>px <B>px <L>px;
  border-image-repeat: stretch;  /* per K2 Speed Note */
  image-rendering: pixelated;
}
```

For control elements:

```css
.aaron-button {
  border-image-source: url("<cicn>.png");
  border-image-slice: <cinf.cornerSize> fill;
  border-image-width: <cinf.cornerSize>px;
  border-image-repeat: <cinf.tileSides ? 'repeat' : 'stretch'>;  /* per K2 */
}
```

### 7.3 Recipe handling

For chrome windows, the **wnd# recipe is primarily hit-test data**. Paint comes from the cinf 9-slice + body rect. The recipe is consulted to:

1. **Skip part-0 segments** when computing where the cicn's drawn region is
2. **Determine hit-test regions** for click handlers
3. **Identify the title pill area** (between the right-most named widget and the right-edge corner) for title-text positioning

We do NOT use the recipe to drive per-segment paint composition. That was an earlier mistake; the WDEF research clarified that Kaleidoscope's paint algorithm was the simple 9-slice.

### 7.4 Pattern overlay (`cinf.bgPattern`)

When `cinf.bgPatternId != 0`, after painting the border-image, overlay a tiled ppat into the content box:

```css
.aaron-control::before {
  content: "";
  position: absolute;
  inset: <cinf.cornerSize>px;
  background: url("<ppat>.png") repeat <bgPixelX>px <bgPixelY>px;
  pointer-events: none;
}
```

Honor `Pattern Anchor` (0–4 for corner anchoring, 5 for scaled cicn fill).

### 7.5 Colr scheme settings

Read at scheme load time; stamp as CSS custom properties on `:root` or `.aaron-window`. Examples:

```css
:root {
  --aaron-colr-bg: #dddddd;
  --aaron-colr-fg: #000000;
  --aaron-colr-titlebar-active-fg: #000000;
  --aaron-colr-titlebar-inactive-fg: #888888;
  /* and flags for scrollbar behavior, menu transparency, etc. */
}
```

---

## 8. Hit-test wiring (future work)

The framework for click handling, derived from §5:

1. On `pointerdown` inside a windowEl, compute the click position relative to the window root
2. Identify which edge band it falls in (top/right/bottom/left/content)
3. Walk the corresponding side recipe to find the segment containing the click
4. Look up the segment's `part` in the rectList; map via convention to Apple's `wInXxx`:
   - rectList[1] (first named widget) → typically `wInGoAway` (close)
   - rectList[2] → typically `wInZoomIn`/`wInZoomOut` (zoom)
   - rectList[3] → typically `wInCollapseBox` (windowshade)
5. Dispatch the corresponding event on the AaronWindow

This work is **not yet wired** in the runtime. The recipe data is retained in `theme.json` for when we do.

---

## 9. Conformance levels

Implementations of the Kaleidoscope render protocol can claim partial support honestly.

### Level 1 — Document window chrome only
Renders `document-window`'s active + inactive states via cinf 9-slice. No other window types. No controls. **Aaron UI's current level for native rendering of window chrome.**

### Level 2 — All window types
Adds dialogs, alerts, utility windows, side-floating, popup tabs — every window type the scheme defines in wnd# (resource IDs -14336 through -12318 per §6.1).

### Level 3 — Standard controls
Adds buttons, checkboxes, radios, sliders, scrollbars, progress bars, tabs, popup menus, disclosure triangles. Each per the §4.3 rules.

### Level 4 — Full HIG
Adds menus (menubar, pull-down, free), cursors, placards, finder colors, list views, notification windows. The complete HIG vocabulary from §6.

### Level 5 — Interaction
All of the above PLUS proper hit-testing per §8 (click on close box closes the window, etc.) AND respect for Colr scheme settings (transparency, scrollbar variants, etc.).

---

## 10. Open questions (deferred — not yet investigated)

- **Crumple zones** — K2 §Tiny Windows mentions designs where end caps "disappear when the window gets too small." Mechanism unknown.
- **Multiple widget instances** — K2 §Multiple Widgets says rectList CAN contain duplicate entries (multiple close boxes that animate together). Have not seen this in the 7-scheme corpus.
- **Animation frames** — disclosure triangles support 5-frame animations at 1/20 second intervals. Aaron UI does not animate yet.
- **cinf for chrome cicns** — none of the 7 schemes audited has cinf paired with the -14336-series cicns. K2 docs imply some chrome cicns DO have cinf (for the gradient + bg pattern fields). Possible scheme-specific.
- **PCS# resources** — present in Scheme Factory's binary (one per window-type ID), structure decoded but semantic unclear. Hypothesis: part-code-validation metadata for the editor's UI, not for rendering.

---

## 11. References

### Primary sources

- Kaleidoscope 2.3.1 installer, `Kaleidoscope Goodies/K2 Scheme Reference` — the authors' format spec
- Kaleidoscope 2.3.1 installer, `Kaleidoscope Goodies/Creating K1 Schemes` — older format reference
- Scheme Factory 1.0PR2 — official scheme editor; its `STR# 128` lists 127 canonical region names
- [Mac OS 8 Window Manager Reference (Inside Macintosh)](https://dev.os9.ca/techpubs/new/WindowMgr8Ref/WindowMgrRef.1.html)
- [Inside Macintosh: Macintosh Toolbox Essentials PDF](https://developer.apple.com/library/archive/documentation/mac/pdf/MacintoshToolboxEssentials.pdf)

### Empirical corpus

`themes/` directory holds 7 schemes: 1138, 1990, acid, big-blue, evolution, masswerk-7-le, masswerk-dark-ergobox2. Each ships its own TMPLs (128, 129, 1240) which are the load-bearing format-spec artifacts.

### Aaron UI runtime modules

- `src/themes/loader/` — `.rsrc` decoder + `theme.json` builder
- `src/themes/runtime/composeKaleidoscopeFaithful.ts` — the chrome composer
- `src/themes/runtime/applyChromeFromTheme.ts` — the dispatch / theme attach layer
- `src/themes/schema/` — TypeScript schema for `theme.json`
- `demo/diagnostics.html` — per-scheme diagnostic view; shows recipe data, parts, segment inspector

### Historical docs (superseded)

These remain in tree for posterity but should not be consulted as authoritative going forward:

- `docs/kaleidoscope-geometry-spec.md`
- `docs/chrome-rendering-architecture.md`
- `docs/control-rendering-architecture.md`
- `docs/kaleidoscope-asset-catalog.md`
- `docs/runtime-rendering-architecture.md`
- `docs/rendering-gap-analysis-2026-05-17.md`
- `docs/wnd-recipe-semantics-2026-05-17.md`

### Important legal note

> "The data structures of the 'wnd#' and 'cinf' resources are the intellectual property of the authors, and these resources may not be programmatically interpreted by software other than Kaleidoscope without prior written consent." — K2 Scheme Reference, Legal Note

Kaleidoscope's authors (Arlo Rose + Greg Landweber) retired the product in 2003 and the official website (kaleidoscope.net) is dead. We have made good-faith attempts to interpret the format for the purpose of archival preservation of period scheme work, and have no commercial intent. The empirical reverse engineering proceeded from the TMPLs embedded in the schemes (which are themselves readable in any resource editor) plus the K2 Scheme Reference (distributed as documentation with the application). If either author surfaces and objects, we'll reconsider.
