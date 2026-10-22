# `slider.draw` — Kaleidoscope 2.3.1 slider CDEF 3: gate, resources, geometry, draw order, hit test

Behavioural spec, v2 spec lane `v2-spec-slider` (2026-10-22). Template:
[`TEMPLATE.md`](TEMPLATE.md). Implementers read this file, Apple Inside
Macintosh / Universal Interfaces (HISlider.h variant names), and only the rule
tables the [implementer brief](IMPLEMENTER-BRIEF.md) allows. The
address-by-address trace is in `slider.evidence.md`; implementers do not open it.

**Every address in this file is a file offset into Kaleidoscope 2.3.1 `CDEF 3`**
(not the kDEF). To keep the routine-coverage counter honest, every line that
carries an address also names CDEF 3. Rect intervals are half-open
`[start, end)`. "Along" is the axis the slider runs on (x for a horizontal
slider, y for a vertical one); "cross" is the other axis. `trunc` rounds toward
zero. Unless a row says otherwise, arithmetic is signed 32-bit and the result
is stored as a 16-bit QuickDraw coordinate.

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `slider.draw`, plus the gate, state, region, hit-test and tracking facts it depends on |
| family | slider (Appearance `kControlSliderProc` 48 and its variants) |
| messages | 0 draw; also 1 test, 2/10/11 regions, 3 init, 4 dispose, 5 posCntl, 6 thumbCntl, 13 drawGhost, 19 getFeatures, 26 calcValueFromPos, 27, 34 (§1.2) |
| binary | Kaleidoscope 2.3.1 `CDEF 3`, 11,595 B, SHA-256 `d40e0c27be6b55a37c706b194828b9b6a74800e47eca65d4bf1561a92aef465a` |
| entry | CDEF 3 `0xc` (code resource entry) → main `0x1fc..0x6ca` |
| cited range | all 45 in-scope ranges of CDEF 3 (`docs/spec/routine-inventory.json`); list in §9 |
| out of scope | the Appearance (System file) slider that CDEF 3 hands off to (§4.1); QuickDraw's CopyMask / CopyBits pixel rules (Apple); how Kaleidoscope gets its CDEF 3 ahead of the System's in the resource chain (not in this binary) |

### 1.1 How CDEF 3 is reached

A control's procID is `16 × CDEF id + variation`, so CDEF 3 serves procIDs
48..63: Appearance's `kControlSliderProc` (48) and its variation bits
(HISlider.h): bit 0 live feedback, bit 1 tick marks, bit 2 reverse direction
(points up/left), bit 3 non-directional. Kaleidoscope's CDEF 3 stands in for the
System file's CDEF 3: when no slider `cinf` is found it loads the
System file's own CDEF 3 and calls it (G2, CDEF 3 `0x21c..0x286`). It answers
message 27 with `' ok '` (new-message support, CDEF 3 `0x62a`). No corpus
archive ships its own `CDEF` resource.

### 1.2 Message map (main, CDEF 3 `0x4ac..0x6a6`)

Every message first runs the gate (§4.1) and, when Kaleidoscope draws, rebuilds
the per-control state (§4.2). Every message Kaleidoscope handles ends by releasing the thumb cicn
(CDEF 3 `0x6a8..0x6ba`).

| message | effect | covered |
|---|---|---|
| 0 draw | when the control is visible, draw (§3.3) | yes |
| 1 test | part code (§4.9) | yes |
| 2 calcCRgns | region = `Th` when the region argument's high bit is set, else `R` | yes |
| 3 init | sets the tick count (§4.2 ID4) | yes |
| 4 dispose | frees the private record, its region and the thumb cicn | yes |
| 5 posCntl | value change from a drag offset (§5.7) | yes |
| 6 thumbCntl | drag constraint (§5.8) | yes |
| 7, 8 and unlisted | nothing; result 0 | yes |
| 10 calcCntlRgn | region = `R` | yes |
| 11 calcThumbRgn | region = `Th` | yes |
| 13 drawGhost | full redraw with the ghost cell (§3.3 step O6) | yes |
| 19 getFeatures | 1 (ghosting) + bit 13 (name not established) + 1024 (live feedback) when variation bit 0 is set | yes |
| 26 calcValueFromPos | sets the value from the ghost rect, then redraws with the thumb at that rect (§5.6) | yes |
| 27 | `' ok '` | yes |
| 34 | sound tags: `sltp` for parts 22/23 at sub-index 1; at sub-index 5, `slth` when variation bit 0 is set, else `slgh` | tags only |

Sources: CDEF 3 `0x4fe..0x512` (0), `0x516..0x526` (1), `0x52a..0x568` (2),
CDEF 3 `0x59c..0x5c6` (3), `0x5ca..0x5fa` (4), `0x5fe..0x60c` (5), `0x610..0x626` (6),
CDEF 3 `0x56c..0x57a` (10), `0x57e..0x598` (11), `0x648..0x656` (13), `0x632..0x646` (19),
CDEF 3 `0x658..0x666` (26), `0x668..0x6a0` (34); default target `0x6a8`.

## 2. Inputs

### Control inputs

| input | meaning | values / domain |
|---|---|---|
| `R` | control rect, port coordinates | `top, left, bottom, right` |
| `visible` | the control is visible | bool |
| `hilite` | the control's highlight value | 0, 1..253, 254, 255 (129 = thumb, 22/23 = page parts) |
| `value`, `min`, `max` | 16-bit control values | integers |
| `variation` | procID − 48 | bits as §1.1 |
| `initialValue` | the value the control holds at message 3 (Appearance: the tick count for tick-mark sliders) | integer |
| `ghostRect` `G` | message 13 / 26 only: the bounding box of the region argument | rect |

### Environment inputs

