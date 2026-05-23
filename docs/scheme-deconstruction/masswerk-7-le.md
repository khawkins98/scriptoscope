# Scheme deconstruction — mass:werk 7 Le

**First Kaleidoscope scheme deconstructed for Aaron UI.** A worked example of how a scheme's resources map to a runtime-ready theme bundle. For the format, see the decoders under `tools/theme-loader/`; for how the chrome is drawn, [`docs/tracking/compositor-spec.md`](../tracking/compositor-spec.md) + [`docs/tracking/kdef231-recipe-walk.md`](../tracking/kdef231-recipe-walk.md).

---

## Provenance

| Field | Value |
|---|---|
| Scheme name | `mass:werk 7 Le` |
| Version | 1.1 (final, 2001-01-13) |
| Author | Norbert Landsteiner — `info@masswerk.at` — <https://www.masswerk.at> |
| Original `vers` resource | "1.1 by mass:werk (based on 'System 7' by Gregory D. Landweber and Arlo Rose)" |
| Source URL | <https://www.masswerk.at/schemes.php> (file: `schemes/masswerk7le.sit`) |
| Date acquired | 2026-05-16 |
| Working copy | `.scratch/schemes/masswerk-7-le/` (gitignored — not in repo) |
| Stated visual goal (per readme) | *"combine the looks an feels of Apple's System 7 and Mac OS 8/9"* — a light System 7 / Platinum hybrid |

### License (quoted from `ReadMe-masswerk7Le`, verbatim)

> This scheme is freeware and you can distribute as long as with this readme file.
>
> 2001/01/13  Norbert Landsteiner

This is an unambiguous freeware-with-attribution license. Redistribution is explicitly permitted; the readme must accompany. For Aaron UI's purposes — **re-authoring** the visual design in CSS/SVG primitives, not republishing the original bitmaps — this clears both research and shipping. Provenance must be preserved in any derived Aaron UI theme bundle.

The scheme is itself derivative of "System 7" by **Gregory D. Landweber and Arlo Rose** — the authors of Kaleidoscope itself. That gives this scheme unusually deep community lineage.

---

## Resource fork at a glance

- **Total resources:** 271
- **Distinct types:** 19
- **Resource fork size:** 119,772 bytes (data fork is empty — classic Mac scheme file)
- **Extracted with:** `DeRez "masswerk 7 Le" > scheme.r`

### Type counts

| Type | Count | What it is | Aaron UI relevance |
|---|---:|---|---|
| `cicn` | 119 | Color icon (1-bit mask + 8-bit color, named) | **High** — every chrome glyph and state |
| `cinf` | 47 | Kaleidoscope custom — interaction metadata for cicns | **High** — hit-test rects, behavior hints |
| `ics8` | 29 | Small (16×16) 8-bit file/folder icons | Low — file icons aren't in Aaron UI's scope |
| `ics#` | 29 | Small (16×16) 1-bit icon + mask | Low — same |
| `ICN#` | 7 | Large (32×32) 1-bit icon + mask | Low — same |
| `icl8` | 7 | Large (32×32) 8-bit icon | Low — same |
| `wnd#` | 6 | Kaleidoscope window definition | **High** — window-type catalog |
| `ppat` | 6 | Pixel pattern (tileable) | **High** — pinstripe, progress fill |
| `icns` | 5 | Modern icon family (Mac OS 8.5+) | Low — Kaleidoscope UI only |
| `TMPL` | 3 | ResEdit template (defines layout of `Colr` / `cinf` / `wnd#`) | None — ResEdit-only |
| `vers` | 2 | Version info | Medium — informs our `theme.json` metadata |
| `PICT` | 2 | Full bitmap picture | Medium — splash / logo |
| `dctb` | 2 | Dialog color table | Low — superseded by CSS custom props |
| `clut` | 2 | Color lookup table (Active Header / Inactive Header) | **High** — titlebar palette |
| `STR#` | 1 | String list (Control Panel info) | Low — Kaleidoscope-only |
| `DLOG` | 1 | Dialog template | None — Kaleidoscope-only |
| `DITL` | 1 | Dialog item list | None — Kaleidoscope-only |
| `Colr` | 1 | Color picker color | Low |
| `actb` | 1 | Alert color table | Low |

---

## The semantic vocabulary (load-bearing finding)

**The single most valuable output of this deconstruction is the named-resource catalog.** Kaleidoscope scheme authors gave each `cicn` a semantic name (e.g., "Pressed Vertical Scrollbar", "Inactive Grow Box", "Collapsed Active Document Window"). This is an *authoritative period vocabulary* for Mac OS-era window chrome elements and their state space — exactly what Aaron UI's CSS custom property catalog needs to mirror.

The vocabulary groups cleanly:

### Window controls (per state)

- **Document Window** — Active, Inactive, Collapsed Active, Collapsed Inactive
- **Grow Box** — Active, Inactive (plus separate Movable Modal variants)
- **Widget Down States** — generic press indicator
- **Window types** (`wnd#` definitions): Document Window, Movable Modal Dialog, Modal Dialog, Alert, Movable Alert, Collapsed Document Window

### Scrollbars (per axis × state)

Per axis (horizontal, vertical), four states each:
- Empty, Normal, Pressed, Disabled

Plus thumb states:
- Vertical Thumb, Horizontal Thumb (+ Pressed variants)
- Vertical Thumb Ghost, Horizontal Thumb Ghost (drag preview)

### Checkboxes / radios

Combinatorial state matrix: **3 sizes × 2 selections × 3 enabled states = 18 cicns**.

- Sizes: Small, Normal, Large
- Selection: Off, On
- State: Normal, Pressed, Disabled

Example: `cicn -10162 "Normal On Pressed"` = medium-sized, selected, currently pressed.

This is a real combinatorial truth our format must support — and it'd be easy to overlook without seeing it spelled out.

### Popup menus

Decomposed into 3 sections × 4 states each:
- Sections: Text Section, Arrow Section, Arrow Only (no text)
- States: Normal, Pressed, Inactive (+ "Inactive" for the dimmed disabled case)

Plus three sizes of standalone arrows: Small, Large, Standard.

### Sliders

Track × thumb × tick mark variants:
- **Tracks**: Down Pointing / Right Pointing / Non-Directional Horizontal / Non-Directional Vertical, each in Normal / Pressed / Inactive
- **Thumbs**: Down Pointing, Right Pointing, Non-Directional Horizontal, Non-Directional Vertical
- **Tick marks**: Horizontal, Vertical, plus Inactive variants

### Menus

- Menu Bar, Menu Item, Selected Menu Bar Item, Pull Down Menu Background, Selected Menu Item, Divider Line, Standalone Menu Background, Application Menu Grabber (Normal / Pressed / Inactive)

### Tabs

Two sets, prefixed `SSF` (Small System Font?) and `LSF` (Large System Font?):
- Front Tab, Rear Tab, Pressed Rear Tab, Disabled Front/Rear Tab
- Plus Tab Pane (Active / Inactive) for LSF

### Disclosure triangles

- Right Pointing, Down Pointing, each in Normal / Pressed / Inactive

### Progress bars

Decomposed into three layers, each with Active / Inactive:
- Progress Bar Track, Progress Bar (fill), Progress Bar Frame

Plus indeterminate-progress `ppat` (animated barber pole).

### Dialog windows

- Active Dialog, Inactive Dialog, Active Alert, Inactive Alert, Active Movable Alert, Inactive Movable Alert, Active Movable Modal, Inactive Movable Modal (8 variants)

---

## What this tells us about Aaron UI's theme bundle format

Mapping each Kaleidoscope resource category to its web-native equivalent:

| Kaleidoscope concept | Aaron UI equivalent | Notes |
|---|---|---|
| `cicn` per state (chrome glyph) | One SVG per state, OR a sprite per element, OR a CSS render | The trade-off is: bitmaps reproduce period themes literally; CSS/SVG re-implementations reflow at any resolution. For Aaron UI's modern-web target, **SVG per state is the default**, with theme bundles free to ship raster fallbacks. |
| `cinf` (hit-test + interaction metadata) | JSON manifest in `theme.json` per element | Kaleidoscope baked behavior into the bundle; we keep behavior in Aaron UI's WM core and let themes describe only *where* (rectangles, anchor points) it applies. |
| `ppat` (tileable pixel pattern) | `repeating-linear-gradient` for the simple patterns; SVG pattern for complex; `--aaron-*-bg` custom prop for theming | The active/inactive titlebar pinstripe goes here. |
| `wnd#` (window definition) | Per-window-type CSS class + Aaron UI window-type enum | Document Window / Modal Dialog / Alert / Movable Alert / Collapsed — Aaron UI Phase 5 (Dialogs & sheets) maps almost 1:1 to this list. |
| `clut` "Active Header" / "Inactive Header" | CSS custom property set per state | Confirms our active/inactive split needs *paired* color palettes, not just an opacity tweak. |
| `STR#` / `DLOG` / `DITL` / `TMPL` | Not carried | Classic Mac Toolbox concepts that don't map to the web. |
| File icons (`ics#` / `ics8` / `ICN#` / `icl8` / `icns`) | Not carried | Aaron UI is a window/chrome theme engine, not a file-icon set. |
| Sounds (`snd ` would live here) | **Not present in this scheme** | Even though Kaleidoscope supported sound resources, this scheme ships none. The PRD's "sounds in the bundle" aspiration goes beyond what most Kaleidoscope schemes shipped — that's an Aaron UI design choice. |
| Desktop background | **Not present in this scheme** | Same — not carried in `.ksc`. Apple's Appearance Manager `.afm` themes did ship desktop pictures; Kaleidoscope didn't. Aaron UI's bundle format follows the Appearance Manager here, not Kaleidoscope. |

