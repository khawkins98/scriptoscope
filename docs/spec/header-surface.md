# Whole-header surfaces and column compatibility

`composeHeaderSurface` draws one explicit whole header rectangle. It is separate
from `composeListHeader` and `platinumListHeader`, which retain their existing
multi-column layout, labels, height policy and pixels. The new primitive does not
turn each column into an original Appearance Manager header call, draw a label,
or change the existing rendering-options scenes.

## Public boundary

```ts
const surface = await composeHeaderSurface(theme, {
  kind: 'list-view-header', // or 'window-header'
  width: 180,
  height: 18,
  drawState: 1,
  compositionContext: {
    controlOrigin: [12, 24],
    portOrigin: [0, 0],
    patternOrigin: { status: 'unknown' },
    clip: { kind: 'rect', rect: { x: 12, y: 24, w: 180, h: 18 } },
    basis: 'caller-declared',
  },
});
if (surface.status === 'rendered') {
  document.body.append(bufferToCanvas(surface.buffer));
} else {
  // Decide explicitly how this application handles absent/unsupported art.
  console.info(surface.status, surface.reason);
}
```

The caller supplies positive integer dimensions, UInt32 `drawState`, and a
composition context. `controlOrigin` plus dimensions is the sole requested Rect;
its edges and the list-view incremented bottom must fit signed16 coordinates.
Invalid arguments reject. Unknown clip is explicitly unsupported; an unbounded
clip must be declared. The returned buffer is exactly the requested dimensions,
with transparent pixels outside the effective clip. It contains no port-sized
padding. The caller owns placement, refresh and borrowed theme lifetime.

The list-view path paints a rectangle one pixel taller, then clips to the
original requested rectangle intersected with the caller clip. Extending the
rectangle changes the lower corners and bands before clipping; clearing the last
row of an ordinary header is not equivalent. Ordinary headers use the requested
rectangle directly. The ordinary-window origin `(-1,-1)` is unsupported: its
original wrapper also needs current port bounds and conditional window
visibility/region state, which this API does not accept. Other signed origins
remain ordinary declared inputs.

The original callback tests the complete raw state for zero. Zero selects
`cicn -9568`; every nonzero UInt32 selects `-9567`. This does not invent a pressed
`-9566` variant, assign HTML disabled behavior, or establish the historical
availability of every later named `ThemeDrawState` constant.

## Admitted source model

The initial subset is ordinary, full-color, non-picture-recording solid or direct PixPat drawing
under Scriptoscope's declared current-display color policy:

- Actual selected face and same-owner `cinf` metadata must be usable. Current
  manifest ID aliases, base search, duplicate policy and body-pattern ownership
  remain compatibility policies, not reconstructed Resource Manager search.
- A valid explicit non5 body request performs the current same-owner pattern
  lookup, including resource ID0. A selected opaque pattern takes priority;
  a decode error rejects. Pattern origin must be explicitly known or declared
  API-unavailable; unknown origin returns `unsupported: unknown-pattern-origin`.
  Nonopaque substituted pattern images are unsupported. An ambiguous selection
  cannot be called a missing pattern. Only an established current lookup miss
  admits the solid body. Mode5 cicn bodies remain unsupported.
- The actual face owner's valid raw background sample supplies display RGB,
  independent of mask, when the selected body path is solid. No raster corner, label color or opaque-anchor fallback
  substitutes for missing sample metadata. Direct handcrafted theme metadata is
  a caller declaration; shape validation does not authenticate its bytes.
- The body is the union of the two transposed corner/side inset rectangles,
  painted before the border. Corners are square; independent side bands may
  overlap corners and each other. Order is TL, TR, top, BL, BR, bottom, left,
  right. The full source raster is retained. True tile repeats the complete
  middle strip with a clipped final tile; false narrows to its first column/row.
  Clipping never restarts the source phase.
- A source width1 expanded horizontally, or source height1 expanded vertically,
  reaches the original raw-color line sampler, regardless of the tile flag.
  Decoded pixels require matching [opaque current-display equivalence](indexed-sampling-equivalence.md).
  Otherwise the selected owner's matching sampled companion supplies those
  lines, with exact dimension/display-policy and mask checks. Missing or invalid
  data remains `unsupported: unverified-line-sampling`; no raster-color fallback
  is invented. See [sampled-line support and its finite literal](header-sampled-lines.md).
