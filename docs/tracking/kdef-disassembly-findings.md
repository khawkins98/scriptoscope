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

## 9. Widget POSITIONING is anchor-based, not recipe-order (2026-05-20)

Third-pass trace (Ghidra 12.1 installed + objdump as MC68020, which
fixes the `0xff` BSR.L long-branch mis-decode). The faithfulness gap in
the v2 compositor is positioning: it lays widgets out left-to-right in
recipe order, but the kDEF **anchors each part to an edge/center and
repositions it as the window grows.**

### 9.1 The part-placement function (`0x35b0`, runs 0x35b0–0x4216)

Decodes (objdump; Ghidra truncates on the raw resource's bad-data
spots, so this is read from assembly):

- Loads the window's CONTENT rect into locals: `*obj@8 → [top,left]`,
  `*obj@12 → [bottom,right]` (fp@-16..-10). Width = right−left
  (fp@-282), height = bottom−top.
- Computes the rect CENTER: `cx=(left+right+1)/2`, `cy=(top+bottom+1)/2`
  (the recurring `divsw #2`).
- Gets the piece's intrinsic size `d4×d6` — either a fixed grow-box
  size (16 or 32 px, chosen by `width < 32`) or from a cicn's bounds
  (`part@34` = cicn handle).
- Then the **placement switch** at `0x3900`: `d0 = part@44 + 1`,
  bounded to 0..9, `jmp` via the 10-word table at `0x3908`. Each case
  positions the `d4×d6` piece relative to the center/edges by the
  centering math. A second 6-case switch (`0x3d28`) is the default
  path when `part@32 == 0` (no explicit placement).

### 9.2 The part-struct fields that drive placement

`a2 = (*obj)@28` then per-part `*a2`:

| Field | Meaning |
|---|---|
| `@32` (word) | has-explicit-placement flag (0 → default switch `0x3d28`) |
| `@34` (long) | cicn handle for the piece's artwork / intrinsic size |
| `@42` (word) | width offset (`width − part@42`) |
| `@44` (word) | **placement mode** — selector for the `0x3900` 10-case switch (anchor: which edge/center the piece sticks to) |
| `@50` (word) | **anchor** — checked against −1/1/2/3/4 to decide whether to subtract the piece size from the span (i.e. right/bottom-anchor vs left/top) |
| outer `@17` (byte) | a per-window anchor/inset flag (≠0,−1,−2 → 1px inset) |

### 9.3 What this means for the compositor

