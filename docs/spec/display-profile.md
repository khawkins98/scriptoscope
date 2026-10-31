# Explicit finite display profiles

`prepareDisplayProfile` and the loader `displayProfile` option provide an opt-in
color preparation policy. Omitting the option retains the existing
`mac-1.8-to-2.2-high-byte` policy and default theme derivatives. A profile is a
finite set of measured or caller-declared joint RGB16 mappings, not a general
Color Manager implementation or an original-fidelity certificate.

## Public use and ownership

```ts
import { prepareDisplayProfile, loadTheme } from 'scriptoscope';
// The example page host (demo/explicit-host.mjs); not a package export.
import { mountExplicitPage } from './explicit-host.mjs';

const data = await fetch('/my-reviewed-display-profile.json').then(r => r.json());
const displayProfile = await prepareDisplayProfile(data);
const theme = await loadTheme('/themes/windows-95', { displayProfile });
// Alternatively, one mount uses the same immutable policy for every theme:
const handle = await mountExplicitPage({
  root: document.querySelector('#desktop'),
  themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', displayProfile,
});
// After the respective consumers unmount:
handle.disconnect();
theme.dispose?.();
```

The factory snapshots plain finite JSON synchronously, before its asynchronous
SHA-256 calculation. It validates and freezes the data, sorts mapping/palette
rows, and hashes canonical JSON including conditions, evidence identities and
producer tables. The returned ID is `display-profile:<sha256>`. Input mutation
after calling the factory cannot change the prepared policy. Preparation needs
Web Crypto; pure Node `convertScheme(bytes, {displayProfile})` remains synchronous.
The browser raw-byte `loadKaleidoscopeScheme` accepts the same prepared object.

Prepare data using the factory from the same library instance that loads it.
Serialize `.data` when crossing module/worker boundaries and prepare it again;
a copied object or arbitrary matching ID is not a prepared realizer. Identical
canonical data produces the same identity. Validation establishes consistency,
not authenticity of caller-supplied evidence or device measurements.

`loadTheme` fetches original archives, not pre-extracted PNG manifests. Loading
with a different profile requires converting the raw archive again. Retagging
prepared PNGs or changing a loaded manifest's profile cannot recolor them.
Profiles are retained once on `theme.manifest.displayProfile`; derived metadata
names that owning policy. Base chains and registered borrowed themes must have
the same profile identity, including the distinction between default and opt-in.
The declarative resolver captures one policy for its lifetime. To change it,
create a new resolver/mount and reload the themes.

Default browser encoding creates fresh asset URLs per load. A custom
`assetUrlFactory` must likewise return URLs for the correct prepared content;
reusing one URL for different profile pixels violates the raster cache contract.
Window title caches also distinguish actual loaded theme objects. The original
fetch URL and raw archive/resource provenance remain unchanged.

## Exact conversion contract

Both profile versions contain conditions, SHA-256 evidence descriptions, indexed device
palette entries, exact joint RGB16 mappings and three 256-byte producer tables.
Each mapping records the source triple, measured device index and device RGB16;
the device RGB16 must equal the recorded palette entry at that index. The sole
producer model, `rgb16-high-byte-table`, selects each channel's table entry using
that device channel's high byte. Low source bits remain part of the exact key.
There is no nearest-color search, per-channel interpolation or legacy fallback.

Ordinary indexed `cicn` and `ppat` palettes and emitted header `clut` parts retain
RGB16 until this operation. The independent engine sampler retains its own
palette-selection rules, then feeds the same realizer. Raw background, text and
emboss samples preserve their raw RGB16 and sentinel decisions. Opaque sampling
equivalence compares the final ordinary and sampled current-display RGB under
the same profile. Sampled-band companions are transformed once; mode-5 body
assets copy already-realized hidden RGB and change alpha only.

Fixed classic icon palettes have only RGB8 constants. Their explicit compatibility
input convention is RGB8 × 257; this is not a recovered original icon RGB16
observation. Existing corner-flood decisions happen in the unchanged legacy
palette domain before profile RGB replacement, preserving alpha even when the
new device mapping merges colors. Caller `meta.palette`, procedural renderer
colors, native controls and consumer CSS are already display-domain inputs and
are not interpreted as original RGB16. Font/device rendering remains separate.

