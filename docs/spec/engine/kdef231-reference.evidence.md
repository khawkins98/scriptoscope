# kdef231-reference — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/kdef231-reference.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`kdef231-reference.md`](../kdef231-reference.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.
>
> Each section below is the **whole original section**, copied exactly, for
> every section whose text changed in the split. The following original
> sections are already preserved verbatim in
> [`qd-primitives.evidence.md`](qd-primitives.evidence.md) and are not
> duplicated here: `1.5 Blit primitives + 9-slice`.
>
> Section 6 ("A-trap inventory") was left untouched in the main document
> (owned by lane L1) and is not reproduced here.

## (preamble, before §1) (original)

````text
# Kaleidoscope 2.3.1 kDEF — standing reference (rubric of coordinate mappings + logic)

*A lookup reference — consult for addresses / ids / offsets / coordinates. For the "how does it work" tour, see [`kdef-architecture.md`](./kdef-architecture.md).*

**What this is.** A lookup reference for the decompiled Kaleidoscope **2.3.1**
`kDEF 0` — the combined 68k code resource (107,726 bytes) that both (a) draws
WINDOW chrome from `wnd#`/`cicn`/`cinf` resources and (b) draws CONTROLS
(buttons, scrollbars, sliders, …) and reads scheme `cicn`/`cinf`/`clut` art. It
exists so the team stops re-reading the binary: every claim below cites an
address, and where a claim is uncertain it is marked **(?)**.

**Addresses are file offsets** into `kDEF231_0.bin` / `kDEF231_0.asm`
(`/tmp/kaleido-trace/`), and match the Ghidra `FUN_xxxx` numbering. The asm is
the **ground truth**; the Ghidra C decompile (`kdef231_decomp.c`) is lossy
around A-traps (use it for structure only). objdump renders a 32-bit far call as
`61ff dddddddd` (`bsrl 0xTARGET`) — that is ONE call, not two words. A-traps show
as `.short 0xaXXX`.

**Reusable decode toolchain**
```
# bin location (not committed):
/tmp/kaleido-trace/kDEF231_0.bin           # 107,726 bytes
/tmp/kaleido-trace/kDEF231_0.asm           # objdump, ~34k lines (this doc's ground truth)
/tmp/kaleido-trace/kdef231_decomp.c        # Ghidra C (structure only)
# disassemble:
m68k-elf-objdump -D -b binary -m m68k:68020 -EB kDEF231_0.bin > kDEF231_0.asm
# hex-peek a region (e.g. a jump table):
xxd -s 0xADDR -l N kDEF231_0.bin
```

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
````

## 1. Routine map (original)

````text
## 1. Routine map

Grouped by subsystem. `fp@(n)` = stack-frame arg/local (positive = caller arg,
negative = local); `a2@(n)` etc = struct field; `a4` = the kDEF globals base
(the work struct built at init). All addresses verified present in the asm.
````

## 1.1 CDEF message dispatch (controls) (original)

````text
### 1.1 CDEF message dispatch (controls)

The control code is a standard **Appearance-era CDEF**, entered at `0x6688`.
Pascal signature `long CDEF(short varCode, ControlHandle, short message, long
param)`; on the frame: `fp@(18)`=varCode (→`d4`), `fp@(14)`=ControlHandle
(→`a2`), `fp@(12)`=message, `fp@(8)`=param. `rtd #12` pops the 12 arg bytes
(`0x772a`-style returns).

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x6688` | `CDEF_main` | CDEF entry: unpack handle, set state-bytes, dispatch on message | reads varCode `fp@18` (low 3 bits = control kind, bit3 = "active" → `fp@(-14)`), `a2@`→ControlRecord; sets `fp@(-16/-15/-14/-13/-4/-2/-1)` precomputed flags | `0x104` (gestalt-ish init), jump table `0x67b6` | `rtd #12` |
| `0x997e` | **re-entrant CDEF entry** (service-handler slot 1) | callback-safe entry: `_HGetState`/`_HUnlock` brackets the handle; `bsrl 0x9930` saves `a4` globals to a static at `0x992c` so the kDEF can run from a context that hasn't bound globals (Toolbox action proc / Appearance Manager callback) | `fp@(8)`=param, `fp@(12)`=msg, `fp@(14)`=handle; 14-entry msg dispatch at `0x99d8` via `0x148` indexed-table helper; handlers `0xa2b6`/`0xa506`/`0xa1fe`/`0xa678` use `_PtInRgn`/`_GetGDevice`/`_GetCTSeed` | `0x9930`, `0x9d84` pre-call hook, `0x148`, `0x1c46` (`'SMARTSCROLLI'` literal nearby — interop with SmartScroll INIT) | `rtd #12` |
| `0x8d36` | **second CDEF main** (service-handler slot 5) | scrollbar / slider family; identical dispatch shape to `0x6688` but allocates 68-byte aux on initCntl (`moveq #68,d0; A122` at `0x8df6`), vs the 32-byte `'Acid'` block | aux fields at +14/+20/+22/+26/+28/+30/+32/+34/+38/+40/+42/+44/+46/+48 (value, min, max, page+/–, action proc) | `0x104`, `0x148`, `0x8c88` msg-0 sub | `rtd #12` |
| `0x67a2` | dispatch | `cmpiw #34,%d0` / `movew %pc@(0x67b6,%d0:w:2),%d0` / `jmp %pc@(0x67b6,%d0:w)` | message 0..34; >34 → `0x6c16` (no-op return) | — | — |
| `0x67b6` | jump table | 35 int16 offsets, target = `0x67b6 + entry` | see §4-controls below | — | — |
| `0x6c16` | default/no-op | return path for unhandled messages | — | — | — |
| `0x6c28` | (msg-0 sub) | called for drawCntl when `a0@(16)` set | `pea fp@(-26)` (the unpacked-state blob) | — | — |

**Decoded dispatch targets** (`0x67b6` table; verified by hex-decode of the
table bytes). Standard CDEF message numbers in parens. Apple's canonical
`Controls.h` numbering is the `phracker/MacOSX-SDKs` mirror (10.6 SDK) — pinned
in `docs/spec/apple-primary-source.md`.

