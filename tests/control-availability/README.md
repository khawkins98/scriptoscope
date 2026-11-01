# Finite control availability expectations

This directory implements the bounded #228 inventory: **27 finite API-policy outcomes**. Every unlisted
family/state/size/base combination across the 18 themes remains unknown. Passing
availability is not a whole-control fidelity certificate.

## Source evidence and review

`expectations.json` version 1.0.7 declares exact inputs, painted owner/depth,
manifest key, signed cicn/cinf identities, source references and required policy
decisions. `REVIEW.md` records independent root/Astra review and the original
draft digest. Root independently reviewed the canonical-ID-first migration; prior review
history is retained. `fixtures.json` declares the synthetic graphs and pixels
before any runtime call. Generated `source-candidates.json` remains unreviewed
shared-decoder evidence; approving an API expectation does not certify decoding.

`source-choices.json` explicitly pins archive SHA-256, entry index and decoded
name, and resource-fork SHA-256 for all 18 themes. Standalone `.rsrc` files use
null entry identity. [Input-choice review 1.0.0](../source-inputs/README.md)
independently corroborates these exact choices; generated resource facts and
original lookup semantics remain unverified. Missing/ambiguous entries and any byte/name/index drift fail
closed. There is no largest-fork selector. Apple Platinum includes an unrelated
application with its own cicns; Dolphin includes many text forks. The decoded
1984/Floppies names contain replacement characters: index and hashes pin those
choices without claiming original filename decoding.

The generator queries nine signed IDs for cicn/cinf and retains author names,
presence, payload size/hash and explicitly shared-decoder dimensions. It reads `demo/themes-manifest.json` only as the source-path catalog. It never
imports runtime resolution, a runtime theme manifest, matrix results or a golden oracle.

```sh
# Enumerate entries without selecting a fork.
node tests/control-availability/candidates.mjs --inspect --output /tmp/availability-entries.json

# Extract source facts for all explicitly selected forks; all remain unreviewed.
node tests/control-availability/candidates.mjs --output /tmp/availability-all-candidates.json

# Reproduce the bounded evidence file.
node tests/control-availability/candidates.mjs \
  --slugs windows-95,system7-nostalgia-silver,animals,monkey-paradise \
  --output /tmp/availability-first-candidates.json

npm run test:availability:sources
node --test tests/control-availability/*.test.mjs
```

Candidate `toolchain` pins identify the explicitly listed extraction files only,
including the cicn sampler/display helpers. They are not a complete transitive
dependency fingerprint or independent decoder proof. Regenerating these pins
after additive comparison metadata does not change source facts or reviewed
availability case policy/version/digest.

Source validation reextracts all 18 archives, compares the saved four-theme
candidates, validates every present/absent cicn/cinf reference and payload hash,
fixture graph/hash, and cited document hash/address. It validates review version,
digest and state consistency too. The original engine binary is not distributed
or executed in CI; document validation does not reauthenticate its fingerprint. The two normal-body ppat dependencies are
validated directly against the same selected raw fork and each face cinf request;
the saved cicn/cinf candidate catalog is unchanged.

## Execute against actual runtime decisions

The mandatory browser contracts include `availability.spec.mjs`, independently
running every exact case against source and built entries. No expectation comes
from parity. One completed direct trace must agree with the actual returned
pixels or null, requested state/flags, painted owner/depth/key/IDs and required
selection decisions. Blob URLs are diagnostic details, never identity keys.

```sh
npm run build:themes
npm run build
npx playwright test --config tests/rendering-options/playwright.config.mjs availability.spec.mjs
# Or run the entire mandatory matrix:
npm run test:rendering
```

The raw-ID-only fixture now has an explicit themed API expectation: its exact
negative ID is usable despite its label. This resolves availability only, not
original pixels or providers. All unlisted cases remain unknown; missing
executions are not-run. Plain ring layout reservation cannot satisfy painted-ring
expectations. Equal source/built null cannot pass known-themed expectations.
Null signed metadata stays null instead of being replaced by a canonical request.

The two native fallback cases use actual interactiveButton DOM, accessible-name
observations, Tab navigation, Enter/Space activation and disabled behavior.
For these two empty-art fixtures, the initial compose trace must be unavailable
with no painted selection, and the native button must contain no canvas. This
one-trace assertion is specific to these fixtures, not all interactive APIs.
Direct null means unavailable output with caller-owned fallback; it is never
silently reclassified as a native control or deliberately unsupported API.

