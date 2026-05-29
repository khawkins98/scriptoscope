# kDEF faithfulness ledger

*The routine→`composeChrome.ts` map + divergences. For the architecture tour, see [`kdef-architecture.md`](./kdef-architecture.md); for binary lookups, [`kdef231-reference.md`](./kdef231-reference.md).*

A one-to-one map of the Kaleidoscope **2.3.1** kDEF (the decompiled 68k WDEF at
`/tmp/kaleido-trace/kDEF231_0.asm`) to our clean-room reimplementation in
`src/composeChrome.ts`. We do **not** ship or execute the original code — this
ledger is how we keep our own code a faithful mimic and make every divergence
*explicit* instead of tribal.

> The routine addresses below are catalogued in the standing
> [`kdef231-reference.md`](./kdef231-reference.md) (§1 routine map). Use that to
> look up what a routine *does* in the binary; use this ledger to see how — and
> how faithfully — `composeChrome.ts` mirrors it.

> **Two-channel resource model (controls) — 2026-05-25.** This ledger covers window
> *chrome* (`composeChrome.ts`). The in-window *controls* live in `controls.ts` and
> follow a rule worth stating once: a negative resource id can carry BOTH a `cicn`
> (body raster) AND an `ics4` (pictogram overlay) with **different roles** — e.g.
> cicn `-10239` is a push-button face, while ics4 `-10239` is a checkbox (on). This
> was the source of repeated checkbox/radio misreads. The full two-channel control
> id→role map is resolved in [`kdef231-reference.md` §2.4](./kdef231-reference.md)
> and rendered live as the pictogram rubric in `demo/index.html` `iconInventory`.

How to use it:
- **Adding/changing compose logic?** Find the routine here first; the asm address
  is the ground truth (verify against it when a render disagrees).
- **A new glitch appears?** Check the relevant row's "divergence" before patching
  — the cause is usually a routine we approximated or skipped, not a new hack to add.
- **The two automated nets** that keep this honest: `npm run lint:themes` (static
  data-shape checks, pre-render) and `npm run diag:audit` (render-time model
  invariants). Each row notes which net (if any) guards it.

Legend: ✓ faithful · ≈ approximated (render-correct for the corpus) · ✗ deliberately not implemented.

