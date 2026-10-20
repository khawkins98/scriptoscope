# Finite CIcon transfer preparation

`prepareCicnTransferResults(data)` prepares a separate version-1, content-addressed
finite result set. `loadTheme` and `loadKaleidoscopeScheme` accept
`cicnTransfer: { results, contractId: results.contractId, maskPolicy: 'source-mask-alpha' }`
alongside a prepared display profile. Existing display-profile versions 1 and 2,
default decoding, source RGB16 queries and direct RGB8 preparation are unchanged.

The explicit option authorizes the result set's recorded preparation contexts.
It does **not** assert that a later compositor call executes CopyBits, has that
native device/port, or uses the original resource provider. Content hashes bind
caller-declared data; they do not authenticate its historical provenance.

Each record binds exact resource payload SHA-256/length and a normalized indexed
representation to one observed destination-index plane. The representation is
canonical JSON (sorted object keys, array order retained) containing version 1,
`pmap`, `mask`, `bmap`, `colorTable`, expanded `indices`, and expanded `maskAlpha`
from the bounded CIcon parser. Full payload identity also retains monochrome
bytes, pointer fields, padding and trailing source bytes. Source owners/IDs are
not color lookup keys: the actual loaded fork hash, signed resource ID and
occurrence are attached separately to the resulting chrome element.

The closed operation contract is GetCIcon followed by unmasked CopyBits,
`srcCopy`, black foreground and white background. It retains source/destination,
clip and port rectangles (left, top, right, bottom), local-zero global position,
and evidence hashes for prepared-layout/device/engine observations. Admission
requires a complete one-to-one origin-zero indexed plane, matching mask bounds,
and destination fully contained by the recorded clip and port. There is no
scaling, partial-plane inference, missing-rank algorithm or foreground/mask
operation generalization. Fresh handles do not establish cold caches.

Destination indices resolve directly through the recorded device palette and
producer table **once**. They never become inferred source RGB16 and never pass
through Color2Index mappings. The selected display profile must have identical
palette and producer tables. Its other source RGB16 mappings remain necessary:
whole-load missing mappings still reject. This compares measured preparation
bindings, not unobserved equality of every historical port/cache/patch condition.

Modern raster preparation applies the source mask as alpha separately, retaining
RGB beneath zero alpha in the raw asset. This is not a CopyMask observation.
kDEF scalar samples, sampled-band companions and mode5 retain their own raw
source semantics and admission rules. The opaque sampler comparison checks each
coordinate of an observed plane: repeated source indices need not imply repeated
destination colors. An unsafe source sampler remains unknown.

Preparation snapshots plain JSON before hashing; loaders snapshot byte inputs
and authorization before awaits. Forged objects, context/profile disagreement,
representation drift, ambiguous asset paths, and no exact source match reject
before any asset URL allocation. A shared set may contain unused records, but at
least one record must match the loaded fork. Unlisted resources keep strict
ordinary profile decoding. Per-element `cicnTransfer` is immutable preparation
provenance, distinct from completed-paint diagnostics.

Owned literal unit, source/built public-loader and installed-package fixtures
exercise spatially distinct destination colors, transparent RGB, one producer
pass, input mutation, forged results and fail-before-URL rejection. Original
CRP evidence separately supports two finite payload planes (35 + 144 pixels),
not an unseen-resource rule. CIP masked/foreground/order variants remain separate.
Current same-run query coverage does not cover the three complete original
archives; their missing RGB16 mappings remain explicit blockers. No captures,
reference scopes, fidelity ledger assertions or goldens are promoted here.