| input | meaning |
|---|---|
| `available resources` | `cinf` and `cicn` resources by id, through the resource chain (§6 item 2) |
| `systemSlider` | the System file's own CDEF 3 (Appearance slider) that the gate hands off to |
| `background` | what the erase step fills `R` with (§3.3 O2–O4; §6 item 1) |
| `devices` | the devices the control's region crosses, each with a pixel depth and a colour/grey flag |
| `lowDepth` | per device: depth < 4, or depth 4 on a colour device; clear above 4 (CDEF 3 `0x1b70..0x1ba4`, `0x1a34..0x1a62`) |
| `portState` | colour port or not; picture/region recording; pen hidden; visRgn and clipRgn |

### Derived state

| state | definition | source |
|---|---|---|
| `horizontal` | `R.right − R.left > R.bottom − R.top` (a square control is vertical) | CDEF 3 `0x144..0x170`, `0x2e4..0x312` |
| `base` | −10144 horizontal, −10128 vertical | CDEF 3 `0x34a..0x35c` |
| `g` (group) | 2 if variation bit 3; else 1 if bit 2; else 0. Fixed when the private record is created (§4.2) | CDEF 3 `0x316..0x332` |
| `gb` | `base + 6g` | CDEF 3 `0x364..0x372` |
| `n` (tick count) | §4.2 ID4 | CDEF 3 `0x59c..0x5c6` |
| `c` (corner) | §4.2 ID6 | CDEF 3 `0x43e..0x480` |
| `thumb` | the thumb cicn, §4.5 | CDEF 3 `0x362..0x3a0` |
| `tA` | along size of the thumb cicn's bounds (width horizontal, height vertical) | CDEF 3 `0x3ac..0x3d0`, `0x3fa..0x416` |
| `alongR` | along length of `R` | CDEF 3 `0x3dc..0x3e8`, `0x422..0x42e` |
| `T` (travel) | `alongR − tA − 2c` (§4.2 ID7) | CDEF 3 `0x3d4..0x3f4`, `0x41a..0x43a` |
| `range`, `offset` | `max − min` and `value − min`, each a 16-bit difference (wraps) then sign-extended | CDEF 3 `0x484..0x4a8` |
| `trackTier` | 0 if hilite is 254 or 255; 2 if hilite is 1..253; 1 if hilite is 0 | CDEF 3 `0xed2..0xef6` |
| `thumbCell` | 0 if hilite is 254 or 255; 2 if hilite is 129; else 1 | CDEF 3 `0x103a..0x1060` |
| `tickState` | 0 if `thumbCell` is 0, else 1 | CDEF 3 `0x1138..0x113c` |

Inactive (254) and disabled (255) controls are drawn identically. Unlike the
scroll bar, `min = max` does not change the art; it moves the thumb (§5.2) and
suppresses ticks (TK2).

### Scriptoscope mapping (proposed) and declared defaults

| public input | native reading |
|---|---|
| `state: 'normal'` | hilite 0 |
| `state: 'pressed'` | hilite 129 (thumb pressed), mirroring DECISIONS #4 for the scroll bar. **Proposed, needs a maintainer decision.** A page press (22/23) gives pressed track art with the normal thumb |
| `state: 'inactive'` / `'disabled'` | hilite 254 / 255 (same pixels) |
| current `composeSlider` | group 2 only (variation bit 3). Groups 0 and 1 need a new public input |

Declared defaults (modern policy, not original observations): one device at
depth ≥ 8 (`lowDepth` clear), colour port, not recording, pen visible, a
resource chain of the archive's own fork then its base chain (as the scroll
bar), and `background` supplied by the host (§6 item 1).

## 3. Outputs

### 3.1 Resources requested, in order

On **every** message (main):

1. Gate: `cinf base`; then `cinf base + 12` (variation bit 3); then `cinf base + 6` (bit 2), each only while nothing is found (G1, CDEF 3 `0x13c..0x1d2`).
2. Thumb: `cicn gb + 3`, then `cicn base + 3` (CDEF 3 `0x362..0x3a0`).
3. Corner: `cinf gb`, then `cinf base` (CDEF 3 `0x43e..0x470`).

On a draw (messages 0, 13, 26), per device:

4. Track: for each candidate id of TR3 in order, `cicn id`; if found, `cinf id`; the first id with both is used, the rest are not requested (CDEF 3 `0xf0e..0x1038`, `0x2970..0x29b0`, `0x1486..0x14ca`).
5. Ticks, only when `n > 1`: `cicn gb + 4 + tickState`, then `cicn base + 4 + tickState` (CDEF 3 `0x112e..0x1176`).

No other resource type is requested. `ppat`, `ics#` and `ics8` are never read.

### 3.2 Rects

Track band `B` (§5.1), thumb rect `Th` (§5.2), tick rects (§5.4), ghost rect
`G` (input), all in port coordinates. Nothing outside `R` is ever changed.

### 3.3 Draw order

Nothing is drawn when the control is invisible (message 0), when the port's
visRgn ∩ clipRgn ∩ `R` is empty, or when the pen is hidden, unless a picture or
region is being recorded (CDEF 3 `0x16ba..0x1744`). Otherwise the drawer runs
once per device (DeviceLoop `$ABCA`), or once directly at the port's depth when
the port is offscreen or recording (CDEF 3 `0x17fa..0x1838`).
Each run (CDEF 3 `0xdce..0x1474`):

| step | action | source |
|---|---|---|
| O1 | create an offscreen GWorld (`$AB1D` NewGWorld) at the device's depth covering `R`, lock it and make it current. On failure nothing is drawn for this device; the port keeps its pixels | CDEF 3 `0xdea..0xe5c` |
| O2 | in the offscreen: when the port is a colour port, copy its foreground and background colours and its background pattern (a pixel pattern, or a plain pattern drawn in those colours) | CDEF 3 `0xe5e..0xeb4` |
| O3 | Appearance Control Manager trap `$AA73` selector 29 with the control, the depth and true (identity §6 item 1) | CDEF 3 `0xeb6..0xec8` |
| O4 | EraseRect `$A8A3` `R` | CDEF 3 `0xeca..0xed0` |
| O5 | track (§4.4, §5.5) | CDEF 3 `0xef8..0x1038` |
| O6 | message 13 only: ghost cell (TH5) into `G` | CDEF 3 `0x1080..0x10c0` |
| O7 | when a thumb cicn exists: the thumb cell into `G` during message 26, else into `Th` (§4.5) | CDEF 3 `0x10c4..0x112a` |
| O8 | ticks (§4.6) | CDEF 3 `0x112e..0x13b8` |
| O9 | restore the port; with black foreground and white background, CopyBits `$A8EC` the offscreen `R` onto the port's `R` in `srcCopy` with no mask region; restore the colours; dispose the offscreen | CDEF 3 `0x13ba..0x146c` |

