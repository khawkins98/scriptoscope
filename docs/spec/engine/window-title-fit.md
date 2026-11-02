# Substitute window-title coverage

## Status and scope

PM modern compatibility policy, 2026-11-02. This self-contained title handoff
includes the required TF1–TF6 and F11 rules; the full legacy widget and
procedural-frame documents are not required implementation reading. It does
not establish original font, QuickDraw raster or cross-platform pixel equivalence.

Recipe-window style selection uses the complete requested title before
horizontal truncation. Shared title measurement and painting also serve built-in
procedural frames; those consumers retain their own geometry, font-selection,
baseline, clipping and truncation policies. This contract does not apply recipe
size reduction to procedural frames.

## Existing recipe placement and horizontal truncation

TF1 measures and draws at full width (`SWc = SW`), without a condensed face.
Here `t4p` is the actual remapped title rectangle and `plate` is the title plate.
The horizontal room is
`min(t4p.width + 2, max(plate.right - t4p.left, t4p.width))`.
Keep the whole requested title when its advance fits that room. Otherwise use
the longest Unicode code-point prefix followed by `…` whose advance fits;
if no nonempty prefix plus ellipsis fits, use the ellipsis alone, even when
the marker itself exceeds room. This does not enlarge the destination clip:
retain `t4p` widened by two pixels on the right, with unchanged vertical bounds,
so a marker wider than room retains its existing clipped behavior.

F11 keeps the pen at `t4p.left` and the alphabetic baseline at
`max(t4p.bottom - 4, t4p.top + nominalAscent)`. The nominal baseline metric
remains `max(1, ceil(actualBoundingBoxAscent || size * .72))` for the text being
measured in the resolved style: the complete request during candidate fitting,
and the displayed title/prefix/marker during publication. This metric is
distinct from the baseline's row in a scratch raster and from any padded or
cropped raster origin; correcting coverage must not substitute those storage
coordinates for the nominal metric or move the published baseline. Keep main
and shadow clipping, shadow offset (+1, +1), and shadow-before-main paint order.

## Style and fit

Preserve the preferred family, required plain/bold face and spacing: recipe
titles are bold when the mapped `altWidgets` flag is set and plain otherwise.
The existing recipe preferred size is `max(8, min(13, frameTop - 6))`;
the preferred-font policy described below may pin it to 16 pixels. Keep the
preferred style when it fits. Otherwise choose the largest positive integer
pixel size no greater than the preferred size that fits, preserving family,
face and spacing. Candidate geometry uses the existing layout constructor and
the candidate's complete-title advance with the caller's unchanged inputs.
Do not assume fit is monotonic with size or infer fit from a later prefix.

For each candidate, keep the existing adjusted baseline and actual remapped
vertical title clip. Fit requires every main glyph pixel of the complete
requested title with nonzero alpha to lie inside that vertical interval.
Fallback glyphs, disconnected marks and faint coverage count. There is no
alpha threshold, permitted lost row, replacement face or enlarged clip/plate.
Shadow retains its existing clipped semantics and does not enlarge the fit
budget.

One resolved style governs advance, layout, truncation/marker measurements and
painting. Preserve existing full-width, longest-prefix and marker rules, colour
sampling, main/shadow order and offsets, title data and accessibility name.
The existing baseline rule remains unchanged for measurement and publication;
scratch padding or cropping must not move the published pen or baseline.

Existing empty-title, suppressed-title and empty-clip behavior is unchanged.
TF5 applies only after every eligible candidate has demonstrated nonfit. It
retains preferred geometry and full title/accessibility data while omitting
both main and shadow ink. An unavailable coverage result is never TF5 and
cannot justify choosing a smaller candidate while a larger one is unresolved.

## P1 supported-renderer premise

P1 is an explicit compatibility assumption about supported modern browser
Canvas 2D rendering, not a bound derived from a standard or a proof over
arbitrary fonts. It applies to stable loaded text state on the existing host
fallback stack, with the existing family order, face and spacing. It assumes
finite host operations and finite main raster support for the complete shaped
request, including every resolved fallback and sequence.

