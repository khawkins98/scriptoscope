# cinf-extended-decode — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/cinf-extended-decode.md` at v2 commit `1183816e`. The behavioural replacement text lives in
> [`cinf-extended-decode.md`](../cinf-extended-decode.md). Nothing here was re-decoded during the move; verifier
> CONFIRMED/REFUTED marks are added by the verifying lane.

## 1. The load + discriminator (original, lines 7–30)

````text
The cinf loader is the routine at **`0x116f8`** (entry `linkw fp,#-8`). The annotation in `docs/spec/kdef-binary-inventory.md` § 2 calls `0x118b8` "the cinf consumer" — that's shorthand for the wnd# dispatcher (`0x118b8` actually loads `'wnd#'` at `0x118e4: movel #0x776e6423,sp@-`). The thing that loads + parses + extends a cinf is `0x116f8`.

Cite (`.scratch/k231-kdef/kDEF/k231-kdef0.asm` lines 23192–23332):

```
116f8:  4e56 fff8        linkw  fp,#-8                ; entry
1171a:  2f3c 6369 6e66   movel  #'cinf',sp@-
11720:  3f07             movew  d7,sp@-               ; d7 = caller-passed id
11722:  a9a0             _GetResource
11724:  245f             moveal sp@+,a2                ; a2 = cinf handle
11726:  200a             movel  a2,d0
11728:  6700 0168        beqw   0x11892               ; null → exit
1172c:  2f0a             movel  a2,sp@-
1172e:  a9a2             _DetachResource
11730:  204a             moveal a2,a0
11732:  a04a             _HLock
11734:  594f             subqw  #4,sp
11736:  2f0a             movel  a2,sp@-
11738:  61ff fffe ec66   bsrl   0x3a0                  ; _GetHandleSize wrapper → d0
1173e:  201f             movel  sp@+,d0
11740:  7212             moveq  #18,d1
11742:  b081             cmpl   d1,d0
11744:  6e3c             bgts   0x11782               ; size > 18 → skip "grow to 20"
```
````

## 1. The load + discriminator (original, lines 32–57)

````text
When `size ≤ 18` (the OLD format the corpus actually ships), the binary runs the patch block at `0x11746..0x11780`:

```
11746:  204a             moveal a2,a0
11748:  7014             moveq  #20,d0
1174a:  a024             _SetHandleSize                 ; grow handle to 20 bytes
1174c:  2052             moveal a2@,a0
1174e:  4268 0012        clrw   a0@(18)                 ; zero the new word at byte 18
11752:  0c47 d030        cmpiw  #-12240,d7
11756:  6d2a             blts   0x11782
11758:  0c47 d040        cmpiw  #-12224,d7
1175c:  6c24             bges   0x11782
1175e:  203c 7057 696e   movel  #'pWin',d0
11764:  43ee fffc        lea    fp@(-4),a1
11768:  a1ad             _Get1NamedResource             ; (or similar)
1176a:  2288             movel  a0,a1@
1176c:  4a40             tstw   d0
1176e:  6612             bnes   0x11782
11770:  206e fffc        moveal fp@(-4),a0
11774:  4a28 000f        tstb   a0@(15)
11778:  6708             beqs   0x11782
1177a:  2252             moveal a2@,a1
1177c:  3368 0010 0012   movew  a0@(16),a1@(18)         ; pWin@16 → cinf@18
```

This is a **legacy compatibility patch** for cinf ids in `-12240..-12225` (system window range, per § 2.5 of `kdef231-reference.md`): the kDEF copies a 16-bit field from a paired `'pWin'` resource into the freshly-cleared word at cinf+18. **There is no Translucency or Opacity in this path.** Byte 18 is a back-filled `pWin`-derived word.
````

## 2. The 56-byte cache populator (original, lines 61–120)

````text
If a second-stage flag is set (`tstb fp@(10)` at `0x11782`), the binary considers extending the record further:

```
11782:  4a2e 000a        tstb   fp@(10)
11786:  6700 010a        beqw   0x11892
1178a:  594f             subqw  #4,sp
1178c:  2f0a             movel  a2,sp@-
1178e:  61ff fffe ec10   bsrl   0x3a0                   ; _GetHandleSize again
11794:  201f             movel  sp@+,d0
11796:  7238             moveq  #56,d1
11798:  b081             cmpl   d1,d0
1179a:  6700 00f6        beqw   0x11892                 ; size == 56 → already populated, exit
1179e:  3f07             movew  d7,sp@-
117a0:  4eba ecd0        jsr    pc@(0x10472)            ; load matching cicn (ppat host)
117a4:  2648             moveal a0,a3
117b2:  204a             moveal a2,a0
117b4:  7038             moveq  #56,d0
117b6:  a024             _SetHandleSize                  ; grow cinf to 56 bytes
117bc:  2612             movel  a2@,d3                  ; ← begin write loop
117be:  2043             moveal d3,a0
117c0:  4868 0014        pea    a0@(20)                 ; dst = cinf+20  (slot 1)
117c4:  3f28 0006        movew  a0@(6),sp@-             ; bgPixel.y (cinf+6)
117c8:  3f28 0008        movew  a0@(8),sp@-             ; bgPixel.x (cinf+8)
117cc:  2f0b             movel  a3,sp@-                 ; cicn handle
117ce:  4eba e48c        jsr    pc@(0xfc5c)             ; sample pixel → write RGBColor at dst
117d2:  ...
117d6:  4868 001a        pea    a0@(26)                 ; dst = cinf+26  (slot 2)
117da:  3f28 000a        movew  a0@(10),sp@-            ; textPixel.y (cinf+10)
117de:  3f28 000c        movew  a0@(12),sp@-            ; textPixel.x (cinf+12)
...
117e8:  2612             movel  a2@,d3                  ; emboss slot — has fallback
117ea:  2043             moveal d3,a0
117ec:  4a68 0010        tstw   a0@(16)                 ; embossPixel.x == 0?
117f0:  4fef 0018        lea    sp@(24),sp
117f4:  6610             bnes   0x11806
117f6:  2043             moveal d3,a0
117f8:  4a68 000e        tstw   a0@(14)                 ; embossPixel.y == 0?
117fc:  6608             bnes   0x11806
117fe:  317c 1234 0020   movew  #0x1234,a0@(32)         ; sentinel: no emboss color
11804:  6018             bras   0x1181e
11806:  ...                                              ; dst = cinf+32 (slot 3), sample emboss
1181e:  197c 0001 04c6   moveb  #1,a4@(1222)            ; flip active/inactive flag → INACTIVE pass
11824:  ...                                              ; dst = cinf+38 (slot 4) bg, inactive
1183a:  ...                                              ; dst = cinf+44 (slot 5) text, inactive
11850:  ...                                              ; dst = cinf+50 (slot 6) emboss, inactive
11886:  1947 04c6        moveb  d7,a4@(1222)            ; restore active/inactive flag
```

