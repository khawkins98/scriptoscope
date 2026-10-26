# Native checkable retirement prototype

Status: implementation draft. Public API retirement has not been approved for
release. The diagnostic demo still imports the retired APIs; delivery is blocked
on its separate consumer migration and independent contract review.

## Result

Native inputs now own checkbox/radio activation, keyboard behavior, selection,
form submission, reset and accessibility. The themed face is a decorative label
pointing to the original input; there is no replacement checkbox/radio role or
custom keyboard/selection state machine. Generated IDs are restored on teardown
unless a caller changed them. Moving the input to a different root retires the
old decoration and restores the native input instead of leaving a clipped,
unreachable control. Normal same-root moves retain native association.

Removed `buildToggle`, internal `interactiveRadio`, public
`interactiveCheckbox`, `radioGroup`, `InteractiveCheckableOptions` and
`RadioGroupOptions`. `composeCheckable` and other imperative widgets remain.
The native face caches four compositions (checked/unchecked × enabled/disabled)
instead of the old two-state preparation. No startup/memory/speed gain is claimed.
Direct property writes to `.checked` are reflected after native input/change
notifications, reset, restoration or retheme; property setters are not intercepted.

| Measurement | Frozen baseline | Prototype | Delta |
| --- | ---: | ---: | ---: |
| Runtime physical logic lines | 17,498 | 17,360 | −138 |
| Fixed checkable/promotion slice | 401 | 265 | −136 (33.9%) |
| Engine table lines | 2,323 | 2,323 | 0 |
| All built JS chunks, bytes | 704,891 | 703,422 | −1,469 |
| Sum of individually gzipped JS chunks, bytes | 223,651 | 223,298 | −353 |

The fixed-slice threshold was 81 lines and is met by the prototype. Production
changes currently touch three runtime files with no stylesheet changes. This is
not the final repository-wide reduction: consumer migration remains incomplete,
and tooling, tests and documentation add repository lines. Count consumer changes
before claiming the completed delivery meets its reduction budget.

Final runtime source fingerprint:
`93107652b27ce16fff45a91420c36ed8b810d1a8a6d18b694471082f731da428`.
The local frozen executable and file hashes remain in
`tools/runtime-spike/.artifacts/native-controls-baseline/`; the comparator verifies
them before execution. No historical source or independent acceptance source was
read or changed. This comparison measures regression against current production,
not original Kaleidoscope fidelity.

## Validation

- Typecheck, build, clean-room lint (0 hits), syntax and whitespace checks pass.
- The Node suite passed during development: 1,154 pass, 0 fail, 2 skipped,
  12 TODO (1,168 total). The final cross-root cleanup addition was subsequently
  checked by the focused source lifecycle probe, typecheck and build; the broad
  Node run preceded that addition. Its log is retained locally under
  `.artifacts/native-controls-prototype/node-tests.log`.
- The focused Chromium source probe checks native event order/targets, keyboard,
  radio grouping across forms, first-legend exemption, disabled state, reset,
  canceled reset, submission, accessible naming, focus indication, retheme,
  pending cancellation, generated-ID ownership, ID changes, cross-root cleanup
  and unmount restoration.
- The public built-package form probe passes in Chromium, Firefox and WebKit.
  WebKit retains its native macOS mouse-focus policy; keyboard checks explicitly
  focus the native input. The probe does not impose another browser's click-focus
  behavior.
- Opaque baseline comparison: 144 themed cases match across all 18 themes and
  four states per control, plus 8 explicitly absent-art fallback cases. Eight
  unknown-census cases are rejected consistently. These are separate results:
  rejection is not a pixel match, and fallback is not themed-art coverage.

The first browser attempt used the wrong Vite source URL and failed to import.
A later probe attempted Playwright's enabled-element click on a disabled label
and timed out; the test now sends an actual mouse click at its bounds to check
that native activation stays disabled. A proposed missing-art fixture omitted
its resource census and correctly rejected; it is now a separate rejection case,
while the absent-art fixture explicitly declares empty resource censuses. The
first WebKit run exposed the mouse-focus assumption described above. No runtime
expectation, independent assertion or golden was weakened to obtain these results.

Run the local Vite server on port 5193, then:

```sh
node tools/runtime-spike/native-checkables-probe.mjs
SCRIPTOSCOPE_PROBE_BUILT=1 node tools/runtime-spike/native-checkables-probe.mjs
SCRIPTOSCOPE_PROBE_BROWSER=firefox SCRIPTOSCOPE_PROBE_BUILT=1 node tools/runtime-spike/native-checkables-probe.mjs
SCRIPTOSCOPE_PROBE_BROWSER=webkit SCRIPTOSCOPE_PROBE_BUILT=1 node tools/runtime-spike/native-checkables-probe.mjs
node tools/runtime-spike/native-checkables-pixels.mjs
```

## Delivery gate

The dev dependency scan reports that `demo/diagnostic.html` imports
`interactiveCheckbox` and `radioGroup`. The implementer's exhaustive allowed-path
list excludes `demo/`; that consumer requires a separate authorized author to
migrate it and inventory package/dynamic uses. No demo source was inspected.
Keep this draft unmerged; independent acceptance/contract review, consumer
migration, release notes and final finished-tree gates are still required.
Accessibility coverage here is a focused browser check, not an independent
assistive-technology review. Live arbitrary label/form mutations and mixed-state
art are not established by this experiment.
