# cinf extended-record decode (`0x116f8`, bytes 18..55)

> **TL;DR.** The 2.3.1 kDEF `_GetHandleSize > 18` discriminator at `0x1173e` does **not** gate a Translucency/Opacity-Percentage payload — it gates an **internal RGBColor cache** (6 × `RGBColor` = 36 bytes) that the kDEF *writes* at load time by sampling pixels from the scheme's `ppat`, then *re-reads* during the 9-slice fill path. Scheme Factory's STR# 135 entries 8 ("Translucency Percentage") and 9 ("Opacity Percentage") are **editor UI controls the 2.3.1 binary doesn't consume** — they don't appear in the byte layout the binary writes, and 0/1099 cinfs in the corpus ship percentages at any offset above 17. **Action: document the extension as a binary-internal cache; do NOT extend the decoder or runtime to honor it.**

## 1. The load + discriminator (`0x1171a`)

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

## 2. The 56-byte cache populator

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

**This is a pixel-sample cache, not Translucency/Opacity.** The kDEF computes it lazily on first use and caches it inline in the cinf handle so subsequent draws skip the sample loop.

## 3. Where the cache is consumed

I searched the full 33999-line disassembly for reads at offsets `[18..55]` against any cinf-handle register, in a 200-instruction window after each of the six known callers of `0x116f8` (call sites: `0xca50, 0xca94, 0x10872, 0x10890, 0x11010, 0x1102c`).

