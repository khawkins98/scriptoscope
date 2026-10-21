# CDEF -1 geometry decode (clean-room)

Source (read-only, understanding-only): Apple's `CDEF` -1 resource (3172 B).
All hex addresses are file-relative offsets into that resource. Trap names follow
the project convention (the WDEF-125 decode). Mimic, never execute.

*Listing-level narrative (registers, frame offsets, instruction excerpts, listing
paths) for this document lives in [`engine/apple-cdef-button-geometry.evidence.md`](engine/apple-cdef-button-geometry.evidence.md) — spec writers and verifiers only.*

---

## 0. HEADLINE CLASSIFICATION — this is NOT the button CDEF

**CDEF -1 is a track/value control CDEF (scroll-bar / slider / indicator family),
the SAME family as CDEF -63 — not the multi-kind button CDEF.** Evidence:

1. **No control-kind dispatch exists.** There is exactly one dispatch (on
   `message`, §b). There is no secondary branch on a control kind / low varCode
   bits, and no per-kind draw entry (no push-button / checkbox / radio / popup /
   tab / group-box / disclosure path anywhere in the resource).
2. **The part vocabulary is the scroll-bar part set, not button parts.** The
   test routine returns `20`/`21`/`22`/`23`/`129` (`0x4ac`,`0x4ba`,`0x508`,
   `0x504`,`0x4de`) = `kControlUpButtonPart`(20), `kControlDownButtonPart`(21),
   `kControlPageUpPart`(22), `kControlPageDownPart`(23),
   `kControlIndicatorPart`(129). A button CDEF would return part 10
   (`kControlButtonPart`) / 11 (`kControlCheckBoxPart`) / 12 (radio) — none
   appear.
3. **value/min/max → thumb-position math.** Draw and pos routines read
   `contrlValue`, `contrlMin`, `contrlMax` and map value across
   the track via an unsigned multiply/divide (`0x42a`–`0x436`, `0x5fc`–`0x5fe`). That is the
   proportional-indicator signature, not a button.
4. **init allocates a Region (not a 58-byte struct) and stores it in
   `contrlData`.** `NewRgn` (`0xa8d8` @ `0x610`) → `contrlData`
   (`0x614`); disp `DisposeRgn` (`0xa023` @ `0x61e`). The control's working
   region (thumb region) lives there.
5. **Drawing is LOCAL QuickDraw with embedded `pixPat` textures**, not delegated
   to an Appearance trap and not via a chained proc handle. The resource owns
   eight inline 16×16 1-bit patterns (§d) and fills the track/thumb itself.

So the reference note in `cdef-geometry.md` §0 — "the multi-kind button CDEF in
this corpus is the separate, much larger `CDEF` -1 (~40 KB)…" — is
**incorrect for this file**. The extracted `CDEF` -1 resource is 3172 B and is a
second track-control proc, not a ~40 KB button proc. See could-NOT-pin #1: the
actual button CDEF (kinds 21/129/16/4) is **not present** among the extracted
resources.

Consistent with CDEF -63's fingerprint in spirit (value→pixel thumb mapping,
parts 26/27 there vs 20/21 here, region-based calc), but CDEF -1 differs in that
it **draws pixels itself** from embedded patterns rather than delegating to a
system proc.

---

## (a) Routine map (addr → role)

Per-routine stack-frame sizes are in the evidence appendix.

