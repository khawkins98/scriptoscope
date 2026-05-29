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

## 1. Routine map

Grouped by subsystem. `fp@(n)` = stack-frame arg/local (positive = caller arg,
negative = local); `a2@(n)` etc = struct field; `a4` = the kDEF globals base
(the work struct built at init). All addresses verified present in the asm.

### 1.1 CDEF message dispatch (controls)

The control code is a standard **Appearance-era CDEF**, entered at `0x6688`.
Pascal signature `long CDEF(short varCode, ControlHandle, short message, long
param)`; on the frame: `fp@(18)`=varCode (→`d4`), `fp@(14)`=ControlHandle
(→`a2`), `fp@(12)`=message, `fp@(8)`=param. `rtd #12` pops the 12 arg bytes
(`0x772a`-style returns).

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x6688` | `CDEF_main` | CDEF entry: unpack handle, set state-bytes, dispatch on message | reads varCode `fp@18` (low 3 bits = control kind, bit3 = "active" → `fp@(-14)`), `a2@`→ControlRecord; sets `fp@(-16/-15/-14/-13/-4/-2/-1)` precomputed flags | `0x104` (gestalt-ish init), jump table `0x67b6` | `rtd #12` |
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

### 1.2 Control draw — push-button face + default ring

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
| `0x6cdc` | install-drawers | registers the FACE drawer per GDevice via `0xf112`; pushes `0x7424` (color twin) then `0x70f6` (b/w twin) | `pea 0x7424` / `pea 0x70f6` then `bsrl 0xf112` | `0xf112` | — |
| `0x7424` | **push-button FACE drawer** (color) | draw the button face cicn into the control rect; pick state cicn; then default-ring | `fp@(8)`→`a2` (state blob: `a2@(8)`=disabled, `a2@(9)`=pressed, `a2@(14..18)`=Rect, `a2@(24)` scratch), `fp@(12)`→`a3`; `fp@(18)`=varCode | `0xea08`,`0xe978`,`0xf2d6`,`0x10fc0` (9-slice), `0x107a4` (ring), `0x6d22` | `rtd #12` |
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

### 1.3 Control draw — other parts (drawer entry points; layout not fully traced)

| addr | role | cicn family | notes |
|---|---|---|---|
| `0x66b4`-region | scrollbar drawer | `-8278..-8271` v / `-8286..-8271` h | per §2.6 (1.8.2-era); `controls.ts` uses these IDs (verified consumer-side) |
| `0x788c`/bevel | bevel/checkbox/radio path | `-10232/-10231` mixed | hand-drawn fallback when cicn absent |
| popup/tab | (msg-routed) | `-12320` frame / `-12319` tab | §2.6 (behavioural `[DOC]`) |

### 1.4 Window chrome — load / layout / draw

| addr | name | purpose | key args / fields | callees | returns |
|---|---|---|---|---|---|
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
| `0x5ddc` | rect-list **widget draw** | draws one named-widget rect (close/zoom/shade/marker) | rect-list entry | `0x10320` | — |
| `0x5ffc` | rect-list **iterator** | walk the rect-list `a4@(1938)`; used for BOTH hit-test (returns hit index) and the widget-draw pass | `fp@(12)`=ControlHandle/window; flag arg | `0x5ddc` (`0x6040`) | hit index / drawn |
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

### 1.5 Blit primitives + 9-slice

