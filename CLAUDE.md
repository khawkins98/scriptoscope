# Agent guidance

Scriptoscope is a browser runtime for original Kaleidoscope resource archives.
It paints chrome and controls while live content and native input behavior remain
DOM. This is a clean-room compatibility runtime: no original Kaleidoscope code
ships or executes as its runtime.

## Role boundary — read first

Runtime implementers must start with the [implementer brief](./docs/spec/engine/IMPLEMENTER-BRIEF.md)
and their assigned listing-free family spec. Its allowed paths are exhaustive.
Use a fresh isolated worktree without private material. Run assigned independent
checks without reading/searching/editing their source, oracle data or verifier
reports. Do not use history, LEARNINGS or original evidence to resolve ambiguity;
stop and request a listing-free spec clarification through the spec author.
Nothing linked below expands that scope.

Other contributors start with [CONTRIBUTING](./CONTRIBUTING.md). Current integration
policy is in [DECISIONS](./docs/v2/DECISIONS.md); all focused PRs target `main`.
The former `v2` branch and May architecture names are historical, not package versions.

## Commands

The [contributor workflow](./docs/contributor-workflow.md) is the canonical home
for setup, commands, validation choices and PR mechanics for unrestricted roles.
Implementers execute their assigned commands within the brief instead of reading
unlisted handbooks. Use Node 24. Validate affected behavior while iterating, then
one finished-candidate chain; retain required CI and independent review. Repeat
checks only after changes, failures or unresolved concerns warrant it.

## Architecture

Theme archive → loader → compositor → pixel buffer → canvas. Live content and
native controls stay DOM, so raw pixel comparisons do not test the whole interface.
Conversion stays portable; `tools/theme-author/` is build-time only. The StuffIt
WASM decoder is a lazy runtime dependency for archive loading.

### Key files in `src/`

| Area | Starting point |
| --- | --- |
| Public contracts | `src/index.ts`, `src/renderer.ts`, `src/declarative/index.ts` |
| Chrome facade and migrated families | `src/composeChrome.ts`, `src/engine/families/` |
| Ownership and loading | `src/ownedTheme.ts`, `src/loadTheme.ts`, `src/declarative/theme.ts` |
| Window interaction and geometry | `src/interactive.ts` |
| Explicit DOM promotion | `src/declarative/ScriptoscopeWindow.ts` |
| Pixels and titles | `src/pixelBuffer.ts`, `src/textRaster.ts` |

### Declarative layout model

Read the promotion and WindowManager contracts before changing layout. Measured
bounds and declared content dimensions are different. Route committed position
changes through `WindowManager.setPosition` / `toAbsolute`; preserve the intentional
pointermove hot path. Resource identity comes from structured source fields,
never asset URL parsing. Capture an owned asset from its selected owner before
awaiting work; release themes only after their borrowers are disconnected.

### Theme bundles

Original archives plus metadata/provenance are authoritative. Theme extraction
produces ignored local diagnostics, not committed replacement inputs. The
[bundle layout](./docs/theme-bundle-layout.md) describes archive and metadata
layout, not a shipped `theme.json` schema. Never infer resource roles from filenames
or numeric IDs; use explicit source identity and established behavioral contracts.

## Working norms

- Correct shared behavioral models; avoid theme-specific exceptions that conceal
  an unresolved rule. Distinguish decoded behavior from modern compatibility policy.
- Keep spec authorship, independent verification/testing and implementation separate.
  Do not supply an implementer with original evidence or verifier reports.
- Preserve original data, failed runs, unknown scope and review requirements.
  Source/built parity and reviewed regression goldens do not certify fidelity.
- Keep focused changes and Conventional Commits; do not add `Co-Authored-By:` lines.
  Do not commit generated builds, dependencies or decoded theme working files.
- Follow [CONTRIBUTING's batch requirements](./CONTRIBUTING.md#fidelity-acquisition-and-implementation-batches)
  where applicable; don't weaken readiness, evidence review or required CI to shorten work.

## Documentation maintenance

Follow the [documentation policy](./docs/doc-sweep.md). Choose the reader and
purpose, update its authoritative home and link from entry points. The
[documentation hub](./docs/index.md) routes unrestricted roles; it does not override
the implementer brief. Keep agent guidance to boundaries and high-value chokepoints,
not a second API, command catalog or chronological project log.
