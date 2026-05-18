# Chrome rendering architecture

> **Audience:** anyone touching `src/themes/runtime/applyChromeFromTheme.ts`
> or its callees. This doc explains the drawing model: how a Kaleidoscope
> chrome cicn becomes a sized, palette-tinted window frame at runtime.
>
> **Companion docs:**
> [docs/kaleidoscope-geometry-spec.md](./kaleidoscope-geometry-spec.md) — the input format.
> [docs/rendering-gap-analysis-2026-05-17.md](./rendering-gap-analysis-2026-05-17.md) — the journey from the per-segment composer to the 3-slice rewrite.

---

## 1. The problem

A Kaleidoscope chrome cicn is a single **fixed-size bitmap** that's meant to *templatize* a window of *any* size. The author drew the chrome at a reference size (74×25 for 7 Le, 132×64 for ErgoBox, 177×140 for Acid); the renderer's job is to stretch / tile / slice that bitmap so it fills a real window correctly, with controls pinned to corners and decoration tiling cleanly.

Three structurally different kinds of chrome cicn exist in the wild:

### Kind A — titlebar-only cicn

The cicn is a thin horizontal strip representing just the titlebar visual. The rest of the window frame is the consumer's responsibility (or a 1px hairline). Reference example:

```
 mass:werk 7 Le active-document-window — 74×25 pixels
 ┌─────────────────────────────────────────────────────────────┐
 │ ┌─┐│┌─┐│┌─┐│ pinstripe pattern │┌─┐│┌─┐│┌─┐│              │
 │ └─┘│└─┘│└─┘│ tile this region  │└─┘│└─┘│└─┘│              │
 │ ─────────── frame line (y=22) ─────────────────────────────│
 └─────────────────────────────────────────────────────────────┘
   ↑ left widgets ↑          ↑ right widgets ↑
```

