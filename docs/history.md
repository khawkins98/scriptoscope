# Scriptoscope (formerly Aaron UI) — project history

*Project arc + dead-ends. This records how the runtime got here and what NOT to relitigate — it is **not** the authority on how the runtime works today. For that, see [`spec/kdef-architecture.md`](./spec/kdef-architecture.md) (design) and the code + [`spec/compositor-spec.md`](./spec/compositor-spec.md) (model).*

> **2026-05-28 pivot logged: project renamed Aaron UI → Scriptoscope** for the first npm publish (the `aaron-ui` package name was already taken on npm by an unrelated Vue avatar component, which became the forcing function for the rename two prior decisions had explicitly deferred). The narrative below uses "Aaron UI" because that's what the project was called when each event happened — preserved as the historical record. Internal API surface (`data-aaron-*` attributes, `.aw-*` CSS classes, `AaronWindow` class) stays stable across the rebrand on the Lodash-kept-`_` model. Full rationale: `LEARNINGS.md` 2026-05-28 "Scriptoscope pivot" entry. The original 2026-05-16 "Aaron UI" naming entry there is marked superseded.

How the window-chrome renderer got to where it is. Written for the next person
(or the next us) so the dead ends don't get re-walked. ~274 commits, 2026-05-16
to 2026-05-23.

