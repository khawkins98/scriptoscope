# Independent #459 public-contract tests

Inputs reviewed on 2026-10-23: CONTRIBUTING.md fidelity and review rules,
docs/v2/DECISIONS.md (especially #8, #10 and #11), and GitHub issues
[#436](https://github.com/khawkins98/scriptoscope/issues/436) and
[#459](https://github.com/khawkins98/scriptoscope/issues/459).
Runtime candidate: `a1755690d1649a9ba8be6270001d9364d31e71ec`.

The issue-defined public contract removes `progressSummary`,
`ThemeInspector.resourceRoles.progress` and `ThemeProgressModel`. CDEF 5 does
not request cicn -10223; -10224 supplies three procedural colour samples.
These tests assert that distinction even when author labels suggest the old
model. Synthetic forks exercise the actual public loader inspector; TypeScript
compiles a consumer with expected errors for the removed API and a positive
check for the retained scroll-arrow API. No progress drawing model is inferred
from artwork or imported from runtime selection helpers.

The diagnostic browser contract is that valid theme hashes select the theme on
initial navigation and hashchange. Compatibility assertions also cover hash
precedence over query, query/default fallback, ignored unknown hashes and
section anchors, restored title/dimensions/window type/state/scale, invalid
controls, bounds, and refresh. The browser asserts rendered window title,
detail heading, controls, ribbon and URL agreement. A held older source response
is released after a newer hash has rendered, then checked for stale overwrites.
Tests use the real demo and loader through Vite, with no imported runtime oracle.
They establish web selection behavior, not native drawing fidelity or visual
approval; independent Tier-2 and visual review remain required.

Run on Node 24 with locked dependencies and Playwright Chromium installed:

```sh
npm ci
node --experimental-strip-types --test tools/theme-loader/progressMetadata.test.mjs
node --test tests/visual-baselines/diagnostic-hash.spec.mjs
node tests/visual-baselines/diagnostic-mutations.mjs
npm run test:acceptance:bindings
node --experimental-strip-types --test tests/acceptance-bindings/generate.test.mjs
```

The opt-in mutation runner requires each targeted test to exit 1 for its named
assertion. It independently restores the retired classifier export, inspector
property, public model export/property, and incorrect -10224 track label, then
disables initial hash precedence and hashchange activation. Node module hooks,
a compiler host, and intercepted HTML responses apply these mutations only
inside test processes; no runtime file is rewritten. Browser mutations fail on
the selected-theme/rendered-state wait, rather than a generic launch failure.

## Binding artifact scope

Regenerating `tests/acceptance-bindings/bindings.json` from the candidate changes
exactly `/toolchain/15/sha256` (the row for
`tools/theme-loader/classifyResources.js`):

- Before: `009e7c731dbeeab93727dddae6ea2b9bc6ecade4c8f5a51365dccd5ce67e649f`
- After: `7287d6cb5e57b43c8bfb24cd645e1a60f90ff7581264adc3cedd4441d9dba2ca`

The classifier's source changed when the deprecated export/summary was removed
and the two role labels were corrected. The generator hashes this source as an
explicit toolchain input. It does not serialize inspector roles, so no generated
manifest, asset plane, resource inventory, fork selection, window selection,
source registry, envelope cell or status changes. All 18 source bindings and 594
envelope cells are preserved byte for byte outside this one hash. This is a
justified source fingerprint update, with zero selection delta; the diagnostic
HTML is not a binding-generator input. No golden, ledger or runtime edits are
part of this test candidate.