Observation uses the library's native internal raster resolution, alphabetic
baseline, identity raster scale and unchanged fractional pen/baseline phase.
CSS presentation scaling and device pixel ratio do not change that internal
raster. Main-coverage observation excludes shadow and filters and preserves
the painter's text shaping state. Drawing a clipped whole request must not
require a hidden full-advance pixel surface. The chosen observation placements
must preserve queried coverage as specified below. These are supported-renderer
assumptions, not guarantees about opaque browser implementations.

The finite envelope is the complete request's signed actual bounding rectangle
on **both axes**, expanded on each side by one candidate font em plus one
internal-raster pixel, then rounded outward to integer pixel boundaries.
At the identity raster scale the expansion is the candidate pixel size plus
one pixel. Horizontal bounds use the alignment-relative actual left/right
bounds, including negative bearings; vertical bounds use baseline-relative
actual ascent/descent, including negative descent. Preserve the actual alignment
point and baseline. Advance width and first-font metrics do not replace actual
ink bounds. Do not clamp signed bounds to zero.

P1 assumes all nonzero main raster coverage lies in this envelope. The expansion
is independent of title advance and length; it varies with candidate size.
Its em and pixel terms are declared support allowances, not maximum contour,
metric-error or antialias widths established by measurement. Finite samples may
falsify this assumption but cannot prove arbitrary-fallback completeness.
A transparent observed border does not establish absence of ink beyond it.
No runtime claim is made that unseen violations of P1 can always be detected.

P1 also assumes **query equivalence for the chosen placements**: after reversing
the integer translation, each queried pixel has the same native main raster
coverage as the complete request at its original pen, baseline and fractional
phase. This includes every nonzero alpha value. Envelope containment alone is
insufficient: a clipped complete-request draw can be unusable for a query even
when the query lies inside the envelope. Neither a geometric guard, a retained
metric anchor nor transparent readback proves query equivalence. This is no
universal theorem about native culling. Finite supported-renderer checks may
falsify the chosen-placement assumption but cannot prove completeness for
arbitrary fonts, fallback sequences or titles. A known unusable placement is
unavailable, not evidence of empty coverage.

The measured request and every observation/publication pass must share stable
font resolution and text state. A result cached across a font-state change
is invalid. An unsupported transform/phase or known premise violation cannot
silently reuse P1. This policy does not change the fallback stack to obtain a
bound and does not require resolving font identities that Canvas does not expose.

## Bounded observation and finite completion

Coverage observation scratch is bounded by one canvas of at most 4096 by 32
internal-raster pixels and one equally bounded RGBA readback. Reuse storage;
do not retain a list of tile rasters, an envelope-sized pixel array or a
full-untruncated-title bitmap. The two explicit RGBA planes total at most
1,048,576 bytes, apart from fixed browser overhead. This is independent of
the complete request's advance for fixed font and clip inputs.

Every raster observation must shape/draw the identical complete request with
the candidate's exact text state. Integer tile translations preserve the original
coordinate phase and absolute baseline relationship. Substring, glyph, word,
cluster or directional-run splitting, horizontal compression and `maxWidth`
fitting do not substitute for complete-request observation.

### Finite guarded paint windows and owned queries

Distinguish the **paint window**, into which the complete request is drawn,
from the **query rectangle**, whose pixels contribute to the coverage verdict.
They need not coincide. Paint windows may overlap on both axes; a query must
be contained in its paint window, and the chosen placement must satisfy P1's
query-equivalence assumption. Paint-window geometry is observation geometry
only and does not widen the published destination clip.

A concrete finite construction follows. Let `M` be the closed actual metric
rectangle in absolute raster coordinates at the unchanged pen and baseline,
with ordered signed endpoints on each axis. Either extent may be zero.
Let `g = candidate size + 1`, and let `E` be the existing outward-rounded
expanded envelope. Existing recipe preferred sizes are no greater than 16,
including the preferred-font pin. An already fitting preferred size may be
fractional; reduced candidates retain the positive-integer search. Thus
`0 < g <= 17` and `ceil(g) <= 17`. This preserves the existing size domain and
P1 allowance; it introduces no title, font or work cap.

