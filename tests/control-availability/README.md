# Availability inventory — phase 1 draft

This directory contains source-only candidates and a finite proposed expectation
inventory for #228. **Nothing here is an approved availability gate yet.** The
runtime trace API from #226 must land, and the expectation data must receive
independent review before assertions are activated. All generated candidates are
unreviewed; every unlisted family/state/size/base combination remains unknown.

## Reproduce source candidates

```sh
# Enumerate every resource fork without choosing one.
node tests/control-availability/candidates.mjs --inspect --output /tmp/availability-entries.json

# Use explicit, pinned choices; no renderer or runtime manifest is imported.
node tests/control-availability/candidates.mjs --output /tmp/availability-all-candidates.json

# Reproduce the bounded source evidence proposed for first review.
node tests/control-availability/candidates.mjs \
  --slugs windows-95,system7-nostalgia-silver,animals,monkey-paradise \
  --output /tmp/availability-first-candidates.json

node --test tests/control-availability/source.test.mjs
```

`source-choices.json` explicitly pins source archive bytes, archive entry index
and decoded name, and resource-fork bytes for all 18 archives. Standalone `.rsrc`
inputs explicitly use null entry identity. Ambiguous/missing choices and hash,
index or name drift fail closed. There is no largest-fork selector. In particular,
Apple Platinum ships an application with its own cicns, Dolphin has many text
forks, and 1984/Floppies entry names contain decoder replacement characters.
Those replacement-character choices remain identified limitations, pinned by
index and byte hashes rather than claimed original filename decoding.

The generator queries nine signed IDs for `cicn` and `cinf`, preserving raw author
names, presence in the selected fork, byte sizes and payload hashes. Decoded
cicn dimensions are explicitly shared-decoder observations. It cannot assign a
semantic role or expected renderer outcome. Its only imports are source archive,
resource-fork and cicn decoders plus Node I/O/hash modules. It never calls runtime
resolution, rendering, a matrix, or a golden comparator.

## Proposed finite expectations

`expectations.draft.json` has 27 exact cases: 14 archived-theme cases and 13
synthetic cases. Twenty-six have proposed API outcomes; the repurposed-only
raw-ID escape remains unknown/policy-pending. Every record is still marked
`draft-requires-independent-review`, with effective availability unknown.
`REVIEW.md` presents the finite list for review. `fixtures.draft.json` declares
synthetic source graphs and opaque art before any renderer is invoked.

Source evidence and public API policy are separate. Author labels prove the
Animals/Monkey -10239 resource is named `Solo Menu Background`; interpreting
that label and substituting the pressed face is a compatibility policy. The
Windows95 archive lacks -10230 and contains -10231/-10232; the reviewed 2.3.1
ring dispatch establishes pressed-ring→active fallback. A plain button's ring
layout reservation is never counted as ring paint.

Known direct missing-art outcomes are `unavailable` with no realization and
caller-owned fallback. They are not labelled deliberately unsupported controls
or automatically native. Separate enabled and disabled interactiveButton cases propose a native
button with accessible name, keyboard activation and disabled semantics, without
inventing a canvas or historical Platinum fidelity.

## Limits and next phase

The raw inventory shares the project's archive/resource decoders. The #226 trace
observes actual owner, signed IDs and manifest key, but does not independently
establish the actual fork/payload decoded. Pinning source bytes does not close
that decoder-provenance gap. Pixel fidelity and complete historical selection
remain outside this availability inventory.

After independent review, execute source and built separately against approved
expectations. A shared null result or wrong owner must fail even if parity agrees.
Use actual per-render traces at the existing resolver points; do not duplicate
resolution in the harness. Preserve expected data and observed outcomes in
separate successful artifacts, and attach exact inputs/traces on failure. Unknown
expectations must stay explicit and never count as verified availability.

Validate every declared source reference and pinned byte identity before running
any future availability gate:

```sh
node tests/control-availability/validate-source.mjs
node --test tests/control-availability/*.test.mjs
```

This reextracts all 18 explicitly chosen sources, compares the four saved source
candidates, validates present/absent cicn/cinf references and payload hashes,
checks fixture graphs and digests, and checks cited document hashes/addresses.
The original engine binary is not available to CI: its declared fingerprint and
reviewed source interpretation are distinct from document-byte validation.
Neither this validation nor an unreviewed candidate activates an API outcome.