Two non-default paths: on a monochrome on-screen port without custom bottlenecks, the drawer first switches to the Window Manager port in global coordinates and then runs DeviceLoop (CDEF 3 `0x174e..0x17f8`); and O2 copies the background pattern only when the port's pattern handle is a pixel-pattern-sized (28-byte) handle (CDEF 3 `0xe8c..0xe9c`). Neither applies under the declared defaults.

So `R` is always repainted opaque: pixels no art covers show the O4
background, never what was in the port before.

## 4. Decision tables

Row ids are stable; `src/engine/tables/slider.ts` mirrors one row per spec row
with the same `source`.

### 4.1 Gate (every message)

| # | condition | output | source |
|---|---|---|---|
| G1 | `cinf base` found; or bit 3 and `cinf base + 12` found; or bit 2 and `cinf base + 6` found | Kaleidoscope handles the message (§4.2 onward) | CDEF 3 `0x13c..0x1d2` |
| G2 | otherwise, the System file holds a non-empty `CDEF 3` | call it with the original four arguments; its result is the result; nothing else happens | CDEF 3 `0x21c..0x286` |
| G3 | otherwise | Kaleidoscope handles the message anyway (with whatever resources exist) | CDEF 3 `0x252..0x258` |

The gate tests `cinf` only. A scheme that ships slider cicns but no slider
`cinf` (floppies) never reaches Kaleidoscope's drawing. The cicns are not
consulted by the gate.

### 4.2 Private record and per-message state

| # | condition | output | source |
|---|---|---|---|
| ID1 | no private record, or one of the wrong size | create or resize it; set `horizontal`, `g`; clear the ghost and live flags | CDEF 3 `0x28a..0x340` |
| ID2 | a record was newly created | also clear the tick count and one unread field, and allocate a region that is only ever disposed. A resized foreign record keeps whatever its tick count and region held | CDEF 3 `0x2b6..0x2da` |
| ID3 | always | `horizontal` and `g` are **not** recomputed after creation | CDEF 3 `0x344..0x35c` |
| ID4 | message 3, variation bit 1 set, `g ≠ 2` | `n = initialValue`, then the control value is set to `min` | CDEF 3 `0x59c..0x5be` |
| ID5 | message 3 otherwise | `n = 0` | CDEF 3 `0x5c2..0x5c6` |
| ID6 | always: `cinf gb`, else `cinf base`, found | `c` = that cinf's first byte, unsigned | CDEF 3 `0x43e..0x480` |
| ID7 | a thumb cicn was found | `tA` and `T` are recomputed **before** ID6 runs, so `T` uses the `c` stored by the previous message | CDEF 3 `0x3a2..0x43a` |
| ID8 | neither corner cinf found | `c` keeps its previous value (undefined on a new record) | CDEF 3 `0x472..0x474` |
| ID9 | always | `range`, `offset` recomputed | CDEF 3 `0x484..0x4a8` |

The gate (G1) recomputes `horizontal` from the current `R` on every message, but the drawing uses the value fixed when the record was created (ID3). If a control's rect changes shape after creation, the gate and the draw can use different `base` values (CDEF 3 `0x144..0x17a`, `0x34a..0x35c`).

ID7 has no effect in the steady state: message 3 runs first and sets `c`, and
`c` does not change for a given control and scheme. The record outlives a
scheme change, so the first message after one uses the old `c` for `T` (ticks,
§5.6–§5.8) but the new `c` for `Th` (§5.2).

### 4.3 Track candidates and art

| # | condition | output | source |
|---|---|---|---|
| TR1 | `trackTier` | §2 derived state | CDEF 3 `0xed2..0xef6` |
| TR2 | always | `B` per §5.1 | CDEF 3 `0xef8..0xf0a`, `0x866..0x92c` |
| TR3 | always | candidate ids in order: `gb + trackTier`, `gb + 1`, `base + trackTier`, `base + 1` | CDEF 3 `0xf0e..0xfa4` (h), `0xfa8..0x1038` (v) |
| TR4 | a candidate's cicn is missing, or present without a `cinf` at the same id | try the next candidate (the cicn is released) | CDEF 3 `0x2970..0x29ae`, `0x1486..0x14c8` |
| TR5 | every candidate fails | no track; the O4 background remains | CDEF 3 `0xf7a..0xfa4`, `0x1014..0x1038` |
| TR6 | a candidate succeeds | slice it into `B` (§5.5) with that cinf's bytes 0, 2 and 3 | CDEF 3 `0x29b0..0x2b5a`, `0x14ca..0x167c` |

### 4.4 Track slicing (`cinf` bytes)

`k` = byte 0 (unsigned, the cap). Byte 2: 0 = one middle column (row), non-zero
= the full middle. Byte 3: 0 = tiles anchored at the start, non-zero = tiles
anchored at the end.

