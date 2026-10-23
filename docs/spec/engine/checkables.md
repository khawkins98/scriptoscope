# `checkables.draw` — checkbox and radio

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `checkables.draw` |
| family | checkbox and radio |
| message | drawCntl (0); visible checkable variants |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| cited range | `0x66e8..0x6770`, `0x67fc..0x6812`, `0x6c28..0x6d20`, `0x70f6..0x7420`, `0xf4ba..0xf68a`; icon table `0x18b88..0x18bb8` |
| out of scope | hit testing, region calculation, lifecycle/data messages, non-checkable variations, Appearance theme/font setup, exact native glyphs and device colour conversion |

A source-derived drawing contract; no ledger status promotion or original
execution. [qd-primitives.md](qd-primitives.md) supplies the corner blit,
mask-clear region, colour setup and device-dependent transfer semantics.
[push-button.md](push-button.md) §5 supplies the shared text-line arithmetic,
with the checkable-specific x/baseline differences below.
Unresolved branches are explicit in §6.

## 2. Inputs

| input | meaning / domain |
|---|---|
| `visible` | control visibility |
| `variation` | low three bits 1/3 → checkbox, 2/4 → radio; other values outside this unit |
| `hilite` | byte 0..255; 254/255 disabled, other nonzero pressed |
| `value` | signed control value; this unit establishes 0,1,2,3 only |
| `acidAlternate` | successful Gestalt('Acid') supplies a nonzero alternate-mark setting; its producer/meaning remains unresolved |
| `D` | control Rect in port coordinates, half-open |
| `eraseControl` | true for the original per-call erase selector zero; how the caller supplies it is outside this unit |
| `regionRecording` | destination port is recording a region |
| `resources` | typed signed IDs, NULL results and explicit resource-file/cache environment |
| `colorPort`, `lowDepth` | shared device conditions; not control/window activity |
| `colorIconMapAvailable` | shared auxiliary colour-icon pixel map is present |
| `recordingPicture`, `customBottlenecks` | original port transfer conditions |
| label / metrics / colours / clip | actual control text and Toolbox drawing environment; no browser metric equivalence assumed |

Cicn and icon lanes number state tiers differently. Do not expose tier numbers
as a single shared state enum. Public Boolean mapping is declared adapter policy:
mixed → value 2 before checked → value 1; otherwise 0; disabled → hilite 255,
otherwise 0; default alternate setting false. This is not an original caller
observation.

## 3. Outputs

For a visible draw outside region recording: prepare text mode/colours, erase D
when requested, draw label, then try cicn glyph art. A successful cicn path erases
its mask-clear region, draws its complete source bounds 1:1 at the computed
point, releases it and ends the glyph stage. Only a cicn NULL enters the icon
lane, which **re-reads the original control value** before its own conversion
and fallback (`0x71c6..0x71e8`, `0x728c..0x7318`).

Cicn requests use the shared loader's successful Gestalt('Copl') file switch
and cache/Resource Manager path. The icon lane instead selects the System file
(UseResFile(0)) before mask lookup, restoring the old resource file and heap zone
afterwards (`0x7364..0x737e`, `0x7400..0x7406`).
A mask's owner is then used for its same-ID `ics8` request via Get1Resource.
An `ics4` request is **not** made by this helper
(`0xf57c..0xf59c`); choosing the highest decoded colour depth is modern policy.

## 4. Decision tables

### State, lane order and cicn requests

Let `kind = 0` for checkbox, 1 for radio.
`cicnId = −9504 + 12×kind + 3×effectiveValue + cicnTier`.

| # | condition | output | source |
|---|---|---|---|
| CB1 | invisible | no draw callback | `0x67fc..0x6812` |
| CB2 | visible, region recording | FrameRect(D), no label or resource glyph draw | `0x6c34..0x6c5e` |
| CB3 | variation 1/3 or 2/4 | kind 0 or 1 respectively | `0x673c..0x6770` |
| CB4 | hilite 254/255 | disabled true, pressed false; cicnTier 0, iconTier 2 | `0x66e8..0x670c`, `0x7202..0x7208`, `0x7326..0x732c` |
| CB5 | other hilite nonzero | disabled false, pressed true; cicnTier 2, iconTier 1 | `0x670e..0x6718`, `0x71f6..0x7200`, `0x731c..0x7324` |
| CB6 | hilite 0 | cicnTier 1, iconTier 0 | `0x71f6..0x7208`, `0x731c..0x732c` |
| CB7 | before glyph selection | optional erase D, label first; disabled TextMode 49, otherwise 1 | `0x71c6..0x71e8` |
| CB8 | cicn lane, value 1, acidAlternate true, checkbox | effectiveValue 3; radio remains 1 | `0x720a..0x7232` |
| CB9 | effectiveValue 2 or 3 | request cicnId; on NULL set effectiveValue 1, preserving kind and tier | `0x7234..0x7264` |
| CB10 | no cicn yet | request computed cicnId; no normal-tier or unchecked retry | `0x7266..0x728a` |
| CB11 | cicn found | erase translated mask-clear region; corner blit full bounds; release, no icon fallback | `0x728c..0x7310` |
| CB12 | cicn NULL | enter icon lane with original value, independent of CB9's retry | `0x7314..0x7318` |

