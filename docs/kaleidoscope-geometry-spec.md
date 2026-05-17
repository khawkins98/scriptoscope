# Kaleidoscope theme geometry — deconstruction & Aaron UI mapping

**Purpose:** the canonical Aaron UI reference for how Kaleidoscope structures its scheme files, what each resource encodes, the runtime composition model, and the mapping table from Kaleidoscope concepts to Aaron UI's HTML/CSS primitives. This document drives both the immediate raster-demo work and the Phase 4 bundle format design.

**Status note (2026-05-17):** elevated from "informing Phase 4" to the central architectural contract following the 2026-05-17 Kaleidoscope-runtime pivot (LEARNINGS entry "Aaron UI is a Kaleidoscope-compatibility runtime, not a Platinum re-author"). With Phase 2 dropped and Aaron UI explicitly *not* hand-authoring chrome, this spec defines what the runtime renders against. Phase 4 = ship the runtime that consumes this format.

**Paired document:** this is the **input contract** (what's in a `.ksc`). The matching **output contract** — how Aaron UI's DOM/CSS composites the parsed `Theme` at runtime — is [`docs/runtime-rendering-architecture.md`](./runtime-rendering-architecture.md). Read both together.

**Source authority:** Kaleidoscope's own ResEdit templates (`TMPL` resources) embedded in every scheme file. These are the format specs Kaleidoscope itself reads and writes against, and we have full extracts of three of them: `TMPL 128` (Colr), `TMPL 129` (cinf), `TMPL 1240` (wnd#). The kaleidoscope.net SDK pages are gone — the domain is parked — but the TMPLs are sufficient because they're the runtime contract, not derivative documentation.

**Empirical corpus:** [`docs/scheme-deconstruction/masswerk-7-le.md`](./scheme-deconstruction/masswerk-7-le.md) and [`masswerk-dark-ergobox2.md`](./scheme-deconstruction/masswerk-dark-ergobox2.md). Decoded `cinf`/`wnd#` values quoted below are from real bytes in those schemes.

---

## 1. The Kaleidoscope resource model — five types matter

A Kaleidoscope scheme is a Mac resource fork containing roughly 270–530 resources across ~19 types. For chrome-rendering purposes, five types do the load-bearing work; everything else is either Kaleidoscope-app-only metadata or out-of-scope-for-Aaron-UI (file icons).

| Type | Purpose | Aaron UI role |
|---|---|---|
| **`cicn`** | Color icon — the *bitmap pixels* of every chrome element (titlebar widget composites, scrollbar parts, checkbox/radio states, progress bar pieces, growbox, etc.) | The raster asset. Source of all visible chrome pixels. |
| **`cinf`** | "Color INFo" — *per-cicn geometry & composition metadata*. Encodes 9-slice corner size + side thickness + tile-vs-stretch flag + which `ppat` to layer over the body + anchor positions for text/embossing. | The 9-slice + composition spec for each chrome asset. The single most important resource for getting rendering right. |
| **`wnd#`** | Window definition list — for each window type (Document Window, Modal Dialog, Alert, Utility, etc.), a list of *named parts with rectangles in the cicn* + per-side *part sequences* describing how to fill each border edge. | The window-type catalog + per-edge composition recipe. |
| **`ppat`** | Pixel pattern — small tileable bitmaps used for textures (titlebar pinstripe, scrollbar track stipple, body fill, indeterminate-progress barber pole). | Tileable backgrounds; the runtime composition layer that cinf's `bgPatternId` references. |
| **`Colr`** | Global scheme settings — version, "stretch scrollbar thumb from center" flag, "menu highlight overlays normal" flag, etc. | Scheme-level options Aaron UI's theme.json should encode at the top level. |

Other types (`PICT`, `clut`, `dctb`, `actb`, `STR#`, `DLOG`, `DITL`, `Colr`, `ICN#`, `icl8`, `ics#`, `ics8`, `icns`, `TMPL`, `vers`) are either ResEdit-only template definitions, classic Mac Toolbox structures with no web equivalent, or file-icon families outside Aaron UI's scope.

---

## 2. `cinf` — the 9-slice spec per chrome asset

### Field layout (per `TMPL 129`)

```
Offset  Bytes  Field                       Type
0       1      Corner Size                 BYTE (unsigned)
1       1      Side Thickness              BYTE (unsigned)
2       1      Tile Sides                  BYTE (0 = stretch, 1 = tile)
3       1      Pattern Anchor              BYTE (anchor mode flags)
4       2      Background Pattern ID       DWRD (signed int16) — resource ID of a ppat, or 0 if none
6       2      Background Pixel (y)        DWRD — y offset for bg-pattern anchor
8       2      Background Pixel (x)        DWRD — x offset for bg-pattern anchor
10      2      Text Pixel (y)              DWRD — y offset for any text rendered over this chrome
12      2      Text Pixel (x)              DWRD — x offset for text
14      2      Embossing Pixel (y)         DWRD — y offset for the embossed-shadow overlay
16      2      Embossing Pixel (x)         DWRD — x offset for emboss
```

Total: **18 bytes per `cinf`**.

### What it means architecturally

This is a **9-slice border-image descriptor** with three extensions:

1. **`Corner Size` / `Side Thickness`** are the 9-slice geometry directly. A `cinf` with `cornerSize=4, sideThickness=4` tells the renderer to slice the associated cicn with 4-pixel corners and 4-pixel side strips, stretching (or tiling, per `Tile Sides`) the middle and edges.
2. **`Background Pattern ID`** is the missing piece for the "white cicn body" puzzle from earlier rendering experiments. Kaleidoscope did NOT bake the body texture into the cicn — instead, it composited a separate `ppat` over the body region at runtime. ErgoBox's white-body bitmap is correct; the gray appearance in the reference thumbnail comes from runtime ppat layering. **Aaron UI's bundle format must encode this composition declaratively.**
3. **`Text/Embossing Pixel`** offsets are anchor positions inside the chrome for label text and embossed highlights — Aaron UI uses these to place title text in titlebars, popup-menu labels in popup buttons, etc.

### Decoded examples (from mass:werk 7 Le)

| `cinf` name | Corner | Side | Tile | BG Ptn | Text x,y | Notes |
|---|---:|---:|---:|---:|---:|---|
| `Pull Down Menu Background` | 2 | 2 | no | — | 2,2 | small corners, thin edges |
| `Selected Menu Item` | 2 | 2 | no | — | 3,3 | inverted-text region |
| `Divider Line` | 4 | 4 | no | — | — | a separator strip |
| `Inactive Right Pointing Slider Track` | 5 | 16 | no | — | — | thick sides for slider track |
| `Normal Popup Button Text` | 3 | 3 | no | — | 3,3 | popup label area |
| `Root Menu Item` | 6 | 6 | no | — | 6,6 | menubar entry |

The actual mass:werk 7 Le scheme has **47 `cinf` resources**. Distinct `cornerSize` values observed: 0, 2, 3, 4, 5, 6, 12. Distinct `sideThickness` values observed: 0, 1, 2, 3, 4, 6, 16. `tileSides` is mostly 0 (stretch) with a few 1s (tile).

### Aaron UI mapping

```css
/* For each cicn that has an associated cinf, render as: */
.chrome-element-X {
  border-style: solid;
  border-color: transparent;
  border-width: <sideThickness>px;          /* from cinf */
  border-image-source: url(<cicn>.png);
  border-image-slice: <cornerSize> fill;    /* from cinf */
  border-image-width: <cornerSize>px;
  border-image-repeat: <tileSides ? 'repeat' : 'stretch'>;  /* from cinf */
}
/* If cinf.bgPatternId != 0, layer the referenced ppat:   */
.chrome-element-X::after {
  content: '';
  position: absolute;
  inset: <cornerSize>px;                     /* inside the border slice */
  background: url(<ppat-N>.png) repeat
              <bgPixelX>px <bgPixelY>px;     /* anchor from cinf */
  pointer-events: none;
}
```

**Phase 4 `theme.json` entry per chrome element:**

```json
{
  "id": "menu-item",
  "asset": "cicn-n12239.png",
  "slice": { "corner": 6, "side": 6, "tile": false },
  "bgPattern": { "ppat": "ppat-N.png", "anchor": [6, 4] },
  "textAnchor": [6, 6]
}
```

This is essentially a direct rewrite of `cinf` into JSON.

---

## 3. `wnd#` — window-type definitions with parts + per-side recipes

### Field layout (per `TMPL 1240`)

```
"Rectangle List" — named parts with bounding rects in the associated chrome cicn
  ZCNT                                       2 bytes (count − 1, so 0x0004 = 5 entries)
  for each rect entry:
    Part                                     DWRD (int16) — semantic part ID
    Rectangle                                RECT (4 × int16: top, left, bottom, right)
                                             — coordinates within the cicn

"Top Side"    — recipe for filling the window's top border edge
  ZCNT                                       2 bytes
  for each side entry:
    Part                                     DWRD — which rect (or 0 for default fill)
    Border                                   DWRD — pixel position along the edge

"Bottom Side" — same structure as Top Side
"Left Side"   — same structure
"Right Side"  — same structure
```

The "Rectangle List" defines named regions inside the chrome cicn (the close box, the zoom box, etc.). The four "Side" lists are *sequences of (part, position)* pairs that describe how to paint each window-frame edge, piece by piece, from one corner to the other.

### Decoded example: 7 Le `wnd# -14336 "Document Window"`

The associated cicn (`Active Document Window`) is 74×25 pixels.

**Rectangle List** — 5 named parts:

| Part ID | Rect (top, left, bottom, right) | Meaning |
|---:|---:|---|
| 0 | (22, 1, 23, 72) | 1px-tall strip across the bottom — the **bottom edge** of the titlebar |
| 1 | (5, 9, 16, 20) | 11×11 region — the **close box** click target |
| 2 | (5, 36, 16, 48) | 11×12 region — the **zoom box** click target |
| 3 | (5, 53, 16, 64) | 11×11 region — the **windowshade arrow** click target |
| 4 | (3, 28, 19, 29) | 1×16 region — a **vertical divider** between title-pill and widgets |

**Top Side recipe** (13 entries) — how to paint the titlebar's top edge from left to right:

| At pixel | Use part | Meaning |
|---:|---:|---|
| 0 | 0 | begin with default fill |
| 5 | 1 | switch to part 1 (close box left edge) |
| 21 | 2 | switch to part 2 |
| 24 | 1 | back to part 1 (some other widget treatment) |
| 25 | 8 | part 8 (unnamed — implicit "edge fill"?) |
| 28 | 6 | … |
| … | … | (continues for 13 chunks total) |

The pattern: as the renderer walks from x=0 to the right edge, it switches which "part" to use at each declared pixel position. Some part IDs (0, 8, etc.) are not in the rectangle list, suggesting they refer to standard fill modes (background pattern, plain color) rather than rectangles in the cicn.

**Bottom Side recipe** (5 entries), **Left Side** (2 entries), **Right Side** (2 entries) — simpler sequences for the other edges of the window frame.

### Decoded example: 7 Le `wnd# -14324 "Movable Modal Dialog"`

Only 2 named parts (no close/zoom/windowshade — modal dialogs are minimal), with a different but structurally identical top-side recipe.

### Aaron UI mapping

`wnd#` is essentially **per-window-type geometry**. For each Aaron UI window-type entry:

```json
{
  "windowTypes": {
    "document": {
      "chromeAsset": "cicn-n14335-active-document-window.png",
      "chromeInactive": "cicn-n14336-inactive-document-window.png",
      "parts": {
        "close":       { "rect": [9, 5, 20, 16] },
        "zoom":        { "rect": [36, 5, 48, 16] },
        "windowshade": { "rect": [53, 5, 64, 16] }
      },
      "edges": {
        "top":    [...recipe...],
        "bottom": [...recipe...],
        "left":   [...recipe...],
        "right":  [...recipe...]
      }
    }
  }
}
```

The renderer (Phase 1 WM core in TS) reads this and:

1. **Click hit-testing:** when the user clicks somewhere on the titlebar, walk the parts list; if the click coordinate falls inside `parts.close.rect`, fire the close event. **This is the missing precision in our current demo — we use approximate hit positions; `wnd#` parts give us exact ones for free.**
2. **Border rendering:** for each edge, walk the recipe and emit positioned sub-elements (or a multi-stop CSS gradient, or a Canvas draw) that paint the edge piece by piece using the right cicn region for each.

For the immediate raster demo, the rectangles alone are useful — they tell us exactly where the close box is inside the titlebar composite, so we can position clickable hit-target divs precisely instead of guessing.

---

## 4. `Colr` — scheme-level global settings

### Field layout (per `TMPL 128`)

```
Colr version                                   BYTE
Color scheme file format version               BYTE
Minimum Kaleidoscope version                   HBYT (hex byte — a Kaleidoscope app version code)
Has accent colors                              BOOL
Stretch scroll bar thumb from center           BYTE (for SmartScroll compatibility)
                                               FBYT — filler byte
Menu highlight cicn overlays normal menu cicn  BOOL
Unified scroll bar track                       BOOL
Windows style scroll bars                      BOOL
Extended scroll bar arrows                     BOOL
Reserved                                       HEXD
```

These are scheme-level flags that affect rendering of all chrome elements together. Aaron UI's `theme.json` should adopt them at the top level:

```json
{
  "name": "mass:werk 7 Le",
  "author": "N. Landsteiner",
  "options": {
    "menuHighlightOverlay": true,
    "unifiedScrollbarTrack": false,
    "windowsStyleScrollbars": false,
    "extendedScrollbarArrows": false,
    "stretchScrollbarThumbFromCenter": false
  },
  "windowTypes": { ... },
  "chromeElements": { ... }
}
```

---

## 5. `ppat` — pixel patterns (the runtime composition layer)

Pixel patterns are small (typically 8×8 to 16×16) tileable bitmaps. The scheme-extractor already decodes them. They serve three roles:

1. **`bgPatternId` reference from cinf** — the runtime overlay over a chrome body, the thing that gives ErgoBox its gray-body look (cicn body is white; the ppat is gray and `multiply`-blends to gray).
2. **Standalone textures** — titlebar pinstripe (7 Le), progress-bar barber pole (both themes), scrollbar track stipple.
3. **Desktop background** — Kaleidoscope schemes don't usually ship these, but the format allows it.

Aaron UI's CSS already handles ppats correctly via `background-image: url(ppat.png) repeat`. The new piece is honoring **cinf-declared overlays**: when a cinf references a ppat by ID, layer it as an `::after` over the chrome with the appropriate blend mode.

---

## 6. Runtime composition model — how a window draws

Pulling threads 1–5 together, here's how Kaleidoscope draws a Document Window of width *W* × height *H*:

1. **Look up `wnd# -14336` "Document Window"** to get the parts list + per-side recipes.
2. **Look up the associated chrome cicn** (`Active Document Window` or `Inactive Document Window`).
3. **Look up the associated `cinf` -14335 / -14336** to get the 9-slice geometry + bgPattern ID.
4. **Paint the chrome frame:**
   - Slice the cicn per `cinf.cornerSize` and `cinf.sideThickness`.
   - For each window edge (top, bottom, left, right), walk that edge's recipe from `wnd#`, painting the chunks of cicn dictated by each (part, position) pair.
   - The middle (content area) is filled either by a fixed color or by `cinf.bgPatternId` (a ppat tile).
5. **Compose interactive parts:** the named parts from `wnd#.rectangles` become hit-target regions. When the user clicks, walk parts to find which one was hit.
6. **Repeat for child controls** (buttons, scrollbars, checkboxes) — each has its own cicn + cinf, composed via the same 9-slice + ppat-overlay model.

### Mapping this to Aaron UI's WM

| Kaleidoscope step | Aaron UI equivalent (Phase 1 + 4) |
|---|---|
| Look up `wnd#` for window type | TS WM reads `theme.json.windowTypes[type]` |
| Look up cicn for chrome | Browser loads PNG from `theme.json.windowTypes[type].chromeAsset` |
| Look up cinf for 9-slice geometry | TS WM reads `theme.json.chromeElements[id].slice` |
| Paint frame via 9-slice + per-edge recipe | CSS Grid layout per window, each cell with `background-image: <cicn>` and computed `background-position` from cinf+wnd# data |
| Optional ppat overlay over body | CSS `::after` pseudo-element with `mix-blend-mode: multiply` (or other declared blend) and `background: url(<ppat>)` |
| Compose child controls | Same model recursively |

---

## 7. Aaron UI `theme.json` proposed schema (informed by all of the above)

```jsonc
{
  "version": "0.1",
  "name": "mass:werk 7 Le",
  "author": {
    "name": "Norbert Landsteiner",
    "email": "info@masswerk.at",
    "url": "https://www.masswerk.at"
  },
  "origin": {
    "kind": "kaleidoscope-port",
    "originalFormat": "ksc",
    "originalLicense": "freeware-with-attribution",
    "originalReadme": "ReadMe-masswerk7Le"
  },
  "options": {
    "menuHighlightOverlay": true,
    "unifiedScrollbarTrack": false,
    "windowsStyleScrollbars": false,
    "extendedScrollbarArrows": false,
    "stretchScrollbarThumbFromCenter": false
  },
  "windowTypes": {
    "document": {
      "chrome": {
        "active":   "assets/cicn-n14335-active-document-window.png",
        "inactive": "assets/cicn-n14336-inactive-document-window.png",
        "collapsed-active":   "assets/cicn-n14331-collapsed-active-document-window.png",
        "collapsed-inactive": "assets/cicn-n14332-collapsed-inactive-document-window.png"
      },
      "parts": {
        "close":       { "rect": [9, 5, 20, 16] },
        "zoom":        { "rect": [36, 5, 48, 16] },
        "windowshade": { "rect": [53, 5, 64, 16] },
        "divider":     { "rect": [28, 3, 29, 19] }
      },
      "edges": {
        "top":    [{"at": 0, "part": "fill"}, {"at": 5, "part": "close"}, {"at": 21, "part": "zoom"}, ...],
        "bottom": [...],
        "left":   [...],
        "right":  [...]
      },
      "bodyPattern": null
    },
    "modal-dialog": { ... },
    "alert": { ... },
    "utility-window": { ... }
  },
  "chromeElements": {
    "menu-item": {
      "asset": "assets/cicn-n12239-menu-item.png",
      "slice": { "corner": 6, "side": 6, "tile": false },
      "textAnchor": [6, 6]
    },
    "pull-down-menu-bg": {
      "asset": "assets/cicn-n12237-pull-down-menu-background.png",
      "slice": { "corner": 2, "side": 2, "tile": false },
      "bgPattern": null
    },
    "popup-button-text-normal": {
      "asset": "assets/cicn-n8207-normal-popup-button-text.png",
      "slice": { "corner": 3, "side": 3, "tile": false },
      "textAnchor": [3, 3]
    },
    "scrollbar-thumb-horizontal": {
      "asset": "assets/cicn-n10206-horizontal-thumb.png",
      "slice": { "corner": 8, "side": 0, "tile": false }
    },
    "progress-bar-fill": {
      "asset": "assets/cicn-n10079-progress-bar-active.png",
      "tile": "horizontal"
    },
    "checkbox-normal-off-normal": {
      "asset": "assets/cicn-n10166-normal-off-normal.png"
    }
  },
  "patterns": {
    "titlebar-pinstripe": { "asset": "assets/ppat-N-pinstripe.png", "repeat": "both" },
    "progress-barber-pole": { "asset": "assets/ppat-N-barber.png", "repeat": "horizontal" }
  }
}
```

Every field above maps **directly** to either a cinf field, a wnd# entry, a cicn pixel rect, or a Colr flag. The format is essentially `theme.json = JSON serialization of the relevant Kaleidoscope resources`, with paths to extracted PNGs.

---

## 8. Mapping table: Kaleidoscope concept → Aaron UI primitive

| Kaleidoscope | Aaron UI HTML | Aaron UI CSS | Comments |
|---|---|---|---|
| Chrome cicn (PNG) | `<img>` or `background-image` URL | `image-rendering: pixelated` | Always rendered at integer scale or as 9-slice |
| cinf `cornerSize` | — | `border-image-slice: <N> fill` | The 9-slice corner |
| cinf `sideThickness` | — | `border-width: <N>px` + `border-image-width: <N>px` | Edge strip width |
| cinf `tileSides` | — | `border-image-repeat: stretch | repeat` | Boolean choice |
| cinf `bgPatternId` reference | `<div class="chrome-bg-overlay">` | `background: url(ppat) repeat; mix-blend-mode: multiply` | Runtime composition layer |
| cinf `textPixelX/Y` | — | `padding: <Y>px <X>px` on text label container | Text anchor |
| cinf `embossPixelX/Y` | — | `text-shadow: <X>px <Y>px <color>` on text | Emboss offset |
| wnd# rectangle (named part) | absolute-positioned `<button class="chrome-hit">` | `position: absolute; top/left/width/height` per rect | Click hit target |
| wnd# edge recipe entry | grid cell with cicn slice as background | `background-image; background-position: -<x>px -<y>px` | One slice per chunk |
| ppat for pinstripe / barber pole | — | `background: url(ppat) repeat-x | repeat-y | repeat` | Tile direction from cinf |
| Colr `unifiedScrollbarTrack` | DOM structure choice | CSS class on scrollbar | Affects scrollbar HTML |
| Colr `menuHighlightOverlay` | rendering mode choice | CSS overlay vs replace | Affects menu rendering |

---

## 9. Open questions / unknowns

1. **Implicit part IDs in wnd# side recipes (0, 8, etc.) that aren't in the rectangle list.** These probably reference standard fill modes (background pattern, plain edge fill, transparent) but we haven't confirmed the convention. Inspection of more schemes + cross-reference with Kaleidoscope source-tools may clarify.
2. **`patternAnchor` byte values in cinf.** The TMPL labels it but doesn't enumerate values; likely a bitfield. To be confirmed empirically against schemes that use non-default values.
3. **Blend mode for ppat overlays.** Kaleidoscope's behavior for compositing a ppat over a cicn isn't documented in the TMPLs. Empirically the gray-tint behavior matches `multiply`, but other blend modes may be appropriate for other cinf entries. Phase 4 work to validate per-element.
4. **Animation.** Mac OS 8 had subtle animations (barber-pole progress, zoom-to-icon close). Where are these encoded? Possibly in the Kaleidoscope app itself, not in scheme files. If so, Aaron UI animates in code per element class.
5. **Coordinate systems.** wnd# rectangles use Mac classic `(top, left, bottom, right)` order. cinf text/emboss are `(y, x)`. Aaron UI needs to consistently translate to CSS `(left, top, width, height)` or `(x, y)`.

---

## 10. Implementation roadmap (consequences of this spec)

### Immediate (demo iteration)

1. **scheme-extractor: add cinf + wnd# decoding to the manifest.** Output a per-asset JSON alongside each PNG with the parsed cinf/wnd# data. The `bin/extract.js` CLI emits this automatically.
2. **demo/themes-raster.html: rewrite ErgoBox window CSS to use the parsed cinf data** (cornerSize, sideThickness, tileSides) for proper 9-slice rendering instead of `background-size: 100% 100%`. Same for 7 Le's chrome controls.
3. **demo/themes-raster.html: position widget hit targets from wnd# rectangle data** instead of approximating positions in JS.

### Phase 1 (WM core)

4. **TS reader for theme.json** based on the schema in §7. Loads + validates.
5. **WM uses parts data from wnd#** for precise click hit-testing on chrome widgets.

### Phase 4 (theme engine)

6. **theme.json as authored output of the scheme-extractor.** Drop a `.ksc` in, get out a directory: extracted PNGs + manifest + theme.json ready for Aaron UI to load.
7. **Runtime composition** of cinf-declared ppat overlays via the WM's chrome renderer.
8. **Per-window-type rendering** that honors the wnd# edge recipes.

---

## References

- `tools/scheme-extractor/` — the extractor itself and its README.
- `docs/scheme-deconstruction/masswerk-7-le.md` — empirical observations + provenance for the 7 Le scheme.
- `docs/scheme-deconstruction/masswerk-dark-ergobox2.md` — same for ErgoBox.
- `docs/RESEARCH-SPIKE-THEMES.md` — the spike that started this whole workstream.
- `LEARNINGS.md` — running log of decisions, including the "Apple themes dropped" pivot and the "bitmap chrome 9-slice + ppat composition" findings that motivated this spec.
- mass:werk preview thumbnails at `demo/assets/references/` — the visual ground truth.
- Lloyd Wood's "The Kaleidoscope Way" — period scheme-author guide (link in [`docs/RESEARCH-SPIKE-THEMES.md`](./RESEARCH-SPIKE-THEMES.md)); points to the wider context but the deep technical details are in the TMPLs.
- *kaleidoscope.net SDK pages* — domain parked; original SDK content gone. The TMPL resources in every scheme are the authoritative spec we use instead.
