# Kaleidoscope asset catalog — control vocabulary & coverage spec

**Purpose:** a normative catalog of the control assets present in a Kaleidoscope scheme, the slot vocabulary a renderer should expect, the naming-convention variations observed across real-world schemes, and the conformance levels by which an implementation can claim partial or full support.

**Audience:** *external* — anyone building a Kaleidoscope-compatible renderer (web, native, embedded) who needs to know what assets they will find, what they mean, and which subset constitutes a useful minimum implementation.

**Companion documents:**

- `tools/theme-loader/` (decoders) — the **input format**: the cicn/cinf/wnd#/ppat/Colr binary layout, decoded.
- [`docs/tracking/compositor-spec.md`](./tracking/compositor-spec.md) + [`docs/tracking/kdef231-recipe-walk.md`](./tracking/kdef231-recipe-walk.md) — **how the kDEF compositor draws** a scheme's chrome.
- `src/types.ts` — the theme.json schema the runtime consumes.

The decoders answer *"what bytes are in the file?"* This document answers *"what controls and states do those bytes represent across the corpus, and what should my implementation handle?"*

**Status:** 1.0 draft, derived from empirical audit of 7 schemes (1,277 cicns total) on 2026-05-18.

---

## 1. Why this catalog exists separately from the geometry spec

The geometry spec defines a `Theme` as a set of resources. It does not say *which controls a scheme will contain*, *what they will be named*, or *which subset an implementation must support to be useful*. Without this catalog, every implementer rediscovers the same things:

- "Does every scheme have a slider thumb? In four directions?"
- "Is `horizontal-scrollbar` always present, or is it sometimes `h-scroll-bar`? `horiztal-scrollbar` (typo)? `vertigo-scrollbar` (theme-specific name)?"
- "If I only implement chrome (no sliders, no checkboxes), can I call my project Kaleidoscope-compatible?"

A catalog + conformance levels makes those answerable.

---

## 2. Empirical corpus

Counts per scheme as of 2026-05-18:

| Scheme | cicns | ppats | Naming style |
|---|---:|---:|---|
| 1138 | 223 | 11 | descriptive |
| 1990 | 190 | 7 | descriptive |
| acid | 190 | 2 | descriptive |
| big-blue | 196 | 20 | descriptive |
| evolution | 190 | 4 | descriptive |
| mass:werk 7 Le | 119 | 6 | descriptive (canonical) |
| mass:werk Dark ErgoBox 2 | 159 | 25 | descriptive |
| **Total** | **1,277** | **75** | |

Across the corpus there are **499 unique cicn name stems** (after stripping the `cicn-nNNNN-` ID prefix and `.png` extension). This count overstates true semantic variety: many stems are spelling variants of the same slot (e.g., `horizontal-scrollbar`, `h-scroll-bar`, `horiztal-scrollbar`).

Reproducing the audit:

```bash
for t in themes/*/cicns/; do ls "$t"; done \
  | sed -E 's/cicn-n[0-9]+-//; s/\.png$//' \
  | sort -u | wc -l
```

---

## 3. The canonical control vocabulary

Every scheme audited contains some subset of these control families. A conforming renderer SHOULD map each scheme's cicns into this vocabulary regardless of the scheme's specific naming.

### 3.1 Window chrome (chrome family)

| Slot | Variants observed | Renderer role |
|---|---|---|
| `document-window` | active, inactive, collapsed-active, collapsed-inactive, pressed-widgets | Primary application window |
| `titled-utility-window` | active, inactive, collapsed-active, collapsed-inactive | Floating tool palette with title |
| `no-title-utility-window` | active, inactive, collapsed | Toolbox without titlebar |
| `side-floating-utility-window` | active, inactive, disabled | Side-attached palette |
| `dialog` | active, inactive | Modal alert dialog |
| `movable-dialog` | active, inactive | Movable modal |
| `alert` | active, inactive | System alert |
| `movable-alert` | active, inactive | Movable alert |
| `popup-window` | active, inactive, tab | Window with popup tab |
| `finder-header` | active, inactive | Finder-style list-view header |
| `grow-box` | active, inactive, pressed, various sizes per window type | Resize handle (sometimes per-window-type variants) |

