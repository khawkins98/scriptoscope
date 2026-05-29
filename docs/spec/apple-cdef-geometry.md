# CDEF -63 geometry decode (clean-room)

Source (read-only, understanding-only): `.scratch/iso-recon/code-out/CDEF-n63.asm`
(5426 B binary, objdump m68k:68030, 1874 lines). All `0xADDR` are file-relative
offsets into `CDEF-n63.bin`. Trap names follow the project's established
convention (`.scratch/iso-recon/trap-scan.mjs` + `docs/spec/platinum-wdef125-decode.md`).
Mimic, never execute.

---

## 0. Headline classification

**This is NOT the multi-kind button CDEF.** There is no secondary dispatch on a
control *kind* (no push-button / checkbox / radio / popup / tab / disclosure /
progress branch). CDEF -63 handles a **single control family** and branches only
on the control's **hilite/state** byte and on **part codes**, with `value / min /
max` driving a **thumb-in-track** geometry. That signature (proportional thumb,
value→pixel mapping, up/down part codes 26/27, indicator part 129) is the
Appearance-Manager **scroll-bar / slider / indicator** family. The multi-kind
button CDEF in this corpus is the separate, much larger `CDEF-n1.asm` (~40 KB,
dispatches on 12 messages, kinds 21/129/16/4, etc.).

Consistent with the prior trap-fingerprint: drawing pixels is **delegated**. Two
delegation channels are present:
1. an **indirect call through a proc handle** chained off `contrlData`
   (`jsr %a0@` @ `0x10b0`), and
2. **QuickDraw / Color-QuickDraw / Appearance traps** issued directly
   (FrameRect, MoveTo/LineTo, EraseRect, RGBForeColor/Back, region ops, an
   Appearance/utility selector trap `0xa8b5`, plus `'proc'`/`'PAT#'` resource
   fetches).

So the proc **computes geometry + sets up an offscreen color port + sequences
the part draws**, and hands the actual rendering to the system proc/traps.

---

## (a) Routine map (addr → role)

All entry points are `linkw %fp,#…`. Sizes/roles inferred from body.

