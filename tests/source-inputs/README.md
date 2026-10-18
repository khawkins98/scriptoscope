# Reviewed explicit source inputs

Review **1.0.0** approves the 18 exact contract inputs in
[`source-choices.json`](../control-availability/source-choices.json). It does not
approve original Resource Manager lookup behavior, control roles, availability,
complete decoder correctness or historical pixels. The overall fidelity target
remains OPEN.

For 13 StuffIt archives, independently installed **lsar/unar 1.10.7** enumerated
181 entries and extracted all 121 resource forks. Each archive has exactly one
`Colr`/`Acid` scheme fork; its independently extracted bytes match the explicitly
pinned fork. Scheme title/version resources and bundled author readmes corroborate
the intended supplied scheme. No choice uses a largest-fork rule. Five standalone
resource forks have no archive-entry choice: their supplied bytes and content
are reviewed, while earlier wrapping/extraction history remains unknown.

`review.json` records the root and independent architecture reviews, exact
per-choice content/readme references, rationale, unknowns and digest seals.
`evidence.json` retains complete normalized listings, tool binary hashes, every
extracted resource-fork hash and selected content observations. These observations
remain labeled **unreviewed**; the separate human decisions approve only the
finite input choices. No extracted executable or original engine is added or run.

## Reproduce and validate

```sh
# Requires separately installed lsar and unar; never changes approval.
python3 tests/source-inputs/capture.py --output /tmp/source-input-candidate.json
# On the recorded tool versions/binaries, the result matches evidence.json.
cmp /tmp/source-input-candidate.json tests/source-inputs/evidence.json

# Portable CI validation does not require lsar/unar installed.
npm run test:source-inputs
node --test tests/source-inputs/*.test.mjs
```

Capture reads the fixed registry and hashes the actual archive bytes. It retains
lsar's index namespace separately from munbox's registry index; neither index
can substitute for the other. Its independent resource-map reader observes
bounded identity strings and payload hashes, without importing project decoders.
A different tool build can produce a different binary hash; that is a new review
candidate, not permission to overwrite the approved evidence.

CI validates every source against the saved independent extraction inventory,
then joins actual selected bytes, identity payloads/strings and readme payloads.
It verifies registry, listing, decision, capture-script and evidence digests.
Negative tests deliberately reseal altered data to exercise the actual byte joins,
including wrong indexes, missing forks, invented strings and forged readmes.
Current validation also uses the project's archive/resource parsers: agreement
with the saved independent evidence supports these exact inputs, not arbitrary
future decoder behavior. Changing choices or evidence requires renewed review
and a review-version/digest update; capture and validation cannot grant approval.

## Precise boundaries

- The 1984 and Floppies munbox paths contain replacement characters where lsar's
  MacRoman interpretation displays `ƒ`. Existing names/indexes remain unchanged;
  byte hashes disambiguate the reviewed input without certifying filename decoding.
- Apple Platinum 2 has a uniquely named supplied scheme and version/author
  resources, but no separate bundled title/readme used by this review. A catalog
  slug is not proof of the original display-version string.
- Raw sources (1138, 1990, Black Platinum, Evolution and System 7 Nostalgia Silver)
  retain explicit unknown prior extraction/wrapping history.
- Source candidate facts remain unreviewed and availability remains unknown
  unless covered by the separate finite availability inventory. Its 26 outcomes
  and one UNKNOWN, policy/version/digest and resource payload pins are unchanged.
- Opt-in runtime provenance from #251 separately joins the bytes actually loaded
  and consumed to manifest resources and actual selections. Candidate generation
  alone does not observe that load; neither mechanism proves all decoding.
- The compatibility authority version and reference-request catalog advance
  together. Their request digests include the registry review state, invalidating
  older capture bindings rather than silently inheriting approvals. The reference
  corpus currently contains no reviewed captures.
