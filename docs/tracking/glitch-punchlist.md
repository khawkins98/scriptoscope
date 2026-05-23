# Window-chrome glitch punch-list — v3-reset compositor QA

QA pass on the v3-reset window-chrome compositor (`src/composeChrome.ts`), after
the source-of-truth alignment to the 2.3.1 kDEF decode. Native-res frame renders
(`npm run diag:render -- <slug> <wt> --w … --h …`) eyeballed against the period
references (`demo/assets/references/<slug>.png`, ground truth) + `npm run
diag:audit` invariants. Method: per-theme contact sheets at 240×140, spot-checks
at 360px and reference width.

**The decompiled 2.3.1 kDEF is the source of truth** (`/tmp/kaleido-trace/
kDEF231_0.asm`; summarised in `compositor-spec.md` + `kdef231-recipe-walk.md`).
When a render disagrees with the reference, suspect our *interpretation* before
the compositor.

---

## Model alignment — DONE (the blockers are resolved)

Five fixes brought the compositor in line with the decode (commits on
`v3-reset`):

1. **Negative-inset guard** — `frameFromBody` clamps each inset to `[0, cicnDim]`.
2. **WDEF id pairing** — `buildThemeJson.js` pairs chrome cicns by id (active =
   wnd#.id+1, inactive = id+0), not by name. Fixed every secondary-type mispair.
3. **Tile, not stretch** — the kDEF default blit (`0xfeae`) always tiles; only
   code 18 (`0x10320`) is a single scaled blit.
4. **End-based cell↔partCode** — segment i is `[border[i-1], border[i])` tagged
   `part[i]` (verified at `0x5356`). Was start-based (off by one), which put
   baked ornaments (1138 chevron, 1990 badge) on stretch codes; end-based puts
   the wide regions on the FIXED code-1 they carry → ornaments draw once.
5. **distributeSide** — a stretch-less half of a side cedes its slack to the
   stretching half (1990's chain sits on one side of a left-third title).

Result: all the original negative-inset / mispair / open-frame / smear blockers
are gone. `diag:audit` is at 2 warnings (both benign — 3px title-markers).

---

## Summary table (theme × type → ok / issue)

| theme | doc-window | dialog | alert | movable-modal/-alert | utility types | popup |
|---|---|---|---|---|---|---|
| **1138** | ok | ok | ok | ok | titled-util slightly busy (minor) | ok |
| **1984** | ok (V1b faint arch, minor) | ok | ok | ok | ok | ok |
| **1990** | ok | ok | ok | ok | ok | ok |
| **evolution** | ok (M5 pucker, faint) | ok | ok | ok | ok | ok |
| **beos-r503** | ok | ok | ok | ok | wnd--14292 dark patch (minor) | ok |

`apple-platinum-2` ships no recipe-based window types (procedural baseline).
1990 / evolution / beos render faithfully across **all** types.

---

## VISIBLE

### V1(a) · 1984 · document-window — left widget/corner bleed — RESOLVED
- Was: the rounded top-left title-tab (with the close box) repeated *down-left*
  along the left border, because the left edge's leading cell `[0,27)` is code-0
  (stretch) and exactly `cornerSize` (27) — the distribution grew it and the tile
  blit repeated it. Fixed by completing the corner-split (an end cell that's ⩽
  `cornerSize` is frozen FIXED when another cell can still fill the edge). The tab
  + close box now draw once, matching the reference. Reference: the 1984 left tab
  IS a fixed rounded ornament that protrudes down-left — drawn once, not scaled.

### V1(b) · 1984 · document-window — title-bar tab-curve arch texture (minor)
- **What:** a faint row of arch/comb shapes on the left of the title bar.
- **Cause:** the rounded tab's curved right edge is baked across cicn x≈8–33,
  spanning the fixed `part-2` close-gap AND the stretch `part-15` close-cell
  `[19,30)`. The `part-15` portion tiles as the cell grows → repeats the curve.
  The curve EXCEEDS `cornerSize` (24), so the corner-split can't capture it, and
  the close widget rect `[8,19]` doesn't align with the `part-15` cell, so carving
  doesn't cover it either. A large baked ornament split across cells — same class
  as the 1138 chevron but harder. Faithful-ish (the binary does tile code-15) but
  doesn't match the reference's smooth bar. Needs a wider ornament model or a
  widget/cell-alignment data fix. **MODEL/DATA.**
- **Severity: minor** (faint).

### V2 · 1984 · popup-window — NOT A GLITCH (faithful)
- Re-examined: the central upward protrusion (the popup menu tab) is the scheme's
  cicn design, and the collapse cells (codes 5/6) draw it ONCE, centred — pixel-
  exact to the cicn by construction (end-based fix). The bar fills symmetrically
  via the 1px `part-8` cells; the white square at the tab base is in the cicn.
  The "notch/gap" was a contact-sheet-thumbnail misread. Renders faithfully.

---

## MINOR (remaining — all faint)

- **M3 · beos-r503 · wnd--14292** (collapsed side-float, low-traffic) — a dark
  patch at the bottom-right where the bottom edge ends, and the right side reads
  open. The only genuine remaining artefact, on a rarely-used collapsed type.
- **M4 · 1138 · titled-utility-window** — the two-segment title bar reads
  slightly busy (two widget clusters); faithful enough, flagged for polish.
- **M5 · evolution · document-window** — top-left pipe-elbow seam pucker; faint.
- (1984 doc-window **V1(b)** title-bar arch, above, is also minor.)

## Re-checked and found FAITHFUL (not glitches)
- **1984 alert "red top edge"** — the red band is baked into the alert cicn
  (rows y2–5) — the scheme's intended alert accent, not an artefact.
- **beos-r503 document-window "double R/B edge"** — that's the BeOS beveled
  border (highlight + shadow), not a doubled line.
- **beos-r503 document-window right-tail / bottom-right gap** — FIXED. The beos
  active-doc cicn is a 92px-wide resource whose frame art ends at column 74 (its
  top/bottom recipes likewise stop at border 75); the 17px transparent tail had
  been inflating `frame.right` to 22px (vs the real 5px, symmetric with the left)
  and, because the bottom recipe stops at 75, leaving the bottom edge short of the
  corner. The compositor now sizes the structure rect to the cicn's *drawable*
  extent (`drawableExtent`, the mask the kDEF blits with), not its raw bounds — a
  no-op for every well-formed frame, trims only beos's padded frames. Right border
  is now a clean 5px and the bottom-right corner meets.
- **1984 popup** (V2 above).

---

## Audit warnings (2) — benign

Both are 3px-wide `part-4` title-text-colour MARKERS (1138 popup + titled-utility)
mis-classified as widgets by the audit's `≤2px = marker` heuristic. Not a render
glitch; widen the audit's marker threshold to ≤3px, or leave as a known false
positive.

---

## Method notes
- `diag:render` writes the chrome FRAME only (no content/title text), so the
  content area shows transparent; the title TEXT is drawn in `renderWindow.ts`.
- References are 4-bit PNGs — decode with PIL, not `scripts/diag-lib.mjs`.
- Contact-sheet generator (per theme, all non-collapsed types) is an ad-hoc PIL
  script; re-create as needed.
