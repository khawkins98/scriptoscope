# `tab.draw` — segmented tab facade and CDEF 8 body

Behavioural contract for the incremental #378 migration, based on v2
`9ab4428a9f32aa4fb500b4ced552c0c4a56a14e6` (2026-10-24).
Implementers read this file and the implementer brief; the separate evidence
appendix is forbidden reading. All original addresses below are payload-relative
citations into Kaleidoscope 2.3.1 **CDEF 8**, 15,902 bytes, SHA-256
`4c9fecff46f6bfe2171961fa71e0831e5e2b85174f55531ad1a2fe895a82c680`.
Original-source rules and modern facade policy are distinguished explicitly.
No native-pixel, historical-font or device-equivalence status is promoted.

## 1. Scope and boundaries

| field | contract |
|---|---|
| unit / family | `tab.draw`, segmented tab header; body, selection and helpers required by public `composeTab` |
| public operation | `composeTab(theme, { label?, selected?, diagnostics? })` → Promise of pixel buffer or null |
| original consumer | one tab painter within the draw caller, CDEF 8 `0x7de..0xa1a`, `0xcc2..0xdca`; body CDEF 8 `0x16e..0x634` |
| migrated subset | one resting, enabled tab; ordinary full-colour masked raster painting, sampled bands, solid or ppat centre |
| replacement boundary | remove the tab-specific three-slice body in `controls.ts` and replace/remove `composeTabBody.ts`; no unsupported branch may call that legacy body |
| out of scope | native multi-tab arrangement, panes, icons, tracking/hit tests, font selection, new public variants/states; list headers and other control families |

The modern policy below was approved by the PM on 2026-10-24. Control-panel
art is deliberately excluded, consistent with DECISIONS #5; this applies to tab
fallback art too. No dependency on shipping that private fork, or on another
family's migration, is introduced. Existing unrelated behavioural contracts stay
valid. The older bounded body contract is historical background, not an additional
implementation reading requirement; this file states the complete assigned scope.

## 2. Inputs and results

Rectangles are half-open. Body engine inputs are source bounds `S`, destination
rect `D` in one port coordinate space, resolved icon and matching `cinf`, and
available pixel patterns. Source width `w = S.right − S.left`, height
`H = S.bottom − S.top`. Metadata means unsigned horizontal inset `c`, unsigned
vertical inset `s`, full-band-repeat flag `tile`, pattern alignment mode `m`,
signed pattern request `p`, and authored background/text/emboss sample points.
These are semantic values; do not substitute opaque bounds for `S`.

The supported modern domain is a zero-origin prepared colour plane and matching
same-size binary alpha plane (the modern mask), with native-bounds admission as
§6.1 declares; positive integer `w,H`, integer `0 ≤ c`, `2c < w`, `0 ≤ s ≤ H`, and
integer output width `W ≥ 2c`. Coordinates and dimensions must be finite and
representable without 16-bit QuickDraw overflow. These are admission limits,
not a claim about the original's handling of malformed resources.

Original body outputs: whether the icon was found; paint operations; sampled
text/emboss colours when metadata exists; updated destination bottom
`D.top + H`. Finding an icon is distinct from painting it. The public facade
returns a transparent-initialized `W × H` buffer when admitted, otherwise null
with the diagnostic distinction in AD1–AD6. Asset loading failures retain their
existing rejected-Promise behavior; they must not become missing-art nulls.

Declared realization: one ordinary colour raster port, full colour, origin
`(0,0)` for the facade, no recording/custom drawing procedures, 1:1 pixels.
Use the selected owner's declared display realization exactly once for raw
RGB16 samples. Raster colours already realized for that owner are not transformed
again. This is a modern display condition, not historical device calibration.

## 3. Resolution, variants and state

### 3.1 Original selection (context, no new public API required)