| addr | role |
|---|---|
| `0x0` | **resource header**: a short branch to `0xc` over `0x0001 'CDEF' 0x0001 000b`. |
| `0xc` | **CDEF entry** (`Main`). Port-state save into a local rect (`0xa898`/`0xa89e` @ `0x20`/`0x22`), unpacks args (`0x24`–`0x32`), range-checks `message` against 12 (@ `0x14`, out-of-range → `0x46`), dispatches via word table @ `0x5a` (`0x36`–`0x3e`), restores rect (`0xa899` @ `0x44`), returns. |
| `0x54` | **null handler** (clears the function result and returns) — target of messages 7/8/9. |
| `0x5a` | **dispatch word table** (12 × int16; see §b). |
| `0x74` | **color/pattern setup** (called first by draw @ `0xf4`). `GetForeColor`/`GetBackColor` (`0xaa19`/`0xaa1a` @ `0x7c`/`0x82`), `aa44` selector call (`0x90`), `GetResource('pmap', -10208)` (`0xa9a0` @ `0xb8`, type `0x706d6170`='pmap', id -10208 @ `0xae`), `aa18` (`0xc2`), stores the handle and clut pointers into two locals and into a struct field (locations in evidence). `HLock`/`HUnlock` (`0xa029`/`0xa02a`). |
| `0xda` | teardown tail: `RGBForeColor`/`RGBBackColor` restore (`0xaa14`/`0xaa15` @ `0xe4`/`0xea`), `aa24` (`0xf0`). |
| `0xf4` | **drawCntl** (msg 0). Calls `0x74` (color setup) then the full track+thumb draw (`0xf8`–`0x358`). |
| `0x360` | **hilite-state colour selector** — adds `+4` if vertical (the orientation flag), `+2` if part 21, `-1` if `contrlHilite == partCode` (pressed), then calls `0x8cc`/`0x91c` to fetch+apply the pattern. |
| `0x3be` | **part-active predicate** — returns "this part is drawable" unless the part value under test is 0, 129, or equal to `partCode`. |
| `0x3cc` | **"has live thumb" predicate** — `contrlMin == contrlMax` ? then result = `contrlHilite`; else `contrlHilite+1`. Gates whether a proportional thumb is drawn. |
| `0x3e0` | **rect long-axis chooser** — width = right−left, height = bottom−top; if height > width returns axis index 2 (vertical), else index 0 (horizontal). Also yields the cross-axis length. The orientation primitive. |
| `0x3fe` | **THUMB GEOMETRY** (value→thumb rect). Copies `contrlRect` to scratch `0x9fa`, computes track span minus thumb width (the cross-axis length subtracted three times @ `0x41a`–`0x41e`), maps `(value-min)` across `(max-min)` (multiply/divide @ `0x42a`–`0x436`), rounds (via `0x622`), positions thumb edges, then `SetRectRgn`(`0xa8df` @ `0x462`) into `contrlData`. |
| `0x46c` | helper: copy `contrlRect` into scratch rect `0x9fa`. |
| `0x470` | helper: copy `contrlRect` into an arbitrary destination rect. |
| `0x480` | **testCntl** (msg 1). Hit-tests parts; returns the part code as the function result. (§d hit-test) |
| `0x50c` | helper: orientation fetch (calls `0x3e0`, then adjusts the part value for vertical; listing detail in evidence). |
| `0x518` | **calcCRgns** (msg 2). If the selector value tested @ `0x518` is negative (calcThumbRgn-style): mask, call `0x3fe`, `EraseRgn`-region build (`0xa8dc` @ `0x52e`), copy thumb rect out. Else `SetRectRgn`(`0xa8df` @ `0x54c`) of `contrlRect` into the caller's region. |
| `0x53e` | **calcCntlRgn** (msg 10). Sets the result slot to 1 then falls into the calc path `0x522`. |
| `0x550` | **calcThumbRgn** (msg 11). Sets the result slot to 1 then branches to `0x522` (thumb-region path). |
| `0x55a` | **delegated-to-system part draw for arrows** — saves grafProcs ptr `0x118`, swaps in `0x2a6`, calls colour select (`0x838`) + `HGetState`/`HLock`/`FillRect`/`HSetState` to stamp an arrow cap (`0xa069`/`0xa029`/`0xa8a5`/`0xa06a` @ `0x58a`–`0x59a`). |
| `0x5b0` | helper: `0xa9b8` with selector 17 → returns a handle (icon/cicn-suite getter; identity un-pinned). |
| `0x5bc` | **posCntl** (msg 5 → table idx5). Re-derives thumb position from `contrlValue`, multiply/divide map (`0x5fc`/`0x5fe`), then `0xa963` (move-thumb / SetCtlValue-equivalent; un-pinned) @ `0x60a`. |
| `0x60e` | **initCntl** (msg 3). `NewRgn` (`0xa8d8` @ `0x610`) → `contrlData` (`0x614`). |
| `0x61a` | **dispCntl** (msg 4). `DisposeRgn` of `contrlData` (`0xa023` @ `0x61e`). |
| `0x622` | **round-half** helper — quotient += 1 if remainder ≥ half of the divisor (`0x624`–`0x630`). Used by every value→pixel map. |
| `0x63a` | **thumbCntl** (msg 6). Builds a 1-pixel-thick "ghost thumb" region for drag feedback: copies thumb rect, insets, computes drag limits (`0x68a`–`0x6a0`), stores cross-axis size into a field of the region record (`0x6a6`; offset in evidence). |
| `0x6ac` | **drag-interpolation** — multiply by 4369 (`= 0x1111`, the 16-bit→Fixed scale `0xFFFF/0x0F`) @ `0x6bc`, two-iteration loop interpolating a start/end point pair. Live-drag math. |
| `0x6e8` | **`'csd '` resource probe** — walks a type/id list at `0xa86`, `GetResource`-style match against `0x63736420`='csd ' (`0xaa33` @ `0x746`); sets the "this scheme has a colour/csd resource" flag (the colour-vs-mono switch). |
| `0x72e` | helper for the above: calls `0x80c` (load a 6-byte RGB) then compares. |
| `0x75a` | **offscreen / clip + global save** — `LocalToGlobal`(`0xa870` @ `0x76c`), `CloseRgn`(`0xa8d8` @ `0x770`), `SetPort`(`0xa873`), `GetClip`(`0xa874`?@`0x78c`), `GetForeColor`/`GetBackColor` (`0xaa19`/`0xaa1a` @ `0x7ae`/`0x7b4`), `DiffRgn`(`0xa8e4` @ `0x786`), `ClipRect`(`0xa878` @ `0x7a8`). Sets up the draw clip excluding sub-regions. |
| `0x7d0` | **restore** counterpart of `0x75a` (RGBfore/back restore, ClipRect, SetClip). |
| `0x7fe` | **mono part→ink table** (14 bytes `00 FF 00 FF …`) — index by part → 0(white)→black/30, 255→white/33. |
| `0x80c` | **load 6-byte RGB** (three words from the source pointer) into two locals. |
| `0x838` | **part→colour apply** — calls `0x842` (set fore), then `0x84e` (set back). |
| `0x842` | set foreground: resolve via `0x85a`; if colour `RGBForeColor`(`0xaa14` @ `0x846`) else `0xa862`(ForeColor classic, un-pinned). |
| `0x84e` | set background: `RGBBackColor`(`0xaa15` @ `0x852`) or `0xa863`(BackColor, un-pinned). |
| `0x85a` | **colour resolver** (the core LUT). §d. |
| `0x8cc` | **fetch pattern** — if the colour flag is set: `GetResource('pixs', -10208)`(`0xa9a0` @ `0x8e2`, type `0x70697873`='pixs') and lock it; else index the inline `pixPat` table at `0xaac` (`0x90e`–`0x914`). Returns the pattern pointer plus a colour/mono flag. |
| `0x91c` | **apply pattern + draw** — builds a pixMap header at `0xa0e`, `CopyBits`(`0xa8ec` @ `0x956`) the 16×16 pattern as the fill, `HUnlock`(`0xa02a`). |
| `0x960` | helper: offset scratch rect `0x9fa` by a two-value delta (all four edges). |
| `0x974` | (alt entry, calls `0x74` then region/clip build with `abca` @ `0x990`) — see §c delegation. |
| `0x99c` | autoTrack-ish callback body (its address is the callback proc passed to `abca` @ `0x990`): hit-test (calls `0x6e8`), then either `FrameRect`(`0xa8a1` @ `0x9c0`) feedback or invert/fill. |

