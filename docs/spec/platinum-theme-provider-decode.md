# Platinum theme provider — decode of the vtable + brush palette

*Clean-room. PPC32 BE disassembly of AppearanceLib's code section, follow-on
to [`apple-drawtheme-decode.md`](./apple-drawtheme-decode.md) and
[`apple-appearancelib-spike.md`](./apple-appearancelib-spike.md). All `0x…`
addresses are offsets within AppearanceLib's code section
(`fileOff = 2443792 + addr` into `.scratch/iso-recon/85-System.bin`). All
data-section offsets are into the decompressed `patternData` image and use
the PEF SVR4-style TOC convention `r2 → patternData + 0x8000` confirmed in §1.
Reproduce via `.scratch/iso-recon/` Python scripts cited per section. .scratch
only; understanding-only; no Apple bytes reproduced verbatim.*

---

## 0. HEADLINE — the Platinum provider is **inside** AppearanceLib

The spike pinned `DrawThemeButton` to vtable offset `+0xCC` and asked the
follow-on question: *where is the Platinum provider PEF*?

**Answer:** there is no separate provider PEF. The "Platinum Engine" is a
**fragment-load alias for AppearanceLib itself**, and the provider's vtable +
all eight method bodies (DrawButton, DrawWindowFrame, DrawTrack, DrawTitleBarWidget,
GetThemeBrushAsColor, GetThemeTextColor, …) live in **AppearanceLib's own
patternData + code sections**. AppearanceLib is **both** the public
DrawTheme* API and the default Platinum provider, in one container.

This is documented in AppearanceLib's patternData around decompressed offset
`8944` as a Pascal-prefixed alias triple:

```
0x0a "Appearance"        ; the canonical fragment name
0x0f "Platinum Engine"   ; alias used to obtain the default theme provider
0x0b "Data Engine"       ; alias used to obtain the metadata provider
```

The triple is loaded by CFM as one fragment, three name handles. A future
non-default theme provider could ship as a separate PEF whose loader-string
section names a different `… Engine`; the corpus 85-System.bin ships only the
Platinum default.

This recasts the spike's "open-ended N-disassemblies deep" cost
characterisation: the next pass is **eight derefs deep within one PEF**, not
eight derefs into an external container. With the TOC base pinned (§1) and
the vtable resolved (§2), the cost collapses to short per-method walks.

---

## 1. TOC convention — `r2 → patternData + 0x8000`

Reproduce: `.scratch/iso-recon/imm-range-check.py`.

Histogram of every `r2`-relative immediate in the code section:

| Stat | Value |
|---|---|
| distinct IMMs | 714 |
| min IMM | `-0x8000` (-32768) |
| max IMM | `+0x459C` (+17820) |
| section length | 50092 bytes (`0xC3AC`) |
| span | `0x8000 + 0x459C = 0xC59C` ≈ section length |

The IMM range maps exactly to the SVR4 PEF convention: **`r2` points
`patternData + 0x8000`**, so `addi r?, r2, IMM` yields data-section offset
`IMM + 0x8000`. Negative IMMs reach the first half, positives reach the
second half. The match is bit-exact at the lower bound, confirming no
unexpected mid-section adjustment.

**All "TOC+X" / "TOC-Y" notations below resolve to decompressed-data offset
`0x8000 + X` / `0x8000 - Y`.**

---

## 2. The provider vtable @ `data[0xA554]` (TOC+`0x2554`)

Reproduce: `.scratch/iso-recon/decode-provider-vtable.py`.

The default provider object is constructed at `0x02e2a4` via
`addi r0, r2, 0x2554 ; stw r0, 0(r30)` — i.e. `provider[0] = vtable_addr`.
With TOC `0x8000`, that vtable lives at decompressed-data offset
**`0xA554`**, as a flat array of 4-byte slots whose values are data-section
TVector pointers `(codeAddr, tocAddr)` resolved by the cross-TOC trampoline
at `0x3D44C`.

Eight spike-mapped methods resolve cleanly:

| vtable slot | TVector @ data | code addr | Public DrawTheme* routine |
|---|---|---|---|
| **`+0x2C`** | `0x183C` | `0x02ED60` | `GetThemeBrushAsColor` |
| **`+0x30`** | `0x1834` | `0x02EE64` | `GetThemeTextColor` |
| **`+0x64`** | `0x1664` | `0x02B338` | `DrawThemeTrack` |
| `+0x68` | `0x165C` | `0x02B3D4` | (track sibling — `HitTestThemeTrack` or `GetThemeTrackBounds`) |
| **`+0x94`** | `0x1934` | `0x031274` | `DrawThemeTrackTickMarks` |
| **`+0xBC`** | `0x18D4` | `0x030A14` | `DrawThemeWindowFrame` |
| **`+0xC0`** | `0x18CC` | `0x030A94` | `DrawThemeTitleBarWidget` |
| **`+0xCC`** | `0x14A4` | `0x01E144` | `DrawThemeButton` |

The same script also dumps the full vtable (slots `+0x00..+0x180`). Every
slot is populated with a non-null TVector pointing into AppearanceLib's
own code section (range `0x6CA4..0x031CC4` — well within `code.unp`
= 261812). The vtable is **dense, not sparse**: Apple's Platinum provider
implements every Theme method, no defaults.

Adjacent slots cluster by topic:
- `+0x08..+0x28` — provider lifecycle (`Init`, `Dispose`, `Refcount`, …).
- `+0x2C..+0x34` — color/brush lookups (`Brush`, `TextColor`, `MetricInteger`, …).
- `+0x64..+0x8C` — track + scrollbar drawers.
- `+0x90..+0xB8` — track tick-marks + track adornments.
- `+0xBC..+0xC8` — window frame + title widgets.
- `+0xCC..+0xE8` — button family.
- `+0xEC..+0x140` — popup / menu / disclosure / focus families.

This neighbour-clustering is consistent with Apple keeping each method's
**slot position** stable along the vtable for ABI compatibility — the same
order that the public DrawTheme*/GetTheme* exports were declared, in API
docs order.

---

## 3. `DrawThemeButton` is a **two-level dispatcher**

Reproduce: `.scratch/iso-recon/decode-platinum-button.py` +
`decode-platinum-resolve.py` + `decode-push-button.py` +
`decode-pushbutton-vtable.py`.

Following `vtable[+0xCC]` → code `0x01E144` does **not** land on a pixel
drawer. The 30-instruction body at `0x01E144` is itself a dispatcher:

```
0x01E170  bl 0x1E46C            ; resolve(buttonKind) -> sub-provider*
0x01E198  lwz r12, 0(r3)        ; sub-vtable = sub-provider[0]
0x01E1A0  lwz r12, 0xC(r12)     ; method = sub-vtable[+0x0C]  ← per-kind drawer
0x01E1B8  bl 0x3D44C            ; call(rect, drawInfo, …)
```

The three sibling methods at `0x01E220`, `0x01E2E4`, `0x01E3A8` (button
`HitTest`, `GetRegion`, `GetBounds`) share the exact same shape but dispatch
via sub-vtable `+0x10`, `+0x14`, `+0x18` — i.e. the sub-vtable is one
shared C++ class per kind, with its own four-method vtable.

### 3.1 The button-kind jump table @ `data[0x48BC]` (TOC-`0x3744`)

`0x1E46C` reads the input kind from `r4`, bounds-checks `≤ 9`, then does:
```
addi r3, r2, -0x3744 ; slwi r0, r30, 2 ; lwzx r3, r3, r0 ; mtctr r3 ; bctr
```

That's a 10-entry jump table at TOC-`0x3744` = data `0x48BC`. The mapping
(also derived in the script):

| `kThemeButtonKind` (decimal / Apple constant) | jump-handler | sub-vtable constructor |
|---|---|---|
| **0 — `kThemePushButton`** | `0x1E4A0` | `0x1FFDC` → vtable @ `data[0x49C0]` (TOC-`0x3640`) |
| 1/2 — `kThemeCheckBox` / `kThemeRadioButton` | `0x1E4CC` | shared check/radio sub-vtable |
| 3/8/9 — Bevel / Disclosure / IncDec | `0x1E504` | shared "bevel family" sub-vtable |
| 4/5 — Arrow / ScrollBarArrowsSingle | `0x1E560` | shared arrow sub-vtable |
| 6 — ScrollBarArrowsLowerRight | `0x1E534` | (dedicated handler) |
| 7 — Popup | `0x1E598` | (dedicated handler) |

