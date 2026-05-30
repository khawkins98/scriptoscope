# docs/archive/ — done work, parked for history

Documents in this folder describe **work that is complete**. They are kept (not deleted) because the design rationale, alternatives weighed, and lessons learned are sometimes still informative when revisiting the same problem space — but they should NOT be mistaken for active project state.

## What lives here

- **Plans** for sub-projects whose deliverable shipped (and the shipped artifact is the living reference).
- **Spike retrospectives** whose verdict has been recorded and acted on (e.g. ADR-0001's Decision 1 retirement).
- **TODO checklists** for features that landed.
- **One-shot QA / coherence passes** whose methodology has been folded into [`LEARNINGS.md`](../../LEARNINGS.md) — the worked example stays here so someone curious can read it end-to-end.

## What does NOT live here

- **Reference material** describing how the runtime works today → stays in [`docs/spec/`](../spec/) or [`docs/`](..).
- **Living TODOs** for in-progress workstreams → stays in [`docs/tracking/`](../tracking/) (or [`docs/geometry-refactor-todo.md`](../geometry-refactor-todo.md)).
- **Decisions** that govern current behaviour → stays in [`docs/adr/`](../adr/) or LEARNINGS.

## Conventions

- File names preserve their original date prefix (`YYYY-MM-DD-*.md`) so the chronology is legible from `ls`.
- Tracking docs (`*-todo.md`, `*-plan.md`) keep their original names.
- If a doc here was superseded by a GitHub issue (e.g. `golden-reference-todo.md` → [#190](https://github.com/khawkins98/aaron-ui/issues/190)), the issue is the live reference.

## What's here right now (2026-05-30)

| File | What it was | Where the live work lives now |
|---|---|---|
| `byo-theme-todo.md` | TODO for browser-side .sit/.rsrc drop-zone | Shipped 2026-05-27; see `tools/theme-loader/loadKaleidoscopeScheme.js` |
| `interactivity-plan.md` | Plan for interactive widget wrappers | Shipped to `src/interactive.ts`; demo playground is the live reference |
| `popup-menu-controls.md` | Deferred popup-menu chrome | Tracked in [#164](https://github.com/khawkins98/aaron-ui/issues/164) |
| `2026-05-24-platinum-wdef125-decode.md` | Plan for WDEF 125 decode (Phase A) | Decoded → `docs/spec/platinum-wdef125-decode.md` |
| `2026-05-26-platinum-controls-decode.md` | Plan for Platinum controls decode | Decoded → `docs/spec/platinum-controls-decode.md` + `platinum-palette.json`; gate = FALLBACK |
| `2026-05-27-sit-decoder-spike.md` | StuffIt-WASM feasibility spike (GO) | Built → `tools/sit-wasm/` |
| `2026-05-28-css-emitter-spike.md` | ADR-0001 §Gating spike (3 rounds, retired) | Decision 1 retired; lessons in LEARNINGS 2026-05-28 |
| `golden-reference-todo.md` | Backlog item, blocked on trustworthy ground truth | Tracked in [#190](https://github.com/khawkins98/aaron-ui/issues/190) |
| `overnight-coherence-review.md` | One-shot citation-coherence pass for 2026-05-29/30 overnight | Methodology folded into LEARNINGS 2026-05-30 |