This corresponds 1:1 to Kaleidoscope's `wnd#` window-type list. Aaron UI's renderer currently consumes 1 (document-window) of these 11.

### 3.2 Scrollbars (scroll family)

| Slot | Variants | Notes |
|---|---|---|
| `vertical-scrollbar` | active, inactive, pressed, empty, small × { same 4 } | "Empty" = nothing-to-scroll state |
| `horizontal-scrollbar` | active, inactive, pressed, empty, small × { same 4 } | |
| `scroll-thumb` | vertical/horizontal × active/pressed × normal/small | The draggable bead |
| `scroll-thumb-ghost` | vertical/horizontal × normal/small | Ghost-during-drag visual |
| `double-headed-scrollbar` | vertical/horizontal × normal/small + pressed/nothing-to-scroll variants | Both arrows on same end |
| `spin-arrows` | up/down, pressed/normal/inactive | NumberField stepper |
| `little-arrows` | up/down, pressed/normal/inactive | Compact stepper |

### 3.3 Sliders (slider family)

Sliders are the most state-rich control family. Each slider direction × tick-orientation × state gets its own cicn.

| Slot | Variants | Notes |
|---|---|---|
| `slider-track` | { up, down, left, right, non-directional } pointing × { vertical, horizontal } orientation × { active, inactive, pressed } | Track bitmap |
| `slider-thumbs` | { up, down, left, right, non-directional } × { vertical, horizontal } | Draggable handle |
| `slider-tick-mark` | { up, down, left, right } × { vertical, horizontal } × { active, inactive } | Individual tick |

The matrix is large (~40 cicns) but regular. A renderer with one direction can extend to all by table-lookup.

### 3.4 Form controls (control family)

| Slot | Variants | Notes |
|---|---|---|
| `checkbox` | empty, checked, mixed × active/inactive/pressed × normal/small/large size | Tri-state (mixed = indeterminate) |
| `radio-button` | off, on, mixed × active/inactive/pressed × normal/small/large | Tri-state |
| `push-button` | active, inactive, pressed (+ ring variants) | Primary button. The "ring" cicn is the default-button outer ring |
| `bevel-button` | off, on × active, inactive × normal/small/large | Toolbar-style button |
| `sbb-*` (small button bar) | selected, unselected × active, inactive × pressed | Segmented control |

### 3.5 Tabs (tab family)

| Slot | Variants | Notes |
|---|---|---|
| `lsf-front-tab` / `ssf-front-tab` | normal, disabled, pressed | Large standard form / small standard form, "front" = selected tab |
| `lsf-rear-tab` / `ssf-rear-tab` | normal, disabled, pressed | "Rear" = unselected tab |
| `lsf-tab-pane` / `ssf-tab-pane` | normal, disabled | The body the tabs attach to |
| `tabs-background` | active, inactive | Container fill |
| `tabs-large/small` | on/off × active/inactive + pressed | Alternative tab visual treatment |

`lsf` / `ssf` are large/small standard-form variants — classic Mac OS shipped two tab sizes.

### 3.6 Menus (menu family)

| Slot | Variants | Notes |
|---|---|---|
| `menubar-background` | normal | The strip across the top of the screen |
| `menubar-menubar-item` | normal | Individual menubar item cell |
| `selected-menubar-item` | normal | Highlighted menubar item |
| `pull-down-menu-background` | normal | The dropdown body |
| `solo-menu-background` | normal | Standalone (context) menu body |
| `selected-menu-item` | normal | Highlighted dropdown item |
| `menubar-menu-divider` | normal | Item separator line |
| `application-menu-grabber` | normal, pressed, inactive | Application-switcher grip (Mac OS 8/9) |

### 3.7 Popup menus (popup family)

