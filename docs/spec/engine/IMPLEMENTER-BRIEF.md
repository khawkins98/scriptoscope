# Implementer brief (v2 clean-room)

*For every sandboxed implementer lane (PLAN §4: L4, L6 and later family
drivers). Source: [v2 PLAN §5](../../v2/PLAN.md). Maintained by lane L2; the
forbidden-document list shrinks as the doc split lands.*

## The rule (verbatim from PLAN §5)

> You implement from `docs/spec/engine/<family>.md`, Apple Inside
> Macintosh/Universal Interfaces, and `tests/rendering-options/*-rules.mjs`. Do
> not open any `*.asm`, `*.bin`, `*.evidence.md`, anything under `.scratch/`,
> `lanes/`, or the maintainer store, or these docs: [list below, from L2 until
> split]. If a spec is ambiguous, stop and file a spec question in your lane
> notes; do not resolve it by reading evidence. Your tool log will be reviewed
> for paths.

Work in a fresh git worktree under
`/Users/khawkins/Documents/git/scriptoscope-lanes/<lane>`. A fresh worktree has
no `.scratch/`. Never `cd` into, list or search the root checkout
(`/Users/khawkins/Documents/git/aaron-ui`) or the maintainer store. Searches
(`grep -r`, `rg`, `find`) must exclude `docs/spec/engine/*.evidence.md` and the
forbidden documents below; prefer naming the files you search.

## Forbidden paths

Never open, read, search or have a tool print these:

- any `*.asm`, `*.bin`, `*.c` decompile, objdump or hex dump of a binary;
- `docs/spec/engine/*.evidence.md`;
- anything under `.scratch/`, `/tmp/kaleido-trace/`, `lanes/`,
  `v2-lanes/*/evidence`;
- the maintainer store: `/Users/khawkins/Documents/Scriptoscope-maintainer-assets/**`
  and the Forgejo `scriptoscope-assets` repository;
- **these docs, until split** (each still embeds assembly, register or stack
  narrative; L2 removes them from this list as their split merges):
  - `docs/spec/kdef231-reference.md`
  - `docs/spec/kdef231-recipe-walk.md`
  - `docs/spec/kdef-service-handlers.md`
  - `docs/spec/kdef-faithfulness-ledger.md`
  - `docs/spec/kdef-binary-inventory.md`
  - `docs/spec/cinf-extended-decode.md`
  - `docs/spec/platinum-controls-decode.md`
  - `docs/spec/platinum-wdef125-decode.md`
  - `docs/spec/platinum-theme-provider-decode.md`
  - `docs/spec/apple-cdef-geometry.md`
  - `docs/spec/apple-cdef-button-geometry.md`
  - `docs/spec/apple-cdef-button-vs-our-compose.md`
  - `docs/spec/apple-drawtheme-decode.md`
  - `docs/spec/codebase-vs-primary-sources-audit.md`
  - `docs/spec/control-pattern-context.md`
  - `docs/spec/checkable-icons.md`
  - `docs/spec/range-controls.md`
  - `docs/spec/proxy-icon-modified-dot.md`
  - `docs/spec/scheme-factory-vocabulary.md`
  - `docs/spec/tab-body-investigation.md`
  - `docs/geometry-refactor-todo.md`
  - `docs/tracking/title-text-color.md`
  - `tests/rendering-options/range-rules.mjs` (one register-relative comment
    near the track-record rule; L5 owns the scrub)
  - `tests/rendering-requirements/EVIDENCE.md`,
    `tests/control-availability/SOURCE-EVIDENCE.md` (address-level evidence
    excerpts)

## Allowed paths

- `docs/spec/engine/*.md` except `*.evidence.md`. Start with
  [`qd-primitives.md`](qd-primitives.md) (tile / scale / corner / cinf body +
  border) and [TEMPLATE.md](TEMPLATE.md) for the shape every family spec takes.
- Split and listing-free behavioural docs in `docs/spec/`:
  [`compositor-spec.md`](../compositor-spec.md) (window chrome model),
  `cinf-resize-behavior.md`, `cinf-lookup-contract.md`,
  `control-face-geometry.md`, `control-border-boundaries.md`,
  `control-solid-background.md`, `control-text-colors.md`,
  `push-button-selection.md`, `default-button-caller-boundaries.md`,
  `progress-caller-boundary.md`, `slider-layout-cinf.md`,
  `slider-interaction.md`, `slider-selected-metadata.md`,
  `header-surface.md`, `header-sampled-lines.md`, `finite-cicn-transfer.md`,
  `cicn-decoding.md`, `cicn-sparse-transfer.md`, `cicn-body-mode5.md`,
  `ppat-decoding.md`, `wnd-decoding.md`, `display-profile.md`,
  `indexed-sampling-equivalence.md`, `managed-control-context.md`,
  `prepared-bitmap-font.md`, `fidelity-compatibility-contract.md`,
  `apple-primary-source.md`, `corpus-corroborated-ids.md`, `README.md`.
  Any `docs/spec/*.md` not in the forbidden list above may be read; if one
  turns out to contain assembly or register narrative, stop reading, record the
  path in your lane notes and tell L2.
- Apple Inside Macintosh and Universal Interfaces 3.4.1 headers
  (`Traps.h`, `Quickdraw.h`, `Controls.h`, `MacWindows.h`, `Appearance.h`).
- `tests/rendering-options/*-rules.mjs` and their tests; `src/`, `tools/`,
  `tests/` generally (minus the evidence files above).
- `docs/v2/PLAN.md`, `docs/v2/DECISIONS.md`, the repository `CLAUDE.md`,
  `CONTRIBUTING.md`, `LEARNINGS.md`, `docs/history.md`.

## What your code must pass

`node scripts/check-cleanroom.mjs` (reviewer contamination check, part 2). It
fails on any of these in `src/`:

- 68k register names in any syntax (percent-prefixed, frame/stack-pointer and
  register-indirect forms, and bare data/address register names as words);
- 68k mnemonics as words (the PLAN §5 list; exact patterns are in the header
  of `scripts/check-cleanroom.mjs`);
- an identifier containing `0x<hex>` (no address-named functions or
  variables; addresses go only in table `source` strings, a driver's doc
  comment and `coverage.json`, per DECISIONS #2);
- in `src/engine/`, any numeric constant outside `src/engine/tables/` that does
  not appear in a `docs/spec/engine/*.md` spec or in `src/engine/tables/`
  (constant census). 0, 1, 2 and -1 are exempt. If a constant you need is not
  in the spec, that is a spec question, not a reason to add it.

The reviewer also checks that every branch in a driver maps to a
decision-table row or a spec sentence (PLAN §5 part 3).

## When the spec is not enough

Write the question in your lane notes (`v2-lanes/<lane>/SPEC-QUESTIONS.md`):
the spec file and section, what is ambiguous, and what you would need to
know. Then stop on that item or implement only what the spec states and mark
the rest unimplemented. Do not infer from the runtime's legacy code where it
disagrees with the spec; report the disagreement as a spec question too.
