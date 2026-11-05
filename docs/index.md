# Documentation

Choose a task before opening a handbook. Tutorials walk through one complete
result; how-to guides solve a task; references hold the full contract; explanations
cover the reasons behind it. Detail belongs where a reader needs it, once.

## Use Scriptoscope

| Task | Start here | Look up details |
| --- | --- | --- |
| Decorate plain HTML | [Hosted page guide](./decorate-a-page.md) | [Attributes and page-host reference](./hosted-reference.md) |
| Integrate an application | [npm tutorial and working example](./npm-consumer.md) | [Runtime recipes](./runtime-api.md) |
| Resolve layout, framework or lifecycle problems | [Integration troubleshooting](./integration-edge-cases.md) | [Gestures, keyboard and events](./interaction.md) |
| Make a new scheme | [Authoring guide](./authoring-a-scheme.md) | [Frame geometry](./authoring-exotic-frames.md), [visual design](./authoring-visual-design.md) |
| Add an existing scheme | [Porting guide](./porting-a-kaleidoscope-scheme.md) | [Bundle layout](./theme-bundle-layout.md), [asset catalog](./kaleidoscope-asset-catalog.md) |
| Understand the project | [Background and preservation](./project-background.md) | [Project history](./history.md) |

The [README](../README.md) has the shortest working hosted example. The
[agent discovery file](../llms.txt) points to these same public contracts.

## Work on the repository

**Runtime implementers:** start with the [implementer brief](./spec/engine/IMPLEMENTER-BRIEF.md)
and then only your assigned safe family spec and the brief's allowed paths.
This index grants no additional reading scope. Do not follow evidence, independent
test sources, verifier reports or historical research links to resolve a rule.
Ask the spec author instead.

| Task / role | Start here |
| --- | --- |
| Set up development, choose checks or prepare a release | [Contributor guide](../CONTRIBUTING.md) and [workflow reference](./contributor-workflow.md) |
| Find diagnostics | [Diagnostic tooling](./diagnostic-tooling.md) |
| Investigate execution cost | [Measured simplification](./measured-simplification.md) |
| Write or independently verify engine specifications | [Role-gated spec index](./spec/README.md) |
| Acquire original reference evidence (maintainers/verifiers only) | [Reference environment](./maintainer-reference-environment.md) and [research records](./research/README.md) |
| Maintain documentation | [Editorial policy and sweep](./doc-sweep.md) |

## Read records in their recorded context

These records retain useful reasoning or evidence. They do not replace current
usage instructions or certify completion beyond their stated scope.

| Collection | Purpose |
| --- | --- |
| [CHANGELOG](../CHANGELOG.md) | Published release changes |
| [LEARNINGS](../LEARNINGS.md) | Dated lessons, including superseded decisions; not default onboarding |
| [Architecture decisions](./adr/0001-consumption-architecture.md) | Decisions with their recorded acceptance/retirement context |
| [Integration decisions and plans](./v2/README.md) | Read current decision amendments before older plans |
| [Historical design proposals](./superpowers/README.md) | Original plans and designs; not the current API contract |
| [Archived work](./archive/README.md) | Retained design, investigation and handoff records |
| [Tracking notes](./tracking/README.md) | Dated investigations; use linked issues for work status |
| [Runtime experiment harness](../tools/runtime-spike/README.md) | Scoped measurements and reproduction, not universal performance guarantees |

The [documentation map](./documentation-map.json) classifies every tracked Markdown
page and `llms.txt` by purpose and retention policy. Run
`node scripts/docs-audit.mjs --check --base origin/main` to check coverage,
protected records and growth in active guides. It does not validate engine rules
or replace the checks for the code or examples being documented.
