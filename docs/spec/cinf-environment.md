# Declared cinf environment for push and bevel faces

`prepareCinfEnvironment` prepares an explicit modern, ordered **cinf-only**
resource environment. Supply it to `loadTheme` or `loadKaleidoscopeScheme`:

```ts
const cinfEnvironment = await prepareCinfEnvironment({
  version: 1,
  complete: true,
  providers: [
    { kind: 'theme-fork', id: 'scheme', complete: true },
    { kind: 'raw-fork', id: 'declared-provider', complete: true, bytes: providerFork },
  ],
});
const theme = await loadKaleidoscopeScheme(schemeBytes, {
  cinfEnvironment, provenance: true,
});
const pixels = await composeButton(theme, { label: '', default: false });
```

External providers are raw resource forks, snapshotted before the factory's first
await. Their cinf occurrences retain fork/payload SHA-256, signed IDs and parser
occurrence indices, including invalid and duplicate resources. The optional
`theme-fork` marker is replaced with the actual selected scheme fork on each
load. No provider is inserted implicitly. The immutable environment ID identifies
the template; the binding ID additionally identifies that actual fork. Prepared
handles and role views cannot be reconstructed by serializing their metadata.

## Lookup and scope

The [source lookup contract](cinf-lookup-contract.md) establishes same-ID lookup,
then cinf 0 for a body-enabled face after an explicit NULL, then no body/border
after a second NULL. This opt-in evaluates that sequence against the caller's
ordered provider list. The declared order/completeness is a modern policy, not
an observation of historical Resource Manager search order. Any globally
incomplete list is unknown. An incomplete provider encountered before selection,
a duplicate ID within a provider, or present invalid cinf stops admission;
none is converted into NULL. Equal request/default IDs retain both attempts.

Only standalone push/bevel faces with exact requested/selected signed ID equality
can consume the view. Existing face-selection reasons remain visible. Base
inheritance, default-ring requests, selected-ID substitutions, mode 5 and
unprepared/mismatched views reject with `CinfEnvironmentError` and code
`UNSUPPORTED_CINF_ENVIRONMENT`. Ring/default-1 lookup is not implemented here.
Other control families retain their common metadata. Without the load option,
existing conversion and rendering behavior is unchanged.

The loader samples the selected face's raw colors while its transient sampler
exists, using the selected cinf and the current display profile exactly once.
Common `ChromeElement` fields are unchanged. `bodyCinf` is a separate immutable
role view. Unusable text samples reject nonempty labels; empty labels can still
use valid body geometry. Two explicit NULLs with an empty label return the
existing public allocation initialized transparently, without body/border paint.
Text outputs for that case are unavailable, so nonempty labels reject.

Pattern lookup retains the existing **same-face-owner** modern policy; a cinf
provider does not become an image provider. Sampled border assets also remain
face-owned. Missing safe raw background samples or unsupported body admission
reject instead of falling back to the legacy face renderer. Existing typography,
mask, pattern and device limitations otherwise remain explicit; this option is
not a complete Resource Manager or control-painter implementation.

## Evidence and lifetime

`byteProvenance.cinfResourceIndex` and `sourceCinfId` still describe the static
same-load pair. They must not be read as the consumed role metadata. Admission
steps carry `cinfLookup`; completed border records carry `resource.consumedCinf`,
including environment/binding IDs and the selected provider/fork/occurrence/hash.
Those records distinguish metadata admission from actual paint. Two NULLs have
no successful paint dependency. A body pattern's existing selection/completion
records do not prove individual pixel occupancy.

The environment owns no asset URLs, retained samplers or base theme. Assets and
disposal stay with the ordinary loaded face theme. Owned synthetic Node fixtures,
the existing source/built harness and installed-package fixture exercise the
public seam; no original engine/provider resource bytes are bundled. Historical
provider/cache order, original palette/device state and broad fidelity remain
unknown. The 87 previously missing-cinf corpus tuples do not establish original
NULL results or authorize unconditional engine defaults.