| kDEF | Role | Our impl (`composeChrome.ts` unless noted) | Status | Verified by | Divergence / notes |
|---|---|---|---|---|---|
| `0x49d6` | Part-code → stretch-flag jump table | `classifyPart` | ✓ | `diag:audit` code→mode | — |
| `0x4a0c` | Code-10 returns the **caller's** flag (stretches iff title-fits set) | `classifyPart` → `fixed` | ≈ | render (1138 utility, 1984 doc) | We classify 10 as FIXED. Render-correct: corpus code-10 cells are label-less (flag false) or over a uniform bar (fixed≡stretch). Full gating needs the per-edge title-fits flag + the widget pass. |
| `0x4a64` | Layout precompute: walk borders, measure title width (QuickDraw text traps → `fp@(-2)`), sum fixed-cell widths, per-half stretch-capacity flags (`fp@(-18)`/`-20`) | `distributeSide` / `distributeHalf` | ✓ | recipe-walk doc; render | — |
| `0x4f58` | Title-fits gate (collapse the 5/6 bezel when the title doesn't fit) | `distributeSide` plate clamp + `plateCap` | ≈ | render (1138 plate) | Approximated: we grow the code-5 cell to the measured title width capped at `plateCap`, rather than a hard fits/doesn't-fits branch. |
| `0x4ff8`/`0x501c`/`0x5034` | Title centring + title-cell DEST span | `distributeSide` (code-5 grow), `renderWindow.ts` (text at `titleRegion` centre) | ✓ | render (beos/1990 title placement) | Horizontal. VERTICAL anchor follows the title-text MARKER's y-band (`0x5530`): `composeChrome` → `titleRegion.midY`, `renderWindow` draws there (else `frame.top/2`). Fixes tall ornate bars (evolution); `lint:themes` `title` rule guards it. |
| `0x5178` | Growth distribution — budget ÷ stretch cells, EVEN, remainder L→R; symmetric about the title (per-half) | `distributeSide` / `distributeHalf` | ✓ | render (1990 asymmetric left-third title) | — |
| `0x5356` | Placement: segment *i* SRC = `[border[i-1], border[i])` (END-based); leading `[0,border[0])` = fixed corner | `recipeCells` (end-based; index-0 cell forced fixed) | ✓ | render (1138/1984 hatch alignment) | Off-by-one here was the original tile regression — now grounded in the asm. |
| `0x572e` | Main draw loop — walks segments, never touches the rect-list (`a4@1938`) | `composeEdge` draw loop | ✓ | render | — |
| `0x5ffc` → `0x5ddc` | **Separate** rect-list widget-draw pass (close/zoom/shade), called from the draw dispatch | — | ✗ | `diag:audit` widgets; `lint:themes` (no widget in a stretch cell) | **Deliberate divergence.** We don't run a second pass; the widgets ride the FIXED title-bar cells they sit in (drawn 1:1 by the edge walk). Holds *only* while no widget lands in a growing cell — both nets guard that assumption. |
| `0xfeae` | Default blit — **always TILES** the src cell across the dst | `composeEdge` tile path (`drawFill`/tile) | ✓ | recipe-walk Q5; render (no smear) | `cinf.tileSides` does NOT gate this (corrected from an earlier draft). A 1px src band ⇒ uniform fill. |
| `0x10320` | Code-18 — a single **scaled** CopyBits (drawn once, src→dst) | `composeEdge` `cls === 'scale'` branch | ✓ | render (evolution/beos pipes) | The only scaled blit; everything else tiles. |
| structure rect from cicn | (Mac WDEF wCalcRgns: structure = content + border insets) | `frameFromBody` + `drawableExtent` | ✓ (fix) | render (beos) + `lint:themes` tail note | **Divergence we corrected:** the structure extent is the cicn's *drawable* extent (mask/last-opaque), not its raw resource bounds. A transparent tail past the art is slack, not window. Fixed beos's 22px→5px right inset. |
| — | Inset on a side with no recipe | `composeWindowChrome` (composes an edge only if its side-list exists) | ✓ | `lint:themes` norecipe note | The kDEF draws no segments for a recipe-less side; we don't fake-fill (the old `composeSeamFallback` override is retired). Expected for collapsed/topless types. |

## Data-shape assumptions (enforced by `lint:themes`)

The kDEF assumes its inputs are well-formed; these are the assumptions, each tied
to a bug class we hit reactively before the linter existed:

- **drawable extent** — a frame cicn may carry a transparent tail past its art;
  insets must be sized off the drawable extent, not raw bounds. *(beos doc-window.)*
- **body in bounds** — part-0 (content rect) sits inside the drawable extent on a
  full type; an overrun = wnd#↔cicn mispairing. Collapsed types reuse the full
  body rect intentionally (inset clamps). *(1138 grow-box pairing.)*
- **top/bottom recipe spans the width** — a corner-to-corner edge should reach the
  drawable width; ending short leaves frame art undrawn. Left/right recipes cover
  only the content-height middle and are NOT span-checked. *(beos signature.)*

## What no automated net catches yet (still eyeball-only)

- Pixel-exact fidelity to the **reference images** — there is no golden render-vs-
  reference diff yet (the "Layer 2" net), and it's blocked on trustworthy ground
  truth — see [golden-reference-todo.md](golden-reference-todo.md). The
  structured-fill joints at extreme widths (M5) and the 1984 title-bar arch (V1b)
  live here.
- Anything requiring the **per-edge title-fits flag** or the **widget-draw pass**
  we skip — guarded only indirectly (corpus has no widget in a growing cell).

## Accepted divergences from kDEF / reference (by owner decision)

Each entry below tags its divergence direction explicitly:
- **decode→reference** means "the kDEF / decode says X; the per-scheme reference image disagrees; we follow the decode."
- **manifest→decode** means "the kDEF would have produced a broken render; we override the kDEF by reading the bundle's structured manifest role."

### decode→reference

- **Scroll-arrow id→state mapping is the 2.3.1 CDEF's, applied universally.** The
  shared CDEF (no per-scheme control template exists) fixes RAISED/normal =
  `-10201..-10204`, PRESSED = `-10197..-10200` (`kDEF231_0.asm:9f0e-9f38`; see
  kdef231-reference §2.4 "Scroll-arrow ics4 family" and `controls.ts composeScrollbar`).
  **platinum-8** is a 1998/Kaleidoscope-1.x scheme that placed its arrow art the other
  way (its preview shows the flat `-10198` at rest, our universal mapping draws its
  boxed `-10202`). We follow the 2.3.1 decode rather than the 1.x-era scheme preview —
  faithful to the engine, divergent from that one scheme's shipped image. s7-nostalgia-
  silver + apple-platinum-2 match the 2.3.1 convention. (Owner decision 2026-05-26.)

- **Segmented On/Off uses the literal pressed + active cicns the bundle ships,
  even when the two are visually disjoint.** 1984's `push-button-pressed`
  (-10238) is a WHITE 3D-bevel face; its `push-button-active` (-10239) is a
  BLUE gradient face. Rendered as a 2-segment toggle (demo's Options dialog),
  "On" (pressed) reads white and "Off" (active) reads blue — a stark split that
  visibly diverges from the reference image's more uniform segmented treatment.
  The reference image was hand-composed for the scheme's docs; the kDEF
  dispatched on button STATE independently and blitted whatever cicn the
  artist authored for that state. We follow the decode: a per-theme override
  would have to special-case 1984 (and any future author who chose the same
  light-pressed convention), which is the per-theme branch we reject by policy.
  (Owner decision 2026-05-29.)

### manifest→decode

- **Push-button face resolves by manifest role name first, then by id.** The 2.3.1
  kDEF asked for cicn id `-10239` (active) / `-10238` (pressed) / `-10240` (inactive)
  and blitted whatever sat there. Two corpus bundles — **monkey-paradise** + **animals**
  — repurpose id `-10239` for `solo-menu-background-2` and ship no active push-button
  cicn at all (only pressed + inactive). A faithful runtime would render menu wallpaper
  in the OK button slot for both schemes. Instead, `loadPushButtonFace` (`src/controls.ts`)
  reads the manifest's STRUCTURED chromeElement key (`push-button-active` /
  `active-push-button` / `active-button` / `push-button`) first; falls back to id-based
  lookup that REJECTS anti-role keys (`/menu|tab-pane|pull-down|popup|window|dialog|scroll/`);
  finally, when no active face exists, substitutes the pressed face (the AppearanceManager's
  documented "empty state slot" fallback). Codex pattern: the manifest carries the
  structured answer, the runtime was guessing from an id collision. The fix is a
  CORPUS-WIDE policy — no per-bundle slug branch — preserving the "never hack the
  compositor for one theme" norm in CLAUDE.md. (Owner decision 2026-05-29; previously
  deferred in LEARNINGS as "non-canonical authoring".)

