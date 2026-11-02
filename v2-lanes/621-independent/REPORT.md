# #621 independent test and policy lane

## Role and exposure record

The initial dispatch assigned runtime implementation and requested reading the
prior review. Before reading IMPLEMENTER-BRIEF, this session printed the linked
prior verifier comment (6556689717), the first 100 lines of docs/spec/README.md,
and broad search excerpts from independent rendering specs. It did not read
original listings, binary dumps, evidence appendices or oracle fixture contents
at that point, and made no runtime changes. After escalation, the PM classified
this attempt as implementer-disqualifying and reassigned it to independent
spec/test/docs ownership. No runtime source or tools implementation file has
been edited. Subsequent independent test/fixture inspection is under that role.
Do not hand this report or test sources to the clean runtime implementer.

## Safe handoff

`docs/spec/engine/window-hit-policy.md` is the behavior-only implementer handoff,
committed separately as `36c1331f5853771dcae32efc90a9b4a39a995d65`.
The PM accepted reusable remove-all disposal semantics, caller host/theme
ownership, pending render suppression and the unchanged HPT36 ceiling.

## Regression evidence on unchanged runtime

- `npm run build:demo`: passed (Node 24.18.0).
- Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2; DPR 1; macOS arm64.
- `SCRIPTOSCOPE_RENDERING_BROWSERS=chromium,firefox,webkit npx playwright test --config tests/rendering-options/playwright.config.mjs frame-pass-through-lifecycle.spec.mjs`:
  HPT42 passed source and built in every engine (6 passes). HPT43 failed source
  and built in every engine because `WindowManager.dispose` does not exist (6
  expected failures). Log: `test-results/621-independent/621-lifecycle-base.log`.
- HPT42 holds `document.fonts.load`, starts a grow resize with real mouse input,
  releases it while preparation is pending, then starts and verifies real frame
  pointer capture. It unblocks the resize and checks style writes and computed
  clipping across the commit, followed by restoration of the resized path and
  independent point hit testing after release. It does not call private render
  methods to schedule the overlap.
- HPT42 mutation proof: temporarily injected the old truthiness guard into the
  live page's `suspendClip` method only (no runtime file edit): return early when
  `!!entry.gesture === on`, otherwise call the original. Source Chromium failed
  at “older resize commit leaves newer drag suspended”: the resize commit
  restored a path while the newer drag remained captured. Exit 1,
  `test-results/621-independent/621-race-mutant.log`. The test-only injection was removed after the run.
- HPT43 tracks the five HP38 document listener signals, disposes while a render
  is pending, checks idempotence, detached management and retained host ownership,
  releases the pending work and checks no canvas commit or callback, then verifies
  the manager and borrowed theme can be reused.

## Performance scope

HPT36 is unchanged: five interleaved alternating trials, WebKit +3 ms p95 margin
and 3 ms hit-test ceiling. Timing is held while another lane records Docker
goldens, per PM direction. Native wheel probe HPT44 reports real scrolling with
and without only the hit-layer listener, with five alternating paired trials;
its observations explicitly include automation/frame latency and establish no
bound under main-thread contention. HPT33 remains the routing correctness gate.

## Remaining work

Run the wheel probe and unchanged HPT36 in the PM's serialized timing window.
Integrate the independently implemented runtime, run HPT43 green, region
correctness/recompute and relevant pointer/resize browser checks in all engines,
and record preparation/reuse evidence and final docs. The PM owns final coherent
PR, exact-head gates and independent review. Existing package-lock changes predated this session (removed optional platform
libc metadata). The PM confirmed generated setup drift matching fresh worktrees;
that specific diff was restored to HEAD, with no dependency version changes.
