# Window-chrome glitch punch-list — v3-reset compositor QA

Visual QA pass on the v3-reset window-chrome compositor (`src/composeChrome.ts`),
comparing native-res diag frame renders against the period reference images
(`demo/assets/references/<slug>.png`, ground truth). Method: `npm run build` →
`npm run diag:render -- <slug> <wt> --w … --h …` (reads the chrome FRAME PNG +
placement JSON under `themes/<slug>/diag/`, git-ignored) → eyeball + scan vs
reference; `npm run diag:audit` invariants folded in.

**This is an enumeration only — no `src/` was touched.** Cause tags: **MODEL**
(part-code / draw / distribution logic in `composeChrome.ts`), **DATA**
(theme.json `part-0` rect / recipe / resolved cicn doesn't match the real
wnd#/cinf/art), **GEOM** (frame/padding derivation).

---

## Summary table  (theme × window type → ok / N glitches)

| theme | document-window | dialog | alert | movable-modal/-alert | titled-utility | side-float-utility | popup | other wnd-- |
|---|---|---|---|---|---|---|---|---|
| **1138** | 2 (proxy smear) | ok | ok | **blocker** (neg-inset) | 1 (proxy + bottom notch) | **blocker** (neg-inset + gap) | — | collapsed-* neg-inset |
| **1984** | 1 (corner smear) | **blocker** (thick R/B frame) | ok-ish | **blocker** (neg-inset) | 1 (detached widget) | **blocker** (neg-inset) | **blocker** (broken) | — |
| **1990** | ok (best) | — | — | — | — | — | 1 (visible) | wnd--14296/14322/14332 gaps; neg-inset on 14288/14296/14322/14332 |
| **evolution** | ok | — | — | — | no chrome | (side carve gap) | minor | wnd--14296 (top gap+carve); **wnd--14326 blocker** (neg-inset, near-blank); thick frames on most |
| **beos-r503** | **blocker** (R-frame transparent tail) | **blocker** (thick R/B frame) | ok | **blocker** (neg-inset, sides missing) | no chrome | ok | — | wnd--14284 ok; wnd--14300 no chrome |

`apple-platinum-2` ships no recipe-based window types (procedural baseline) — out of scope.

---

## The dominant root cause (read first)

Most secondary-window-type breakage traces to ONE structural fault, not the draw
logic: **`part-0` body rects whose right/bottom coordinates exceed the resolved
cicn's dimensions.** `frameFromBody` (`composeChrome.ts:95`) computes
`right = cicnW − body.right`, `bottom = cicnH − body.bottom`. When `body.right >
cicnW` the inset goes **NEGATIVE**; `composeWindowChrome` then skips that edge
(`if (frame.right > 0 …)` at `:658`/`:672`), so the right/bottom border is never
drawn and `fullW/fullH` shrink — the frame hangs open. When the body rect is just
*small relative to a too-tall cicn*, the inset is huge-but-positive and the frame
samples the cicn's INTERIOR art (button/proxy pixels) as if it were border.

This is fundamentally **DATA** (the rect/cicn pairing is wrong — several rects are
clearly from a different/larger template than the cicn that got resolved for the
type, e.g. 1138 `movable-modal` body `[7,24,34,25]` against a 16×16 cicn). It is
*also* a **MODEL/GEOM robustness gap**: the compositor has no guard — a negative
inset should clamp to 0 (or the type should fall back), never silently drop an
edge. Full enumeration of affected types in the blocker section.

---

## BLOCKERS

### B1 · beos-r503 · document-window · all sizes — right border is a transparent tail; title-bar fill goes white
- **What:** top bar is yellow tab on the left then a large WHITE/transparent gap
  on the right two-thirds; the right border is missing in the title rows. Ref
  shows a solid yellow tab + thin gray bar fully across, thin 1px right edge.
- **Evidence:** `themes/beos-r503/diag/document-window.json` — `frame.right = 22`
  (body `[5,24,70,25]`, cicn 92×30). Pixel scan: cicn rows y0–18 are yellow only
  to x68 then a 1px black divider then **transparent x69–92**; the `right` frame
  samples x70–92 (transparent) and the top `part-8` fill samples src x70–75
  (transparent) → white. So the top-fill + entire right edge read as nothing.
- **Cause:** **DATA/decoder.** The doc-window cicn was decoded 92px wide with a
  ~22px transparent right margin; `part-0.right = 70` makes that transparent
  margin the "right border". Real beos right border is ~1px. The cicn crop / the
  body rect don't match the real wnd#. (Contrast: every other doc-window has a
  near-symmetric sane frame — see the doc-window frame table in notes.)