| msg | → target | meaning |
|---|---|---|
| 0 (drawCntl) ✓ | `0x67fc` | draw — `a0@(16)` gate → `0x6c28` part drawers (`$A874`/`$A95E`/`$A88B` GetCIcon/CopyMask/StringWidth chain — §1.2) |
| 1 (testCntl) ✓ | `0x6816` | hit-test — `_PtInRgn` (`$A8AD`) on the face region; sentinel `a0@(17) == 0xfe` returns `d3=254` (pressed-state hit) |
| 2 (calcCRgns) ✓ | `0x686a` | calc control region — strips bit-31 sign of `fp@(8)` arg, falls through to `0x6872` |
| 3 (initCntl) ✓ | `0x6910` | init — `_NewHandle #32` (`$A122`) → ControlRecord+28 = kDEF's 32-byte aux block; writes `'Acid'` magic at +0, clears +6 / +30 (default-button flag) |
| 4 (dispCntl) ✓ | `0x695e` | dispose — `_DisposeHandle` (`$A023`) on the aux block if the `'Acid'` magic checks out |
| 10,11 (calcCntlRgn/calcThumbRgn) ✓ | `0x6872` | region calc (shared) — `_RectRgn` (`$A8DF`) the face cicn (-10240) rect; if default-button flag set, union in the ring (-10232) rect (insets -4) |
| 14 (kControlMsgCalcBestRect) ✓ | `0x69b8` | best-fit rect — `$A874` `_GetMHandle`, read width/height/style from a font/title record, write Rect into `a3@`; routes through `0x65ba` for default-button cases |
| **19 (kControlMsgGetFeatures)** ✓ | `0x698a` | Appearance feature query — returns bitmask in `d3`. Base = `#0x240` (`kControlSupportsDataAccess \| kControlSupportsCalcBestRect`); `\|= 0x800 (kControlHasRadioBehavior)` if radio; `\|= 0x4000 (kControlSupportsClickActivation)` if click-activated; always `\|= 0x2000 (kControlSupportsContextualMenus)`. (Bit 13/14 mapping is the Appearance 1.0 / pre-Carbon numbering — Carbon shifted these to bits 21/22 post-2001; Kaleidoscope 2.3.1 predates the shift.) |
| **20 (kControlMsgSetData)** ✓ | `0x6b14` | set custom data on the aux block. Dispatches on a 4-CC tag at `a3@`: `'cncl'` → write byte from caller into `a2@(31)` (cancel-button flag); `'dflt'` → write byte into `a2@(30)` (default-button flag); `'font'` → copy 24-byte `ControlFontStyleRec` into `a2@(6..29)`. Unknown tag → returns `d3=#-30581` (`errMessageNotSupported`). |
| **21 (kControlMsgGetData)** ✓ | `0x6a86` | mirror of msg 20 — read from aux block into caller's buffer at `a3@(12)`. Same `'cncl'`/`'dflt'`/`'font'` tag set; same -30581 default. Sets `a3@(8) = 24` for the font tag (returned-size field), `=1` for the flag tags. |
| **27 (kControlMsgTestNewMsgSupport)** ✓ | `0x6980` | returns the magic constant `d3 = #0x206F6B20` (`' ok '`) to confirm Appearance-era CDEF compatibility (a single `movel #' ok ',%d3` then `braw 0x6c16` — see §1.1 confirmation note below). **This is NOT msg 16 `kControlMsgFocus` — Kaleidoscope's kDEF doesn't handle focus.** |
| **34 (kDEF-private GetControlKind)** ✓ | `0x6b84` | writes a Kaleidoscope-private kind descriptor to `a3@(4..7)` based on aux flags + variation code. Long-write picks family by aux-block flags (`a0@(30)` default-btn → `'dbtp'`; `a0@(31)` cancel-btn → `'cbtp'`; neither → `'btnp'`; with `fp@(-15)` radio hint → `'radp'`; else `'chkp'`). Then `a3@(2)` variation-code (1..4) patches byte+7 with suffix `p/e/x/r` (Plain / Embossed / eXtended / Recessed). varCode 5+ → `clrl %a3@(4)` (no descriptor). **Msg 34 is unassigned in Apple's published `Controls.h` (`kControlMsgGetRegion = 31` and Carbon jumps to 38) — this is Kaleidoscope's private kind-introspection message, used by Kaleidoscope's own CDEF callers to learn which family/variation a control belongs to without re-classifying.** |
| 5,6,7,8,9,12,13,15,16,17,18,22-26,28-33 | `0x6c16` | unhandled → default (returns whatever was last in `d3`) |

> **Return-value mechanism.** At `0x6c1a`, the default-return path writes
> `%d3` into `%sp@(370)` — the long that `rtd #12` will pop into the caller's
> result slot. So every handler that wants to return a value loads `d3` and
> branches to `0x6c16`. (Handlers that don't touch `d3` return whatever was
> in it from the unpacked-state preamble.)
>
> **Confirmations (2026-05-29).** The five "(?)" entries above are now decoded
> against `kDEF231_0.asm`. The two non-obvious ones:
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
> All five entries' raw asm sits in the `0x6980..0x6c10` block; cite line
> numbers in `kDEF/k231-kdef0.asm` are 8754 (msg 27), 8756 (msg 19), 8829
> (msg 21), 8875 (msg 20), 8909 (msg 34).
>
> The LOW entries (0-4, 10, 11, 14) were the "classic CDEF set" called solid
> previously; they're now spot-checked too — see the per-row ✓ citations
> against the toolbox-trap signatures.
````

## 1.2 Control draw — push-button face + default ring (original)

````text
### 1.2 Control draw — push-button face + default ring

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x6cdc` | install-drawers | registers the FACE drawer per GDevice via `0xf112`; pushes `0x7424` (color twin) then `0x70f6` (b/w twin) | `pea 0x7424` / `pea 0x70f6` then `bsrl 0xf112` | `0xf112` | — |
| `0x7424` | **push-button FACE drawer** (color) | draw the button face cicn into the control rect; pick state cicn; then default-ring | `fp@(8)`→`a2` (state blob: `a2@(8)`=disabled, `a2@(9)`=pressed, `a2@(14..18)`=Rect, `a2@(24)` scratch), `fp@(12)`→`a3`; `fp@(18)`=device depth (DeviceLoop wrapper `0xf112`→`0xf290`; equivalent manual callback arguments at `0xf26c–0xf27c`) | `0xea08`,`0xe978`,`0xf2d6`,`0x10fc0` (body + independent border bands), `0x107a4` (ring), `0x6d22` | `rtd #12` |
| `0x70f6` | b/w FACE drawer | 1-bit-screen twin of `0x7424` | same blob | `0x10472` (cicn) | — |
| `0x757c` | **face state-select** | choose face cicn id | `a2@(8)` set → **-10240**; else `a2@(9)` set → **-10238**; else **-10239** | pushes id → `0x10fc0` | — |
| `0x76a8` | **aux-struct 'Acid' gate** | `cmpil #1097034084,%a0@` (= `0x41636964` = `'Acid'`, the kDEF aux-struct magic), then `tstb %a0@(30)`; both must hold to draw the default ring. Reached via `a2@`→`@`→`@(28)`→`@` handle chain (`0x768c`-`0x76a8`) | aux struct: `+0`='Acid', `+30`=default-button flag | — | — |
| `0x76c4` | **default-ring blit** | choose ring cicn id by state and 9-slice it | `a2@(8)` set → **-10232** (inactive); else `a2@(9)` → **-10230** (mixed), retry **-10231**; else **-10231** (active) | `0x107a4` | — |
| `0x788c` | **hand-drawn 3-D frame/bevel** | procedural MoveTo/LineTo bevel when no cicn face | state `d5==254`/`255` (pressed/raised); loads aux cicns via `0x10472` (`0x78b8`/`0x78d0`/`0x78e0`) | `0x10472`, MoveTo/LineTo | `0x7d86` rts |

> **Correction to the brief's state mapping:** at `0x757c` the asm is
> `a2@(8)`→**-10240**, `a2@(9)`→**-10238**, else **-10239**. (`controls.ts`
> `drawButton` uses the same: `disabled→10240, pressed→10238, normal→10239`.)
> The ring at `0x76c4` is `a2@(8)`→**-10232** (inactive), `a2@(9)`→**-10230**
> (mixed) then -10231, else **-10231** (active). So `a2@(8)` is the
> "disabled/inactive" bit and `a2@(9)` is the "pressed/mixed" bit.
````

## 1.3 Control draw — other parts (drawer entry points; layout not fully traced) (original)

````text
### 1.3 Control draw — other parts (drawer entry points; layout not fully traced)

