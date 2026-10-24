# Header evidence appendix — gated original-source material

Never read or forward this file to runtime implementers. Only the independently
approved, listing-free `header.md` patch may cross that boundary. This appendix
is the spec author's retrace, not an independent verifier approval. It records
static acquisition and decoding; no original engine executable was run.

## Reconstructed input chain

Fresh acquisition 2026-10-24 in the specification lane's external store
`/Users/khawkins/Documents/git/scriptoscope-lanes/headers-spec/`.
Only the authorized exact installer and Traps.h were read; no parent directory
of either private input was enumerated. `unar` 1.10.7 performed two static passes:

```sh
unar -q -forks visible -o "$STORE/acquisition" /Users/khawkins/Downloads/Kaleidoscope231US.bin
unar -q -forks visible -o "$STORE/acquisition/payload" "$STORE/acquisition/Kaleidoscope 2.3.1 Installer"
```

`$STORE` above denotes the external directory just named. These are retrace
commands, not product dependencies. Both commands exited 0. `acquire.mjs` in
that store imports this checkout's `tools/theme-loader/containers.js` and
`resource-fork.js`, detects the actual wrapper, unwraps its resource entry,
parses the complete resource map and selects type PACH / signed ID130. It also
independently walks the type/ref table to record the reference and payload
positions; no historical payload offset is used to obtain the component.

| actual input / member | bytes | SHA256 |
|---|---:|---|
| authorized Kaleidoscope231US.bin | 1908736 | `4173477d60f3081e03e4b18bd1cf17da16ad5381315ff04d8f51e8bb4cb7012a` |
| installer data fork, Kaleidoscope 2.3.1 Installer | 1687965 | `8aad109da26d11791d9ada2e8cf92327af1d617f396659cc63bd7ce70a0b01ce` |
| payload/Kaleidoscope 2.3.1 Installer/Kaleidoscope.rsrc, detected AppleDouble | 1005617 | `b5fd81a12072da1e3a1af9fedd9f6846d88e2e5187a8dd152266a00aa0cfba6c` |
| unwrapped raw fork | 1005535 | `0d4af8bab15e467f00b9dfaac99bb9adec6ee884e12e04f3de03d74b3fdc9c0b` |
| PACH130 “68k Patches” | 87914 | `bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44` |
| authorized Universal Interfaces Traps.h | 26632 | `b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b` |

The raw fork data area starts at256, map at996672; the PACH130 map reference is
998394, payload135431. These are **raw fork** offsets. The AppleDouble resource
entry starts at82. Source addresses in header.md are relative to PACH payload0,
not any wrapper, map, installer or kDEF address. `source-chain.json` records
actual measured values. The installer data length was measured from the extracted member.

`disassemble.py` uses Python capstone5.0.7, M68K big endian, 68020 decoding.
It starts each inspected routine at a deliberate known boundary. Retained
`header-retrace.asm`, `helpers-retrace.asm`, `sort-retrace.asm`,
`selection-retrace.asm`, and `header-entry.asm` are private static working
receipts, not runtime source. Range ends can truncate a final instruction; such
truncated tail output is not evidence. Inline tables are data, not sequential
instructions; in particular the linear continuation after the dispatch helper
inside the icon resolver must not be promoted as executable instruction claims.

## Source-address retrace rows

Each row below identifies both the source question and actual observations for
independent reinspection. Author classification is static-supported within its
stated boundary; independent verifier CONFIRMED/REFUTED marks are separately
owned and are not fabricated here.