- **Severity: blocker.**

### B2 · 1984 · dialog · 240×140 — right & bottom "frame" are 72px / 64px of interior art
- **What:** a wide gray slab down the right side with vertical button-bars in it,
  plus a stray blue widget on the bottom bar. Ref dialog is a clean thin raised
  rectangle.
- **Evidence:** `themes/1984/diag/dialog.json` — `frame R72 B64`, cicn 89×82,
  body `[9,10,17,18]`. The right edge stamps src x17–89 (the On/Off button
  region of the cicn) down the whole right side.
- **Cause:** **DATA.** `part-0` body rect is far too small (right=17, bottom=18
  on an 89×82 cicn): the cicn is the whole minimum dialog *including its content
  buttons*, and the rect treats almost all of it as border. Same shape as B6.
- **Severity: blocker.**

### B3 · beos-r503 · dialog · 240×140 — same thick-frame fault as B2
- **What:** thick yellow vertical band on the right (with orange widget bits) and
  a yellow bottom streak; left/top borders fine.
- **Evidence:** `frame R58 B24` (body `[5,5,34,6]`, cicn 92×30). Right edge =
  cicn x34–92.
- **Cause:** **DATA** (body rect too small for the cicn). 
- **Severity: blocker.**

### B4 · 1138 + 1984 + beos · movable-modal / movable-alert — negative inset, right/bottom border dropped
- **What:** only the top title-bar fragment (1138/1984) or top bar + no sides
  (beos) renders; the rest of the frame is open/blank.
- **Evidence (placement JSON `frame` + edge slice counts):**
  - 1138 `movable-modal` / `movable-alert`: cicn 16×16, body `[7,24,34,25]` →
    **frame R−18 B−9**; `right` & `bottom` edges have **0 slices**.
  - 1984 `movable-modal` / `movable-alert`: cicn 26×28, body `[8,22,41,25]` →
    **frame R−15**; right edge 0 slices.
  - beos `movable-modal` / `movable-alert`: cicn 39×11, body `[5,24,34,25]` →
    **frame B−14**; bottom dropped, sides stop at 170/184px (audit).
- **Cause:** **DATA** (body.right/bottom > cicn dim → negative inset; the rect is
  from a different/larger template than the resolved cicn) **+ MODEL** (no
  negative-inset guard; `composeWindowChrome` silently skips edges ≤ 0).
- **Severity: blocker.**

### B5 · 1138 + 1984 · side-floating-utility-window — negative inset + coverage gap
- **What:** vertical title rails only partly drawn, black streaks at the L/R
  edges, large empty middle (audit: 1138 L/R stop at 149/165; 1984 L/R 161/165).
- **Evidence:** 1138 `side-floating-utility-window`: cicn 56×24, body
  `[13,5,15,40]` → **frame R41 B−16** (thick R, negative B). 1984: cicn 60×31,
  body `[13,5,16,35]` → **frame R44 B−4**.
- **Cause:** **DATA** (rect/cicn mismatch → thick + negative insets) — this is the
  "evolution side-utility carve gap" family the brief mentions, present in 1138 &
  1984 too. **+ MODEL** carve/coverage gap.
- **Severity: blocker.**

### B6 · 1984 · popup-window · 240×32 — disconnected top segments + floating right piece
- **What:** the top edge renders as separated blue/gray fragments with gaps and a
  detached right-end stub; no continuous menu border. Ref popup is a clean thin
  framed strip.
- **Cause:** **DATA/GEOM** — popup body/recipe doesn't tile across; widgets stamp
  into gaps. (1990 popup is comparatively ok; evolution popup is ok-ish — so this
  is a 1984-popup data problem, not a universal popup-model gap.)
- **Severity: blocker.**

### B7 · evolution · wnd--14326 — near-blank (negative inset, tiny cicn)
- **What:** essentially nothing renders but a single widget speck in the top-left
  corner. Audit reads "left coverage stops at 156/188" but visually the whole
  frame is absent.
- **Evidence:** `themes/evolution/diag/wnd--14326.json` — cicn **20×20**, body
  `[28,28,52,52]` → **frame R−32 B−32**; bottom & right edges 0 slices; top/left
  "cover" the buffer only because the buffer itself collapsed.