| addr | role | cicn family | notes |
|---|---|---|---|
| `0x8d36` | **scrollbar / slider CDEF main** (second CDEF) | `-8278..-8271` etc | service-handler slot 5; 35-entry msg dispatch (matching CDEF protocol), allocates 68-byte aux block on initCntl (vs slot 0's 32). Full trace: `docs/spec/kdef-service-handlers.md` |
| `0x66b4`-region | scrollbar drawer | `-8278..-8271` v / `-8286..-8271` h | per §2.6 (1.8.2-era); `controls.ts` uses these IDs (verified consumer-side) |
| `0xdd22` | **GDevice-aware focus / state helper** | — | service-handler slot 2; gates draw on 3 ctSeed magics (`'CHTA'`/`'POrg'`/`'CH3D'`); no aux allocate, consumes slot 0's. Full trace: `docs/spec/kdef-service-handlers.md` |
| `0x788c`/bevel | bevel/checkbox/radio path | `-10232/-10231` mixed | hand-drawn fallback when cicn absent |
| popup/tab | (msg-routed via `0x17452`) | `-12320` frame / `-12319` tab | §2.6 (behavioural `[DOC]`); the kDEF gates these to a loaded `'WDEF', -14336` whose code is called directly (`jsr a0@`) with msg-base 1008 — see `docs/spec/kdef-service-handlers.md` slot 8 |
````

## 1.4 Window chrome — load / layout / draw (original)

````text
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
| slot 8 | `0x17452` | popup / tab / menu | `-12320` | varCode + 1008 (trampolined to a loaded `'WDEF', -14336` via `jsr a0@`) |

Slot 6 `0x28e0` is the **master compositor dispatcher** — receives msg
1000 = INIT (called once at table install) + msgs 1001..1009 (per-side
recipe walk + draw). Its 9-entry dispatch fans out to the routines below
(`0x356c`, `0x3680`, `0x3f2c`, `0x41ee`, ...).

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x28e0` | **master compositor dispatcher** (service-handler slot 6) | window-chrome message router; writes args into `a4@(454/458/460/464)`, dispatches msg-1001 via `0x148` indexed table | `fp@(8)`=param, `fp@(12)`=msg (1000 init / 1001..1009 verbs), `fp@(14)`=handle, `fp@(18)`=varCode | `0x2e02` precompute, `0x41ee`, `0x3f2c`, `0x3ac4`, `0x38fe`, `0x3aa8`, `0x3e6c`, `0x436c`, `0x4924` | `rtd` |
| `0x356c`-`0x367e` | **wnd# loader + 12-step fallback ladder** | `GetResource('wnd#', id)` then progressive low-bit masks (`&-2,-3,-4,-5,-6,-15,-16,-17,-18,-21,-22`) as fallbacks → loads the per-window-type recipe; full decode + landing table in §3.4.1 | `d3`=window variation code | `$A9A0` GetResource | recipe handle in `a2` |
| `0x3680`-`0x38c8` | recipe install / resize | copy rect-list → `a4@(1938)`, 4 source side-lists → `a4@(2788/2950/3112/3274)` (162 B stride); loop `s=0..3` calling `0x4a64` | rect-list count `a4@(1938)`; stride = `10*count+12` bytes | `0x4a64` | — |
| `0x487e` | zoom/grow widget predicate | "is there a usable zoom/grow widget" = `a4@(500) && a4@(0x1f9) && !a4@(0x1f0)` | cinf widget flags | — | bool in `d0` |
| `0x49d6` | **part-code jump table** | classify a part code → stretch(1)/fixed(0); see §4 | `fp@(8)`=partCode, `fp@(10)`=caller flag byte | helper `0x148`; `0x487e` | byte `d0` |
| `0x4a0c` | code-10 handler | `moveb %fp@(10),%d0` — returns the **caller's flag** unchanged | `fp@(10)` | — | `d0` |
| `0x4a64` | **layout precompute** (per side) | walk source side list, classify each segment, measure title (`StringWidth $A888`), find title anchor `d4`, sum fixed widths, set per-half stretch flags `fp@(-18)`/`fp@(-20)`, call `0x5178` ×2 (one per half); title-fits gate at `0x4f58` clears `fp@(-290)` | side index; source list `a2`/`a3`; `fp@(-2)`=title width; `fp@(-290)`=title-fits | `0x49d6`, `0x5178`, `$A888` StringWidth, `$A88C` GetFontInfo | fills DEST side list |
| `0x4f58` | title-fits gate | `cmpiw #2,%d0; bgt`; if title doesn't fit → `clrb fp@(-290)` + `clrw fp@(-2)` (collapse plate) | `fp@(-290)` title-fits, `fp@(-2)` title width | — | — |
| `0x4ff8`/`0x501c` | title centring | signed `/2`-with-rounding sequences (`lsr/lsr/lsr/lsr; add; asr #1`) on the title region bounds | — | — | center x |
| `0x5178` | **growth distribution** | fill DEST borders: budget = (half extent − Σ fixed widths); each stretch cell gets `budget/numStretch` EVEN, remainder L→R; explicit `cmp` chains classify fill codes (see §4) | `fp@(20)`=numStretch, `fp@(22)`=reqWidth (fixed sum), `fp@(26)`=flag byte (title-fits on title path, `#1` else) | `0x49d6` (`0x5302`) | DEST `border[i]=border[i-1]+w` |
| `0x5356` | **placement** | per `(side,segIdx)` build SRC rect from `a4@(2788)` and DST rect from `a4@(2140)`; 4-way `switch(side)` axis remap. **END-based:** segment i = `[border[i-1],border[i])` tagged `part[i]` | `param_5/6`=structure-rect handle (cross-axis); side, segIdx | — | SRC+DST rects |
| `0x572e` | **main draw loop** | per side, per segment: `0x5356` then blit (code 18 → `0x10320`, else `0x0feae`). Never touches the rect-list `a4@(1938)` | side lists | `0x5356`, `0x10320` (`0x59ba`), `0x0feae` (`0x59e8`) | — |
| `0x5ddc` | rect-list widget **hit-test** | GetCIcon (`$AA1E`) of widget id `-14330` (`+32` if `a4@(506)`, `+8` more if `a4@(507)`), mask → region (`0xf6e0`), OffsetRgn, `PtInRgn` (`$A8E8`) then `PtInRect` (`$A8AD`) → `d0` = hit. The entry rect is first remapped to placed coordinates by `0x5cb6` (`0x5f72`). Draws nothing (corrected 2026-10-21, §5.1) | `fp@(8)`=point, `fp@(12)`=part, `fp@(14)`=entry rect | `0xf6e0` | hit byte |
| `0x5ffc` | rect-list **hit iterator** | map part 0/1/3 → entry type 1/2/3; walk `a4@(1938)` (10-byte entries, type at `+2`, rect at `+4`) from the end; return 1 on the first `0x5ddc` hit. Hit-test only, not a draw pass (corrected 2026-10-21) | `fp@(8)`=point, `fp@(12)`=part | `0x5ddc` (`0x6040`) | hit |
| `0x632e` | rect-list **widget draw iterator** | map window part 4/5/6/9 → entry type 1/2/2/3; walk `a4@(1938)` from the end; call `0x6062` per matching entry. Called from `0x42a6` (dispatch, caller part) and `0x5a3c` (end of `0x572e`, part 5 only, gated by `a4@(502)` and `a4@(508)`) | `fp@(8)`=part, `fp@(10)`=state byte | `0x6062` (`0x637a`) | — |
| `0x6062` | rect-list **widget draw** | dst = the entry rect remapped by `0x5cb6` on all three paths (`0x6138`, `0x62b0`, `0x6308`), then ONE `0x10320` blit. Source: parts 5/6 with `a4@(502)` → GetCIcon(id`+1`) (`0x60aa..0x6146`); state byte ≠ 0 → GetCIcon(id) in the `-14330` family (`0x6158..0x62e0`); **state 0 → no GetCIcon: the chrome template `a4@(1934)` itself, src = raw entry rect** (`0x62f0..0x6318`) | `fp@(8)`=part, `fp@(10)`=state, `fp@(12)`=entry rect (template coords) | `0x5cb6`, `0x10320` (`0x6146`, `0x62e0`, `0x6318`) | — |
| `0x5cb6` | rect-list rect **template → placed remap** | for each side, `0x5356` builds the template (src) and placed (dst) cell of each segment. The segment loop starts at index 1 (`moveq #1,d3` at `0x5d26`), so a side's leading `[0,border[0])` cell is never a match target. The first template cell containing the rect's topLeft (`PtInRect` `0x5d52`) offsets topLeft by placed − template (`0x5d60..0x5d74`); likewise botRight−1 (`0x5d82..0x5da0`). If either corner matches no cell, the rect is emptied (`0x5dc6..0x5dd0`). So widget placement depends on the `0x5178` widths | `fp@(8)`=rect (in/out) | `0x5356`, `$A8AD` | rect |
| `0x5530` | **title draw** (+ text-colour sample) | `GetWTitle` (`$A919`) → title string; `0x6582(idx)` → marker rects; sample TWO ADJACENT chrome-pixmap (`a4@1934`) pixels via `0xfc5c` into `fp@(-28)`=text colour + `fp@(-22)`=shadow colour; at `0x56b2` if the two are EQUAL → one `RGBForeColor`+`DrawString`, else text in colour1 + a ~1px-offset shadow in colour2 (emboss) | `a4@(454)`=title, `a4@(1934)`=chrome pixmap, `a4@(509)` state flag | `$A919`, `0x6582`, `0xfc5c`, `$AA14` RGBForeColor, `$A884` DrawString | — |
| `0x6582` | rect-list lookup by part | scan rect-list (`a4@1938`, 10-byte entries) for the one whose part field == index arg; else the first | `sp@(4)`=part index | — | rect ptr `a0` |
| `0xfc5c` | **GetPixel** (index→RGB) | sample the chrome pixmap at `(x,y)`: compute bit/byte offset (handles 1/2/4/8-bit depth), extract the colour index, resolve via `0x10702`, write `*outColor` | pixmap, `x`, `y`, `&RGBColor` | `0x10702` (index→clut RGB) | RGBColor |
| `0x4138`/`0x4176`/`0x41d0` | draw/hit dispatch | window-def message handlers calling `0x5ffc` (e.g. grow-box `a4@(508)`, body `a4@(501)`) | `a4@(508)`,`a4@(501)`,`a4@(500)` widget flags | `0x5ffc` | part code in `d0` |
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
````

## 1.6 Resource loaders (original)

````text
### 1.6 Resource loaders

| addr | name | purpose | resource | notes |
|---|---|---|---|---|
| `0x10472` | **cicn loader / cache** | `GetCIcon` (`$AA1E` at `0x10434` / `0x10698`); an inline `0x148` sparse switch (`0x104ba`) caches specific control IDs in `a4`-relative slots; see the corrected [body dispatch](cinf-resize-behavior.md) | `'cicn'` `#1667851118` | the switch enumerates the cached control cicn families (see §2) |
| `0x10420` | cicn slot fetch | `GetCIcon`-by-id into a cached slot if empty | `'cicn'` | helper for `0x10472` |
| `0x10440` | plain ppat load | GetPixPat (`$AA0C` at `0x10460`) | `'ppat'` | mode !=5 body path |
| `0x116f8` | **cinf loader** | `GetResource('cinf', id)` (`#1667853926` at `0x1171a`, trap `$A9A0` at `0x11722`), check size (`#18`/`#56`); cicn→cinf id range check `cmpiw #-12240`/`#-12224`; also loads paired `'pWin'` (`#1884776814`) resource for in-range ids | `'cinf'` `#1667853926` | size>18 ⇒ has extended fields; size==56 ⇒ full record |
| `0x106e6` | clut loader | loads `'clut'` (`#1668052340` = `0x636c7574`) | `'clut'` | scheme palette |
| `0x33a8`/`0x3be4` | `'Copl'` tag | `'Copl'` (`#1131376748` = `0x436f706c`) — the kDEF's private GWorld-tagging clut handle, attached to every GWorld it allocates | `'Copl'` | NOT a scheme resource; internal marker |

A-trap addresses for these calls are in §6.

---
````

## 2. Resource-ID tables (original)

````text
## 2. Resource-ID tables

IDs are signed int16 (negative = the system/scheme resource range). "movew #-NNNN"
immediates were swept from the asm; the cache-switch IDs were hex-decoded from
`0x104c0`. Cross-checked against `src/controls.ts` `loadById(...)` and the
`themes/*/extraction-manifest.json` conventions.
````

## 2.2 Control faces + rings (verified against `0x757c`/`0x76c4` + `controls.ts`) (original)

````text
### 2.2 Control faces + rings (verified against `0x757c`/`0x76c4` + `controls.ts`)

| id | role | source |
|---|---|---|
| `-10239` | push-button face — **normal** | `0x758e` / `controls.ts:500` |
| `-10240` | push-button face — **disabled/inactive** (`a2@(8)`) | `0x757c` |
| `-10238` | push-button face — **pressed** (`a2@(9)`) | `0x7588` |
| `-10232` | default-ring — **inactive** (`a2@(8)`) | `0x76c4` |
| `-10230` | default-ring — **mixed** (`a2@(9)`) | `0x76de` |
| `-10231` | default-ring — **active** (default) | `0x76f4`/`0x7708` |
| `-10176` | bevel-button face base **(?)** | one immediate |
````

## 2.3 Control cicns CACHED by the `0x10472` switch (`0x104c0`, hex-decoded) (original)

````text
### 2.3 Control cicns CACHED by the `0x10472` switch (`0x104c0`, hex-decoded)

These 18 IDs get dedicated `a4`-relative GWorld cache slots (range lo=-14332,
hi=-8271). They reveal the control families the kDEF expects:

| id | family | id | family |
|---|---|---|---|
| -14332/-14331/-14330 | collapsed window | -10208/-10207/-10206/-10205 | **slider** (track/thumb v+h) |
| -12288/-12287 | menu bg / menu highlight | -8286/-8285 | **scrollbar** horiz (inactive/active) |
| -12272 | menu accent | -8278/-8277 | scrollbar vert (inactive/active) |
| -10224/-10223 | **progress bar** — beos 2-part (track/fill, no frame) | -8272/-8271 | scrollbar **thumb ghost** (drag preview) |
````

## 2.4 Slider / scrollbar / popup IDs (from immediates + `controls.ts`) (original)

````text
### 2.4 Slider / scrollbar / popup IDs (from immediates + `controls.ts`)

| id range | element | detail |
|---|---|---|
| `-10208`..`-10197` | **slider** part table (12 parts) | track + directional thumb variants; `0x4f7e`-era stores 12 ids (1.8.2-era, see §2.6) |
| `-10205`..`-10208` | slider thumb/track h+v | `controls.ts:166`: thumb -10206 h / -10208 v (pressed -10205/-10207) |
| `-10197`..`-10204` | **Scroll-arrow ics4 family** — directional ARROW BUTTONS (each a whole 16×16 button: face + arrow + bevel) | `controls.ts composeScrollbar` (keep in sync with that code comment). **RAISED / normal:** right `-10201` · left `-10202` · down `-10203` · up `-10204`. **PRESSED:** right `-10197` · left `-10198` · down `-10199` · up `-10200`. **This split is UNIVERSAL, not per-scheme** — the scheme forks carry no CDEF/control template (only art), so the mapping lives in Kaleidoscope's shared CDEF. Decoded at `kDEF231_0.asm:9f0e-9f38`: the CDEF writes BOTH ids per direction into the control record (offsets left 24/26, up 28/30, right 32/34, down 36/38) and picks by `contrlHilite` at draw time — PRESSED id for the held arrow, RAISED for the rest; a disabled control dims the RAISED art (there is **no separate inactive-arrow bitmap** — the 12-id part table is 8 arrows + 4 thumb `-10205..-10208`). Scheme art APPEARANCE of each quartet varies (s7 raised = beveled 3-D, platinum-8 raised = boxed gray button / its pressed = flat arrow). **(Corrected 2026-05-26 — the two quartets were previously swapped, so resting scrollbars showed depressed arrows. Owner chose to follow the 2.3.1 decode universally; platinum-8 — a 1998/1.x scheme — placed art the other way, so it renders its boxed `-10202` at rest, diverging from its own preview; logged in the faithfulness ledger.)** |
| `-8288`/`-8280` | scrollbar pressed (h/v) | immediates at the drawer |
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
>   normal·pressed) — there is NO separate inactive-arrow art;
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
````