The existing CI artifact includes separate reviewed expectation and actual
execution JSON under `test-results/rendering-evidence/<project>/availability*`.
Executions record commit/cleanliness, bundle hash, browser/DPR, exact options and
actual traces. Failed cases additionally attach inputs, traces and raw canvases
through the existing failure-artifact path. Successful observations cannot
promote unlisted/UNKNOWN cases or independently verify pixel fidelity.

## Evidence limits

Animals/Monkey author labels establish names, not authoritative original
selection intent; their menu-labelled cicn and push-labelled same-ID cinf even
differ. Rejection and pressed-face substitution are declared compatibility
policy. The finite Windows95 missing pressed-ring→active fallback is supported
by original 2.3.1 dispatch at 0x76d2–0x76fe; see `SOURCE-EVIDENCE.md`.

Initial traces expose actual owner/IDs/key, not the decoder's selected archive
fork or payload hash. Pinned expected input bytes therefore do not independently
prove actual decoder/fork provenance. Historical face fallback, all-theme
availability, complete pixel fidelity and original-engine execution are outside
this finite inventory. Extend it with separately reviewed exact evidence and
expectations, never by blessing observed matrix statuses.


Inventory 1.0.1 refreshes only the full `kdef231-reference.md` evidence hash in
three ring cases after the cinf body/trap documentation correction. Ring dispatch
at 0x76c4 and the separately pinned detailed ring evidence remain unchanged.
The exact case inputs, source payload pins and expected outcomes are unchanged;
the prior 1.0.0 review is retained in `expectations.json`.

Inventory 1.0.3 refreshes only the same three full-document hashes after reconciling
stale solid-face notes with the delivered pattern/raw-color model and the
bounded raw-background solid-fill correction. The ring
source addresses, all27 exact cases/outcomes and source inputs are unchanged;
the prior review is retained. This documentation update adds no availability or
historical-fidelity claim.

Inventory 1.0.5 refreshes only the same three full-document hashes after correcting
A9A0 to GetResource and documenting conditional cinf fallback. The ring dispatch
claims, detailed source evidence, all 27 case inputs/outcomes and payload pins
remain unchanged. The complete 1.0.4 review history is retained; this adds no
provider-order or pixel-fidelity claim.

Inventory 1.0.9 refreshes only the full `kdef231-reference.md` document hash after
the §6 A-trap table's name column was regenerated from Universal Interfaces 3.0.1
`Traps.h` (`scripts/gen-trap-table.mjs`). All 27 case inputs, outcomes, payload pins
and ring dispatch claims are unchanged. The review label is PENDING until an
independent hash-only review; earlier review history is retained.

Inventory 1.0.10 again refreshes only the full `kdef231-reference.md` document hash
(`e1e94403` -> `3e55c385`), after the `'pWin'` lookup at `0x11768` was corrected
from a resource load to a `$A1AD` _Gestalt query (cinf-loader row `0x116f8`, the cinf
id-range row, the `$A9A0` role and open item 3). No case-cited address line changed.
All 27 case inputs, outcomes, payload pins and ring dispatch claims are unchanged.
The 1.0.9 review is archived verbatim; 1.0.10 carries the independent hash-only
review of PR #388.

Inventory 1.0.11 (v2 lane L2 doc split, PR #386) refreshes only the full
`kdef231-reference.md` document hash (`3e55c385` -> `8b289cf8`) after its assembly,
register and stack narrative moved verbatim to
`docs/spec/engine/kdef231-reference.evidence.md`. The `0x76c4`/`0x76d2` lines name the
ring state bytes instead of register operands; addresses, ids and outcomes, all 27
case inputs, payload pins and detailed source evidence are unchanged. The 1.0.10
review is archived verbatim; the 1.0.11 label is PENDING an independent hash-only
review.

Inventory 1.0.12 (v2 scroll-bar citation correction) refreshes only the full
`kdef231-reference.md` document hash (`8b289cf8` -> `90efe521`) after §1.1, §1.3
and §2.4 were corrected: `0x997e` (slot 1) is the scroll-bar CDEF, `0x8d36`
(slot 5) a separate undecoded CDEF, and the scroll arrows are `ics#`/`ics8`,
never `ics4` or `cicn`. No case-cited address line changed; all 27 case inputs,
outcomes, payload pins and ring dispatch claims are unchanged. The 1.0.11 review
is archived verbatim; 1.0.12 carries the independent hash-only review of PR #390.

Inventory 1.0.13 (scrollbar 1.2.0 citation pass) refreshes only the full
`kdef231-reference.md` document hash (`90efe521` -> `5ca8cee0`) after the §1.1 `0x8d36`
row's aux-field gloss was marked undecoded (it rested on the retired slot-5
scroll-bar attribution). No case-cited address line changed; all 27 case inputs,
outcomes, payload pins and ring dispatch claims are unchanged. The 1.0.12 review
is archived verbatim; 1.0.13 carries the PM Tier 0 check of PR #398.