| # | condition | output | source |
|---|---|---|---|
| SL1 | always | the art keeps its own cross size, centred in `B` (§5.5) | CDEF 3 `0x29dc..0x2a04`, `0x14f6..0x151e` |
| SL2 | along length of `B` ≤ `2k` | halves: two 1:1 pieces, no middle (§5.5) | CDEF 3 `0x2a08..0x2aa8`, `0x1522..0x15c6` |
| SL3 | otherwise | caps: the first `k` and last `k` source pixels 1:1 at the two ends | CDEF 3 `0x2aac..0x2b00`, `0x15ca..0x1622` |
| SL4 | SL3, byte 2 = 0 | middle source is the single column (row) at `k` from the start | CDEF 3 `0x2b14..0x2b26`, `0x1636..0x1648` |
| SL5 | SL3, byte 2 ≠ 0 | middle source is `[S.start + k, S.end − k)` | CDEF 3 `0x2b00..0x2b10`, `0x1622..0x1632` |
| SL6 | middle | drawn into `[B.start + k, B.end − k)` by the tiler (BL4–BL7), anchored at the start when byte 3 = 0, at the end otherwise | CDEF 3 `0x2b2a..0x2b58`, `0x164c..0x167c` |

### 4.5 Thumb and ghost

| # | condition | output | source |
|---|---|---|---|
| TH1 | always (every message) | thumb = `cicn gb + 3`, else `cicn base + 3` | CDEF 3 `0x362..0x3a0` |
| TH2 | no thumb cicn | `Th` empty; no thumb, no ghost; messages 5 and 6 do nothing; message 26 changes no value but still redraws | CDEF 3 `0xa9c..0xaaa`, `0x1062..0x1068`, `0x6f0`, `0x982`, `0xc38` |
| TH3 | thumb found | source cell `thumbCell`: horizontal rows `[16·cell, 16·cell + 16)` × full width; vertical columns `[16·cell, 16·cell + 16)` × full height | CDEF 3 `0x10c4..0x10f0` |
| TH4 | thumb found | cell drawn into `Th` (§5.2), or into `G` during message 26 (a live drag), masked (BL1) | CDEF 3 `0x10f2..0x112a` |
| TH5 | message 13 | before the thumb, cell 3 (rows or columns `[48, 64)`) drawn into `G`, masked, scaled if `G` differs | CDEF 3 `0x1080..0x10c0` |

Cell map: **0 inactive/disabled, 1 normal, 2 pressed (hilite 129 only), 3
ghost**. Nothing reads a cell beyond 3.

### 4.6 Tick marks

| # | condition | output | source |
|---|---|---|---|
| TK1 | `n ≤ 1` | no ticks, no tick request | CDEF 3 `0x112e..0x1134` |
| TK2 | `range ≤ 0` | no ticks | CDEF 3 `0x11ec..0x11f2`, `0x12fc..0x1302` |
| TK3 | cross size of `R` < 24 | no ticks (the tick cicn is requested and released) | CDEF 3 `0x1194..0x11a4`, `0x12a4..0x12b4` |
| TK4 | otherwise | tick cicn `gb + 4 + tickState`, else `base + 4 + tickState`; none → no ticks | CDEF 3 `0x113e..0x1176` |
| TK5 | ticks drawn | `n` copies of the whole tick cicn, 1:1, masked, at §5.4 | CDEF 3 `0x11f6..0x12a0`, `0x1306..0x13b2` |

Group 2 never has ticks (ID4). For horizontal group 2 the tick ids `gb + 4` / `gb + 5` would be −10128 / −10127, which are the vertical `base` ids (the vertical track and its `cinf`), not tick art; they are never requested as ticks because `n = 0`.

### 4.7 Blits (transfer modes)

All art goes through two helpers that draw into the current port (the
offscreen) with black foreground and white background, restoring the colours
after (CDEF 3 `0x24fa..0x25f2`, `0x205e..0x2442`).

| # | condition | output | source |
|---|---|---|---|
| BL1 | rect draw (caps, halves, thumb, ghost, ticks) | CopyMask `$A817` from the cicn's pixel map, through the cicn's mask with the same source rect, into the destination rect (scaled if sizes differ) | CDEF 3 `0x25cc..0x25dc` |
| BL2 | BL1 or BL6, `lowDepth` or a non-colour port | the source is the cicn's 1-bit icon bitmap instead of its pixel map (set bits black, clear white) | CDEF 3 `0x2568..0x257e`, `0x21fa..0x221e` |
| BL3 | BL1 while a picture is being recorded or the port has custom bottlenecks; BL6 while a picture is being recorded | BL1: CopyBits `$A8EC` `srcCopy` with the mask as a region; BL6: CopyBits `srcCopy` unmasked. Not reached by the drawer, whose port is a fresh offscreen | CDEF 3 `0x2588..0x25ca`, `0x22c4..0x22e0`, `0x23b0..0x23cc` |
| BL4 | tiler, one-column source, destination wider than 1 | per source row (1:1 from the top, while inside the destination): when the cicn's mask bit at (column, row) is set, a one-pixel line (MoveTo `$A893` / LineTo `$A891`, default pen) across the destination in that pixel's colour; rows whose mask bit is clear are left alone | CDEF 3 `0x20ee..0x2164` |
| BL5 | tiler, one-row source, destination taller than 1 (and BL4 not taken) | per source column, the same as BL4 with vertical lines | CDEF 3 `0x2168..0x21c8` |
| BL6 | tiler otherwise | 1:1 tiles of the source; the last tile is cut short; masked as BL1 | CDEF 3 `0x21cc..0x2418` |
| BL7 | BL6 direction | tiles advance along x when the destination's height equals the source's, otherwise along y | CDEF 3 `0x22fc..0x2318`, `0x23e8..0x2404` |
| BL8 | BL4/BL5 colour | the pixel's colour-table entry: the entry whose value equals the pixel, tried at that index first, then searched from the last entry down, entry 0 if none; a table whose last entry has value 0 is indexed by position. At `lowDepth` the 1-bit icon bit gives black or white | CDEF 3 `0x1c1c..0x1de6`, `0x28ea..0x2944` |
| BL9 | any helper | skipped when the destination misses the clip region's bounding box vertically, or (tiler) either rect is empty | CDEF 3 `0x253c..0x254e`, `0x2072..0x20da` |
| BL10 | BL4, BL5, BL8 | the mask and pixel are read at the column and row counted from the cicn's first stored row and column (equal to source coordinates when the bounds start at 0,0, as in every corpus cicn) | CDEF 3 `0x1c3a..0x1c74`, `0x1d0c..0x1d20` |

