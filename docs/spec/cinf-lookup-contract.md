# Conditional cinf lookup contract

This test-only model describes one original call sequence, not the modern
loader or a reconstructed historical Resource Manager environment. It supplies
no production defaults, new public API, ledger evidence or reference admission.

## Source sequence

Pinned kDEF0 SHA256:
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.

1. `10860/10862` restores caller CurResFile before requesting cinf. Image and
   cinf therefore need not share a provider.
2. `1086e–10878` calls `116f8(requestedID,false)`. Its `11722` trap is `$A9A0`
   **GetResource**, not `$A81F` **Get1Resource**.
3. Only a NULL return advances to `10880–10898`: cinf 0 with body=true
   (push/bevel wrapper `10fc0`), cinf 1 with body=false (ring wrapper).
4. A second NULL branches `1089a → 10fa8`, skipping this body/border stage.
   Nonnull admits metadata/painter execution; it does not establish any painted
   pixel, successful decode, visible contribution or whole-control output.

If requestedID already equals 0 or 1, the source still makes two calls after the
first NULL. The model preserves them. A transcript may record different results
between calls; a static complete environment normally returns the same result.

The three wnd# gates likewise use GetResource: `118ee`, `15296`, `17472`
inside entrypoints `118b8`, `1525a`, `17452`, requesting −14336/−14304/−12320.
The corrected trap name does not by itself establish any provider order.

## Executable conditional fixture

`tests/rendering-options/cinf-lookup-contract.mjs` accepts exactly one of:

- An explicitly ordered **caller-declared** environment, with provider IDs,
  per-provider completeness, cinf occurrence/hash records and a completeness
  declaration for the provider list. These declarations are assumptions, not
  evidence that the historical process used this ordering. Duplicate matches
  within one provider remain ambiguous. An incomplete provider stops lookup
  even if it lists a match; an exhausted incomplete list remains unknown.
- An exact caller-declared lookup transcript: ID and found/missing/unknown/
  ambiguous result per call. Found requires provider, occurrence and payload
  hash. Missing means an explicitly observed/declared NULL helper result, never
  an omitted record. Unknown/ambiguous stops fallback. Extra or wrong-ID calls
  are rejected. A found identity's hash syntax is checked, not authenticated.

The environment model assumes valid returned handles for listed synthetic
resources; it does not simulate load failures, handle mutation or Resource
Manager side effects. The transcript boundary can describe those lookup
results without inventing a search algorithm. No original resource bytes are
included: fixture hashes identify owned synthetic identity strings.

Run `node --test tests/rendering-options/cinf-lookup-contract.test.mjs`.
The existing npm test registration includes these six focused groups: same-ID
success, body/ring defaults, double miss and coincident requests, unknown and
duplicate evidence, explicit provider-order sensitivity, and invalid transcripts.

## Bounded installed-component facts

A previously examined installed component fork has SHA256
`cb903bef4410feb096d65b5a4c9383fa2a3c943e6afef6d3c13463b48267d333`.
Its static 18-byte cinf candidates decode as follows (all points are **x,y**):

| ID | Corner/side/repeat | Mode/body ID | Background | Text | Emboss | Payload SHA256 |
|---|---|---|---|---|---|---|
| 0 | 6/6/0 | 0/0 | 6,6 | 8,8 | 9,7 | `53fb901d6aefeffba2cf20f40bd96d06101856eef3e43d0317a570ac5bbded83` |
| 1 | 8/4/0 | 0/0 | 0,0 | 0,0 | 0,0 | `964e47db35f597c9abb8f0a379fbdf3197fc8502a1dcc9393683fa2ebda7f141` |

These are static candidate metadata, not the observed GetResource provider in
any capture. No serialized component/resource/media bytes ship with this note.
They are not automatically inserted into manifests or the fixture environment.

## Current corpus gap

The retained #333 source/built CI observations and complete occurrence inventory
identify 87 missing-cinf tuples, each selecting distinct 16×16 art:

| Sources | Push tuples | Bevel tuples |
|---|---:|---:|
| 1138, 1984 | 0 | 24 |
| apple-platinum-2, black-platinum, platinum-8, system7-nostalgia-silver | 12 | 48 |
| slimes | 3 | 0 |

All 87 have **no same-signed-ID cinf occurrence in the selected fork**; none is
a failed, short, skipped or duplicate pairing. This does not establish original
lookup failure, default owner or visible mismatch. The modern builder uses the
last successful same-owner pairing, then null slice/body request if absent.
Current controls use inset6 for this 16×16 art and legacy rectangular stretching
with conditional raster(6,6) center fill; the original fallback algorithm is a
separate fact. Existing scoped System7 output equality remains valid.

A future cross-owner loading seam must represent independently selected cinf
ownership and complete/unknown lookup evidence before applying any default.
This contract intentionally does not design that production API. Historical
provider/cache/base order and all broader rendering requirements remain OPEN.