## Finite direct-RGB8 preparation

Version 2 adds a separate `directRgb8` section to the existing RGB16 mappings.
It declares `operation: 'GetPixPat-FillCRect-patCopy'`,
`context: 'declared-context0'`, and `scope: 'preparation-only'`, with its own
evidence identities and exact `rgb8`, `deviceIndex`, and `deviceRgb16` rows.
The device index and RGB16 must agree with the same recorded palette; the shared
producer tables realize the resulting device color. Direct RGB8 inputs never
pass through RGB16 expansion, interpolation, or an RGB16 fallback. Version 1
retains its existing identity and behavior and rejects the new section.

The direct path admits only full-color patType1 patterns with a zero-based,
unpacked RGBDirect PixMap: pmVersion1, pixelSize32, three eight-bit components,
power-of-two dimensions, and bounded rows. It reads the three RGB bytes, ignores the unused high byte and row padding,
and produces opaque pixels. Other direct layouts remain unsupported. Missing
exact mappings reject the entire conversion before asset URLs are allocated.

This is a caller-declared **pixel preparation policy**. The loader cannot observe
the eventual painter's origin, clip, operation, or native device; the declaration
does not enforce those conditions at draw time. Reusing prepared assets in other
contexts does not establish their historical fidelity. Original comparisons must
separately bind actual paint conditions, source coordinates, and visible pixels.

The reviewed private GetPixPat → FillCRect acquisition supplies finite zero-origin
evidence for three gray RGB8 inputs. A source-declared phase rule was sealed
before the offline comparison; 18,102 gray pixels match the same-run uniform
indices, including 12,288 exact original-pattern pixels. Nonzero-origin phase,
arbitrary-pattern independence, private provider/cache behavior, and participation
in any particular captured button remain separate unknowns. These observations
do not certify every use of a version 2 profile.

## Failures and support boundaries

`DisplayProfileError` exposes `code`:

- `INVALID_PROFILE`: malformed data, inconsistent palette, or unprepared object.
- `INVALID_SOURCE_COLOR`: source color is not a valid RGB16 triple.
- `MISSING_MAPPING`: an exact required source tuple is absent.
- `PROFILE_MISMATCH`: a theme/base/resolver policy differs.
- `UNSUPPORTED_SOURCE_COLOR`: a source cannot provide the required safe RGB16
  conversion, including direct-color `ppat` variants outside the selected version and strict layout contract.

Conversion completes before the browser encoder allocates asset URLs. Missing
mappings, including hidden icon RGB, reject the whole load; conversion does not
silently skip those resources or mix default and profile colors. This strict
admission is intentional: a finite profile may support two schemes and reject a
third. Failed source decoding under an opt-in profile also rejects conversion
rather than returning a partially prepared theme. Existing no-profile behavior
is unchanged.

## Evidence and the measured test input

`tests/decoder-fixtures/display-profile.mjs` supplies independent joint-color and
low-bit literals. The measured JSON beside it is an explicit test input with
194 exact source tuples, a captured 256-entry indexed palette and producer table.
Its 388 repeated queries were joined to the actual palette under the recorded
System 7.5.5 environment. It contains no ROM, executable, font or private-path
payload. Its SHA-256 is
`d8c495d980029f857633652c5e1abd3bc4f289fb8705e03fd750bc9bdff96d00`;
its prepared identity is
`display-profile:506eb4e615f81385b6143c63a9612f4c899b14e2c93c60b67358b436777f772d`.

The fixture retains `QUARANTINED_PARTIAL`, exact conditions and evidence hashes.
It supports the measured two-theme color inventory and declared fixed-icon
convention; it is not an admitted original capture or whole-theme oracle.
Independent private full-face comparisons are separate evidence. Default
reviewed goldens continue to test the unchanged legacy policy. No reference
intake, requirement-ledger assessment or historical device/font claim is promoted
by this option; original evidence collection remains tracked in #190.