### Scratch rects / globals
`0x9fa` = primary scratch Rect (8 B). `0xa02` = a paired Rect.
`0xa0e` = pixMap header scratch (for `CopyBits`). `0xa34` = a saved point/rect
pair. `0x118` = grafProcs lowmem (saved/restored around `0x55a`).
`0xb9e` = a lowmem flag set to −1 before two `GetResource` calls
(`0xb2`/`0x8dc`) — "use cur-res-file / don't search" style.

---

## (b) Message dispatch table

`Main` compares `message` with 12 (@ `0x14`); out-of-range messages branch to the
restore+exit at `0x46` (@ `0x1a`; the original notes this as "message ≥ 12").
Otherwise it doubles the message, adds the int16 entry from the table at `0x5a`
to the table base, and calls the resulting target (`0x28`–`0x3e`; instruction
excerpt in evidence).

Table bytes @ `0x5a` (12 × int16, each = target − `0x5a`):

| idx | int16 | target | standard CDEF message | routine |
|---|---|---|---|---|
| 0 | `0x009a` | `0x0f4` | **drawCntl** | full track+thumb draw |
| 1 | `0x0426` | `0x480` | **testCntl** | part hit-test |
| 2 | `0x04be` | `0x518` | **calcCRgns** | rect/thumb region |
| 3 | `0x05b4` | `0x60e` | **initCntl** | `NewRgn` → contrlData |
| 4 | `0x05c0` | `0x61a` | **dispCntl** | `DisposeRgn` |
| 5 | `0x0562` | `0x5bc` | **posCntl** (move indicator) | value→pos remap |
| 6 | `0x05e0` | `0x63a` | **thumbCntl** (calc drag) | ghost-thumb region |
| 7 | `0xfffa` | `0x054` | dragCntl | → null handler |
| 8 | `0xfffa` | `0x054` | autoTrack | → null handler |
| 9 | `0xfffa` | `0x054` | (unused) | → null handler |
| 10 | `0x04e4` | `0x53e` | **calcCntlRgn** | sets result slot = 1, calc path |
| 11 | `0x04f6` | `0x550` | **calcThumbRgn** | sets result slot = 1, thumb path |