| Slot | Variants | Notes |
|---|---|---|
| `pop-up-menu-button` | active, inactive | The button body |
| `popup-menu-text-section` | normal, pressed, inactive | Left side (label area) |
| `popup-menu-arrow-section` | normal, pressed, inactive | Right side (chevron area) |
| `popup-menu-arrow-only` | normal, pressed, inactive | Chevron-only variant |
| `pop-up-menu-arrow-glyph` | active, inactive, pressed × small/large | The chevron itself |

### 3.8 Progress indicators (progress family)

| Slot | Variants | Notes |
|---|---|---|
| `progress-bar-track` | active, inactive | The trough |
| `progress-bar-fill` (or `progress-bar`) | active, inactive | The filled portion |
| `progress-bar-frame` | active, inactive | Outline / bezel |
| `progress-indicator-frame` / `progress-indicator-track` | (paired) | Older naming for same concept |

Indeterminate (barber-pole) progress is typically a `ppat` (tileable pattern) plus the standard frame/track.

### 3.9 Disclosure (disclosure family)

| Slot | Variants | Notes |
|---|---|---|
| `disclosure-triangle` | down-pointing, right-pointing × normal, pressed, inactive | Tree expander |

(Some schemes also use `disclosure-triangle-closed/open` × `active/inactive` — semantically equivalent.)

### 3.10 Cursors & arrows (cursor family)

| Slot | Variants | Notes |
|---|---|---|
| `point-arrow` | normal, pressed, disabled × down/right/up/left | Cursor sprite |
| `arrow-only` | normal, pressed, disabled | Chevron-only button face |

### 3.11 Miscellaneous (misc family)

| Slot | Variants | Notes |
|---|---|---|
| `divider-line` | normal | Horizontal/vertical separators |
| `placard` | normal, inactive | Embossed label slab |
| `standard-file-document-icon` | normal | Generic document icon (used in Open/Save dialogs) |
| `sort-column-background` | normal | List-view sorted-column highlight |
| `list-*` (separator, sort-color, background) | various | Finder list-view chrome bits |

---

## 4. Naming convention variations

All schemes audited use **descriptive** naming (e.g., `horizontal-scrollbar-active`), but the convention is informal and not normative. Implementations MUST NOT rely on exact filename matches. Observed variations:

| Variation type | Example | Notes |
|---|---|---|
| Direction abbreviation | `h-scroll-bar` vs `horizontal-scrollbar` | Both refer to the same slot |
| Typos preserved verbatim | `horiztal-scrollbar`, `tringle` for triangle, `inacive-` | Period authoring tools didn't catch these; we must |
| Theme-specific renames | `vertigo-scrollbar` (theme "vertigo") | Theme branding leaks into asset name |
| State word ordering | `active-document-window` vs `document-window-active` | Both observed across corpus |
| Synonyms for state | `un-checked-check-box` vs `checkboxes-empty` vs `mixed-check-box` vs `checkboxes-mixed` | "Empty" and "un-checked" are synonyms |
| Numeric IDs only | `cicn-n10075` (no descriptive suffix) | Some schemes / some assets are unnamed |

### Recommended resolution strategy

A renderer SHOULD classify cicns by **two complementary signals**:

1. **Filename-pattern matching** (a fuzzy regex against a per-family vocabulary), used when names exist.
2. **Resource-ID range matching** (cicn-n10075..n10090 covers progress bar variants in any scheme that follows Kaleidoscope SDK ID ranges), used as a fallback or cross-check.

A renderer MUST NOT fail when a cicn doesn't classify — surface the asset as "unclassified" rather than silently dropping it. The diagnostics page in this project does exactly this and the unclassified list is itself a data point for catalog evolution.

---

## 5. Conformance levels

To allow honest partial implementations, this catalog defines four conformance levels. A renderer claiming a level MUST support every feature in that level and every lower level. An implementation MAY support features from higher levels without claiming the level.

### Level 1 — Window chrome only

Renders chrome for the **document-window** type (active + inactive states) using cicn + cinf + wnd# data. May omit all other window types and all in-window controls.

This is roughly the minimum that produces a visually-themed window. Aaron UI is currently at this level.