- **Default-button ring outset reads the author-shipped cicn, not Apple's
  standard `kThemeMetricFocusRectOutset = 4 px`.** Two models:
    - OUTSET: `outset = (ring.width − face.width) / 2` when the artist drew the
      ring larger than the face (crayon-os: 80 ring around 74 face → 3 px).
    - OVERLAY: `outset = max(3, round(ring.width / 4))` heuristic when ring ≤
      face (apple-platinum-2, beos-r503, etc.).
  Plain (non-default) buttons reserve the same outer rect so a row of default
  + plain buttons aligns. Rationale: the ring is shipped art (cicn -10231
  active / -10232 inactive); the cicn IS the author's declared outset; Apple's
  4 px metric is the standard-metrics fallback when no ring ships. References:
  `src/controls.ts:1034-1057` + `docs/spec/apple-cdef-button-vs-our-compose.md`
  row 2 + Apple `kThemeMetricFocusRectOutset` per `apple-primary-source.md`.
  (Owner decision 2026-05-29.)

- **Push-button label size is `max(8, round(faceHeight × 0.6))`, not Apple's
  fixed `kThemeSystemFont = 12 pt`.** Rationale: corpus authors shipped faces
  ranging 16 → 74 px tall (apple-platinum-2 ring 16 px through crayon-os
  74 px). A fixed 12-pt size would either overflow short buttons or look
  comical on tall faces. The 0.6 ratio yields 12 pt for the canonical 20-px
  button (Platinum match) and scales gracefully elsewhere. References:
  `src/controls.ts:990` + `docs/spec/apple-cdef-button-vs-our-compose.md`
  row 5 + Apple `kThemeSystemFont` per `apple-primary-source.md`.
  (Owner decision 2026-05-29.)

## References
- `compositor-spec.md` — the model these routines implement.
- `kdef231-recipe-walk.md` — the part-code / draw decode (the source behind the spec).
- `glitch-punchlist.md` — the running render-quality status per scheme.
