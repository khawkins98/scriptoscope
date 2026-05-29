# Scheme Factory vocabulary — the canonical authoring spec

> Extracted from **Scheme Factory 1.0pr2** (`kaleidoscope.net`, the OFFICIAL
> Kaleidoscope scheme editor) recovered from the Wayback Machine:
> `https://web.archive.org/web/20020312171604/http://kaleidoscope.net/schemefactory/SchemeFactoryPR2.sea.hqx`.
> The `.sea.hqx` decodes via `unar`; the application's resource fork
> (`com.apple.ResourceFork` xattr on the extracted `Scheme Factory 1.0pr2`
> binary, 361 643 bytes) parses via `tools/theme-loader/resource-fork.js`.
>
> **Why this matters** — Scheme Factory is the tool every corpus author used to
> author their scheme. Its UI labels are the canonical names for every
> chromeElement slot, every wnd# part code, and every window/widget type.
> Where `corpus-corroborated-ids.md` shows what authors *typed* into NAMED
> resources (the labels they invented when they overrode the defaults),
> Scheme Factory's strings are the **source authors derived from** — the
> defaults the corpus paraphrases.
>
> Re-extract:
> ```sh
> curl -L https://web.archive.org/web/20020312171604/http://kaleidoscope.net/schemefactory/SchemeFactoryPR2.sea.hqx -o sf.sea.hqx
> unar -o /tmp/scheme-factory sf.sea.hqx
> xattr -px com.apple.ResourceFork '/tmp/scheme-factory/Scheme Factory 1.0pr2/Scheme Factory 1.0pr2' | xxd -r -p > /tmp/sf-rsrc.bin
> node /tmp/probe-sf.mjs  # the probe script
> ```

---

## 1 · The 127 chromeElement role names — `STR# 128`

The editor's master role catalogue. Each string is a slot the author can
assign a cicn / ppat / Colr to. The catalogue is grouped into seven editorial
sections (the bold rows below — those are *headings*, not slots).

**Source:** `STR# 128` in Scheme Factory 1.0pr2 (127 entries).

