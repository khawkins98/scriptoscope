# Compositor spec — the authoritative window-chrome model

*The implemented chrome model (the spec). For the "how does it work" tour, see [`kdef-architecture.md`](./kdef-architecture.md); for binary lookups, [`kdef231-reference.md`](./kdef231-reference.md).*

This is the canonical artifact for (re)building `src/composeChrome.ts`. It
consolidates the Kaleidoscope **2.3.1** kDEF decode (`kdef231-recipe-walk.md`)
PLUS the gaps we found while implementing it. The
schemes are **K2 / 2.x format** (they ship `wnd#` recipes + `cinf`); the 2.3.1
kDEF is the engine that draws them. Earlier 1.8.2 material is historical.

> **Looking up an address, resource id, struct offset, or coordinate?** Start at
> [`kdef231-reference.md`](./kdef231-reference.md) — the standing 2.3.1 kDEF
> reference that indexes this spec, the recipe-walk, and the faithfulness ledger
> in one lookup table. This spec is the *implemented model*; that reference is the
> *index over the binary*.

The litmus: this was a small, deterministic 68k routine. The model below is
simple and GENERAL — no per-theme special cases. If an implementation needs
per-theme branches, it has the model wrong.

## The three data sources (must be used TOGETHER)

A window type provides:
1. **cicn** — the minimum-window artwork bitmap (the template the recipe indexes).
2. **wnd#** — a **rect-list** (named widget rects: close/zoom/shade/marker + the
   body) and **4 side recipes** (top/bottom/left/right), each a list of
   `(partCode:int16, border:int16)`. Walking a side gives cells
   `[border[i-1], border[i])` tagged `partCode[i]`. Borders are cicn-template
   (SOURCE) coordinates. **theme.json `part-N` IS the raw partCode (identity —
   verified).** Loader: `tools/theme-loader/decoders/wnd.js`.
3. **cinf** — per chrome element: `cornerSize`, `sideThickness`, `tileSides`,
   `patternAnchor`, and the `textPixel` / `embossPixel` (title text colour) +
   `bgPixel`. Loader: `tools/theme-loader/decoders/cinf.js`. **Currently NOT
   surfaced in theme.json or used by the compositor — this is a gap.** (In the
   corpus, all elements have `tileSides=0` ⇒ stretch, `cornerSize`≈5–7.)

The compositor we built used only #1 and #2 (recipe) and mishandled the
rect-list; #3 (cinf) was ignored. That is the root of the remaining issues.

## Part-code classification (decoded jump table `0x49d6` + `0x5178`)

Per cell, keyed PURELY on the part code (not pixel content, not width):

