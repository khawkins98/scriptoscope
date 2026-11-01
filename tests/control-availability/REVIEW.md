# #228 finite expectation review

**Version 1.0.7 canonical-ID migration and two normal-body ppat dependencies independently reviewed by root. Prior reviews below remain historical records.**

27 exact cases: 27 reviewed API-policy outcomes. The outcomes below are source/policy expectations, never generated from renderer or matrix outcomes.

| Case | Proposed outcome | Painted owner / signed resource / exact key | Policy / source boundary |
| --- | --- | --- | --- |
| windows-95.push.normal | themed | face: theme.windows-95@0 / -10239 / `cicn--10239` | canonical-push-states, plain-ring-reservation |
| windows-95.push.pressed | themed | face: theme.windows-95@0 / -10238 / `cicn--10238` | canonical-push-states, plain-ring-reservation |
| windows-95.push.disabled | themed | face: theme.windows-95@0 / -10240 / `cicn--10240` | canonical-push-states, plain-ring-reservation |
| system7-nostalgia-silver.push.normal | themed | face: theme.system7-nostalgia-silver@0 / -10239 / `active-push-button` | canonical-push-states, plain-ring-reservation |
| system7-nostalgia-silver.push.pressed | themed | face: theme.system7-nostalgia-silver@0 / -10238 / `pressed-push-button` | canonical-push-states, plain-ring-reservation |
| system7-nostalgia-silver.push.disabled | themed | face: theme.system7-nostalgia-silver@0 / -10240 / `inactive-push-button` | canonical-push-states, plain-ring-reservation |
| animals.push.normal | themed | face: theme.animals@0 / -10239 / `solo-menu-background-2`; body ppat -12239 / `ppat--12239` | canonical-first; source numeric dispatch; API-only |
| monkey-paradise.push.normal | themed | face: theme.monkey-paradise@0 / -10239 / `solo-menu-background-2`; body ppat 128 / `ppat-128` | canonical-first; source numeric dispatch; API-only |
| windows-95.default.normal | themed | face: theme.windows-95@0 / -10239 / `cicn--10239`; default-ring: theme.windows-95@0 / -10231 / `cicn--10231` | canonical-push-states |
| windows-95.default.pressed | themed | face: theme.windows-95@0 / -10238 / `cicn--10238`; default-ring: theme.windows-95@0 / -10231 / `cicn--10231` | canonical-push-states |
| windows-95.default.disabled | themed | face: theme.windows-95@0 / -10240 / `cicn--10240`; default-ring: theme.windows-95@0 / -10232 / `cicn--10232` | canonical-push-states |
| windows-95.bevel.normal | themed | face: theme.windows-95@0 / -10166 / `cicn--10166` | canonical-bevel-states |
| windows-95.bevel.pressed | themed | face: theme.windows-95@0 / -10165 / `cicn--10165` | canonical-bevel-states |
| windows-95.bevel.disabled | themed | face: theme.windows-95@0 / -10167 / `cicn--10167` | canonical-bevel-states |
| synthetic.child-canonical | themed | face: child@0 / -10239 / `cicn--10239` | self-first |
| synthetic.child-missing | themed | face: base@1 / -10239 / `push-button-active` | self-first |
| synthetic.child-repurposed | themed | face: child@0 / -10239 / `cicn--10239` | canonical-first; source numeric dispatch; API-only |
| synthetic.named-preference | themed | face: child@0 / -10239 / `cicn--10239` | canonical-first; source numeric dispatch; API-only |
| synthetic.named-unknown-id | themed | face: child@0 / unknown ID / `push-button-active` | named-preference |
| synthetic.active-to-pressed | themed | face: child@0 / -10239 / `cicn--10239` | canonical-first; source numeric dispatch; API-only |
| synthetic.inactive-to-active | themed | face: child@0 / -10239 / `cicn--10239` | face-state-substitution |
| synthetic.empty-chain | unavailable | none / not asserted | direct-missing |
| synthetic.empty-cycle | unavailable | none / not asserted | direct-missing |
| synthetic.bevel-child-base | themed | face: child@0 / -10166 / `cicn--10166` | bevel-self-first |
| synthetic.raw-repurposed-only | themed | face: child@0 / -10239 / `cicn--10239` | canonical-first; source numeric dispatch; API-only |
| synthetic.native-empty.enabled | native-procedural | none / not asserted | native-fallback |
| synthetic.native-empty.disabled | native-procedural | none / not asserted | native-fallback |

All real cases use explicit no-base input. Synthetic graph/base identity is defined in fixtures.json. Public options are recorded per case (80px minimum width /20px height for direct controls); the native fallback is a separate interactive API input.

## Review boundaries

- Approve the finite identities and public policy choices independently of current rendering.
- Source archive entry/fork and signed payload identities are pinned in source-candidates.json and source-choices.json.
- Windows95 pressed default requests missing -10230 but paints active -10231 under source dispatch; plain-button reservation must not satisfy this paint expectation.
- Exact negative face IDs are retained despite author labels; missing-ID compatibility remains separate.
- Missing direct output means no realization; native fallback must be checked as a separate DOM/interaction contract.
- Unknown signed metadata on a named synthetic resource stays null, never replaced by the requested ID.
- Original engine identity for ring dispatch: Kaleidoscope 2.3.1 kDEF 0, SHA256 2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342; source reference docs/spec/kdef231-reference.md at 0x76c4. Original engine is not executed.
- Historical face fallback, whole-control pixels and actual decoder/fork provenance are not certified.
- All other 18-theme family/state/option/base combinations remain unknown.

