# Aaron UI — Raster-to-Skeleton Mapping Specification

**Status:** v1.0 — written 2026-05-19. Defines the rules by which Kaleidoscope scheme resources (cicn / cinf / wnd# / ppat / Colr) fill the DOM shapes defined in spec A.

**Spec B of three:**
- [`docs/aaron-ui-html-skeleton-spec.md`](./aaron-ui-html-skeleton-spec.md) — the DOM contract (spec A)
- **This document** — how scheme resources map onto that DOM (spec B)
- (TBD) `docs/aaron-ui-composer-spec.md` — the JS runtime that executes this mapping (spec C)

**Companion:** [`docs/aaron-ui-architecture-spec.md`](./aaron-ui-architecture-spec.md) — Kaleidoscope format details + WDEF protocol + canonical resource ID conventions. This spec references it heavily rather than duplicating.

**Scope guarantees:**
- This spec defines mapping **rules**, not their CSS/JS implementation.
- Section numbers in spec A are load-bearing (e.g., "§A-4" means spec A section 4). Aaron UI's runtime must produce the DOM defined there; spec B says how scheme resources fill it.
- When a rule depends on a kDEF disassembly finding not yet available, the section says so explicitly + names the parked open question.

---

## 1. Mapping model — the four kinds of mapping

Every scheme resource maps to spec-A DOM via one of four mechanisms:

| Mechanism | What it does | Where used |
|---|---|---|
| **Chrome composition** | cicn + cinf + wnd# → per-segment paint on a DOM element (border-image, tiled bg, etc.) | Windows, popup menus, menu containers |
| **State-cycle stamping** | A cicn-pair or cicn-quad (states stacked vertically inside one cicn) → stamped onto a chrome element based on `data-state` | Buttons, checkboxes, radios, disclosure triangles, sliders, arrows |
| **Color extraction** | cicn pixels are sampled (not rendered) → CSS custom properties on `:root` | Dialog/alert colors, Finder window colors, notification window |
| **Pattern overlay** | ppat → `background-image` (tiled) | Desktop pattern, utility pattern, indeterminate progress bar fill |

This taxonomy is the high-level decision tree the composer (spec C) walks.

---

## 2. cicn slicing geometry

### 2.1 Source coordinate system

A cicn has its own pixel coordinate system: origin top-left, integer pixels. Aaron UI never resizes cicn pixels in transit — the source PNG (or raw image) is the canonical raster.

### 2.2 The four geometric inputs

For chrome cicns, four inputs define the slicing geometry. The composer needs all four before it can paint:

| Input | Source | Meaning |
|---|---|---|
| `cicn.width` × `cicn.height` | cicn dimensions | The native-pixel canvas |
| `cinf.cornerSize` | cinf bytes (per K2 TMPL 129) | Pixel width of corner regions on all four sides |
| `cinf.sideThickness` | cinf bytes | Pixel thickness of the edge strip (top/bottom = vertical, left/right = horizontal) |
| `cinf.rectList[1..4]` | cinf rectangles | Named-widget rectangles (close box, zoom box, etc.) in cicn-pixel coords |

### 2.3 The four "named bands"

These four bands tile the cicn canvas:

```
        ←───────── cicn.width ─────────→
       ┌────┬───────────────────────┬────┐  ↑
       │ TL │     TOP STRIP         │ TR │  │ cornerSize (or sideThickness)
       ├────┼───────────────────────┼────┤  │
       │ L  │                       │ R  │  │ cicn.height
       │ S  │      BODY REGION      │ S  │  │
       │ T  │   (filled by ppat     │ T  │  │
       │ R  │    or transparent)    │ R  │  │
       │ I  │                       │ I  │  │
       │ P  │                       │ P  │  │
       ├────┼───────────────────────┼────┤  │
       │ BL │   BOTTOM STRIP        │ BR │  │ cornerSize
       └────┴───────────────────────┴────┘  ↓
```

Corner regions are square (cornerSize × cornerSize). Top + bottom strips are `(width - 2×cornerSize) × sideThickness`. Left + right strips are `sideThickness × (height - 2×cornerSize)`. The body region is whatever's left.

When `cinf.cornerSize` or `cinf.sideThickness` is absent or 0, fall back to the "part-0 body rect" (`cinf.rectList[0]`) — its inset from the cicn bounds defines the strip widths implicitly.

### 2.4 Recipe (wnd#) segments

Spec-A windows are 8 widgets in the worst case (close + zoom + collapse + proxy-icon + title + 4 corners). Kaleidoscope encodes their **positions along edges** via `wnd#` recipe entries: each entry is `(part code, border offset)`. Adjacent entries on the same edge define a segment.

Recipe walking rules:

1. Group recipe entries by edge (top, bottom, left, right). The grouping is implicit in the K2 format — borders increase along each edge then jump to the next.
2. For each edge, walk entries pairwise: entry `i` defines segment `[border_i, border_{i+1})`.
3. The trailing entry on each edge is the **null terminator** — its position marks the segment end; its part code is unused.
4. Within a segment, the part code dictates render behavior per §3 below.

### 2.5 Slice-vs-stamp boundary

Two rules together resolve every recipe segment's render behavior. Both come from K2:

| Part code | Slice or stamp? | What gets painted |
|---|---|---|
| `0` (null) | Neither | Don't draw. Skip the segment. |
| 1-4 (named widgets) | Stamp | The corresponding `rectList[part]` rectangle in cicn pixels, at the segment's start position, at native size. |
| 5, 6 (divider sandwich) | Slice | The cicn pixels at the segment's source slice (interpolated from the cicn band the edge belongs to). |
| 8 (universal stretch) | Slice | Same. |
| 18 (gradient stretch) | Slice | Same. Per K2 §Speed: same as 8 for our purposes. |
| 10, 11, 15, 17 (other non-named) | Slice | Same. Treat as universal stretch unless future kDEF disassembly says otherwise. |

**See open question §13.1** for divider-sandwich semantics not yet pinned down.

---

## 3. Stretch vs tile policy

### 3.1 K2 Speed Note (the authoritative principle)

> Tiling parts of icons, while cool, can be slow, so to make your scheme as fast as possible, use stretching instead of tiling wherever you can. For cicn's, turn off the Tile Sides option in the cinf resource whenever it is not needed. For windows, Kaleidoscope runs fastest if the stretch regions are only one pixel high or wide... If a one pixel stretch region does not fit into your window frame, you can split a larger stretch region into two regions, making the first pixel the stretch region and the remainder a null region (part code 0) that does not draw.

**Three consequences:**

1. **Default rendering is stretch**, not tile. CSS: `border-image-repeat: stretch`.
2. The fastest path is **1-pixel-wide stretch regions** (a single column or row stretched). These look like solid color bars — the author chose the pixel deliberately.
3. **Tiling is opt-in** via `cinf.tileSides`. When set, tile in the per-edge direction; otherwise stretch.

### 3.2 Hybrid policy (current Aaron UI behavior)

Even with stretch-default, naively stretching a 60-px wide ornament across a 600-px window distorts the graphic. Aaron UI compromises:

| Segment span | Render |
|---|---|
| span ≤ `TINY_STRETCH_THRESHOLD` (= 2 px) | Stretch the source slice across the segment. Equivalent to 1-px-stretch behavior. |
| span > threshold | Stretch the **full-edge slice** (from the cicn band) across the segment. Preserves graphic content's once-ness while not multiplying static art. |

The threshold is a tuning knob. K2 documentation does not specify a threshold value — the value `2` is empirical (matches what most period schemes' authors anticipated, based on §13.2 open question).

### 3.3 `cinf.tileSides` override

When `cinf.tileSides` flag is set for a given cicn:
- The composer switches the segment to `border-image-repeat: repeat` (CSS tile) instead of stretch.
- Tile direction is per-edge: horizontal for top/bottom edges, vertical for left/right edges.
- This applies to ALL segments on the cicn's edges, not just one segment.

### 3.4 Control-family override table

Per K2 §Buttons/Menus/etc., controls have specific stretch behaviors:

| Element family (spec A §) | Default | Override |
|---|---|---|
| Windows (A§2) | Per recipe / cinf | — |
| Push buttons (A§3.1) | 9-slice stretch | — |
| Default buttons (A§3.1) | 9-slice stretch | Outer ring also 9-slice |
| Bevel buttons (A§3.2) | 9-slice stretch | — |
| Checkboxes (A§4.1) | Stamp at native (no stretch) | — |
| Radios (A§4.2) | Stamp at native | — |
| Disclosure triangles (A§5) | Stamp at native | — |
| Little/spin arrows (A§6) | Stamp at native | — |
| Tabs (A§7) | Horizontal stretch only | Pane stretches both ways |
| Scrollbar track (A§8) | Stretch along main axis | Arrows + thumb stamped |
| Sliders track (A§9) | Stretch along main axis | Thumb stamped |
| Progress bar frame (A§10) | 9-slice stretch | Fill + track: horizontal stretch only |
| Menu bar / menus (A§11) | "Simply stretched" | Dividers: horizontal stretch only |
| Popup menus (A§12) | Stretched (text half + arrow half) | Arrow glyph stamped |
| Window headers (A§13) | "Simply stretched" | — |
| Placards (A§14) | "Simply stretched" | — |

"Simply stretched" = single source bitmap stretched across the full element bounds, no slicing.

---

## 4. Per-family mapping rules

For each element family in spec A, define the resource → DOM mapping. Section numbers below mirror spec A's.

### 4.1 Windows (A§2)

**Chrome cicn pair:** Per the window's type, look up the active + inactive cicns via the architecture spec's §6.1 ID table. Map `data-state`:

| `data-state` | Active cicn | Inactive cicn | Use |
|---|---|---|---|
| `active` | yes | no | Default render |
| `inactive` | no | yes | Render with inactive variant |
| `collapsed` | -14331 (collapsed-active) | — | Replaces the chrome cicn entirely |
| `collapsed-inactive` | — | -14332 (collapsed-inactive) | Same |

**Composition:** the chrome cicn is sliced per §2.3 + walked per recipe (§2.4) + each segment rendered per §3.

**Where it paints:** in the DOM defined in A§2.2 — segments go inside `[data-aaron-chrome-edge="{top|bottom|left|right}"]` strips on the window root, with one `[data-aaron-chrome-segment]` div per recipe segment. The titlebar widget overlays from A§2.4 sit inside `.aaron-titlebar__widgets` and are positioned absolute from the `rectList` rects.

**Background:** `cinf.bgPatternId` (if non-zero) is loaded as a ppat and tiled into `.aaron-content`'s background.

**Collapsed state:** A§2.3 specifies `data-state="collapsed"`. The composer must hide `.aaron-content` + the 3 non-top edge strips, and swap the top-edge chrome cicn to the collapsed-state cicn.

**Hit-test overlays:** for each named-widget rect in `rectList[1..4]`, an `.aaron-widget--{name}` button is inserted into `.aaron-titlebar__widgets`. Position absolute, dimensions = the rect, background-image = `data-state="pressed"` swaps to `-14330` Widget Down State cicn at the same rect.

**Movable + Modal + Alert variants** use the same composer; only the chrome-cicn ID differs (per A§2.1's window-type table).

### 4.2 Push buttons / default buttons (A§3.1)

**Cicn pair / quad:** Per arch §6.2 — `-10238` (pressed) / `-10237` (normal) / `-10236` (disabled) / `-10235` (default ring).

**State mapping:**

| `data-state` | cicn | Notes |
|---|---|---|
| `normal` | -10237 | Default |
| `pressed` | -10238 | Default-button pressed: also draw -10230 (default ring pressed) outer overlay |
| `disabled` | -10236 | |
| `focused` (default) | -10237 + -10235 outer overlay | Outer ring rendered on `.aaron-button--default` |

**Composition:** 9-slice on each cicn. Cicn has its own cinf (4 corners + 4 sides). Paint via border-image on the `<button>` element.

### 4.3 Bevel buttons (A§3.2)

**Cicn cluster:** Per arch §6.2 — bevel button cluster.

**State + value matrix:** `data-state` (normal/pressed/disabled) × `data-value` (off/on/mixed) × `data-size` (small/normal/large). K2 specifies the cicn IDs for each combination.

**Composition:** same 9-slice as §4.2.

### 4.4 Checkboxes (A§4.1)

**Cicn cluster:** Per arch §6.3 — `-9504..-9495` (4 values × 3 states each).

**State mapping:**

| `data-value` | `data-state` | cicn |
|---|---|---|
| `off` | `disabled` / `normal` / `pressed` | -9504 / -9503 / -9502 |
| `on` | same | -9501 / -9500 / -9499 |
| `mixed` | same | -9498 / -9497 / -9496 |
| `alternate-on` | same | -9495 / -9494 / -9493 |

**Composition:** stamp at native cicn size on `.aaron-checkbox__chrome`. No stretch, no tile. Cicn is its own dimensions; the DOM box has those exact dimensions.

### 4.5 Radios (A§4.2)

**Cicn cluster:** Per arch §6.4 — `-9492..-9484`.

**State mapping:** same 3×3 matrix as §4.4 minus alternate-on.

**Composition:** stamp at native size on `.aaron-radio__chrome`.

### 4.6 Disclosure triangles (A§5)

**Cicn cluster:** Per arch §6.6 — `-10112..-10086` (varies by facing + animation).

**State mapping:**

| `data-facing` | `data-state` | `aria-expanded` | cicn |
|---|---|---|---|
| `right` | `normal` | `false` | -10112 |
| `right` | `pressed` | `false` | -10111 |
| `right` | `disabled` | `false` | -10110 |
| `down` | `normal` | `true` | -10104 |
| ... | ... | ... | etc per arch §6.6 |

**Animation:** when `aria-expanded` flips, optional 5-frame animation cycles cicns -10109..-10105 (right→down) or -10101..-10097 (down→right). Aaron UI ticks the frame counter at 1/20s per K2.

**Composition:** stamp at native size on `.aaron-disclosure__glyph`.

### 4.7 Little arrows / spin arrows (A§6)

**Cicn cluster:** Per arch §6.7 — `-10048..-10045` (disabled / normal / up-pressed / down-pressed). Single cicn for the pair; up/down halves are stacked vertically within the cicn.

**State mapping:** combination state — `data-state` of each child arrow button drives which half of the cicn is highlighted.

**Composition:** stamp the cicn over `.aaron-arrows`; use CSS `background-position` to expose the correct half for the pressed state.

### 4.8 Tabs (A§7)

**Cicn cluster:** Per arch §6.8 — `-9984..-9977` (large) / `-9976..-9969` (small).

**State + selection matrix:** the cluster has cicns for selected / unselected × normal / pressed / disabled × left-cap / center / right-cap.

**Composition:** per K2, tabs stretch horizontally only (the bottom edge meets the pane). Each tab is 3-slice horizontally: left-cap, stretchable center, right-cap. Pane stretches both ways (9-slice).

### 4.9 Scrollbars (A§8)

**Cicn cluster:** Per arch §6.9 — thumbs `-10208..-10205` + ghosts `-8272/-8271` + tracks `-8288..-8273` + small variants `-8270..-8249`.

**Composition rules:**
- Track: 3-slice along the main axis (or single if Colr "Unified Scroll Bar Track" flag is set — then no end caps, just continuous fill behind the thumb).
- Thumb: stamp at native; if Colr "Stretch Scroll Bar Thumb from Center" flag is set, stretch the center-row of the thumb cicn pixels along the axis.
- Arrows: stamp at native at each end (or paired-one-end if "Windows-style Scrollbars" Colr flag).
- Ghost: stamp at native on `.aaron-scrollbar__thumb-ghost` during drag.

**Colr-flag → DOM attribute mapping** (per spec A §20):
| Colr flag | DOM attribute on `.aaron-scrollbar` |
|---|---|
| Unified track | `data-aaron-scrollbar-style="unified"` |
| Windows-style | `data-aaron-scrollbar-layout="paired"` |
| Stretch-from-center | `data-aaron-thumb-stretch="center"` |

The composer reads Colr once at scheme load + stamps these once. CSS keys off them for layout.

### 4.10 Sliders (A§9)

**Cicn cluster:** Per arch §6.11 — tracks + thumbs + ticks × 4 directions × states.

**Composition rules:**
- Track: stretch along the main axis only. 3-slice horizontally for horizontal sliders, 3-slice vertically for vertical.
- Thumb: stamp at native, positioned via CSS variable `--slider-value`.
- Tick marks: each tick is a stamp of the tick cicn. Layout via CSS `--tick-position` (percent).

### 4.11 Progress bars (A§10)

**Cicn cluster:** Per arch §6.12 — `-10080..-10075` (determinate) + `-10080..-10073` (indeterminate animation).

**Composition rules (determinate):**
- Frame: 9-slice with cinf.
- Track: stretched horizontally only (3-slice horizontal).
- Fill: stretched horizontally only (3-slice horizontal). CSS `--progress` variable drives width.

**Composition rules (indeterminate):**
- Fill DOM swaps to `.aaron-progress__fill--indeterminate`.
- 8 ppat IDs cycle on a 125 ms interval. Per K2, single-ppat schemes can also animate by shifting the ppat 4 px/frame.
- `data-frame="0..7"` ticks; CSS `background-image: var(--ppat-frame-N)` keys off this.

### 4.12 Menus (A§11)

**Cicn cluster:** Per arch §6.5 — menu bar / menu title / pull-down / free / divider / selected-item / app-menu-grip + extended borders.

**Composition rules:**
- Menubar background (-12240): simply stretched across `.aaron-menubar`.
- Menubar item (-12239 normal / -12238 pressed): simply stretched per item, swapped on `data-state="pressed"`.
- Pull-down + free menu background (-12237 / -12234): simply stretched across the menu popup container.
- Menu item highlight (-12236 / -12233): simply stretched across `.aaron-menu__item[data-state="selected"]`.
- Divider (-12235 / -12232): stretched horizontally only (corners at left/right caps; side ignored). DOM: `.aaron-menu__divider`.
- App menu grip (-12231..-12229): stamped at native.
- Solo menu background: K2-only; rare; treat like free menu.

**Extended borders + transparency (Kaleidoscope ≥ 2.3):**
- cicn -12228, -12226 = 8-bit alpha masks for the menu borders.
- Last 2 bytes of menu cinf = transparency level (0x0000 solid → 0xFFFF transparent).
- DOM attribute on the menu element: `data-has-extended-border="true"` + `data-alpha="{16-bit hex}"`.
- CSS keys off these to apply alpha-mask + opacity.

### 4.13 Popup menus (A§12)

**Cicn cluster:** Per arch §6.10 — text half + arrow half + state matrix.

**Composition rules:**
- Text half (`-8208..-8203`): simply stretched across `.aaron-popup-menu__text`.
- Arrow half background (`-8208..-8203` right half OR `-8202..-8200` for arrow-only): simply stretched across `.aaron-popup-menu__arrow`.
- Arrow glyph: stamped at native on top of arrow half. Glyph cicn varies by size + state (arch §6.10).
- Open dropdown: rendered as `.aaron-menu--free` per §4.12.

**Variant detection:** if popup width < text-half min-width, switch DOM to arrow-only variant. The min-width threshold is the arrow-only background cicn's native width (`-8202..-8200` width).

### 4.14 Window headers (A§13)

**Cicn pair:** Per arch §6.15 — `-9568` inactive / `-9567` active.

**Composition:** simply stretched across `.aaron-window-header`.

### 4.15 Placards (A§14)

**Cicn cluster:** Per arch §6.16 — `-9792` / `-9791` / `-9790`.

**Composition:** simply stretched across `.aaron-placard`, swapped on `data-state`.

### 4.16 Dialog + alert colors (A§15)

**Color extraction only.** Per arch §6.13 — cicns `-9776..-9773`.

**Extraction rule:** read the cicn's color table (cluts in the cicn structure), pull the dominant background + dominant foreground color from the pixel histogram, plus the bg pattern if cinf.bgPatternId is set.

**Stamp as CSS custom properties** on `:root`:

```css
--aaron-dialog-active-bg
--aaron-dialog-active-fg
--aaron-dialog-active-pattern
--aaron-dialog-inactive-bg
--aaron-dialog-inactive-fg
--aaron-alert-active-bg
--aaron-alert-active-fg
--aaron-alert-inactive-bg
--aaron-alert-inactive-fg
```

**Open question §13.4:** which exact pixel of the cicn is the canonical "bg color"? Period schemes appear to use color at coords `(1, height-1)` (bottom-left interior) but this isn't documented. kDEF would settle it.

### 4.17 Finder window colors (A§16)

Per arch §6.14 — `-9552..-9548`. Same extraction as §4.16. Stamp as `--aaron-desktop-icon-{bg,fg}` / `--aaron-icon-view-{bg,fg}` / `--aaron-list-view-{bg,fg}` / `--aaron-list-view-sort-col-bg` / `--aaron-list-view-separator`.

### 4.18 Notification window (A§17)

Per arch §6.17 — `-9547`. Stamp as `--aaron-notification-bg`.

### 4.19 Cursors (A§18)

Per arch §6.18 — `crsr 0`, `crsr -20488..-20486`. Convert to PNG + apply hotspot. Stamp as `cursor: url(...)` on `:root` for the default cursor; cluster cursors are emitted as named CSS classes for opt-in use.

---

## 5. cinf field reference

For each cinf-bearing cicn, the cinf resource contains (per K2 TMPL 129):

| Field | Bytes | Meaning |
|---|---:|---|
| cornerSize | 2 | Pixel size of each square corner region |
| sideThickness | 2 | Edge strip thickness |
| tileSides | 2 | 0 = stretch, 1 = tile |
| patternAnchor | 2 | Anchor for the bg pattern: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right |
| bgPatternId | 2 | ID of ppat resource to use as background, 0 = none |
| textAnchor | 2 | Title text anchor: 0=center, 1=left, 2=right (per K2 §Anchoring) |
| embossAnchor | 2 | Emboss offset anchor for title text |
| rectList[0..4] | 5 × 8 | 5 rects: body region + 4 named widgets. Each rect = `(left, top, right, bottom)` 16-bit |
| (Kaleidoscope 2.3+) alphaLevel | 2 | Transparency 0x0000-0xFFFF (menus only) |
| (Kaleidoscope 2.3+) extendedBorder | 1 | Boolean: use cicn -12228/-12226 alpha mask (menus only) |

The 15 resize behaviors documented in K2 Scheme Factory MENU 139 are encoded in the upper bits of `tileSides` (5 stretch directions + 5 repeat directions + 5 anchor corners). **Open question §13.3** for the exact bit layout.

---

## 6. wnd# structure

Per arch spec §2 — `wnd#` is a list of (part code, border offset) pairs. The structure:

```
[edge top entries...]
[edge bottom entries...]
[edge left entries...]
[edge right entries...]
```

Edges are detected by border offset monotonicity (each edge's entries are sorted by offset, then offset resets at the next edge). The composer walks pairwise + creates segments.

Each segment becomes one `[data-aaron-chrome-segment]` div in the spec-A DOM, inside its edge's `[data-aaron-chrome-edge="..."]` strip.

---

## 7. ppat (pattern) resources

ppat = pixel pattern, classic Mac 8×8 or 16×16 tile.

**Loading:** decode to PNG at native dimensions.

**Usage:**
- `cinf.bgPatternId` → tile as `background-image` on the window's `.aaron-content`.
- ppat 17 → desktop pattern (stamp on `--aaron-desktop-pattern`).
- ppat 42 → utility window pattern.
- Indeterminate progress bar frames (per §4.11).

Patterns always tile at native size (`background-size: auto`, `background-repeat: repeat`).

---

## 8. Colr (scheme global flags)

Colr is a TMPL-typed structure with binary flags + scheme metadata. Each flag becomes a DOM attribute or CSS custom property stamped on `:root` or `.aaron-window` at scheme load. The full flag set is in arch spec §6 + spec A §20.

Aaron UI reads Colr once at scheme load, never per element. The composer's per-element rules above reference these flags by name (e.g., "if Colr 'Unified Scrollbar Track' is set").

---

## 9. Resource fallback chain

Schemes are not always complete. Aaron UI's fallback chain:

1. **Per-state cicn missing** (e.g., no `-9498` mixed checkbox): fall back to the same state's `on` cicn. If `on` is missing, fall back to `off`.
2. **cinf missing for a cicn that needs it**: synthesize cornerSize = 4, sideThickness = 1, no tile, no bg pattern.
3. **Per-window-type cicn missing**: fall back to the closest type per:
   - Modal Alert → Modal Dialog → Document Window
   - Movable Alert → Movable Dialog → Document Window
   - Utility (small) → Utility (large) → Document Window
4. **rectList missing widget rect**: omit the widget from the titlebar (no overlay rendered).
5. **wnd# missing**: synthesize a default recipe (corners stamped, edges stretched, no widget overlays).

Fallback decisions are logged so consumers can detect incomplete schemes.

---

## 10. State swap mechanism

The composer doesn't re-paint on every state change — instead it stamps **all candidate cicns** as CSS custom properties at scheme load, then CSS keys off `data-state`:

```css
.aaron-button {
  --cicn-normal: url("themes/<slug>/cicns/-10237.png");
  --cicn-pressed: url("themes/<slug>/cicns/-10238.png");
  --cicn-disabled: url("themes/<slug>/cicns/-10236.png");
  border-image-source: var(--cicn-normal);
}
.aaron-button[data-state="pressed"] { border-image-source: var(--cicn-pressed); }
.aaron-button[data-state="disabled"] { border-image-source: var(--cicn-disabled); }
```

State machines (per spec A §1.4) flip `data-state` synchronously; no JS-driven repaint.

---

## 11. Asset resolution + URL conventions

Per the existing `loadTheme` + `resolveAssetUrls` runtime: every scheme's cicns/cinfs/ppats are pre-extracted to disk at `themes/{slug}/{cicns|cinfs|ppats}/{semantic-name}.{png|json|png}`.

Spec B does not dictate file extensions or directory structure — that's the loader's contract. Spec B says only: "the composer resolves a cicn-ID + state to a URL (or data URI) via the runtime's asset resolver." Spec C will define the resolver.

**Recommended semantic-name convention** (already in use):
- `cicns/active-document-window.png`, `cicns/pressed-push-button.png` — human-readable
- `cinfs/active-document-window.json` — parsed cinf as JSON
- `ppats/desktop.png`, `ppats/utility.png` — patterns by name

The composer takes a `chromeElements` map (from the loaded `Theme` object) that maps semantic name → asset URL + dimensions + cinf.

---

## 12. Conformance checklist for a scheme

A scheme passes mapping conformance when:

- [ ] Every chrome cicn referenced in arch §6 either exists or has an explicit fallback per §9.
- [ ] Every cinf bears all required TMPL 129 fields (§5).
- [ ] wnd# recipe entries are well-formed: monotonic per edge, terminator entries present.
- [ ] Every rectList rect referenced by part codes 1-4 in wnd# is valid (inside cicn bounds).
- [ ] Colr flags are extracted + stamped (even if all default).
- [ ] No referenced cicn is missing without a fallback (§9 logs the case).

Aaron UI's runtime emits a conformance report on `loadTheme` for diagnostic dashboards.

---

## 13. Open questions (parked, mostly resolvable by kDEF disassembly)

These rules above are best-effort from documented sources. The following uncertainties remain. See [`docs/tracking/kdef-disassembly.md`](./tracking/kdef-disassembly.md) for the full disassembly plan.

### 13.1 Divider-sandwich semantics (parts 5/6)

K2 mentions parts 5+6 as a divider sandwich pair — the segment between two part-5/6 markers gets a specific treatment. Whether that treatment is "stretch the middle pixel" or "tile the slice" or "skip and let pattern show through" is not documented. Current Aaron UI treats them as universal-stretch (part-8).

### 13.2 Tile-vs-stretch threshold

The hybrid policy's `TINY_STRETCH_THRESHOLD = 2` (§3.2) is empirical. K2 doesn't specify a threshold — Kaleidoscope's kDEF likely has the exact logic. Until disassembled, the threshold is a tunable.

### 13.3 cinf upper bits (15-value resize behavior)

Scheme Factory's MENU 139 enumerates 15 resize behaviors but doesn't publish the bit layout in cinf. Aaron UI currently honors only the lower bit (tileSides 0/1). Full 15-value support requires either reverse-engineering or a known scheme test corpus.

### 13.4 Color-extraction pixel

Which exact pixel of a color-only cicn (§4.16-§4.18) is the canonical bg/fg color is undocumented. Aaron UI samples `(1, height-1)` empirically; kDEF disassembly would settle.

### 13.5 Pattern-anchor semantics for non-rectangular containers

cinf.patternAnchor specifies which corner the bg pattern anchors to (so seams align). For windows this is well-defined. For free menus + popup menus the anchor seems to follow the popup's screen position, but kDEF would confirm.

### 13.6 Indeterminate progress bar — frame timing + ppat IDs

K2 says ~125 ms per frame, 8 frames. Some schemes ship fewer ppat IDs and rely on shifting one ppat 4 px/frame. Detection logic (when to cycle vs shift) is empirical.

### 13.7 Animation timing for disclosure triangles

K2 says 1/20 s per frame, 5 frames. Confirmed by inspection. No open question — listed for completeness.

---

## 14. What this spec does NOT define

- **DOM shape** — that's spec A.
- **JS runtime architecture, lifecycle, error handling** — that's spec C.
- **CSS rules** for stretching, layering, layout — that's per-family stylesheet code (informed by §3 + §4 rules above).
- **Asset extraction from rsrc files** — that's the upstream `rsrc-to-theme` tool's contract.
- **kDEF assembly semantics** — disassembly is a tracked future ticket; this spec calls out the open questions but doesn't resolve them.

---

## 15. References

- K2 Scheme Reference (Kaleidoscope 2.3.1 installer)
- Scheme Factory 1.0PR2 — STR# 128, MENU 139, TMPL 129 (cinf), TMPL 130 (wnd#)
- Apple Inside Macintosh: Macintosh Toolbox Essentials, Window + Control Manager chapters
- [`docs/aaron-ui-architecture-spec.md`](./aaron-ui-architecture-spec.md) §2 (resource model), §4 (rendering algorithm), §6 (ID conventions)
- [`docs/aaron-ui-html-skeleton-spec.md`](./aaron-ui-html-skeleton-spec.md) §all (target DOM)
- [`docs/tracking/kdef-disassembly.md`](./tracking/kdef-disassembly.md) — kDEF disassembly tracking
