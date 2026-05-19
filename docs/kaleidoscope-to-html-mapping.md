# Kaleidoscope → HTML mapping reference

**Status:** v1.0 — written 2026-05-19 after the kDEF disassembly findings (see [`tracking/kdef-disassembly-findings.md`](./tracking/kdef-disassembly-findings.md)).

**Purpose:** a single-page lookup that answers "this Kaleidoscope feature → this HTML/CSS implementation" for every load-bearing piece of the format. Built from cross-referencing K2 Scheme Reference + Scheme Factory binary + Kaleidoscope's own kDEF binary against Aaron UI's current implementation.

**Audience:**
- Anyone porting a scheme + wondering "will Aaron UI render X?"
- Implementers extending Aaron UI's runtime
- Reviewers verifying we stayed true to the period author's intent

**Reading order:**
1. §1 = the rendering algorithm itself (what kDEF actually does)
2. §2 = resource-by-resource mapping
3. §3 = element-by-element mapping (with current Aaron UI status)
4. §4 = where we differ from period behavior + why

---

## 1. The rendering algorithm — period-correct, in five steps

Per the K2 Scheme Reference and confirmed via the kDEF 1.8.2 PowerPC disassembly:

1. **OS dispatches a WDEF/CDEF/MDEF message** (Apple Window/Control/Menu Manager protocol — wDraw, wHit, wCalcRgns, etc.).
2. **Kaleidoscope's kDEF receives the message** via stub WDEF/CDEF/MDEF resources installed in the System.
3. **The kDEF looks up scheme resources by name + ID** — cicn, cinf, wnd#, ppat — via `GetResource`. Resource IDs are TABLE-DRIVEN (only ~4 literal `GetResource(type, id)` calls in the entire 60KB 68k kDEF; everything else is computed).
4. **Composition happens via QuickDraw `CopyBits`** with source/destination rectangles. When `srcRect.size != dstRect.size`, CopyBits stretches via **sample-and-hold (nearest-neighbor)** — the period-correct pixelated scaling.
5. **Optional pattern fills** for body backgrounds via `PenPat` / `BackPat` / `PixPat` operations.

| Period reality | Aaron UI mapping |
|---|---|
| CopyBits sample-and-hold scaling | CSS `image-rendering: pixelated` + `border-image-repeat: stretch` |
| QuickDraw region clipping | CSS `overflow: hidden` + flexbox segment positioning |
| GWorld off-screen composition | No analog needed (browser composites natively) |
| 8-bit alpha (Kaleidoscope 2.3+) | CSS opacity / alpha channel in PNG |
| ResourceFork `GetResource(type, id)` | `theme.chromeElements[slug]` lookup |

**Critical implication:** there is no "smart" stretching, no antialiasing, no resampling. Kaleidoscope renders bitmaps AT NATIVE PIXEL SIZE with simple pixel-doubling when stretched. Aaron UI's `image-rendering: pixelated` is **the same algorithm**, not an approximation.

---

## 2. Resource → schema mapping

### 2.1 `cicn` (color icon)

The raster asset. Variable size; typically tens of pixels per side for controls, hundreds for window chrome.

| cicn field | Theme field | Note |
|---|---|---|
| Bitmap pixels | `chromeElements[slug].asset` | Extracted to PNG by the extractor |
| Width/height | `chromeElements[slug].{width, height}` | Native dimensions |
| Resource ID (negative) | `chromeElements[slug].sourceCicnId` | Diagnostic only; runtime uses slug |
| Resource name | Becomes the slug (via `slugify()`) | |

### 2.2 `cinf` (color info) — TMPL 129 in Scheme Factory

18 bytes per cinf. Documented in K2 + confirmed via inspection of Scheme Factory's TMPL 129 resource:

