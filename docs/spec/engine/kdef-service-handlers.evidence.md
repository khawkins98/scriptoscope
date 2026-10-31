# kdef-service-handlers — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/kdef-service-handlers.md` at v2 commit `1183816e`. The behavioural replacement text lives in
> [`kdef-service-handlers.md`](../kdef-service-handlers.md). Nothing here was re-decoded during the move; verifier
> CONFIRMED/REFUTED marks are added by the verifying lane.

## Table install site (lines 17–36): installer listing, listing path, register/frame narrative

````text
```
1cbc: lea 0x6688,%a0   ; %a2@(0)
1cc4: lea 0x997e,%a0   ; %a2@(4)
1cce: lea 0xdd22,%a0   ; %a2@(8)
1cd8: lea 0x118b8,%a0  ; %a2@(12)
1ce2: lea 0x1525a,%a0  ; %a2@(16)
1cec: lea 0x8d36,%a0   ; %a2@(20)
1cf6: lea 0x28e0,%a0   ; %a2@(24)
1d00: lea 0x1d3e,%a0   ; %a2@(28)
1d0a: lea 0x17452,%a0  ; %a2@(32)
1d14: bsrl 0xf3aa      ; allocate backbuffer GWorld (_NewGWorld at f3b0)
1d26: bsrl 0x28e0      ; call slot 6 with (param=0, message=1000, handle=0, varCode=0) — INIT
```

(`k231-kdef0.asm` lines 2594..2618.) The table base is `a2` at entry to the
installer; `a2` was loaded from the caller-supplied service-table pointer at
`1c84: moveal %fp@(8),%a2`. After install, `0xf3aa` runs `_NewGWorld` and
saves the handle into `a4@(1216)` — the compositor's offscreen pixel buffer.
Then slot 6 is called with message 1000, which is its "INIT" opcode — see
slot 6 below.
````

## Confirmed roles (lines 49–59): original table incl. asm-evidence line column and register/frame operands

