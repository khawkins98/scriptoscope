# `push-button.draw` — push face and default ring

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `push-button.draw` |
| family | push buttons, including the optional default ring |
| message | drawCntl (0), visible controls; colour face callback |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| cited range | `0x66e8..0x6770`, `0x67fc..0x6812`, `0x6c28..0x6d20`, `0x7424..0x772a`; shared painter `0x107a4..0x10fde` |
| out of scope | PACH 130 and Dialog Manager default-item handling; bevel buttons; best-fit, regions, hit tests and non-draw messages; special icon/menu label adornments; full device/offscreen semantics (§6) |

This is a source-derived drawing contract, with unresolved branches in §6.
It does not promote any ledger row or establish native pixel fidelity.
Implementers read this file and [qd-primitives.md](qd-primitives.md), including
its sampler, body, pattern and border tables. Listing detail is segregated
in the evidence appendix for an independent verifier.

## 2. Inputs

| input | meaning / domain |
|---|---|
| `visible` | control visibility; false suppresses message-0 drawing |
| `hilite` | byte 0..255; 254/255 mean disabled/inactive drawing; other nonzero values mean pressed |
| `D` | original control face Rect in port coordinates, half-open |
| `defaultDataValid` | caller supplies the recognized Kaleidoscope auxiliary control data |
| `defaultFlag` | its default-button byte, interpreted as nonzero/zero |
| `regionRecording` | a region is being recorded in the destination port |
| `depth`, `lowDepth` | device depth and shared sampler/fill condition; these are distinct inputs |
| `resources` | typed signed IDs and lookup results, including explicit NULL, plus cache/resource-file environment |
| `label`, `fontMetrics` | Pascal-style control text (carriage return separates lines) and actual Toolbox widths/ascent/descent/leading |
| `labelAdornment` | none in this unit; other original label/icon branches remain §6 |
| `clip`, port/pattern origins | original drawing environment consumed by shared primitives |

No source branch uses author names, positive-ID aliases or a contrast heuristic
to choose a face (`0x7576..0x7594`). Public normalized state, browser font
metrics, display conversion and layout size policy are separate adapter inputs,
not native observations.

## 3. Outputs

For a visible non-recording draw, paint the selected face body and border,
then optional label emboss, then label text, then optional ring
(`0x7594..0x770c`). Preserve the destination through mask holes according to
the shared primitives; do not crop art to its opaque bounds.

Each face/ring attempt requests its cicn first; NULL returns failure without
requesting cinf. With a cicn, request same-ID cinf, then cinf 0 for a face
or cinf 1 for a ring on NULL. A second metadata NULL skips that attempt's
body/border, but the shared painter reports success because the cicn existed.
Consequently a pressed-ring attempt missing both metadata records does **not**
retry normal-ring art. These are distinct outcomes
(`0x10814..0x1089c`, `0x10fa8..0x10fb8`).

Cicn lookup uses the file named by successful Gestalt('Copl'), plus the
shared cache/Resource Manager behavior; the caller file is restored before
cinf lookup. Cinf and body resources follow their own shared lookup contract.
Neither a cicn's owner nor same-ID metadata presence proves a historical
provider chain. The engine's archive/base chain and omission of control-panel
art remain declared DECISIONS #5 policy.

## 4. Decision tables

Rows are normative for this unit. Shared QD rows are dependencies, not copies
of a second slicing algorithm.

