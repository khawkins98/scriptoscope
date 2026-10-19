# Scoped public-API face observations

Scope ID `public-api-empty-face` is an additive eligibility path
within the [existing reference intake](../../tests/reference-captures/README.md).
It admits no records itself. Request draft **0.3.0** preserves all thirteen earlier exact
request objects and the existing compatibility authority, and appends 46 fixed
campaign requests. Each request digest binds
the applicable scope definition, claim, associated IDs and exclusions.

Version **1** remains unchanged for `windows-95.normal` and
`system7-nostalgia-silver.normal`: empty title, enabled normal control in an
active window, no default API requested, fixed port Rect (20,20,80,20), native
scale, white opaque background and the original port/context. This records a
public `NewControl` / `Draw1Control` invocation's visible result, with recorded
procedure/variant/hilite/value all zero and no default API invoked. It does not
infer private control flags,
selected resource providers or painters from the public state.

Version **2** is available only for the existing `windows-95.pressed`,
`windows-95.inactive`, `system7-nostalgia-silver.pressed` and
`system7-nostalgia-silver.inactive` requests. Their geometry, empty title,
background, context and provenance requirements remain the same. Each records
`NewControl` / `Draw1Control`, procedure/variant/value0 and the actual state API
`HiliteControl`:

| Request state | Observed hilite | Enabled | Window active | Bounded observation |
|---|---:|---|---|---|
| `pressed` | 10 | true | true | Logical control highlight after `HiliteControl(10)` |
| `inactive` | 255 | false | true | Disabled control after `HiliteControl(255)` |

Neither state establishes a physical mouse gesture or an inactive window; v2
explicitly excludes both claims. `invocation.stateApi` must be `HiliteControl`,
and the observed control-definition hilite must match the request's v2 scope.
The public normal v1 scope, its request digests and existing records remain exact.
The original v2 addition retained catalog version 0.2.0 and all thirteen request
objects. Only those four requests gained v2 scope-bound digests;
previous attestations cannot silently acquire v2 eligibility. Four existing v10 observations are separately reviewed under this scope;
the validator does not generate original evidence.

## Later finite scopes and the fixed-state campaign

Version **3** remains limited to `crayon-os.normal`; version **4** remains
limited to `apple-lisa.normal`. These conditioned observations retain an explicit
unknown original pattern origin. They do not establish original pattern phase,
provider or cache state. Their earlier capture/review/request bindings remain
unchanged.

Version **5** applies only to the 46 new IDs enumerated by the contract across
18 canonical sources and three fixed empty-push states. Together with the eight
old requests this makes 54 campaign requests; five older default/shift requests
remain separate. V5 requires actual `HiliteControl` and hilite 0/10/255 for
normal/logically highlighted/disabled controls, procedure/variant/value 0, an
active window, no default API, full port clip and explicit unknown original
pattern origin. Every case has face (20,20,80,20) in port (0,0,160,80), an empty
title and opaque white background. No physical gesture or inactive window is
inferred. Missing future captures stay missing.

The semantic digest includes only the applicable scope and policy section;
adding v5 preserves every old request object, eight capture/review records and
their digests. `campaign-retention.json` and focused rejection/retention tests
pin that boundary. Full admission, earlier v1–v4 scopes and the compatibility
authority are unchanged. Capture approval and renderer equality remain separate
steps: palette/gamma/device/producer joins and whole-load mapping coverage must
justify profile reuse before comparison, without interpolating new mappings.

## Fixed comparison extent and limits

`capture.reviewScope` must exactly equal the versioned definition returned by
`publicFaceScope(request)`:

- Comparison layer: `composited-face-pixels`.
- Complete face in port and request image: `[20,20,80,20]`.
- Associated requirements: `geometry.remaining` and `fill.remaining`.
- Claim: recorded composited pixels under the observed invocation, environment
  and background, not the entirety of either associated requirement.
- Excluded claims: alpha/mask, font independence, automatic sizing, other states,
  outside-face margins, default ring, private resource/painter selection,
  provider/cache/search order, whole requirements and whole request.

Keep the full **160×80 request image**, its original **96×36 context crop**, and
the complete original frame. Do not submit only the face or a convenient subset.
`observed.publicApiFace.fullFrame` binds the full-frame PNG hash/dimensions,
`requestImageRect` within that frame, and the explicit pixel-preserving crop
transform. The frame may be larger than the request image. For example, a port
at frame origin (80,90) places the face at frame (100,110), while the face remains
(20,20) in the 160×80 request image. The validator checks bounds/transforms and
hashes; independent review must establish the actual image extraction and
recorded pixel provenance. It does not perform a renderer comparison.