| row | condition | result | source |
|---|---|---|---|
| ST1 | resting hilite 254 or 255 | base state 0 | CDEF 8 `0xcc2..0xce0` |
| ST2 | other resting hilite | base state 1 | CDEF 8 `0xcc2..0xce0` |
| ST3 | per-tab enabled flag is clear | override base state to 0 | CDEF 8 `0xdb4..0xdc4` |
| ST4 | tracking inside/outside | tracking caller chooses base state 2/1 | CDEF 8 `0x117a..0x11a8` |
| ST5 | tab index equals control value | add 3 to base state; otherwise unchanged | CDEF 8 `0x8d2..0x8dc` |
| V1 | small variant | request `cicn −9976 + state`; only an absent icon retries `cicn −9960 + state` | CDEF 8 `0x8de..0x924` |
| V2 | large variant | request `cicn −9984 + state`; only an absent icon retries `cicn −9968 + state` | CDEF 8 `0x926..0x95a` |
| V3 | found icon, missing same-ID cinf | handled, no body or colour outputs; do not retry another icon | CDEF 8 `0x37e..0x38e`, `0x622..0x62a` |

The original small variant is the variant value whose low three bits equal 1;
other values use the large ladder (CDEF 8 `0x812..0x82e`, `0x8de..0x8ea`).
Its nominal strip heights 16/21 are not body minimum heights: the body returns
source height (CDEF 8 `0x614..0x61e`). For base states 0/1/2, unselected small
IDs are −9976/−9975/−9974, selected −9973/−9972/−9971;
large uses −9984/−9983/−9982 and −9981/−9980/−9979.

### 3.2 Public resolution (modern, intentionally different from V1/V2)

| row | condition | result | basis |
|---|---|---|---|
| F1 | `selected` omitted or false | candidate IDs −9975, then −9983 | current `composeTab` policy; ST2 + ST5 explains the state meaning only |
| F2 | `selected` truthy | candidate IDs −9972, then −9980 | current `composeTab` policy |
| F3 | each candidate | search loaded theme, then each base nearest first before trying next candidate | existing face resolver / base inheritance policy |
| F4 | multiple element entries in one owner match candidate absolute ID | first in manifest insertion order; preserve actual signed `sourceCicnId` and key in diagnostics | existing positive-ID-alias compatibility policy |
| F5 | no candidate icon | null, missing-art outcome | modern, control-panel art excluded |
| F6 | candidate icon found | freeze selected owner, actual occurrence, asset, dimensions and metadata before paint; metadata/sample/pattern failure does not retry the large candidate or another owner | modern facade boundary; V3 supports no retry on missing cinf |

Selection is by structured resource identity, never a theme slug, role label or
filename guess. The fallback order is **small across the chain, then large across
the chain**, not both sizes in each owner. No disabled/pressed input is added.
No −9959/−9956 control-panel fallback or its palette recolouring is rendered.
This null divergence for art-less themes must be recorded, not described as
original agreement. The original icon loader consults the file identified by
Gestalt `Copl`; its runtime identity and resource precedence are not proved
(CDEF 8 `0x23da..0x241a`, `0x25f8..0x261a`).

## 4. Body geometry and paint order

Let `L = D.left`, `T = D.top`, `R = D.right`, `W = R − L`.
Let `q = w − 2c` if `tile` is nonzero, otherwise 1. All source and destination
rectangles below use their full declared bounds. Transparent pixels skip writes;
opaque pixels overwrite prior paint. Preserve earlier opaque paint under a
later transparent mask bit, including overlapping bands.