- **Cause:** **DATA** (20×20 cicn with a body rect sized for a ~140px template —
  wrong cicn resolved for the type) **+ MODEL** (no neg-inset guard).
- **Severity: blocker.**

### B8 · 1990 + evolution · wnd--14296 — top-edge coverage gap + un-stamped carved widgets
- **What:** top border starts late (gap at the leading corner), L/B incomplete,
  metallic/camo break around the centre widgets.
- **Evidence:** audit — evolution `wnd--14296`: "top coverage gap 0→26px" + "top
  widget part-2 `[15,24 9×9]` / part-3 `[15,15 9×9]` neither stamped nor in a
  fixed cell (carve/smear risk)". 1990 `wnd--14296`: L/R stop at 144/171. Frames:
  evolution body `[27,26,36,77]` (R44 thick), 1990 body `[14,11,23,62]` (R49
  thick, **B−27**).
- **Cause:** **DATA** (thick/negative inset) **+ MODEL** (the corner clamp at
  `composeEdge` `:324`–`:345` leaves the leading corner gap when a widget sits at
  the very start of the leading stretch cell; the carve gate at `:693` then skips
  these widgets — `cell.cls === 'fixed'` short-circuit — so they're neither drawn
  1:1 nor stamped).
- **Severity: blocker.**

### B9 · 1138 · collapsed-document-window — negative inset
- **Evidence:** cicn 16×16, body `[11,20,92,26]` → **frame R−76 B−10**. (Collapsed
  variants across 1138 share the tiny-cicn / large-rect mismatch.) Not separately
  rendered (collapsed states are low-traffic) but flagged for completeness; same
  class as B4/B7.
- **Cause:** **DATA + MODEL** (neg-inset guard).
- **Severity: blocker** (but low priority — collapsed states).

---

## VISIBLE

### V1 · 1138 · document-window · all sizes — proxy/title-bezel art smears diagonally across the title bar
- **What:** a dark trapezoidal wedge (the window-proxy bezel baked into the cicn
  centre, x≈46–55 + the surrounding code-0/code-8 cells) is stretched into a
  diagonal black smear across the middle of the title bar; worsens with width
  (mild at 160px, a large diagonal wedge at 360px). Ref is a clean platinum
  pinstripe bar full-width. Pinstripe also reads as a blurred gradient, not crisp
  horizontal lines.
- **Evidence:** cicn `cicn-n14335-unnamed.png` shows the dark proxy trapezoid
  centre-baked; `document-window.json` top `part-0` src x8 w27 → 89px and
  `part-8` src x56 w39 → 179px both stretch over proxy pixels.
- **Cause:** **DATA/decoder fidelity** — the proxy box is baked into a stretch
  cell and isn't a carve-able rect-list widget (the brief flags this as a known
  decoder-split issue, not a model bug). Secondary **MODEL** angle: pinstripe
  stretch (sample-and-scale) blurs the horizontal lines vs a clean tile.