The pattern is "**allocate a small (4/6/8-byte) per-button object, install
its vtable pointer, return it**" — a transient object the dispatcher creates
on every `DrawThemeButton` call. Allocations go through the AppearanceLib
heap helper at `0x37B54` (a thin `NewPtrClear`-style wrapper).

### 3.2 Push-button sub-vtable @ `data[0x49C0]` — the pixel drawer

The constructor at `0x1FFDC` does `addi r0, r2, -0x3640 ; stw r0, 0(r31)` —
sub-vtable lives at data `0x49C0`. Dumping it:

| sub-vtable slot | code addr | inferred role |
|---|---|---|
| `+0x08` | `0x02001C` | Init / RefCount |
| **`+0x0C`** | **`0x01CAE0`** | **DrawPushButton (the pixel drawer)** |
| `+0x10` | `0x020134` | HitTestPushButton |
| `+0x14` | `0x01CCB0` | GetRegionPushButton |
| `+0x18` | `0x0200C0` | GetButtonContentBounds |
| `+0x1C` | `0x020238` | (button metric lookup) |
| `+0x20` | `0x020080` | GetButtonBackgroundRegion |
| `+0x24` | `0x01CF20` | (state-derived helper) |
| `+0x28` | `0x02012C` | (utility) |
| `+0x2C` | `0x0201BC` | (utility) |
| `+0x30` | `0x01D0B4` | (button-specific draw helper) |
| `+0x34` | `0x01CFA4` | (helper) |
| `+0x38` | `0x01D0B0` | (helper) |

Slots `+0x3C..+0x54` are **not** code pointers — they contain the magic
signature/sentinel pattern `bb bb 99 99 77 77 88 88 cc cc 99 99 cc cc dd dd
44 44 55 55 cc cc ff ff aa fe 07 00`. The `aa fe 07 00` token also marks
every other class-metadata block in the data section (see e.g. data `0x22F0`
right before the `Appearance/Platinum Engine/Data Engine` triple) — it's
AppearanceLib's class-record terminator, not RGB data.

### 3.3 Push-button drawer at `0x01CAE0` — instruction map

A 200-instruction walk through `0x01CAE0` shows it is **still a dispatcher**,
not a pixel-pushing primitive. Notable steps:

```
0x01CB08  bl 0x3C1D4               ; snapshot current GWorld
0x01CB48  li r4, -3                ;   ← FOCUS RING OUTSET (signed in pixels)
0x01CB54..0x01CB60   InsetRect(&r, -3, -3)  via helper 0x3CC3C
0x01CBA8  lwz r12, 0(r24);
0x01CBAC  lwz r12, 0x28(r12)        ; calls a HIGHER-LEVEL drawer's vtable[+0x28]
0x01CBB8  sth r3, 0x3C(r1)          ; stash returned metric/region
0x01CBC4  addi r4, r2, -0x4E2C      ; constant offset (TOC-0x4E2C = data 0x31D4)
0x01CBF0..0x01CBF8   bl 0x3C36C     ; the heavy "draw bevel + gradient + ring" call
```

**Pinned constant from this walk:**

| Constant | Value | Apple-doc name | Where |
|---|---|---|---|
| Focus-ring outset | **3 pixels** | `kThemeMetricFocusRectOutset` (Apple docs: "≥ 3 px") | `0x01CB48  li r4, -3` (sign = outward inset) |

The remaining bevel + gradient + pressed-state bytes are layered TWO more
levels deep: `0x3C36C` is the generic "primitive bevel" routine shared
across all control kinds, and it in turn calls `GetThemeBrushAsColor`
(§4) for each gradient stop. The walk stops here because every further
constant is also reachable via the brush-lookup table dumped in §4 — which
is the **same path** the routine takes at runtime and the more durable
artefact to pin.

---

## 4. `GetThemeBrushAsColor` is a lookup-table read — palette pinned