| addr | name | purpose | args | callees |
|---|---|---|---|---|
| `0x0feae` | **TILE blit** (default) | step dst by src cell w/h, CopyBits/CopyMask one src-sized tile at a time, clamp last partial tile. 1px-tall/1px-wide fast paths. | `fp@(8)`=dir byte (→`d4`; `(pc==11\|\|pc==14)?0:1` from caller `0x59c8`), `fp@(12)`=src rect (`a3`), `fp@(16)`=dst rect (`a2`) | `$A8EC` CopyBits / `$A817` CopyMask, `0x1027a` (skip if degenerate) |
| `0x10320` | **single scaled blit** (code 18) | ONE CopyBits (`0x103ea` `$A8EC`) or CopyMask (`0x10402` `$A817`), mapped src→dst (scales if dst grew) | `fp@(8)`=cicn (`a2`), `fp@(12)`=src rect (`d6`), `fp@(16)`=dst rect (`a3`) | `$A8EC`/`$A817`, RGBForeColor `0xf30a` |
| `0x102d0` | **corner 1:1 copy** | translate src rect by (dst−src) offset, then `0x10320` → places a corner at 1:1 size | `fp@(8)`=cicn, `fp@(12)`=src (`a2`), `fp@(16/18)`=dst origin | `0x10320` |
| `0x107fe` | **cinf 9-slice engine** | load cicn + cinf for an id, read corner insets, blit 4 corners 1:1 + 4 edges + center per cinf style byte | `fp@(8)`=id (`d4`), `fp@(10)`=dst rect (`a2`), `fp@(18)`=optional rect, `fp@(22)`=scale flag (?), pushed scale-flag at `fp@(?)` | `0x116f8` (cinf), `0x10472`/`0xed70` (cicn), `0xfc5c` (GetPixel — sample px → RGB; see §1.4), `0xf930`, `0xfdf8` |
| `0x108a0` | (inside `0x107fe`) | reads cinf corner insets: `d3`=byte[0] (`a3@`), `d4`=byte[1] (`a3@(1)`); style switch on cinf byte[3] (`a0@(3)`, `cmpib #5` + `subq #1` chain) | cinf `a3@`: `[0]`=cornerX, `[1]`=cornerY, `[3]`=style/mode | — |
| `0x10fc0` | 9-slice wrapper (controls) | pushes `#1` scale-flag, forwards `fp@(8..18)` to `0x107fe` | `fp@(8)`=id, `fp@(10/14/18)`=rects/flags | `0x107fe` |
| `0x10fe0` | 9-slice wrapper (window regions) | sibling: loads cicn (`0x10472`) + cinf (`0x116f8`) itself, then slices | `fp@(8)`=id (`a3`), `fp@(10)`=rect (`a2`), `fp@(14)`=`d4`, `fp@(18)`=alt flag | `0x10472`, `0x116f8` |

### 1.6 Resource loaders

| addr | name | purpose | resource | notes |
|---|---|---|---|---|
| `0x10472` | **cicn loader / cache** | `Get1Resource('cicn', id)` (`$A9A0` at `0x10490`) + `GetCIcon` (`$AA0C`), tags GWorld with `'Copl'` clut; an inline `0x148` sparse switch (`0x104ba`) caches 18 specific control IDs into `a4`-relative GWorld slots | `'cicn'` `#1667851118` | the switch enumerates the cached control cicn families (see §2) |
| `0x10420` | cicn slot fetch | `GetCIcon`-by-id into a cached slot if empty | `'cicn'` | helper for `0x10472` |
| `0x10440` | plain cicn load | `Get1Resource('cicn', id)`+`GetCIcon`, tag `'Copl'` | `'cicn'` | |
| `0x116f8` | **cinf loader** | `Get1Resource('cinf', id)` (`#1667853926` at `0x1171a`), check size (`#18`/`#56`); cicn→cinf id range check `cmpiw #-12240`/`#-12224`; also loads paired `'pWin'` (`#1884776814`) resource for in-range ids | `'cinf'` `#1667853926` | size>18 ⇒ has extended fields; size==56 ⇒ full record |
| `0x106e6` | clut loader | loads `'clut'` (`#1668052340` = `0x636c7574`) | `'clut'` | scheme palette |
| `0x33a8`/`0x3be4` | `'Copl'` tag | `'Copl'` (`#1131376748` = `0x436f706c`) — the kDEF's private GWorld-tagging clut handle, attached to every GWorld it allocates | `'Copl'` | NOT a scheme resource; internal marker |

A-trap addresses for these calls are in §6.

---

## 2. Resource-ID tables

IDs are signed int16 (negative = the system/scheme resource range). "movew #-NNNN"
immediates were swept from the asm; the cache-switch IDs were hex-decoded from
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
| `-10240` | push-button face — **disabled/inactive** (`a2@(8)`) | `0x757c` |
| `-10238` | push-button face — **pressed** (`a2@(9)`) | `0x7588` |
| `-10232` | default-ring — **inactive** (`a2@(8)`) | `0x76c4` |
| `-10230` | default-ring — **mixed** (`a2@(9)`) | `0x76de` |
| `-10231` | default-ring — **active** (default) | `0x76f4`/`0x7708` |
| `-10176` | bevel-button face base **(?)** | one immediate |

