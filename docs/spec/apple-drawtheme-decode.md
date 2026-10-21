# AppearanceLib DrawTheme* decode — extending the spike

*Clean-room. PPC32 BE disassembly of AppearanceLib's code section, reached via
the PEF pattern-data decompressor implemented during the spike. All `0x…`
addresses are offsets within AppearanceLib's code section
(`fileOff = 2443792 + addr` into the Mac OS 8.5 System file, `85-System.bin`).
Understanding-only; no Apple listing reproduced verbatim.*

*Listing-level narrative (PPC instruction excerpts, registers, stack/TOC
offsets, reproduction toolchain) for this document lives in [`engine/apple-drawtheme-decode.evidence.md`](engine/apple-drawtheme-decode.evidence.md) — spec writers and verifiers only.*

---

## 0. HEADLINE — Apple's API layer is uniformly a vtable dispatch

The spike's open question was: "follow the +0xCC indirection from
`DrawThemeButton`'s dispatcher to the actual button-drawing code." The answer,
once the other DrawTheme exports are resolved alongside it, is that **the entire
public DrawTheme*/GetTheme* API in AppearanceLib is the same single-shape
dispatcher** — fetch a global "current theme provider" object, call its vtable
method at a fixed per-routine offset, and return whatever the method returns.

The pixel-drawing code is **not** in AppearanceLib. It lives in the **theme
provider** — a separate PEF container that ships as the active "theme file"
(Apple Platinum, etc.). AppearanceLib is the API surface + selector dispatcher;
the theme provider is the renderer. This is the OO structure the spike inferred
from the single `DrawThemeButton` indirection; the eight routines decoded here
confirm it as the *uniform* architecture.

This recasts the FALLBACK gate's rationale even more strongly: a faithful
re-implementation tracks Apple's separation of API ↔ provider, and our
provider-equivalent is the procedural drawer + extracted Platinum palette.
Following each `+0x??` indirection into the Platinum provider would only pin
the **specific gradient/bevel bytes** Apple's Platinum provider materializes —
not the API contract, which is exactly what we already model.

---

## 1. The dispatcher signature

Every routine in section 2 below follows this template (citing
`DrawThemeButton` @ `0x002ee4` as the canonical example):

1. Standard PPC prologue; the seven parameters are saved (`0x002ee4`…).
2. **Null-rect guard** (`0x002f10`): a null rect returns `-50` (`paramErr`).
3. Loads the `drawInfo->state` half-word (`0x002f30`) and masks it with `5`
   (`0x002f34`; `kThemeStateActive=1 | kThemeStateRollover=4`).
4. Calls `0x18618` to fetch the current theme provider (`0x002f58`).
5. Loads the provider's vtable (`provider[0]`, `0x002f60`) and the method at
   **vtable `+0xCC`** (`0x002f68`) — the per-routine constant.
6. Passes, in order: rect, kind, drawInfo, prevInfo, eraseProc, labelProc,
   userData (`0x002f64`…`0x002f80`).
7. Calls the method through the cross-TOC indirect-call trampoline `0x3d44c`
   (`0x002f84`).

(Instruction excerpt in evidence.)

Two helpers are common to every routine:

- **`0x018618`** — "get current theme provider": returns the value held in a
  global slot in AppearanceLib's TOC (`0x018618`–`0x018620`; slot offset in
  evidence).
  *Period claim:* the active theme provider lives in a **single global slot** in
  AppearanceLib's TOC — i.e. AppearanceLib supports exactly one provider at a
  time.

- **`0x03d44c`** — the standard PPC PEF indirect-call trampoline (re-used by
  every routine): takes the entry point and callee TOC from the TVector it is
  given, saves the caller's TOC, and jumps to the entry
  (`0x03d44c`–`0x03d45c`).

Most routines call the method **twice** — once with the active provider, and
once again after `0x18790` (`SwitchTheme`-style helper) if the provider has
changed mid-call. That double-call is the "theme switched while drawing" race
guard, not a per-kind branch.

---

## 2. The vtable map (the spike's #1 unknown — answered)

Concrete vtable offsets resolved by tracing each routine's vtable-method load:

| Routine | TVector @ data | code addr | vtable +offset | arg count |
|---|---|---|---|---|
| `DrawThemeButton` | `0x0CCC` (3276) | `0x002EE4` | **+0xCC** | 7 (rect, kind, drawInfo, prevInfo, eraseProc, labelProc, userData) |
| `DrawThemeWindowFrame` | `0x0F34` (3892) | `0x0096C0` | **+0xBC** | 7 (mac/window, rect, style, state, attribs, hasTitle, eraseProc/userData) |
| `DrawThemeTitleBarWidget` | `0x0F2C` (3884) | `0x009870` | **+0xC0** | 6 (mac/window, rect, state, widgetKind, adornment, …) |
| `DrawThemeTrack` | `0x0C5C` (3164) | `0x0038F8` | **+0x64** | 4 (trackInfo, ghostRgn, eraseProc, userData) |
| `DrawThemeTrackTickMarks` | `0x0C14` (3092) | `0x003F34` | **+0x94** | 4 (trackInfo, numTicks, eraseProc, userData) |
| `GetThemeTextColor` | `0x0CE4` (3300) | `0x002C80` | **+0x30** | 4 (textColor, depth, isColorDev, outRGB) |
| `GetThemeBrushAsColor` | `0x0CEC` (3308) | `0x002BA4` | **+0x2C** | 4 (brushID, depth, isColorDev, outRGB) |
| `GetThemeWindowRegion` | `0x0F3C` (3900) | `0x0094FC` | (per-region, not yet pinned — same prologue as WindowFrame, dispatches twice) | 7 |

The vtable is a **C++-shaped flat function-pointer table on the theme-provider
object**. The numerical ordering (0x2C, 0x30, 0x64, 0x94, 0xBC, 0xC0, 0xCC, ...)
suggests an ABI position assignment, not arbitrary grouping — Apple kept the
position of each Method along the vtable stable for compatibility.

`DrawThemeButton` at `+0xCC` is genuinely the deepest routine of the four core
drawers; the spike's "one more indirection" estimate was accurate.

---

## 3. Per-routine findings

### 3.1 `DrawThemeWindowFrame` — the primary target

**TVector** `0x0F34` (3892) in patternData → **code addr `0x96C0`** (fileOff
2482384).

**Decoded prologue (instructions 1–28)** — as decisions (instruction excerpt in
evidence):

| addr | step |
|---|---|
| `0x096C0` | standard prologue |
| `0x096CC` | parameters in order: mac, rect, style, state, attribs, hasTitle, eraseProc |
| `0x096EC` | null-rect guard: |
| `0x096F0` | if `rect->right < rect->left` → return `-50` (paramErr) |
| `0x09710` | if `rect->bottom < rect->top` → return `-50` (paramErr) |
| `0x0973C` | if `hasTitle == 0` (computed as a boolean from the condition register) → `-50` |
| `0x0975C` | state range: only `state == 0 \|\| state == 1` accepted → else `-50` |
| `0x09784` | attribs mask: if `(attribs & ~0x3FE) != 0` → `-50` |
| `0x097A0` | state-canonicalize: canonical state = 1 when `state == 1`, else 0 |
| `0x097B4` | fetch theme provider (`0x18618`) |
| `0x097BC`/`0x097C0` | load vtable, then `vtable[+0xBC]` = window-frame drawer |
| `0x097E0` | indirect call via `0x3d44c` (rect, state, attribs, hasTitle, eraseProc, …) |

**Concrete period-fidelity claims:**

1. **Apple's `DrawThemeWindowFrame` accepts only 9 attribute bits.** The attribs
   test at `0x09784` ANDs with `-0x3FE` (sign-extended: `0xFFFFFC02`) and rejects any
   bit outside `0x002…0x200`. That is exactly `kThemeWindowHasCloseBox`,
   `…HasZoom`, `…HasCollapse`, `…HasTitleText`, `…HasDirty`, `…HasFullZoom`,
   `…HasMacOS9Treatment`, plus two reserved (`0x40 / 0x80`). Any other adornment
   bit on input → returns `paramErr` **before** dispatch.
2. **State is binary.** Only `kThemeStateInactive(0)` and
   `kThemeStateActive(1)` are accepted; the doc's `kThemeStatePressed(2)` and
   `…Rollover(4)` are **not legal** here (those are button-only). This contradicts
   any code that passes a pressed-state to a window-frame draw — it would no-op.