## 2.5 cinf id range + clut/Colr (original)

````text
### 2.5 cinf id range + clut/Colr

| id / range | meaning |
|---|---|
| `-12240` .. `-12224` | **cinf id range** (`0x116f8`: `cmpiw #-12240`/`#-12224`). cicns whose id falls here have an associated `'pWin'` companion loaded. |
| `'cinf'` per element | the per-element info record (corner insets + colours). See §3.5. |
| `'clut'` (`0x106e6`) | scheme colour table. |
| `'Copl'` | internal GWorld tag, NOT a scheme resource (do not extract). |
| `-12345` (`0xCFC7`) | **NOT a resource id** — a sentinel transfer-mode marker written into a pixmap field at `0xff62`/`0x10954`. Ignore in any id sweep. |
````

## 3.1 The CDEF per-call state blob (`fp@(-26)` in `0x6688`, = `a2` in `0x7424`) (original)

````text
### 3.1 The CDEF per-call state blob (`fp@(-26)` in `0x6688`, = `a2` in `0x7424`)

Built by `0x6688` and passed to the part drawers. Confirmed offsets:

| offset | meaning | set/read at |
|---|---|---|
| `a2@(8)` | **disabled/inactive** state byte | `0x7576`/`0x75a6` (face), `0x76b8` (ring) |
| `a2@(9)` | **pressed/mixed** state byte | `0x7582` (face), `0x76d2` (ring) |
| `a2@(14)` / `a2@(18)` | control **Rect** (long pair → top/left, bottom/right) | `0x7434`/`0x743a` (`fp@(-8)`/`fp@(-4)`) |
| `a2@(24)` | scratch / "drawing in progress" byte | `0x75ca`/`0x75de` |
| (via `a2@`→`@`→`@(28)`→`@`) | the **'Acid' aux struct** | `0x768c`-`0x76a8` |