| Offset | Bytes | Field | Theme field | Status |
|---|---|---|---|---|
| 0 | 1 | `cornerSize` | `slice.corner` | ✓ |
| 1 | 1 | `sideThickness` | `slice.side` | ✓ |
| 2 | 1 | `tileSides` (0=stretch, 1=tile) | `slice.tile` (boolean) | ✓ |
| 3 | 1 | `patternAnchor` (0-5) | feeds `slice.resizeBehavior` | ✓ |
| 4-5 | 2 | `bgPatternId` (DWRD, ppat ID) | `bgPattern` (resolved to slug) | ✓ |
| 6-7 | 2 | `bgPixel.y` (DWRD) | `bgAnchor[1]` | **NEW (§13.4)** |
| 8-9 | 2 | `bgPixel.x` (DWRD) | `bgAnchor[0]` | **NEW (§13.4)** |
| 10-11 | 2 | `textPixel.y` (DWRD) | `textAnchor[1]` | ✓ |
| 12-13 | 2 | `textPixel.x` (DWRD) | `textAnchor[0]` | ✓ |
| 14-15 | 2 | `embossPixel.y` (DWRD) | `embossAnchor[1]` | ✓ |
| 16-17 | 2 | `embossPixel.x` (DWRD) | `embossAnchor[0]` | ✓ |

**Resize behavior encoding** (per Scheme Factory MENU 139 + our cross-corpus audit):

`(tileSides * 5) + patternAnchor` produces 0-9:

| ID | Behavior | tileSides | patternAnchor |
|---:|---|---:|---:|
| 0 | stretch-whole | 0 | 0 |
| 1 | stretch-top | 0 | 1 |
| 2 | stretch-left | 0 | 2 |
| 3 | stretch-bottom | 0 | 3 |
| 4 | stretch-right | 0 | 4 |
| 5 | repeat-whole | 1 | 0 |
| 6 | repeat-top | 1 | 1 |
| 7 | repeat-left | 1 | 2 |
| 8 | repeat-bottom | 1 | 3 |
| 9 | repeat-right | 1 | 4 |
| 10-14 | anchor-center / anchor-{corner} (×4) | encoding unconfirmed | |

**Empirical note:** all 7 bundled schemes (1138, 1990, acid, big-blue, evolution, masswerk-7-le, masswerk-dark-ergobox2) use **only behaviors 0-9**. Zero anchor-* (10-14) behaviors observed across the corpus. The 10-14 encoding remains technically open (spec B §13.3) but is **practically settled**: it doesn't matter for any actual scheme.

### 2.3 `wnd#` (window definition) — TMPL 1240 in Scheme Factory

Per K2's documented binary layout:

```
ZCNT (count − 1, count for rectangleList)
for each entry:
  DWRD part
  RECT {top, left, bottom, right}

Per-side recipes (Top / Bottom / Left / Right):
  ZCNT (count − 1)
  for each entry:
    DWRD part
    DWRD border (position along the edge)
```

Mapping:

| wnd# field | Theme field |
|---|---|
| `rectangleList[].part` (0-4) | becomes the key `part-N` in `windowTypes[type].parts` |
| `rectangleList[].rect {top,left,bottom,right}` | `windowTypes[type].parts[part-N].rect = [left, top, right, bottom]` (re-ordered to CSS convention) |
| `topSide[].part` | `windowTypes[type].edges.top[].part = "part-N"` |
| `topSide[].border` | `windowTypes[type].edges.top[].at` |
| `bottomSide` / `leftSide` / `rightSide` | analogous |

**Part code semantics** (from K2 §Speed Note + §Multiple Widgets):

| Part code | Meaning | Aaron UI handling |
|---:|---|---|
| `0` | Null — does not draw | Composer SKIPS the segment |
| `1-4` | Named widget — reference into `rectList` | Composer pins the rect at native size |
| `5` / `6` | Divider sandwich (parts 5+6 wrap a divider) | **Currently treated as universal-stretch** — spec B §13.1 still open |
| `8` | Universal stretch | Stretch the slice |
| `10`, `11`, `15`, `17` | Other non-named | Treated as universal stretch (empirical) |
| `18` | Gradient stretch | Same as `8` for our purposes |

### 2.4 `ppat` (pixel pattern)

8×8 or 16×16 tile. Extracted to PNG. Used as background fill via `cinf.bgPatternId`.

| ppat field | Theme field |
|---|---|
| Bitmap | `patterns[slug].asset` (PNG) |
| Repeat axis | `patterns[slug].repeat` ('horizontal' / 'vertical' / 'both') |

Note: most schemes leave `repeat` unset → defaults to `both`.

### 2.5 `Colr` (scheme global flags)

Per K2 + the cdev resource's prefs UI:

| Colr flag | Theme field | DOM data attribute (per spec A §20) |
|---|---|---|
| Unified Scroll Bar Track | `options.unifiedScrollbarTrack` | `data-aaron-scrollbar-style="unified"` |
| Windows-style Scrollbars | `options.windowsStyleScrollbars` | `data-aaron-scrollbar-layout="paired"` |
| Stretch Scroll Bar Thumb from Center | `options.stretchScrollbarThumbFromCenter` | `data-aaron-thumb-stretch="center"` |
| Menu highlight cicn overlays normal menu cicn | `options.menuHighlightOverlay` | `data-aaron-menu-overlay="true"` |
| Extended Scrollbar Arrows | `options.extendedScrollbarArrows` | `data-aaron-scrollbar-arrows="extended"` |

The stamping happens in `applyChromeFromTheme.ts` (composer step 2, see PR #138).

### 2.6 `crsr` (cursor)

| crsr field | Theme field |
|---|---|
| Bitmap | `cursors[slug].asset` (PNG) |
| Hotspot (x, y) | `cursors[slug].hotspot` |
| OS cursor type | `cursors[slug].fallback` (CSS keyword) |

---

## 3. Element-by-element → Aaron UI status

For each Kaleidoscope element family from K2's catalog:

| Family | Resource IDs | Period rendering | Aaron UI status |
|---|---|---|---|
| **Document Window** | cicn `-14336`/`-14335` + cinf + wnd# `-14336` | Recipe-driven per-segment via kDEF | ✅ Window composer (PRs #130, #138) |
| **Modal Dialog** | cicn `-14328`/`-14327` + same pattern | Same | ✅ Same composer; window-type dispatch picks the cicn |
| **Alert** | cicn `-14326`/`-14325` + same | Same | ✅ Same |
| **Utility Window** | cicn `-14304`/`-14303` + same | Same | ✅ Same |
| **Popup Window** | cicn `-12320`/`-12318` + same | Same | ✅ Same |
| **Push Button** | None — drawn by Mac OS CDEF | OS Appearance Manager | ✅ AaronButton CSS-only (period-correct per §13.4 finding 2.2) |
| **Default Button** | None — same | Same | ✅ AaronButton with .aaron-button--default |
| **Checkbox** | cicn `-9504..-9495` (3 values × 3 states) | Stamp at native | ✅ AaronCheckbox + attachThemeToCheckable (PR #139) |
| **Radio** | cicn `-9492..-9484` | Same | ✅ AaronRadio (PR #139) |
| **Disclosure Triangle** | cicn `-10112..-10086` (right/down × 3 states) | Stamp at native; optional animation | ✅ AaronDisclosure (PR #140); animation deferred |
| **Little / Spin Arrows** | cicn `-10048..-10045` | Stamp at native | ⏳ Not implemented |
| **Tabs** | cicn `-9984..-9969` (large + small) | Horizontal stretch | ⏳ Not implemented |
| **Scrollbar** | cicn `-10208`/`-8288..` + Colr flags | Complex (Colr-flag-driven layout) | ⏳ Not implemented |
| **Slider** | cicn `-10144..-10113` | Axis-stretched track + stamped thumb | ⏳ Not implemented |
| **Progress Bar** | cicn `-10080..-10073` + ppat for indeterminate | 3-layer (frame + track + fill) | ✅ AaronProgress determinate (PR #146); indeterminate deferred |
| **Menubar** | cicn `-12240..-12225` + Colr menu flags | Simply stretched | ⏳ Not implemented |
| **Pull-down / Free Menu** | Same range | Simply stretched + selected-item highlight | ⏳ Not implemented |
| **Popup Menu** | cicn `-8208..-8188` | Text + arrow sections, both stretched | ⏳ Not implemented |
| **Window Header** | cicn `-9568` / `-9567` (active/inactive) | Simply stretched | ✅ AaronWindowHeader (PR #144) |
| **Placard** | cicn `-9792..-9790` | Simply stretched | ✅ AaronPlacard (PR #144) |
| **Dialog/Alert colors** | cicn `-9776..-9773` | Color extraction (cinf-anchored pixel) | ⏳ Helper added (PR #149); consumers pending |
| **Finder window colors** | cicn `-9552..-9548` | Color extraction | ⏳ Same |
| **Notification window** | cicn `-9547` | Color extraction | ⏳ Same |
| **Cursors** | crsr `0`, `-20488..-20486` | OS cursor swap | ⏳ Schema field exists; runtime CSS not wired |

**Summary:** 11 of 24 element families ship cicn-driven rendering. The remaining 13 are well-scoped per-family follow-ups. Each follow-up reuses the patterns established by AaronCheckable / AaronDisclosure / AaronProgress.

---

## 4. Where we differ from period behavior — and why

### 4.1 Tile-vs-stretch threshold

**Period:** no threshold. Each segment is either:
- A fixed-rect stamp (rectList-named widget),
- A stretched 1-pixel-wide source (the K2 Speed Note's "fast stretch" pattern), or
- A tiled fill (when `cinf.tileSides = 1`).

**Aaron UI:** `TINY_STRETCH_THRESHOLD = 2` (px). Spans ≤ 2 use a 1-pixel-stretch source; spans > 2 use the full edge slice.

**Why we differ:** CSS `border-image` doesn't have a "stretch a 1-pixel slice infinitely" mode. The threshold is a workaround that produces the period-correct visual for spans ≤ 2 (because a 1-px slice stretched any width = uniform color bar) while preserving graphic content for wider spans.

**Truthfulness assessment:** **partially faithful.** The threshold approximation works for ~99% of segments across the corpus. The remaining 1% (very wide fill segments that the author intended to be 1-pixel-stretched) get slightly distorted instead of uniform. This is a CSS-tooling limitation, not a model limitation. Acceptable.

### 4.2 Button rendering

**Period:** standard Mac OS Appearance Manager + system CDEF draws buttons. Kaleidoscope themes only the surroundings via `SetUpControlBackground`.

**Aaron UI:** CSS-drawn beveled buttons palette-tinted with `--aaron-colr-*` custom properties from the scheme.

**Truthfulness assessment:** **partially faithful — flagged for revisit.** We're following the period architecture (button = system-drawn, scheme contributes palette only) but on the web there's no equivalent "system CDEF" — so our CSS bezels stand in for what Mac OS would have drawn. Visual fidelity depends on how period-correct those CSS bezels are.

> **Decision note (2026-05-19):** the team decided to keep buttons CSS-only for now, matching the period architecture decision. **This may not be the right long-term call.** Period users SAW themed-looking buttons (because the underlying Mac OS Appearance was itself themed by Kaleidoscope's surrounding chrome cues — pinstripes, accent colors, etc.); flat-looking CSS bezels in a heavily-themed page look out-of-place. Future option: extract a "synthetic button cicn" from the scheme's accent colors + frame pixels at theme load + render it as a 9-slice border on the button. Or: ship a few canonical button bitmaps that we tint per scheme. Track as a follow-up; revisit when the rest of the chrome stack stabilizes.

### 4.3 No `proxy icon`, no `windowshade widget` animations, no `zoom rect` flicker

**Period:** Kaleidoscope's WPrf prefs include `Use Spinning Zoom Rects` (animation between window positions) and `Number of steps` (animation frame count). Aaron UI ships none of this.

**Truthfulness assessment:** **partially faithful.** The structural DOM is right (data-state transitions exist). The visual transition animations are missing. Low priority.

### 4.4 No user-level vs. scheme-level preference distinction

**Period:** Kaleidoscope had its own WPrf/SPrf prefs (user-level) separately from each scheme's Colr (scheme-level). Aaron UI's Theme object conflates them (only scheme-level today).

**Truthfulness assessment:** **architectural gap** that doesn't affect any current functionality. Note in spec C §3 for future expansion if/when we add user prefs.

### 4.5 Color extraction not yet implemented

**Period:** dialog/alert/Finder cicns are sampled at cinf-anchored pixels to populate the OS's color tables for those elements.

**Aaron UI:** `extractColorsFromCicn()` helper exists (PR #149) but no consumer code calls it yet. `theme.palette` is populated by the meta.json sidecar instead of by cicn sampling.

**Truthfulness assessment:** **plumbing complete, consumers pending.** Spec B §4.16-§4.18 is the consumer-side spec; implementing it = wire `extractColorsFromCicn` into `loadTheme`'s palette construction.

---

## 5. Implementation map — where each piece lives

| Concept | File(s) |
|---|---|
| Resource fork parsing | `src/themes/loader/resource-fork.js` |
| cicn decoder | `src/themes/loader/decoders/cicn.js` |
| cinf decoder | `src/themes/loader/decoders/cinf.js` |
| wnd# decoder | `src/themes/loader/decoders/wnd.js` |
| ppat decoder | `src/themes/loader/decoders/ppat.js` |
| Theme schema (TS) | `src/themes/schema/types.ts` |
| Theme schema (parser/validator TS) | `src/themes/schema/parseTheme.ts` |
| Theme schema (validator JS, extractor mirror) | `src/themes/loader/validateTheme.js` |
| Manifest → theme.json | `src/themes/loader/buildThemeJson.js` |
| HTTP load + URL resolution | `src/themes/runtime/loadTheme.ts` |
| Resource fork → in-browser Theme | `src/themes/runtime/loadThemeFromRsrc.ts` |
| Theme registry (singleton state) | `src/themes/runtime/ThemeRegistry.ts` |
| Window composer (chrome) | `src/themes/runtime/composeKaleidoscopeChrome.ts` |
| Window dispatcher (state + Colr flags) | `src/themes/runtime/applyChromeFromTheme.ts` |
| Control infrastructure | `src/themes/runtime/applyControlChrome.ts` |
| Checkbox/radio cicn helper | `src/themes/runtime/attachThemeToCheckable.ts` |
| Disclosure cicn helper | `src/themes/runtime/attachThemeToDisclosure.ts` |
| Stretched-container helper (placard, header, progress) | `src/themes/runtime/attachThemeToStretched.ts` |
| Color extraction | `src/themes/runtime/extractColorsFromCicns.ts` |
| Conformance reporting | `src/themes/runtime/conformanceReport.ts` |
| Window manager | `src/window-manager/AaronWindow.ts` |
| Unified scanner | `src/scanAll.ts` |
| Per-family control classes | `src/controls/AaronButton.ts`, `AaronCheckable.ts`, `AaronField.ts`, `AaronDisclosure.ts`, `AaronPlacard.ts`, `AaronWindowHeader.ts`, `AaronProgress.ts` |
| Engine-baseline CSS | `src/controls/engineBaseline.ts` |

---

## 6. Methodology notes

This mapping was assembled from:

1. **K2 Scheme Reference** — the format authors' own docs (Arlo Rose + Greg Landweber's documentation bundled in `Kaleidoscope Goodies/`)
2. **Scheme Factory 1.0PR2** — the official editor's resource fork (STR# 128 region vocabulary + MENU 139 resize options + TMPL 129 cinf)
3. **Kaleidoscope 1.8.2 binary** — extracted from `~/Downloads/Kaleidoscope 1.8.2 Installer.app`; 504KB Control Panel + 12KB extension. Disassembled the 60KB 68k kDEF and parsed the 100KB PowerPC kDEF (PEF format) for symbol imports.
4. **Cross-corpus audit** — 7 schemes (1138, 1990, acid, big-blue, evolution, masswerk-7-le, masswerk-dark-ergobox2) confirm or refute claims empirically.

Disassembly artifacts are under `/tmp/aaron-disasm/` (not committed; reproducible from the installer).

---

## 7. References

- [`docs/aaron-ui-architecture-spec.md`](./aaron-ui-architecture-spec.md) — resource model + WDEF protocol
- [`docs/aaron-ui-html-skeleton-spec.md`](./aaron-ui-html-skeleton-spec.md) (spec A) — DOM contract
- [`docs/aaron-ui-raster-mapping-spec.md`](./aaron-ui-raster-mapping-spec.md) (spec B) — mapping rules + open questions
- [`docs/aaron-ui-composer-spec.md`](./aaron-ui-composer-spec.md) (spec C) — runtime architecture
- [`docs/tracking/kdef-disassembly-findings.md`](./tracking/kdef-disassembly-findings.md) — primary-source binary archaeology
- [`docs/tracking/kdef-disassembly.md`](./tracking/kdef-disassembly.md) — disassembly tracking ticket
- [`docs/kaleidoscope-asset-catalog.md`](./kaleidoscope-asset-catalog.md) — control-asset catalog with conformance levels
