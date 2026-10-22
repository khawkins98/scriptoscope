# cinf extended-record decode (`0x116f8`, bytes 18..55)

> **TL;DR.** The 2.3.1 kDEF `_GetHandleSize > 18` discriminator at `0x1173e` does **not** gate a Translucency/Opacity-Percentage payload — it gates an **internal RGBColor cache** (6 × `RGBColor` = 36 bytes) that the kDEF *writes* at load time by sampling pixels from the scheme's `ppat`, then *re-reads* during the 9-slice fill path. Scheme Factory's STR# 135 entries 8 ("Translucency Percentage") and 9 ("Opacity Percentage") are **editor UI controls the 2.3.1 binary doesn't consume** — they don't appear in the byte layout the binary writes, and 0/1099 cinfs in the corpus ship percentages at any offset above 17. **Action: document the extension as a binary-internal cache; do NOT extend the decoder or runtime to honor it.**

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/cinf-extended-decode.evidence.md`](engine/cinf-extended-decode.evidence.md) — spec writers and verifiers only.*

## 1. The load + discriminator (`0x1171a`)

The cinf loader is the routine at **`0x116f8`**. The annotation in `docs/spec/kdef-binary-inventory.md` § 2 calls `0x118b8` "the cinf consumer" — that's shorthand for the wnd# dispatcher (`0x118b8` actually loads `'wnd#'` at `0x118e4`). The thing that loads + parses + extends a cinf is `0x116f8`.

Load sequence (`0x116f8..0x11744`; listing detail in evidence):

1. `_GetResource` (`$A9A0`) on `'cinf'` with the caller-passed id (`0x1171a`); a null handle exits the routine (`0x11892`).
2. `_LoadResource` (`$A9A2`), then `_HNoPurge` (`$A04A`) on the handle (names per Traps.h; formerly misread as `_DetachResource` / `_HLock`, *re-verify* any claim that rested on detaching or locking).
3. `_GetHandleSize` (via the wrapper at `0x3a0`); the result is compared against 18 at `0x11740`–`0x11744`. Size > 18 skips the "grow to 20" patch and goes to § 2's check at `0x11782`.

When `size ≤ 18` (the OLD format the corpus actually ships), the binary runs the patch block at `0x11746..0x11780`:

1. `_SetHandleSize` (`$A024`) grows the handle to 20 bytes and the new word at byte 18 is zeroed.
2. If the cinf id is in `-12240..-12225` (i.e. ≥ `-12240` and < `-12224`), the kDEF calls `_Gestalt` (`$A1AD` at `0x11768`, per Traps.h) with selector `'pWin'`. If Gestalt returns no error and byte 15 of the record its response points to is non-zero, the word at offset 16 of that record is copied into cinf byte 18 (`0x1177c`). Otherwise byte 18 stays zero. *(Corrected 2026-10-21: this was previously read as a paired `'pWin'` resource fetch via `_Get1NamedResource`, which is `$A820`. What the `'pWin'` Gestalt record is, and which component registers it, is not decoded — re-verify.)*

This is a **legacy compatibility patch** for cinf ids in `-12240..-12225` (system window range, per § 2.5 of `kdef231-reference.md`): the kDEF copies a 16-bit field from the `'pWin'` Gestalt response record into the freshly-cleared word at cinf+18. **There is no Translucency or Opacity in this path.** Byte 18 is a back-filled word from that record.

## 2. The 56-byte cache populator

If a second-stage flag is set (tested at `0x11782`), the binary considers extending the record further (`0x11782..0x11886`; listing detail in evidence):

1. `_GetHandleSize` again; if the size is **exactly 56**, the cache is already populated and the routine exits (`0x1179a` → `0x11892`).
2. Load the matching cicn (the ppat host) via `0x10472` (`0x117a0`).
3. `_SetHandleSize` grows the cinf to 56 bytes (`0x117b6`).
4. Write loop (from `0x117bc`): for each slot, the pixel sampler `0xfc5c` samples the cicn at a (y, x) marker taken from the cinf and writes one `RGBColor` at the slot's destination offset:
   - slot 1 → cinf+20, marker bgPixel (y = cinf+6, x = cinf+8);
   - slot 2 → cinf+26, marker textPixel (y = cinf+10, x = cinf+12);
   - slot 3 → cinf+32, marker embossPixel (y = cinf+14, x = cinf+16) — **fallback:** if embossPixel.x and embossPixel.y are both zero, the sentinel word `0x1234` is written at cinf+32 instead (`0x117fe`: "no emboss color") and sampling is skipped.
5. At `0x1181e` the active/inactive flag is set to 1 (INACTIVE pass), and slots 4–6 (cinf+38 bg, cinf+44 text, cinf+50 emboss) are sampled the same way (`0x11824`, `0x1183a`, `0x11850`).
6. At `0x11886` the active/inactive flag is restored.

The dst offsets `20, 26, 32, 38, 44, 50` are **6 bytes apart** — each slot is one `RGBColor` (`{red:WORD, green:WORD, blue:WORD}` = 6 bytes). Six slots × 6 bytes = 36 bytes of cache, appended at byte 20..55 (the byte-18 word stays the value back-filled from the `'pWin'` Gestalt record in § 1).

The two passes are gated by the **active/inactive global flag** — `0xfc5c` (the per-pixel sampler) consults this flag at `0xfcc8` and picks the active vs inactive `Colr`-mapped channel. So the 6 slots decompose as:

| Offset | Slot | Source pixel | State |
|---|---|---|---|
| `[20..25]` | bg color, active | (cinf+6 `bgPixelY`, cinf+8 `bgPixelX`) | active (flag at its restored/saved value) |
| `[26..31]` | text color, active | (cinf+10, cinf+12) | active |
| `[32..37]` | emboss color, active | (cinf+14, cinf+16), or `0x1234`-magic if both zero | active |
| `[38..43]` | bg color, inactive | (cinf+6, cinf+8) | inactive (flag = 1) |
| `[44..49]` | text color, inactive | (cinf+10, cinf+12) | inactive |
| `[50..55]` | emboss color, inactive | (cinf+14, cinf+16) | inactive |

**This is a pixel-sample cache, not Translucency/Opacity.** The kDEF computes it lazily on first use and caches it inline in the cinf handle so subsequent draws skip the sample loop.

## 3. Where the cache is consumed

I searched the full 33999-line disassembly for reads at offsets `[18..55]` of the cinf handle, in a 200-instruction window after each of the six known callers of `0x116f8` (call sites: `0xca50, 0xca94, 0x10872, 0x10890, 0x11010, 0x1102c`).

**Zero hits.** The cache is consumed only inside `0xfc5c` itself (the sampler reads its own previously-written values when it's invoked multiple times, through the same cinf-handle dereference that wrote them). The big chrome-drawing routine `0x11000..0x11600` reads cinf byte 0 (cornerSize) and byte 1 (sideThickness) and nothing past byte 17. Title-bar consumer (`0xca50`) reads byte 17 (low byte of embossPixel.x) and nothing higher.

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

Entries 1–7 map bijectively onto `cinf.js` bytes 0..17. Entries 8 and 9 (Translucency / Opacity) have **no presence in the binary's byte layout** above. The 2.3.1 kDEF doesn't compare or test any percentage value sourced from a cinf, anywhere — verified via an offset-range search (offsets ≥18) over the entire 2.3.1 kDEF listing (search pattern in evidence).

Possible explanations (we don't have to pick):

1. **STR# 135 over-promises.** Scheme Factory was a 3rd-party editor (kaleidoscope.net) that anticipated features the 2.3.1 runtime never shipped, OR shipped in a later kDEF (2.4+? no decompile exists).
2. **The percentages live in `Colr` / `actb` / `wctb`.** Menu-border alpha-mask cicns (STR# 128 entries 23, 28) are masked via a paired alpha-channel cicn, not via a per-cinf percentage. Translucency could be a property of `Colr`'s alpha bytes, surfaced in the editor as a cinf-adjacent control.
3. **The fields exist in some pre-2.3.1 kDEF.** Aaron / Kaleidoscope 1.8.x is the only other kDEF we have IR for; the inventory note "AppearanceLib: 1.8.2 = 2 imports, 2.3.1 = 19 imports" suggests substantial divergence.

For our runtime, the explanation doesn't matter: **the 2.3.1 kDEF is our authority, and it doesn't consume percentages.** Scriptoscope is a 2.3.1 clean-room reimplementation; we mirror what the binary actually does.

## 5. Corpus survey

A local survey script (location in the evidence appendix) parses every bundle's `scheme.rsrc` (or decodes its `scheme.sit` via `tools/sit-wasm`), enumerates `cinf` resources, and tallies raw byte sizes.

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

- Cinf loader routine: `0x116f8..0x118a0` (listing location in evidence).
- Pixel sampler `0xfc5c`: per-call writes 6 bytes of RGBColor from a `cicn` host indexed by `(srcY, srcX)` markers + the active/inactive global flag.
- Six `0x116f8` callers: `0xca50, 0xca94, 0x10872, 0x10890, 0x11010, 0x1102c`.
- Confused inventory note: `docs/spec/kdef-binary-inventory.md` § 2 ("0x118b8 is the cinf consumer") — actually the wnd# dispatcher; the cinf consumer is `0x116f8`. Recommend folding the correction into a later inventory pass.
- Scheme Factory STR# 135: `docs/spec/scheme-factory-vocabulary.md` § 7.
- Existing decoder: `tools/theme-loader/decoders/cinf.js` (unchanged by this investigation).
- Survey reproducer: a local survey script (location in the evidence appendix).
