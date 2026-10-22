# 2.3.1 kDEF — master service-handler table (9 slots)

The kDEF proc-init builds a 9-entry function-pointer table at `0x1c7c`. The
table is the kDEF's public ABI to itself + to Kaleidoscope's main code module:
every routed call into the kDEF goes through one of these nine slots.

This page traces each slot to a confirmed role by reading its first ~50
instructions, identifying its A-traps + immediates, and cross-referencing
against `kdef231-reference.md`'s routine map.

> Surfaced by agent a845257356 in `kdef-binary-inventory.md §2`; this page
> confirms the 9 roles and updates §1 of `kdef231-reference.md` for the
> previously-unmapped service entries.

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/kdef-service-handlers.evidence.md`](engine/kdef-service-handlers.evidence.md) — spec writers and verifiers only.*

## Table install site

The installer (`0x1cbc..0x1d0a`) fills the nine slots in order into the
caller-supplied service table (argument 1, read at `0x1c84`):

| Slot | Entry |
|---:|---|
| 0 | `0x6688` |
| 1 | `0x997e` |
| 2 | `0xdd22` |
| 3 | `0x118b8` |
| 4 | `0x1525a` |
| 5 | `0x8d36` |
| 6 | `0x28e0` |
| 7 | `0x1d3e` |
| 8 | `0x17452` |

After install, `0xf3aa` (called at `0x1d14`) allocates the backbuffer GWorld
(`_NewGWorld` at `0xf3b0`) and saves its handle in the kDEF globals — the
compositor's offscreen pixel buffer. Then, at `0x1d26`, slot 6 is called with
(param=0, message=1000, handle=0, varCode=0); message 1000 is its "INIT"
opcode — see slot 6 below. (Listing excerpt and line range in evidence.)

> Note on slot ordering: agent a845257356's inferred labels in the inventory
> are wrong in a structurally informative way. There is no single "resource
> loader" or "recipe walker" slot — the resource loaders (`0x10472` cicn,
> `0x116f8` cinf) are NOT in this table at all; they're internal callees.
> The table's structure is: **three CDEF dispatchers (slot 0 push-button
> family, slot 1 scroll bar, slot 5 an undecoded CDEF answering `bevp` tags) +
> one helper CDEF (slot 2) + three family-routed WDEF dispatchers (slots 3, 4,
> 8) + one master compositor (slot 6) + one WDEF main (slot 7)**. The full
> slot-by-slot decode is below. *(Corrected 2026-10-21, v2 lane L5 verifier:
> an earlier revision called slot 1 a tracking proc / re-entrant entry and
> slot 5 the scroll-bar CDEF; the roles are the other way round.)*

## Confirmed roles

| Slot | Addr | Role | Aux block | Cross-reference |
|---:|---:|---|---:|---|
| 0 | `0x6688` | **CDEF main** — push-button family (default-button / cancel / radio / checkbox) | 32 B (`'Acid'`) | `kdef231-reference.md §1.1`, `§3.1`, `§3.2` |
| 1 | `0x997e` | **Scroll-bar CDEF** — handle-locked dispatcher that saves the kDEF globals pointer (`0x9930`), rebuilds its per-message scroll-bar state (`0x9d84`) and dispatches through a 15-entry message table at `0x99ce`; its message 34 answers the `sbap/sbae/sbar/sbax/sbgh/sbth/sbtp` FourCCs (`0x9b42`). Behavioural spec: `docs/spec/engine/scrollbar.md` | (caller's) | `kdef231-reference.md §1.1`; corrected 2026-10-21 (was "re-entrant CDEF entry") |
| 2 | `0xdd22` | **Auxiliary CDEF** — second control-record dispatcher, lighter (no 32-byte `'Acid'` allocate, sentinels `0xff/0xfe` in the control record's contrlHilite byte only). Likely Appearance-era **embedded / focus-ring helper** | none | new — adds row to §1.3 |
| 3 | `0x118b8` | **wnd# → WDEF gate (document-window family)** — `GetResource('wnd#', -14336)`; on hit → calls `0x28e0` (slot 6); on miss → loads system `'WDEF', -14330` and forwards. This is **NOT the cinf consumer** (that's `0x116f8`, see `kdef231-reference.md §1.6`) | — | corrects `kdef-binary-inventory.md §2` |
| 4 | `0x1525a` | **wnd# → WDEF gate (utility-window family)** — same shape, id `-14304`, message base `+1984` (added at `0x15274`). On miss, falls into a 9-entry private dispatch (`0x152fc`) | — | new — adds row to §1.4; aligns with §2.1 `-14304..-14295` utility band |
| 5 | `0x8d36` | **Separate CDEF, undecoded (likely bevel button)** — same dispatch shape as `0x6688`, allocates a 68-byte aux block (`_NewHandle`, trap `A122`, at `0x8df6`); its hit test returns part 10 and its message 34 (`0x98ca`) answers `bevp`-family tags. **Not** the scroll bar: nothing in `0x8d36..0x991e` reaches `0x9d84` or the scroll-bar drawers | 68 B | corrected 2026-10-21 (was "second CDEF main — scrollbar / slider") |
| 6 | `0x28e0` | **Master compositor dispatcher** — receives `(param, msg, handle, varCode)`, stores them in the compositor's work struct, dispatches on `msg - 1001` via the `0x148` indexed-table helper. msg 1000 = INIT (hit at boot); messages 1001..1009 are the per-side recipe-walk + draw entry points calling into `0x356c`/`0x3680`/`0x3f2c` etc. **This is what the inventory labelled "wnd# dispatcher"** — but the wnd# load happens in slot 3; slot 6 walks the recipe AFTER it's loaded | — | covers §1.4 `0x3680..0x4138` block from above |
| 7 | `0x1d3e` | **WDEF main** — 35-entry msg dispatcher at `0x1d68` (already documented in `kdef-binary-inventory.md §1`). Handles standard WDEF msgs 0..34 (wDraw, wHit, wCalcRgns, wNew, wDispose, wGrowIcon + Appearance/Carbon msgs 19/20/21/27/29/34) | — | `kdef-binary-inventory.md §1`; row already in `kdef231-reference.md §1.4` implicitly via `0x4138/0x4176/0x41d0` |
| 8 | `0x17452` | **wnd# → WDEF gate (popup / tab / menu family)** — `GetResource('wnd#', -12320)`; on hit loads `'WDEF', -14336`, locks the handle, and calls into the loaded resource's code with `msg + 1008` — **period-faithful: it calls the real WDEF resource's code, not the kDEF's own renderer**. Used for the `-12320` popup-frame + `-12319` tab family from `kdef231-reference.md §2.6`. On miss → 9-entry private dispatch (`0x174e8`) | — | new — adds row to §1.4 |

(The original table's per-slot listing line column is in evidence.)

## Per-slot traces (first ~50 instructions)

### Slot 0 — `0x6688` (CDEF main)

Fully documented in `kdef231-reference.md §1.1`. Not re-traced here.

### Slot 1 — `0x997e` (scroll-bar CDEF)

Entry sets up a large local state copy, runs the common init `0x104` (the
same init slot 0 uses), then calls `0x9930`, which saves the kDEF globals
pointer into a static at `0x992c`. It brackets the handle with `_HGetState`
(`A069`) / `_HUnlock` (`A029`, as labelled in the trace), builds a call
struct (handle, master pointer, message, param), runs the pre-call hook
`0x9d84` (the scroll-bar per-message state), then dispatches on the message
through the indexed-table helper `0x148` into a 15-entry int16 table at
`0x99ce..0x9a0c` (msg → handler offset). (Listing detail in evidence.)
This is the scroll-bar CDEF: its draw (`0xa2b6`), hit test (`0xa506`) and
region handlers are specified in `docs/spec/engine/scrollbar.md`, and its
message 34 (`0x9b42`) answers the `sb*` theme-sound FourCCs. *(Corrected
2026-10-21, v2 lane L5 verifier: an earlier revision called this a re-entrant
tracking entry and attributed the scroll bar to slot 5.)*

**Diagnosis.** The `0x9930` "save globals pointer" + `_HGetState`/`_HUnlock` bracket means
this entry is **re-entrant from a context that hasn't bound the kDEF
globals** — exactly the shape of a callback installed via the Toolbox (e.g.
`SetClikLoop`, an action proc, or the Appearance Manager calling back into
the CDEF after a theme switch). The handler bodies (`0xa2b6`, `0xa506`,
`0xa1fe`, `0xa678`, ...) include `_PtInRect` (`A8AD` at a538) and `_GetPort`
/ `_OSDispatch` (`A874`/`A88F` at a2ca/a30a; names per Traps.h, formerly
misread as PtInRgn / GetGDevice / GetCTSeed), consistent with hit-testing and
port-bracketed draw operations *(re-verify: the "GDevice-aware" reading rested on
the wrong names)*. The nearby `'SMARTSCROLLI'` literal at
`0x1c34..0x1c44` (Aladdin's SmartScroll INIT detection) confirms this
entry interoperates with installed-extension scrollbar mods.

### Slot 2 — `0xdd22` (auxiliary CDEF)

Entry reads varCode, clears two locals and copies two kDEF globals into
locals (`0xdd34..0xdd66`), then calls `_OSDispatch` (`A88F`, selector 58; formerly misread as
`_GetCTSeed`) and compares the result against three four-character magics
*(re-verify: the "GDevice ctSeed" interpretation was written under the wrong trap
name)*:

| Magic | Hex | Note |
|---|---|---|
| `'CHTA'` | `0x43484841` | |
| `'POrg'` | `0x504F7267` | |
| `'CH3D'` | `0x43483344` | ATI Rage 3D variants |

It then calls `_SetResLoad` (trap `A99B` per Traps.h; the trace labelled it
`_SetPort`, with `_GetForeColor` as an alternative — both wrong), takes varCode bit 3 as the "is
themed" flag, walks the handle to the ControlRecord and checks the owning
window's port fields (`0xddbc..0xddfc`), brackets with `_HGetState` /
`_HUnlock`, and on msg 3 (initCntl, test at `0xde20`) runs the init flow on
contrlData (the aux block) at `0xde2a..0xde4c`. (Listing detail in evidence.)


**Diagnosis.** This handler is a **secondary control draw / state-update
helper** — GDevice-aware (checks 3 specific ctSeed magics tied to ATI / 3D
acceleration) *(re-verify: "GDevice-aware" and the "ctSeed magics" rest on the former GetCTSeed/GetGDevice trap names; the traps are OSDispatch/GetPort)*, reads the host WindowPort fields directly. The 32-byte
`'Acid'` aux block is NOT allocated here; instead it consumes one that
slot 0 already built. This is the **embedded / Appearance-focus helper**
for slot 0's CDEF family — likely the per-control "draw focus ring" /
"DrawThemeFocusRect" wrapper that the inventory's new AppearanceLib import
list hints at.

### Slot 3 — `0x118b8` (wnd# → WDEF gate, document family)

Entry reads the window handle, message and varCode, and reduces varCode
mod 16 (16-family lookup). It saves two low-memory globals (`0x118`,
`0x2a6`; the trace annotates the second as a globals-save mirror), then:

1. `_GetResource('wnd#', -14336)` (`A9A0` at `0x118ee`; the trace annotates
   `-14336` as the doc-window inactive cicn id) — the recipe handle.
2. On non-null: calls slot 6 (`0x28e0`) with (param, msg, handle, varCode)
   and returns its result (via `0x11ed8`).
3. On null (`0x11916`): `_GetResource('WDEF', -14330)` — Apple's stock
   system WDEF (`0x11922`); lock/unlock (`0x11932`); msg 2 (calcRgns) takes
   the path at `0x11990`; at `0x11944` trap `A1AD` with selector `'appr'`
   (annotated "_CountAppFiles? actually _Gestalt('appr')"); continues with
   msg-specific behaviour.

(Listing detail in evidence.)


**Diagnosis.** **Confirms `kdef-binary-inventory.md §2`'s correction**: the
cinf consumer is `0x116f8`, NOT this. This slot is the **wnd# gate** —
"does this scheme ship a recipe for the requested document-window
variation, or do we fall back to the system WDEF?". When the wnd# hits,
control passes to **slot 6 (`0x28e0`) — the master compositor** with the
recipe in hand.

### Slot 4 — `0x1525a` (wnd# → WDEF gate, utility family)

Entry reads message, param and varCode; the family message base is
varCode mod 16 plus 1984 (`0x15270`/`0x15274`). Then:

1. `_GetResource('wnd#', -14304)` — the UTILITY-WINDOW family id (§2.1)
   (`0x1528c..0x15296`).
2. On non-null: calls slot 6 with message base 1984 (`0x152a2..0x152ae`).
3. On null (`0x152be`): private dispatch — a precompute call `0x1547e` on the
   message (`0x152e0`), range check (result above 8 → `0x15466`), then a
   9-entry private table at `0x152fc..0x15308` (msg 0..8: `0x1530e`,
   `0x15318`, `0x1532a`, ...).

(Listing detail in evidence.)


**Diagnosis.** Same gate shape as slot 3, but for the **utility-window
band** (`-14304..-14296` from `kdef231-reference.md §2.1`). The `+1984`
message-base offset distinguishes it: when slot 6 sees msg in [1984, 1992]
it knows "utility family", not "document family". This is how the
compositor multiplexes per-window-type recipes through a single core.

### Slot 5 — `0x8d36` (separate CDEF, undecoded; not the scroll bar)

Entry has a very large local frame (scrollbar geometry), takes the
ControlHandle argument, runs the common init `0x104`, and dispatches on the
message through `0x148` (table at `0x8d5c..0x8d94`, msg 0..0x22 = 34, like
the CDEF set). Notable branches:

| Msg | Range | Behaviour |
|---|---|---|
| 0 | `0x8d98..0x8da0` | calls `0x8c88` with the handle, returns via `0x990e` |
| 1 (hit-test) | `0x8da4..0x8df2` | `_PtInRect` (`$A8AD`, formerly misnamed PtInRgn) at `0x8dbc`; sentinel -1/-2 in contrlHilite; `_RectRgn` at `0x8df0` |
| init | `0x8df6..0x8e64` | `_NewHandle(68)` (`A122`) allocates the 68-BYTE aux block, stored as contrlData; `0x8e02..0x8e64` initialise its fields (control value, min, max, page-up, page-down, increment, decrement, etc.) |

(Table entry words and aux field offsets in evidence.)


**Diagnosis (corrected 2026-10-21, v2 lane L5 verifier).** A separate CDEF,
symmetric to slot 0 but with a 68-byte aux block instead of 32. It is **not**
the scroll bar: its hit test returns part 10, its message 34 (`0x98ca`)
answers `bevp`-family tags, and nothing in `0x8d36..0x991e` calls `0x9d84` or
the scroll-bar drawers (`0xa2b6`, `0xaed6`, `0xc338`). Likely the bevel
button; undecoded. The `sb*` FourCCs and the scroll-bar ids are slot 1's
(`0x997e`, `docs/spec/engine/scrollbar.md`). An earlier revision of this
section attributed the scroll bar to this slot.

### Slot 6 — `0x28e0` (master compositor dispatcher)

Entry takes the handle / WindowPtr, message, varCode and param, runs the
common init `0x104`, and installs all four arguments into the compositor's
work struct (`0x28fc..0x290c`). Messages 1000 (INIT) and 1001 skip the
precompute (`0x2910`/`0x2916` → `0x2926`); every other message first calls
the PRECOMPUTE routine `0x2e02` with the message (`0x291c`), which touches
the work struct. It then dispatches through `0x148` on `msg - 1001` into a
9-entry table at `0x2936..0x295e` (msg 1001..1009):

| Msg | Site | Callee | Note |
|---:|---|---|---|
| 1001 | `0x2962` | `0x41ee` | returns via `0x2ddc` |
| 1002 | `0x296c` | `0x3f2c` (param, handle) | likely the wnd# recipe walker |
| 1003 | `0x2980` | `0x3ac4` (handle) | recipe install (§1.4 `0x3680` area) |
| 1004 | `0x298e` | `0x38fe` (handle) | |
| 1005 | `0x299c` | `0x3aa8` (handle) | |
| 1006 | `0x29aa` | `0x3e6c` | |
| 1007 | `0x29b4` | `0x436c` | |
| 1008 | `0x29be` | `0x4924` | a local flag is set to 1 first; zoom/grow path? |

(Listing detail in evidence.)


**Diagnosis.** **The master window-chrome compositor.** Receives every
themed-window operation routed through slots 3/4/8 as message codes
1000..1009 (≈10 verbs: init, load-recipe, install, walk, draw, hit, layout,
zoom/grow, …). The handler bodies are exactly the routines documented in
`kdef231-reference.md §1.4` (`0x356c..0x4138`) — slot 6 is the umbrella
that fans them out by message. The init call at `0x1d26` (slot 6 with
msg 1000) sets up the compositor at boot.

### Slot 7 — `0x1d3e` (WDEF main)

Entry has the biggest local frame in the kDEF; it reads varCode, the
WindowPtr / handle, param and message. Messages above 34 go to `0x28d2`
(no-op); otherwise it jumps through the 35-entry WDEF dispatch table at
`0x1d68` — fully decoded in `kdef-binary-inventory.md §1`. (Listing detail
in evidence.)


**Diagnosis.** Already documented. This is the **classic-CDEF-shape WDEF
main** — entered for every wDraw/wHit/wCalcRgns/wNew/wDispose call when
the host Window Manager invokes the kDEF as a WDEF resource. It bridges
into slot 6 (master compositor) for the themed paths and to `0x28d2`
(default no-op) for unhandled messages.

### Slot 8 — `0x17452` (wnd# → WDEF gate, popup / tab / menu family)

Entry reads the window and varCode, reducing varCode mod 16. Then:

1. `_GetResource('wnd#', -12320)` — the POPUP / TAB FRAME id (§2.6)
   (`0x17468..0x17472`).
2. On null (`0x174c8`): 9-entry private dispatch.
3. On non-null: `_GetResource('WDEF', -14336)` — loads the doc-window WDEF as
   the carrier (`0x1747a..0x17486`); checks the master pointer and
   locks/unlocks (`A069` / `A029`, `0x17490..0x1749a`).
4. MESSAGE BASE = 1008: the message passed is varCode mod 16 plus 1008
   (`0x1749e`).
5. `0x174a4..0x174b6`: pushes the params, `_HLock` (`A055` as labelled in the
   trace), and **calls the loaded WDEF resource's own code** through its
   dereferenced handle.
6. `A06A` (labelled `_HUnlock`) at `0x174bc`; stores the result and returns
   (`0x174c0`).

(Listing detail in evidence.)

**Diagnosis.** **Period-faithful trick**: for popup/tab windows, the kDEF
loads a `'WDEF'` resource and then *jumps to it directly* (a call through
the dereferenced handle), passing message-base 1008. This is how
Kaleidoscope's popup/tab theming defers to a "trampoline" WDEF that knows
the popup geometry while inheriting the cicn art from the scheme. The
`-12320` popup-frame / `-12319` tab cicn ids in `kdef231-reference.md §2.6`
are exactly this family.

## Cross-references to add

The following rows are now eligible for `kdef231-reference.md §1`:

- **§1.1 (CDEF dispatch)** — add row for slot 1 `0x997e` (scroll-bar CDEF,
  saves the kDEF globals pointer via `0x9930`) and row for slot 5 `0x8d36`
  (separate CDEF, 68-byte aux, `bevp` tags, undecoded). *(Corrected 2026-10-21.)*
- **§1.3 (control draw — other parts)** — add `0x997e` as the scroll-bar
  family's CDEF entry (corrected 2026-10-21; this item formerly named `0x8d36`); add `0xdd22` as the GDevice-aware focus / state helper *(re-verify: "GDevice-aware" and the "ctSeed magics" rest on the former GetCTSeed/GetGDevice trap names; the traps are OSDispatch/GetPort)*.
- **§1.4 (window chrome)** — add a sub-section "the three wnd# gates"
  documenting that slots 3 / 4 / 8 are three parallel `GetResource('wnd#',
  -id)` routers (document / utility / popup-tab families) that hand off to
  slot 6 (`0x28e0`) — the master compositor that owns `0x356c..0x4138`.
- **§2 (kdef-binary-inventory)** — the "0x118b8 is the cinf consumer" note
  should be replaced with "0x118b8 is the wnd# gate for document windows;
  the cinf consumer is `0x116f8`" (the inventory already notes this
  inline; folding it into the table cell will avoid future confusion).

## Candidate runtime gaps

The runtime mirrors slots 0 / 3 / 6 / 7 well (CDEF push-button face,
wnd#-cascade resolution, recipe walk + draw, WDEF message routing). The
following slots are **not yet modelled in the runtime** and are candidate
gaps surfaced by this trace:

1. **Slot 1 (`0x997e`) scroll-bar CDEF** *(corrected 2026-10-21; formerly
   read as a re-entrant entry)*. The runtime's scroll bars are drawn by
   `controls.ts`; the v2 scroll-bar family replays this CDEF from
   `docs/spec/engine/scrollbar.md`. The "lock the handle + save globals" bracket
   itself has no runtime counterpart (Scriptoscope draws synchronously).
2. **Slot 2 (`0xdd22`) GDevice-aware focus / state helper** *(re-verify: "GDevice-aware" and the "ctSeed magics" rest on the former GetCTSeed/GetGDevice trap names; the traps are OSDispatch/GetPort)*. The runtime
   doesn't render Appearance focus rings (the keyboard-focus halo around
   the active button). If we want a "focused button" demo state, this is
   the period reference — gates draw via the 3 ctSeed magics, suggesting
   the original kDEF dimmed/skipped the focus glow on accelerators.
   **Candidate runtime addition: a focus-ring overlay in `controls.ts`**.
3. **Slot 4 (`0x1525a`) utility-window gate**. The runtime renders document
   windows + corner-sprite chrome, but `src/renderWindow.ts` doesn't yet
   pick a different recipe variant for the utility-window band (`-14304..
   -14295`). The runtime's `resolveWindowType` is document-only. **Candidate
   runtime addition: utility-window variant in `wndCascade.ts`**.
4. **Slot 5 (`0x8d36`) separate CDEF, 68-byte aux, `bevp` tags** *(corrected
   2026-10-21; formerly read as the scroll bar)*. Undecoded; likely the bevel
   button. Not a scroll-bar reference.
5. **Slot 8 (`0x17452`) popup-tab trampoline WDEF**. The runtime doesn't
   render popups/tabs as window-shaped chrome. If we ever add popup-menu
   theming or the `-12319` tab family, the period-faithful path is "load
   a `'WDEF'` and let IT draw the geometry, with the cicn art coming from
   the scheme". **Candidate runtime addition: popup/tab chrome path
   keyed on `-12320 / -12319`** (currently `kdef231-reference.md §2.6`
   labels these `[DOC]`-confidence only).

Items 3 and 5 are the highest-leverage candidates: each adds a window
class the corpus actually ships art for but the runtime doesn't render.
