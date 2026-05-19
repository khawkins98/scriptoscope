# kDEF disassembly findings — Kaleidoscope 1.8.2 binary archaeology

**Date:** 2026-05-19
**Source binary:** `Kaleidoscope 1.8.2 Installer` (StuffIt InstallerMaker self-extracting), extracting `Kaleidoscope` (Control Panel, 504,938-byte resource fork).
**Status:** First-pass investigation. Closes some of spec B §13's open questions; opens others.

This document records what was learned from inspecting Kaleidoscope's actual binary, with cross-references back to the K2 Scheme Reference + spec B (raster mapping) for each finding.

---

## 1. What the binary contains

| Resource | Count | Total bytes | Role |
|---|---:|---:|---|
| `kDEF` | 2 | 160,692 | The 68k (`kDEF 0`, 60,732 B) and PowerPC (`kDEF 1`, 99,960 B) versions of the chrome-rendering "Definition Procedure" |
| `WDEF` | 8 | 10,032 | Window Definition Procedure replacements (one per window-type variant) |
| `CDEF` | 14 | 15,346 | Control Definition Procedure replacements (scrollbar, popup arrows, etc.) |
| `MDEF` | 1 | 4,606 | Menu Definition Procedure replacement |
| `cdev` | 1 | 30,052 | Control Panel device code (the UI for picking schemes) |
| `PACH` | 2 | 87,872 | OS-trap patch code |
| `Zoom` | 2 | 11,281 | Window zoom animation (the "spinning rects") |
| `cicn` | 40 | 17,796 | Default cicns for Kaleidoscope's own UI (not for themed window chrome) |
| `ppat` | 8 | 2,472 | Default ppats |
| `clut` | 18 | 1,296 | Color lookup tables |
| `TMPL` | 2 | 165 | **WPrf** (Window Preferences) + **SPrf** (Scheme Preferences) — Kaleidoscope's own prefs |

The kDEFs are where chrome rendering actually happens. The WDEF/CDEF/MDEF replacements are thin stubs that dispatch into the kDEF.

---

## 2. Architectural facts (confirmed)

### 2.1 Kaleidoscope is QuickDraw-based — no custom blitter

`kDEF 1` (PowerPC) imports 174 symbols from `InterfaceLib`. The functions used:

- **Bitmap copying:** `CopyBits`, `CopyMask` — these are the workhorses. CopyBits with `srcRect.size != dstRect.size` stretches via **sample-and-hold (nearest-neighbor)** — the QuickDraw default.
- **Patterns:** `PenPat`, `BackPat`, `GetPattern`, `GetPixPat`, `DisposePixPat`
- **Regions:** `NewRgn`, `SectRgn`, `UnionRgn`, `DiffRgn`, `RectRgn`, `BitMapToRegion`, `FillRgn`, `PaintRgn`, `FrameRgn`, `EraseRgn`
- **GWorld (off-screen):** `NewGWorld`, `SetGWorld`, `GetGWorld`, `GetGWorldPixMap`, `LockPixels`, `UnlockPixels`, `DisposeGWorld`
- **Clipping:** `SetClip`, `GetClip`, `ClipRect`, `ClipAbove`
- **Color:** `BackColor`, `ForeColor`, `RGBBackColor`, `RGBForeColor`, `GetCTable`
- **Text:** `TextFont`, `TextFace`, `TextSize`, `TextMode`, `DrawText`, `DrawString`, `TruncString`, `StringWidth`, `GetFontInfo`
- **Resource manager:** `GetResource`, `LoadResource`, `ReleaseResource`, `HLock`, `HUnlock`, `HGetState`, `HSetState`

**Implication for Aaron UI:** CSS `image-rendering: pixelated` + `border-image-repeat: stretch` produces the period-correct sample-and-hold scaling. Browsers default to bilinear filtering, which is wrong for the period. Our existing `image-rendering: pixelated` on chrome strips is correct.

### 2.2 Standard controls (buttons) are drawn by the OS, not by Kaleidoscope

`kDEF 1` imports only two symbols from AppearanceLib:
- `GetMenuItemIconHandle`
- `SetUpControlBackground`

The second one is telling: it's the AppearanceLib call that prepares the **background** for a control before the system CDEF draws on top. **Kaleidoscope themes the surroundings; the OS draws the control.** This is why no canonical Kaleidoscope scheme ships push-button cicn artwork.

This confirms our existing AaronButton/AaronField approach (CSS-drawn fallback, no cicn path) and our spec A §3.1 + commentary in `src/controls/AaronButton.ts`.

### 2.3 Resources Kaleidoscope's kDEF directly loads

Searching `kDEF 0` (68k) for literal `_GetResource(type, id)` patterns:

| Address | Call | Notes |
|---|---|---|
| `0x77b4` | `GetResource('cinf', -8208)` | Popup menu text-section cinf |
| `0x8ee2` | `GetResource('proc',  -8224)` | Code procedure (scrollbar?) |
| `0x932e` | `GetResource('WDEF', -14330)` | Widget down-states cicn pair (per K2 §6.1, cicn -14330 = "Widget Down States"; here Kaleidoscope loads its companion WDEF) |
| `0xc31e` | `GetResource('actb', -14336)` | Alert color table — confirms -14336 is the "Inactive Document Window" ID range |

Only **four** literal-ID resource loads. The rest happen with computed IDs (register-loaded), which means **the kDEF is heavily table-driven** — the dispatch chooses an ID from a table based on the request, rather than hardcoded calls per element.

### 2.4 Kaleidoscope's preference templates (NOT cinf)

The TMPL resources inside Kaleidoscope's own resource fork are:

- **TMPL 128** ("WPrf"): `Version` (DWRD) + `Not Used` (BOOL) + `Finder Windows have icons` (BOOL) + `Use Spinning Zoom Rects` (BOOL) + `Number of steps` (DWRD) + `Enable WindowShade Widget` (BOOL).
- **TMPL 129** ("SPrf"): `Version` (DWRD) + `Use Ghost Thumb` (BOOL).

These are **Kaleidoscope's own preferences**, not the cinf format. The cinf TMPL 129 (and STR# 128 with the canonical region vocabulary) live in **Scheme Factory**, the official scheme editor — confirming our spec C §3 model.

The WPrf reveals two facts about Kaleidoscope's animation model that spec B §13 didn't capture:
- "Use Spinning Zoom Rects" is a USER preference, not a Colr (scheme) flag — so spec A §19's animation section is correct that this is global, not per-scheme.
- "Number of steps" controls the zoom animation step count — adjustable by the user. Aaron UI doesn't ship zoom animations yet; if we add them, the step count should be configurable.

---

## 3. Open questions from spec B §13 — resolution status

### §13.1 Divider sandwich (parts 5/6) — STILL OPEN

Not directly observable from the binary surface analysis. The kDEF's recipe-walking happens in the 68k code at addresses we'd need to trace step-by-step. Punted; the empirical "treat as universal-stretch" rule continues to work for the bundled corpus.

### §13.2 Tile-vs-stretch threshold — REFRAMED

The disassembly clarifies the model: there is **no threshold** in Kaleidoscope. Each segment is either:
- A **fixed-rect** stamp (rectList[1..4] named widget) — CopyBits with srcRect = dstRect (no stretch),
- A **stretched fill** — CopyBits with srcRect = one-pixel-wide source, dstRect = N-pixel-wide destination (the "1-pixel-stretch" Speed Note pattern), OR
- A **tiled fill** — only when `cinf.tileSides = 1`; uses pattern-fill primitives instead of CopyBits.

**Implication for Aaron UI:** the current `TINY_STRETCH_THRESHOLD = 2` is an ARTIFACT of CSS `border-image` not having a clean "stretch a 1-pixel slice" mode. The period-correct behavior is: source slices are AT MOST 1 pixel wide for fills (the author authored them that way). If a segment is wider in the cicn, it's a STATIC graphic the author wants preserved, not a fill — these correspond to recipe `at` markers that bracket the static graphic.

The threshold can be replaced with a more honest rule: **if the segment's part is in rectList, stamp the rect at native; otherwise, stretch the source slice at the recipe-bounded width.** Width-of-source = `next_at − cur_at` for fills.

In practice the current per-segment composer already does the right thing for the bundled corpus; this finding is mostly a clarification of WHY.

### §13.3 cinf upper bits (15-value resize behavior) — STILL OPEN

The bit layout for the 15-value matrix isn't recoverable from the binary surface — would need to disassemble the cinf-parser at `kDEF 0` `0x77b4+` and watch how it reads the cinf bytes. Punted again, but with a clearer route forward: the cinf load is at a known location, the next ~100 instructions parse fields.

### §13.4 Color-extraction pixel — PARTIALLY CONFIRMED

The cinf TMPL 129 in Scheme Factory has explicit fields:
- `Background Pixel x/y`
- `Text Pixel x/y`
- `Embossing Pixel x/y`

So the kDEF doesn't have to GUESS which pixel — the cinf TELLS it. Aaron UI's current empirical `(1, height-1)` sample is a fallback when cinf is absent; for cinf-present cases, we should be reading these explicit pixel coords from cinf.

**Action:** check src/themes/loader/decoders/cinf.js — is it already parsing Background/Text/Embossing pixel? (Yes, per our cinf decoder file — the fields exist as `bgPixel`, `textPixel`, `embossPixel`.)

The runtime should consume those fields for color extraction (spec B §4.16-§4.18) instead of pixel-scanning. This is a small but real revision to apply.

### §13.5 Pattern-anchor for non-rectangular containers — STILL OPEN

