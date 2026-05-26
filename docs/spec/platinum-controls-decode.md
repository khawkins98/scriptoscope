# Mac OS 8.5/8.6 Platinum controls — `CDEF` + `AppearanceLib` decode

*Clean-room decode of the Platinum standard controls. Geometry from the 68k
`CDEF`s; drawing model from the PowerPC `AppearanceLib` `DrawTheme*` suite.
Mirrors the kDEF/WDEF playbook: cite `0xADDR`/offset, describe the algorithm,
**never** dump Apple's listing. Feeds the Phase-B control generator. Companion:
[`platinum-wdef125-decode.md`](./platinum-wdef125-decode.md),
[`platinum-controls-faithfulness-ledger.md`](./platinum-controls-faithfulness-ledger.md).*

```
# bins (NOT committed — Apple system code; git-ignored in .scratch/iso-recon):
#   code-out/CDEF-n63.bin   (5426B, 68k)   — track family (decoded here)
#   code-out/CDEF-n1.bin    (3172B, 68k)   — button family (TODO, not yet decoded)
#   85-System.bin           (PowerPC PEF host of AppearanceLib + ControlsLib)
# disassemble the CDEF:  m68k-elf-objdump -D -b binary -m m68k:68030 CDEF-n63.bin > CDEF-n63.asm
# PPC PEF:  capstone (CS_ARCH_PPC | CS_MODE_32 | CS_MODE_BIG_ENDIAN); see the spike section.
```

## Headline

Two findings reshaped this decode:

1. **The control CDEFs are track procs; there is no rich per-scheme button CDEF.**
   `CDEF -63` **and** `CDEF -1` are *both* value/min/max **track-with-thumb**
   procs (scroll-bar / slider / indicator) — neither dispatches on control kind,
   and the genuine **button / checkbox / radio / popup / tab** CDEF is **not in
   the extracted corpus**. Consistent with the AppearanceLib finding: buttons go
   Control Manager → `DrawThemeButton` → AppearanceLib (a vtable dispatcher), so
   button geometry is **standard Appearance metrics** (and the sizes the renderer
   already fixes), not a decodable proc — sourced that way under the FALLBACK.
2. **The pixels are drawn by `AppearanceLib` (PowerPC), and even `DrawThemeButton`
   is a thin dispatcher**, not the drawer — it validates args and dispatches
   through the *current theme object's vtable* (method at offset `0xCC`). Apple
   itself separates theme **data** from a generic **drawer**. This validates the
   chosen fallback (extracted color data + a generic bevel model) as faithful in
   *architecture*, not merely appearance.

## Decode scope & spike-gate decision

**Gate verdict: FALLBACK (calibrated).** The `AppearanceLib` decode was proven
feasible end-to-end (see the spike section) but its cost is open-ended (compressed
pattern-data → TVector → 256 KB PPC reverse-engineering, *per* control kind, plus
the drawer is one more vtable indirection deep). The data + bevel-model path is
faithful and far cheaper. Phase-B therefore builds from: **CDEF geometry**
(`-63` here + `-1` to decode) **+ the extracted color data**
(`themes/apple-platinum-replica/sources/platinum-palette.json`) **+ the
already-implemented `WDEF 125` raised-bevel model**. The `AppearanceLib` PPC decode
is documented below as an *optional surgical* fidelity-tightening step.

---

## Routine map (`CDEF -63`, track family)

All `0xADDR` are file offsets into `CDEF-n63.bin`. Entry points are `linkw %fp,#…`.

