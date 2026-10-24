# Header draw — behavioral contract

## Scope and authority

Units: `header.drawSurface` and `header.drawColumns`. Public callers are
`composeHeaderSurface` and `composeListHeader`; signatures and result unions stay
unchanged. The facade validates and snapshots browser inputs, resolves prepared
assets and translates diagnostics. Typed engine inputs own the draw decisions,
geometry and paint order. Drivers are per message × family (DECISIONS #2), not
per source routine. No original executable is run or shipped.

Native citations in this file mean Kaleidoscope 2.3.1 PACH 130, “68k Patches”,
87,914 bytes, SHA256
`bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`, with
resource-payload-relative addresses. `N` rows describe the bounded decoded
whole-header path; `F`, `ADM`, `OBS`, and `C` rows are explicit modern policy.
The implementer brief overrides the template's obsolete permission to read
independent rules. Only this safe contract is an implementation input.

This contract bounds and clarifies the older `header-surface.md` and
`header-sampled-lines.md`: direct full-color pattern bodies are admitted;
mode 5 remains excluded; columns retain their separate compatibility painter.
No new historical fidelity, ledger status, loader schema or release is implied.

## Inputs and finite public domain

| ID | input | contract / authority |
|---|---|---|
| F1 | whole-header kind | Exactly `window-header` or `list-view-header`. No column, label, sort direction or pressed-part input. Native wrappers: `0xc41c..0xc580`. |
| F2 | size and state | Width and height are positive integers; raw drawState is integer 0..4294967295. The requested origin and exclusive right/bottom, including the list-view extra bottom, fit signed16 (-32768..32767). No automatic minimum. Invalid kind/context shape throws TypeError; invalid numeric domains throw RangeError. Zero-size public surfaces are invalid; empty clips are valid. Modern validation. |
| F3 | composition | Required controlOrigin and portOrigin are signed16 pairs. Pattern origin is `known` with signed16 offset pair, `api-unavailable`, or `unknown`. Clip is `unbounded`, `unknown`, or a signed16-edged rectangle with nonnegative integral width/height. Basis is omitted/caller-declared or managed-content-port. Snapshot by value before any await; do not freeze caller objects. Shared `controlComposition.ts` policy. |
| F4 | output plane | Exactly requested width × height, initially transparent; returned coordinates are local to requested origin. Effective clip is requested Rect intersect caller clip; unbounded means requested Rect. No port-sized padding. Full, empty, small, translated and negative Rects use the same formulas. Modern plane/cropping policy with native clipping citations below. |
| F5 | owner selection | Before selection, guard the entire root/base chain for the same display-profile identity, including tiers after an early hit and default versus opt-in. Cycle-safe root-first traversal; first manifest entry in property order whose integral sourceCicnId has matching absolute value wins. Preserve actual signed ID, key, owner, depth and provenance. Positive IDs are compatibility aliases. No alternate state is tried after missing face or failed decode. Shared `baseChain.ts` and `display-profile.md` policy. |
| F6 | snapshots | Before first asset await, retain the chosen owner, asset URL, signed IDs/key/provenance, slices, request, anchors, sampling descriptors and owner policy. Snapshot mutable descriptors, columns, labels and context. Retain the same registered immutable prepared profile capability by reference; never clone/reconstruct it from an ID or data. Concurrent calls and later caller mutation cannot relabel a decoded asset. Shared display-profile ownership policy. |

## Selection and native boundary

| ID | condition | observable result | source |
|---|---|---|---|
| N1 | raw state = 0 | Request face cicn -9568. | `0xc1e8..0xc1fa` |
| N2 | raw state nonzero | Request face cicn -9567, including 1, 2 and 4294967295. No -9566 pressed variant is derived. | `0xc1e8..0xc1fa` |
| N3 | ordinary window header | Paint the requested Rect. The native (-1,-1) sentinel also consults port/window state and may clamp its right edge. | `0xc430..0xc4e4` |
| N4 | list-view header | Paint Rect has the same left/top/right and bottom + 1; clipping remains intersected with the original requested Rect. Source selection uses the same raw-state test. | `0xc504..0xc55c` |
| ADM1 | window-header origin exactly (-1,-1), any raw state | `unsupported: special-window-origin`; this API has no port bounds/window-region input for the sentinel. Other negative origins are admitted. | modern finite admission over N3 |
| ADM2 | unknown clip | `unsupported: unknown-clip` before face decoding. | modern finite admission |
| N5 | native generic face dependency | Native draw first requires selected icon; same-ID cinf is requested, then default cinf 0 for this body-enabled caller. If both metadata requests fail, no body/border is painted. This does not establish same-owner metadata or archive/base policy. | `0x7668..0x7684`, `0x6ebc..0x6f48`, `0x7ea2..0x7ed2` |
| ADM3 | public metadata | Consume only the selected owner's finite prepared header metadata. Missing fields are unsupported, not evidence of native cinf absence. Do not infer tab-style declared-null/no-cinf behavior, use cinf0, or borrow another owner's metadata. | modern selected-owner policy |

The separate native stateful header/button callback selects other art: state 2
tries -9790 then -10174 before the zero/nonzero -9792/-9791 selection; an
application-specific branch tries state-relative -10176 art first. Its eventual
fallback is the ordinary header callback. These are separate caller conditions,
not a sort or pressed ladder for F1 (`0xc584..0xc6be`). The public APIs here expose
neither a sort state nor a sort indicator. Native sort-column background colors,
indicator glyphs, interaction and later named ThemeDrawState semantics are outside
this delivery; do not add them to N1/N2 or columns by analogy.

## Admission and dependencies

| ID | required fact | result / policy |
|---|---|---|
| ADM4 | no selected face | `unavailable: missing-face`; columns return null. No procedural fallback inside either composer. Caller may choose its baseline. |
| ADM5 | slices | Required for whole-header: integer corner c and side s, each 0..255; tile Boolean. Missing gives `missing-slice`, malformed gives `invalid-slice`. Source dimensions are actual positive decoded dimensions. No half-size clamp on c/s. |
| ADM6 | body request | Required integral mode 0..255 and signed16 resource ID, including 0. Missing gives `missing-body-request`, malformed `invalid-body-request`, mode 5 `cicn-body`. These reasons are unsupported. |
| ADM7 | pattern binding | Non5 requests ppat with that signed ID only in the selected face owner. Prefer matching bodyPattern link, then matching bgPattern link; otherwise use the unique matching ID entry. Multiple unbound candidates or an observed but undecoded matching resource are `ambiguous-body-selection`. Only an established miss admits solid fill. No base/control-panel pattern substitution. Decode failures reject; they never become a miss. |
| ADM8 | pattern realization | Selected visible pattern body requires positive-size opaque prepared pixels and a known pattern offset or explicit API-unavailable declaration. Unknown offset gives `unknown-pattern-origin`; any nonopaque pattern gives `nonopaque-pattern`. Already-realized pixels are not transformed again. |
| ADM9 | solid realization | A visible solid body requires selected-owner background sample model `kdef-2.3.1-color`, matching display policy, valid RGB16 (three integers 0..65535), display RGB (three integers 0..255) and in-bounds integral bgAnchor. Unavailable samples reject with `missing-background-sample`. Use raw background sampling independent of source mask; no corner/text/opaque-anchor fallback. |
| ADM10 | source alpha / geometry | Whole-header face alpha is binary 0/255; otherwise `nonbinary-mask`. A visible nonempty band with source coordinates outside the actual raster gives `unsafe-source-geometry`. Overlap and unequal c/s alone are valid. Skip nonpositive source/destination extents. |
| ADM11 | expanded lines | Before clipping, choose horizontal sampled lines if source width = 1 and destination width > 1; else vertical if source height = 1 and destination height > 1; otherwise ordinary masked copy/repeat. Tile flag does not suppress sampled expansion. Only visible required line branches need color evidence. |
| ADM12 | line evidence | Use ordinary pixels only with model `kaleidoscope-2.3.1-opaque-sampling-v1`, comparison `opaque-current-display-rgb`, matching actual dimensions and owner display policy, status `equivalent`, reason `all-opaque-display-rgb-equal`. Otherwise require selected-owner sampledBandAsset with the same model/comparison/dimensions/policy, nonempty asset and derived path `cicn-sampled/<one filename>.png`. Decoded companion size and entire alpha mask must equal face. Missing/incompatible evidence gives `unverified-line-sampling`; actual decode errors reject. Companion pixels replace only sampled lines, never ordinary corners/copies. |
| ADM13 | color capability | Default current-display and registered opt-in profiles remain distinct. If RGB16 realization is required, use the retained owner's prepared capability and exact mappings. Missing mapping/profile failure rejects with the existing DisplayProfileError; do not use stored display RGB to bypass a required profile mapping. Do not demand text/emboss/unused background/unused companion mappings. Shared `display-profile.md` and qd-primitives color policy. |
| ADM14 | optional cinf environments | No expanded environment ladder is introduced. Harmless extra metadata alone does not reject. A selected-header role declaration that explicitly supplies a different icon/cinf ID, owner, profile, slice or body request from the selected finite header dependency is contradictory; a role claiming to replace that dependency but supplying no usable required fields is unsupported. Unrelated push/bevel role views and top-level environment summaries do not activate this rule. Report the specific contradicted/missing dependency in diagnostics; do not silently ignore it. Use an existing applicable unsupported category (invalid slice/request, ambiguous body selection, missing sample, or unverified sampling); do not expand the public result union. PM classification 2026-10-24. |
| ADM15 | empty operations | Whole-chain guard, scalar validation and structural metadata validation still apply to an empty effective clip. Return rendered transparent requested-size output once admitted, with painted=false. No unused pattern/companion decode or color realization is required; invisible body and bands create no paint claim. A nonempty clip can also produce no writes through empty regions or masks. Empty public dimensions are governed by F2. Modern dependency policy; native helper rejects empty source/destination Rects at `0x5ccc..0x5cf0`. |

Validate the selected dependency itself: an invalid asset identity, transport failure
or decode error rejects rather than falling through to a later alias, owner or
state. Profile-chain failures remain visible even when root art suffices. Borrowed
theme lifetime remains caller-owned; this migration adds no public signal API.
No new original lifetime/cache behavior is inferred.

## Whole-header geometry and paint

Use half-open rectangles. In local coordinates let paint size be W × H (H is
requested height + 1 only for list-view), source raster size U × V, c=corner,
s=side, Cx=min(c,U), Cy=min(c,V), Sx=min(s,U), Sy=min(s,V).
Nonpositive rectangles are empty, not reflected or made positive. The body is
`inset(paintRect,c,s) union inset(paintRect,s,c)`; each inset contracts left/right
by its first argument and top/bottom by its second. Its solid/pattern fill occurs
before all borders (`0x71a2..0x7260`). The solid native operation is EraseRoundRect with both oval dimensions zero, after RGBBackColor; the modern supported result is an opaque rectangular fill. Mask holes retain earlier paint.

| ID | order / region | source (x,y,w,h) | destination (x,y,w,h) | source |
|---|---|---|---|---|
| N6 | 1 TL | (0,0,Cx,Cy) | (0,0,Cx,Cy) | `0x72a8..0x7300` |
| N7 | 2 TR | (U-Cx,0,Cx,Cy) | (W-Cx,0,Cx,Cy) | `0x7300..0x7362` |
| N8 | 3 top | (c,0,Bx,Sy) | (c,0,W-2c,Sy) | `0x7362..0x73e4` |
| N9 | 4 BL | (0,V-Cy,Cx,Cy) | (0,H-Cy,Cx,Cy) | `0x73e4..0x7452` |
| N10 | 5 BR | (U-Cx,V-Cy,Cx,Cy) | (W-Cx,H-Cy,Cx,Cy) | `0x7452..0x74be` |
| N11 | 6 bottom | (c,V-Sy,Bx,Sy) | (c,H-Sy,W-2c,Sy) | `0x74be..0x7542` |
| N12 | 7 left | (0,c,Sx,By) | (0,c,Sx,H-2c) | `0x7542..0x75b6` |
| N13 | 8 right | (U-Sx,c,Sx,By) | (W-Sx,c,Sx,H-2c) | `0x75b6..0x762e` |

Bx = U-2c when tile=true, otherwise 1. By = V-2c when tile=true,
otherwise 1. Ordinary band copies repeat forward at native pixel rate from their
original destination start; partial final tiles clip rather than rescale.
Source position for local destination q in a region is its source origin plus
floorMod(q - region destination origin, source extent). Never restart phase at
clip edges (`0x5e86..0x5f84`). Sampled-line branch selection uses original
unclipped region dimensions (ADM11); mask gating and full-color sampling are
source-backed (`0x5d48..0x5e26`, `0x5874`, `0x687e..0x68e2`).

N14: Body sample is mask-independent (`0x6fb0..0x6fc2` → `0x5a46`); a null
non5 pattern reaches the solid inset union (`0x7114..0x713e`, `0x721a..0x7260`).
N15: Pattern anchor P is paint Rect TL for mode1, TR for mode2, BL for mode3,
BR for mode4, absolute (0,0) for every other non5 mode. Right/bottom are exclusive.
The same P serves both body insets (`0x7156..0x7202`). Let D be requested origin,
q local output position and R declared known pattern offset, or (0,0) for
API-unavailable. Sample coordinate = floorMod(D + q - P + R, tile dimensions),
componentwise. Port-origin translation cancels; do not subtract it again
(`0x574a..0x5808`). List-view uses the extended bottom in P before clipping.
Unknown R is never silently zero. This finite current-display preparation and
caller context do not certify original device conditions or nonzero-origin API use.

## Multi-column compatibility engine contract

The following C rows preserve current public behavior from base
`057780119776c4071e183ead073a8cf15ec61290`, `src/controls.ts`
composeListHeader/composeFaceButton and `src/pixelBuffer.ts` nineSlice.
These are modern policies, not native whole-header calls or original font rules.
They belong to the typed `header.drawColumns` path; keeping the old full painter
under a renamed facade is not engine migration. Shared low-level helpers may be
reused with their compatibility behavior explicit.

| ID | input/decision | compatibility behavior |
|---|---|---|
| C1 | inactive Boolean | Truthy selects abs ID9568, otherwise9567, using F5 owner/alias selection. No sort state or per-column lookup. Missing face returns null, including when columns is empty. |
| C2 | omitted columns | [{label:'Name',width:140},{label:'Size',width:56},{label:'Kind',width:90}]. Explicit [] is retained. Width is the sum in input order; output is transparent W × H before cells. Empty list yields width0 buffer and no cells/labels. |
| C3 | height | H=max(16, explicit height if supplied, otherwise actual face height if <=28, otherwise20). Explicit compact heights still receive the16 floor. For ordinary supported calls widths/heights are integral nonnegative allocation-compatible values and labels strings; this migration adds no new normalization for malformed legacy values. |
| C4 | cell slices | Horizontal requested inset c = slice.corner if supplied, else max(2,floor((min(U,V)-3)/2)); vertical s = slice.side if supplied, else c. Rectangular nine-slice clamps left to max(0,min(c,floor(U/2))), right to max(0,min(c,U-left)), top to max(0,min(s,floor(V/2))), bottom to max(0,min(s,V-top)). Unlike native N rows, corners have horizontal c/vertical s, center exists, and pieces partition source without overlap. |
| C5 | cell transfer | Four corners copy at native size in order TL,TR,BL,BR; top,bottom,left,right,center follow. Edge/center mode is tile when slice.tile truthy, otherwise nearest-neighbor stretch (destination offset k reads source offset floor(k*sourceExtent/destinationExtent), independently per axis). Tile uses clipped final tiles. Nonpositive source/destination pieces skip. This copies prepared RGBA, including transparent pixels; it is not the native sampled-line model. |
| C6 | compatibility center | After nine-slice, sample raster at valid bgAnchor only when bgPattern absent and its pixel alpha>0; otherwise textAnchor gives (clamp(textX-3,0,U-1),clamp(textY,0,V-1)), else(c,c). If resulting sample alpha>0 and (cellWidth-2c,H-2s) positive, overwrite that rectangular center with sample RGB, alpha255. Do not introduce whole-header raw samples, body union, ppat or companion requirements. |
| C7 | labels | Font size max(8,round(H*0.6)); browser rasterizeText policy. RGB luminance = .299R+.587G+.114B from C6 sample; below128 uses white, otherwise black. No emboss. Left x=6, y=round((H-glyphHeight)/2); existing drawOver clips to cell, then places each cell at cumulative preceding widths, y0. No original font/resource-chain claim. |
| C8 | retained API boundary | Preserve ordinary column pixels/defaults and platinumListHeader caller fallback unchanged. No list-view bottom extension, pattern-origin API, whole-header strict metadata admission, raw-state overload or new diagnostics option is added to ListHeaderOptions. Profile guard and immutable owner snapshots still apply because they are shared ownership policy. |

The supported finite column domain includes empty lists, zero-width cells and
small positive heights/widths under the allocation behavior above. These do not
license new native assertions. Whole-header admission failures never reroute to
this compatibility painter.

## Diagnostics, failures and independent acceptance

| ID | observation | requirement |
|---|---|---|
| OBS1 | admission | Existing ControlDiagnostics mode/callback behavior applies. Whole-header records raw state, kind, requested/paint Rect, snapshotted context/effective clip, admission and finite reason. Geometry is `pach130-ordinary-full-color`; selection is `current-manifest-compatibility`. Actual face and required dependencies are admission observations until successful writes. |
| OBS2 | paint | Only a successful nontransparent body/border write creates selected-face usage:paint, reusing the exact prepared identity without lookup/decode again. Empty clips/masks never claim paint. This is executed-write attribution, not final surviving pixel contribution. Unsupported/error results have no successful face/body/band paint record. |
| OBS3 | pattern and lines | patternBody records phase, tile dimensions and clipped body-union coverage before borders. Only nonempty successful body fill adds actual ppat usage:paint. lineSampling distinguishes not-required/equivalent-current-display/sampled-companion/unverified; bandPaints describe actual nontransparent companion writes, joined to chosen owner/occurrence/derived transport. No double display conversion. |
| OBS4 | errors | Decode/profile exceptions retain error identity; diagnostics report admission:error when a plan exists. Callback failure follows existing ControlDiagnostics precedence; no callback or off-mode work triggers an extra decode or changes dependencies. Frozen detached records must not change after caller mutation. |

Independent checks should discriminate N1/N2 including high-bit raw state; ordinary
versus list-view lower corners; c≠s, c/s over half-source, small destinations and
ordered overlap; tile false versus true with source widths/heights1 and>1;
partial tails, transparent holes, clipped phase and negative translation; all
anchors including extended-bottom BR/BL; unknown contexts, missing versus
ambiguous/undecoded patterns, ID0, mode5, and real decode failures; raw samples
under transparent masks and opt-in exact mappings; stale/wrong-size/wrong-mask
companions and ordinary red versus sampled gray; empty regions with absent unused
samples; root hit with incompatible later base; immutable profile capability and
mutation during await; C1–C8 defaults, explicit sizes, empty lists and base owners.
Remove/flip each rule to demonstrate a corresponding independent check fails.
These hooks are obligations for separate test ownership, not authored tests here.

Unknown/outside support: original Resource Manager ownership/search/default-cinf
and cache state, monochrome/global foreground/background, recording, arbitrary
native device/depth conversions, original fonts, native sort interaction and
unexposed Appearance variants. Original native fallback art after the generic
face miss is not reproduced by the explicit whole-header API. No corpus agreement
alone proves these paths. Ordinary prepared manifests exercise the admitted
subset; unusual geometry, palette collisions and ambiguity need discriminating
synthetic cases. This spec does not reclassify any archive's ledger evidence.