The dispatcher (`0x6688`) precomputes these locals from varCode/handle:
`fp@(-16)`,`fp@(-15)` (kind flags, cleared for varCode∈{1,2,3,4}), `fp@(-14)`
(active = varCode bit3), `fp@(-13)` (b/w-vs-color), `fp@(-4)` (variant: 1 for
varCode 6, 2 for varCode 7), `fp@(-2)` (cleared), `fp@(-1)` (set for varCode 3/4).
````

## 3.2 The 'Acid' aux struct (original)

````text
### 3.2 The 'Acid' aux struct

Reached `ControlHandle → @ → @(28) → @`. Magic at `+0` = `0x41636964` `'Acid'`
(`0x76a8`). Field `+30` = **default-button flag** (`tstb a0@(30)`, `0x76b2`).
Both gate whether the default ring (`0x76c4`) draws. (`tstb a2@(30)` in the
brief refers to this same flag once the aux handle is dereferenced.)
````

## 3.3 Window-chrome `a4`-relative globals (the work struct) (original)

````text
### 3.3 Window-chrome `a4`-relative globals (the work struct)

| offset | meaning |
|---|---|
| `0x792` (1938) | rect-list count + base (named-widget rects) |
| `0x85c` (2140) | **DEST** side-lists (window-relative borders), 4×162 B |
| `0xae4` (2788) | **SOURCE** side-lists (cicn-template borders), side 0; sides 1/2/3 at +162/+324/+486 = `0xb86`(2950)/`0xc28`(3112)/`0xcca`(3274) |
| `0x1c6` (454) | window record / port handle |
| `0x1f0`/`0x1f9`/`0x1f4`(500)/`0x1f5`(501) | cinf widget-presence flags (close/zoom/shade/body) — feed `0x487e`, `0x49d6`, the draw dispatch (`0x4124` tests `a4@(508)`, `0x4168` tests `a4@(501)`) |
| `0x1fc` (508) | grow-box present flag |
| `0x4c4`/`0x4c5`/`0x4c6` (1220/1221/1222) | render-mode flags consulted by the 9-slice/`0x10320` (b/w vs color, mask vs copy) |
| `0xd6c` (3436) | cicn cache table base (the 18-slot GWorld cache from `0x10472`) |
````

## 3.4 The recipe / border list layout (original)

````text
### 3.4 The recipe / border list layout

Per side, a 162-byte block: `count` at the block base (`a3@`/`a2@`), then
entries. Each entry = **`{partCode:int16 @ +2, border:int16 @ +4*i+4}`** indexed
by `4*i`. Walking gives cells **`[border[i-1], border[i])` tagged `part[i]`**
(END-based — the part code travels with the border that CLOSES the cell;
`0x5356`, confirmed in `compositor-spec.md`). Segment loop starts at index 1, so
`[0, border[0])` is the fixed leading **corner** (drawn 1:1), and
`[border[N-1], srcExtent)` the trailing corner. SOURCE borders are cicn-template
coords; DEST borders are window-relative (filled by `0x5178`).
````

## 3.4.1 wnd# fallback ladder (`0x356c..0x367e`) (original)

````text
#### 3.4.1 wnd# fallback ladder (`0x356c..0x367e`)

**Decoded 2026-05-29** against `.scratch/k231-kdef/kDEF/k231-kdef0.asm`. The
kDEF doesn't give up when `GetResource('wnd#', d3)` returns NULL — it walks a
12-step degraded-id cascade, ANDing `d3` against a fixed mask sequence and
re-attempting until a handle resolves. The asm pattern repeats per step:

```
35xx  594f             subqw #4,%sp                ; reserve return-handle slot
35xx  2f3c 776e 6423   movel #'wnd#',%sp@-         ; push FourCC 0x776e6423
35xx  3003             movew %d3,%d0               ; copy raw window id
35xx  0240 ffff        andiw #MASK,%d0             ; strip variant bits
35xx  3f00             movew %d0,%sp@-             ; push degraded id
35xx  a9a0             .short 0xa9a0               ; _GetResource
35xx  245f             moveal %sp@+,%a2            ; pop handle
35xx  200a             movel %a2,%d0
35xx  6614             bnes 0x35xx                 ; non-null → SKIP rest of cascade
```

Decoded mask sequence (step `i` ends at the `_GetResource` trap on the cited
addr; "bits cleared" is the bitmask interpretation — what each AND strips from
the 16-bit unsigned `d3`):

| step | addr | mask (hex) | bits cleared | role |
|---:|---|---|---|---|
| 0 | `0x3574` | `0xFFFF` | none | raw `d3` (no degradation) |
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

After `0x367e` the code clears 5 work-struct fields
(`a4@(0xae4/0xb86/0xc28/0xcca/0x792)` = the 4 side-list pointers + count) then
tests `a2`; still-null at `0x36a0` branches to `0x373e` (the "no recipe"
failure path).

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

**2.3.1-only enhancement.** The 1.8.2 kDEF (`.scratch/k182-kdef/kDEF/`,
60,732 B) has **zero** `'wnd#'` FourCC literals anywhere in `kDEF 0`
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
````

## 3.5 cinf byte layout (`0x108a0` + `0x116f8`) (original)