| code(s) | behaviour |
|---|---|
| 1, 5, 6, 7, 9, default | **FIXED** — drawn 1:1 at src width. (5/6 are the title bezel: fixed when the title fits; collapse to 0 when it doesn't; never grow.) |
| 8, 11 | **GROW** — a primary share plus rounding remainder. |
| 13, 14 | **REMAINDER ONLY** — share the leftover pixels after whole-tile truncation; excluded from the primary divisor. |
| 0 | **COLLAPSE** — zero width. |
| 10 | **FLAG-GATED** (jump table `0x4a0c` returns the caller's flag): its stretch verdict (width 0) applies when title-fits is set and always on non-title sides (flag 1). We classify it FIXED, a divergence (see note and the faithfulness-ledger `0x4a0c` row). |
| 15, 16, 17 | collapse to zero iff the corresponding widget is PRESENT; else fixed. |
| 2, 3, 4 | the close/zoom/shade GAP cells — fixed when widget present; collapse to zero when absent. |
| 12 | **TILE** — primary share truncated down to a whole multiple of source width (possibly zero); the unused fraction joins the remainder pool. |
| 18 | **SCALE** — a single scaled CopyBits (drawn once, mapped src→dst). |

**code 10 note (superseded rationale):** under the corrected `0x5178` reading a
stretch verdict means width 0, and non-title sides pass flag 1
(`0x4db4`/`0x4dd4`/`0x515e`). The decode therefore collapses code-10 cells on
untitled sides, and on titled sides whenever the title fits. The earlier "fixed
≡ stretch" argument predates that correction. The runtime keeps code 10 FIXED
because its band carries BAKED close/zoom art that only the unimplemented
rect-list widget pass (`0x632e` → `0x6062`) would redraw. That pass places
widgets through `0x5cb6`, which remaps their rects by the placed side-list
widths. What a collapse does to widget placement is not established
([reference §5.1](kdef231-reference.md)). This is a divergence
(see the faithfulness-ledger `0x4a0c` row) with a failing `todo` in
`tests/rendering-options/window-chrome-rules.test.mjs`.

**Widget draw:** the kDEF draws the named widgets in a SEPARATE pass over the
rect-list (`0x632e` → `0x6062`), NOT in the recipe walk. `0x572e`'s side loop
never reads the wnd# rect-list; after it, `0x5a3c` calls `0x632e` for the
zoom part only. `0x5ffc` → `0x5ddc` is the hit-test, not a draw pass
(corrected 2026-10-21). `0x6062`'s dst rect is the template-coordinate entry
rect remapped by `0x5cb6` through the placed cells. In state 0 it blits the
chrome template itself, not a widget cicn. We don't replicate that
pass; instead the widgets ride the FIXED recipe cells they sit in (empirically
all corpus widgets land in code 1/2/3/4 fixed/gap cells or the fixed leading
corner), drawn 1:1 by the edge walk. This is why the carving/stamp pass could be
retired — it holds as long as no widget lands in a growing cell.

## Draw + distribution

- **Template extent = the cicn's DRAWABLE extent, not its raw bounds.** The kDEF
  blits the template with its mask and walks each side over `[0, lastBorder)`, so
  columns/rows past the last drawn pixel are slack in the resource, not part of
  the window. The compositor sizes the structure rect to the last opaque column/
  row (`drawableExtent`). A no-op for every well-formed frame (art reaches the
  bitmap edge); it trims only beos's active-doc-window, a 92px resource whose
  frame ends at col 74 / recipe border 75 — without it `frame.right` inflates to
  22px (real: 5px) and the bottom recipe (stops at 75) falls short of the corner.
- **Cell↔partCode is END-BASED** (`0x5356`): segment i is `[border[i-1],
  border[i])` tagged `part[i]` — the part code travels with the border that
  CLOSES its cell. The segment loop (`0x4a64`) starts at index 1, so the
  pre-first-border region `[0, border[0])` is never a growing segment — it is the
  **fixed leading CORNER, drawn 1:1**. The trailing `[border[N-1], srcExtent)` is
  likewise a 1:1 corner. (Corner preservation is intrinsic to the walk — there is
  no separate cornerSize heuristic.)
- **Distribution** (`0x5178`): subtract fixed widths from the output span.
  Only codes **8/11/12/18** count toward the primary divisor (caller `0x4b3e`).
  Divide that nonnegative budget evenly, then truncate each code-12 share to
  whole source-width tiles. A first pass collects both the initial division
  remainder and every tile's unused fraction (`0x51b4..0x523e`). A second pass
  divides the accumulated remainder among **8/11/13/14/18**, updating the remaining
  budget and recipient count after each cell (`0x5260..0x532e`). Codes 13/14 get
  only this remainder; 8/11/18 also get the primary share. Indivisible extras go
  to **later** recipients (e.g. 10 pixels across three ordinary growers → 3/3/4).
  A tile-only edge can leave an unallocated remainder; do not invent partial
  tiles or a minimum one-tile allocation. With no primary grower, remainder-only
  cells receive zero.
  **Symmetric about the title:** each half allocates independently. A half with
  no primary grower keeps its fixed width and cedes the rest to the other half.
  Below the fixed-art minimum, the runtime retains fixed widths and clamps the
  flexible budget to zero, so art can clip. This is an explicit existing runtime
  limit, not a claim to emulate the kDEF's small-window negotiation.
- **Per-cell blit:** the kDEF default blit (`0xfeae`) **always TILES** the src
  cell across the dst (`kdef231-recipe-walk.md` Q5) — there is no scaled CopyBits
  for ordinary fills, and `cinf.tileSides` does NOT gate it. Only code 18
  (`0x10320`) is a single scaled blit. A 1px src band ⇒ a uniform fill.
  Tiling runs along the side. The caller passes a direction byte that sets
  the anchor: 0 for codes 11 and 14, 1 for every other code. Codes 11/14 tile
  from the far end (right/bottom), so their partial tile sits at the near end.
  Every other code tiles from the start (behaviour and formula:
  [`engine/qd-primitives.md`](engine/qd-primitives.md) §4 tile blit).
  (Correction: an earlier draft of this spec said tileSides selects tile-vs-
  stretch; the 2.3.1 decode shows the blit is unconditional tiling.)
- **Widgets ride the FIXED cells (no carving):** the close/zoom/shade widgets are
  baked into the cicn title bar, and with the end-based association they fall
  inside the wide FIXED title-bar cells (code 1) — drawn 1:1 by the edge walk,
  anchored, never tiled. Verified: 0 widgets land in a growing cell across all
  corpus window types. (An earlier model carved the rect-list widget rects out of
  stretch cells and stamped them in a second pass; that was a workaround for the
  start-based off-by-one putting widgets in stretch cells, and is now retired.)

## Title TEXT + plate

The title text is a **centred part**: positioned at the window content centre
(`cx = frame.left + contentW/2`), independent of frame growth, in the header
text colour. Drawn in `renderWindow.ts`.

**Vertical** placement follows the scheme's title-text MARKER, not the bar's
geometric centre. The marker is the ≤2px-wide vertical line in the title bar that
the kDEF samples for the title colour (`0x5530`); a scheme draws it AT the title,
so its y-span is the text's vertical band. `composeChrome` exposes the band centre
as `titleRegion.midY` (clamped into the bar) and `renderWindow` anchors the title
(and the colour-sample region) there, else falls back to `frame.top/2`. This fixes
tall ornate bars (evolution) where the text well sits well below centre; flat bars
(1138, marker ≈ centre) are unchanged. Data-driven on import, no per-scheme code;
guarded by the `title` rule in `lint:themes`.

The **title PLATE** (the "pill" behind the text) is the chrome side of the same
mechanism, decoded at kDEF `0x4a64`: the kDEF sets the title face (`TextFace`, $A888), measures the
title via `StringWidth` ($A88C), gates it (title-fits at `0x4f58`), then sizes the title-
anchor cell's DEST span to that **measured title-text width**, centred (`0x5034`;
the `/2` at `0x4ff8`/`0x501c`). That anchor cell is **code 5** — flanked by
code-6 bezels (`0x4f74`/`0x4f90`) — and its src (a 1px pill column in 1138) is
tiled across the reserved width (`0xfeae`); the two fill halves pin to its edges.
So the plate **grows to fit the title**, not the other way round. Implemented:
`renderWindow` passes the measured `titleWidthPx` into `composeWindowChrome`;
`distributeSide` grows the code-5 cell to it (code-6 fixed); the edge walk tiles
the plate src across it. Without this the plate stays its tiny src width and dark
header text spills onto the bezel (the 1138 symptom).

## Validation cases (the reference images are ground truth)

Render at a few sizes and compare to `demo/assets/references/<slug>.png`:
- **1138**: clean platinum title bar (pinstripe = code 8) that FILLS as it
  widens; close box anchored left, zoom/shade right; title centred; corners fixed.
- **1990**: camo/LED border; the "1990" + star drawn once; rods stretch.
- **1984**: gray bar, light-blue centred title, button row drawn once.
- **evolution**: metallic pipe border, "XPe" once, white centred title, no stray
  dark box beside the title.
- **beos**: yellow tab, clean uniform thin border that fills the bottom.

## Status / remaining

The model above is implemented in `composeChrome.ts` and the corpus renders
faithfully (see `glitch-punchlist.md`). Resolved since the first draft: tile-not-
stretch blit, end-based cell association, grounded corners, the retirement of
the widget-carving + cornerSize-split heuristics (widgets ride fixed cells now),
and the **`0x5178` width-pass semantics** — the part-code classifier was reading
the `0x49d6` table as a fixed/tile binary, so the "stretch" verdict for code 0,
the gap codes 2/3/4 (widget absent) and the widget-cell codes 15/16/17 (widget
present) TILED those cells. In the kDEF that verdict means **collapse to width
0**: the cell yields its span to the primary growers (8/11, tile 12, scale 18) and remainder cells (13/14) / to the separately-drawn widget. Fixing this removed 1984's row of
title-tab arches (code 15 tiled) without a content heuristic — it now collapses,
and the flat fill grows, matching the period reference's structure.

Also resolved: **corner composition order**. At the corners two edges' bands
overlap; the horizontal bars (top/bottom) span the full width incl. the corners,
so they must be drawn AFTER the side edges or a side overdraws the corner with
its own 1:1 cicn-corner block. The bottom edge already drew last; the TOP edge
did not, so a side re-introduced the very art the top edge had collapsed (1984's
close-tab/bar junction left a ~2px wedge). Drawing top last (the title bar owns
its corners) made the collapse hold — 1984 now matches the reference pixel-wise.
The 2026-10-18 allocation correction follows the two-pass routine above. The old
single-pass allocator counted 13/14 as full growers and rounded tiles to nearest,
losing or overrunning the output budget. At content width 240, monkey-paradise's
bottom edge ended 14 pixels early; at 320 it clipped 67 opaque corner pixels.
`src/composeChrome.test.mjs` now verifies actual bottom-corner pixels for both
states of monkey-paradise and animals at native/240/320 widths, plus small pure
allocation cases. These tests run in `npm test` and therefore `npm run gates`.

Open:
1. **`cinf` is not surfaced/used** (cornerSize / sideThickness / tileSides /
   textPixel). The corpus ships no window `cinf`, so the compositor derives the
   corner from the recipe and tiles unconditionally — faithful for this corpus,
   but a scheme that DID ship a window cinf wouldn't be honoured.
2. **Structured wide fills** at very large sizes (camo/pipes): tiling keeps the
   texture; a couple of corner joints read marginally off at extreme widths (M5).

## References
- `kdef231-recipe-walk.md` — the full part-code / draw decode, from the
  Kaleidoscope **2.3.1** kDEF (the engine our K2 schemes use). The source of
  truth behind this spec. This doc and the recipe-walk summarise the listing.
  When they disagree with a reference render, a spec writer or verifier
  re-checks the listing and corrects this spec; implementers file a spec
  question instead ([implementer brief](engine/IMPLEMENTER-BRIEF.md)). Listing
  provenance: [`engine/compositor-spec.evidence.md`](engine/compositor-spec.evidence.md)
  (spec writers and verifiers only).
- `diagnostic-tooling.md` — the in-browser slice inspector + the
  `diag:render` / `diag:audit` CLIs for validating against the reference images.

## Window type selection before composition

The renderer resolves an exact usable window-type key first, then equivalent
canonical, legacy and raw signed `wnd#` keys from the portable
`tools/theme-loader/window-type-identities.js` authority. For example,
`collapsed-side-utility`, `collapsed-side-floating-utility-window` and
`wnd--14292` identify the same authored type. Exact conflicting/custom keys still
win. The loader retains its shipped manifest names; it does not rename bundles.
Only after equivalent identities miss does the kDEF wnd# mask fallback cascade
run, expanding each fallback identity through that same key table. Generic utility/mini/floating/palette aliases prefer
complete titled-utility, other utility, then floating/palette recipes using the
manifest's canonical window-type keys. Resource URLs never identify a window
role: browser loading rewrites them to opaque blob URLs. A grow-box mispair is
rejected using the matching chrome element's structured author label.

Collapse discovery uses the owner selected by the expanded request's existing
child-first render policy. A usable child fallback still wins over an exact
collapsed type in its base; an empty child can defer to its base. Both sliced and
corner-sprite types use the shared window eligibility check; a corner sprite does
not require a sliced top-edge recipe. If no authored collapsed type is found,
the manager retains the expanded type at zero body height. These are runtime
identity/selection guarantees, not a claim about original Resource Manager search
ownership or independently verified original window pixels.


## Runtime theme request ownership

This is a web runtime lifecycle policy, not reconstructed kDEF drawing behavior.
`WindowManager.retheme(theme, signal?, themeRef?)` uses a manager request epoch and stages
all connected managed windows before committing chrome synchronously. A newer
call or aborted caller signal discards the old preparation. A current preparation
error rejects without assigning the new theme or changing any window canvas.
Per-window epochs invalidate older focus/size renders; a theme batch re-prepares
entries whose state changed while decoding. Removed entries cannot commit.

The live pooled canvas, title-strip cache, and `describe().theme` change only
inside commit. The optional declarative `themeRef` stamps those exact hosts
before change notifications; it is a consumer ref, not a provenance identity.
Title-widget pressed paints/release also check the current chrome and entry/press
epochs before touching the pooled canvas. Preparing a replacement requires temporary canvas storage; it
must never move or paint a live pooled canvas before the ownership check.
Standalone add calls are enrolled if their hosts are connected before the batch
commits; a host connected afterwards retains the explicitly supplied add theme.

Declarative mounts invalidate a prior request at invocation, before loading.
Superseded failures are suppressed; the current failure rejects. A completed
request updates its URL/default, picker, and `retheme` event after controls finish.
New scans wait for request settlement; scans already running are enrolled before
window preparation. A failed load therefore cannot become the default for later
windows. Window batch atomicity does not promise whole-desktop rollback: buttons,
tabs, and native control faces have guarded individual commits after chrome.
Individual control failures retain the existing logged-error behavior.


## Declarative button lifecycle

A mounted button keeps its original element and form association. The mount owns
its replacement faces, click/keyboard listeners, hidden display property and
promotion stamp. Ownership is published synchronously before inserting a face,
so a consumer insertion observer can disconnect without leaving an orphan.
Disconnect disposes every owned face (including one whose async caller has not
resumed), restores only unchanged runtime-owned source properties, and returns
focus after enclosing window restoration. Consumer style/attribute edits and
live form values survive. Retheme disposes the replaced face after preparation.

The scanner captures parent and mount eligibility before loading a theme and
checks them before face preparation; preparation also checks its source parent,
mount boundary, requested reference and lifetime immediately before committing. Removed/reparented sources are not moved back.
A connected source moved within the mount retries under its
current parent/theme, at most once per animation frame, until stable or disconnected. The optional preparation signal stops
sequential face, ring and pressed-state work after cancellation; it does not
transfer theme ownership or dispose a returned imperative face automatically.
Two-argument public `promoteButton` still supports disconnected fragments.
Button disabled/default state is sampled on promotion/retheme. Live attribute
observation and tab/text-field decoration restoration are outside this change.