| row | order / condition | source → destination | source citation |
|---|---|---|---|
| B1 | first, left end | `[S.left,S.left+c) × [S.top,S.bottom)` → `[L,L+c) × [T,T+H)` 1:1 | CDEF 8 `0x430..0x450` |
| B2 | second, right end | `[S.right−c,S.right) × [S.top,S.bottom)` → `[R−c,R) × [T,T+H)` 1:1 | CDEF 8 `0x456..0x47e` |
| B3 | third, top band | `[S.left+c,S.left+c+q) × [S.top,S.top+s)` repeated forward over `[L+c,R−c) × [T,T+s)` | CDEF 8 `0x484..0x4e2` |
| B4 | fourth, bottom band | same x rule, source y `[S.bottom−s,S.bottom)` repeated forward over `[L+c,R−c) × [T+H−s,T+H)` | CDEF 8 `0x4e8..0x552` |
| B5 | fifth | sample authored background regardless of mask; centre rect `I = [L+c,R−c) × [T+s,T+H−s)`; fill by P1–P4 | CDEF 8 `0x558..0x600` |
| B6 | after body | output bottom becomes `T+H`; source height, independent of incoming `D.bottom` | CDEF 8 `0x614..0x61e` |
| B7 | source or destination rectangle empty | band helper paints nothing | CDEF 8 `0x1e94..0x1eb8` |
| B8 | final repeat shorter than `q` | copy only its leading source fragment; no scaling or reverse anchoring | CDEF 8 `0x2046..0x20aa`, `0x20e0..0x20f8` |

For zero-origin source, a middle pixel at destination x `X` reads source
`x = c + ((X − L − c) mod q)`; band y maps 1:1 relative to `T`. `mod` is the
non-negative remainder. The centre never stretches the icon's semantic sample
pixels. If `2s > H`, top and bottom overlap and `I` is empty; bands still paint.
If `s = 0`, bands are empty and a positive centre spans the full height.
If `W = 2c`, there is no middle. No push/bevel unequal-inset union is used.
Body transparency is retained outside paint; no whole-output background erase.

### 4.1 Sampled bands versus ordinary mask copies

| row | condition | result | source |
|---|---|---|---|
| C1 | band source width 1, destination width > 1 | each source row's mask bit gates a horizontal line in the raw sampled RGB colour; not necessarily the decoded bitmap colour | CDEF 8 `0x1f10..0x1f86`, `0x197c..0x19ba`, `0x19f6..0x1bc4` |
| C2 | remaining B1–B4 ordinary colour-raster path | masked 1:1 copies / forward repeats, no smoothing | CDEF 8 `0x2046..0x20f8`, `0x2228..0x2360` |
| C3 | background/text/emboss sampling | read authored point in local icon coordinates, derive RGB independently of returned mask bit | CDEF 8 `0x1bce..0x1d92` |
| C4 | packed full-colour indexed sample | 1/2/4/8-bit MSB-first pixel; palette selection C5; no colour-table flag reinterpretation by this sampler | CDEF 8 `0x1cb0..0x1d80` |
| C5 | sampled value `v`, last palette index `n` | matching value at position `v` wins when `v ≤ n`; otherwise if last entry's value is zero use position `v`; otherwise reverse-search values from `n` to 0; no match uses entry 0 | CDEF 8 `0x2678..0x26ec` |

C5's positional shortcut is unsafe when it selects outside the table. Such data
is unsupported in this modern domain. C1 requires an admitted complete sampled
raster companion, or a matching-size/owner-display `samplingEquivalence` record
with status `equivalent` permitting the decoded raster shortcut. `different`
requires the complete safe sampled companion; unknown/absent cannot be guessed
from the ordinary bitmap. The companion supplies sampled RGB at opaque points
and preserves the icon mask; it is used only for sampled lines, never to recolour
ordinary cap copies. Owner/dimensions/display mismatch is unsupported. Existing
engine resource preparation may supply this fact; do not broaden another family's
admission merely to implement tabs.

For C3/B5 use valid same-owner raw sample metadata in the declared display
condition, including RGB beneath mask holes. An in-bounds opaque decoded anchor
may substitute only with established sampler equivalence for that occurrence.
A transparent canvas sample loses hidden RGB and is not a fallback. No double
display conversion, contrast heuristic or generic emboss suppression may replace
the decoded sample when exposing the body engine's colour outputs.

### 4.2 Centre and pattern phase

Pattern lookup is needed for a nonzero signed `p`; the type is always `ppat`,
even when `m = 5`. There is no mode-5 cicn body in this tab helper.

