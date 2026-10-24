# Tab CDEF 8 — evidence appendix

**Spec author / independent verifier only. Never give this appendix to runtime
implementers.** Behavioural handoff: `tab.md`. Author: dispatched tabs-spec lane,
2026-10-24. Verifier marks are deliberately unfilled; author retracing is not
independent verification. No original binary or listing is committed.

## E0. Inputs, reconstruction and address convention

Original CDEF 8 is 15,902 bytes, SHA-256
`4c9fecff46f6bfe2171961fa71e0831e5e2b85174f55531ad1a2fe895a82c680`.
Read exact root-checkout file
`/Users/khawkins/Documents/git/aaron-ui/.scratch/k231-kdef/CDEF/id-8.bin`;
its hash matches. Existing evidence pointer `/tmp/scriptoscope-cdef8-68020.asm`
was absent, so the author generated a fresh local listing:

```sh
m68k-elf-objdump -D -b binary -m m68k:68020 /Users/khawkins/Documents/git/aaron-ui/.scratch/k231-kdef/CDEF/id-8.bin > /tmp/tabs-spec-cdef8.asm
```

Listing SHA-256 `c12a62e0de4d62cfbe613e98a06a195d768c87af5dda60615775ba9d49f71736`.
All original addresses are offsets from resource payload zero. Linear disassembly
misinterprets embedded switch data; those rows are not instructions. No original
code was executed. Narrow extraction was independently repeated from the exact
installer pointer in the existing inventory, without enumerating private stores:

```sh
unar -q -forks visible -o /tmp/tabs-spec-extraction /Users/khawkins/Downloads/Kaleidoscope231US.bin
unar -q -forks visible -o /tmp/tabs-spec-extraction/payload '/tmp/tabs-spec-extraction/Kaleidoscope 2.3.1 Installer'
```

AppleDouble member is exactly
`/tmp/tabs-spec-extraction/payload/Kaleidoscope 2.3.1 Installer/Kaleidoscope.rsrc`.
Parse AppleDouble big-endian entry count at 24, entries at 26 (12 bytes each),
select entry 2; read raw-fork header/map, CDEF type and ID 8 reference.

| input | bytes | SHA-256 / observation |
|---|---:|---|
| MacBinary installer | 1908736 | `4173477d60f3081e03e4b18bd1cf17da16ad5381315ff04d8f51e8bb4cb7012a` |
| installer data fork | 1687965 | `8aad109da26d11791d9ada2e8cf92327af1d617f396659cc63bd7ce70a0b01ce` (existing inventory chain) |
| control-panel AppleDouble | 1005617 | `b5fd81a12072da1e3a1af9fedd9f6846d88e2e5187a8dd152266a00aa0cfba6c` freshly matched |
| raw resource fork | 1005535 | `0d4af8bab15e467f00b9dfaac99bb9adec6ee884e12e04f3de03d74b3fdc9c0b` freshly matched |
| CDEF 8 | 15902 | `4c9fecff46f6bfe2171961fa71e0831e5e2b85174f55531ad1a2fe895a82c680` freshly matched extraction and root copy |
| exact approved Traps.h | 26632 | `b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b` |

Header read only at
`/Users/khawkins/Documents/git/scriptoscope-lanes/459-inputs/Traps.h`.
Trap identities below are resolved from that file. Its hash and byte count were read from that exact file.

**Offset correction:** prior `tab-cdef8-body.md` / inventory wording calls 42778
the payload offset. A fresh big-endian read proves raw-fork offset **42778 is the
four-byte length word**, value 15902; payload begins **42782**. Slicing
`[42782,58684)` produces the exact CDEF hash above. Map reference 997278 has bytes
`0008ffff5000a61a00902288`: ID 8, unnamed, attributes 0x50, data-relative offset
0x00a61a = 42522; raw data start 256, hence length word 42778. Resource-payload
addresses used by both behavioural documents are unaffected. Older pinned docs
are preserved, not incidentally edited in this lane.

The earlier PACH lead is not this painter. PACH 130 (87914 bytes, SHA-256
`bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`)
`0xb996/0xb9d4 → 0x69a4 → 0x7ea2` establishes metadata reads, not tab-body
painting; see `tab-body-investigation.evidence.md` and its companion. No new PACH
rule or patched-trap equivalence is promoted here.