The dst offsets `20, 26, 32, 38, 44, 50` are **6 bytes apart** — each slot is one `RGBColor` (`{red:WORD, green:WORD, blue:WORD}` = 6 bytes). Six slots × 6 bytes = 36 bytes of cache, appended at byte 20..55 (the byte-18 word stays the patched `pWin` value from § 1).

The two passes are gated by the **active/inactive global at `%a4@(1222)`** — `0xfc5c` (the per-pixel sampler) consults this byte at `0xfcc8 tstb %a4@(1222)` and picks the active vs inactive `Colr`-mapped channel. So the 6 slots decompose as:

| Offset | Slot | Source pixel | State |
|---|---|---|---|
| `[20..25]` | bg color, active | (cinf+6 `bgPixelY`, cinf+8 `bgPixelX`) | active (`a4@(1222) = d7 saved`) |
| `[26..31]` | text color, active | (cinf+10, cinf+12) | active |
| `[32..37]` | emboss color, active | (cinf+14, cinf+16), or `0x1234`-magic if both zero | active |
| `[38..43]` | bg color, inactive | (cinf+6, cinf+8) | inactive (`a4@(1222) = 1`) |
| `[44..49]` | text color, inactive | (cinf+10, cinf+12) | inactive |
| `[50..55]` | emboss color, inactive | (cinf+14, cinf+16) | inactive |
````

## 3. Where the cache is consumed (original, lines 126–128)

````text
I searched the full 33999-line disassembly for reads at offsets `[18..55]` against any cinf-handle register, in a 200-instruction window after each of the six known callers of `0x116f8` (call sites: `0xca50, 0xca94, 0x10872, 0x10890, 0x11010, 0x1102c`).

**Zero hits.** The cache is consumed only inside `0xfc5c` itself (the sampler reads its own previously-written values when it's invoked multiple times, via the same `%a2` dereference pattern that wrote them). The big chrome-drawing routine `0x11000..0x11600` reads `%a3@(0)` (cornerSize) and `%a3@(1)` (sideThickness) and nothing past byte 17. Title-bar consumer (`0xca50`) reads `%a0@(17)` (low byte of embossPixel.x) and nothing higher.
````

## 4. STR# 135 reconciliation (original, line 148)

````text
Entries 1–7 map bijectively onto `cinf.js` bytes 0..17. Entries 8 and 9 (Translucency / Opacity) have **no presence in the binary's byte layout** above. The 2.3.1 kDEF doesn't `cmpib`/`tstb` any percentage value sourced from a cinf, anywhere — verified via grep for `cmpib #[0-9]{1,3},%a[0-9]@(\d+)` with offsets ≥18, on the entire kdef0.asm.
````

## 7. References (original, lines 223–224)

````text
- Cinf loader routine: `0x116f8..0x118a0` (`.scratch/k231-kdef/kDEF/k231-kdef0.asm:23192-23332`).
- Pixel sampler `0xfc5c`: per-call writes 6 bytes of RGBColor from a `cicn` host indexed by `(srcY, srcX)` markers + the active/inactive flag at `%a4@(1222)`.
````

## Survey reproducer path (original)

````text
- Survey reproducer: `.scratch/cinf-size-survey.mjs`.
````

## Survey script path (original)

````text
Script: `.scratch/cinf-size-survey.mjs` (kept for future re-runs). It parses
````

## Corrections (2026-10-21 review round; the passages above stay verbatim)

- `0x11768` `.short 0xa1ad` is **`_Gestalt`** per Universal Interfaces `Traps.h`
  (`_Get1NamedResource` is `$A820`). The surrounding sequence (selector `'pWin'`
  in the selector register, the response stored through a frame local, the
  returned error tested before the response is dereferenced) is Gestalt glue.
  `'pWin'` is therefore a Gestalt selector whose response is used as a pointer to
  a record (byte 15 tested, word 16 copied to cinf byte 18), not a resource.
- `0x1172e` `$A9A2` is **`_LoadResource`** (not `_DetachResource`, which is
  `$A992`); `0x11732` `$A04A` is **`_HNoPurge`** (not `_HLock`, which is `$A029`).
- The size compare is `0x11740`–`0x11744` (`0x1173e` pops the size result).