Partition `E` into disjoint integer half-open query rectangles of width at
most `4096 - 2` and height at most `32 - 2`. Keep the smaller final strips
and corner rectangles. For each axis independently, let `[u,v)` be the query
interval, `[l,r]` the closed metric interval, and `a` the projection of the
query midpoint `(u + v) / 2` onto `[l,r]`. The paint interval is
`[min(u, floor(a)) - 1, max(v, ceil(a)) + 1)`.
The product of the two paint intervals contains the whole query with a
one-pixel guard on every side and contains the reported-metric anchor
`(a_x,a_y)` strictly inside. Draw with the original absolute pen and baseline
translated by the integer paint-window origin, preserving fractional phase.
Clear the reused observation scratch before each complete-request draw.
Do not replace the pen or baseline with the anchor or a raster/crop origin.

The per-axis paint extent is at most
`max(v - u + 2, ceil(g) + 3)`. If the query interval meets the closed metric interval,
the projected anchor lies in the query's closure and the extent is `v - u + 2`.
Otherwise the anchor is the nearest metric endpoint; outward rounding of `E`
and rounding that endpoint cost at most one further pixel beyond `ceil(g)`,
giving the bound `ceil(g) + 3` including the two guard pixels. Thus the horizontal extent
is at most 4096 and the vertical extent at most 32. Applying this argument on
each axis covers the metric core, either side's halo, corners and partial
queries. Negative bearings, signed ascent/descent and zero-width, zero-height
or point metric rectangles use the same construction without clamping or
discarding their expanded envelope. A line or point anchor is not evidence
that native raster coverage is empty or nonempty. Reversed or unusable metric
intervals are unavailable, not degenerate empty coverage.

The construction proves finite geometric containment and scratch bounds; it
does not prove native raster preservation. In particular, retaining a metric
anchor does not imply that native culling accepts the draw or preserves any
query. If this finite construction cannot supply safe placements under P1 for
a state, expose coverage unavailable. An alternative finite partition or
placement needs an explicit argument for complete query coverage, contained
guarded queries, retained metric anchors where needed, bounded paint windows
and finite traversal, as well as the chosen-placement query-equivalence
support premise. A guard alone cannot discharge that premise. Do not invent
an unbounded placement search, retry loop or cutoff to bridge an unknown.

Every possible exterior pixel has exactly one owning query in the partition.
Read only that query's owned exterior pixels for the verdict, using their
original absolute rows and the unchanged vertical clip. Extra pixels in an
overlapping paint window, including other queries' pixels and interior rows,
do not gain ownership or change classification. If an equivalent construction
uses overlapping query readings, it must assign each absolute exterior pixel
one owner and neither omit it nor count it as a different row after translation.
Reuse the bounded canvas and readback between placements; do not accumulate
rasters or a pixel ownership array. Ownership follows from the finite partition.

An envelope wholly inside the vertical clip establishes fit conditional on P1
without raster observation. Otherwise account for the finite envelope completely
at the original raster resolution. Any nonzero-alpha pixel outside the vertical
clip establishes nonfit and permits early termination for that candidate.
Fit requires complete coverage of the possible exterior ink; interior pixels
cannot affect this verdict, so observing only the envelope's exterior regions
is permitted. Do not treat the envelope's excess height itself as nonfit.

The concrete partition has at most
`ceil(E.width / (4096 - 2)) * ceil(E.height / (32 - 2))` queries, with no
observations needed for wholly interior queries. Traversal has a finite bound
determined by the envelope and query dimensions, including partial queries.
There is no open-ended border-growth retry, fixed tile-count cutoff
or title-length cap. Bounds, origins, translated coordinates and traversal
counts must remain finite and safely representable within the supported host's
numeric/raster coordinate range. Missing, nonfinite, inconsistent or unusable
metrics do not establish empty ink or fit. Zero actual bounds alone do not
establish empty raster; account for the expanded envelope.

Fixed scratch does not imply linear CPU. If observation visits N tiles and a
complete-string host operation costs S, its work may include N times S per
candidate. With advance proportional to input size this can be quadratic;
the existing prefix-truncation work must also be included in performance
assessment. Neither a browser cache nor an expected early nonfit witness is a
worst-case work guarantee. Before landing, bounded public-render measurements
must demonstrate acceptable added fit and total-render cost against unchanged
behavior on long ordinary and fallback requests, including fitting requests
that require complete traversal. Preserve the measured costs and obtain an
explicit integration/review disposition. Do not turn a performance concern into
silent input rejection, incomplete observation or weakened alpha semantics.