| row | condition | result | source |
|---|---|---|---|
| P1 | `p = 0` | erase `I` in sampled background RGB, opaque | CDEF 8 `0x402..0x418`, `0x596..0x600` |
| P2 | `p ≠ 0`, pattern absent | same solid erase as P1; no substitute pattern ID | CDEF 8 `0x40a..0x418`, `0x596..0x600`, `0x23a0..0x23d8` |
| P3 | pattern found, ordinary full-colour path | fill `I` using the pattern at phase point from P4; release pattern afterward | CDEF 8 `0x59e..0x5f4`, `0x17d8..0x1886` |
| P4 | alignment `m = 1 / 2 / 3 / 4 / other` | phase point is incoming `D` top-left / top-right / bottom-left / bottom-right / port `(0,0)` | CDEF 8 `0x59e..0x5e0`, `0x1888..0x197a` |

A pattern of size `pw × ph` places at port pixel `(X,Y)` the pattern pixel
`((X−px) mod pw, (Y−py) mod ph)`. Phase uses the **incoming outer tab rect**,
not the inset centre or the returned bottom. Under the facade, incoming
`D = [0,W) × [0,H)`. Mode 2 therefore anchors at `(W,0)`, mode 4 at `(W,H)`.
Empty `I` paints nothing and needs no modern pattern or background realization,
although the original helper can still request/sample them before the empty fill.

Modern pattern resolution is same-selected-face-owner: an explicit body-pattern
or background-pattern link matching signed `p` wins, otherwise a unique matching
`sourcePpatId` in that owner's patterns. Do not inherit the root's unrelated
pattern for a base-owned face. Missing means genuinely no resource; ambiguous,
present-but-undecodable or unsafe pattern realization is unsupported (AD5), not
P2. This owner binding is policy; the original GetPixPat resource-chain ownership
is not established. Pattern pixels use their prepared owner display raster;
complete original pattern decoding and patched FillCRect parity remain unknown.

### 4.3 Native colour outputs; modern label distinction

The body samples authored foreground. Emboss is absent only when its authored
point is `(0,0)`; otherwise it samples that point, without testing equality to
background (CDEF 8 `0x3b4..0x3f8`). Native text paints emboss at `(+1,+1)` first
when present, then foreground (CDEF 8 `0x9e0..0xa12`). These are body-engine
outputs/context, **not** an instruction to change the public label policy below.
Absent metadata leaves those outputs unspecified; never invent colours for V3.

## 5. Public label and dimensions (modern compatibility policy)

These rules preserve the existing facade and have no historical-font claim.
Let `b` be the inclusive opaque bounding box of the selected full icon, width
`bw`, height `bh`. A fully transparent icon returns AD2 before text or body work.
For admitted metadata use its `c`; do not introduce a cap-size heuristic.
`label = opts.label ?? ''`. Nonempty labels use the existing text rasterizer,
font size `max(8, round(bh × 0.42))`. Sample the full icon at
`(floor((b.left+b.right)/2), floor((b.top+b.bottom)/2))`; luminance
`0.299r + 0.587g + 0.114b < 128` selects white, otherwise black. This heuristic
is retained **only for facade labels**, not for body background/sampled bands.

`glyphWidth = 0` for an empty label, otherwise the rasterized label width.
`W = max(w, glyphWidth + 2c + 6)` and output height `H`. A nonempty label is
drawn over the completed body at `x = round((W−glyphWidth)/2)` and
`y = round((bh−glyphHeight)/2) + 1`. Rounding is JavaScript `Math.round`;
negative halves round toward positive infinity. Clip glyphs to the output.
Keep opaque-bound measurements for this label policy while body paint uses full
bounds. No arbitrary height, minimum 16/21, native StringWidth+24, new scale
factor, changed font backend or native emboss is added. The original caller's
width/height/font evidence is CDEF 8 `0x812..0x8cc`, `0xa1c` onward; it is not
this modern facade geometry.

## 6. Admission and diagnostics (modern; explicit outcomes)

