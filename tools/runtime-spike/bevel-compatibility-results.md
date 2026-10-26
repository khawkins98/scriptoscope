# Preserve bevel appearance with prepared compatibility inputs

Superseded by the [compatibility-preserving revision](bevel-delivery-revision.md).
The measurements and proposed losses below describe the earlier candidate.

The better experiment preserves all measured themed renders. Its two paint
recipes remain a useful comparison candidate, but the subsequent contract audit
did not establish an exact-preserving production consolidation. A subsequent
[delivery candidate](bevel-delivery-results.md) removes code by proposing explicit
compatibility changes. Shipped production is unchanged. Do not ship the earlier
six-theme retirement recommendation.

The frozen reference is the normal compiled build of `f7d93afb`, executed only
through its public loader/render exports. The candidate is an internal prototype,
not a shipped API. All synthetic inputs are implementation-owned probes derived
from current public compatibility behavior, not independent acceptance fixtures
or original-engine evidence.

## Results

| Experiment | Bundled-theme comparisons | Synthetic comparisons | Pixel differences | Lost renders |
| --- | ---: | ---: | ---: | ---: |
| Retire approximation | 2592 | 0 | 0 among two rendered results | 864 |
| Infer compatibility cinf | 2592 | 1728 | 1236, all synthetic | 0 |
| Prepare rectangular compatibility recipe | 2592 | 1728 | 0 | 0 |

The final recipe comparison has **4032 identical rendered results and 288 matching
`null` results**, with no changed errors, dimensions or availability. Four comparator
mutation probes detect pixel, dimensions, availability and error differences.
Three additional exclusion probes deliberately reject inputs the old renderer
can paint: missing cinf plus a solid background anchor, missing cinf plus a
pattern body, and a present short cinf. These are reported separately from the
4320 comparisons. They identify unfinished prototype boundaries, not equivalent
outcomes or proposed new production errors.

All 864 previously lost renders are restored for `1138`, `1984`,
`apple-platinum-2`, `black-platinum`, `platinum-8` and
`system7-nostalgia-silver`. No generic Platinum/browser substitution is required
for these measured cases.

The original corpus matrix covers 18 themes ×144 combinations: regular/small,
on/off, normal/pressed/disabled, automatic and explicit dimensions, empty/text
labels, and local/offset clipped contexts. The six synthetic fixtures exercise
patterned middle bands, unequal insets, oversized clamped insets, partial alpha,
a transparent sampled center and tiled unequal insets. Each has 288 combinations
of width, height (including 1 and 3 pixels), label, disabled state, foreground
override (including a defined empty string) and clip.

## What changed in the experiment

Preparation first checks the engine's selected cinf and fallback. A present
resource, including unusable metadata, is not converted into compatibility data.
Absence is necessary but insufficient: the old painter can still select a solid,
pattern or mode-5 body from other supplied metadata. The prototype rejects every
missing-cinf input carrying a body request, or a slice plus usable background
anchor, instead of pretending it selected rectangular resizing. The measured six
themes enter the rectangular recipe 144 times each and remain outside these
guards. Declared standalone cinf environments also remain explicitly unimplemented.
The delivery must prepare the actual old branch, or separately review a changed
contract, before supporting these additional combinations.

The inferred-cinf variant captures the current inferred inset and sampled colors,
then supplies an explicitly named compatibility provider to `drawCinfFrame`.
It works for the bundled artwork but fails the synthetic counterexamples. It is
not the recommended general implementation and should be removed after the spike.

The recommended rectangular recipe captures the selected source, insets, tile/
stretch mode, sampled RGBA and label colors. Execution is just the existing
`PixelBuffer.nineSlice`, followed by the existing conditional central `fillRect`.
`nineSlice` already delegates transfers to the engine's CopyBits primitive.
It preserves source-copy before central fill, source inset clamping, middle-band
stretch/repeat, transparent center behavior and the existing alpha treatment.
That alpha preservation statement applies to the rectangular compatibility branch,
not metadata-backed cinf execution or the entire bevel renderer.
It does not invent or attach raw cinf metadata to a theme manifest.
The partial-alpha fixture uses a PNG encoder and tests decoded image pixels,
including Canvas rounding. Synthetic themes use the current owner binding with
the frozen renderer; they do not establish frozen-loader equivalence for arbitrary
hand-built themes or unchanged raw RGBA transport.

