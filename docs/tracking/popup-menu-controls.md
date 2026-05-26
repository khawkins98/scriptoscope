# TODO — graft the shipped POPUP MENU + MENU art (deferred / out of scope for now)

**Status:** DEFERRED — reference only. Both controls have working **procedural
baselines** (`platinum.ts`), so nothing looks broken; this is a fidelity upgrade for
*later*. The two unused control classes the all-rasters audit surfaced (see
`LEARNINGS.md` 2026-05-25) that we did NOT graft, because each needs a decision +
visual confirmation a blind solo graft can't safely make.

The shipped-art override engine already exists: `composeFaceButton` in
`src/controls.ts` (9-slice + interior-flatten + label; width/height/align). Bevel
buttons (`composeBevelButton`) and the list header (`composeListHeader`) graft cleanly
through it; these two are the holdouts.

---

## Popup / dropdown menu — `-8194..-8208`

The closed pop-up button. Two channels of art:

**Arrow glyphs** (consistent across schemes):

| id | role |
|----|------|
| -8194 / -8195 / -8196 | small popup arrow — pressed / active / inactive (≈7–9 × 10) |
| -8197 / -8198 / -8199 | large popup arrow — pressed / active / inactive (≈9–11 × 12) |

**Button faces** `-8200..-8208` — **structured INCONSISTENTLY per scheme**, which is
why a robust graft needs per-scheme handling:

- **1984** (cleanly named) splits the control into two 14×16 sections + an arrow-only:
  `-8206/-8207/-8208` = TEXT section (pressed / active / inactive),
  `-8203/-8204/-8205` = ARROW section, `-8200/-8201/-8202` = arrow-ONLY variant.
  → graft = 9-slice the text section to the label + append the arrow section.
- **1990** ships a single **unified** button `-8200` ("pop-up-menu-button-active",
  15×15) — arrow likely baked in. → graft = 9-slice -8200 alone (adding an arrow glyph
  would double it).
- **1138** ships `-8200..-8208` all **unnamed** 16×16 — layout unknown without
  decoding the pixels.

Ships in: the sliced schemes (1138 / 1984 / 1990 / beos / evolution). The Platinum-
family schemes do NOT ship a popup button (they defer to the OS CDEF).

**Graft sketch (later):** detect the layout — if a 14px text-section (-8207) +
arrow-section (-8204) exist, compose `[composeFaceButton(text) | arrow-section]`; else
if a unified button (-8200) exists, 9-slice it alone; else fall back to
`platinumPopupMenu`. Verify each scheme visually. Baseline today: `platinumPopupMenu`.

---

## Menus (menu bar + selection highlight) — `-12247..-12288`

| id | role |
|----|------|
| **-12288** | **menu-bar** (the bar background) |
| -12272 | menu-colors (a palette swatch resource, not chrome) |
| -12247 .. -12287 | **menu-highlight-<colour>** — the selection bar, one cicn PER colour |

The named highlight colours (black-platinum, 18–20 of them): teal, rose, plum, olive,
nutmeg, lime, ivy, french-blue, copper, aquamarine, silver, sapphire, magenta, crimson,
turquoise, emerald, gold, lavender.

Ships the bar + ~20 highlights in: **apple-platinum-2, black-platinum, platinum-8,
system7-nostalgia-silver** (the corner-sprite Platinum family). NOT the sliced schemes.

**The ambiguity:** the bar (-12288) is one clear cicn to 9-slice, but the *selection*
uses **one of ~20 highlight colours** — and which one is "the" highlight is the user's
system Highlight-Colour setting (Appearance control panel), not a per-scheme constant.
So a faithful graft needs a DECISION, e.g.:
  1. a fixed default colour (which? — period default ≈ a blue/teal), or
  2. expose the colour as an option / cycle them in the demo, or
  3. read a scheme-declared default if one exists (none found yet — `-12272`
     "menu-colors" is unexplored; may encode the default).

Baseline today: `platinumMenuBar` + `platinumMenu` (procedural, black-invert selection).

**Graft sketch (later):** 9-slice -12288 for the bar background, draw titles, and
9-slice a chosen highlight cicn for the pulled-down title / selected item. Resolve the
colour decision first. Worth exploring `-12272` "menu-colors" to see if it pins a
default.

---

## When picking this up
- Reuse `composeFaceButton` (the 9-slice + flatten + label engine).
- Add `composeListHeader`-style composers (`composePopupMenu`, `composeMenuBar` /
  `composeMenu`) that resolve by id and fall back to the `platinum.ts` baseline.
- Wire them in the demo (per-theme row, like the bevel buttons) and verify each
  shipping scheme visually before committing.