3. **`hasTitle` is required.** A `nullPtr` mac-handle is rejected; window-frame
   drawing has no implicit fallback.
4. **There is no `windowType` branch in AppearanceLib.** The `kThemeDocumentWindow…
   kThemeDrawerWindow` switch lives entirely **inside the provider's `+0xBC`
   method**. AppearanceLib's wrapper is identical for every window class.

**What our runtime currently does** (`src/composeChrome.ts:662`,
`composeWindowChrome`): we drive chrome composition from the bundle's
`wnd#` rect-list + 4 side recipes, faithful to the **kDEF** (which is the older
classic-Mac path, not AppearanceLib). The two layers are independent —
AppearanceLib only kicks in for windows whose `WDEF`/scheme references the
Appearance Manager. Our compositor remains the authoritative model for the
Kaleidoscope-rendered corpus.

**Alignment / divergence:** the *only* place this AppearanceLib decode could
inform `composeChrome.ts` today is the **per-type body brush** and **title
text color** — but both of those live inside the provider's `+0xBC` method and
the `+0x30` `GetThemeTextColor` method, neither of which we've decoded into the
Platinum provider yet. Our existing per-scheme title-text colour fallback
(`reference_title_text_color`: black active / grey inactive) matches Apple's
documented default exactly.

### 3.2 `DrawThemeButton` — extending the spike

**TVector** `0x0CCC` (3276) → **code addr `0x2EE4`** (fileOff 2455796).

The spike disassembled the prologue + first dispatch. Extending past insn 60
into the routine **tail** reveals a *second* dispatch block (`0x002FB8`) that
re-runs the vtable call after `0x18790` returns a different provider — the
"theme changed mid-call" retry, *not* a separate per-kind path. The single
button-kind switch (push/check/radio/popup/disclosure/triangle) is entirely
**inside** the `+0xCC` method.

**Decoded constants:**

- `state & 5` (@ `0x2F34`) — extracts active|rollover early.
- call to `0x3d02c` @ `0x2F40` — utility "is rect a real Drawing rect?"; returns
  byte; if 0 the routine returns 0 (noerr) silently. This is the "drawing
  optimised away" fast-path: a degenerate rect skips dispatch entirely.

**No bevel inset, no gradient color, no focus-ring thickness is visible at the
AppearanceLib layer.** The spike's gate verdict stands: those bytes live in the
Platinum provider's `+0xCC` method body, and reaching them requires (a) locating
the Platinum provider PEF in 85-System.bin and (b) another PEF decompress +
TVector deref. The spike documented the cost as open-ended *per kind*; this
decode confirms the kinds aren't even split at this layer.

**What our runtime currently does** (`src/controls.ts:1010–1089`,
`composeButton`): we 9-slice the artist-shipped `-10231/-10232` ring around the
`-10239` face, with outset derived from `opaqueBounds(ring).w − faceCe.w` /2 or
the historical `ring.width/4` heuristic. Per the existing learning entry
`reference_default_button_ring`, this is faithful to the cicn-shipped art
model — *not* to Apple's procedural-ring model. Apple's procedural focus ring
lives behind `+0xCC` and the trap-selector `DrawThemeFocusRect` (see §3.4).

### 3.3 `DrawThemeTitleBarWidget`

**TVector** `0x0F2C` (3884) → **code addr `0x9870`**.

**Concrete period-fidelity claims:**

1. Same `state ∈ {0, 1}` and `(adornments & ~0x3FE) == 0` gates as
   `DrawThemeWindowFrame` (`0x99..0x991C`). Pressed state again **is not legal**
   at this layer — the per-widget pressed appearance is computed inside the
   provider's `+0xC0` method from a different parameter (likely a
   pre-canonicalized `pressed` flag, set to 1 at `0x9934` when `state == 1`;
   register detail in evidence).
2. The widget kind (arg3) is passed through unchanged — no validation
   here. So `kThemeWidgetCloseBox=0`, `…ZoomBox=1`, `…CollapseBox=2`, and any
   later additions all share the same wrapper; the provider's method is the
   policy.

**Vtable offset: `+0xC0`** — adjacent to `DrawThemeWindowFrame`'s `+0xBC`, which
matches their being a window-decoration pair.