## E1. Author retrace: caller, state, lookup and successful no-paint

| CDEF 8 range | listing observation and behavioural claim | independent verifier |
|---|---|---|
| `0x7de..0x812` | DoDrawTab obtains control, index, state and rect; copies control rect. ST/V context | |
| `0x812..0x82e` | `(data+32)&7 == 1` → nominal 16 height, otherwise 21; this is before painter replaces bottom | |
| `0x832..0x8b8` | left starts +5; preceding widths StringWidth+24 plus20 if icon; current tab same width; modern facade intentionally does not copy native layout | |
| `0x8d2..0x8dc` | compare tab index to control value (+18), equal adds3 to d3 | |
| `0x8de..0x924` | low3 variant==1: −9976+d3, call16e; false retries −9960+d3 | |
| `0x926..0x95a` | otherwise −9984+d3, false retries −9968+d3 | |
| `0xcc2..0xce0`, `0xdb4..0xdca` | hilite254/255 →0, others1; per-item enabled byte0 forces0; calls7de | |
| `0x117a..0x11a8` | tracking d3 1→2 entering and2→1 leaving; calls718 update wrapper; lifecycle not assigned | |
| `0x182..0x194` | get icon23da; nil returns d0=0 | |
| `0x37e..0x38e` | get same-ID cinf via2f3c with false (no extension); nil branches622 | |
| `0x622..0x62a` | release icon261c then d0=1; both painted and found-icon/no-cinf are success; caller never retries in no-cinf case | |
| `0x23da..0x241a`, `0x25f8..0x261a` | set zone SysZone; save resource file; Gestalt Copl→UseResFile; cache switch then GetCIcon; restore zone/file. No live file identity is proved | |
| `0x1ba..0x378` | special fallback IDs recolour from clut−14336/−14335; pressed additionally samples cicn−10238 with matching/default cinf. Public modern small/large IDs do not enter these cases | |
| `0x2f3c..0x2f80` | GetResource cinf ID, detach/purge handling; caller false bypasses54-byte extended colour cache. No same-ID missing cinf→cinf0 fallback in16e | |

## E2. Metadata encoding and body

Old 18-byte cinf header: byte0 unsigned c, byte1 unsigned s, byte2 repeat flag,
byte3 alignment mode, signed word4 ppat ID; signed point words6/8 background
(vertical/horizontal),10/12 foreground,14/16 emboss. Not a generic push/bevel
resize interpreter. Body receives original D at a3, icon handle d3, cinf a2.
Full source S comes from icon PixMap.bounds +6..13. The declared modern domain
normalizes only zero-origin sources; native nonzero bounds are not claimed.

| CDEF 8 range | listing observation / result | independent verifier |
|---|---|---|
| `0x394..0x39e` | c and s zero-extended bytes | |
| `0x3b4..0x3c6` | foreground point10/12 passed to1bce | |
| `0x3cc..0x3f8` | emboss14/16 bothzero → first RGB word sentinel0x1234; otherwise sample. No comparison to background | |
| `0x402..0x418` | d6 initially0; nonzero word4 calls23a0/GetPixPat; d6 may remain0 if unavailable | |
| `0x420..0x42a` | full S, not opaque scan | |
| `0x430..0x47e` | full-height left then right end strips; source widths c, destination right anchored | |
| `0x484..0x4b4` | top source inner width, height s; byte2zero reduces source right to left+1 | |
| `0x4b8..0x4e2` | destination inset horizontal c, height s; flag1 calls1e48 forward tiler | |
| `0x4e8..0x552` | bottom source rows bottom−s..bottom, same width rule; destination top = D.top + sourceHeight−s, bottom=D.top+sourceHeight | |
| `0x558..0x566` | background point6/8 through19bc→1bce; RGBBackColor regardless returned mask | |
| `0x56c..0x592` | rectangular centre x D.left+c..D.right−c, y D.top+s..D.top+H−s; overrides incoming bottom | |
| `0x596..0x600` | test resolved d6 handle, not requested ID; nil→A8B2 with oval width/height zero. Thus missing requested pattern also erases | |
| `0x614..0x61e` | write D.bottom=D.top+H after centre fill | |
| `0x9e0..0xa12` | nonsentinel emboss DrawString at(+1,+1), foreground at original text position; modern public label preserves its own policy | |