| # | Role name |
|---|---|
| **1** | **Windows** *(section header)* |
| 2 | Document Window |
| 3 | Collapsed Document Window |
| 4 | Modal Dialog |
| 5 | Modal Alert |
| 6 | Movable Dialog |
| 7 | Movable Alert |
| 8 | Utility Window |
| 9 | Collapsed Utility Window |
| 10 | Untitled Utility Window |
| 11 | Collapsed Untitled Utility Window |
| 12 | Side Floating Utility Window |
| 13 | Collapsed Side Floating Utility Window |
| 14 | Popup Window |
| **15** | **Menus** *(section header)* |
| 16 | Menu Bar Background |
| 17 | Menu Bar Item |
| 18 | Selected Menu Bar Item |
| 19 | Pull Down Menu Background |
| 20 | Pull Down Selected Menu Item |
| 21 | Pull Down Menu Divider Line |
| 22 | Pull Down Menu Border |
| 23 | Pull Down Menu Border's Alpha Mask |
| 24 | Free Menu Background |
| 25 | Free Selected Menu Item |
| 26 | Free Menu Divider Line |
| 27 | Free Menu Border |
| 28 | Free Menu Border's Alpha Mask |
| 29 | Disabled Popup Menu Text Section |
| 30 | Enabled Popup Menu Text Section |
| 31 | Pressed Popup Menu Text Section |
| 32 | Disabled Popup Menu Arrow Section |
| 33 | Enabled Popup Menu Arrow Section |
| 34 | Pressed Popup Menu Arrow Section |
| 35 | Disabled Popup Menu Without Text |
| 36 | Enabled Popup Menu Without Text |
| 37 | Pressed Popup Menu Without Text |
| **38** | **Buttons** *(section header)* |
| 39 | Disabled Push Button |
| 40 | Enabled Push Button |
| 41 | Pressed Push Button |
| 42 | Disabled Default Push Button Ring |
| 43 | Enabled Default Push Button Ring |
| 44 | Pressed Default Push Button Ring |
| 45 | Small Disabled Bevel Button Off |
| 46 | Small Enabled Bevel Button Off |
| 47 | Small Pressed Bevel Button Off |
| 48 | Small Disabled Bevel Button On |
| 49 | Small Enabled Bevel Button On |
| 50 | Small Pressed Bevel Button On |
| 51 | Small Disabled Bevel Button Mixed |
| 52 | Small Enabled Bevel Button Mixed |
| 53 | Small Pressed Bevel Button Mixed |
| 54 | Normal Disabled Bevel Button Off |
| 55 | Normal Enabled Bevel Button Off |
| 56 | Normal Pressed Bevel Button Off |
| 57 | Normal Disabled Bevel Button On |
| 58 | Normal Enabled Bevel Button On |
| 59 | Normal Pressed Bevel Button On |
| 60 | Normal Disabled Bevel Button Mixed |
| 61 | Normal Enabled Bevel Button Mixed |
| 62 | Normal Pressed Bevel Button Mixed |
| 63 | Large Disabled Bevel Button Off |
| 64 | Large Enabled Bevel Button Off |
| 65 | Large Pressed Bevel Button Off |
| 66 | Large Disabled Bevel Button On |
| 67 | Large Enabled Bevel Button On |
| 68 | Large Pressed Bevel Button On |
| 69 | Large Disabled Bevel Button Mixed |
| 70 | Large Enabled Bevel Button Mixed |
| 71 | Large Pressed Bevel Button Mixed |
| **72** | **Tabs, Headers & Placards** *(section header)* |
| 73 | Large Disabled Rear Tab |
| 74 | Large Enabled Rear Tab |
| 75 | Large Pressed Rear Tab |
| 76 | Large Disabled Front Tab |
| 77 | Large Enabled Front Tab |
| 78 | Large Disabled Tab Pane |
| 79 | Large Enabled Tab Pane |
| 80 | Small Disabled Rear Tab |
| 81 | Small Enabled Rear Tab |
| 82 | Small Pressed Rear Tab |
| 83 | Small Disabled Front Tab |
| 84 | Small Enabled Front Tab |
| 85 | Small Disabled Tab Pane |
| 86 | Small Enabled Tab Pane |
| 87 | Disabled Finder Header |
| 88 | Enabled Finder Header |
| 89 | Disabled Placard |
| 90 | Enabled Placard |
| 91 | Pressed Placard |
| **92** | **Slider Tracks & Progress Bars** *(section header)* |
| 93 | Disabled Down Pointing Slider Track |
| 94 | Enabled Down Pointing Slider Track |
| 95 | Pressed Down Pointing Slider Track |
| 96 | Disabled Up Pointing Slider Track |
| 97 | Enabled Up Pointing Slider Track |
| 98 | Pressed Up Pointing Slider Track |
| 99 | Disabled Horizontal Non-Directional Slider Track |
| 100 | Enabled Horizontal Non-Directional Slider Track |
| 101 | Pressed Horizontal Non-Directional Slider Track |
| 102 | Disabled Right Pointing Slider Track |
| 103 | Enabled Right Pointing Slider Track |
| 104 | Pressed Right Pointing Slider Track |
| 105 | Disabled Left Pointing Slider Track |
| 106 | Enabled Left Pointing Slider Track |
| 107 | Pressed Left Pointing Slider Track |
| 108 | Disabled Vertical Non-Directional Slider Track |
| 109 | Enabled Vertical Non-Directional Slider Track |
| 110 | Pressed Vertical Non-Directional Slider Track |
| 111 | Enabled Progress Bar Frame |
| 112 | Enabled Progress Bar Fill |
| 113 | Enabled Progress Bar Track |
| 114 | Disabled Progress Bar Frame |
| 115 | Disabled Progress Bar Fill |
| 116 | Disabled Progress Bar Track |
| **117** | **Colors & Patterns** *(section header)* |
| 118 | Enabled Dialog Background |
| 119 | Disabled Dialog Background |
| 120 | Enabled Alert Background |
| 121 | Disabled Alert Background |
| 122 | Desktop Text Color & Background |
| 123 | Icon View Background Color |
| 124 | Non-Sorted List View Color |
| 125 | Sorted List View Color |
| 126 | List View Divider Line Color |
| 127 | Mac OS 9 Notification Window Background |

### Cross-correlation with `corpus-corroborated-ids.md`