Messages 7 (drag) / 8 (autoTrack) / 9 fall to the null handler `0x54`
(clears the result and returns) — the Control Manager default handles live tracking; the
proc only supplies geometry (calc/pos/thumb) and pixels (draw). calcCRgns(2),
calcCntlRgn(10) and calcThumbRgn(11) reach three distinct entries (`0x518`,
`0x53e`, `0x550`) that all converge on `0x522`; the requested region is selected
by the sign of a selector value (sign test @ `0x518`; register detail in evidence).

---

## (c) Control-kind dispatch + delegation map

**There is NO control-kind table.** (This is the headline finding — §0.) The
only branches are on:

| site | test | meaning |
|---|---|---|
| `0x1e4` | `contrlHilite == -2` | `-2` (254) = a special inactive/disabled sentinel → simplified frame path `0x330` |
| `0x376` | `contrlHilite == partCode` | pressed part (hilite == part) → `-1` colour shift @ `0x37c` |
| `0x3cc` | `contrlMin == contrlMax` | degenerate range → no live thumb |
| `0x6f0` | a probe-result local compared with 4 (condition form in evidence) | sets the **colour-vs-mono** flag from a `'csd '` probe (NOT a kind) |
| `0x244`,`0x4c2` | which-part-to-draw argument `== 1` | the incoming "which part to draw" arg; `1` = a restricted single-part draw |

Part codes used (drawn/tested): **20**(up), **21**(down), **22**(pageUp),
**23**(pageDown), **129**(indicator/thumb). Sites: `0x4ac`(20), `0x4ba`(21),
`0x508`(22), `0x504`(23), `0x4de`/`0x24c`(129).

**Delegation map** (where pixels come from):

