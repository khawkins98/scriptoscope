# Apple CDEF -1 (button family) vs. our `composeButton` / `composeFaceButton` — cross-check audit

*Audit-only. No runtime changes. 2026-05-29.*

This file cross-references the runtime button-compose path
(`src/controls.ts:composeButton` / `composeFaceButton` / `loadPushButtonFace` /
`baselineButton`, `src/platinum.ts:platinumButton`) against the on-disk
Apple-side decompile in `.scratch/iso-recon/code-out/CDEF-n1.asm`.

## Headline (read this first)

**`CDEF-n1.asm` is NOT the button CDEF.** The 40 KB disassembly extracted into
`.scratch/iso-recon/code-out/CDEF-n1.asm` (3172 B binary; header `'CDEF' 0x0001
000b`, dispatch table @ `0x5a`) is a **second track / scroll-bar / slider /
indicator proc** — a sibling of `CDEF -63` — not the multi-kind button family.
This is the load-bearing finding of `docs/spec/apple-cdef-button-geometry.md`
§0 (May 2026), and `docs/spec/platinum-controls-decode.md` §"Headline" item 1
re-confirms it. Spot-check (this audit): the resource header at
`CDEF-n1.asm:0x0` matches, and the dispatch table at `0x5a` matches the
prior-findings table verbatim (12 × int16, msg 0 → `0x0f4` drawCntl, etc.).

What that means for this audit:

1. The **part codes** the resource tests/returns are `20`/`21`/`22`/`23`/`129`
   (`kControlUpButtonPart` / `kControlDownButtonPart` / `kControlPageUpPart` /
   `kControlPageDownPart` / `kControlIndicatorPart`) — NOT `10`
   (`kControlButtonPart`), `11` (`kControlCheckBoxPart`), `12` (radio), `14`
   (popup), etc. (`CDEF-n1.asm:0x4ac`/`0x4ba`/`0x504`/`0x508`/`0x4de`.) A
   button CDEF would expose `kControlButtonPart` (10); none of the per-part
   sites in this binary do.
2. The proc's **value→pixel math** (`muluw`/`divuw` mapping
   `contrlValue` across `[contrlMin..contrlMax]` at `0x42a`–`0x436` and
   `0x5fc`–`0x5fe`) is the proportional-indicator signature: it positions a
   thumb across a track. Buttons have no min/max/value.
3. The pixel data is eight inline 16×16 1-bit `pixPat` blocks at `0xaac` →
   `0xbe6` (§(d) of the prior findings) — scroll-bar/slider track + thumb
   textures, not button bevel art.

