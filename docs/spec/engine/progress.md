# `progress.draw` — Kaleidoscope 2.3.1 progress bar CDEF 5: gate, art, geometry, draw order, states, indeterminate mode

Behavioural spec, v2 spec lane `v2-progress-spec` (2026-10-22). Template:
[`TEMPLATE.md`](TEMPLATE.md). Implementers read this file, Apple Inside
Macintosh / Universal Interfaces (Appearance progress-bar names), and only the
rule tables the [implementer brief](IMPLEMENTER-BRIEF.md) allows. The
address-by-address trace is in `progress.evidence.md`; implementers do not open it.

**Every address in this file is a file offset into Kaleidoscope 2.3.1 `CDEF 5`**
(not the kDEF and not PACH 130). To keep the routine-coverage counter honest,
every line that carries an address also names CDEF 5. Rects are written
`(top, left, bottom, right)` and are half-open: `[left, right)` × `[top, bottom)`.
`trunc` rounds toward zero. Unless a row says otherwise, arithmetic is signed
32-bit and a result is stored as a 16-bit QuickDraw coordinate.

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `progress.draw`, plus the message, state, data-access and idle facts it depends on |
| family | progress (Appearance `kControlProgressBarProc` 80) |
| messages | 0 draw; also 1 test, 2/10/11 regions, 3 init, 4 dispose, 18 idle, 19 getFeatures, 20 setData, 21 getData, 27 (§1.2) |
| binary | Kaleidoscope 2.3.1 `CDEF 5`, 14,313 B, SHA-256 `0f159bd353e84c276e85d41f1a8e7f0c63dfc1ad37868f04f034ae8c6764939c` |
| entry | CDEF 5 `0xc` (code resource entry) → main `0x13c..0x30e` |
| cited range | all 56 in-scope ranges of CDEF 5 (`docs/spec/routine-inventory.json`); list in §9 |
| out of scope | PACH 130's PaintRect patch, which may repaint the procedural fallback's PaintRect calls (§6 item 1, [progress-caller-boundary](../progress-caller-boundary.md)); what the Control Manager does before or after calling the CDEF; QuickDraw's CopyMask / CopyBits / pattern pixel rules (Apple); how Kaleidoscope gets its CDEF 5 ahead of the System's |

### 1.1 How CDEF 5 is reached

A control's procID is `16 × CDEF id + variation`, so CDEF 5 serves procIDs
80..95. Appearance's progress bar is `kControlProgressBarProc` (80). CDEF 5
never reads the variation, so every procID in 80..95 behaves the same. It
answers message 27 with `' ok '` (new-message support, CDEF 5 `0x292`).

Unlike the slider (CDEF 3), CDEF 5 **never hands off** to the System file's
CDEF. It always draws: either the Kaleidoscope art (§4.3) or its own
procedural bar (§4.9). No corpus archive ships a `CDEF` resource.

### 1.2 Message map (main, CDEF 5 `0x13c..0x30e`)

Before dispatching, **every** message forces the control rect to 14 pixels
tall (RECT1). Unlisted messages do nothing and return 0.

| message | effect | source |
|---|---|---|
| 0 draw | when the control is visible (DRAW1), draw (§3.3). The part argument is ignored | CDEF 5 `0x226..0x240` |
| 1 test | returns 0: the bar has no parts (HIT1) | CDEF 5 `0x244..0x246` |
| 2 calcCRgns | region = `R`, whatever the region argument's high bit (HIT2) | CDEF 5 `0x24a..0x25a` |
| 3 init | allocates the 8-byte private record: not indeterminate, idle time 0, phase 0 (IDLE1) | CDEF 5 `0x25e..0x27e` |
| 4 dispose | frees the private record when there is one | CDEF 5 `0x280..0x290` |
| 10 calcCntlRgn, 11 calcThumbRgn | region = `R` (HIT2) | CDEF 5 `0x250..0x25a` |
| 18 idle | advances the indeterminate phase (§4.10), then draws (IDLE3) | CDEF 5 `0x1d8..0x240` |
| 19 getFeatures | 72: wants idle (8) + supports data access (64) | CDEF 5 `0x29a` |
| 20 setData | tag `'inde'`: the indeterminate flag := the first data byte; other tags: −30581 (DATA1, DATA3) | CDEF 5 `0x2d4..0x2f6` |
| 21 getData | tag `'inde'`: writes the flag byte (when a data pointer is given) and size 1, result 0; other tags: −30581 (DATA2, DATA3) | CDEF 5 `0x29e..0x2d2` |
| 27 | `' ok '` | CDEF 5 `0x292` |
| 5–9, 12–17, 22–26 and > 27 | nothing; result 0 | CDEF 5 `0x18e..0x194`, `0x2fc` |

`'inde'` is Apple's `kControlProgressBarIndeterminateTag`; 72 = Apple's
`kControlWantsIdle` (8) + `kControlSupportsDataAccess` (64); −30581 is Apple's
`errDataNotSupported` (names from Apple's Appearance interfaces, not pinned
here; the numeric values are what the binary uses).

## 2. Inputs

### Control inputs

| input | meaning | values / domain |
|---|---|---|
| `R` | control rect, port coordinates, after RECT1 | `(top, left, top + 14, right)` |
| `visible` | the Control Manager's visibility answer (DRAW1) | bool |
| `hilite` | the control's highlight value | 0..255; only 254 and 255 are tested |
| `value`, `min`, `max` | 16-bit control values | integers −32768..32767 |
| `indeterminate` | the private record's flag byte, set by message 20 | byte; 0 = determinate, anything else = indeterminate |
| `phase` | the private record's phase byte, advanced by message 18 (§4.10) | 0..255 |

### Environment inputs

| input | meaning |
|---|---|
| `available resources` | `cinf`, `cicn` and `ppat` resources by id through the resource chain (§4.14) |
| `prior pixels` | what the port already shows under `R`. CDEF 5 never erases (§4.12), so every pixel no art covers keeps it |
| `devices` | the devices `R` crosses, each with a pixel depth and a colour/grey flag |
| `lowDepth` | per device: depth < 4, or depth 4 on a colour device; clear above 4 (CDEF 5 `0xd60..0xd94`, `0xe36..0xe66`) |
| `portState` | colour port or not; picture/region recording; custom bottlenecks; pen hidden; visRgn and clipRgn; whether the port is the screen |
| `colourQD` | Colour QuickDraw is present (Gestalt `'qd  '` ≥ 0x100), cached after the first test (CDEF 5 `0x9c2..0xa02`) |

### Derived state

| state | definition | source |
|---|---|---|
| `inactive` | hilite is 254 or 255 **and** `cinf` −10077 exists (§4.3 GATE1) | CDEF 5 `0x376..0x3a6` |
| `F` (frame id) | −10077 when `inactive`, else −10080 | CDEF 5 `0x370`, `0x38a`, `0x3a6` |
| `k` | frame cinf byte 0 (Corner Size), unsigned | CDEF 5 `0x3fc..0x40c` |
| `s` | frame cinf byte 1 (Side Thickness), unsigned | CDEF 5 `0x410..0x416` |
| `I` (inner rect) | §5.2 | CDEF 5 `0x3ee..0x430` |
| `x` (split) | §5.3 | CDEF 5 `0x532..0x580` |

Inactive (254) and disabled (255) draw identically. Hilite 0..253 all draw as
active; there is no pressed art.

### Scriptoscope mapping (proposed) and declared defaults

| public input | native reading |
|---|---|
| `state: 'normal'` and `'pressed'` | hilite 0 (a progress bar has no pressed art; 1..253 draw the same) |
| `state: 'inactive'` / `'disabled'` | hilite 254 / 255 (same pixels) |
| `length` | `R.right − R.left`; `R` = `(0, 0, 14, length)` |
| `value` (normalized 0..1, current API) | **Proposed, needs a maintainer decision:** add integer `value` / `min` / `max` inputs. Until then the facade passes `min = 0`, `max = 10000`, `value = trunc(v × 10000)`. Declared default, modern policy |
| indeterminate | **missing** from the public API: needs `indeterminate?: boolean` and `phase?: number` (the count of idle advances, 0..255) |

