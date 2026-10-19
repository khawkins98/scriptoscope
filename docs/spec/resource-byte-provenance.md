# Actual loaded resource-byte provenance

`loadTheme(url, { provenance: true })` and
`loadKaleidoscopeScheme(input, { provenance: true })` opt into immutable
`LoadedTheme.byteProvenance`. The default path performs no hashing and adds no
byte-evidence fields. This is a direct-load option; the declarative resolver does
not request it, upgrade cached themes, or fabricate evidence for borrowed bases.
There is no global sink, callback, retained input buffer, or persistent load log.
Consumers own the returned scalar record and any export of it.

```ts
const theme = await loadTheme('/themes/windows-95', { provenance: true });
try {
  await composeButton(theme, {
    label: 'OK', default: true,
    diagnostics: { onComplete(trace) {
      // Each resource.byteProvenance joins to its owning theme's evidence.
      console.log({ load: theme.byteProvenance, trace });
    } },
  });
} finally { theme.dispose?.(); }
```

## Data flow and identity

The loader snapshots caller-owned byte inputs synchronously before its first
await. The same private bytes feed SHA-256 and the existing container path.
StuffIt selection records the entry index/name, numeric file type/creator and
fork type returned by the actual decoder. Its existing largest non-icon resource
fork policy is recorded, not replaced or independently certified. Raw forks have
null archive entry identity. Other containers record their actual output fork
hash but use `unverified-container-unwrapping`: their container-selection
semantics have not been independently assessed here.

At the existing chrome decoder dispatch, the observer hashes the exact cicn/cinf/ppat/wnd#
payload view passed into that decoder and records its parser occurrence index,
signed ID, type, byte length and conversion outcome (`decoded`, `skipped`,
`error`). No resource is parsed or selected again to obtain this evidence. The
index distinguishes repeated IDs. The existing manifest builder carries exact
successful resource references into each generated key, including the last
successful same-ID cinf used by its existing metadata map. Missing cinf metadata
has a null reference. Version1 now declares an expanded `scope.resourceTypes`
list (`cicn`, `cinf`, `ppat`, `wnd#`); older version1 records may omit ppat or wnd#.
Consumers must inspect scope rather than infer observation from the version alone.
Other types still have no payload evidence.

Each chrome entry's frozen `byteProvenance` contains the generated key, load ID,
and cicn/cinf occurrence indexes. The existing control trace copies this reference
from its actual selected or rejected entry. Join through the owning theme's load
record, not the requesting child's record, a requested ID, filename, blob URL or
another load of the same URL. Absent load/entry evidence remains unknown.
`loadId` is random per-load correlation; stable identity is established by input
and fork hashes plus exact payload type/signed ID/length/hash. Concurrent loads
never share collectors, even when their URLs match.

The returned evidence and entry references are deeply frozen scalar data. Theme
manifests and custom asset encoders remain consumer-controlled: manually replacing
assets/entries after load does not turn their historical load reference into a
verification of replacement bytes. This is not a tamper-proof attestation API.

## Completion, ambiguity and ownership

Secure-context Web Crypto is required only for opted-in loads. All digest work
settles before encoding can allocate URLs. A hash failure rejects the opted-in
load; if conversion also fails, its original error takes precedence after
pending hashes settle. There is no successful load record returned on rejection.
Successful loads can separately record resource-level decoding failures that
produced no manifest entry. Existing encoding failure cleanup and idempotent
`dispose()` ownership are unchanged. Disposing a theme revokes its URLs; its
scalar evidence remains readable if the caller retained it.

Duplicate cicns or ppats that collide on the same converted asset binding are an explicit
opt-in limitation. The existing encoder map would keep the last URL while two
manifest keys can retain different metadata. A provenance load rejects this
ambiguity before URL allocation, even if the payload bytes are equal, rather than
certifying an ambiguous occurrence. The default loader retains its prior policy.
Repeated IDs with distinct output bindings are not rejected merely for sharing
an ID. Repeated cinf metadata remains observable by exact occurrence.

## Bounded independent acceptance