CB9 success uses the already loaded cicn without another request.
Neither a malformed resource nor a failed decoder establishes native NULL.
Unknown/ambiguous provider results must stay unresolved, not fall through
as a proven missing resource.

### Icon ID table and fallback

| kind | icon tier | value 0 | value 1 | value 2 | value 3 | source |
|---|---|---:|---:|---:|---:|---|
| checkbox | normal 0 | −10236 | −10235 | −10234 | −10233 | `0x18b88..0x18b90` |
| checkbox | pressed 1 | −10232 | −10231 | −10230 | −10229 | `0x18b90..0x18b98` |
| checkbox | disabled 2 | −10240 | −10239 | −10238 | −10237 | `0x18b98..0x18ba0` |
| radio | normal 0 | −10220 | −10219 | −10218 | −10219 | `0x18ba0..0x18ba8` |
| radio | pressed 1 | −10216 | −10215 | −10214 | −10215 | `0x18ba8..0x18bb0` |
| radio | disabled 2 | −10224 | −10223 | −10222 | −10223 | `0x18bb0..0x18bb8` |

| # | condition | output | source |
|---|---|---|---|
| CB13 | icon lane, original value 1, acidAlternate true | effectiveValue 3 for **either** kind | `0x7380..0x73a2` |
| CB14 | effectiveValue 2/3 | probe selected `ics#`; NULL → value 1 at same kind/tier | `0x73a4..0x73d8` |
| CB15 | final icon selection | selected table ID; helper requests its `ics#` again, including after successful CB14 probe | `0x73da..0x73fa`, `0xf50c..0xf51e` |
| CB16 | final mask missing | no icon art; no another state/value retry | `0xf51a..0xf51e` |
| CB17 | lowDepth, or not a colour port | no `ics8` lookup; use selected mask resource's 1-bit image | `0xf4fa..0xf50a`, `0xf574..0xf57a`, `0xf5c6..0xf61a` |
| CB18 | colour port, not lowDepth | same-ID `ics8` from selected mask's HomeResFile via Get1Resource; restore current file | `0xf57c..0xf59c` |
| CB19 | `ics8` NULL or colourIconMapAvailable false | use 1-bit image; missing colour art is not the CB14 mask-NULL retry | `0xf5bc..0xf5c6` |
| CB20 | 1-bit image, mask all set or picture recording or custom bottlenecks | CopyBits srcCopy, no mask region | `0xf52e..0xf554`, `0xf5dc..0xf604` |
| CB21 | other 1-bit image transfer | CopyMask with selected `ics#` mask | `0xf606..0xf61a` |
| CB22 | colour image, mask all set or picture recording | CopyBits srcCopy | `0xf61e..0xf652` |
| CB23 | other colour image transfer | CopyMask; custom bottlenecks alone do not change this colour branch | `0xf654..0xf66a` |
| CB24 | icon lane, before final art | erase the icon lane's 16×12 rect, then extend destination bottom by 4 to a 16×16 rect (§5); no opacity cropping | `0x732e..0x7360`, `0x18bb8..0x18bc0` |

“All set” means every one of the 256 mask bits is one. Colour/1-bit source
frame is 16×16 (`0x18abc..0x18ac4`); it scales to CB24's 16×16 destination.
Transfer results still depend on original QuickDraw and destination colour
conditions; these operations alone do not establish modern pixel equivalence.

## 5. Geometry

For a cicn with full bounds S:
`w = S.right−S.left`, `h = S.bottom−S.top`,
`glyphX = D.left + 8 − trunc(w/2)`,
`glyphY = trunc((D.top+D.bottom−h)/2)`
(`0x72a0..0x72d2`).
Draw full S at this point, first erasing its mask-clear region
(`0x72d4..0x72fe`). Nonzero source bounds remain inputs to the primitive;
do not crop to mask-set bounds.