Render strategy: **3-slice on the titlebar** + a 1px hairline frame for sides+bottom (derived from the cicn's outermost opaque pixel).

### Kind B — full-window cicn

The cicn encodes the **complete window frame** — top edge with titlebar widgets, side edges with bevels/decoration, bottom edge with the frame line, even (sometimes) corners with projecting tabs. Reference example:

```
 mass:werk Dark ErgoBox 2 document-window-active — 132×64 pixels
 ╔═════════════════════════════╗ ← projecting tab + titlebar
 ║ ┌─┐│Hello!│ │┌─┐│┌─┐         ║
 ╚╦═╤╦═════════════════════════╦╝
 ┌╨─┴╨─────────────────────────╨┐ ← main window rectangle
 │▓▓▓ stretchable body area  ▓▓▓│   beveled 6px border on all sides
 │▓▓▓ (tile or empty)        ▓▓▓│
 └──────────────────────────────┘
```

Render strategy: **9-slice on the window root** (corners pinned, sides tile, center stretchable for the body). Titlebar element overlays the cicn's top region for click + drag handling.

### Kind C — fixed-bitmap cicn

The cicn isn't a template at all — it's a *literal picture* of one specific window size. Common in elaborate decorative schemes (Acid's lego-blocks, evolution's pipes). Stretching breaks the design.

Render strategy: **closest-fit centered**, with optional scale-to-fit for non-decorative consumers. The renderer can't faithfully reproduce these at arbitrary sizes — the author's design intent is "render at the reference size or accept distortion."

---

## 2. How to tell them apart

Detection runs at theme-load time via `classifyChromeCicn(cicnUrl, windowType)`:

```
                    ┌────────────────────────────────────┐
                    │ cicn width ≈ a typical titlebar    │
                    │ height (≤ 30px) ?                  │
                    └─────────┬──────────────────────────┘
                              │ yes
                  ┌───────────▼───────────┐
                  │       Kind A          │
                  │   (titlebar-only)     │
                  └───────────────────────┘

                              │ no
                              ▼
                    ┌────────────────────────────────────┐
                    │ Scan cicn rows from top and bottom │
                    │ — find a "body region" (a 4×4+     │
                    │ block of opaque non-near-white     │
                    │ pixels surrounded by frame)?       │
                    └─────────┬──────────────────────────┘
                              │ yes
                  ┌───────────▼───────────┐
                  │       Kind B          │
                  │   (full-window)       │
                  └───────────────────────┘

                              │ no
                              ▼
                  ┌───────────────────────┐
                  │       Kind C          │
                  │   (fixed bitmap)      │
                  └───────────────────────┘
```

For Kind B, the slice boundaries (top/right/bottom/left in cicn pixels) come from `deriveFrameGeometry` — the scan-from-edge algorithm in `src/themes/runtime/deriveFrameColor.ts`.

---

## 3. CSS `border-image` mechanics

CSS `border-image` is the workhorse for both 3-slice (Kind A) and 9-slice (Kind B). The model:

```
 source image (cicn)                  rendered element
 ┌──┬───────────┬──┐                 ┌──┬───────────────┬──┐
 │ A│     B     │ C│                 │ A│       B       │ C│
 ├──┼───────────┼──┤                 ├──┼───────────────┼──┤
 │  │           │  │                 │  │               │  │
 │ D│     E     │ F│  ────────►      │ D│       E       │ F│
 │  │           │  │                 │  │               │  │
 ├──┼───────────┼──┤                 ├──┼───────────────┼──┤
 │ G│     H     │ I│                 │ G│       H       │ I│
 └──┴───────────┴──┘                 └──┴───────────────┴──┘
   ↑slice top   ↑slice right
                                     • A,C,G,I (corners): rendered at NATIVE pixel size
                                       (slice extracted directly, no scaling)
                                     • B (top): stretched horizontally OR tiled
                                       (border-image-repeat)
                                     • D,F (sides): stretched vertically OR tiled
                                     • H (bottom): same as B
                                     • E (center): filled into the content box
                                       when `fill` keyword is on the slice
```

`border-image` parameters:

| Property | What it controls |
|---|---|
| `border-image-source` | The cicn URL |
| `border-image-slice` | Pixel coordinates in the SOURCE image where slices cut. `0 39 0 25 fill` = no top/bottom slice, right=39px, left=25px, and the center fills the content box. |
| `border-image-width` | How much SCREEN space each border occupies. Should match the slice values for crisp native-size corners. |
| `border-image-repeat` | `stretch` / `repeat` / `round` / `space`. `round` is period-correct for pinstripes — tiles whole copies with slight resize to fit. |

**Always pair with `image-rendering: pixelated`** to preserve crisp 1-bit chrome appearance.

---

## 4. 3-slice (Kind A) — current implementation

For titlebar-only cicns, the slice has top=0 and bottom=0:

```
 cicn (74×25)                                 rendered titlebar (380×25)
 ┌──┬────────┬───────┐                       ┌──┬──────────────────┬───────┐
 │ A│   B    │   C   │                       │ A│        B'        │   C   │
 │  │ (10×25)│(39×25)│   ───────►            │  │ (sized to fill)  │       │
 │  │        │       │                       │  │  middle tiles    │       │
 └──┴────────┴───────┘                       └──┴──────────────────┴───────┘
   ↑slice    ↑                                  ↑border-left       ↑border-right
   left=25   slice right=39                     25px native        39px native
```

A is rendered as the `border-left` (close-box widgets at native pixel size). C is `border-right` (zoom-box widgets). B is the title-pill stretch zone (the cicn's "between widgets" pattern), tiled across the variable middle width via `border-image-repeat: round`.

Slice boundaries come from `computeStretchZone(recipe, namedParts, cicnWidth)` — the widest contiguous run of fill segments (recipe entries whose part code isn't in `windowType.parts`).

Implemented in: `src/themes/runtime/applyChromeAs3Slice.ts → applyTitlebarAs3Slice()`

Side+bottom frame is a thin scheme-derived hairline (1-2px for thin-frame schemes like 7 Le). For Kind A, the `[data-aaron-edge]` containers paint via 3-slice piece divs sized by `--aaron-frame-{left,right,bottom}-px` custom properties stamped from `deriveFrameGeometry`.

---

## 5. 9-slice (Kind B) — new implementation

For full-window cicns, the slice includes top + bottom too:

```
 cicn (132×64)                                 rendered window (480×320)
 ┌──┬────────┬───────┐                        ┌──┬─────────────────────┬───────┐
 │ A│   B    │   C   │ (top widgets row)      │ A│         B'          │   C   │ ← border-top
 ├──┼────────┼───────┤                        ├──┼─────────────────────┼───────┤
 │  │        │       │                        │  │                     │       │
 │ D│   E    │   F   │ (body row)             │ D│      E (body)       │   F   │ ← borders
 │  │        │       │     ─────►             │  │   stretches/tiles   │       │   stretch
 │  │        │       │                        │  │                     │       │   vertically
 ├──┼────────┼───────┤                        ├──┼─────────────────────┼───────┤
 │ G│   H    │   I   │ (bottom frame)         │ G│         H'          │   I   │ ← border-bottom
 └──┴────────┴───────┘                        └──┴─────────────────────┴───────┘
   ↑slice    ↑slice                              ↑border ↑content        ↑border
   left      right                               left    box (transparent right
                                                         + native input)
```

A,C,G,I are the cicn's CORNERS — rendered at native pixel size at the window's corners. They never scale. B is the top frame center (titlebar visual minus widgets), tiles horizontally as window grows wider. H is the bottom frame center, tiles horizontally. D, F are the side frame centers, tile vertically. E (center, with `fill`) fills the content box behind everything.

Slice boundaries come from `deriveFrameGeometry(cicnUrl)`:
- `top` = titlebar height as encoded in the cicn (e.g., 18 for ErgoBox's tab+top-frame)
- `bottom` = derived by scanning bottom rows for the body transition (e.g., 6-7 for ErgoBox)
- `left`/`right` = derived by scanning side columns for the body transition

Implementation pattern: `applyWindowAs9Slice(windowEl, ...)` writes `border-image-*` styles to the window ROOT (not the titlebar). The titlebar element stays as a positioned overlay for click + drag + the title text — its rendered position aligns with the cicn's top border region.

```
 .aaron-window {
   box-sizing: border-box;
   border-style: solid;
   border-color: transparent;
   border-top-width: <topSlice>px;
   border-right-width: <rightSlice>px;
   border-bottom-width: <bottomSlice>px;
   border-left-width: <leftSlice>px;
   border-image-source: url(<cicn>);
   border-image-slice: <top> <right> <bottom> <left> fill;
   border-image-width: <top>px <right>px <bottom>px <left>px;
   border-image-repeat: round;
   image-rendering: pixelated;
 }
 .aaron-titlebar {
   position: absolute;
   top: 0; left: 0; right: 0;
   height: <topSlice>px;
   /* No own border-image — the window's border covers this region */
 }
```

Implemented in: `src/themes/runtime/applyChromeAs9Slice.ts → applyWindowAs9Slice()`

---

## 6. Fallback (Kind C) — fixed bitmap

For cicns that don't fit either model, the renderer falls back to:

1. Detect via classifier — neither titlebar-only nor full-window with body.
2. Render the cicn as a non-stretching background of the window root, sized to fit (`background-size: contain` or `cover` depending on aspect ratio).
3. Skip border-image entirely.
4. Side effect: window resize distorts or crops the chrome. This is the documented limitation.

A future improvement could be canvas-composite rendering — load the cicn pixels, render them into a runtime-generated bitmap at the window's exact size with intelligent stretching. Out of scope for now.

---

## 7. Path selection in `applyChromeFromTheme`

The renderer dispatches on **two** axes, not one:

1. **Classifier kind** (the cicn's geometric shape): titlebar-only / full-window / fixed-bitmap
2. **Recipe density** (the wnd# data's slice complexity): simple / rich

```ts
const kind = classifyChromeCicn(cicnUrl, windowType);
const recipe = recipeDensity(windowType.edges); // see §7.1

switch (kind) {
  case 'titlebar-only':            // Kind A
    applyTitlebarAs3Slice(...);
    applyHairlineFrame(...);
    break;
  case 'full-window':               // Kind B
    if (recipe === 'rich') {
      composeRichRecipe(...);       // §7.2 — N-segment DOM composer
    } else {
      applyWindowAs9Slice(...);     // §5 — CSS border-image
    }
    break;
  case 'fixed-bitmap':              // Kind C
    applyFixedBitmap(...);          // current: falls back to Kind A treatment
    break;
}
```

Detection costs: classifier = one image fetch + pixel scan per cicn (cached); recipe density = synchronous wnd# traversal (no I/O).

### 7.1 What counts as a "rich" recipe?

A recipe is **rich** when CSS `border-image` (which is 9-slice only — 4 corners + 4 sides + 1 center) is physically incapable of expressing the slicing the recipe describes. The discriminator is **fill segments per edge** (entries whose `part` is *not* in the `parts` table — i.e., spans of cicn pixels that need to tile). Named-widget entries don't strain `border-image` because they're positioned via the `parts` map, not the border-image slicing.

```ts
function recipeDensity(edges: Edges, parts: Parts): 'simple' | 'rich' {
  const fillsPerEdge = (['top', 'right', 'bottom', 'left'] as const).map(
    (side) => (edges[side] ?? []).filter((e) => !(e.part in parts)).length,
  );
  // border-image gives us exactly ONE fill span per side (between the corners).
  // Anything beyond that is a fidelity loss — but in practice schemes with up
  // to ~6 fill segments per edge still render acceptably with 9-slice because
  // the in-between fills are short and visually uniform. The threshold is set
  // at the corpus-empirical gap (see §7.1 table): 6 is the highest count among
  // schemes that look fine with 9-slice today; 9 is the lowest among schemes
  // that visibly drop decoration.
  return Math.max(...fillsPerEdge) > 6 ? 'rich' : 'simple';
}
```

The threshold (`> 6`) is corpus-empirical: at the time of writing, the Kind B schemes split cleanly:

| Scheme | Kind | Max fills / edge | Recipe density | Path |
|---|---|---:|---|---|
| 7 Le | A | 6 | n/a | 3-slice (Kind A overrides) |
| ErgoBox | B | 4 | simple | 9-slice |
| Big Blue | B | 4 | simple | 9-slice |
| 1138 | B | 5 | simple | 9-slice |
| **1990** | **B** | **9** | **rich** | **composer** |
| Acid | C | 17 | rich | falls back to Kind A (Kind C limit) |
| evolution | C | 9 | rich | falls back to Kind A (Kind C limit) |

Two observations:

1. **Kind C schemes also have rich recipes** (Acid 17, evolution 9) but the composer doesn't help them — Kind C is fixed-bitmap, not tile-able. They remain a deferred canvas-composite problem.
2. **7 Le sits at 6 fills** — right at the edge of the threshold — but Kind A overrides any recipe density discussion since 7 Le has no body region. The 3-slice path is unaffected.

If a future scheme lands between 7 and 8, revisit the threshold — but the gap between 5 (1138) and 9 (1990) is comfortable for current sizing.

### 7.2 The rich-recipe composer (`composeRichRecipe`)

**Output contract:** for each edge with a non-trivial recipe, emit a horizontal (or vertical) flex row of absolutely-positioned segment divs. Each segment is one of:

- **Fill segment** — `background-image: url(cicn); background-position: -<start>px 0; background-repeat: repeat` — tiles the cicn pixels for that span. Span width is recipe-derived; rendered width depends on the window's actual size (the edge container is `flex: 1 1 auto` and segments distribute by `flex-basis: <span>px`).
- **Named widget segment** — fixed-width div sized at the named part's native rect, with `background-image` cropped to that rect. Acts as a hit target for the part (clickable, role-anchored).

Corners are pinned at native size (no stretch). The body cell is independent — it can carry a `ppat` fill if cinf references one, or stay transparent for content.

**Why a DOM composer and not SVG or canvas:**

- **DOM** — natural hit targets per named widget (close box, zoom box, etc.) for free; standard pointer events; cheap to update on resize via flex.
- **SVG** — would require manual hit-target rects and breaks pointer events through nested `<image>` elements.
- **Canvas** — pixel-perfect but loses hit-target semantics; deferred for Kind C where it's the only viable path.

**Conformance check:** the segment positions emitted by `composeRichRecipe` must match the segment bands drawn by the diagnostics `Edge segments` overlay (`demo/diagnostics.html`) at the same recipe-derived offsets. Visual diff is the regression guard.

**Performance:** segment count is bounded by recipe entries (worst observed: 22 per edge × 4 edges = 88 divs per window). Compared to the rest of the AaronWindow DOM this is negligible.

---

## 8. Why not just one approach?

You could theoretically force every scheme through 9-slice. Why don't we?

1. **Kind A schemes** (7 Le) have cicns only 25px tall. A 9-slice rendering would force top=22, bottom=1, but with no body region in the cicn, the `fill` would be empty pixels — needs a separate fill mechanism anyway.
2. **Kind C schemes** (Acid) have decoration that doesn't tile coherently. 9-slice would produce visible seams where slice boundaries land mid-decoration.
3. **Architectural cleanness**: each kind has a distinct geometry, and forcing them through one path requires conditionals throughout. Three smaller specialized renderers are easier to maintain.

The classifier picks once per theme load; the right renderer runs once per window apply.

---

## 9. Open questions / future work

- **Animated chrome** — some schemes have collapsed/active state transitions. Currently we re-apply on state change; could be smoother.
- **Per-state cicn caching** — multiple cicns for active/inactive/collapsed × document/dialog/utility means 12+ cicn samples per scheme. Probably fine for now, worth profiling at scale.
- **Canvas-composite for Kind C** — render the cicn through a canvas to a window-sized texture, with smart stretching that respects perceived structure. Significant effort, deferred.
- **wnd# `parts` map utilization** — currently mostly informational (used for stretch-zone detection). Could anchor specific control hit-targets (close-box click area, etc.) once we wire interactive titlebar widgets.

---

## 10. Worked examples per bundled scheme

| Scheme | Cicn | Kind | Top | Right | Bottom | Left | Notes |
|---|---|---|---|---|---|---|---|
| mass:werk 7 Le | 74×25 | A | 0 | 39 | 0 | 25 | Titlebar-only; hairline frame |
| mass:werk Dark ErgoBox 2 | 132×64 | B | ~18 | 6 | 7 | 6 | Beveled frame all around; tab projects above |
| Acid (#1022) | 177×140 | C (probably) | — | — | — | — | Lego-block decoration doesn't tile cleanly |
| 1138 | ~96×48 | A or B | TBD | TBD | TBD | TBD | Multi-icon decoration |
| Big Blue (#1984) | 89×82 | B | ~20 | 4 | 4 | 4 | Apple-style with projecting tab |
| 1990 | 170×170 | B (rich) | ~22 segs | ~2 segs | ~22 segs | ~2 segs | Grunge frame — uses `composeRichRecipe` (§7.2); 9-slice would drop ~54 segments |
| 1991 evolution | 140×140 | C | — | — | — | — | Metallic pipes — fundamentally fixed-bitmap |

The classifier validates these expectations at runtime. If a scheme renders weirdly, check the gallery (`/themes-gallery.html`) to see whether it's misclassified.