**Required:** `chrome.document-window` slot, 9-slice or 3-slice composition per cinf classifier, ppat overlay if cinf references one.

### Level 2 — Full window-type chrome

Renders chrome for **every window type** the scheme defines in its `wnd#` resource (dialog, alert, movable-dialog, utility-window, side-floating-utility-window, popup-window, etc.).

**Required:** Level 1 + every `chrome.*` slot listed in §3.1, including collapsed and per-window-type grow-box variants where present.

### Level 3 — Standard controls

Adds rendering of the **scroll**, **slider**, **control**, **disclosure**, and **progress** families (§3.2, §3.3, §3.4, §3.8, §3.9).

This brings parity with what a typical classic-Mac application would visibly use.

**Required:** Level 2 + classify and render scrollbars, sliders, checkbox/radio/push/bevel/sbb buttons, disclosure triangles, progress bars.

### Level 4 — Full HIG

Adds **menu** (§3.6), **popup** (§3.7), **cursor** (§3.10), and **misc** (§3.11) families. Renderer covers essentially everything a scheme ships.

**Required:** Level 3 + menubar + popup menus + cursor sprites + placards / dividers / file icons.

### Reporting conformance

Implementations SHOULD ship a conformance report listing, per scheme:

- Total cicns extracted
- Cicns classified into a known slot
- Cicns the renderer actually consumes at runtime
- Unclassified residue (the gap that motivates catalog updates)

Aaron UI's diagnostics page (`demo/diagnostics.html`) implements this as a "Coverage" section per scheme. Other renderers are encouraged to do the same.

---

## 6. Implications for Aaron UI's roadmap

This audit revealed that current utilization is roughly **3–5% of available assets** (4 of 120–220 cicns per scheme). The remaining 95% are extracted, classified into families by the diagnostics catalog, and waiting for renderer wiring.

Concrete consequences:

- **Phase 3 (controls)** has a confirmed data source for every planned widget. The geometry spec was already complete; the asset catalog confirms the assets *physically exist* in every scheme audited, with regular naming.
- **Level 2 chrome (other window types)** is a near-term win — the cicns are present and the composition algorithm is identical to document-window. Mostly a registry-mapping change in the renderer.
- **A conformance test suite** becomes possible: load each scheme, classify, render, compare against curated reference jpgs. The diagnostics page already does the first two steps.
- **New-scheme authoring** can target this catalog as its specification — a tool generating a Kaleidoscope-compatible scheme knows exactly which assets to produce for each conformance level.

---

## 7. Open questions

- **Direction abbreviations & typos**: should we normalize at extraction time (rename files), at classification time (regex), or never (preserve authorial choice)? Currently we preserve; classification regex absorbs the variance.
- **Resource-ID ranges**: are the Kaleidoscope SDK's published ID ranges stable across all schemes? An audit of the numeric prefixes across all 7 schemes would confirm/deny and let us add ID-based classification as a fallback signal.
- **Theme-specific assets**: schemes occasionally include cicns with no slot in this vocabulary (custom decoration, easter eggs). The spec should classify these as `theme-specific` rather than `unclassified` — they're authorial intent, not catalog gaps.
- **ppats coverage**: this document focuses on cicns. The 75 ppats across the corpus deserve their own short catalog section — they're mostly textures (titlebar pinstripe, scrollbar stipple, indeterminate progress) but the slot mapping isn't documented anywhere yet.

---

## 8. Versioning & change control

This catalog is versioned with the geometry spec. Breaking changes to slot names or conformance level definitions require a major version bump. Additions (new slots, new families) are minor.

Per-scheme audits SHOULD be regenerated whenever a new scheme is added to `themes/` or the extractor's naming logic changes.

To regenerate the §2 counts table:

```bash
for t in themes/*/; do
  slug=$(basename "$t")
  cicns=$(ls "$t"cicns/ 2>/dev/null | wc -l | tr -d ' ')
  ppats=$(ls "$t"ppats/ 2>/dev/null | wc -l | tr -d ' ')
  printf "| %s | %d | %d |\n" "$slug" "$cicns" "$ppats"
done
```