**What our runtime currently does** (`src/composeChrome.ts` part-codes
1/2/3 for the close/zoom/collapse widgets; `src/cornerSpriteGeometry.ts` for the
four corner-sprite schemes per the existing learning `reference_corner_sprite_frame`).
The widget arithmetic (7×7 fixed per WDEF decode) is independently derived
from the WDEF 125 disassembly, not from AppearanceLib — so this layer adds
**zero new constraints** to our existing geometry. The decompiled provider's
`+0xC0` method *would* pin the pressed-vs-raised bevel arithmetic if decoded,
which is the one cosmetic detail our procedural Platinum corner-sprite path
currently approximates.

### 3.4 `DrawThemeFocusRect` / `DrawThemeFocusRegion` — the trap-selector family

**TVector** `0x1D24` (7460) for `FocusRect`, `0x1C7C` (7292) for `FocusRegion`.

These are a **different dispatcher shape** from the routines above. Each is a
short stub (~10 instructions) that (instruction excerpt in evidence):

1. packs arg1 (`0x0385F0`) and the low byte of arg2 (`0x0385F4`);
2. loads the "Theme Manager dispatch refnum" global (`0x0385F8`);
3. loads a per-routine **arg-size mask** (`0x7B8` for `FocusRect`, `0x0385FC`)
   and a per-routine **selector code** (`0xB`, `0x038600`);
4. calls the cross-TOC import-glue table entry `0x3BF94` (`0x038604`).

`0x3BF94`+ is a packed table of 6-instruction **PEF cross-TOC trampolines** —
the standard PPC shape (load the symbol slot from the caller's TOC, save the
caller's TOC, load the callee's entry point and TOC, jump through the count
register). Each entry resolves to an imported symbol; for the focus
family that import is **the Appearance Manager Pack trap** (or its modern
equivalent), with the arg-size mask and selector carrying an
`(argLayout, selector)` pair the trap uses to look up the actual handler. This
is the legacy `_Pack` selector-based ABI preserved for compatibility, *not* the
OO vtable.

**The selector table for the Focus family** (entries enumerated `0x385E4..0x388FC`):

| addr | arg-mask | selector | inferred routine |
|---|---|---|---|
| `0x385E4` | `0x07B8` | `0x0B` | `DrawThemeFocusRect` |
| `0x38624` | `0x0FB8` | `0x0C` | (focus-related, 4-arg) |
| `0x38664` | `0x0FB8` | `0x0D` | (focus-related, 4-arg) |
| `0x386A4` | `0x0FB8` | `0x0E` | (focus-related, 4-arg) |
| `0x386E4` | `0x0398` | `0x0F` | (focus-query, returns bool) |
| `0x38720` | `0x0398` | `0x10` | (focus-query, returns bool) |
| `0x3875C` | `0x07B8` | `0x11` | (focus-related, 3-arg) |
| `0x3879C` | `0x01B8` | `0x12` | (focus-state set) |
| `0x387DC` | `0x0FB8` | `0x13` | (focus-related) |
| `0x3881C` | `0x0FB8` | `0x14` | (returns int16) |
| `0x38860` | `0x3BB8` | `0x18` | (large-payload) |
| `0x388A4` | `0x10000–0x1048` | `0x19` | (multi-arg trampoline) |

The arg-mask value is the **arg-size descriptor** the trap dispatcher uses to copy
parameters; the selector byte is the **selector** that picks the routine in
Appearance's `_Pack` table. The selector codes are dense (0x0B…0x19) and
contiguous — Apple kept these stable.

**Concrete period-fidelity claim:** AppearanceLib exports **at least 14 distinct
focus / theme-state selectors** between codes `0x0B` and `0x19`, all routed
through the same trap glue at `0x3BF94`. The focus-ring procedural draw is
selector `0x0B`. Our runtime's CSS focus ring at
`src/declarative/field.ts:45` (the `--scriptoscope-focus-color` custom property)
sits at a deliberately higher abstraction; the period-faithful procedural ring
is one selector deep — but reaching the actual pixels still requires the
provider PEF decode.

### 3.5 `DrawThemeTrack`

**TVector** `0x0C5C` (3164) → **code addr `0x38F8`**.

Standard OO dispatcher. **Vtable offset: `+0x64`.**