| addr | role |
|---|---|
| `0x0e`/`0x14` | **CDEF entry** — unpack args, snapshot port (`0x1224`/`0x128e`), dispatch on message, restore (`0x1262`/`0x12f2`), return in `%d6`→`fp@(20)`. |
| `0x1e2` | **initCntl** (msg 3) — alloc the **58-byte** private struct (`moveq #58; 0xa322` @ `0x1f4`) into `contrlData` (`a3@(28)`); copy value/min/max; call thumb-calc `0xa6c`. |
| `0x386` | **drawCntl** (msg 0) — build offscreen GWorld (`0xeba`), recompute thumb (`0xa6c`), erase/frame track, draw groove, optional label `0xd76`, blit + teardown. |
| `0x6e8` | **testCntl** (msg 1) — `PtInRect`(thumb) (`0xa8ad` @ `0x71a`), gated by active state. |
| `0x746` | **dispCntl** (msg 4) — dispose struct, clear `contrlData`. |
| `0x78c` | **calcCRgns/calcCntlRgn/calcThumbRgn** (msgs 2/10/11) — recompute, `SetRectRgn` (`0xa8df` @ `0x7b6`) into the caller's region. |
| `0x7c0` | **autoTrack** (msg 8) — live-drag; maps mouse→value, writes `contrlValue`. |
| `0xa6c` | **thumb/track geometry** (core calculator). |
| `0xc5c` | thumb-glyph draw (size clamped 4..6). |
| `0xd76` | label/title text (local QD; trunc selector `0x8208FFE0`). |
| `0xeba` | offscreen color-port setup (`OpenCPort` `0xaa00` @ `0xef0`). |
| `0xf5a` | color-pair fetch (RGB by index, `0xaa64`; `RGBForeColor/Back` `0xaa14/15`). |
| `0x1030` | **part-draw DELEGATION** — validate chained proc handle, `jsr %a0@` @ `0x10b0` with (partCode, rect, bounds). |
| `0x10da`–`0x11fa` | rect helpers (channel / track-minus-arrows / arrow box / inset frame). |
| `0x1224`–`0x1336` | port save/restore + hilite-lowmem poke (`0xba6`/`0xba8`/`0x988`/`0x984`). |
| `0x14f4` | `'PAT#'` resource fetch (`GetResource` `0xa9a0`, type `0x50415423`). |

## Message dispatch (`CDEF -63`)

Range check + jump table; **table base `0xf8`**, jmp base `0xf6`:
`0xe0 movew %d5,%d0` (msg) · `bmiw 0x17c` · `cmpiw #11` · `bgtw 0x17c` ·
`addw %d0,%d0` · `movew %pc@(0xf8,%d0:w),%d0` · `jmp %pc@(0xf6,%d0:w)`.

| idx | target | message | reached |
|---|---|---|---|
| 0 | `0x110` | drawCntl | `jsr 0x386` |
| 1 | `0x132` | testCntl | `jsr 0x6e8` |
| 2,10,11 | `0x142` | calcCRgns/calcCntlRgn/calcThumbRgn | `jsr 0x78c` (part by `param`) |
| 3 | `0x156` | initCntl | `jsr 0x1e2` |
| 4 | `0x164` | dispCntl | `jsr 0x746` |
| 5,6,7,9 | `0x17c` | posCntl/thumbCntl/dragCntl/unused | → common exit (system default) |
| 8 | `0x16e` | autoTrack | `jsr 0x7c0` |

posCntl/thumbCntl/dragCntl fall through to the Control-Manager default.

## Per-kind geometry — the track family (`CDEF -63`)

**Private struct** (`contrlData`, `%a4`), 58 bytes; key offsets pinned from init/calc:
`+4` value · `+10..+17` **thumb rect** · `+26/+28` track-extent clamp pair
(`+28 = contrlRect.bottom−top`, the control height @ `0x2e8`) · `+34` max · `+42`
range cache · `+48` **orientation/direction** (−1 ⇒ grow from far end) · `+50/+52`
system thumb-metric snapshots (global `0xbac` @ `0xa90`) · `+54` **arrow/cap
thickness** (used as `+3` in the arrow-box helper `0x11b6`).

**Thumb/track (`0xa6c`):** usable length `%d7 = (end−start) − (+50 + +52 + +56) − 3`
(`0xb20`–`0xb36`); degenerate range ⇒ fixed-length thumb centered; proportional case
maps `value` across `(+16 − +12)` via half-span midpoint math (`0xbfa`–`0xc16`);
direction flips on `+48 == −1` (`0xc1c`); thumb clamped to `[+26, +28]`
(`0xbd8`/`0xbe2`). **Thumb glyph (`0xc5c`):** size `= (+54 >> 2)`, parity-adjusted,
clamped **4..6** (`0xcb6`/`0xcc2`), centered, cross-stroked.

