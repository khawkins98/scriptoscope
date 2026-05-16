# Scheme deconstruction — mass:werk Dark ErgoBox 2

**Second Kaleidoscope scheme deconstructed for Aaron UI.** Picked as a Tier 2 stylistically-distant counterweight to [`masswerk-7-le.md`](./masswerk-7-le.md): same author, very different aesthetic — dark BeOS / Rhapsody / CDE hybrid. The goal is to surface what extends past the Platinum-faithful vocabulary so Aaron UI's bundle format leaves room for it.

---

## Provenance

| Field | Value |
|---|---|
| Scheme name | `mass:werk Dark ErgoBox 2` |
| Version | 2 — first public version (2011-08, work 2002-2011) |
| Author | N. Landsteiner — <https://www.masswerk.at> |
| Source URL | <https://www.masswerk.at/schemes/masswerk_dark_ergobox2.sit> (80,320 bytes archive) |
| Date acquired | 2026-05-16 |
| Working copy | `.scratch/schemes/masswerk-dark-ergobox2/` (gitignored) |
| Stated visual goal | *"BE-like tabbed windows with a gentle blend of Mac OS and Rhapsody elements, CDE-like folders (with reversed tab). The scheme is specially made for high productivity and minimal eye-stress."* |

### License (quoted from readme)

> **Distribution: Freeware**
> Scheme by N. Landsteiner 2002-2011

Even tighter than 7 Le's readme — single word, no conditions. Clean.

---

## Resource fork at a glance vs 7 Le

| Type | ErgoBox 2 | 7 Le | Delta | What this reveals |
|---|---:|---:|---:|---|
| `cicn` | 159 | 119 | **+40** | More state variants — utility windows + extra widget states |
| `ppat` | 25 | 6 | **+19 (4×)** | Heavy use of pattern fills for textures, borders, scrollbar tracks |
| `wnd#` | 10 | 6 | **+4** | Four new window types: Utility, Collapsed Utility, Side Floating Utility, Collapsed Side Floating Utility |
| `cinf` | 57 | 47 | +10 | Interaction metadata for the new utility-window widgets |
| `icns` | 62 | 5 | +57 | Modern (Mac OS 8.5+) icon family for the CDE-like folder set |
| `ICN#` / `icl8` | 60 | 7 | +53 | Same — many more file-system icons |
| `ics8` / `ics#` | 72 | 29 | +43 | Same — small-icon set |
| `PICT`, `clut`, `dctb`, `actb`, `Colr`, `STR#`, `DLOG`, `DITL`, `vers`, `TMPL` | match | match | 0 | Structural — same per-scheme |

**Total: 530 resources across 19 types** (vs 271 in 7 Le).

The 4× explosion of `ppat` is the load-bearing signal. ErgoBox's BeOS/CDE feel is *pattern-driven*, where 7 Le's Platinum feel is *bevel-driven*. Two very different ways to fill the same chrome categories.

---

## Vocabulary extensions vs 7 Le

### New window types (4 added)

| `wnd#` ID | Name | What it is |
|---:|---|---|
| -14304 | **Utility Window** | Floating utility / tool palette — the BeOS tear-off equivalent |
| -14300 | **Collapsed Utility Window** | Utility windowshade state |
| -14296 | **Side Floating Utility Window** | Side-docked utility variant |
| -14292 | **Collapsed Side Floating Utility Window** | Side-docked windowshade |

**Implication for Aaron UI's window-type enum:** Phase 5 (Dialogs & sheets) needs to include Utility Window types alongside the Document/Modal/Alert set from 7 Le. Six wasn't the full vocabulary — ten is closer.

### New widget vocabulary in `cicn` names

ErgoBox decomposes utility-window chrome separately from document-window chrome:

- `Titled Utility Window` (active + inactive)
- `Collapsed Titled Utility Window` (active + inactive)
- `Side Floating Utility Window` (active + inactive + collapsed variants)
- `Large Utility Window Grow Box` (active + inactive)
- `Small Utility Window Grow Box` (active + inactive)
- `Utility Window Down State Widgets` (the pressed-control composite)
- `Document Window Alternate Zoom Boxes` — confirms ErgoBox has *more than one* zoom-box variant
- `Document Window Pressed Widgets` — composite-pressed-state icon (different idiom from 7 Le's per-widget approach)

### Naming convention shift

Same author, but the noun-order convention shifted between schemes:

- 7 Le (2001): `Active Document Window` / `Inactive Document Window`
- ErgoBox 2 (2011): `Document Window Active` / `Document Window Inactive`

**Implication for Aaron UI:** even within a single author's body of work, naming isn't normalized. Aaron UI's canonical vocabulary must pick one convention. Recommend **`<noun> <state>`** (matches HIG prose: "the active document window") rather than **`<state> <noun>`**. Update across the bundle format reference.

---

## Visual reference (from author's screenshot)

Quoted observations from `schemes/dark_ergobox.jpg` — the author's own preview image. **Do not extract pixels; these are visual notes for re-authoring.**

- **Chrome:** very dark gray (~`#3a3a3a`), darker than Mac OS Platinum by far
- **Titlebar metaphor:** the titlebar is a **small rounded-top tab** that projects upward from the window's top-left corner, not a full-width strip — the "BE-like tabbed window" the readme describes. Inactive windows show a dimmer, less-saturated version of the same tab
- **Titlebar texture:** very faint horizontal pinstripe in dark-on-darker; close to flat
- **Content area:** mid-light gray (~`#d4d4d4`), *not* white — that's the "ergonomic / low eye-stress" choice
- **Window border:** 1px crisp dark outer + 1px lighter inner — the "border treatment" the user flagged. Sharper than Platinum's softer bevel.
- **Scrollbars:** dark chunky tracks with mid-gray thumbs, much heavier than Platinum's
- **Status bar:** present at window bottom, showing "1 Object, 2 MB free" — confirms the Mac OS 8 status bar slot is in active use here (and absent from 7 Le)
- **Menu bar:** dark with white text — inverted from Platinum's light bar
- **Default button:** noticeably *less* thick black outline than Platinum's

---

## What this tells us about Aaron UI's bundle format (new findings beyond 7 Le)

1. **`ppat` is a first-class concept, not just for the pinstripe.** ErgoBox uses patterns for: titlebar texture, scrollbar tracks, scrollbar thumb fill, window border, content background — at least 6 distinct surfaces. Our format needs a *pattern catalog* (`--aaron-titlebar-pattern`, `--aaron-scrollbar-track-pattern`, etc.), not just colors.

2. **Window-type catalog is open-ended.** Six types in 7 Le, ten in ErgoBox. Aaron UI's WM should accept a *registered* window type — themes can declare new types — rather than hard-coding the enum. A `wnd#`-equivalent JSON section in `theme.json`.

3. **Composite "pressed widgets" image.** ErgoBox ships a single `Document Window Pressed Widgets` icon that contains all pressed-state widgets composited together. That's a packing optimization for the bitmap era. Aaron UI should *not* mirror this — modern web has CSS state pseudo-classes, so per-state CSS rules are cleaner than composite sprites. **Reject this Kaleidoscope quirk.**

4. **Status bar is sometimes-present.** 7 Le doesn't ship a status bar element; ErgoBox visibly does. Aaron UI's window class should expose a status-bar slot that themes can choose to render (or not), with the WM core agnostic about content.

5. **Tabbed-titlebar is a layout primitive, not just a paint job.** The BeOS-style tab is a *different titlebar geometry* — projecting outside the content rectangle, not contained within the window frame. Aaron UI's chrome system should accept "titlebar geometry" as a theme-overridable layout (`--aaron-titlebar-shape: full-width | tab-projecting | other`), not just a color/pattern swap.

6. **Content area color is not assumed white.** 7 Le content is white; ErgoBox content is light gray. Themes should set `--aaron-content-bg` rather than the WM assuming `#fff`.

7. **Border treatments are richer than "1px solid".** ErgoBox uses a 1px outer + 1px inner stripe at different luminance levels — closer to a 2px composite border. Aaron UI's bundle format should allow themes to specify multi-stripe borders (CSS `border` is too thin; `box-shadow` chains or composite borders work).

---

## Observations against the spike's hypothesis

The spike doc predicted that a Tier 2 scheme would surface "extension points" the Tier 1 scheme didn't. **Confirmed in five places**:

| Extension surfaced by ErgoBox | Required in Aaron UI bundle format |
|---|---|
| Utility / Side Floating Utility window types | Open-ended window-type registry, not fixed enum |
| Heavy pattern reliance (4× more `ppat`) | Pattern catalog (`--aaron-*-pattern` props) alongside colors |
| Tab-projecting titlebar geometry | Titlebar shape as a layout primitive |
| Non-white content background | `--aaron-content-bg` as a first-class prop |
| Status bar present | WM exposes status-bar slot |

If Aaron UI's v0 format had been designed against 7 Le only, all five would have been missed. Validates the methodology.

---

## What's notably absent in both schemes

Same as 7 Le — and the absence pattern matters:

- **No sounds** (`snd ` resources). Kaleidoscope supported them, mass:werk never shipped them.
- **No desktop background.** Schemes ship neither.
- **No fonts.** OS-provided typography is assumed.

**Conclusion across both Tier 1 and Tier 2:** the "theme bundle ships sounds + desktop + fonts" PRD goal is **an Aaron UI design choice, not Kaleidoscope-derived**. Ported third-party Kaleidoscope schemes will not bring these; only Aaron UI's first-party preset themes can be expected to. Set consumer expectations accordingly. (Recorded in LEARNINGS.)

---

## Next steps (carried forward)

1. Apply the five new findings to `docs/THEME-FORMAT-REFERENCE.md` when drafted.
2. The multi-theme demo (`demo/themes.html`) renders both schemes from these observations — visual fidelity is approximate "informed re-authoring," not pixel reproduction.
3. Future Tier 3 candidate (if format generalizes well to both 7 Le and ErgoBox, we may not need a third before drafting v0).