**Zero hits.** The cache is consumed only inside `0xfc5c` itself (the sampler reads its own previously-written values when it's invoked multiple times, via the same `%a2` dereference pattern that wrote them). The big chrome-drawing routine `0x11000..0x11600` reads `%a3@(0)` (cornerSize) and `%a3@(1)` (sideThickness) and nothing past byte 17. Title-bar consumer (`0xca50`) reads `%a0@(17)` (low byte of embossPixel.x) and nothing higher.

Concretely: this means **a runtime that recomputes the bg/text/emboss colors at draw time (which Scriptoscope does — via `tools/theme-loader/decoders/ppat.js` + the gamma pipeline) is fully equivalent to a runtime that honors the cache.** There is no consumer-visible behavior gated on the extension bytes.

## 4. STR# 135 reconciliation

`docs/spec/scheme-factory-vocabulary.md` § 7 lists Scheme Factory 1.0pr2's STR# 135 properties:

| # | Property |
|---|---|
| 1 | Corner Size: |
| 2 | Side Thickness: |
| 3 | Tile Sides |
| 4 | Text Pixel: |
| 5 | Embossing Pixel: |
| 6 | Background Pixel: |
| 7 | Pattern Anchor: |
| 8 | Translucency Percentage: |
| 9 | Opacity Percentage: |

Entries 1–7 map bijectively onto `cinf.js` bytes 0..17. Entries 8 and 9 (Translucency / Opacity) have **no presence in the binary's byte layout** above. The 2.3.1 kDEF doesn't `cmpib`/`tstb` any percentage value sourced from a cinf, anywhere — verified via grep for `cmpib #[0-9]{1,3},%a[0-9]@(\d+)` with offsets ≥18, on the entire kdef0.asm.

Possible explanations (we don't have to pick):

1. **STR# 135 over-promises.** Scheme Factory was a 3rd-party editor (kaleidoscope.net) that anticipated features the 2.3.1 runtime never shipped, OR shipped in a later kDEF (2.4+? no decompile exists).
2. **The percentages live in `Colr` / `actb` / `wctb`.** Menu-border alpha-mask cicns (STR# 128 entries 23, 28) are masked via a paired alpha-channel cicn, not via a per-cinf percentage. Translucency could be a property of `Colr`'s alpha bytes, surfaced in the editor as a cinf-adjacent control.
3. **The fields exist in some pre-2.3.1 kDEF.** Aaron / Kaleidoscope 1.8.x is the only other kDEF we have IR for; the inventory note "AppearanceLib: 1.8.2 = 2 imports, 2.3.1 = 19 imports" suggests substantial divergence.

For our runtime, the explanation doesn't matter: **the 2.3.1 kDEF is our authority, and it doesn't consume percentages.** Scriptoscope is a 2.3.1 clean-room reimplementation; we mirror what the binary actually does.

## 5. Corpus survey

Script: `.scratch/cinf-size-survey.mjs` (kept for future re-runs). It parses every bundle's `scheme.rsrc` (or decodes its `scheme.sit` via `tools/sit-wasm`), enumerates `cinf` resources, and tallies raw byte sizes.

| Bundle | cinf count | sizes |
|---|---:|---|
| 1138 | 69 | 18 × 69 |
| 1984 | 66 | 18 × 66 |
| 1990 | 91 | 18 × 91 |
| animals | 80 | 18 × 80 |
| apple-lisa | 46 | 18 × 46 |
| apple-platinum-2 | 15 | 18 × 15 |
| beos-r503 | 86 | 18 × 86 |
| black-platinum | 0 | (no cinfs — corner-sprite scheme) |
| crayon-os | 67 | 18 × 67 |
| dolphin-som | 91 | 18 × 91 |
| evolution | 91 | 18 × 91 |
| **floppies** | **73** | **18 × 72 + 54 × 1** |
| monkey-paradise | 63 | 18 × 63 |
| platinum-8 | 0 | (controls-only) |
| slimes | 0 | (controls-only) |
| system7-nostalgia-silver | 0 | (controls-only) |
| windows-31 | 96 | 18 × 96 |
| windows-95 | 99 | 18 × 99 |

**Totals: 1032 × 18-byte (old format), 1 × 54-byte (floppies, id `-12240` "Root Menu Background"), 0 × 56-byte.**

### The floppies outlier

The single 54-byte cinf (`floppies/-12240`, no name on disk) decodes as:

```
00: 08 08 00 00 00 00 00 07 00 0c 00 08 00 0b 00 09
10: 00 0c                                              ; bytes 16..17 = embossPixel.x (12)
   ; — byte 18 follows ——
12: 90 90 90 90 71 71                                  ; slot 1 (cinf+20..25) RGB(0x9090, 0x9090, 0x7171) tan-gray
18: ff ff ff ff ff ff                                  ; slot 2 (cinf+26..31) RGB white
24: 00 00 00 00 00 00                                  ; slot 3 (cinf+32..37) RGB black
30: ff ff ff ff ff ff                                  ; slot 4 (cinf+38..43) RGB white
36: ff ff ff ff ff ff                                  ; slot 5 (cinf+44..49) RGB white
42: 00 00 00 00 00 00                                  ; slot 6 (cinf+50..55) truncated to 4 bytes on disk
```

The on-disk record is **54 bytes** (not 56) — the trailing word `00 00` of slot 6's blue channel was elided, presumably by Scheme Factory's writer when both inactive-emboss x/y were zero. This is consistent with TMPL 129's variable-length tail (kDEF grows to 56 via `_SetHandleSize` regardless of disk size).

Because the kDEF's `size == 56` discriminator at `0x11796` requires **exactly 56 bytes** to skip the cache populate, even floppies' 54-byte cinf is **overwritten** by the binary at load time. The disk values are effectively dead data — never read by anything other than the kDEF's `_SetHandleSize`-then-rewrite path. (Scheme Factory may write them for round-trip integrity in its own editor, but the runtime ignores them.)

## 6. Recommendation: do not extend the decoder or runtime

**Decision:** keep `tools/theme-loader/decoders/cinf.js` at 18 bytes. Do not add `translucency` / `opacity` fields to `chromeElement`. Do not multiply alpha at blit time.

**Rationale:**

1. **The binary doesn't consume them.** The 2.3.1 kDEF reads bytes 0..17 and nothing else (verified via offset-range grep). It writes bytes 20..55 as a sampled-color cache; those values are recomputable from `bgPixel` / `textPixel` / `embossPixel` + the paired ppat, which Scriptoscope already does.
2. **The corpus doesn't ship them.** 1032 of 1033 cinfs are old-format 18-byte records. The one outlier carries cached RGB triples, not percentages.
3. **STR# 135 entries 8/9 are unresolved.** Without a decompile of Translucency/Opacity *consumers* (none exist in 2.3.1), we'd be modeling a feature with no observable behavior. Adding a runtime path keyed on undocumented bytes would violate "faithful to the decode."

**What we DO update:** `docs/spec/kdef231-reference.md` § 3.5 should reference this doc and replace the placeholder "ext'd colour-pixel record (?)" with the concrete 6-slot RGBColor cache layout pinned in § 2 above.

Future re-investigation triggers:
- If someone surfaces a scheme that renders with menu-border transparency *and* ships ≥56-byte cinfs, re-open this decision.
- If an Aaron-era (1.8.x) kDEF decompile shows percentage reads, document divergence in `kdef-faithfulness-ledger.md`.

## 7. References

- Cinf loader routine: `0x116f8..0x118a0` (`.scratch/k231-kdef/kDEF/k231-kdef0.asm:23192-23332`).
- Pixel sampler `0xfc5c`: per-call writes 6 bytes of RGBColor from a `cicn` host indexed by `(srcY, srcX)` markers + the active/inactive flag at `%a4@(1222)`.
- Six `0x116f8` callers: `0xca50, 0xca94, 0x10872, 0x10890, 0x11010, 0x1102c`.
- Confused inventory note: `docs/spec/kdef-binary-inventory.md` § 2 ("0x118b8 is the cinf consumer") — actually the wnd# dispatcher; the cinf consumer is `0x116f8`. Recommend folding the correction into a later inventory pass.
- Scheme Factory STR# 135: `docs/spec/scheme-factory-vocabulary.md` § 7.
- Existing decoder: `tools/theme-loader/decoders/cinf.js` (unchanged by this investigation).
- Survey reproducer: `.scratch/cinf-size-survey.mjs`.