Free menus + popup menus have non-rectangular containers (the popup menu is a list rendered as a column). The cinf.patternAnchor field documented values (0-4 corners + 5=scaled) don't enumerate anchor behavior for non-rect containers. The kDEF must have logic for this — punted; not a blocker.

### §13.6 Indeterminate progress timing — UNCHANGED

K2 says 125 ms per frame. The disassembly doesn't directly reveal the delay value. The bundled schemes ship 8 ppat IDs; the loop is straightforward.

### §13.7 Disclosure animation timing — UNCHANGED

K2 says 1/20s (50 ms) per frame, 5 frames. Aaron UI doesn't ship animations yet; defer.

---

## 4. New findings not previously catalogued

### 4.1 WPrf prefs are USER-level (Aaron UI doesn't have a counterpart)

Kaleidoscope's WPrf carries 5 flags including "Finder Windows have icons" and "Enable WindowShade Widget". These are GLOBAL user prefs (not per-scheme), set in the Control Panel.

**Implication for Aaron UI:** if we want user-level "appearance global" preferences (analogous to Mac OS Appearance Manager), they belong in a Theme-Registry-adjacent layer, NOT in Theme. We have no analog today; not urgent.

### 4.2 The cdev's Colr load pattern (-14336 family)

The cdev resource (the Control Panel UI) loads `actb` (Alert Color Table) at ID -14336. That ID is in the "Inactive Document Window" range per K2 §6.1, but `actb` is a different resource TYPE (Apple's standard alert color table). This tells us that **Kaleidoscope's resource IDs intentionally overlap with Apple's standard resource ID conventions** — same ID, different resource type. The K2 ID table we have should be interpreted as ID-within-type, not absolute ID slot.

Our spec A §6 / arch spec §6 already treats IDs as type-specific, so this is just a confirmation.

### 4.3 What we DON'T see in Kaleidoscope's binary

The following are absent from kDEF/cdev:
- No literal `cicn` string in the .text segment (cicn IDs are computed)
- No literal `wnd#` string either (recipe lookups computed)
- No literal `ppat`, `Colr` strings
- No MathLib, no transcendentals — pure integer math

This confirms our model: Kaleidoscope is a TABLE-DRIVEN renderer. The mapping from "type of chrome element" to "resource type + ID" happens through indirect tables. We should expect the same table-driven architecture in our composer.

---

## 5. Action items for the runtime

| Finding | Action | Priority |
|---|---|---|
| 2.1 sample-and-hold scaling | Verify `image-rendering: pixelated` is applied everywhere — it is, per `src/controls/engineBaseline.ts` + chrome composer | DONE |
| 2.2 buttons drawn by OS | Existing AaronButton CSS-only approach is period-correct; no change | DONE |
| §13.2 threshold | Document why the current threshold "works"; defer cleanup until step 3 controls expand | DEFER |
| §13.4 explicit color pixels | Use cinf's Background/Text/Embossing pixel fields for color extraction instead of pixel-scanning | DO NEXT |
| 2.4 WPrf prefs | Note in spec C §3 that scheme-global vs user-global is a distinction we don't currently model | DOC ONLY |
| 4.3 table-driven | Spec C §11 already describes our composer as table-driven; reinforce in arch spec | DOC ONLY |

---

## 6. Methodology

- Source: `~/Downloads/Kaleidoscope 1.8.2 Installer.app` (a classic-Mac file with FinderInfo type `APPL`, creator `Acid!`, ~520KB data fork containing the StuffIt InstallerMaker payload)
- Extraction: `unar` → "Kaleidoscope" (cdev, 504KB rsrc fork) + "Kaleidoscope Extension" (APPL, 12KB rsrc fork)
- Resource parsing: our own `src/themes/loader/resource-fork.js`
- 68k disassembly: `m68k-elf-objdump -D -b binary -m m68k:68000 -EB`
- PEF parsing: hand-rolled `parse-pef.py` based on Apple's Mac OS Runtime Architecture spec
- Strings: `strings -n 4` + `xxd`
- Resource-load pattern search: byte-pattern grep for `0x2f3c TT TT TT TT 0x3f3c IL IH 0xa9a0` (the canonical "push type, push ID, call GetResource" sequence)

Disassembly artifacts kept under `/tmp/aaron-disasm/` (not committed). Reproducible from the original binary path above.

---

## 7. References

- [`docs/aaron-ui-raster-mapping-spec.md`](../aaron-ui-raster-mapping-spec.md) §13 — open-question catalog this disassembly is closing against
- [`docs/aaron-ui-architecture-spec.md`](../aaron-ui-architecture-spec.md) §2-§6 — format model this confirms
- K2 Scheme Reference (in `Kaleidoscope Goodies/`) — period-author documentation
- Apple "Mac OS Runtime Architecture" (1996) — PEF specification
- Apple "Inside Macintosh: Macintosh Toolbox Essentials" — WDEF / CDEF / MDEF protocols + QuickDraw reference