- A visible band requiring source coordinates outside the raster returns
  `unsupported: unsafe-source-geometry`; an equivalence record cannot establish
  out-of-bounds sampling. Valid unequal/overlapping insets are not rejected merely
  for exceeding half the raster. Tiny requested rectangles have no label-driven
  minimum; their corner overlap follows the admitted order.
- Source alpha must be binary. Substituted PNGs with partial alpha return
  `unsupported: nonbinary-mask`; browser alpha blending is not called original
  CopyMask behavior.

`rendered`, `unavailable` and `unsupported` are distinct public results. Missing
face is unavailable. Missing/malformed metadata and the excluded paths above
are unsupported, with finite reason strings. There is no automatic legacy or
procedural fallback. Mono/global foreground/background, mode5 bodies, recording paths, optional device-color caches, original device
conversion and historical resource ownership remain outside this subset. Solid
fills do not need a known pattern origin, and no unknown pattern offset is
silently asserted as original state.

## Source bindings

These header bindings come from static inspection. The product runtime and CI
do not execute or redistribute original engine code.
The selected Kaleidoscope 2.3.1 `PACH`130 payload is 87,914 bytes, SHA256
`bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`.
Addresses below are offsets within that payload, not kDEF offsets.

| Boundary | PACH130 evidence |
| --- | --- |
| Appearance dispatch | `0x9b18/0x9b20` → `0x9bd4/0x9bda` → ordinary `0xc41c` / list-view `0xc504` |
| Raw state selection | callback `0xc1e8..0xc1f8` tests long state at+8, selects−9568 or−9567; `0xc1fa` → `0x7668` → body-enabled `0x6ea6` |
| List-view Rect/clip | `0xc524..0xc538` intersects original Rect with clip; `0xc53a..0xc546` increments bottom before drawing |
| Ordinary sentinel | `0xc430..0xc48a` conditionally changes clipping for state0 at(-1,-1); `0xc4ae..0xc4d4` clamps its right to portRect.right+1 |
| Metadata/source bounds | corner/side `0x6f48..0x6f58`; full source bounds `0x7042..0x704c` |
| Body sample and fill | mask-independent sample `0x6fb0..0x6fc2` → `0x5a46`; RGBBackColor `0x705a..0x705e`; pattern/null selection `0x7114..0x713a`; inset union `0x71a2..0x7202`; solid fill `0x721a..0x7260` |
| Border order/coordinates | `0x72a8..0x7620`; repeat direction true at `0x73ce/0x752c/0x75a4/0x761c` |
| Sampled expansion | helper `0x5cb8`; one-column/row `0x5d48..0x5e26` uses mask-gated `0x5874` and palette sampler `0x687e` |
| Ordinary repetition | forward tiles `0x5e86..0x5f84`, partial-tail clipping `0x5eaa..0x5f00`, original-mask CopyMask `0x5f4e` |
| Excluded recording/cache | recording `0x5f18..0x5f32`; optional cache `0x13406` with destination palette/device state |