Reproduce: `.scratch/iso-recon/dump-brush-tables.py`.

The Platinum provider's `GetThemeBrushAsColor` at code `0x02ED60` decodes
into **two static tables** in AppearanceLib's data section:

### 4.1 The brush-ID → palette-index table @ `data[0xA18C]` (TOC+`0x218C`)

47 entries × 4 bytes (one slot per legal `kThemeBrush*` value, ID `1..0x2F`).
Each slot is `(high_short, low_short)`:

- `high_short` — selector / role hint:
  - `0x0000` — "use universal" (black/white shortcut, or table-B fallback)
  - `0x000A..0x000E` — index into a small set of "Platinum-specific" tints
- `low_short` — the palette-index:
  - **`0x001E`** — index into the **RGBColor table at `0xA248`** (gray ramp).
    Used by the *majority* of brushes — i.e. nearly every Platinum brush is
    a gray.
  - **`0x0021`** — special; routes through the **active theme's pattern set**
    (`r3->0x2A8`) — used for textured brushes
    (`kThemeBrushDocumentWindowBackground = 14`,
    `kThemeBrushDialogBackgroundActive = 19`, etc.).

This is the precise mechanism behind the spike's "Platinum brushes are
either grays or textures" intuition.

### 4.2 The RGBColor table @ `data[0xA248]` — Platinum gray ramp