### 4.8 Offscreen and background

| # | condition | output | source |
|---|---|---|---|
| OS1 | per device | a fresh offscreen at that device's depth covering `R` | CDEF 3 `0xdf8..0xe1c` |
| OS2 | offscreen creation fails, or no device | nothing drawn for this device | CDEF 3 `0xe1a..0xe24` |
| OS3 | the port is a colour port | the offscreen takes the port's foreground, background and background pattern before O3 | CDEF 3 `0xe5e..0xeb4` |
| OS4 | always | O3 then EraseRect of `R`: every pixel of `R` starts as the background | CDEF 3 `0xeb6..0xed0` |
| OS5 | always | the finished offscreen replaces `R` in the port (`srcCopy`, unmasked, clipped by the port) | CDEF 3 `0x13ba..0x1454` |

### 4.9 Hit test (message 1, CDEF 3 `0xb90..0xbf6`)

| # | condition (point `P`) | part | source |
|---|---|---|---|
| HT1 | `P` outside `B` | 0 | CDEF 3 `0xba0..0xbbc`, `0xbf2` |
| HT2 | `P` in `Th` | 129 | CDEF 3 `0xbbe..0xbd4` |
| HT3 | `P.h < Th.left` or `P.v < Th.top` | 22 | CDEF 3 `0xbd6..0xbec` |
| HT4 | otherwise | 23 | CDEF 3 `0xbee` |

The hit area is the 16-pixel band `B`, not `R`: tick marks and the rest of `R`
answer 0. hilite is not consulted (the Control Manager's own handling of
inactive controls applies). With no thumb cicn, `Th` is empty at (0, 0), so a
point in `B` is 23 unless a coordinate is negative.

## 5. Geometry

Formulas are written for a horizontal slider; a vertical slider swaps x/y
(left↔top, right↔bottom) except where a vertical rule is given.

### 5.1 Track band `B` (CDEF 3 `0x866..0x92c`)

`B` has `R`'s along extent and a 16-pixel cross extent:

| group | horizontal `B` cross | vertical `B` cross |
|---|---|---|
| 0 (points down/right) | `[R.top, R.top + 16)` | `[R.left, R.left + 16)` |
| 1 (points up/left) | `[R.bottom − 16, R.bottom)` | `[R.right − 16, R.right)` |
| 2 (non-directional) | `s = trunc((R.top + R.bottom) / 2) − 8`, `[s, s + 16)` | the same on x |

The sum is 16-bit. `B` may reach outside `R`; pixels outside `R` are never drawn.

### 5.2 Thumb rect `Th` (CDEF 3 `0xa82..0xb5a`)

- No thumb cicn: `Th = (0, 0, 0, 0)`.
- Cross: `B`'s cross. Along length: `tA`.
- Horizontal: `Th.left = R.left` when `range = 0`, else
  `R.left + c + trunc((alongR − tA − 2c) · offset / range)`.
- Vertical (minimum at the bottom): `Th.top = R.top` when `range = 0`, else
  `R.top + c + trunc((alongR − tA − 2c) · (range − offset) / range)`.

This uses the current `c` (not `T`, ID7). At `range = 0` there is no corner
inset.

### 5.3 Thumb source cell (CDEF 3 `0x10c4..0x10f0`)

Horizontal: `[bounds.left, bounds.right)` along × rows `[16·cell, 16·cell + 16)`;
vertical: columns `[16·cell, 16·cell + 16)` × `[bounds.top, bounds.bottom)` along.
`Th` is `tA × 16`, so the copy is 1:1. The ghost (TH5) uses cell 3 the same way.

### 5.4 Tick rects (CDEF 3 `0x11a8..0x12a0`, `0x12b8..0x13b2`)

Tick cicn bounds `t` (`tw = t.right − t.left`, `th = t.bottom − t.top`). For
`i = 0 .. n − 1`:

- `v_i = trunc((i · range + trunc((n − 1) / 2)) / (n − 1))`.
- Horizontal: `x_i = R.left + c + trunc(T · v_i / range) + trunc((tA − t.right − t.left) / 2)`;
  tick rect `[x_i, x_i + tw)` × (group 0: `[R.top + 16, R.top + 16 + th)`;
  group 1: `[R.bottom − 16 − th, R.bottom − 16)`).
- Vertical: `y_i = R.top + c + trunc(T · (range − v_i) / range) + trunc((tA − t.bottom − t.top) / 2)`;
  tick rect (group 0: `[R.left + 16, R.left + 16 + tw)`;
  group 1: `[R.right − 16 − tw, R.right − 16)`) × `[y_i, y_i + th)`.

The centring term subtracts `t.right` **and** `t.left` (not the width); it equals
`(tA − tw)` only when the bounds start at 0, as in the corpus. Tick `i` is
centred on the thumb position for `value = min + v_i`.

### 5.5 Track slicing into `B` (CDEF 3 `0x2970..0x2b5a`, `0x1486..0x167c`)

`S` = the cicn's bounds; `D` = `B` with its cross extent replaced by
`[trunc((B.top + B.bottom − (S.bottom − S.top)) / 2), … + (S.bottom − S.top))`
(SL1). `L = D.right − D.left`.

- **Halves** (`L ≤ 2k`): piece 1 source `[S.left, S.left + trunc((L + 1)/2))`
  at `D.left`; piece 2 source `[S.right − trunc(L/2), S.right)` at
  `D.right − trunc(L/2)`. Both 1:1, full source cross.
- **Caps** (`L > 2k`): `[S.left, S.left + k)` at `D.left`;
  `[S.right − k, S.right)` at `D.right − k`; middle source (SL4/SL5) tiled into
  `[D.left + k, D.right − k)` × `D`'s cross (SL6, BL4–BL7).
