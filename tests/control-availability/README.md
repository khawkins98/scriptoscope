# Finite control availability expectations

This directory implements the bounded #228 inventory: **26 independently
reviewed API-policy outcomes and one explicit UNKNOWN**. Every unlisted
family/state/size/base combination across the 18 themes remains unknown. Passing
availability is not a whole-control fidelity certificate.

## Source evidence and review

`expectations.json` version 1.0.0 declares exact inputs, painted owner/depth,
manifest key, signed cicn/cinf identities, source references and required policy
decisions. `REVIEW.md` records independent root/Astra review and the original
draft digest. Activation changes review state only; the reviewed inputs and
outcomes are unchanged. `fixtures.json` declares the synthetic graphs and pixels
before any runtime call. Generated `source-candidates.json` remains unreviewed
shared-decoder evidence; approving an API expectation does not certify decoding.

`source-choices.json` explicitly pins archive SHA-256, entry index and decoded
name, and resource-fork SHA-256 for all 18 themes. Standalone `.rsrc` files use
null entry identity. Missing/ambiguous entries and any byte/name/index drift fail
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

Source validation reextracts all 18 archives, compares the saved four-theme
candidates, validates every present/absent cicn/cinf reference and payload hash,
fixture graph/hash, and cited document hash/address. It validates review version,
digest and state consistency too. The original engine binary is not distributed
or executed in CI; document validation does not reauthenticate its fingerprint.

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

The raw-ID-only repurposed fixture executes for observation but remains UNKNOWN
and is excluded from the 26 successful-availability count. Missing executions
are not-run. Plain ring layout reservation cannot satisfy painted-ring
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