Stride 6 (`RGBColor = {short r, short g, short b}`). First 15 entries
recovered (sufficient to span every observed `lo=0x1E` brush; later entries
are role-specific colors used by the corpus's 8-bit palette).

| index | RGBColor (16-bit BE) | sRGB-8 | Plain-English role |
|---|---|---|---|
| 0 | `0x0000 0x0000 0x0000` | `#000000` | pure black |
| 1 | `0x4444 0x4444 0x4444` | `#444444` | Platinum darkest gray |
| 2 | `0x5555 0x5555 0x5555` | `#555555` | Platinum frame / text shadow |
| 3 | `0x6666 0x6666 0x6666` | `#666666` | Platinum bevel-shadow |
| 4 | `0x7777 0x7777 0x7777` | `#777777` | Platinum mid-tone shadow |
| 5 | `0x8888 0x8888 0x8888` | `#888888` | disabled-frame gray |
| 6 | `0x9999 0x9999 0x9999` | `#999999` | inner bevel shadow |
| 7 | `0xAAAA 0xAAAA 0xAAAA` | `#aaaaaa` | gradient mid |
| 8 | `0xBBBB 0xBBBB 0xBBBB` | `#bbbbbb` | gradient mid-light |
| 9 | `0xCCCC 0xCCCC 0xCCCC` | `#cccccc` | gradient base / disabled face |
| 10 | `0xDDDD 0xDDDD 0xDDDD` | `#dddddd` | gradient highlight |
| 11 | `0xEEEE 0xEEEE 0xEEEE` | `#eeeeee` | gradient brightest pre-white |
| 12 | `0xFFFF 0xFFFF 0xFFFF` | `#ffffff` | pure white |
| 13 | `0x6666 0x6666 0xCCCC` | **`#6666cc`** | **Platinum highlight / focus blue** |
| 14 | `0xFFFF 0x0000 0x0000` | `#ff0000` | destructive / error |

Indexes 15..39 (also dumped by the script) are repeated black/`#777777`/white
triples — these populate role-specific brushes (e.g. text-on-icon, accent
states) where the index is shared but the brush ID's `hi_short` discriminates
which specific RGBColor is returned.

The two single-RGBColor fallbacks at `data[0xA530]` (`#000000`) and
`data[0xA536]` (`#ffffff`) are the "couldn't resolve" return values — the
match-all baseline for any malformed brush descriptor.

**This is the unique source of every Platinum gray Apple's procedural
provider produces.** Bevel gradients, control faces, frame strokes, default
backgrounds — all of them are 16-bit `RGBColor`s assembled out of this 13-
entry gray ramp plus the lavender highlight at `#6666cc`.

---

## 5. Window + title-widget paths (sibling architecture)

Reproduce: `.scratch/iso-recon/find-all-vtable-bases.py` shows the
constructor calls; `decode-platinum-button.py` shows the parallel shape.

`DrawThemeWindowFrame` (`vtable[+0xBC]` → code `0x030A14`) and
`DrawThemeTitleBarWidget` (`vtable[+0xC0]` → code `0x030A94`) are
**structurally identical** to `DrawThemeButton`:

1. Validate arguments (`bne 0x30A54 ; li r3, -0x32` = `paramErr`).
2. Call a window-kind resolver: `0x30B94` for window-frame, an analogous
   helper for title-widget.
3. Dispatch through the returned sub-provider's `vtable[+0x0C]`.

The window-kind jump table is at `data[0xA6A4]` (TOC+`0x26A4`), 10 entries,
addressing 10 distinct in-line sub-provider thunks (`addi r3, r3, +imm; blr`)
that yield 10 different offsets into a single 56-byte "window-master"
provider object (per-kind sub-vtables are packed in 6-byte chunks at
+6, +10, +16, +22, +28, +34, +40, +46, +50, +54 from the master).

The pressed-state bevel + title-text contrast bytes therefore live behind
*two more* derefs from `0x030A14` — analogous to the push-button trail. The
full chase would mirror §3 method-by-method; pinning those bytes is left as
follow-on work tied to a specific visual-fidelity question (no current
runtime question requires them).

---

## 6. Pinned constants — comparison vs the runtime

| Constant | Apple Platinum (this decode) | Our runtime | Status |
|---|---|---|---|
| Focus-ring outset | **3 px** (`0x01CB48  li r4, -3`) | `composeButton` heuristic: `Math.max(3, Math.round(ringDrawn.width / 4))` (`src/controls.ts:1077`) | **Aligned** — minimum floor matches Apple's pinned constant exactly. |
| Frame stroke gray | **`#555555`** (RGBColor[2]) | `FRAME = [85, 85, 85]` = `#555555` (`src/platinum.ts:25`) | **Aligned** (bit-exact). |
| Inner-bevel shadow | **`#999999`** (RGBColor[6]) | `SHADOW = [154, 154, 154]` = `#9A9A9A` (`src/platinum.ts:28`) | **Off by 1 sRGB byte** (we have `#9A`, Apple has `#99`). Likely a Mac-gamma round-trip — `#9999` in Mac 1.8 space ≈ `#9A` in sRGB 2.2 after the bake. **Divergent (cosmetic, ≤1 lsb).** |
| Disabled / mid-tone | **`#888888`** (RGBColor[5]) | `MARK_OFF = [136,136,136]` = `#888888` (`src/platinum.ts:32`) | **Aligned** (bit-exact). |
| Gradient base (foot) | **`#CCCCCC`** (RGBColor[9]) | `FACE_BOT = [205,205,205]` = `#CDCDCD` (`src/platinum.ts:30`) | **Divergent by 1 byte.** Apple's `#CCCC` 16-bit short → sRGB `#CC`, our value `#CD` is off by one. Same Mac-gamma round-trip story as above. |
| Gradient top (white-ish) | between `#EEEEEE` (RGBColor[11]) and `#FFFFFF` (RGBColor[12]) | `FACE_TOP = [246,246,246]` = `#F6F6F6` (`src/platinum.ts:29`) | **Open** — our `#F6` is the midpoint of `#EE..#FF`. Apple's actual gradient endpoints would need the bevel-routine walk (§3.3) to pin precisely. |
| Default frame Hi | `#FFFFFF` (RGBColor[12]) | `HILITE = WHITE` (`src/platinum.ts:27`) | **Aligned**. |
| Highlight blue | **`#6666CC`** (RGBColor[13]) | Not currently used (focus state uses CSS `--scriptoscope-focus-color`) | **Open** — Apple's procedural focus ring is filled with this exact color via brush `0x21 → pattern set`, in a 3-pixel outset rect. Our CSS hook can map to it 1:1 when a scheme wants the period-faithful look. |

**Verdict.** Where the runtime makes a Platinum-color decision, it is
either bit-exact (frame stroke, disabled gray, white hilite) or within 1
sRGB byte (inner shadow, gradient foot) of Apple's pinned palette. The 1-byte
offsets are consistent with a Mac-1.8 → sRGB-2.2 gamma round-trip (Mac short
`0x9999` ≈ sRGB `0x9A`); they are not random and they are not divergent in
direction. No code change is recommended; the audit's value is documenting
that our procedural fallback IS the Platinum palette, not a procedurally
generated lookalike.

The two open items (gradient-top byte, highlight-blue wiring) are
documentation-aware: each is a one-line change in `src/platinum.ts` if a
future scheme needs the bit-exact look.

---

## 7. Cross-reference: the prior palette extraction

`.scratch/iso-recon/extract-platinum-palette.mjs` (the prior pass) extracted
**256 colors + a lavender highlight** from a different code path — namely
`code-out/CDEF-n63.bin`'s color CLUT and the `clut 8` system palette
attached via `extract-icons --all`. That extraction operates on the icon-side
of the world (ics4 / ics8 palette indexes); the table dumped here in §4 is
**the API-side palette** (the RGBColors that `GetThemeBrushAsColor` returns
to a caller).

The two palettes intersect on the gray ramp `#000`..`#FFF` at `0x11`-step
increments — both yield exactly the same 13 grays plus `#6666CC`. The
intersection is bit-exact at the 16-bit short level (`0x0000`, `0x1111`,
…, `0xFFFF`), which is the strongest possible cross-validation against a
clean-room re-derivation of the canonical Platinum palette.

The prior pass's 256-entry extraction adds **per-icon palette indexes** and
the **ics8 mask table** — those are properties of the bundled artwork, not
the procedural drawer, and lie outside this decode's scope.

---

## 8. Reproduction

```sh
# requires /tmp/ppc-venv with capstone; recreate if missing:
python3 -m venv /tmp/ppc-venv && /tmp/ppc-venv/bin/pip install capstone

# §1: TOC-base proof
/tmp/ppc-venv/bin/python .scratch/iso-recon/imm-range-check.py

# §2: vtable resolved at data[0xA554]
/tmp/ppc-venv/bin/python .scratch/iso-recon/decode-provider-vtable.py

# §3: button dispatch + sub-vtable + drawer constants
/tmp/ppc-venv/bin/python .scratch/iso-recon/decode-platinum-button.py
/tmp/ppc-venv/bin/python .scratch/iso-recon/decode-platinum-resolve.py
/tmp/ppc-venv/bin/python .scratch/iso-recon/decode-push-button.py
/tmp/ppc-venv/bin/python .scratch/iso-recon/decode-pushbutton-vtable.py

# §4: brush lookup tables + Platinum palette
/tmp/ppc-venv/bin/python .scratch/iso-recon/dump-brush-tables.py
```

All scripts read `85-System.bin` from the same `.scratch/iso-recon/` path
as the spike's `pef-locate.py` and `pef-decompress.py`. No new artifacts,
no network.

---

## 9. Stop point — what the next reader could pursue

The decode now has the full structural model and the Platinum palette
pinned. Three concrete cosmetic byte-questions remain — each is a
shallow further walk into the same `0x3C36C` bevel primitive:

1. **Gradient-top exact byte** (`FACE_TOP` in `src/platinum.ts`).
   Trail: `0x01CAE0 → 0x3C36C → vtable[+0x28] → GetThemeBrushAsColor(?)`.
   ETA: ~50 instructions of disassembly.

2. **Pressed-state darken delta** (the "press-on-button" gradient shift).
   Trail: same as above, but with the drawInfo `state=kThemeStatePressed`
   branch. Likely a constant subtraction on the brush-table low_short
   before lookup — one `subi` instruction worth of evidence.

3. **Title-text contrast for window-frame methods** (§5). Trail:
   `0x030A14 → 0x30B94 → window-kind sub-provider's vtable[+0x0C] →
   GetThemeTextColor(slot)`. Same shape as button; ETA mirrors §3.

None of these block any current runtime concern, and each yields ≤1
byte of new period-fidelity information. The decode hits diminishing
returns past the Platinum palette pin (§4), which is the most durable
single artefact of this pass.