- **Start-anchored tiles** (byte 3 = 0): tile `j` covers
  `[D.left + k + j·m, …)` with `m` the middle source length, the last one cut
  to `D.right − k`, its source cut from the end.
- **End-anchored tiles** (byte 3 ≠ 0): tiles placed from `D.right − k` back
  toward the start, the first-placed tile full, the last cut at `D.left + k`
  with its source cut from the start.

Vertical sliders use the same rules on y.

### 5.6 Value from the ghost rect (message 26, CDEF 3 `0x6d6..0x7a6`)

`p = G.left − B.left − c` (horizontal) or `B.bottom − c − G.bottom` (vertical).
`value = min + trunc((p · range + trunc(T / 2)) / T)`, written without pinning.
Then the control is redrawn with the thumb at `G` (TH4).

### 5.7 posCntl (message 5, CDEF 3 `0xc22..0xd2e`)

`d` = the along offset of the drag (h for horizontal, v for vertical).
`q(x) = trunc((x · range + trunc(T / 2)) / T)`.
Horizontal: `Δ = q(d)` for `d > 0`, `−q(−d)` otherwise. Vertical:
`Δ = −q(d)` for `d > 0`, `q(−d)` otherwise. Then SetControlValue `$A963`
`(value + Δ)`.

### 5.8 thumbCntl constraint (message 6, CDEF 3 `0x95e..0xa34`)

With `P` the press point: limit rect and slop rect start as `B`.
Horizontal: axis 1 (h only); `limit.left = P.h − trunc(T · offset / range)`,
`limit.right = limit.left + T + 1`. Vertical: axis 2 (v only);
`limit.top = P.v − trunc((range − offset) · T / range)`,
`limit.bottom = limit.top + T + 1`. The slop rect is `B` outset by 15 on every
side (InsetRect `$A8A9` −15, −15).

### 5.9 Worked examples

**A. 1138, horizontal, group 0, `R` = (0, 0, 32, 120), min 0, max 100, value 50, `n` = 5, normal.**
`c = 5` (cinf −10144), thumb −10141 is 15 wide, `T = 120 − 15 − 10 = 95`.
`B = [0, 16)` rows. `Th = [5 + 47, +15) = [52, 67)` × `[0, 16)`, cell 1
(rows `[16, 32)` of −10141). Track −10143 (49 × 16, cinf 5, 16, 1, 0): caps
`[0, 5)` ← `[0, 5)`, `[115, 120)` ← `[44, 49)`; middle source `[5, 44)` (39
wide) tiled from 5: `[5, 44)`, `[44, 83)`, `[83, 115)` ← `[5, 37)`. Ticks
(−10139, 5 × 7): `v = 0, 25, 50, 75, 100`; `x = 10, 33, 57, 81, 105`; rows
`[16, 23)`. Hit: (h 30, v 8) → 22; (60, 8) → 129; (100, 8) → 23; (60, 20) → 0.

**B. 1990, vertical, group 0, `R` = (0, 0, 100, 32), min 0, max 100, value 25, `n` = 3.**
`c = 5` (cinf −10128), thumb −10125 is 19 high, `T = 71`. `B = [0, 16)` columns.
`Th.top = 5 + trunc(71 · 75 / 100) = 58` → rows `[58, 77)`, cell 1 (columns
`[16, 32)`). Ticks (−10123, 7 × 3) at columns `[16, 23)`: `v = 0, 50, 100` →
rows `[84, 87)`, `[48, 51)`, `[13, 16)`.

**C. windows-95, horizontal, group 2, `R` = (0, 0, 16, 100), value 50 of 0..100.**
`c = 2` (cinf −10132), thumb −10129 is 11 wide, `T = 85`. `B = [0, 16)`.
`Th = [44, 55)`. Track −10131 (5 × 4, cinf 2, 4, 0, 0) is centred at rows
`[6, 10)`; caps `[0, 2)` ← `[0, 2)`, `[98, 100)` ← `[3, 5)`; middle: one column
(byte 2 = 0), rows 6..9 each a line over `[2, 98)` in the colour of source
pixel (2, row) (BL4).

**D. Halves (1984 or animals, `c = 10`), horizontal, `R` along 15.** `L = 15 ≤ 20`:
`[0, 8)` ← `[0, 8)`, `[8, 15)` ← `[S.right − 7, S.right)`.

## 6. Not decoded / unknown; corpus impact

Implementers stop at these and file a spec question.

1. **Background.** `$AA73` is not in Universal Interfaces 3.0.1 `Traps.h`. The
   call (control, depth, true) right before the erase matches the shape of the
   Appearance `SetUpControlBackground`, but the selector-29 identity and what it
   sets for a control with no embedding parent are not established here. The
   engine takes `background` as an input; it must not be synthesised from art.
2. **Resource chain.** The gate, corner and track `cinf`s and the thumb and tick
   cicns are requested through the current resource chain; track cicns from the
   file named by Gestalt(`Copl`) when it exists (CDEF 3 `0x2664..0x288c`). Which
   file that is at run time is not decoded. The Kaleidoscope 2.3.1 control-panel
   file holds no `cinf` or `cicn` in −10144..−10111 (evidence E12), so shipping it
   would not change any outcome. Whether the base chain participates is policy:
   the scroll bar declares archive-then-base; `composeSlider` is self-only.
3. **The handed-off System slider** (G2) is Apple's, not Kaleidoscope's. The
   engine's existing procedural Platinum slider is the declared substitute.
4. **Several devices.** Each device repaints all of `R`; how QuickDraw limits
   each pass to its device is not established. The declared default is one
   device.
5. **Division by zero.** Messages 5, 6 and 26 divide by `T` or `range` without a
   guard (`T = 0` or `range = 0` with a thumb cicn). Undefined.
6. **Degenerate slices.** `2k` larger than the source length (halves source
   beyond the bounds), or byte 2 ≠ 0 with an empty middle (the tiler skips it,
   leaving a background gap). No corpus case.