`provenance.spec.mjs` joins the 14 existing reviewed real control cases (17 painted
face/ring selections per runtime) in Animals, Monkey Paradise, System7 Nostalgia
Silver and Windows95 to their separately pinned archive/fork/payload identities.
Source and built results are assessed independently, with opted-in/off pixel
comparison as a regression check only. A separate own/base test proves inherited
ownership and unknown evidence on an unobserved borrowed base. Successful artifacts
keep independent pins separate from actual load records/traces and execution SHA.

Hand-built uncompressed StuffIt/resource maps challenge alternate forks with the
same IDs, changed payloads, duplicate occurrences/output bindings, concurrent
same-URL loads, mutable caller bytes, failures before allocation and deep freezing.
The join verifier rejects wrong owner, key, occurrence, fork, payload and usage;
reservation cannot satisfy paint. Missing evidence is unknown, never passed.

This proves which bytes entered the shared conversion path. It does not verify
archive decompression, resource parsing, cicn/cinf decoding, image encoding,
original-engine selection, or historical pixels independently. The remaining
families/types/containers and independent decoder fixtures remain work under
[#221](https://github.com/khawkins98/scriptoscope/issues/221).

## Pattern catalog bindings and raw body requests

Each successfully converted pattern entry carries its own frozen
`PatternByteProvenance { loadId, manifestKey, ppatResourceIndex }` when opted in.
The converter carries that exact parser occurrence into its generated catalog key;
it does not reconstruct the join from filenames, labels, signed/absolute IDs, or
URLs. Distinct same-ID/name-different assets remain distinct. A skipped bit14
pattern or decoder error retains its input record and outcome but no catalog
binding. This extends the existing pre-encoding collision rejection to ppat paths.

`ChromeElement.bodyRequest` preserves raw cinf byte3 `mode` (0..255) and signed
bytes4..5 `resourceId` (-32768..32767), including zero. Null/absent is unknown.
Mode5's original branch requests cicn; other modes request ppat. The retained
legacy `bgPattern` link still uses its previous nonzero-ID/same-catalog policy;
it must not be mistaken for this raw request or historical Resource Manager
ownership. The initial #266 change added metadata without changing that policy or rendering.

`pattern-provenance.spec.mjs` observes source and built catalog bindings for two
independently pinned Crayon payloads, plus hand-encoded own/base catalogs and an
unobserved borrowed owner. The exact fixture and archive/fork/payload pins are
in `tests/resource-provenance/pattern-pins.json`; matching that declared fork is
not original lookup approval. Occurrence/key/load/payload negative fixtures,
concurrent loads and unsupported bit14 outcomes are checked separately. Independent
indexed ppat pixel fixtures are documented in [ppat-decoding.md](ppat-decoding.md).

The direct push/bevel compositor now consumes supported ppat bodies and observes
its actual requested/selected owner and paint usage at the real resolution boundary;
see [control-pattern-context.md](control-pattern-context.md). The loader's optional
`bodyPattern` key carries its last decoded same-owner choice, including ID0, before
numeric catalog keys can reorder. It is distinct from both raw `bodyRequest` and
occurrence-level `PatternByteProvenance`; it does not certify original Resource
Manager lookup. Legacy `bgPattern` and catalog keys remain unchanged. Catalog
presence alone still cannot establish a paint dependency.

## Window construction bindings

Opted-in `WindowType.byteProvenance` carries the generated key and load ID plus
exact selected parser occurrence indexes. Sliced windows identify their actual
`wnd#` record, state chrome records and the cinf selected by the existing builder
neighborhood policy. Duplicate recipes keep distinct emitted keys; failed records
do not replace successful selections. This records decoder outcomes, not proof
that a decoder validates every malformed input.

Corner-sprite windows instead identify a **modern synthesis table key**, with
trigger `no-emitted-wnd-window-types`. That can occur even when raw `wnd#`
resources exist. No original recipe occurrence is invented. State fallback and
cicn-before-ppat sprite selection retain their actual source references. A null
cinf means none selected; omitted sprite roles are interpreted against that table
key. Each nested record is frozen, and asset URL encoding leaves it unchanged.

These are construction inputs, not completed paint, original selection/provider
truth or all window dependencies. The default path adds nothing. A partial/custom
observer that cannot supply all selected records from one load yields no window
binding; consumers must retain UNKNOWN, never infer that the resources are absent.
The acceptance inventory consumes the same references, separately from its
non-unique asset-path candidate lists and finite modern resolver observations.