Prologue performs the same `is-real-rect` validation via a call to `0x3D02C`
(`0x391C`) — if degenerate, returns 0. Then a call to `0x18618` + vtable `+0x64`
call. The trackInfo struct is passed unmodified; all the `kThemeTrackKind`
discrimination (scrollBar / slider / progressBar / movableTrack / indeterminate)
happens inside the provider's `+0x64` method.

**Adjacent dispatcher at `0x39C4`** uses **vtable `+0x68`** — this is almost
certainly the related **`DrawThemeTrackTickMarks` cousin or
`HitTestThemeTrack`** path: provider fetch (`0x18618`) @ `0x039E8`, vtable load
@ `0x039F4`, `+0x68` method load (neighbour of `+0x64`) @ `0x039FC` (instruction
excerpt in evidence).
Resolving which exact public export bound to `+0x68` requires another
exports-table pass.

**What our runtime does** (`src/controls.ts` — composeProgress, composeScrollbar,
composeSlider): we composite from cicn-shipped track / thumb art, with the
artist's bundle deciding the chrome-vs-fill split. Apple's procedural split
(the spike's bullet #5) is inside the `+0x64` method and would only matter
for the procedurally-generated Platinum corpus — covered by our
`platinum-controls-decode.md` from a different angle (the `CDEF` -63 decode).

### 3.6 `GetThemeTextColor` — the **most concrete** period claim

**TVector** `0x0CE4` (3300) → **code addr `0x2C80`**.

Decoded **completely** (50 instructions) — as a decision table (instruction
excerpt in evidence):

| addr | condition | result |
|---|---|---|
| `0x2CA0` | `outRGB == NULL` | return `-50` |
| `0x2CB4` | `kind == -2` (`kThemeTextColorWhite`) | `outRGB = (0xFFFF, 0xFFFF, 0xFFFF)`; return 0 |
| `0x2CD8` | `kind == -1` (`kThemeTextColorBlack`) | `outRGB = (0,0,0)`; return 0 |
| `0x2CF8` | `kind < 1` OR `kind > 0x2C` | return `-30877` (`themeNoAppropriateBrushErr`) |
| `0x2D18`–`0x2D38` | otherwise | fetch provider (`0x18618`), call `vtable[+0x30]` = "get theme text color" with (kind, depth, isColorDev, outRGB) through `0x3D44C` |
| `0x2D44` | dispatch never happened | return `-30877` |

**Concrete period-fidelity claims:**

1. **Apple ships exactly 44 themed text-color slots** (`kThemeTextColor`
   values `1..0x2C`), plus two specials (`-2` white, `-1` black). Any value
   outside that range returns **`themeNoAppropriateBrushErr` = `-30877` =
   `0xFFFF8763`** — the immediate `-0x7763` loaded at `0x2D44` is the negated
   error constant.
2. **Black and White are short-circuited** without consulting the provider —
   they are universal, not theme-customisable. This explains why the Mac OS 8.5
   `Themes` control panel never had a "Customize text color" affordance for
   plain text: the universal slots are hard-coded.
3. **`outRGB` is the only required pointer**; depth and isColorDev are passed
   through. Apple's provider may use depth to pick between 1-bit (B/W) and
   8/24-bit color answers, but the wrapper does not pre-process them.

This is the **single most directly verifiable claim** against our runtime:
`reference_title_text_color` states "the faithful answer is the classic-Mac
system default: black active / grey inactive (schemes theme the frame, not the
title text)". That **exactly matches Apple's `kThemeTextColorBlack = -1`** path
through this routine (the inactive grey is a documented default colour returned
by the provider for `kThemeTextColorDocumentWindowTitleInactive` ≈ slot 6 or 7,
inside `+0x30`).

### 3.7 `GetThemeBrushAsColor`

**TVector** `0x0CEC` (3308) → **code addr `0x2BA4`**.

Identical shape to `GetThemeTextColor`. Concrete differences:

1. **47 themed brush slots** (`1..0x2F`) — three more than text colors.
2. Same `-2`/`-1` short-circuits for `kThemeBrushWhite` / `kThemeBrushBlack`.
3. Returns the same `themeNoAppropriateBrushErr = -30876` (`0xFFFF8764`,
   immediate `-0x7760` loaded at `0x2C68`) for out-of-range — note the **off-by-one** from
   `GetThemeTextColor`'s `-30877`. Apple uses a *different* error constant per
   "what was missing" category (text vs brush).
4. **Vtable offset `+0x2C`** — directly adjacent to `+0x30` for the text-color
   getter. The brush + text-color methods are an ABI pair.

---

## 4. The trap-selector glue: `0x3BF94`

What the spike called "the imported glue" is, in disassembly, a flat table of
6-instruction PEF cross-TOC trampolines, each resolving one Appearance Manager
selector. From `0x03BF94` onward each entry (`0x03BF94`–`0x03BFA8` for the first)
loads its symbol slot from the caller's TOC, saves the caller's TOC, loads the
callee entry and callee TOC, and jumps (instruction excerpt in evidence).

Each entry's TOC displacement selects one of ~30 imported symbols within a single
TOC page (the displacement values are in evidence). These are the
Appearance Manager *Pack* extensions — the legacy selector-trap ABI Apple
preserved for back-compat with the System 7.6 / Mac OS 8.0 Appearance Extension.
**It is *not* a per-kind drawer**; it is one more level of "go ask the
Appearance Manager which provider currently handles selector N".

For our purposes: the focus-ring procedural rule is one TOC-import indirection
+ one selector lookup deeper. Same cost-shape as the OO vtable path.

---

## 5. Reproduction

The reproduction toolchain (decode scripts, their environment and input paths)
is recorded in the evidence appendix — spec writers and verifiers only.

---

## 6. Stop point — what the next reader would need

For each of the eight vtable offsets in §2, the **theme provider's PEF
container** must be located in `85-System.bin` and its code section
decompressed via the same PEF pattern-data decompressor. Then:

- The provider PEF's data section will carry a vtable struct whose entries at
  `+0x2C / +0x30 / +0x64 / +0x68 / +0x94 / +0xBC / +0xC0 / +0xCC` are
  TVectors of the same shape we have already decoded.
- Each TVector → a code-section offset → the per-method body that finally draws
  pixels (button bevel, focus ring, title-bar widget, etc.).

The cost mirrors the AppearanceLib decode we just did: one container locate +
one decompress + per-method PPC RE. With the eight offsets here, the next pass
is **eight TVector derefs deep, not one**. The spike's "open-ended per control
kind" cost characterisation holds — but now with the dispatch surface fully
mapped, the open-endedness is just N independent disassemblies, not unknown
breadth.

**Update — landed by the follow-on pass:** the eight derefs all turned out to
be in-PEF. See [`platinum-theme-provider-decode.md`](./platinum-theme-provider-decode.md)
for the resolved vtable (data offset `0xA554`), the button-kind jump table,
the focus-ring outset constant (3 px), and the **pinned Platinum gray palette**
(13 grays + the `#6666CC` highlight) read directly from
`GetThemeBrushAsColor`'s lookup tables.

---

## 7. Bottom-line claims that affect our runtime today

These are the only AppearanceLib facts that change a claim our runtime
currently makes:

1. **Window-frame `state` is binary in Apple's API.** Anywhere our code passes
   anything other than 0 or 1 to a "window state" abstraction, we are modelling
   a richer state-space than Apple did. (We don't — `composeChrome.ts` already
   threads only Active/Inactive — so this is *alignment*, not divergence.)
2. **There are 44 themed text-color slots and 47 themed brush slots.**
   Our `headerColors` shape (`active.frame`, `active.text`, `active.fill`,
   `inactive.*`) is a tiny subset because schemes only customise a handful;
   Apple's API surface always carried the full 44/47, populated by the
   provider. This bounds how much "theming a window can do" — anything beyond
   slot 47 was never an option.
3. **Black and White text colors are universal**, not provider-overridden. Our
   "black active / grey inactive" default sits inside the universal path; no
   scheme can override it via the same mechanism Platinum used.
4. **Focus-ring drawing is a single procedural selector (`0x0B`)**, not a
   per-control shipped raster. The artist-shipped `-10231/-10232` rings we
   9-slice in `composeButton` are the **Kaleidoscope** model; the
   **Appearance** model is procedural. Our current behaviour is faithful to
   Kaleidoscope (which is what our corpus ships) and divergent from Appearance —
   correctly, because the corpus is Kaleidoscope-source.

No code change is implied — these are documentation-level corroborations of the
runtime model we already have, plus a precise statement of where the
Appearance-flavoured path would peel off if a future bundle ever needed it.