7. **`c` undefined** (ID8): variation bits 2 and 3 both set with only a group-1
   `cinf` passes the gate but finds no corner. No corpus case.
8. **Scaling and depth.** CopyMask scaling (ghost into a different-sized `G`),
   colour mapping into an 8-bit offscreen, and the `lowDepth` 1-bit path follow
   QuickDraw; the declared default (depth ≥ 8, unscaled thumb) avoids them.
9. **Message 34** semantics beyond the tags, and the name of feature bit 13.
10. **Native confirmation.** No capture of a Kaleidoscope slider has been
    compared against this spec.
11. **Tiler text font.** Around the BL4/BL5 line loops the port's text font is
    set to −12345 and restored (CDEF 3 `0x2108..0x2110`, `0x215c..0x2160`). No
    drawing effect is established; it may be a marker for Kaleidoscope's own
    trap patches.

### Corpus impact (own forks)

The census behind this table is verifier-only (private store); implementers do not open it. Every value they need is in the table.

| rows | archives |
|---|---|
| G1 Kaleidoscope draws (all ship `cinf` −10144 and −10128) | 1138, 1984, 1990, animals, apple-lisa, beos-r503, crayon-os, dolphin-som, evolution, windows-31, windows-95 (11) |
| G2 handed off: no slider resources at all | apple-platinum-2, black-platinum, monkey-paradise, platinum-8, slimes, system7-nostalgia-silver (6) |
| G2 handed off: slider cicns but **no `cinf`** | floppies |
| `c` (group 0 / 1 / 2) | 1138 5/5/5, 1984 10/10/10, 1990 5/5/5, animals 10/10/10, apple-lisa 5/4/5, beos-r503 2/2/2, crayon-os 3/3/3, dolphin-som 5/5/5, evolution 5/5/5, windows-31 1/1/1, windows-95 2/2/2 |
| SL5 full middle (byte 2 ≠ 0) | 1138, 1990, crayon-os, dolphin-som, evolution |
| SL4 one column (byte 2 = 0), BL4/BL5 | 1984, animals, apple-lisa, beos-r503, windows-31, windows-95 |
| SL6 end-anchored (byte 3 ≠ 0) | none (byte 3 = 0 everywhere) |
| SL2 halves | any archive at `alongR ≤ 2c` (≤ 20 for 1984 and animals) |
| SL1 art thinner than 16 | crayon-os group 2 (3 px), windows-95 (4 px, all groups) |
| TR3 pressed tier missing → `gb + 1` | apple-lisa (−10142, −10136, −10130, −10126, −10120, −10114 absent) |
| TK4 group ticks missing → group 0 ticks | 1984 and apple-lisa group 1 |
| mask-clear track pixels (background shows) | all G1 archives except windows-31, windows-95 and crayon-os group 2 |
| mask-clear thumb pixels | all G1 archives except windows-31 (all cells) and crayon-os / windows-95 group 2 |
| thumb `tA` (h group 0 / 1 / 2) | 1138 15/15/15, 1984 15/15/15, 1990 19/19/16, animals 19/19/17, apple-lisa 15, beos-r503 17, crayon-os 15, dolphin-som and evolution as 1990, windows-31 16, windows-95 11 |
| BL10 / §5.4 non-zero bounds origin | none (every cicn in range has bounds at 0, 0) |

## 7. Test hooks

For a separate test author. Selection rows can use the sentinel-substitution
method of `range-rules.mjs`; geometry rows need the engine trace (rects and
source rects per draw step). Rows go in `tests/rendering-options/slider-rules.mjs`
(new), derived from this spec, never importing `src/`.

| rows | assertion | mutations that must fail |
|---|---|---|
| G1–G3 | floppies and the six resource-less archives never emit Kaleidoscope slider ops; the 11 G1 archives do. Synthetic forks: only `cinf` −10144 with variation bit 2 → Kaleidoscope draws (passes on `base`); only `cinf` −10132 with bit 3 → draws, with bit 2 alone → handed off | gating on the track cicn (floppies would draw); gating on `cinf gb` only (the first synthetic fork would hand off; the corpus alone cannot catch it, since every G1 archive ships `cinf` at `base` and every `gb`) |
| ST (`trackTier`, `thumbCell`) | per hilite 0 / 22 / 129 / 254 / 255: track tier 1/2/2/0/0, thumb cell 1/1/2/0/0 | thumb cell 2 for hilite 22; disabled → cell 3 (the current runtime map); inactive → tier 1 |
| TR3, TR4 | apple-lisa pressed draws −10143/−10131 (normal); a synthetic fork with a pressed cicn but no pressed `cinf` also falls back | dropping the `cinf` requirement; skipping `gb + 1` |
| TH3, TH5 | cell rows `[0,16)` inactive, `[16,32)` normal, `[32,48)` pressed, `[48,64)` ghost (message 13 only) | the 1/2/3 map; ghost cell drawn outside message 13 |
| §5.1 | group 0 / 1 / 2 band at top / bottom / centre for `R` 32 high; group-2 centre of rows (−10, 5) (sum −5) is `[−10, 6)` | floor instead of trunc (gives `[−11, 5)`; a non-negative or even sum cannot tell them apart); band = `R` |
| §5.2 | examples A–C `Th`; `range = 0` → `Th.left = R.left` | rounding instead of trunc; vertical minimum at the top; `c` inset at `range = 0` |
| SL1–SL6 | example A middle tiles (`[83,115)` ← `[5,37)`); example C one-column lines; example D halves | stretching the middle; cap clamp at 6; tiling from the end when byte 3 = 0; halves rule omitted |
| TK1–TK5, §5.4 | examples A and B tick rects; range 0..10 with `n = 4` gives `v = 0, 3, 7, 10`; `n = 1` and `range = 0` draw none; `R` cross 23 draws none | `v_i` without rounding (gives `0, 3, 6, 10`; examples A and B cannot catch it); tick band inside `B`; `tw` instead of `t.right + t.left` (needs a synthetic cicn with bounds.left ≠ 0) |
| BL1, BL6 | mask-clear thumb/track pixels show the O4 background, not the port's old pixels | unmasked copy; transparent `R` |
| OS4, OS5, O-order | trace order: erase, track, ghost, thumb, ticks, composite | thumb before track; no erase |
| HT1–HT4 | example A hit points; a point in the tick band → 0 | testing against `R`; 22/23 swapped |
| §5.6–§5.8 | value from `G.left = 52` in example A → 49 (`trunc(4747 / 95)`; the mapping does not invert §5.2), from `G.left = 53` → 51; vertical posCntl sign | dropping `+ trunc(T/2)` (gives 49 and 50); value from `Th` inverting to 50; vertical sign not flipped |

