# TODO — authentic classic-Mac typography (Chicago / Charcoal / Geneva)

**Status:** WINDOW TITLES done (2026-05-25); control labels + the `textRaster`
pixel path still on the platform-font fallback.
**Goal:** titles and control labels should render in the classic Mac system
typeface (Chicago for System 6–7.5, Charcoal for OS 8.5+, Geneva for small
labels) instead of today's bold-sans fallback — the single biggest "this doesn't
quite read as Mac OS" tell once the chrome is right.

## Done (2026-05-25) — window titles

Two license-clean **Charcoal** faces are bundled (`demo/assets/fonts/`) and wired
into the browser title path (`renderWindow.ts` `rasterizeTitleFont`), satisfying
clean paths 1 + 2 + 3 below for titles:
- **Charcoal 12** — Jeremy Sachs' CC BY-SA bitmap clone of Mac OS 8/9 Charcoal
  (FontStruct). PRIMARY title font; crisp only at its grid-native 16px (pinned,
  zero tracking, integer baseline), so it upscales pixelated and blocky-crisp.
  License + readme bundled per CC BY-SA (`charcoal-12-license.txt` / `-readme.txt`).
- **Virtue** — Marty P. Pfeiffer / Scooter Graphics' free Charcoal recreation,
  itself from Greg Landweber's Aaron/Kaleidoscope Charcoal. The `@font-face`
  fallback + the UI-label font; `local('Charcoal')` is preferred when installed
  (clean path 3). Credit + terms in `VIRTUE-LICENSE.txt`.

**Still pending:** the compositor's `rasterizeText` (`src/textRaster.ts`, the
non-DOM pixel path + the title fallback) and CONTROL LABELS (`controls.ts`
button/tab labels) still use the platform-font stack — wire them to the bundled
faces too (Charcoal 12 for ≥1× pixel sizes, Virtue/Geneva-lookalike for labels).

## Where we are now

- The pixel compositor's `rasterizeText` (`src/textRaster.ts`) draws glyphs with
  the **platform font** via canvas: `700 …px Chicago, "Charcoal", Geneva,
  Verdana, sans-serif`. If the user happens to have Chicago/Charcoal installed it
  looks right; otherwise it falls back to bold sans-serif. Its own doc comment
  already flags "bundling the actual bitmap font is a known refinement."
- The demo + `renderWindow` CSS use the same `Charcoal, Chicago, Geneva,
  sans-serif` stack — same system-dependent behaviour.
- So in practice most viewers see bold sans, not the period bitmap face.

## The catch (why we can't just grab the fonts)

Apple's **Chicago / Charcoal / Geneva are Apple IP** and are not redistributable.
The repos that surfaced this are NOT a usable source:
- `JohnDDuncanIII/macfonts` — **no license** (all rights reserved), and its
  `Charcoal_10.11/*.ttf` are renamed **Apple San Francisco** (`SFNSDisplay`)
  binaries, not the real bitmap Charcoal. Can't ship.
- `JohnDDuncanIII/platinum` — likewise unlicensed + Apple-derived (see
  `../archive/golden-reference-todo.md` / the Platinum discussion).
- **Credit ≠ a license.** Attribution doesn't grant redistribution rights; any
  third-party font needs an actual web-embedding/redistribution license.
- Kaleidoscope schemes don't ship fonts (the OS supplied them), so the corpus
  isn't a source either.

## Clean paths (in the project's clean-room spirit)

1. **Embed our own / a public-domain BITMAP font in `rasterizeText`** *(recommended)*.
   The classic system font WAS a bitmap at UI sizes; a small pixel glyph set
   (ASCII + the punctuation titles use) authored or sourced public-domain gives an
   authentic, crisp, license-clean result — the same clean-room move as the
   procedural Platinum chrome. Self-contained, no webfont fetch, pixelates with
   the chrome.
2. **Bundle a freely-licensed lookalike webfont.** Several Chicago/Geneva-style
   retro fonts exist under OFL / explicit free-for-web terms (e.g. ChiKareGo /
   ChiKareGo2, and KreativeKorp's retro families). **Verify each font's license
   permits redistribution + web embedding** before bundling; record it in the
   theme/asset provenance the way scheme licenses are recorded.
3. **Consumer opt-in.** Ship a clean lookalike as the default but expose a CSS
   `@font-face` / custom-property hook so a consumer who legitimately owns
   Chicago/Charcoal can supply it.

## Definition of done

- A bundled, license-clean face (our bitmap glyphs and/or an OFL lookalike) wired
  into BOTH `rasterizeText` (compositor titles/labels) and the demo/`renderWindow`
  CSS stacks, with the bold-sans fallback retained for safety.
- Provenance + license documented (font name, author, license, source URL) — same
  bar as scheme provenance.
- Spot-check titles/labels across the corpus at 1× and 2× (crisp, no smoothing).

## Pointers
- `src/textRaster.ts` — the compositor glyph rasterizer (the main seam).
- Font stacks: `demo/index.html` + `demo/diagnostic.html`, `src/renderWindow.ts`, `src/platinum.ts`
  (`platinumWindow` title), `src/controls.ts` (button/tab labels).
- `README.md` "what loaded themes carry" — notes schemes don't bring fonts.
