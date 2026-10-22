# Kaleidoscope 2.3.1 kDEF — standing reference (rubric of coordinate mappings + logic)

*A lookup reference — consult for addresses / ids / offsets / coordinates. For the "how does it work" tour, see [`kdef-architecture.md`](./kdef-architecture.md).*

**What this is.** A lookup reference for the decompiled Kaleidoscope **2.3.1**
`kDEF 0` — the combined 68k code resource (107,726 bytes) that both (a) draws
WINDOW chrome from `wnd#`/`cicn`/`cinf` resources and (b) draws CONTROLS
(buttons, scrollbars, sliders, …) and reads scheme `cicn`/`cinf`/`clut` art. It
exists so the team stops re-reading the binary: every claim below cites an
address, and where a claim is uncertain it is marked **(?)**.

**Addresses are file offsets** into the 107,726-byte `kDEF 0` resource. The
instruction listing is the ground truth for every citation; a decompile was
used for structure only.

*Listing-level narrative (registers, frame offsets, instruction excerpts) and
the decode toolchain for this document live in
[`engine/kdef231-reference.evidence.md`](engine/kdef231-reference.evidence.md)
— spec writers and verifiers only. The blit primitives (§1.5, §3.6, §5, §5.1)
are specified behaviourally in [`engine/qd-primitives.md`](engine/qd-primitives.md).*

**This reference CONSOLIDATES and supersedes the scattered decodes.** Where it
restates an existing doc it links it; it does not re-argue prose already settled
there:
- `kdef231-recipe-walk.md` — window-chrome part-code/draw decode (the deep
  derivation behind §1 chrome + §4 + §5). This reference *summarises* it.
- `compositor-spec.md` — the implemented chrome model (the consumer of §4).
- `kdef-faithfulness-ledger.md` — routine→`composeChrome.ts` map.
- `kdef-layout-recipes.md` — **RETIRED** (2026-05-23). It was the older,
  **1.8.2-era** control/window recipe doc; its window sections were contradicted
  by the 2.3.1 decode, and §1/§2/§6 of THIS doc verify the control IDs and the
  button/ring/9-slice paths against 2.3.1. Its still-useful 1.8.2-era control
  material (progress / menu / disclosure / grow-box / bevel families + the
  period-doc behavioural notes) was folded into **§2.6 below**; its procedural
  Platinum-fallback geometry (`src/platinum.ts`) moved to
  `../kaleidoscope-asset-catalog.md`. Do not look for the old file — it is gone.

---

## 1. Routine map

Grouped by subsystem. Arguments and fields are named by meaning; "the work
struct" = the kDEF globals built at init. All addresses verified present in the
listing.

### 1.1 CDEF message dispatch (controls)

The control code is a standard **Appearance-era CDEF**, entered at `0x6688`.
Pascal signature `long CDEF(short varCode, ControlHandle, short message, long
param)`; the routine pops its 12 argument bytes on return (`0x772a`-style
returns).

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x6688` | CDEF main | CDEF entry: unpack handle, set state-bytes, dispatch on message | reads varCode (low 3 bits = control kind, bit3 = "active"), the ControlRecord; precomputes the per-call state flags (§3.1) | `0x104` (gestalt-ish init), jump table `0x67b6` | CDEF result (pops 12 arg bytes) |
| `0x997e` | **scroll-bar CDEF** (service-handler slot 1; corrected 2026-10-21, was "re-entrant CDEF entry") | `_HGetState`/`_HUnlock` brackets the handle; a call to `0x9930` saves the kDEF globals to a static at `0x992c`; rebuilds the scroll-bar per-message state (`0x9d84`) before every message. Behavioural spec: `docs/spec/engine/scrollbar.md` | args = param, message, handle; 15-entry msg dispatch, table at `0x99ce`, via `0x148` indexed-table helper; handlers `0xa2b6` draw / `0xa506` hit test / `0xa1fe` regions / `0xa678`; msg 34 `0x9b42` answers the `sb*` FourCCs; traps `_PtInRect`/`_GetPort`/`_OSDispatch` (Traps.h names) | `0x9930`, `0x9d84` pre-call hook, `0x148`, `0x1c46` (`'SMARTSCROLLI'` literal nearby — interop with SmartScroll INIT) | CDEF result (pops 12 arg bytes) |
| `0x8d36` | **separate CDEF, undecoded** (service-handler slot 5; corrected 2026-10-21, was "second CDEF main, scrollbar / slider") | **not** the scroll bar: hit test returns part 10, msg 34 (`0x98ca`) answers `bevp`-family tags (likely bevel button); identical dispatch shape to `0x6688` but allocates a 68-byte aux block on initCntl (`_NewHandle` at `0x8df6`), vs the 32-byte `'Acid'` block | aux fields at +14/+20/+22/+26/+28/+30/+32/+34/+38/+40/+42/+44/+46/+48 (meanings undecoded; formerly read as scroll-bar value, min, max, page+/– and action proc under the retired slot-5 scroll-bar attribution) | `0x104`, `0x148`, `0x8c88` msg-0 sub | CDEF result (pops 12 arg bytes) |
| `0x67a2` | dispatch | bounds-checks the message against 34, then jumps through the `0x67b6` offset table (listing detail in evidence) | message 0..34; >34 → `0x6c16` (no-op return) | — | — |
| `0x67b6` | jump table | 35 int16 offsets, target = `0x67b6 + entry` | see §4-controls below | — | — |
| `0x6c16` | default/no-op | return path for unhandled messages | — | — | — |
| `0x6c28` | (msg-0 sub) | called for drawCntl when the draw-gate byte (+16 of the dereferenced record) is set | arg = the unpacked per-call state blob (§3.1) | — | — |

**Decoded dispatch targets** (`0x67b6` table; verified by hex-decode of the
table bytes). Standard CDEF message numbers in parens. Apple's canonical
`Controls.h` numbering is the `phracker/MacOSX-SDKs` mirror (10.6 SDK) — pinned
in `docs/spec/apple-primary-source.md`.

| msg | → target | meaning |
|---|---|---|
| 0 (drawCntl) ✓ | `0x67fc` | draw — `contrlVis` gate (ControlRecord +16) → `0x6c28` part drawers (`$A874`/`$A95E`/`$A88B` GetPort/GetControlTitle/GetFontInfo per Traps.h; the role text "GetCIcon/CopyMask/StringWidth chain" was written under wrong names *(re-verify)* — §1.2) |
| 1 (testCntl) ✓ | `0x6816` | hit-test — `_PtInRect` (`$A8AD`; formerly misnamed PtInRgn, *re-verify* the "face region" wording) on the face; sentinel `contrlHilite` (+17) `== 0xfe` returns 254 (pressed-state hit) |
| 2 (calcCRgns) ✓ | `0x686a` | calc control region — strips bit-31 sign of the param argument, falls through to `0x6872` |
| 3 (initCntl) ✓ | `0x6910` | init — `_NewHandle` of 32 bytes (`$A122`) → ControlRecord+28 = kDEF's 32-byte aux block; writes `'Acid'` magic at +0, clears +6 / +30 (default-button flag) |
| 4 (dispCntl) ✓ | `0x695e` | dispose — `_DisposeHandle` (`$A023`) on the aux block if the `'Acid'` magic checks out |
| 10,11 (calcCntlRgn/calcThumbRgn) ✓ | `0x6872` | region calc (shared) — `_RectRgn` (`$A8DF`) the face cicn (-10240) rect; if default-button flag set, union in the ring (-10232) rect (insets -4) |
| 14 (kControlMsgCalcBestRect) ✓ | `0x69b8` | best-fit rect — `$A874` `_GetPort` (formerly misnamed `_GetMHandle`; *re-verify*), read width/height/style from a font/title record, write Rect into the caller's param buffer; routes through `0x65ba` for default-button cases |
| **19 (kControlMsgGetFeatures)** ✓ | `0x698a` | Appearance feature query — returns a bitmask. Base = `0x240` (`kControlSupportsDataAccess \| kControlSupportsCalcBestRect`); `\|= 0x800 (kControlHasRadioBehavior)` if radio; `\|= 0x4000 (kControlSupportsClickActivation)` if click-activated; always `\|= 0x2000 (kControlSupportsContextualMenus)`. (Bit 13/14 mapping is the Appearance 1.0 / pre-Carbon numbering — Carbon shifted these to bits 21/22 post-2001; Kaleidoscope 2.3.1 predates the shift.) |
| **20 (kControlMsgSetData)** ✓ | `0x6b14` | set custom data on the aux block. Dispatches on the 4-CC tag at the start of the caller's param record: `'cncl'` → write byte from caller into aux +31 (cancel-button flag); `'dflt'` → write byte into aux +30 (default-button flag); `'font'` → copy 24-byte `ControlFontStyleRec` into aux +6..29. Unknown tag → returns -30581 (`errMessageNotSupported`). |
| **21 (kControlMsgGetData)** ✓ | `0x6a86` | mirror of msg 20 — read from aux block into caller's buffer (param record +12). Same `'cncl'`/`'dflt'`/`'font'` tag set; same -30581 default. Sets the param record's returned-size field (+8) to 24 for the font tag, 1 for the flag tags. |
| **27 (kControlMsgTestNewMsgSupport)** ✓ | `0x6980` | returns the magic constant `0x206F6B20` (`' ok '`) to confirm Appearance-era CDEF compatibility (a single load of the constant then the `0x6c16` return — see §1.1 confirmation note below). **This is NOT msg 16 `kControlMsgFocus` — Kaleidoscope's kDEF doesn't handle focus.** |
| **34 (kDEF-private GetControlKind)** ✓ | `0x6b84` | writes a Kaleidoscope-private kind descriptor to bytes 4..7 of the caller's param record based on aux flags + variation code. Long-write picks family by aux-block flags (aux +30 default-btn → `'dbtp'`; aux +31 cancel-btn → `'cbtp'`; neither → `'btnp'`; with the radio-hint state flag → `'radp'`; else `'chkp'`). Then the param record's variation code (+2, 1..4) patches byte+7 with suffix `p/e/x/r` (Plain / Embossed / eXtended / Recessed). varCode 5+ → the descriptor long is cleared (no descriptor). **Msg 34 is unassigned in Apple's published `Controls.h` (`kControlMsgGetRegion = 31` and Carbon jumps to 38) — this is Kaleidoscope's private kind-introspection message, used by Kaleidoscope's own CDEF callers to learn which family/variation a control belongs to without re-classifying.** |
| 5,6,7,8,9,12,13,15,16,17,18,22-26,28-33 | `0x6c16` | unhandled → default (returns whatever the pending result value last held) |

> **Return-value mechanism.** At `0x6c1a`, the default-return path stores the
> pending result value into the caller's function-result slot. So every
> handler that wants to return a value sets the pending result and branches to
> `0x6c16`. (Handlers that don't set it return whatever it held from the
> unpacked-state preamble.)
>
> **Confirmations (2026-05-29).** The five "(?)" entries above are now decoded
> against the listing. The two non-obvious ones:
>
> 1. **Msgs 19 and 27 are NOT swapped from Apple's numbering** even though
>    msg 19's bitmask AND msg 27's `' ok '` constant both look like
>    `kControlMsgGetFeatures` / `kControlMsgTestNewMsgSupport`. Apple's
>    `Controls.h` (phracker 10.6 mirror) puts GetFeatures at 19 and
>    TestNewMsgSupport at 27, so the kDEF matches Apple — the `' ok '`
>    response to TestNewMsgSupport is the canonical Appearance handshake.
> 2. **Msg 34 has no Apple-side counterpart** (the published enum ends at
>    `kControlMsgSetCursor = 33` and resumes at `kControlMsgDragEnter = 38`).
>    The handler writes a 5-family / 4-variation descriptor that looks like
>    Apple's later `ControlKind` struct but uses Kaleidoscope-private tags
>    (`dbtp/cbtp/btnp/radp/chkp` × `p/e/x/r`). The most likely explanation
>    is an internal Kaleidoscope-engine query: the kDEF is consulted by
>    Kaleidoscope's own button-promotion code (which needs to know "is this
>    a default-button face?" without re-decoding the varCode) and uses
>    `CallControlDefProc(msg=34)` as the ABI. Confirming this would require
>    decompiling the calling-side Kaleidoscope code module, which isn't in
>    the kDEF binary.
>
> All five entries sit in the `0x6980..0x6c10` block (listing line citations
> in evidence).
>
> The LOW entries (0-4, 10, 11, 14) were the "classic CDEF set" called solid
> previously; they're now spot-checked too — see the per-row ✓ citations
> against the toolbox-trap signatures.

### 1.2 Control draw — push-button face + default ring

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x6cdc` | install-drawers | registers the FACE drawer per GDevice via `0xf112`; passes `0x7424` (color twin) then `0x70f6` (b/w twin) | args = the two drawer entry points, then the call to `0xf112` | `0xf112` | — |
| `0x7424` | **push-button FACE drawer** (color) | draw the button face cicn into the control rect; pick state cicn; then default-ring | arg 1 = the per-call state blob (§3.1: disabled byte, pressed byte, control Rect, scratch byte); arg 2 = second drawer argument; device-depth argument (DeviceLoop wrapper `0xf112`→`0xf290`; equivalent manual callback arguments at `0xf26c–0xf27c`) | `0xea08`,`0xe978`,`0xf2d6`,`0x10fc0` (body + independent border bands), `0x107a4` (ring), `0x6d22` | pops 12 arg bytes |
| `0x70f6` | b/w FACE drawer | 1-bit-screen twin of `0x7424` | same blob | `0x10472` (cicn) | — |
| `0x757c` | **face state-select** | choose face cicn id | disabled byte set → **-10240**; else pressed byte set → **-10238**; else **-10239** | passes id → `0x10fc0` | — |
| `0x76a8` | **aux-struct 'Acid' gate** | compares the aux struct's first long against `0x41636964` (= `'Acid'`, the kDEF aux-struct magic), then tests its default-button byte (+30); both must hold to draw the default ring. The aux struct is reached through the control handle chain ControlHandle → record → +28 → aux (`0x768c`-`0x76a8`) | aux struct: `+0`='Acid', `+30`=default-button flag | — | — |
| `0x76c4` | **default-ring blit** | choose ring cicn id by state and 9-slice it | disabled byte set → **-10232** (inactive); else pressed byte → **-10230** (mixed), retry **-10231**; else **-10231** (active) | `0x107a4` | — |
| `0x788c` | **hand-drawn 3-D frame/bevel** | procedural MoveTo/LineTo bevel when no cicn face | state value 254 / 255 (pressed/raised); loads aux cicns via `0x10472` (`0x78b8`/`0x78d0`/`0x78e0`) | `0x10472`, MoveTo/LineTo | returns at `0x7d86` |

