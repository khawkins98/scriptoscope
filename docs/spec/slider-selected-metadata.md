# Slider groove metadata follows selected art

`composeSliderWithLayout` resolves a self-owned requested-state groove, then
falls back to the active groove. Both the decoded raster and its `slice.corner`
and `slice.tile` must come from that actual selection. Previously the fallback
raster was paired with a fresh lookup of the absent requested slot, which used
the default cap clamp and disabled tiling instead of the selected cinf values.

The loader now retains the selected element alongside its decoded buffer. This
changes only the association used by the existing groove compositor. Requested
state selection, self-only fallback, abort checks, thumb selection, layout,
normalized value placement and native input behavior are unchanged.

## Bounded acceptance

The owned serialized fixture has an asymmetric seven-color groove, three pixels
across, with opaque masks and endpoint palette colors. The active cinf requests
one-pixel caps and a tiled middle; a present requested-state cinf instead requests
two-pixel caps and a stretched middle. No thumb is supplied. At length 32,
independently literal color runs distinguish both metadata choices.

The public source/built tests cover both axes, missing/present pressed and
inactive grooves (including the disabled public state), and a normal control.
They compare complete 96-pixel planes and join the observed decode URL to the
actual selected manifest key, load ID, cicn/cinf occurrence, signed ID and payload
hash. They do not infer a paint trace that the API does not expose.

This is a modern selected-input consistency correction. The same-owner fallback
and three-slice policy are explicit compatibility assumptions. It does not prove
native state fallback, provider order, original mask/device behavior or slider
endpoints. In particular, the independently identified CDEF 3 layout cinf is a
separate group-base resource; selected groove cinf must not be substituted for
that native endpoint/layout input without a separately established contract.