| # | condition | output | source |
|---|---|---|---|
| PB1 | `visible = false` | no draw callback, requests or paint | `0x67fc..0x6812` |
| PB2 | visible, `regionRecording` | FrameRoundRect(D, 8, 8); no face/text/ring callback | `0x6c34..0x6c5e` |
| PB3 | hilite 254 or 255 | disabled true, pressed false | `0x66e8..0x670c` |
| PB4 | other hilite | disabled false; pressed iff hilite nonzero | `0x670e..0x6718` |
| PB5 | disabled | face ID −10240, body enabled, destination D | `0x7576..0x7580`, `0x7592..0x7594` |
| PB6 | not disabled, pressed | face ID −10238, body enabled, destination D | `0x7582..0x758c` |
| PB7 | otherwise | face ID −10239, body enabled, destination D | `0x758e..0x7594` |
| PB8 | face cicn missing | shared painter returns failure; no fallback to another face state; label colour outputs not established, stop the source-backed label claim (§6) | `0x10864..0x1086a`, `0x759a..0x75ea` |
| PB9 | face cicn found | same-ID cinf, NULL → cinf 0; then shared body B and border E tables. Missing both cinfs skips body/border, leaves label outputs unspecified | `0x1086e..0x1089c`, `0x10fa8..0x10fb8` |
| PB10 | decoded face colour outputs available | text := raw RGB16 text sample; emboss absent when emboss point (0,0), emboss equals background RGB16, or returned emboss red is 0x1234 | `0x10904..0x10998`, `0x759a..0x75a4` |
| PB11 | disabled and depth < 4 | TextMode 49 (grayishTextOr); otherwise mode 1 (srcOr) | `0x75a6..0x75c4` |
| PB12 | emboss present | draw label first in emboss colour with pen offset (+1,+1); then draw text in text colour without that offset | `0x75c6..0x75ea`, `0x70a6..0x70ba` |
| PB13 | emboss absent | draw text once in text colour | `0x75c6..0x75ea` |
| DR1 | invalid auxiliary identity or zero defaultFlag | no ring attempt | `0x76a8..0x76b6` |
| DR2 | valid default, disabled | ring ID −10232; NULL does not retry −10231 | `0x76b8..0x76d0` |
| DR3 | valid default, not disabled, pressed | ring ID −10230; failure of this attempt → −10231 once | `0x76d2..0x7700` |
| DR4 | valid default, normal | ring ID −10231 once | `0x7702..0x7712` |
| DR5 | every ring attempt | destination outset(D,4); shared painter with body disabled, same-ID cinf then cinf 1; border only, after label text | `0x7698..0x76a2`, `0x107de..0x107f2`, `0x1086e..0x10898` |
| DR6 | ring attempt has cicn but neither same-ID nor default cinf | draws no border and reports success; suppress DR3's normal-art retry | `0x1089a..0x1089c`, `0x10fa8..0x10fb8` |

For PB9/DR5, body and border geometry, samples and pattern phase are exactly
[qd-primitives.md](qd-primitives.md) B/P/E/S rows. Body-resource NULL erases
the body union with sampled background, without another ID retry; ring never
requests a body resource (`0x109aa..0x10bc0`). This includes independent
corner/side dimensions and masked overlap order.

## 5. Geometry

`ringRect = {left: D.left−4, top: D.top−4, right: D.right+4,
bottom: D.bottom+4}` (`0x7698..0x76a2`).
A browser allocation around this rect is adapter policy; the original face D
and pattern anchor must not change when reserving the ring footprint.

For a plain label with no adornment, define
`lineHeight = ascent + descent + leading`,
`n = 1 + count(CR)`,
`q = trunc((D.bottom + 1 − D.top − n×lineHeight)/2)`.
First baseline:
`D.bottom − q − leading − descent − (n−1)×lineHeight`.
On the push path subtract one more when lineHeight < 13.
Subsequent baselines add lineHeight (`0x6fb8..0x7036`, `0x70bc..0x70ca`).
For each line, `x = trunc((D.left + D.right − TextWidth(line))/2)`
(`0x707c..0x709c`). Label drawing clips to old clip ∩ D
(`0x6d4e..0x6d80`) even for the (+1,+1) emboss pass.

These formulas assume intermediate signed coordinate values do not overflow.
The original coordinate-word wrap is an unresolved edge; do not silently add
clamps. Empty text emits no DrawText. The final CR is included in the final
line's length by the original scan; Toolbox glyph behavior for that byte
requires independent verification (`0x703a..0x70ba`).

## 6. Not decoded / unknown; corpus impact

- This unit describes the colour callback. DeviceLoop, GWorld allocation,
  allocation failure, background preservation and copy-back
  (`0x7444..0x7566`, `0x75ee..0x768a`) require a separate environment
  derivation before a multi-device/offscreen equivalence claim.