> **Correction to the brief's state mapping:** at `0x757c` the listing selects
> disabled byte →**-10240**, pressed byte →**-10238**, else **-10239**. (`controls.ts`
> `drawButton` uses the same: `disabled→10240, pressed→10238, normal→10239`.)
> The ring at `0x76c4` is disabled byte →**-10232** (inactive), pressed byte →**-10230**
> (mixed) then -10231, else **-10231** (active). So state-blob byte 8 is the
> "disabled/inactive" bit and byte 9 is the "pressed/mixed" bit.

### 1.3 Control draw — other parts (drawer entry points; layout not fully traced)

| addr | role | cicn family | notes |
|---|---|---|---|
| `0x997e` | **scroll-bar CDEF main** (corrected 2026-10-21; this row formerly named `0x8d36`) | `-8288..-8277` tracks, `-10208..-10205` thumbs, `-8272/-8271` ghosts | service-handler slot 1; 15-entry msg dispatch (table `0x99ce`). Behavioural spec: `docs/spec/engine/scrollbar.md`. Slot 5 `0x8d36` is a separate, undecoded CDEF (`bevp` tags). Full trace: `docs/spec/kdef-service-handlers.md` |
| `0x66b4`-region | scrollbar drawer | `-8278..-8271` v / `-8286..-8271` h | per §2.6 (1.8.2-era); `controls.ts` uses these IDs (verified consumer-side) |
| `0xdd22` | **GDevice-aware focus / state helper** *(re-verify: name and the ctSeed reading rest on the former GetCTSeed trap name; `$A88F` is OSDispatch)* | — | service-handler slot 2; gates draw on 3 four-character magics (`'CHTA'`/`'POrg'`/`'CH3D'`); no aux allocate, consumes slot 0's. Full trace: `docs/spec/kdef-service-handlers.md` |
| `0x788c`/bevel | bevel/checkbox/radio path | `-10232/-10231` mixed | hand-drawn fallback when cicn absent |
| popup/tab | (msg-routed via `0x17452`) | `-12320` frame / `-12319` tab | §2.6 (behavioural `[DOC]`); the kDEF gates these to a loaded `'WDEF', -14336` whose code is called directly with msg-base 1008 — see `docs/spec/kdef-service-handlers.md` slot 8 |

### 1.4 Window chrome — load / layout / draw

**The three wnd# gates (service-handler slots 3, 4, 8).** Every themed
window operation enters the kDEF through one of these three parallel
`GetResource('wnd#', -id)` routers, each scoped to a different window
family. On hit they hand off to **slot 6 `0x28e0`** — the master
compositor that owns the routines tabled below. On miss they fall back to
either a system `'WDEF'` (slots 3, 8) or a private dispatch (slot 4). Full
slot-by-slot trace: `docs/spec/kdef-service-handlers.md`.

| gate | addr | family | wnd# id loaded | msg base into slot 6 |
|---|---|---|---:|---:|
| slot 3 | `0x118b8` | document windows | `-14336` | per `0x28e0` table (1001..1009) |
| slot 4 | `0x1525a` | utility windows | `-14304` | varCode + 1984 |
| slot 8 | `0x17452` | popup / tab / menu | `-12320` | varCode + 1008 (trampolined to a loaded `'WDEF', -14336` by a direct call) |