The pinned Apple Universal Interfaces 3.4.1
[Appearance.h](https://github.com/elliotnunn/UniversalInterfaces/blob/328d38f2b72b2d4ceda30170eea32ca6b9de218a/3.4.1/Universal/Interfaces/CIncludes/Appearance.h)
(SHA256 `ea4337a6b07144879928ef1d73caca8ef9ff771b63fcd9f11fe9921e885b05fc`)
independently identifies AA74 selectors 5/6 as `DrawThemeWindowHeader` and
`DrawThemeWindowListViewHeader`, with Rect/UInt32 state and no column/text input.
This later header identifies the API shape; it is not an original pixel capture.
The source restores CurResFile before its cinf lookup and can fall back to cinf0;
that is not established by our same-owner manifest policy.

## Diagnostics and independent checks

`diagnostics` adds a frozen per-call `header-surface` record with raw state,
requested/paint Rects, context/clip, admission and reason. Actual face/dependency
resolution uses `usage: admission`. A rendered result reports whether any
admitted body or border pixel was written (`painted`). Only actual writes add
the selected face's `usage: paint` record, reusing the prepared identity without
another lookup/decode. An empty effective clip can return a rendered transparent
buffer without a paint claim. This records an executed paint operation, not the
final contribution of each pixel after overlapping writes. An unsupported pattern context or failed decode never receives a
successful painted dependency record. Callback success/error precedence follows
`ControlDiagnostics`; off-mode performs no diagnostic decode.

The hand-serialized fixture in `tests/decoder-fixtures/header-surface.mjs` has
independent literal rows for c2/s1 first-strip masking and c2/s3 overlapping bands,
partial final tiles, clip-through-tile phase, and ordinary/list-view lower edges.
A separate bit15/ColorSpec collision uses the retained sampled companion for both tile flags, with strict missing-data rejection. Browser
checks exercise source/built public loaders, raw states0/1/2/0xffffffff, actual
owner/occurrence/payload joins, missing/invalid evidence, tiny rectangles, frozen
concurrent contexts, decode/callback boundaries, and unchanged old column pixels.
The old column output differs from the whole-header literals by 146/176 pixels on
the fixed 11×16 experiment; that demonstrates the API boundary, not permission to
silently migrate existing callers. No golden or ledger status is promoted by
these synthetic inputs or regression checks.

## Direct full-color pattern body

PACH130 `0x7114..0x713a` selects a PixPat, including ID0. Its original paint Rect
sets P at `0x7156..0x719e`: mode1 TL,2 TR,3 BL,4 BR, otherwise zero (mode5 is
excluded earlier). Both transposed inset rectangles use that same P at
`0x71a2..0x7202`. Helper `0x574a` saves O, sets O−P (`0x5768..0x577c`), translates
the finite clip and Rect by−P (`0x579a..0x57c2`), and calls the full-color
`FillCRect` path (`0x57cc`→`0x5698`→`0x572a`) before restoring coordinates.
The existing [declared pattern-offset convention](control-pattern-context.md)
therefore applies: sample(q)=floorMod(D.origin+q−P+R, tile size). Port translation
cancels from physical placement; it is not an extra subtraction from sampling.
List-view P uses the extended bottom **before** original-height clipping.

This API does not substitute zero for unknown R. API-unavailable is an explicit
caller declaration, not evidence of the original environment. The decoded tile
already uses its owning theme's display policy; painting does not transform it
again. Original lookup/cache/device/recording and nonzero-origin API invocation
remain unverified. Borrowed theme lifetime remains caller-owned.

`headerSurface.patternBody` records phase, tile size and clipped body-union pixel count
before masked borders (not final surviving pixels). Only a successful, nonempty
body adds its actual prepared ppat identity with `usage: paint`; empty clips,
unsupported mappings and later failures retain admission observations alone.
The hand-encoded4×2 PixPat in `tests/decoder-fixtures/header-pattern.mjs` has literal
rows for all four corner anchors, negative D, translated O, a nonzero R, masked
border overlap and clipped list-view extension. These are finite synthetic
current-display expectations, not original captures or new ledger assessments.

## Corpus rule table (2026-10-21)

`tests/rendering-options/tab-header-rules.mjs` restates the selection and paint
rules above as a pure table, independent of `src/`. Its source/built spec runs
`composeHeaderSurface` for every archive: both kinds, raw states 0/1/0xffffffff,
sizes 61×17 and 7×5, control origins (0,0) and (5,3), a declared known pattern
offset R=(0,0) and an unbounded clip. Re-read in the pinned PACH 130 listing:

- Selection (0xc1e8–0xc1f8): zero raw state selects -9568, any nonzero state -9567.
- Regions (0x72a8–0x762a): corners c×c are clamped to the source bounds. The top/bottom bands are s rows over destination x [c, W−c), the left/right bands s columns over [c, H−c). When cinf[2] is zero the band source is one column/row (0x7396–0x73a4, 0x756c–0x757a).
- Body (0x71a2–0x7202): inset (c horizontal, s vertical), then the transposed inset when c≠s, both sharing P. The pattern is used iff the archive ships the cinf+4 ppat; otherwise the body is solid from the raw sample.
- Pattern anchor (0x7156–0x719e): P is the paint Rect's TL/TR/BL/BR for modes 1–4, else the absolute point (0,0), so mode 0 and mode 1 differ only away from origin (0,0).

All 13 archives with header art match on every pixel (432 rows). Pattern bodies:
1990 (both states), animals (active), crayon-os and evolution (both) and
monkey-paradise (active). Dolphin-som's active header requests ppat -9567, which it
does not ship, so its body is solid. In 1984, 1990, apple-lisa, evolution,
windows-31 and windows-95, -9567 and -9568 give identical output in every row, so
selection is not discriminated there. No archive discriminates the c/s swap,
single-inset, repeat-flag or body-order readings. Synthetic specs cover them:
`header-band-requirements.spec.mjs` catches c/s swap, single inset and body order,
and only `header-surface.spec.mjs` catches the repeat flag. The 18 archives' original pattern offset R, file ownership and
`composeListHeader` (a compatibility column helper) are not covered.
