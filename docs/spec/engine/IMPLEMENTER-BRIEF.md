# Implementer brief (v2 clean-room)

*For every sandboxed implementer lane (PLAN §4: L4, L6 and later family
drivers). Source: v2 PLAN §5, quoted below. Maintained by lane L2; the
forbidden-document list shrinks as the doc split lands.*

## The rule (verbatim from PLAN §5)

> You implement from `docs/spec/engine/<family>.md`, Apple Inside
> Macintosh/Universal Interfaces, and other files explicitly allowed below.
> You may run independent test-author specs and rule tests, but never open,
> read, search or edit their source or oracle data. Verifier review files must
> never be handed to implementers. Do not open any `*.asm`, `*.bin`,
> `*.evidence.md`, anything under `.scratch/`,
> `lanes/`, or the maintainer store, or these docs: [list below, from L2 until
> split]. If a spec is ambiguous, stop and file a spec question in your lane
> notes; do not resolve it by reading evidence. Your tool log will be reviewed
> for paths.

Work in a fresh isolated git worktree (including an Orca-managed worktree),
with no private `.scratch/` material, evidence mounts or links to another
checkout or the maintainer store. Never `cd` into, list or search any other
checkout of the repository or the maintainer store. Read only the files in **Allowed paths**
below; when you search, name those files or directories explicitly rather than
searching the whole tree.

## Forbidden paths

Never open, read, search or have a tool print these:

- any `*.asm`, `*.bin`, `*.c` decompile, objdump or hex dump of a binary;
- `docs/spec/engine/*.evidence.md`;
- independent test-author specs, rule tables, rule tests and oracle data,
  including all of `tests/rendering-options/*-rules.mjs` and their
  `.spec.mjs` / `.test.mjs` companions, wherever stored;
- verifier review files, reports, annotations and review JSON, wherever stored
  (including `*.review.*`, `*-review.*` and review directories). The PM must
  never hand these files or their contents to an implementer; send only a
  listing-free spec clarification through the spec author;
- anything under `.scratch/`, `/tmp/kaleido-trace/`, `lanes/`,
  `v2-lanes/*/evidence`;
- the maintainer store (`Scriptoscope-maintainer-assets`) and the Forgejo
  `scriptoscope-assets` repository, except that you write, and may read back,
  your own lane notes in `v2-lanes/<lane>/`;
- **git history** of docs, specs, rule tables and `src/`: no `git log -p`,
  `git show <rev>:<path>`, `git blame`, `git diff <rev>` or checkout of an
  earlier revision. Earlier revisions of the split docs hold the narrative that
  was moved out. `git status`, `git diff` of your own uncommitted work and
  `git log --oneline` are fine;
- `docs/archive/**` (the pre-split Platinum decodes and other retired notes);
- `LEARNINGS.md` (asm lines and directions to listings in historical entries),
  `docs/history.md`, `docs/spec/README.md` (the spec index names listing
  paths) and `docs/v2/PLAN.md` (it names where the listings are; the rule you
  need is quoted above, and the PM restates your lane row in your assignment);
- `tests/rendering-requirements/**` (the ledger, its family sources and
  `*-transition.json` files quote register operands in pinned evidence
  locators; `EVIDENCE.md` is address-level evidence) and
  `tests/control-availability/SOURCE-EVIDENCE.md`;
- **these docs, until split** (each still embeds assembly, register or stack
  narrative; L2 removes them from this list as their split merges):
  - `docs/spec/kdef231-reference.md` (split, except four ledger-pinned
    evidence excerpts the requirement ledger quotes byte-for-byte and the §6
    trap table owned by lane L1; stays forbidden until those are repointed)
  - `docs/spec/kdef-binary-inventory.md` (a map of where the listings and
    binaries live)
  - `docs/spec/kdef231-code10-widgets.md` (split into
    [`window-widgets.md`](window-widgets.md); the stub keeps the ledger-pinned
    `kdef.too-short-step` excerpt, which quotes register operands, and stays
    forbidden until that row is repointed)
  - `docs/spec/checkable-icons.md`, `docs/spec/range-controls.md`
    (ledger-pinned excerpts quote register-relative operands)
- anything not listed under **Allowed paths**. The list is exhaustive.

## Allowed paths

This read/write list is exhaustive. The linter fails (`brief-scope`) if a
path named here is unscanned or independently forbidden. Linting a file does
not grant permission to read it; the checker also scans independent rule tables.

- `docs/spec/engine/*.md` except `*.evidence.md`, `*.review.md` and `*-review.md`.
  Only behavioural specs, the template and this brief qualify;
  verifier material is forbidden regardless of filename. Start with
  [`qd-primitives.md`](qd-primitives.md) (tile / scale / corner / cinf body +
  border) and [TEMPLATE.md](TEMPLATE.md) for the shape every family spec takes.
