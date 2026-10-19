# Request-specific reference evidence identity

`request-semantic-v1` replaces document-wide request identity with the exact
semantic dependency set in `tests/reference-captures/contract.mjs`. It changes
no admission predicates, scope outcomes, images or requirement assessments.

The digest contains the authority ID, complete request, complete selected source
record and engine component, exact target requirement definitions, full and
applicable scoped definitions, transitive experiment baseline request objects,
and applicable versioned sections of `eligibility-policy.json`. A changed
source, input, obligation, scope or eligibility rule invalidates prior bindings.
Canonical object-key ordering is unchanged; array order remains significant.

Global document SHA/version, catalog request version, ledger inventory version,
registry-wide schema/review metadata and the full policy-file hash remain in
report provenance. Catalog authority ID/version must still match the authoritative
header; source bytes and authority paths still validate. These metadata values
cannot silently certify a historical environment or change a request's meaning.
All thirteen request objects, broader unresolved targets and original evidence
artifacts remain unchanged.

## Normative policy and transitive changes

The policy contains rules, not just version labels. Common/full rules apply to
all requests; public face/common and its v1/v2 section apply only to supported
scoped requests; pattern-origin/direct-invocation sections apply where required.
The existing executable validator remains the source of admission decisions.
Policy is a reviewed description and digest dependency, not an alternate validator.

Every eligibility change requires reviewing and updating the affected policy
rules/version with its implementation. This includes transitive changes to PNG
validation, filesystem containment/limits, artifact joins, contamination discovery,
source/target selection, scope admission, reviewer checks and report semantics.
Pure refactors need an explicit no-policy-impact review. No source hash mechanism
can automatically decide semantic equivalence: reviewers must not treat a policy
version as sufficient proof or allow changed rules hidden in unrelated prose.
New known contaminated images are checked at assessment time even when request
identity is unchanged; eligibility never bypasses current image/artifact checks.

## One explicit migration

Preserve the complete preceding capture and review files byte-for-byte. A reviewed
migration maps each old/new request digest and consequent capture digest, with
old/new record hashes and full-file hashes. Only `capture.requestDigest` changes
in factual captures; images, conditions, sources, scopes and artifacts remain exact.
Independent reviewers authorize amended review bindings and retain prior reviews
and their historical timestamps/notes. Candidate mappings are not approvals.
The validator accepts only the current semantic digest: there is no legacy-digest
allowlist, silent upgrade, dual acceptance or automatic re-attestation. Existing
metadata-only amendments remain historical records.

The six scoped observations retain zero verified requirement IDs and all five
broader targets unresolved. No request becomes complete and no ledger changes.