Reviewed pre-activation draft case digest: 410f07d1c8098aa352d3f2d5aff9b3eeb65ab060369e021e5d46fa8bb962de7a.

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
source candidates remain unreviewed shared-decoder observations; approving an API
expectation does not turn extraction into independently verified decoding.

On activation after #239 merged, inventory version 1.0.0 changed only case
reviewStatus and effectiveAvailability. Active case digest:
`3d4c2b6908157c510f8b5731b8bb0159260c5fa44156e0f3c057aa42430e0d97`.
The original refined draft digest is retained in `expectations.json` review data.
The raw-only repurposed case remains UNKNOWN and never counts as passed.

The executable gate was independently reviewed by root and Astra after
activation. Their refinements validate input/fixture/base consistency and require
the two native fallback cases to have an unavailable initial compose trace, no
painted selection and no canvas in addition to real keyboard/name semantics.
Astra independently ran all 22 source/reference/comparison tests and approved
the gate pending the full browser/CI checks. These strengthen validation without
changing any of the 27 reviewed inputs or proposed outcomes.


## Evidence-only revision 1.0.1

The full reference-document pin changes for the three Windows95 ring cases
because the body-fill section and directly implicated trap names were corrected.
The ring dispatch paragraph, address 0x76c4, detailed source evidence and all
API-policy expectations are unchanged. The previous 1.0.0 review is preserved in
`expectations.json`; this revision does not widen the approved case set or mark
any additional historical behavior verified.

## Canonical-ID revision 1.0.7

Six cases change selection/availability under the separately pinned numeric
dispatch at 0x758e; all original fixture bytes and public options remain exact.
Animals/Monkey normal, synthetic child-repurposed, named-preference and
active-to-pressed now select canonical -10239. Historical synthetic IDs are
retained. Raw-repurposed-only changes UNKNOWN→themed API availability; it
does not gain an original pixel/provider or ledger assessment. Three ring
detail-document hashes change mechanically; their dispatch claims are exact.
Missing canonical art still uses existing named/positive/state/base policies,
covered by the trace regressions. Root independently checked the numeric dispatch and exact six changed cases
on 2026-10-19, including all inputs/fixture bytes and the three mechanical hashes.
Approved digest: `a24bfb8cd11af200467a6efd8880eca4420edc3964e1ed6cdae239c1e69ac523`.
The full previous review object is retained in expectations.json.

The first focused availability run exposed omitted body dependencies in the two
real normal expectations. Their raw cinf mode2 requests ppat -12239 (Animals)
and128 (Monkey Paradise); both exact payloads and owners are now pinned. The
validator checks raw fork bytes and the cinf request, without treating a ppat
as a cicn/cinf pair or dropping the extra trace. Revised candidate digest:
`fde472f13748fbe83e53b04a6777dadaa843dc1e7ae8883fdceed59f1f8eab12`.
Root independently selected both raw forks and checked exact cinf mode2, ppat
IDs/payloads and the unchanged remainder on 2026-10-19; this dependency delta
is approved.

## #608 revision 1.0.18 (independently reviewed, PR #612)

The nine `push-no-cinf-admission` rows (System7 push normal/pressed/disabled and
synthetic child-canonical, child-missing, child-repurposed, named-preference,
active-to-pressed, raw-repurposed-only) change `themed` -> `unavailable` under
`docs/spec/engine/push-button.md` PF3/PF6. The table above is the historical 1.0.7
record; for these rows the face identity is now admission only, with exact cinf and
cinf0 NULL and a terminal `engine:PB9:cinf:NULL` face step. Inputs, options,
identities, evidence and the other 18 rows are unchanged. The exact delta is
`corrections/608-no-cinf-unavailable.json`. The independent Tier-2 reviewer of PR #612
approved the transition on head 3afad856 and its receipt is the 1.0.18 reviewer
entry in `expectations.json`.

## #611 revision 1.0.19 (independently reviewed, PR #615)

Hash-only. The nine `kdef231-reference.md` `documentSha256` pins (Animals/Monkey push
normal, the three Windows95 default cases and synthetic child-repurposed,
named-preference, active-to-pressed, raw-repurposed-only) move `ce33a576` -> `bf390065`
after the §1.4 dispatch labels were corrected per `docs/spec/engine/hit-regions.evidence.md`
E1 in seven edits: the gate intro's slot-8 miss path, the gate column "msg base into
slot 6", the slot-3/4/8 gate cells, the slot-6 paragraph and the `0x28e0` row. The 0x758e and 0x76c4 lines these cases cite are byte-identical.
Inputs, outcomes, identities, evidence and the other 18 rows are unchanged. The exact
delta is `corrections/611-reference-labels.json`. The independent Tier-1 reviewer of PR #615
approved the transition on head 2695a6f4 and its receipt is the 1.0.19 reviewer entry in
`expectations.json`; the test author did not self-approve.