For the icon lane:
`y = floor((D.top+D.bottom−12)/2)`;
erase Rect `{left:D.left, top:y, right:D.left+16, bottom:y+12}`;
draw into the same rect extended to `bottom:y+16`
(`0x7102..0x7108`, `0x732e..0x7360`, `0x18bb8..0x18bc0`).
The vertical division here rounds down, unlike cicn positioning's truncation
toward zero. Source data declares the initial 12×12 rect; the separate icon
helper uses a 16×16 source frame (`0x18abc..0x18ac4`).

For the ordinary checkable label (no special adornments), x is always
`D.left + 18`, including a (+1,+1) offset only when explicitly invoked as
a shared emboss pass. This callback invokes one plain label pass. Baselines
use [push-button.md](push-button.md) §5's shared formula **without** the
push-only one-pixel correction for lineHeight < 13. Clip is old clip ∩ D
(`0x7028..0x7036`, `0x7060..0x706c`, `0x70a6..0x70ba`).

All formulas assume no intermediate coordinate-word overflow; signed wrapping
and extreme/negative sizes need an explicit extension before implementation.

## 6. Not decoded / unknown; corpus impact

- Value outside 0..3 is not given safe icon-table semantics. Stop rather than
  indexing outside the decoded table, clamping or inventing an unchecked state.
- The producer/meaning of acidAlternate is not decoded. False is a declared
  default, not evidence it can never be true. CB8 and CB13 differ for radio.
- Appearance/OSDispatch setup, font-style selection, original label glyphs,
  device palette, resource-cache provider identity and invalid allocations are
  not proven by this unit. Caller erase-selector construction also remains open.
- The engine archive/base chain is a modern declared environment. The original
  System-file search for icons and mask-owner-only `ics8` lookup must remain
  visible in the trace; selecting any available `ics4`/`ics8` is a divergence.
  Control-panel art is not shipped (DECISIONS #5).
- Current public compatibility may retry a normal-tier cicn before icon fallback
  and use browser label placement. Those policies are separate from CB10/CB12
  and §5; no source claim authorizes that extra retry.
- Independent verifier and separate test author remain prerequisites. No
  native execution, runtime/test edits or self-review are included here.

Corpus partition (own-fork presence and declared public inputs only):

| rows | archives / impact |
|---|---|
| CB11 cicn lane | 1138, 1984, 1990, animals, apple-lisa, beos-r503, crayon-os, dolphin-som, evolution, floppies, monkey-paradise, windows-31, windows-95 (13) |
| CB12 icon lane | apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver (5) |
| CB9 mixed → checked cicn retry | animals radio mixed, normal and disabled (2 of 216 public rows) |
| CB14 missing mixed mask | no declared public corpus row; synthetic missing-mask input required |
| CB8/CB13 alternate; pressed tier | outside current public Boolean matrix; explicit conditioned inputs required |
| CB15–CB23 original provider/device selection | presence of decoded art alone does not exercise original System/owner/depth behavior |

The 216 public rows are 18 archives × 2 kinds × 3 values × 2 states,
not 216 independently observed original controls. Existing checkable rules
record identical-art ambiguity and unexercised branches.

## 7. Test hooks

Separate author must map CB1–CB24 and all six icon-table rows to assertions,
then record mutations. Existing `checkable-rules.mjs` is an independent source
table for selection, not a complete original rendering oracle.

| rows | mutation / distinguishing input |
|---|---|
| CB1–CB7 | flip visibility, recording shape, variant kind, disabled/pressed precedence or text/erase order; test 254 and 255 separately |
| CB8–CB12 | swap tiers, remove same-tier mixed retry, retry unchecked, preserve CICN-lane retry value into icon lane, or invent normal-tier retry; animals radio and synthetic sparse resources discriminate |
| six icon rows | alter each literal; independently hashed 48-byte table plus distinct per-ID art |
| CB13–CB16 | checkbox-only alternate rule in icon lane, missing mask vs missing colour, remove repeated mask request; synthetic value-3 radio and mask lookup transcript |
| CB17–CB19 | request `ics4`, search `ics8` outside mask owner, prefer colour at lowDepth, omit 1-bit fallback; conditioned provider/device transcripts |
| CB20–CB23 | flip CopyBits/CopyMask, all-set-mask test, picture/custom condition; partial mask and poisoned background |
| CB24 / geometry | use 16 instead of 12 in icon centering, symmetric erase height, floor instead of trunc for negative cicn placement, crop bounds, shift label x; odd/negative coordinates and mask holes |

New geometry, transfer and provider rows require independent source re-tracing;
the test author must keep unsupported native pixel claims unknown.