The corpus authors typed paraphrases of these strings into NAMED resources.
Note the editorial **terminology shift**: Scheme Factory's labels say
"Enabled/Disabled/Pressed"; corpus authors usually wrote "Active/Inactive/Pressed"
(matching the Appearance Manager API's vocabulary) — but they map 1:1:

| Scheme Factory term | Corpus paraphrase | Sample cicn id |
|---|---|---|
| "Enabled Push Button"    | "Push Button Active¥"        | `-10239` |
| "Disabled Push Button"   | "Push Button Inactive¥"      | `-10240` |
| "Pressed Push Button"    | "Push Button Pressed¥"       | `-10238` |
| "Enabled Default Push Button Ring" | "Push Button Ring Active¥"   | `-10231` |
| "Disabled Default Push Button Ring"| "Push Button Ring Inactive¥" | `-10232` |
| "Pressed Down Pointing Slider Track" | (absent in corpus — not authored) | `-10142` (cinf only) |
| "Enabled Down Pointing Slider Track" | "Down Pointing Slider Track" | `-10143` |
| "Disabled Down Pointing Slider Track" | "Inactive Down Pointing Slider Track" | `-10144` |
| "Enabled Progress Bar Frame" | (`cinf` -10080 "Progress Indicator Frame") | `-10080` |
| "Enabled Progress Bar Fill" | "Progress Bar: Lavender " (or similar hue) | `-10223` |
| "Enabled Progress Bar Track" | "Progress Bar Track" | `-10224` |
| "Document Window" *(wnd#)* | "Document Window" | wnd# `-14336` |
| "Modal Alert" *(wnd#)*    | "Alert"                      | wnd# `-14326` |
| "Side Floating Utility Window" *(wnd#)* | "Side Floating Utility Window" | wnd# `-14296` |
| "Popup Window" *(wnd#)*   | "Popup Window"               | wnd# `-12320` |

The pattern: **the corpus author labels are paraphrases of the Scheme Factory
defaults**, occasionally trimmed (no "Disabled/Enabled" qualifier when the
state is obvious from id) and re-cast to Appearance Manager vocabulary
("Active/Inactive" instead of "Enabled/Disabled"). Where corpus labels disagree
on a paraphrase, Scheme Factory's string is the canonical disambiguator.

---

## 2 · wnd# part codes — `STR# 130` (the structure-element vocabulary)

This is the answer to "what does each part code in a wnd# recipe MEAN?" — the
Scheme Factory side-editor's part picker. The compositor uses these codes per
side; see `docs/spec/compositor-spec.md` for our classification.

**Source:** `STR# 130` in Scheme Factory 1.0pr2 (24 strings).

| Idx | Part-code name | Compositor classification |
|---|---|---|
| 1 | Ignored | (filler, never drawn) |
| 2 | Static Element | FIXED (drawn once, no scaling) |
| 3 | Close Box Area | FIXED + FLAG-GATED on `hasCloseBox` |
| 4 | Zoom Box Area | FIXED + FLAG-GATED on `hasZoomBox` |
| 5 | Collapse Box Area | FIXED + FLAG-GATED on `hasCollapseBox` |
| 6 | Title Repeating Area | STRETCH/TILE (the title bar fill) |
| 7 | Title End Cap | FIXED (the right edge of the title bar) |
| 8 | Stretch Left End Cap (not used) | (deprecated — never emitted) |
| 9 | Repeat From Left | TILE from the left edge inward |
| 10 | Stretch Right End Cap (not used) | (deprecated — never emitted) |
| 11 | Disappears in Low Space | FIXED, hidden when window is too narrow |
| 12 | Repeat From Right | TILE from the right edge inward |
| 13 | Repeat Using Exact Length | TILE constrained to an exact pixel run |
| 14 | Exact Length Slack Fill From Left | TILE/SCALE that pads from the left |
| 15 | Exact Length Slack Fill From Right | TILE/SCALE that pads from the right |
| 16 | No Close Box Area | FLAG-GATED *inverse* of close box |
| 17 | No Zoom Box Area | FLAG-GATED *inverse* of zoom box |
| 18 | No Collapse Box Area | FLAG-GATED *inverse* of collapse box |
| 19 | Stretching Area | SCALE (the cell stretches to fit) |
| 20 | (separator) | — |
| 21 | Repeat From Top | TILE from the top edge downward (vertical sides) |
| 22 | Repeat From Bottom | TILE from the bottom edge upward (vertical sides) |
| 23 | Exact Length Slack Fill From Top | vertical equivalent of #14 |
| 24 | Exact Length Slack Fill From Bottom | vertical equivalent of #15 |

### Cross-reference with `kdef-recipe-walk.md` and `compositor-spec.md`

The "(not used)" notation on entries 8 and 10 is straight from Scheme
Factory's own UI — confirms our compositor-spec's observation that the kDEF
*could* emit two end-cap codes per side but the official editor only authored
one (the **right** end cap for horizontal sides). Schemes in our corpus that
appear to use both end caps are reading the SAME code as either start or end
based on cell position, not on the part-code value.

Entries 21–24 are the vertical-side analogues — the same part code drawn in
either horizontal or vertical context. The kDEF decompile uses a single jump
table that switches direction based on which side of the window the cell
belongs to (see `docs/spec/kdef231-recipe-walk.md`).

---

## 3 · Per-window widget slots — `STR# 129` (the master widget list)

The widgets a wnd# can have. Used by Scheme Factory's window-type editor to
let the author assign each cicn to one of these slot kinds.

**Source:** `STR# 129` in Scheme Factory 1.0pr2 (7 strings).

| # | Widget slot |
|---|---|
| 1 | Content |
| 2 | Close Box |
| 3 | Zoom Box |
| 4 | Collapse Box |
| 5 | Title Text |
| 6 | Left Grow Box |
| 7 | Right Grow Box |

### Implications for the widget-presence flag field

Our `docs/spec/kdef231-reference.md` §7.6 calls out the
`a4@(0x1f0/0x1f4/0x1f5/0x1f9/0x1fc)` mystery — a 16-bit-ish field per
window-type whose bits gate the close/zoom/collapse/grow widgets. Scheme
Factory's list (#2 Close Box, #3 Zoom Box, #4 Collapse Box, #6 Left Grow Box,
#7 Right Grow Box) confirms the **set of bits the field encodes** is exactly
five: close, zoom, collapse, left-grow, right-grow. (#1 Content and #5 Title
Text are always present — they're not gated by a presence flag.)

`STR# 130`'s entries 16/17/18 ("No Close Box Area", "No Zoom Box Area",
"No Collapse Box Area") are the *inverse* gates — they're cell-level part codes
the recipe emits to claim *static* pixels in the title bar when the
corresponding widget is absent. That fully validates the FLAG-GATED part-code
class we already classified in `compositor-spec.md`. **The bit-field is per
window-type, not per recipe-cell** — the recipe asks "is this widget on?"
once, and emits either the widget cell (entries 3/4/5) or the no-widget cell
(entries 16/17/18) accordingly.

What we still don't have from Scheme Factory: the **exact bit layout** (which
bit position is close vs zoom vs collapse vs left-grow vs right-grow). The
binary's WDEF/CODE resources need to be disassembled against the wnd#
serialiser. Best next move: parse a known-good wnd# from a corpus scheme
(e.g. `1138`'s wnd# `-14336` Document Window which has all five widgets) and
compare its `0x1f0`-region bytes against `1984`'s `-14288` "No Title Utility
Window" (which has zero widgets).

---

## 4 · The window-type catalogue — STR# 128 entries 2–14 cross-referenced

| Scheme Factory string (STR# 128) | wnd# id (corpus) | Note |
|---|---|---|
| 2 — Document Window                       | -14336 | (n=11 — every classic-recipe scheme) |
| 3 — Collapsed Document Window             | -14332 | (n=4 — only schemes that author the shaded variant) |
| 4 — Modal Dialog                          | -14328 | corpus paraphrase: "Dialog" |
| 5 — Modal Alert                           | -14326 | corpus paraphrase: "Alert" |
| 6 — Movable Dialog                        | -14324 | corpus paraphrase: "Movable Modal Dialog" |
| 7 — Movable Alert                         | -14322 | corpus paraphrase: "Movable Alert" |
| 8 — Utility Window                        | -14304 | corpus paraphrase: "Titled Utility Window" |
| 9 — Collapsed Utility Window              | -14300 | (n=1, 1138 only — confirms the slug) |
| 10 — Untitled Utility Window              | -14288 | corpus paraphrase: "No Title Utility Window" |
| 11 — Collapsed Untitled Utility Window    | -14284 | (n=1, 1138 only) |
| 12 — Side Floating Utility Window         | -14296 | (n=5) |
| 13 — Collapsed Side Floating Utility Window | -14292 | (n=2) |
| 14 — Popup Window                         | -12320 | (n=11) |

This pins the **canonical id↔name table for wnd# resources** — the
corpus paraphrases ("No Title Utility Window" = the editor's "Untitled Utility
Window", "Alert" = "Modal Alert") are now explicitly grounded in the official
editor's UI string.

---

## 5 · Side-recipe editor — `MENU 134` "wnd# edit"

The four-way breakdown Scheme Factory uses when the author opens a wnd# to
edit its parts. Confirms our compositor's "four sides" model exactly.

**Source:** `MENU 134` in Scheme Factory 1.0pr2.

1. Content & Controls *(the inner rect + widget assignments)*
2. — *(separator)*
3. Top of the Window
4. Bottom of the Window
5. Left Side of the Window
6. Right Side of the Window

This is the order the editor's tab bar uses. The kDEF iterates the same four
sides; **`docs/spec/kdef231-recipe-walk.md`'s side order is the same as the
editor's** (top, bottom, left, right) — confirmed.

---

## 6 · cinf editor — `MENU 136` "cinf edit" + `MENU 137` "cinf fill"

cinf (control info) resources have three editable sections and three fill modes.

**`MENU 136`:**
1. Corners & Sides
2. Text
3. Background

**`MENU 137`:**
1. No Fill
2. Pattern Fill
3. Color Icon Fill

The three fill modes map onto the cinf header's fillType byte we already
decode in `tools/theme-loader/decoders/cinf.js` — Scheme Factory's labels
confirm the three possible values are `none` / `ppat` / `cicn`.

---

## 7 · cinf properties — `STR# 135` (the geometry parameters)

The properties Scheme Factory exposes for editing a cinf:

**Source:** `STR# 135` in Scheme Factory 1.0pr2.

| # | Property |
|---|---|
| 1 | Corner Size: |
| 2 | Side Thickness: |
| 3 | Tile Sides |
| 4 | Text Pixel: |
| 5 | Embossing Pixel: |
| 6 | Background Pixel: |
| 7 | Pattern Anchor: |
| 8 | Translucency Percentage: |
| 9 | Opacity Percentage: |

This is the **authoritative cinf field list**. Our `cinf` decoder should
expose exactly these nine properties. "Corner Size", "Side Thickness", and
"Tile Sides" are the geometry triple that drives 9-slice; "Text Pixel" /
"Embossing Pixel" / "Background Pixel" are three palette indices the cinf
carries for text rendering; "Pattern Anchor" is the ppat origin alignment;
"Translucency/Opacity Percentage" are alpha levels (and confirm cinf can
encode partial transparency — relevant for the menu border alpha mask
in STR# 128 entries 23 and 28).

---

## 8 · cnfo — the editor's per-control panel layout

The application ships 14 `cnfo` resources (ids 128–141). Each is a 35–62 byte
record holding a fixed-format struct followed by a few pascal strings naming
labelled cells in the editor UI ("End Caps:", "Top Cap:", "Top & Bottom
Caps:", "Tile Center"). These are **panel descriptors for the editor**, NOT
part of the Kaleidoscope scheme format — they let the editor know which
geometry properties to show for each control. Cross-referencing the strings:

- `cnfo 130–135, 139`: contain "End Caps:" — for controls that 3-slice horizontally
- `cnfo 132/133/134/139`: contain "Tile Center" — toggle for tiled vs stretched centre
- `cnfo 135`: contains "Top & Bottom Caps:" — the only entry with both axes (likely the slider 5-piece)

This is a useful confirmation that the **editor itself uses our 3-slice/9-slice
classification** — controls are either end-cap+centre (3-slice) or
corners+sides+centre (9-slice).

---

## 9 · Scheme Info — `STR# 136`

Scheme Factory's Get Info inspector for the SCHEME resource (the cinf-info /
Colr 129 we already decode in `loadTheme`).

**Source:** `STR# 136` in Scheme Factory 1.0pr2.

| # | Field |
|---|---|
| 1 | Get Info for This Scheme |
| 2 | Get Info for This Part |
| 3 | Get Info for ^0 |
| 4 | Show: |
| 5 | Minimum required Kaleidoscope version: |
| 6 | Stretch scroll bar thumbs from: |
| 7 | Has accent colors |
| 8 | Overlay menu highlights |
| 9 | Unified scroll bar tracks |
| 10 | Windows style scroll bars |
| 11 | Extended scroll bar arrows |
| 12 | Version number: |
| 13 | Release type: |
| 14 | Release number: |
| 15 | Country: |
| 16 | Short version text: |
| 17 | Long version text (visible in the Finder's Get Info windows): |
| 18 | Info |
| 19 | Scheme's Info |

The **five booleans** (entries 7–11) are exactly the flag bits we observe in
the `Colr 129` / scheme-flags field. They are:

- `hasAccentColors` — the scheme contributes to Appearance Manager's accent ramp
- `overlayMenuHighlights` — menu highlight is a colour overlay rather than a solid
- `unifiedScrollBarTracks` — track is one piece (vs. up/down-track variants)
- `windowsStyleScrollBars` — both arrows clustered at one end (Win95 mode)
- `extendedScrollBarArrows` — arrows are 32px (vs the standard 16px)

The **thumb stretch source** (entry 6 + `MENU 143`) has three modes:
"Default position (3 pixels in)" / "Center" / "Custom position" — useful for
explaining why some schemes' thumbs look offset.

---

## 10 · What is still missing

| Item | Why it's missing | Next step |
|---|---|---|
| Exact bit position of each widget-presence flag (close/zoom/collapse/left-grow/right-grow) | Scheme Factory's STR# tells us the bits *exist* but not the bit layout — that's in the WDEF or CODE | Diff a known-good wnd# byte-by-byte: `1138`'s `-14336` (all five widgets on) vs `1984`'s `-14288` "No Title Utility Window" (zero widgets). The bytes that differ in the `0x1f0`-ish offset are the flag field |
| Side-recipe header struct (the wnd# bytes before the (partCode, border) pairs start) | The editor reads these but the strings don't say what each field means | Disassemble Scheme Factory's WDEF/CODE against the wnd# serialiser, or re-derez a wnd# with `derez` and cross-reference |
| The `cinf` `fillType` byte's three exact values | We know from `MENU 137` the names are `None/Pattern/Color Icon` but not which byte value maps to which | Read one cinf of each kind from the corpus and compare |
| The Scheme Factory **tutorial pages** (the wayback URLs in the request) | Not fetched in this pass | Future agent: WebFetch `https://web.archive.org/web/20030116184053/http://kaleidoscope.net/schemefactory/tutorial/window.html` to cross-corroborate the part-code vocabulary against a worked example |

The big rocks (the 127-element role catalogue, the 24-element part-code
vocabulary, the 7-element widget-slot list, the 5-boolean flag set, the
4-side editor order, the 3-mode fill type, the 9 cinf properties) are all
**recovered and cross-corroborated**. The above are loose ends, not
blockers.

---

## Provenance

- **Binary source:** `Scheme Factory 1.0pr2`, recovered from
  `https://web.archive.org/web/20020312171604/http://kaleidoscope.net/schemefactory/SchemeFactoryPR2.sea.hqx`
  (BinHex-encoded StuffIt SEA, 661 771 bytes).
- **Decoder pipeline:** `unar` → application bundle → `xattr -px
  com.apple.ResourceFork` → `tools/theme-loader/resource-fork.js`
  (`parseResourceFork`, 162 resources, 22 types).
- **Probe script:** archived at `/tmp/probe-sf.mjs` for re-run.
- **Cross-correlation source:** `docs/spec/corpus-corroborated-ids.md`
  (auto-generated from the 18 corpus bundles by `scripts/dump-author-hints.mjs`).
- **Extraction date:** 2026-05-29.

### Resource inventory of Scheme Factory 1.0pr2 (for reference)

```
ALRT 2 · BNDL 1 · CNTL 3 · CODE 2 · CURS 1 · DATA 4 · DITL 7 · DLOG 4
FREF 3 · ICN# 3 · LIST 1 · MBAR 1 · MENU 18 · NUM# 2 · PCS# 13 · PICT 2
SFty 1 · SIZE 1 · STR 1 · STR# 9 · WDEF 1 · WIND 1 · cfrg 1 · cicn 41
cnfo 14 · crsr 3 · dlgx 4 · icl4 3 · icl8 3 · icns 1 · ics# 3 · ics4 3
ics8 3 · vers 2
                                                          Total: 162
```

The 41 `cicn` resources inside Scheme Factory are the editor's own icons (the
parts palette, toolbar, sample previews) — not Kaleidoscope role art. The
`cnfo` resources are the editor's per-control geometry-panel descriptors
(§8 above). The single `WDEF` (1124 bytes) is the application's own window
definition, *not* a scheme-bearing kDEF. The `dlgx` resources are System 8
"Appearance" extended dialog templates (boolean + font flags).