Inventory 1.0.14 (issue #374 ledger closure) refreshes only the full
`kdef231-reference.md` document hash (`5ca8cee0` -> `40366d19`) after §2.4 was
corrected: -8288/-8280 are the scroll-bar track tier 0 (inactive), not pressed, and
-10205..-10208 are the scroll-bar thumb cicns (the stale `controls.ts:166` pointer is
gone). No case-cited address line changed; all 27 case inputs, outcomes, payload pins
and ring dispatch claims are unchanged. The 1.0.13 review is archived verbatim; the
1.0.14 label is PENDING an independent hash-only review.

Inventory 1.0.18 (#608) moves the nine `push-no-cinf-admission` cases (three
System7 push states and six synthetic fixtures) from `themed` to `unavailable`.
`docs/spec/engine/push-button.md` PF3/PF6 supersede the 2026-10-23 themed-extent
disposition: known art whose exact cinf and cinf0 are both proven NULL keeps its
admission identity and NULL transcript, but the public facade returns `null` with
outcome `unavailable` and a terminal face step `engine:PB9:cinf:NULL`. Each row
changes only `proposed.outcome`, a new `proposed.terminal` and its notes; the rule
keeps its id with an amended claim. `corrections/608-no-cinf-unavailable.json`
archives the exact before/after rows, the prior review, the pinned PF section and
the single `border-boundaries.spec.mjs` patch; `controls459/peel-608.mjs` lets the
earlier correction proofs verify their own frozen state. The 1.0.18 transition carries
the independent Tier-2 review receipt of PR #612; the test author did not self-approve.

Inventory 1.0.19 (#611) refreshes only the full `kdef231-reference.md` document hash
(`ce33a576` -> `bf390065`) in its nine pinned cases, after the §1.4 dispatch labels were
corrected per `docs/spec/engine/hit-regions.evidence.md` E1 (#610): slot 6 `0x28e0`
dispatches the standard WDEF messages 0..8 plus 1000/1001 through the `0x148` switch
table at `0x292e`, not verbs 1001..1009, and the slot-3/4/8 gates pass the message
unchanged and rewrite only the varCode (the gate column was "msg base into slot 6"),
and slot 8 falls back on a miss to its private dispatch (`0x174c8`), not a system `'WDEF'`. No case-cited address line changed; all 27
case inputs, outcomes, payload pins and ring dispatch claims are unchanged.
`corrections/611-reference-labels.json` archives the seven exact label edits, the
prior review and the 1.0.18 file hash; `controls459/peel-611.mjs` peels the bump back
off so the 1.0.18 and earlier correction proofs keep verifying their own frozen state.
The 1.0.18 review is archived verbatim; the 1.0.19 transition carries the independent
Tier-1 review receipt of PR #615; the test author did not self-approve.

Inventory 1.0.20 (PR #540, merged after #608/#611) refreshes only the nine
`docs/spec/kdef231-reference.md` document hashes (`bf390065` -> `9c73533a`)
after its title-colour note was updated to the implemented TC1–TC5 sample. The
#611 dispatch-label corrections and #608 no-cinf unavailable outcomes remain
unchanged. All 27 case inputs, policy rules, payload pins and case-cited addresses
are preserved, and the complete 1.0.19 review is archived verbatim.
`controls459/hash-only-bumps.mjs` peels this exact prose edit and inventory bump
before the unchanged 611/608 helpers verify their historical receipts. The new
transition carries the independent Tier 0 hash-only approval of `/root/astra_bonn`
(2026-11-01), including six passing frozen proofs and in-memory mutation probes;
it promotes no availability, native or pixel-fidelity claim.
