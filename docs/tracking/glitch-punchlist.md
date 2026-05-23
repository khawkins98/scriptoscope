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
| **1984** | **V1** (widget bleed + arch) | ok | M2 (red top edge?) | ok | ok | V2 (arrow notch) |
| **1990** | ok | ok | ok | ok | ok | ok |
| **evolution** | ok | ok | ok | ok | ok | ok |
| **beos-r503** | M1 (faint double R/B edge) | ok | ok | ok | wnd--14292 dark patch (minor) | ok |

`apple-platinum-2` ships no recipe-based window types (procedural baseline).
1990 / evolution / beos render faithfully across **all** types.

---

## VISIBLE

### V1 · 1984 · document-window — left widgets bleed below the title bar + title-bar arch texture
- **What:** (a) the close/zoom widgets on the title-bar's left corner are
  stamped/bleed *down-left* into the left border below the title line (a stack of
  rounded blobs hanging off the left edge); (b) the title-bar left shows a row of
  small arch/comb shapes.
- **Cause:** (a) **MODEL/GEOM** — the left-edge corner/widget sampling pulls the
  title-corner art down the side band (the old "title-corner bleed"). (b) the
  `part-15` close-cell band (cicn x19–30) tiles its arch decoration as the cell
  grows; the reference bar is smooth. Likely the close-cell carve/fill sampling
  the bar ornament rather than a flat fill.
- **Severity: visible.**

### V2 · 1984 · popup-window — notch/gap at the top-centre arrow
- **What:** the top edge has a small protrusion (popup arrow) with a gap/notch
  around it; the bar doesn't close cleanly across the centre.
- **Cause:** **MODEL/GEOM** — the centre arrow widget interrupts the top fill.
- **Severity: visible** (popup, lower traffic).

---

## MINOR

- **M1 · beos-r503 · document-window** — a faint double line on the right and
  bottom border (the cicn's ~1px right margin reads as a second edge). The
  earlier "transparent right tail" is gone; this is the residual. **DATA/decoder.**
- **M2 · 1984 · alert** — a red line along the top edge. May be the scheme's
  alert accent (intended) or a 1px corner artefact; confirm against the ref.
- **M3 · beos-r503 · wnd--14292** (collapsed side-float) — a dark patch at the
  bottom-right corner.
- **M4 · 1138 · titled-utility-window** — the two-segment title bar reads
  slightly busy (two widget clusters); faithful enough, flagged for polish.
- **M5 · evolution · document-window** — top-left pipe-elbow seam pucker; minor.

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
