# PR 484: native form ownership

Current implementation draft; no ready-to-land or performance claim. This
supersedes the narrower `native-checkables-results.md` delivery status. The
original document remains a record of the first experiment and its frozen build.

## Delivered scope

- Native checkbox/radio inputs own focus, pointer activation, keyboard behavior,
  grouping and forms. The original input overlays its visible carrier; only the
  artwork is hidden from accessibility. The original input identity, form state
  and parent/sibling position are restored on disconnect. Consumer carrier moves
  survive teardown/retheme; neighboring promotions and insertions do not count
  as moves. Implicit-label links
  and generated IDs have reversible ownership, including caller ID changes.
- `interactiveButton` keeps its factory, options and callback surface and returns
  a real `type=button` element. Its handlers paint feedback; browser click/default
  behavior activates it. Enter timing and synthetic pointer-only activation
  differ from the old custom span. Declarative button forwarding and managed
  painter/binding contracts remain in place.
- Closed selects use passive artwork, preserving paired-face admission and the
  old inline presentation box. They no longer prepare an interactive button
  beneath the native select. Decorative labels and canvas pixels are preserved.
- A separate authorized consumer author migrated diagnostic checkables, inventoried
  public callers and updated README/CHANGELOG. Public showcase reproduction
  confirms original control identities, positions and changed values survive
  off/restore, with exactly one callback per button and checkable activation.

Retired APIs remain `interactiveCheckbox`, `radioGroup` and their option types.
Standalone sliders/scrollbars (including vertical), tab coordination, the managed
button binder and raster composition APIs are retained. Live consumers and their
actual responsibilities rule out counting their whole source files as deletions.

## Measured outcome

Compared with the frozen production baseline:

| Measure | Baseline | Draft | Change |
| --- | ---: | ---: | ---: |
| Runtime logic physical lines | 17,498 | 17,382 | −116 |
| Engine table lines | 2,323 | 2,323 | 0 |
| Fixed checkable/promotion slice | 401 | 305 | −96 (23.9%) |
| Built JS chunk bytes | 704,891 | 704,891 | 0 |
| Sum of individually gzipped JS bytes | 223,651 | 223,722 | +71 |

The consumer migration adds 20 production lines: net production reduction is
**96 lines**, including that migration. No other production consumer code was
added. Documentation and implementation-owned harness code increase repository
lines and are not included in that production number. The predeclared slice
threshold was 81 lines and remains satisfied after the pointer/label fixes.
The native pointer target and move-safe cleanup cost more code than the first
clipped-input prototype. Earlier −138 and −130 runtime-line figures are not the
final result. There is no final built-size reduction; gzip increases by 71 bytes.

Source fingerprint:
`0e61cc796a4b9cecea340995cfe99e1c666508ce2a0595eac56f8fea6cca78fa`.
The ignored hash-verified compiled baseline is retained locally at
`.artifacts/native-controls-baseline/`. No old source was checked out or read.
This measures regressions against current production, not original Mac fidelity.

## Validation and remaining failures

- Typecheck, library/demo builds, clean-room lint (0 hits) and Node tests pass.
  The final Node run has 1,154 pass, 0 fail, 2 skipped, 12 TODO (1,168 total).
- Source and built comparisons match all 144 push-button pixel/geometry cases
  and 72 closed-select pixel/geometry cases across the 18 themes.
- Checkables match 144 themed cases plus 8 explicit absent-art fallbacks. Eight
  unknown-census inputs reject consistently, counted separately from pixels.
- Implementation-owned native button/select and checkable form probes pass in
  Chromium, Firefox and WebKit against the built package. Source probes also
  exercise cancellation, ID ownership, source movement and restoration.
- Packed-package consumer validation passes: public exports, strict declarations,
  isolated production build, archive decoding, native interaction/teardown and
  three package-boundary negative controls.
- A requirements validation run exits 0 with zero mismatched obligations. No
  independent assertions, fixtures, goldens, evidence or binding hashes changed.

The original broader affected browser run had **136 pass / 15 fail**. It exposed
real native-pointer and passive-select metadata defects; both were fixed.
Independent author commit `30213948` then established native DOM/form contracts,
updated legacy DOM assertions and repaired the mutation fixture import. A rebuilt
integrated run passed **30 independent checks** across Chromium, Firefox and
WebKit. The affected legacy run improved to **159 pass / 2 fail**; only mixed
showcase tests remained. Independent follow-up `686a94eb` adjusted exactly three
DOM tag sites while preserving all other pixel/provenance/structural/callback and
teardown requirements. Root integrated both commits without reading acceptance
sources. After integrating the DOM-only showcase follow-up, the run reached 160 pass /
1 fail: production showcase readiness. Rebuilding the full demo resolved that
prerequisite; both showcase cases then passed. The final complete affected-suite rerun passes **161/161**, exit 0.

Independent runtime review found a separate carrier-move teardown issue. An
executed implementation-owned reproducer failed for parent moves, sibling
reordering and retheming after a move. A first neighbor-based fix was rejected
because ordinary neighboring promotions changed the neighbor identity. The final
removal observer preserves actual moves while ignoring neighboring changes;
those probes now pass in source across Chromium, Firefox and WebKit. Built
checkable probes also pass across all three browsers. The final independent
source/built DOM suite passes 30 checks across those browsers; final Node tests
pass 1,154 with zero failures (2 skipped, 12 TODO). Narrow independent runtime
review found no further cleanup issue in the corrected version.

Local execution logs are under `.artifacts/native-form-wide/` (not committed).
The original failed runs remain retained. Earlier driver mistakes were corrected
explicitly: source URLs now load the actual package JSON rather than the demo's
SPA fallback; fallback comparison addresses the presentation node rather than
the relocated input; inline select presentation restores the original line box.
These corrections do not replace independent acceptance evidence.

## Next gate

The user-authorized independent public DOM contract/test-author assignment is
complete; its justified changes are integrated. Final local integration passes; full CI is pending. Do not merge, update acceptance data from implementation
output, or weaken old behavior without review. Final acceptance/CI and independent
adversarial review remain required. `lane:ready` has not passed; this environment
also lacks its configured Apple header path. This work establishes a bounded
simplification with a real net deletion, not a large engine rewrite or a speedup.
