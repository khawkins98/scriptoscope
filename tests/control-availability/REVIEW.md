# #228 finite expectation review

**Draft for independent review. No executable availability gate is active.**

27 exact cases; all currently have effective availability UNKNOWN. The proposed API outcomes below are source/policy expectations, never generated from renderer or matrix outcomes.

| Case | Proposed outcome | Painted owner / signed resource / exact key | Policy / source boundary |
| --- | --- | --- | --- |
| windows-95.push.normal | themed | face: theme.windows-95@0 / -10239 / `cicn--10239` | canonical-push-states, plain-ring-reservation |
| windows-95.push.pressed | themed | face: theme.windows-95@0 / -10238 / `cicn--10238` | canonical-push-states, plain-ring-reservation |
| windows-95.push.disabled | themed | face: theme.windows-95@0 / -10240 / `cicn--10240` | canonical-push-states, plain-ring-reservation |
| system7-nostalgia-silver.push.normal | themed | face: theme.system7-nostalgia-silver@0 / -10239 / `active-push-button` | canonical-push-states, plain-ring-reservation |
| system7-nostalgia-silver.push.pressed | themed | face: theme.system7-nostalgia-silver@0 / -10238 / `pressed-push-button` | canonical-push-states, plain-ring-reservation |
| system7-nostalgia-silver.push.disabled | themed | face: theme.system7-nostalgia-silver@0 / -10240 / `inactive-push-button` | canonical-push-states, plain-ring-reservation |
| animals.push.normal | themed | face: theme.animals@0 / -10238 / `pressed-push-button` | canonical-push-states, anti-role, face-state-substitution, plain-ring-reservation |
| monkey-paradise.push.normal | themed | face: theme.monkey-paradise@0 / -10238 / `pressed-push-button` | canonical-push-states, anti-role, face-state-substitution, plain-ring-reservation |
| windows-95.default.normal | themed | face: theme.windows-95@0 / -10239 / `cicn--10239`; default-ring: theme.windows-95@0 / -10231 / `cicn--10231` | canonical-push-states |
| windows-95.default.pressed | themed | face: theme.windows-95@0 / -10238 / `cicn--10238`; default-ring: theme.windows-95@0 / -10231 / `cicn--10231` | canonical-push-states |
| windows-95.default.disabled | themed | face: theme.windows-95@0 / -10240 / `cicn--10240`; default-ring: theme.windows-95@0 / -10232 / `cicn--10232` | canonical-push-states |
| windows-95.bevel.normal | themed | face: theme.windows-95@0 / -10166 / `cicn--10166` | canonical-bevel-states |
| windows-95.bevel.pressed | themed | face: theme.windows-95@0 / -10165 / `cicn--10165` | canonical-bevel-states |
| windows-95.bevel.disabled | themed | face: theme.windows-95@0 / -10167 / `cicn--10167` | canonical-bevel-states |
| synthetic.child-canonical | themed | face: child@0 / -10239 / `cicn--10239` | self-first |
| synthetic.child-missing | themed | face: base@1 / -10239 / `push-button-active` | self-first |
| synthetic.child-repurposed | themed | face: base@1 / -10239 / `push-button-active` | self-first, anti-role |
| synthetic.named-preference | themed | face: child@0 / -123 / `push-button-active` | named-preference |
| synthetic.named-unknown-id | themed | face: child@0 / unknown ID / `push-button-active` | named-preference |
| synthetic.active-to-pressed | themed | face: child@0 / -10238 / `pressed-push-button` | anti-role, face-state-substitution |
| synthetic.inactive-to-active | themed | face: child@0 / -10239 / `cicn--10239` | face-state-substitution |
| synthetic.empty-chain | unavailable | none / not asserted | direct-missing |
| synthetic.empty-cycle | unavailable | none / not asserted | direct-missing |
| synthetic.bevel-child-base | themed | face: child@0 / -10166 / `cicn--10166` | bevel-self-first |
| synthetic.raw-repurposed-only | unknown / policy-pending | none / not asserted | source ring dispatch or unresolved policy |
| synthetic.native-empty.enabled | native-procedural | none / not asserted | native-fallback |
| synthetic.native-empty.disabled | native-procedural | none / not asserted | native-fallback |

All real cases use explicit no-base input. Synthetic graph/base identity is defined in fixtures.draft.json. Public options are recorded per case (80px minimum width /20px height for direct controls); the native fallback is a separate interactive API input.

## Review boundaries

- Approve the finite identities and public policy choices independently of current rendering.
- Source archive entry/fork and signed payload identities are pinned in source-candidates.draft.json and source-choices.json.
- Windows95 pressed default requests missing -10230 but paints active -10231 under source dispatch; plain-button reservation must not satisfy this paint expectation.
- Raw-ID-only repurposed art remains unknown even if current rendering returns pixels.
- Missing direct output means no realization; native fallback must be checked as a separate DOM/interaction contract.
- Unknown signed metadata on a named synthetic resource stays null, never replaced by the requested ID.
- Original engine identity for ring dispatch: Kaleidoscope 2.3.1 kDEF 0, SHA256 2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342; source reference docs/spec/kdef231-reference.md at 0x76c4. Original engine is not executed.
- Historical face fallback, whole-control pixels and actual decoder/fork provenance are not certified.
- All other 18-theme family/state/option/base combinations remain unknown.

Frozen draft case digest: 410f07d1c8098aa352d3f2d5aff9b3eeb65ab060369e021e5d46fa8bb962de7a.

## Independent review record

On 2026-10-18 the root reviewer approved the 26 finite API-policy expectations
and one explicit UNKNOWN, conditional on precise evidence and exact manifest-key
assertions. The independent Astra architecture reviewer reproduced the source
inventory and found no outcome or architectural blocker. Its requested
refinements are applied here: author labels establish names rather than original
dispatch intent; every asserted cicn/cinf identity has a presence/hash reference
(including System7 cinf absence); the pressed-ring fallback cites
0x76d2–0x76fe in `SOURCE-EVIDENCE.md`; and every painted resource includes its
exact manifest key. The digest above identifies the refined case inventory.

This records review of expected API outcomes and their limited evidence. The
JSON remains explicitly draft/inactive until the trace dependency lands and the
executable gate is integrated. Source candidates remain unreviewed observations;
approving an API expectation does not turn extraction into independently
verified decoder behavior.