| row | condition | facade result / required diagnostic meaning |
|---|---|---|
| AD1 | F5 all icon candidates absent | null; `missing-art`, attempted IDs and owner chain |
| AD2 | selected icon has no opaque pixels | null; `empty-art`, actual selected owner/id |
| AD3 | selected icon found, authoritative same-ID cinf absence or explicit declared no-cinf input (§6.1) | null; `no-cinf-no-paint`, handled icon, no retry (V3); no label drawn; distinguish original absence from modern declaration |
| AD4 | metadata missing from transport, incomplete/short, invalid domain or absent explicit body request | null; `unsupported-metadata` and concrete missing/invalid field; distinguish absence of original cinf from absence of prepared metadata |
| AD5 | required sample or pattern exists but cannot be safely realized | null; `unsupported-sampling` or `unsupported-pattern`, owner/id and reason; do not label resource missing |
| AD6 | admitted body | buffer; source selection, bands versus sampled lines, centre empty/solid/pattern, requested pattern and missing-pattern erase, actual phase and modern label basis |

These names denote required meanings; existing diagnostic schema may express them
without adding public fields. With diagnostics enabled, unsupported null must be
distinguishable from missing art and no-cinf no-paint, with no loss of caller-visible
error context. Without diagnostics, the existing nullable signature is preserved.
AD1–AD5 are not successful source-faithful renders. No legacy body fallback is kept.
For empty centres, missing unused background/pattern samples do not cause AD5;
malformed body request or slices still cause AD4. Omitted exported slice metadata alone proves only AD4; §6.1 defines the exact
authoritative-versus-declared distinction for AD3.

### 6.1 Tab-only transport conventions (modern clarification, 2026-10-24)

These conventions apply only to the public tab facade. They do not relax any
other family or the generic engine sample adapter. A successful declaration is
not loader-occurrence proof, raw resource-census proof or native certification.
Snapshot the selected owner, element key, signed icon ID, asset URL, declared
width/height, slices/request/anchors, sample records, bounds records and display
policy **before the first asynchronous asset load**. Use those snapshots for
admission and paint; never join a loaded buffer to later mutable metadata.
After decode, declared dimensions must equal actual prepared dimensions. In the
bounds rows, supplied means an own field whose value is not undefined; explicit
null is invalid bounds data, not omission.

| row | selected-owner transport fact | result and diagnostic basis |
|---|---|---|
| MD1 | complete authoritative cinf lookup/census explicitly establishes same-ID absence | AD3, original-absence fact; V3 is the source no-paint rule |
| MD2 | own `sourceCinfId` property explicitly equals null, no contradictory header/slice/request/sample declaration | AD3 as **declared no-cinf**, compatibility basis; original absence remains unproved |
| MD3 | `sourceCinfId` omitted/undefined and required slice/request absent | AD4, unknown metadata; missing transport never becomes MD1/MD2 |
| MD4 | valid same-ID prepared slice/request present; `sourceCinfId` equals selected signed icon ID or is omitted | body admission continues; omission is declared local metadata, not a proved original join |
| MD5 | explicit numeric cinf ID differs from selected signed icon ID; null contradicts usable header/slice/request/sample; supplied retained header contradicts prepared fields; or any required metadata malformed | AD4, contradictory/invalid metadata; never silently prefer a weaker declaration |

MD2 is an explicit modern negative declaration convention, not an inference that
an undecoded or unexported resource was absent. Null slice/request/anchor/sample
fields accompanying MD2 do not contradict it. A usable raw same-ID cinf header
or any nonnull body metadata does contradict it. Missing entries in a partial
`engineCinfs` map, or missing inspector data, do not establish MD1. A supplied
usable raw header can supply body fields; an omitted exported field need not be
invented when that header provides it. No default cinf or unrelated owner is used.

