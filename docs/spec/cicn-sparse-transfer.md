# Sparse CIcon preparation and ordinary transfer

The retained primary references specify ordinary CopyBits/CopyMask foreground/background coloration, but do not establish the missing-index lookup algorithm for a sparse indexed source ColorTable. The observed reversal therefore cannot, by itself, identify a missing-entry rule.

This is evidence and a future model boundary, not a new decoder API. The current
ordinary decoder still uses its explicit black compatibility fallback for absent
indices. Strict display-profile preparation still rejects them with
`UNSUPPORTED_SOURCE_COLOR`. Neither behavior is changed here.

## Primary evidence

- Apple, *Imaging With QuickDraw* (1994), pp. 4-32–4-34, Table 4-1: ordinary colored source transfers apply foreground to black, background to white, and weighted contributions to other source colors. The recommendation to set black foreground and white background explicitly covers CopyBits, CopyMask and CopyDeepMask. Source colors come from the source PixMap table; indexed destination colors use the current GDevice (p. 4-32).
- Apple TN QD13, “Principia Off-Screen Graphics Environments,” ColorTable section: ctFlags controls value-keyed versus positional entries; nonconsecutive source pixel values are supported. ctSize is logical count minus one. Its full-depth allocation/zero-unused-storage advice does not make allocated tail bytes logical colors or specify the lookup result for absent values. Its CopyBits discussion also distinguishes color-table seed/equality shortcuts from inverse-table conversion.
- The explicit largest/smallest-unassigned-value foreground/background interpolation rule on p. 4-59 describes full-color **PixPat**. It is not evidence that ordinary CIcon/CopyBits uses the same missing-index rule.
- Pinned kDEF f378–f3a4 sets black foreground/white background; fdf8–fe7a calls that setup and takes depth-one CopyMask versus greater-depth CopyBits(srcCopy, null region) branches. The eight-panel experiment's reversed pair and masked greater-depth path are separately declared experimental branches, not those original dispatch choices.

## Exact finite inputs and preparation

The experiment used two distinct, unchanged `cicn` payloads in a newly owned
resource file. The 1990 and Dolphin SOM occurrences share the same payload;
this is two payload inputs, not three independent native measurements.

| Source occurrence / signed ID | Geometry / depth / stride | Logical table / missing source pixels | Payload bytes / SHA-256 |
| --- | --- | --- | --- |
| 1984 occurrence 119 / −10139 | 5×7 / 4-bit / 4 bytes | values 0–6; index 9 at (4,6), mask clear | 230 / `e531c598177ba65f254e193837b40f98815e7902c9cd51b840f72b37a80ad56a` |
| 1990 occurrence 123 and Dolphin SOM occurrence 134 / −9504 | 12×12 / 8-bit / 12 bytes | values 0–31; index 255 at (10,11) and (11,11), mask set | 586 / `6baa459370a075da6ee49fe25391cef401d20d225303dbc2dd341685602711b5` |

The source fork SHA-256 bindings are:

- 1984: `f086875e048980d1a7523b949000bc37daf3e22848c97230c107c4b426eba873`.
- 1990: `767bd46d55b98c55ac891ad3e917993681571a4485880e7105f01abd7224768a`.
- Dolphin SOM: `3cbe736723e4b8f4b56ad2232b85427ba3e84c8985d7e6b339c0b29bfb35ad85`.

The new 1,142-byte container has SHA-256
`060420aab3a9f7bd33eed834054347ee63ecba3c4bc69275f57fdb182bb5fc5d`.
Its provider identity is disclosed experimental input, not an original resource
search result. `GetCIcon` preparation retained the raw pixel/mask/mono planes
and declared colors. Twenty bounded snapshots separated logical ColorTable rows
from actual handle allocation; there were no allocated tail bytes in these two
returned tables. TN QD13’s allocation advice is therefore not evidence of hidden
defined entries here. The valid 5×7 CIcon also does not inherit PixPat’s
power-of-two dimension constraint.

## Finite controls and observations

Six opaque, actually used, explicitly declared source-color controls were derived
from the raw source planes and exported destination indices/palette. The numeric
examples below are reproducible from the retained raw export: unpack the
MSB-first source index at the stated coordinate using the declared depth/stride,
require its mask bit and unique logical ColorSpec, then read the same coordinate
from each case's `resultDestinationIndices` and that index's positional
`devicePalette` entry. Compare cases 0/1 against 2/3 for 1984 and cases 4/5 against
6/7 for 1990/Dolphin. This derivation adds no color prediction. Pair 0 is black
foreground/white background; pair 1 reverses them. Examples:

| Input / source coordinate | Declared RGB16 | Pair 0 destination palette RGB16 | Reversed pair destination palette RGB16 |
| --- | --- | --- | --- |
| 1984 (1,0), index 1 | (0,9766,25700) | (0,13107,26214), index 207 | (65535,52428,39321), index 8 |
| 1984 (2,0), index 2 | (0,4883,12850) | (0,0,13107), index 214 | (65535,65535,52428), index 1 |
| 1990/Dolphin (0,0), index 0 | (0,0,0) | (0,0,0), index 255 | (65535,65535,65535), index 0 |
| 1990/Dolphin (1,1), index 1 | (5140,5140,5140) | (4369,4369,4369), index 254 | (61166,61166,61166), index 245 |