Top/bottom overlap can map to identical original y coordinates, so changing draw
order alone may not change final pixels in corpus fixtures. Ordering is a listing
claim; pixel tests must not overstate its discrimination.

## E3. Pattern anchors and fill

| CDEF 8 range | listing observation / result | independent verifier |
|---|---|---|
| `0x23a0..0x23d8` | GetPixPat AA0C with requested signed ID; temporary SysZone; no alternate ID/type lookup | |
| `0x59e..0x5b6` | unsigned byte3 dispatch1/2/3/4, all other values default | |
| `0x5b8..0x5be` | d4=D.left, d5=D.top | |
| `0x5c0..0x5c6` | d4=D.right, d5=D.top | |
| `0x5c8..0x5d0` | d4=D.left, d5=D.bottom | |
| `0x5d2..0x5da` | d4=D.right, d5=D.bottom | |
| `0x5dc..0x5ea` | default d4=d5=0; call1888(rect,ppat,h,v). Incoming a3 bottom is unchanged until61e, distinct from centre bottom at592 | |
| `0x1888..0x18c6` | save current port origin, SetOrigin(saved−phase) | |
| `0x18c8..0x1900` | clip bounds sentinel check >−32000; OffsetRgn(−h,−v) unless huge clip | |
| `0x1902..0x1924` | subtract phase from rect, call17d8 | |
| `0x1928..0x1972` | restore rect, finite clip and saved origin (upper sentinel32000) | |
| `0x17d8..0x182c` | lock pattern; colour-port fillPixPat saved/cleared | |
| `0x182e..0x1862` | lowDepth path FillRect A8A5 with pattern's pat1Data+20 in black/white; out of scope | |
| `0x1864..0x1886` | full-colour FillCRect AA0E; restore fillPixPat, handle state and zone | |
| `0x5f0..0x5f4` | DisposePixPat AA08 | |

Phase formula in tab.md is the same origin-aligned non-negative-modulo model
already specified for the engine primitive / progress pattern helper, applied
here to independently traced CDEF 8 anchors. This does not establish that a
live patched FillCRect/device pipeline matches prepared browser pattern pixels.
Pattern owner binding is explicit modern policy, not inferred GetPixPat precedence.

## E4. Masking, tiling, packed sampling and palette selection

| CDEF 8 range | listing observation / result | independent verifier |
|---|---|---|
| `0x1e48..0x1e7a` | wrapper calls1e7c with same flag and no alternate source | |
| `0x1e94..0x1eb8` | reject empty destination and source | |
| `0x1f10..0x1f86` | width1 source expanded to width>1: temporary text font−12345;197c sampled foreground with mask gating; MoveTo+LineTo to right−1 per row; restore font. Marker effect via patches unknown | |
| `0x197c..0x19ba`, `0x19f6..0x1bc4` | sampler optionally checks mask; clear mask skips RGB; packed full-colour path uses2678; C1 differs from ordinary raster copy | |
| `0x2046..0x20aa` | forward repeat clips final source width/height to destination remainder | |
| `0x20c2..0x20f8` | recording branch CopyBits, ordinary bitmap port CopyMask; only latter assigned | |
| `0x2228..0x227c` | fixed-end helper builds source-sized destination before227e | |
| `0x2310..0x234e` | recording/custom-port path builds mask region then CopyBits; out of scope | |
| `0x2350..0x2360` | ordinary fixed-end CopyMask A817 | |
| `0x1bce..0x1c24` | semantic sampler computes mask without suppressing subsequent RGB path | |
| `0x1cb0..0x1d6c` | local x/y read packed indexed pixels using rowBytes and1/2/4/8-bit extraction | |
| `0x1d70..0x1d92` |2678 gets RGB, then independent mask byte returned | |
| `0x2678..0x269e` | positional v in range whose ColorSpec.value==v wins | |
| `0x26a0..0x26b2` | last-entry value0 shortcut selects position v (even unsafe outside palette; modern admission rejects that case) | |
| `0x26b4..0x26d0` | reverse value search; failed search selects entry0 | |
| `0x26d2..0x26ec` | copy selected RGB16; no ctFlags interpretation | |

Raw RGB sample preparation/display policy and safe sampled-band companions are
finite modern transport dependencies, not a new general original-engine decode.
The no-cinf branch never initializes text/emboss outputs. Public null for that
branch is PM-approved modern policy; source establishes only no body + success.