````text
| Slot | Addr | Role | Aux block | Asm-evidence line | Cross-reference |
|---:|---:|---|---:|---:|---|
| 0 | `0x6688` | **CDEF main** — push-button family (default-button / cancel / radio / checkbox) | 32 B (`'Acid'`) | 8754 | `kdef231-reference.md §1.1`, `§3.1`, `§3.2` |
| 1 | `0x997e` | **CDEF re-entrant entry** — handle-locked dispatcher, saves/restores `a4` (`0x9930`) so the kDEF can be called from a context that hasn't bound globals; bridges to the same drawer family as slot 0 via a smaller msg table | (caller's) | 12768 | new — adds row to §1.1 |
| 2 | `0xdd22` | **Auxiliary CDEF** — second control-record dispatcher, lighter (no 32-byte `'Acid'` allocate, sentinels `0xff/0xfe` at handle+17 only). Likely Appearance-era **embedded / focus-ring helper** | none | 18295 | new — adds row to §1.3 |
| 3 | `0x118b8` | **wnd# → WDEF gate (document-window family)** — `GetResource('wnd#', -14336)`; on hit → `bsrl 0x28e0` (slot 6); on miss → loads system `'WDEF', -14330` and forwards. This is **NOT the cinf consumer** (that's `0x116f8`, see `kdef231-reference.md §1.6`) | — | 23341 | corrects `kdef-binary-inventory.md §2` |
| 4 | `0x1525a` | **wnd# → WDEF gate (utility-window family)** — same shape, id `-14304`, message base `+1984` (`addiw #1984,%d6` at 15274). On miss, falls into a 9-entry private dispatch (`0x152fc`) | — | 28099 | new — adds row to §1.4; aligns with §2.1 `-14304..-14295` utility band |
| 5 | `0x8d36` | **Second CDEF main** — scrollbar / slider family. Same dispatch shape as `0x6688` but allocates 68-byte aux (`moveq #68,d0; A122` at 8df6) and inits fields at +20/+22/+28/+32/+34/+38/+42/+46 (control value, min, max, page, action). Consumes the `sbap/sbae/sbar/sbax/sbgh/sbth/sbtp` FourCC family from `kdef-binary-inventory.md §5` | 68 B | 11724 | new — adds row to §1.1 / §1.3 |
| 6 | `0x28e0` | **Master compositor dispatcher** — receives `(param, msg, handle, varCode)`, writes them to `a4@(454/458/460/464)`, dispatches on `msg - 1001` via the `0x148` indexed-table helper **[superseded 2026-10-31 (#597): switch table at `0x292e`, default `0x2ddc`, WDEF messages 0..8 plus 1000/1001]**. msg 1000 = INIT (hit at boot); messages 1001..1009 are the per-side recipe-walk + draw entry points calling into `0x356c`/`0x3680`/`0x3f2c` etc. **This is what the inventory labelled "wnd# dispatcher"** — but the wnd# load happens in slot 3; slot 6 walks the recipe AFTER it's loaded | — | 3633 | covers §1.4 `0x3680..0x4138` block from above |
| 7 | `0x1d3e` | **WDEF main** **[superseded 2026-10-31 (#597): CDEF-shaped dispatcher, family undecoded]** — 35-entry msg dispatcher at `0x1d68` (already documented in `kdef-binary-inventory.md §1`). Handles standard WDEF msgs 0..34 (wDraw, wHit, wCalcRgns, wNew, wDispose, wGrowIcon + Appearance/Carbon msgs 19/20/21/27/29/34) | — | 2627 | `kdef-binary-inventory.md §1`; row already in `kdef231-reference.md §1.4` implicitly via `0x4138/0x4176/0x41d0` |
| 8 | `0x17452` | **wnd# → WDEF gate (popup / tab / menu family)** — `GetResource('wnd#', -12320)`; on hit loads `'WDEF', -14336`, locks the handle, calls `a3@→a0; jsr a0@` with `msg + 1008` — **period-faithful: it calls the real WDEF resource's code, not the kDEF's own renderer**. Used for the `-12320` popup-frame + `-12319` tab family from `kdef231-reference.md §2.6`. On miss → 9-entry private dispatch (`0x174e8`) | — | 30845 | new — adds row to §1.4 |
````

## Slot 1 — `0x997e` (re-entrant CDEF entry) (lines 69–97): listing excerpt and diagnosis

````text
```
997e: linkw fp,#-78          ; large local frame (state copy)
9982: moveml d3-d5/a2-a3,sp@-
9986: moveal fp@(14),a3      ; handle arg
998c: bsrl 0x104             ; gestalt-ish init (same as 0x6688:0x6688+0x68c)
9994: bsrl 0x9930            ; SAVE GLOBALS — 0x9930 stores a4 into static @ 0x992c
999a: moveal a3,a0; A069     ; _HGetState — lock the handle
99a0: moveal a3,a0; A029     ; _HUnlock — set state byte for the duration
99a4: movel a3,fp@(-78)      ; build call-struct: handle
99a8: movel a3@,fp@(-74)     ;   master ptr
99ac: movew fp@(12),fp@(-70) ;   message
99b2: movel fp@(8),fp@(-68)  ;   param
99b8: pea fp@(-78)
99bc: bsrl 0x9d84            ; pre-call hook
99c2: movew fp@(12),d0       ; msg → d0
99c8: bsrl 0x148             ; indexed-table dispatch (helper at 0x148)
99ce..9a0c: 14-entry int16 table (msg → handler offset; mid-decode bytes 0214/00c0/...)
```

**Diagnosis.** The `0x9930` "save a4" + `_HGetState`/`_HUnlock` bracket means
this entry is **re-entrant from a context that hasn't bound the kDEF
globals** — exactly the shape of a callback installed via the Toolbox (e.g.
`SetClikLoop`, an action proc, or the Appearance Manager calling back into
the CDEF after a theme switch). The handler bodies (`0xa2b6`, `0xa506`,
`0xa1fe`, `0xa678`, ...) include `_PtInRgn` (`A8AD` at a538) and `_GetGDevice`
/ `_GetCTSeed` (`A874`/`A88F` at a2ca/a30a), consistent with hit-testing +
GDevice-aware draw operations. The nearby `'SMARTSCROLLI'` literal at
`0x1c34..0x1c44` (Aladdin's SmartScroll INIT detection) confirms this
entry interoperates with installed-extension scrollbar mods.
````

## Slot 2 — `0xdd22` (auxiliary CDEF) (lines 101–117): listing excerpt

````text
```
dd22: linkw fp,#-144
dd2a: movew fp@(18),d4       ; varCode → d4
dd34..dd66: clear fp@(-83), fp@(-98), copy a4@(330/334) to locals
dd6a: pea fp@(-136); pea fp@(-82); movew #58,sp@-; A88F  ; _GetCTSeed(58)
dd80: cmpil #0x43484841,d7   ; 'CHTA' (one of the GDevice ctSeed magics)
dd8e: cmpil #0x504F7267,d7   ; 'POrg'
dd96: cmpil #0x43483344,d7   ; 'CH3D' — ATI Rage 3D variants
dda8: moveb #1,sp@-; A99B    ; _SetPort (or _GetForeColor — A99B = _SetPort)
ddae: andiw #8,d4            ;   varCode bit 3
ddb8: moveb d0,d5            ;   "is themed"
ddbc..ddfc: walk handle→ControlRecord at @+4; check window port at @+68/+74/+70
de02: A069                   ; _HGetState
de0c: A029                   ; _HUnlock
de20: cmpiw #3,fp@(12)       ; msg == 3 (initCntl)?
de2a..de4c: handle init flow on a2@(28) (contrlData = aux block)
```
````

## Slot 3 — `0x118b8` (wnd# → WDEF gate, document family) (lines 130–153): listing excerpt

````text
```
118b8: linkw fp,#-82
118c0: moveal fp@(14),a2     ; window handle
118c4: movew fp@(12),d3      ; message
118c8: movew fp@(18),d4      ; varCode
118cc: andiw #15,d4          ; varCode % 16 (16-family lookup)
118d2: movel 0x118,sp@       ; save SP-relative slot
118da: movel 0x2a6,sp@       ; ... another globals fence (A4 save mirror)
118e4: movel #'wnd#',sp@-    ; #2003723299
118ea: movew #-14336,sp@-    ; doc-window inactive cicn id
118ee: A9A0                  ; _GetResource
118f0: moveal sp@+,a3        ; recipe handle
118f6: tstl a3 → 11916       ; on null → WDEF fallback
118fa: pea (param/msg/handle/varCode) → bsrl 0x28e0   ; slot 6 (master compositor)
1190c: movel d0,sp@(130); braw 0x11ed8 → return
;; fallback path:
11918: movel #'WDEF',sp@-    ; #1464091974
1191e: movew #-14330,sp@-    ; system WDEF id
11922: A9A0                  ; _GetResource — load Apple's stock WDEF
11932: A069 / A029           ; lock/unlock
1193e: cmpiw #2,d3 → 0x11990 ; msg==2 (calcRgns) path
11944: movel #'appr',d0; lea fp@(-80),a1; A1AD  ; _CountAppFiles? actually _Gestalt('appr')
;; ... continues with msg-specific behaviour
```
````

## Slot 4 — `0x1525a` (wnd# → WDEF gate, utility family) (lines 164–181): listing excerpt

````text
```
1525a: linkw fp,#-8
15262: movew fp@(12),d4      ; message
15266: movel fp@(8),d5       ; param
1526c: movew fp@(18),d6      ; varCode
15270: andiw #15,d6          ; varCode % 16
15274: addiw #1984,d6        ; message base for utility family
1528c: movel #'wnd#',sp@-
15292: movew #-14304,sp@-    ; UTILITY-WINDOW family id (§2.1)
15296: A9A0; moveal sp@+,a2  ; recipe handle
1529e: tstl a2 → 0x152be     ; on null → private dispatch
152a2..152ae: pea (...) → bsrl 0x28e0  ; slot 6 with message base 1984
;; private dispatch path:
152e0: movew d4,sp@-; bsrl 0x1547e  ; precompute call
152ea: cmpiw #8,d0 → bhiw 0x15466    ; range check
152f4: movew pc@(0x152fc,d0:w:2),d0  ; 9-entry private table
152fc..15308: 9 entries (msg 0..8): 0x1530e, 0x15318, 0x1532a, ...
```
````

## Slot 5 — `0x8d36` (second CDEF main — scrollbar / slider) (lines 191–208): listing excerpt

````text
```
8d36: linkw fp,#-350         ; very large frame (scrollbar geometry)
8d3e: moveal fp@(14),a2      ; ControlHandle
8d42: moveq #0,d4
8d44: bsrl 0x104             ; gestalt
8d4e: movew fp@(12),d0       ; msg
8d52: bsrl 0x148             ; indexed-table dispatch
8d5c..8d94: msg-table entries (msg 0..0x22 = 34, like the CDEF set):
            0036, 003e, 0074, 0088, 0194, 000a..., 0070, 000b, 006c, 000e,
            05b6, 01ae, 0546, 09a6, 07c4, 0530, 0b34
8d98..8da0: msg-0 branch — pea a2; jsr 0x8c88; braw 0x990e (return)
8da4..8df2: msg-1 (hit-test) branch — _PtInRgn at 8dbc, sentinel -1/-2 at +17
            _RectRgn at 8df0
8df6: moveq #68,d0; A122     ; _NewHandle #68 — allocate 68-BYTE aux block
8dfa: moveal a2@,a1; movel a0,a1@(28)  ; ControlRecord+28 = contrlData = aux
8e02..8e64: init aux fields at +14/+20/+22/+26/+28/+30/+32/+34/+38/+40/+42/+44/+46/+48
            (control value, min, max, page-up, page-down, increment, decrement, etc.)
```
````

## Slot 6 — `0x28e0` (master compositor dispatcher) (lines 220–253): listing excerpt and diagnosis

````text
```
28e0: linkw fp,#-30
28e8: moveal fp@(14),a2      ; handle / WindowPtr
28ec: movew fp@(12),d3       ; message
28f0: moveq #0,d4
28f2: bsrl 0x104             ; gestalt
28fc: movel a2,a4@(454)      ; — install args into the a4-relative work struct
2900: movew fp@(18),a4@(458)
2906: movel fp@(8),a4@(460)
290c: movew d3,a4@(464)      ; message stored at @464
2910: cmpiw #1000,d3 → beqs 0x2926   ; msg 1000 = INIT (skip the per-msg call)
2916: cmpiw #1001,d3 → beqs 0x2926   ; msg 1001 also skips the precompute
291c: movew d3,sp@-; bsrl 0x2e02      ; PRECOMPUTE (touches a4 work struct)
2926: movew d3,d0
2928: bsrl 0x148             ; indexed-table dispatch
292e: subil #1001,fp@(10)    ; (effective: d0 = msg - 1001 for table index)
2936..295e: 9 entries (msg 1001..1009): 002a, 0030, 0040, 004a, 0054, 005e, 0064, 006a, 0106
; SUPERSEDED 2026-10-31 (#597): 292e..2934 are switch-table words, not code:
; default 04ae (-> 2ddc), min 0000, max 03e9, count-1 000a; pairs from 2936:
; (0,002a)->2962 (1,0030)->296c (2,0040)->2980 (3,004a)->298e (4,0054)->299c
; (5,005e)->29aa (6,0064)->29b4 (7,006a)->29be (8,0106)->2a5e (1000,0460)->2dbc (1001,0470)->2dd0
2962: bsrl 0x41ee → braw 0x2ddc   ; msg 1001 → bsrl 0x41ee
296c: pea fp@(8); pea a2; bsrl 0x3f2c  ; msg 1002 — likely the wnd# recipe walker
2980: pea a2; bsrl 0x3ac4              ; msg 1003 — recipe install (§1.4 0x3680 area)
298e: pea a2; bsrl 0x38fe              ; msg 1004
299c: pea a2; bsrl 0x3aa8              ; msg 1005
29aa: bsrl 0x3e6c                       ; msg 1006
29b4: bsrl 0x436c                       ; msg 1007
29be: moveq #1,d4; bsrl 0x4924         ; msg 1008 — calls 0x4924 (zoom/grow path?)
```

**Diagnosis.** **The master window-chrome compositor.** Receives every
themed-window operation routed through slots 3/4/8 as message codes
1000..1009 **[superseded 2026-10-31 (#597): WDEF messages 0..8 plus 1000/1001]** (≈10 verbs: init, load-recipe, install, walk, draw, hit, layout,
zoom/grow, …). The handler bodies are exactly the routines documented in
`kdef231-reference.md §1.4` (`0x356c..0x4138`) — slot 6 is the umbrella
that fans them out by message. The init call at `0x1d26: bsrl 0x28e0` with
msg 1000 sets up the compositor at boot.
````

## Slot 7 — `0x1d3e` (WDEF main; superseded 2026-10-31 (#597): CDEF-shaped) (lines 257–267): listing excerpt

````text
```
1d3e: linkw fp,#-624          ; the biggest frame in the kDEF
1d46: movew fp@(18),d6        ; varCode
1d4a: moveal fp@(14),a2       ; WindowPtr / handle
1d4e: movel fp@(8),d3         ; param
1d54: movew fp@(12),d0        ; message
1d58: cmpiw #34,d0 → bhiw 0x28d2  ; msgs > 34 → no-op
1d60: movew pc@(0x1d68,d0:w:2),d0
1d64: jmp  pc@(0x1d68,d0:w)
1d68: 35-entry WDEF dispatch table — fully decoded in kdef-binary-inventory.md §1
```
````

## Slot 8 — `0x17452` (wnd# → WDEF gate, popup / tab / menu family) (lines 277–303): listing excerpt and diagnosis

````text
```
17452: linkw fp,#-282
1745a: moveal fp@(14),a2     ; window
1745e: movew fp@(18),d5      ; varCode
17462: andiw #15,d5
17468: movel #'wnd#',sp@-
1746e: movew #-12320,sp@-    ; POPUP / TAB FRAME id (§2.6)
17472: A9A0; moveal sp@+,a3
17476: tstl a3 → 0x174c8     ; on null → 9-entry private dispatch
1747a: movel #'WDEF',sp@-
17482: movew #-14336,sp@-    ; load doc-window WDEF as the carrier
17486: A9A0; moveal sp@+,a3
1748e: tstl a3@; 17490..1749a: A069 / A029 lock/unlock
1749e: movew d5,d0; addiw #1008,d0    ; MESSAGE BASE = 1008
174a4..174b6: pea params → movel a3@,d0; A055 — _HLock; jsr a0@
                            ↑ CALLS THE LOADED WDEF RESOURCE'S OWN CODE
174bc: A06A                  ; _HUnlock
174c0: movel d3,sp@(330) → return
```

**Diagnosis.** **Period-faithful trick**: for popup/tab windows, the kDEF
loads a `'WDEF'` resource and then *jumps to it directly* (`jsr a0@` on
the dereferenced handle), passing message-base 1008. This is how
Kaleidoscope's popup/tab theming defers to a "trampoline" WDEF that knows
the popup geometry while inheriting the cicn art from the scheme. The
`-12320` popup-frame / `-12319` tab cicn ids in `kdef231-reference.md §2.6`
are exactly this family.
````

## Cross-references to add (lines 309–311): register narrative

````text
- **§1.1 (CDEF dispatch)** — add row for slot 1 `0x997e` (re-entrant entry,
  saves `a4` via `0x9930`) and row for slot 5 `0x8d36` (scrollbar/slider
  CDEF main, 68-byte aux).
````


## Moved at the main→v2 sync of 2026-10-22 (main #377, `3d846c8e`)

> Verbatim from `docs/spec/kdef-service-handlers.md` on main at `3d846c8e`. The behavioural replacement text
> lives in [`kdef-service-handlers.md`](../kdef-service-handlers.md). Nothing here was re-decoded during the move.

| 8 | `0x17452` | **wnd# → WDEF gate (popup / tab / menu family)** — `GetResource('wnd#', -12320)`; on hit loads `'WDEF', -14336`, locks the handle, calls `a3@→a0; jsr a0@` with varCode `(var & 15) + 1008` (procID family 63; corrected 2026-10-21) — **period-faithful: it calls the real WDEF resource's code, not the kDEF's own renderer**. Used for the `-12320` popup-frame + `-12319` tab family from `kdef231-reference.md §2.6`. On miss → 9-entry private dispatch (`0x174e8`) | — | 30845 | new — adds row to §1.4 |

```
1749e: movew d5,d0; addiw #1008,d0    ; varCode = (fp@(18) & 15) + 1008 (family 63)
```

the dereferenced handle), passing varCode `(var & 15) + 1008` — not a message base: the push order
(`0x174a4` varCode, `0x174a6` window, `0x174a8` message, `0x174ac` param) makes
it the WDEF variation code, so the kDEF sees procID family 63 and sets
`a4@(509)` (`0x3210`; corrected 2026-10-21, lane K PR #377 review). That WDEF
-14336 forwards the varCode unchanged into `0x28e0` is inferred, not shown in
this listing. This is how
…