Widgets are NOT placed by walking the recipe left-to-right. Each named
part has its MINIMUM-window rect (the wnd# rect list) plus an anchor:
left-anchored parts (close box) keep their left x; right-anchored parts
(zoom, windowshade) move with the right edge
(`x' = windowWidth − (cicnWidth − rectRight)`); centered parts center on
`cx`. The recipe fill (§8) paints the stripe BETWEEN the anchored
widgets. That's the faithful model — and it explains why left-to-right
layout "feels hacked."

### 9.4 The placement modes — DECODED (all 10 cases)

At the switch (`0x3900`): `d7 = cx = (left+right+1)/2`, `fp@-284 = cy =
(top+bottom+1)/2`, `d4 = piece width`, `d6 = piece height`, and the
piece rect starts at the origin. `part@48` = x-offset, `part@46` =
y-offset (per-part insets from the anchored edge). Each case places the
piece, then most run a secondary `@50` sub-switch for title-relative
nudging. Selector = `part@44 + 1`:

| `part@44` | handler | placement |
|---|---|---|
| `-1`, `1` | `0x3a44` | **left edge**, V-centered: `left = content.left + @48` |
| `0` | `0x391c` | **center** both: `left = cx − w/2`, `top = cy − h/2` |
| `2` | `0x3ace` | **right edge**, V-centered: `left = content.right − w − @48` |
| `3` | `0x3b5a` | **top edge**, H-centered: `top = content.top + @46` |
| `4` | `0x3be4` | **bottom edge**, H-centered: `top = content.bottom − h − @46` |
| `5` | `0x3c74` | **top-left** corner: `(content.left+@48, content.top+@46)` |
| `6` | `0x3c9a` | **bottom-left**: `(content.left+@48, content.bottom−h−@46)` |
| `7` | `0x3cc2` | **top-right**: `(content.right−w−@48, content.top+@46)` |
| `8` | `0x3cea` | **bottom-right**: `(content.right−w−@48, content.bottom−h−@46)` |

So it's a **3×3 anchor grid + center** with pixel offsets — the classic
Appearance-Manager part placement. Edge/corner anchors are what make
the close box stick left, zoom/windowshade stick right, and the grow
box stick bottom-right as the window resizes.

### 9.5 Scope — which path draws what

`0x35b0` is the **part/control placement** path (grow box, scrollbar
parts, cinf-anchored elements) — it positions ONE part by its anchor.
The window TITLEBAR frame + its baked-in widgets are drawn by the
**recipe walk** (§8): fixed segments (incl. widget columns) copy 1:1,
grow segments stretch — which already edge-anchors the baked widgets
(left stays, right shifts) as the window grows. The TITLE TEXT is a
centered part (mode 0/3). So:
- titlebar frame/stripe/widgets → recipe walk (§8)
- title text + grow box + scrollbar parts → anchor placement (§9)

Do NOT apply §9 anchor math to the titlebar's baked widgets — the
recipe already handles them. The compositor fix is to make the §8 fill
faithful (drop the `findStripeColumn` heuristic; stretch grow segments
straight from the recipe).

### 9.6 RESOLVED (2026-05-21) — the window-title anchor is not in scheme data

Settled where `@44/@50` come from for a window title: **nowhere in the
scheme**. Proof:
- **TMPL 1240** (the authoritative `wnd#` format, embedded in every scheme)
  is exactly `Rectangle List` + `Top/Bottom/Left/Right Side` — no title rect,
  no anchor field. `decodeWnd` consumes 100% of the bytes; re-checked all
  `wnd#` in 1990/1138/1984/beos/evolution → **0 trailing bytes** in every one.
- **No window-title cinf exists.** Dumped all 91 cinf in 1990 (and 1138):
  every cinf is a *control* background (view-BG, bevel buttons, progress,
  tabs, placard, dialog/alert BG, text/arrow parts). The window cicns
  (`-14335/-14336`) are cinf-less.

So `@44/@50` are kDEF **runtime defaults by part-code** (no per-scheme
override for the title). The default is centered. The renderer centering the
title on the bar is therefore faithful; the old web-renderer reference images
that show 1990/BeOS titles in a left box/tab are that renderer's
approximation, NOT genuine kDEF — do not treat them as ground truth for the
title anchor. The cinf `textPixel` IS the per-element anchor signal, but only
for the controls that ship a cinf (used now for button label color, §11.5).
- Renumber: this section was authored before §8; numbering is
  non-sequential (§9 then §8) — historical, leave as-is.

### 9.5 Tooling

Ghidra 12.1 (`brew install ghidra`) + openjdk@21. Headless decompile:
`analyzeHeadless <proj> <name> -import kDEF_0.bin -processor
68000:BE:32:MC68020 -postScript DecompFrame.java` (Java script, since
12.1 dropped Jython). Define the embedded jump tables (`0x3908`:10w,
`0x3978`:6w, `0x3d28`:6w, `0x1f22`:28w) as data first or analysis runs
through them. Decompiler still truncates on bad-data; reading the
objdump (`-m m68k:68020`) of the specific case handlers is more reliable.

---

## 8. Recipe-walk resolution — §13.1 CLOSED (2026-05-20)

Second-pass trace, driven by the v2 compositor needing a principled
fill-source rule (not the heuristic "scan for the stripiest column").
Resolved by THREE independent, agreeing sources.

### 8.1 The period authoring doc states the rule outright

`Kaleidoscope Goodies/Creating Schemes/Creating Color Schemes` (shipped
in the 1.8.2 installer) describes the popup-window draw, which is the
same model used for all frames:

> "It draws the four corners of the frame directly from the cicn, and
> **stretches the single row or column of pixels between the various grow
> regions to draw the sides.** It then stamps the tab on top of the
> frame, stretching the middle column of pixels (which includes the text
> color pixel) to make room for the title."

So: corners/fixed pieces are CopyBits 1:1; **sides are a single 1px
row/column stretched** between grow-region markers. This is the
authoritative statement of §13.2's model, from Kaleidoscope's own authors.

### 8.2 The wnd# recipe is a structural segment list, NOT widget refs

Raw decode of 7 Le's `wnd#` (via `tools/theme-loader`), with TRUE part
codes (theme.json slugs them part-0..N by index, hiding this):

```
Document Window (-14336)
  RECT LIST (hit-test only): p0 body, p1 close x9-20, p2 zoom x36-48,
                             p3 windowshade x53-64, p4 divider x28-29
  TOP recipe (border@part):  0@p0 5@p1 21@p2 24@p1 25@p8 28@p6 29@p5
                             32@p6 33@p8 35@p1 51@p3 68@p10 74@p1
```

The recipe part codes are a **frame-piece vocabulary, independent of the
rect-list widget codes**. Proof: the **Modal Dialog has no widgets** yet
its recipe is `0@p0 3@p1 4@p8 8@p1` — so `p1`/`p8` are structural frame
pieces, not the close box. Every window type shows the same signature:
`p8` fill segment(s) flanking a `p5/p6` "divider sandwich", `p1` at the
edges/corners, `p0` as the null start. Widgets are **baked into the cicn
bitmap** at their positions; the rect-list is purely for click hit-testing.

### 8.3 Code-level confirmation (kDEF 0, 68k)

- **Top-level dispatch** `0x1f0e`: `movew fp@(12),d0; cmpiw #27,d0;
  bhi …; movew pc@(0x1f22,d0:w:2),d0; jmp pc@(0x1f22,d0:w)` — a 28-case
  jump table on the **element type** (window / scrollbar / menu / …).
  Confirms the table-driven dispatch model (§4.3).
- **Core blit primitive** `0x738–0x7c2`: one routine that calls
  `CopyBits` (`$a8ec`) or `CopyMask` (`$a817`) per a "use-mask" flag
  (`tstb d3` @ `0x77a`), bracketed by fore/back color sets. Fixed pieces
  call it with `srcRect == dstRect`; fills with a 1px-wide srcRect. The
  sample-and-hold scaling is QuickDraw's, per §2.1.

### 8.4 What this means for the compositor (the principled rule)

Replace the heuristic `findStripeColumn` with a recipe walk:

- Walk the side recipe as segments `[border[i], border[i+1])`.
- `p0` = null start (skip).
- A segment's cicn source is its own `[border[i], border[i+1])` x-range.
- At minimum window size, every segment draws 1:1 (reproduces the cicn).
- For a larger window, the **extra span is absorbed by the fill segments**
  (the narrow 1px "side" columns — the `p8` stripe and the `p5/p6`
  divider), each stretched horizontally; **fixed segments** (corners +
  the wide segments that contain baked-in widgets) stay native.
- Centered title behavior falls out: the two `p8` stripe segments
  flanking the center each absorb half the extra, keeping the divider/
  title centered and the widgets pinned to their sides.

### 8.5 Still not nailed to the instruction (low marginal value)

The exact **width-distribution arithmetic** (precise px split when there
are multiple fill segments) and the full **part-code → fixed/fill table**
weren't traced instruction-by-instruction — that's a deep multi-hour walk
through the window-draw case's recipe loop and rect math in 20k lines of
68k. Given §8.1 states the rule and §8.2/§8.3 confirm the structure +
mechanism, the marginal value is low. Revisit only if a scheme renders
visibly wrong on the model above. (If/when needed: emulator golden images
across window sizes would pin the distribution faster than 68k tracing.)

### 8.6 IMPLEMENTED (2026-05-22) — the rule is WIDTH-based, not part-code-based

§8.4 above assumed `p8` IS the narrow 1px stripe and the wide segments are
something else. That holds for the simple corpus (7 Le's pinstripe) but is
**inverted for decorated schemes**, which broke our renderer:

| scheme · edge | `p8` "side fill" segments | `p1` "border" segments |
|---|---|---|
| 1984 · bottom | **48px** (a button cluster — STATIC) | **1px** (the grow column) |
| 1990 · bottom | **13–36px** (camo panels, "1990", star — STATIC) | **1px** (the connecting rods — GROW) |
| evolution · all | mix; wide `p1` (13px) is a baked widget | **1px** `p1` between p18 gradients |

So the part code does **not** reliably say fill-vs-static. The reliable
signal is the one §8.1 actually states: the grow region is a **single row
or column of pixels** — i.e. it is THIN. Everything wider is static art the
author wants preserved (drawn once). Two passages from `Creating Color
Schemes` pin both halves:

> "Normal document windows are drawn by **simply stretching the icon**...
> draws the four corners first, then it draws the edges by **stretching the
> colors along the edge**, and finally fills the inside with the background
> color at the center."

> "When drawing the racing stripe pattern **for utility windows**,
> Kaleidoscope **does not stretch the icon; rather, it tiles the icon**."

**First cut was WIDTH-based** (`STRETCH_MAX = 2`: thin → stretch, wide →
fixed). That fixed 1984/1990 but broke two cases width can't see: a THIN `p8`
that must stay fixed (1138's flat side row — 1px tall, so width said
"stretch", but stretching it gives a flat border instead of the 3D bevel),
and a WIDE uniform `p1` that must stretch (BeOS's 65px bottom border — width
said "fixed", leaving a texture chunk + gradient instead of a clean border).

**Final rule is CONTENT-based — UNIFORMITY along the walk axis**
(`isStretchable`, `STRETCH_UNIFORMITY = 0.9`, `COLOR_TOL = 16`):

- stretching samples ONE line of the segment and repeats it; that is lossless
  iff every line along the walk axis is identical. So **a segment is a GROW
  column iff ≥90% of its walk-axis lines match the sampled (mid) line**;
  anything with cross-axis structure (button row, decoration, stepped bevel)
  is STATIC art → **FIXED**, drawn once.
- `p0` corner and rectList-widget-overlapping segments are always FIXED; the
  title plate grows to the title width.
- growth distributes across the grow columns ∝ native length.
- **`p18` is NOT special-cased.** It was treated as a scalable gradient
  (sample-and-hold the whole segment), but evolution's `p18` segments are
  decorative metallic links + a 59px corner blob coded `p18`, not smooth
  ramps — gradient-scaling smeared the 59px corner and let the wide links hog
  growth from the 1px grow gaps (which then barely stretched). Routing `p18`
  through the same uniformity test fixes both: a vertical ramp is uniform
  (→ stretch, lossless) while structured links/corners are not (→ fixed). Only
  uniform grow columns absorb growth, so evolution's 1px gaps now stretch and
  the links/corners stay native. (If a future scheme needs a genuinely
  scaling horizontal ramp, re-introduce a gradient mode gated on "uniform
  along the CROSS axis" so it's distinguishable from decorative `p18`.)

Probed across the corpus, the separation is clean: grow columns (1138 right
`p1`, BeOS bottom `p1`, 1990/1984 1px `p1`) score 100% uniform; static panels
(1138 right `p8` = 50%, 1990 top `p1` = 20%, 1990/1984 `p8` panels = 3%) score
≤50%. The part code only *approximated* this — in decorated schemes `p1` is
the (uniform) border and `p8` the (structured) panel, the INVERSE of their
names — so neither code nor width is the real signal; uniformity is.

This replaced the per-edge `tileMotif` flag + body-boundary corner heuristics,
which over-tiled wide decorated edges. **Document windows never TILE.**
Validated visually + `diag:audit` on all five themes' document windows (only
BeOS's known trailing-transparent-padding coverage quirk remains).

**Deferred:** (a) utility-window racing-stripe TILING (the doc's explicit
exception); (b) gradient-as-plate flattening on evolution utility windows;
(c) coverage gaps on dialog/alert/side-floating types whose recipes stop
short of the cicn width (same far-corner class as before).

### 8.7 Reproduce

```
unar "Kaleidoscope 1.8.2 Installer.app"        # → Kaleidoscope (cdev)
node tools/theme-loader … dump kDEF 0          # → kDEF_0.bin (60,732 B)
m68k-elf-objdump -D -b binary -m m68k:68000 -EB kDEF_0.bin
# raw wnd# decode: parseResourceFork(scheme.rsrc) → decodeWnd, print true part codes
# the authoring doc: Kaleidoscope Goodies/Creating Schemes/Creating Color Schemes
```

---

## 7. References

- [`docs/aaron-ui-raster-mapping-spec.md`](../aaron-ui-raster-mapping-spec.md) §13 — open-question catalog this disassembly is closing against
- [`docs/aaron-ui-architecture-spec.md`](../aaron-ui-architecture-spec.md) §2-§6 — format model this confirms
- K2 Scheme Reference (in `Kaleidoscope Goodies/`) — period-author documentation
- Apple "Mac OS Runtime Architecture" (1996) — PEF specification
- Apple "Inside Macintosh: Macintosh Toolbox Essentials" — WDEF / CDEF / MDEF protocols + QuickDraw reference