| from | mechanism | what |
|---|---|---|
| `0x91c`→`0x956` | `CopyBits` (`0xa8ec`) of an inline 16×16 `pixPat` | **primary fill** — track & thumb textures, drawn LOCALLY (no Appearance trap). |
| `0x55a`→`0x594` | `FillRect` (`0xa8a5`) under HLock/HSetState | arrow-cap fill. |
| `0x32c`,`0x344`,`0x9c0` | `FrameRect` (`0xa8a1`) | outer frame / drag feedback. |
| `0x290`,`0x34c`,`0x29e` | `EraseRect`/`FillRect` (`0xa8a3`/`0xa8a5`) | track erase. |
| `0x272`,`0x300`,`0x1d2` | `InsetRect` (`0xa8a9`) / `SectRect` (`0xaa28`) | rect math. |
| `0x990` | `abca` (callback proc `0x99c`) | a Control-Manager tracking trap given a callback — **only place an indirect call surfaces**, and it is the *system* calling back into `0x99c`, not the CDEF delegating its draw. |
| `0xb8`,`0x8e2` | `GetResource('pmap'/'pixs', -10208)` | colour pixMap + colour pattern resources (used only when `'csd '` is present). |
| `0x746` | `GetResource('csd ', …)` via `0xaa33` | colour-scheme-data probe → mono/colour switch. |

There is **no `DrawThemeButton`/`DrawThemeTrack`-style Appearance call and no
chained `contrlData→proc` indirect call.** CDEF -1 renders the track itself from embedded
pixpats, falling back to a 2-colour (black/white) table when no `'csd '`
colour resource is found.

---

## (d) Per-control geometry (the one family: scroll-bar / slider track)

### contrlData
`initCntl` (`0x60e`) puts a single **Region handle** (`NewRgn`) in
`contrlData`. The thumb region is rebuilt into it by `calcThumbRgn`/draw
(`SetRectRgn` @ `0x462`/`0x54c`). No private fixed-size struct (contrast CDEF -63's
58-byte block).

ControlRecord fields used (dereferenced control handle, standard Apple layout):
`contrlRect`, `contrlVis` (b), `contrlHilite` (b), `contrlValue` (w),
`contrlMin` (w), `contrlMax` (w), `contrlData` (h).

### Orientation primitive (`0x3e0`)
width = right−left, height = bottom−top. If height > width → **vertical** (returns
axis index `2`, the .v offset into a rect); else **horizontal** (index `0`). It
also yields the **cross-axis length** `C` (the short dimension = the bar
thickness). Every downstream rect op indexes edges with the axis index and the
axis index XOR 2, so the same code serves both axes.

### Thumb / indicator rect (`0x3fe`)  — value→pixel
1. copy `contrlRect` → scratch `0x9fa` (`0x404`).
2. call `0x3e0` → axis index, cross length `C` (= thumb thickness).
3. usable travel `T = (trackEnd − trackStart) − 3·C` (`0x412`–`0x41e`)
   — i.e. the thumb's own length (≈ one cross-dimension) plus margins are
   removed from the track before mapping. (The `−C` is applied **three**
   times: thumb body + the two end insets.)
4. `T = T · (value−min) / (max−min)` (multiply @ `0x42a`, `max−min` formed @
   `0x430`, divide @ `0x436`); rounds via `0x622`. Degenerate `max−min==0` →
   `T = (value-min)` raw (`0x468`).
5. thumb near-edge `= trackStart + H + T`; far-edge `= near + H`
   where `H` is described as "thumb half/■" (`0x43c`–`0x44c`; listing detail in
   evidence); cross edges nudged `+1/−1` (`0x450`–`0x458`).
6. `SetRectRgn(contrlData, thumbRect)` (`0x462`).

| quantity | value | cite |
|---|---|---|
| track end-margin reserve | `3 × crossLen` (crossLen subtracted three times) | `0x41a`–`0x41e` |
| cross-edge nudge | thumb shrunk `+1` top/left, `−1` bottom/right | `0x450`–`0x458` |
| thumb thickness | = control cross-axis length (`C` from `0x3e0`) | `0x3e8`/`0x3f2`/`0x3fa` |