| row | bounds and mask transport | result and diagnostic basis |
|---|---|---|
| OR1 | neither `cicnSource` nor `boundsOrigin` supplied | declare prepared source origin `(0,0)` for this legacy tab facade; `legacy-zero-origin-policy` in diagnostics |
| OR2 | valid `cicnSource.bounds` supplied | source ID must equal the selected signed icon ID; top/left must be zero and extent must equal actual prepared dimensions; an accompanying `boundsOrigin` must agree |
| OR3 | no `cicnSource`, valid `boundsOrigin` supplied | both coordinates must be zero; explicit origin declaration |
| OR4 | present source record lacks usable bounds or has wrong source ID; any supplied bounds invalid/nonzero, dimensions disagree, or origin records conflict | AD4; OR1 cannot override present contrary or incomplete bounds data |
| OR5 | admitted prepared raster | its alpha plane of the same width/height is the modern mask; require binary alpha; do not assert that native PixMap and mask bounds matched |

No new raw-mask census is required for OR1/OR5. A colour PNG alone cannot prove
original mask dimensions or origin. If original mask bounds/layout are explicitly
supplied and disagree with the admitted zero-origin same-size domain, reject AD4;
never erase contrary information by normalizing it. A pixmap-only
`cicnSource.bounds` is not original mask evidence. Missing sampler proof still
rejects a needed C1 line under C1's own rules even though ordinary raster copies
can use the declared alpha mask. Corpus tests must retain legacy JSON-manifest
and current loader consumers; do not reject all older manifests for lacking the
newer occurrence/bounds objects.

| row | required colour transport | result |
|---|---|---|
| CS1 | usable occurrence-bound `engineColorSamples` | use that strong source under its existing identity/dimensions/display rules |
| CS2 | newer engine samples absent; selected element has `colorSamples.model = kdef-2.3.1-color` | tab-only **declared local role samples** may supply RGB16 without newer object-identity binding, subject to the checks below; diagnostics mark compatibility declaration |
| CS3 | supplied newer sample binding is contradictory/invalid for a required point | AD5; no downgrade to CS2 to bypass a failed stronger binding |
| CS4 | native text/emboss samples unavailable but not used by public paint | leave those native outputs unspecified; do not reject an otherwise paintable public body |

CS2 requires the frozen samples to accompany that same selected element and its
local same-ID metadata (MD4), not be borrowed from a root/base sibling. Its
background/text/emboss role must correspond to the matching frozen authored
anchor, with integer in-bounds coordinates; `rgb16` must be three integers in
`[0,65535]`, `displayRgb` three integers in `[0,255]`. Model and display policy
must match the owner; realizing RGB16 once under that owner's current policy must
equal the declared displayRgb. Use the already-realized value thereafter. Invalid
or contradictory values reject AD5 for a **needed** point. CS2's frozen parent
join is a compatibility declaration; equal paths/IDs/dimensions do not make it an
independent occurrence proof. No `embossDecision: same-as-background` suppression
is imported into the tab engine.

Needed samples are the C1 line colours whenever a line expands, and the
background when a positive centre will erase (P1 or P2). A found usable pattern
centre needs its pattern raster/phase, not otherwise-unused native background,
text or emboss outputs. Empty centres require none of those colour outputs.
The public label still uses §5 contrast policy. C1's complete companion or
matching sampler-equivalence requirement is unchanged; local role colour samples
cannot stand in for a whole sampled-line raster. CS4 similarly leaves optional
engine colour outputs unavailable rather than synthesizing them.

Test hooks: distinguish omitted/null/contradictory cinf metadata (MD1–MD5), old
JSON manifests with neither bounds object (OR1) versus explicit invalid or
nonzero records (OR4), binary-alpha declaration versus native-mask proof (OR5),
legacy local samples versus valid/contradictory strong binding (CS1–CS3), masked
background RGB and missing unused native text/emboss (CS4). Mutations that infer
absence from omission, ignore explicit nonzero bounds, borrow another owner's
samples, mix pre/post-await records, relax C1 proof, or reject valid legacy
manifests must fail. These are modern declaration checks, not native pixel tests.

## 7. Not decoded / corpus impact

Implementers stop and ask the spec owner about cases outside this domain.

- Original font/style, native label metrics/transfer and multi-tab arrangement,
  icons, panes, hit regions, event/tracking lifecycle beyond the state context.