**Consequence:** every row in the audit table below is, on Apple's side,
either **Open (not traceable in this corpus)** or sourced from a sibling
primary source (`CDEF -63`, AppearanceLib, `cctb` id=0, the WDEF 125 raised-
bevel model, or Apple's `Controls.h` / Inside-Macintosh standard metrics). We
do **not** treat `CDEF-n1.asm` constants as authority on button geometry
anywhere in this doc. The genuine button CDEF (kinds 21/129/16/4 dispatching
on `kControlButtonPart` / `kControlCheckBoxPart` / `kControlRadioButtonPart` /
`kControlPopupButtonPart`) is **not present in `.scratch/iso-recon/code-out/`**
and would need to be re-extracted from a different scheme/system before any
button-side row could move out of Open.

This finding is already on the ledger (`platinum-controls-faithfulness-ledger.md`
rows "push button / default ring / bevel button / checkbox / radio / popup /
tab" all status `could-NOT-pin (TODO)`) and in
`platinum-controls-decode.md`'s could-NOT-pin #5 ("Button-family geometry has
no decodable source — `CDEF -1` decoded to another track proc; no button CDEF
in the corpus").

## Audit table

| # | Aspect | Apple CDEF -1 says | Our runtime does | Divergence | Action |
|---|---|---|---|---|---|
| 1 | **Push-button face inset arithmetic** (procedural / no-cicn path) | **Open.** `CDEF-n1.asm` is the track family — its only inset constants are scroll-bar idioms (`0x11b6`-style cap = thickness+3 on the `-63` sibling; no equivalent in `-1`). No `kControlButtonPart`(10) draw routine exists, so no bevel/inset constant for a push-button face is decodable here. Apple's real answer lives in (a) `Controls.h` `kThemeMetricPushButton*` (TextHeight 12; Frame outset = 0; default-ring focus = `kThemeMetricFocusRectOutset` 4 per Inside-Macintosh / Appearance) and (b) the un-decoded vtable method at AppearanceLib `+0xCC` (`apple-appearancelib-spike.md`). | **`composeFaceButton`** (`src/controls.ts:943`–`992`) reads the cinf's `slice.corner` / `slice.side` per-bundle (`src/controls.ts:953`–`955`), falling back to a `sliceInset` heuristic (`src/controls.ts:9`–`12`: `max(2, floor((min(w,h)-3)/2))`). **`baselineButton`** (`src/controls.ts:1242`–`1264`) uses CSS `padding: '3px 16px'`, `borderRadius: '10px'`; **`platinumButton`** (`src/platinum.ts:187`–`202`) uses fixed `h = 20`, `padX = 12`, `minWidth = 56`. | **Open** (Apple side untraceable in this corpus). Our cicn-path is data-driven from the bundle's cinf — period-faithful in the sense that the *author* declared the slice. The procedural baselines are a **calibrated fallback** (per the platinum-controls FALLBACK gate). | **No change.** Keep our shape. Apple's standard-metrics path would be a refinement (read `kThemeMetricPushButtonHeight` ≈ 20 px which already matches `platinum.ts:188`); add the Apple-metric constants to the source-of-truth doc when the real button CDEF is recovered. |
| 2 | **Default-ring outset** | **Open.** No focus-ring draw site exists in `CDEF-n1.asm` (no `kControlButtonPart` dispatch, no `FrameRoundRect`-around-button idiom). The only frame operations in `-1` are scroll-bar outline strokes (`FrameRect` `0xa8a1` @ `0x32c`, `0x344`, `0x9c0`). Apple's documented constant is `kThemeMetricFocusRectOutset` (Appearance Manager / Inside Macintosh: Mac OS 8 Toolbox, Appearance ch.) — typically **4 px outset** with a **1 px gap** from the face. The PPC drawer at AppearanceLib vtable `+0xCC` is the only place a Platinum-era ring constant could be pinned, and that's the open chase the spike declined (`platinum-controls-decode.md` could-NOT-pin #4). | **`composeButton`** (`src/controls.ts:1001`–`1089`) uses a **dual-model** approach (`src/controls.ts:1034`–`1057`): (1) OUTSET model — `outset = (ring.width − face.width) / 2` when the artist drew the ring larger than the face (crayon-os: 80 ring around 74 face → 3 px); (2) OVERLAY model — `outset = max(3, round(ring.width / 4))` heuristic when ring ≤ face (apple-platinum-2, beos-r503, etc.). Plain (non-default) buttons reserve the *same* outer rect so a row of default + plain buttons aligns (`src/controls.ts:1025`–`1031`, the 2026-05-29 row-alignment fix at commit `1d7fa9d`). **`platinumButton`** (`src/platinum.ts:192`–`198`) uses fixed `ringPad = 3` and strokes two 1-px concentric rectangles (no gap — 2-px black ring). **`baselineButton`** uses CSS stacked `box-shadow`s: `0 0 0 1px #d4d4d4, 0 0 0 3px #000000` (`src/controls.ts:1260`) — 1-px light gap + 2-px black ring, **3 px total outset**. | **Divergent (rationale: shipped art is authoritative).** This is **already an owner-approved divergence** documented in MEMORY's `reference_default_button_ring` and the kdef-faithfulness-ledger ("default-button ring is SHIPPED ART (cicn -10231 active / -10232 inactive), NOT procedural"). The ring is a 9-sliced cicn whose outset is read from the bundle (the author's intent), not Apple's `kThemeMetricFocusRectOutset`. apple-platinum-2's indigo ring is real cctb-slot-14 data per `platinum-palette.json`. | **No change.** Keep our shape. Per the kdef-faithfulness-ledger rule "data over hardcoded constants" and the Apple-data/drawer-split mirror in `platinum-controls-decode.md` Headline #2. **Candidate ledger row** — add a kdef-faithfulness-ledger entry making the outset model an explicit deliberate divergence from the standard 4-px focus-rect outset (today it's only on MEMORY). |
| 3 | **Pressed-state visualization** | **Open** (for buttons). `CDEF-n1.asm` does have a pressed-state branch at `0x376` (`cmpb contrlHilite(+17), partCode` → if pressed, the ink index gets `-1` via `0x360`; ink rotation `+4 if vertical`, `+2 if part 21`, `-1 if pressed`). That selects a *different pixPat / different colour-table slot* — i.e. the **track-control** pressed state is a hard art swap, not an alpha-blend. There is no equivalent for `kControlButtonPart`(10) since that part isn't dispatched. Apple's real button pressed-state lives in (a) the per-state cicn AppearanceLib draws (cf. our `-10238` "pressed" slot), and (b) the WDEF 125 sunken-bevel model (`docs/spec/platinum-wdef125-decode.md`) for the procedural side. | **Cicn path:** `composeButton` swaps the entire face cicn — `faceId = opts.pressed ? 10238 : 10239` (`src/controls.ts:1002`), a 1:1 mirror of the per-state art Apple's drawer would emit. **Procedural path:** `platinumButton` does **NOT** visualize the pressed state — it has no `pressed` flag at all (`src/platinum.ts:175`–`186`). **`baselineButton`** likewise has no pressed flag. The interactive wrapper (`src/interactive.ts`) handles momentary darken/sink via the cicn re-render. | **Aligned for the cicn path** (per-state art swap mirrors Apple's drawer-emits-per-state model). **Divergent for the procedural fallback** (no pressed state at all — gap, not wrong shape). | **No change** for the cicn path. **Candidate follow-up** (not a ledger entry; an implementation gap to surface): when the procedural Platinum baseline is exercised in an interactive setting, `platinumButton` should accept `pressed?: boolean` and stamp `sunkenFace` (already implemented in `src/platinum.ts:292`–`298` for the bevel button) instead of `raisedFace`. Not a divergence to land today — surfaced for the next pass at the procedural fallback. |
| 4 | **Disabled-state lookup** | **Open** (for buttons). `CDEF-n1.asm` *does* have a disabled-state sentinel: `cmpib #-2, contrlHilite(+17)` at `0x1e4` (= 254 = `kControlInactivePart` sentinel) routing to a simplified frame path at `0x330`. That's a **track-control** rule — it dims the bar; it doesn't tell us about button disabled-state. Apple's classic-Mac disabled rule for buttons (Inside Macintosh: Macintosh Toolbox Essentials, Controls ch.): draw at the full art **plus a 50% mask** (the gray-pattern stipple, `gray` pattern from `'PAT '`). Apple's Platinum era replaced this with a per-state cicn the drawer emits (the same model we follow). | **`loadPushButtonFace(theme, 'inactive')`** (`src/controls.ts:156`–`181`) walks the manifest's structured role names for `push-button-inactive` / `inactive-push-button` / `inactive-button`, then falls back to id `-10240` with the anti-role filter. If still missing, `composeButton` falls through `inactive → active` (`src/controls.ts:1021`) — i.e. *substitutes the active face* (no 50% mask, no stipple). `baselineButton` and `platinumButton` paint a lighter gray face + gray text (`src/controls.ts:1257`, `src/platinum.ts:189`) — closer to the Platinum dimmed look than to the classic-Mac stipple. | **Divergent (rationale: shipped art is authoritative).** Apple's Platinum-era rule (per-state cicn — what AppearanceLib emits) IS what we mirror; the classic-Mac stipple rule was retired in Mac OS 8. The `inactive → active` fallback (without overlay) is a **gap**: when a bundle ships no inactive cicn, we render the active art unmodified instead of dimming it. | **No change** for the per-state art swap (period-faithful for Platinum schemes). **Candidate follow-up gap**: when `loadPushButtonFace(theme, 'inactive')` returns null and we fall through to active (`src/controls.ts:1021`), apply a 50% desaturation / `-15%` lightness overlay so cicn-less or sparse bundles still read as disabled. Today's behaviour is the gap noted in the ledger row "AppearanceManager-style state-fallback chain" — the active-substitution path needs an explicit dim. **Not a deliberate divergence — a known gap**, OK to log but not a ledger entry. |
| 5 | **Label rasterization** | **Open.** `CDEF-n1.asm` has **no label/title draw routine** — it's the track family. (The `-63` sibling has a label routine at `0xd76` that calls QuickDraw `DrawText` with a truncation selector `0x8208FFE0`, but that's for scroll-bar value labels, not button captions.) Apple's button labels go through `DrawThemeButtonText` / `DrawThemeTextBox` with `kThemeSystemFont` (Charcoal 12 in 8.5+) / `kThemeSmallSystemFont` (Geneva 9 or Charcoal 10 small), antialiased per the Appearance Manager `kThemeAntiAliasFontMin` (default 9 pt). | **`composeFaceButton`** (`src/controls.ts:968`) sizes the label off the **button height**: `rasterizeText(label, max(8, round(lineH * 0.6)), fg)`. For a 16-px face → ~10 px text. For a 20-px face (the platinum height) → 12 px. **`platinumButton`** (`src/platinum.ts:190`) uses a fixed `rasterizeText(label, 11, fg)`. **`baselineButton`** uses CSS `font: '12px Charcoal, Chicago, Geneva, sans-serif'` (`src/controls.ts:1252`). Title-text colour is picked by face luminance (`src/controls.ts:962`–`966`), NOT from a cicn marker (the cinf `textAnchor` is read but only for the offset, not the colour — see `composeChrome` `reference_title_text_color` for why; same rule applies here). | **Divergent (rationale: schemes carry no text-color marker; bitmap font choice).** Two threads:<br>(a) **Size:** scaled-from-face vs. Apple's fixed-12-pt is a **deliberate** choice — our face heights vary (16 px for apple-platinum-2 ring, 20 px for Platinum, 74 px for crayon-os) so a fixed point size would either overflow or be tiny. The ratio `0.6 × height` keeps the label proportional. Already documented (cinf `textAnchor` reading at `src/controls.ts:959`–`961`).<br>(b) **Font:** Charcoal 12 is the period-faithful family (Mac OS 8.5+ system font; see `reference_title_fonts` — we use the Jeremy Sachs bitmap recreation). Aligned in family, divergent in *which font sits where* (the CSS baseline path lists Charcoal first, the rasterized path uses our Charcoal bitmap). | **No change.** Keep our shape. The size-from-height rule is correct for our heterogeneous face heights; Apple's fixed `kThemeSystemFont` 12-pt assumes the Platinum 20-px button. **Candidate ledger row** — note the scaled-label-size rule as a deliberate divergence from `kThemeSystemFont` 12-pt, motivated by per-scheme face-height variance. |

## Per-routine deeper notes

### Row 1 — face inset (where the constants would come from)

The cinf-driven `slice.corner` / `slice.side` path (`src/controls.ts:953`–`955`)
is the period-faithful answer when a scheme ships a cicn — it reads the
**author's** declared 9-slice, which is what AppearanceLib would have honoured
through the per-state cicn. The `sliceInset` heuristic (`src/controls.ts:9`–`12`)
is a fallback for old bundles authored before the cinf carried slice metadata;
no Apple constant maps to it.

For the procedural `platinumButton` (`src/platinum.ts:187`–`202`): `h = 20`,
`padX = 12`, `minWidth = 56` align with the Mac OS 8.5 **standard push-button
metrics** (Inside Macintosh: Mac OS 8 Appearance, `kThemeMetricPushButtonHeight
= 20` — verifiable in the phracker `Appearance.h` mirror cited by
`docs/spec/apple-primary-source.md`). No change recommended.

### Row 2 — default-ring outset (the most user-visible item)

The OUTSET vs OVERLAY split (`src/controls.ts:1034`–`1057`) is the runtime's
answer to a real authoring divergence in the corpus: some artists drew the ring
as a separate larger cicn, others as a same-size overlay. **This is owner
territory and shipped art, not Apple metrics** — the ring cicn IS the data.
Apple's `kThemeMetricFocusRectOutset` (typically 4 px) is the *standard-metrics
fallback* and only applies when no ring cicn ships.

Concrete Apple-side numbers (for the ledger row this audit proposes):

- `kThemeMetricFocusRectOutset` = **4 px** (Appearance / Inside Macintosh; the
  default focus-rect inflation around any focusable control)
- Default-button ring inset from focus-rect: **1 px gap** between face and ring
  (the gap is the focus rect itself; the ring is drawn ON the focus rect edge)
- Our `(ring.width − face.width) / 2` formula reproduces 3 px for the crayon-os
  80×74 case — author-declared outset, **not** the standard 4 px

### Row 3 — pressed-state (cicn swap vs alpha-blend)

Our per-state cicn swap is **exactly** what AppearanceLib's drawer does: emit
the `kThemeButtonOn` art instead of the `kThemeButtonOff` art. No alpha-blend.
The procedural fallback gap (no `pressed` flag on `platinumButton`) is a
runtime feature gap, not a faithfulness divergence — when surfaced, it should
re-use `sunkenFace` (`src/platinum.ts:292`–`298`) which already implements the
WDEF-125 sunken-bevel model authentically (`platinum-wdef125-decode.md`).

### Row 4 — disabled-state stipple vs per-state cicn

The classic-Mac stipple-overlay rule (Inside Macintosh: Macintosh Toolbox
Essentials, Controls ch. 5) was the System 7 / pre-Appearance behaviour. The
Mac OS 8.5 Platinum era replaced it with per-state cicns — and our per-state
swap mirrors that. Our `inactive → active` cascade (without dimming) is a
fallback when a bundle ships no inactive cicn, which is rare but happens; the
classic-Mac answer there would have been a gray-pattern stipple. Today we just
draw the active art. Surface for the next pass at the cicn-less path.

### Row 5 — label font and size

The `0.6 × height` ratio (`src/controls.ts:968`) is calibrated against the
Platinum 20-px button: `0.6 × 20 ≈ 12`, which equals `kThemeSystemFont` for the
canonical case. For tall faces (crayon-os 74 px), the ratio gives ~44 px text
which the `rasterizeText` clamps to whatever the available font sizes allow.
The face-luminance colour pick at `src/controls.ts:962`–`966` mirrors what we
do for window titles (see `reference_title_text_color` in MEMORY: schemes
carry no reliable title-text marker, default to black/gray contrast).

## Bonus: standard-metric constants for `apple-primary-source.md`

The following Apple-documented constants (Appearance Manager, Inside Macintosh:
Mac OS 8 Toolbox Essentials, `Appearance.h` `kThemeMetric*` enum, `Controls.h`)
are the **standard-metrics fallback** when the real button CDEF is unavailable.
Recommend adding to `apple-primary-source.md` as a "Control metrics" section
(today the doc covers ThemeBrush / ThemeTextColor / ThemeWidget /
ThemeWindowType only — no control metrics):

| `kThemeMetric*` constant | value | role |
|---|---:|---|
| `kThemeMetricPushButtonHeight` | 20 | default push-button face height (Platinum) |
| `kThemeMetricSmallPushButtonHeight` | 17 | small push-button face height |
| `kThemeMetricCheckBoxHeight` | 16 | checkbox glyph + label row |
| `kThemeMetricRadioButtonHeight` | 16 | radio glyph + label row |
| `kThemeMetricFocusRectOutset` | 4 | default-button ring outset from focus rect |
| `kThemeMetricEditTextFrameOutset` | 1 | edit-text frame outset |
| `kThemeMetricScrollBarWidth` | 16 | scroll-bar thickness |
| `kThemeMetricSmallScrollBarWidth` | 11 | small scroll-bar thickness |
| `kThemeMetricMenuBarHeight` | 20 | menu-bar height |
| `kThemeMetricMenuTitleHeight` | 18 | menu-title row height |
| `kThemeMetricPopupButtonHeight` | 20 | popup-button face height |

Sources: `Appearance.h` `kThemeMetric*` enum in the phracker MacOSX SDK 10.6
mirror; Inside Macintosh: Mac OS 8 Toolbox Essentials, Appearance Manager and
Controls chapters (Apple PDF, archived). These are the **Apple-stated**
control sizes; the runtime hits them through `platinum.ts` (push button 20,
scroll-bar 16) but should cite them centrally.

## Candidate ledger entries (proposed; not landed)

Two rows would clarify the audit table's "owner-approved divergences":

1. **kdef-faithfulness-ledger** — "Default-button ring outset reads the
   author-shipped cicn (OUTSET model `(ring.width − face.width) / 2`, OVERLAY
   model `max(3, round(ring.width / 4))`) rather than Apple's standard
   `kThemeMetricFocusRectOutset = 4 px`. Rationale: the ring is shipped art;
   the cicn IS the author's declared outset; Apple's metric is the
   standard-metrics fallback when no ring ships."
   
   File: `docs/spec/kdef-faithfulness-ledger.md`. Citations: `src/controls.ts:1034`–`1057`,
   `apple-primary-source.md` (new control-metrics section).

2. **kdef-faithfulness-ledger** — "Push-button label size is `max(8, round(faceHeight × 0.6))`,
   not Apple's `kThemeSystemFont = 12 pt`. Rationale: the corpus authors
   shipped faces ranging 16 → 74 px tall; a fixed 12-pt size would either
   overflow short buttons or look comical on tall faces. The 0.6 ratio yields
   12 pt for the canonical 20-px button (Platinum match), scales gracefully
   elsewhere."
   
   File: `docs/spec/kdef-faithfulness-ledger.md`. Citations: `src/controls.ts:968`,
   `apple-primary-source.md` (new control-metrics section).

## Items NOT made into rows (out of scope)

- **Push-button face resolves by manifest role name first, then by id** — already
  in `kdef-faithfulness-ledger.md` (the monkey-paradise + animals fix).
- **Segmented On/Off pressed/active authoring** — already in
  `kdef-faithfulness-ledger.md` (1984's pressed/active inversion).
- **Button row outer rect (`composeButton` ALWAYS allocates 2× outset)** —
  already covered by MEMORY's `reference_button_row_outer_rect` and commit
  `1d7fa9d`.

## How to advance this audit

To convert any Open row to Aligned/Divergent, the genuine button CDEF must be
recovered. Steps documented in `apple-cdef-button-geometry.md` §(e) item 1:

1. Locate the multi-kind button CDEF in another classic-Mac system or
   Kaleidoscope-adjacent scheme (likely also resource id `-1` but in a
   different `'CDEF'` resource fork — `.scratch/iso-recon/code-out/`
   currently contains only this corpus' track-only CDEFs).
2. Extract via the same pipeline (`scripts/macbin-resfork.mjs` or the
   `iso-recon` extractor used for `85-System.bin`).
3. Re-decode with `m68k-elf-objdump` per the recipe in
   `platinum-controls-decode.md` §"# bins".
4. Re-run this audit against the recovered binary.

Until then, all five rows stay **Open on Apple's side** and the runtime's
shape is held against (a) the cinf's per-bundle slice data, (b) the WDEF-125
raised-bevel model (`platinum-wdef125-decode.md`), (c) the `cctb` id=0
extracted Platinum grays + lavender/indigo (`platinum-palette.json`), and (d)
Apple's `kThemeMetric*` standard metrics enumerated above.
