# Fidelity plan: a defined, independently verified target

Tracked by [epic #221](https://github.com/khawkins98/scriptoscope/issues/221);
independent reference acquisition is [#190](https://github.com/khawkins98/scriptoscope/issues/190).

The target is the **themed surfaces of Kaleidoscope 2.3.1 for the current 18 archived schemes**, as interpreted by Scriptoscope's supported window/control API. Completion means every declared acceptance cell has independent evidence and passes its contract. It does not mean proof for arbitrary dimensions, all browser inputs, every historical extension, or every possible scheme.

Browser-native select popups and ordinary text fields remain native integration surfaces. Verify their keyboard, labeling, form and focus behavior; do not describe their appearance as original Kaleidoscope rendering. The themed closed-select face remains in scope. Document procedural fallback and deliberately unsupported source variants separately from themed support.

## Evidence and coverage ledger

Implementation: [requirement ledger #227](https://github.com/khawkins98/scriptoscope/issues/227),
[actual selection #226](https://github.com/khawkins98/scriptoscope/issues/226), and
[reviewed availability #228](https://github.com/khawkins98/scriptoscope/issues/228).

Maintain one ledger keyed by scheme, surface/family, state and supported option class. Record the source archive/resource identity, requested dimensions, expected availability, evidence link, exact tested configuration, and one status:

- **Verified:** passes a stated independent source-derived or reference-capture requirement. Name the requirement; a passing screenshot baseline alone is insufficient.
- **Mismatched:** a concrete expected/actual difference exists, linked to an active fix (currently control-face corner/edge semantics in #218 and tab source cropping in #223).
- **Unsupported:** the runtime deliberately does not implement that source variant or surface; record the reason and fallback behavior.
- **Unknown:** evidence or validation is missing. Candidate art and plausible screenshots do not upgrade this status.

Apply statuses at the requirement level. A case is verified only when **all** its
declared requirements are verified; one passing background-color assertion does
not verify the complete button. Partially tested cases retain unknown requirements.

The [review limits](../../tests/rendering-options/KNOWN-LIMITS.md) retain concrete
mismatches and unverified requirements found while reviewing the initial sheets.

Track regression coverage separately: source/built parity, reviewed browser golden, interaction contract, browser/DPR configuration. Freeze a finite acceptance inventory before claiming its completion. Use native/minimum/representative/resized dimension classes plus independent allocation, clipping and endpoint invariants; never imply that a finite screenshot set exhausts continuous size/value inputs.

## Phase 1 — Preserve the evidence chain

Keep original archives and sidecar provenance. Extend capture metadata with archive hashes, package/build identity, stylesheet/chunk hashes, browser/font/DPR, ordered case IDs and requested options. Record actual per-case status and dimensions beside golden candidates. Review an explicit expected-availability inventory; verification must fail when an expected themed render becomes null, even if source and built agree.

**Exit:** every candidate links to exact inputs/build, every acceptance cell has a reviewed availability expectation, and missing evidence remains visible. The current rendering runner can land independently; its 70/660-case profiles are regression/contract coverage, not an original-engine oracle.

## Phase 2 — Observe actual selection

At existing role/state/base resolver decision points, add optional diagnostic tracing: requested role/state, selected owner, signed resource type/id, asset identity, fallback reason, or explicit absence. Do not duplicate the resolver in the harness. Candidate-art galleries remain candidates.

Add hand-authored selection expectations for repurposed active slots (Animals/Monkey), pressed/inactive/default-ring states, and synthetic base ownership. Pair archive/resource hashes with selected decoded pixels so a wrong decoder or selector can be distinguished from a wrong compositor.

**Exit:** the ledger's tested renders have actual selection provenance, and selection fixtures fail for wrong owner/state/alias or unexpected fallback. Tracing itself is observation, not proof that the selection is correct.

## Phase 3 — Close proven rendering mismatches

Resolve #218 first: original `0x10fc0` sends push/bevel faces into `0x107fe`, whose square corners and independent edge strips differ from `composeFaceButton`'s current rectangular-inset model. Cover unequal pairs in Animals/Monkey, Apple Lisa and Crayon OS, preserving the correct background sample and resource ownership. Validate body fill/pattern behavior explicitly before altering it.

Use small hand-derived decoder and coordinate-sentinel fixtures for palette, depth, mask, corner/edge order, tile phase and clipping. Keep original-source addresses and expected coordinate calculations with the tests. Extend distinct DOM interaction contracts for buttons, checkables, sliders and tabs; rendered state cases do not establish activation behavior.

**Exit:** every known mismatch in the declared target is fixed with independent regression evidence, and relevant source/built, DOM and packaging checks pass. Remaining unsupported/unknown cells prevent an unqualified completion claim.

## Phase 4 — Reference captures and reviewed goldens

Acquire existing, authorized reference captures or supplied reference datasets as **separate evidence data**. Record scheme/archive version, system/Kaleidoscope version, control/window state and rectangle, font/size, color depth, scale and capture provenance. When these are unknown, use the image as a qualitative reference, not an exact pixel oracle.

Respect the clean-room rule: do not execute or ship original 68k code. Offline assembly inspection and permitted reference data inform independent requirements. If a necessary reference is unavailable, retain an unknown ledger entry rather than manufacturing expected output from our renderer.

Review pinned Linux browser contact sheets against those requirements and raw resources, then commit self-goldens to detect later drift. Record #218 and any other open limits until resolved. Add a clean `npm pack` consumer smoke so repository files cannot hide missing published assets.

**Exit:** every declared acceptance cell is verified against its stated independent requirement, no mismatched/unknown/unsupported cell is silently counted as supported, reviewed goldens pass, and the published build reproduces the validated behavior. Report “complete for this versioned acceptance target,” with its explicit exclusions—not “100% fidelity for all inputs.”