## E5. Trap identity checks

Exact approved Traps.h SHA above: A874 GetPort, A878 SetOrigin, A8E0 OffsetRgn,
AA0C GetPixPat, AA0E FillCRect, AA08 DisposePixPat, A8B2 EraseRoundRect,
A8A5 FillRect, A817 CopyMask, A8EC CopyBits, A893 MoveTo, A891 LineTo,
AA14 RGBForeColor, AA15 RGBBackColor, AA1E GetCIcon, AA25 DisposeCIcon,
A9A0 GetResource, A994 CurResFile, A998 UseResFile.
The old prose calls the zero-oval EraseRoundRect an EraseRect; geometry agrees,
but the exact trap is A8B2. No browser/native trap parity is inferred.

## E6. Modern boundary and reproducible delta

Base `9ab4428a9f32aa4fb500b4ced552c0c4a56a14e6`:
`src/controls.ts` resolveFaceById/loadResolvedFace and elementEntryById establish
archive-then-base, first absolute-ID match and preserved selected owner;
composeTabWithTrace establishes small→large, active/enabled selection, opaque-bound
label measurement, contrast colours, Math.round font/placement, and full-source
width in supported-body branch. Existing `src/composeTabBody.ts` source bands
are bounded to explicit zero body request for positive centres; all unsupported
cases fall through to cropped three-slice legacy paint. The new contract removes
that fallback, preserves supported-body width/label rules, and covers ppat centres.

PM reply to bounded author question on 2026-10-24 approves preserving public
label/size and small-then-large policy, explicit unsupported admission with
observable diagnostics, separate original no-cinf/no-paint, no new variant API,
control-panel exclusion, unknown native fonts/device/patch equivalence. Required
null distinctions were explicitly reinforced. No verifier report is part of the
implementer handoff; independently checked source clarifications are restated in
listing-free tab.md only.

Existing 18-fork census/rule evidence is in `../tab-cdef8-body.md` and
`tests/rendering-options/tab-header-rules.mjs`; this lane did not claim new native
captures. The new pattern-phase rows require independent synthetic assertions
before implementation acceptance; prior Crayon centre exclusions are insufficient.
No runtime, tests, goldens or ledger edits were made by the author.

## E7. Transport clarification (modern policy, 2026-10-24)

The implementer asked how older manifests without raw cinf census, bound engine
sample identity or exported origin can enter the bounded modern domain. This is
a transport-policy clarification, not additional CDEF decode. New §6.1 is the
complete listing-free answer; its MD/OR/CS rows must receive independent review.

At the base, `buildThemeJson.js` creates byTypeAndId only from status-ok decoded
assets, pairs same-ID cinf, and writes `sourceCinfId: cinf?.id ?? null`.
Therefore explicit null cannot prove original resource absence: it can also
mean no successfully decoded pairing. MD2 gives it an explicit tab-only declared
no-paint meaning and compatibility trace basis; omitted fields remain unknown.
No inspector absence is promoted into an exhaustive raw cinf census.

The same builder emits immutable role colour samples from the selected local
cicn/cinf pair, suppressing ambiguous generated paths. `kdef-color-samples.js`
reads rawRGB16 before canvas transport and exports both raw and display triples.
`convert.js` later attaches newer cicnSource / engineColorSamples. The generic
adapter requires actual per-load identity for the newer points. CS2 deliberately
permits older local role samples as a **declaration**, without altering that
adapter's generic identity rules; CS3 forbids bypassing a contradictory supplied
strong binding. Needed-versus-unused points are separate so public contrast
labels do not force realization of unused native text/emboss.

Older JSON elements may lack both origin fields; OR1 explicitly declares a local
zero-origin raster, and OR5 uses that raster's binary alpha as the modern mask.
Neither RGBA dimensions nor pixmap-only cicnSource bounds prove original mask
bounds. Explicit invalid/nonzero/conflicting source/mask information rejects;
no new broad original-mask interpretation is inferred. This preserves the old
public consumer while keeping native geometry and display evidence unproved.

Independent mutations are specified for missing/null/conflicting metadata,
legacy bounds default versus explicit contradiction, same-owner finite samples,
strong-binding downgrade, and pre/post-await snapshot mixing. No runtime or
other-family transport policy was edited in this spec lane.