One opaque white background cannot distinguish transparent mask pixels from
white source pixels. Exact fixed-size pixels cannot establish font independence,
automatic layout, other states or internal painter identity. Those limits remain
bound even if the observation happens to match Scriptoscope exactly.

## Relevant observations and artifact joins

The existing source/archive/fork pins, original OS and Kaleidoscope installation
identities, control procedure/variant/hilite/value/enabled/window-active/default
invocation, capture log, image hash and exact environment manifest remain
required. The scoped path additionally records `observed.publicApiFace`:

| Field | Required observation |
|---|---|
| `configuredScheme` | Matching archive/fork hashes and evidence of the configured scheme file; this is not selected-provider attribution |
| `invocation` | Actual public creation/draw APIs, exact control Rect, empty title, matching request state, v2/v5 `stateApi:HiliteControl`, and `defaultRing:false` |
| `port` | Exact origin/bounds, effective full-port clip, recorded RGB background and opaque composited-background condition |
| `producer` | Name, exact external build identities, producer table hash, RGBA8 encoding, recorded color realization and measurement timing |
| `fullFrame` | Original complete frame hash/dimensions and request-image extraction Rect/transform |

A semantic producer release may remain `{status:"unknown", reason:"…"}` when
exact external builds are identified by name and hash. Otherwise record `{status:"observed", value:"…"}`.
Do not invent a release from a build hash. Record when palette/producer conditions
were observed: measurements after drawing must not be relabeled as pre-draw or
as a bracket around drawing. No universal color-transfer algorithm is inferred.

The existing artifact mechanism binds `configured-scheme`, `public-invocation`
and `pixel-conditions` JSON to those observations. The latter two contain exactly
`{controlDefinition, invocation, port, fullFrame}` and `{palette, producer}`.
`producer-identities` JSON must match the named external build-hash list; the
intake does not require emulator executables or OS binaries. `indexed-palette`,
`producer-table` and `full-frame` artifact hashes must match their observed identities. These are intake-relative files,
not new embedded engine payloads. Capture logs and full environment manifests
remain required. Duplicate scoped roles, drifted bytes and known self-image
contamination reject eligibility.

Font, patch stack, base chain, search order, selected provider, resource cache
and private default state
must each be recorded honestly. An unobserved field is explicitly `null` with a
nonempty `observed.unknownConditions[field]` reason. Omission is incomplete.
Supplied observed identities retain validation; an unknown reason cannot excuse
an incomplete claimed identity. Unknowns and their reasons are digest-bound and
reported. The scope excludes their dependent claims even when some identities
are available. Private default state must remain explicitly unknown in this scope;
`defaultApiInvoked:false` records public action, not a private flag. No new guest
experiment is implied by an unknown field.

## Review and result semantics

The independent review must repeat the exact `reviewScope`, capture/request
digests and associated target IDs. Its scoped checks cover original environment,
installation/configured source, public invocation, recorded pixel conditions,
conditions/transform, image/artifacts, independence and scope/limits. Capture
producer and reviewer must differ; the review file remains a trust input rather
than authenticated proof of independence.

An accepted eligible record reports `reviewed-scoped-observation`, with
`verifiedRequirementIds: []`, all five original `unresolvedRequirementIds`,
explicit exclusions and unresolved conditions. The request stays
`evidence-incomplete`; its separate `scopedEligibleObservations` names the usable
observations. Neither broad geometry/fill requirement becomes verified, and no
ledger changes occur. Other request obligations and unobserved conditions remain
visible instead of becoming a completion percentage.

Omitting `reviewScope` retains the old full-admission path. Explicit
`{id:"full",version:1}` uses that same strict path. Both still require font,
patch/base/provider and all prior review checks, including for pressed/inactive
requests. Default-ring and nonzero-origin full-admission gates are unchanged. Unknown scope IDs, expanded face
regions/claims, stale versions or a review with different scope reject intake.
Actual capture/review additions require a separate evidence review. The
[current corpus](../../tests/reference-captures/ORIGINALS.md) lists the twelve separately reviewed scoped observations, with every broader target unresolved.