### Arrow / end-cap rect (`0x55a` family)
The up/down (or left/right) arrow boxes are square caps of side = the cross-axis
length, stamped at each track end via `FillRect` of the cap pattern. Pattern
selected by `0x838`→`0x85a` with part index 17(up,vert)/16/0/1 (`0x572`–`0x57e`).

### Hit test (`0x480`, testCntl)
- skip if `contrlHilite == -2` (disabled sentinel) (`0x484`) or no live thumb
  (`0x48a` via `0x3cc`).
- `PtInRect(pt, contrlRect)` (`0xa8ad` @ `0x49a`); miss → 0.
- inside: split the track. If `pt.long − trackStart ≤ thumbLen (C)` → part
  **20** (up button); if `trackEnd − pt.long ≤ C` → part **21** (down button)
  (`0x4a2`–`0x4ba`).
- else `PtInRgn(pt, contrlData)` (`0xa8e8` @ `0x4d8`) → part **129** (thumb)
  (`0x4de`).
- else compare against thumb midpoint (`0x4f2`–`0x500`): `pt < mid` → **22**
  (pageUp), `≥` → **23** (pageDown).
- result returned as the function result.

### Drag feedback / thumbCntl (`0x63a`)
Builds a 1-px ghost frame of the thumb and computes drag limits by subtracting
the cap/end reserves (`0x68a`–`0x6a0`); the cross-axis size is cached in the
region record (`0x6a6`; field offset in evidence). The `0x6ac` interpolator scales the drag offset by
`0x1111` (= `0xFFFF/15`) to a Fixed for smooth mapping.

### Colour resolver (`0x85a`) — the part/state → ink LUT
- **No colour scheme** (no `'csd '`; the colour flag is clear): ink = mono table
  @ `0x7fe` = `{0,FF,0,FF,…}` indexed by `partIdx`; entry 0 ⇒ result 33 (white),
  nonzero ⇒ 30 (black) (`0x8b4`–`0x8c2`).
- **Colour scheme, `partIdx ≥ 16`**: RGB = entry `partIdx − 16` (6 bytes each) of
  the RGB table @ `0xa80` (`0x860`–`0x878`).
- **Colour scheme, `partIdx < 16`**: RGB = entry `partIdx` of the colour list of
  the `'pmap'` clut (`0x880`–`0x8b0`).

Part/state index is built in `0x360`: base part, `+4` if vertical, `+2` if part
21, `−1` if pressed (`hilite==part`). So a single 0..N index encodes
(part × orientation × pressed) and selects both the ink and the `pixPat`.

### Embedded pixPat textures (8 patterns)
The proc carries eight inline 16×16 1-bit patterns (each a 5-word pixMap header
`0002 0000 0000 0010 0010` then `FFFF` + 16 rows). Selector table @ `0xaac`
(entry offset `2·idx`):

| idx | pattern @ | likely role (by dither density) |
|---|---|---|
| 6 | `0xac0` | `8001 8001 8181 8241 8421 …` light 50%-ish |
| 7 | `0xaea` | `8001 8001 8181 83c1 87e1 8ff1 9ff9 bffd` graded |
| 4 | `0xb14` | mirror of idx6 |
| 5 | `0xb3e` | mirror of idx7 |
| 2 | `0xb68` | `8001 8101 8301 8501 89f1 9011 a011 …` |
| 3 | `0xb92` | `8001 8101 8301 8701 8ff1 9ff1 bff1 …` (darker) |
| 0 | `0xbbc` | `8001 8081 80c1 80a1 8f91 8809 8805 …` |
| 1 | `0xbe6` | `8001 8081 80c1 80e1 8ff1 8ff9 8ffd …` |
There are also solid blocks at `0xc1c` (`c003` ×14 — a 25% grey) and
`0xc46` (`8001` ×12 — near-white frame). These are the **track groove,
thumb face, and arrow-cap fills**; specific role-to-pattern binding beyond
"light vs dark / horizontal vs vertical mirror pair" is in could-NOT-pin #4.