### 2.3 Control cicns CACHED by the `0x10472` switch (`0x104c0`, hex-decoded)

These 18 IDs get dedicated `a4`-relative GWorld cache slots (range lo=-14332,
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
> `-9488..-9504` are still derived consumer-side (not kDEF immediates). The full
> two-channel id→role map is the **pictogram ID rubric** rendered in
> `demo/index.html` `iconInventory` (and reproduced for authoring in the asset catalog).
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
| `-12240` .. `-12224` | **cinf id range** (`0x116f8`: `cmpiw #-12240`/`#-12224`). cicns whose id falls here have an associated `'pWin'` companion loaded. |
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

### 3.2 The 'Acid' aux struct

Reached `ControlHandle → @ → @(28) → @`. Magic at `+0` = `0x41636964` `'Acid'`
(`0x76a8`). Field `+30` = **default-button flag** (`tstb a0@(30)`, `0x76b2`).
Both gate whether the default ring (`0x76c4`) draws. (`tstb a2@(30)` in the
brief refers to this same flag once the aux handle is dereferenced.)

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

### 3.4 The recipe / border list layout

Per side, a 162-byte block: `count` at the block base (`a3@`/`a2@`), then
entries. Each entry = **`{partCode:int16 @ +2, border:int16 @ +4*i+4}`** indexed
by `4*i`. Walking gives cells **`[border[i-1], border[i])` tagged `part[i]`**
(END-based — the part code travels with the border that CLOSES the cell;
`0x5356`, confirmed in `compositor-spec.md`). Segment loop starts at index 1, so
`[0, border[0])` is the fixed leading **corner** (drawn 1:1), and
`[border[N-1], srcExtent)` the trailing corner. SOURCE borders are cicn-template
coords; DEST borders are window-relative (filled by `0x5178`).

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
| `-14300` | collapsed-titled-utility | → `-14304` |
| `-14296` | side-floating-utility-window | → `-14304` |
| `-14292` | collapsed-side-utility | → `-14296` → `-14304` |
| `-14288` | no-title-utility-window | → `-14304` |
| `-14284` | collapsed-no-title-utility | → `-14288` → `-14300` → `-14304` |
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

### 3.5 cinf byte layout (`0x108a0` + `0x116f8`)

**Authoritative source:** every bundle in the corpus ships **TMPL 129 `cinf`** — Kaleidoscope's own ResEdit/Resorcerer template that documents the byte layout the kDEF reads. Every "(?)" entry below is now resolved against TMPL 129:

| byte | TMPL 129 field name | kDEF use | evidence |
|---|---|---|---|
| `[0]` | **Corner Size** | corner inset X (`d3`) | `1610 moveb %a0@,%d3` @ `0x108a8` |
| `[1]` | **Side Thickness** | corner inset Y (`d4`) | `1828 0001 moveb %a0@(1),%d4` @ `0x108b0` |
| `[2]` | **Tile Sides** | (boolean: tile vs stretch the side bands) | TMPL 129 (was "(?)" — now confirmed) |
| `[3]` | **Pattern Anchor** | body fill pattern-phase selector (NOT a 1..15 enum) | `0x109be cmpib #5,%a0@(3)` selects the bgPattern-fill path when `=5`; otherwise `0x10ab2 subq #1`-chain dispatches cases 1..4 → anchor body pattern phase at dst-rect corner TL/TR/BL/BR (reads `a2@(0/2/4/6)`); default (0 or ≥6) → anchor at origin `(0,0)`. Full decode + corpus survey in `docs/spec/cinf-resize-behavior.md`. |
| `[4..5]` | **Background Pattern ID** (DWRD) | tied ppat handle | TMPL 129 |
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
`0x0feae`/`0x10320` read `rect@(0)`=top, `@(2)`=left, `@(4)`=bottom, `@(6)`=right
(e.g. `0xfec2` `movew %a2@(6)` = right, compared to `@(2)` = left). Dest rects
flow in as `fp@(16)` (dst) / `fp@(12)` (src) pointers; the 9-slice computes the
four corner sub-rects by adding/subtracting `d3`/`d4` (the cinf insets) to the
outer rect (`0x10a28`-`0x10a34`: `addw d3,@(-14)` left+=X, `addw d4,@(-16)` top+=Y,
`subw d3,@(-10)` right-=X, `subw d4,@(-12)` bottom-=Y).

---

## 4. The part-code jump table (`0x49d6`) + fill classifier (`0x5178`)

Two stacked decisions, both keyed on the **part code** (never on pixel content
or width). Reconciled with `compositor-spec.md`'s table — they agree.

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
(`0x518a`); distribution is EVEN across stretch cells, remainder L→R; symmetric
about the title because `0x4a64` calls `0x5178` twice (per half, split at the
title anchor).

> This SUPERSEDED the retired `kdef-layout-recipes.md §1/§11.x` (the dead 1.8.2
> reading: a grow set `{5,6,8,18}` + a pixel-variance plate search).
> Fixed-vs-stretch is the part code, full stop.

---

## 5. Blit primitives (arg conventions)

| primitive | addr | call form | semantics |
|---|---|---|---|
| TILE | `0x0feae` | `feae(dirByte, srcRect*, dstRect*)` (`fp@8/12/16`) | step dst by src cell size, CopyBits/CopyMask one tile, clamp last partial. `dir` = horizontal vs vertical run (`(pc==11\|\|pc==14)?0:1`). 1px-tall and 1px-wide fast paths. **Always tiles; never scales.** |
| SCALE | `0x10320` | `f10320(cicn, srcRect*, dstRect*)` (`fp@8/12/16`) | ONE CopyBits (`$A8EC`)/CopyMask (`$A817`) src→dst → scales if dst grew. Used for partCode 18 (`0x59ba`) and named-widget rects (`0x5ddc`). |
| CORNER 1:1 | `0x102d0` | `(cicn, srcRect*, dstX, dstY)` | shift src by dst−src, call `0x10320` → 1:1 placement |
| 9-SLICE | `0x107fe` | `(id, dstRect*, …, scaleFlag)` | cinf-driven: 4 corners 1:1 (`0x102d0`-style), 4 edges + center per cinf byte[3] style; corner insets from cinf byte[0]/[1] |
| 9-SLICE wrap (control) | `0x10fc0` | `(id, …)` pushes `#1` scaleFlag → `0x107fe` | used by button face (`0x7594`) + ring (`0x107a4`-region) |
| 9-SLICE wrap (window) | `0x10fe0` | `(id, rect, d4, altFlag)` | loads cicn+cinf itself, then slices |
| RING blit | `0x107a4` | `(id, dstRect*, flag)` | the default-button ring 9-slice (its own wrapper over the slice engine) |

---

## 6. A-trap inventory

The toolbox calls the kDEF uses, with representative invocation addresses (full
counts via `grep '.short 0xaXXX'`). Trap numbers are the standard Mac OS set.

| trap | name | role in kDEF | example addr(s) |
|---|---|---|---|
| `$A8EC` | **CopyBits** | the core scaled/1:1 blit | `0x103ea`, `0x750c`, `0x7654` |
| `$A817` | **CopyMask** | masked blit (cicn alpha) | `0x10402`, `0x7676` |
| `$A874` | GetPort | save current port | `0xfeee`, `0x10336`, `0x108cc` |
| `$A873`/`$A879` | SetPort/SetPortBits (?) | port plumbing | `0x...` |
| `$A8A9` | **GetPixBaseAddr** (?) | pixmap base for the blit | `0x103d2` |
| `$AA19` | **GetGWorld** | save current GWorld | `0xff32`, `0x1037c`, `0x1e96` |
| `$AA1A` | **SetGWorld** (the GWorld dispatch form) | switch to the cicn GWorld | `0xff38`, `0x10382`, `0x1e90` |
| `$AA1E` | **NewGWorld** | offscreen alloc (cicn cache) | `0x10434` |
| `$AA0C` | **UpdateGWorld** | refresh a cached GWorld | `0x10460` |
| `$AA14` | **LockPixels** | lock the cicn pixmap before CopyBits | `0x760c`, `0x10994` |
| `$AA15` | **UnlockPixels** | unlock after the blit | `0x7612`, `0x10998` |
| `$A9A0` | **GetResource / Get1Resource** | wnd#, cicn, cinf, clut, pWin | `0x3574`, `0x10490`, `0x11722` |
| `$A9A2` | **ReleaseResource** | free recipe handle | `0x36a6`, `0x1172e` |
| `$A024` | **SetHandleSize** | resize loaded handle | `0x1174a`, `0x117b6` |
| `$A01B` | **SetGWorld** (`_GWorldDispatch` selector form via `0x118`/`0x2a6`) | switch drawing world using saved port/device | `0x10490`, `0x1045a` |
| `$A994` | **CurResFile** | save current resource file | `0x10816`, `0x10494` |
| `$A998` | **UseResFile** | restore resource file | `0x10830`, `0x104ae` |
| `$A888` | **StringWidth** | measure title text (title-fits gate) | `0x4f18`, `0x4f20`, `0x4f36` |
| `$A88C` | **GetFontInfo** | ascent/descent for title region | `0x4aa4`, `0x4f0a`, `0x4f28` |
| `$A887` | **TextFont** | set title font | `0x7540` |
| `$A88A` | **TextSize** | set title size | `0x754a` |
| `$A889` | **TextFace/DrawChar-area** | set title face / draw | `0x7558`, `0x75bc`, `0x75c4` |
| `$A8B2` | **PaintRect** | center fill in the 9-slice (case `d3==d4`) | `0x10a3e`, `0x10a66` |
| `$AA25` | **DisposeGWorld** | free temp world | `0x10a14` |
| `$AA42`/`$AA55`/`$AA73` | Appearance/Icon-services utilities (?) | control-state / icon queries | scattered |
| `$A8D8`/`$A8D9` | **SectRect / UnionRect** | rect math in tiling/slicing | `0x103c4`, `0x15c92` |
| `$A8DC`/`$A8DF`/`$A8E0`/`$A8E4`/`$A8E5`/`$A8E6` | EqualRect / OffsetRect / InsetRect / PtInRect family | geometry | throughout |
| `$AB1D` | **`_CopyDeepMask` / `_GetMaskTable`-area QuickDraw selector** (?) | the control-draw path's main toolbox bracket (`0x7484` pushes selector `#1441792` etc.) | `0x747e`, `0x749c`, `0x74b6` |
| `$ABCA`/`$ABC9` | **PlotCIconHandle / PlotIcon** (?) | icon plot | `0x15cd0` |
| `$A06A`/`$A069`/`$A029`/`$A023`/`$A122` | memory mgr (HLock/HUnlock/NewHandle/DisposeHandle) | handle juggling | `0x108f2`, `0x10aa0` |

> Several trap names are marked **(?)** where the trap number is ambiguous
> between the classic and Appearance dispatch tables; the CopyBits/CopyMask,
> GetResource/ReleaseResource, NewGWorld/SetGWorld, StringWidth/GetFontInfo, and
> the text traps are unambiguous and load-bearing. Resolve the rest against a
> Mac trap-number table if a behaviour question turns on one.

---

## 7. Gaps / not-yet-decoded

1. **High CDEF messages (19/20/21/27/34)** — dispatch targets are decoded
   (`0x698a`/`0x6b14`/`0x6a86`/`0x6980`/`0x6b84`) but the per-message behaviour
   is not traced; the message *meanings* are inferred from Appearance numbering,
   not proven (§1.1).
2. ~~**cinf byte[2] and bytes [4..55]**~~ **RESOLVED 2026-05-29** — TMPL 129 shipped in 16 of 18 corpus bundles gives the full field map: byte[2]=Tile Sides, byte[3]=Pattern Anchor, bytes[4..17]=3× DWRD pixel coords (bg/text/embossing). See §3.5. **The 15-value Scheme Factory MENU 139 vocabulary** referenced in earlier `cinf.js` decoder comments is editor-side authoring sugar — the kDEF dispatches on `byte[2]` as a boolean (tile vs stretch the 4 edge bands) and `byte[3]` as a 5-way switch (`0`=origin anchor, `1..4`=anchor TL/TR/BL/BR corner of dst rect, `5`=use bgPattern resource); higher values fall through to the `=0` default. Verified at `0x10ab2` subq-chain + `0x109be cmpib #5,%a0@(3)` — there is no `cmpib` against byte[3] for values 6..15 anywhere in the kDEF. The "anchor-corner" labels (indices 10..14) in `RESIZE_BEHAVIOR_LABELS` were speculative and unreachable from the kDEF's byte[3] dispatch; dropped. Full decode + corpus survey in `docs/spec/cinf-resize-behavior.md`.
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