| safe rule | exact payload citations | retraced observations / limits |
|---|---|---|
| F1, N3/N4 | 0x9b18/0x9b20, 0x9bd4/0x9bda | Selectors5/6 jump to c41c/c504 respectively. These are ordinary/header-list wrappers, not a per-column text interface. Independently fetched pinned UI3.4.1 Appearance.h maps these selectors to DrawThemeWindowHeader/DrawThemeWindowListViewHeader. This names the API shape, not original runtime pixels. |
| N1/N2 | 0xc1b4..0xc200 | Shared callback prepares painter state, then `tst.l 8(a2)` controls 0/1 added to word daa0; c1fa calls7668. Therefore exactly -9568/-9567; raw nonzero isn't a pressed comparison. |
| N3, ADM1 | 0xc430..0xc48a, 0xc4ae..0xc4d4 | State0 and origin(-1,-1) trigger conditional window visibility/region inspection and ClipRect; sentinel origin independently caps right to portRect.right+1. Public missing window/port inputs justify finite rejection for that origin in both states. |
| N4 | 0xc518..0xc55c | GetClip obtains saved clip; RectRgn requested Rect and SectRgn produce intersection; SetClip applies it. Copy Rect then increment word bottom at c546 before callback. Restore old clip afterward. |
| N5 | 0x7668..0x7684, 0x6ebc..0x6f48 | 7668 passes true body flag into6ea6. CurResFile is saved; temporary Copl resource environment can be used for icon lookup. CurResFile is restored at6f08 before same-ID cinf request at6f1a. If null, true body selects cinf0 at6f30..6f38; two null returns skip paint. This is **not** same-icon-owner proof. |
| N5, ADM3 | 0x7ea2..0x7ed2 | cinf loader requests FourCC cinf via GetResource A9A0 using supplied signed ID. Its later record expansion/cache paths do not authenticate public manifest joins or absence declarations. |
| ADM5, N6..N13 | 0x6f48..0x6f58, 0x7042..0x704c | Unsigned bytes are corner/side; full icon bounds are retained. No source-raster trimming by opacity is established. |
| N14 | 0x6fb0..0x6fc2, 0x5a46..0x5bd6 | Background sample uses cinf bg coordinates and raw icon color sampler, not mask-gated sampler5874. Full-color branch eventually uses palette lookup687e. Mask does not qualify the RGB sample. |
| N14 / solid body | 0x705a..0x705e, 0x7114..0x7142, 0x721a..0x7260 | RGBBackColor applies sampled RGB. Non5 pattern selection uses requested ID without excluding0; NULL branches to two transposed insets. Trap A8B2 receives zero long oval arguments each time. Traps.h names A8B2 **EraseRoundRect**, not FillRect. Its zero-oval rectangular result is the bounded modern opaque fill model. |
| N15 / pattern | 0x7156..0x71a2 | Mode byte cases1,2,3,4 select paint Rect TL,TR,BL,BR. Other cases produce zero point. Mode5 took a different branch earlier. Exclusive right/bottom anchor is retained, including list-view extension. |
| body union | 0x71a2..0x7202 and 0x721a..0x7260 | First inset uses corner horizontally / side vertically; c!=s adds transposed inset. Both pattern fills pass same P to574a. Both precede border calls. |
| phase N15 | 0x574a..0x5808 | Helper saves origin O; SetOrigin receives O−P; finite clip and Rect move−P;5698 draws, then Rect/clip/origin restore. Shared declared R convention is modern caller policy. Extreme native region thresholds, unavailable native pattern API and device behavior are not generalized. |
| admitted FillCRect | 0x5698..0x5748 | Global monochrome branch uses FillRect A8A5 at5714 with fore/back globals; full-color branch uses FillCRect AA0E at572a. Public model explicitly chooses full color. Recording/proc suppression and private environment restoration are not public claims. |
| N6/N7 | 0x72a8..0x7362 | TL then TR square corner source Rects; clamp requested source corner dimensions at actual source bounds; destinations stay on matching outer edges. Calls60da. Port bounds can skip invisible rows; public effective clip expresses admitted visible region. |
| N8 | 0x7362..0x73e4 | Top source is side rows between c and sourceRight−c; false tile narrows width to1 at739e..73a4. Destination spans W−2c. True forward flag passed at73ce independently of that narrowing. |
| N9/N10 | 0x73e4..0x74be | BL then BR corners. Source top clamps at source top, right/left likewise; destination anchors bottom edges with actual clamped source height. |
| N11 | 0x74be..0x7542 | Bottom source/destination; false tile narrows width at74fc..7502; forward flag752c. |
| N12/N13 | 0x7542..0x762e | Left then right; source side widths clamp to raster, source middle height uses c; false tile narrows height at7574..757a and75ec..75f2; forward flags75a4/761c. No c/s transposition into rectangular nine-slice. |
| corner transfer | 0x60da..0x6228 | Coordinate wrapper builds destination Rect from source dimensions and requested position, then calls612a. Ordinary nonrecording transfer at61fc..620c invokes CopyMask A817; the separate recording branch at61c0..61f8 uses temporary mask-region/CopyBits handling. Original CopyMask semantics are distinct from browser RGBA blending. |
| ADM10/ADM11 | 0x5ccc..0x5cf0, 0x5d48..0x5e26 | Empty source/destination exits. Source width1 + expanded destination takes horizontal sample branch first; source height1 + expanded height otherwise takes vertical. Selection precedes clipping.5874 checks original mask before emitting sampled lines. |
| ADM12 | 0x5874..0x59bc, 0x687e..0x68e2 | Mask-gated sampler derives color from original indexed content;687e has ColorSpec-value/index rules that differ from ordinary raster interpretation. Thus a sampled companion or full current-display opaque equivalence is required; neither certifies out-of-bounds source coordinates. |
| repetition | 0x5e86..0x5f84 | Forward iteration preserves original tile start; partial-tail handling at5eaa..5f00 narrows the source/destination rectangles at the requested end; this is not a temporary-clip mutation; ordinary branch at5f36..5f4e invokes original-mask CopyMask A817. Recording branch5f18..5f32 uses CopyBits A8EC and is excluded. |
| cache exclusions | 0x6ede..0x6f08, 0x7268..0x72a4 | Optional cached icon path1367a and band cache13406 are conditional. No universal cache/depth/device identity is inferred from this static trace. |
| separate Placard boundary | 0xc584..0xc6be | On process signature SJAM branch, word selection is state−10176. For state2 normal path, try -9790 then state−10176 (-10174); then raw zero/nonzero gives -9792/-9791. If unsuccessful callc1b4. This callback is reached from selector7 wrapperc6c2, independently identified as DrawThemePlacard by the pinned Appearance.h. It is a separate family from F1 selectors5/6 and is not evidence of header sort behavior. Its process identity and complete placard semantics remain unverified. |
| no -9566 claim | 0xc76e..0xc774 | The byte sequence daa2 occurs within an instruction displacement for calla212; it is **not** an immediate resource request. A search hit is not a decoded selection rule. |