> If you read one section, read **[Dead ends — don't relitigate](#dead-ends--dont-relitigate-these)**. Most of the
> hard-won progress was *deleting* a plausible-but-wrong idea.

## Pre-history — why this exists at all

The proximate trigger was the [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac)
Mac OS 8 Platinum chrome layer hitting a structural ceiling against WinBox: ~70% of the gap was
CSS work in cv-mac's own court, ~15% a thin shell layer, but ~30% of the remaining authenticity
was the window manager itself (fixed DOM hierarchy, scrollbars-inside-body geometry, no slot for
the windowshade arrow, drag with web-style acceleration). The honest move was to own one.

But the *deeper* origin is a recurring frustration across earlier "modern web utility, classic-OS
look-and-feel" experiments — each of which arrived at the same lesson from a slightly different
angle, then walked away because the cost-benefit didn't justify finishing the chrome by hand:

- **[PDF-A-go-actionable](https://github.com/khawkins98/PDF-A-go-actionable#visual-design)** — a
  NeXTSTEP-styled PDF utility. The "Visual design" notes catalogue the by-hand CSS grind to
  *approximate* NeXT chrome and how quickly the result diverges from the real thing the moment
  you zoom in. You can fake the buttons; the *system* of buttons-radios-scrollbars-windows is
  another order of work.
- **[PDF-A-go-slim](https://github.com/khawkins98/PDF-A-go-slim#why-it-looks-like-that)** — same
  impulse, classic-Mac flavour. The "Why it looks like that" section says the same thing from a
  different angle: hand-authored chrome is tedious to build, never quite right, and rots the
  moment you reach for a control you haven't drawn yet — there's always one more thing.
- **["The 90s desktop paradigm for browser utilities"](https://www.allaboutken.com/posts/20260216-90s-desktop-paradigm-browser-utilities/)**
  — the longer essay that pulls those experiments together. A web utility *as a windowed desktop
  app* is a richer, more legible UX than a single-flow page (the desktop metaphor still organises
  thought better than scroll-and-tab does), but only if the chrome is authentic — and authentic
  chrome is something you **render from the original art**, not redraw in CSS.

That synthesis — *render from the original art* — is what made this project tractable where the
predecessors stalled. Read the OS's own resource files (`cicn`, `ppat`, `wnd#`, `cinf`) once,
faithfully replay the engine that drew them, and every utility downstream gets the look for free.
No per-project CSS Platinum. No per-project drift. The rest of this document is the saga of
getting that "replay the engine" part right.

## What we're trying to do

Render classic **Kaleidoscope** schemes 1:1 in the browser — windows, controls,
the whole HIG — driven *entirely* by each scheme's own resources (`cicn` artwork,
`wnd#` layout recipe, `cinf`/`Colr` metadata). No hand-authored CSS chrome, no
per-theme special-casing. A scheme is data; the renderer is a faithful, general
replay of the engine that originally drew it (the Kaleidoscope **kDEF**, a 68k
`WDEF`). Get the engine right once and every scheme renders for free.

The discipline that took us a week to learn: **be faithful to the decoded engine,
and when a render is wrong, fix the *interpretation* — don't bolt a compositor
heuristic on top of a misreading.** Almost every heuristic we ever added was later
deleted once we understood what the binary actually did.

## The journey

### Phase 0 — Deconstruction & a first principle (May 16)
Scaffolding, a North Star ("framework-agnostic, declarative-first, spec-faithful"),
and a deconstruction spike on two mass:werk schemes. Built the first
`scheme-extractor` (`cicn`/`ppat` → PNG) and a raster-fidelity demo. The first
durable lesson landed here: **never guess `border-image-slice` — decode the `cicn`
first.** Guessing geometry was already the enemy.

### Phase 1 — The window manager (May 17)
A real WM: `AaronWindow`, WinBox-style API parity, drag/resize/z-order/focus, a
declarative `[data-aaron-window]` scanner, ARIA + focus-trap, an e2e suite, GH
Pages. Then the decisive **pivot: drop hand-authored Platinum, become a
Kaleidoscope-compatibility runtime.** The WM stayed; the chrome became data-driven.

### Phase 2 — First rendering attempts, and a methodology reset (May 17–18)
`theme.json` schema + validator, `loadTheme`, `cinf`-driven 9-slice, `ppat`
overlays, `wnd#` part-rect positioning. We tried 9-slice, then CSS `border-image`
3-slice, then per-side thickness sampled from pixels, then a classifier dispatch —
each a reaction to the last one's glitch. After three reactive PRs we stopped and
wrote a **rendering gap analysis ("methodology reset")**. The key realization,
arrived at the hard way: **`wnd#` entries are slice markers, not render commands**
(we reverted a whole "Phase 4" built on the opposite assumption).

### Phase 3 — The "faithful" composer & binary archaeology (May 18–19)
Converged on a single `composeKaleidoscopeFaithful`, a "tile at native size, never
stretch" period principle, corner-overlap rules, a three-layer architecture spec,
and CSS/cicn controls. We disassembled the kDEF for the first time — **but it was
the 1.8.2 binary**, which predates the `wnd#` recipe model. We didn't know that
yet; it sent us looking for a recipe-walk that wasn't in that binary.

### Phase 4 — v2 clean break: own the pixels (May 19–21)
A hard reset: blanked `src/`, kept the artifacts, rebuilt as a **pixel compositor
— a faithful QuickDraw replay in our own engine** (not CSS approximations). This is
where the real model started to emerge: the **title-plate breakthrough** (the plate
*grows to the title width*, it's a size-driver), grow regions *tile* rather than
stretch, a two-pass render (stretch background, then stamp widgets), and a whole
diagnostic layer — the slice **placement map**, headless `render-window` /
`audit-placement` CLIs, and the interactive **Window Playground**. We were de-
hacking constantly ("walks ALL FOUR edge recipes — root-cause, not patch").

### Phase 5 — The version breakthrough & the v3 reset (May 22)
We were tuning *uniformity-based* stretch-vs-fixed heuristics and pixel-scoring the
title plate — increasingly elaborate guesses. Then the **breakthrough: we'd been
decoding the wrong kDEF version (1.8.2, not 2.3.1).** The 2.3.1 kDEF *is* the engine
our K2 schemes use, and it has the real **part-code jump table**. A WIP rewrite
around it rendered garbled (parked, reverted to the recognizable render), then
clicked: **classify each cell by the 2.3.1 part-code table.** That became the
`compositor-spec.md` and the **v3 foundation** — the renderer rebuilt around the
part codes instead of around pixel heuristics.

### Phase 6 — v3: get the interpretation right, watch the hacks fall away (May 22–23)
With the real jump table in hand, every remaining heuristic turned out to be
compensating for a *misread* of the binary. As each interpretation was corrected
against the decompiled `kDEF231_0.asm`, the corresponding hack became dead code:
- **tile, don't stretch** the default blit (`0xfeae` always tiles);
- **end-based** cell↔part-code association (`0x5356`: cell *i* = `[border[i-1],
  border[i])`) — fixing the off-by-one that had been smearing ornaments;
- **corners are intrinsic** (the segment loop starts at index 1, so `[0,border[0])`
  is the fixed leading corner) — retired the `cornerSize`-split heuristic;
- with those right, **widget carving + the second stamping pass became dead code**
  (widgets land in fixed title-bar cells and draw 1:1) — ~90 lines deleted;
- the **title plate** sized from the measured title width (`0x4a64`), title text
  placed on the title *region*;
- **recipe-less edges draw nothing** (the kDEF draws no segments for a side with no
  side-list) — retired the fake-fill fallback;
- the **structure rect is the cicn's *drawable* extent**, not its raw bounds — a
  transparent tail past the art isn't part of the window (fixed beos's 22px→5px
  right border and its bottom-right corner gap).

The compositor got smaller and *more* correct at each step. That's the signature of
fixing interpretation rather than symptoms.

### Phase 7 — Stop being reactive (May 23)
Every glitch above was found by a human eyeballing a render. To get ahead of them
without re-shipping or executing the original 68k code (we keep a **clean-room,
API-compatible mimic**), we added two nets:
- **`npm run lint:themes`** — static, pre-render checks of `theme.json` + `cicn`
  against the kDEF's structural assumptions (drawable-extent tail, body-in-bounds,
  top/bottom recipe spans the width, recipe-less insets). Each rule maps to a real
  bug class we'd hit. Baseline: 0 errors, 0 warnings, documented notes only.
- **`docs/spec/kdef-faithfulness-ledger.md`** — a routine-by-routine map of the
  kDEF to our code, marking each ✓ faithful / ≈ approximated / ✗ deliberately
  skipped, with how it's verified and the divergences in writing.

A third net — a golden render-vs-reference diff — is deferred because our reference
images aren't a trustworthy oracle (see `golden-reference-todo.md`).

## The architecture we landed on

**Inputs (used together).** Per window type: a `cicn` (the minimum-window template
bitmap), a `wnd#` (a rect-list of named widget/body rects + four side recipes, each
a list of `(partCode, border)`), and `cinf`/`Colr` (colors + geometry hints).

**The compose pipeline** (`src/composeChrome.ts` → `composeWindowChrome`), a clean-
room replay of the 2.3.1 kDEF:
1. **Drawable extent** — size the structure to the cicn's last opaque col/row, not
   its raw bounds (`drawableExtent`).
2. **Frame insets** from the body rect vs that extent (`frameFromBody`).
3. **Classify** each recipe cell purely by its part code (`classifyPart`, the
   `0x49d6` jump table): fixed / stretch / tile / scale / collapse.
4. **Walk** each side end-based, with the fixed leading corner intrinsic
   (`recipeCells`, `0x5356`/`0x4a64`).
5. **Distribute** the slack evenly across stretch cells, symmetric about the title
   (per-half) (`distributeSide`, `0x5178`).
6. **Blit** each cell: tile by default (`0xfeae`), single scaled CopyBits for code
   18 (`0x10320`); the title plate grows to the measured title width (`0x4a64`).
7. **Title text** is drawn separately, centered on the title region (`renderWindow.ts`).

No per-theme branches. Widgets ride the fixed cells they sit in (we don't replicate
the kDEF's separate widget-draw pass — a documented divergence that holds while no
widget lands in a growing cell).

**The detection layer:** `lint:themes` (static data shape) + `diag:audit` (our
model's own invariants) + the faithfulness ledger (intent & divergences) + the
diagnostic CLIs/Playground (manual inspection). Golden-vs-reference is the missing
piece, blocked on ground truth.

## Dead ends — don't relitigate these

- **CSS `border-image` / 9-slice for chrome.** Schemes aren't 3- or 9-sliceable;
  the recipe has many cells with per-cell behavior. We own the pixels instead.
- **Stretching fill regions.** The kDEF *tiles* (`0xfeae`); stretching smears
  textures. Only code 18 scales.
- **Deciding stretch-vs-fixed by pixel uniformity or cell width.** It's the **part
  code**, full stop. The uniformity model was a long, plausible detour.
- **Start-based cell↔part-code association.** It's **end-based** (`0x5356`). The
  off-by-one masqueraded as a dozen unrelated glitches.
- **A `cornerSize` heuristic / a separate corner-split.** Corners are intrinsic to
  the walk (the leading `[0,border[0])` region).
- **Carving widget rects out of fill cells + a second stamping pass.** Dead once
  the corners and end-based walk were right — widgets ride fixed cells.
- **Faking a fill on a recipe-less edge.** The kDEF draws nothing there.
- **Sizing the frame off the raw cicn bounds.** Use the drawable extent.
- **Decoding kDEF 1.8.2.** Wrong engine for K2 schemes — use **2.3.1**.
- **Executing the original kDEF as our runtime** (e.g. an emulator-as-oracle). We
  keep a clean-room mimic; the binary is for *understanding*, not shipping.

## Map of the docs
- `spec/kdef-architecture.md` — **start here for "how does it work?"** The runtime architecture tour: subsystems, the compose pipeline, and how a `wnd#` recipe maps to a drawn window.
- `spec/kdef231-reference.md` — **start here for "where is X?"** The standing 2.3.1 kDEF reference: a lookup rubric of routine addresses, resource ids, struct offsets, and coordinate mappings. It indexes the docs below.
- `spec/compositor-spec.md` — the authoritative chrome model (the implemented consumer).
- `spec/kdef231-recipe-walk.md` — the part-code / draw decode (the deep derivation behind the reference + spec).
- `spec/kdef-faithfulness-ledger.md` — routine → our impl, with divergences.
- `spec/glitch-punchlist.md` — per-scheme render-quality status.
- `spec/golden-reference-todo.md` — the deferred golden-diff net + its blocker.
- `diagnostic-tooling.md` — the Playground + `diag:render` / `diag:audit` CLIs.
- `kaleidoscope-asset-catalog.md`, `porting-a-kaleidoscope-scheme.md`,
  `theme-bundle-layout.md` — reference material. (The old 1.8.2-era
  `kdef-layout-recipes.md` was retired 2026-05-23 — folded into
  `spec/kdef231-reference.md §2.6` + the asset catalog's Platinum-fallback §6.1.)
