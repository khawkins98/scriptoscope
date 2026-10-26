# PR 484: native form ownership

Current implementation draft; no ready-to-land or performance claim. This
supersedes the narrower `native-checkables-results.md` delivery status. The
original document remains a record of the first experiment and its frozen build.

## Delivered scope

- Native checkbox/radio inputs own focus, pointer activation, keyboard behavior,
  grouping and forms. The original input overlays its visible carrier; only the
  artwork is hidden from accessibility. The original input identity, form state
  and parent/sibling position are restored on disconnect. Implicit-label links
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
| Runtime logic physical lines | 17,498 | 17,368 | −130 |
| Engine table lines | 2,323 | 2,323 | 0 |
| Fixed checkable/promotion slice | 401 | 291 | −110 (27.4%) |
| Built JS chunk bytes | 704,891 | 704,372 | −519 |
| Sum of individually gzipped JS bytes | 223,651 | 223,564 | −87 |

The consumer migration adds 20 production lines: net production reduction is
**110 lines**, including that migration. No other production consumer code was
added. Documentation and implementation-owned harness code increase repository
lines and are not included in that production number. The predeclared slice
threshold was 81 lines and remains satisfied after the pointer/label fixes.
The correct native pointer target costs more code than the first clipped-input
prototype; the earlier −138 runtime-line figure is not the final result.

Source fingerprint:
`1747146c18b9d6597760b73d273ca880489e74ef9f29990991d321db6013b0cd`.
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

The broader affected browser run had **136 pass / 15 fail**. It found a genuine
clipped-native-pointer defect and missing passive-select label metadata. Both
were fixed. A targeted 22-case lifecycle/select followup had **18 pass / 4 fail**:
the four former lifecycle timeouts now progress to literal `aria-checked`
expectations on native inputs. Do not present that targeted rerun as a passing
full browser suite. The final owned-label ID followup additionally passed the
focused source probe and final Node/build/typecheck checks.

Thirteen prior failure cases remain unresolved for independent contract/test
author triage: four checkable ARIA cases, two disabled-button attribute cases,
two span-specific showcase checks, two form-fixture button-tag checks, two
synthetic-pointer-only activation checks, and one mutation-fixture import
failure. The import failure reproduced in isolation; do not classify it as a
transient fetch problem. Existing tests may establish further behavioral
requirements after those first assertions; their failures are not automatically
obsolete. Preserve coverage and negative controls rather than simply accepting
new output. The public consumer author independently reproduced correct showcase
teardown/remount with the native button shape, without editing acceptance tests.

Local execution logs are under `.artifacts/native-form-wide/` (not committed).
The original failed runs remain retained. Earlier driver mistakes were corrected
explicitly: source URLs now load the actual package JSON rather than the demo's
SPA fallback; fallback comparison addresses the presentation node rather than
the relocated input; inline select presentation restores the original line box.
These corrections do not replace independent acceptance evidence.

## Next gate

Use `native-form-contract-handoff.md` for an independent public DOM contract and
test-author assignment. Do not merge, update acceptance data from implementation
output, or weaken old behavior without review. Final acceptance/CI and independent
adversarial review remain required. `lane:ready` has not passed; this environment
also lacks its configured Apple header path. This work establishes a bounded
simplification with a real net deletion, not a large engine rewrite or a speedup.