## Modern policy provenance and correction boundaries

F2–F6, ADM1–ADM15 and OBS1–OBS4 are admitted public/preparation policy, grounded in
the base's `src/headerSurface.ts`, `src/controls.ts`, `src/controlComposition.ts`,
`src/controlDiagnostics.ts`, `src/baseChain.ts`, the registered-profile contract in
`docs/spec/display-profile.md`, and needed-only sample preparation of shared
engine primitives. They do not inherit tab-specific no-cinf or null-transport
semantics. The immutable prepared profile capability requirement follows the
profile module's registry, not a guessed cache identity. Guarding the entire
chain is already `resolveInChain` policy and must survive migration even when
the first owner has art. Asset exceptions stay exceptions; optional unused
color mappings are not newly required.

PM messages on 2026-10-24 classified (1) preservation of column pixels/defaults,
(2) no expanded cinf-environment/default-cinf delivery and no blanket rejection
of harmless summaries, and (3) exclusion of unexposed native sort features.
The first candidate invented a hypothetical selected-header role contradiction
rule; independent review rejected that ambiguity. The corrected ADM14 consumes
no cinfEnvironment/bodyCinf views: current CinfBindingSummary explicitly scopes
both to standalone-push-bevel-body (cinf-environment.d.ts lines10..25).
Only the actual common selected element fields use their existing named finite
admission rules. No new role discriminant/schema/failure category is invented.

The first candidate also misnamed the selector7 callback a header/button path.
Independent reinspection of the binary dispatch and independently fetched Apple
UI3.4.1 Appearance.h confirms **DrawThemePlacard**, a separate family; there is
no source basis to identify it as native header sort behavior. The header was
fetched from commit328d38f2b72b2d4ceda30170eea32ca6b9de218a,
3.4.1/Universal/Interfaces/CIncludes/Appearance.h at the UniversalInterfaces
source mirror. Its SHA256 is
ea4337a6b07144879928ef1d73caca8ef9ff771b63fcd9f11fe9921e885b05fc;
lines1786..1788,1800..1802,1814..1816 explicitly bind AA74 selectors5/6/7.
The exact input is retained as Appearance.h in this lane's external store.