Both recipe kinds share face selection, sizing, label painting, clipping and
theme ownership in the candidate facade. Metadata-backed faces continue through
`themeResourceChain` and `drawCinfFrame`. Rectangular compatibility uses the
existing rectangular primitive. These are different operations with a shared
orchestrator, not two complete bevel compositors or a new generic renderer.

The prototype prepares a recipe per composition. It does not establish that
immutable per-theme caching is valid or that startup/painting is faster.

## Code-reduction implication

The gross replacement surface is 408 physical lines in `controls.ts`. Withdraw
both the earlier 160–255-line replacement estimate and the suggested 108–223-line
net reduction. They did not budget for the actual compatibility contract. The
engine and bevel renderer differ in body-resource admission, staged alpha
blending, scalar geometry and diagnostic publication. Retaining these behaviors
has not produced a credible deletion budget; introducing another policy layer
could increase production code.

The user approved snapshotting selected metadata on 2026-10-26, including a change
to observable getter counts and mutations during asynchronous rendering. That
approval does not authorize different resource selection, admission, pixels,
geometry, diagnostic completion, callback behavior or owner disposal protection.
Snapshotting alone does not resolve the other differences. It is approved for the
future implementation, not implemented by this spike.

At the spike revision, only tooling and documentation were added and no
production code was removed. The later delivery candidate is measured separately. The independent test author has added boundary coverage in a
separate lane; that coverage does not certify a candidate that has not been built.

Withdraw the earlier arbitrary 150-line minimum: preserving themed output is
more valuable than choosing semantics to hit a line target. Require a measured
net decrease and deletion of the old orchestration in the eventual delivery PR.
Do not count relocation or formatting compression as simplification. Keep the
shared grow/disclosure graph and public `PixelBuffer.nineSlice`.

## Reproduction and receipts

Use the existing local frozen build receipt; hashes are checked before execution:

```sh
SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY=tools/runtime-spike/.artifacts/deletion-baseline/compiled/scriptoscope.js \
SCRIPTOSCOPE_ARTIFACT_DIR=tools/runtime-spike/.artifacts/bevel-compatibility-next \
node tools/runtime-spike/run.mjs --bevel-compatibility
```

Use `--bevel-compatibility=cinf` for the rejected inferred-cinf variant.
`--bevel-proposal` retains the original retirement experiment. A successful
measurement reports `measured`, not an acceptance/equivalence certification.
Failed/incomplete measurements retain their accumulated rows.

| Local ignored receipt | SHA-256 |
| --- | --- |
| `.artifacts/bevel-compatibility-cinf-02/bevel-compatibility-results.json` | `8cb67e2a9e225db9c8630bc2521464325ffd48fea8785ea1aa18664b3d7d676c` |
| `.artifacts/bevel-compatibility-rectangular-02/bevel-compatibility-results.json` | `802d3150a435e572d82722935566c20272d2234bfe14bc258f038c5c9e2d0f0d` |

Final receipt: 7853 bytes, source HEAD `52a70d89` plus pinned working-tree driver
`c946a053804e436bb1f784faef71bb30cc71e96f9b0a38397a7ec586e5e56cc8`.
The runtime fingerprint remains
`5f83483787e4702fb9234b9240236fdf5f1350df62e62aab318808daefa5a2a3`.
It records fetched archive SHA-256 values, browser identity, build and driver
fingerprints. Fonts and untracked runtime files remain outside the fingerprint;
the inferred-cinf receipt predates archive hashing. Missing historical source maps
produce expected warnings; no historical maps or renderer source are inspected.

## Next delivery gate

Before committing to the typed facade, establish a concrete deletion sketch
against the retained contracts or present one coherent compatibility proposal for
review. Do not implement the prototype's rejected inputs as production errors or
quietly adopt the engine's different blending and admission rules. Snapshot timing
is approved; the other behavioral differences remain unapproved.

Once a viable boundary is agreed, implement and delete the replaced orchestration
in the same feature PR. Have the independent specification/test owner validate
that boundary, then run the frozen renderer matrix and relevant independent
checks. Include eager transport, base inheritance, missing/unknown dependencies,
declared environments, diagnostics, failures and disposal. Report actual net
production lines and built/gzip bytes separately. The current result establishes
bounded pixel matches, not complete public compatibility, original-engine
fidelity, package shrinkage or a speedup.