- Listing-free behavioural docs (the linter's `ALLOWED_DOCS`):
  `docs/spec/compositor-spec.md` (window chrome model),
  `docs/spec/cinf-resize-behavior.md`, `docs/spec/cinf-lookup-contract.md`,
  `docs/spec/control-face-geometry.md`, `docs/spec/control-border-boundaries.md`,
  `docs/spec/control-solid-background.md`, `docs/spec/control-text-colors.md`,
  `docs/spec/push-button-selection.md`,
  `docs/spec/default-button-caller-boundaries.md`,
  `docs/spec/progress-caller-boundary.md`, `docs/spec/slider-layout-cinf.md`,
  `docs/spec/slider-interaction.md`, `docs/spec/slider-selected-metadata.md`,
  `docs/spec/header-surface.md`, `docs/spec/header-sampled-lines.md`,
  `docs/spec/finite-cicn-transfer.md`, `docs/spec/cicn-decoding.md`,
  `docs/spec/cicn-sparse-transfer.md`, `docs/spec/cicn-body-mode5.md`,
  `docs/spec/ppat-decoding.md`, `docs/spec/wnd-decoding.md`,
  `docs/spec/display-profile.md`, `docs/spec/indexed-sampling-equivalence.md`,
  `docs/spec/managed-control-context.md`, `docs/spec/prepared-bitmap-font.md`,
  `docs/spec/fidelity-compatibility-contract.md`,
  `docs/spec/apple-primary-source.md`, `docs/spec/corpus-corroborated-ids.md`,
  Split by L2 (behaviour, tables and address citations; their listing
  narrative is in the matching evidence appendix, which stays forbidden):
  `docs/spec/kdef231-recipe-walk.md`, `docs/spec/kdef-service-handlers.md`,
  `docs/spec/kdef-faithfulness-ledger.md`, `docs/spec/kdef-architecture.md`,
  `docs/spec/kdef182-disassembly-findings.md`,
  `docs/spec/cinf-extended-decode.md`, `docs/spec/platinum-controls-decode.md`,
  `docs/spec/platinum-controls-faithfulness-ledger.md`,
  `docs/spec/platinum-wdef125-decode.md`,
  `docs/spec/platinum-theme-provider-decode.md`,
  `docs/spec/apple-cdef-geometry.md`,
  `docs/spec/apple-cdef-button-geometry.md`,
  `docs/spec/apple-cdef-button-vs-our-compose.md`,
  `docs/spec/apple-drawtheme-decode.md`,
  `docs/spec/apple-appearancelib-spike.md`,
  `docs/spec/codebase-vs-primary-sources-audit.md`,
  `docs/spec/control-pattern-context.md`,
  `docs/spec/control-resolution-diagnostics.md`,
  `docs/spec/fidelity-verification-plan.md`,
  `docs/spec/resource-byte-provenance.md`,
  `docs/spec/sampled-control-bands.md`, `docs/spec/proxy-icon-modified-dot.md`,
  `docs/spec/scheme-factory-vocabulary.md`,
  `docs/spec/tab-body-investigation.md`, `docs/spec/tab-cdef8-body.md`,
  `docs/geometry-refactor-todo.md`, `docs/tracking/title-text-color.md`;
  and `docs/v2/DECISIONS.md`, `CLAUDE.md`, `CONTRIBUTING.md`.
- Code: `src/` and `tools/` (both linted, comments included), plus
  `package.json`. Implementation-owned unit tests in these code trees may be
  read and edited when assigned; they test implementation details derived from
  the allowed spec and are not independent acceptance oracles. Independent
  test-author material remains forbidden even inside these trees. A task
  assignment cannot override the forbidden list or authorize an unlisted test
  harness.
- Apple Inside Macintosh and Universal Interfaces 3.4.1 headers
  (`Traps.h`, `Quickdraw.h`, `Controls.h`, `MacWindows.h`, `Appearance.h`).

If an allowed file turns out to contain assembly, register narrative or a
pointer to a listing, stop reading it, record the path in your lane notes and
tell L2. A sentence saying "(listing detail in evidence)" is a stop sign: if
you need that detail, file a spec question.

## Running independent checks

You may execute the PM's assigned test commands, including independent
specs and rule tests, without opening their source, fixtures or expected data.
Use normal pass/fail and assertion diagnostics; do not ask tools to print
source, inspect snapshots, dump oracle data or expose verifier review contents.
Do not import independent rules as implementation inputs or copy expected
values into runtime code. Report ambiguity or a failing independent check to
the PM for a listing-free spec clarification; never change the oracle to pass.

The linter enforces file content and the brief's declared read scope, not
filesystem access or authorship. Isolation, PM handoff filtering and the
reviewer's tool-log audit enforce the remaining boundary. Do not treat a
passing linter or a test command's ability to read a file as read permission.

## What your code must pass

`node scripts/check-cleanroom.mjs` (reviewer contamination check, part 2; it
also runs in `npm run gates`). Over `src/`, `tools/`, the allowed docs and the
rule tables it fails on:

- 68k register names: percent-prefixed, frame/stack-pointer and
  register-indirect (MIT `@`) forms and Motorola parenthesised operands
  anywhere; bare data/address register names as words, lower or upper case, in
  docs and in code **comments** (in code proper, short names such as a
  destination offset or an alpha value stay ordinary variable names);
- 68k mnemonics as words, including the size-suffixed family and the dotted
  sized forms; mnemonics that are also English words only when followed by an
  operand (exact patterns are in the header of `scripts/check-cleanroom.mjs`);
- decompiler-generated names (function, variable and parameter names) and
  pointers to listings (listing directories, assembly files, disassembler
  commands);
- in code, an identifier containing `0x<hex>` (no address-named functions or
  variables; addresses go only in table `source` strings, a driver's doc
  comment and `coverage.json`, per DECISIONS #2);
- in `src/engine/`, any numeric constant outside `src/engine/tables/` that does
  not appear in a `docs/spec/engine/*.md` spec or in `src/engine/tables/`
  (constant census). 0, 1, 2 and -1 are exempt. If a constant you need is not
  in the spec, that is a spec question, not a reason to add it.

The reviewer also checks that every branch in a driver maps to a
decision-table row or a spec sentence (PLAN §5 part 3).

## When the spec is not enough

Write the question in your lane notes (`v2-lanes/<lane>/SPEC-QUESTIONS.md`, the one store path you may write):
the spec file and section, what is ambiguous, and what you would need to
know. Then stop on that item or implement only what the spec states and mark
the rest unimplemented. Do not infer from the runtime's legacy code where it
disagrees with the spec; report the disagreement as a spec question too.