**Hit test (`0x6e8`):** `PtInRect(pt, thumbRect)` only when active (`contrlHilite
!= 255`) and bounds-region non-empty. **States:** branch only on `contrlHilite`
(`a3@(17)`): `255` = inactive/dimmed (`0x3bc`), `1` = pressed part (`0x51a`).
**Part codes:** `129` indicator/thumb, `26`/`27` decrement/increment ends, `49`
sub-glyph. **Delegation:** the actual part pixels come from a runtime-installed proc
handle in `contrlData` (`jsr %a0@` @ `0x10b0`, frame pass selector 5 + fill pass
selector 4) and Appearance metric trap `0xa8b5` (selectors `0x84020008`,
`0x8404000C`, `0x82020006`, `0x8208FFE0`).

> `CDEF -1` (button/checkbox/radio/popup/tab geometry) is **not yet decoded** —
> same playbook, Phase-B prerequisite.

## AppearanceLib drawing model (spike: `DrawThemeButton`)

Located by parsing every PEF (`Joy!peff`/`pwpc`) container in `85-System.bin`:
- **ControlsLib** @ container `1903232` exports the Control Manager and **imports**
  `DrawThemeButton` — i.e. the CDEFs call into AppearanceLib (confirms delegation).
- **AppearanceLib** @ container `2428848`: code section 261812 B *uncompressed*
  (fileOff `2443792`); pattern-data section *compressed* (39053→50092); exports 32
  `DrawTheme*` here (the full ~57 split across adjacent containers).
- `DrawThemeButton` export = a **TVector** at data offset `3276`. Reaching code
  required a PEF **pattern-data decompressor** (5 opcodes: zero / block / repeat /
  interleave×2) → TVector `codeAddr = 0x2ee4`.

**Decoded behavior (`DrawThemeButton` @ code `0x2ee4`, PPC32 BE):** signature
`DrawThemeButton(rect, kind, drawInfo, prevInfo, eraseProc, labelProc, userData)`
(args r3..r9 → r23..r29); validates `rect`/`drawInfo` (null → `-50` paramErr);
reads `drawInfo` state halfword at `+6` (`andi. &5`); fetches the current theme
object via imported glue; then `lwz r12,0(r3); lwz r12,0xCC(r12); bl …` — **dispatches
to the theme object's vtable method at offset `0xCC`**. So `DrawThemeButton` is a
validating *dispatcher*; the concrete Platinum button drawer is that vtable method
(one indirection deeper, not decoded — the gate declined the open-ended chase).

## Accent application model

Not fully pinned (lives in the un-decoded vtable drawer + `CDEF -1`). What is known:
controls read color from a control color table and a theme accent. The extracted
`cctb` id=0 carries the neutral control grays **plus** the genuine highlight pair —
lavender `[204,204,255]` (slot 13) and indigo `[51,51,102]` (slot 14) — i.e. the
Platinum selection/default tint is real data, corroborating the previously-observed
`apple-platinum-2` indigo ring. The 20 named accents are user-selectable; how each
control consumes the accent (progress fill, slider, default ring) is a Phase-B
calibration item, to be confirmed against reference renders.

## Color data (accents + grays)

Authoritative artifact: **`themes/apple-platinum-replica/sources/platinum-palette.json`**
(extracted + verified, do not duplicate values here).
- `accents`: 21 named system cluts (Azul, Bondi, Copper, Crimson, Emerald, French
  Blue, Gold, Ivy, Lavender, Pistachio, Magenta, Nutmeg, Poppy, Plum, Rose,
  Sapphire, Silver, Teal, Turquoise, Sunny, Black & White). Spot-checked by name.
- `controlColors` (`cctb` id=0): 15 slots — 13 neutral grays (R=G=B) + slots 13/14
  the lavender/indigo highlight pair.