Slot 6 `0x28e0` is the **master compositor dispatcher** — receives msg
1000 = INIT (called once at table install) + msgs 1001..1009 (per-side
recipe walk + draw). Its 9-entry dispatch fans out to the routines below
(`0x356c`, `0x3680`, `0x3f2c`, `0x41ee`, ...).

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x28e0` | **master compositor dispatcher** (service-handler slot 6) | window-chrome message router; stores its arguments in work-struct fields 454/458/460/464 (454 = the window record, §3.3), dispatches msg-1001 via `0x148` indexed table | args = param, message (1000 init / 1001..1009 verbs), window handle, varCode | `0x2e02` precompute, `0x41ee`, `0x3f2c`, `0x3ac4`, `0x38fe`, `0x3aa8`, `0x3e6c`, `0x436c`, `0x4924` | pops its args on return |
| `0x356c`-`0x367e` | **wnd# loader + 12-step fallback ladder** | `GetResource('wnd#', id)` then progressive low-bit masks (`&-2,-3,-4,-5,-6,-15,-16,-17,-18,-21,-22`) as fallbacks → loads the per-window-type recipe; full decode + landing table in §3.4.1 | arg = the window variation code | `$A9A0` GetResource | returns the recipe handle |
| `0x3680`-`0x38c8` | recipe install / resize | copy the wnd# rect-list into the work struct's rect-list, and the 4 source side-lists into the SOURCE side-lists (162 B stride); loop `s=0..3` calling `0x4a64` | rect-list count; stride = `10*count+12` bytes | `0x4a64` | — |
| `0x487e` | zoom/grow widget predicate | "is there a usable zoom/grow widget" = flag 500 set AND flag 505 set AND flag 496 clear (§3.3) | cinf widget flags | — | boolean |
| `0x49d6` | **part-code jump table** | classify a part code → stretch(1)/fixed(0); see §4 | arg 1 = part code, arg 2 = caller flag byte | helper `0x148`; `0x487e` | byte (1 = stretch) |
| `0x4a0c` | code-10 handler | returns the **caller's flag** (arg 2) unchanged | caller flag byte | — | the flag |
| `0x4a64` | **layout precompute** (per side) | walk source side list, classify each segment, set the title face (`$A888` TextFace, `0x4f18`/`0x4f20`) then measure the title (`$A88C` StringWidth, `0x4f28`), find the title anchor, sum fixed widths, set the two per-half stretch flags, call `0x5178` ×2 (one per half); title-fits gate at `0x4f58` clears the title-fits flag | side index; the source side list; title width; title-fits flag | `0x49d6`, `0x5178`, `$A888` TextFace, `$A88C` StringWidth (names per Traps.h) | fills DEST side list |
| `0x4f58` | title-fits gate | compares the title-room test value against 2; if title doesn't fit → clears the title-fits flag and zeroes the title width (collapse plate) | title-fits flag, title width | — | — |
| `0x4ff8`/`0x501c` | title centring | signed `/2`-with-rounding sequences on the title region bounds (listing detail in evidence) | — | — | center x |
| `0x5178` | **growth distribution** | fill DEST borders: budget = (half extent − Σ fixed widths); each stretch cell gets `budget/numStretch` EVEN, remainder L→R; explicit compare chains classify fill codes (see §4) | args = numStretch, reqWidth (fixed sum), flag byte (title-fits on title path, 1 else) | `0x49d6` (`0x5302`) | DEST `border[i]=border[i-1]+w` |
| `0x5356` | **placement** | per `(side,segIdx)` build SRC rect from the SOURCE side-lists and DST rect from the DEST side-lists; 4-way per-side axis remap. **END-based:** segment i = `[border[i-1],border[i])` tagged `part[i]` | the structure-rect handle (cross-axis); side, segIdx | — | SRC+DST rects |
| `0x572e` | **main draw loop** | per side, per segment: `0x5356` then blit (code 18 → `0x10320`, else `0x0feae`). Never touches the rect-list | side lists | `0x5356`, `0x10320` (`0x59ba`), `0x0feae` (`0x59e8`) | — |
| `0x5ddc` | rect-list widget **hit-test** | GetCIcon (`$AA1E`) of widget id `-14330` (`+32` if flag 506, `+8` more if flag 507), mask → region (`0xf6e0`), OffsetRgn, `PtInRgn` (`$A8E8`) then `PtInRect` (`$A8AD`) → hit result. The entry rect is first remapped to placed coordinates by `0x5cb6` (`0x5f72`). Draws nothing (corrected 2026-10-21, §5.1) | args = point, part, entry rect | `0xf6e0` | hit byte |
| `0x5ffc` | rect-list **hit iterator** | map part 0/1/3 → entry type 1/2/3; walk the rect-list (10-byte entries, type at `+2`, rect at `+4`) from the end; return 1 on the first `0x5ddc` hit. Hit-test only, not a draw pass (corrected 2026-10-21) | args = point, part | `0x5ddc` (`0x6040`) | hit |
| `0x632e` | rect-list **widget draw iterator** | map window part 4/5/6/9 → entry type 1/2/2/3; walk the rect-list from the end; call `0x6062` per matching entry. Called from `0x42a6` (dispatch, caller part) and `0x5a3c` (end of `0x572e`, part 5 only, gated by flags 502 and 508) | args = part, state byte | `0x6062` (`0x637a`) | — |
| `0x6062` | rect-list **widget draw** | dst = the entry rect remapped by `0x5cb6` on all three paths (`0x6138`, `0x62b0`, `0x6308`), then ONE `0x10320` blit. Source: parts 5/6 with flag 502 → GetCIcon(id`+1`) (`0x60aa..0x6146`); state byte ≠ 0 → GetCIcon(id) in the `-14330` family (`0x6158..0x62e0`); **state 0 → no GetCIcon: the chrome template itself, src = raw entry rect** (`0x62f0..0x6318`) | args = part, state, entry rect (template coords) | `0x5cb6`, `0x10320` (`0x6146`, `0x62e0`, `0x6318`) | — |
| `0x5cb6` | rect-list rect **template → placed remap** | for each side, `0x5356` builds the template (src) and placed (dst) cell of each segment. The segment loop starts at index 1 (`0x5d26`), so a side's leading `[0,border[0])` cell is never a match target. The first template cell containing the rect's topLeft (`PtInRect` `0x5d52`) offsets topLeft by placed − template (`0x5d60..0x5d74`); likewise botRight−1 (`0x5d82..0x5da0`). If either corner matches no cell, the rect is emptied (`0x5dc6..0x5dd0`). So widget placement depends on the `0x5178` widths | arg = rect (in/out) | `0x5356`, `$A8AD` | rect |
| `0x5530` | **title draw** (+ text-colour sample) | `GetWTitle` (`$A919`) → title string; `0x6582(idx)` → marker rects; sample TWO ADJACENT chrome-pixmap pixels via `0xfc5c` into a text colour + a shadow colour; at `0x56b2` if the two are EQUAL → one `RGBForeColor`+`DrawString`, else text in colour1 + a ~1px-offset shadow in colour2 (emboss) | the window record (title source), the chrome pixmap, state flag 509 | `$A919`, `0x6582`, `0xfc5c`, `$AA14` RGBForeColor, `$A884` DrawString | — |
| `0x6582` | rect-list lookup by part | scan the rect-list (10-byte entries) for the one whose part field == index arg; else the first | arg = part index | — | pointer to the matching rect |
| `0xfc5c` | **GetPixel** (index→RGB) | sample the chrome pixmap at `(x,y)`: compute bit/byte offset (handles 1/2/4/8-bit depth), extract the colour index, resolve via `0x10702`, write `*outColor` | pixmap, `x`, `y`, `&RGBColor` | `0x10702` (index→clut RGB) | RGBColor |
| `0x4138`/`0x4176`/`0x41d0` | draw/hit dispatch | window-def message handlers calling `0x5ffc` (e.g. grow-box flag 508, body flag 501) | widget flags 508, 501, 500 | `0x5ffc` | part code |
| `0x4778` | structure/content rect | compute the window structure rect (FrameRect source) | window record | — | rect |

> **Title text colour is SAMPLED from the cicn, not from a clut.** `0x5530`
> sets the `DrawString` foreground via two `0xfc5c` (GetPixel) reads of the
> chrome pixmap at a marker rect (from `0x6582`): one pixel = the text colour,
> the neighbour = the shadow colour (drawn as a ~1px emboss when they differ).
> So a scheme encodes its title colour as a small marker SWATCH baked into the
> window cicn — there is NO per-scheme title-colour clut/`wctb` (verified: the
> `-14335`/`-14336` cluts are frame/bevel appearance only, and the `Colr`
> resource is scheme metadata). **Scriptoscope shipped decision:** the exact marker
> coordinate isn't reliably pinnable (the `0x6582(0)` body-rect corners don't
> yield it; the decompile is truncated through `0x6582`/`0xfc5c`), AND every
> corpus scheme draws the classic-Mac default anyway, so `renderWindow.ts` uses
> black (grey when inactive) rather than sampling. The marker path is the
> OVERRIDE for a colour-customising scheme; reopen with one as a test case. Full
> write-up: `docs/tracking/title-text-color.md`.

### 1.5 Blit primitives + 9-slice

| addr | name | purpose | args | callees |
|---|---|---|---|---|
| `0x0feae` | **TILE blit** (default) | tile src across dst along ONE axis, chosen by `srcH == dstH` (`0x10146`, `0x10236`); dir byte selects the anchor end (§5.1). 1px-along-run fast paths `0xff3e`, `0xffba` | arg 1 = the chrome cicn; arg 2 = src rect; arg 3 = dst rect; arg 4 = direction byte (0 for part codes 11 and 14, 1 otherwise; caller `0x59c8`); arg 5 = a long from the caller (alternate source pixmap, `0x1005c`) | `$A8EC` CopyBits / `$A817` CopyMask, `0x1027a` (skip if degenerate) |
| `0x10320` | **single scaled blit** (code 18) | ONE CopyBits (`0x103ea` `$A8EC`) or CopyMask (`0x10402` `$A817`), mapped src→dst (scales if dst grew) | arg 1 = cicn, arg 2 = src rect, arg 3 = dst rect | `$A8EC`/`$A817`, RGBForeColor `0xf30a` |
| `0x102d0` | **corner 1:1 copy** | translate src rect by (dst−src) offset, then `0x10320` → places a corner at 1:1 size | arg 1 = cicn, arg 2 = src rect, args 3/4 = dst origin | `0x10320` |
| `0x107fe` | **cinf body + border engine** | load cicn + cinf, optionally fill body, then paint square corners and independently thick masked edge bands | arg 1 = id, arg 2 = dst rect, arg 3 = text RGB output, arg 4 = emboss RGB output, arg 5 = body-fill flag | `0x116f8` (cinf), `0x10472`/`0xed70` (cicn), `0xfc5c` (GetPixel — sample px → RGB; see §1.4), `0xf930`, `0xfdf8` |
| `0x108a0` | (inside `0x107fe`) | reads cinf corner size (byte[0]) and side thickness (byte[1]); style switch on cinf byte[3] (`== 5` test, then a case 1..4 chain) | cinf: `[0]`=square corner size, `[1]`=independent side thickness, `[3]`=pattern anchor/mode | — |
| `0x10fc0` | face wrapper (controls) | passes body-fill true, forwards its four arguments to `0x107fe` | arg 1 = id, arg 2 = dst rect, args 3/4 = text/emboss RGB outputs | `0x107fe` |
| `0x10fe0` | 9-slice wrapper (window regions) | sibling: loads cicn (`0x10472`) + cinf (`0x116f8`) itself, then slices | arg 1 = id, arg 2 = rect, arg 3 = a caller value (not decoded), arg 4 = alt flag | `0x10472`, `0x116f8` |

Behavioural spec of these primitives: [`engine/qd-primitives.md`](engine/qd-primitives.md).

### 1.6 Resource loaders

| addr | name | purpose | resource | notes |
|---|---|---|---|---|
| `0x10472` | **cicn loader / cache** | `GetCIcon` (`$AA1E` at `0x10434` / `0x10698`); an inline `0x148` sparse switch (`0x104ba`) caches specific control IDs in work-struct cache slots; see the corrected [body dispatch](cinf-resize-behavior.md) | `'cicn'` `1667851118` | the switch enumerates the cached control cicn families (see §2) |
| `0x10420` | cicn slot fetch | `GetCIcon`-by-id into a cached slot if empty | `'cicn'` | helper for `0x10472` |
| `0x10440` | plain ppat load | GetPixPat (`$AA0C` at `0x10460`) | `'ppat'` | mode !=5 body path |
| `0x116f8` | **cinf loader** | `GetResource('cinf', id)` (`1667853926` at `0x1171a`, trap `$A9A0` at `0x11722`), check size (18 / 56); cicn→cinf id range check against -12240 / -12224; for in-range ids, also queries Gestalt selector `'pWin'` (`1884776814`; trap `$A1AD` _Gestalt at `0x11768`, formerly misread as `_Get1NamedResource`; no `'pWin'` resource is loaded) | `'cinf'` `1667853926` | size>18 ⇒ has extended fields; size==56 ⇒ full record |
| `0x106e6` | clut loader | loads `'clut'` (`1668052340` = `0x636c7574`) | `'clut'` | scheme palette |
| `0x33a8`/`0x3be4` | `'Copl'` tag | `'Copl'` (`1131376748` = `0x436f706c`) — the kDEF's private GWorld-tagging clut handle, attached to every GWorld it allocates | `'Copl'` | NOT a scheme resource; internal marker |

A-trap addresses for these calls are in §6.

---

## 2. Resource-ID tables

IDs are signed int16 (negative = the system/scheme resource range). Word-immediate ids
were swept from the listing; the cache-switch IDs were hex-decoded from
`0x104c0`. Cross-checked against `src/controls.ts` `loadById(...)` and the
`themes/*/extraction-manifest.json` conventions.

### 2.1 Window chrome cicns (loaded via the wnd#-driven path, by WDEF-id convention)

The chrome cicn for a window comes in an **active/inactive pair** keyed by the
WDEF id: **active = wndId+1, inactive = wndId+0** (a numeric +1, NOT a name).
Immediates observed (now CORROBORATED against corpus author-supplied NAMED labels — see `docs/spec/corpus-corroborated-ids.md`. n column = bundles agreeing on the role label):

| id(s) | meaning (cicn-template path) | n agree | meaning (corner-sprite path) | n agree |
|---|---|---:|---|---:|
| `-14336` | "Document Window Inactive" | 6 | "Document Window Inactive" | 5 |
| `-14335` | "Document Window Active" | 7 | (not shipped) | — |
| `-14334` | "Inactive Grow Box" | 10 | "Inactive Grow Box" | 5 |
| `-14333` | "Document Window Grow Box Active" | 6 | (not shipped) | — |
| `-14332` | collapsed inactive doc window | 9 | **"Document Window Active"** | 5 |
| `-14331` | collapsed active doc window | 9 | "Document Racing Stripes" overlay | 5 |
| `-14330` | "Document Window Pressed Widgets" | 6 | "Active Grow Box" | 5 |
| `-14328` | "Inactive Dialog" | 8 | — | — |
| `-14327` | "Dialog Active" | 6 | — | — |
| `-14326` / `-14325` | Alert Inactive / Active | 6 / 6 | — | — |
| `-14324` / `-14323` | Movable Dialog Inactive / Active | 6 / 6 | — | — |
| `-14322` / `-14321` | Movable Alert Inactive / Active | 6 / 6 | — | — |
| `-14320`..`-14313` | utility / floating window family (8 ids = 4 type / 2 state) — see corroborated table | — | — | — |
| `-14317` | "Inactive Utility Window Grow Box" | 6 | "Inactive Utility Window Grow Box" | — |
| `-14313` | "Active Utility Window Grow Box" | 6 | "Active Utility Window Grow Box" | — |
| `-14304` / `-14303` | "Titled Utility Window Inactive / Active" | 6 / 6 | — | — |
| `-14296` / `-14295` | "Side Utility Window Inactive / Active" | 6 / 6 | — | — |
| `-14310` / `-14309`, `-14286` / `-14285` | further variants — see corroborated table | — | — | — |

> **The corner-sprite vs cicn-template split** is now provably real (corpus
> author labels). For cicn-template schemes (`1138`, `1984`, `1990`, …, 14
> bundles), the active/inactive pair is `(-14336 inactive, -14335 active)`,
> with `-14332`/`-14331` carrying the COLLAPSED variants. For corner-sprite
> schemes (`apple-platinum-2`, `black-platinum`, `platinum-8`,
> `system7-nostalgia-silver`, 4 bundles), the active doc cicn rides on
> `-14332` (because they procedural-draw the frame coloured by `headerColors`
> rather than 9-slicing a cicn), `-14335` is not shipped, and `-14331`
> carries a racing-stripes overlay sprite. Same numeric range, different
> convention per draw path. The runtime already discriminates correctly via
> `composeCornerSprite.ts`; this table makes the split explicit.

> The wnd# **recipe** id is separate from the cicn id: `0x356c` loads `'wnd#'`
> by the window variation code with low-bit-mask fallbacks; the cicn id is the
> chrome art the recipe indexes.

### 2.2 Control faces + rings (verified against `0x757c`/`0x76c4` + `controls.ts`)

| id | role | source |
|---|---|---|
| `-10239` | push-button face — **normal** | `0x758e` / `controls.ts:500` |
| `-10240` | push-button face — **disabled/inactive** (disabled byte) | `0x757c` |
| `-10238` | push-button face — **pressed** (pressed byte) | `0x7588` |
| `-10232` | default-ring — **inactive** (disabled byte) | `0x76c4` |
| `-10230` | default-ring — **mixed** (pressed byte) | `0x76de` |
| `-10231` | default-ring — **active** (default) | `0x76f4`/`0x7708` |
| `-10176` | bevel-button face base **(?)** | one immediate |

### 2.3 Control cicns CACHED by the `0x10472` switch (`0x104c0`, hex-decoded)

These 18 IDs get dedicated work-struct GWorld cache slots (range lo=-14332,
hi=-8271). They reveal the control families the kDEF expects:

| id | family | id | family |
|---|---|---|---|
| -14332/-14331/-14330 | collapsed window | -10208/-10207/-10206/-10205 | **slider** (track/thumb v+h) |
| -12288/-12287 | menu bg / menu highlight | -8286/-8285 | **scrollbar** horiz (inactive/active) |
| -12272 | menu accent | -8278/-8277 | scrollbar vert (inactive/active) |
| -10224/-10223 | **progress bar** — beos 2-part (track/fill, no frame) | -8272/-8271 | scrollbar **thumb ghost** (drag preview) |

### 2.4 Slider / scrollbar / popup IDs (from immediates + `controls.ts`)

| id range | element | detail |
|---|---|---|
| `-10208`..`-10197` | **slider** part table (12 parts) *(1.8.2-era reading; in 2.3.1 these ids are the scroll bar's: cicn `-10208..-10205` thumbs, icons `-10208..-10205` disabled arrows, icons `-10204..-10197` arrows — `docs/spec/engine/scrollbar.md` TH3/TH4, AI1–AI3)* | track + directional thumb variants; `0x4f7e`-era stores 12 ids (1.8.2-era, see §2.6) |
| `-10205`..`-10208` | scroll-bar **thumbs** (cicn) h+v *(corrected 2026-10-22, #374: formerly "slider thumb/track", with a pointer to `controls.ts:166`, which no longer holds this code)* | thumb -10206 h / -10208 v, pressed (hilite 129) -10205/-10207 (`docs/spec/engine/scrollbar.md` TH3/TH4; runtime: `src/engine/tables/scrollbar.ts` `SCROLLBAR_THUMB_ID`) |
| `-10197`..`-10204` | **Scroll-arrow icon family** (drawn from `ics#` then `ics8` from the same file, or the 1-bit `ics#`; **never `ics4`, never `cicn`** — corrected 2026-10-21, `docs/spec/engine/scrollbar.md` AI4) — directional ARROW BUTTONS (each a whole 16×16 button: face + arrow + bevel) | `controls.ts composeScrollbar` (keep in sync with that code comment). **RAISED / normal:** right `-10201` · left `-10202` · down `-10203` · up `-10204`. **PRESSED:** right `-10197` · left `-10198` · down `-10199` · up `-10200`. **This split is UNIVERSAL, not per-scheme** — the scheme forks carry no CDEF/control template (only art), so the mapping lives in Kaleidoscope's shared CDEF. Decoded at `0x9f0e..0x9f38`: the CDEF writes BOTH ids per direction into the control record (offsets left 24/26, up 28/30, right 32/34, down 36/38) and picks by `contrlHilite` at draw time — PRESSED id for the held arrow, RAISED for the rest; a disabled control dims the RAISED art (there is **no separate inactive-arrow bitmap** — the 12-id part table is 8 arrows + 4 thumb `-10205..-10208`). *(Superseded 2026-10-21: a disabled control draws the icons `-10206/-10205` h, `-10208/-10207` v (`0xc7ba..0xc7fa`), so `-10208..-10205` also serve as disabled-arrow icon ids; an inactive control draws no arrows.)* Scheme art APPEARANCE of each quartet varies (s7 raised = beveled 3-D, platinum-8 raised = boxed gray button / its pressed = flat arrow). **(Corrected 2026-05-26 — the two quartets were previously swapped, so resting scrollbars showed depressed arrows. Owner chose to follow the 2.3.1 decode universally; platinum-8 — a 1998/1.x scheme — placed art the other way, so it renders its boxed `-10202` at rest, diverging from its own preview; logged in the faithfulness ledger.)** |
| `-8288`/`-8280` | scroll-bar track **tier 0, inactive** (h/v) *(corrected 2026-10-22, #374: formerly "scrollbar pressed"; pressed is tier 3, -8285/-8277)* | track bases at `0xa032..0xa03e`, id = base + tier (0 inactive, 1 disabled, 2 normal, 3 pressed), `docs/spec/engine/scrollbar.md` §4.2 |
| `-8272`/`-8271` | scrollbar thumb ghost | drag preview |
| `-9504` | checkbox empty inactive | `controls.ts:573` (radio/checkbox -9488..-9504) — **corpus-corroborated as kDEF-canonical** (`docs/spec/corpus-corroborated-ids.md` — 1138 author-labels the family); strike the earlier "computed, not a kDEF immediate" speculation |
| `-12320`/`-12319`/`-12318`/`-12317` | **popup MENU window** chrome (frame / tab / disabled-frame / disabled-tab) — author-label "Popup Window Active¥" n=6 | `composeChrome.ts` (window-type dispatch) |
| `-8194`..`-8208` | **popup BUTTON** control family (small + large × normal / pressed / inactive, arrow vs text vs arrow-only) — author-labeled in 1138; **distinct from popup-MENU above**; the earlier conflation with `-12317..-12320` was wrong | not yet wired (no current consumer) |
| `-9972`/`-9975` (SSF), `-9980`/`-9983` (LSF) + `-9969`/`-9977` pane | **segmented TAB control** (real pane tabs): front/"on" (selected, taller) vs rear/"off" (shorter) trapezoid + tab pane | `controls.ts composeTab`. NOT an On/Off toggle — that is a flat 2-segment control, drawn separately |
| `-10080`/`-10078`/`-10079` · `-10223`/`-10224` | **progress bar**: 3-part frame/track/fill (most schemes) · 2-part track/fill, no frame (`-10223` author-labeled "Progress Bar: Lavender" n=6) | `controls.ts composeProgress` |
| `-12304`/`-12303` | popup variant **(?)** | immediates |

> **Resolution (2026-05-25 — verified against the actual `cicn` *and* `ics4`
> pixels in all three pictogram schemes: apple-platinum-2, platinum-8,
> system7-nostalgia-silver).** The old `kdef-layout-recipes.md` was not wrong to
> tie checkbox/radio to `-10238`/`-10231/-10232`; it conflated two resources that
> share one numeric id. **A negative id carries BOTH a `cicn` (body raster) AND an
> `ics4` (pictogram overlay), and they are different controls:**
> - `cicn` `-10239`/`-10238`/`-10240` = **push-button face** (normal/pressed/disabled);
>   `cicn` `-10231`/`-10232`/`-10230` = **default-button ring** (active/inactive/mixed).
>   This is the channel the 2.3.1 kDEF draws (verified §2.2) — correct.
> - `ics4` `-10229..-10240` = **checkbox** glyphs (empty / ✓ / – / ✕ × active·pressed·
>   disabled); `ics4` `-10214..-10224` = **radio** glyphs (off/on/mixed × states);
>   `ics4` `-10197..-10204` = scroll/slider directional **arrows** (R,L,D,U × raised·pressed
>   — see §2.4 row; raised = `-10201..-10204`), `-10205..-10208` = slider **thumb** (h/v ×
>   normal·pressed) — there is NO separate inactive-arrow art; *(corrected 2026-10-21: the
>   2.3.1 scroll-bar CDEF draws these arrows from `ics#`/`ics8`, never `ics4`, and uses the
>   icons `-10205..-10208` as disabled arrows; the cicns `-10205..-10208` are the scroll thumbs)*
>   `ics4` `-14315..-14320` / `-14331..-14336` = utility / document window **widget**
>   glyphs. These are the scheme-supplied control *pictograms*.
> The CICN selector at `0x7234–0x7282` explicitly adds `−9504` at `0x724c`/`0x7278`:
> `id = −9504 + 12×kind + 3×value + tier`. Kind is checkbox0/radio1
> (`0x6740–0x676a`); value is ControlRecord+18 (`0x71ec–0x71f0`);
> tier is normal1/pressed2/disabled0 (`0x71f6–0x7208`, disabled wins).
> Value2 therefore requests mixed CICN checkbox −9497/−9496/−9498 and radio
> −9485/−9484/−9486 for normal/pressed/disabled. On a missing value2/3 CICN,
> `0x7264` changes only value to1 before retrying at the same kind/tier.
> This establishes selector arithmetic, not the actual provider/cache or native
> pixel result. Public `mixed` takes precedence over `checked`; that Boolean
> mapping is an API policy. The later active-checked compatibility fallback and
> existing icon fallback are not certified by this arithmetic. The full
> two-channel id→role map is the **pictogram ID rubric** rendered in
> `demo/diagnostic.html` `iconInventory` (and reproduced for authoring in the asset catalog).
>
> **GENERATED MANIFEST:** the decoded id→role for EVERY resource a theme ships is now
> emitted per-theme to `themes/<slug>/resource-roles.json` (`scripts/gen-resource-roles.mjs`,
> in `build:themes`) — each entry has `{id, type, slug, family, role}` honouring the
> cicn/ics4 dual channel, plus a resolved `progress` model (lavender-2-part vs role-3-part)
> and `scrollArrows` mapping. Read that instead of guessing a resource's role from its
> filename slug (the recurring bug: same id, different role per scheme + per channel).

### 2.5 cinf id range + clut/Colr

| id / range | meaning |
|---|---|
| `-12240` .. `-12224` | **cinf id range** (`0x116f8` range check against -12240 / -12224). For ids in this range the kDEF queries Gestalt selector `'pWin'` (`0x11768`, `$A1AD` _Gestalt; not a resource load). |
| `'cinf'` per element | the per-element info record (corner insets + colours). See §3.5. |
| `'clut'` (`0x106e6`) | scheme colour table. |
| `'Copl'` | internal GWorld tag, NOT a scheme resource (do not extract). |
| `-12345` (`0xCFC7`) | **NOT a resource id** — a sentinel transfer-mode marker written into a pixmap field at `0xff62`/`0x10954`. Ignore in any id sweep. |

### 2.6 Control families known only at `[DOC]`/1.8.2 confidence (folded from the retired `kdef-layout-recipes.md`)

These families were decoded against the **1.8.2** kDEF (a *different* binary —
its drawer addresses, e.g. `0x30a8`/`0x66b4`, do **not** map to 2.3.1's
`0x6688`/`0x7424`) and/or come from the period "Creating Color Schemes" authoring
doc. They are **NOT 2.3.1-instruction-verified** — treat as `[DOC]`/`[DRAWER]`.
What carries over reliably is the **resource-ID convention** (version-independent)
plus the behavioural notes; the 2.3.1 *layout arithmetic* is a gap (§7.4/§7.9).

| family | cicn / ppat ids | behaviour (period `[DOC]`) |
|---|---|---|
| **progress bar** | frame `-10080` (active) / `-10077` (inactive); track `-10075`; barber-pole `ppat -10064` (accent variants `-10063..-10057`) | determinate = frame 9-slice + accent-ramp fill; indeterminate uses only the top ~10px of the ppat, tiles the whole bar, shifts it **+4px right each draw** |
| **menu / menu bar** | bg `-12288` / highlight `-12287` / accent `-12272`; accent menu-highlight cicns+ppats start `-12256` | menu bar + backgrounds are `ppat` fills; highlight is an accent cicn/ppat overlay |
| **disclosure triangle** | `-10102..-10112` (right/down × normal/pressed/inactive) | fixed-size state glyphs stamped 1:1; 5-frame rotation animation. (NB: this range is sometimes mislabelled as "scroll arrows" in bundles — the real scroll arrows are baked into the composite scrollbar cicn.) |
| **bevel button** | base `-10176`, variants `-10174..-10150`; mixed `-10232/-10231` | "same format as the push-button cicns" — 9-sliced like §1.2 |
| **grow box** | (uses the doc-window corner glyph `-14334/-14333`, §2.1) | bottom-right-anchored; sizes 15×15–21×21 (doc window) / 14×14–18×18 (utility); a mis-sized 17×17 scales to fit |

Behavioural `[DOC]` notes that have no 2.3.1 trace yet but constrain the layout:

- **Popup/tab** (ids in §2.4): *"draws the four corners of the frame from the
  cicn, stretches the single row/column between the grow regions for the sides,
  then stamps the tab on top — stretching the middle column (which includes the
  text-colour pixel) to fit the title. The **bottom six pixels of the tab cicn
  overwrite the top six pixels of the frame.**"*
- **Scrollbar** (ids in §2.3/§2.4): small-bar special case — when bar width < 17px
  the layout collapses/centres; the track is a **1px row/column stretched** between
  the fixed arrow boxes; accent thumbs start at `-9472`.

---

## 3. Struct / coordinate offset maps

### 3.1 The CDEF per-call state blob (built in `0x6688`; the first argument of `0x7424`)

Built by `0x6688` and passed to the part drawers. Confirmed fields (byte
offsets in evidence):

| field | meaning | set/read at |
|---|---|---|
| disabled byte | **disabled/inactive** state byte | `0x7576`/`0x75a6` (face), `0x76b8` (ring) |
| pressed byte | **pressed/mixed** state byte | `0x7582` (face), `0x76d2` (ring) |
| control rect | control **Rect** (long pair → top/left, bottom/right), copied into drawer locals | `0x7434`/`0x743a` |
| scratch byte | scratch / "drawing in progress" byte | `0x75ca`/`0x75de` |
| (via ControlHandle → record → contrlData handle → aux) | the **'Acid' aux struct** | `0x768c`-`0x76a8` |

The dispatcher (`0x6688`) precomputes these per-call flags from varCode/handle:
two kind flags (cleared for varCode∈{1,2,3,4}; the second is the radio hint
used by msg 34), an active flag (= varCode bit3), a b/w-vs-color flag, a
variant value (1 for varCode 6, 2 for varCode 7), one cleared word, and a flag
set for varCode 3/4.

### 3.2 The 'Acid' aux struct

Reached ControlHandle → record → contrlData handle (record +28) → aux. Magic at
`+0` = `0x41636964` `'Acid'` (`0x76a8`). Field `+30` = **default-button flag**
(tested at `0x76b2`). Both gate whether the default ring (`0x76c4`) draws. (The
brief's "+30 of the state blob" refers to this same flag once the aux handle is
dereferenced.)

### 3.3 Window-chrome work struct (the kDEF globals)

Fields are named by meaning; work-struct offsets are in evidence. The widget
flags whose meaning is only inferential (§7.6) keep their decimal work-struct
offset as a **label** (e.g. "flag 500") so cross-references stay unambiguous.

| field | meaning |
|---|---|
| rect-list | rect-list count + base (named-widget rects, 10-byte entries) |
| DEST side-lists | **DEST** side-lists (window-relative borders), 4×162 B |
| SOURCE side-lists | **SOURCE** side-lists (cicn-template borders), 4×162 B, one per side 0..3 |
| window record | window record / port handle (also the title source for `0x5530`) |
| chrome cicn | the chrome template cicn / pixmap the side cells and state-0 widgets blit from |
| flags 496 / 505 / 500 / 501 | cinf widget-presence flags (close/zoom/shade/body) — feed `0x487e`, `0x49d6`, the draw dispatch (`0x4124` tests flag 508, `0x4168` tests flag 501) |
| flag 508 | grow-box present flag |
| flags 502 / 503 / 506 / 507 / 509 | further widget / state flags; meaning not established (§5.1 "Still open") |
| render-mode flags (three bytes) | render-mode flags consulted by the 9-slice/`0x10320` (b/w vs color, mask vs copy) |
| cicn cache table | cicn cache table base (the 18-slot GWorld cache from `0x10472`) |

### 3.4 The recipe / border list layout

Per side, a 162-byte block: `count` at the block base, then
entries. Each entry = **`{partCode:int16 @ +2, border:int16 @ +4*i+4}`** indexed
by `4*i`. Walking gives cells **`[border[i-1], border[i])` tagged `part[i]`**
(END-based — the part code travels with the border that CLOSES the cell;
`0x5356`, confirmed in `compositor-spec.md`). Segment loop starts at index 1, so
`[0, border[0])` is the fixed leading **corner** (drawn 1:1), and
`[border[N-1], srcExtent)` the trailing corner. SOURCE borders are cicn-template
coords; DEST borders are window-relative (filled by `0x5178`).

#### 3.4.1 wnd# fallback ladder (`0x356c..0x367e`)

**Decoded 2026-05-29** against the listing. The
kDEF doesn't give up when `GetResource('wnd#', d3)` returns NULL — it walks a
12-step degraded-id cascade, ANDing `d3` against a fixed mask sequence and
re-attempting until a handle resolves. Each step requests `'wnd#'` at
(raw id AND mask) through `_GetResource` and, on a non-null handle, skips the
rest of the cascade (per-step listing excerpt in evidence).

Decoded mask sequence (step `i` ends at the `_GetResource` trap on the cited
addr; "bits cleared" is the bitmask interpretation — what each AND strips from
the 16-bit unsigned window variation code):

| step | addr | mask (hex) | bits cleared | role |
|---:|---|---|---|---|
| 0 | `0x3574` | `0xFFFF` | none | raw id (no degradation) |
| 1 | `0x358c` | `0xFFFE` (`& -2`) | bit 0 | strip bit 0 |
| 2 | `0x35a4` | `0xFFFD` (`& -3`) | bit 1 | strip bit 1 |
| 3 | `0x35bc` | `0xFFFC` (`& -4`) | bits 0–1 | strip bits 0+1 |
| 4 | `0x35d4` | `0xFFFB` (`& -5`) | bit 2 | strip bit 2 |
| 5 | `0x35ec` | `0xFFFA` (`& -6`) | bits 0+2 | strip bits 0+2 |
| 6 | `0x3604` | `0xFFF1` (`& -15`) | bits 1–3 | strip bits 1+2+3 |
| 7 | `0x361c` | `0xFFF0` (`& -16`) | bits 0–3 | strip bits 0+1+2+3 |
| 8 | `0x3634` | `0xFFEF` (`& -17`) | bit 4 | strip bit 4 |
| 9 | `0x364c` | `0xFFEE` (`& -18`) | bits 0+4 | strip bits 0+4 |
| 10 | `0x3664` | `0xFFEB` (`& -21`) | bits 2+4 | strip bits 2+4 |
| 11 | `0x367c` | `0xFFEA` (`& -22`) | bits 0+2+4 | strip bits 0+2+4 |

After `0x367e` the code clears 5 work-struct fields (the 4 SOURCE side-list
pointers + the rect-list count) then tests the returned handle; still-null at
`0x36a0` branches to `0x373e` (the "no recipe" failure path).

**Translated to canonical wnd# slugs** (the kDEF id grid — see §2.1 / Apple
`MacWindows.h` defProcID conventions):

| id | slug | cascade landing (unique steps after raw) |
|---:|---|---|
| `-14336` | document-window | (terminal) |
| `-14332` | collapsed-document-window | → `-14336` |
| `-14328` | dialog | → `-14336` |
| `-14326` | alert | → `-14328` → `-14336` |
| `-14324` | movable-modal | → `-14328` → `-14336` |
| `-14322` | movable-alert | → `-14324` → `-14326` → `-14336` |
| `-14304` | titled-utility-window | (terminal — utility family) |
| `-14300` | collapsed-titled-utility-window | → `-14304` |
| `-14296` | side-floating-utility-window | → `-14304` |
| `-14292` | collapsed-side-floating-utility-window | → `-14296` → `-14304` |
| `-14288` | no-title-utility-window | → `-14304` |
| `-14284` | collapsed-no-title-utility-window | → `-14288` → `-14300` → `-14304` |
| `-12320` | popup-window | (terminal — no canonical landing on the mask grid) |

The cascade encodes two structural decisions: **document-family ids degrade to
`-14336`** and **utility-family ids degrade to `-14304`**. `popup-window`
(`-12320 = 0xCFE0`) is intentionally OUTSIDE the mask grid — none of the strips
produce another canonical id, so a missing popup is a genuine miss.

**2.3.1-only enhancement.** The 1.8.2 kDEF (60,732 B) has **zero** `'wnd#'` FourCC literals anywhere in `kDEF 0`
(cross-checked by binary grep on both extracted blobs); the cascade — and the
wnd# resource model itself — were introduced in 2.3.1.

**Runtime mirror.** `src/wndCascade.ts` is the clean-room replay; consulted by
`src/renderWindow.ts:resolveWindowType` immediately after exact-slug match.
Audited corpus impact (verified by running `loadKaleidoscopeScheme` over each
bundle's source archive and diffing the old heuristic resolver against the
cascade): 16 of 18 bundles ship at least one missing canonical collapsed-* /
no-title-utility slug that the cascade resolves into the bundle's structurally-
compatible parent. Concrete deltas the cascade corrects (the three visual
baselines that shifted when the helper landed):
- `crayon-os` · `collapsed-no-title-utility` was falling to `titled-utility-window`; now resolves to `collapsed-titled-utility` (preserves the windowshade state)
- `windows-31` + `windows-95` · all four utility-family slugs were falling to `movable-modal` (a dialog!); now resolve into the utility family (`titled-utility-window` / `side-floating-utility-window`) per the kDEF's cascade

### 3.5 cinf byte layout (`0x108a0` + `0x116f8`)

**Lookup before layout:** `0x10860/0x10862` restores the caller’s resource file
before the cinf lookup. `0x1086e–0x10878` requests the same ID through `0x116f8`;
a null result retries cinf 0 for body=true or cinf 1 for body=false at
`0x10880–0x10898`. A second null result branches `0x1089a → 0x10fa8`, skipping
this body/border stage. The trap is `$A9A0` **GetResource**, not `$A81F`
**Get1Resource**. The selected cicn owner therefore does not establish the cinf
provider. See the [conditional lookup contract](cinf-lookup-contract.md); it does
not infer historical provider order or synthesize runtime defaults.

**Authoritative source:** every bundle in the corpus ships **TMPL 129 `cinf`** — Kaleidoscope's own ResEdit/Resorcerer template that documents the byte layout the kDEF reads. Every "(?)" entry below is now resolved against TMPL 129:

| byte | TMPL 129 field name | kDEF use | evidence |
|---|---|---|---|
| `[0]` | **Corner Size** | square corner size (the corner inset) | byte read @ `0x108a8` |
| `[1]` | **Side Thickness** | independent edge thickness (the side inset) | byte read @ `0x108b0` |
| `[2]` | **Tile Sides** | (boolean: full-band repeat vs first middle column/row) | TMPL 129 (was "(?)" — now confirmed) |
| `[3]` | **Pattern Anchor** | body resource/phase selector (NOT a 1..15 enum) | the `== 5` test at `0x109be` selects a cicn body at `=5`; otherwise loads a ppat and the case chain at `0x10ab2` dispatches cases 1..4 → anchor body pattern phase at dst-rect corner TL/TR/BL/BR (reads the dst rect's top/left/bottom/right); default (0 or ≥6) → anchor at origin `(0,0)`. Full decode + corpus survey in `docs/spec/cinf-resize-behavior.md`. |
| `[4..5]` | **Background Pattern ID** (DWRD) | signed resource ID: cicn for mode5, ppat otherwise | TMPL 129 / [body dispatch](cinf-resize-behavior.md) |
| `[6..7]` | **Background Pixel y** (DWRD) | sample-pixel coordinate | TMPL 129 |
| `[8..9]` | **Background Pixel x** (DWRD) | sample-pixel coordinate | TMPL 129 |
| `[10..11]` | **Text Pixel y** (DWRD) | text marker | TMPL 129 |
| `[12..13]` | **Text Pixel x** (DWRD) | text marker | TMPL 129 |
| `[14..15]` | **Embossing Pixel y** (DWRD) | embossing marker | TMPL 129 |
| `[16..17]` | **Embossing Pixel x** (DWRD) | embossing marker | TMPL 129 |
| `[18..]` | binary-internal pixel-sample cache, NOT on-disk data: byte[18] = pWin-back-patched word (for cinf ids in `-12240..-12225`); bytes[20..55] = 6 × `RGBColor` slots (active bg/text/emboss + inactive bg/text/emboss) written by `0xfc5c` at load. The kDEF grows the handle to 56 bytes via `_SetHandleSize` regardless of disk size and never reads bytes 20..55 from disk. Scheme Factory STR# 135 entries 8/9 ("Translucency / Opacity Percentage") are editor-UI controls the 2.3.1 binary does NOT consume — verified by full-binary grep + 1032/1033 corpus cinfs ship 18 bytes. Full trace + corpus survey: `docs/spec/cinf-extended-decode.md`. | size checks at `0x11740`/`0x11796` |

The TMPL is **shipped in 16 of 18 corpus bundles** — recoverable any time via `scripts/dump-author-hints.mjs` (`TMPL` resource id 129). The recipe-walk's `cinf` summary in `compositor-spec.md` (`cornerSize`/`sideThickness`/`tileSides`/`patternAnchor`/`textPixel`) is the loader's decoded field names; the TMPL 129 names above are the kDEF developer's own.

### 3.6 Rect layout

Mac `Rect` = 4× int16 in order **`{top, left, bottom, right}`** at `+0/+2/+4/+6`.
`0x0feae`/`0x10320` read the rect fields in that order (e.g. at `0xfec2` the
right edge is compared to the left). Dst and src rects are passed by pointer
(tile/scale blit args 3 and 2); the 9-slice computes the four corner sub-rects
by adding/subtracting the cinf insets to the outer rect (`0x10a28`-`0x10a34`:
left += corner size, top += side thickness, right −= corner size, bottom −= side
thickness). See [`engine/qd-primitives.md`](engine/qd-primitives.md) §2 / §6
item 6 for the reconciliation note on these insets.

---

## 4. The part-code jump table (`0x49d6`) + fill classifier (`0x5178`)

Two stacked decisions, both keyed on the **part code** (never on pixel content
or width). Reconciled with `compositor-spec.md`'s table — they agree.

### 4.1 `0x49d6` — stretch-vs-fixed flag (jump table via helper `0x148`)

Takes `(partCode, flag)` and returns a byte (1 = may stretch, 0 = fixed). Verified entries:

| partCode | target | behaviour |
|---|---|---|
| default (1,5,6,7,8,9,11,12,13,14,18,…) | `0x4a5e` | returns 0 → **FIXED** |
| 0 | `0x4a12` | **STRETCH** always |
| 2 | `0x4a16` | stretch iff the window record's +112 field `== 0` (widget ABSENT — close gap) |
| 3 | `0x4a24` | stretch iff flag 501 `== 0` (zoom gap) |
| 4 | `0x4a2e` | stretch iff `0x487e()==0` (shade gap) |
| 10 | `0x4a0c` | returns the caller's `flag` (arg 2) — flag-gated |
| 15 | `0x4a3a` | stretch iff the window record's +112 field `!= 0` (widget PRESENT — inverse of 2) |
| 16 | `0x4a48` | stretch iff flag 501 `!= 0` (inverse of 3) |
| 17 | `0x4a52` | stretch iff `0x487e()!=0` (inverse of 4) |

### 4.2 `0x5178` — fill classifier (explicit compare chains, NOT the table)

The width-assignment loop (`0x5260`-`0x534a`):

| partCode | behaviour | addr |
|---|---|---|
| 12 | **TILE** — `dstW = floor(slack/numStretch / srcW) * srcW` (whole tiles) | `0x5266`-`0x5292` |
| 8, 11, 18 | **STRETCH (grow)** — `share = sVar5/sVar6 + slack/numStretch` | `0x529e`-`0x52d6` |
| 13, 14 | **STRETCH** smaller share (`sVar5/sVar6`, no slack term) | `0x52da`-`0x52f8` |
| else | call `0x49d6(pc,flag)`: nonzero → leave width 0 (budget participant); else FIXED `dstW=srcW`; **except** pc∈{5,6} AND flag==0 → width 0 (collapse) | `0x52fc`-`0x532a` |

So **codes 5/6** (title bezel) are FIXED when the title fits (`flag`=`fp@(-290)`
title-fits, pushed at `0x5100`/`0x5120`) and **collapse to 0** when it doesn't —
they never grow. Budget = `slack = (srcBorder[end]−srcBorder[start-1]) − reqWidth`
(`0x518a`); the primary divisor counts only 8/11/12/18 (`0x4b3e`), while 8/11/13/14/18
share the division and whole-tile remainder. Each remainder share is truncated
against the number of recipients still to visit, so extra pixels accumulate at
the END of the walk (3/3/4 for a budget of 10 and three ordinary growers); symmetric
about the title because `0x4a64` calls `0x5178` twice (per half, split at the
title anchor).

> This SUPERSEDED the retired `kdef-layout-recipes.md §1/§11.x` (the dead 1.8.2
> reading: a grow set `{5,6,8,18}` + a pixel-variance plate search).
> Fixed-vs-stretch is the part code, full stop.

---

## 5. Blit primitives (arg conventions)

| primitive | addr | call form | semantics |
|---|---|---|---|
| TILE | `0x0feae` | `feae(cicn, srcRect*, dstRect*, dirByte, pixmap)` (`fp@8/12/16/20/22`) | tile along the side's run axis, one src-sized CopyBits/CopyMask per step. `dir` = anchor end, NOT axis: 1 = forward from dst top-left, 0 = reverse from dst bottom-right (`(pc==11\|\|pc==14)?0:1`). See §5.1. **Always tiles; never scales.** |
| SCALE | `0x10320` | `(cicn, srcRect*, dstRect*)` | ONE CopyBits (`$A8EC`)/CopyMask (`$A817`) src→dst → scales if dst grew. Used for partCode 18 (`0x59ba`) and named-widget rects (`0x6062`). |
| CORNER 1:1 | `0x102d0` | `(cicn, srcRect*, dstX, dstY)` | shift src by dst−src, call `0x10320` → 1:1 placement |
| BODY + BORDER | `0x107fe` | `(id, dstRect*, textRGB*, embossRGB*, bodyFill)` | square corners from byte[0], independent side bands from byte[1], optional body; see [solid face geometry](control-face-geometry.md) |
| FACE wrap (control) | `0x10fc0` | `(id, …)` passes bodyFill=true → `0x107fe` | push face (`0x7594`) and bevel (`0x7778`); ring uses false via `0x107de` |
| 9-SLICE wrap (window) | `0x10fe0` | `(id, rect, callerValue, altFlag)` (third argument not decoded) | loads cicn+cinf itself, then slices |
| RING blit | `0x107a4` | `(id, dstRect*, flag)` | the default-button ring 9-slice (its own wrapper over the slice engine) |

---

### 5.1 `0xfeae` tile blit: argument frame, axis and direction byte (traced 2026-10-21)

Traced statically from the kDEF 0 listing (sha256 of the resource in
[kdef-binary-inventory.md](kdef-binary-inventory.md); listing provenance in
evidence). No original code was executed. Earlier rows in §1.5 and §5 put the
direction byte in the first argument slot and called it a horizontal/vertical
selector. Both were wrong. Behavioural restatement:
[`engine/qd-primitives.md`](engine/qd-primitives.md) (tables T1–T7, W1–W3).

**Caller arguments (`0x59c6..0x59ee`).** The window draw loop passes, in call
order: the chrome cicn, the src rect, the dst rect, the direction byte, and a
long passed through from the caller (18 bytes of arguments in all). The src/dst
roles match `0x5356`, which builds the src rect from the template borders (the
SOURCE side-lists) and the dst rect from the placed borders (the DEST
side-lists).

**`0x5356` fixes the cross axis.** On sides 0 and 1 (top, bottom) it sets
dst height = src height (`0x539c..0x53a6`, `0x5404..0x540c`). On sides 2 and 3
(left, right) it sets dst width = src width (`0x5470..0x547c`,
`0x54da..0x54e6`). The run-axis bounds come from the border lists. A placed
cell therefore differs from its source only along the run.

**Fast paths (direction-independent).** These run before the direction byte is read:

- `0xff3e..0xffb6`: src width 1 and dst width > 1. For each source row
  (rows map 1:1), sample the pixel (`0xf9f6`), then MoveTo/LineTo across the
  dst width.
- `0xffba..0x10018`: src height 1 and dst height > 1. The same, one source
  column per dst column.

Because of `0x5356`, these fire only for a source that is 1 px along the run.

**General path.** The tile is src width × src height (`0x10036..0x10042`).
The direction byte, tested at `0x10074`, chooses the branch:

| byte | code | first tile | partial-tile clip | step (`0x10146` / `0x10236`) | loop exit |
|---|---|---|---|---|---|
| 1 | all non-18 except 11/14 | at dst top-left (`0x10088..0x10098`) | far end: trims src right/bottom, keeps the leading src columns/rows (`0x100a0..0x100f6`) | `srcH != dstH` → `top,bottom += srcH`; else `left,right += srcW` | `left >= dst.right` or `top >= dst.bottom` (`0x10162..0x10176`) |
| 0 | 11, 14 | at dst bottom-right (`0x1018a..0x1019a`) | near end: trims src left/top, keeps the trailing src columns/rows (`0x1019e..0x101fa`) | same test, but subtracts | `right <= dst.left` or `bottom <= dst.top` (`0x10252..0x10262`) |

Each step does one blit of the clipped tile. When the port's `grafProcs`
(`port+92`) is non-nil, that blit is CopyBits (`$A8EC`) srcCopy with no mask.
That copy is opaque: transparent source pixels overwrite what is underneath.
Otherwise it is CopyMask (`$A817`) (`0x1010e`/`0x101fe`). Only the forward
branch first culls a tile against the bbox of `thePort`'s clipRgn
(`0x100fa..0x1010c`; bbox read at `0xff06..0xff12`). The listing shows only
the cull. That the cull changes no pixels is an inference from Toolbox
clipping semantics.

**Answer to "what does the byte select".** It selects the tile anchor and copy
order. It does not select the tiling axis. The axis comes from `srcH == dstH`.
With `0x5356` fixing the cross axis, horizontal sides always step horizontally.
Vertical sides step vertically. The one exception is a run exactly `srcH` long,
where both branches draw one identical full copy. So:

- **Code 8 on a vertical side** (and every other non-18 tile cell, codes 8, 12,
  13 and the default/fixed classes, on any side) tiles along the run from the
  top (or left). Source offset 0 is at the dst start, and the final partial
  tile keeps the source's leading pixels.
- **Codes 11 and 14 on any side** tile along the run from the far end, right
  on top/bottom and bottom on left/right. Source offset `srcLen-1` is at the
  last dst pixel. The partial tile at the near end shows the source's trailing
  pixels. A remainder cell shorter than its source shows its last `dstLen`
  pixels.

As a formula, dst index `k ∈ [0, dw)` of a cell with source length `sw` reads
source offset `k % sw` forward and `sw - 1 - ((dw - 1 - k) % sw)` reversed.
The two coincide when `dw` is a multiple of `sw`.

A structural consequence (not original-engine evidence): forward cells keep the
template adjacency `s0-1 | s0` at their near boundary. 11/14 cells keep
`s1-1 | s1` at their far boundary instead.

For a 1 px run, both branches are direction-independent (every tile is the
same source pixel), and so are the fast paths. The fast paths draw with
RGBForeColor and LineTo, and only where `0xf9f6` returns nonzero. Whether
their pixels are identical to the general path's CopyMask is not shown. The
PR #367 1px-only check could therefore not tell the two readings apart.

**A second consumer of the same byte.** `0x6390` also walks the side lists and
passes the same byte (0 for codes 11 and 14, 1 otherwise) to `0x11452`
(`0x651c..0x653c`). That routine
and what it draws are not traced here.

**Corpus scope** (13 wnd# archives, every sliced type, sampled at template
+97 × +33 with the runtime cell placement, cell index 0 skipped). Script and
output are in the private store `campaign-20261021/lanes/H/`. Counts are
**per state**, so each cell is counted once for active and once for inactive.

- Code 11: 38 horizontal rows, all 1 px (direction-neutral). 6 vertical rows,
  4 with varying >1 px sources: animals `side-floating-utility-window` right
  (15 px) and `collapsed-no-title-utility` left (3 px), that is 2 cells.
- Code 14: 6 horizontal rows, 4 varying: animals `document-window` and
  `collapsed-document-window` bottom (6 px), 2 cells. 6 vertical rows, 2
  varying: monkey-paradise `document-window` right (4 px), 1 cell.
- Code 13: 28 horizontal rows, 6 varying and phase-sensitive (animals). They
  are forward under the trace and the runtime alike, so they are not a
  divergence.
- Code 8: 678 horizontal and 512 vertical rows. 205 and 140 of them have a
  varying >1 px source and need the forward anchor.

So five cells (× 2 states) are where the byte is visible.

**Runtime and checker (2026-10-21).** `drawTile` in `src/composeChrome.ts`
now takes the anchor from the part code: 11/14 tile from the far end, and
every other tile cell from the start. There is no per-theme branch.
`tests/rendering-options/window-chrome-rules.mjs` asserts the formula above
for every non-18 cell, unknown-class cells included, over the runtime-placed
width. It counts 1 px, whole-copy, forward >1 px and reverse >1 px pixels
separately, and checks opaque source pixels only. Opaque CopyBits and the
CopyMask-over-earlier-sides order are not modelled. Nonzero forward/reverse
counts do not show that an archive exercises the anchor, because a uniform
source passes under any anchor. A per-archive mutation table makes it
explicit:

- The flip 11/14 mutation (the pre-fix runtime) fails only animals and
  monkey-paradise.
- Inverted-anchor and scaled blits fail 1990, animals, crayon-os,
  dolphin-som, evolution, floppies and monkey-paradise.
- 1138, 1984, apple-lisa, beos-r503, windows-31 and windows-95 pass all three
  mutations, so they do not discriminate.

This is a source-rule check against the runtime, not native capture
evidence.

**Code-10 corollary (Q2, partial, corrected after review).** The widget draw
is `0x632e` → `0x6062`, not `0x5ffc`. `0x5ffc` → `0x5ddc` is a point hit-test
and draws nothing. `0x6062` is not independent of the side lists:

- Its dst rect is the rect-list entry rect in template
  coordinates, remapped by `0x5cb6`. `0x5cb6` walks every side's cells through
  `0x5356` and offsets each corner by its containing cell's placed − template
  delta, so it depends on the `0x5178` widths.
- In the state-0 path it blits the chrome template itself (src =
  raw entry rect), not a widget cicn.

What a code-10 collapse would do to widget placement or art is therefore not
established. This corollary must not be used to justify collapsing code 10.

Still open:

- Which callers of `0x632e` draw close (part 4) and collapse (part 9) on a full
  frame draw. Inside `0x572e`, only part 5 is drawn (`0x5a28..0x5a3c`).
- The meaning of flags 502/503/506/507/508 (§3.3) and of the state byte.
- `0x5cb6`'s behaviour when a corner falls in a cell placed at width 0.
- How the rect-list rects are derived.

---

## 6. A-trap inventory

The toolbox calls the kDEF makes, with representative call-site addresses (the
address of the trap word itself). **The `name` column is generated from Apple
Universal Interfaces 3.0.1 `Traps.h`** by `scripts/gen-trap-table.mjs`; never
hand-edit it. Run `node scripts/gen-trap-table.mjs --traps-h <path> --check` to
verify, or `--write` to regenerate. `Traps.h` is Apple-copyrighted and is not
committed; the maintainer copy lives in the private store
(sha256 `b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b`).
Toolbox traps are looked up with the auto-pop bit (`$0400`) cleared; OS traps are
looked up with their flag bits.

Body-related rows were corrected against Universal Interfaces 3.4.1 earlier; see
[source identity and body dispatch](cinf-resize-behavior.md). The `role` column is
hand-written. A role marked *(re-verify)* was written when the trap carried a
different (wrong) name, so treat it as unverified until someone re-traces it. Every
example address below was checked to hold the trap word (2026-10-21, v2 lane L1).

<!-- trap-table:begin -->
| trap | name | role in kDEF | example addr(s) |
|---|---|---|---|
| `$A8EC` | CopyBits | the core scaled/1:1 blit | `0x103ea`, `0x750c`, `0x7654` |
| `$A817` | CopyMask | masked blit (cicn alpha) | `0x10402` |
| `$A874` | GetPort | save current port | `0xfeee`, `0x10338`, `0x108d0` |
| `$A873` | SetPort | port plumbing *(re-verify)* | — |
| `$A879` | SetClip | clip plumbing *(re-verify; was "SetPortBits (?)")* | — |
| `$A8A9` | InsetRect | rect geometry; default ring expands the control rect by 4px | `0x76a2` |
| `$AA19` | GetForeColor | save foreground RGB | `0xfe2c`, `0xf82a` |
| `$AA1A` | GetBackColor | save background RGB | `0xfe32`, `0xf830` |
| `$AA1E` | GetCIcon | request color icon | `0x10434`, `0x10698` |
| `$AA0C` | GetPixPat | request pixel pattern | `0x10460`, `0xef24` |
| `$AA14` | RGBForeColor | set foreground RGB | `0xfe9c`, `0xf836` |
| `$AA15` | RGBBackColor | set background RGB | `0x10998`, `0x109b6` |
| `$A9A0` | GetResource | wnd#, cicn, cinf, clut (`'pWin'` is a Gestalt selector at `0x11768`, `$A1AD`, not a resource) | `0x3574`, `0x11722` |
| `$A9A2` | LoadResource | *(re-verify; was "ReleaseResource / free recipe handle")* | `0x36a6`, `0x1172e` |
| `$A024` | SetHandleSize | resize loaded handle | `0x1174a`, `0x117b6` |
| `$A01B` | SetZone | switch heap zone around resource loads | `0x10458`, `0x10490` |
| `$A994` | CurResFile | save current resource file | `0x10816`, `0x10494` |
| `$A998` | UseResFile | restore resource file | `0x10830`, `0x104ae` |
| `$A888` | TextFace | set title text face *(re-verify; was "StringWidth / title-fits gate")* | `0x4f18`, `0x4f20`, `0x4f36`, `0x7558` |
| `$A88C` | StringWidth | measure title text *(re-verify; was "GetFontInfo")* | `0x4aa4`, `0x4f0a`, `0x4f28` |
| `$A88B` | GetFontInfo | ascent/descent *(re-verify; no call site cited)* | — |
| `$A887` | TextFont | set title font | `0x7540` |
| `$A88A` | TextSize | set title size | `0x754a` |
| `$A889` | TextMode | *(re-verify; was "TextFace/DrawChar-area")* | `0x75bc`, `0x75c4` |
| `$A8B2` | EraseRoundRect | solid inset-union body; both oval dimensions pushed as zero | `0x10a3e`, `0x10a66` |
| `$AA25` | DisposeCIcon | release mode5 background icon | `0x10a14` |
| `$AA42` | GetAuxWin | *(re-verify; was "Appearance/Icon-services utility (?)")* | scattered |
| `$AA55` | *(not in Traps.h 3.0.1)* | none: data words only (`0x18a22`–`0x18bc6`, inside the data block), no call site | — |
| `$AA73` | *(not in Traps.h 3.0.1)* | unknown; a selector-in-`d0` call site (`0x1f28`) suggests an Appearance-era dispatcher newer than UI 3.0.1 | `0x1f28` |
| `$A8D8` | NewRgn | region allocation *(re-verify; was "SectRect")* | `0x103c4` |
| `$A8D9` | DisposeRgn | region release *(re-verify; was "UnionRect")* | `0x15c92` |
| `$A8DC` | CopyRgn | region geometry *(re-verify; was "rect family")* | throughout |
| `$A8DF` | RectRgn | region geometry *(re-verify)* | throughout |
| `$A8E0` | OffsetRgn | region geometry *(re-verify)* | throughout |
| `$A8E4` | SectRgn | region geometry *(re-verify)* | throughout |
| `$A8E5` | UnionRgn | region geometry *(re-verify)* | throughout |
| `$A8E6` | DiffRgn | region geometry *(re-verify)* | throughout |
| `$AB1D` | QDExtensions | selector-dispatched QuickDraw extensions (GWorld family; the control-draw bracket pushes a selector before it). Selector names are not in `Traps.h` | `0x7484`, `0x74a2`, `0x74bc` |
| `$ABCA` | DeviceLoop | *(re-verify; was "PlotCIconHandle (?)")* | `0x15cd0` |
| `$ABC9` | IconDispatch | selector-dispatched Icon Utilities *(re-verify; was "PlotIcon (?)")* | — |
| `$A06A` | HSetState | handle state restore | — |
| `$A069` | HGetState | handle state save | `0x108f2` |
| `$A029` | HLock | handle lock | — |
| `$A023` | DisposeHandle | handle release | — |
| `$A122` | NewHandle | handle allocation (OS flag bits set) | — |
<!-- trap-table:end -->

---

## 7. Gaps / not-yet-decoded

1. **High CDEF messages (19/20/21/27/34)** — dispatch targets are decoded
   (`0x698a`/`0x6b14`/`0x6a86`/`0x6980`/`0x6b84`) but the per-message behaviour
   is not traced; the message *meanings* are inferred from Appearance numbering,
   not proven (§1.1).
2. **cinf header fields / body dispatch** — field offsets are known, but full
   body rendering is not closed. Byte2 is boolean edge repeat; byte3==5 requests
   a cicn, while other modes request a ppat and choose phase0..4 (higher values
   use origin). Bytes4–5 are a signed background resource ID in both branches;
   bytes6–17 are bg/text/emboss RGB sample coordinates. The prior “resolved”
   note inverted the body branch and overstated the Scheme Factory MENU139
   interpretation. See the corrected [source table and 18-fork survey](cinf-resize-behavior.md).
   Editor menu encoding, complete phase/mask behavior and caller coverage are
   not established by header labels alone.
3. **'pWin' Gestalt selector** (`0x1175e`, `1884776814`; trap `$A1AD` _Gestalt at `0x11768`, formerly read as a
   `_Get1NamedResource` companion-resource load) — queried for cinf-range ids. If the call succeeds, the response
   is used as a pointer to a record: when that record's byte 15 is non-zero, its word at offset 16 is
   copied into cinf byte 18. Which
   component registers `'pWin'` and what the word means are not decoded.
4. **Scrollbar/slider/popup/progress/menu/disclosure LAYOUT arithmetic** — drawer
   entry points and cicn families are known (§1.3, §2.3–§2.6), but the
   track-stretch / thumb-position / barber-pole / tab math was only ever decoded
   against the **1.8.2** binary (folded into §2.6 at `[DOC]` confidence) and was
   never instruction-traced for 2.3.1.
5. **The `0x788c` hand-drawn bevel path** — entry + state selectors (state value 254 / 255)
   identified; the full MoveTo/LineTo coordinate sequence (the procedural
   button/checkbox geometry) is not transcribed.
6. **cinf widget-presence flags** (flags 496 / 500 / 501 / 505 / 508, §3.3) — decoded
   as close/zoom/shade/body/grow by *behaviour*, not from a documented struct;
   the exact bit/byte semantics are inferential (§3.3).
7. **The 18-slot cicn cache** (`0x10472` switch, the work-struct cicn cache table) — IDs enumerated
   (§2.3) but the slot eviction/reuse policy is not traced; `-10224`/`-10223`
   remain unidentified.
8. **theme.json `part-N` vs runtime partCode for evolution/beos** — the recipe
   model is solid, but whether the corpus's per-link p18 / p1 cells reflect the
   live `wnd#` is still open (see `kdef231-recipe-walk.md` "honest discrepancy").
   Needs a raw `wnd#` dump from the 2.3.1 resource fork.

---

## 8. Cross-reference: Apple primary-source role pegs

The Kaleidoscope resource ids documented above are **Kaleidoscope-private** —
they don't appear in Apple's published headers. What Apple documents is the
**role each slot serves**. The mapping from Kaleidoscope id → Apple role peg
is the bridge the runtime needs.

See **`docs/spec/apple-primary-source.md`** for the full Apple enum tables:

- `Appearance.h` ThemeBrush / ThemeTextColor / ThemeWidget / ThemeWindowType
- `IconsCore.h` Apple Finder system icons (range -3968..-4000)
- `MacWindows.h` defProcID + window-color-table entries
- `Controls.h` control-type enums

Key correlations established 2026-05-29:

| Kaleidoscope id | Author label | Apple role peg |
|---|---|---|
| `bodyBackground.pattern` (cinf -9551) | "Icon View Background" | `kThemeBrushDocumentWindowBackground = 15` |
| `ppat-42` / `ppat--9568` | (utility-window body) | `kThemeBrushUtilityWindowBackgroundActive = 7` |
| `-10239` / `-10238` / `-10240` | Push Button Active / Pressed / Inactive | (CDEF-rendered; analog is `kThemeButton*`) |
| `-10231` / `-10232` | Push Button Ring Active / Inactive | (same CDEF family) |
| `-14336` (corner-sprite) / `-14335` (cicn-template) | Document Window Active | `kThemeBrushDocumentWindowBackground` chrome + `kThemeTextColorDocumentWindowTitleActive = 23` |
| `-14320..-14313` | utility / floating windows | `kThemeUtilityWindow = 8` + `kThemeBrushUtilityWindowBackgroundActive = 7` |
| `-3790` | "Snap-To-Grid" / "Grid Arrangement" | Finder header badge (NO Apple constant — Kaleidoscope private slot for the Finder-header layer) |

The runtime renders via the Kaleidoscope id; the Apple peg gives us the
authoritative role label for cross-talk with Inside Macintosh / Carbon docs.

## 9. References (the citation chain)

- **`docs/spec/corpus-corroborated-ids.md`** — auto-generated cross-theme
  consensus from 6,842 author-supplied NAMED labels across 17 of 18 bundles.
  The primary source for "what role does id X play". Refresh with
  `node scripts/dump-author-hints.mjs`.
- **`docs/spec/apple-primary-source.md`** — Apple `Appearance.h` /
  `IconsCore.h` enum tables. Direct citations from
  `phracker/MacOSX-SDKs` + `ctm/executor` + `elliotnunn/UniversalInterfaces`.
- **`docs/spec/kaleidoscope-author-docs.md`** — surviving public-web
  Kaleidoscope-era community docs (Companion / FAQ / Scheme Factory tutorial)
  with archived Wayback URLs.
- **`docs/spec/kdef182-disassembly-findings.md`** — the 1.8.2 binary
  archaeology pass (May 2026). Establishes the structural facts that hold
  across 1.8.2 + 2.3.1: QuickDraw + CopyBits (no custom blitter); Kaleidoscope
  themes the surroundings, the OS Appearance Manager draws controls; only 4
  hardcoded `_GetResource` calls in the kDEF (the rest are table-driven).
- **`scripts/dump-author-hints.mjs`** — regenerates the corpus table.
- **`scripts/probe-reference-slot.mjs`** — pixel-matches bundle reference
  PNGs against candidate icons. The verification mechanism for Finder UI
  slots where neither the kDEF nor Apple's docs give a direct answer.
- **`compositor-spec.md`** — the runtime model these routines implement.
- **`kdef231-recipe-walk.md`** — the wnd# recipe walk (truth source for
  part-code edges).
- **`kdef-faithfulness-ledger.md`** — every deliberate divergence from the
  decode, with intent.


### Default push-button ring geometry (verified 2026-10-18)

`0x7434` copies the control rectangle; `0x7572` passes it to the face drawer.
After face/text drawing, `0x7698..0x76a2` calls InsetRect with `(-4,-4)`. The
ring dispatch uses inactive -10232, pressed -10230 (falling back to -10231),
and active -10231 (`0x76b8..0x770e`). Its wrapper at `0x107de` disables body
fill when entering `0x107fe`. No source opaque-bounds crop is involved.

The border is not a rectangular nine-slice. The cinf corner size sets both
dimensions of each square corner; the side thickness sets band thickness. Order: TL `0x10c54`, TR `0x10cb2`, top `0x10d34`, BL `0x10da6`,
BR `0x10e0e`, bottom `0x10e92`, left `0x10f0a`, right `0x10f82`. Bands exclude
corner size at their longitudinal ends, and may overlap when side > corner.
Masked samples preserve already-painted pixels underneath.

For a false repeat flag, top/bottom use the first source column at x=corner
(`0x10cf6`, `0x10e54`), and left/right the first row at y=corner (`0x10ecc`,
`0x10f44`). A true flag repeats the complete corner-trimmed band; FEAE clips
the final tile. Thus a 21px source with corner7/side14 is valid overlapping
art, not malformed or a pair of 14px vertical corner insets.

The runtime applies this border model to default rings and supported push/bevel
faces with explicit cinf metadata. Solid and full-color ppat bodies fill the
inset union before masked border art. Raw RGB16 text/emboss samples survive
canvas mask holes; the [supported solid fallback](control-solid-background.md)
consumes the selected face owner's raw background display sample as well,
including masked anchors. Selected pattern bodies retain priority. See [solid geometry](control-face-geometry.md)
and [the pattern/context model](control-pattern-context.md) for exact source
fixtures and remaining device, transfer, lookup and font limits. Mode5 cicn bodies remain unsupported; missing/unusable background metadata and
the per-column list-header helper retain their existing compatibility behavior.
The separate [whole-header surface](header-surface.md) uses the PACH130 Appearance
callback and a bounded solid/masked drawing model; it is not a kDEF push-face or
per-column equivalence claim. Reserving the four-pixel margin on plain buttons is a runtime layout
policy to keep state changes stable, not an additional claim about the original
Control Manager's layout.