| addr | frame | role |
|---|---|---|
| `0x0e`/`0x14` | `#-52` | **CDEF entry** (`Main`). Unpacks args, snapshots port (`0x1224`/`0x128e`), dispatches on message, restores port (`0x1262`/`0x12f2`), returns result in `%d6`→`fp@(20)`. |
| `0x1e2` | `#-8` | **initCntl** (msg 3). Allocates the **58-byte** private struct (`moveq #58; 0xa322` @ `0x1f4`), stores it in `contrlData` (`a3@(28)`), copies value/min/max + flags into it, then calls the thumb-calc `0xa6c`. |
| `0x386` | `#-52` | **drawCntl** (msg 0). Builds offscreen GWorld (`0xeba`), recomputes thumb (`0xa6c`), erases/frames track, draws groove lines, optionally calls label-text `0xd76`, blits + tears down the port. |
| `0x6e8` | `#-12` | **testCntl** (msg 1). `PtInRect(pt, thumbRect)`-style hit test (`0xa8ad` @ `0x71a`) gated by active state; returns hit part in `%d0`. |
| `0x746` | `#0` | **dispCntl** (msg 4). Disposes the private struct (region/handle dispose, `0xa023` @ `0x778`) and clears `contrlData`. |
| `0x78c` | `#0` | **calcCRgns / calcCntlRgn / calcThumbRgn** (msgs 2/10/11). Calls `0xa6c` to recompute, then `SetRectRgn`(`0xa8df` @ `0x7b6`) of the requested rect into the caller's region handle. |
| `0x7c0` | `#-30` | **autoTrack** (msg 8). Live-drag tracking; reads cursor/`'proc'` resource (resID `0xDFE0`=-8224 @ `0x900`), maps mouse to value, writes `contrlValue`, sets a "value changed" flag. |
| `0xa6c` | `#-34` | **THUMB/TRACK GEOMETRY** (core). Value/min/max → thumb rect; track length; orientation (H/V). Central calculator called by init/draw/calc. |
| `0xc5c` | `#-18` | **thumb-glyph draw** — centers a small fixed glyph (size clamped 4..6) inside the thumb and strokes it (`MoveTo/LineTo` @ `0xd2e`/`0xd38`…), with hatch/pat fills (`0xa8cb/cc/c7/cd`). |
| `0xd76` | `#-272` | **label / title text** — sets font/size, `TruncString`-style fit (`0xa9ce` @ `0xea2`, selector `0x8208FFE0`), draws the control title into a 256-byte buffer rect. |
| `0xeba` | `#-20` | **offscreen color-port setup** — `NewPtr 108` (`0xa11e` @ `0xec8`), `OpenCPort` (`0xaa00` @ `0xef0`), origin/clip set, copies vis/clip rgns. Returns the port ptr (0 = couldn't). |
| `0xf5a` | `#-16` | **color-pair setup** — fetches a fore/back RGB pair from a color table by index (`0xaa64` @ `0xf94`/`0xfbe`/`0xfe8`), swaps for hilite (`fp@(19)` flag), issues `RGBForeColor`/`RGBBackColor` (`0xaa14`/`0xaa15` @ `0x1020`/`0x1024`). |
| `0x1030` | `#-14` | **part-draw dispatch (DELEGATION)** — validates the chained proc handle (`HandToHand 0xa9a2` @ `0x105a`, `RecoverHandle 0xa9af` @ `0x1062`), locks it, and **`jsr %a0@`** @ `0x10b0` with (partCode `fp@(18)`, struct rect, bounds `fp@(20)`). Wrapped by hilite calls (`0x1336`) when `varCode&8`. |
| `0x10da` | `#0` | track/channel rect helper (insets by `a3@(54)`-derived margin; uses `InsetRect 0xa8a9` @ `0x1100`). |
| `0x112a` | `#0` | rect helper: copy bounds (`a3@(10..17)`→out) and shrink one axis by `a3@(42)` toward end flagged by `a3@(48)`. |
| `0x1174` | `#0` | rect helper: copy bounds, inset one side by `a3@(42)` per `a3@(48)`, then `-1,-1`. (Track-minus-arrows.) |
| `0x11b6` | `#0` | rect helper: arrow-box rect = bounds end ± (`a3@(54)+3`). |
| `0x11fa` | `#0` | rect helper: bounds offset `+3,+3 / +1,+1` (small inset frame). |
| `0x1224` | `#-4` | save current `GrafPort` state (`GetPort 0xa874` @ `0x1232`; copies port fields +68/+70/+72/+74). |
| `0x1262` | `#0` | restore port lines/pen from a saved rect (issues four primitives `0xa887/0xa88a/0xa888/0xa889`). |
| `0x128e` | `#-8` | save Color-QD pen/clip via `0xa910` @ `0x129c` + `0xaa48` @ `0x12c4`. |
| `0x12f2` | `#-8` | restore Color-QD pen/clip (counterpart of `0x128e`). |
| `0x1336` | `#-8` | hilite-bit poke: writes globals `0xba6`/`0xba8`/`0x988`/`0x984` (HiliteRGB / pen-mode lowmem) before/after a delegated draw. |
| `0x139c` | `#-20` | cursor/region: gets mouse pos (`0xaa19`/`0xaa1a`? — see could-NOT-pin), midpoints a rect, allocates via `0xaa07`, `0x14f4` if empty. |
| `0x142e` | `#-4` | **part-index search** — loops `0xa84e`/`0xa943`/`0xa950` over parts, returns matching index (used to resolve a value→part). |
| `0x1486` | `#-12` | **list/record lookup** — Pack selector 36 (`0xa9ed` @ `0x14ae`), walks 8-byte records at `+2+8·i`, returns a byte. |
| `0x14f4` | `#0` | **`'PAT#'` resource fetch** — `GetResource('PAT#', id)` (`0xa9a0` @ `0x1504`, type `0x50415423` @ `0x14fa`), indexes the pattern list, copies the 8-byte pattern out. |

---

## (b) Message dispatch table

Range check + jump table @ `Main`:

```
0xe0  movew %d5,%d0            ; %d5 = message (from fp@(12), loaded @ 0x16)
0xe2  bmiw 0x17c               ; message < 0  → common exit
0xe6  cmpiw #11,%d0
0xea  bgtw 0x17c               ; message > 11 → common exit
0xee  addw  %d0,%d0            ; ×2
0xf0  movew %pc@(0xf8,%d0:w),%d0   ; TABLE BASE = 0xf8
0xf4  jmp   %pc@(0xf6,%d0:w)       ; JMP BASE   = 0xf6
```

Table bytes @ `0xf8` (12 × int16, each = target − `0xf6`):

| idx | int16 | target | standard CDEF message | routine reached |
|---|---|---|---|---|
| 0 | `0x001a` | `0x110` | **drawCntl** | sets up @0x110, `jsr 0x386` @ `0x126` |
| 1 | `0x003c` | `0x132` | **testCntl** | `jsr 0x6e8` @ `0x138` |
| 2 | `0x004c` | `0x142` | **calcCRgns** | `jsr 0x78c` @ `0x14c` |
| 3 | `0x0060` | `0x156` | **initCntl** | `jsr 0x1e2` @ `0x15c` |
| 4 | `0x006e` | `0x164` | **dispCntl** | `jsr 0x746` @ `0x166` |
| 5 | `0x0086` | `0x17c` | posCntl | → common exit (NO-OP / system default) |
| 6 | `0x0086` | `0x17c` | thumbCntl | → common exit |
| 7 | `0x0086` | `0x17c` | dragCntl | → common exit |
| 8 | `0x0078` | `0x16e` | **autoTrack** | `jsr 0x7c0` @ `0x174` |
| 9 | `0x0086` | `0x17c` | (unused / exit) | → common exit |
| 10 | `0x004c` | `0x142` | **calcCntlRgn** | shares calcCRgns (`0x142`) |
| 11 | `0x004c` | `0x142` | **calcThumbRgn** | shares calcCRgns (`0x142`) |

Note: posCntl(5)/thumbCntl(6)/dragCntl(7) and idx 9 all fall through to the
shared epilogue at `0x17c` — i.e. this CDEF lets the Control Manager / Appearance
default handle them. calcCRgns / calcCntlRgn / calcThumbRgn (2/10/11) share one
entry `0x142` → `0x78c`; the requested region/part is selected by the `param`
argument inside `0x78c` (passed as `fp@(16)` → region handle, with the part
implicit in `0x7a4`).

The common epilogue `0x17c` re-hilites for non-init/non-dispose messages
(`tstw a3@(46)` @ `0x188`, then `0xa936`/`0xa06a`), restores both port snapshots,
and returns `%d6` into `fp@(20)`.

---

## (c) Control-kind dispatch + delegation (DrawTheme* call map)

**There is no kind table.** The only "kind-ish" branches are on the
ControlRecord **hilite** byte (`contrlHilite` @ ControlRecord +17, read as
`a3@(17)`/`a4@(17)`):

| site | test | meaning |
|---|---|---|
| `0x3bc` | `cmpiw #255, a3@(17)` | 255 = `kControlInactivePart` (dimmed/disabled) |
| `0x51a` | `cmpiw #1, a3@(17)` | 1 = a specific part highlighted/pressed |
| `0x728` | `cmpiw #255, …` (testCntl) | inactive controls fail the hit test |
| `0xd8c`,`0xdba`,`0xdfa` | `#1`/`#255` (label draw) | dim/normal label color |

Part codes seen (the `param`/`fp@(18)` and rect-selector values):

| value | site | role |
|---|---|---|
| 129 (`0x81`) | `0x40e` | indicator / proportional thumb part |
| 26 | `0x430`,`0x84c`,`0x9b8`,`0xb64`,`0xbc0` | up/decrement-end part |
| 27 | `0x84a`,`0x9c0` | down/increment-end part |
| 49 (`0x31`) | `0x1404`,`0xe0e` | a sub-part / glyph index |
| 4 (calcCRgns) | `0x59c` and `0x7a4` arg `5`/`4` | "draw whole control" vs "draw indicator" selector passed to `0x1030` |

**Delegation map** (where pixels actually get produced):

| from | mechanism | what |
|---|---|---|
| `0x10b0` | `jsr %a0@` (indirect) | chained part-draw proc in `contrlData→…→+6`; args = (partCode, rect, bounds). This is the primary "DrawTheme*"-equivalent. |
| `0x3f0`,`0x5a8`,`0xaf0` | `jsr 0x1030` with selector 5 then 4 | invoke the above twice (frame pass + fill pass). |
| `0x4b8` | `jsr 0xeba` | offscreen color GWorld so the delegated draw composites cleanly. |
| `0x502`,`0x612` | `jsr 0xd76` / `0xc5c` | label text + thumb glyph (drawn locally with QD, not delegated). |
| `0x826`,`0xaa8`,`0x9ec`,`0x107c` | `jsr 0x1336` | poke HiliteMode lowmem (`0xba6`/`0xba8`/`0x988`/`0x984`) around delegated draws. |
| direct traps | `0xa8a1` FrameRect @ `0x63e`; `0xa893/0xa891` MoveTo/LineTo groove @ `0x656`–`0x66e`; `0xa8a3` EraseRect @ `0x486`/`0x498`/`0x548`; `0xaa14/0xaa15` color @ `0x6a6`/`0x6ac` | local QD chrome. |
| `0xa8b5` (Appearance/utility selector) | `0x86e`,`0x87e`,`0x89a`,`0xe86` | selector longwords `0x84020008`,`0x8404000C`,`0x82020006`,`0x8208FFE0`,`0x8208FFE0` — Appearance/theme metric or icon-suite calls (exact verb un-pinned, see (e)). |

---

## (d) Per-kind geometry (the one kind: value-driven track control)

### Private struct (`contrlData` deref, register `%a4`), 58 bytes
Allocated `moveq #58; 0xa322` @ `0x1f4`. Field offsets pinned from init/calc:

| off | written @ | meaning (inferred) |
|---|---|---|
| +4 (w) | `0x22c`,`0x2be` | current value (copy of `contrlValue`) |
| +6 (l) | `0x328` (`value*65536 + …`) | value as Fixed / scaled accumulator |
| +10..+17 | `0x32c`–`0x336`, `0xac6` | **thumb/part rect** (top,left,bottom,right) ← copied from `a3@(8..15)` then adjusted |
| +18 (l) | `0x47e` | bounds copy (left/top of control) used for "unchanged" short-circuit |
| +26 (w) | `0x2f2` | track extent cache (= +28 when btst0 set) |
| +28 (w) | `0x2e8` = `a3@(14)-a3@(10)` | **control height** (bottom−top of contrlRect) |
| +30 (w) | `0x466`,`0xaf4` | last-drawn min/extent |
| +32 (w) | `0x470`,`0xafc` | last-drawn max/peer |
| +34 (w) | `0x338` = `a3@(22)` | max (copy of `contrlMax`) |
| +36 (w) | `0x232` | value (second copy) |
| +38 (b) | `0x33e`=1, `0x6d6`=1, `0x49c` test | "needs redraw / clean" flag |
| +39 (b) | `0x228` = `(a3@(4)@(6) & 0xC000)!=0` | "color/deep port" flag |
| +40 (b) | `0x26c`,`0x27e` | packed flag byte (variant bits) |
| +42 (w) | `0x240` = `a3@(22)` if max>1 | max-1 / range cache |
| +44 (w) | `0x250` = `a3@(18) & 0xFF` | low byte of proc-id/flags |
| +46 (w) | `0x294` = `(thumbRgn==0)` | "no thumb region" flag |
| +48 (w) | `0x30c`/`0x306` | **orientation/direction**: −1 ⇒ one axis grows from far end, else near end (used by every rect helper) |
| +50 (w) | `0xa90` = global `0xbac` | a system metric snapshot (thumb min length?) |
| +52 (w) | `0xb12` | second metric (paired with +50) |
| +54 (w) | `0x11c6`,`0xc8c`,`0x11b6` | **arrow / cap thickness** (used as `+3` in `0x11b6`, `0x10ee`) |
| +56 (w) | `0xb1a` | derived span = +50 + +52 (+56 read @ `0xb1c`) |

ControlRecord fields used (register `%a3`, standard layout):
`+4` contrlOwner(WindowPtr), `+8..+15` contrlRect, `+16` contrlVis(b),
`+17` contrlHilite(b), `+18` contrlValue(w), `+20` contrlMin(w),
`+22` contrlMax(w), `+28` contrlData(h).

### Thumb / track geometry (routine `0xa6c`)

Orientation: at `0xb9e` `tstw a4@... a3@@(2)` distinguishes the two axes
(reads the bounds region's first word). The proc computes, in the **long axis**:

- usable track length `%d7` derived from the part rect ends minus
  `+50 + +52 + +56` reserve (`0xb20`–`0xb36`: `d0 = (end − start) − reserve − 3`,
  `d7 = d0 asr 1`), then `a4@(10) += d7` (@ `0xb38`) and
  `a4@(14) = a4@(10) + reserve + 3` (@ `0xb3c`–`0xb48`). → centers a fixed-length
  thumb when range is degenerate.
- proportional case (`a4@(42)` max>0 path @ `0xbec`): thumb position =
  value mapped across `(a4@(16) − a4@(12))` track via the half-span midpoint
  math at `0xbfa`–`0xc16`:
  `a4@(12) -= ((d7 − d6) asr 1)`, `a4@(16) = a4@(12) + d7`.
- direction flip on `a4@(48) == −1` (@ `0xc1c`): grows from the opposite end
  (`a4@(12) = a4@(16) − d7`).
- thumb clamped into track: `min(d7, a4@(28))` @ `0xbd8`, `max(d7, a4@(26))`
  @ `0xbe2`.

Helper rect math (all operate on the bounds copied from `a3@(10..17)`):

| helper | output rect | citation |
|---|---|---|
| `0x112a` (track minus far cap) | shrink end by `a3@(42)`; which side per `a3@(48)==−1` | `0x114a`–`0x1162` |
| `0x1174` (track minus arrows + frame) | inset one side by `a3@(42)`, then `−1,−1` (`subqw#1` on +4,+6) | `0x1194`–`0x11a8` |
| `0x11b6` (arrow box) | `len = a3@(54)+3`; place at near/far end per `a3@(48)`; `+1` on the cross axis | `0x11c6`–`0x11ee` |
| `0x11fa` (inset frame) | `+3,+3` top-left, `+1,+1` bottom-right | `0x120e`–`0x1218` |
| `0x10da` (channel) | `InsetRect(rect, 1,1)` then end-shift by `a3@(54)+3` | `0x10f2`–`0x111c` |

### Thumb glyph (routine `0xc5c`)
- glyph size `%d7` from `a4@(54)` reduced by `asr 2` then parity-adjusted
  (`0xca0`–`0xcb4`), clamped to **6 ≤ size**, and not below **4**
  (`cmpiw #6` @ `0xcb6`, `cmpiw #4` @ `0xcc2`; if `<4` skip → `0xd6c`).
- centered in the thumb rect: `mid = (span − size) asr 1 + start`
  (`0xcd6`–`0xd20`), then `MoveTo`/`LineTo` cross strokes
  (`0xa893` @ `0xd2e`, `0xa891` @ `0xd38`/`0xd50`/`0xd56`).

### Hit test (routine `0x6e8`, testCntl)
- copies thumb/part rect `a4@(10..17)` to a local, `PtInRect`-style
  (`0xa8ad` @ `0x71a`); returns part only if active
  (`a3@(17) != 255` @ `0x728`) and the bounds region is non-empty
  (`a4@@(2) != 0` @ `0x732`). Result part in `%d0` (1 on hit, else 0).

### calcCRgns / calcThumbRgn (routine `0x78c`)
- recompute via `0xa6c`, then `SetRectRgn(rgn, thumbRect)` (`0xa8df` @ `0x7b6`)
  where `thumbRect = contrlData→…→+10`. The selected region handle is the caller's
  `param` (`fp@(16)` @ `0x7a4`).

### Label text (routine `0xd76`)
- font index from `a3@(40)`, draw color dimmed when `a4@(17)==1`
  (`0xdba`), buffer = `fp@(-256)`, fit/trunc via selector `0x8208FFE0`/`0xa9ce`.
- This is the only place a *control title* is rendered, and it's local QD, not
  delegated.

---

## (e) could-NOT-pin

1. **Exact control sub-type.** The geometry is unambiguously a value/min/max
   **track-with-thumb** control (scroll bar **or** slider **or** standalone
   indicator). Nothing in the listing names which; there is no `'CDEF'`-internal
   variant byte that selects between bar vs slider (the `varCode&8` test @
   `0x270`/`0x80c` toggles *active/inset* behavior, not the sub-type). Could not
   pin scroll-bar-vs-slider.

2. **Trap `0xa322` @ `0x1f4` (`moveq #58` before it).** Allocates the 58-byte
   private struct, but `0xA322` is not in the project trap table and is not a
   canonical documented A-trap number; treated as a "new zeroed handle of size
   d0" allocator by behavior only. Identity un-pinned.

3. **Trap `0xa8b5`** (called @ `0x86e`,`0x87e`,`0x89a`,`0xe86` with selector
   longwords `0x84020008`,`0x8404000C`,`0x82020006`,`0x8208FFE0`). Clearly an
   Appearance/theme-metric or icon-suite selector trap, but the specific verb for
   each selector could not be pinned from the listing. The returned `int16`s feed
   thumb/arrow sizing and `0x1486`'s list lookup, so they are **theme metrics**,
   but exact metric names are un-pinned. (`0x8208FFE0` reuses the `'proc'` resID
   −8224 in its low word — likely "load action proc by id".)

4. **Trap `0xaa64`** (color-pair fetch @ `0xf94`/`0xfbe`/`0xfe8` in `0xf5a`).
   Pulls a 6-byte RGB at handle `+10`/`+16`/`+22` indexed by `%d6`/`%d7`; behaves
   like a color-table / theme-brush getter, exact trap identity un-pinned.

5. **Traps `0xa84e`/`0xa84f`/`0xa943`/`0xa944`/`0xa945`/`0xa948`/`0xa950`/`0xa9ed`/`0xa9ce`/`0xa830`/`0xa80b`/`0xa910`/`0xaa48`.**
   Their *roles* are inferred from argument shapes (part iteration / pen-state
   save-restore / Pack selector 36 / string-trunc / hilite), but the project trap
   table does not list these exact numbers, so individual names are not asserted.
   The QuickDraw rect/line traps that **are** in the table
   (`0xa8a1` FrameRect, `0xa8a3` EraseRect, `0xa8a9` InsetRect, `0xa893` MoveTo,
   `0xa891` LineTo, `0xa8df` SetRectRgn, `0xa8d8`/`0xa8d9` Close/DisposeRgn,
   `0xaa14`/`0xaa15` RGB fore/back, `0xaa00` OpenCPort, `0xaa02` DisposeCPort,
   `0xa11e` NewPtr, `0xa01f` DisposPtr, `0xa029`/`0xa02a` HLock/HUnlock,
   `0xa069`/`0xa06a` HGetState/HSetState, `0xa9a0` GetResource,
   `0xa9a2` HandToHand, `0xa9af` RecoverHandle, `0xa870` LocalToGlobal)
   are pinned with confidence.

6. **ControlRecord +18 dual use.** Init reads `a3@(18)` both as `contrlValue`
   (low byte → `a4@(44)` @ `0x250`) and as a flags word (high bit @ `0x25a`,
   bits 8–14 → `a4@(40)` @ `0x26c`). On a fresh control these overlap with the
   CDEF variant packed into the value field; could not pin whether the high bits
   are genuine init-time variant data or stale.

7. **The chained proc at `contrlData→…→+6`** (`jsr %a0@` @ `0x10b0`). It is a
   real handle that gets `HandToHand`/`RecoverHandle`-validated and called, but
   its **source** (where it's installed into the struct) is not within this
   resource — it is supplied by the system/Appearance Manager at runtime. The
   call's pixel output therefore cannot be reproduced from this listing alone
   (consistent with the delegation hypothesis).

8. **Self-consistency note (not a contradiction).** Part rects (`+10..+17`)
   are always derived by copying `contrlRect` (`a3@(8..15)`) and then
   insetting/shifting via the helpers, and every clamp keeps the thumb inside
   `[+26 , +28]` track bounds (`0xbd8`/`0xbe2`). No rect was found that escapes
   the control bounds, so no contradiction to flag.
