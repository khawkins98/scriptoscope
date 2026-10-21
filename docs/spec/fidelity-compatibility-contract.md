# Fidelity compatibility contract

Contract ID: `scriptoscope.kaleidoscope-2.3.1`. Draft version: **0.1.16**,
2026-10-20. Inventory closure: **OPEN**. Tracked by
[epic #221](https://github.com/khawkins98/scriptoscope/issues/221).

This defines the proposed acceptance boundary and the work needed to close it.
It is not a certification, a release threshold, or a declaration that the current
case list exhausts that boundary. Changes to this draft require review and a
version increment; expanding a passing screenshot matrix does not close it.

## Engine and scheme identities

The source model targets Kaleidoscope **2.3.1**. The currently fingerprinted
primary reference is **kDEF 0, 68k**, 107,726 bytes,
SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
The [evidence record](../../tests/rendering-requirements/EVIDENCE.md#engine-identity)
and [binary inventory](./kdef-binary-inventory.md) identify the extraction and
address convention. Source inspection informs requirements; original code is
neither executed nor redistributed by this program.
This kDEF is not the entire historical engine surface: tab/body investigations
also involve PACH/Appearance paths. Pin each newly cited binary/resource before
using it to verify a requirement.

The proposed scheme set is the 18 entries in
[`source-choices.json`](../../tests/control-availability/source-choices.json):
1138, 1984, 1990, Animals, Apple Lisa, Apple Platinum 2, BeOS R5.0.3, Black
Platinum, Crayon OS, Dolphin SOM, Evolution, Floppies, Monkey Paradise, Platinum 8,
Slimes, System 7 Nostalgia Silver, Windows 3.1 and Windows 95.

That versioned registry records archive path/hash and explicit entry/fork
identities. [Input-choice review 1.0.0](../../tests/source-inputs/README.md)
approves these 18 exact contract inputs: independent lsar/unar inventories and
extraction hashes corroborate 13 archive choices; five supplied raw forks carry
no archive-selection claim. Resource-role facts, complete decoding and original
Resource Manager lookup policy remain unverified. The finite availability
inventory reviews its own four-archive subset separately. Opt-in actual load
provenance from [#251](https://github.com/khawkins98/scriptoscope/pull/251) joins
loaded/consumed bytes to actual selections; that is distinct from choosing the
contract inputs or certifying all decoding. Do not create a second independently
mutable source catalog or infer identity from generated filenames. An archive
or entry change requires renewed review.

## Surfaces and option classes

The proposed historical target is themed chrome and closed control faces exposed
by the current public API. Native browser integration has separate behavior
requirements. These family boundaries do not silently include every historical
Kaleidoscope feature or every future scheme.

| Family | Inputs to enumerate before closure | Integration paths |
| --- | --- | --- |
| Push/default and bevel buttons | Available sizes; normal/pressed/disabled/on combinations; ring reservation/paint; empty/short/long/ink labels | Direct pixels, imperative interaction, declarative promotion where exposed |
| Compatibility list-header columns | Column count/width, explicit/automatic height, active/inactive and labels | Existing direct text/cell helper and supported consumer use |
| Whole header surfaces | Explicit Rect/UInt32 state, ordinary/list-view kind, caller clip, solid-body and sampling admission; unavailable/unsupported boundaries | Separate direct `composeHeaderSurface` API; no labels/columns or automatic migration |
| Checkbox/radio | Available check/mixed/disabled combinations, labels, grouping | Direct pixels and native declarative controls |
| Closed select | Selection text, empty/long labels, disabled, available closed-face states | Declarative native select with themed closed face |
| Slider/progress/scrollbar | Supported orientation/state, minimum/native/resized length, endpoint/interior values; scrollbar thumb model/extent | Direct pixels; supported imperative and declarative paths separately |
| Tabs | Selected/unselected, available art, labels, grouped strip/panel behavior | Direct pixels and declarative tabs |
| Disclosure/grow box | Supported direction/state and authored size | Direct pixels and exposed interactions |
| Window chrome | Exact available type aliases/art per scheme, active/inactive, title/size boundaries, widgets and collapse | Direct composition, imperative manager and declarative windows |

The [70/660-case profiles](../../tests/rendering-options/cases.mjs) are executable
regression samples, not the full acceptance inventory. In particular, window
types/states and base-chain cases are not exhaustively enumerated there. Before
closing this draft, assign stable acceptance IDs with exact archive/base inputs,
path, options, sizes, labels and expected availability for every claimed cell.
Freeze each cell's obligations and review its inventory closure independently.
Unlisted combinations remain **unknown**, including combinations sampled by a
passing matrix but absent from reviewed acceptance data.

Use native/minimum/representative/resized classes and separately justified
boundary invariants for continuous lengths, values and arbitrary label inputs.
Explicit caller-requested clipping differs from automatic sizing. Do not invent
declarative attributes or public size options to complete a test grid.

## Evidence carried through each claimed cell

Every claimed cell needs an auditable chain through actual runtime boundaries:

`source bytes → decoding → selection/base ownership → composition → DOM/CSS → interaction → distribution`

Record applicable obligations for resource selection, geometry, fill/mask,
typography, state, placement and interaction. Add decoding and distribution
requirements explicitly when extending the current ledger; its seven dimensions
are scaffolding, not proof that all obligations have been discovered. An excluded
dimension needs a reviewed reason for that exact cell.

Each verified requirement needs independent evidence, exact source/reference
identity and locator, a narrow claim with limits, and an executable assertion for
the exact input. Keep observed execution separate: source/built path, clean commit,
browser/OS/DPR, requested options and assertion result. A correct payload hash
proves input identity, not decoder correctness. A trace proves actual selection,
not the historical validity of a fallback policy. A self-golden proves stability,
not original-engine pixels.

The current [ledger 1.21.0](../../tests/rendering-requirements/ledger.json) contains
144 OPEN cases and 1,039 declared obligations: 153 narrowly verified, 0 mismatched,
0 explicitly unsupported and 886 unknown. Of the 18 window-chrome cases, only
the 13 `wnd#` ladder-selection obligations are verified. Of the 18 checkable
cases, only the 13 CICN-lane `checkable.lane-selection` obligations are
verified: agreement with the decode under a declared public-to-native mapping,
a clear Gestalt(`Acid`) byte and an archive-only resource chain, not original
file provenance. Fifty-four verified obligations concern
only complete recorded-condition empty 80×20 faces under explicit finite
measured profiles (nine of them also bind whole-load finite CIcon transfer data;
the six 1990/Dolphin faces do not discriminate state selection). They do not establish original alpha/mask, typography, hidden
selection, general state/placement, private provider/cache or default-display
fidelity. Other verified assessments retain their individually declared source
or modern-policy evidence; prepared synthetic font strikes do not identify an
original glyph provider or establish historical typography or caller sizing.

The separate [availability inventory 1.0.7](../../tests/control-availability/expectations.json)
contains 27 finite API-policy outcomes. Neither inventory is a completion
denominator for this proposed 18-scheme target. The overall denominator remains
**unclosed; no overall fidelity percentage is established**.

## Capture and browser conditions

Independent captures must identify the source scheme/fork, original system and
Kaleidoscope version, surface/state/rectangle/text, font and metrics, palette/color
depth, scale, crop method, provenance and reviewer. Existing author thumbnails
with unknown conditions remain qualitative evidence. Acquire authorized supplied
or existing reference data under [#190](https://github.com/khawkins98/scriptoscope/issues/190);
do not synthesize a reference by running our own renderer.

For browser regression, the [reviewed golden manifest](../../tests/rendering-options/goldens/manifest.json)
pins Linux/amd64, immutable Playwright container, Chromium version, DPR1, viewport,
case order and font hashes. Virtue and Charcoal-12 browser faces are explicit
substitutions whose historical text equivalence remains to be verified. Browser
RGBA output is not proof of original QuickDraw palette/transfer behavior.
Firefox/WebKit and DPR2 execution broaden behavioral coverage; they do not imply
cross-platform image identity or verification of every declared browser floor.
Capture conditions and any justified tolerance belong to each independent
reference, not a tolerance chosen to accommodate current output.

Native colour depth is part of the capture condition. The 8-bit calibrated
condition and the 32 bpp direct condition ([reference environment](../maintainer-reference-environment.md#direct-32-bpp-condition))
are separate evidence and are never pooled. A comparison states which modern plane
it uses: the default display-gamma policy or an analysis-only pre-gamma plane
(not a public runtime mode; a supplied measured display profile replaces the default). Framebuffer
agreement at either depth does not establish what a historical display showed.

## Deliberate boundaries and substitutions

- Browser-native open select menus and ordinary text fields retain native visuals.
  Their labeling, focus, keyboard, form and lifecycle behavior remains in scope;
  their appearance does not count as Kaleidoscope pixels. The closed-select face
  remains part of the themed target.
- Procedural fallback and native fallback are compatibility behavior, not original
  scheme art. Record the actual outcome, reason and ownership for each case.
- Named-role preference, anti-role rejection, inherited ownership and state
  substitutions are declared compatibility policies until independently justified
  as original behavior. Do not conflate API-policy and historical requirements.
- Consumer content, arbitrary external fonts/CSS, unsupported original variants
  and additional historical extensions are not silently certified. Name a concrete
  supported consumer condition or retain an unknown/unsupported entry with reason.
- Frame geometry and text behavior are separate claims. Pattern-backed faces,
  list-header/legacy callers (#218), tab body/font semantics (#223), and original
  slider arithmetic/masks remain unresolved. No exclusion here resolves them.

## Delivery order and closure

Inventory structure closure is separate from fidelity verification. Audit all18
pinned inputs against the actual public exports, declarative paths and available
window types, with explicit decoder and distribution obligations. A larger sample
matrix does not establish that this inventory is exhaustive.

Replace broad remaining obligations incrementally with source-derived parameterized
rules, preconditions, literal oracles and actual byte/branch assertions. Preserve
the unresolved remainder; a representative success must not bulk-promote other
inputs. After the current empty-face campaign, prioritize a real public push/default
consumer vertical slice, then chrome, checkables, ranges and tabs/headers.
Historical caller/owner, destination clip, font metrics and transfer/device evidence
are required for the claims actually made. Missing provider or font truth stays
unknown and does not block unrelated source-backed fixes. The full acceptance
target and exit criteria below remain unchanged.

1. Review and freeze acceptance inputs, applicable obligations and exclusions.
   Keep overall closure OPEN while adding bounded independently reviewed cases.
2. Join actual loaded-byte provenance (#241); verify independent decoder fixtures
   separately. Verify overlapping mount/theme operations (#237) and preserve
   native interaction/lifecycle contracts through the real public paths.
3. Resolve demonstrated source mismatches (#218/#223) using call-site evidence,
   hand-derived expectations and negative proofs against the prior implementation.
   Preserve held experiments until their complete semantic effect is explained.
4. Acquire/review independent reference data (#190), broaden families/windows and
   validate a clean packed consumer. Keep missing evidence visible while useful
   implementation proceeds in parallel.
5. Require zero mismatched or unknown obligations within the reviewed historical
   fidelity claim, all applicable independent assertions and required regression
   checks passing, and a reproducible shipped consumer. Deliberate unsupported
   or substituted cells remain visible in the inventory and explicitly outside
   that historical claim. Update CHANGELOG and the coverage report.

Completion may then be described as **complete for the named versioned acceptance
target**, with its exclusions and deliberate substitutions. The separate product
release threshold remains [#168](https://github.com/khawkins98/scriptoscope/issues/168).
This draft does not choose that threshold or certify the current implementation.

## Reference capture intake implementation (#190)

[Capture requests and validation](../../tests/reference-captures/README.md)
currently track 59 requests and 45 independently reviewed scoped observations.
The observed whole requests remain evidence-incomplete; a scoped pixel match
is not whole-control certification. Requests reuse the source-choice pins, name
target requirements, and specify body-only geometry/state/port/crop conditions.
Unobserved environment, base/search-chain, font and palette information remains
unknown until external evidence and independent review supply it. The validator
separates eligibility from rendering verdicts, rejects known self-image
contamination and stale/mismatched provenance, and reports missing evidence
without a fidelity percentage. It neither executes original code nor promotes
request inputs, author previews or selfgoldens to historical defaults. Target
closure, source-selection approval and typography remain unchanged.

Nonzero-port requests are explicitly unresolved direct-invocation experiments,
not assumed valid Window/Control Manager calls. Their coordinate-placement and
fixed-physical-placement cases are separate; pattern-origin API availability and
state require observation and review before any phase comparison. See the capture
contract for source references and exact transforms.