- Missing face art/metadata leaves the label's returned colour outputs
  unspecified. The original still reaches the label call. Do not invent
  black/white samples or claim a procedural push fallback from this callback.
- Non-draw messages, special adornments and auxiliary font-style application
  are prerequisites for a full Control Manager lifecycle, outside this draw unit.
  Return/Enter and SetDialogDefaultItem belong to the caller; default:true
  requests this ring only, not dialog behavior.
- Resource-cache identity, which file 'Copl' names, duplicate resource provider
  precedence, native fonts/transfer and native output remain separate proof
  obligations. The shared sampler's unsupported depths/out-of-range reads
  remain unspecified. No runtime/test edits or self-review accompany this spec.

Own-fork census of the 18 shipped archives (resource identities, not captures):

| rows | archives / impact |
|---|---|
| PB5–PB7; DR2, DR4 | all 18 carry the three face cicns and −10232/−10231 ring cicns |
| DR3 pressed-art success | none has cicn −10230; pressed → normal retry is the corpus branch |
| PB9 same-ID face metadata | 1138, 1984, 1990, animals, apple-lisa, beos-r503, crayon-os, dolphin-som, evolution, floppies, monkey-paradise, windows-31, windows-95 |
| DR5 same-ID ring metadata | the preceding list except apple-lisa (neither ring cinf) and floppies (only disabled ring cinf) |
| default metadata prerequisite | apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver have no local face/ring cinf; none of the 18 carries cinf 0 or 1. Supply an explicit reviewed base/default environment or mark these branches unresolved |
| PB1/PB2/PB8; DR1/DR6 | need conditioned/synthetic inputs; presence census alone cannot establish their output |

## Modern raw-cinf compatibility policy

The ordinary public loader consumes the first raw occurrence of a requested
signed `cinf` ID in the selected provider. This is a bounded modern policy,
not native Resource Manager, provider-order or cache equivalence. A valid first
record ignores later duplicate records, unused defaults and later providers.
A present selected malformed header or typed UNKNOWN metadata/body result
rejects explicitly with its reason; it is not NULL and does not authorize a
default, later-provider or other-state retry. Two proven metadata NULLs retain
the reviewed transparent admission extent without claiming completed paint.
No loader schema expansion or blanket duplicate rejection is implied.

`byteProvenance.cinfResourceIndex` identifies the builder's static image/metadata
pair. With raw duplicate metadata that pair may identify a later occurrence
than the first consumed record. The ordinary trace makes no `consumedCinf` or
lookup-occurrence claim. A consumed raw duplicate-metadata join, uniqueness,
and native provider/cache behavior remain unknown. The opt-in prepared cinf
environment has its own explicit identity/completeness contract; it does not
change this ordinary policy.

## 7. Test hooks

The separate test author must bind every PB/DR row to an assertion and record
mutation results. Existing control-trace/face-bands/pattern-body/cinf-lookup
tests cover narrower contracts; they do not constitute independent review of
this spec or native evidence.

| rows | required distinguishing check / mutation |
|---|---|
| PB1–PB4 | invisible + region-recording inputs; hilite 0, 1, 254, 255; invert gate or let pressed override disabled |
| PB5–PB9 | asymmetric per-state art; missing cicn; same-ID/default cinf misses; flip ID, invent face-state retry or request cinf after cicn NULL |
| PB10–PB13 | raw RGB16 equality, mask-clear sample, 0x1234 red collision, low-depth boundary; compare before conversion, omit/shift/reorder emboss |
| DR1–DR4 | invalid identity, zero/nonzero default byte, both flags, pressed art success/failure; invent disabled → normal retry |
| DR5–DR6 | unequal art sizes, transparent margin, body poison colour, c≠s and overlapping bands; shift outset, fill body, crop opaque bounds, or retry after metadata-only miss |
| label formulas | odd widths/heights and multiple lines; alter truncation direction, baseline adjustment, clip or CR scan |

All newly decoded branches need independent address re-tracing before any
implementation; unsampled cases stay unknown.