---

## Surprises and observations

1. **The semantic vocabulary is the headline finding.** Aaron UI's `--aaron-*` custom property catalog can be drafted directly from this list — "Active Document Window," "Pressed Vertical Scrollbar," "Inactive Grow Box" — period-authentic names with no naming work required.

2. **Active/Inactive is everywhere.** Nearly every chrome element has explicit Active and Inactive variants — not done via opacity, but as distinct artwork with distinct palettes (`clut -14335` "Inactive Header" and `clut -14336` "Active Header" are separate palettes). The PRD's `data-state="inactive"` pattern (already used in `demo/platinum-static.html`) is correct; the *implementation* should swap palettes, not just dim.

3. **Pressed is a first-class state, not a hover.** Mac OS 8 chrome had three interaction states: Normal, Pressed, Disabled. There's no "hover" — that's a post-OS X concept. Aaron UI's default Platinum theme should honor this; period themes don't get hover effects. Optional hover indications can be a Phase 6 polish add, themed off by default.

4. **`cinf` is Kaleidoscope's secret sauce.** It's the bridge between bitmap (`cicn`) and behavior — describing hit-test rectangles, anchor points, and tiling rules inside the icon. The Appearance Manager handled this differently (more conventions-based, less per-asset metadata). Aaron UI's format can split the difference: simple chrome elements get conventions; complex multi-region elements (popup buttons, sliders) get a JSON descriptor. This is the "extension point" the spike-doc anticipated finding.

5. **Combinatorial explosion in state space.** Radios alone are 18 assets (3 × 2 × 3). Across the full chrome set, a faithful theme bundle is *hundreds* of declared visual states. Aaron UI's format needs to handle missing-state fallbacks (e.g., "if no Disabled variant is provided, derive from Normal via desaturation"), because asking theme authors to provide all 271 will kill adoption.

6. **No fonts in this scheme.** Schemes didn't carry fonts; the OS provided Charcoal/Chicago. Aaron UI themes *should* be able to carry fonts (Hi-Tech, e.g., used a Tahoma-style face that we'd need to bundle as a webfont), but optional, not required.

7. **The scheme is `cicn`-heavy and `ppat`-light** (119 vs. 6). The Mac OS 8 chrome aesthetic is overwhelmingly per-state bitmap, not pattern fill. That's the *opposite* of how the web defaults — CSS prefers gradients and computed rendering. Aaron UI's default Platinum theme already uses gradients (in `demo/platinum-static.html`) because that's cheap on the web; faithful Kaleidoscope-derived themes will lean more on per-state SVGs.

8. **Window types are only six.** The full Mac OS dialog vocabulary is just: Document Window, Modal Dialog, Movable Modal Dialog, Alert, Movable Alert, Collapsed Document Window. That's manageable — Aaron UI Phase 5 (Dialogs & sheets) ships when all six render correctly.

---

## What this scheme does *not* tell us

- **The actual visual rendering.** This pass extracted format and vocabulary. To see what the icons actually look like, we'd need to decode each `cicn` (a 16×16 pixel block with palette + mask + custom format) — out of scope for the spike. Period screenshots are the visual reference; this scheme contributes structural knowledge.
- **How the Appearance Manager differs in resource layout.** That requires a separate study against Apple's published Appearance Manager docs. The takeaway from this scheme is that the *semantic vocabulary* generalizes; the *resource encoding* is Kaleidoscope-specific and Aaron UI's format will resemble neither verbatim.
- **Animation.** No animation resources at all — Mac OS 8 chrome was static. Aaron UI's optional zoom-to-icon and windowshade roll-up animations (PRD Phase 6) are *additions*, not period-faithful.

---

## Next steps (informed by this deconstruction)

1. **Draft `docs/THEME-FORMAT-REFERENCE.md` v0** using the resource categories above as the spine.
2. **Adopt the semantic vocabulary directly** in Aaron UI's CSS custom property catalog. The chrome-element names from `cicn` titles become the public theming API names.
3. **Pick a Tier 2 deconstruction target** — a stylistically distant Kaleidoscope scheme — to test that our format generalizes. Apple Gray (Akamai Design, Internet Archive PD Mark 1.0) is the next candidate.
4. **Defer per-asset bitmap analysis** until Phase 4 is actively designing the loader; we can do that work on demand against specific schemes when their look is wanted.