Declared defaults (modern policy, not original observations): one device at
depth ≥ 8 (`lowDepth` clear), Colour QuickDraw present, colour port, not
recording, no custom bottlenecks, pen visible, `visible` true, a wide-open
clip, the port not the screen (offscreen) so the bar is drawn in one direct
pass (DRAW4), `phase` 0, and a resource chain of the archive's own fork then
its base chain (§4.14).

## 3. Outputs

### 3.1 Resources requested, in order

On a draw (messages 0 and 18), per device pass:

1. `cinf −10077`, only when hilite is 254 or 255 (GATE1).
2. `cinf −10080`, when step 1 was not made or found nothing (GATE1, GATE2).
3. `cicn F` (the frame), then `cinf F` again inside the frame drawer (FRAME1). A missing `cicn F` ends the Kaleidoscope attempt (GATE3).
4. Determinate: `cicn F + 1`, then `cinf F + 1` (fill); then `cicn F + 2`, then `cinf F + 2` (track) (DET1, SLICE1).
5. Indeterminate: `ppat F_p + 1`, where `F_p` is −10072 when `inactive`, else −10080 (a probe, released at once); then `ppat F_p + phase` (when `phase < 8`), then `ppat F_p` (IND1–IND4).
6. Procedural fallback only (§4.9): `cicn −10224`; then `ppat −10064` when indeterminate.

No other resource is requested. `cicn −10223` is **never** requested by CDEF 5.
No request is retried at another id except the ones listed (GATE1, IND2, IND3).

### 3.2 Rects

`R` (RECT1), the frame pieces (§5.1), `I` (§5.2), the fill rect
`[I.left, x)` and the track rect `[x, I.right)` (§5.3), the art rects inside
them (§5.4), and the fallback rects (§5.6), all in port coordinates.

### 3.3 Draw order

Nothing is drawn when `visible` is false (DRAW1), or when `R` ∩ visRgn ∩ clipRgn
is empty or the pen is hidden, unless a picture or region is being recorded
(DRAW2). Otherwise the drawer runs once per device (DeviceLoop `$ABCA`), or
once directly when the port is not the screen or is recording (DRAW3, DRAW4).
**There is no offscreen and no erase**: every step draws straight into the port
(ERASE1). Each run (CDEF 5 `0x5d2..0x7f0`):

| step | action | source |
|---|---|---|
| O1 | save the port state (port, clip, pen, colours, pen and background pixel patterns) | CDEF 5 `0x5f8..0x614`, `0xcfc..0xd20`, `0xb02..0xbbc` |
| O2 | normalise the port: white background pattern, black pen pattern, PenNormal, black foreground on white background (when `colourQD`); on a colour port whose background pixel-pattern handle is not 28 bytes, that handle is first dropped from the port | CDEF 5 `0x61a..0x61e`, `0xc6a..0xcfa` |
| O3 | set `lowDepth` from this pass's device | CDEF 5 `0x624..0x626`, `0xd60..0xd94` |
| O4 | Kaleidoscope art (§4.3–§4.8): frame, then determinate fill and track **or** indeterminate pattern | CDEF 5 `0x62c..0x638`, `0x35a..0x5d0` |
| O5 | only when O4 declined (GATE2, GATE3): the procedural bar (§4.9) | CDEF 5 `0x64e..0x7d8` |
| O6 | restore the port state saved in O1 | CDEF 5 `0x63a..0x648`, `0x7da..0x7e8`, `0xd22..0xd5e`, `0xbbe..0xc68` |

Within O4 the order is fixed: frame (§4.4), then determinate fill then track
(§4.6), or the indeterminate fill (§4.7). Within O5: bevel lines, frame
rectangle, then the two painted parts or the pattern (§4.9).

## 4. Decision tables

Row ids are stable; `src/engine/tables/progress.ts` mirrors one row per spec
row with the same `source`.

### 4.1 Rect and messages

| # | condition | output | source |
|---|---|---|---|
| RECT1 | every message, before dispatch, when `R.bottom − R.top ≠ 14` | the control rect's bottom is rewritten to `R.top + 14` (the change persists in the control) | CDEF 5 `0x15a..0x188` |
| RECT2 | always | `R.left`, `R.right` and `R.top` are never changed; the width is the caller's | CDEF 5 `0x176..0x188` |
| MSG1 | message > 27, or a message with no case in §1.2 | result 0, nothing else | CDEF 5 `0x18e..0x194`, `0x2fc` |
| MSG2 | every message | the variation is never read | CDEF 5 `0x13c..0x30a` |

### 4.2 Visibility and device passes

