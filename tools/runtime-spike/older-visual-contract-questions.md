# Listing-free clarification for the older optional visual failures

This public handoff records normal assertion diagnostics and runtime-only probes.
It is not a reproducer or a replacement acceptance oracle. The implementer has
not inspected independent test sources, fixtures, expected images or verifier
review material. No expected behavior has been changed.

The final integration rerun has 33 passes and the same eight failing case labels
at runtime revision `6cfe9afd`, integrated with evidence refresh at `c157454c`.
`optional-visual-results.json` records the serialized unchanged command and outcome.
The runtime-only probe observations below come from the earlier diagnostic stage. Current eager/owned equivalence and passing
required browser/golden checks cannot establish whether these failures predate
the migration. An attempted frozen compiled-entry replay stopped at fixture
readiness before assertions; it supplies no historical failure evidence.

## Public handoff requested from the spec/test author

For each case, provide a minimal public API invocation or HTML/JSON input that
reaches the assertion, plus the listing-free expected contract and applicable
public spec section. Include theme/base selection, public loader, selected raw
resource occurrence identities, prepared input changes, geometry, state, scale,
clip/pattern origin and browser/font/CSS preconditions as relevant. Identify
whether the expectation is renderer output, input selection, diagnostic metadata,
consumer-page behavior or a declared CSS contract. Do not hand over independent
test source, oracle data, private capture material or verifier reviews.

| Observed case | Permitted diagnostic/probe observation | Clarification needed |
| --- | --- | --- |
| Inherited face metadata | Request cicn −10239/raw index238; supplied decoded occurrence identifies −10240/index239. Runtime-only probe sees Windows95 root owner at depth0. Fresh eager/owned loads preserve matching identities for both entries. | Public preparation/mutation sequence and intended resolution when the request identity and decoded occurrence disagree. |
| Apple Platinum 2 ring corners | Normal assertion reports actual60 / expected0. | Complete public geometry/state and the corner-coverage contract. |
| Ring overlay | Normal failure attempts getPixel on null. | Public resource/base inputs and whether a missing face, fallback or painted overlay is required. |
| Ring label ink | Normal assertion reports actual8 / expected0. | Public label, font, state, clipping inputs and ink-count contract. |
| Overlapping ring bands | Normal assertion reports actual RGBA [6,2,100,255] / expected [13,2,100,255]. | Public band/source geometry, alpha/transfer conditions and painter-order contract. |
| Windows95 label ink | Normal assertion reports actual34 / expected61. | Public label/font/render inputs and the ink-count contract. |
| Showcase copy button | Normal locator timeout. | Public page URL/state, intended control identity and expected interaction sequence. |
| Window shell shadow | Normal assertion reports no shadow where an rgba shadow is expected. | Public shell/options/CSS inputs and whether shadow is required by the runtime or consumer stylesheet. |

The assertion numbers above are diagnostic observations, not values to insert
into runtime code. Several cases lack sufficient inputs to reproduce. Do not
infer a renderer correction or rebless expectations from these observations.

Local and Forgejo maintainer-asset metadata, archive indexes and available handoff
searches did not identify this public contract. That search is not proof that no
handoff exists. The separately authorized extraction-provenance/binding verifier
assignment excludes these visual cases; its completed refresh does not resolve
them or grant the implementer access to their independent sources.

## Independent contract triage (2026-10-26)

A separately assigned independent verifier inspected these cases in an isolated
worktree at `7e5029c6`. Only ordinary results and listing-free contract
classifications returned. No expectations, goldens or runtime files changed.
The focused command reproduced eight failures (six passes); this is a subset of
the serialized 41-case run above, not a new full-suite total.

| Case | Applicable current public contract and setup conflict |
| --- | --- |
| Inherited face metadata | The fixture relabels inactive art as active while retaining contradictory raw occurrence identity and assumes cross-state fallback. Push PB5–PB9 and the migrated-family interpretation in `docs/spec/control-resolution-diagnostics.md` exclude that fallback. |
| Apple Platinum 2 ring corners | Standalone input lacks required ring cinf/default metadata. Art presence alone does not admit border paint (push DR5–DR6 and §6). |
| Ring overlay | Pressed output requires the pressed face, which the synthetic input omits. Ring art cannot supply the missing face (PB6/PB8). |
| Ring label ink | The expectation assumes height-derived font size and raster-box placement. Push §5 and the prepared-bitmap-font compatibility default use explicit/default 12px size and actual metrics. Supplementary public probes found no existing foreground ink erased by enabling default for 1138 and Windows95. |
| Overlapping ring bands | The fixture edits derived slice geometry while retaining raw engine cinf, which remains authoritative (PB9/DR5, raw-cinf compatibility policy and QD E1–E4). |
| Windows95 label ink | The contract centers text advance and computes a metric-derived baseline; it does not promise rasterizeText box placement (push §5). |
| Showcase copy button | The control is absent from the current showcase. The showcase links to the installation guide; installation copying belongs to install.html. |
| Window shell shadow | The CSS property `--scriptoscope-window-shadow` defaults to none. A public probe confirmed the requested shadow when explicitly enabled. |

The verifier recommends merging after final mandatory checks pass, with faithful
optional coverage restored separately in [issue #481](https://github.com/khawkins98/scriptoscope/issues/481).
These findings resolve the outstanding contract questions; they neither turn the
suite green nor establish that failures historically predate this PR. No inspected
case demonstrated a violation of the current public contracts. The follow-up
tracks consistent resource fixtures, consumed cinf geometry, metadata-conditioned
corners, metric-based labels and current consumer/CSS setup.