- Original device conversion, low-depth/mono, several devices, recording,
  arbitrary port origins/clips and custom drawing procedures; the temporary
  helper text-font marker and patched trap internals. Browser alpha is no proof.
- Actual `Copl` file and live resource-chain ownership/precedence, cached icon
  occurrence handling, fallback recolouring and control-panel art. No shipped
  control-panel fork is required; excluded art is a deliberate divergence.
- Nonzero icon/mask bounds, unsafe samples, unsupported pattern formats,
  short cinf, degenerate/overflowing rects. AD4/AD5 declares a modern result,
  never establishes the original undefined/malformed behavior.
- Native captures corroborating this expanded pattern-phase model. Source-rule
  agreement is not original-output evidence and does not promote ledger rows.

At the base, 14 of 18 own forks have public tab art. The four without it are
black-platinum, platinum-8, slimes, system7-nostalgia-silver (AD1 under an empty
base chain). Of the 14, crayon-os alone requests a nonzero public centre ppat
(17); its prior legacy path is replaced by P3/P4. The other 13 exercise solid
or empty centres. 1138 rear has `w=23,H=16,c=10,s=10,tile=false`; 1990 rear has
`w=32,H=16,c=14,s=14,tile=false`: their overlapping bands repeat one column,
never adjacent semantic marker columns. All corpus public tab faces have recorded
sampler equivalence, but synthetic `different`/unknown cases must test C1 admission.
Animals' large disabled art lacks cinf but is unreachable from F1/F2; V3 still
needs a synthetic test. Native fallback states/large-only ladders remain contextual.

## 8. Independent test hooks and migration acceptance

Test authors derive expectations from these rows, not the runtime. Existing
`tab-header-rules` / tab-body checks may be run without giving implementers their
source. Add coverage where those earlier bounded checks leave pixels unasserted.

| rows | discriminating assertions / mutation that must fail |
|---|---|
| F1–F6 | sentinel small/base/large art; base small wins over root large; selected IDs differ; no large retry on found-icon/missing-cinf or unsupported metadata; positive alias trace retains sign; mutate ordering or owner |
| ST1–ST5, V1–V3 | table-level state/id assertions; original small miss probes −9959 for normal rear, not −9983; expose original-versus-facade distinction without expanding public API |
| B1–B8 | literal asymmetric transparent padding, both overlapping bands, partial final tile, empty bands/centre and positive centre; mutate crop to opaque bounds, use whole centre, stretch, reverse-repeat, or erase transparent overlap |
| C1–C5 | literal sparse/duplicate palette fixtures distinguish sampler from bitmap RGB; opaque mismatch companion used only on lines; mask-zero line preserves previous paint; absent/unknown proof rejects; masked background retains raw RGB; no double display transform |
| P1–P4 | non-square multicolour pattern with positive centre, all alignment modes including 0/5; nonzero outer origin and incoming bottom different from returned bottom at rule level; facade uses zero origin and H; missing pattern erases; ambiguous/undecodable pattern rejects; mutate phase to centre anchor, always-zero, wrong sign or root owner |
| §4.3 / §5 | native emboss-equals-background remains present in engine colour outputs; facade keeps contrast text with no emboss; empty and AgjpQy labels; full source height with opaque-label geometry preserved; mutate native width/font into facade |
| AD1–AD6 | each null class has distinct diagnostic meaning; corrupt needed metadata/sample/pattern, check no legacy fallback and no owner retry; asset errors still reject |
| corpus / removal | all 18 forks × selected false/true, source and built; Crayon centre fully asserted by declared pattern model, 1138/1990 marker retention; remove all replaced tab body branches/helpers and no changes to unrelated families |

Identical source art cannot discriminate selection: 1990, apple-lisa, windows-31,
windows-95 both public rows; apple-platinum-2 rear and beos-r503 front. Use sentinel
resources. Band overlap order also needs operation trace/source verification when
both bands map the same source coordinate; do not claim a pixel mutation proves it.
No test author or implementer may manufacture historical label/device fidelity or
update ledger/goldens as part of this spec-only change.