## Measurement and publication consumers

The procedural callback retains its own placement contract: `pass.x` is the
text pen, `pass.y` is the alphabetic baseline, `pass.clip` is the destination
clip, and `pass.truncateTo` is that pass's own horizontal limit (undefined
means no truncation). Raster padding/cropping must preserve that pen and
baseline when compositing into the destination. Preserve the same advance
(`ceil(measureText(text).width)`) and `fontAscent`/`fontDescent` metrics used by
procedural geometry. Those font metrics remain
`ceil(fontBoundingBoxAscent || nominalAscent)` and
`ceil(fontBoundingBoxDescent || max(0, ceil(actualBoundingBoxDescent || 0)))`;
they are distinct from raster/crop offsets.

Keep the current preferred-font policy: nonutility procedural titles request
12 pixels and use the available Charcoal 12 face at its preferred 16-pixel grid
with zero spacing; otherwise they use the Charcoal, Helvetica Neue, Arial,
sans-serif stack at the requested size with 0.5-pixel spacing. Utility titles
use exact 10-pixel sizing, bypass the Charcoal 12 pin, and retain that latter
stack and spacing. Procedural titles retain their current plain face. Recipe
titles use the same preferred-font policy with their requested size and required
face, followed by the recipe fit rules above. Do not apply recipe TF2–TF6 size
reduction to procedural consumers.

Keep procedural truncation unchanged: retain the whole title when its advance
fits the pass limit; otherwise shorten the existing UTF-16 prefix from the end
until prefix plus ellipsis fits, returning no text if none fits. This pass
policy remains distinct from TF1's code-point-prefix and ellipsis-alone rule.

Recipe and procedural measurement, advance acquisition and truncation decisions
must be metrics-only operations. They must not allocate full requested-title
bitmaps merely to obtain advance, ascent or font metrics. Coverage needed for
recipe style selection uses the bounded observation above.

Window-title paint scratch/readbacks must be bounded by the actual destination
clip/output and fixed observation scratch, rather than by the full untruncated
advance. Final window/frame storage may follow the requested window dimensions;
that inherently sized output is separate from coverage scratch. Preserve each
consumer's own baseline, font policy, geometry, colours and clipping.

Published glyph coverage must not lose rows or overhang that were accounted for
during fit solely because an intermediate raster used narrower measured bounds.
Coverage padding/crop origins remain explicit in placement: they must not be
mistaken for the public pen, baseline or framebuffer origin. Complete-request
shaping is required for coverage fitting; final painting retains existing
displayed-prefix/marker shaping and clipping semantics with the resolved style.

A separately live, explicitly requested full-text raster output may remain
proportional to the requested output dimensions. It must not be used as hidden
pretruncation observation or measurement storage. Preserve such a consumer's
placement contract when correcting coverage. If no live/public consumer needs
that output, retirement requires an explicit caller audit; do not keep a private
full-raster path solely to evade the scratch bound. Input strings and opaque
browser shaping metadata may scale with input size; this contract does not
claim constant total memory including input, output and host internals.

## Coverage unavailable

Unusable metrics or coordinates, unsupported observation state, known breach
of either P1's envelope or chosen-placement query equivalence, inability to
establish a finite safe placement/query construction for the state, and host
allocation/readback/security failure yield a distinct coverage-unavailable
failure. A known culled or otherwise unusable placement cannot supply a fit or
nonfit verdict, including when its readback is transparent. Do not reinterpret
unavailable coverage as nonfit, empty ink, TF5,
successful clipping, a smaller fitting style or an automatic metrics-only
fallback. Do not retry indefinitely. A caller may distinguish this failure
from a successfully resolved impossible slot.

Use the existing error/throw/rejection convention of the consuming operation;
do not add a general new configuration or transaction API. A failed render/update
must not publish a partially resolved style or replace a prior successful
render/accessibility result outside the existing update transaction semantics.
No successful new result is returned on first-render failure. Requested title
data is not shortened or rewritten.

Existing non-DOM and unavailable-Canvas-context fallback behavior remains
unchanged. It is not a new coverage-unavailable branch merely because Canvas
is absent. Successful supported rendering retains the established behavior
specified above; unsupported/failed observation is the distinct failure path.