A row that no mutation can fail is a finding; report it rather than drop it.
Example A's ticks and example D need public inputs the runtime does not have
yet (group, tick count); until then they are engine-trace rows only.

## 8. Effect on the current runtime (`src/controls.ts` `composeSliderWithLayout`)

Each item is a decode finding; none has been fixed.

| current behaviour | decode | verdict |
|---|---|---|
| group-2 ids: track −10132 / −10131 / −10130 (inactive / normal / pressed) h, −10116 / −10115 / −10114 v; thumb −10129 / −10113 | `gb + trackTier`, `gb + 3` with `gb` = −10132 / −10116 | **confirmed** for non-directional sliders |
| only group 2 is drawn | groups 0 and 1 (directional thumbs, ticks) use `base` and `base + 6` and a top/bottom band | **missing** |
| track fallback: requested → normal | requested → `gb + 1` → `base + tier` → `base + 1`; each needs a `cinf` at the same id | **replaced** |
| a scheme draws when it ships the cicns | the gate needs a slider `cinf`; floppies is handed off | **replaced** (floppies) |
| scheme without slider art → `platinumSlider` | the six resource-less archives (and floppies) hand off to the System slider | **confirmed** as policy (§6 item 3) |
| thumb rows: normal 1, pressed 2, disabled/inactive 3 ("blank" row 0) | 0 inactive/disabled, 1 normal, 2 pressed only for hilite 129, 3 ghost; no corpus row 0 is blank | **wrong** for inactive/disabled (draws the ghost cell) |
| cap = `slice.corner` (cinf byte 0), else a 6-clamp | cap = byte 0, no clamp; halves when `L ≤ 2k` | byte 0 **confirmed**; clamp and missing halves **replaced** |
| `slice.tile` (byte 2) false → stretch the whole middle | byte 2 = 0 → one column drawn as lines; else the full middle tiled | **replaced** for byte-2 = 0 archives (1984, animals, apple-lisa, beos-r503, windows-31, windows-95) |
| tiling always from the start | byte 3 selects start or end anchoring | **confirmed** for the corpus (byte 3 = 0), rule **missing** |
| groove centred in `max(thickness, cell)` with floor | art centred in the 16-px band with trunc | **confirmed** at cross 16 (equal for non-negative coordinates) |
| declared-group2 layout: `inset + trunc(travel · value)`, vertical minimum at the bottom, cross 16 (`slider-layout-cinf.md`) | §5.2 | **confirmed**, including `c` from `cinf` −10132/−10144 (h) and −10116/−10128 (v) |
| default (non-declared) layout: `round`, inset 0, value 0 at the top for vertical | trunc, inset `c`, minimum at the bottom; `range = 0` → no inset | **replaced** |
| thumb copied with `srcCopy` (the comment says the mask path is untraced) | CopyMask through the cicn mask (BL1) | **replaced** |
| transparent output outside the art | `R` erased to the background and copied opaque (OS4, OS5) | **replaced** (needs the `background` input) |
| no tick marks | TK1–TK5, §5.4 | **missing** |
| output cross = 16 or the art's natural size | `R` may be taller; band placement by group | **missing** for groups 0/1 |
| pointer mapping (`slider-interaction.md`) | hit area `B` only (HT1); value from position rounds to nearest (§5.6) | to reconcile; `slider-interaction.md` is a modern consistency contract and does not claim native geometry |

## 9. Routine coverage (CDEF 3, 45 in-scope ranges)

Decoded in this file (behaviour or reachability): CDEF 3 `0xc` (entry glue),
CDEF 3 `0x28` and `0xae..0x102` (relocation glue), `0x104` and `0x116` (globals and switch
glue): no behavioural effect.
CDEF 3 `0x13c` (gate), `0x1fc` (main), `0x6d6` (message 26), `0x7ee`, `0x82a`, `0x82e` (message 13, one routine split by the index),
CDEF 3 `0x866` (band), `0x95e` (message 6), `0xa82` (`Th`), `0xb90` (hit test), `0xc22` (message 5),
CDEF 3 `0xd66`, `0x16ba`, `0x171a` (draw entry and device loop; `0x171a` continues `0x16ba`), `0x18b2`, `0x1912`, `0x1956`, `0x19a2` (port tests),
CDEF 3 `0xdce` (drawer), `0x1a34`, `0x1b70` (`lowDepth`), `0x1a86`, `0x1af2`, `0x1b26` (icon prepare, release, black and white),
CDEF 3 `0x1bc0`, `0x1c1c`, `0x1c6c`, `0x28ea` (pixel colour), `0x2012`, `0x205e` (tiler), `0x247e`, `0x24fa` (rect blit),
CDEF 3 `0x2970`, `0x1486` (slicing), `0x2664`, `0x28b2` (cicn get/release), `0x2b96` (`cinf` get).
Reached but inert in CDEF 3: `0x2628` and the switch in `0x2664` (an icon cache whose table pointer is never set;
CDEF 3 slider ids are not in it), and `0x2bf6`, `0x1e20` (the extended `cinf` path; every CDEF 3 caller passes false).
