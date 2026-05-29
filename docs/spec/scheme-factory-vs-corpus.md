# Scheme Factory `STR# 128` × corpus author labels — cross-correlation

> Cross-correlates the **127-element master chromeElement role catalogue**
> extracted from Scheme Factory 1.0pr2 (the official scheme editor) against
> the **6,842 author-supplied NAMED-resource labels** aggregated across the
> 18-bundle corpus.
>
> Two sources, two perspectives:
>
> - `docs/spec/scheme-factory-vocabulary.md` §1 — what authors **DERIVED FROM**
>   (the editor's default role names; 127 entries — 120 slots + 7 section
>   headers; entry numbering preserved from the binary).
> - `docs/spec/corpus-corroborated-ids.md` — what authors **TYPED** (the
>   verbatim NAMED labels they wrote when they overrode the defaults).
>
> Matching is normalized: lowercase, strip `¥`, swap state aliases
> (`Active`↔`Enabled`, `Inactive`↔`Disabled`, `Normal`→`Enabled`), expand the
> three corpus shorthands `SSF`→`Small`, `LSF`→`Large`, `SBB`→`Small Bevel
> Button`, then Jaccard token overlap. Buckets:
>
> | Bucket | Threshold | Interpretation |
> |---|---|---|
> | **canonical** | exact normalized equality | author kept the Scheme Factory default verbatim (up to state-alias) |
> | **paraphrase** | Jaccard ≥ 0.5, not exact | author paraphrased — same SF slot, different wording |
> | **paraphrase (weak)** | 0.3 ≤ Jaccard < 0.5 | one or two tokens off; the SF intent is still clear |
> | **invented** | Jaccard < 0.3 | the corpus row's label is not in the SF catalogue — author coined a new role or repurposed a slot |
> | **dead SF role** | no corpus row matches at score ≥ 0.3 | no bundle in the corpus assigns a cicn to this SF slot |
> | **misroute candidate** | label maps strongly to a SF role *different from* the id's canonical role | the resource is in the wrong slot — anti-role detection candidate |
>
> Re-generate: `node /tmp/cross-correlate.mjs` (script archived at
> `/tmp/cross-correlate.mjs` — bakes the 127 SF entries verbatim from §1 plus
> the 133 corpus rows from cicn/cinf/wnd# tables).

---

## 1 · Headline numbers

| Bucket | Count |
|---|---|
| Canonical (exact, state-alias normalized) | 12 |
| Paraphrase (Jaccard ≥ 0.5) | 94 |
| Paraphrase weak (0.3 ≤ Jaccard < 0.5) | 15 |
| Invented (Jaccard < 0.3) | 12 |
| **Total corpus rows analysed** | **133** (cicn + cinf + wnd#) |
| SF roles with ≥ 1 corpus assignment | 68 of 120 (57 %) |
| **Dead SF roles** | **52 of 120** (43 %) |

The catalogue is **wider than the corpus uses**. Half of `STR# 128` is
authoring affordances the corpus authors never touched (every bevel-button
"Mixed" state, every small-tab variant, every "Free Menu" slot, the
notification-window background…). That's not a corpus defect — it's
Scheme Factory anticipating Mac OS 8/9 Appearance Manager controls that
classic Kaleidoscope schemes typically left to the OS.

---

## 2 · Canonical match — author kept the SF default verbatim

These 12 rows reproduce the Scheme Factory string with no editing beyond
the universal `Active↔Enabled` / `Inactive↔Disabled` swap (Appearance
Manager API vocabulary vs Scheme Factory UI vocabulary).

| restype | id | author label (verbatim) | n bundles | SF entry # | SF role name |
|---|---|---|---|---|---|
| cicn | -10144 | "Inactive Down Pointing Slider Track" | 7 | 93 | Disabled Down Pointing Slider Track |
| cicn | -10128 | "Inactive Right Pointing Slider Track" | 7 | 102 | Disabled Right Pointing Slider Track |
| cinf | -10144 | "Inactive Down Pointing Slider Track" | 5 | 93 | Disabled Down Pointing Slider Track |
| cinf | -10138 | "Inactive Up Pointing Slider Track" | 5 | 96 | Disabled Up Pointing Slider Track |
| cinf | -10240 | "Inactive Push Button" | 4 | 39 | Disabled Push Button |
| cinf | -10238 | "Pressed Push Button" | 4 | 41 | Pressed Push Button |
| wnd# | -14336 | "Document Window" | 11 | 2 | Document Window |
| wnd# | -12320 | "Popup Window" | 11 | 14 | Popup Window |
| wnd# | -14322 | "Movable Alert" | 5 | 7 | Movable Alert |
| wnd# | -14296 | "Side Floating Utility Window" | 5 | 12 | Side Floating Utility Window |
| wnd# | -14332 | "Collapsed Document Window" | 4 | 3 | Collapsed Document Window |
| wnd# | -14292 | "Collapsed Side Floating Utility Window" | 2 | 13 | Collapsed Side Floating Utility Window |

Observation: **wnd# resources are the cleanest** — 6 of the 12 canonicals
are window-type names. Authors paraphrase art (cicn / cinf) labels, but
they leave the window-type names alone.

---

## 3 · Paraphrase — author rewrote the SF default but kept the intent

The 94 paraphrase rows. Columns paired so the corpus voice and the SF
voice sit side-by-side.

### 3.1 · Push-button family (`-1023x` / `-1024x`)

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -10239 | "Push Button Active¥" | 6 | 40 | Enabled Push Button |
| -10240 | "Push Button Inactive¥" | 6 | 39 | Disabled Push Button |
| -10238 | "Push Button Pressed¥" | 6 | 41 | Pressed Push Button |
| -10231 | "Push Button Ring Active¥" | 6 | 43 | Enabled Default Push Button Ring |
| -10232 | "Push Button Ring Inactive¥" | 6 | 42 | Disabled Default Push Button Ring |
| -10239 (cinf) | "Push Button" | 5 | 40 | Enabled Push Button (cinf carries geometry, not state) |
| -10231 (cinf) | "Default Ring" | 4 | 43 | Enabled Default Push Button Ring |
| -10232 (cinf) | "Inactive Default Ring" | 4 | 42 | Disabled Default Push Button Ring |

### 3.2 · Bevel-button family (`-1015x..-1017x`) — `Off/On × Small/Normal/Large × Disabled/Normal/Pressed`

Authors compress the SF labels by dropping "Bevel Button" — the SIZE prefix
+ ON/OFF + STATE is enough to disambiguate. There's NO "Mixed" state in
the corpus — every "Mixed" SF slot is dead (see §6).

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -10165 | "Normal Off Pressed" | 9 | 56 | Normal Pressed Bevel Button Off |
| -10162 | "Normal On Pressed" | 9 | 59 | Normal Pressed Bevel Button On |
| -10167 | "Normal Off Disabled" | 8 | 54 | Normal Disabled Bevel Button Off |
| -10166 | "Normal Off Normal" | 8 | 55 | Normal Enabled Bevel Button Off |
| -10164 | "Normal On Disabled" | 8 | 57 | Normal Disabled Bevel Button On |
| -10163 | "Normal On Normal" | 7 | 58 | Normal Enabled Bevel Button On |
| -10158 | "Large Off Disabled" | 8 | 63 | Large Disabled Bevel Button Off |
| -10157 | "Large Off Normal" | 7 | 64 | Large Enabled Bevel Button Off |
| -10156 | "Large Off Pressed" | 8 | 65 | Large Pressed Bevel Button Off |
| -10155 | "Large On Disabled" | 7 | 66 | Large Disabled Bevel Button On |
| -10154 | "Large On Normal" | 7 | 67 | Large Enabled Bevel Button On |
| -10153 | "Large On Pressed" | 8 | 68 | Large Pressed Bevel Button On |
| -10174 | "Small Off Pressed" | 7 | 47 | Small Pressed Bevel Button Off |
| -10171 | "Small On Pressed" | 7 | 50 | Small Pressed Bevel Button On |

### 3.3 · Slider family (sliders are a paraphrase mess — authors trim "Pointing", drop "Non-Directional", insert "Horizontal")

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -10143 | "Down Pointing Slider Track" | 7 | 94 | Enabled Down Pointing Slider Track |
| -10127 | "Right Pointing Slider Track" | 7 | 103 | Enabled Right Pointing Slider Track |
| -10135 | "Up Pointing Slider Thumbs" | 7 | 97 | Enabled Up Pointing Slider Track *(corpus uses "Thumbs" — see §6 misroute discussion)* |
| -10125 | "Right Pointing Slider Thumbs" | 7 | 103 | Enabled Right Pointing Slider Track *(same as above)* |
| -10119 | "Left Pointing Slider Thumbs" | 7 | 106 | Enabled Left Pointing Slider Track *(same)* |
| -10113 | "Vertical Non-Directional Slider Thumbs" | 7 | 109 | Enabled Vertical Non-Directional Slider Track *(same)* |
| -10131 (cinf) | "Non-Directional Horizontal Slider Track" | 5 | 100 | Enabled Horizontal Non-Directional Slider Track |
| -10132 (cinf) | "Inactive Non-Directional Horizontal Slider Track" | 5 | 99 | Disabled Horizontal Non-Directional Slider Track *(Jaccard 1.00)* |
| -10115 (cinf) | "Non-Directional Vertical Slider Track" | 5 | 109 | Enabled Vertical Non-Directional Slider Track |
| -10116 (cinf) | "Inactive Non-Directional Vertical Slider Track" | 5 | 108 | Disabled Vertical Non-Directional Slider Track *(Jaccard 1.00)* |
| -10130 (cinf) | "Pressed Non-Directional Horizontal Slider Track" | 4 | 101 | Pressed Horizontal Non-Directional Slider Track *(Jaccard 1.00)* |
| -10142 (cinf) | "Pressed Down Pointing Horizontal Slider Track" | 4 | 95 | Pressed Down Pointing Slider Track *(corpus inserts "Horizontal")* |
| -10136 (cinf) | "Pressed Up Pointing Horizontal Slider Track" | 4 | 98 | Pressed Up Pointing Slider Track |
| -10143 (cinf) | "Down Pointing Horizontal Slider Track" | 5 | 94 | Enabled Down Pointing Slider Track |
| -10137 (cinf) | "Up Pointing Horizontal Slider Track" | 5 | 97 | Enabled Up Pointing Slider Track |

Note: the corpus consistently writes `Thumbs` for the **slider thumb cicns**
(ids -10113, -10119, -10125, -10135). The SF catalogue has **no separate
slider-thumb slot** — `STR# 128` entries 93–110 are all "Slider Track". The
thumbs are an authoring affordance Kaleidoscope adds *outside* the canonical
catalogue, encoded as "the cicn with a `Thumbs` suffix at the track-pair's
sibling id" (always `track_id - 8`). This is a corpus-attested authoring
convention not captured by `STR# 128`.

### 3.4 · Window-frame family — `-143xx` ids cluster

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -14336 | "Document Window Inactive¥" | 6 | 2 | Document Window |
| -14330 | "Document Window Pressed Widgets¥" | 6 | 2 | Document Window *(corpus invents a "Pressed Widgets" sub-state — see §6)* |
| -14327 | "Dialog Active¥" | 6 | 4 | Modal Dialog |
| -14328 (cicn) | "Inactive Dialog" | 8 | 119 | Disabled Dialog Background *(weak — see §6 misroute)* |
| -14326 | "Alert Inactive¥" | 6 | 5 | Modal Alert |
| -14325 | "Alert Active¥" | 6 | 5 | Modal Alert |
| -14324 | "Movable Dialog Inactive¥" | 6 | 6 | Movable Dialog |
| -14323 | "Movable Dialog Active¥" | 6 | 6 | Movable Dialog |
| -14322 | "Movable Alert Inactive¥" | 6 | 7 | Movable Alert |
| -14321 | "Movable Alert Active¥" | 6 | 7 | Movable Alert |
| -14304 | "Titled Utility Window Inactive¥" | 6 | 8 | Utility Window |
| -14303 | "Titled Utility Window Active¥" | 6 | 8 | Utility Window |
| -14296 | "Side Utility Window Inactive¥" | 6 | 12 | Side Floating Utility Window |
| -14295 | "Side Utility Window Active¥" | 6 | 12 | Side Floating Utility Window |
| -12320 | "Popup Window Active¥" | 6 | 14 | Popup Window |
| wnd# -14326 | "Alert" | 6 | 5 | Modal Alert |
| wnd# -14328 | "Dialog" | 3 | 4 | Modal Dialog |
| wnd# -14324 | "Movable Modal Dialog" | 3 | 6 | Movable Dialog |
| wnd# -14304 | "Titled Utility Window" | 2 | 8 | Utility Window |
| wnd# -14288 | "No Title Utility Window" | 2 | 10 | Untitled Utility Window |
| wnd# -14300 | "Collapsed Titled Utility Window" | 1 | 9 | Collapsed Utility Window |
| wnd# -14284 | "Collapsed No Title Utility Window" | 1 | 11 | Collapsed Untitled Utility Window |

### 3.5 · Menubar family

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -12238 | "Menubar Selected Menubar Item¥" | 6 | 18 | Selected Menu Bar Item *(weak — corpus doubles "Menubar")* |
| -12238 (cinf) | "Selected Root Menu Item" | 5 | 18 | Selected Menu Bar Item |
| -12240 (cinf) | "Root Menu Background" | 5 | 16 | Menu Bar Background |
| -12239 (cinf) | "Root Menu Item" | 5 | 17 | Menu Bar Item |
| -12236 (cinf) | "Selected Menu Item" | 5 | 20 | Pull Down Selected Menu Item |
| -12237 (cinf) | "Pull Down Menu" | 4 | 19 | Pull Down Menu Background |
| -12235 | "Divider Line" (cicn n=7 + cinf n=6) | | 21/26 | Pull Down Menu Divider Line / Free Menu Divider Line (ambiguous — see §6) |

### 3.6 · Tab family — `SSF` (Small) vs `LSF` (Large) shorthand

The corpus uses `SSF`/`LSF` prefixes; the SF catalogue spells them out as
"Small"/"Large". After expanding the shorthand the rows line up
unambiguously.

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -9976 | "SSF Disabled Rear Tab" | 7+5 | 80 | Small Disabled Rear Tab |
| -9975 | "SSF Rear Tab" | 7+5 | 81 | Small Enabled Rear Tab |
| -9972 | "SSF Front Tab" | 7+5 | 84 | Small Enabled Front Tab |
| -9974 (cinf) | "SSF Pressed Rear Tab" | 5 | 82 | Small Pressed Rear Tab |
| -9973 (cinf) | "SSF Disabled Front Tab" | 5 | 83 | Small Disabled Front Tab |
| -9970 (cinf) | "SSF Inactive Tab Pane" | 4 | 85 | Small Disabled Tab Pane |
| -9969 (cinf) | "SSF Active Tab Pane" | 4 | 86 | Small Enabled Tab Pane |
| -9984 (cinf) | "LSF Disabled Rear Tab" | 4 | 73 | Large Disabled Rear Tab |
| -9983 (cinf) | "LSF Rear Tab" | 5 | 74 | Large Enabled Rear Tab |
| -9982 (cinf) | "LSF Pressed Rear Tab" | 5 | 75 | Large Pressed Rear Tab |
| -9981 (cinf) | "LSF Disabled Front Tab" | 5 | 76 | Large Disabled Front Tab |
| -9980 (cinf) | "LSF Front Tab" | 5 | 77 | Large Enabled Front Tab |
| -9978 (cinf) | "LSF Inactive Tab Pane" | 5 | 78 | Large Disabled Tab Pane |
| -9977 (cinf) | "LSF Active Tab Pane" | 5 | 79 | Large Enabled Tab Pane |

(The script's first pass mismatched `SSF` → "Large Disabled Rear Tab"
because the regex didn't know the shorthand; with `SSF→Small` the rows
become unambiguous Small-tab matches.)

### 3.7 · Header / list view family

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -9568 (cinf) | "Inactive Header" | 5 | 87 | Disabled Finder Header |
| -9567 (cinf) | "Active Header" | 4 | 88 | Enabled Finder Header |
| -9551 (cinf) | "Icon View Background" | 7 | 123 | Icon View Background Color |
| -9550 (cinf) | "List View Background" | 7 | 124 | Non-Sorted List View Color *(weak — see §6)* |
| -9549 (cinf) | "List View Sort Color" | 5 | 125 | Sorted List View Color |
| -9548 (cinf) | "List View Divider Line" | 5 | 126 | List View Divider Line Color |

### 3.8 · Popup-menu family

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -8208 (cinf) | "Disabled Popup Button Text" | 4 | 29 | Disabled Popup Menu Text Section |
| -8207 (cinf) | "Normal Popup Button Text" | 4 | 30 | Enabled Popup Menu Text Section |
| -8206 (cinf) | "Pressed Popup Button Text" | 4 | 31 | Pressed Popup Menu Text Section |
| -8205 (cinf) | "Disabled Popup Button Arrow" | 4 | 32 | Disabled Popup Menu Arrow Section |
| -8204 (cinf) | "Normal Popup Button Arrow" | 4 | 33 | Enabled Popup Menu Arrow Section |
| -8203 (cinf) | "Pressed Popup Button Arrow" | 4 | 34 | Pressed Popup Menu Arrow Section |
| -8202 (cinf) | "Disabled Arrow Only Popup" | 4 | 32 | Disabled Popup Menu Arrow Section *(corpus reuses the slot for the arrow-only variant)* |
| -8201 (cinf) | "Normal Arrow Only Popup" | 4 | 33 | Enabled Popup Menu Arrow Section |
| -8200 (cinf) | "Pressed Arrow Only Popup" | 4 | 34 | Pressed Popup Menu Arrow Section |

Note: the corpus has 9 popup entries (-8200..-8208); the SF catalogue has
9 popup slots (#29-#37, where #35/36/37 are "Popup Menu Without Text").
The corpus authors **collapse the "Arrow Only" variant onto the
same SF arrow slots** as the regular popup — `-8202..-8200` and
`-8205..-8203` both map to SF #32-#34. The SF "Without Text"
slots (#35-#37) get zero corpus assignments — see §6.

### 3.9 · Progress-bar family

| id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|
| -10224 | "Progress Bar Track" | 6 | 113 | Enabled Progress Bar Track |
| -10223 | "Progress Bar: Lavender " | 6 | 112 | Enabled Progress Bar Fill *(weak — author treats fill as a colour-named slot, not "Fill")* |
| -10080 (cinf) | "Progress Indicator Frame" | 6 | 111 | Enabled Progress Bar Frame |
| -10078 (cinf) | "Progress Indicator Track" | 6 | 113 | Enabled Progress Bar Track |
| -10077 (cinf) | "Inactive Progress Indicator Frame" | 5 | 114 | Disabled Progress Bar Frame |
| -10076 (cinf) | "Inactive Progress Indicator Fill" | 5 | 115 | Disabled Progress Bar Fill |
| -10075 (cinf) | "Inactive Progress Indicator Track" | 5 | 116 | Disabled Progress Bar Track |

The corpus uses "Progress Indicator" (the Mac OS classic name) where SF
uses "Progress Bar" (the Appearance Manager name).

---

## 4 · Paraphrase (weak) — one or two tokens off

15 rows in the 0.3-0.5 Jaccard band. Mostly authors trimming qualifiers
or doubling up. Listed for completeness — the SF intent is still legible.

| restype | id | corpus author label | n | SF # | SF role name |
|---|---|---|---|---|---|
| cicn | -9975 | "SSF Rear Tab" | 7 | 81 | Small Enabled Rear Tab *(SSF expansion lifts this to canonical-paraphrase)* |
| cicn | -9972 | "SSF Front Tab" | 7 | 84 | Small Enabled Front Tab *(same)* |
| cicn | -14333 | "Document Window Grow Box Active ¥" | 6 | (none — no SF grow-box slot) | — |
| cicn | -14317 | "Inactive Utility Window Grow Box" | 6 | (none — no SF grow-box slot) | — |
| cicn | -14313 | "Active Utility Window Grow Box" | 6 | (none — no SF grow-box slot) | — |
| cicn | -12238 | "Menubar Selected Menubar Item¥" | 6 | 18 | Selected Menu Bar Item |
| cicn | -10223 | "Progress Bar: Lavender" | 6 | 112 | Enabled Progress Bar Fill |
| cinf | -9550 | "List View Background" | 7 | 124 | Non-Sorted List View Color |
| cinf | -10080 | "Progress Indicator Frame" | 6 | 111 | Enabled Progress Bar Frame |
| cinf | -10078 | "Progress Indicator Track" | 6 | 113 | Enabled Progress Bar Track |
| cinf | -9983 | "LSF Rear Tab" | 5 | 74 | Large Enabled Rear Tab |
| cinf | -9980 | "LSF Front Tab" | 5 | 77 | Large Enabled Front Tab |
| cinf | -9975 | "SSF Rear Tab" | 5 | 81 | Small Enabled Rear Tab |
| cinf | -9972 | "SSF Front Tab" | 5 | 84 | Small Enabled Front Tab |
| cinf | -10231 | "Default Ring" | 4 | 43 | Enabled Default Push Button Ring |

The three "Grow Box" rows (cicn -14333 / -14317 / -14313) have NO SF #128
match because **`STR# 128` has no grow-box slot** — grow-box is in
`STR# 129` (widget slots, entries #6 "Left Grow Box" + #7 "Right Grow
Box"). That's a window-widget, not a window-chrome role. So these are
NOT invented — they're authored against the *widget-slot* vocabulary
the editor exposes elsewhere.

---

## 5 · Invented — corpus labels with no `STR# 128` match

12 corpus rows whose label doesn't normalize to any of the 120 SF slots.
**Most are NOT invented — they're authored against a different
vocabulary** (widget slots, scroll-bar slots, finder pane slots) that
the SF binary spells out in `STR# 129` or in dedicated cinf slots.

| restype | id | corpus author label | n | Best SF guess (low score) | What it actually is |
|---|---|---|---|---|---|
| cicn | -14334 | "inactive grow box" | 10 | #89 Disabled Placard (0.25) | `STR# 129` widget slot, not `STR# 128` |
| cicn | -14310 | "Inactive Movable Modal Grow Box" | 7 | #4 Modal Dialog (0.17) | `STR# 129` widget slot |
| cicn | -12240 | "Menubar Menubar Background¥" | 6 | #16 Menu Bar Background (0.25) | **Genuinely paraphrased** — corpus doubles "Menubar"; canonical |
| cicn | -12239 | "Menubar Menubar Item¥" | 6 | #17 Menu Bar Item (0.25) | Same — canonical, the doubled "Menubar" drops the Jaccard |
| cicn | -10208 | "Scroll Thumbs Vertical Active¥" | 6 | #109 Vert Slider Track (0.25) | **Scroll-bar thumb** — `STR# 128` has NO scrollbar entries (scrollbars are a separate Kaleidoscope subsystem) |
| cicn | -10207 | "Scroll Thumbs Vertical Pressed¥" | 6 | #110 (0.25) | Scroll-bar thumb |
| cicn | -10206 | "Scroll Thumbs Horizontal Active¥" | 6 | #100 (0.25) | Scroll-bar thumb |
| cicn | -10205 | "Scroll Thumbs Horizontal Pressed¥" | 6 | #101 (0.25) | Scroll-bar thumb |
| cinf | -12234 | "Solo Menu" | 4 | #16 Menu Bar Background (0.25) | Authored — "Solo Menu" is Kaleidoscope's name for the standalone-popup menu (matches SF's "Free Menu" family #24-#28 conceptually, but the corpus author's term doesn't tokenize-overlap) |
| cinf | -10175 | "SBB Active/Unselected" | 3 | #90 Enabled Placard (0.25) | After expanding SBB→"Small Bevel Button": **Small Enabled Bevel Button Off** (#46) — the corpus uses an Active/Unselected×Inactive/Selected DUAL-AXIS vocabulary the SF Off/On/Mixed×Disabled/Enabled/Pressed catalogue doesn't anticipate |
| cinf | -10174 | "SBB Active/Unselected Pressed" | 3 | #56 (0.29) | Small Pressed Bevel Button Off |
| cinf | -10173 | "SBB Inactive/Selected" | 3 | #89 (0.25) | Small Disabled Bevel Button On |

### Key finding — the scroll-bar vocabulary gap

`STR# 128` has **zero scrollbar entries**. The 4 `-1020x` "Scroll Thumbs"
ids are authored against a vocabulary the SF master catalogue doesn't
expose — confirming a long-standing observation in this codebase:
**Kaleidoscope's scrollbar model lives outside `STR# 128`** (in the
ppat-driven `-8285..-8288` scrollbar tracks per the kDEF decompile,
referenced in `src/controls.ts:323-331`). The SF editor presumably has a
separate panel for scrollbars; the corresponding STR# resource is not
`STR# 128`.

### Key finding — the grow-box gap

Three cicn rows (-14334, -14310, plus widget rows in §4) reference
"Grow Box" — these belong to `STR# 129` (widget slots), NOT `STR# 128`
(chromeElement role catalogue). Authors freely mix the two vocabularies
when typing labels. **Not bugs.**

### Key finding — SBB dual-axis vocabulary

The corpus authors invent a `Active/Unselected` × `Inactive/Selected`
nomenclature for the SBB (Small Bevel Button) when used as a tab-strip
button. The SF catalogue's `Off/On/Mixed` × `Disabled/Enabled/Pressed`
model doesn't map cleanly — `Unselected ≈ Off`, `Selected ≈ On`, but
that's a guess. Investigate further: load one bundle's `-10175` cicn
and see whether it visually matches a small-bevel "Off" or something
distinct.

---

## 6 · Dead SF roles — slots no corpus bundle assigns

52 of 120 (43 %) `STR# 128` slots have no corpus assignment at score
≥ 0.3. Grouped by section:

### Windows (#1-#14) — 2 dead

| # | SF role | Note |
|---|---|---|
| 10 | Untitled Utility Window | corpus uses "No Title Utility Window" (canonical paraphrase) — **NOT truly dead, the matcher missed it** |
| 11 | Collapsed Untitled Utility Window | Same — corpus has "Collapsed No Title Utility Window" — **NOT truly dead** |

After manual correction: **0 windows dead**. Every SF window type is
represented.

### Menus (#15-#37) — 11 dead

| # | SF role | Truly dead? |
|---|---|---|
| 20 | Pull Down Selected Menu Item | **No** — corpus has cinf -12236 "Selected Menu Item" (paraphrase Jaccard 0.75 to SF #18, but the verbatim slot is #20) |
| 21 | Pull Down Menu Divider Line | **No** — corpus has cicn/cinf -12235 "Divider Line" (paraphrase 0.50 — the disambiguation between #21 and #26 is unclear from the corpus label) |
| 22 | Pull Down Menu Border | **Yes** — no corpus row mentions any "Menu Border" |
| 23 | Pull Down Menu Border's Alpha Mask | **Yes** — corpus never authors a Mac-OS-9 alpha mask |
| 24 | Free Menu Background | **Yes** — "Free Menu" is the SF name for a torn-off / contextual menu; the corpus's "Solo Menu" (cinf -12234) is the same concept but doesn't match by tokens (see §5 invented) |
| 25 | Free Selected Menu Item | **Yes** — same gap |
| 26 | Free Menu Divider Line | **Maybe** — cicn/cinf -12235 "Divider Line" could be either #21 or #26 |
| 27 | Free Menu Border | **Yes** |
| 28 | Free Menu Border's Alpha Mask | **Yes** |
| 35 | Disabled Popup Menu Without Text | **Yes** — the "Without Text" popup variant is unused by every corpus bundle |
| 36 | Enabled Popup Menu Without Text | **Yes** |
| 37 | Pressed Popup Menu Without Text | **Yes** |

### Buttons (#38-#71) — 14 dead — all "Mixed" + small-bevel-Off

| # | SF role | Note |
|---|---|---|
| 44 | Pressed Default Push Button Ring | **Yes** — corpus has -10231 active + -10232 inactive but never a "Pressed Ring". (The Mac UI doesn't actually press the ring — only the inner face — so this is plausibly absent by design.) |
| 45-46 | Small Disabled / Enabled Bevel Button Off | **Yes** — corpus skips the small-bevel-Off entirely |
| 48-49 | Small Disabled / Enabled Bevel Button On | **Yes** |
| 51-53 | Small Disabled / Enabled / Pressed Bevel Button Mixed | **Yes** — no "Mixed" anywhere |
| 60-62 | Normal Disabled / Enabled / Pressed Bevel Button Mixed | **Yes** |
| 69-71 | Large Disabled / Enabled / Pressed Bevel Button Mixed | **Yes** |

**Total: every "Mixed" state across all 3 sizes is dead.** Corpus
authors never ship the indeterminate / tri-state bevel button face.

### Tabs / Headers / Placards (#72-#91) — 11 dead

| # | SF role | Note |
|---|---|---|
| 74 | Large Enabled Rear Tab | **No** — corpus has cinf -9983 "LSF Rear Tab" (paraphrase 0.40) |
| 77 | Large Enabled Front Tab | **No** — cinf -9980 "LSF Front Tab" |
| 80-86 | Small Disabled / Enabled / Pressed Rear/Front Tab + Tab Pane | **No** — corpus has the SSF cinf entries -9976/-9975/-9974/-9973/-9972/-9970/-9969 (after SSF→Small expansion all 7 map cleanly) |
| 89 | Disabled Placard | **Yes** — no Placard authored |
| 90 | Enabled Placard | **Yes** |
| 91 | Pressed Placard | **Yes** |

After manual correction: **Placards are truly dead (3 entries).** Tabs
all match.

### Sliders / progress (#92-#116) — 9 "dead", all matcher artifacts

The script's normalizer dropped "Pointing" from corpus labels, making
"Down Pointing Slider Track" vs SF "Disabled Down Pointing Slider Track"
match exactly (n=7). The "Enabled X Slider Track" entries (#94, #97,
#100, #103, #106, #109) score 0.80 not exact-1.0 because corpus authors
drop the state qualifier when the state is "active/enabled" (the default
state). So the SF "Enabled Down Pointing Slider Track" matches corpus
"Down Pointing Slider Track" at 0.80 — paraphrase, not dead.

Same story for the four Pressed-Slider entries (#101, #104, #107, #110).

**Truly dead in this section: 1 — entry #112 Enabled Progress Bar Fill.**

Wait — `-10223 "Progress Bar: Lavender"` (n=6) maps to #112 at score 0.40
(weak paraphrase). So **#112 is paraphrase-attested, not dead.** The
corpus author labels every progress fill by its colour name (Lavender,
Aqua, etc.) rather than as "Fill" — that's why the Jaccard is low. The
SF intent is intact.

**Net dead in this section: 0.**

### Colors & Patterns (#117-#127) — 4 dead

| # | SF role | Truly dead? |
|---|---|---|
| 118 | Enabled Dialog Background | **No** — cicn -14328 "Inactive Dialog" matches "Disabled Dialog Background" #119 at 0.67 — the active variant (-14327 cicn "Dialog Active") matches #118 at 0.67 too. Not dead. |
| 122 | Desktop Text Color & Background | **Yes** — corpus never authors a "Desktop" slot in cinf/cicn (the `ppat 17 "Desktop Pattern"` doesn't have a matching cinf/cicn role) |
| 124 | Non-Sorted List View Color | **No** — cinf -9550 "List View Background" maps here (0.40 weak) |
| 127 | Mac OS 9 Notification Window Background | **Yes** — corpus has no OS 9 notification authored |

### Final dead-SF tally (after manual review)

| Section | Truly dead | Count |
|---|---|---|
| Windows | (none) | 0 |
| Menus | 22, 23, 24, 25, 27, 28, 35, 36, 37 | 9 |
| Buttons | 44, 45, 46, 48, 49, 51, 52, 53, 60, 61, 62, 69, 70, 71 | 14 (all "Mixed" + small-bevel-Off + Pressed-Ring) |
| Tabs / Headers / Placards | 89, 90, 91 | 3 (Placards) |
| Sliders & Progress | (none) | 0 |
| Colors & Patterns | 122, 127 | 2 |
| **Total** | | **28 of 120 (23 %)** |

The honest "dead" count after correcting for matcher artifacts is
**28 dead slots, not 52**. The corpus covers 92 of 120 SF role slots
(77 %) — substantial coverage. The truly-dead slots cluster: every
**bevel-button "Mixed" state** (the indeterminate tri-state), every
**"Free Menu" variant** (torn-off menus), every **"Without Text" popup**
variant, every **Placard**, the **Desktop slot**, and the **OS 9
notification window**.

---

## 7 · Misroute candidates — author label hints at a different SF role

These are the **anti-role detection candidates**. A row is a misroute
candidate when its corpus label maps STRONGLY to a SF role *different
from* the one its id canonically encodes (per `STR# 128` cross-reference
table in `docs/spec/scheme-factory-vocabulary.md` §1 + §4).

### 7.1 · Known canonical id↔SF mapping (from `STR# 128` cross-ref)

| id | canonical SF role | SF # |
|---|---|---|
| -10239 (cicn) | Enabled Push Button | 40 |
| -10240 (cicn) | Disabled Push Button | 39 |
| -10238 (cicn) | Pressed Push Button | 41 |
| -10231 (cicn) | Enabled Default Push Button Ring | 43 |
| -10232 (cicn) | Disabled Default Push Button Ring | 42 |
| -10143 (cicn) | Enabled Down Pointing Slider Track | 94 |
| -10144 (cicn) | Disabled Down Pointing Slider Track | 93 |
| -10142 (cicn) | Pressed Down Pointing Slider Track | 95 |
| -10080 (cinf) | Enabled Progress Bar Frame | 111 |
| -10223 (cicn) | Enabled Progress Bar Fill | 112 |
| -10224 (cicn) | Enabled Progress Bar Track | 113 |
| -14336 (wnd#) | Document Window | 2 |
| -14326 (wnd#) | Modal Alert | 5 |
| -14296 (wnd#) | Side Floating Utility Window | 12 |
| -12320 (wnd#) | Popup Window | 14 |

### 7.2 · Surfaced misroutes (corpus label disagrees with canonical id)

For these, the author wrote a label that points at a DIFFERENT SF role
than the one the id encodes — the resource is in the wrong slot.

| Bundle | restype | id | author label | canonical SF role | mislabel points at | Severity |
|---|---|---|---|---|---|---|
| animals + monkey-paradise (per `LEARNINGS.md`) | cicn | -10239 | "Solo Menu Background" (or `solo-menu-background-2`) | #40 Enabled Push Button | #16 Menu Bar Background / #24 Free Menu Background | **HIGH — already patched** (commit 888826d added anti-role detection in `src/controls.ts:138-155`) |

That's the only one already surfaced and patched in the codebase. The
remaining corpus rows below MIGHT be misroutes but the corpus aggregate
data alone can't confirm — we'd need per-bundle authorLabels to verify.

### 7.3 · Suspicious patterns worth a closer look (per-bundle audit)

These author conventions COULD hide misroutes if any individual bundle
ships its label-meaning under the canonical-role's id.

**1. "Document Window Pressed Widgets¥" — cicn -14330 (n=6)**

The corpus author invented a "Pressed Widgets" sub-state for the
Document Window. SF has only `Active`/`Inactive` for windows — no
pressed state. The `-14330` id sits between the canonical -14336
(Document Window) and -14328 (Modal Dialog) families. **Likely a
genuine new role** (the close/zoom/collapse boxes drawn pressed)
rather than a misroute — but worth a pixel inspection to confirm.

Runtime usage check: `src/composeChrome.ts` — Document Window chrome
uses -14336 (active) and -14333 (inactive variant? Actually the corpus
labels say -14336 IS the inactive variant — see next row).

**2. "Document Window Inactive¥" — cicn -14336 (n=6)**

`-14336` is the `wnd#` Document Window id (per §4 of the SF
vocabulary doc). But six corpus bundles label the CICN with the same
id as "Document Window **Inactive**". This is the wnd# id reused as
the inactive cicn id — **not a misroute, a deliberate id-reuse
convention** the kDEF supports (the wnd# resource and the inactive
chrome cicn co-share -14336; active chrome is at a sibling id).

This is documented behaviour, not a bug. Worth calling out so
future readers don't flag it.

**3. "Inactive Dialog" — cicn -14328 (n=8)**

`-14328` is the wnd# Dialog id (per §4: `Modal Dialog → -14328`). Same
pattern as #2 — the inactive-state cicn co-shares the wnd# id. The
corpus label "Inactive Dialog" maps to SF #119 "Disabled Dialog
Background" at 0.67 — that's the `cinf` background slot, not the
chrome cicn slot. **Not a misroute** — the matcher confused two
unrelated SF entries (#4 wnd# Modal Dialog vs #119 cinf Disabled
Dialog Background). Both are legitimate roles for the id.

**4. The slider "Thumbs" naming (cicn -10113, -10119, -10125, -10135)**

The corpus authors use "Slider Thumbs" but `STR# 128` has no
thumb-slot. The matcher mapped these to "Slider Track" entries because
of the shared "Slider" token. **Not misroutes** — these are
genuinely a thumb resource sitting at id `track_id - 8`. The SF
catalogue doesn't expose them as a separate slot, but every
corpus bundle does the same thing — they're an attested but
catalogue-absent convention.

### 7.4 · Recommended anti-role additions

Based on the patterns surfaced above, the runtime should grow
anti-role detection beyond the existing push-button regex.
Current state of `src/controls.ts:155`:

```ts
const PUSH_BUTTON_FACE_ANTI_KEY_RE = /menu|tab.pane|pull.down|popup|window|dialog|scroll/i;
```

Candidates for additional anti-role guards:

| Slot | Canonical SF role | Recommended anti-role regex | Why |
|---|---|---|---|
| Slider track family (-10143/-10144/-10127/-10128/-10135/-10125/-10119/-10113) | SF #93-#110 | `/thumb|menu|popup|window|button/i` | A bundle could ship `solo-menu` or a button face at -10143 the same way animals/monkey-paradise did at -10239; the slider compositor (`composeSlider` in `src/controls.ts:580+`) currently has no such guard |
| Push-button RING (-10231/-10232) | SF #42/#43 | `/face|button.face|menu|window/i` | Sister-id to the face — same kind of mis-authoring possible. The face has a guard; the ring should too |
| Progress-bar fill (-10223) | SF #112 | `/menu|window|dialog|button/i` | The "Lavender" colour-named slot convention means any bundle that ships a non-progress cicn at -10223 will be silently used as the fill |

**Action item:** at the next pass through `src/controls.ts`, generalize
the anti-role guard into a per-role catalogue keyed by SF entry number.
The push-button case is the proof-of-concept; the catalogue covers 119
other slots that COULD develop the same authoring bug.

---

## 8 · Bottom line

- **The corpus is mostly canonical.** 12 + 94 = 106 of 133 rows (80 %)
  are exact-or-near-exact paraphrases of SF defaults. Authors follow the
  Scheme Factory vocabulary closely.
- **The corpus is wider than `STR# 128`.** Three vocabularies coexist in
  the corpus labels: `STR# 128` (chrome roles), `STR# 129` (widget slots
  like Grow Box), and a Kaleidoscope-specific scrollbar vocabulary that
  has no `STR# 128` entry. The corpus's "invented" labels are mostly
  authored against those OTHER vocabularies, not invented from scratch.
- **`STR# 128` is wider than the corpus.** 28 of 120 SF slots (23 %)
  have no corpus author at all — the bevel-button "Mixed" state, the
  "Free Menu" torn-off variant, the "Popup Menu Without Text" variant,
  Placards, Desktop, and the OS 9 Notification Window.
- **Only one confirmed misroute** so far: the animals + monkey-paradise
  "Solo Menu Background" at cicn -10239 (already patched at
  `src/controls.ts:155`). The cross-correlation surfaces THREE other
  slots (slider tracks, push-button rings, progress-fill) that could
  develop the same authoring bug — recommend generalizing the
  push-button anti-role pattern into a per-SF-role catalogue.
- **The matcher's 52 "dead" slots overcount by ~24** — most are
  paraphrase-token-loss artifacts (the corpus drops "Pointing",
  "Enabled", "Bevel Button" qualifiers). The honest dead-slot count is
  **28** (§6 final tally).

---

## Provenance

- **SF vocabulary source:** `docs/spec/scheme-factory-vocabulary.md` §1
  (the 127-entry `STR# 128` extracted from Scheme Factory 1.0pr2).
- **Corpus source:** `docs/spec/corpus-corroborated-ids.md` (auto-generated
  by `scripts/dump-author-hints.mjs` from the 18 corpus bundles' named
  resources).
- **Matching script:** `/tmp/cross-correlate.mjs` — Jaccard token overlap
  with state-alias + shorthand expansion (`SSF→Small`, `LSF→Large`,
  `SBB→Small Bevel Button`).
- **Extraction date:** 2026-05-29.
- **Cross-references:**
  - `src/controls.ts:132-203` — the push-button anti-role detection
    (the pattern the §7.4 recommendations generalize).
  - `LEARNINGS.md` — the "monkey-paradise Solo Menu" entry that
    motivated the anti-role check.
  - `docs/spec/scheme-factory-vocabulary.md` §1 cross-reference table
    — the canonical id↔SF role mapping §7.1 derives from.
