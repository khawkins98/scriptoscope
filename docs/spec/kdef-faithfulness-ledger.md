# kDEF faithfulness ledger

*The routine→window-engine map + divergences (updated after 0.4.0). For the architecture tour, see [`kdef-architecture.md`](./kdef-architecture.md); for binary lookups, [`kdef231-reference.md`](./kdef231-reference.md).*

A map of the Kaleidoscope **2.3.1** kDEF to the clean-room window engine in
`src/engine/families/window.ts` and `src/engine/tables/window.ts`, the drawing
facade in `src/composeChrome.ts`, and title presentation in `src/renderWindow.ts`.
Scriptoscope does not ship or execute original code as its runtime — this
ledger is how we keep our own code a faithful mimic and make every divergence
*explicit* instead of tribal.

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/kdef-faithfulness-ledger.evidence.md`](engine/kdef-faithfulness-ledger.evidence.md) — spec writers and verifiers only.*

> The routine addresses below are catalogued in the standing
> [`kdef231-reference.md`](./kdef231-reference.md) (§1 routine map). Use that to
> look up what a routine *does* in the binary; use this ledger to see how — and
> how faithfully — the window engine mirrors it.

> **Two-channel resource model (controls) — 2026-05-25.** This ledger covers window
> *chrome* (`composeChrome.ts`). The in-window *controls* live in `controls.ts` and
> follow a rule worth stating once: a negative resource id can carry BOTH a `cicn`
> (body raster) AND an `ics4` (pictogram overlay) with **different roles** — e.g.
> cicn `-10239` is a push-button face, while ics4 `-10239` is a checkbox (on). This
> was the source of repeated checkbox/radio misreads. The full two-channel control
> id→role map is resolved in [`kdef231-reference.md` §2.4](./kdef231-reference.md)
> and rendered live as the pictogram rubric in `demo/diagnostic.html` `iconInventory`.

How to use it:
- **Adding/changing compose logic?** Find the routine here first; the binary address
  is the ground truth (when a render disagrees, a verifier checks it against the listing; see the evidence file).
- **A new glitch appears?** Check the relevant row's "divergence" before patching
  — the cause is usually a routine we approximated or skipped, not a new hack to add.
- **The two automated nets** that keep this honest: `npm run lint:themes` (static
  data-shape checks, pre-render) and `npm run diag:audit` (render-time model
  invariants). Each row notes which net (if any) guards it.

Legend: ✓ faithful · ≈ approximated (render-correct for the corpus) · ✗ deliberately not implemented.

The implementation locations below describe the shipped 0.4.0 architecture.
They do not promote fidelity claims: the requirement-level statuses and limits
in `tests/rendering-requirements/families/window.json` remain authoritative.
The behavioral reference is [window-widgets.md](engine/window-widgets.md).

| kDEF | Role / spec rows | Current implementation | Evidence / remaining boundary |
|---|---|---|---|
| `0x49d6` | Part verdict, PV1–PV9 | `verdictZero` in `engine/families/window.ts`; `PART_VERDICT` in `engine/tables/window.ts` | `window.recipe-rules`; flags use the declared §2.3 defaults. The old `classifyPart` is deleted. |
| `0x4a0c`, `0x4dfe..0x4e42` | Code-10 and too-short negotiation, PV5 / TS1–TS4 | `layoutSide`, `TOO_SHORT` | Negative budgets and dropped titles follow the decoded rows. `negotiateSides` is deleted. Flag-gated obligations remain unknown. |
| `0x4a64` | Layout sums, LS | `layoutSide`, `LAYOUT_SUMS` | Fixed sums, title margins and growers come from the spec. |
| `0x4f58` | Title fit, TT2–TT4 | `layoutSide`, `TITLED_SIDE`; public width defaults in `composeWindowChrome` | DECISIONS #13 supplies SWc = SW because the runtime has no condensed face. The former `plateCap` approximation is deleted. |
| `0x4ff8` / `0x501c` / `0x5034` | Title-side placement, TT5–TT10 | `layoutSide`; `remapWidget` supplies the title rect; `renderWindow.ts` draws the text | Centered plate and remapped title rect replace the old `titleRegion` text centering. Typography follows TX and DECISIONS #13; TC1–TC5/TX7 use raw title samples and the declared substitute-glyph painter. |
| `0x5178` | Allocation, AW1–AW9 | `layoutSide`, `CELL_WIDTH` / `ALLOCATION` | Unclamped signed budgets; code-12 whole tiles and both remainder passes. `distributeSide` / `distributeHalf` are deleted. |
| `0x5356` | Template and placed cell rects, CR1–CR4 | `windowCell`, `CELL_RECT` | Leading and trailing areas outside placed segments stay unpainted (LS9/Q3); the earlier forced leading-corner cell is gone. |
| `0x572e` | Side draw, WD4 | `composeWindowChrome` walks `WINDOW_SIDES`, uses `windowCell` and the engine blit tables | Top, bottom, left, right order with CopyMask. Code 18 uses `scaleBlit`; the other cells use `tileBlit`. `composeEdge` is deleted. |
| `0x632e` → `0x6062`, `0x5cb6` | Widget remap, draw and hit, RM / WD / HT | `windowWidgets`, `remapWidget`, `drawPressedWidget`, `widgetHit`; popup art via `popupRawBlits` | Pressed widgets use the strip and its mask. At-rest close/collapse art stays in the template; partial-zoom full-draw WD5 remains unexercised. RM6 empties widgets in dropped cells. Inactive public buttons stay operable under DECISIONS #12. |
| `0xfeae` | Tile blit | `engine/qd/tile.ts` `tileBlit`, selected by `engine/tables/windowBlit.ts` | Codes 11/14 anchor at the far end; other tiled codes start at the near end. Masked composition and original device/primitive limits remain separately tracked. |
| `0x10320` | Code-18 scaled blit | `engine/qd/scale.ts` `scaleBlit` | Scaling policy is declared in qd-primitives; it does not establish original scaled-pixel fidelity. |
| Structure rect from cicn | Frame/content extent | `frameFromBody`, `drawableExtent` in `composeChrome.ts` | Transparent-tail handling remains a runtime policy guarded by theme lint. |
| Side without recipe | No cell draw | `layoutWindow` / `composeWindowChrome` skip absent sides | No invented seam fill; unpainted screen content is outside the decoded Q3 claim. |

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
  truth — tracked in [#190](https://github.com/khawkins98/scriptoscope/issues/190). The
  structured-fill joints at extreme widths (M5) and the 1984 title-bar arch (V1b)
  live here.
- Original device output beyond the sampled and decoded rule claims, the
  unexercised partial-zoom full-draw branch (WD5), and original-font title pixels.
  Title fitting, widget remapping, pressed-strip drawing and masked hit testing
  are now explicit engine paths checked by the window rule suite.

## Accepted divergences from kDEF / reference (by owner decision)

Each entry below tags its divergence direction explicitly:
- **decode→reference** means "the kDEF / decode says X; the per-scheme reference image disagrees; we follow the decode."
- **manifest→decode** means "the kDEF would have produced a broken render; we override the kDEF by reading the bundle's structured manifest role."

### accessibility→decode

- **The `accessibility→decode` direction:** the decode says X, and we deliberately do Y so the page stays usable with a keyboard and assistive technology. Each entry names the rule, what we do instead, and why.
- **Title-bar widgets on inactive windows stay operable** (maintainer decision 2026-10-22, [DECISIONS #12](../v2/DECISIONS.md)).
  - **The decode:** `engine/window-widgets.md` HT2 says the original window definition does not hit-test widgets on an inactive window. A click on a background window's close, zoom or collapse box only activates the window.
  - **What we do:** the engine implements HT2 as decoded, and the trace records it. But `renderWindow` and the declarative layer keep each widget a real, focusable button on inactive windows too. It can be clicked, and reached and activated from the keyboard.
  - **Why:** on the web a window is a region of the page, not the frontmost app window. Making a background window's controls inert would take them out of the tab order and away from screen readers, for no visual gain. Keyboard and assistive-technology users would have to activate a window before they could close it.
  - **Scope:** this only covers whether the widget responds. What the widgets look like still follows the decode: at rest, close and collapse art is part of the window's own (active or inactive) template pixels; the only widget draw gated on the active state is the partial-zoom widget (WD5) (WD rows). Any visual or behavioural change beyond keeping the button operable needs its own entry here.

### decode→reference

- **Scroll-arrow id→state mapping is the 2.3.1 CDEF's, applied universally.** The
  shared CDEF (no per-scheme control template exists) fixes RAISED/normal =
  `-10201..-10204`, PRESSED = `-10197..-10200` (`0x9f0e..0x9f38`; see
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

- **Document proxy icon + modified-document marker (2.3.1 only).** The 2.3.1 kDEF
  imports `WindowsLib::GetWindowProxyIcon` + `IsWindowModified` and pairs them with
  `IconServicesLib::PlotIconRef` to draw a 16x16 document icon at the leading edge
  of the title bar (call sites: `0x22c08`/`0x22c18` and `0x2312c`/`0x2313c`; full
  decode in `docs/spec/proxy-icon-modified-dot.md`). The kDEF gates the path on the
  scheme shipping a `wind` resource for the current window kind. **Zero of 18 corpus
  bundles ship a `wind` resource**, so the gate is closed for every scheme we host.
  We do not implement the proxy icon, the modified-document dot, or the
  `kThemeWidgetDirtyCloseBox = 6` close-box variant. 1.8.2 doesn't import either
  symbol — this is a strict 2.3.1 addition. (Owner decision 2026-05-29.)

### manifest→decode

- **Push-button role/anti-role/state fallbacks are compatibility policies.**
  The original 2.3.1 dispatch at `0x7572..0x7594` selects numeric cicn IDs
  `-10239` / `-10238` / `-10240`. Scriptoscope prefers structured manifest
  keys, rejects resources heuristically labeled for unrelated roles, and tries
  state/base fallbacks before its last-resort numeric lookup. These corpus-wide
  policies handle Animals/Monkey repurposed active slots; they are not proven
  original-engine fallback rules or proof of author intent. Actual selection
  diagnostics are tracked in [#226](https://github.com/khawkins98/scriptoscope/issues/226).

- **Disclosure triangles: only the canonical state ids are evidence; the rest is compatibility policy**
  ([#595](https://github.com/khawkins98/scriptoscope/issues/595)).
  - **What the evidence supports:** `composeDisclosure` (`src/controls.ts`) resolves signed cicn ids first: right `-10111` normal, `-10110` pressed, `-10112` inactive; down `-10103` normal, `-10102` pressed, `-10104` inactive. The family range is in [kdef231-reference §2.6](./kdef231-reference.md). The per-state mapping comes from the corpus author labels (`corpus-author-labels.json`: 1138, animals, beos-r503, 1990, dolphin-som, evolution, 1984, floppies, crayon-os), not from a decoded disclosure dispatch.
  - **Compatibility policy, not decode:**
    - A missing pressed or inactive triangle reuses the same direction's normal triangle. crayon-os ships only `-10111`/`-10103`.
    - Named keys and apple-platinum-2's positive ics4 ids 3060/3061 are tried next.
    - With no triangle at all, the caller draws the Platinum one.
  - **What remains unproven:** none of these fallbacks is a proven original-engine rule.

- **Default-ring destination expansion is four pixels.** Original
  `InsetRect(-4,-4)` at `0x7698..0x76a2` expands the control rectangle before
  ring painting. #219 replaced the former ring/face-size heuristic with this
  independently sourced geometry. The complete raster supplies square corners
  and independently thick bands; its dimensions do not determine the outset.
  Reserving the same footprint for plain buttons is a separate runtime alignment
  policy. Pressed ring `-10230` falls back to active `-10231`; inactive uses
  `-10232` (`0x76b8..0x770e`). See `composeButton` in `src/controls.ts` and
  the source-coordinate contracts in `tests/rendering-options/source-oracles.spec.mjs`.

- **Push-button font sizing remains a runtime policy.** The raster size is
  `max(8, round(resolvedHeight × 0.6))`, after automatic-height resolution and
  a standard-height retry when an automatic tiny face cannot contain its label.
  Explicit heights remain authoritative. This policy is not independent proof
  of the original Control Manager's font metrics, colors or label placement.
  Current glyph-ink tests verify their stated retention requirements; they do
  not certify the complete original typography. See
  [the fidelity plan](./fidelity-verification-plan.md) and
  [epic #221](https://github.com/khawkins98/scriptoscope/issues/221).

## References
- `compositor-spec.md` — the model these routines implement.
- `kdef231-recipe-walk.md` — the part-code / draw decode (the source behind the spec).
- `glitch-punchlist.md` — the running render-quality status per scheme.