````text
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
| `[0]` | **Corner Size** | square corner size (`d3`) | `1610 moveb %a0@,%d3` @ `0x108a8` |
| `[1]` | **Side Thickness** | independent edge thickness (`d4`) | `1828 0001 moveb %a0@(1),%d4` @ `0x108b0` |
| `[2]` | **Tile Sides** | (boolean: full-band repeat vs first middle column/row) | TMPL 129 (was "(?)" — now confirmed) |
| `[3]` | **Pattern Anchor** | body resource/phase selector (NOT a 1..15 enum) | `0x109be cmpib #5,%a0@(3)` selects a cicn body at `=5`; otherwise loads a ppat and `0x10ab2 subq #1`-chain dispatches cases 1..4 → anchor body pattern phase at dst-rect corner TL/TR/BL/BR (reads `a2@(0/2/4/6)`); default (0 or ≥6) → anchor at origin `(0,0)`. Full decode + corpus survey in `docs/spec/cinf-resize-behavior.md`. |
| `[4..5]` | **Background Pattern ID** (DWRD) | signed resource ID: cicn for mode5, ppat otherwise | TMPL 129 / [body dispatch](cinf-resize-behavior.md) |
| `[6..7]` | **Background Pixel y** (DWRD) | sample-pixel coordinate | TMPL 129 |
| `[8..9]` | **Background Pixel x** (DWRD) | sample-pixel coordinate | TMPL 129 |
| `[10..11]` | **Text Pixel y** (DWRD) | text marker | TMPL 129 |
| `[12..13]` | **Text Pixel x** (DWRD) | text marker | TMPL 129 |
| `[14..15]` | **Embossing Pixel y** (DWRD) | embossing marker | TMPL 129 |
| `[16..17]` | **Embossing Pixel x** (DWRD) | embossing marker | TMPL 129 |
| `[18..]` | binary-internal pixel-sample cache, NOT on-disk data: byte[18] = pWin-back-patched word (for cinf ids in `-12240..-12225`); bytes[20..55] = 6 × `RGBColor` slots (active bg/text/emboss + inactive bg/text/emboss) written by `0xfc5c` at load. The kDEF grows the handle to 56 bytes via `_SetHandleSize` regardless of disk size and never reads bytes 20..55 from disk. Scheme Factory STR# 135 entries 8/9 ("Translucency / Opacity Percentage") are editor-UI controls the 2.3.1 binary does NOT consume — verified by full-binary grep + 1032/1033 corpus cinfs ship 18 bytes. Full trace + corpus survey: `docs/spec/cinf-extended-decode.md`. | size checks at `0x11740`/`0x11796` |

The TMPL is **shipped in 16 of 18 corpus bundles** — recoverable any time via `scripts/dump-author-hints.mjs` (`TMPL` resource id 129). The recipe-walk's `cinf` summary in `compositor-spec.md` (`cornerSize`/`sideThickness`/`tileSides`/`patternAnchor`/`textPixel`) is the loader's decoded field names; the TMPL 129 names above are the kDEF developer's own.
````

## 3.6 Rect layout (original)

````text
### 3.6 Rect layout

Mac `Rect` = 4× int16 in order **`{top, left, bottom, right}`** at `+0/+2/+4/+6`.
`0x0feae`/`0x10320` read `rect@(0)`=top, `@(2)`=left, `@(4)`=bottom, `@(6)`=right
(e.g. `0xfec2` `movew %a2@(6)` = right, compared to `@(2)` = left). Dest rects
flow in as `fp@(16)` (dst) / `fp@(12)` (src) pointers; the 9-slice computes the
four corner sub-rects by adding/subtracting `d3`/`d4` (the cinf insets) to the
outer rect (`0x10a28`-`0x10a34`: `addw d3,@(-14)` left+=X, `addw d4,@(-16)` top+=Y,
`subw d3,@(-10)` right-=X, `subw d4,@(-12)` bottom-=Y).

---
````

## 4.1 `0x49d6` — stretch-vs-fixed flag (jump table via helper `0x148`) (original)

````text
### 4.1 `0x49d6` — stretch-vs-fixed flag (jump table via helper `0x148`)

`FUN(partCode, flag) -> byte` (1 = may stretch, 0 = fixed). Verified entries:

| partCode | target | behaviour |
|---|---|---|
| default (1,5,6,7,8,9,11,12,13,14,18,…) | `0x4a5e` | `moveq #0` → **FIXED** |
| 0 | `0x4a12` | **STRETCH** always |
| 2 | `0x4a16` | stretch iff `a4@(454)→+112 == 0` (widget ABSENT — close gap) |
| 3 | `0x4a24` | stretch iff `a4@(501) == 0` (zoom gap) |
| 4 | `0x4a2e` | stretch iff `0x487e()==0` (shade gap) |
| 10 | `0x4a0c` | returns the caller's `flag` (`fp@(10)`) — flag-gated |
| 15 | `0x4a3a` | stretch iff `a4@(454)→+112 != 0` (widget PRESENT — inverse of 2) |
| 16 | `0x4a48` | stretch iff `a4@(501) != 0` (inverse of 3) |
| 17 | `0x4a52` | stretch iff `0x487e()!=0` (inverse of 4) |
````

## 4.2 `0x5178` — fill classifier (explicit `cmp` chains, NOT the table) (original)

````text
### 4.2 `0x5178` — fill classifier (explicit `cmp` chains, NOT the table)

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
````

## 5. Blit primitives (arg conventions) (original)

````text
## 5. Blit primitives (arg conventions)

| primitive | addr | call form | semantics |
|---|---|---|---|
| TILE | `0x0feae` | `feae(cicn, srcRect*, dstRect*, dirByte, pixmap)` (`fp@8/12/16/20/22`) | tile along the side's run axis, one src-sized CopyBits/CopyMask per step. `dir` = anchor end, NOT axis: 1 = forward from dst top-left, 0 = reverse from dst bottom-right (`(pc==11\|\|pc==14)?0:1`). See §5.1. **Always tiles; never scales.** |
| SCALE | `0x10320` | `f10320(cicn, srcRect*, dstRect*)` (`fp@8/12/16`) | ONE CopyBits (`$A8EC`)/CopyMask (`$A817`) src→dst → scales if dst grew. Used for partCode 18 (`0x59ba`) and named-widget rects (`0x6062`). |
| CORNER 1:1 | `0x102d0` | `(cicn, srcRect*, dstX, dstY)` | shift src by dst−src, call `0x10320` → 1:1 placement |
| BODY + BORDER | `0x107fe` | `(id, dstRect*, textRGB*, embossRGB*, bodyFill)` | square corners from byte[0], independent side bands from byte[1], optional body; see [solid face geometry](control-face-geometry.md) |
| FACE wrap (control) | `0x10fc0` | `(id, …)` pushes bodyFill=true → `0x107fe` | push face (`0x7594`) and bevel (`0x7778`); ring uses false via `0x107de` |
| 9-SLICE wrap (window) | `0x10fe0` | `(id, rect, d4, altFlag)` | loads cicn+cinf itself, then slices |
| RING blit | `0x107a4` | `(id, dstRect*, flag)` | the default-button ring 9-slice (its own wrapper over the slice engine) |

---
````

## 5.1 `0xfeae` tile blit: argument frame, axis and direction byte (traced 2026-10-21) (original)

````text
### 5.1 `0xfeae` tile blit: argument frame, axis and direction byte (traced 2026-10-21)

Traced from the local `m68k-elf-objdump` listing of kDEF 0
(`.scratch/k231-kdef/kDEF/k231-kdef0.asm`, sha256 of the resource in
[kdef-binary-inventory.md](kdef-binary-inventory.md)). Static reading only;
no original code was executed. Earlier rows in §1.5 and §5 put the direction
byte at `fp@(8)` and called it a horizontal/vertical selector. Both were wrong.

**Caller frame (`0x59c6..0x59ee`).** The caller pushes, in order: `d6` (long),
the direction byte (`moveb` to a word slot), `&fp@(-8)`, `&fp@(-16)` and
`a4@(1934)`. It pops 18 bytes. So inside `0xfeae`: `fp@(8)` = `a4@(1934)`
(`d4`, the chrome cicn), `fp@(12)` = src rect (`a3`), `fp@(16)` = dst rect
(`a2`), `fp@(20)` = direction byte, `fp@(22)` = the `d6` long. The src/dst
roles match `0x5356`, which writes the src rect through `sp@(32)` from the
template borders `a4@(2788)` and the dst rect through `sp@(36)` from the
placed borders `a4@(2140)`. The 18-byte pop matches 4+4+4+2+4.