---

## (e) could-NOT-pin

1. **The button CDEF is not in this corpus.** CDEF -1 is unambiguously a track
   control. The expected multi-kind button proc (push/bevel/checkbox/radio/
   popup/tab/group-box/disclosure, dispatching on kinds 21/129/16/4 per the
   `cdef-geometry.md` note) was **not found** here — and there is no other
   extracted CDEF resource for it. So the checkbox/radio mark-box size,
   button bevel inset, and tab geometry the task asked for **cannot be pinned
   from this file**; they live in a CDEF that has not been extracted.
   *(Action for the caller: re-extract the real button CDEF — likely also id
   `-1` but from a different scheme, or a differently-named resource — before
   the button-geometry questions can be answered.)*

2. **Scroll-bar vs slider sub-type.** As with CDEF -63, the value/min/max + parts
   20/21/22/23/129 fit **both** a scroll bar and a slider. Nothing names which.
   The presence of explicit up/down arrow caps (`0x55a`) leans **scroll bar**,
   but a directional slider also has end caps — not pinned.

3. **Several A-traps' exact identities** (roles inferred from arg shapes only):
   `0xaa44` (`0x90`), `0xaa18` (`0xc2`), `0xaa24` (`0xf0`), `0xaa28` (`0x1d2`,
   used like SectRect), `0xa963` (`0x60a`, "move indicator"/SetCtlValue-like),
   `0xabca` (`0x990`, a Control-Manager track trap taking a callback proc),
   `0xa9b8` (`0x5b6`, selector-17 handle getter), `0xaa33` (`0x746`,
   `'csd '`-aware GetResource variant), `0xa862`/`0xa863` (`0x846`/`0x852`,
   classic ForeColor/BackColor fallbacks), `0xa011` (data, not executed),
   `0xa898`/`0xa899` (`0x20`/`0x44`, a port-state save/restore pair),
   `0xa87a` (`0x7be`, likely SetClip companion). The QuickDraw traps in the
   project table (`FrameRect 0xa8a1`, `EraseRect 0xa8a3`, `FillRect 0xa8a5`,
   `InsetRect 0xa8a9`, `PtInRect 0xa8ad`, `PtInRgn 0xa8e8`, `SetRectRgn 0xa8df`,
   `NewRgn 0xa8d8`, `DisposeRgn 0xa8d9`, `EraseRgn 0xa8dc`, `DiffRgn 0xa8e4`,
   `CopyBits 0xa8ec`, `RGBFore/Back 0xaa14/aa15`, `GetFore/Back 0xaa19/aa1a`,
   `GetResource 0xa9a0`, `HLock/HUnlock 0xa029/a02a`,
   `HGetState/HSetState 0xa069/a06a`, `LocalToGlobal 0xa870`, `SetPort 0xa873`,
   `GetPort 0xa874`, `ClipRect 0xa878`, `PenMode 0xa89c`, `PenPat 0xa89d`,
   `PenNormal 0xa89e`) are pinned with confidence.

4. **Pattern-to-role binding.** The 8 inline `pixPat`s + 2 solid blocks are
   selected through the `0xaac` table by a composite (part×orientation×state)
   index, but the index→pattern map was only partially recovered (the
   light/dark + H/V-mirror pairing is clear; exact "this is the thumb face vs
   the groove" assignment per index is not fully pinned).

5. **The `-10208` resource id family** (`'pmap'`, `'pixs'`, and the implied
   `'csd '`) — these are the colour-scheme resources fetched only when a colour
   scheme is active. Their on-disk content is outside this binary, so the actual
   thumb/track colours come from those resources, not from constants here. The
   B&W fallback (table `0x7fe`) is the only ink fully contained in CDEF -1.

6. **`0x974`/`0x99c` block** — an alternate draw entry that installs a callback
   via `abca` and re-runs the hit-test/feedback. It is reachable but not from the
   main message table; likely a sub-helper invoked by the system tracking trap.
   Its precise trigger is not pinned.