- **Severity: visible** (it's the primary, most-referenceable window).

### V2 · 1984 · document-window · all sizes — black corner wedge bleeds down-left from the title corner
- **What:** the dark title-corner block is stamped/stretched down the left edge,
  producing a black triangular smear at the top-left below the title bar. Most
  obvious at small/medium; persists when wide.
- **Evidence:** `document-window.json` left edge: `part-0` src x0 y27 w24 h27
  fixed (the full title-height dark corner) then src x0 y54 w24 h9 stretch — the
  27px-tall dark title-corner art is drawn into the left frame band.
- **Cause:** **MODEL/GEOM** — the left-edge corner block (`corner[0]` /
  `frameFromBody`) samples the cicn rows that contain the *title-bar* corner art,
  not a side-edge profile; the dark title pixels leak below the title line.
- Minor sibling: the top-right zoom/shade widgets sit ~1px high / slightly
  detached from the bar surface (stamp cross-axis offset).
- **Severity: visible.**

### V3 · 1138 · titled-utility-window · 240×140 — proxy smear (smaller) + stray dark notch at bottom-centre
- **What:** same centre proxy-box smear as V1 (smaller utility title), plus a dark
  block at the bottom-bar centre that doesn't belong.
- **Cause:** **DATA** (proxy bake, as V1) + a bottom-edge fixed cell sampling
  interior art.
- **Severity: visible.**

### V4 · 1984 · titled-utility-window · 240×140 — widget detached at top-right corner
- **What:** a zoom/shade widget box floats at the extreme top-right, separated
  from the title bar (the bar ends before it).
- **Cause:** **MODEL** widget stamp anchoring — the right widget rides the right
  edge but the title-bar fill behind it stops short, leaving it isolated. Possibly
  also coverage-short on the top edge.
- **Severity: visible.**

### V5 · 1990 · popup-window · 240×32 — camo top bar with smeared joins; body doesn't close cleanly
- **What:** camo top bar + widgets render but the join art smears and the popup
  doesn't form a clean closed strip.
- **Cause:** **DATA/GEOM** popup recipe + thick frame. Lower priority (popup).
- **Severity: visible.**

---

## MINOR

### M1 · 1990 · document-window — camo joints slightly stretched at wide sizes
- Camo/chain texture holds well but a few corner joints read marginally stretched
  at 360px. Faithful overall; flagged only for polish. **MODEL** (stretch vs tile
  of structured fill). Severity: minor.

### M2 · evolution · document-window — top-left pipe seam pucker; busy bottom joins
- The metallic pipe border fills and reads faithfully; the top-left corner has a
  slight seam pucker and the bottom pipe joins look a touch busy. **GEOM/MODEL**
  corner art. Severity: minor.

### M3 · beos-r503 · alert · 240×140 — small notch on the left edge
- Otherwise a clean thin raised rectangle (matches ref alert). One spurious notch
  on the left border. Severity: minor.

### M4 · evolution · popup-window — acceptable but pipe joins slightly mismatched
- Renders a full pipe-bordered strip; minor join misalignment. Severity: minor.

---

## Non-glitches / data-absent (not compositor bugs)

- **beos-r503 `titled-utility-window`, `wnd--14300`; evolution `titled-utility`
  family:** "has no active chrome cicn" — the window type ships no chrome art, so
  it can't render. **DATA** (missing cicn), not a compositor fault.
- **apple-platinum-2:** no recipe-based window types (procedural). Out of scope.
- **dialog/alert with thin clean borders (1138 dialog/alert, beos alert):** render
  correctly — confirm the thin-frame path is healthy when the rect/cicn match.

---

## Triage / fix-order recommendation

1. ~~**Add a frame-inset guard in `frameFromBody` / `composeWindowChrome`**~~
   **DONE.** `frameFromBody` now clamps every inset to `[0, cicnDim]`. With a
   well-formed body rect (`0 ≤ near < far ≤ cicnDim`) the clamp is a strict no-op
   — the five document-windows render byte-identically (verified). For the
   mis-paired secondary types the negative `right`/`bottom` clamp to 0 (the edge
   is simply absent, not a smear) and the over-tall `top` clamps to `cicnH` (no
   OOB sampling). Result: content always fits, no blank/open frame, no
   white-smear edges — a coherent *degraded* frame until #2 lands. Audit
   warnings 19 → 6; the frame-invariant sweep (no neg inset, full ≥ content, no
   OOB inset) now passes on all 52 window types (was 18 bad). The art is still
   wrong on the mis-paired types — **#2 (re-pairing) must follow** to give them
   the correct cicn so all four borders draw real frame, not nothing.
2. **Re-pair cicn ↔ rect-list for the secondary window types** (the DATA core of
   B2–B9): the body rects for movable-modal/-alert, side-floating-utility, popup,
   1984/beos dialog, and the small `wnd--` types reference templates that don't
   match the resolved cicn (rects sized for a title/large template against a 16×16
   / 20×20 / 39×11 corner cicn, or treating cicn *content* as border). Audit the
   decoder's window-type → cicn resolution + `part-0` rect extraction.
3. **beos doc-window right-tail (B1):** crop the transparent right margin or fix
   `part-0.right` so the right border isn't 22px of nothing.
4. **Proxy/title-bezel carving (V1/V3):** the 1138 baked proxy box needs decoder
   splitting into a carve-able rect (known decoder issue) — or stretch it as a
   centred fixed bezel, never across the bar.
5. **Title-corner bleed (V2) + leading-corner carve gap (B8):** corner-block
   sampling + the `cell.cls==='fixed'` short-circuit in the pass-2 stamp gate
   (`composeChrome.ts:693`/`:719`) drop widgets that sit in a corner-split fixed
   cell.
6. Texture/polish (M1–M4) last.
