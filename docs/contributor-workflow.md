# Develop and validate a change

This is the command and PR workflow for contributors and integration owners.
Runtime implementers first follow the [implementer brief](./spec/engine/IMPLEMENTER-BRIEF.md)
and their assigned commands; this guide does not expand its exhaustive allowed
paths. Source evidence, independent tests and verifier reports keep separate
ownership. Ambiguous behavior becomes a listing-free spec question.

## Set up a checkout

Use **Node.js 24**, matching CI. The package's consumer `engines` field is not the
contributor toolchain requirement. From a clone of this repository:

```sh
npm ci
npm run dev
```

Vite serves the landing page at `http://localhost:5173/`, the interactive demo at
`/showcase.html`, and diagnostics at `/diagnostic.html`. Development CSS comes
from `src/scriptoscope.css`; the production build copies that stylesheet into
`dist/`. Check production output when changing styles or integration:

```sh
npm run build:demo
npm run preview:demo
```

Open the printed `/scriptoscope/` URL. A successful development server does not
establish that minified modules, assets and base paths work after deployment.

## Choose the validation for your change

Start with a reproducer and the affected test. Before requesting review, run one
finished-candidate chain appropriate to the change; do not repeat successful
suites unless new changes, failures or unresolved concerns justify it. Required
CI, evidence checks and independent visual review remain mandatory.

| Change or task | Command / canonical procedure |
| --- | --- |
| TypeScript check | `npm run typecheck` |
| Node tests | `npm test`; a single file: `node --experimental-strip-types --test path/to/file.test.mjs` |
| Finished runtime/theme candidate | `npm run build:themes`, `npm run build`, then `npm run gates` |
| Controls, CSS, fonts or DOM promotion | Also run `npm run test:rendering`; use affected browser contracts while iterating and required CI for the final full matrix |
| Package exports, declarations, lazy assets or shipped consumer guide/example | Also run `npm run test:package`; [installed-package contract](../tests/package-consumer/README.md) |
| Browser engines, golden review, sharding or failure artifacts | [Browser CI procedure](../tests/rendering-options/CI.md) |
| Diagnostic Scene image changes | [Scene baseline procedure](../tests/visual-baselines/README.md) |
| Source/evidence or fidelity status changes | [Fidelity batch requirements](./contributor-fidelity.md) and the role-gated [requirement ledger](../tests/rendering-requirements/README.md) |
| Documentation | [Maintenance policy](./doc-sweep.md), links/anchors, changed command names and any affected executable example |
| Benchmark runtime rendering | [Performance harness](../tools/performance/README.md) |

Theme extraction supplies the ignored local derivatives used by diagnostics and
scene audit. `gates` runs the checks declared in [package.json](../package.json),
including typechecking, clean-room and ledger-related validation, unit tests,
strict theme lint and scene audit; do not maintain a second script expansion here.
Install Chromium before browser runs with `npx playwright install --with-deps chromium`.
The extended/interaction procedures explain additional browser installation.

## Theme and diagnostic commands

| Task | Command |
| --- | --- |
| Port one scheme | `npm run import -- <slug>`; [porting workflow](./porting-a-kaleidoscope-scheme.md) |
| Decode all bundled archives locally | `npm run build:themes` |
| Verify archive hashes | `npm run lint:themes` |
| Verify decoding and the strict baseline | `npm run lint:themes -- --strict` (add `--decoded` for the release check) |
| Refresh a reviewed lint baseline after a relevant rule/renderer change | `npm run lint:themes -- --update` |
| Inspect a rendered window / placement | [Diagnostic prerequisites and complete example](./diagnostic-tooling.md#headless--node-clis-no-browser); the render CLI requires a scheme slug |
| Check scene slots / regenerate the scene catalog | `npm run audit:scenes -- --check` / `npm run audit:scenes -- --write` |
| Create a new scheme | [Authoring workflow](./authoring-a-scheme.md) |

Do not commit `dist/`, `node_modules/` or generated theme working files.
Original archives, metadata and provenance remain the theme bundle source of
truth; [bundle layout](./theme-bundle-layout.md) explains the distinction.

## Branching

Branch from `main` for engine migrations, docs, release work and hotfixes. Use a
short task name such as `fix/close-box` or `docs/install`; research-only branches
can use `spike/` and must not be merged as implementation. The former `v2`
integration branch is retired; [DECISIONS #1/#8](./v2/DECISIONS.md) own integration policy.

## Commit messages — Conventional Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<optional scope>): <summary>`, for example
`fix(chrome): correct close-box placement`. Common types are `feat`, `fix`,
`docs`, `chore`, `refactor`, `test`, `ci` and `build`. Use `!` or a
`BREAKING CHANGE:` footer for breaking changes. Do not add a `Co-Authored-By:` line.
Source attribution, copyright and required third-party notices are separate from
commit trailers; retain those credits when using or adapting others' work.

## Pull requests

Open a focused PR to `main` describing the problem and resulting behavior, related
issues, checks, limits and any remaining evidence gaps. Obtain independent review;
do not self-approve. Carry approval over provably unchanged content; material
changes and unresolved findings reopen the affected review.

The existing [fidelity workflow](./contributor-fidelity.md#evidence-and-batch-requirements)
retains the exact-head `lane:ready` receipt, engine-diff declarations, runtime LOC
report, review tiers and evidence requirements. That section is mandatory where
applicable, not replaced by this quick path. Runtime implementers receive only
listing-free spec clarifications, never independent test sources or review reports.

### Merging

Squash larger or noisy branches into a Conventional Commit. A small branch with
one well-formed commit may use a regular merge. Rebase private branches instead
of merging `main` into them. Do not bypass required checks or review.

## CI tiers

The required PR check is **Gates + build + browser contracts**. The PR matrix is
bounded and Chromium-only; the release matrix adds the extended engines and
required interaction-coverage checks. [Browser CI](../tests/rendering-options/CI.md)
owns the tier details and artifact procedure.

The **Release gate** is a release prerequisite, not a branch-protection check for
ordinary PRs. Tagging requires a successful dispatch/scheduled gate on the exact
commit; a green PR merge preview is insufficient. Follow the
[release procedure](./contributor-release.md) for npm candidate integrity, tags,
registry smoke and coordinated Pages publication.