Masked and unmasked outputs agree at these opaque controls. General foreground/background coloration demonstrably affects declared colors too. These are device-quantized outputs, not reconstructed pre-device source colors. The reversal does **not** disprove a context-independent missing-source RGB followed by ordinary coloration; no such fallback RGB or algorithm is established by these observations.

The prepared tables remain 7 rows/64 allocated bytes and 32 rows/264 allocated bytes, with no allocated tail and no logical index 9/255 added. Hidden index 9 remains unchanged under the zero mask. Unmasked index 9 yields palette bbbb in pair 0 and 4444 in the reversed pair. Visible index 255 yields black in pair 0 and white reversed for both operations. These facts do not establish interpolation rank, an exact intermediate RGB16, or a universal missing-index color. A hypothesis borrowing the PixPat interpolation rule would require independent ordinary-transfer evidence; it is not adopted here. The unmasked 1984 index 9 observation under pair 0 also differs from the ordinary decoder’s current black compatibility value. Its zero-mask result does not establish what unmasked transfer should do.

## Future shared-model boundary

For a future historically supported transfer path, preserve an indexed source representation: dimensions/depth/stride and pixel indices, sparse logical ColorSpecs and flags/count/seed, separate mask/mono planes, and exact input/owner identity. Retain prepared allocation bytes as observations separately from logical entries. Do not fill absent values with entry zero, black, transparent RGBA, or a fabricated RGB16 tuple.

Resolve this representation through an explicit transfer operation/context: CopyBits versus CopyMask, mode, foreground/background, source/destination rectangles, clip, initial destination and actual destination device/color realization. Defined colors have the documented coloration contract; absent lookup remains unsupported/unresolved or separately labeled finite operation-conditioned evidence. The engine's sampled-color lookup and prepared full-plane transfer are distinct consumers, so a sampler fallback must not become a universal asset fallback. Current strict color-profile preparation rejects these absent palette indices before treating them as RGB16 inputs. Keep that rejection until an independently admitted source/transfer contract exists. The default black compatibility fallback and the engine sampler’s separate entry-zero fallback are existing, distinct behaviors; this recommendation does not redefine them.

This is a representation boundary recommendation, not a request for a general QuickDraw emulator or a new profile. A future fixed black/white preparation can be narrower, but still requires an independently supported missing lookup rule. Preserve source seed/flags/equality assumptions if that path is modeled.

## Limits and retained evidence

One System 7.5.5 / Kaleidoscope 2.3.1 environment under Basilisk II, with BeOS R5.0.3 selected, and eight panels; CopyMask precedes CopyBits on each handle, so operation and order are not isolated. Fresh handle is not cold cache. Owned resource container is not a historical provider. No original button/control attribution, display-profile admission, decoder rule, or public fidelity promotion follows.

- Raw export: 204154 bytes, SHA256 `4d28e0f578c73a7f9b545d991d789ca67d483c11e0a2dd2ad6b07bd97295a414`.
- Final acquisition result SHA256 `e6ce8585474b51d527ae41b28deea9bcfa82b711c04c93b14714500ff3056528`.
- Independent acquisition-quality review SHA256 `de84fff4d1c4dfcb733d2adb920960fc3639aacefe5345d0ba38ff94c14223ee`.
- Root missing-index observations SHA256 `e5bc5e8b17bd331fad3e2a4e12c5713672e53308810da255ccdbbd89a0f6feeb`.
- Retained Apple manual PDF SHA256 `f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`; [primary-authored manual mirror](https://vintageapple.org/inside_r/pdf/Imaging_With_QuickDraw_1994.pdf).
- Retained Apple QD13 HTML SHA256 `493a6ce9e1080363441908b16ca104278f22a243c7247195294450036243db36`; [primary-authored technote mirror](https://leopard-adc.pepas.com/technotes/qd/qd_13.html).
- kDEF0 SHA256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`; retained disassembly SHA256 `dd76798d98e8d05d1d61280d4d03d26f1deb75ac4b11509e0f36020321ca7b0b`.

The independent review covers acquisition quality: eight transfers / 716 panel
pixels, all 307,200 full-frame raw/PNG pixels, native source/plane/palette/FCB
joins and durable export. It does not approve a missing-index model. The single
boot also retains the premeasurement ordinary Finder volume-rename correction;
no second capture or silent native retry occurred.

Private maintainer recovery uses asset `cicn-palette-acquisition-20261020` in
`scriptoscope-assets` commit `d03cfc2e26c6d6e5396a7581f4e88785c049d8d0`.
The 46,438,199-byte archive SHA-256 is
`66f6223610b07b16aa0f189823d3b4f897a04b10e0b2f9a19e946985108b2365`.
The fresh selective-LFS round trip verified 145 regular files and one symlink;
receipt `forgejo-cicn-palette-roundtrip-20261020.json` has SHA-256
`1763d90272a9ed9e512229b0128435ebee870fad97e2296fcd126cc202f87d3f`.
The asset retains source, reviews, initial input history, export and the root
missing-index observations. The declared-color control derivation above is a
subsequent analysis of that retained export, not an additional file claimed to
exist in the frozen asset. No private resource payload, engine/OS bytes or native payload log is
published by this document. See the [private reference environment](../maintainer-reference-environment.md).

No runtime/profile, reference-intake acceptance, requirement-ledger count or
original whole-control claim changes. The [indexed decoder contract](cicn-decoding.md)
and [finite display-profile contract](display-profile.md) retain their current
compatibility and strict-preparation boundaries.