- `windowColors` (`wctb` id=0): 13 slots. `systemPalette` (`clut` id=9): 256 colours.

## Constants (the Phase-B inputs)

| constant | value | source |
|---|---|---|
| track private-struct size | 58 bytes | `CDEF -63` `0x1f4` |
| control height field | `contrlRect.bottom−top` → struct `+28` | `0x2e8` |
| thumb length reserve | `+50 + +52 + +56`, then `−3` | `0xb20`–`0xb36` |
| thumb glyph size | `(+54 >> 2)`, parity-adj, clamp **4..6** | `0xcb6`/`0xcc2` |
| arrow/cap box length | `+54 + 3` | `0x11b6` |
| inset-frame | `+3,+3` / `+1,+1` | `0x11fa` |
| draw passes | frame (sel 5) then fill (sel 4) via delegated proc | `0x1030` |
| `DrawThemeButton` sig | `(rect,kind,drawInfo,prevInfo,eraseProc,labelProc,userData)` | AppearanceLib `0x2ee4` |
| theme vtable draw slot | offset `0xCC` | AppearanceLib `0x2fb8` region |
| control grays + highlight | 15 `cctb` slots (13 neutral + lavender/indigo) | `platinum-palette.json` |
| accents | 21 named cluts | `platinum-palette.json` |

## Confirmed (instruction/data-backed) vs could-NOT-pin

**Confirmed:** the `CDEF -63` dispatch table + routine map; its track/thumb geometry
+ private-struct layout; the delegation mechanism; the `AppearanceLib` location +
`DrawThemeButton` signature/validation/vtable-dispatch; all color data (instruction-
or clut-backed).

**could-NOT-pin (gates Phase-B):**
1. **Scroll-bar vs slider vs indicator** within `CDEF -63` — geometry is shared; no
   internal variant byte selects between them.
2. Several A-traps not in the project trap table (`0xa322` struct allocator;
   `0xa8b5` Appearance metric selectors; `0xaa64` color-pair getter; the part/pen
   utility traps) — roles inferred from behavior, exact verbs un-named.
3. The runtime-installed chained draw proc (`jsr %a0@`) — supplied by the system, so
   its pixels aren't in `CDEF -63`.
4. The concrete Platinum button drawer — the `DrawThemeButton` vtable method at
   `+0xCC` (one PPC indirection deeper; not decoded by gate decision).
5. **Button-family geometry has no decodable source** — `CDEF -1` decoded to
   another track proc; no button CDEF in the corpus. Button/checkbox/radio sizes
   come from standard Appearance metrics + the renderer's fixed sizes (FALLBACK).
6. Per-control accent application model.

## Phase-B ledger seed

See [`platinum-controls-faithfulness-ledger.md`](./platinum-controls-faithfulness-ledger.md).

## Next plan (per the spike gate → FALLBACK)

**Phase-B has begun** (`scripts/generate-platinum/{control-metrics,draw-control,build-controls,raster}.mjs`):
the data-driven control generator — a control **spec** + a generic bevel **drawer**
(the AppearanceLib data/drawer split made explicit) — generates push button, default
ring (real indigo), and scrollbar track + thumb into the replica bundle, superseding
the graft. Remaining:
1. **Button-family geometry** comes from standard Appearance metrics (no button CDEF
   exists in the corpus; both `-1`/`-63` are track procs) + the bevel model.
2. **Extend the generator** — checkbox/radio/popup/tab/slider/progress × state × accent from
   geometry + `platinum-palette.json` + the `WDEF 125` raised-bevel model; wire into
   the bundle; retire the `apple-platinum-2` control graft; simplify `controls.ts`.
3. **Verify** with `npm run lint:themes` + this ledger + a Playground render; resolve
   the could-NOT-pin items (esp. accent application) against reference renders.
4. *Optional surgical:* decode the `DrawThemeButton` `+0xCC` vtable method only if a
   specific control's bevel can't be matched — the method + container + decompressor
   are all documented (`.scratch/iso-recon/pef-decompress.py`).