**`0x5356` fixes the cross axis.** On sides 0 and 1 (top, bottom) it sets
dst height = src height (`0x539c..0x53a6`, `0x5404..0x540c`). On sides 2 and 3
(left, right) it sets dst width = src width (`0x5470..0x547c`,
`0x54da..0x54e6`). The run-axis bounds come from the border lists. A placed
cell therefore differs from its source only along the run.

**Fast paths (direction-independent).** These run before `fp@(20)` is read:

- `0xff3e..0xffb6`: src width 1 and dst width > 1. For each source row
  (rows map 1:1), sample the pixel (`0xf9f6`), then MoveTo/LineTo across the
  dst width.
- `0xffba..0x10018`: src height 1 and dst height > 1. The same, one source
  column per dst column.

Because of `0x5356`, these fire only for a source that is 1 px along the run.

**General path.** `d5` = src width and `d3` = src height (`0x10036..0x10042`).
`tstb fp@(20)` at `0x10074` chooses the branch:

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
passes `(pc==11||pc==14)?0:1` to `0x11452` (`0x651c..0x653c`). That routine
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

- Its dst rect is the rect-list (`a4@(1938)`) entry rect in template
  coordinates, remapped by `0x5cb6`. `0x5cb6` walks every side's cells through
  `0x5356` and offsets each corner by its containing cell's placed − template
  delta, so it depends on the `0x5178` widths.
- In the state-0 path it blits the chrome template `a4@(1934)` itself (src =
  raw entry rect), not a widget cicn.

What a code-10 collapse would do to widget placement or art is therefore not
established. This corollary must not be used to justify collapsing code 10.

Still open:

- Which callers of `0x632e` draw close (part 4) and collapse (part 9) on a full
  frame draw. Inside `0x572e`, only part 5 is drawn (`0x5a28..0x5a3c`).
- The meaning of flags `a4@(502/503/506/507/508)` and of the state byte.
- `0x5cb6`'s behaviour when a corner falls in a cell placed at width 0.
- How the rect-list rects are derived.

---
````

## 7. Gaps / not-yet-decoded (original)

````text
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
3. **'pWin' companion resource** (`0x1175e`, `#1884776814`) — loaded for cinf-
   range ids; its layout/use is not decoded.
4. **Scrollbar/slider/popup/progress/menu/disclosure LAYOUT arithmetic** — drawer
   entry points and cicn families are known (§1.3, §2.3–§2.6), but the
   track-stretch / thumb-position / barber-pole / tab math was only ever decoded
   against the **1.8.2** binary (folded into §2.6 at `[DOC]` confidence) and was
   never instruction-traced for 2.3.1.
5. **The `0x788c` hand-drawn bevel path** — entry + state selectors (`d5==254/255`)
   identified; the full MoveTo/LineTo coordinate sequence (the procedural
   button/checkbox geometry) is not transcribed.
6. **cinf widget-presence flags** (`a4@(0x1f0/0x1f4/0x1f5/0x1f9/0x1fc)`) — decoded
   as close/zoom/shade/body/grow by *behaviour*, not from a documented struct;
   the exact bit/byte semantics are inferential (§3.3).
7. **The 18-slot cicn cache** (`0x10472` switch, `a4@(3436)`) — IDs enumerated
   (§2.3) but the slot eviction/reuse policy is not traced; `-10224`/`-10223`
   remain unidentified.
8. **theme.json `part-N` vs runtime partCode for evolution/beos** — the recipe
   model is solid, but whether the corpus's per-link p18 / p1 cells reflect the
   live `wnd#` is still open (see `kdef231-recipe-walk.md` "honest discrepancy").
   Needs a raw `wnd#` dump from the 2.3.1 resource fork.

---
````

## Default push-button ring geometry (verified 2026-10-18) (original)

````text
### Default push-button ring geometry (verified 2026-10-18)

`0x7434` copies the control rectangle; `0x7572` passes it to the face drawer.
After face/text drawing, `0x7698..0x76a2` calls InsetRect with `(-4,-4)`. The
ring dispatch uses inactive -10232, pressed -10230 (falling back to -10231),
and active -10231 (`0x76b8..0x770e`). Its wrapper at `0x107de` disables body
fill when entering `0x107fe`. No source opaque-bounds crop is involved.

The border is not a rectangular nine-slice. Register d3 (cinf corner size)
sets both dimensions of each square corner; d4 (side thickness) sets band
thickness. Order: TL `0x10c54`, TR `0x10cb2`, top `0x10d34`, BL `0x10da6`,
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
````

## Further original passages restated in place (moved verbatim during the completeness pass)

### 1.5 Blit primitives + 9-slice (original, old lines 223–229)

````text
| `0x0feae` | **TILE blit** (default) | tile src across dst along ONE axis, chosen by `srcH == dstH` (`0x10146`, `0x10236`); dir byte selects the anchor end (§5.1). 1px-along-run fast paths `0xff3e`, `0xffba` | `fp@(8)`=cicn (→`d4`, `a4@(1934)`), `fp@(12)`=src rect (`a3`), `fp@(16)`=dst rect (`a2`), `fp@(20)`=dir byte (`(pc==11\|\|pc==14)?0:1`, caller `0x59c8`), `fp@(22)`=long from caller `d6` (alternate source pixmap, `0x1005c`) | `$A8EC` CopyBits / `$A817` CopyMask, `0x1027a` (skip if degenerate) |
| `0x10320` | **single scaled blit** (code 18) | ONE CopyBits (`0x103ea` `$A8EC`) or CopyMask (`0x10402` `$A817`), mapped src→dst (scales if dst grew) | `fp@(8)`=cicn (`a2`), `fp@(12)`=src rect (`d6`), `fp@(16)`=dst rect (`a3`) | `$A8EC`/`$A817`, RGBForeColor `0xf30a` |
| `0x102d0` | **corner 1:1 copy** | translate src rect by (dst−src) offset, then `0x10320` → places a corner at 1:1 size | `fp@(8)`=cicn, `fp@(12)`=src (`a2`), `fp@(16/18)`=dst origin | `0x10320` |
| `0x107fe` | **cinf body + border engine** | load cicn + cinf, optionally fill body, then paint square corners and independently thick masked edge bands | `fp@(8)`=id (`d4`), `fp@(10)`=dst rect (`a2`), `fp@(14)`=text RGB output, `fp@(18)`=emboss RGB output, `fp@(22)`=body-fill flag | `0x116f8` (cinf), `0x10472`/`0xed70` (cicn), `0xfc5c` (GetPixel — sample px → RGB; see §1.4), `0xf930`, `0xfdf8` |
| `0x108a0` | (inside `0x107fe`) | reads cinf corner size and side thickness: `d3`=byte[0] (`a3@`), `d4`=byte[1] (`a3@(1)`); style switch on cinf byte[3] (`a0@(3)`, `cmpib #5` + `subq #1` chain) | cinf `a3@`: `[0]`=square corner size, `[1]`=independent side thickness, `[3]`=pattern anchor/mode | — |
| `0x10fc0` | face wrapper (controls) | pushes body-fill true, forwards `fp@(8..18)` to `0x107fe` | `fp@(8)`=id, `fp@(10)`=dst rect, `fp@(14/18)`=text/emboss RGB outputs | `0x107fe` |
| `0x10fe0` | 9-slice wrapper (window regions) | sibling: loads cicn (`0x10472`) + cinf (`0x116f8`) itself, then slices | `fp@(8)`=id (`a3`), `fp@(10)`=rect (`a2`), `fp@(14)`=`d4`, `fp@(18)`=alt flag | `0x10472`, `0x116f8` |
````

## Control message table (initCntl row) (original)

````text
init — `_NewHandle #32` (`$A122`)
````

