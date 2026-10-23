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

The opt-in mutation runner independently restores the retired classifier export,
inspector property, public model export/property, and incorrect -10224 track
label, then disables initial hash precedence and hashchange activation. Node
module hooks, a compiler host, and intercepted Vite JavaScript proxy responses
apply these mutations only inside test processes; no runtime file is rewritten.
The independent delayed-theme race and loader/type/label probes are retained.

For each browser mutation the runner requires one precise replacement in
`/diagnostic.html?html-proxy&index=0.js`, one successful HTTP-200 navigation,
no route/navigation/page/request errors, and exactly one failed selected-theme
assertion (`ERR_ASSERTION`, strict equality). Literal expected themes are
`beos-r503` for initial hash and `windows-95` for hashchange; the disabled
selection leaves `1138` active. A selected-state wait timeout alone cannot kill
a mutation: a wrong ribbon theme must produce the named equality assertion,
and a timeout with the correct theme remains an unrelated failure. The runner
also launches real broken-navigation, route-exception, unapplied-mutation and
unrelated-assertion controls and verifies that none qualify as runtime kills.
Set `SCRIPTOSCOPE_459_EVIDENCE_DIR` to retain each child's raw TAP output.

## Superseded negative-control evidence

The original `28939beb` mutation receipts incorrectly claimed browser kills.
The HTML route could not replace logic Vite extracted into its JavaScript proxy;
its route assertion interrupted navigation, and the runner accepted a generic
`TimeoutError`. Those browser receipts establish no runtime mutation coverage.
The original report/logs are preserved without rewriting under
`/Users/khawkins/Documents/git/scriptoscope-lanes/459-tests-evidence/` and marked
superseded by a companion notice. Corrected raw child receipts and a new honest
report live under
`/Users/khawkins/Documents/git/scriptoscope-lanes/459-tests-repair/`.
Positive browser/race and loader checks are rerun for this bounded repair; no
historical drawing or visual approval is inferred from these assertions.

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
