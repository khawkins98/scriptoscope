# V2 plan: decode-first engine, sharpened for parallel agents (2026-10-21)

> **Workflow amendment (2026-10-24):** use
> [CONTRIBUTING — Efficient delivery for focused fixes](../../CONTRIBUTING.md#efficient-delivery-for-focused-fixes)
> for current coordination and validation practice. Reproduce and settle spec
> gaps first; keep a small team and the same independent reviewer through fixes;
> parallelize implementation and independent tests after spec verification; check
> provenance before expensive runs; use targeted iteration and one final integrated
> validation chain. Required CI, review tiers and clean-room boundaries remain in
> force. The original lane counts and timing estimates below are planning history,
> not a requirement to create another agent or repeat a full suite at each handoff.

Reviewed: #378, #221 exit criteria, RE-ADVISORY.md + re-routine-inventory.json, BRIEF.md/STAGE.json, repo CLAUDE.md/CONTRIBUTING, history "Dead ends", spec index, `src/` (13.3k lines incl. declarative/interactive), `tests/` (rule tables, ledger + transitions, 36 golden sheets), package exports, lane I/H/K reviews.

## 1. Critique of #378 and the advisory

**Keep.** The diagnosis is right and the evidence is strong: every family lane found the same failure class (hand-written selection, fallback ladders as branches, hand-typed trap names), and lane I's reviewer confirmed the runtime scroll map matches *neither* binary. The three core moves are right: selection ladders as data rows with a source address, shared QuickDraw primitives, and a coverage denominator counted in routines rather than a fidelity percentage. The role split (spec writer / verifier / implementer / test author) is right and already proven by today's reviews. "Stop doing" is right.

**Change.**

1. *"One function per binary routine, named by address" is the wrong unit.* Routine boundaries in this CodeWarrior build are compiler artefacts: 1-bit/colour drawer twins, GWorld caches, Gestalt glue, A-trap wrappers. Mirroring them one-to-one produces a transliteration shaped like the listing, which is exactly the clean-room line the spec template is supposed to hold, and it makes the inventory's heuristic segmentation (CDEF 3: 22 detected vs 16 Macsbug names) load-bearing in code. **Drivers are per message × family** (`scrollbar.draw`, `scrollbar.calcRects`, `window.drawFrame`, `window.calcRgns`), each a short orchestration over table rows and primitives. Addresses live in three places only: table rows (`source: '0xa032-0xa10e'`), a doc-comment per driver, and a generated `coverage.json` (address → row/driver). Function names never carry addresses. Coverage is still reported "routines mirrored out of N", via the map, not via names.
2. *The 3–4k LOC target is not meaningful and should be dropped.* The 6.4k "render path" excludes what the binary does not have but the public API and the harness depend on: `controlDiagnostics` traces, display profiles, finite cicn transfer, header surfaces, managed content port, interactive/declarative layers (~3.5k more). The engine core will be ~3–5k plus tables, and total `src/` grows before it shrinks. Replace the LOC target with three structural invariants, lint-checkable: no resource id literal outside `engine/tables/`; no `slug ===` / per-theme branch anywhere; no fallback chain expressed as nested `??`/`if` outside `engine/resources/`.
3. *Mirroring all 35 WDEF messages and every CDEF table as data is over-engineering.* Scriptoscope has no Window Manager. Implement only the messages whose output is observable: draw, calcRgns/hit rects, grow image, collapse/zoom frames, control draw/test/calcRects. Document the full message map in the spec; code the subset.
4. *The dual-run gate is right as a migration mechanism but wrong at pixel-only granularity.* Pixel diffs on 430 cases × 2 engines inside a 20-minute CI window will not fit, and pixel diffs do not say *why*. Gate at two levels (§6): a trace diff (resolved resource ids + rects + draw order) as the required check, and pixel dual-run per family on demand and nightly.
5. *Timeline.* 6–10 weeks assumes decoding is the bottleneck. Today's evidence says *verification* is: one verifier re-trace of one family (lane I) was a full lane-day and produced five findings. ~120 spec units × verify = the critical path. Plan on 10–14 weeks, and make verifier throughput the thing the PM watches.

**Cut.** Parallel emulator sessions as a Phase 4 item (one shared media root, one lane; the sentinel scheme makes parallelism unnecessary). "Fix ~10 trap names by hand" (generate the trap table from `Traps.h` and diff the doc instead).

**Risks #378 and the advisory missed.**

- *Engine logic already leaks into the conversion layer and the public types.* `tools/theme-loader/classifyResources.js` builds `resourceRoles.progress` (a named "model") and `scrollArrows`, surfaced on `ThemeManifest`. v2 must move selection out of the loader (loader = pure decode) and deprecate those manifest fields; this is a public type change.
- *Public API churn is wider than `pressedPart`.* `composeSliderWithLayout`, `composeButtonWithLayout`, `ControlRenderTrace`/`ControlResolutionStep`, `HeaderSurfaceResult` are consumed by `interactive.ts` (1.8k lines, 9 compose call sites), `declarative/tabs.ts`, `demo/diagnostic.html` (25 call sites) and five Playwright specs (`control-trace`, `legacy-face-trace`, `slider-*`). The engine's trace shape must be a superset, or those specs migrate in the same family PR.
- *Hit testing is a family.* The inventory has 12 kDEF hit-test routines and K found left-side widget hit rects unmapped; #378's Phase 3 has no interaction lane. Add one (owner `interactive.ts` + `engine/families/*.hit.ts`).
- *Golden churn is structural.* Goldens are per-theme contact sheets (page-1/page-2 × 18) mixing all families; every family migration touches all 36 and needs a reviewer. Re-cut on v2 to per-family sheets (one sheet per family, all 18 themes × sampled states, ~16 sheets) so each lane's churn is isolated and reviewable.
- *Ledger contention.* `ledger.test.mjs` enforces prefix-sha reconstruction of one monotone `ledger.json`; today two lanes could not bump in parallel. A per-family split must be *source files + a generator* that emits the canonical single ledger, or lanes will still serialise.
- *Bundle and performance.* A runtime `engine: legacy|model` switch that ships both paths doubles `dist/`. The switch must be build-time/dev-only; `dist/` for 2.0 contains one engine. Generic `copyBits` over `PixelBuffer` can regress the specialised blits; set a budget (18-theme matrix render time, measured in the rendering suite) before migration starts.
- *Control-panel fork art.* Lane J found tab cicns -9968..-9956 in the Kaleidoscope control panel fork. Mirroring that ladder means either shipping Kaleidoscope's own art (a redistribution question, distinct from the code clean-room line) or declaring the step a deliberate divergence. Default: do not ship it; record the divergence per family.
- *CI does not run on a non-main branch today* (`pull_request: branches: [main]`), and `paths-ignore` skips `docs/**`, so spec-only PRs get no checks. Both need changing on day one.

## 2. Branch and integration strategy

> **Superseded 2026-10-30 ([DECISIONS #1](./DECISIONS.md)).** The branch and integration rules in this section no longer apply: `v2` is retired as an integration target (frozen at 0.7.0, `c5c09a20`), `main` is not frozen, there is no main → v2 sync, CI runs on `main` only, and every PR (engine-family work included) targets `main` under [CONTRIBUTING](../../CONTRIBUTING.md). The release criteria below still define the **1.0** milestone per DECISIONS #8. The section is kept as the record of the original plan.

> **Amended 2026-10-22 (DECISIONS #8):** cutover is incremental. v2 merges into main through per-family minor releases (0.2.0 first), and the "v2 → main release criteria" below now define **1.0** rather than the first release. The `main` freeze applies between releases; the Monday main → v2 sync still holds. *(Both superseded 2026-10-30; see the note above.)*

**Long-lived `v2` integration branch**, not trunk-with-flag. Reasons: the public type changes (manifest roles, trace shape, `pressedPart`) cannot be flagged; a shipped flag doubles the bundle; and `main` must keep deploying GH Pages from reviewed goldens while v2 goldens churn.

- `main` is **frozen to hotfixes, docs, rule tables and evidence** for the duration. Runtime fixes that are themselves a family migration (#374 scroll bars, #377 code-10/widget remap) land on `v2` as part of that family's driver, with the issue noted on main's CHANGELOG as "fixed in v2". Only a user-visible regression gets a runtime hotfix on main, and that commit is cherry-picked to v2 the same day.
- **Sync main → v2 by merge commit** (never rebase a shared branch), on a fixed cadence: every Monday, plus immediately after any main runtime hotfix. The PM owns the sync PR; conflicts are expected only in `CHANGELOG.md`, the ledger generator inputs and `docs/spec/*` (resolve by keeping v2 structure, main content).
- **CI on v2:** `ci.yml` triggers on `push: [main, v2]` and `pull_request: [main, v2]`; remove `docs/**` from `paths-ignore` for the `v2` target and add a cheap docs-only job (spec lint + clean-room grep) so spec PRs get a check.
- **PR-into-v2 rules.** One PR = one lane deliverable (a spec unit, a family driver, a tooling piece). Required: typecheck, `npm test`, rule-independence check, clean-room lint, trace-diff gate for the touched family, and the golden candidate workflow for any pixel change. One independent review per PR at the bar of lanes/I/REVIEW.json: every cited address re-traced, mutation probes recorded, verdict with required changes. Squash-merge with a Conventional Commit body; no `Co-Authored-By`.
- **v2 → main release criteria ("2.0 ready").** (a) Every public `compose*`/`renderWindow` path is served by the model engine; `src/platinum.ts` survives only as the declared procedural fallback; no legacy drawer code remains. (b) Trace-diff gate shows zero *unexplained* differences vs the last main golden set; every explained difference cites a rule row, and those rows are in the ledger as verified-or-mismatched (never silently unknown). (c) Per-family sheets reviewed and recorded in the pinned container. (d) Coverage report committed: routines mirrored / in-scope, with the in-scope denominator frozen by L1. (e) #221 exit criteria 1, 4, 5 met (contract versioned with exclusions incl. PACH 130 scope and control-panel art; required CI passes; fresh checkout + installed package reproduce). Criteria 2 and 3 are *not* required for 2.0; they remain the epic's close condition. (f) Semver: publish as `scriptoscope 0.2.0` (pre-1.0 minor may break); "v2" is the engine and branch name, not the package major. Breaking changes listed under a "Migration from 0.1" CHANGELOG section; deprecated manifest fields kept for one minor with a console warning.

## 3. Target module layout

```
src/engine/                       the model; no DOM, no fetch, no theme slugs
  qd/        copyBits.ts copyMask.ts tileBlit.ts(0xfeae) scaleBlit.ts(0x10320)
             patternFill.ts pen.ts getPixel.ts cinfFrame.ts(0x107fe)   + *.test.mjs
  resources/ chain.ts   ResourceChain: archive → base chain → (control-panel: divergence) → procedural
             getCIcon.ts getPixPat.ts getIcon.ts   (NULL is never retried at another tier, etc.)
  tables/    scrollbar.ts pushButton.ts checkable.ts tab.ts header.ts slider.ts progress.ts
             window.ts(part codes, wnd# ladder) cdefMessages.ts     DATA ONLY, every row has `source`
  state/     controlState.ts (hilite/part → engine state bits)  windowState.ts
  families/  scrollbar.ts pushButton.ts checkable.ts tab.ts header.ts slider.ts progress.ts
             windowFrame.ts(recipe walk) proceduralFrame.ts(0x11ee2, replaces composeCornerSprite)
             *.hit.ts  (hit-test messages)
  trace.ts   per-call {family, inputs, resolved[], rects, drawOps[]}  → diff gate + ControlRenderTrace
  coverage.json  generated: address range → table row | driver | 'out-of-scope' | 'unmirrored'
src/controls.ts, composeChrome.ts, renderWindow.ts   become thin facades; signatures unchanged except additive options
src/interactive.ts, declarative/                      unchanged API; consume facades
tools/theme-loader/                                   pure decode; classifyResources role models deprecated
tests/rendering-options/*-rules.mjs                   independent of src/ (enforced)
tests/engine-diff/                                    dual-run trace + pixel diff
docs/spec/engine/<family>.md + <family>.evidence.md   behavioural spec / listing appendix (implementers never read .evidence.md)
```

Ownership: `engine/qd` and `engine/resources` are shared infrastructure (one owner, PRs by others need that owner's review); each `families/<x>.ts` + `tables/<x>.ts` + the facade function it backs + its rule table + its spec are one family's bundle, but spec/rule/implementation are *different* agents.

**Minimum engine core to land first (Phase 1):** `qd/` (tileBlit, scaleBlit, copyBits/copyMask, patternFill, getPixel, pen), `resources/chain.ts`, `state/controlState.ts`, `trace.ts`, the diff-gate harness, and the scroll-bar family end to end (facade `composeScrollbar` with `pressedPart`). Nothing else moves until that is merged and the gate has caught at least one injected regression.

## 4. Lanes for the first two weeks

> *Where this section names the `v2` branch (its CI, nightlies or branch model), that part is superseded 2026-10-30; see the [§2 note](#2-branch-and-integration-strategy) and [DECISIONS #1](./DECISIONS.md).*

| Lane | Role / clean-room | Owns (exclusive) | Depends on | Deliverable + acceptance |
|---|---|---|---|---|
| **L0 Integration (PM)** | no listings needed | `.github/workflows/*`, `package.json` scripts, `tests/engine-diff/*`, `scripts/check-rule-independence.mjs`, `scripts/check-cleanroom.mjs` (from L3), CHANGELOG | none; **start now** | `v2` branch cut from main; CI on v2 incl. docs job; weekly sync; diff-gate skeleton that runs legacy vs model trace for a named family and fails on an unexplained delta (prove with an injected mutation) |
| **L1 Listings & denominator** | reads listings; writes private store + docs | private `annotated/` listings (Traps.h names, bounds, call graph, xrefs), `docs/spec/routine-inventory.json`, `scripts/report-coverage.mjs`, `docs/spec/kdef231-reference.md` §6 trap table | none; **start now** | Independent re-class of a 40-routine sample (record the heuristic error rate; if >15% the classes are advisory only); reachability of the 45 "unreached" kDEF routines resolved or marked; committed address-only denominator with a frozen in-scope count; `Traps.h`-generated trap table replaces hand-typed names, control-availability hash refreshed; `history.md` dead end reworded: "executing the kDEF *as the runtime*"; research-only oracle use is in scope |
| **L2 Clean-room tooling + doc split** | reads listings only to *move* asm out | `docs/spec/engine/TEMPLATE.md`, `docs/spec/engine/*.evidence.md` (moved asm from the 10 asm-embedding docs: compositor-spec, kdef231-reference, recipe-walk, service-handlers, faithfulness ledger, cinf-extended, platinum-controls, apple-cdef-*), `scripts/check-cleanroom.mjs`, implementer brief `docs/spec/engine/IMPLEMENTER-BRIEF.md` | none; **start now** | Each split doc keeps behaviour + tables + address citations and loses register/asm narrative; the linter (§5) passes on `src/` and fails on a planted asm comment; brief lists allowed paths |
| **L3 Ledger split** | none | `tests/rendering-requirements/families/*.json` (sources), `tests/rendering-requirements/build-ledger.mjs`, `ledger.test.mjs` | none; **start now** | Generated `ledger.json` byte-identical to 1.22.0; prefix-sha tests pass; two lanes can add cases to different family files and both PRs merge without a re-bump |
| **L4 QuickDraw primitives (implementer)** | **sandboxed**: no listings, no `*.evidence.md` | `src/engine/qd/*`, `src/engine/resources/*`, `src/engine/trace.ts`, `src/engine/state/*` | L2 split of compositor-spec/0xfeae/0x10320/0x107fe prose (day 1–2); otherwise starts from `window-chrome-rules.mjs` comments + Apple IM QuickDraw | Unit tests per primitive (tile with anchor/reverse direction, scale, mask edges, pattern phase, NULL-not-retried chain); `composeWindowChrome` re-pointed at `qd/` with zero golden change (dual-run identical) |
| **L5 Scroll-bar spec + verify** | spec writer reads listings; a *second* agent verifies | `docs/spec/engine/scrollbar.md` + `.evidence.md`; `tests/rendering-options/range-rules.mjs` additions (thumb rect, geometry) by a *third* test-author agent | L2 template | Completes `range-controls.md` with 0xbbf4 thumb rect, track fill between boxes, 0xba0e/0xc6e4 ppat path, ≤11 thickness path; decision tables only; verifier marks every address CONFIRMED/REFUTED; mutation table shows each row can fail |
| **L6 Scroll-bar driver (implementer)** | **sandboxed** | `src/engine/tables/scrollbar.ts`, `src/engine/families/scrollbar.ts`, `composeScrollbar` facade in `controls.ts`, `interactiveScrollbar` part mapping in `interactive.ts` | L4 + L5 (week 2) | 144 rule rows pass strict; `pressedPart` API; diff gate explains every changed cell with a rule id; per-family scroll-bar golden sheet recorded; #374 closed on v2 |
| **L7 Dark-region spec (0x11ee2–0x1525a, then 0x1547e)** | spec writer + verifier | `docs/spec/engine/procedural-frame.md` + `.evidence.md` | L1 annotated listing (can start on raw listing day 1) | Confirms or refutes the "procedural frame for wnd#-less schemes" hypothesis against the 5 corner-sprite schemes; decision tables for frame geometry/colours; names which `composeCornerSprite.ts` heuristics (`dominantColor`, `lighten/darken`) the decode replaces |

Immediately parallel: L0, L1, L2, L3, L5, L7 (six agents). L4 starts day 2 after L2 hands over the first split docs. L6 starts week 2. Week 3+ candidates in the same shape: push button/default ring (specs largely exist), checkables, tabs/headers (J), CDEF 3/5 specs, hit-test family, demo/diagnostic migration.

## 5. Clean-room mechanics agents can follow

- **Where listings are.** `.scratch/` (gitignored, root checkout only), `/tmp/kaleido-trace/`, the private store (`lanes/*/*.asm`, `lanes/RE-advisory/work/asm`, L1's `annotated/`). A fresh git worktree contains **no** `.scratch/`; implementers always work in a fresh isolated worktree (including Orca-managed worktrees) with no private evidence mounts or links and are never given a path into the root checkout or the private store.
- **What implementers are told** (verbatim in IMPLEMENTER-BRIEF.md): "You implement from `docs/spec/engine/<family>.md`, Apple Inside Macintosh/Universal Interfaces, and other files explicitly allowed below. You may run independent test-author specs and rule tests, but never open, read, search or edit their source or oracle data. Verifier review files must never be handed to implementers. Do not open any `*.asm`, `*.bin`, `*.evidence.md`, anything under `.scratch/`, `lanes/`, or the maintainer store, or these docs: [list below, from L2 until split]. If a spec is ambiguous, stop and file a spec question in your lane notes; do not resolve it by reading evidence. Your tool log will be reviewed for paths."
- **Independent checks and handoffs.** Implementers may run assigned independent tests without reading their source or oracle data; implementation-owned unit tests derived from allowed specs remain editable in the allowed code trees. Independent specs, rule tables and rule tests are never implementation inputs, even if linted or stored under a code tree. The PM never hands verifier review files or their contents to implementers; spec authors relay listing-free clarifications. The brief's exhaustive read list excludes verifier material regardless of filename. The linter checks content and declared scope; isolation, handoff filtering and tool-log review enforce access and authorship.
- **Reviewer contamination check**, three parts, recorded in the review JSON: (1) tool-log/transcript grep for forbidden paths; (2) `scripts/check-cleanroom.mjs` on `src/`: forbids `%d0-7`, `%a0-7`, `fp@`, `sp@`, 68k mnemonics as words (`jsr|bsr|moveq|movel|movew|lea|pea|link|unlk|bne|beq|bra|dbf|rts`), `0x[0-9a-f]+` in identifiers, and any constant in `engine/` not present in the spec or tables (constant census); (3) structure check: every branch in a driver maps to a decision-table row or a spec sentence; a branch with no spec anchor is a finding.
- **Spec template skeleton** (`docs/spec/engine/TEMPLATE.md`):
  1. Unit id and scope: family, message, binary + sha, cited range (as a citation, not narrative).
  2. Inputs: named engine inputs (state bits, part, orientation, rects, available resources) with meaning; no struct offsets.
  3. Outputs: resources requested in order with retry semantics; rects; draw order.
  4. Decision tables (inputs → outputs), one row per decision; each row carries its `source` citation.
  5. Geometry as formulas (`thumbLen = max(minThumb, floor(track * extent))`).
  6. Not decoded / unknown; corpus impact (which archives exercise which rows).
  7. Test hooks: rule rows and mutations that must fail.
  Appendix `<unit>.evidence.md` (never read by implementers): address-by-address trace, trap list, register narrative, verifier CONFIRMED/REFUTED marks.

## 6. Verification at scale

> *Where this section names the `v2` branch (its CI, nightlies or branch model), that part is superseded 2026-10-30; see the [§2 note](#2-branch-and-integration-strategy) and [DECISIONS #1](./DECISIONS.md).*

- **Diff gate (required check).** `tests/engine-diff/run.mjs` renders every matrix case (cases.mjs families × 18 themes × sampled states/sizes) under `legacy` and `model` *in Node* via `trace.ts` (no browser; theme-loader and PixelBuffer are pure), and compares `{resolved ids, rects, draw order}`. Each PR declares `engine-diff: <family>`; the gate runs that family and fails on any differing cell not listed in `tests/engine-diff/expected/<family>.json` with a `rule` id from the family's rules file. Pixel dual-run (full Playwright matrix both ways) runs nightly on v2 and on a `pixel-diff` label; its output is a per-family candidate sheet. Build-time switch: `SCRIPTOSCOPE_ENGINE=legacy|model` resolved in `vite.config`, never a runtime option; `dist/` carries one engine.
- **Rule tables stay independent.** `scripts/check-rule-independence.mjs` fails CI if any `tests/**/*-rules.mjs` imports from `src/` or if `src/engine/tables/*` imports from `tests/`. Policy: the test author and the implementer are different agents from the same spec; the reviewer's mutation step (flip one table row → a rule row fails; flip one rule row → it disagrees with the engine) is what proves the two derivations are not one.
- **Sentinel scheme: feasible, priority P1 after the first two families.** Author a resource fork (cicn/ppat/cinf/wnd#/ics#) where every resource of id *i* is a solid 8-bit index unique to *i*; read back **palette indices** from the framebuffer, not RGB, so no display-profile calibration is needed. Caveats: selection depends on *presence*, so build two variants (full ladder, sparse archive-only) and freeze predictions per variant before boot; it tests selection and geometry, not art or QuickDraw edge behaviour; sentinel has no PICT so the 32 bpp about-box hang does not apply. Budget: two boots per variant, one lane.
- **CI time budget.** Required v2 CI ≤ 25 min: gates (~5) + build + rendering contracts (~14 today) + Node trace diff (<2). Nightly on v2: extended matrix + full pixel dual-run (≤40). Container golden verification stays on the per-family candidate workflow, not on every PR.

## 7. Decisions needed now

> *Where this section names the `v2` branch (its CI, nightlies or branch model), that part is superseded 2026-10-30; see the [§2 note](#2-branch-and-integration-strategy) and [DECISIONS #1](./DECISIONS.md).*

1. **Branch model.** Recommend: long-lived `v2`, main frozen to hotfix/docs/tests, Monday merge-syncs, release as `0.2.0`.
2. **Driver unit and naming.** Recommend: per message × family drivers; addresses only in table rows, doc comments and `coverage.json`; reject address-named functions (overrides #378's "one function per routine").
3. **PACH 130 scope.** Recommend *scoped*: in scope are the patched painters already cited in the contract (list-header draw/sort from lane J; the EraseRect/FillRect interception and PaintRect helpers behind progress and body backgrounds, per `progress-caller-boundary.md`). Out of scope for 2.0: menus/MDEF, dialogs, Finder, cursors, text patches. Record the exclusion in the contract; open a v2.1 inventory issue for the rest (saves the advisory's 3–4 weeks).
4. **Scroll-bar pressed-part API.** Recommend: add `pressedPart?: 'up' | 'down' | 'pageUp' | 'pageDown' | 'thumb'` to `ScrollbarOptions` (mapped to 20/21/22/23/129); `state: 'pressed'` without a part means `thumb` (what `interactiveScrollbar` drags) and is documented as such; `interactiveScrollbar` sets the part from the hit. Keep `ControlState` unchanged.
5. **Golden re-cut and control-panel art.** Recommend: re-cut goldens on v2 into per-family sheets (one review per family, churn isolated); do **not** ship Kaleidoscope control-panel fork cicns, record that ladder step as a deliberate divergence per family and keep the procedural fallback.