## Rows as merged by #388 (v2 `acc8ebea`; Gestalt reading kept, immediate-operand syntax restated in place)

````text
| `0x116f8` | **cinf loader** | `GetResource('cinf', id)` (`#1667853926` at `0x1171a`, trap `$A9A0` at `0x11722`), check size (`#18`/`#56`); cicn→cinf id range check `cmpiw #-12240`/`#-12224`; for in-range ids, also queries Gestalt selector `'pWin'` (`#1884776814`; trap `$A1AD` _Gestalt at `0x11768`, formerly misread as `_Get1NamedResource`; no `'pWin'` resource is loaded) | `'cinf'` `#1667853926` | size>18 ⇒ has extended fields; size==56 ⇒ full record |
| `0x106e6` | clut loader | loads `'clut'` (`#1668052340` = `0x636c7574`) | `'clut'` | scheme palette |
| `0x33a8`/`0x3be4` | `'Copl'` tag | `'Copl'` (`#1131376748` = `0x436f706c`) — the kDEF's private GWorld-tagging clut handle, attached to every GWorld it allocates | `'Copl'` | NOT a scheme resource; internal marker |
| `-12240` .. `-12224` | **cinf id range** (`0x116f8`: `cmpiw #-12240`/`#-12224`). For ids in this range the kDEF queries Gestalt selector `'pWin'` (`0x11768`, `$A1AD` _Gestalt; not a resource load). |
3. **'pWin' Gestalt selector** (`0x1175e`, `#1884776814`; trap `$A1AD` _Gestalt at `0x11768`, formerly read as a
   `_Get1NamedResource` companion-resource load) — queried for cinf-range ids. If the call succeeds, the response
   is used as a pointer to a record: when that record's byte 15 is non-zero, its word at offset 16 is
   copied into cinf byte 18. Which
   component registers `'pWin'` and what the word means are not decoded.
````

## Rows as merged by #379 (v2 `20fd70ab`; register operands restated in place, trap names kept)

````text
| 0 (drawCntl) ✓ | `0x67fc` | draw — `a0@(16)` gate → `0x6c28` part drawers (`$A874`/`$A95E`/`$A88B` GetPort/GetControlTitle/GetFontInfo per Traps.h; the role text "GetCIcon/CopyMask/StringWidth chain" was written under wrong names *(re-verify)* — §1.2) |
| 1 (testCntl) ✓ | `0x6816` | hit-test — `_PtInRect` (`$A8AD`; formerly misnamed PtInRgn, *re-verify* the "face region" wording) on the face; sentinel `a0@(17) == 0xfe` returns `d3=254` (pressed-state hit) |
| 14 (kControlMsgCalcBestRect) ✓ | `0x69b8` | best-fit rect — `$A874` `_GetPort` (formerly misnamed `_GetMHandle`; *re-verify*), read width/height/style from a font/title record, write Rect into `a3@`; routes through `0x65ba` for default-button cases |
| `0x4a64` | **layout precompute** (per side) | walk source side list, classify each segment, measure title (`$A88C` StringWidth; `$A888` here is TextFace per Traps.h, *re-verify* the call order), find title anchor `d4`, sum fixed widths, set per-half stretch flags `fp@(-18)`/`fp@(-20)`, call `0x5178` ×2 (one per half); title-fits gate at `0x4f58` clears `fp@(-290)` | side index; source list `a2`/`a3`; `fp@(-2)`=title width; `fp@(-290)`=title-fits | `0x49d6`, `0x5178`, `$A888` TextFace, `$A88C` StringWidth *(names per Traps.h; re-verify)* | fills DEST side list |
````


## Moved at the main→v2 sync of 2026-10-22 (main #377, `3d846c8e`)

> Verbatim from `docs/spec/kdef231-reference.md` on main at `3d846c8e`. The behavioural replacement text
> lives in [`kdef231-reference.md`](../kdef231-reference.md). Nothing here was re-decoded during the move.

| popup/tab | (msg-routed via `0x17452`) | `-12320` frame / `-12319` tab | §2.6 (behavioural `[DOC]`); the kDEF gates these to a loaded `'WDEF', -14336` whose code is called directly (`jsr a0@`) with varCode `(var & 15) + 1008` (procID family 63) — see `docs/spec/kdef-service-handlers.md` slot 8 |
| `0x4a64` | **layout precompute** (per side) | walk source side list, classify each segment, measure title (`StringWidth $A888`), find title anchor `d4`, sum fixed widths, set per-half stretch flags `fp@(-18)`/`fp@(-20)`, call `0x5178` ×2 (one per half); too-short step `0x4dfe..0x4e42` sets `fp@(-3)` (drops code 10 and the title, may clear `a4@(500)`); title gate at `0x4f58` zeroes `fp@(-290)` | `fp@(8)`=source list, `fp@(12)`=dest list, `fp@(16)`=template body `0x6582(0)`, `fp@(20)`=`0x4778` rect, `fp@(24)`=axis (`#1` sides 0/1); `fp@(-2)`=title width; `fp@(-290)`=GetWTitle Str255 (its length byte is the title flag) | `0x49d6`, `0x5178`, `$A888` StringWidth, `$A88C` GetFontInfo | fills DEST side list |
| `0x4f58` | title gate | `cmpiw #2,%d0; bgt`; if ≤2px of title room is left → `clrb fp@(-290)` (`0x4f5e`, the title string's length byte) + `clrw fp@(-2)` (collapse plate) | `fp@(-290)` title length byte, `fp@(-2)` title width | — | — |
| `0x5178` | **growth distribution** | fill DEST borders: budget = (half extent − Σ fixed widths); each stretch cell gets `budget/numStretch` EVEN, remainder L→R; explicit `cmp` chains classify fill codes (see §4) | `fp@(20)`=numStretch, `fp@(22)`=reqWidth (fixed sum), `fp@(24)`=**`0x49d6` flag** (always `0x4a64`'s too-short byte `fp@(-3)`, read at `0x52fc`), `fp@(26)`=5/6 gate (`#1` at `0x4db4`/`0x4dd4`, title string length byte `fp@(-290)` at `0x5100`/`0x5120`, `0` at `0x5148`; read at `0x530c`) — corrected 2026-10-21, [kdef231-code10-widgets.md](kdef231-code10-widgets.md) | `0x49d6` (`0x5302`) | DEST `border[i]=border[i-1]+w` |
| `0x572e` | **main draw loop** | per side, per segment: `0x5356` then blit (code 18 → `0x10320`, else `0x0feae`); empty cells skipped (`0x5990..0x59a6`). The side loop never touches the rect-list `a4@(1938)`. After it: `0x632e(5,0)` only under `a4@(502) && a4@(508)` (`0x5a28..0x5a3c`, the only widget call for types 1–3); under `a4@(509)` (family 63) `0x5b7a..0x5c92` blits rect-list types 5/6 and a 15×15 corner at the bottom-right of `0x6582(0)` from the template at raw rects (no `0x5cb6`); `0x5b5a..0x5b78` (`!a4@(510) && 0x489c` → `0x480a`/`0x45b2`) is untraced | side lists | `0x5356`, `0x10320` (`0x59ba`), `0x0feae` (`0x59e8`) | — |
| `0x1fc` (508) | **draw-active** flag (corrected 2026-10-21; was "grow-box present"): assigned from `WindowRecord+111` at `0x2e52` — `hilited` in the classic `WindowRecord` layout (inference from the struct layout; +110 visible, +112 goAwayFlag) — and forced for families 66/67/124 when variation bit 0 is clear (`0x315e`, `0x31d4`). Readers include `0x4124`, `0x5a30`, `0x334a`, `0x3386`, `0x3db0`, `0x3fa6`, `0x45be` (list may be partial). See [kdef231-code10-widgets.md](kdef231-code10-widgets.md) §6 |
