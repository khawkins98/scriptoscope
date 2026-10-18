# cinf body dispatch: source evidence and limits

This corrects the earlier branch interpretation under [#218](https://github.com/khawkins98/scriptoscope/issues/218).
The `cinf` header contains independent edge-repeat and body-mode fields. A
background resource ID is **not restricted to mode 5**. Mode 5 requests a color
icon; the other modes request a pixel pattern. No runtime behavior changes with
this evidence correction, and the pattern-backed face approximation remains open.

The earlier five-theme survey and claim that all bodies come from their face
interiors are superseded by the pinned 18-fork survey below. The previous
identification of `$AA25` as `SetBackPixPat` was also wrong: it disposes a color
icon. Do not implement body filling from the previous prose or from the legacy
`resizeBehavior` label names.

## Primary identities

Offline inspection uses Kaleidoscope 2.3.1 `kDEF 0`, 107,726 bytes, SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
Addresses are file offsets in the extraction described in
[kdef-binary-inventory.md](./kdef-binary-inventory.md). Original code is neither
executed nor included here. Push faces (`0x7572..0x7594`) and bevel faces
(`0x7770..0x7778`) call the body-enabled wrapper `0x10fc0 → 0x107fe`.
That establishes this painter's relevance to those callers, not to list headers
or segmented tabs.

Apple Universal Interfaces 3.4.1 supplies the trap identities, from
[Traps.h](https://github.com/elliotnunn/UniversalInterfaces/blob/328d38f2b72b2d4ceda30170eea32ca6b9de218a/3.4.1/Universal/Interfaces/CIncludes/Traps.h)
(Apple header preserved in a source mirror; file SHA-256
`53f1e9da1006604b006aa152bd79efda6cda548a928fe5aac7624ca41f9b0168`).
Relevant identities: `$AA0C` GetPixPat, `$AA1E` GetCIcon, `$AA25` DisposeCIcon,
`$AA08` DisposePixPat, `$AA0E` FillCRect, `$A8A5` FillRect,
`$A8B2` EraseRoundRect, `$AA14/$AA15` RGBForeColor/RGBBackColor.
Trap names establish API identity; they do not by themselves establish all
QuickDraw transfer, palette or mask semantics.

## Address-backed decision table

Let `c` be header byte 0 (corner), `s` byte 1 (side), `tile` byte 2,
`mode` byte 3, and `backgroundId` the signed big-endian word at bytes 4–5.
`D` is the caller's destination Rect; source sample coordinates occupy bytes
6–17 and are color samples, not evidence of destination text placement.

| Condition | Original path | Established requirement |
| --- | --- | --- |
| Body flag false | `0x109aa..0x109ae → 0x10bc0` | Ring wrapper skips body work; border work continues. |
| Body enabled, `mode == 5` | Compare at `0x109be`; equality falls through `0x109c8..0x109d0` | Pass `backgroundId` to `0x10472`, whose uncached lookup uses GetCIcon at `0x10698`. This is a **cicn** request. |
| Mode 5 icon found | `0x109da..0x10a1a` | Source Rect comes from the icon's bitmap bounds at offsets70/74; destination is inset by `s` on all four sides. Call `0xfdf8`, then DisposeCIcon at `0x10a14`. This is not a ppat fill or the inset-cross union. |
| Mode 5 icon absent | `0x109d8 → 0x10a1e..0x10a66` | Erase the two inset rectangles described below using the sampled background. |
| Body enabled, `mode != 5` | `0x109c4 → 0x10a6c` | Pass the **same** `backgroundId` to cached `0xeeea` or uncached `0x10440`, selected by `a4+1220`. Both use GetPixPat (`0xef24`, `0x10460`). This is a **ppat** request. |
| Pixel pattern found | `0x10a96..0x10b5a` | Select phase from `mode`, then fill the two inset rectangles through `0xf930`. |
| Pixel pattern absent | `0x10a9a → 0x10b72..0x10bb8` | Erase the two inset rectangles using the sampled background. |

A zero background ID is still passed to the loader in these paths; the source
shown does not special-case zero as “none.” Same-fork absence alone cannot prove
absence from the original Resource Manager's search chain.

The two rectangles, relative to D's top-left, are
`(c,s,W−2c,H−2s)` and `(s,c,W−2s,H−2c)`. The second is skipped when `c == s`.
The solid fallback calls EraseRoundRect with both oval dimensions zero, so the
previously implemented [solid inset-union geometry](./control-face-geometry.md)
is unchanged by correcting the trap name. These rectangles are followed by the
square-corner/independent-band border painter, not a rectangular nine-slice.

### Pixel-pattern phase

Only the non-5, successfully loaded ppat path reaches this switch:

| Mode byte | Phase argument `(x,y)` | Address |
| --- | --- | --- |
| 1 | `(D.left,D.top)` | `0x10ac8` |
| 2 | `(D.right,D.top)` | `0x10ad2` |
| 3 | `(D.left,D.bottom)` | `0x10adc` |
| 4 | `(D.right,D.bottom)` | `0x10ae8` |
| 0 or 6–255 | `(0,0)` | `0x10af4` |

`0x10b14..0x10b22` passes phase and first rectangle to `0xf930`; the transposed
rectangle follows at `0x10b48..0x10b56`. That helper adjusts port origin and
rectangle coordinates before `0xf7cc`, then restores them. `0xf7cc` has a
FillCRect path at `0xf85e` and a separate FillRect path at `0xf848` selected by
`a4+1222`. The phase arguments are established; translating all port-origin,
clip-region, color-depth and alternate-path behavior into canvas pixel indices
still needs its own hand-derived requirements. No full pattern implementation is
certified by this table.

### Edge repeat is separate

Byte 2 is tested as zero/nonzero at the four edge branches (`0x10cf0`,
`0x10e4e`, `0x10ec6`, `0x10f3e`). Zero reduces the source middle to its first
column/row; nonzero repeats the full middle strip through `0xfeae`. It is not
whole-band scaling. See the independently tested
[control-face geometry](./control-face-geometry.md). The additional byte-2 test
at `0x10bc6` precedes corner painting; it must not be described as a fifth edge.

## Reproducible current corpus survey

Run from the repository root:

```sh
node scripts/survey-cinf-body.mjs > /tmp/cinf-body-observations.json
```

The script reads raw fields directly, without `decodeCinf`, generated theme
manifests, role labels or compositor output. It enumerates containers and uses
the existing explicit archive/entry/fork pins in
[`source-choices.json`](../../tests/control-availability/source-choices.json),
whose file SHA-256 for this survey is
`fdec3d378ec944d9718b148c3a1e199b5d3a1354de029b65348ee4132a3c8b88`.
It fails on archive/entry/fork drift. The JSON retains each payload hash, parser
occurrence, raw fields, same-ID cicn/ppat candidates, source pins and tool hashes.
The source-choice registry remains `draft-requires-review`; this survey does not
promote its choices, runtime selection or decoder correctness to verified.
Archive extraction and resource parsing are shared tools, explicitly not an
independent decoder oracle.

`mode:count` below counts all cinf records, not only control faces. “No local
candidate” means a nonzero background ID has no same-fork candidate of the type
requested by the table; it says nothing about inherited/system resources.

| Scheme | cinf records | Raw mode:count | Nonzero background ID | No local candidate |
| --- | ---: | --- | ---: | ---: |
| 1138 | 69 | 0:69 | 0 | 0 |
| 1984 | 66 | 0:66 | 3 | 0 |
| 1990 | 91 | 0:82, 1:3, 2:3, 3:2, 4:1 | 13 | 3 |
| Animals | 80 | 0:64, 1:15, 2:1 | 17 | 2 |
| Apple Lisa | 46 | 0:40, 1:6 | 4 | 2 |
| Apple Platinum 2 | 15 | 0:15 | 0 | 0 |
| BeOS R5.0.3 | 86 | 0:86 | 0 | 0 |
| Black Platinum | 0 | — | 0 | 0 |
| Crayon OS | 67 | 0:67 | 42 | 0 |
| Dolphin SOM | 91 | 0:82, 1:3, 2:2, 3:3, 4:1 | 12 | 10 |
| Evolution | 91 | 0:83, 1:2, 2:2, 3:3, 4:1 | 9 | 1 |
| Floppies | 73 | 0:66, 1:7 | 7 | 0 |
| Monkey Paradise | 63 | 0:49, 1:13, 2:1 | 15 | 2 |
| Platinum 8 | 0 | — | 0 | 0 |
| Slimes | 0 | — | 0 | 0 |
| System 7 Nostalgia Silver | 0 | — | 0 | 0 |
| Windows 3.1 | 96 | 0:96 | 1 | 0 |
| Windows 95 | 99 | 0:99 | 2 | 0 |

There are **1,033 cinfs**: mode0=964, mode1=49, mode2=9, mode3=8, mode4=3;
none use mode5 or higher. Tile byte0=818 and byte1=215; no other tile values
occur. **125** have a nonzero background ID; **20** lack a local ppat candidate.
No short cinf headers were encountered. These are source inventory facts, not
counts of supported or correctly rendered controls.

Concrete #218 leads:

- Crayon OS active/inactive push cinfs `-10239/-10240` use mode0 and ppat17;
  pressed `-10238` uses mode0 and ppat-10238. All three patterns are present.
  Mode5 is not needed to reach the patterned-body path.
- Animals cinf-10239 uses mode2 and background ID-12239; both cicn and ppat
  candidates exist at that ID. The branch determines the requested type.
- Monkey Paradise cinf-10239 uses mode2 and ppat128. These raw active slots
  do not override the runtime's separately documented anti-role fallback policy.
- 1990 finder headers use mode1/2 and ppat-9567/-9568. This is resource evidence,
  not proof that list headers call the same original painter as push buttons.

## Remaining implementation boundary

The decoder's `bg-pattern`/`stretch-*`/`repeat-*` strings are compatibility
labels. They do not encode resource type, full body geometry or historical phase
semantics. The manifest currently resolves `bgPattern` through the ppat catalog;
mode5 color-icon bodies would require a distinct representation before support.
The focused byte fixture tests field offsets/signedness, not those label names.

Next, trace the observed Crayon mode0 ppat body path, including `0xf930/0xf7cc`
and the relevant environment flags, and derive asymmetric-pattern coordinates
for both inset rectangles before changing the runtime. Separately investigate
mode5 icon copy/mask behavior and the missing/legacy-sample path. Resource lookup
outside the selected fork, nonzero destination/port origins and transparency
must stay unknown until covered by source requirements. List-header and tab
call-site/body/font behavior remains open under #218/#223; do not erase sample
markers or bless the held tab prototype from this body table.