| # | condition | output | source |
|---|---|---|---|
| DRAW1 | message 0 or the end of message 18 | Control Manager `$AA73` selector 6 (IsControlVisible; identity from Apple's later Controls.h, §6 item 3) on the control; draw only when it answers true | CDEF 5 `0x226..0x240` |
| DRAW2 | the draw region `R` ∩ visRgn ∩ clipRgn is empty, or the pen is hidden, and no picture or region is being recorded | nothing is drawn | CDEF 5 `0x7fc..0x882` |
| DRAW3 | otherwise, the port is the screen and not recording | DeviceLoop `$ABCA` over the draw region; one pass per device, each with that device's depth and colour flag | CDEF 5 `0x96c..0x97c` |
| DRAW4 | the port is not the screen (its pixels' base address differs from the Window Manager port's), or a picture or region is being recorded | one direct pass with the current device; the depth argument is the port's pixel depth (1 for a non-colour port) | CDEF 5 `0x83a..0x86a`, `0x93a..0x96a`, `0xa3c..0xaa0` |
| DRAW5 | a non-colour port that is the screen, with no custom bottlenecks and not recording | the pass first switches to the Window Manager port in global coordinates with the clip set to the window's visRgn ∩ clipRgn, and restores afterwards. Not reached under the declared defaults | CDEF 5 `0x824..0x938`, `0x97e..0x9b4`, `0xa04..0xa24` |

`lowDepth` comes from the device of the pass (DRAW3) or the current device
(DRAW4), not from the depth argument (CDEF 5 `0xd60..0xd94`).

### 4.3 Gate and state (which drawing path)

| # | condition | output | source |
|---|---|---|---|
| GATE1 | hilite 254 or 255, and `cinf −10077` found | `inactive`, `F = −10077` | CDEF 5 `0x376..0x3a2` |
| GATE1a | hilite 254 or 255, `cinf −10077` missing | **not** inactive: `F = −10080`, and the whole bar draws with the active ids (frame, fill, track and patterns). There is no per-part fallback | CDEF 5 `0x3a4..0x3a6`, `0x3aa..0x3ba` |
| GATE2 | `cinf F` not found (for active, `cinf −10080`) | the Kaleidoscope path declines; the procedural bar draws (§4.9) | CDEF 5 `0x3bc..0x3c4` |
| GATE3 | `cinf F` found, `cicn F` missing | the Kaleidoscope path declines (no frame is drawn); the procedural bar draws. An inactive bar with `cinf −10077` but no `cicn −10077` does **not** retry −10080 | CDEF 5 `0x3c6..0x3ec`, `0x1f72..0x1fca`, `0x2032..0x2046` |
| GATE4 | `cinf F` and `cicn F` found | the frame is drawn (§4.4) and then the determinate (§4.6) or indeterminate (§4.7) content. From here on the Kaleidoscope path never declines, even when the fill, track or pattern is missing | CDEF 5 `0x3ee..0x5c8` |

Only `cinf F` and `cicn F` decide the path. The fill, track and pattern
resources are looked up after the frame has been drawn; a missing one just
draws nothing in its place.

### 4.4 Frame (cinf border, no body)

The frame is drawn into `D = R` from `cicn F` and `cinf F` with `c = k`, `s`
and `tile` = cinf byte 2. The body is **not** filled and no colour is sampled.

| # | condition | output | source |
|---|---|---|---|
| FRAME1 | GATE4 | `cicn F`, then `cinf F` (the current resource file is switched to the `'Copl'` file for the cicn only, §4.14); a missing cinf here would be retried at `cinf 1`, but GATE4 has already found it, so the retry is unreachable | CDEF 5 `0x1fd2..0x2078` |
| FRAME2 | always | pen state saved, PenNormal; restored at the end | CDEF 5 `0x20a6..0x20ac`, `0x273c..0x2740` |
| FRAME3 | always | pieces in this order: TL, TR, top, BL, BR, bottom, left, right, at the rects of §5.1 | CDEF 5 `0x219c..0x251a` |
| FRAME4 | corners | 1:1 masked copy (BLIT1) of the cut corner block | CDEF 5 `0x21a8..0x2256`, `0x22e8..0x23ae` |
| FRAME5 | bands, `tile` = 0 | the band's source is the one column (top/bottom) or row (left/right) at offset `c`; drawn by the tiler (BLIT3–BLIT6), which for a run longer than 1 paints lines | CDEF 5 `0x2296..0x229c`, `0x23f0..0x23f6`, `0x2466..0x246c`, `0x24dc..0x24e2` |
| FRAME6 | bands, `tile` ≠ 0 | the band's source is the whole middle strip `[c, extent − c)`, tiled forward from the band's start | CDEF 5 `0x2264..0x22d2`, `0x23be..0x242c`, `0x2434..0x24a2`, `0x24a6..0x2518` |
| FRAME7 | culls | TL/TR skipped when `D.top + c ≤ clip top`; top band when `D.top + s ≤ clip top`; BL/BR when `D.bottom − c ≥ clip bottom`; bottom band when `D.bottom − s ≥ clip bottom` (clip = the clip region's bounding box). Pixel-neutral | CDEF 5 `0x219c..0x21a4`, `0x225a..0x2262`, `0x22da..0x22e4`, `0x23b2..0x23bc` |
| FRAME8 | always | nothing else: no erase, no body pattern, no text or emboss colour | CDEF 5 `0x2530..0x2534` |

These are the same piece rules as the kDEF cinf border ([qd-primitives](qd-primitives.md)
table E and "cinf border rects", with `D = R`), decoded separately here from
CDEF 5's own copy.

### 4.5 Inner rect

| # | condition | output | source |
|---|---|---|---|
| INSET1 | `k > 2` | `I = R` inset by `k` horizontally and `s` vertically | CDEF 5 `0x3fc..0x41c` |
| INSET2 | `k ≤ 2` | `I = R` inset by 2 horizontally and `s` vertically | CDEF 5 `0x41e..0x430` |

InsetRect `$A8A9`; an inset larger than half the rect gives an empty `I`
(Apple: InsetRect returns an empty rect then).

### 4.6 Determinate (indeterminate flag 0)

| # | condition | output | source |
|---|---|---|---|
| DET1 | always | `x` per §5.3; the fill rect `[I.left, x)` × `I`'s rows is drawn with art id `F + 1`, then the track rect `[x, I.right)` × `I`'s rows with `F + 2` (SLICE1–SLICE7) | CDEF 5 `0x532..0x5c4` |
| DET2 | `max = min` | the range is taken as 1 | CDEF 5 `0x55e..0x562` |
| DET3 | always | **no clamp**: `value < min` puts `x` left of `I.left` (an empty fill and a track that starts left of `I`); `value > max` puts `x` right of `I.right` (a fill that runs past `I.right` and an empty track) | CDEF 5 `0x570..0x580`, `0x5a0..0x5b0` |
| DET4 | a fill or track rect that is empty or inverted | the slicer still runs; it copies no pixels (the pieces are empty, and an empty rect copies nothing: Apple) | CDEF 5 `0x1e12..0x1e20` |

### 4.7 Indeterminate (indeterminate flag ≠ 0)

`F_p` = −10072 when `inactive`, else −10080. The pattern fills all of `I`.

| # | condition | output | source |
|---|---|---|---|
| IND1 | always | probe `ppat F_p + 1`; it is released at once | CDEF 5 `0x43c..0x45e` |
| IND2 | probe found (**frame mode**), `phase < 8` | pattern = `ppat F_p + phase`; if missing, `phase := 0` (written back) and pattern = `ppat F_p` | CDEF 5 `0x460..0x4be` |
| IND3 | probe found, `phase ≥ 8` | `phase := 0` (written back), pattern = `ppat F_p` | CDEF 5 `0x464..0x46a`, `0x490..0x4be` |
| IND4 | IND2/IND3 pattern found | fill `I` with it, phase point `(I.left, I.top)` (PAT1–PAT3) | CDEF 5 `0x4c0..0x4e2` |
| IND5 | probe missing (**shift mode**) | pattern = `ppat F_p`; when found, fill `I` with phase point `(I.left + 4·phase, I.top)`. `phase` is not reset | CDEF 5 `0x4e6..0x52e` |
| IND6 | no pattern found (IND2/IND3 frame 0, or IND5) | nothing is drawn inside `I`; the frame stands and `I` keeps its prior pixels | CDEF 5 `0x4c2`, `0x500` |
| IND7 | always | the determinate value is not read | CDEF 5 `0x432..0x438` |

In frame mode the patterns are animation frames `F_p .. F_p + 7`; the cycle
length is the number of consecutive frames present from `F_p` (a missing
frame restarts at `F_p`). In shift mode the single pattern moves right by 4
pixels per phase, so a pattern 8 wide shows two positions and one 16 wide four.

### 4.8 Fill and track slicing (art id `A`, target rect `T`)

| # | condition | output | source |
|---|---|---|---|
| SLICE1 | always | `cicn A`, then `cinf A`; either missing → nothing drawn for `T` (no retry) | CDEF 5 `0x1d7e..0x1dbe` |
| SLICE2 | always | `S` = the cicn bounds; the art keeps its own height, centred on `T` (§5.4) | CDEF 5 `0x1dd2..0x1e0e` |
| SLICE3 | `L ≤ 2a` (`L` = `T` width, `a` = `cinf A` byte 0) | halves: two 1:1 pieces, no middle (§5.4) | CDEF 5 `0x1e12..0x1ea6` |
| SLICE4 | otherwise | caps: the first `a` and last `a` source columns 1:1 at the two ends | CDEF 5 `0x1eaa..0x1efa` |
| SLICE5 | SLICE4, `cinf A` byte 2 = 0 | the middle source is the single column at `a` from the start | CDEF 5 `0x1f12..0x1f24` |
| SLICE6 | SLICE4, byte 2 ≠ 0 | the middle source is `[S.left + a, S.right − a)` | CDEF 5 `0x1efe..0x1f0e` |
| SLICE7 | middle | drawn into `[T.left + a, T.right − a)` × the art rows by the tiler (BLIT3–BLIT6), forward from the start when `cinf A` byte 3 = 0, from the end otherwise | CDEF 5 `0x1f28..0x1f52`, `0x1516..0x1548` |

The caps (SLICE4) are not cut to the icon: an `a` wider than half the icon
reads source columns that overlap or lie outside it (§6 item 6).

### 4.9 Procedural bar (GATE2 or GATE3)

Drawn into the port with the state left by O2 (black pen pattern, PenNormal).
The colours are fixed RGB triples (COL3) or samples of `cicn −10224` (COL2).

| # | condition | output | source |
|---|---|---|---|
| FB1 | `cicn −10224` found | foreground := colour of its pixel (11, 11); MoveTo / LineTo lines along the bottom row `R.bottom − 1` over columns `[R.left + 1, R.right − 1]` and the right column `R.right − 1` over rows `[R.top + 1, R.bottom − 1]` (inclusive) | CDEF 5 `0x64e..0x692` |
| FB2 | FB1 | foreground := colour of its pixel (0, 0); lines along the left column `R.left` over rows `[R.top, R.bottom − 2]` and the top row `R.top` over columns `[R.left, R.right − 2]` | CDEF 5 `0x6a6..0x6d4` |
| FB3 | FB1 | foreground := colour of its pixel (1, 1); the cicn is released | CDEF 5 `0x6d6..0x6e6` |
| FB4 | `cicn −10224` missing | no lines; the foreground stays black (O2) | CDEF 5 `0x65e` |
| FB5 | always | FrameRect `$A8A1` of `R` inset by 1 in the current foreground | CDEF 5 `0x6ec..0x6fc` |
| FB6 | always | `I_f = R` inset by 2 (both axes) | CDEF 5 `0x6fe..0x708` |
| FB7 | determinate | split `x_f` per §5.3 over `I_f`; PaintRect `$A8A2` `[I_f.left, x_f)` in dark grey (COL3), then PaintRect `[x_f, I_f.right)` in lavender (COL3) | CDEF 5 `0x75e..0x7d8` |
| FB8 | indeterminate, `ppat −10064` found | fill `I_f` with it at phase point `(I_f.left + 4·phase, I_f.top)` (shift mode only; there are no frames) | CDEF 5 `0x712..0x75c` |
| FB9 | indeterminate, `ppat −10064` missing | foreground := lavender, then PaintRect of a rect the routine **never sets**: undefined, **not decoded** (§6 item 2). Declared engine policy: draw nothing in `I_f` and trace the step as unspecified | CDEF 5 `0x71e..0x72e` |
| FB10 | always | hilite is never read: inactive and disabled bars look like active ones | CDEF 5 `0x64e..0x7d8` |

Pixels `(R.left, R.bottom − 1)` and `(R.right − 1, R.top)` are covered by no
line (FB1, FB2); with FB4 the whole outer ring is uncovered. Those pixels keep
their prior content (ERASE2).

### 4.10 Idle and phase

| # | condition | output | source |
|---|---|---|---|
| IDLE1 | message 3 | flag 0, idle time 0, phase 0 | CDEF 5 `0x25e..0x27e` |
| IDLE2 | message 18, flag ≠ 0, TickCount `$A975` ≥ idle time + 3 (unsigned) | `phase := phase + 1` (8-bit, wraps at 256), idle time := TickCount; then draw if visible (DRAW1) | CDEF 5 `0x1d8..0x224` |
| IDLE3 | message 18, always (also after IDLE2) | draw if visible (DRAW1). So an idle draws once, or twice when the phase advanced; a determinate bar redraws on every idle | CDEF 5 `0x1e2`, `0x1fa`, `0x226..0x240` |
| IDLE4 | message 20 | changes the flag only; nothing is redrawn and the phase is kept | CDEF 5 `0x2d4..0x2f4` |

The second draw in IDLE3 repaints the same pixels: every step is a masked copy,
a line or an opaque fill drawn in a fixed order, so repeating the sequence
leaves the last-drawn layer on top at every pixel.

### 4.11 Blits (transfer modes)

Art goes through two helpers that set black foreground and white background,
draw, and restore the colours (CDEF 5 `0x194c..0x1a4a`, `0x154a..0x18f4`).

| # | condition | output | source |
|---|---|---|---|
| BLIT1 | rect copy (corners, halves, caps) | CopyMask `$A817` from the cicn's pixel map through its mask, same source rect, into the destination rect | CDEF 5 `0x1a1e..0x1a2e`, `0x18f6..0x194a` |
| BLIT2 | BLIT1 or BLIT5, `lowDepth` or a non-colour port | the source is the cicn's 1-bit icon image instead of its pixel map | CDEF 5 `0x19ba..0x19d0`, `0x16ea..0x170a` |
| BLIT3 | tiler, one-column source, destination wider than 1 | per source row from the top while inside the destination: when the cicn's mask bit at (column, row) is set, a one-pixel line (MoveTo `$A893` / LineTo `$A891`) across the destination in that pixel's colour (COL1); clear rows are left alone | CDEF 5 `0x15de..0x1654` |
| BLIT4 | tiler, one-row source, destination taller than 1 (BLIT3 not taken) | per source column, the same with vertical lines | CDEF 5 `0x1658..0x16b8` |
| BLIT5 | tiler otherwise | 1:1 tiles of the source; the last tile is cut short; masked as BLIT1 | CDEF 5 `0x16bc..0x18c4` |
| BLIT6 | BLIT5 direction and axis | forward: first tile at the top-left, a cut tile keeps the source's leading columns/rows; reverse: first tile at the bottom-right, a cut tile keeps the trailing ones. Tiles advance along x when the destination's height equals the source's, otherwise along y | CDEF 5 `0x1714..0x1800`, `0x1800..0x18c2` |
| BLIT7 | BLIT1 or BLIT5 while a picture is being recorded (BLIT1 also with custom bottlenecks) | BLIT1: CopyBits `$A8EC` `srcCopy` with a mask region made from the cicn mask (BitMapToRegion `$A8D7`, MapRgn `$A8FB`); BLIT5: CopyBits `srcCopy` **unmasked** | CDEF 5 `0x19da..0x1a1c`, `0x1790..0x17ac`, `0x185c..0x1878` |
| BLIT8 | any helper | skipped when the destination misses the clip region's bounding box vertically, or (tiler) either rect is empty. Pixel-neutral | CDEF 5 `0x1562..0x15ca`, `0x198e..0x19a0` |

### 4.12 Erase and background

| # | condition | output | source |
|---|---|---|---|
| ERASE1 | always, on both paths | CDEF 5 performs **no erase** and no background set-up for the bar: no EraseRect, no SetUpControlBackground, no offscreen. (The frame drawer has an erase only in its body path, which the progress bar never enables, FRAME8) | CDEF 5 `0x5d2..0x7f0`, `0x2530..0x2534` |
| ERASE2 | a pixel of `R` that no step of §3.3 covers | keeps its prior content: mask-clear frame, fill and track pixels; rows of `I` above and below art shorter than `I`; all of `I` when IND6 holds; the two corner pixels of FB1/FB2 or the outer ring with FB4 | CDEF 5 `0x35a..0x5d0`, `0x64e..0x7d8` |
| ERASE3 | engine output (declared) | the engine draws into a buffer covering `R` whose pixels start **transparent**; ERASE2 pixels stay transparent so the host's own pixels show through. The engine must not synthesise a background colour or pattern from the art. Modern policy, not an original observation | CDEF 5 `0x5d2..0x7f0` |
| ERASE4 | pattern fills (IND4, IND5, FB8) and PaintRect (FB7) | opaque: every pixel of the target rect is replaced | CDEF 5 `0xf56..0x1048`, `0xea6..0xf54`, `0x7b0..0x7d8` |

Masked art never mixes with what lies under it: where the mask is set the
pixel is replaced; where it is clear the pixel is left alone.

### 4.13 Colour lookups

| # | condition | output | source |
|---|---|---|---|
| COL1 | a cicn pixel colour (BLIT3/BLIT4 lines, FB1–FB3), not `lowDepth` | the stored pixel value (1, 2, 4 or 8 bit; the leftmost pixel in the high bits) looked up in the cicn's colour table: the entry at that index when the index is within the table and the entry's value equals the pixel; else, when the table's last entry has value 0, the entry at that index (by position); else the entry whose value equals the pixel, searched from the last entry down; entry 0 if none | CDEF 5 `0x129c..0x1460`, `0x10c4..0x129a`, `0x1d08..0x1d7c` |
| COL1a | COL1 at `lowDepth` | the cicn's 1-bit icon image bit: set → black, clear → white | CDEF 5 `0x12f2..0x137a`, `0x112c..0x11b4` |
| COL1b | COL1 coordinates | the point is read as column and row counted from the cicn's first stored pixel, with no range check (every corpus cicn in this family has bounds at (0, 0)) | CDEF 5 `0x12b4..0x12f0`, `0x137e..0x1392` |
| COL1c | COL1 on a 16- or 32-bit pixel map | not handled: **not decoded** (no corpus case) | CDEF 5 `0x1394..0x13ac`, `0x11ce..0x11e6` |
| COL2 | FB1–FB3 samples | the mask bit is ignored: a sample on a mask-clear pixel still gives that pixel's colour | CDEF 5 `0x108a..0x10c2` |
| COL3 | fixed colours (16-bit QuickDraw RGB) | dark grey `(0x4445, 0x4444, 0x4444)` (FB7 filled part); lavender `(0xCCCC, 0xCCCC, 0xFFFF)` (FB7 empty part, FB9); black `(0, 0, 0)` and white `(0xFFFF, 0xFFFF, 0xFFFF)` (O2 and the blit helpers) | CDEF 5 `0x7b0..0x7d2`, `0x722..0x726`, `0xe04..0xe34`, `0xc6a..0xcf4` |
| COL4 | COL3 display (declared) | the engine converts COL3 triples through the same display policy as decoded resource colours (the conversion-time Mac gamma, `tools/theme-loader/mac-gamma.js`). Modern policy; CDEF 5 only hands the triples to QuickDraw | CDEF 5 `0x7b0..0x7d2` |

### 4.14 Resource chain and payloads

| # | condition | output | source |
|---|---|---|---|
| CHAIN1 | every cicn request (frame, fill, track, −10224) | made with the current resource file switched to the file named by the `'Copl'` Gestalt response when that call succeeds; the caller's file is restored after | CDEF 5 `0x1aa8..0x1ae8`, `0x1cdc..0x1cde`, `0x1fec..0x200a`, `0x203c..0x203e` |
| CHAIN2 | every `cinf` and `ppat` request | through the current resource chain (GetResource `$A9A0`, GetPixPat `$AA0C`), no file switch | CDEF 5 `0x2e84..0x2ff0`, `0x43c..0x4fa`, `0x712..0x718` |
| CHAIN3 | engine (declared) | the chain is the archive's own fork, then its base chain. The Kaleidoscope 2.3.1 control-panel file, which holds `cicn −10224`, `cicn −10223` and `ppat −10064`, is **not** shipped (DECISIONS #5): a recorded deliberate divergence. It matters only for the procedural bar (FB1, FB8/FB9) | CDEF 5 `0x1aa8..0x1ae8` |
| CINF1 | any `cinf` request | found when a handle comes back; the length is never checked (the one length check is on a path no CDEF 5 caller takes) | CDEF 5 `0x2e84..0x2ec8` |
| CINF2 | bytes read | frame: bytes 0 and 1 (inset, §4.5) and 0, 1, 2 (border, §4.4); fill and track: bytes 0, 2 and 3 (§4.8). No other byte is read | CDEF 5 `0x3fc..0x42e`, `0x207c..0x2086`, `0x2290`, `0x1dc2..0x1dc6`, `0x1f14`, `0x1f3e` |
| CINF3 | a `cinf` too short for a byte CINF2 reads | reads past the data: **undefined, not decoded**. Declared engine policy: trace the read as unspecified and treat that `cinf` as missing. No corpus case (every progress `cinf` is 18 bytes) | CDEF 5 `0x2e84..0x2ec8` |

### 4.15 Hit test, regions and data access

| # | condition | output | source |
|---|---|---|---|
| HIT1 | message 1, any point | part 0: no point in a progress bar is a part | CDEF 5 `0x244..0x246` |
| HIT2 | messages 2, 10, 11 | the region is set to `R` (RectRgn `$A8DF`) | CDEF 5 `0x24a..0x25a` |
| DATA1 | message 20, tag `'inde'` | the flag := the first byte at the data pointer. The size and the part are not checked; no redraw (IDLE4) | CDEF 5 `0x2d4..0x2f4` |
| DATA2 | message 21, tag `'inde'` | when the data pointer is not nil, the flag byte is written there; the size is set to 1; result 0 | CDEF 5 `0x29e..0x2ca` |
| DATA3 | messages 20/21, any other tag | result −30581; nothing changes | CDEF 5 `0x2cc..0x2d2`, `0x2f6` |
| DATA4 | message 3 when memory is short | the record is used without a nil check: **not decoded** (undefined) | CDEF 5 `0x25e..0x27e` |

## 5. Geometry

### 5.1 Frame pieces (`D = R`, CDEF 5 `0x219c..0x251a`)

`B` = the frame cicn's bounds, `W` and `H` its width and height. With
`cw = min(c, W)`, `ch = min(c, H)`, `sw = min(s, W)`, `sh = min(s, H)`, and
`e = W − c`, `f = H − c` when `tile ≠ 0`, `e = c + 1`, `f = c + 1` when `tile = 0`
(source rects relative to `B`'s top-left):

| piece | source x × y | destination x × y |
|---|---|---|
| TL | `[0, cw) × [0, ch)` | `[D.left, D.left + cw) × [D.top, D.top + ch)` |
| TR | `[W − cw, W) × [0, ch)` | `[D.right − cw, D.right) × [D.top, D.top + ch)` |
| top | `[c, e) × [0, sh)` | `[D.left + c, D.right − c) × [D.top, D.top + sh)` |
| BL | `[0, cw) × [H − ch, H)` | `[D.left, D.left + cw) × [D.bottom − ch, D.bottom)` |
| BR | `[W − cw, W) × [H − ch, H)` | `[D.right − cw, D.right) × [D.bottom − ch, D.bottom)` |
| bottom | `[c, e) × [H − sh, H)` | `[D.left + c, D.right − c) × [D.bottom − sh, D.bottom)` |
| left | `[0, sw) × [c, f)` | `[D.left, D.left + sw) × [D.top + c, D.bottom − c)` |
| right | `[W − sw, W) × [c, f)` | `[D.right − sw, D.right) × [D.top + c, D.bottom − c)` |

Bands are drawn by the tiler (BLIT3–BLIT6) forward; corners by BLIT1. Later
pieces win where their mask is set.

### 5.2 Inner rect `I` (CDEF 5 `0x3ee..0x430`)

`h = k` when `k > 2`, else 2. `I = (R.top + s, R.left + h, R.bottom − s, R.right − h)`.
With RECT1, `I` is `14 − 2s` rows tall.

### 5.3 Split `x` (CDEF 5 `0x532..0x580`; fallback CDEF 5 `0x75e..0x7ac`)

`w = I.right − I.left`, `range = max − min` (1 when 0), `offset = value − min`,
each computed from the sign-extended 16-bit values, so neither difference
wraps. `x = I.left + trunc(w · offset / range)`, stored as 16 bits. The fallback
uses the same formula on `I_f`.

### 5.4 Fill and track art (CDEF 5 `0x1d7e..0x1f6a`)

For target `T` and art id `A`: `S` = the cicn bounds, `a` = `cinf A` byte 0,
`L = T.right − T.left` (16-bit). The art rows are
`D.top = trunc((T.top + T.bottom − (S.bottom − S.top)) / 2)` and
`D.bottom = D.top + (S.bottom − S.top)` (SLICE2).

- **Halves** (`L ≤ 2a`): piece 1 source `[S.left, S.left + trunc((L + 1) / 2))`
  at `T.left`; piece 2 source `[S.right − trunc(L / 2), S.right)` at
  `T.right − trunc(L / 2)`. Both 1:1, full source height, at `D.top`.
- **Caps** (`L > 2a`): `[S.left, S.left + a)` at `T.left`; `[S.right − a, S.right)`
  at `T.right − a`; the middle source (SLICE5/SLICE6) tiled into
  `[T.left + a, T.right − a)` × `[D.top, D.bottom)`.
- **Forward tiles** (byte 3 = 0): from `T.left + a`, each tile the middle
  source's length, the last cut at `T.right − a` with its source cut from the end.
- **Reverse tiles** (byte 3 ≠ 0): from `T.right − a` back toward the start, the
  last cut at `T.left + a` with its source cut from the start.

The art may be taller than `T`: then it covers rows of the frame above and
below `I` (BLIT1 is masked, so only its mask-set pixels do).

### 5.5 Pattern phase (CDEF 5 `0xf56..0x1048`)

A pattern fill of rect `P` with phase point `(px, py)` moves the port origin
so that `(px, py)` becomes local `(0, 0)`, moves `P` and the clip region by the
same amount (the clip is left unmoved when its bounding box already reaches
±32000), fills, and moves everything back (SetOrigin `$A878`, OffsetRgn
`$A8E0`). With Apple's rule that patterns align to the port origin, port pixel
`(X, Y)` shows pattern pixel `((X − px) mod pw, (Y − py) mod ph)`, `mod` the
non-negative remainder (same as qd-primitives F1).

| # | condition | output | source |
|---|---|---|---|
| PAT1 | not `lowDepth` | FillCRect `$AA0E` with the pixel pattern | CDEF 5 `0xf32..0xf36` |
| PAT2 | `lowDepth` | FillRect `$A8A5` with the pattern's 1-bit form, black on white, colours restored after | CDEF 5 `0xefc..0xf30` |
| PAT3 | colour port | the port's fill pixel pattern field is cleared for the call and restored; no pixel effect established | CDEF 5 `0xed4..0xefa`, `0xf38..0xf42` |

### 5.6 Procedural bar rects (CDEF 5 `0x64e..0x7d8`)

Lines are inclusive pixel runs (QuickDraw's 1 × 1 pen hangs below and to the
right of each point: Apple). FrameRect `(R.top + 1, R.left + 1, R.bottom − 1, R.right − 1)`.
`I_f = (R.top + 2, R.left + 2, R.bottom − 2, R.right − 2)`, 10 rows tall.

### 5.7 Worked examples

All bars are active, `R` = (0, 0, 14, 100) unless stated, min 0.

**A. 1138, determinate, max 100, value 50.** `cinf −10080` = (2, 2, 0, 0):
`c = 2`, `s = 2`, `tile = 0`. Frame `cicn −10080` is 5 × 14: TL `[0,2)×[0,2)`
← `[0,2)×[0,2)`; TR `[98,100)×[0,2)` ← `[3,5)×[0,2)`; top band `[2,98)×[0,2)`
from source column 2, rows 0–1, as lines (BLIT3); BL `[0,2)×[12,14)`; BR
`[98,100)×[12,14)`; bottom band `[2,98)×[12,14)` from column 2, rows 12–13;
left band `[0,2)×[2,12)` from row 2, columns 0–1, as vertical lines (BLIT4);
right band `[98,100)×[2,12)` from row 2, columns 3–4. `I = (2, 2, 12, 98)`,
`w = 96`, `x = 2 + trunc(96 · 50 / 100) = 50`. Fill `cicn −10079` (7 × 10,
`cinf` (3, 3, 0, 0)) in `[2, 50)`: rows `[2, 12)`, `L = 48 > 6`: caps `[2,5)` ←
`[0,3)`, `[47,50)` ← `[4,7)`, middle source column 3 as lines over `[5, 47)`.
Track `cicn −10078` (7 × 10, (3, 3, 0, 0)) in `[50, 98)`: caps `[50,53)` ← `[0,3)`,
`[95,98)` ← `[4,7)`, middle column 3 over `[53, 95)`.

**B. 1984, determinate, `R` = (0, 0, 14, 40), max 10, value 3.** `I = (2, 2, 12, 38)`,
`w = 36`, `x = 2 + trunc(108 / 10) = 12` (rounding would give 13). Fill
`cicn −10079` (18 × 10, `a = 8`) in `[2, 12)`: `L = 10 ≤ 16`, halves: `[2, 7)` ←
`[0, 5)` and `[7, 12)` ← `[13, 18)`. Track `cicn −10078` (18 × 10, `a = 9`,
byte 2 = 0) in `[12, 38)`: `L = 26 > 18`, caps `[12, 21)` ← `[0, 9)`,
`[29, 38)` ← `[9, 18)`, middle source column 9 as lines over `[21, 29)`.

**C. Indeterminate.** 1138 ships `ppat −10080..−10077` (probe −10079 found:
frame mode). Phase 2 fills `I` with `ppat −10078` at phase point (2, 2); phase
4 finds no `ppat −10076`, so phase becomes 0 and `ppat −10080` is used.
crayon-os ships `ppat −10080` but not −10079 (shift mode): phase 3 fills
`I = (2, 2, 12, 98)` with the 64 × 16 `ppat −10080` at phase point (14, 2), so
port pixel (X, Y) shows pattern pixel `((X − 14) mod 64, (Y − 2) mod 16)`.
1990 ships no progress `ppat`: only the frame is drawn and `I` keeps its prior
pixels (IND6).

**D. Inactive without `cinf −10077`.** apple-lisa, hilite 255: GATE1a, so the
bar is drawn exactly as the active one (frame −10080, fill −10079, track
−10078, shift-mode `ppat −10080`).

**E. Procedural bar, platinum-8, determinate, max 100, value 25.** No
`cinf −10080` (GATE2). `cicn −10224` (12 × 14, 8-bit): pixel (11, 11) is
white, (0, 0) is grey `(0x8888, 0x8888, 0x8888)` (CDEF 5 colour, not an address),
(1, 1) is black. White lines on
row 13 over columns 1–99 and column 99 over rows 1–13; grey lines on column 0
over rows 0–12 and row 0 over columns 0–98; black FrameRect (1, 1, 13, 99);
`I_f = (2, 2, 12, 98)`, `x_f = 2 + trunc(96 · 25 / 100) = 26`: dark grey
`[2, 26)`, lavender `[26, 98)`. Pixels (0, 13) and (99, 0) keep their prior
content.

## 6. Not decoded / unknown; corpus impact

Implementers stop at these and file a spec question.

1. **PACH 130.** Kaleidoscope's PACH 130 patches PaintRect and recognises
   9/10/11-pixel-high rects with grey or blue-tinted foregrounds
   ([progress-caller-boundary](../progress-caller-boundary.md)). The
   procedural bar's FB7 PaintRects are 10 rows high in exactly such colours,
   so natively PACH 130 may repaint them with themed art. That patch is
   outside this unit; this spec gives CDEF 5's own calls only. Native output
   for the eight procedural-bar archives is therefore not established.
2. **FB9's rect.** With no `ppat −10064`, the procedural indeterminate bar
   paints lavender into a rect the routine never sets. Undefined.
3. **`$AA73` identity.** `$AA73` is the Control Manager dispatch trap; it is
   not in Universal Interfaces 3.0.1 `Traps.h`. Selector 6 is IsControlVisible
   in Apple's later Controls.h (not pinned), corroborated by placement (it gates
   every draw) and by the scroll bar's selector 5, IsControlActive. No
   Appearance-presence check precedes it.
4. **What the Control Manager does** around message 0 (erasing, clipping to
   `R`) is not in this binary. CDEF 5 sets no clip to `R` on a colour port, so
   DET3 overflow (`value > max`) or art taller than `R` can draw outside `R`.
   Declared engine policy: the output buffer is `R`; pixels outside it are
   clipped and the clip is traced.
5. **Several devices.** Each device pass repaints all of `R`; how QuickDraw
   limits each pass to its device is not established. The declared default is
   one pass.
6. **Degenerate slices.** A cap `a` larger than half the art (SLICE4 reads
   outside or across the art), `2c` larger than the frame art, a frame cicn
   whose band column `c` lies outside it, or byte 2 ≠ 0 with an empty middle.
   No corpus case.
7. **Short or exotic payloads.** CINF3, COL1c, DATA4. No corpus case.
8. **The tiler's text font.** Around the one-column line loop (BLIT3, not
   BLIT4) the port's text font is set to −12345 and restored
   (CDEF 5 `0x15f8..0x1600`, CDEF 5 `0x164c..0x1650`). No drawing effect is established.
9. **Message semantics** beyond §1.2 (32-bit control values, the part code of
   the data-access record) are Apple's.
10. **Native confirmation.** No capture of a Kaleidoscope progress bar has been
    compared against this spec.

### Corpus impact (own forks)

The census behind this table is verifier-only (private store); implementers do
not open it. Every value they need is in the table. Every frame cicn is 14
rows tall, every cicn in −10080..−10064 and −10224 has bounds at (0, 0), and
every progress `cinf` is 18 bytes.

| rows | archives |
|---|---|
| GATE4 Kaleidoscope art (`cinf` and `cicn −10080`) | 1138, 1984, 1990, apple-lisa, crayon-os, dolphin-som, evolution, floppies, windows-31, windows-95 (10) |
| GATE2 procedural bar (no `cinf −10080`) | animals, apple-platinum-2, beos-r503, black-platinum, monkey-paradise, platinum-8, slimes, system7-nostalgia-silver (8); all ship `cicn −10224` |
| GATE1a inactive draws as active | apple-lisa (no `cinf −10077`) |
| GATE3 | none (every archive with `cinf F` ships `cicn F`) |
| frame `cinf` (`k`, `s`, byte 2) | all GATE4 archives `k = 2`, so INSET2 everywhere (INSET1 unexercised); `s = 2` except windows-95 inactive `s = 1`; byte 2 = 1 for 1990, crayon-os, dolphin-som, evolution, floppies, else 0 |
| fill/track art | 1138 7 × 10; 1984 18 × 10; 1990 / dolphin-som / evolution fill 14 × 10, track 15 × 10 (inactive 7 and 10 wide); apple-lisa 6 × 10; crayon-os 66 × 10; floppies fill 31 × 14, track 38 × 12; windows-31 fill 5 × 14, track 3 × 14; windows-95 fill 10 × 14, track 3 × 14 |
| SLICE7 reverse tiles (byte 3 ≠ 0) | 1990, dolphin-som, evolution (fill 4, track 2, inactive track 2); apple-lisa track |
| art taller than `I` (§5.4) | floppies, windows-31, windows-95 (14-row art in a 10- or 12-row `I`) |
| IND frame mode (frames present) | 1138, floppies, windows-31, windows-95: 4 active, 4 inactive; 1984: 8 and 8 |
| IND shift mode | crayon-os (`ppat −10080` 64 × 16, inactive −10072); apple-lisa (`ppat −10080` 8 × 8) |
| IND6 no pattern | 1990, dolphin-som, evolution |
| FB8 `ppat −10064` | all procedural archives except monkey-paradise (FB9) |
| `cicn −10224` samples (11,11) / (0,0) / (1,1), CDEF 5 colour values | apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver: white / `0x8888` grey / black; animals, monkey-paradise: `0xDDDD` / `0x7777` / `0xAAAA` greys; beos-r503: `0xF333` / `0xA8F6` / `0x51EC` greys |
| shipped but never requested by CDEF 5 | `cicn −10223` (8 archives); `cicn −10080..−10071` and `ppat −10080..−10071` in apple-platinum-2, black-platinum, system7-nostalgia-silver; `cicn` and `ppat −10078` in platinum-8 (no `cinf`, so GATE2) |

## 7. Test hooks

For a separate test author. Selection rows can use the sentinel-substitution
method of `range-rules.mjs`; geometry rows need the engine trace (rects and
source rects per draw step). Rows go in
`tests/rendering-options/progress-rules.mjs` (new), derived from this spec,
never importing `src/`. Each mutation below is one the stated assertion
actually separates; a row no mutation can fail is a finding.

| rows | assertion | mutations that must fail |
|---|---|---|
| RECT1 | `R` = (0, 0, 20, 100) is drawn as (0, 0, 14, 100): nothing at rows ≥ 14, `I` rows `[2, 12)` | using the caller's height (`I` would be rows `[2, 18)`) |
| GATE1, GATE1a | 1984 inactive draws frame −10077, fill −10076, track −10075; apple-lisa inactive draws −10080/−10079/−10078 | per-part inactive→active fallback (the current runtime's): a synthetic fork with `cinf`/`cicn −10077` but no `cicn −10076` must draw **no** fill, not −10079 |
| GATE2, GATE3 | the eight procedural archives never request a frame cicn; a synthetic fork with `cicn −10080` but no `cinf −10080` draws the procedural bar | gating on the frame cicn (that fork would draw the frame) |
| GATE4 | a synthetic fork with `cinf`/`cicn −10080` and no fill/track/pattern draws the frame and nothing else (no procedural bar) | falling back to the procedural bar when the fill is missing |
| INSET1, INSET2 | synthetic `cinf −10080` = (3, 2, 0, 0) → `I.left = 3`; (1, 2, 0, 0) → `I.left = 2` (the corpus has `k = 2` only, which cannot tell the rows apart) | inset by `k` always (k = 1 gives 1); inset by 2 always (k = 3 gives 2); inset by `s` horizontally (both cases give 2) |
| DET1, §5.3 | example B split `x = 12` | rounding (gives 13; example A cannot tell); a normalized-then-rounded split |
| DET2, DET3 | `min = max = 5`, value 5 → `x = I.left`; value −10 of 0..100 in example A geometry → track rect starts at `2 + trunc(96 · −10 / 100) = −7` | clamping value to `[min, max]` (track would start at 2); range 0 treated as "full" |
| SLICE1 | a synthetic fork with fill cicn but no fill `cinf` draws no fill | dropping the `cinf` requirement |
| SLICE3–SLICE6 | example B fill halves `[2,7)` ← `[0,5)`, `[7,12)` ← `[13,18)` and track middle column 9; example A middle column 3 | halves omitted (caps of 8 overlap); stretching the middle; a cap clamp at 4 (the current runtime's) |
| SLICE7 | 1990 fill (byte 3 = 4) at `L` not a multiple of the middle length: tiles placed from the end | tiling from the start when byte 3 ≠ 0 (1138's byte 3 = 0 cannot catch it) |
| SLICE2 | windows-31 fill (14 rows) in `I` rows `[2, 12)` covers rows `[0, 14)` | stretching the art to `I`'s height (the current runtime's); clipping it to `I` |
| FRAME3–FRAME6 | example A frame piece rects and band sources | 9-slice stretching of the bands; using the whole middle when `tile = 0` |
| IND2, IND3 | 1138 phase 4 → `ppat −10080` and phase written back to 0; phase 9 → `ppat −10080` | modulo the frame count without writing back; treating phase 8–255 as valid frames |
| IND5 | crayon-os phase 3 → phase point (14, 2); apple-lisa phase 1 → (6, 2) | shifting by `phase` instead of `4·phase`; resetting phase in shift mode |
| IND1 | probe id is `F_p + 1`: a synthetic fork with `ppat −10080` and −10078 but no −10079 is in shift mode | probing `F_p` or `F_p + phase` |
| IND6, ERASE2, ERASE3 | 1990 indeterminate: every pixel of `I` is transparent; mask-clear frame pixels (1990 frame −10080 has 48) are transparent | painting `I` with a colour; erasing `R` first; unmasked frame copy |
| ERASE4 | example C crayon-os: every pixel of `I` is opaque | masking the pattern |
| FB1–FB6 | example E: pixel colours on the four bevel lines, the black FrameRect ring, and (0, 13), (99, 0) transparent | a bevel over the whole outer ring (would draw (0, 13) and (99, 0)); sampling (0, 0) for the bottom/right lines (grey instead of white on row 13) |
| FB7, COL3 | example E (CDEF 5 colours) split at 26, dark grey `(0x4445, 0x4444, 0x4444)` and lavender `(0xCCCC, 0xCCCC, 0xFFFF)` before display conversion | the current runtime's lavender cicn model (−10223 fill / −10224 track) |
| FB9 | monkey-paradise indeterminate: `I_f` drawn nothing, trace marks the step unspecified | painting `I_f` lavender (an invented rect) |
| FB10 | platinum-8 inactive equals platinum-8 active, pixel for pixel | any state-dependent fallback |
| IDLE2, IDLE3 | driver level, indeterminate, idle time `t`: an idle at tick `t + 2` does not advance the phase, one at `t + 3` does and sets the idle time to `t + 3`; a determinate bar's idle redraws and leaves the phase alone | `>` instead of `≥` (no advance at `t + 3`); advancing a determinate bar; not redrawing on a non-advancing idle |
| HIT1, HIT2 | every point → part 0; regions equal `R` (14 rows) | returning a fill/track part; region from the caller's height |
| DATA1–DATA3 | `'inde'` set/get round-trips one byte; another tag returns −30581 | accepting any tag |
| COL1 | a synthetic track cicn drawn by BLIT3 with colour values (0, 2, 2) and middle pixel value 2: the line takes entry 2 | first-match lookup (gives entry 1); a duplicate at its own index (values (0, 1, 1), pixel 1) cannot tell them apart |
| CHAIN3 | the procedural archives use their own `cicn −10224` | reading the control-panel file's art |

## 8. Runtime divergences (`src/controls.ts` `composeProgress`)

Each item is a decode finding about the current runtime; none has been fixed.

| current behaviour | decode | verdict |
|---|---|---|
| "lavender 2-part" model: schemes that ship `cicn −10223` draw it as the fill and `cicn −10224` as the track, 3-sliced with a cap of `min(4, …)` and a stretched middle | CDEF 5 never requests −10223; −10224 is only a colour source (three pixels) for the procedural bar, which is used when `cinf −10080` is missing (GATE2, FB1–FB3) | **wrong** for animals, apple-platinum-2, beos-r503, black-platinum, monkey-paradise, platinum-8, slimes, system7-nostalgia-silver |
| `tools/theme-loader/classifyResources.js` `progress` model (lavender vs role 3-part, by cicn presence and slug) | the path is chosen by `cinf −10080` (and `−10077`) | **replaced**; selection belongs to the engine |
| role 3-part ids: frame −10080 / −10077, fill −10079 / −10076, track −10078 / −10075 | `F`, `F + 1`, `F + 2` | **confirmed** |
| draws when the frame **or** the track cicn exists; no `cinf` needed | needs `cinf F` and `cicn F`; fill and track each need their own `cinf` (GATE2–GATE4, SLICE1) | **replaced** |
| inactive fill/track fall back to the active ids part by part | inactive needs `cinf −10077`; without it the whole bar is active (GATE1a); no per-part fallback | **replaced** |
| `state: 'disabled'` draws as active | hilite 255 draws as inactive | **wrong** |
| returns `null` (caller fallback) with no frame and no track | CDEF 5 always draws: the procedural bar (§4.9) | **missing** |
| output height = the frame (or track) cicn height | `R` is forced to 14 rows (RECT1) | **confirmed** for the corpus (every frame is 14 rows), rule **missing** |
| value normalized, clamped to [0, 1], default 0.5; fill width `round(value · iw)` | integer value/min/max, no clamp, `trunc` (§5.3, DET3) | rounding **replaced**; clamp is modern policy (needs the §2 mapping decision) |
| interior inset `slice.corner` (else a pixel scan of the frame) × `slice.side` | `k` when `k > 2`, else 2, × `s` (§5.2) | **confirmed** for the corpus (`k = 2`); pixel scan **replaced**; the `k ≤ 2 → 2` rule **missing** |
| order: track stretched over the whole interior, then the frame 9-slice, then the fill | frame, then fill `[I.left, x)`, then track `[x, I.right)` only (§3.3, DET1) | **replaced** |
| frame 9-slice, stretched bands unless `slice.tile` | cinf border: `tile = 0` → one column painted as lines, `tile ≠ 0` → middle tiled (FRAME5, FRAME6) | **replaced** for `tile = 0` (1138, 1984, apple-lisa, windows-31, windows-95) |
| track stretched (scaled) into the interior; fill 1:1-scaled when narrow, else cap `min(4, …)` + stretched middle; both scaled to the interior height | `cinf` cap `a`, halves when `L ≤ 2a`, one-column lines or tiles, start or end anchored; art keeps its height, centred (§4.8, §5.4) | **replaced** |
| `copyBits` overwrites with alpha (srcCopy) | CopyMask: mask-clear pixels leave what is under them (BLIT1, BLIT5) | **replaced** |
| transparent output where nothing is drawn | no erase; uncovered pixels keep the host's pixels (ERASE1–ERASE3) | **confirmed** as the engine representation |
| no indeterminate mode, no idle, no phase | `'inde'` flag, frame or shift mode, phase advance every 3 ticks (§4.7, §4.10) | **missing** |
| length at least 16, default 160 | any width (`R.right − R.left`) | modern policy |

## 9. Routine coverage (CDEF 5, 56 in-scope ranges)

Decoded in this file (behaviour or reachability): CDEF 5 `0xc` (entry glue),
CDEF 5 `0x28`, `0xae` (relocation glue), `0x104` (globals) and `0x116` (switch glue): no behavioural effect.
CDEF 5 `0x13c` (main), `0x30e` (draw entry), `0x7f4` (device loop), `0x9c2`, `0xa04`, `0xa26`, `0xa3c` (Colour QuickDraw, Window Manager port, colour-port and screen tests),
CDEF 5 `0x5d2` (device pass and procedural bar), `0x35a` (Kaleidoscope art), `0xaa2`, `0xad0`, `0xb02`, `0xbbe`, `0xcfc`, `0xd22`, `0x3000` (port state save and restore),
CDEF 5 `0xc6a` (port normalise), `0xd60`, `0xe36` (`lowDepth`), `0xe04` (black and white), `0xd96`, `0xde8` (icon prepare and release),
CDEF 5 `0xf56`, `0xea6` (pattern fill), `0x104a`, `0x108a`, `0x10c4`, `0x129c`, `0x1d08` (pixel colour), `0x1516`, `0x154a` (tiler), `0x18f6`, `0x194c` (rect blit),
CDEF 5 `0x1d7e` (fill and track slicing), `0x1f72`, `0x1fd2` (frame), `0x1aa8`, `0x1a4c`, `0x1cea` (cicn get and release), `0x2e84`, `0x2ff2` (`cinf` get, handle size).
Reached but inert in CDEF 5: `0x1a4c` and the switch in `0x1aa8` (an icon cache whose table pointer is never set),
CDEF 5 `0x3288`, `0x3340`, `0x3358`, `0x302c`, `0x3262` (cache paths behind two flags that are never set),
CDEF 5 `0x275a`, `0x2bf2`, `0xe68` (the frame's region form, which the progress bar never requests),
CDEF 5 `0x1462`, `0x1a6e` (the frame body, never enabled), and the extended `cinf` path inside CDEF 5 `0x2e84` (every caller passes false).
