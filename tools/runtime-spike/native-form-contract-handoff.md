# Proposed independent DOM contract/test-author assignment: PR 484

Deliverable: listing-free contract decisions and justified independent DOM-test
changes for the frozen PR 484 draft. This is not a request to update expectations
to make output pass, nor final approval to merge. The user authorized this assignment. Independent commits `30213948` and
`686a94eb` are now integrated; final runtime and CI results are recorded in
`native-form-results.md`. This text retains the original assignment scope.
The implementer must not read or edit independent acceptance source or oracles.

Use a fresh isolated worktree at the current PR head. No other checkouts, original
program sources, historical renderer sources, private assets, evidence mounts or
verifier material. Limit the assignment to public web control contracts and
current DOM/form acceptance tests. No fidelity status, original-pixel, extraction,
golden or provenance changes. Freeze semantic expectations from the proposed
public contract and native browser behavior before using implementation details
to diagnose instrumentation. Keep opaque regression images/executables opaque.

Proposed changes requiring review:

- Native checkbox/radio inputs replace the custom focusable role spans. Actual
  native inputs overlay the visible artwork and own activation, grouping, focus
  and forms. Restore source identity, properties, labels and position on teardown;
  preserve later caller changes. Native `.checked`/disabled state should not need
  a second authoritative ARIA state model. Native radio tab order differs from
  making every custom radio span a tab stop; explicitly review this.
- Retire `interactiveCheckbox`, `radioGroup` and their option types. Use native
  markup/change listeners and existing declarative mounting/borrowed registration.
- Keep `interactiveButton` options/callbacks but return a native button. It must
  preserve real pointer/keyboard activation, cancellation, disabled fieldsets,
  callback counts and form behavior. Native Enter may click on keydown; synthetic
  pointer-only event sequences are not native clicks. Review that boundary.
- Closed selects retain their native interaction surface and passive face label,
  geometry, paired admission and paint lifetimes. Managed push composition and
  raster APIs are unchanged; standalone sliders/scrollbars remain available.

Read `native-form-results.md` for source identity and exact measurement/check
receipts. The broad 151-case run was 136 pass / 15 fail. Two select failures were
fixed and pass a targeted followup; four native pointer timeouts were fixed and
now reach ARIA assertions. Targeted lifecycle/select run: 18 pass / 4 fail out of
22. The final owned-label ID followup has focused source coverage.

Independent triage needed for 13 prior failure cases:

1. Four checkable lifecycle cases now stop at literal `aria-checked` on native
   inputs. Verify actual checked state, restoration, event behavior, accessibility
   and subsequent tab-order assertions. Do not remove those behavioral checks.
2. Two disabled-button cases require old `aria-disabled`/tabindex representation.
   Review native disabled behavior and focus availability, including fieldsets.
3. Two showcase cases explicitly count span-shaped faces. A separate consumer
   author reproduced original identity/values/positions and exact-once callbacks
   through off/restore with two native button faces. Verify rather than assume.
4. Two form fixture positives require a span button tag. Preserve submit/reset,
   default actions, form owners, cleanup and named negative controls if setup is
   updated for an approved native contract.
5. Two disconnected-fragment cases expect synthetic pointer pairs to activate.
   Review the public contract and preserve meaningful activation/cancellation
   coverage instead of restoring a duplicate manual activation state machine.
6. One process-only mutation fixture fails dynamic module import, reproduced
   in isolation. Diagnose the instrumentation/export path before interpreting
   any positive or negative result. Retain the ability to detect the actual bug.

Return only public contract clarifications, commit IDs and ordinary check counts
and exits to the runtime implementer. Do not transmit excluded acceptance source,
oracle values, evidence locators or verifier reports. Keep unresolved behavior
visible. A test change requires a justified contract decision, not merely the
observation that the implementation changed.