C1–C8 are independently specified from the assigned base's compatibility helper,
not PACH. Source pins: base commit
057780119776c4071e183ead073a8cf15ec61290, controls.ts selection helpers,
composeFaceButton legacy-list-header and composeListHeader; PixelBuffer nineSlice,
copyBits and drawOver; textRaster browser font policy. Separate source dimensions
are preserved, side != corner remains rectangular compatibility slicing, and
center raster fill follows nine-slice. The code's prior comments suggesting a
native listing origin do not establish native per-column calls. The native APIs
receive neither the columns array nor these labels/width defaults.

The older sampled-line lead's opening exclusion of pattern bodies is stale:
its useful line-companion extension does not rescind the independently traced
full-color FillCRect body. The new safe spec clarifies this without mutating
pinned legacy docs. No 13-archive regression result from those leads is reused as
an independently executed result in this lane.

## Reverification and unknowns

Reconstruct payload and compare all source hashes, then independently decode each
cited bounded range from deliberate instruction boundaries and resolve trap
words against the exact Traps.h. Check safe formulas against source corner clamps,
source/destination Rects, body order, state width, list bottom and phase; preserve
any refutation with actual execution/source identities. Independent tests and
review remain separately owned. This lane authors no runtime or tests and has
not run a native pixel oracle, browser suite or full integrated gates.

Native icon fallback to alternate art after callback failure, process-specific
header variants, sort-column glyph/color/interaction, full Resource Manager chain,
recording/mono paths, destination palette/device cache effects and original fonts
remain outside the safe contract. No corpus-wide, arbitrary-depth or historical
color-environment claim is made. Source-address evidence supports finite rules;
modern generated pixels and a matching source hash alone do not establish original
execution fidelity.

## Mask-clear sampled-line clarification (2026-10-24)

Question: does geometric visibility of a sampled-line band require equivalence
or companion evidence even when every actually selected source mask point is
clear? ADM16 explicitly chooses modern needed-only admission, consistent with
ADM13/ADM15, instead of conservative geometry-only companion admission. No tests,
oracle outputs or runtime algorithm were supplied to derive this rule.

Independent author retrace uses the same already reconstructed PACH130 payload,
SHA256bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44.
No new original source acquisition or native execution was performed.

| source citation | observation and boundary |
|---|---|
| 0x5d76..0x5d8c;0x5dde..0x5df2 | Both sampled-line branches pass true mask-test to5810 and branch past line drawing when its return is false. Horizontal draw only5d8e..5da0; vertical only5df4..5e04. |
| 0x5810..0x5842 | Wrapper forwards mask-test, source point and icon to5874. It preserves returned mask result across an unconditional RGBForeColor call at5836. Therefore no claim that foreground state is untouched or that the complete historical wrapper has no color API call. |
| 0x5884..0x58d4 | When mask-test is true, sampler extracts the source mask bit first. A zero mask result branches directly to5a3c before color-content/palette lookup. |
| 0x5964..0x5a32;0x5a3c..0x5a44 | The admitted full-color path computes indexed source color and calls687e only after the mask gate; return preserves mask result. Thus clear points contribute no defined sampled line RGB and emit no line write. |

The modern requirement concerns published pixels and required color evidence.
Only samples whose corresponding line spans intersect effective clip create a
possible published line-color dependency; mapping remains anchored before clip.
The public header subset excludes native foreground/port-state certification.
No companion decode or missing exact color mapping is demanded solely for a
clear-mask line, but source bounds and binary face mask still must be established.
An out-of-bounds transparent read cannot stand in for a verified clear mask.
Other body/border dependencies and whole-chain/profile guards remain unchanged.
If another sampled band does require color, ADM12 still applies fully; only that
required companion undergoes the existing complete dimension/mask identity checks.
No independent test or review result is asserted by this clarification.
